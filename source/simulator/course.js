// The tutorial "Three heroes downhill": the tale of three optimisers told as one line of steps.  The reader only
// clicks Next.  Each step is a line or two of the story, its formula with real numbers, and an animation on the map
// of the land.  The lands and the walks come from engine.js; the drawing kit, the step player and the day-by-day steps
// (feeling the slope, the Pilgrim's stride, the Cartographer's journal, the Twins' day) from board.js and
// board_parts.js.
(function () {
  'use strict';
  var E = window.Engine, B = window.Board; if (!E || !B) return;
  var H = B.H, C = H.C, seg = H.seg, num = H.num, pair = H.pair, at = H.at, add = H.add, sub = H.sub, dot = H.dot, len = H.len;
  var scale = H.scale, mix = H.mix, lerp2 = H.lerp2, around = H.around, ease = H.ease, clamp = H.clamp, TAU = 2 * Math.PI;
  var NAMES = { pg: 'the Pilgrim', lb: 'the Cartographer', tw: 'the Wanderer' }, COL = { pg: C.orange, lb: C.blue, tw: '#e6e9ee' };

  // ------------------------------------------------------------ lands and walks, as the game computes them
  function world(key, over) {
    var p = {}, k; for (k in E.PRESETS[key]) p[k] = E.PRESETS[key][k]; for (k in (over || {})) p[k] = over[k];
    var K = E.KINDS[key], land = E.buildLand(key, p), x0 = K.kind === 'tower' && p.sx == null ? E.lanternStart(p) : [p.sx, p.sy], D = Math.round(p.days);
    var W = { key: key, p: p, K: K, land: land, x0: x0, view: K.view, T: land.treasure,
              walks: { pg: E.pilgrim(land, x0, p.alpha, D), lb: E.cartographer(land, x0, Math.round(p.m), D), tw: E.twins(land, x0, p.rho, D) } };
    var v = K.view, lo = Infinity, hi = -Infinity, sm = land.smooth || land.J;
    for (var i = 0; i <= 40; i++) for (var j = 0; j <= 40; j++) { var z = sm([v[0] + (v[1] - v[0]) * i / 40, v[2] + (v[3] - v[2]) * j / 40]); lo = Math.min(lo, z); hi = Math.max(hi, z); }
    W.shade = { id: key + JSON.stringify(over || {}), lo: lo, hi: hi, pits: !!land.holes, rings: 14 };
    W.Jstar = land.J(W.T);
    return W;
  }
  function ctxOf(W, hero, day) { return { hero: hero, name: NAMES[hero], key: W.key, L: { view: W.view, kind: W.K.kind }, land: W.land, p: W.p, x0: W.x0, day: day, walk: W.walks[hero], tutorial: true }; }
  // steps of the day-by-day board, renamed into the course's chapter
  function pick(W, hero, day, ids, chapter) {
    var all = B.plan(ctxOf(W, hero, day)).steps;
    return ids.map(function (id) {
      var s = all.filter(function (q) { return q.id === id; })[0]; if (!s) throw new Error('no step ' + id);
      var c = {}, k; for (k in s) c[k] = s[k]; c.id = W.key + '-' + hero + '-' + id; c.chapter = chapter; return c;
    });
  }
  function firstWithin(walk, T, tol, key) { for (var k = 0; k < walk.length; k++) { var q = walk[k][key || 'x']; if (Math.hypot(q[0] - T[0], q[1] - T[1]) <= tol) return k; } return null; }

  // ------------------------------------------------------------ drawing helpers for the story steps
  function base(g, W, o) {
    o = o || {}; var sh = {}, k; for (k in W.shade) sh[k] = W.shade[k]; if (o.alpha != null) sh.alpha = o.alpha;
    g.land(W.land.J, sh); g.axes();
    var b = W.land.box;
    if (b && W.K.kind === 'quad' && o.law !== false) g.path([[b[0], b[0]], [b[1], b[0]], [b[1], b[1]], [b[0], b[1]], [b[0], b[0]]], C.blue, 2, o.lawP == null ? 1 : o.lawP);
    if (W.K.kind === 'tower' && o.law !== false) g.line(W.land.lawSegment[0], W.land.lawSegment[1], C.blue, 2, 1, [6, 4]);
  }
  function star(g, q, p, text) {
    if (!(p > 0)) return; var c = g.ctx, a = g.P(q), r = 11 * H.backOut(p);
    var gl = c.createRadialGradient(a[0], a[1], 0, a[0], a[1], 30); gl.addColorStop(0, 'rgba(255,210,122,0.55)'); gl.addColorStop(1, 'rgba(255,210,122,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(a[0], a[1], 30, 0, TAU); c.fill();
    c.beginPath(); for (var i = 0; i < 10; i++) { var an = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(a[0] + rr * Math.cos(an), a[1] + rr * Math.sin(an)); }
    c.closePath(); c.fillStyle = '#ffd27a'; c.fill(); c.strokeStyle = '#8a4b00'; c.lineWidth = 1.2; c.stroke();
    if (text) g.label(q, text, C.gold, { dx: 16, dy: 14, p: seg(p, 0.4, 1), size: 12.5 });
  }
  // a walk drawn up to a fractional day; returns where its hero stands then
  function walkTo(g, walk, upto, col, w, key) {
    key = key || 'x'; var n = Math.min(walk.length - 1, Math.floor(upto)), f = clamp(upto - n, 0, 1), pts = [];
    for (var k = 0; k <= n; k++) pts.push(walk[k][key]);
    var now = n < walk.length - 1 ? lerp2(walk[n][key], walk[n + 1][key], ease(f)) : walk[n][key];
    pts.push(now); g.path(pts, col, w || 2.5, 1);
    for (k = 1; k <= n; k++) g.dot(walk[k][key], 2.8, col, 1);
    return now;
  }
  // the height of a walk, day by day, on a log scale: log10(J − J*)
  function chart(g, R, series, upto, title) {
    var D = 0, lo = Infinity, hi = -Infinity;
    series.forEach(function (s) { D = Math.max(D, s.days); for (var k = 0; k <= Math.min(s.days, s.walk.length - 1); k++) { var v = s.val(k); lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    lo = Math.max(lo, -9); var pad = (hi - lo) * 0.08 || 1, pl = g.plot(R, [0, D], [lo - pad, hi + pad], { title: title || 'height above the treasure, J − J*, day by day (log scale)' });
    pl.frame('day', 'log₁₀(J − J*)');
    series.forEach(function (s) {
      var f = function (t) { var k = Math.min(Math.floor(t), s.walk.length - 1), k2 = Math.min(k + 1, s.walk.length - 1), u = t - Math.floor(t); return Math.max(lo - pad, s.val(k) * (1 - u) + s.val(k2) * u); };
      pl.curve(f, s.col, 2.2, clamp(upto / D, 0, 1));
      var tEnd = Math.min(upto, D), yEnd = f(tEnd); if (s.mark != null && upto >= s.mark) pl.point(s.mark, f(s.mark), s.col, s.name + ': day ' + s.mark, 1, s.mark > D * 0.6 ? 'left' : 'right');
      void yEnd;
    });
  }
  function series(W, hero, days, key, mark, name) {
    var w = W.walks[hero], J = W.land.J, Js = W.Jstar;
    return { walk: w, days: days, col: COL[hero], mark: mark, name: name || NAMES[hero].replace('the ', ''), val: function (k) { var q = w[Math.min(k, w.length - 1)][key || 'x']; return Math.log(Math.max(J(q) - Js, 1e-9)) / Math.LN10; } };
  }

  // ------------------------------------------------------------ the self-checking light board
  // A 2-by-2 picture is extended by one parity lamp per row and column.  The result is a small product code:
  // every one of the nine lamps belongs to one row check and one column check.  The fixed-evidence trace below is
  // computed here, rather than drawn from hand-picked positions, so the syndrome/residual comparison stays honest.
  var LIGHT_CHECKS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8]];
  var LIGHT_VALID = [1, 0, 1, 1, 1, 0, 0, 1, 1];
  var LIGHT_GLOW = [0.8000, 0.2500, 0.7750, 0.7750, 0.4500, 0.5300, 0.2500, 0.5625, 0.7500];
  // Bit-zero channel LLR: negative evidence favours a lit lamp (bit 1).
  var LIGHT_LLR = LIGHT_GLOW.map(function (y) { return 4 * (0.5 - y); });
  function lightHard(v) { return v.map(function (x) { return x >= 0.5 ? 1 : 0; }); }
  function lightSyndrome(bits) {
    return LIGHT_CHECKS.map(function (ch) { return ch.reduce(function (s, i) { return s + bits[i]; }, 0) % 2; });
  }
  function projectEven(v) {
    var out = v.map(function (x) { return clamp(x, 0, 1); });
    var signs = out.map(function (x) { return x > 0.5 ? 1 : -1; });
    var positive = signs.filter(function (s) { return s > 0; }).length, closest = 0, closestDistance = Infinity;
    out.forEach(function (x, i) { var d = Math.abs(x - 0.5); if (d < closestDistance) { closestDistance = d; closest = i; } });
    if (positive % 2 === 0) { signs[closest] = -signs[closest]; positive += signs[closest] > 0 ? 1 : -1; }
    var bound = positive - 1, violation = -bound;
    signs.forEach(function (s, i) { violation += s * out[i]; });
    if (violation <= 0) return out;
    var lo = 0, hi = Math.max.apply(null, v.map(Math.abs)) + 1;
    for (var k = 0; k < 52; k++) {
      var lambda = (lo + hi) / 2, residual = -bound;
      signs.forEach(function (s, i) { residual += s * clamp(v[i] - lambda * s, 0, 1); });
      if (residual > 0) lo = lambda; else hi = lambda;
    }
    var lm = (lo + hi) / 2;
    return v.map(function (x, i) { return clamp(x - lm * signs[i], 0, 1); });
  }
  function lightADMM(rounds) {
    var rho = 3, beta = 0.6, edges = LIGHT_LLR.map(function () { return []; });
    LIGHT_CHECKS.forEach(function (ch, a) { ch.forEach(function (bit, j) { edges[bit].push([a, j]); }); });
    var b = LIGHT_LLR.map(function (ell) { return ell < 0 ? 1 : 0; });
    var z = LIGHT_CHECKS.map(function (ch) { return projectEven(ch.map(function (i) { return b[i]; })); });
    var u = LIGHT_CHECKS.map(function (ch) { return ch.map(function () { return 0; }); });
    var trace = [{ b: b.slice(), z: z.map(function (q) { return q.slice(); }), u: u.map(function (q) { return q.slice(); }), syndrome: lightSyndrome(lightHard(b)), primal: null, dual: null }];
    for (var round = 1; round <= rounds; round++) {
      b = b.map(function (old, bit) {
        var consensus = edges[bit].reduce(function (s, e) { return s + z[e[0]][e[1]] - u[e[0]][e[1]]; }, 0);
        return clamp((rho * consensus - LIGHT_LLR[bit] - beta) / (rho * edges[bit].length - 2 * beta), 0, 1);
      });
      var oldZ = z.map(function (q) { return q.slice(); }), primal2 = 0, dualSum = b.map(function () { return 0; });
      LIGHT_CHECKS.forEach(function (ch, a) {
        var next = projectEven(ch.map(function (bit, j) { return b[bit] + u[a][j]; }));
        ch.forEach(function (bit, j) {
          dualSum[bit] += next[j] - oldZ[a][j];
          z[a][j] = next[j];
          var r = b[bit] - z[a][j]; u[a][j] += r; primal2 += r * r;
        });
      });
      var primal = Math.sqrt(primal2 / 18), dual = rho * Math.sqrt(dualSum.reduce(function (s, x) { return s + x * x; }, 0) / 9);
      trace.push({ b: b.slice(), z: z.map(function (q) { return q.slice(); }), u: u.map(function (q) { return q.slice(); }), syndrome: lightSyndrome(lightHard(b)), primal: primal, dual: dual });
    }
    return trace;
  }
  var LIGHT_TRACE = lightADMM(8);

  function lamp(g, x, y, r, value, p, label, hard) {
    if (!(p > 0)) return; var c = g.ctx, q = clamp(p, 0, 1), v = clamp(value, 0, 1);
    c.globalAlpha = q; c.fillStyle = 'rgba(242,245,248,0.06)'; c.strokeStyle = C.faint; c.lineWidth = 1.5;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.stroke();
    if (v > 0.01) {
      var gl = c.createRadialGradient(x, y, 0, x, y, r * 1.7); gl.addColorStop(0, 'rgba(255,226,150,' + (0.32 + 0.62 * v) + ')'); gl.addColorStop(0.58, 'rgba(255,210,122,' + (0.18 + 0.62 * v) + ')'); gl.addColorStop(1, 'rgba(255,210,122,0)');
      c.fillStyle = gl; c.beginPath(); c.arc(x, y, r * 1.7, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,210,122,' + (0.12 + 0.78 * v) + ')'; c.beginPath(); c.arc(x, y, r * 0.72, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    if (label != null) g.labelPx(x, y, String(label), v > 0.45 ? '#241805' : C.ink, { align: 'center', plain: true, mono: true, size: Math.max(10, r * 0.8), p: q });
    if (hard != null) g.labelPx(x + r * 0.76, y + r * 0.76, String(hard), hard ? C.gold : C.dim, { align: 'center', plain: false, mono: true, size: 9.5, p: q });
  }
  function lightBoard(g, R, values, o) {
    o = o || {}; var c = g.ctx, title = o.title || '', p = o.p == null ? 1 : o.p;
    if (o.panel !== false) g.panel(R, title);
    var top = R[1] + (title ? 35 : 8), usableH = R[3] - (title ? 45 : 16), cell = Math.min(72, (R[2] - 88) / 3, (usableH - 58) / 3);
    cell = Math.max(34, cell); var bw = 3 * cell, bh = 3 * cell, x0 = R[0] + (R[2] - bw - 55) / 2, y0 = top + (usableH - bh - 40) / 2;
    var syn = o.syndrome || lightSyndrome(lightHard(values)), hbits = o.hard || null;
    if (o.payload) {
      c.globalAlpha = seg(p, 0.05, 0.3); c.strokeStyle = C.gold; c.lineWidth = 2; c.setLineDash([5, 4]); c.strokeRect(x0 + 3, y0 + 3, 2 * cell - 6, 2 * cell - 6); c.setLineDash([]); c.globalAlpha = 1;
      g.labelPx(x0 + cell, y0 - 8, '2 × 2 picture', C.gold, { align: 'center', plain: true, size: 10.5, p: seg(p, 0.1, 0.35) });
    }
    if (o.highlightRow != null) { c.globalAlpha = 0.16 * seg(p, 0.1, 0.35); c.fillStyle = C.blue; c.fillRect(x0 - 5, y0 + o.highlightRow * cell + 3, bw + 10, cell - 6); c.globalAlpha = 1; }
    if (o.highlightCol != null) { c.globalAlpha = 0.16 * seg(p, 0.2, 0.45); c.fillStyle = C.violet; c.fillRect(x0 + o.highlightCol * cell + 3, y0 - 5, cell - 6, bh + 10); c.globalAlpha = 1; }
    for (var i = 0; i < 9; i++) {
      var row = Math.floor(i / 3), col = i % 3, reveal = o.cellP ? o.cellP(i, p) : p;
      if (o.payload && (row === 2 || col === 2)) reveal *= seg(p, row === 2 && col === 2 ? 0.58 : 0.35, row === 2 && col === 2 ? 0.86 : 0.65);
      lamp(g, x0 + (col + 0.5) * cell, y0 + (row + 0.5) * cell, cell * 0.27, values[i], reveal, o.showValues ? num(values[i], 2) : null, hbits ? hbits[i] : null);
    }
    for (var r = 0; r < 3; r++) {
      var bad = !!syn[r], rp = seg(p, 0.48 + r * 0.06, 0.72 + r * 0.06);
      g.labelPx(x0 + bw + 16, y0 + (r + 0.5) * cell, 'R' + (r + 1) + ' ' + (bad ? '×' : '✓'), bad ? C.red : C.green, { plain: true, mono: true, size: 11.5, p: rp });
    }
    for (var cc = 0; cc < 3; cc++) {
      var cbad = !!syn[3 + cc], cp = seg(p, 0.58 + cc * 0.06, 0.82 + cc * 0.06);
      g.labelPx(x0 + (cc + 0.5) * cell, y0 + bh + 17, 'C' + (cc + 1) + (cbad ? '×' : '✓'), cbad ? C.red : C.green, { align: 'center', plain: true, mono: true, size: 11.5, p: cp });
    }
    return { x: x0, y: y0, cell: cell, w: bw, h: bh };
  }
  function patternCards(g, R, p) {
    g.panel(R, 'One even-parity check'); var c = g.ctx, narrow = R[2] < 560, cols = narrow ? 2 : 4, rows = narrow ? 2 : 1;
    var gap = 10, top = R[1] + 38, cw = (R[2] - 24 - gap * (cols - 1)) / cols, ch = (R[3] - 52 - gap * (rows - 1)) / rows;
    [[0, 0], [0, 1], [1, 0], [1, 1]].forEach(function (bits, i) {
      var q = seg(p, 0.08 + i * 0.13, 0.34 + i * 0.13), col = i % cols, row = Math.floor(i / cols), x = R[0] + 12 + col * (cw + gap), y = top + row * (ch + gap), pass = bits[0] + bits[1] !== 1;
      c.globalAlpha = q; c.fillStyle = 'rgba(255,255,255,0.035)'; c.strokeStyle = pass ? C.green : C.red; c.lineWidth = 2; c.fillRect(x, y, cw, ch); c.strokeRect(x, y, cw, ch); c.globalAlpha = 1;
      var cy = y + ch * 0.46, rr = Math.min(22, cw * 0.13, ch * 0.18); lamp(g, x + cw * 0.36, cy, rr, bits[0], q); lamp(g, x + cw * 0.64, cy, rr, bits[1], q);
      g.labelPx(x + cw / 2, y + ch * 0.76, bits.join('') + '  ' + (pass ? 'PASS · even' : 'FAIL · odd'), pass ? C.green : C.red, { align: 'center', plain: true, mono: true, size: narrow ? 10.5 : 11.5, p: q });
    });
  }

  // ------------------------------------------------------------ the course
  var Wc = world('canyon'), Wlong = world('canyon', { alpha: 0.22 }), Ww = world('wall'), Wm = world('misty');
  var out = [], CH = { land: 'The King’s land', feel: 'Feeling the slope', pg: 'The Pilgrim: gradient descent', lb: 'The Cartographer: L-BFGS', tw: 'The Twins: ADMM and the King’s law', light: 'The self-checking light board', cajode: 'From the light board to CAJODE', misty: 'The misty hills', end: 'What we learned' };
  var T = Wc.T, x0 = Wc.x0, A = Wc.land.A, c = Wc.land.c, pc = Wc.p;

  // 1. the King's land
  out.push({ id: 'title', chapter: CH.land, title: 'Three heroes downhill', layout: 'map', view: Wc.view, dur: 4.2,
    text: 'Fog lies on the King’s land, and at its lowest spot he has hidden a treasure. Three heroes set out from the same flag to find it: the Pilgrim, the Cartographer and the Twins. Each finds its way down in its own manner, and each manner is a method computers use to solve problems.',
    math: '',
    draw: function (g, p) {
      base(g, Wc, { alpha: seg(p, 0, 0.5) }); g.flag(x0, seg(p, 0.35, 0.5)); g.label(x0, 'the start flag', C.ink, { dx: 18, dy: -22, p: seg(p, 0.45, 0.6) });
      [['pg', [-0.03, 0]], ['lb', [0, -0.035]], ['tw', [0.03, 0]]].forEach(function (h, i) { g.hero(add(x0, h[1]), h[0], seg(p, 0.5 + 0.1 * i, 0.62 + 0.1 * i), i === 0 ? '' : ''); });
      star(g, T, seg(p, 0.8, 1), 'the treasure');
    } });
  var probe = [[-0.15, 1.1], [0.25, 0.9], [0.55, 0.62], [0.95, 0.35], [1.15, -0.1]];
  function along(pts, t) { var n = pts.length - 1, s = clamp(t, 0, 1) * n, k = Math.min(Math.floor(s), n - 1); return lerp2(pts[k], pts[k + 1], s - k); }
  out.push({ id: 'land', chapter: CH.land, title: 'The land is a formula', layout: 'map', view: Wc.view, dur: 4.6,
    text: 'Every spot on the map is a pair of numbers, x = (x₁, x₂), and every spot has a height, J(x), given by the King’s formula. On the map, colour shows height, dark low and warm high, and each ring joins spots of the same height. Watch a probe read the height as it crosses the land.',
    math: 'J(x) = ½(x − c)ᵀA(x − c),  c = ' + pair(c, 2),
    draw: function (g, p) {
      base(g, Wc); var q = along(probe, seg(p, 0.1, 0.95));
      g.ring(Wc.land.J(q), C.gold, 2, seg(p, 0.1, 0.2)); g.dot(q, 6, C.gold, seg(p, 0.05, 0.15));
      g.label(q, 'x = ' + pair(q, 2) + '   J(x) = ' + num(Wc.land.J(q), 3), C.gold, { dx: 12, dy: -16, p: seg(p, 0.1, 0.2) });
    } });
  var flow = E.pilgrim(Wc.land, x0, 0.02, 600).map(function (q) { return q.x; });
  out.push({ id: 'goal', chapter: CH.land, title: 'The treasure is the lowest spot', layout: 'map', view: Wc.view, dur: 4.2,
    text: 'Finding the treasure means finding the spot where J is smallest. In the words of optimisation: minimise the cost J(x) over all x; the answer, x*, is called the minimiser. On this land, a long canyon, x* = ' + pair(T) + ' and J(x*) = 0.',
    math: 'x* = argmin<sub>x</sub> J(x) = ' + pair(T),
    draw: function (g, p) {
      base(g, Wc); g.flag(x0, 1); var n = Math.round(seg(p, 0.1, 0.8) * (flow.length - 1));
      g.path(flow.slice(0, n + 1), C.gold, 2.5, 1); g.dot(flow[n], 6, C.gold, 1); g.label(flow[n], 'J = ' + num(Wc.land.J(flow[n]), 3), C.gold, { dx: 12, dy: -14 });
      star(g, T, seg(p, 0.8, 1), 'x*, the treasure');
    } });
  out.push({ id: 'fog', chapter: CH.land, title: 'But the land lies in fog', layout: 'map', view: Wc.view, dur: 4,
    text: 'Nobody can see the land. A hero knows only what it measures where it stands. A computer program solving a problem is in the same place: it cannot look at the whole cost function, only work it out at the spots it tries. Every hero must find its way down from local measurements alone.',
    math: '',
    draw: function (g, p) {
      base(g, Wc); g.hero(x0, 'pg', 1);
      var ctx = g.ctx, R = g.mapR, a = g.P(x0), r = 40 + (1 - seg(p, 0.1, 0.8)) * Math.max(R[2], R[3]);
      ctx.save(); ctx.beginPath(); ctx.rect(R[0], R[1], R[2], R[3]); ctx.arc(a[0], a[1], r, 0, TAU, true); ctx.fillStyle = 'rgba(14,20,28,0.93)'; ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(242,245,248,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(a[0], a[1], r, 0, TAU); ctx.stroke(); ctx.restore();
      g.label(x0, 'all it can know: the ground under its feet', C.ink, { dx: 46, dy: -46, p: seg(p, 0.75, 0.95) });
    } });

  // 2. feeling the slope (the board's own steps, on the Pilgrim's first day)
  out = out.concat(pick(Wc, 'pg', 0, ['staff', 'four', 'ew', 'ns', 'grad'], CH.feel));

  // 3. the Pilgrim
  var wp = Wc.walks.pg, pgDays = firstWithin(wp, T, 0.01), u1 = [Math.cos(pc.theta * Math.PI / 180), Math.sin(pc.theta * Math.PI / 180)], u2 = [-u1[1], u1[0]];
  out.push({ id: 'pilgrim', chapter: CH.pg, title: 'The Pilgrim', layout: 'map', view: around([x0, wp[1].x, wp[2].x], 0.8, 0.5), dur: 4.4,
    text: 'The Pilgrim carries a staff and no memory. Every day it feels the slope, turns downhill and takes a stride whose length is a fixed share α of the slope. That is gradient descent, the simplest way down a land you cannot see.',
    math: 'x<sub>k+1</sub> = x<sub>k</sub> − α∇J(x<sub>k</sub>),  α = ' + num(pc.alpha, 2),
    draw: function (g, p) {
      base(g, Wc); g.flag(x0, 1); var gk = wp[1].g, gl = len(gk) || 1, A0 = g.P(x0);
      if (p > 0.15) g.arrowPx(A0, [A0[0] + gk[0] / gl * 60 * seg(p, 0.15, 0.35), A0[1] - gk[1] / gl * 60 * seg(p, 0.15, 0.35)], C.orange, 3);
      g.label(x0, '∇J, uphill', C.orange, { dx: gk[0] > 0 ? 50 : -110, dy: -30, p: seg(p, 0.3, 0.4) });
      g.arrow(x0, wp[1].x, C.ink, 3, seg(p, 0.45, 0.75)); g.label(lerp2(x0, wp[1].x, 0.5), '−α∇J', C.ink, { dx: 10, dy: -14, p: seg(p, 0.6, 0.75) });
      g.hero(lerp2(x0, wp[1].x, seg(p, 0.75, 0.95)), 'pg', 1, 'the Pilgrim');
    } });
  out = out.concat(pick(Wc, 'pg', 0, ['down', 'alpha', 'new'], CH.pg));
  out.push({ id: 'pgwalk', chapter: CH.pg, title: 'Day after day', layout: 'map+side', view: around(wp.slice(0, pgDays + 2).map(function (q) { return q.x; }), 0.3, 0.5), dur: 6,
    text: 'The Pilgrim repeats the same rule every day. It comes within 0.01 of the treasure on day ' + pgDays + '. Watch its path: it crosses the canyon from side to side, again and again, while it creeps along the canyon’s floor.',
    math: 'within 0.01 of x* on day ' + at(0.9, String(pgDays)),
    draw: function (g, p) {
      base(g, Wc); star(g, T, 1); var up = seg(p, 0, 0.95) * (pgDays + 1), q = walkTo(g, wp, up, C.orange, 2.5); g.hero(q, 'pg', 1, 'day ' + Math.min(Math.floor(up), pgDays + 1));
      chart(g, g.sideR, [series(Wc, 'pg', pgDays + 1, 'x', pgDays)], up);
    } });
  var zig = wp.slice(0, 13).map(function (q) { var d = sub(q.x, c); return [dot(d, u1), dot(d, u2)]; });
  out.push({ id: 'zigzag', chapter: CH.pg, title: 'Why it zigzags', layout: 'side', dur: 5,
    text: 'Split the Pilgrim’s distance from the treasure into the part along the canyon and the part across it. The canyon is ten times steeper across (λ₂ = ' + num(pc.l2, 0) + ') than along (λ₁ = ' + num(pc.l1, 0) + '). Each day the part along is multiplied by 1 − αλ₁ = ' + num(1 - pc.alpha * pc.l1, 2) + ', and the part across by 1 − αλ₂ = ' + num(1 - pc.alpha * pc.l2, 2) + ': the minus sign throws it to the other side every day. That is the zigzag. A stride short enough for the steep direction is far too short for the gentle one.',
    math: 'along: × (1 − αλ₁) = ' + at(0.3, num(1 - pc.alpha * pc.l1, 2)) + ';  across: × (1 − αλ₂) = ' + at(0.6, num(1 - pc.alpha * pc.l2, 2)),
    draw: function (g, p) {
      var R = g.sideR, h2 = (R[3] - 8) / 2;
      [[0, 'along the canyon (gentle, λ₁ = ' + num(pc.l1, 0) + ')', C.green], [1, 'across the canyon (steep, λ₂ = ' + num(pc.l2, 0) + ')', C.orange]].forEach(function (row, r) {
        var Rr = [R[0], R[1] + r * (h2 + 8), R[2], h2], vals = zig.map(function (z) { return z[row[0]]; }), m = Math.max.apply(null, vals.map(Math.abs)) * 1.15 || 1;
        var pl = g.plot(Rr, [0, 12], [-m, m], { title: row[1] }); pl.frame('day', ''); pl.seg(0, 0, 12, 0, C.faint, 1, 1);
        var upto = seg(p, 0.1 + 0.3 * r, 0.6 + 0.3 * r) * 12;
        for (var k = 0; k <= Math.floor(upto); k++) { pl.seg(k, 0, k, vals[k], row[2], 3, 1); pl.point(k, vals[k], row[2], '', 1); if (k) pl.seg(k - 1, vals[k - 1], k, vals[k], row[2], 1, 1, [3, 3]); }
      });
    } });
  var wl = Wlong.walks.pg, lostDay = wl.lost != null ? wl.lost : wl.length - 1, nShow = Math.min(12, wl.length - 1);
  out.push({ id: 'toolong', chapter: CH.pg, title: 'A stride too long', layout: 'map', view: around(wl.slice(0, nShow + 1).map(function (q) { return q.x; }), 0.2, 0.6), dur: 5,
    text: 'The share α has a limit. Across the canyon the daily factor is 1 − αλ₂; once α is above 2/λ₂ = ' + num(2 / pc.l2, 2) + ', that factor is below −1, and the zigzag grows instead of shrinking. With α = 0.22 the part across is multiplied by ' + num(1 - 0.22 * pc.l2, 2) + ' every day, and the Pilgrim is flung out of the canyon.',
    math: 'α = 0.22 > 2/λ₂ = ' + num(2 / pc.l2, 2) + ':  × (1 − 0.22·' + num(pc.l2, 0) + ') = ' + at(0.5, num(1 - 0.22 * pc.l2, 2)),
    draw: function (g, p) { base(g, Wc); star(g, T, 1); var up = seg(p, 0, 0.95) * nShow, q = walkTo(g, wl, up, C.red, 2.5); g.hero(q, 'pg', 1, 'day ' + Math.floor(up)); void lostDay; } });

  // 4. the Cartographer
  var wc2 = Wc.walks.lb, lbDays = firstWithin(wc2, T, 0.01);
  out.push({ id: 'carto', chapter: CH.lb, title: 'The Cartographer', layout: 'map', view: around([x0, wc2[1].x, wc2[2].x, T], 0.5, 0.5), dur: 4.4,
    text: 'The Cartographer also feels the slope with a staff, but it keeps a journal: its last m = ' + Math.round(Wc.p.m) + ' strides, each with how the slope changed over it. From those pages it learns the shape of the land, and bends its course toward the bottom instead of going straight downhill. It also tests candidate step lengths before it moves. This is L-BFGS, a quasi-Newton method.',
    math: 'x<sub>k+1</sub> = x<sub>k</sub> + t·d,  d = −H∇J',
    draw: function (g, p) { base(g, Wc); g.flag(x0, 1); star(g, T, 1); var up = seg(p, 0.1, 0.9) * 2, q = walkTo(g, wc2, up, C.blue, 3); g.hero(q, 'lb', 1, 'the Cartographer'); } });
  // Follow one complete day in causal order.  Day 2 starts at x_1, uses the first
  // journal page to choose d_1, accepts t_1, and creates the page (s_1, y_1).
  out = out.concat(pick(Wc, 'lb', 1,
    ['journal', 'read', 'tests', 'stride', 'page-stride', 'page-slopes', 'page-change', 'page-curve', 'newpage'], CH.lb));
  out.push({ id: 'race1', chapter: CH.lb, title: 'The Cartographer against the Pilgrim', layout: 'map+side', view: around(wp.slice(0, pgDays + 1).map(function (q) { return q.x; }), 0.3, 0.5), dur: 6,
    text: 'On the canyon the Cartographer is within 0.01 of the treasure on day ' + lbDays + '; the Pilgrim needs ' + pgDays + ' days. After a couple of strides its journal has learned the canyon’s shape, so it stops zigzagging and heads along the floor.',
    math: 'days to within 0.01 of x*:  Pilgrim ' + at(0.5, String(pgDays)) + ',  Cartographer ' + at(0.8, String(lbDays)),
    draw: function (g, p) {
      base(g, Wc); star(g, T, 1); var up = seg(p, 0, 0.95) * (pgDays + 1);
      var qp = walkTo(g, wp, up, C.orange, 2.2), ql = walkTo(g, wc2, Math.min(up, wc2.length - 1), C.blue, 3);
      g.hero(qp, 'pg', 1); g.hero(ql, 'lb', 1); g.labelPx(g.mapR[0] + 12, g.mapR[1] + 30, 'day ' + Math.min(Math.floor(up), pgDays + 1), C.gold, { size: 14 });
      chart(g, g.sideR, [series(Wc, 'pg', pgDays + 1, 'x', pgDays), series(Wc, 'lb', pgDays + 1, 'x', lbDays)], up);
    } });

  // 5. the Twins and the King's law
  var Tw = Ww.T, cw = Ww.land.c, wpw = Ww.walks.pg, wlw = Ww.walks.lb, wtw = Ww.walks.tw, tol = 0.001;
  var dPg = firstWithin(wpw, Tw, tol), dLb = firstWithin(wlw, Tw, tol), dTw = firstWithin(wtw, Tw, tol, 'z'), clipped = wpw.slice(1, dPg + 1).filter(function (q) { return q.clipped; }).length;
  var twEnd = wtw[wtw.length - 1], twPrev = wtw[Math.max(0, wtw.length - 2)], uEnd = twEnd.u, gStar = Ww.land.grad(Tw), uTheory = [-gStar[0] / Ww.p.rho, -gStar[1] / Ww.p.rho];
  var primalEnd = len(sub(twEnd.x, twEnd.z)), dualEnd = Ww.p.rho * len(sub(twEnd.z, twPrev.z)), wallView = [-0.3, 1.8, -0.55, 1.55];
  out.push({ id: 'wall', chapter: CH.tw, title: 'The kingdom wall', layout: 'map', view: wallView, dur: 4.6,
    text: 'On this land the King adds a law: the treasure must lie inside the wall, the square from 0 to 1 on each side. The bottom of the valley, c = ' + pair(cw, 2) + ', lies outside it, so the lowest lawful spot is on the wall itself, at x* = ' + pair(Tw) + '. In the words of optimisation the wall is a constraint: minimise J(x) with x in the set C.',
    math: 'minimise J(x) subject to x ∈ C = [0, 1]²;  x* = ' + at(0.8, pair(Tw)),
    draw: function (g, p) {
      base(g, Ww, { lawP: seg(p, 0.1, 0.45) }); g.dot(cw, 6, C.violet, seg(p, 0.45, 0.6)); g.label(cw, 'c, outside the wall', C.violet, { dx: 10, dy: 14, p: seg(p, 0.5, 0.65) });
      g.ring(Ww.land.J(Tw), C.gold, 2, seg(p, 0.6, 0.8)); star(g, Tw, seg(p, 0.75, 0.95), 'x*, on the wall');
    } });
  out.push({ id: 'pgwall', chapter: CH.tw, title: 'The Pilgrim at the wall', layout: 'map', view: wallView, dur: 5.4,
    text: 'The Pilgrim keeps its rule and adds one more: when a stride carries it outside the wall, it is set back to the nearest spot inside. That is projected gradient descent. It comes within 0.001 of the treasure on day ' + dPg + '; on ' + clipped + ' of those days the wall set it back.',
    math: 'x<sub>k+1</sub> = Π<sub>C</sub>(x<sub>k</sub> − α∇J(x<sub>k</sub>))',
    draw: function (g, p) {
      base(g, Ww); star(g, Tw, 1); var up = seg(p, 0, 0.95) * (dPg + 1), n = Math.floor(up);
      for (var k = 1; k <= Math.min(n, wpw.length - 1); k++) if (wpw[k].clipped) { g.dot(wpw[k].raw, 3.5, C.red, 1); g.line(wpw[k].raw, wpw[k].x, C.red, 1.5, 1, [3, 3]); }
      var q = walkTo(g, wpw, up, C.orange, 2.5); g.hero(q, 'pg', 1, 'day ' + Math.min(n, dPg + 1));
    } });
  // The Twins' tale, from the King's request to one full circuit, told on day 4 to day 5: day 4 created the first
  // nonzero ledger entry, so the next aim visibly differs from the Warden's point.  Earlier versions used day 3, where u = 0 and v = z hid the mechanism.
  out = out.concat(pick(Ww, 'tw', 4,
    ['twins', 'wanderer-role', 'warden-role', 'rope', 'rope-day-1', 'rope-day-2', 'rope-day-3', 'without-ledger', 'ledger-role', 'aim', 'wander', 'wander-balance', 'warden', 'ledger',
      'book-day-1', 'book-day-2', 'book-day-3', 'again'], CH.tw));
  var Dw = Math.max(dPg, dLb, dTw) + 1;
  out.push({ id: 'race2', chapter: CH.tw, title: 'Three heroes at the wall', layout: 'map+side', view: [0.0, 1.6, -0.2, 1.4], dur: 6,
    text: 'At the wall the Cartographer is within 0.001 of the treasure on day ' + dLb + ', the Twins’ Warden on day ' + dTw + ' and the Pilgrim on day ' + dPg + '. At the Twins’ settled endpoint both tests are small: the gap is ' + num(primalEnd, 5) + ' and ρ times the Warden’s move is ' + num(dualEnd, 5) + '. The Warden’s book settles at u = ' + pair(uEnd) + ': the wall’s toll, −∇J(x*)/ρ = ' + pair(uTheory) + ', the slope of the land at the spot to dig divided by the rope’s stiffness.',
    math: 'days to within 0.001:  Cartographer ' + at(0.25, String(dLb)) + ',  Twins ' + at(0.42, String(dTw)) + ',  Pilgrim ' + at(0.58, String(dPg)) + '<br>' + at(0.72, 'primal residual ' + num(primalEnd, 5) + ';  dual residual ' + num(dualEnd, 5)) + '<br>' + at(0.88, 'the book u → −∇J(x*)/ρ = ' + pair(uTheory) + ', the wall’s toll'),
    draw: function (g, p) {
      base(g, Ww); star(g, Tw, 1); var up = seg(p, 0, 0.95) * Dw;
      var a = walkTo(g, wpw, up, C.orange, 2), b = walkTo(g, wlw, up, C.blue, 2.5), z = walkTo(g, wtw, up, '#9ec5f3', 2, 'z');
      g.hero(a, 'pg', 1); g.hero(b, 'lb', 1); g.dot(z, 6, '#6aa2e3', 1);
      chart(g, g.sideR, [series(Ww, 'pg', Dw, 'x', dPg), series(Ww, 'lb', Dw, 'x', dLb), series(Ww, 'tw', Dw, 'z', dTw, 'Twins')], up,
        g.W < g.H ? 'cost gap by day (log scale)' : undefined);
    } });

  // 6. the self-checking light board.  The first five pages create the need for overlapping checks; the next four
  // reveal the consensus-ADMM bookkeeping only after the reader has seen why one hard correction is not enough.
  out.push({ id: 'light-patterns', chapter: CH.light, title: 'Four patterns, two pass', layout: 'side', dur: 5,
    text: 'Begin with two lamps, each either off (0) or on (1). There are four patterns. An even-parity check passes only 00 and 11, because they contain an even number of lit lamps. It rejects 01 and 10. This is the smallest check, shown directly rather than as a rule in a fantasy story.',
    math: 'b₁ ⊕ b₂ = 0:  {00, 11} pass;  {01, 10} fail',
    draw: function (g, p) { patternCards(g, g.sideR, p); } });

  out.push({ id: 'light-picture', chapter: CH.light, title: 'Build a self-checking picture', layout: 'side', dur: 5.2,
    text: 'Put four picture lamps in the upper-left square. Add one parity lamp to each picture row, then one parity lamp to each column. The completed 3 × 3 board has an even number of lit lamps in every row and every column. Six checks are visible, although only five are independent.',
    math: 'picture  ↦  3 row checks + 3 column checks;  101 / 110 / 011 passes all six',
    draw: function (g, p) { lightBoard(g, g.sideR, LIGHT_VALID, { title: 'Four picture lamps plus five parity lamps', p: p, payload: true }); } });

  out.push({ id: 'light-shared', chapter: CH.light, title: 'One lamp belongs to two checks', layout: 'side', dur: 5,
    text: 'The centre lamp is one coded bit, not two lamps. Yet row R2 checks it and column C2 checks it. Every lamp on the board is shared in exactly this way: one physical decision participates in one row check and one column check. Overlap is what lets one part of the board test another.',
    math: 'bit b₅ belongs to N(b₅) = {R2, C2}',
    draw: function (g, p) {
      var R = g.sideR, q = lightBoard(g, R, LIGHT_VALID, { title: 'One lamp, row R2 and column C2', p: p, highlightRow: 1, highlightCol: 1 }), c = g.ctx;
      c.globalAlpha = seg(p, 0.48, 0.75); c.strokeStyle = C.gold; c.lineWidth = 3; c.strokeRect(q.x + q.cell + 5, q.y + q.cell + 5, q.cell - 10, q.cell - 10); c.globalAlpha = 1;
      g.labelPx(q.x + q.cell * 1.5, q.y + q.cell * 1.5, 'b₅', '#241805', { align: 'center', plain: true, mono: true, size: 12, p: seg(p, 0.55, 0.8) });
    } });

  out.push({ id: 'light-single-error', chapter: CH.light, title: 'One glitch is easy', layout: 'side', dur: 5.4,
    text: 'Suppose the centre lamp alone is read incorrectly. R2 becomes odd and C2 becomes odd. Their intersection identifies the suspect lamp—but only because we assumed exactly one hard decision was wrong. With two or more errors, the same syndrome can have several explanations.',
    math: 'one-error assumption: failed row ∩ failed column = suspect bit',
    draw: function (g, p) {
      var bad = LIGHT_VALID.slice(), flip = seg(p, 0.35, 0.65); bad[4] = mix(1, 0, flip);
      var hard = lightHard(bad), q = lightBoard(g, g.sideR, bad, { title: 'One flipped hard decision', p: p, hard: hard, syndrome: lightSyndrome(hard), highlightRow: flip > 0.5 ? 1 : null, highlightCol: flip > 0.5 ? 1 : null }), c = g.ctx;
      c.globalAlpha = seg(p, 0.58, 0.82); c.strokeStyle = C.red; c.lineWidth = 3; c.strokeRect(q.x + q.cell + 5, q.y + q.cell + 5, q.cell - 10, q.cell - 10); c.globalAlpha = 1;
    } });

  out.push({ id: 'light-uncertain', chapter: CH.light, title: 'Several glows are uncertain', layout: 'side', dur: 6,
    text: 'A receiver does not first see perfect zeros and ones. It measures a brightness yᵢ; a channel model turns that observation into a channel LLR ℓᶜʰᵢ. Here three glows lie near the decision threshold. The hard board fails C2 and C3, and flipping those two positions in any one row repairs the syndrome. Parity says which boards are allowed; the LLRs decide which allowed board fits the observations best.',
    math: 'toy channel: ℓᶜʰᵢ = log[p(yᵢ|0)/p(yᵢ|1)] = 4(0.5 − yᵢ);  negative favours 1',
    draw: function (g, p) {
      var R = g.sideR, narrow = R[2] < 560, BR = narrow ? [R[0] + 4, R[1] + 28, R[2] - 8, R[3] * 0.62] : [R[0] + 4, R[1] + 28, R[2] * 0.57, R[3] - 34];
      var LR = narrow ? [R[0] + 12, R[1] + R[3] * 0.66, R[2] - 24, R[3] * 0.31] : [R[0] + R[2] * 0.60, R[1] + 42, R[2] * 0.38, R[3] - 58];
      g.panel(R, 'Observation → channel LLR → valid board');
      lightBoard(g, BR, LIGHT_GLOW, { panel: false, p: p, showValues: true, hard: lightHard(LIGHT_GLOW), syndrome: lightSyndrome(lightHard(LIGHT_GLOW)) });
      var lines = ['repair R1: 110 / 101 / 011', 'repair R2: 101 / 110 / 011  ← best fit', 'repair R3: 101 / 101 / 000'];
      lines.forEach(function (t, i) { g.labelPx(LR[0] + 4, LR[1] + 24 + i * Math.min(42, LR[3] / 4), t, i === 1 ? C.gold : C.ink, { plain: true, mono: true, size: narrow ? 10 : 11.5, p: seg(p, 0.52 + i * 0.10, 0.72 + i * 0.10) }); });
      g.labelPx(LR[0] + 4, LR[1] + LR[3] - 12, 'all three pass parity; evidence separates them', C.dim, { plain: true, size: narrow ? 9.5 : 11, p: seg(p, 0.82, 1) });
    } });

  out.push({ id: 'light-replicas', chapter: CH.cajode, title: 'One check keeps one replica', layout: 'side', dur: 5.4,
    text: 'To handle all checks separately, row R2 keeps a replica vector z<sub>R2</sub> of its three incident shared bits. Its update projects b<sub>N(R2)</sub> + u<sub>R2</sub> onto the even-parity polytope. That polytope is the convex hull of the row’s four even binary patterns, so a projection may be fractional; it need not choose a hard row immediately.',
    math: 'z<sub>a</sub> ← Π<sub>P<sub>a</sub></sub>(b<sub>N(a)</sub> + u<sub>a</sub>),  one vector z<sub>a</sub> per check a',
    draw: function (g, p) {
      var R = g.sideR, c = g.ctx, narrow = R[2] < 560, BR = narrow ? [R[0] + 4, R[1] + 28, R[2] - 8, R[3] * 0.57] : [R[0] + 4, R[1] + 28, R[2] * 0.49, R[3] - 34];
      var DR = narrow ? [R[0] + 12, R[1] + R[3] * 0.62, R[2] - 24, R[3] * 0.34] : [R[0] + R[2] * 0.52, R[1] + 42, R[2] * 0.46, R[3] - 58];
      g.panel(R, 'Shared row values and one local replica'); lightBoard(g, BR, LIGHT_TRACE[2].b, { panel: false, p: p, showValues: true, highlightRow: 1 });
      var x = DR[0] + DR[2] / 2, y1 = DR[1] + DR[3] * 0.22, y2 = DR[1] + DR[3] * 0.52, y3 = DR[1] + DR[3] * 0.82;
      g.labelPx(x, y1, 'shared row  b₄, b₅, b₆', C.gold, { align: 'center', plain: true, mono: true, p: seg(p, 0.1, 0.32), size: narrow ? 10.5 : 12 });
      g.arrowPx([x, y1 + 14], [x, y2 - 18], C.violet, 2);
      c.globalAlpha = seg(p, 0.32, 0.58); c.strokeStyle = C.violet; c.lineWidth = 2; c.strokeRect(DR[0] + DR[2] * 0.12, y2 - 17, DR[2] * 0.76, 34); c.globalAlpha = 1;
      g.labelPx(x, y2, 'R2: project onto P_even', C.violet, { align: 'center', plain: true, p: seg(p, 0.34, 0.6), size: narrow ? 10 : 11.5 });
      g.arrowPx([x, y2 + 18], [x, y3 - 16], C.blue, 2);
      g.labelPx(x, y3, 'replica vector z_R2 (possibly fractional)', C.blue, { align: 'center', plain: true, p: seg(p, 0.62, 0.88), size: narrow ? 9.5 : 11 });
    } });

  // ------------------------------------------------------------ the even-parity polytope of row R2, drawn in its cube
  // The cube of the row's three lamps, its eight corners (the eight hard rows), the solid spanned by the four even
  // corners, why that solid is convex (a segment between two mixtures, and the flat cuts), and R2's projection in round 4.
  var EVEN3 = [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]], R2_ROUND = 4;
  var R2_IN = [3, 4, 5].map(function (bit, j) { return LIGHT_TRACE[R2_ROUND].b[bit] + LIGHT_TRACE[R2_ROUND - 1].u[1][j]; }), R2_Z = LIGHT_TRACE[R2_ROUND].z[1].slice();
  var R2_W = { w110: R2_Z[1], w101: R2_Z[2], w000: 1 - R2_Z[1] - R2_Z[2] };   // z lies on the face b₄ = b₅ + b₆ through 000, 101 and 110
  function triple3(v) { return '(' + v.map(function (q) { return num(q, 3); }).join(', ') + ')'; }
  function cubeView(R, yaw, pitch) {
    var S = Math.min(R[2], R[3]) * 0.5, cx = R[0] + R[2] / 2, cy = R[1] + R[3] * 0.55;
    return function (v) {
      var x = v[0] - 0.5, y = v[1] - 0.5, z = v[2] - 0.5, x1 = x * Math.cos(yaw) - y * Math.sin(yaw), y1 = x * Math.sin(yaw) + y * Math.cos(yaw);
      return [cx + S * x1, cy - S * (z * Math.cos(pitch) - y1 * Math.sin(pitch)), y1 * Math.cos(pitch) + z * Math.sin(pitch)];
    };
  }
  out.push({ id: 'light-polytope', chapter: CH.cajode, title: 'Inside the cube: the even-parity polytope', layout: 'side', dur: 9,
    text: 'What does that polytope look like? Row R2 has three lamps, so its replica is a point in a cube, one coordinate per lamp, from 0 (off) to 1 (on). ' +
      'The cube’s eight corners are the eight hard rows. The four with an even number of lit lamps, 000, 011, 101 and 110, pass the check; the other four fail it. ' +
      'The even-parity polytope is every mixture of the four passing corners: weights from 0 to 1 that add to 1. This set of all mixtures is the convex hull of the four corners. Drawn, it is the blue solid whose corners are those four rows. ' +
      'It is convex: the straight segment between any two of its points stays inside it. ' +
      'The reason is one line of arithmetic. A point between two mixtures is again a mixture of the same four corners, with weights that are still at least 0 and still add to 1. ' +
      'Watch the white dot slide from A to B: its four weights change, but none turns negative and their sum stays 1. ' +
      'The same solid is the cube with each failing corner sliced off by one flat cut. A segment between two points on the kept side of a cut stays on that side: a second reason it is convex. ' +
      'In round ' + R2_ROUND + ', row R2’s b + u is ' + triple3(R2_IN) + ', just outside the solid. Its nearest point is z<sub>R2</sub> = ' + triple3(R2_Z) + ', on the cut that removes 100: a fractional replica, mostly the row 110.',
    math: 'P<sub>even</sub> = { w₁·000 + w₂·011 + w₃·101 + w₄·110 :  w ≥ 0,  w₁ + w₂ + w₃ + w₄ = 1 }' +
      at(0.45, '<br>convex: t·A + (1 − t)·B has weights t·w<sup>A</sup> + (1 − t)·w<sup>B</sup> ≥ 0, which still add to 1') +
      at(0.62, '<br>the four cuts: b₄ + b₅ + b₆ ≤ 2,  b₄ ≤ b₅ + b₆,  b₅ ≤ b₄ + b₆,  b₆ ≤ b₄ + b₅') +
      at(0.8, '<br>round ' + R2_ROUND + ': Π' + triple3(R2_IN) + ' = ' + triple3(R2_Z) + ' ≈ ' + num(R2_W.w110, 2) + '·110 + ' + num(R2_W.w101, 2) + '·101 + ' + num(R2_W.w000, 2) + '·000'),
    draw: function (g, p) {
      var R = g.sideR, narrow = R[2] < 560, c = g.ctx;
      var CR = narrow ? [R[0], R[1] + 26, R[2], R[3] * 0.6] : [R[0], R[1] + 26, R[2] * 0.6, R[3] - 30];
      var LR = narrow ? [R[0] + 12, R[1] + R[3] * 0.6 + 34, R[2] - 24, R[3] * 0.4 - 40] : [R[0] + R[2] * 0.6 + 6, R[1] + 48, R[2] * 0.4 - 18, R[3] - 60];
      g.panel(R, 'Row R2’s cube: three lamps, eight hard rows');
      var P3 = cubeView(CR, 0.45 + 0.45 * ease(p), 0.42), corners = [], m;
      for (m = 0; m < 8; m++) corners.push([(m >> 2) & 1, (m >> 1) & 1, m & 1]);
      var q0 = seg(p, 0, 0.1);
      c.save(); c.globalAlpha = q0; c.strokeStyle = 'rgba(242,245,248,0.3)'; c.lineWidth = 1.2;
      corners.forEach(function (a, ia) { corners.forEach(function (b2, ib) { var dd = Math.abs(a[0] - b2[0]) + Math.abs(a[1] - b2[1]) + Math.abs(a[2] - b2[2]); if (dd === 1 && ia < ib) { var A = P3(a), Bq = P3(b2); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(Bq[0], Bq[1]); c.stroke(); } }); });
      c.restore();
      // which way each lamp's coordinate grows: three small arrows in the lower-left corner, clear of the corner names
      var O3 = P3([0, 0, 0]), tri = [CR[0] + 62, CR[1] + CR[3] - 44];
      ['b₄', 'b₅', 'b₆'].forEach(function (nm, j) {
        var e = [0, 0, 0]; e[j] = 1; var A = P3(e), dx = A[0] - O3[0], dy = A[1] - O3[1], L = Math.hypot(dx, dy) || 1;
        c.save(); c.globalAlpha = q0; g.arrowPx(tri, [tri[0] + 28 * dx / L, tri[1] + 28 * dy / L], C.dim, 1.6); c.restore();
        g.labelPx(tri[0] + 41 * dx / L, tri[1] + 41 * dy / L, nm, C.ink, { align: 'center', size: 12, plain: true, p: q0 });
      });
      // the solid: the four faces of the tetrahedron spanned by the even corners
      var qs = seg(p, 0.18, 0.4), onFace = function (f) { return f.pts.every(function (v) { return Math.abs(v[0] - v[1] - v[2]) < 1e-9; }); };
      var faces = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]].map(function (f) { var pts = f.map(function (j) { return EVEN3[j]; }); return { pts: pts, depth: pts.reduce(function (sum, v) { return sum + P3(v)[2]; }, 0) }; });
      faces.sort(function (a, b) { return b.depth - a.depth; });
      faces.forEach(function (f) {
        if (!(qs > 0)) return; c.save(); c.globalAlpha = qs; c.beginPath();
        f.pts.forEach(function (v, j) { var A = P3(v); if (j) c.lineTo(A[0], A[1]); else c.moveTo(A[0], A[1]); }); c.closePath();
        c.fillStyle = p > 0.72 && onFace(f) ? 'rgba(217,194,255,0.34)' : 'rgba(169,205,246,0.13)'; c.fill(); c.strokeStyle = C.blue; c.lineWidth = 1.8; c.stroke(); c.restore();
      });
      // the eight corners: the even ones blue, the odd ones red and hollow
      var midX = CR[0] + CR[2] / 2, midY = CR[1] + CR[3] * 0.55;
      corners.forEach(function (v, j) {
        var even = (v[0] + v[1] + v[2]) % 2 === 0, A = P3(v), qq = seg(p, 0.02 + 0.015 * j, 0.1 + 0.015 * j); if (!(qq > 0)) return;
        c.save(); c.globalAlpha = qq; c.beginPath(); c.arc(A[0], A[1], even ? 6 : 5, 0, TAU);
        if (even) { c.fillStyle = C.blue; c.fill(); } else { c.fillStyle = '#0b121b'; c.fill(); c.strokeStyle = C.red; c.lineWidth = 1.8; c.stroke(); }
        c.restore();
        g.labelPx(A[0] + (A[0] < midX ? -10 : 10), A[1] + (A[1] < midY ? -12 : 13), '' + v[0] + v[1] + v[2], even ? C.blue : C.red, { align: A[0] < midX ? 'right' : 'left', size: 12, mono: true, plain: true, p: qq });
      });
      // convexity: two mixtures A and B, and every point between them
      var PA = [0.5, 1, 0.5], PB = [0.3, 0, 0.3], WA = [0, 0.5, 0, 0.5], WB = [0.7, 0, 0.3, 0], qa = seg(p, 0.42, 0.5), qsg = seg(p, 0.5, 0.6), qm = seg(p, 0.56, 0.7);
      // the white dot slides from A to B and back to the middle; its weights on 000, 011, 101, 110 are the same blend of A's and B's
      var tm = qm < 0.65 ? ease(qm / 0.65) : 1 - 0.5 * ease((qm - 0.65) / 0.35), WM = WA.map(function (wa, k) { return (1 - tm) * wa + tm * WB[k]; });
      function dot3(v, r, fill, q) { if (!(q > 0)) return; var A = P3(v); c.save(); c.globalAlpha = clamp(q, 0, 1); c.beginPath(); c.arc(A[0], A[1], r, 0, TAU); c.fillStyle = fill; c.fill(); c.strokeStyle = '#0b121b'; c.lineWidth = 1.5; c.stroke(); c.restore(); }
      if (qsg > 0) { var SA = P3(PA), SB = P3(PB); c.save(); c.strokeStyle = C.gold; c.lineWidth = 2.4; c.beginPath(); c.moveTo(SA[0], SA[1]); c.lineTo(SA[0] + (SB[0] - SA[0]) * qsg, SA[1] + (SB[1] - SA[1]) * qsg); c.stroke(); c.restore(); }
      dot3(PA, 5.5, C.gold, qa); dot3(PB, 5.5, C.gold, qa);
      if (qa > 0) { var LA = P3(PA), LB = P3(PB); g.labelPx(LA[0] + 10, LA[1] - 12, 'A', C.gold, { size: 13, p: qa }); g.labelPx(LB[0] - 10, LB[1] + 13, 'B', C.gold, { align: 'right', size: 13, p: qa }); }
      if (qm > 0) dot3([PA[0] + (PB[0] - PA[0]) * tm, PA[1] + (PB[1] - PA[1]) * tm, PA[2] + (PB[2] - PA[2]) * tm], 4.5, '#fff6e6', 1);
      // R2's projection in round 4: b + u outside, z on the face that cuts off 100
      var qi = seg(p, 0.72, 0.8), qz = seg(p, 0.8, 0.92);
      dot3(R2_IN, 5, C.orange, qi);
      if (qz > 0) { var SI = P3(R2_IN), SZ = P3(R2_Z); c.save(); c.strokeStyle = C.violet; c.lineWidth = 2; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(SI[0], SI[1]); c.lineTo(SI[0] + (SZ[0] - SI[0]) * qz, SI[1] + (SZ[1] - SI[1]) * qz); c.stroke(); c.setLineDash([]); c.restore(); }
      dot3(R2_Z, 5.5, C.violet, seg(p, 0.88, 0.95));
      if (qi > 0) { var LI = P3(R2_IN); g.labelPx(LI[0] + 10, LI[1] + 6, 'b + u', C.orange, { size: 12, p: qi }); }
      if (qz > 0) { var LZ = P3(R2_Z); g.labelPx(LZ[0] + 9, LZ[1] - 13, 'z', C.violet, { size: 12, p: seg(p, 0.88, 0.95) }); }
      var mixText = WM.map(function (wk, k) { return num(wk, 2) + '·' + ['000', '011', '101', '110'][k]; }).join(' + ');
      // the legend, in step with the drawing
      var items = narrow ? [
        { t: 'blue corners pass (even), red corners fail (odd)', col: C.blue, at: 0.1 },
        { t: 'the solid: every mixture of the blue four', col: C.blue, at: 0.3 },
        { t: 'the white dot, between A and B, is a mixture too:', col: C.gold, at: 0.56 },
        { t: mixText, col: C.ink, mono: true, at: 0.56 },
        { t: 'weights ≥ 0 that add to 1, so the solid is convex', col: C.gold, at: 0.66 },
        { t: 'round ' + R2_ROUND + ': b + u = ' + triple3(R2_IN), col: C.orange, at: 0.74 },
        { t: 'nearest point z = ' + triple3(R2_Z) + ': fractional', col: C.violet, at: 0.86 }] : [
        { t: 'eight corners: the eight hard rows', col: C.ink, at: 0.05 },
        { t: 'corner 101: b₄ = 1, b₅ = 0, b₆ = 1', col: C.ink, at: 0.07 },
        { t: 'blue: 000, 011, 101, 110 pass (even)', col: C.blue, at: 0.1 },
        { t: 'red: 100, 010, 001, 111 fail (odd)', col: C.red, at: 0.14 },
        { t: 'the solid: every mixture of the blue four', col: C.blue, at: 0.3 },
        { t: 'A = ½·011 + ½·110 = (0.5, 1, 0.5)', col: C.gold, at: 0.44 },
        { t: 'B = 0.7·000 + 0.3·101 = (0.3, 0, 0.3)', col: C.gold, at: 0.48 },
        { t: 'the white dot, between A and B:', col: C.gold, at: 0.56 },
        { t: mixText, col: C.ink, mono: true, at: 0.56 },
        { bar: true, at: 0.56 },
        { t: 'weights ≥ 0 that add to 1: a mixture', col: C.gold, at: 0.64 },
        { t: 'every such dot is inside: convex', col: C.gold, at: 0.66 },
        { t: 'violet: the cut that removes 100', col: C.violet, at: 0.72 },
        { t: 'round ' + R2_ROUND + ': b + u = ' + triple3(R2_IN), col: C.orange, at: 0.74 },
        { t: 'nearest point z = ' + triple3(R2_Z), col: C.violet, at: 0.84 },
        { t: '≈ ' + num(R2_W.w110, 2) + '·110 + ' + num(R2_W.w101, 2) + '·101 + ' + num(R2_W.w000, 2) + '·000', col: C.violet, at: 0.9 },
        { t: 'a fractional replica, mostly the row 110', col: C.violet, at: 0.92 }];
      // the white dot's four weights as one bar of length 1: the parts change, the whole does not
      function weightBar(x0, yc, wBar, q) {
        if (!(q > 0)) return; var xx = x0, h = 12, shades = [0.95, 0.72, 0.5, 0.32];
        c.save(); c.globalAlpha = clamp(q, 0, 1);
        WM.forEach(function (wk, k) { var ww = wBar * wk; if (ww > 0.5) { c.fillStyle = 'rgba(169,205,246,' + shades[k] + ')'; c.fillRect(xx, yc - h / 2, ww, h); c.strokeStyle = '#0b121b'; c.lineWidth = 1.2; c.strokeRect(xx, yc - h / 2, ww, h); } xx += ww; });
        c.strokeStyle = C.ink; c.lineWidth = 1; c.strokeRect(x0, yc - h / 2, wBar, h); c.restore();
        g.labelPx(x0 + wBar + 8, yc, 'sum 1', C.ink, { plain: true, size: 11, p: q });
      }
      var rh = Math.min(narrow ? 19 : 28, LR[3] / items.length);
      items.forEach(function (it, j) {
        var yy = LR[1] + rh * j + rh / 2, q = seg(p, it.at, it.at + 0.08);
        if (it.bar) weightBar(LR[0], yy, Math.min(220, LR[2] - 60), q);
        else g.labelPx(LR[0], yy, it.t, it.col, { plain: true, mono: !!it.mono, size: it.mono ? (narrow ? 11 : 12) : narrow ? 11 : 12, p: q });
      });
    } });

  out.push({ id: 'light-corrections', chapter: CH.cajode, title: 'One lamp receives two corrections', layout: 'side', dur: 5.5,
    text: 'The shared centre value b₅ receives one agreement target from R2 and another from C2. Each check-bit edge has its own replica coordinate zₐ,ᵢ and scaled dual variable uₐ,ᵢ, because the row and column can disagree with b₅ in different ways. These are two soft agreement terms, not two hard commands; the shared-bit update balances both with the channel LLR.',
    math: 'b₅ update balances ℓᶜʰ₅,  z<sub>R2,5</sub> − u<sub>R2,5</sub>,  z<sub>C2,5</sub> − u<sub>C2,5</sub>',
    draw: function (g, p) {
      var R = g.sideR, c = g.ctx, narrow = R[2] < 520, cx = R[0] + R[2] / 2, cy = R[1] + R[3] * 0.54;
      var A = narrow ? [cx, R[1] + R[3] * 0.23] : [R[0] + R[2] * 0.22, cy], Bp = narrow ? [cx, R[1] + R[3] * 0.84] : [R[0] + R[2] * 0.78, cy];
      g.panel(R, 'Two incident checks, two edge states');
      c.globalAlpha = seg(p, 0.05, 0.3); c.fillStyle = 'rgba(255,210,122,0.12)'; c.strokeStyle = C.gold; c.lineWidth = 2.5; c.beginPath(); c.arc(cx, cy, 34, 0, TAU); c.fill(); c.stroke(); c.globalAlpha = 1;
      g.labelPx(cx, cy - 5, 'b₅', C.gold, { align: 'center', plain: true, mono: true, size: 16, p: seg(p, 0.05, 0.3) });
      g.labelPx(cx, cy + 18, 'one shared value', C.dim, { align: 'center', plain: true, size: 10, p: seg(p, 0.12, 0.35) });
      [[A, 'R2', 'z(R2,5) − u(R2,5)', C.blue], [Bp, 'C2', 'z(C2,5) − u(C2,5)', C.violet]].forEach(function (d, i) {
        var q = seg(p, 0.25 + i * 0.18, 0.52 + i * 0.18), w = narrow ? Math.min(150, R[2] * 0.52) : Math.min(170, R[2] * 0.27);
        c.globalAlpha = q; c.strokeStyle = d[3]; c.lineWidth = 2; c.strokeRect(d[0][0] - w / 2, d[0][1] - 23, w, 46); c.globalAlpha = 1;
        g.labelPx(d[0][0], d[0][1] - 8, d[1] + ' parity check', d[3], { align: 'center', plain: true, size: 11, p: q });
        g.labelPx(d[0][0], d[0][1] + 10, d[2], C.ink, { align: 'center', plain: true, mono: true, size: narrow ? 9.5 : 10.5, p: q });
        g.arrowPx(d[0], [cx + (d[0][0] < cx ? -38 : d[0][0] > cx ? 38 : 0), cy + (d[0][1] < cy ? -38 : d[0][1] > cy ? 38 : 0)], d[3], 2);
      });
      g.labelPx(cx, R[1] + R[3] - 18, 'channel evidence + both agreement targets → next b₅', C.gold, { align: 'center', plain: true, size: narrow ? 10 : 12, p: seg(p, 0.76, 0.96) });
    } });

  out.push({ id: 'light-rounds', chapter: CH.cajode, title: 'Run all checks together', layout: 'side', dur: 8,
    text: 'Each round updates all nine shared values, projects all six check replicas from that same shared state, then updates all 18 edge duals. In this computed fixed-evidence run, the hard board passes every row and column at round 3, while the primal and dual residuals are still nonzero. The continuous state settles only at round 8. A zero syndrome is therefore not the same event as ADMM convergence.',
    math: 'round 3: syndrome = 0 but r = ' + num(LIGHT_TRACE[3].primal, 4) + ', s = ' + num(LIGHT_TRACE[3].dual, 4) + ';  round 8: r = s = 0',
    draw: function (g, p) {
      var R = g.sideR, narrow = R[2] < 580, up = seg(p, 0.04, 0.96) * 8, k = Math.min(8, Math.floor(up)), k2 = Math.min(8, k + 1), f = up - k;
      var vals = LIGHT_TRACE[k].b.map(function (x, i) { return mix(x, LIGHT_TRACE[k2].b[i], f); }), hard = lightHard(vals), syn = lightSyndrome(hard);
      var BR = narrow ? [R[0] + 4, R[1] + 28, R[2] - 8, R[3] * 0.49] : [R[0] + 4, R[1] + 28, R[2] * 0.52, R[3] - 34];
      var PR = narrow ? [R[0] + 8, R[1] + R[3] * 0.54, R[2] - 16, R[3] * 0.42] : [R[0] + R[2] * 0.55, R[1] + 34, R[2] * 0.43, R[3] - 42];
      g.panel(R, 'Fixed-evidence ADMM teaching trace'); lightBoard(g, BR, vals, { panel: false, p: 1, showValues: true, hard: hard, syndrome: syn });
      g.labelPx(BR[0] + BR[2] / 2, BR[1] + 8, 'round ' + Math.min(8, Math.round(up)) + ' · failed checks ' + syn.reduce(function (s, x) { return s + x; }, 0), syn.some(function (x) { return x; }) ? C.red : C.green, { align: 'center', plain: true, mono: true, size: 11, p: 1 });
      var plotTitle = narrow ? 'Residuals · syndrome zero at round 3' : 'Residuals keep moving after the syndrome clears';
      var pl = g.plot(PR, [1, 8], [0, 0.8], { title: plotTitle }); pl.frame('round', narrow ? '' : 'RMS residual');
      function traceLine(key, col) {
        var last = Math.min(8, Math.floor(up));
        for (var j = 2; j <= last; j++) pl.seg(j - 1, LIGHT_TRACE[j - 1][key], j, LIGHT_TRACE[j][key], col, 2, 1);
        for (j = 1; j <= last; j++) pl.point(j, LIGHT_TRACE[j][key], col, '', 1);
      }
      traceLine('primal', C.violet); traceLine('dual', C.blue);
      if (up >= 3) pl.point(3, LIGHT_TRACE[3].dual, C.gold, narrow ? '' : 'syndrome = 0 here', seg(up - 3, 0, 0.8), 'left');
      g.labelPx(PR[0] + PR[2] - 18, PR[1] + 50, narrow ? 'r agreement' : 'violet r: agreement gap', C.violet, { align: 'right', plain: true, size: narrow ? 9.5 : 10, p: 1 });
      g.labelPx(PR[0] + PR[2] - 18, PR[1] + 66, narrow ? 's movement' : 'blue s: replica movement', C.blue, { align: 'right', plain: true, size: narrow ? 9.5 : 10, p: 1 });
    } });

  out.push({ id: 'light-ldpc', chapter: CH.cajode, title: 'From the light board to an LDPC graph', layout: 'side', dur: 6,
    text: 'Redraw each lamp as a shared variable node and each row or column test as a check node; draw an edge whenever that check uses that bit. The light board is a small regular product code. An LDPC code uses a much larger sparse graph, usually with different connections and check sizes. The same ADMM bookkeeping remains: shared bits b, per-check replica vectors z, and one scaled dual u on every check-bit edge.',
    math: 'light board incidence graph → sparse LDPC graph;  same b / z / u roles, different code',
    draw: function (g, p) {
      var R = g.sideR, c = g.ctx, narrow = R[2] < 580, BR = narrow ? [R[0] + 4, R[1] + 28, R[2] - 8, R[3] * 0.48] : [R[0] + 4, R[1] + 28, R[2] * 0.47, R[3] - 34];
      var GR = narrow ? [R[0] + 8, R[1] + R[3] * 0.53, R[2] - 16, R[3] * 0.44] : [R[0] + R[2] * 0.50, R[1] + 34, R[2] * 0.48, R[3] - 42];
      g.panel(R, 'The wiring is the code'); lightBoard(g, BR, LIGHT_VALID, { panel: false, p: seg(p, 0, 0.45) });
      var bits = [], checks = [], bx0 = GR[0] + GR[2] * 0.19, by0 = GR[1] + GR[3] * 0.29, dx = GR[2] * 0.21, dy = GR[3] * 0.25;
      for (var i = 0; i < 9; i++) bits.push([bx0 + (i % 3) * dx, by0 + Math.floor(i / 3) * dy]);
      for (i = 0; i < 3; i++) checks.push([bx0 + 3 * dx + GR[2] * 0.10, by0 + i * dy]);
      for (i = 0; i < 3; i++) checks.push([bx0 + i * dx, by0 - GR[3] * 0.17]);
      LIGHT_CHECKS.forEach(function (members, a) { members.forEach(function (bit, edge) { var q = seg(p, 0.25 + (a * 3 + edge) * 0.018, 0.52 + (a * 3 + edge) * 0.018); c.globalAlpha = q; c.strokeStyle = C.faint; c.lineWidth = 1.3; c.beginPath(); c.moveTo(bits[bit][0], bits[bit][1]); c.lineTo(checks[a][0], checks[a][1]); c.stroke(); c.globalAlpha = 1; }); });
      bits.forEach(function (a, i) { var q = seg(p, 0.18 + i * 0.025, 0.42 + i * 0.025); c.globalAlpha = q; c.fillStyle = 'rgba(255,210,122,0.16)'; c.strokeStyle = C.gold; c.lineWidth = 1.5; c.beginPath(); c.arc(a[0], a[1], narrow ? 10 : 12, 0, TAU); c.fill(); c.stroke(); c.globalAlpha = 1; g.labelPx(a[0], a[1], 'b' + (i + 1), C.gold, { align: 'center', plain: true, mono: true, size: narrow ? 7.5 : 8.5, p: q }); });
      checks.forEach(function (a, i) { var isRow = i < 3, n = (i % 3) + 1, q = seg(p, 0.36 + i * 0.05, 0.60 + i * 0.05); c.globalAlpha = q; c.strokeStyle = isRow ? C.blue : C.violet; c.lineWidth = 1.8; c.strokeRect(a[0] - 15, a[1] - 12, 30, 24); c.globalAlpha = 1; g.labelPx(a[0], a[1], (isRow ? 'R' : 'C') + n, isRow ? C.blue : C.violet, { align: 'center', plain: true, mono: true, size: 9, p: q }); });
      g.labelPx(GR[0] + GR[2] / 2, GR[1] + GR[3] - 9, 'circles: shared bits   squares: local checks', C.dim, { align: 'center', plain: true, size: narrow ? 9 : 10.5, p: seg(p, 0.75, 0.95) });
    } });

  // The light board fixes its channel evidence.  These final pages state exactly what full CAJODE adds, and keep
  // acceptance of a decoded word separate from convergence of its continuous optimisation variables.
  out.push({ id: 'cajode-circuit', chapter: CH.cajode, title: 'One full CAJODE circuit', layout: 'side', dur: 5.6,
    text: 'The light-board trace held its channel LLRs fixed. Full CAJODE also estimates the channel that produced the bit evidence. One circuit computes one robust weight for each received sample, updates all shared bit variables, recomputes those weights, updates the channel coefficients, projects each check’s replica vector onto its parity polytope, and then updates every scaled dual variable.',
    math: 'weights → shared bits → weights → channel → parity-polytope projections → scaled dual variables',
    draw: function (g, p) {
      var R = g.sideR, rows = ['1  one weight per received sample', '2  all shared variables bᵢ', '3  recompute those weights', '4  all channel coefficients', '5  every check projection', '6  every scaled dual variable'];
      g.panel(R, 'One circuit, in order');
      rows.forEach(function (t, i) {
        var q = seg(p, 0.08 + 0.12 * i, 0.25 + 0.12 * i), y = R[1] + 52 + i * Math.min(42, (R[3] - 80) / rows.length);
        g.labelPx(R[0] + 28, y, t, i === 3 ? C.gold : i >= 4 ? C.blue : C.ink, { plain: true, p: q, size: 14 });
        if (i < rows.length - 1) g.labelPx(R[0] + 15, y + 20, '↓', C.dim, { plain: true, p: q, size: 15 });
      });
    } });
  out.push({ id: 'cajode-done', chapter: CH.cajode, title: 'Two different meanings of “done”', layout: 'side', dur: 5.2,
    text: 'After a complete circuit, CAJODE forms a binary word. It may accept the first decoded word that satisfies every parity check and passes the CRC. Accepting that word is not proof that the continuous variables converged: the primal and dual residuals can still be nonzero, and stationarity is not established. The wall teaches the ADMM pattern; CAJODE applies it to a nonconvex optimization problem, so the wall’s standard convergence story does not transfer automatically.',
    math: 'accepted word: parity checks + CRC   ≠   continuous convergence or stationarity',
    draw: function (g, p) {
      var R = g.sideR, mid = R[0] + R[2] / 2;
      g.panel(R, 'Do not merge these tests');
      g.labelPx(R[0] + R[2] * 0.25, R[1] + 68, 'accepting a decoded word', C.blue, { align: 'center', plain: true, p: seg(p, 0.05, 0.25), size: 15 });
      g.labelPx(R[0] + R[2] * 0.25, R[1] + 112, 'all parity checks', C.ink, { align: 'center', plain: true, p: seg(p, 0.18, 0.38) });
      g.labelPx(R[0] + R[2] * 0.25, R[1] + 142, '+ CRC', C.ink, { align: 'center', plain: true, p: seg(p, 0.3, 0.5) });
      g.labelPx(mid, R[1] + 122, '≠', C.orange, { align: 'center', plain: true, p: seg(p, 0.45, 0.6), size: 28 });
      g.labelPx(R[0] + R[2] * 0.75, R[1] + 68, 'continuous checks', C.gold, { align: 'center', plain: true, p: seg(p, 0.55, 0.7), size: 15 });
      g.labelPx(R[0] + R[2] * 0.75, R[1] + 112, 'primal + dual residuals', C.ink, { align: 'center', plain: true, p: seg(p, 0.65, 0.8) });
      g.labelPx(R[0] + R[2] * 0.75, R[1] + 142, '+ stationarity', C.ink, { align: 'center', plain: true, p: seg(p, 0.75, 0.9) });
    } });

  // 8. the misty hills
  var mT = Wm.T, mw = Wm.walks, holes = Wm.land.holes, Dm = Math.min(40, Math.max(mw.pg.length, mw.lb.length, mw.tw.length) - 1);
  out.push({ id: 'misty', chapter: CH.misty, title: 'The misty hills', layout: 'map', view: Wm.view, dur: 4.6,
    text: 'The hardest land. Six random waves ripple it, a haze makes every tap of the staff a little wrong, and three black holes, narrow and deep, hide in it. The treasure lies at the bottom of the deepest hole.',
    math: 'J(x) = valley + ripples R(x) + black holes B(x), and every tap is off by about σ = ' + num(Wm.land.sigma, 4),
    draw: function (g, p) {
      base(g, Wm, { alpha: seg(p, 0, 0.5) });
      holes.at.forEach(function (q, k) { g.halo(q, Math.max(6, 2 * holes.w * g.s), C.red, seg(p, 0.4 + 0.1 * k, 0.55 + 0.1 * k), 2); });
      star(g, mT, seg(p, 0.75, 0.95), 'the treasure, in the deepest hole'); g.flag(Wm.x0, seg(p, 0.6, 0.75));
    } });
  out.push({ id: 'mistywalks', chapter: CH.misty, title: 'Nobody finds the treasure', layout: 'map', view: Wm.view, dur: 6.4,
    text: 'The Cartographer’s long strides drop it into one of the holes, where the haze makes every stride look too high: it stalls on day ' + (mw.lb.length - 1) + '. The Pilgrim and the Twins settle in the valley’s lowest hollow and never meet a hole. No hero finds the treasure: from local measurements, a narrow pit is found only by stepping into it.',
    math: 'the Cartographer stops on day ' + (mw.lb.length - 1) + ';  nobody reaches ' + pair(mT, 2),
    draw: function (g, p) {
      base(g, Wm); holes.at.forEach(function (q) { g.halo(q, Math.max(6, 2 * holes.w * g.s), C.red, 1, 1.5); }); star(g, mT, 1);
      var up = seg(p, 0, 0.95) * Dm, a = walkTo(g, mw.pg, up, C.orange, 2), b = walkTo(g, mw.lb, Math.min(up, mw.lb.length - 1), C.blue, 2.5), x = walkTo(g, mw.tw, up, '#e6e9ee', 2);
      g.hero(a, 'pg', 1); g.hero(b, 'lb', 1, up >= mw.lb.length - 1 ? 'stalled' : ''); g.hero(x, 'tw', 1);
      g.labelPx(g.mapR[0] + 12, g.mapR[1] + 30, 'day ' + Math.floor(up), C.gold, { size: 14 });
    } });

  // 9. what we learned
  var cards = [
    ['pg', 'The Pilgrim · gradient descent', 'Needs only the slope. Simple and sure on a gentle land, slow in a narrow valley, and flung away when its stride is too long.'],
    ['lb', 'The Cartographer · L-BFGS', 'Keeps m pages of memory, learns the land’s shape and tests each stride. Fastest on this smooth canyon; haze can stall it.'],
    ['tw', 'The Twins · ADMM', 'The Wanderer hunts the lowest spot, the Warden keeps the law; a rope ties them, and the Warden’s book of their gaps makes them meet. Stop when they stand together and have stopped moving.']];
  out.push({ id: 'summary', chapter: CH.end, title: 'Three ways down', layout: 'side', dur: 5,
    text: cards.map(function (cd) { return '<b>' + cd[1] + '.</b> ' + cd[2]; }).join('<br><br>'),
    math: 'canyon: Pilgrim ' + pgDays + ' days, Cartographer ' + lbDays + ';  wall: Cartographer ' + dLb + ', Twins ' + dTw + ', Pilgrim ' + dPg,
    draw: function (g, p) {
      var R = g.sideR, stacked = g.W < g.H, gap = 8;
      var wd = stacked ? R[2] : (R[2] - 2 * gap) / 3, ht = stacked ? (R[3] - 2 * gap) / 3 : R[3];
      cards.forEach(function (cd, i) {
        var q = seg(p, 0.1 + 0.25 * i, 0.4 + 0.25 * i); if (!(q > 0)) return;
        var Rr = stacked ? [R[0], R[1] + i * (ht + gap), wd, ht] : [R[0] + i * (wd + gap), R[1], wd, ht];
        var keep = g.mapR; g.mapR = [Rr[0] + 4, Rr[1] + 34, Rr[2] - 8, Rr[3] - 40];
        var W = i === 2 ? Ww : Wc, v = i === 2 ? [0.0, 1.6, -0.1, 1.5] : [-0.1, 1.0, -0.15, 0.95];
        g.panel(Rr, cd[1]); g.view(v); g.ctx.globalAlpha = q; g.land(W.land.J, { id: W.shade.id + 'mini' + i, lo: W.shade.lo, hi: W.shade.hi, rings: 10, cell: 5 });
        if (W.land.box) g.path([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]], C.blue, 1.5, 1);
        g.ctx.globalAlpha = 1; star(g, W.T, q);
        var w = W.walks[cd[0]], key = cd[0] === 'tw' ? 'z' : 'x', n = Math.min(w.length - 1, 30);
        var qq = walkTo(g, w, q * n, COL[cd[0]], 2, key); g.hero(qq, cd[0], q);
        g.mapR = keep;
      });
    } });
  out.push({ id: 'end', chapter: CH.end, title: 'The end of the tale', layout: 'map', view: Wc.view, dur: 6,
    text: 'That is the tale of three heroes downhill: three ways to find the lowest spot of a land you cannot see. The Pilgrim follows the slope, the Cartographer learns the shape of the land, and the Twins share the work when the King adds a law. Use Back, or the contents, to visit any step again.',
    math: '',
    draw: function (g, p) {
      base(g, Wc); star(g, T, 1); var up = seg(p, 0, 0.95) * 24;
      var a = walkTo(g, wp, up, C.orange, 2), b = walkTo(g, wc2, up, C.blue, 2.5), x = walkTo(g, Wc.walks.tw, up, '#e6e9ee', 2);
      g.hero(a, 'pg', 1); g.hero(b, 'lb', 1); g.hero(x, 'tw', 1);
    } });

  // ------------------------------------------------------------ the page: the player, the chapter bar
  var chapters = [];
  out.forEach(function (s, i) { if (!chapters.length || chapters[chapters.length - 1].name !== s.chapter) chapters.push({ name: s.chapter, start: i, n: 0 }); chapters[chapters.length - 1].n++; });
  var bar = document.getElementById('progress');
  if (bar) {
    bar.innerHTML = chapters.map(function (ch, k) { return '<button type="button" class="seg" data-k="' + k + '" style="flex-grow:' + ch.n + '" title="' + ch.name + '"><span class="fill"></span><span class="name">' + ch.name + '</span></button>'; }).join('');
    bar.addEventListener('click', function (e) { var b = e.target.closest ? e.target.closest('[data-k]') : null; if (b) B.go(chapters[+b.getAttribute('data-k')].start); });
  }
  B.onStep(function (i) {
    if (!bar) return;
    Array.prototype.forEach.call(bar.querySelectorAll('[data-k]'), function (b, k) {
      var ch = chapters[k], f = clamp((i - ch.start + 1) / ch.n, 0, 1); b.querySelector('.fill').style.width = Math.round(f * 100) + '%'; b.classList.toggle('on', i >= ch.start && i < ch.start + ch.n);
    });
  });
  document.addEventListener('keydown', function (e) { if (e.ctrlKey || e.metaKey || e.altKey) return; if (e.target && /^(INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY)$/.test(e.target.tagName) && (e.key === ' ' || e.key === 'Enter')) return; B.key(e); });
  B.openSteps(out, { embedded: true });
  window.course = { steps: out, chapters: chapters };
  // #step=ID&p=0.5 opens a step at a moment of its animation, with time stopped (for screenshots and checks)
  var hash = (window.location && window.location.hash) || '', ms = /step=([^&]+)/.exec(hash), mp = /p=([0-9.]+)/.exec(hash);
  if (ms) { var st = decodeURIComponent(ms[1]); B.debug({ step: /^\d+$/.test(st) ? +st : st, p: mp ? +mp[1] : 1 }); }
})();
