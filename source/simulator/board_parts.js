// The parts of the step-by-step board that only some days need: the height of the two-bit parity lands, the
// Cartographer's journal, reading and stride tests, and the Twins' aim, rope, Warden and ledger.  Each
// part is registered with Board.register(name, function (cx, out, H) { ... out.push(step) ... }); see board.js.
(function () {
  'use strict';
  var B = window.Board; if (!B) return;
  var H = B.H, C = H.C, seg = H.seg, num = H.num, pair = H.pair, par = H.par, at = H.at, frac = H.frac, add = H.add, sub = H.sub, dot = H.dot;
  var lerp2 = H.lerp2, len = H.len, scale = H.scale, around = H.around, clamp = H.clamp, mix = H.mix, ease = H.ease;
  var TAU = 2 * Math.PI;
  function sign(v) { return v >= 0 ? '+' : '−'; }
  function order(q) { return '(' + sign(q[0]) + ', ' + sign(q[1]) + ')'; }
  function boxPath(b) { return [[b[0], b[0]], [b[1], b[0]], [b[1], b[1]], [b[0], b[1]], [b[0], b[0]]]; }
  // A line-search step length: 1, ½, ¼, ⅛, then 1/2^j.
  function stepName(s) { var j = Math.round(-Math.log(s) / Math.LN2); return j === 0 ? '1' : j === 1 ? '½' : j === 2 ? '¼' : j === 3 ? '⅛' : '1/' + Math.pow(2, j); }
  function subscript(n) {
    var d = '₀₁₂₃₄₅₆₇₈₉';
    return String(n).split('').map(function (q) { return d.charAt(Number(q)); }).join('');
  }

  // ------------------------------------------------------------ the two-bit parity lands
  B.register('towerHeight', function (cx, out) {
    var land = cx.land, P = cx.p, x = cx.x, y = land.y, s2 = P.s2, mb = P.muB, mp = P.muP, s = land.lawSign, tw = cx.hero === 'tw';
    var dx = [x[0] - y[0], x[1] - y[1]], lan = (dx[0] * dx[0] + dx[1] * dx[1]) / (2 * s2);
    var f1 = Math.pow(1 - x[0] * x[0], 2), f2 = Math.pow(1 - x[1] * x[1], 2), fl = mb * (f1 + f2);
    var r = 1 - s * x[0] * x[1], law = mp * r * r;
    var gLan = [dx[0] / s2, dx[1] / s2], gFl = [-4 * mb * x[0] * (1 - x[0] * x[0]), -4 * mb * x[1] * (1 - x[1] * x[1])], gLaw = [-2 * mp * r * s * x[1], -2 * mp * r * s * x[0]];
    cx.parts.push({ name: 'fixed evidence', value: lan, col: C.gold }, { name: 'binary-end pull', value: fl, col: C.green });
    cx.gradParts.push({ name: 'evidence (x − y)/σ²', vec: gLan, col: C.gold }, { name: 'binary-end pull', vec: gFl, col: C.green });
    if (!tw) { cx.parts.push({ name: 'parity penalty', value: law, col: C.violet }); cx.gradParts.push({ name: 'parity penalty', vec: gLaw, col: C.violet }); }
    var view = [-1.32, 1.32, -1.32, 1.32], T = land.treasure, seg2 = land.lawSegment, weather = !!(land.ripples || land.holes);
    var lanFn = function (q) { return ((q[0] - y[0]) * (q[0] - y[0]) + (q[1] - y[1]) * (q[1] - y[1])) / (2 * s2); };
    var flFn = function (q) { return mb * (Math.pow(1 - q[0] * q[0], 2) + Math.pow(1 - q[1] * q[1], 2)); };
    var lawFn = function (q) { var rr = 1 - s * q[0] * q[1]; return mp * rr * rr; };
    var SQ = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]], CORN = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    function square(g, p, col) { g.path(SQ, col || 'rgba(255,210,122,0.7)', 1.5, p, [6, 4]); }
    function corners(g, p, marks) {
      CORN.forEach(function (q, i) {
        var ok = q[0] * q[1] === s, q0 = seg(p, i * 0.1, i * 0.1 + 0.2), col = marks ? (ok ? C.blue : C.orange) : C.ink;
        g.dot(q, 5, col, q0);
        g.label(q, order(q) + (marks ? (ok ? ' passes' : ' fails') : ''), col, { dx: q[0] > 0 ? 9 : -9, dy: q[1] > 0 ? -13 : 14, align: q[0] > 0 ? 'left' : 'right', p: q0, size: 12 });
      });
    }
    var lean = function (v) { return Math.abs(v) < 0.2 ? 'is near the threshold' : v > 0 ? 'leans to bit 1' : 'leans to bit 0'; };
    out.push({ id: 'cards', chapter: 'The height', title: 'Two relaxed bit coordinates', layout: 'map', view: view, dur: 4,
      text: 'A point x = (x₁, x₂) holds two relaxed signed bit values, each between −1 and +1. At an endpoint, −1 represents bit 0 and +1 represents bit 1; an interior value is still undecided. The square’s four corners are 00, 01, 10 and 11. The evidence-selected passing endpoint is ' + order(T) + '. ' +
        'Today coordinate 1 ' + lean(x[0]) + ' (x₁ = ' + num(x[0]) + ') and coordinate 2 ' + lean(x[1]) + ' (x₂ = ' + num(x[1]) + ').',
      math: at(0.75, 'x = (x₁, x₂) = ' + pair(x) + ', each coordinate in [−1, 1]'),
      draw: function (g, p) {
        g.land(cx.J, { lo: cx.shade.lo, hi: cx.shade.hi, id: 'J', alpha: 0.45, pits: cx.shade.pits }); g.axes();
        square(g, seg(p, 0, 0.3)); corners(g, seg(p, 0.2, 0.7), false);
        g.halo(T, 14, C.gold, seg(p, 0.6, 0.75), 2.5); g.label(T, 'selected passing endpoint', C.gold, { dx: T[0] > 0 ? 18 : -18, dy: T[1] > 0 ? 14 : -14, align: T[0] > 0 ? 'left' : 'right', p: seg(p, 0.65, 0.8) });
        g.hero(x, cx.hero, seg(p, 0.7, 0.85));
        var q = seg(p, 0.82, 1), v = g.vis; g.line(x, [x[0], v[2]], C.gold, 1.5, q, [5, 4]); g.line(x, [v[0], x[1]], C.gold, 1.5, q, [5, 4]);
      } });
    out.push({ id: 'formula', chapter: 'The height', title: 'The two-bit objective: three parts', layout: 'map', view: view, dur: 3.6,
      text: 'The objective J(x) has three parts: fit to the fixed evidence, a pull toward binary endpoints, and a parity-violation penalty' + (weather ? ', with the weather added on top' : '') + '. ' +
        (tw ? 'The Wanderer carries the first two; the Warden enforces the parity set instead of adding its penalty. ' : '') + 'Dark is low and warm is high. We take the parts one at a time.',
      math: 'J(x) = ' + at(0.25, 'evidence fit') + at(0.45, ' + binary-end pull') + at(0.65, ' + parity penalty') + (land.ripples ? at(0.8, ' + R(x)') : '') + (land.holes ? at(0.85, ' + B(x)') : '') + (tw ? at(0.9, '<br>the Wanderer’s objective: f(x) = J(x) − parity penalty') : ''),
      draw: function (g, p) { g.land(cx.J, { lo: cx.shade.lo, hi: cx.shade.hi, id: 'J', alpha: seg(p, 0, 0.6), pits: cx.shade.pits }); g.axes(); square(g, 1); g.hero(x, cx.hero, seg(p, 0.5, 0.7)); } });
    out.push({ id: 'lanterns', chapter: 'The height', title: 'Fit the fixed evidence', layout: 'map', view: view, dur: 4.2,
      text: 'The fixed evidence is y = (y₁, y₂) = ' + pair(y, 2) + '. The first part grows with the distance from y, ' +
        '[(x₁ − y₁)² + (x₂ − y₂)²]/(2σ²). The variance σ² = ' + num(s2, 2) + ' sets the evidence strength: the smaller it is, the harder y pulls. Here x − y = ' + pair(dx) + ', so the evidence term adds ' + num(lan, 4) + '.',
      math: 'evidence fit = ' + frac('(x₁ − y₁)² + (x₂ − y₂)²', '2σ²') + at(0.5, ' = ' + frac(par(dx[0]) + '² + ' + par(dx[1]) + '²', num(2 * s2, 2))) + at(0.85, ' = ' + num(lan, 4)),
      draw: function (g, p) {
        g.land(lanFn, { id: 'lan', rings: 10 }); g.axes(); square(g, 1, 'rgba(242,245,248,0.35)');
        g.dot(y, 7, C.gold, seg(p, 0, 0.15)); g.halo(y, 12 + 8 * seg(p, 0.1, 0.4), C.gold, seg(p, 0.05, 0.2) * (1 - seg(p, 0.4, 0.55)));
        g.label(y, 'y, fixed evidence', C.gold, { dx: 12, dy: -14, p: seg(p, 0.1, 0.25) });
        g.hero(x, cx.hero, 1);
        var corner = [x[0], y[1]];
        g.line(y, corner, C.violet, 2, seg(p, 0.25, 0.45), [6, 4]); g.line(corner, x, C.violet, 2, seg(p, 0.45, 0.6), [6, 4]);
        g.label(lerp2(y, corner, 0.5), 'x₁ − y₁ = ' + num(dx[0]), C.violet, { dy: 16, p: seg(p, 0.35, 0.5), align: 'center' });
        g.label(lerp2(corner, x, 0.5), 'x₂ − y₂ = ' + num(dx[1]), C.violet, { dx: 10, p: seg(p, 0.55, 0.65) });
        g.ring(lan, C.gold, 2.5, seg(p, 0.7, 0.85)); g.label(x, 'evidence fit ' + num(lan, 4), C.gold, { dx: 14, dy: -16, p: seg(p, 0.85, 1) });
      } });
    var fmax = mb * 1.08;
    out.push({ id: 'flags', chapter: 'The height', title: 'Pull each value toward a binary endpoint', layout: 'map+side', view: view, dur: 4.4,
      text: 'The second part pulls each coordinate toward −1 or +1. Each coordinate adds μ_b(1 − t²)²: 0 at either endpoint and largest at t = 0, so an undecided interior value costs height. ' +
        'With μ_b = ' + num(mb, 2) + ': coordinate 1 (x₁ = ' + num(x[0]) + ') adds ' + num(mb * f1, 4) + ', coordinate 2 (x₂ = ' + num(x[1]) + ') adds ' + num(mb * f2, 4) + ', together ' + num(fl, 4) + '.',
      math: 'binary-end pull = μ_b[(1 − x₁²)² + (1 − x₂²)²] = ' + at(0.45, num(mb, 2) + '·[' + num(f1, 4) + ' + ' + num(f2, 4) + ']') + at(0.85, ' = ' + num(fl, 4)),
      draw: function (g, p) {
        g.land(flFn, { id: 'flags', rings: 8 }); g.axes(); square(g, 1, 'rgba(242,245,248,0.35)'); g.hero(x, cx.hero, 1);
        CORN.forEach(function (q) { g.halo(q, 9, C.green, seg(p, 0.05, 0.25), 1.5); });
        var pl = g.plot(g.sideR, [-1.2, 1.2], [0, fmax], { title: 'one coordinate’s part: μ_b(1 − t²)²' });
        pl.frame('t →', ''); pl.curve(function (t) { return mb * Math.pow(1 - t * t, 2); }, C.green, 2.2, seg(p, 0.1, 0.4));
        pl.point(x[0], mb * f1, C.orange, 'coordinate 1: ' + num(mb * f1, 4), seg(p, 0.45, 0.6), x[0] > 0.5 ? 'left' : 'right');
        pl.point(x[1], mb * f2, C.blue, 'coordinate 2: ' + num(mb * f2, 4), seg(p, 0.6, 0.75), x[1] > 0.5 ? 'left' : 'right');
      } });
    var lawOK = CORN.filter(function (q) { return q[0] * q[1] === s; }).map(order).join(' and ');
    out.push({ id: 'law', chapter: 'The height', title: 'The parity penalty', layout: 'map', view: view, dur: 4.4,
      text: 'The sign s chooses the check. s = +1 means even parity, so the endpoint signs agree; s = −1 means odd parity, so they differ. Here s = ' + (s > 0 ? '+1' : '−1') + ', so the passing endpoints are ' + lawOK + '. ' +
        'The third part, μ_p(1 − s·x₁x₂)², is 0 where s·x₁x₂ = 1 and grows with parity violation; μ_p = ' + num(mp, 2) + ' sets its strength. At x, s·x₁x₂ = ' + num(s * x[0] * x[1]) + ', so the penalty adds ' + num(law, 4) + '.' +
        (tw ? ' The Wanderer does not carry this part: the Warden projects onto the parity-polytope line between the two passing endpoints.' : ''),
      math: 'parity penalty = μ_p(1 − s·x₁x₂)² = ' + at(0.45, num(mp, 2) + '·(1 − ' + par(s * x[0] * x[1]) + ')²') + at(0.85, ' = ' + num(law, 4)),
      draw: function (g, p) {
        g.land(lawFn, { id: 'law', rings: 9 }); g.axes(); square(g, 1, 'rgba(242,245,248,0.35)'); corners(g, seg(p, 0.05, 0.5), true);
        g.line(seg2[0], seg2[1], C.blue, 3, seg(p, 0.45, 0.7)); g.label(lerp2(seg2[0], seg2[1], 0.3), 'parity polytope', C.blue, { dx: 10, dy: -10, p: seg(p, 0.6, 0.75) });
        g.hero(x, cx.hero, 1); g.ring(law, C.violet, 2.5, seg(p, 0.7, 0.85)); g.label(x, 'penalty ' + num(law, 4), C.violet, { dx: 14, dy: -16, p: seg(p, 0.85, 1) });
      } });
  });

  // ------------------------------------------------------------ the Cartographer: its journal, its course, its stride tests
  // A FIFO table drawn on the canvas: rows [{ n, day, s, y, col, strike, mark, lit }], oldest at the top.
  function fifo(g, R, rows, m, p, o) {
    o = o || {}; var c = g.ctx, top = R[1] + 34, rh = Math.min(22, (R[3] - 80) / Math.max(rows.length + 1, 4)), X = [R[0] + 12, R[0] + 40, R[0] + 92, R[0] + 92 + Math.min(170, Math.max(120, (R[2] - 110) / 2))];
    g.panel(R, o.title || 'The journal: a queue of m = ' + m + ' pages');
    c.font = '600 11.5px ' + g.sans; c.fillStyle = C.dim; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText('↑ out: the oldest page leaves first', X[0], top);
    c.font = '12px ' + g.mono; c.fillStyle = C.blue;
    ['#', 'day', 'stride s', 'slope change y'].forEach(function (h, i) { c.fillText(h, X[i], top + rh); });
    rows.forEach(function (r, i) {
      var q = r.p == null ? 1 : r.p; if (!(q > 0)) return;
      var y = top + rh * (i + 2), dy = (1 - q) * 10;
      c.globalAlpha = clamp(q, 0, 1) * (r.strike ? 0.55 : 1);
      if (r.lit) { c.fillStyle = 'rgba(255,210,122,0.2)'; c.fillRect(R[0] + 6, y - rh / 2 + dy, R[2] - 12, rh); }
      c.fillStyle = r.col || C.ink; c.font = '12px ' + g.mono;
      [r.n, r.day == null ? '' : 'day ' + r.day, r.s ? pair(r.s, 3) : '', r.y ? pair(r.y, 3) : ''].forEach(function (t, k) { c.fillText(String(t), X[k], y + dy); });
      if (r.strike) { c.strokeStyle = r.col || C.ink; c.lineWidth = 1; c.beginPath(); c.moveTo(X[0], y + dy); c.lineTo(R[0] + R[2] - 70, y + dy); c.stroke(); }
      if (r.mark) { c.textAlign = 'right'; c.font = '600 11.5px ' + g.sans; c.fillText(r.mark, R[0] + R[2] - 10, y + dy); c.textAlign = 'left'; }
      c.globalAlpha = 1;
    });
    c.font = '600 11.5px ' + g.sans; c.fillStyle = C.dim; c.fillText('↓ in: each new page joins here', X[0], top + rh * (rows.length + 2) + 2);
  }
  function pageRows(pages, extra) { return pages.map(function (pg, i) { var r = { n: i + 1, day: pg.day, s: pg.s, y: pg.y }; for (var k in (extra && extra(pg, i)) || {}) r[k] = extra(pg, i)[k]; return r; }); }
  function stretcher(land) {
    var b = land.box; if (!b) return null;
    var lo = b[0], w = b[1] - b[0];
    return { lo: lo, w: w, toX: function (t) { return [lo + w * (1 + Math.tanh(t[0])) / 2, lo + w * (1 + Math.tanh(t[1])) / 2]; },
             dxdt: function (t) { return t.map(function (v) { var th = Math.tanh(v); return w * (1 - th * th) / 2; }); } };
  }
  function unit(v) { var l = len(v) || 1; return [v[0] / l, v[1] / l]; }
  function degBetween(a, b) { var d = Math.atan2(a[0] * b[1] - a[1] * b[0], dot(a, b)); return Math.round(Math.abs(d) * 180 / Math.PI); }

  B.register('lbDay', function (cx, out) {
    var rec = cx.rec, w = cx.walk, land = cx.land, mm = Math.round(cx.p.m), x = cx.x, k = cx.k;
    if (!rec) return;
    var st = rec.stretched ? stretcher(land) : null, t0 = rec.t, d = rec.d, gt = rec.gt;
    var toX = st ? st.toX : function (t) { return t.slice(); }, J = cx.J;
    var D = st ? st.dxdt(t0) : [1, 1], dirX = unit([D[0] * d[0], D[1] * d[1]]), downX = unit([-D[0] * gt[0], -D[1] * gt[1]]), turn = degBetween(downX, dirX);
    var queue = rec.queue || [], pagesIn = function (pages) { return pages.map(function (pg) { return [w[Math.max(0, pg.day - 1)].x, w[Math.min(pg.day, w.length - 1)].x]; }); };
    var span = cx.span, near = around([x, rec.x].concat(queue.length ? [].concat.apply([], pagesIn(queue)) : []), 0.5, 10 * cx.h);
    function course(tau) { return toX([t0[0] + tau * d[0], t0[1] + tau * d[1]]); }
    function base(g) { g.land(J, cx.shade); g.axes(); if (land.box) g.path(boxPath(land.box), C.blue, 1.5, 1); }
    // 1. the journal
    var torn = rec.torn || [];
    out.push({ id: 'journal', chapter: 'The journal', title: 'The journal: a queue of the last m strides', layout: 'map+side', view: near, dur: 4.2,
      text: mm === 0 ? 'This Cartographer keeps no journal (m = 0): it goes straight downhill and only tests candidate step lengths.' :
        'The Cartographer keeps a journal of its last m = ' + mm + ' strides. It works like a queue: each new page joins at the bottom, and once there are m pages the oldest leaves at the top. ' +
        (rec.restart ? 'Today its pages pointed it uphill, so it tears all ' + torn.length + ' out and starts again with none.' : queue.length ? 'Today it holds ' + queue.length + (queue.length === 1 ? ' page' : ' pages') + ', each written on the day its stride was taken; on the map each page is the stride it remembers.' : 'Today is its first day, so the journal is still empty.'),
      math: mm === 0 ? 'm = 0' : at(0.2, 'm = ' + mm) + at(0.6, ', pages today: ' + queue.length),
      draw: function (g, p) {
        base(g); g.path(cx.path, C.blue, 1.5, 1, [4, 4]); g.hero(x, 'lb', 1);
        var shown = rec.restart ? torn : queue, segs = pagesIn(shown);
        segs.forEach(function (sg, i) { var q = seg(p, 0.15 + 0.6 * i / Math.max(segs.length, 1), 0.15 + 0.6 * (i + 1) / Math.max(segs.length, 1)); g.arrow(sg[0], sg[1], rec.restart ? C.red : C.gold, 3, q); g.label(lerp2(sg[0], sg[1], 0.5), 'page ' + (i + 1), rec.restart ? C.red : C.gold, { dx: 8, dy: -12, p: q, size: 12 }); });
        if (mm > 0) fifo(g, g.sideR, pageRows(shown, function (pg, i) { return { p: seg(p, 0.15 + 0.6 * i / Math.max(shown.length, 1), 0.15 + 0.6 * (i + 1) / Math.max(shown.length, 1)), strike: rec.restart, col: rec.restart ? C.red : C.ink, mark: rec.restart ? 'torn out' : '' }; }).concat(shown.length < mm ? [{ n: '', day: null, p: seg(p, 0.75, 0.9), col: C.dim, mark: (mm - shown.length) + ' empty' }] : []), mm, p);
        else g.panel(g.sideR, 'No journal');
      } });
    // 2. one page
    var last = queue[queue.length - 1];
    if (last && !rec.restart) {
      var a = w[last.day - 1].x, b = w[last.day].x, gb = w[last.day].g, ga = w[last.day + 1] ? w[last.day + 1].g : rec.g, curve = dot(last.y, last.s) / dot(last.s, last.s);
      var pv = around([a, b], 0.9, 12 * cx.h), gl = Math.max(len(ga), len(gb), 1e-12), kk = 0.32 * (pv[1] - pv[0]) / gl;
      out.push({ id: 'page', chapter: 'The journal', title: 'What one page says', layout: 'map+side', view: pv, dur: 4.4,
        text: 'Take the newest page, from day ' + last.day + '. It holds the stride s, from where the Cartographer stood to where it went, and y, how the slope ∇J changed over that stride (the slope after minus the slope before). ' +
          'The quotient yᵀs/sᵀs = ' + num(curve, 2) + ' is the change in uphill slope along s divided by the distance travelled. The journal itself keeps both complete vectors s and y.' + (st ? ' (On this walled land the journal is kept on a stretched map, so its numbers are measured there; see the next step.)' : ''),
        math: at(0.3, 's = ' + pair(last.s)) + at(0.5, ',  y = ' + pair(last.y)) + at(0.8, '<br>curve = yᵀs/sᵀs = ' + num(curve, 2)),
        draw: function (g, p) {
          base(g); g.arrow(a, b, C.gold, 3, seg(p, 0.05, 0.3)); g.label(lerp2(a, b, 0.5), 's, the stride', C.gold, { dx: 8, dy: -14, p: seg(p, 0.2, 0.35) });
          g.arrow(a, add(a, gb, kk), C.orange, 2.5, seg(p, 0.35, 0.5)); g.tipLabel(add(a, gb, kk), gb, 'slope before', C.orange, seg(p, 0.45, 0.55));
          g.arrow(b, add(b, ga, kk), C.orange, 2.5, seg(p, 0.5, 0.65)); g.tipLabel(add(b, ga, kk), ga, 'slope after', C.orange, seg(p, 0.6, 0.7));
          var dy = sub(ga, gb); g.arrow(add(b, gb, kk), add(add(b, gb, kk), dy, kk), C.violet, 2.5, seg(p, 0.7, 0.85)); g.tipLabel(add(add(b, gb, kk), dy, kk), dy, 'y: the change', C.violet, seg(p, 0.8, 0.9));
          g.line(b, add(b, gb, kk), 'rgba(255,176,113,0.45)', 1.5, seg(p, 0.65, 0.75), [4, 4]);
          var R = g.sideR; g.panel(R, 'Page from day ' + last.day);
          [['stride s', pair(last.s), C.gold], ['slope change y', pair(last.y), C.violet], ['curve yᵀs/sᵀs', num(curve, 2), C.ink]].forEach(function (row, i) {
            g.labelPx(R[0] + 14, R[1] + 52 + 30 * i, row[0], row[2], { plain: true, p: seg(p, 0.3 + 0.2 * i, 0.45 + 0.2 * i) });
            g.labelPx(R[0] + 150, R[1] + 52 + 30 * i, row[1], C.ink, { plain: true, mono: true, p: seg(p, 0.3 + 0.2 * i, 0.45 + 0.2 * i) });
          });
        } });
    }
    // The tutorial follows the day-2 page while it is being made.  Keep these
    // ideas on separate pages: accepted step length, displacement, endpoint
    // gradients, their change, and finally the rise-over-run quotient.
    var made = rec.wrote;
    if (cx.tutorial && made && !st) {
      var pageNo = Math.max(0, made.day - 1), si = subscript(pageNo), sj = subscript(pageNo + 1);
      var detailA = x.slice(), detailB = rec.x.slice(), madeS = made.s.slice(), madeY = made.y.slice();
      var gradBefore = gt.slice(), gradAfter = add(gradBefore, madeY), detailCurve = dot(madeY, madeS) / dot(madeS, madeS);
      var detailView = around([detailA, detailB], 1.35, 14 * cx.h), detailGradLen = Math.max(len(gradBefore), len(gradAfter), 1e-12);
      var detailGradScale = 0.25 * (detailView[1] - detailView[0]) / detailGradLen;
      var detailDistance = len(madeS), detailHat = unit(madeS), slopeBefore = dot(gradBefore, detailHat), slopeAfter = dot(gradAfter, detailHat);
      var slopePad = Math.abs(slopeAfter - slopeBefore) * 0.45 || 0.1;

      out.push({ id: 'page-stride', chapter: 'The journal', title: 'How day ' + made.day + ' takes its stride', layout: 'map+side', view: detailView, dur: 4.8,
        text: 'The Cartographer starts at x' + si + ' and its journal has already chosen the direction d' + si + '. The line search tests how far to travel and accepts the step length t' + si + ' = ' + stepName(rec.step) + '. ' +
          'The gold arrow is the resulting stride: s' + si + ' = x' + sj + ' − x' + si + ' = t' + si + 'd' + si + '. The step length t' + si + ' is one number; the stride s' + si + ' is the two-coordinate move.',
        math: at(0.3, 't' + si + ' = ' + stepName(rec.step) + ',  d' + si + ' = ' + pair(d)) + at(0.62, '<br>s' + si + ' = x' + sj + ' − x' + si + ' = t' + si + 'd' + si) + at(0.88, ' = ' + pair(madeS, 4)),
        draw: function (g, p) {
          base(g); g.path(cx.path, C.blue, 1.4, 1, [4, 4]);
          g.dot(detailA, 5, C.ink, 1); g.label(detailA, 'x' + si, C.ink, { dx: -10, dy: 18, align: 'right' });
          g.arrow(detailA, add(detailA, d), C.blue, 2, seg(p, 0.08, 0.35), [6, 4]);
          g.label(lerp2(detailA, add(detailA, d), 0.6), 'd' + si + ', chosen direction', C.blue, { dx: 9, dy: -15, p: seg(p, 0.25, 0.4) * (1 - seg(p, 0.46, 0.62)), size: 12 });
          g.arrow(detailA, detailB, C.gold, 4, seg(p, 0.4, 0.72));
          g.dot(detailB, 5, C.gold, seg(p, 0.65, 0.78)); g.label(detailB, 'x' + sj, C.gold, { dx: 12, dy: 25, p: seg(p, 0.68, 0.82) });
          g.label(lerp2(detailA, detailB, 0.48), 's' + si + ' = t' + si + 'd' + si, C.gold, { dx: -8, dy: 17, align: 'right', p: seg(p, 0.65, 0.82) });
          g.hero(lerp2(detailA, detailB, ease(seg(p, 0.42, 0.78))), 'lb', 1);
          var R = g.sideR; g.panel(R, 'From a direction to the stride');
          g.labelPx(R[0] + 16, R[1] + 58, '1. choose direction  d' + si + ' = ' + pair(d, 4), C.blue, { plain: true, mono: true, p: seg(p, 0.1, 0.32) });
          g.labelPx(R[0] + 16, R[1] + 91, '2. accept step length  t' + si + ' = ' + stepName(rec.step), C.ink, { plain: true, mono: true, p: seg(p, 0.3, 0.52) });
          g.labelPx(R[0] + 16, R[1] + 124, '3. move  s' + si + ' = t' + si + 'd' + si, C.gold, { plain: true, mono: true, p: seg(p, 0.52, 0.75) });
          g.labelPx(R[0] + 16, R[1] + 157, '   s' + si + ' = ' + pair(madeS, 4), C.gold, { plain: true, mono: true, p: seg(p, 0.7, 0.9) });
        } });

      out.push({ id: 'page-slopes', chapter: 'The journal', title: 'Measure the gradient at both ends', layout: 'map+side', view: detailView, dur: 4.6,
        text: 'Before the stride, at x' + si + ', the uphill slope is the gradient g' + si + ' = ∇J(x' + si + '). After the stride, at x' + sj + ', it measures again: g' + sj + ' = ∇J(x' + sj + '). ' +
          'The two arrows use exactly the same scale, so their change in size and direction can be compared directly.',
        math: at(0.35, 'g' + si + ' = ∇J(x' + si + ') = ' + pair(gradBefore, 4)) + at(0.72, '<br>g' + sj + ' = ∇J(x' + sj + ') = ' + pair(gradAfter, 4)),
        draw: function (g, p) {
          base(g); g.arrow(detailA, detailB, 'rgba(255,210,122,0.45)', 2, 1); g.label(lerp2(detailA, detailB, 0.5), 's' + si, C.gold, { dx: 8, dy: 15, size: 12 });
          g.dot(detailA, 5, C.ink, 1); g.dot(detailB, 5, C.ink, 1);
          g.label(detailA, 'x' + si, C.ink, { dx: -8, dy: 18, align: 'right' }); g.label(detailB, 'x' + sj, C.ink, { dx: 8, dy: 18 });
          var tip1 = add(detailA, gradBefore, detailGradScale), tip2 = add(detailB, gradAfter, detailGradScale);
          g.arrow(detailA, tip1, C.orange, 3, seg(p, 0.1, 0.42)); g.tipLabel(tip1, gradBefore, 'g' + si + ': before', C.orange, seg(p, 0.32, 0.5));
          g.arrow(detailB, tip2, C.green, 3, seg(p, 0.45, 0.76)); g.tipLabel(tip2, gradAfter, 'g' + sj + ': after', C.green, seg(p, 0.66, 0.84));
          var R = g.sideR; g.panel(R, 'Same arrow scale');
          g.labelPx(R[0] + 16, R[1] + 62, 'before:  g' + si + ' = ' + pair(gradBefore, 4), C.orange, { plain: true, mono: true, p: seg(p, 0.25, 0.48) });
          g.labelPx(R[0] + 16, R[1] + 100, 'after:   g' + sj + ' = ' + pair(gradAfter, 4), C.green, { plain: true, mono: true, p: seg(p, 0.58, 0.81) });
        } });

      out.push({ id: 'page-change', chapter: 'The journal', title: 'Subtract the two gradients', layout: 'side', dur: 4.8,
        text: 'Slide the two gradient arrows to one common tail without rotating or resizing them. The violet arrow from the tip of g' + si + ' to the tip of g' + sj + ' is exactly what changed. ' +
          'Call it y' + si + ': adding y' + si + ' to the old gradient reaches the new gradient, so y' + si + ' = g' + sj + ' − g' + si + '.',
        math: at(0.42, 'g' + si + ' + y' + si + ' = g' + sj) + at(0.72, '<br>y' + si + ' = g' + sj + ' − g' + si) + at(0.9, ' = ' + pair(madeY, 4)),
        draw: function (g, p) {
          var R = g.sideR; g.panel(R, 'Put both gradients at the same tail');
          var O = [R[0] + R[2] * 0.52, R[1] + R[3] * 0.45], sc = Math.min(R[2], R[3]) * 0.38 / detailGradLen;
          var P1 = [O[0] + gradBefore[0] * sc, O[1] - gradBefore[1] * sc], P2 = [O[0] + gradAfter[0] * sc, O[1] - gradAfter[1] * sc];
          var q1 = seg(p, 0.08, 0.35), q2 = seg(p, 0.28, 0.55), qy = seg(p, 0.58, 0.86);
          g.ctx.beginPath(); g.ctx.arc(O[0], O[1], 4, 0, TAU); g.ctx.fillStyle = C.ink; g.ctx.fill();
          g.arrowPx(O, [mix(O[0], P1[0], q1), mix(O[1], P1[1], q1)], C.orange, 3);
          g.labelPx(P1[0] - 8, P1[1] + 14, 'g' + si, C.orange, { align: 'right', p: seg(p, 0.25, 0.42) });
          g.arrowPx(O, [mix(O[0], P2[0], q2), mix(O[1], P2[1], q2)], C.green, 3);
          g.labelPx(P2[0] + 9, P2[1] - 12, 'g' + sj, C.green, { p: seg(p, 0.48, 0.62) });
          g.arrowPx(P1, [mix(P1[0], P2[0], qy), mix(P1[1], P2[1], qy)], C.violet, 3.5);
          g.labelPx((P1[0] + P2[0]) / 2 + 12, (P1[1] + P2[1]) / 2 - 10, 'y' + si + ' = g' + sj + ' − g' + si, C.violet, { p: seg(p, 0.74, 0.9) });
        } });

      out.push({ id: 'page-curve', chapter: 'The journal', title: 'Why the denominator is s' + si + 'ᵀs' + si, layout: 'map+side', view: detailView, dur: 5.6,
        text: 'Now look only in the direction of the stride. On the plot, the vertical rise is the change in uphill slope along that direction, y' + si + 'ᵀŝ' + si + '. The horizontal run is the distance travelled, ‖s' + si + '‖. ' +
          'Rise divided by run gives the change in slope per unit distance. Because ŝ' + si + ' = s' + si + '/‖s' + si + '‖, the stride length appears twice: ‖s' + si + '‖² = s' + si + 'ᵀs' + si + '.',
        math: at(0.22, frac('change in uphill slope along the stride', 'distance travelled')) + at(0.52, ' = ' + frac('y' + si + 'ᵀŝ' + si, '‖s' + si + '‖')) + at(0.76, ' = ' + frac('y' + si + 'ᵀs' + si, 's' + si + 'ᵀs' + si)) + at(0.92, ' = ' + num(detailCurve, 2)),
        draw: function (g, p) {
          base(g); g.arrow(detailA, detailB, C.gold, 4, seg(p, 0.04, 0.24));
          g.label(detailA, 'x' + si, C.ink, { dx: -8, dy: 18, align: 'right' }); g.label(detailB, 'x' + sj, C.ink, { dx: 10, dy: 28 });
          g.label(lerp2(detailA, detailB, 0.5), 's' + si + ', distance ‖s' + si + '‖', C.gold, { dx: 8, dy: -15, p: seg(p, 0.16, 0.3), size: 12 });
          var R = g.sideR, low = Math.min(slopeBefore, slopeAfter) - slopePad, high = Math.max(slopeBefore, slopeAfter) + slopePad;
          var pl = g.plot(R, [0, detailDistance], [low, high], { title: 'Uphill slope while travelling along s' + si });
          pl.frame('', 'uphill slope along s' + si);
          pl.curve(function (r) { return dot(land.grad(add(detailA, detailHat, r)), detailHat); }, C.blue, 2.5, seg(p, 0.22, 0.55));
          pl.point(0, slopeBefore, C.orange, 'before', seg(p, 0.38, 0.55), 'right');
          pl.point(detailDistance, slopeAfter, C.green, 'after', seg(p, 0.48, 0.65), 'left');
          pl.run(0, detailDistance, low + 0.08 * (high - low), 'run = ‖s' + si + '‖', C.gold, seg(p, 0.62, 0.8));
          pl.rise(detailDistance, slopeBefore, slopeAfter, 'rise = y' + si + 'ᵀŝ' + si, C.violet, seg(p, 0.72, 0.9));
        } });
    }
    // 3. the stretched map
    if (st) {
      out.push({ id: 'stretch', chapter: 'The course', title: 'The stretched map', layout: 'side', dur: 4.2,
        text: 'Inside a wall the Cartographer never steps out, because it walks on a stretched map t instead of on x: x = lo + w·(1 + tanh t)/2 for each coordinate, with lo = ' + num(st.lo, 2) + ' and w = ' + num(st.w, 2) + '. ' +
          'Every t, however large, lands inside the wall, and the wall itself is infinitely far away. Near the wall a step in t moves x very little, so the Cartographer slows down there.',
        math: 'x = lo + w·(1 + tanh t)/2;  today t = ' + pair(t0) + at(0.7, ' ↔ x = ' + pair(x)),
        draw: function (g, p) {
          var R = g.sideR, T = Math.max(3, Math.abs(t0[0]) + 0.5, Math.abs(t0[1]) + 0.5), pl = g.plot(R, [-T, T], [st.lo - 0.08 * st.w, st.lo + 1.08 * st.w], { title: 'from the stretched map t to the land x' });
          pl.frame('t →', 'x'); pl.seg(-T, st.lo, T, st.lo, C.blue, 1.5, 1, [5, 4]); pl.seg(-T, st.lo + st.w, T, st.lo + st.w, C.blue, 1.5, 1, [5, 4]);
          pl.curve(function (t) { return st.lo + st.w * (1 + Math.tanh(t)) / 2; }, C.gold, 2.5, seg(p, 0.05, 0.4));
          pl.point(t0[0], x[0], C.orange, 't₁ → x₁ = ' + num(x[0]), seg(p, 0.45, 0.6), t0[0] > 0 ? 'left' : 'right');
          pl.point(t0[1], x[1], C.violet, 't₂ → x₂ = ' + num(x[1]), seg(p, 0.6, 0.75), t0[1] > 0 ? 'left' : 'right');
          g.labelPx(pl.box[0] + 8, pl.Y(st.lo + st.w) - 12, 'the wall', C.blue, { plain: true, size: 12, p: seg(p, 0.75, 0.9) });
        } });
    }
    // 4. reading the journal: the two-loop recursion
    var rd = rec.reading || {}, n = queue.length, aw = 0.3 * (cx.zoom[1] - cx.zoom[0]), cv = [x[0] - 4.5 * cx.h, x[0] + 4.5 * cx.h, x[1] - 4.5 * cx.h, x[1] + 4.5 * cx.h];
    out.push({ id: 'read', chapter: 'The course', title: 'Reading the journal', layout: 'map+side', view: cv, dur: 5,
      text: rec.restart ? 'Its pages would have turned it uphill, so it trusts none of them today: it heads straight downhill' + (st ? ' on its stretched map' : '') + ', d = −∇J.' :
        !n ? 'With no pages yet there is nothing to bend: it heads straight downhill' + (st ? ' on its stretched map' : '') + ', d = −∇J, like the Pilgrim. Unlike the Pilgrim, it will choose a step length with a line search before it moves.' :
        'To choose its course it reads the complete s and y vectors on every page twice: from the newest to the oldest, then back from the oldest to the newest. Each page bends the course to match how the land changed along that stride, and in between it scales by γ = sᵀy/yᵀy of the newest page, ' + num(rd.gamma, 4) + '. ' +
        'The result is d = −H∇J: ' + turn + '° away from straight downhill' + (st ? ' on its stretched map' : '') + '.',
      math: (n && !rec.restart ? at(0.45, 'γ = sᵀy/yᵀy = ' + num(rd.gamma, 4)) + '<br>' : '') + at(0.85, 'd = ' + (n && !rec.restart ? '−H∇J = ' : '−∇J = ') + pair(d) + ', ' + turn + '° from straight downhill'),
      draw: function (g, p) {
        g.land(J, { id: 'J', rings: 9 }); g.axes(); g.hero(x, 'lb', 1);
        g.arrow(x, add(x, downX, aw), C.ink, 2.5, seg(p, 0.05, 0.25), [6, 4]); g.label(lerp2(x, add(x, downX, aw), 0.6), 'straight downhill', C.ink, { dx: downX[1] > 0 ? 12 : -12, dy: downX[0] > 0 ? 14 : -14, align: downX[1] > 0 ? 'left' : 'right', p: seg(p, 0.15, 0.3), size: 12 });
        var sw = seg(p, 0.6, 0.95), a0 = Math.atan2(downX[1], downX[0]), a1 = Math.atan2(dirX[1], dirX[0]), da = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)), ang = a0 + da * sw, dv = [Math.cos(ang), Math.sin(ang)];
        g.arrow(x, add(x, dv, aw * 1.15), C.blue, 3.5, seg(p, 0.55, 0.65)); if (sw > 0.95) g.tipLabel(add(x, dv, aw * 1.15), dv, 'd, its course', C.blue, 1);
        if (mm > 0) {
          var order1 = [], r;
          for (r = n - 1; r >= 0; r--) order1.push(r);
          for (r = 0; r < n; r++) order1.push(r);
          var pos = rec.restart || !n ? -1 : Math.floor(seg(p, 0.1, 0.55) * order1.length * 0.999), cur = pos >= 0 ? order1[pos] : -1, second = pos >= n;
          fifo(g, g.sideR, pageRows(rec.restart ? torn : queue, function (pg, i) {
            var aI = rd.alphas ? rd.alphas[n - 1 - i] : null, bI = rd.betas ? rd.betas[i] : null, firstDone = pos >= 0 && (second || order1.indexOf(i) <= pos), secondDone = second && i <= cur;
            return { lit: i === cur, strike: rec.restart, col: rec.restart ? C.red : C.ink, mark: rec.restart ? 'torn out' : secondDone ? 'β = ' + num(bI, 3) : firstDone && aI != null ? 'α = ' + num(aI, 3) : '' };
          }), mm, p, { title: rec.restart ? 'Torn out today' : second ? 'Reading back: oldest to newest' : 'Reading: newest to oldest' });
        } else g.panel(g.sideR, 'No journal');
      } });
    // 5. testing the stride (Armijo)
    var tr = (rec.trials || []).map(function (q) { return { tau: q.step, f: q.f, need: q.need, x: q.x, ok: false }; });
    tr.push({ tau: rec.step, f: rec.felt, need: rec.need, x: rec.x, ok: true });
    var gd = dot(gt, d), tmin = Math.min.apply(null, tr.map(function (q) { return q.tau; })), u0 = Math.log(tmin) / Math.LN2 - 0.6, u1 = 0.6;
    var sv = around([x].concat(tr.map(function (q) { return q.x; })), 0.4, 10 * cx.h);
    var hs = [], uu; for (uu = u0; uu <= u1; uu += (u1 - u0) / 60) hs.push(J(course(Math.pow(2, uu))));
    tr.forEach(function (q) { hs.push(q.f, q.need); }); hs.push(rec.fromF);
    var vlo = Math.min.apply(null, hs), vhi = Math.max.apply(null, hs), vp = (vhi - vlo) * 0.15 || 1e-3;
    var words = tr.map(function (q) { return 'step length ' + stepName(q.tau) + ': ' + num(q.f, 4) + (q.ok ? ' ≤ ' : ' > ') + num(q.need, 4) + (q.ok ? ' ✓' : ' ✗'); });
    out.push({ id: 'tests', chapter: 'The line search', title: 'Choosing the step length', layout: 'map+side', view: sv, dur: Math.min(6, 3.4 + 0.4 * tr.length),
      text: 'It never trusts a proposed move blindly. It first tries step length 1 along d; if the land there is not lower by enough, it halves the step length and tries again. ' +
        '“Enough” is the Armijo test: the height must be at most f(x) + 10⁻⁴·' + (st ? '(step length)' : 't') + '·(∇J·d), a hair below the ' + num(rec.fromF, 4) + ' where it stands. ' +
        (tr.length > 1 ? 'Today it tried ' + tr.length + ' step lengths; ' + (st ? 'step length ' : 't = ') + stepName(rec.step) + ' passed.' : 'Today step length ' + (st ? '1' : 't = 1') + ' passed at once.') + (cx.haze ? ' In this haze every height it tries is a tap, off by about σ, so the dots need not sit on the curve.' : ''),
      math: words.slice(0, 4).map(function (wd, i) { return at(0.2 + 0.6 * i / Math.min(4, words.length), wd); }).join('<br>') + (words.length > 4 ? '<br>' + at(0.85, '… ' + (words.length - 4) + ' more') : ''),
      draw: function (g, p) {
        base(g); g.hero(x, 'lb', 1);
        var crv = []; for (var i = 0; i <= 40; i++) crv.push(course(i / 40)); g.path(crv, C.blue, 2, seg(p, 0, 0.2), [6, 4]);
        tr.forEach(function (q, i) { var s0 = seg(p, 0.2 + 0.6 * i / tr.length, 0.2 + 0.6 * (i + 1) / tr.length); g.dot(q.x, 6, q.ok ? C.green : C.red, s0); if (i < 6 || q.ok) g.label(q.x, stepName(q.tau) + (q.ok ? ' ✓' : ' ✗'), q.ok ? C.green : C.red, { dx: 9, dy: -11, p: s0, size: 12 }); });
        var pl = g.plot(g.sideR, [u0, u1], [vlo - vp, vhi + vp], { title: 'the height along its course, by step length', tTicks: false }), U = function (tau) { return Math.log(tau) / Math.LN2; };
        pl.frame(st ? 'step length, halving to the left' : 'step length t, halving to the left', 'J');
        var nT = Math.round(-U(tmin)), every = Math.max(1, Math.ceil((nT + 1) / 7)); g.ctx.font = '11px ' + g.mono; g.ctx.fillStyle = C.dim; g.ctx.textAlign = 'center'; g.ctx.textBaseline = 'top';
        for (var jj = 0; jj <= nT; jj += every) g.ctx.fillText(stepName(Math.pow(2, -jj)), pl.X(-jj), pl.box[1] + pl.box[3] + 4);
        pl.curve(function (u) { return J(course(Math.pow(2, u))); }, C.dim, 1.8, seg(p, 0.05, 0.25));
        pl.curve(function (u) { return rec.fromF + 1e-4 * Math.pow(2, u) * gd; }, C.gold, 1.5, seg(p, 0.1, 0.3));
        g.labelPx(pl.box[0] + pl.box[2] - 4, pl.Y(rec.fromF) - 12, 'the bar to pass', C.gold, { align: 'right', size: 11.5, p: seg(p, 0.2, 0.35) });
        tr.forEach(function (q, i) { pl.point(U(q.tau), q.f, q.ok ? C.green : C.red, i < 5 || q.ok ? stepName(q.tau) + (q.ok ? ' ✓' : ' ✗') : '', seg(p, 0.2 + 0.6 * i / tr.length, 0.2 + 0.6 * (i + 1) / tr.length), U(q.tau) > (u0 + u1) / 2 ? 'left' : 'right'); });
      } });
    // 6. the stride
    var mv = around([x, rec.x], 0.6, 10 * cx.h), storedStride = rec.wrote ? rec.wrote.s : scale(d, rec.step);
    out.push({ id: 'stride', chapter: 'The stride', title: 'Taking the stride', layout: 'map', view: mv, dur: 3.6,
      text: st ? 'On its stretched map it accepts step length ' + stepName(rec.step) + ' along d. There, the journal stride is s = t<sub>new</sub> − t<sub>old</sub> = (step length)·d = ' + pair(storedStride) + '. ' +
          'The nonlinear map carries its position on the land from ' + pair(x) + ' to ' + pair(rec.x) + '; that physical move is not the stored s. The height goes from ' + num(cx.Jx, 4) + ' to ' + num(rec.J, 4) + '.' :
        'It accepts step length t = ' + stepName(rec.step) + ' and takes the resulting stride s = t·d: from ' + pair(x) + ' to ' + pair(rec.x) + '. The height goes from ' + num(cx.Jx, 4) + ' to ' + num(rec.J, 4) + '.',
      math: st ? 'stretched map: s = t<sub>new</sub> − t<sub>old</sub> = (step length)·d = ' + pair(storedStride) + at(0.72, '<br>land: x ← ' + pair(rec.x)) + at(0.9, ';  J: ' + num(cx.Jx, 4) + ' → ' + num(rec.J, 4)) :
        's = t·d = x<sub>new</sub> − x = ' + pair(storedStride) + at(0.72, '<br>x ← ' + pair(rec.x)) + at(0.9, ';  J: ' + num(cx.Jx, 4) + ' → ' + num(rec.J, 4)),
      draw: function (g, p) {
        base(g); var q = seg(p, 0.1, 0.7), pts = []; for (var i = 0; i <= 30; i++) pts.push(course(rec.step * i / 30 * q));
        g.path(pts, C.blue, 3, 1); g.hero(pts[pts.length - 1], 'lb', 1);
        g.label(x, 'J = ' + num(cx.Jx, 4), C.dim, { dx: 12, dy: 16 }); g.label(rec.x, 'J = ' + num(rec.J, 4), C.gold, { dx: 12, dy: -16, p: seg(p, 0.75, 0.9) });
      } });
    // 7. a new page
    if (mm > 0) {
      var after = rec.after || [], dropped = rec.dropped || [];
      var wroteIndex = rec.wrote ? Math.max(0, rec.wrote.day - 1) : 0, wroteSub = subscript(wroteIndex);
      var tutorialPageText = rec.wrote && cx.tutorial ? 'The page from day ' + rec.wrote.day + ' now joins the journal. It stores the complete vectors s' + wroteSub + ' = ' + pair(rec.wrote.s, 4) + ' and y' + wroteSub + ' = ' + pair(rec.wrote.y, 4) + '—not only the value ' + num(dot(rec.wrote.y, rec.wrote.s) / dot(rec.wrote.s, rec.wrote.s), 2) + '. ' +
        'That quotient was a one-number explanation of bending along this stride. On the next day L-BFGS reads both vectors. The separate scale sᵀy/yᵀy used while reading has a different denominator and a different role.' : '';
      out.push({ id: 'newpage', chapter: 'The journal', title: rec.wrote ? (cx.tutorial ? 'The complete pair enters the journal' : 'A new page joins the queue') : 'No page today', layout: 'side', dur: 4,
        text: rec.wrote ? (tutorialPageText || ('After the stride it writes today’s page at the bottom of the journal: s = ' + pair(rec.wrote.s) + ', y = ' + pair(rec.wrote.y) + '. ' +
            (dropped.length ? 'The journal already held m = ' + mm + ' pages, so the oldest, from day ' + dropped[0].day + ', leaves at the top: first in, first out.' : 'The journal now holds ' + after.length + ' of its ' + mm + ' pages; pages leave only once it is full.')))
          : 'It writes no page today: the slope did not grow along this stride (yᵀs ≤ 0), and such a page would mislead its reading.',
        math: rec.wrote ? (cx.tutorial ? at(0.35, 'stored: (s' + wroteSub + ', y' + wroteSub + ')') + at(0.72, '<br>s' + wroteSub + ' = ' + pair(rec.wrote.s, 4)) + at(0.9, ',  y' + wroteSub + ' = ' + pair(rec.wrote.y, 4)) : at(0.5, 'in: day ' + rec.wrote.day) + (dropped.length ? at(0.75, ',  out: day ' + dropped[0].day) : '')) : 'yᵀs ≤ 0: no page',
        draw: function (g, p) {
          var rows = dropped.map(function (pg) { return { n: '−', day: pg.day, s: pg.s, y: pg.y, strike: true, col: C.red, mark: '← leaves', p: 1 - 0.6 * seg(p, 0.55, 0.9) }; });
          rows = rows.concat(pageRows(after, function (pg) { var fresh = rec.wrote && pg.day === rec.wrote.day; return fresh ? { col: C.green, mark: cx.tutorial ? '' : '← joins', p: seg(p, 0.15, 0.5) } : {}; }));
          if (after.length < mm) rows.push({ n: '', day: null, col: C.dim, mark: (mm - after.length) + ' empty' });
          fifo(g, g.sideR, rows, mm, p);
        } });
    }
    // 8. and again
    var ahead = w.slice(k, Math.min(w.length, k + 9)).map(function (q) { return q.x; });
    if (ahead.length > 2) {
      out.push({ id: 'again', chapter: 'The stride', title: 'And again, day after day', layout: 'map', view: around(ahead, 0.35, 10 * cx.h), dur: 4,
        text: 'Each day it reads its pages, chooses a step length, takes the resulting stride and writes one more page. Here are its next ' + (ahead.length - 1) + ' days. The pages teach it the shape of the land, so its course bends toward the bottom instead of zigzagging across the valley.',
        math: st ? 'stretched map: t ← t + (step length)·d;  then map t to x' : 'd = −H∇J,  x ← x + t·d',
        draw: function (g, p) {
          base(g); var nn = ahead.length - 1, s = seg(p, 0.05, 0.9) * nn, kk = Math.floor(s), f = s - kk;
          g.path(ahead.slice(0, kk + 1).concat(kk < nn ? [lerp2(ahead[kk], ahead[kk + 1], ease(f))] : []), C.blue, 2.5, 1);
          ahead.slice(1, kk + 1).forEach(function (q, i) { g.dot(q, 4, C.blue, 1); g.label(q, 'day ' + (k + i + 1), C.dim, { dx: 8, dy: -10, size: 11 }); });
          g.hero(kk < nn ? lerp2(ahead[kk], ahead[kk + 1], ease(f)) : ahead[nn], 'lb', 1);
        } });
    }
    if (cx.last && w.why === 'line search') {
      out.push({ id: 'stall', chapter: 'The stride', title: 'Why it stops', layout: 'map', view: around([w[w.length - 1].x], 0, 12 * cx.h), dur: 3.4,
        text: 'On day ' + (w.length) + ' it halved the step length again and again, down to almost nothing, and no candidate passed the test: ' + (cx.haze ? 'in this haze its taps contradict each other, so even a tiny step looks too high.' : 'along its course this is as low as it can measure.') + ' So it stops for good.',
        math: 'no step length ' + (st ? '' : 't ') + '≥ 10⁻¹⁶ passed',
        draw: function (g, p) { g.land(J, { id: 'J', rings: 9 }); g.axes(); var q = w[w.length - 1].x; g.hero(q, 'lb', 1); g.halo(q, 14 + 10 * seg(p, 0.2, 0.8), C.red, 1 - seg(p, 0.8, 1), 2); } });
    }
  });

  // ------------------------------------------------------------ the Twins: one spot to dig, two skills, a rope, a book, and one circuit
  B.register('twDay', function (cx, out) {
    var rec = cx.rec, w = cx.walk, land = cx.land, P = cx.p, rho = P.rho, k = cx.k;
    if (!rec) return;
    var x = rec.from, z = rec.zFrom, u = rec.uFrom, v = rec.v, xn = rec.x, zn = rec.z, un = rec.u, tower = land.kind === 'tower', box = land.box;
    var wall = cx.key === 'wall', noLaw = !tower && !box, f = land.f, T = land.treasure, x0 = w[0].x;
    var lawName = tower ? 'the parity-polytope line' : wall ? 'the wall' : 'the realm', lawWord = tower ? 'on the parity-polytope line' : wall ? 'inside the wall' : 'inside the realm';
    // the Wanderer's own lowest spot, with nothing pulling on it: the valley's floor, or the lowest point of the cards'
    // land; there is none to name where the land has no formula
    var free = land.kind === 'quad' ? land.c.slice() : land.exactStep ? land.wanderer([0, 0], 1e-9) : null;
    var freeZ = free && !noLaw ? land.project(free) : free, freeOut = free && !noLaw ? len(sub(free, freeZ)) > 1e-9 : false;
    var xu = add(xn, u), gapNow = sub(x, z), gap = sub(xn, zn);
    var firstWallContact = null; for (var fj = 1; fj < w.length; fj++) if (w[fj].gap > 1e-9) { firstWallContact = fj; break; }
    var view = around([x, z, v, xn, zn, xu, add(z, u)], 0.5, 0.3 * cx.span);
    var introView = free ? around([x0, free, freeZ, T], 0.35, 0.5 * cx.span) : cx.landView;
    function law(g, p) { if (tower) g.line(land.lawSegment[0], land.lawSegment[1], C.blue, 3, p); else if (box) g.path(boxPath(box), C.blue, 2, p); }
    function warden(g, q, p, label) { if (!(p > 0)) return; g.dot(q, 7, C.blue, p); if (label) g.label(q, label, C.blue, { dx: 10, dy: 14, p: p, size: 12 }); }
    function base(g, shade) { g.land(shade || cx.J, shade ? { id: 'ropeShade', rings: 10 } : cx.shade); g.axes(); law(g, 1); }
    function star(g, q, p, text) {
      if (!(p > 0)) return; var c = g.ctx, a = g.P(q), r = 10 * H.backOut(p);
      c.beginPath(); for (var i = 0; i < 10; i++) { var an = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(a[0] + rr * Math.cos(an), a[1] + rr * Math.sin(an)); }
      c.closePath(); c.fillStyle = C.gold; c.fill(); c.strokeStyle = '#8a4b00'; c.lineWidth = 1.2; c.stroke();
      if (text) g.label(q, text, C.gold, { dx: 14, dy: 14, p: seg(p, 0.4, 1), size: 12 });
    }
    // the rope, drawn as a spring between two spots
    function spring(g, a, b, p, col) {
      if (!(p > 0)) return; var c = g.ctx, A = g.P(a), B2 = g.P(b), dx = B2[0] - A[0], dy = B2[1] - A[1], L = Math.hypot(dx, dy); if (L < 3) return;
      var ux = dx / L, uy = dy / L, n = 9, amp = Math.min(6, L / 30), end = Math.min(14, 0.15 * L), span = L - 2 * end;
      g.clip(g.mapR); c.globalAlpha = clamp(p, 0, 1); c.strokeStyle = col || C.orange; c.lineWidth = 2; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(A[0] + ux * end, A[1] + uy * end);
      for (var i = 1; i < 2 * n; i++) { var t = end + span * i / (2 * n), s = i % 2 ? amp : -amp; c.lineTo(A[0] + ux * t - uy * s, A[1] + uy * t + ux * s); }
      c.lineTo(B2[0] - ux * end, B2[1] - uy * end); c.lineTo(B2[0], B2[1]); c.stroke(); c.globalAlpha = 1; c.restore();
    }
    // the mark of a nearest point: a right angle at the foot, between the law and the leash to the point
    function rightAngle(g, foot, from, p) { var d = sub(from, foot), l = len(d); if (l < 1e-9 || !(p > 0)) return; var n = scale(d, 1 / l); g.square(foot, [-n[1], n[0]], n, 10, C.blue, p); }

    // ---- the King's request, and the two skills
    out.push({ id: 'twins', chapter: 'The Twins', title: 'One spot to dig, two skills', layout: 'map', view: cx.landView, dur: 5.4,
      text: noLaw ? 'The King wants one spot to dig: the lowest point of the land. Here there is no wall, so the Twins have only one job between them, and they walk as one. Their real tale begins on the land with a wall.' :
        'The King wants one spot to dig: the lowest point ' + lawWord + '. One spot, because a map with two marks is no answer. But the job has two halves that call for different skills. Finding the lowest point of the land is easy for someone who may roam anywhere and feels the slope. Keeping the law is easy for someone who stays ' + lawWord + ' and never looks at the land. Doing both at once is the hard part. So the King sends twins. The Wanderer hunts the lowest spot; the Warden keeps the law. The clerk files a spot only on the day both twins stand on it.',
      math: 'one spot: the lowest point with x in C' + at(0.5, '<br>two copies: x hunts the lowest point, z keeps the law, and at the end x = z'),
      draw: function (g, p) {
        var narrow = g.W < g.H;
        base(g); star(g, T, seg(p, 0, 0.2), narrow ? '' : 'the spot to dig'); g.flag(x0, seg(p, 0.2, 0.3));
        var wq = add(x0, [-0.045 * cx.span, 0]), zq = add(x0, [0.045 * cx.span, 0]);
        g.hero(wq, 'tw', seg(p, 0.3, 0.45)); g.dot(zq, 7, C.blue, seg(p, 0.45, 0.6));
        if (narrow) {
          g.labelPx(g.mapR[0] + 12, g.mapR[1] + 28, 'Wanderer x: lowers the cost', '#e6e9ee', { p: seg(p, 0.35, 0.5), size: 11.5 });
          g.labelPx(g.mapR[0] + 12, g.mapR[1] + 55, 'Warden z: keeps the law', C.blue, { p: seg(p, 0.5, 0.65), size: 11.5 });
          g.label(wq, 'x', '#e6e9ee', { dx: -10, dy: -17, align: 'right', p: seg(p, 0.35, 0.5), size: 12 });
          g.label(zq, 'z', C.blue, { dx: 10, dy: 18, p: seg(p, 0.5, 0.65), size: 12 });
        } else {
          g.label(wq, 'the Wanderer hunts the lowest spot', '#e6e9ee', { dx: -14, dy: -16, align: 'right', p: seg(p, 0.35, 0.5), size: 12 });
          g.label(zq, 'the Warden keeps the law', C.blue, { dx: 14, dy: 20, p: seg(p, 0.5, 0.65), size: 12 });
        }
        if (!noLaw) {
          g.line(x0, T, C.violet, 1.5, seg(p, 0.65, 0.9), [5, 4]);
          g.label(narrow ? T : lerp2(x0, T, 0.55), narrow ? 'both end at x*' : 'both must end on the spot to dig', C.violet,
            narrow ? { dx: -14, dy: -20, align: 'right', p: seg(p, 0.8, 1), size: 11.5 } : { dx: 0, dy: -18, align: 'center', p: seg(p, 0.8, 1), size: 12 });
        }
      } });

    var freeJ = free ? f(free) : null, TJ = f(T);
    out.push({ id: 'wanderer-role', chapter: 'The Twins', title: 'Meet the Wanderer: x', layout: 'map', view: introView, dur: 5.2,
      text: free ? 'The Wanderer’s job: find the lowest point of whatever it is asked to minimise. Asked about the land alone, it feels the slope and walks to ' + (tower ? 'the lowest point of the evidence fit and binary-end pull' : 'the valley’s floor') + ', c = ' + pair(free) + ', where J = ' + num(freeJ, 3) + '. It never looks at the law' + (freeOut ? ', and that spot is ' + (tower ? 'off the parity-polytope line' : 'outside ' + lawName) + ': no use to the King on its own.' : '.') + ' But add any pull to the land, and the Wanderer will find the new lowest point just as surely. That is the skill the King hired.' :
        'The Wanderer’s job: find the lowest point of whatever it is asked to minimise. On this land no formula gives that point, so it walks downhill in small steps, feeling the way with its staff. It never looks at the law.',
      math: 'the Wanderer: x = argmin f(x) + (whatever pulls on it)' + (free ? at(0.6, ';  with nothing pulling: c = ' + pair(free) + (freeOut ? ', outside C' : '')) : ''),
      draw: function (g, p) {
        base(g); g.flag(x0, 1); star(g, T, 1);
        if (free) {
          var q = seg(p, 0.1, 0.7); g.path([x0, free], 'rgba(230,233,238,0.6)', 2, q, [4, 4]); g.hero(lerp2(x0, free, q), 'tw', 1, q >= 1 ? 'c, the lowest point of all' : '');
          if (freeOut) g.label(free, tower ? 'off the parity-polytope line' : 'outside ' + lawName, C.red, { dx: 14, dy: 16, p: seg(p, 0.75, 0.95), size: 12 });
        } else g.hero(x, 'tw', 1, 'the Wanderer');
      } });

    // ---- the Warden. On the wall (tutorial only) it takes three pages: who it is, with C and Π in words; how it finds
    // the lawful spot nearest to c, first as a circle growing from c, then one direction at a time; and why that
    // nearest spot is not the lowest one. Elsewhere one page shows three spots taken to their nearest lawful spots.
    var cFace = -1;   // the one coordinate the wall changes when the Warden is handed c (2: both, -1: none)
    if (free && box && freeOut) for (var ci = 0; ci < 2; ci++) if (Math.abs(free[ci] - freeZ[ci]) > 1e-9) cFace = cFace < 0 ? ci : 2;
    var wardenPages = !!(cx.tutorial && box && freeOut && land.kind === 'quad' && land.A && !land.ripples && !land.holes &&
      (cFace === 0 || cFace === 1) && Math.abs(T[cFace] - freeZ[cFace]) < 1e-9);
    if (wardenPages) {
      var fi = cFace, fj = 1 - cFace, wallAt = freeZ[fi], dWall = len(sub(free, freeZ)), dStar = len(sub(free, T));
      var zJ = f(freeZ), gapTZ = len(sub(T, freeZ)), wd = box[1] - box[0];
      var SUBN = ['₁', '₂'], DIRS = ['east–west', 'north–south'], DIRC = ['East–west', 'North–south'];
      var faceName = (fi === 0 ? (wallAt >= box[1] ? 'east' : 'west') : (wallAt >= box[1] ? 'north' : 'south')) + ' wall';
      var bLo = num(box[0], 0), bHi = num(box[1], 0), lawRule = bLo + ' ≤ x₁ ≤ ' + bHi + ' and ' + bLo + ' ≤ x₂ ≤ ' + bHi;
      // the land's rings around c: on a quadratic land, ellipses whose long axis follows the valley
      var a11 = land.A[0][0], a12 = land.A[0][1], a22 = land.A[1][1], am = (a11 + a22) / 2, ar = Math.sqrt((a11 - a22) * (a11 - a22) / 4 + a12 * a12);
      var ev = Math.abs(a12) > 1e-12 ? [a12, am - ar - a11] : a11 <= a22 ? [1, 0] : [0, 1], evAlong = scale(ev, 1 / len(ev)), evAcross = [-evAlong[1], evAlong[0]];
      var lamLo = am - ar, lamHi = am + ar, steeper = lamHi / lamLo, WORDS = { 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten' };
      var steeperS = Math.abs(steeper - Math.round(steeper)) < 1e-6 && WORDS[Math.round(steeper)] ? WORDS[Math.round(steeper)] : num(steeper, 1);
      var landRing = function (h) {
        var pts = [], d = Math.max(h - freeJ, 0), ra = Math.sqrt(2 * d / lamLo), rc = Math.sqrt(2 * d / lamHi);
        for (var i = 0; i <= 120; i++) { var t = TAU * i / 120; pts.push(add(add(free, scale(evAlong, ra * Math.cos(t))), scale(evAcross, rc * Math.sin(t)))); }
        return pts;
      };
      // the lawful set C, lightly filled
      var lawFill = function (g, p) {
        if (!(p > 0)) return; var c = g.ctx, A0 = g.P([box[0], box[1]]), B0 = g.P([box[1], box[0]]);
        g.clip(g.mapR); c.globalAlpha = 0.16 * clamp(p, 0, 1); c.fillStyle = C.blue; c.fillRect(A0[0], A0[1], B0[0] - A0[0], B0[1] - A0[1]); c.globalAlpha = 1; c.restore();
      };
      // spots one distance r from c: a circle, drawn as far round as p
      var circle = function (g, r, col, w, p, dash) {
        if (!(p > 0) || !(r > 0)) return; var pts = []; for (var i = 0; i <= 96; i++) { var t = Math.PI + TAU * i / 96; pts.push(add(free, [r * Math.cos(t), r * Math.sin(t)])); }
        g.path(pts, col, w, p, dash);
      };

      // page 1: who the Warden is, the lawful set C, and the symbol Π
      var lawSamples = [
        { v: [box[0] + 0.24 * wd, box[0] + 0.42 * wd], text: 'inside: Π(v) = v', dx: 14, dy: 0, align: 'left' },
        { v: [box[0] + 0.45 * wd, box[1] + 0.24 * wd], text: 'outside: Π(v) on the wall', dx: -12, dy: 20, align: 'right', face: true },
        { v: [box[1] + 0.3 * wd, box[1] + 0.22 * wd], text: 'past a corner: the corner', dx: 12, dy: 20, align: 'left' }
      ].map(function (s) { s.z = land.project(s.v); return s; });
      out.push({ id: 'warden-role', chapter: 'The Twins', title: 'Meet the Warden: z', layout: 'map', view: introView, dur: 6.4,
        text: 'The Warden is the Wanderer’s twin, with the opposite skill. It knows the King’s law by heart and never looks at the land. ' +
          'The law is the wall: a spot x is lawful when ' + lawRule + '. We call the set of lawful spots C, the shaded square on the map. ' +
          'Hand the Warden any spot v, and it answers with the lawful spot nearest to v. A spot inside the wall is lawful already, so it stays. ' +
          'A spot outside is pulled straight back to the wall, meeting it at a right angle; a spot past a corner goes to the corner. ' +
          'We write the Warden’s answer as Π<sub>C</sub>(v), the projection of v onto C, or Π(v) for short. Π is the capital Greek letter pi. Here Π<sub>C</sub>(v) denotes the Euclidean projection of v onto C.',
        math: 'C = {x : ' + lawRule + '}' + at(0.3, '<br>z = Π<sub>C</sub>(v), the spot of C nearest to v') +
          at(0.55, '<br>inside C: Π<sub>C</sub>(v) = v;  outside: on the wall'),
        draw: function (g, p) {
          base(g); lawFill(g, seg(p, 0, 0.14)); star(g, T, 1); var phone = g.mapR[2] < 430;
          g.label([box[0] + 0.5 * wd, box[0] + 0.1 * wd], 'C: the lawful spots, inside the wall', C.blue, { align: 'center', size: 12, p: seg(p, 0.04, 0.16), inside: true });
          lawSamples.forEach(function (s, i) {
            var q = seg(p, 0.2 + 0.26 * i, 0.44 + 0.26 * i), moved = len(sub(s.v, s.z)) > 1e-9;
            var label = phone ? ['inside: Π(v) = v', 'outside → wall', 'past corner → corner'][i] : s.text;
            var dx = phone && i > 0 ? (i === 1 ? -10 : 10) : s.dx, dy = phone && i > 0 ? (i === 1 ? 20 : -20) : s.dy;
            var align = phone && i > 0 ? (i === 1 ? 'right' : 'left') : s.align;
            g.dot(s.v, 5, C.ink, seg(q, 0, 0.25)); g.label(s.v, 'v', C.ink, { dx: 9, dy: -12, size: 12, p: seg(q, 0.05, 0.3) });
            if (moved) { g.arrow(s.v, s.z, C.blue, 2.5, seg(q, 0.25, 0.7)); if (s.face) rightAngle(g, s.z, s.v, seg(q, 0.7, 0.9)); } else g.halo(s.v, 11, C.blue, seg(q, 0.25, 0.7), 1.8);
            warden(g, s.z, seg(q, 0.6, 0.9));
            g.label(s.z, label, C.blue, { dx: dx, dy: dy, align: align, size: 12, p: seg(q, 0.7, 1), inside: true });
          });
        } });

      // page 2: the Warden's own problem for c, as a growing circle and then one direction at a time
      var inPt = add(freeZ, fi === 0 ? [wallAt >= box[1] ? -0.55 * wd : 0.55 * wd, 0] : [0, wallAt >= box[1] ? -0.55 * wd : 0.55 * wd]);
      var stepView = around([add(free, [dWall, dWall]), add(free, [-dWall, -dWall]), inPt], 0.3, 0.3 * cx.span);
      var nlLo = Math.min(box[0], free[0], free[1]) - 0.2 * wd, nlHi = Math.max(box[1], free[0], free[1]) + 0.2 * wd;
      // one coordinate on a number line: the lawful stretch in blue, c's value in white, and where the Warden puts it
      var coordLine = function (g, x, y, w, val, to, p, q) {
        if (!(p > 0)) return; var c = g.ctx, X = function (t) { return x + (t - nlLo) / (nlHi - nlLo) * w; }, moved = Math.abs(val - to) > 1e-9;
        c.globalAlpha = clamp(p, 0, 1); c.lineCap = 'round';
        c.strokeStyle = C.faint; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.stroke();
        c.strokeStyle = C.blue; c.lineWidth = 5; c.beginPath(); c.moveTo(X(box[0]), y); c.lineTo(X(box[1]), y); c.stroke();
        c.font = '11px ' + g.mono; c.fillStyle = C.dim; c.textAlign = 'center'; c.textBaseline = 'top';
        c.fillText(bLo, X(box[0]), y + 7); c.fillText(bHi, X(box[1]), y + 7);
        c.beginPath(); c.arc(X(val), y, 5.5, 0, TAU); c.fillStyle = '#e6e9ee'; c.fill(); c.lineWidth = 2; c.strokeStyle = C.bg; c.stroke(); c.globalAlpha = 1;
        if (!(q > 0)) return;
        if (moved) {
          g.arrowPx([X(val), y - 10], [mix(X(val), X(to), q), y - 10], C.blue, 2);
          if (q >= 1) { c.beginPath(); c.arc(X(to), y, 5.5, 0, TAU); c.fillStyle = C.blue; c.fill(); c.lineWidth = 2; c.strokeStyle = C.bg; c.stroke(); }
        } else { c.globalAlpha = clamp(q, 0, 1); c.strokeStyle = C.blue; c.lineWidth = 2; c.beginPath(); c.arc(X(val), y, 10, 0, TAU); c.stroke(); c.globalAlpha = 1; }
      };
      var lineText = function (k) {
        return Math.abs(free[k] - freeZ[k]) > 1e-9 ? num(free[k], 2) + ' is past the wall at ' + num(freeZ[k], 0) + ', so z' + SUBN[k] + ' = ' + num(freeZ[k], 0) :
          num(free[k], 2) + ' is inside, so z' + SUBN[k] + ' = ' + num(freeZ[k], 2);
      };
      out.push({ id: 'warden-steps', chapter: 'The Twins', title: 'The Warden’s problem, step by step', layout: 'map+side', view: stepView, dur: 8,
        text: 'Now hand the Warden the spot that matters most, c = ' + pair(free) + '. This c is the valley’s floor, the lowest point of the land with no wall; the Wanderer walked there on its own. ' +
          'The Warden must find the point z in C with the smallest distance |z − c|, which is an optimisation problem of its own. ' +
          'Spots at one distance from c lie on a circle, so let a circle grow from c. The first lawful spot it reaches is the answer. ' +
          'For a square wall there is a shortcut, because |z − c|² = (z₁ − c₁)² + (z₂ − c₂)² and the wall limits z₁ and z₂ separately. Hence the Warden settles one direction at a time. ' +
          DIRC[fi] + ', ' + num(free[fi], 2) + ' lies past the wall at ' + num(wallAt, 0) + ', so z' + SUBN[fi] + ' = ' + num(wallAt, 0) + '. ' +
          DIRC[fj] + ', ' + num(free[fj], 2) + ' is already between ' + bLo + ' and ' + bHi + ', so it stays. ' +
          'Both ways give Π(c) = ' + pair(freeZ) + ', ' + num(dWall) + ' from c.',
        math: 'Π<sub>C</sub>(c) = the point z in C nearest to c' + at(0.5, '<br>|z − c|² = (z₁ − c₁)² + (z₂ − c₂)²') +
          at(0.62, '<br>z' + SUBN[fi] + ': ' + num(free[fi], 2) + ' → ' + num(wallAt, 0)) + at(0.78, ';  z' + SUBN[fj] + ': ' + num(free[fj], 2) + ' stays') +
          at(0.88, '<br>Π<sub>C</sub>(c) = ' + pair(freeZ) + ', ' + num(dWall) + ' from c'),
        draw: function (g, p) {
          base(g); lawFill(g, 1); star(g, T, 1);
          var qC = seg(p, 0, 0.1), grow = seg(p, 0.12, 0.46), r = dWall * grow, touched = p >= 0.46, A0 = g.P(free), phoneMap = g.mapR[2] < 430;
          // the circle grows; the rings it passes stay behind, dashed
          [1 / 3, 2 / 3].forEach(function (k) { if (grow >= k) circle(g, k * dWall, 'rgba(169,205,246,0.6)', 1.3, 1, [4, 4]); });
          if (r > 0) circle(g, r, C.blue, 2, 1);
          if (grow > 0.25 && p < 0.56) g.labelPx(A0[0], A0[1] - r * g.s - 14, '|z − c| = ' + num(r, 2), C.blue, { align: 'center', size: 11.5, p: seg(p, 0.14, 0.2) * (1 - seg(p, 0.5, 0.56)) });
          if (touched) g.halo(freeZ, 10, C.blue, seg(p, 0.46, 0.5) * (1 - seg(p, 0.8, 0.86)), 2.2);
          g.label(freeZ, 'the first lawful spot it reaches', C.blue, { dx: -12, dy: -24, align: 'right', size: 11.5, p: seg(p, 0.46, 0.52) * (1 - seg(p, 0.56, 0.6)), inside: true });
          // then one direction at a time: c's coordinate across the wall moves onto it, the other stays
          var qE = seg(p, 0.6, 0.72), qN = seg(p, 0.74, 0.82), qZ = seg(p, 0.84, 0.94);
          var qELabel = qE * (1 - seg(p, 0.74, 0.8)), qNLabel = qN * (1 - seg(p, 0.84, 0.9));
          g.arrow(free, freeZ, C.blue, 2.6, qE);
          g.label(lerp2(free, freeZ, 0.5), 'z' + SUBN[fi] + ': ' + num(free[fi], 2) + ' → ' + num(wallAt, 0), C.blue, { dx: 0, dy: fi === 0 ? -20 : 0, align: 'center', size: 12, p: phoneMap ? 0 : qELabel, inside: true });
          g.label(freeZ, 'z' + SUBN[fj] + ': ' + num(free[fj], 2) + ' stays', C.blue, { dx: -12, dy: 20, align: 'right', size: 12, p: phoneMap ? 0 : qNLabel, inside: true });
          warden(g, freeZ, qZ); rightAngle(g, freeZ, free, qZ);
          g.label(freeZ, 'Π(c) = ' + pair(freeZ), C.blue, { dx: -12, dy: -32, align: 'right', size: 12, p: qZ, inside: true });
          g.hero(free, 'tw', qC); g.label(free, 'c, the valley’s floor', C.ink, { dx: phoneMap ? 12 : 0, dy: 24, align: phoneMap ? 'left' : 'center', size: 12, p: qC, inside: true });
          // the side panel: the same problem, one coordinate at a time
          var R = g.sideR, compact = R[3] < 330, x = R[0] + 14, w = R[2] - 28, y = R[1] + (compact ? 36 : 40), bh = compact ? 62 : 92;
          g.panel(R, 'The Warden’s problem, step by step');
          if (!compact) {
            g.labelPx(x, y, 'find the point z in C nearest to c', C.ink, { plain: true, size: 12, p: seg(p, 0.04, 0.1) });
            g.labelPx(x, y + 24, '|z − c|² = (z₁ − c₁)² + (z₂ − c₂)²', C.ink, { plain: true, mono: true, size: 12, p: seg(p, 0.5, 0.56) });
            y += 62;
          }
          [fi, fj].forEach(function (k, n) {
            var q0 = n ? seg(p, 0.72, 0.76) : seg(p, 0.56, 0.6), q1 = n ? seg(p, 0.74, 0.82) : seg(p, 0.6, 0.72), yy = y + n * bh;
            g.labelPx(x, yy, DIRS[k] + ':  c' + SUBN[k] + ' = ' + num(free[k], 2), C.ink, { plain: true, size: 12, p: q0 });
            coordLine(g, x + 8, yy + 24, w - 16, free[k], freeZ[k], q0, q1);
            g.labelPx(x, yy + (compact ? 50 : 56), lineText(k), C.blue, { plain: true, mono: true, size: 12, p: q1 });
          });
          var yr = y + 2 * bh + (compact ? 0 : 6);
          g.labelPx(x, yr, 'Π(c) = ' + pair(freeZ) + ', ' + num(dWall) + ' from c', C.blue, { plain: true, mono: true, size: 12, p: qZ });
          if (!compact && yr + 22 < R[1] + R[3] - 8) g.labelPx(x, yr + 22, 'the same spot the circle reached', C.ink, { plain: true, size: 12, p: seg(p, 0.9, 0.98) });
        } });

      // page 3: two different questions rank the same lawful points in opposite orders
      var ringT = landRing(TJ), farView = around(ringT.concat([add(free, [-dWall, -dWall]), add(free, [dWall, dWall]), inPt]), 0.12, 0.3 * cx.span);
      var questionCard = function (g, Rr, col, title, answer, comparison, qTitle, qAnswer, qComparison) {
        var c = g.ctx, compact = Rr[3] < 130, x = Rr[0] + 14;
        var yAnswer = Rr[1] + (compact ? 32 : Rr[3] * 0.43), yComparison = Rr[1] + (compact ? 53 : Rr[3] * 0.68);
        g.panel(Rr);
        c.save(); c.globalAlpha = clamp(qTitle, 0, 1); c.fillStyle = col; c.fillRect(Rr[0] + 3, Rr[1] + 8, 3, Rr[3] - 16); c.restore();
        g.labelPx(x, Rr[1] + 10, title, col, { plain: true, size: compact ? 10.5 : 12.5, p: qTitle });
        g.labelPx(x, yAnswer, answer, col, { plain: true, mono: true, size: compact ? 9.5 : 13, p: qAnswer });
        g.labelPx(x, yComparison, comparison, C.ink, { plain: true, mono: true, size: compact ? 9.2 : 12, p: qComparison });
      };
      out.push({ id: 'warden-not-lowest', chapter: 'The Twins', title: 'Nearest is not lowest', layout: 'map+side', view: farView, dur: 9,
        text: 'The Warden and the King are answering different questions. ' +
          at(0.06, 'The Warden asks: “Which lawful point is closest to c?” Its answer, Π<sub>C</sub>(c) = ' + pair(freeZ) + ', is lawful and ' + num(dWall) + ' from c. Projection promises no more than that. ') +
          at(0.32, 'The King asks: “Which lawful point has the lowest height J?” Its answer is x* = ' + pair(T) + '. The ranking reverses: x* is farther from c, ' + num(dStar) + ' instead of ' + num(dWall) + ', but lower in J, ' + num(TJ, 3) + ' instead of ' + num(zJ, 3) + '. ') +
          at(0.58, 'Both answers lie on the same ' + faceName + ', ' + num(gapTZ) + ' apart. Follow the wall from Π(c) to x*: the height falls. A distance circle first touches C at Π(c). The land is ' + steeperS + ' times steeper across the valley than along it, so its equal-height rings are tilted ellipses. The first such ellipse to reach C touches x*. ') +
          at(0.82, 'The Warden knows C but never reads J. The Wanderer feels the slope of J but may leave C. The twins must combine these jobs to find one point that is both lawful and low.'),
        math: 'Warden: Π<sub>C</sub>(c) = arg min<sub>z ∈ C</sub> |z − c| = ' + pair(freeZ) + ';  distance ' + num(dWall) +
          at(0.42, '<br>King: x* = arg min<sub>z ∈ C</sub> J(z) = ' + pair(T) + ';  J = ' + num(TJ, 3)) +
          at(0.7, '<br>nearest: ' + num(dWall) + ' < ' + num(dStar) + ';  lowest: ' + num(TJ, 3) + ' < ' + num(zJ, 3)),
        draw: function (g, p) {
          base(g); lawFill(g, 1);
          var qW = seg(p, 0.04, 0.28), qK = seg(p, 0.32, 0.58), qE = seg(p, 0.62, 0.82), qB = seg(p, 0.84, 0.96), phoneMap = g.mapR[2] < 430;
          // First replay the Warden's answer. Then visibly walk down the same wall until the King reaches x*.
          circle(g, dWall, C.blue, 2, qW);
          var wallNow = lerp2(freeZ, T, ease(qK));
          if (qK > 0) {
            g.path([freeZ, wallNow], C.gold, 2.8, 1);
            g.dot(wallNow, 5.5, C.gold, 1);
            g.label(wallNow, 'along the wall: J = ' + num(f(wallNow), 3), C.gold, { dx: 12, dy: 18, size: 11.5, p: seg(p, 0.34, 0.4) * (1 - seg(p, 0.54, 0.6)), inside: true });
          }
          // Once the lower point is visible, grow the land's equal-height ellipse to its first wall contact.
          if (qE > 0) g.path(landRing(freeJ + (TJ - freeJ) * qE), C.gold, 2.2, 1);
          var inward = fi === 0 ? [wallAt >= box[1] ? -0.05 * wd : 0.05 * wd, 0] : [0, wallAt >= box[1] ? -0.05 * wd : 0.05 * wd];
          g.path([freeZ, add(freeZ, inward), add(T, inward), T], C.violet, 1.6, qB);
          if (phoneMap) g.labelPx(g.mapR[0] + g.mapR[2] - 10, g.mapR[1] + 52, num(gapTZ) + ' apart on the wall', C.violet, { align: 'right', size: 10.5, p: seg(p, 0.9, 1) });
          else g.label(add(lerp2(freeZ, T, 0.5), inward), num(gapTZ) + ' apart', C.violet, { dx: -10, dy: 0, align: 'right', size: 12, p: seg(p, 0.9, 1), inside: true });
          warden(g, freeZ, qW); star(g, T, seg(p, 0.54, 0.62));
          g.label(freeZ, 'nearest: Π(c), distance ' + num(dWall), C.blue, { dx: -12, dy: phoneMap ? 30 : 20, align: 'right', size: phoneMap ? 10.5 : 12, p: seg(p, 0.18, 0.28), inside: true });
          g.label(T, 'lowest: x*, J = ' + num(TJ, 3), C.gold, { dx: -12, dy: phoneMap ? -36 : -22, align: 'right', size: phoneMap ? 10.5 : 12, p: seg(p, 0.56, 0.66), inside: true });
          var stageText = p < 0.3 ? '1  Warden: which lawful point is closest?' : p < 0.62 ? '2  King: which lawful point is lowest?' : p < 0.84 ? 'same centre, different rings' : 'nearest lawful is not lowest lawful';
          g.labelPx(g.mapR[0] + 12, g.mapR[1] + 30, stageText, p < 0.3 ? C.blue : C.gold, { size: 13 });
          g.hero(free, 'tw', 1); g.label(free, 'c', C.ink, { dx: 12, dy: -14, size: 12, inside: true });
          // The side cards keep the two objectives and their reversed rankings visible without asking students to read two plots.
          var R = g.sideR, h2 = (R[3] - 8) / 2, R1 = [R[0], R[1], R[2], h2], R2 = [R[0], R[1] + h2 + 8, R[2], h2];
          questionCard(g, R1, C.blue, '1  Warden: closest to c?', 'Π_C(c) = ' + pair(freeZ), 'distance  ' + num(dWall) + ' < ' + num(dStar) + ' at x*', seg(p, 0.02, 0.08), seg(p, 0.18, 0.28), seg(p, 0.56, 0.64));
          questionCard(g, R2, C.gold, '2  King: lowest height J?', 'x* = ' + pair(T), 'height J  ' + num(TJ, 3) + ' < ' + num(zJ, 3) + ' at Π(c)', seg(p, 0.32, 0.4), seg(p, 0.52, 0.6), seg(p, 0.56, 0.66));
        } });
    } else {
      var samples = [];
      if (free) { var dir0 = sub(free, x0), perp = [-dir0[1], dir0[0]]; samples = [add(free, scale(perp, 0.35)), lerp2(x0, free, 0.45), free].map(function (q) { return { q: q, z: noLaw ? q : land.project(q) }; }); }
      out.push({ id: 'warden-role', chapter: 'The Twins', title: 'Meet the Warden: z', layout: 'map', view: introView, dur: 5.6,
        text: noLaw ? 'The Warden’s job: given any point, step to the nearest lawful spot. With no law every spot is lawful, so the Warden simply stands where the Wanderer stands.' :
          'The Warden’s job: given any point, step to the nearest lawful spot, ' + (tower ? 'the nearest point of the parity-polytope line' : 'the nearest spot ' + lawWord) + '. A lawful point stays where it is; a point outside is pulled straight to the law, at a right angle. ' + (free ? 'Asked about the Wanderer’s spot c, the Warden answers Π(c) = ' + pair(freeZ) + ': lawful, but J = ' + num(f(freeZ), 3) + ' there, above the spot to dig, where J = ' + num(TJ, 3) + '. ' : '') + 'The Warden never feels the slope, so on its own it cannot find the lowest lawful spot either.',
        math: 'the Warden: z = Π<sub>C</sub>(any point), the nearest lawful spot' + (free && freeOut ? at(0.6, ';  Π<sub>C</sub>(c) = ' + pair(freeZ) + ',  J = ' + num(f(freeZ), 3) + ' > ' + num(TJ, 3)) : ''),
        draw: function (g, p) {
          base(g); star(g, T, 1);
          samples.forEach(function (s, i) {
            var q = seg(p, 0.05 + 0.24 * i, 0.3 + 0.24 * i), moved = len(sub(s.q, s.z)) > 1e-9;
            g.dot(s.q, 5, i === 2 ? '#e6e9ee' : C.ink, seg(q, 0, 0.3));
            if (moved) { g.arrow(s.q, s.z, C.blue, 2.5, seg(q, 0.3, 0.8)); rightAngle(g, s.z, s.q, seg(q, 0.8, 1)); } else g.halo(s.q, 10, C.blue, seg(q, 0.3, 0.8), 1.5);
            warden(g, s.z, seg(q, 0.7, 1), i === 2 ? 'Π(c): lawful, not lowest' : moved ? 'nearest lawful spot' : 'already lawful: stays');
          });
          if (free) g.hero(free, 'tw', seg(p, 0.55, 0.65), 'c');
        } });
    }

    // ---- the rope, and what the rope alone cannot do
    var ropeOk = !!(free && land.exactStep && !noLaw), xr = ropeOk ? land.wanderer(freeZ, rho) : null;
    var reachFree = ropeOk ? Math.min(Math.sqrt(2 * Math.max(f(freeZ) - land.fmin, 0) / rho), cx.span) : 0;
    var ropeFree = ropeOk ? function (q) { var dq = sub(q, freeZ); return f(q) + rho / 2 * dot(dq, dq); } : null;
    var ropeView = ropeOk ? around([free, freeZ, xr, T], 0.6, 0.35 * cx.span) : view;
    out.push({ id: 'rope', chapter: 'The Twins', title: 'Tie them with a rope', layout: 'map', view: ropeView, dur: 5.8,
      text: noLaw ? 'Tie the twins with a rope of stiffness ρ = ' + num(rho, 2) + '. With no law the Warden always stands where the Wanderer stands, so the rope hangs slack and nothing changes.' :
        'Tie the twins with a rope of stiffness ρ = ' + num(rho, 2) + '. Now the Wanderer minimises the land plus the rope’s pull toward the Warden, and the Warden steps to the nearest lawful spot to the Wanderer. Each still does only what it is good at; the rope makes them care about each other. The shading is the land as the Wanderer now feels it, with the rope tied to the Warden at z = ' + pair(freeZ) + ': the rope’s cost ρ/2·|x − z|² is added to the height. ' + (ropeOk ? 'Pulled by the rope, the Wanderer moves from c to ' + pair(xr) + '. No spot farther than r = ' + num(reachFree) + ' from the Warden can beat the Warden’s own spot: the dashed ring.' : 'On this land the Wanderer walks down that combined land in small steps.'),
      math: 'the Wanderer now minimises f(x) + ρ/2·|x − z|²,  ρ = ' + num(rho, 2) + at(0.6, ';  the Warden takes Π<sub>C</sub>(x)'),
      draw: function (g, p) {
        if (!ropeOk) { base(g); g.hero(x, 'tw', 1, 'the Wanderer'); warden(g, z, 1, 'the Warden'); spring(g, x, z, seg(p, 0.2, 0.5)); return; }
        base(g); g.land(ropeFree, { id: 'ropeFree', rings: 10, alpha: seg(p, 0.3, 0.55) }); law(g, 1); star(g, T, 1);
        g.dot(freeZ, 7, C.blue, 1); g.label(freeZ, 'the Warden, z', C.blue, { dx: -12, dy: -14, align: 'right', size: 12 }); var q = seg(p, 0.55, 0.9), at2 = lerp2(free, xr, q);
        spring(g, at2, freeZ, seg(p, 0.05, 0.3)); g.hero(at2, 'tw', 1, q >= 1 ? 'pulled to ' + pair(xr) : q <= 0 ? 'the Wanderer at c' : '');
        if (reachFree > 0) g.halo(freeZ, reachFree * g.s, C.ink, seg(p, 0.7, 0.9), 1.2, [5, 4]);
      } });


    // ---- one day at a time (tutorial only). Each day the Wanderer faces a new land: the valley plus the rope's bowl
    // around a spot made from yesterday's numbers, the Warden's spot z with the rope alone, the aim v = z − u with the
    // book. A day page fades yesterday's land into today's, marks its lowest point, walks the Wanderer there, moves the
    // Warden, writes the book (if there is one), and ends on the spot that tomorrow's rope is tied to.
    function dayPage(o) {
      var d = o.d, sd = subscript(d), sp = subscript(d - 1), sn = subscript(d + 1), book = !!o.book;
      var a = sub(o.prev.z, o.prev.u), aNext = sub(o.now.z, o.now.u), xuD = add(o.now.x, o.prev.u), hasU = len(o.prev.u) > 1e-9;
      var Fd = function (q) { var dq = sub(q, a); return f(q) + rho / 2 * dot(dq, dq); };
      var Fp = o.aPrev ? function (q) { var dq = sub(q, o.aPrev); return f(q) + rho / 2 * dot(dq, dq); } : null;
      var gapV = sub(o.now.x, o.now.z), gapL = len(gapV), lawful = len(sub(o.now.z, xuD)) < 1e-9, uNow = o.now.u;
      var aName = book ? 'v' + sp : 'z' + sp, aNameN = book ? 'v' + sd : 'z' + sd, idOf = function (q) { return 'dayland' + q[0].toFixed(6) + ',' + q[1].toFixed(6); };
      var math = 'F' + sd + '(x) = f(x) + ρ/2·|x − ' + aName + '|²,  ' + aName + ' = ' + (book ? 'z' + sp + ' − u' + sp + ' = ' : '') + pair(a) +
        at(0.3, '<br>x' + sd + ' = the lowest point of F' + sd + ' = ' + pair(o.now.x)) +
        at(0.56, '<br>z' + sd + ' = Π(x' + sd + (book ? ' + u' + sp : '') + ') = ' + pair(o.now.z)) +
        (book ? at(0.74, '<br>u' + sd + ' = u' + sp + ' + x' + sd + ' − z' + sd + ' = ' + pair(uNow)) : '') +
        at(0.88, '<br>tomorrow: F' + sn + '(x) = f(x) + ρ/2·|x − ' + aNameN + '|²,  ' + aNameN + ' = ' + pair(aNext));
      var rows = book ? [
        { t: 'yesterday:  z' + sp + ' = ' + pair(o.prev.z), col: C.blue, mono: true, at: 0.03 },
        { t: '            u' + sp + ' = ' + pair(o.prev.u), col: C.orange, mono: true, at: 0.03 },
        { t: 'today’s aim  v' + sp + ' = z' + sp + ' − u' + sp + ' = ' + pair(a), col: C.violet, mono: true, at: 0.08 },
        { t: 'F' + sd + '(x) = f(x) + ρ/2·|x − v' + sp + '|²', col: C.gold, mono: true, at: 0.14 },
        { t: 'the Wanderer walks to its lowest point:', col: '#e6e9ee', at: 0.3 },
        { t: 'x' + sd + ' = ' + pair(o.now.x), col: '#e6e9ee', mono: true, at: 0.3 },
        { t: 'the Warden: z' + sd + ' = Π(x' + sd + ' + u' + sp + ') = ' + pair(o.now.z), col: C.blue, mono: true, at: 0.56 },
        { t: 'the book: u' + sd + ' = u' + sp + ' + x' + sd + ' − z' + sd + ' = ' + pair(uNow), col: C.orange, mono: true, at: 0.74 },
        { t: 'tomorrow’s aim: v' + sd + ' = z' + sd + ' − u' + sd + ' = ' + pair(aNext), col: C.violet, mono: true, at: 0.88 },
        { t: 'F' + sn + '(x) = f(x) + ρ/2·|x − v' + sd + '|²', col: C.gold, mono: true, at: 0.9 }] : [
        { t: 'yesterday’s Warden:  z' + sp + ' = ' + pair(o.prev.z), col: C.blue, mono: true, at: 0.03 },
        { t: 'today’s land, the rope tied to z' + sp + ':', col: C.gold, at: 0.08 },
        { t: 'F' + sd + '(x) = f(x) + ρ/2·|x − z' + sp + '|²', col: C.gold, mono: true, at: 0.08 },
        { t: 'the Wanderer walks to its lowest point:', col: '#e6e9ee', at: 0.3 },
        { t: 'x' + sd + ' = ' + pair(o.now.x), col: '#e6e9ee', mono: true, at: 0.3 },
        { t: 'the Warden steps to the nearest lawful spot:', col: C.blue, at: 0.56 },
        { t: 'z' + sd + ' = Π(x' + sd + ') = ' + pair(o.now.z), col: C.blue, mono: true, at: 0.56 },
        { t: 'the gap  x' + sd + ' − z' + sd + ' = ' + pair(gapV), col: C.violet, mono: true, at: 0.74 },
        { t: 'tomorrow’s land, the rope tied to z' + sd + ':', col: C.gold, at: 0.88 },
        { t: 'F' + sn + '(x) = f(x) + ρ/2·|x − z' + sd + '|²', col: C.gold, mono: true, at: 0.88 }];
      return { id: o.id, chapter: 'The Twins', title: 'Day ' + d + ': today’s land is built from ' + (book ? 'z' + sp + ' and u' + sp : 'z' + sp), layout: 'map+side', view: o.view, dur: 9,
        text: o.text, math: math,
        draw: function (g, p) {
          var q1 = seg(p, 0.04, 0.24), qW = seg(p, 0.28, 0.5), qZ = seg(p, 0.54, 0.7), qU = seg(p, 0.72, 0.86), qN = seg(p, 0.88, 0.98);
          // yesterday's land fades into today's: the rope's bowl has moved
          if (Fp) g.land(Fp, { id: idOf(o.aPrev), rings: 10 }); else g.land(cx.J, cx.shade);
          g.land(Fd, { id: idOf(a), rings: 10, alpha: q1 });
          g.axes(); law(g, 1); star(g, T, 1);
          if (o.showC && free) { g.dot(free, 4, C.ink, 1); g.label(free, 'c, the valley floor', C.ink, { dx: 10, dy: -12, size: 11.5, inside: true }); }
          if (o.trail && o.trail.length) { if (o.trail.length > 1) g.path(o.trail, 'rgba(242,245,248,0.35)', 1.5, 1, [3, 3]); o.trail.forEach(function (q) { g.dot(q, 2.5, 'rgba(242,245,248,0.6)', 1); }); }
          // where today's rope is tied: the Warden's spot (rope alone), or the aim, the Warden's spot moved back by the book
          if (book) {
            if (hasU) g.arrow(o.prev.z, a, C.violet, 2.6, q1);
            g.dot(o.aPrev ? lerp2(o.aPrev, a, ease(q1)) : a, 5.5, C.violet, o.aPrev ? 1 : q1);
          } else g.halo(o.prev.z, 13, C.violet, q1 * (1 - seg(p, 0.5, 0.56)), 2);
          // the lowest point of today's land, which the Wanderer will walk to
          var qT = seg(p, 0.18, 0.26) * (1 - seg(p, 0.5, 0.56)); g.halo(o.now.x, 10, C.gold, qT, 1.8, [3, 2]);
          // the Wanderer's walk, then the Warden's step
          var hx = lerp2(o.prev.x, o.now.x, ease(qW)), hz = lerp2(o.prev.z, o.now.z, ease(qZ));
          if (qW > 0) g.path([o.prev.x, hx], 'rgba(242,245,248,0.85)', 2, 1);
          spring(g, hx, book ? a : hz, 0.5 * (1 - qN));
          if (book && hasU && qZ > 0) { g.dot(xuD, 4, C.ink, 1); g.line(xuD, o.now.z, C.blue, 1.5, qZ, [4, 3]); }
          if (!lawful) rightAngle(g, o.now.z, xuD, seg(p, 0.66, 0.72));
          // the gap, and the book's new entry drawn a little below it
          if (gapL > 1e-9) g.arrow(o.now.z, o.now.x, C.violet, 2.2, qU);
          if (book && len(uNow) > 1e-9 && qU > 0) {
            var A0 = g.P(o.now.z), B0 = g.P(add(o.now.z, uNow)), off = 38, a0 = [A0[0], A0[1] + off], b0 = [B0[0], B0[1] + off];
            g.ctx.save(); g.clip(g.mapR); g.ctx.globalAlpha = clamp(qU, 0, 1); g.arrowPx(a0, [a0[0] + (b0[0] - a0[0]) * qU, a0[1] + (b0[1] - a0[1]) * qU], C.orange, 3); g.ctx.restore(); g.ctx.globalAlpha = 1;
          }
          // tomorrow's aim, or tomorrow's Warden spot
          if (book) g.halo(aNext, 9, C.violet, qN, 1.8, [3, 3]); else g.halo(o.now.z, 13, C.violet, qN, 2, [4, 3]);
          warden(g, hz, 1); g.hero(hx, 'tw', 1);
          // the map's labels, one or two at a time
          var L = function (q, text, col, dx, dy, align, pp) { g.label(q, text, col, { dx: dx, dy: dy, align: align, size: 12, p: pp, inside: true }); };
          if (book) {
            L(a, 'today’s aim ' + aName + ' = z' + sp + ' − u' + sp, C.violet, 0, 24, 'center', q1 * (1 - seg(p, 0.5, 0.56)));
            L(o.prev.z, 'z' + sp, C.blue, -10, -18, 'right', q1 * (1 - seg(p, 0.54, 0.58)));
            if (hasU) L(lerp2(o.prev.z, a, 0.5), '−u' + sp, C.violet, 0, -16, 'center', q1 * (1 - seg(p, 0.5, 0.56)));
            L(o.now.x, 'lowest point of F' + sd, C.gold, 4, -26, 'left', qT);
            L(o.now.x, 'x' + sd, '#e6e9ee', 12, -18, 'left', seg(p, 0.5, 0.56));
            if (hasU) L(xuD, 'x' + sd + ' + u' + sp, C.ink, 0, -18, 'center', qZ * (1 - seg(p, 0.86, 0.9)));
            L(o.now.z, 'z' + sd, C.blue, -10, -18, 'right', seg(p, 0.66, 0.72));
            if (len(uNow) > 1e-9) g.labelPx(g.P(add(o.now.z, scale(uNow, 0.5)))[0], g.P(o.now.z)[1] + 58, 'the book u' + sd + ' = ' + pair(uNow), C.orange, { align: 'center', size: 12, p: seg(p, 0.8, 0.86) });
            L(aNext, 'tomorrow’s aim ' + aNameN, C.violet, 0, 24, 'center', qN);
          } else {
            L(o.prev.z, 'the rope is tied here: z' + sp, C.violet, 0, 26, 'center', q1 * (1 - seg(p, 0.5, 0.56)));
            L(o.now.x, 'lowest point of F' + sd, C.gold, 0, -24, 'center', qT);
            L(o.now.x, lawful ? 'x' + sd + ' is lawful: z' + sd + ' = x' + sd : 'x' + sd, '#e6e9ee', 0, -24, 'center', seg(p, 0.66, 0.72) * (1 - seg(p, 0.86, 0.9)));
            if (!lawful) L(o.now.z, 'z' + sd, C.blue, -10, -18, 'right', seg(p, 0.66, 0.72));
            L(o.now.z, 'tomorrow the rope is tied here: z' + sd, C.violet, 0, 28, 'center', qN);
          }
          g.labelPx(g.mapR[0] + 12, g.mapR[1] + 30, 'day ' + d + ': ' + (p < 0.27 ? 'today’s land' : p < 0.53 ? 'the Wanderer moves' : p < 0.71 ? 'the Warden moves' : p < 0.87 ? (book ? 'the book' : 'the gap') : 'tomorrow'), C.gold, { size: 13 });
          // the side panel: the day's recipe, in step with the drawing
          var R = g.sideR, rh = Math.min(28, (R[3] - 50) / rows.length);
          g.panel(R, 'Day ' + d + (book ? ', with the book' : ', the rope alone'));
          rows.forEach(function (r, i) { g.labelPx(R[0] + 14, R[1] + 44 + rh * i, r.t, r.col, { plain: true, mono: !!r.mono, size: 12, p: seg(p, r.at, r.at + 0.06) }); });
        } };
    }

    var noLedgerZ = [], noLedgerX = [], noLedgerDays = 10;
    if (wall && land.exactStep && w[0] && w[0].z) {
      var nlz = w[0].z.slice(), nlX = w[0].x.slice(); noLedgerZ.push(nlz.slice()); noLedgerX.push(nlX.slice());
      for (var nl = 0; nl < noLedgerDays; nl++) { nlX = land.wanderer(nlz, rho); nlz = land.project(nlX); noLedgerX.push(nlX.slice()); noLedgerZ.push(nlz.slice()); }
    }
    if (noLedgerZ.length) {
      var nlEndZ = noLedgerZ[noLedgerDays], nlEndX = noLedgerX[noLedgerDays], nlGap = len(sub(nlEndX, nlEndZ));
      var nlGaps = noLedgerX.map(function (q, i) { return len(sub(q, noLedgerZ[i])); }), admmGaps = []; for (var ai = 0; ai <= noLedgerDays; ai++) admmGaps.push(w[Math.min(ai, w.length - 1)].gap || 0);
      var nlView = around(noLedgerX.concat(noLedgerZ).concat([T]), 0.4, 0.3 * cx.span);
      // the first three days, one move at a time (tutorial only); the summary page below then continues from day 3
      var ropeDays = 3, ropeFirstGap = null, rg;
      for (rg = 1; rg <= noLedgerDays; rg++) if (len(sub(noLedgerX[rg], noLedgerZ[rg])) > 1e-9) { ropeFirstGap = rg; break; }
      var ropeDayText = function (d) {
        var sd = subscript(d), sp = subscript(d - 1), xd = noLedgerX[d], zd = noLedgerZ[d], zp = noLedgerZ[d - 1], together = len(sub(xd, zd)) < 1e-9;
        var wardenS = together ? 'The Wanderer’s spot x' + sd + ' is inside the wall, so the nearest lawful spot is x' + sd + ' itself: the Warden steps onto it, z' + sd + ' = x' + sd + ', and the gap is 0.' :
          'The Wanderer’s spot x' + sd + ' is outside the wall, so the Warden stops at the wall, z' + sd + ' = ' + pair(zd) + ', and a gap of ' + num(len(sub(xd, zd))) + ' opens.';
        if (d === 1) return 'Here are the first ' + ropeDays + ' days, one move at a time. Each day is built from the day before. On day 1 the rope is tied to the Warden’s spot at the start, z₀ = ' + pair(zp) + '. ' +
          'So the Wanderer’s land today is the valley plus a bowl around z₀: F₁(x) = f(x) + ρ/2·|x − z₀|². ' +
          'Its lowest point is x₁ = ' + pair(xd) + ': the valley pulls the Wanderer toward its floor c, and the rope holds it back. The Wanderer walks there. Then the Warden moves. ' + wardenS + ' Tomorrow the rope is tied to z₁.';
        if (d === 2) return 'Day 2 starts from day 1’s result. The rope is re-tied to z₁ = ' + pair(zp) + ', so the bowl moves with it. ' +
          'Today’s land, F₂(x) = f(x) + ρ/2·|x − z₁|², is a different function from yesterday’s. Its lowest point is x₂ = ' + pair(xd) + ', another step toward the valley floor. ' + wardenS;
        return 'Day ' + d + ' repeats the recipe with z' + sp + ' = ' + pair(zp) + ': F' + sd + '(x) = f(x) + ρ/2·|x − z' + sp + '|². The Wanderer reaches x' + sd + ' = ' + pair(xd) + '. ' + wardenS +
          (ropeFirstGap == null || ropeFirstGap > d ? ' So far the twins have ended every day together.' : '') +
          (ropeFirstGap === d + 1 ? ' Tomorrow’s lowest point lies past the wall; the next page follows the twins from there.' : '');
      };
      if (cx.tutorial) {
        var ropeDayView = around(noLedgerX.slice(0, ropeDays + 2).concat(free ? [free] : []).concat([T]), 0.15, 0.3 * cx.span);
        for (var rd = 1; rd <= ropeDays; rd++) out.push(dayPage({ id: 'rope-day-' + rd, d: rd, view: ropeDayView, showC: true, text: ropeDayText(rd),
          prev: { x: noLedgerX[rd - 1], z: noLedgerZ[rd - 1], u: [0, 0] }, now: { x: noLedgerX[rd], z: noLedgerZ[rd], u: [0, 0] },
          aPrev: rd > 1 ? noLedgerZ[rd - 2] : null, trail: noLedgerX.slice(0, rd) }));
      }
      out.push({ id: 'without-ledger', chapter: 'The Twins', title: 'The rope pulls, but does not remember', layout: 'map+side', view: nlView, dur: 6.6,
        text: 'Let them go on with the rope alone, each day remembering only where the Warden stood yesterday. The Wanderer goes to the lowest point of land plus rope, the Warden to the nearest lawful spot, and again. ' +
          (ropeFirstGap ? 'For ' + (ropeFirstGap - 1) + (ropeFirstGap === 2 ? ' day' : ' days') + ' the twins end together. From day ' + ropeFirstGap + ' the Wanderer’s lowest point lies past the wall, so the Warden stops at the wall and a gap opens. ' : '') +
          'The Wanderer always stops a little downhill of the Warden, the rope stretched by the slope, and the Warden stands on the wall. They settle a fixed gap apart. After ' + noLedgerDays + ' circuits the Warden is at z = ' + pair(nlEndZ) + ', on the wall but above the spot to dig, ' + pair(T) + ', and the gap is still ' + num(nlGap) + '. The rope pulls; it does not remember. This rope-only run is a counterfactual, not ADMM: it omits the scaled-dual update that remembers disagreement.',
        math: 'rope alone: x ← argmin f + ρ/2·|x − z|²,  z ← Π<sub>C</sub>(x)' + at(0.55, '<br>after ' + noLedgerDays + ' circuits: z = ' + pair(nlEndZ) + ', gap ' + num(nlGap) + ';  the spot to dig ' + pair(T)),
        draw: function (g, p) {
          base(g); star(g, T, 1);
          var s = ropeDays + seg(p, 0, 0.8) * (noLedgerDays - ropeDays), kk = Math.floor(s), fr = s - kk;   // from day 3 on; each day: the Wanderer hops, then the Warden
          for (var i = 1; i <= Math.min(kk, noLedgerDays); i++) { g.dot(noLedgerX[i], 3, 'rgba(230,233,238,0.7)', 1); g.dot(noLedgerZ[i], 3, C.red, 1); }
          var hx = kk >= noLedgerDays ? noLedgerX[noLedgerDays] : lerp2(noLedgerX[kk], noLedgerX[kk + 1], ease(Math.min(1, fr * 2)));
          var hz = kk >= noLedgerDays ? noLedgerZ[noLedgerDays] : fr < 0.5 ? noLedgerZ[kk] : lerp2(noLedgerZ[kk], noLedgerZ[kk + 1], ease((fr - 0.5) * 2));
          spring(g, hx, hz, 1, C.red); g.hero(hx, 'tw', 1); warden(g, hz, 1);
          g.labelPx(g.mapR[0] + 12, g.mapR[1] + 30, 'day ' + Math.min(kk, noLedgerDays) + ', rope alone', C.red, { size: 13 });
          if (p > 0.85) {
            var narrow = g.W < g.H;
            g.label(nlEndZ, (narrow ? 'fixed gap = ' : 'a fixed gap of ') + num(nlGap), C.red,
              narrow ? { dx: -12, dy: -18, align: 'right', size: 11.5 } : { dx: -14, dy: -18, align: 'right', size: 12 });
            g.label(nlEndZ, narrow ? 'z = ' + pair(nlEndZ) + ' ≠ x*' : 'z = ' + pair(nlEndZ) + ', above the spot to dig', C.red,
              narrow ? { dx: -12, dy: 20, align: 'right', size: 11.5 } : { dx: -14, dy: 20, align: 'right', size: 12 });
          }
          var R = g.sideR, hi = Math.max.apply(null, nlGaps.concat(admmGaps)) * 1.6 || 1, pl = g.plot(R, [0, noLedgerDays], [0, hi], { title: 'the gap between the twins, circuit by circuit' }); pl.frame('circuit', 'gap |x − z|');
          pl.curve(function (t) { var i = Math.floor(t), fq = t - i; return nlGaps[Math.min(i, noLedgerDays)] * (1 - fq) + nlGaps[Math.min(i + 1, noLedgerDays)] * fq; }, C.red, 2.2, clamp(s / noLedgerDays, 0, 1));
          pl.curve(function (t) { var i = Math.floor(t), fq = t - i; return admmGaps[Math.min(i, noLedgerDays)] * (1 - fq) + admmGaps[Math.min(i + 1, noLedgerDays)] * fq; }, C.blue, 2.2, seg(p, 0.85, 1));
          // both labels sit above the rope-alone plateau, where no curve passes
          g.labelPx(pl.X(noLedgerDays) - 4, pl.Y(nlGaps[noLedgerDays]) - 34, 'rope alone: the gap stays', C.red, { align: 'right', size: 11.5, plain: true, p: seg(p, 0.8, 0.9) });
          g.labelPx(pl.X(noLedgerDays) - 4, pl.Y(nlGaps[noLedgerDays]) - 15, 'with the book (next): the gap closes', C.blue, { align: 'right', size: 11.5, plain: true, p: seg(p, 0.9, 1) });
        } });
    }

    // ---- the Warden's book
    // The page zooms in on the two twins so their gap is visible, writes each twin's two numbers on dashed lines to the
    // axes (x = (x₁, x₂) for the Wanderer, z = (z₁, z₂) for the Warden), and draws the gap x − z and the book u.
    var entries = []; for (var ej = 1; ej <= k; ej++) entries.push({ day: ej, gap: sub(w[ej].x, w[ej].z) });
    var firstGap = firstWallContact != null && firstWallContact <= k ? sub(w[firstWallContact].x, w[firstWallContact].z) : null;
    var bookSpan = Math.min(cx.span, Math.max(5 * len(gapNow), 5 * len(u), 0.08 * cx.span));
    var bookView = around([z, x, add(z, u)], 0.6, bookSpan), kk = subscript(k);
    var together = len(gapNow) < 1e-9, sameA = Math.abs(x[0] - z[0]) < 5e-4, sameB = Math.abs(x[1] - z[1]) < 5e-4;
    var outsideWord = tower ? 'off the parity-polytope line' : 'outside ' + lawName, onWord = tower ? 'on the parity-polytope line' : wall ? 'on the wall' : 'at the edge of ' + lawName;
    // the book's rows: runs of days with no gap are merged, and only the last rows are kept
    var bookRows = [];
    entries.forEach(function (e) {
      var zero = len(e.gap) < 1e-9, last = bookRows[bookRows.length - 1];
      if (zero && last && last.zero) last.to = e.day; else bookRows.push({ from: e.day, to: e.day, zero: zero, gap: e.gap });
    });
    var bookText = bookRows.map(function (r) { return { text: (r.from === r.to ? 'day ' + r.from : 'days ' + r.from + '–' + r.to) + ':  ' + (r.zero ? 'together, (0, 0)' : pair(r.gap)), col: r.zero ? C.dim : C.violet }; });
    if (!bookText.length) bookText = [{ text: 'no entries yet', col: C.dim }];
    if (bookText.length > 4) bookText = [{ text: '…', col: C.dim }].concat(bookText.slice(-3));
    bookText.push({ text: 'total u' + kk + ' = ' + pair(u), col: C.orange });
    // the twins' two numbers, on dashed lines from each twin to the bottom and left edges of the map
    function coordLines(g, q, col, p) { var vv = g.vis; g.line(q, [q[0], vv[2]], col, 1.3, p, [4, 4]); g.line(q, [vv[0], q[1]], col, 1.3, p, [4, 4]); }
    function coordLabels(g, pA, pB) {
      var vv = g.vis, right = x[0] >= z[0], up = x[1] >= z[1];
      if (sameA) g.label([x[0], vv[2]], 'x₁ = z₁ = ' + num(x[0]), C.ink, { dy: -28, align: 'center', p: pB, size: 11.5 });
      else {
        g.label([x[0], vv[2]], 'x₁ = ' + num(x[0]), '#e6e9ee', { dx: right ? 6 : -6, dy: -28, align: right ? 'left' : 'right', p: pA, size: 11.5 });
        g.label([z[0], vv[2]], 'z₁ = ' + num(z[0]), C.blue, { dx: right ? -6 : 6, dy: -28, align: right ? 'right' : 'left', p: pB, size: 11.5 });
      }
      if (sameB) g.label([vv[0], x[1]], 'x₂ = z₂ = ' + num(x[1]), C.ink, { dx: 44, dy: 14, p: pB, size: 11.5 });
      else {
        g.label([vv[0], x[1]], 'x₂ = ' + num(x[1]), '#e6e9ee', { dx: 44, dy: up ? -12 : 12, p: pA, size: 11.5 });
        g.label([vv[0], z[1]], 'z₂ = ' + num(z[1]), C.blue, { dx: 44, dy: up ? 12 : -12, p: pB, size: 11.5 });
      }
    }
    // the book drawn as an arrow from the Warden, set a little below the gap so the two can be told apart
    function bookArrow(g, p) {
      if (!(p > 0) || len(u) < 1e-9) return;
      var A = g.P(z), Bp = g.P(add(z, u)), dx = Bp[0] - A[0], dy = Bp[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      if (ny < 0) { nx = -nx; ny = -ny; }   // always below on the screen
      var off = 26, a = [A[0] + nx * off, A[1] + ny * off], b = [Bp[0] + nx * off, Bp[1] + ny * off];
      g.ctx.save(); g.clip(g.mapR); g.ctx.globalAlpha = clamp(p, 0, 1);
      g.ctx.strokeStyle = 'rgba(255,176,113,0.5)'; g.ctx.lineWidth = 1; g.ctx.setLineDash([2, 3]);
      g.ctx.beginPath(); g.ctx.moveTo(A[0], A[1]); g.ctx.lineTo(a[0], a[1]); g.ctx.stroke(); g.ctx.setLineDash([]);
      g.arrowPx(a, [a[0] + (b[0] - a[0]) * clamp(p, 0, 1), a[1] + (b[1] - a[1]) * clamp(p, 0, 1)], C.orange, 3);
      g.ctx.restore(); g.ctx.globalAlpha = 1;
      g.labelPx((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 20, 'the book: u' + kk + ' = ' + pair(u), C.orange, { align: 'center', size: 12, p: seg(p, 0.6, 1) });
    }
    out.push({ id: 'ledger-role', chapter: 'The Twins', title: 'The Warden’s book: u', layout: 'map+side', view: bookView, dur: 6.4,
      text: 'So the Warden keeps a book. The story calls it a book or ledger; in standard scaled ADMM it is the scaled dual variable u. ' +
        'Each twin stands at a spot with two numbers, one for each direction of the map: the Wanderer at x = (x₁, x₂) and the Warden at z = (z₁, z₂). ' +
        'At the end of every circuit the Warden writes their gap, x − z, into the book: how far, and in which direction, the Wanderer stands from it. So u ← u + (x − z). ' +
        (k === 0 ? 'At the start the twins stand together, x₀ = z₀, and the book is empty: u₀ = (0, 0).' :
          !firstGap ? 'So far the twins have always stood together, x = z, so every gap was (0, 0) and the book is empty. Today both stand at ' + pair(x) + '.' :
          (firstWallContact > 1 ? 'For the first ' + (firstWallContact - 1) + (firstWallContact === 2 ? ' day' : ' days') + ' the twins stood together, x = z, and the book stayed empty. ' : '') +
          (firstWallContact === k ?
            'On day ' + k + ' the Wanderer ended at x' + kk + ' = ' + pair(x) + ', ' + outsideWord + ', while the Warden stood ' + onWord + ' at z' + kk + ' = ' + pair(z) + '. The gap x' + kk + ' − z' + kk + ' = ' + pair(gapNow) + ' became the first entry, so the book reads u' + kk + ' = ' + pair(u) + '. ' :
            'On day ' + firstWallContact + ' the Wanderer first ended ' + outsideWord + ', and the book got its first entry, ' + pair(firstGap) + '. Today the Wanderer is at x' + kk + ' = ' + pair(x) + ' and the Warden at z' + kk + ' = ' + pair(z) + ', and the book reads u' + kk + ' = ' + pair(u) + '. ') +
          'Tomorrow the Warden will use it.' + (cx.tutorial && w[k + 4] ? ' The next pages follow day ' + (k + 1) + ' move by move, then days ' + (k + 2) + ' to ' + (k + 4) + ' one at a time, each with a land made from the day before.' : '')),
      math: 'x = (x₁, x₂): the Wanderer;  z = (z₁, z₂): the Warden' + at(0.3, '<br>x' + kk + ' = ' + pair(x) + ',  z' + kk + ' = ' + pair(z) + ',  x' + kk + ' − z' + kk + ' = ' + pair(gapNow)) +
        at(0.72, '<br>u<sub>k</sub> = u<sub>k−1</sub> + (x<sub>k</sub> − z<sub>k</sub>);  u' + kk + ' = ' + (k > 0 ? (function () { var nz = entries.filter(function (e) { return len(e.gap) > 1e-9; }).map(function (e) { return pair(e.gap); }); return nz.length ? (nz.length > 3 ? '… + ' : '') + nz.slice(-3).join(' + ') + ' = ' : ''; })() : '') + pair(u)),
      draw: function (g, p) {
        var pX = seg(p, 0.05, 0.3), pZ = seg(p, 0.25, 0.5), pG = seg(p, 0.5, 0.7), pU = seg(p, 0.72, 0.95);
        base(g);
        if (wall) {   // name the wall the Warden stands on
          var vv = g.vis, onSide = Math.abs(z[0] - box[0]) < 1e-9 || Math.abs(z[0] - box[1]) < 1e-9;
          if (onSide) g.label([z[0], vv[3]], 'the wall, x₁ = ' + num(z[0], 0), C.blue, { dx: 8, dy: 16, size: 11.5 });
          else if (Math.abs(z[1] - box[0]) < 1e-9 || Math.abs(z[1] - box[1]) < 1e-9) g.label([vv[1], z[1]], 'the wall, x₂ = ' + num(z[1], 0), C.blue, { dx: -8, dy: -12, align: 'right', size: 11.5 });
        }
        coordLines(g, x, 'rgba(230,233,238,0.7)', pX); if (!together) coordLines(g, z, 'rgba(169,205,246,0.8)', pZ);
        coordLabels(g, pX, together ? pX : pZ);
        if (!together) { g.arrow(z, x, C.violet, 2.5, pG); g.label(lerp2(z, x, 0.5), 'the gap x' + kk + ' − z' + kk + ' = ' + pair(gapNow), C.violet, { dy: -42, align: 'center', p: pG, size: 12 }); }
        bookArrow(g, pU);
        g.dot(z, 7, C.blue, together ? pX : pZ); g.hero(x, 'tw', pX);
        if (together) g.label(x, 'both twins: x' + kk + ' = z' + kk + ' = ' + pair(x), C.ink, { dx: 14, dy: -18, p: pX, size: 12 });
        else {
          var right = x[0] >= z[0];
          g.label(x, 'the Wanderer, x' + kk, '#e6e9ee', { dx: right ? 14 : -14, dy: -18, align: right ? 'left' : 'right', p: pX, size: 12 });
          g.label(z, 'the Warden, z' + kk, C.blue, { dx: right ? -14 : 14, dy: -18, align: right ? 'right' : 'left', p: pZ, size: 12 });
        }
        // the side panel: the twins' numbers, then the book
        var R = g.sideR, tall = R[3] > 300, rh = tall ? 26 : 20, c1 = R[0] + 14, c2 = R[0] + R[2] * 0.5, c3 = R[0] + R[2] * 0.76;
        g.panel(R, 'Where the twins stand, day ' + k);
        var table = [['', 'first', 'second', C.dim, 1], ['x' + kk + ', the Wanderer', 'x₁ = ' + num(x[0]), 'x₂ = ' + num(x[1]), '#e6e9ee', pX], ['z' + kk + ', the Warden', 'z₁ = ' + num(z[0]), 'z₂ = ' + num(z[1]), C.blue, pZ], ['x' + kk + ' − z' + kk + ', the gap', num(gapNow[0]), num(gapNow[1]), C.violet, pG]];
        table.forEach(function (r, i) { var y = R[1] + 40 + rh * i; g.labelPx(c1, y, r[0], r[3], { plain: true, size: 12, p: r[4] }); g.labelPx(c2, y, r[1], r[3], { plain: true, mono: true, size: 12, p: r[4] }); g.labelPx(c3, y, r[2], r[3], { plain: true, mono: true, size: 12, p: r[4] }); });
        var y2 = R[1] + 40 + rh * 4 + (tall ? 18 : 8), cv = g.ctx;
        cv.globalAlpha = clamp(pU, 0, 1); cv.strokeStyle = C.faint; cv.lineWidth = 1; cv.beginPath(); cv.moveTo(R[0] + 10, y2 - rh / 2); cv.lineTo(R[0] + R[2] - 10, y2 - rh / 2); cv.stroke(); cv.globalAlpha = 1;
        g.labelPx(c1, y2, 'The Warden’s book', C.gold, { plain: true, size: 12.5, p: pU });
        bookText.forEach(function (r, i) { g.labelPx(c1, y2 + rh * (i + 1), r.text, r.col, { plain: true, mono: true, size: 12, p: seg(pU, 0.15 * i, 0.15 * i + 0.4) }); });
      } });

    // ---- one circuit: the aim, the Wanderer's step, the Warden's step, the book
    var aimView = around([z, v, x, add(z, u)], 1.2, Math.max(0.16 * cx.span, 7 * len(u), 0.28));
    out.push({ id: 'aim', chapter: 'The Twins', title: 'Aim past the Warden: v = z − u', layout: 'map+side', view: aimView, dur: 5,
      text: (len(u) > 1e-9 ? 'The book says: you fell short of me by u<sub>' + k + '</sub> = ' + pair(u) + '. So the Warden tells the Wanderer to aim not at z<sub>' + k + '</sub> but past it by the book: the aim is v<sub>' + k + '</sub> = z<sub>' + k + '</sub> − u<sub>' + k + '</sub> = ' + pair(v) + '. ' : 'The book is empty, so the aim is the Warden’s own spot: v<sub>' + k + '</sub> = z<sub>' + k + '</sub> = ' + pair(v) + '. ') +
        'Why past, and why subtract? The rope’s cost ρ/2·|x − z + u|² is the same number as ρ/2·|x − (z − u)|²: a rope tied to v. A gap that repeats is corrected a little harder each day, until the Wanderer lands on the Warden.',
      math: '|x − z + u|² = |x − (z − u)|²,  so its centre is v = z − u' + at(0.55, '<br>v<sub>' + k + '</sub> = ' + pair(z) + ' − ' + pair(u) + ' = ' + pair(v)),
      draw: function (g, p) {
        base(g); g.dot(z, 7, C.blue, 1); g.label(z, 'start at z' + subscript(k), C.blue, { dx: -8, dy: -16, align: 'right', p: 1, size: 12 }); g.hero(x, 'tw', 1); g.label(x, 'x' + subscript(k), '#e6e9ee', { dx: 10, dy: -16, size: 12 });
        if (len(u) > 1e-9) { g.arrow(z, v, C.violet, 3, seg(p, 0.25, 0.58)); g.label(lerp2(z, v, 0.5), 'past it by the book, −u' + subscript(k), C.violet, { dy: -42, align: 'center', p: seg(p, 0.45, 0.68), size: 12 }); }
        g.dot(v, 6, C.violet, seg(p, 0.55, 0.7)); g.halo(v, 12, C.violet, seg(p, 0.6, 0.75), 1.5);
        g.label(v, 'the aim v' + subscript(k) + ' = ' + pair(v), C.violet, { dx: 8, dy: 24, p: seg(p, 0.68, 0.86), size: 12 });
        var R = g.sideR; g.panel(R, 'Build the aim');
        g.labelPx(R[0] + 16, R[1] + 55, '1. the Warden   z' + subscript(k) + ' = ' + pair(z), C.blue, { plain: true, mono: true, p: seg(p, 0.08, 0.3) });
        g.labelPx(R[0] + 16, R[1] + 91, '2. the book     u' + subscript(k) + ' = ' + pair(u), C.orange, { plain: true, mono: true, p: seg(p, 0.28, 0.5) });
        g.labelPx(R[0] + 16, R[1] + 127, '3. past it by  −u' + subscript(k) + ' = ' + pair(scale(u, -1)), C.violet, { plain: true, mono: true, p: seg(p, 0.48, 0.7) });
        g.labelPx(R[0] + 16, R[1] + 163, '4. the aim      v' + subscript(k) + ' = ' + pair(v), C.gold, { plain: true, mono: true, p: seg(p, 0.68, 0.9) });
      } });

    // ---- the Wanderer's step, in two pages: first as gradient descent on the land plus the rope (what the reader
    // already knows from the Pilgrim), then the place where that walk stops, where the land's pull and the rope's pull
    // cancel; on a valley that condition is two equations, which is how the Wanderer actually takes its step.
    var rope = function (q) { var dq = sub(q, v); return f(q) + rho / 2 * dot(dq, dq); };
    var gradF = land.fgrad || land.grad, ropeSlope = function (q) { return add(gradF(q), scale(sub(q, v), rho)); };
    var sk = subscript(k), sk1 = subscript(k + 1), quadExact = !!(rec.exact && !tower && land.A && land.c), stepText, stepMath, side = null, gd = null;
    if (quadExact) {
      // gradient descent on F = f + rope with the stride 2/(λmin + λmax) = 2/trace(A + ρI): it zigzags, as the Pilgrim does
      var Aq = land.A, alphaGD = 2 / (Aq[0][0] + Aq[1][1] + 2 * rho), gq = x.slice(), gdPath = [gq.slice()], gdH = [rope(gq)];
      for (var gs = 0; gs < 40; gs++) { var ng = sub(gq, scale(ropeSlope(gq), alphaGD)); if (len(sub(ng, gq)) < 2e-5 * cx.span) break; gq = ng; gdPath.push(gq.slice()); gdH.push(rope(gq)); }
      if (gdPath.length === 1) { gdPath.push(xn.slice()); gdH.push(rope(xn)); } else { gdPath[gdPath.length - 1] = xn.slice(); gdH[gdH.length - 1] = rope(xn); }
      gd = { path: gdPath, h: gdH, alpha: alphaGD, n: gdPath.length - 1 };
      stepText = 'Today the Wanderer must find the lowest point of a new land, F(x): the valley’s height f(x) plus the rope’s cost ρ/2·|x − v|², with the rope tied to the aim v' + sk + ' = ' + pair(v) + '. ' +
        'The rope adds a bowl around the aim, so the new land leans toward it. ' +
        'One way to find that lowest point is the Pilgrim’s: feel the slope of F and step downhill, again and again. ' +
        'The slope of F has two parts, the valley’s slope ∇f(x) and the rope’s slope ρ(x − v). ' +
        'So downhill on F is the sum of two pulls: the land’s pull −∇f(x), downhill on the valley, and the rope’s pull ρ(v − x), toward the aim. ' +
        (len(sub(xn, x)) < 1e-6 * cx.span ? 'Today the Wanderer already stands at the lowest point of F, x' + sk1 + ' = x' + sk + ' = ' + pair(xn) + ': the slope is zero, so the walk takes no step.' :
          'From x' + sk + ' = ' + pair(x) + ', with a fixed stride, the steps zigzag and shrink as the ground flattens. ' +
          'After ' + gd.n + (gd.n === 1 ? ' step' : ' steps') + ' the Wanderer stands at x' + sk1 + ' = ' + pair(xn) + ', the lowest point of F.');
      stepMath = 'F(x) = f(x) + ρ/2·|x − v' + sk + '|²,  ρ = ' + num(rho, 2) + at(0.1, '<br>slope: ∇F(x) = ∇f(x) + ρ(x − v' + sk + ')') + at(0.22, '<br>downhill: −∇F(x) = −∇f(x) + ρ(v' + sk + ' − x)') +
        at(0.4, '<br>step: x ← x − α·∇F(x),  α = ' + num(gd.alpha, 3)) + at(0.92, '<br>after ' + gd.n + (gd.n === 1 ? ' step' : ' steps') + ': x' + sk1 + ' = ' + pair(xn));
    } else if (rec.exact && tower) {
      var y = land.y, s2 = P.s2, mb = P.muB, phi = function (t, i) { return (y[i] - t) * (y[i] - t) / (2 * s2) + mb * Math.pow(1 - t * t, 2) + rho / 2 * (t - v[i]) * (t - v[i]); };
      stepText = 'Today the Wanderer must find the lowest point of a new land: the evidence fit and binary-end pull plus a rope to v' + sk + ' = ' + pair(v) + '. On this two-bit land each coordinate can be chosen on its own: it takes the lowest point on [−1, 1] of its evidence term, binary-end pull and share of the rope, φ(t) = (y − t)²/(2σ²) + μ_b(1 − t²)² + ρ/2·(t − v)². The lowest points: x' + sk1 + ' = ' + pair(xn) + '.';
      stepMath = at(0.4, 'coordinate 1: lowest φ at ' + num(xn[0])) + at(0.7, ',  coordinate 2: lowest φ at ' + num(xn[1]));
      side = function (g, p) {
        var R = g.sideR, h2 = (R[3] - 8) / 2;
        [0, 1].forEach(function (i) {
          var Rr = [R[0], R[1] + i * (h2 + 8), R[2], h2], vals = []; for (var q = 0; q <= 40; q++) vals.push(phi(-1 + q / 20, i));
          var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pl = g.plot(Rr, [-1, 1], [lo - 0.08 * (hi - lo), hi + 0.08 * (hi - lo)], { title: 'coordinate ' + (i + 1) + ': φ(t)' });
          pl.frame('signed bit t', ''); pl.curve(function (t) { return phi(t, i); }, i ? C.blue : C.orange, 2, seg(p, 0.1 + 0.25 * i, 0.35 + 0.25 * i));
          pl.point(xn[i], phi(xn[i], i), C.gold, 'lowest: ' + num(xn[i]), seg(p, 0.35 + 0.25 * i, 0.5 + 0.25 * i), xn[i] > 0.3 ? 'left' : 'right');
        });
      };
    } else {
      stepText = 'Today the Wanderer must find the lowest point of a new land: the land plus a rope to v' + sk + ' = ' + pair(v) + '. With ' + (cx.haze ? 'haze' : 'ripples or pits') + ' on the land there is no formula, so it does what the Pilgrim does: it walks down that combined land in ' + Math.max(rec.path.length - 1, 0) + ' small steps, feeling the way with its staff, until it is as low as it can tell: x' + sk1 + ' = ' + pair(xn) + '.';
      stepMath = 'F(x) = f(x) + ρ/2·|x − v' + sk + '|²' + at(0.8, ';  x' + sk1 + ' = ' + pair(xn));
    }
    var wanderView = gd ? around(gd.path.concat([v]), 0.7, 0.1 * cx.span) : around([x, v, xn], 0.6, 0.25 * cx.span);
    out.push({ id: 'wander', chapter: 'The Twins', title: 'The Wanderer’s step: downhill on land plus rope', layout: gd || side ? 'map+side' : 'map', view: wanderView, dur: gd ? 9 : 4.8,
      text: stepText, math: stepMath,
      draw: function (g, p) {
        g.land(rope, { id: 'rope' + v[0] + ',' + v[1], rings: gd ? 12 : 10 }); g.axes(); law(g, 1);
        g.dot(v, 6, C.violet, 1); g.label(v, 'the aim v' + sk, C.violet, { dx: -12, dy: 18, align: 'right', size: 12, inside: true });
        if (!gd) {
          var path = rec.path && rec.path.length > 1 ? rec.path : [x, xn], q = seg(p, 0.3, 0.9);
          g.path(path, C.ink, 2, q, [4, 3]);
          var L = 0, segL = []; for (var i = 1; i < path.length; i++) { segL.push(len(sub(path[i], path[i - 1]))); L += segL[i - 1]; }
          var goal = L * q, pos = path[0]; for (i = 1; i < path.length; i++) { if (goal <= segL[i - 1]) { pos = lerp2(path[i - 1], path[i], segL[i - 1] ? goal / segL[i - 1] : 1); break; } goal -= segL[i - 1]; pos = path[i]; }
          spring(g, pos, v, 1); g.hero(pos, 'tw', 1); if (q >= 1) g.label(xn, 'x' + sk1 + ' = ' + pair(xn), C.gold, { dx: 14, dy: 18 });
          if (side) side(g, p);
          return;
        }
        // the walk: where it starts, the two pulls that make the slope there, then every step
        var gp = gd.path, n = gd.n, w0 = 0.38, sA = seg(p, w0, 0.92) * n, kA = Math.floor(sA), fA = sA - kA, at2 = kA >= n ? gp[n] : lerp2(gp[kA], gp[kA + 1], ease(fA)), c2 = g.ctx;
        g.halo(x, 10, C.ink, 1, 1.5); g.label(x, 'x' + sk + ': where it starts', C.ink, { dy: 26, align: 'center', size: 12, p: seg(p, 0, 0.1) * (1 - seg(p, 0.85, 0.95)), inside: true });
        for (var m = 1; m <= Math.min(kA, n); m++) g.dot(gp[m], 3.5, 'rgba(242,245,248,0.9)', 1);
        if (p > w0) g.path(gp.slice(0, Math.min(kA, n) + 1).concat(kA < n ? [at2] : []), 'rgba(242,245,248,0.8)', 2, 1);
        spring(g, at2, v, 0.45);
        // at the start the slope of F is the sum of two pulls: the land's pull −∇f(x) and the rope's pull ρ(v − x)
        var pullL = scale(gradF(x), -1), pullR = scale(sub(v, x), rho), pullF = add(pullL, pullR), bigP = Math.max(len(pullL), len(pullR)), fadeP = 1 - seg(p, 0.33, 0.39), flatF = len(pullF) < 0.03 * bigP;
        if (bigP > 1e-12 && fadeP > 0) {
          var Lp = 64 / g.s / bigP, tL = add(x, scale(pullL, Lp)), tR = add(x, scale(pullR, Lp)), tF = add(x, scale(pullF, Lp)), qF = seg(p, 0.2, 0.28), parts = 1 - seg(p, 0.21, 0.24);
          var tipIn = function (tip, dir, text, col, q) { var l = len(dir) || 1, ux = dir[0] / l, uy = -dir[1] / l; g.label(tip, text, col, { dx: ux * 14, dy: uy * 14 + (Math.abs(ux) < 0.4 ? (uy < 0 ? -4 : 4) : 0), align: ux > 0.35 ? 'left' : ux < -0.35 ? 'right' : 'center', size: 12, p: q, inside: true }); };
          c2.globalAlpha = fadeP; g.arrow(x, tL, C.orange, 2.6, seg(p, 0.04, 0.12)); g.arrow(x, tR, C.violet, 2.6, seg(p, 0.12, 0.2));
          if (qF > 0) { g.line(tL, tF, 'rgba(242,245,248,0.5)', 1.2, qF, [3, 3]); g.line(tR, tF, 'rgba(242,245,248,0.5)', 1.2, qF, [3, 3]); if (!flatF) g.arrow(x, tF, C.gold, 3, qF); }
          c2.globalAlpha = 1;
          if (len(pullL) > 0.03 * bigP) tipIn(tL, pullL, 'the land’s pull', C.orange, Math.min(seg(p, 0.08, 0.12), parts));
          if (len(pullR) > 0.03 * bigP) tipIn(tR, pullR, 'the rope’s pull', C.violet, Math.min(seg(p, 0.16, 0.2), parts));
          if (flatF) g.label(x, 'the pulls cancel: no step', C.gold, { dy: -30, align: 'center', size: 12, p: Math.min(seg(p, 0.24, 0.28), fadeP), inside: true });
          else tipIn(tF, pullF, 'their sum: downhill on F', C.gold, Math.min(seg(p, 0.24, 0.28), fadeP));
        }
        g.hero(at2, 'tw', 1);
        g.label(xn, 'x' + sk1 + ': the lowest point of F', C.gold, { dy: -26, align: 'center', size: 12, p: seg(p, 0.9, 1), inside: true });
        g.labelPx(g.mapR[0] + 12, g.mapR[1] + 30, p < w0 ? 'feel the slope' : kA >= n ? n + (n === 1 ? ' step' : ' steps') + ': it stops' : 'step ' + (kA + 1), C.gold, { size: 13 });
        // the height of F after every step
        // a flat series (the twins have settled) still needs a visible range, or the plot's ticks would never advance
        var hs = gd.h, lo = Math.min.apply(null, hs), hi = Math.max.apply(null, hs), pad = hi - lo > 1e-6 * (1 + Math.abs(hi)) ? (hi - lo) * 0.14 : 0.01 * (1 + Math.abs(hi));
        if (p < w0 - 0.02) {
          // before the walk: the two pulls at the start, their sum, and the first step taken along it
          var SR = g.sideR, first = n ? gp[1] : x, out2 = 1 - seg(p, w0 - 0.07, w0 - 0.02);
          var rows = [
            { t: 'the land’s pull, downhill on the valley', col: C.orange, at: 0.06 },
            { t: '−∇f(x' + sk + ') = ' + pair(pullL), col: C.orange, mono: true, at: 0.06 },
            { t: 'the rope’s pull, toward the aim v' + sk, col: C.violet, at: 0.14 },
            { t: 'ρ(v' + sk + ' − x' + sk + ') = ' + pair(pullR), col: C.violet, mono: true, at: 0.14 },
            { t: 'their sum: downhill on F', col: C.gold, at: 0.22 },
            { t: '−∇F(x' + sk + ') = ' + pair(pullF), col: C.gold, mono: true, at: 0.22 }].concat(flatF || !n ? [
            { t: 'their sum is zero, so the walk takes no step', col: C.ink, at: 0.28 }] : [
            { t: 'the first step goes along their sum, stride α:', col: C.ink, at: 0.28 },
            { t: 'x' + sk + ' + ' + num(gd.alpha, 3) + '·' + pair(pullF) + ' = ' + pair(first), col: C.ink, mono: true, at: 0.28 }]);
          var rh2 = Math.min(28, (SR[3] - 50) / rows.length); g.panel(SR, 'At x' + sk + ', the slope of F is two pulls');
          rows.forEach(function (r, i) { g.labelPx(SR[0] + 14, SR[1] + 46 + rh2 * i + (r.mono ? -3 : 0), r.t, r.col, { plain: true, mono: !!r.mono, size: r.mono ? 12 : 12.5, p: Math.min(seg(p, r.at, r.at + 0.05), out2) }); });
        } else {
          var pl = g.plot(g.sideR, [0, n], [lo - pad, hi + pad], { title: 'height of land + rope after each step' }); pl.frame('step', 'F(x)');
          pl.curve(function (t) { var i2 = Math.floor(t), fq = t - i2; return hs[Math.min(i2, n)] * (1 - fq) + hs[Math.min(i2 + 1, n)] * fq; }, C.gold, 2.2, p < w0 ? 0 : clamp(sA / n, 0, 1));
          for (var j = 0; j <= (p < w0 ? 0 : Math.min(kA, n)); j++) pl.point(j, hs[j], C.gold, '', 1);
          if (kA >= n) pl.point(n, hs[n], C.gold, 'lowest: F(x' + sk1 + ') = ' + num(hs[n], 4), seg(p, 0.92, 1), 'left');
        }
      } });

    // where the walk stops: the land's pull and the rope's pull cancel
    var landPull = scale(gradF(xn), -1), ropePull = scale(sub(v, xn), rho), sumPull = add(landPull, ropePull), pullSize = len(landPull) + len(ropePull) + 1e-12;
    var cancel = len(sumPull) <= 1e-6 * (1 + pullSize), nearly = len(sumPull) <= 0.05 * pullSize, balText, balMath, balSide;
    if (quadExact) {
      var Aw = land.A, cw = land.c, Mw = [[Aw[0][0] + rho, Aw[0][1]], [Aw[1][0], Aw[1][1] + rho]], rhsW = [Aw[0][0] * cw[0] + Aw[0][1] * cw[1] + rho * v[0], Aw[1][0] * cw[0] + Aw[1][1] * cw[1] + rho * v[1]];
      var eq = function (r) { return num(Mw[r][0]) + '·x₁ ' + (Mw[r][1] < 0 ? '− ' : '+ ') + num(Math.abs(Mw[r][1])) + '·x₂ = ' + num(rhsW[r]); };
      balText = 'Where does the walk stop? Where the new land is flat, so the two pulls on the Wanderer cancel. ' +
        'The land pulls it downhill, out toward the valley floor c; the rope pulls it back toward the aim v' + sk + '. ' +
        'At x' + sk1 + ' the land pulls with ' + pair(landPull) + ' and the rope with ' + pair(ropePull) + ': equal and opposite. ' +
        'On this valley there is a shortcut. “The pulls cancel” is one equation for each direction of the map: A(x − c) + ρ(x − v) = 0. So the Wanderer can solve two equations for its two numbers, x₁ and x₂, instead of walking. ' +
        'That is what it does each day on this land: one solve, and the same spot the walk reaches.';
      balMath = 'flat:  ∇f(x) + ρ(x − v) = 0,  with ∇f(x) = A(x − c)' + at(0.55, '<br>' + eq(0) + ',  ' + eq(1)) + at(0.85, '<br>solved: x' + sk1 + ' = ' + pair(xn));
      balSide = function (g, p) {
        var R = g.sideR, tall = R[3] > 300, rh = tall ? 30 : 21, x0 = R[0] + 14; g.panel(R, 'The pulls cancel: two equations');
        var rows = [
          { t: 'the land’s pull   −A(x' + sk1 + ' − c) = ' + pair(landPull), col: C.orange, mono: true, at: 0.15 },
          { t: 'the rope’s pull    ρ(v' + sk + ' − x' + sk1 + ') = ' + pair(ropePull), col: C.violet, mono: true, at: 0.4 },
          { t: 'their sum = ' + pair(sumPull), col: C.gold, mono: true, at: 0.55 },
          { t: 'so A(x − c) + ρ(x − v) = 0: one equation', col: C.dim, at: 0.62 },
          { t: 'for each direction of the map', col: C.dim, at: 0.62 },
          { t: eq(0), col: C.ink, mono: true, at: 0.7 },
          { t: eq(1), col: C.ink, mono: true, at: 0.75 },
          { t: 'solved: x₁ = ' + num(xn[0]) + ',  x₂ = ' + num(xn[1]), col: C.gold, mono: true, at: 0.85 }];
        rows.forEach(function (r, i) { g.labelPx(x0, R[1] + 46 + rh * i, r.t, r.col, { plain: true, mono: !!r.mono, size: 12, p: seg(p, r.at, r.at + 0.12) }); });
      };
    } else {
      balText = 'Where does the walk stop? Where the new land is flat, so the two pulls on the Wanderer ' + (cancel ? 'cancel' : nearly ? 'nearly cancel' : 'would cancel, if nothing held it') + '. ' +
        'The land pulls it downhill; the rope pulls it back toward the aim v' + sk + '. ' +
        'At x' + sk1 + ' the land pulls with ' + pair(landPull) + ' and the rope with ' + pair(ropePull) + '. ' +
        (cancel || nearly ? 'They are equal and opposite' + (cancel ? '' : ', as near as the walk can tell') + ': this is the lowest point of land plus rope.' :
          'They do not cancel: ' + (tower ? 'the edge of a card’s range, −1 or +1, holds the rest.' : 'the edge of the land holds the rest.'));
      balMath = 'flat:  ∇f(x) + ρ(x − v) = 0' + at(0.6, ';  sum of the pulls ' + pair(sumPull));
      balSide = function (g, p) {
        var R = g.sideR, x0 = R[0] + 14; g.panel(R, 'The two pulls at x' + sk1);
        [{ t: 'the land’s pull  ' + pair(landPull), col: C.orange, at: 0.2 }, { t: 'the rope’s pull  ' + pair(ropePull), col: C.violet, at: 0.45 }, { t: 'their sum        ' + pair(sumPull), col: C.gold, at: 0.65 }]
          .forEach(function (r, i) { g.labelPx(x0, R[1] + 52 + 32 * i, r.t, r.col, { plain: true, mono: true, size: 12, p: seg(p, r.at, r.at + 0.15) }); });
      };
    }
    var balView = quadExact ? around([v, xn, land.c], 1, 0.3 * cx.span) : around([v, xn], 1.2, 0.3 * cx.span);
    out.push({ id: 'wander-balance', chapter: 'The Twins', title: 'Where the walk stops: two pulls cancel', layout: 'map+side', view: balView, dur: 6,
      text: balText, math: balMath,
      draw: function (g, p) {
        base(g);
        if (quadExact) { g.dot(land.c, 5, C.ink, seg(p, 0, 0.15)); g.label(land.c, 'c, the valley floor', C.ink, { dx: 10, dy: -16, p: seg(p, 0, 0.2), size: 12, inside: true }); }
        g.dot(v, 6, C.violet, 1); g.label(v, 'the aim v' + sk, C.violet, { dx: -10, dy: -16, align: 'right', size: 12, inside: true });
        spring(g, xn, v, 0.55); g.hero(xn, 'tw', 1);
        // the arrows stop short of the aim; the rope's label and x's label sit on the side away from the aim and the land's pull
        var Pv = g.P(v), Px = g.P(xn), gapPx = Math.hypot(Pv[0] - Px[0], Pv[1] - Px[1]), big = Math.max(len(landPull), len(ropePull)) || 1;
        var Lw = (gapPx > 24 ? Math.min(52, 0.75 * gapPx) : 52) / g.s, aL = scale(landPull, Lw / big), aR = scale(ropePull, Lw / big);
        var ulx = landPull[0] / big, uly = -landPull[1] / big, ul = Math.hypot(ulx, uly) || 1, sideA = ropePull[0] <= 0 ? 'left' : 'right', dxA = sideA === 'left' ? -6 : 6, dyA = uly < 0 ? 1 : -1;
        g.arrow(xn, add(xn, aL), C.orange, 3, seg(p, 0.15, 0.4));
        g.label(add(xn, aL), 'the land’s pull, downhill', C.orange, { dx: 14 * ulx / ul, dy: 14 * uly / ul + (Math.abs(ulx / ul) < 0.4 ? (uly < 0 ? -4 : 4) : 0), align: ulx / ul > 0.35 ? 'left' : ulx / ul < -0.35 ? 'right' : 'center', p: seg(p, 0.3, 0.45), size: 12, inside: true });
        g.arrow(xn, add(xn, aR), C.violet, 3, seg(p, 0.4, 0.65));
        g.label(xn, 'the rope’s pull, toward v' + sk, C.violet, { dx: dxA, dy: 30 * dyA, align: sideA, p: seg(p, 0.55, 0.7), size: 12, inside: true });
        g.label(xn, 'x' + sk1 + ' = ' + pair(xn), '#e6e9ee', { dx: dxA, dy: 54 * dyA, align: sideA, p: seg(p, 0.7, 0.85), size: 12, inside: true });
        balSide(g, p);
      } });

    out.push({ id: 'warden', chapter: 'The Twins', title: 'The Warden’s step', layout: 'map', view: view, dur: 4.4,
      text: noLaw ? 'Now the Warden moves while x<sub>' + (k + 1) + '</sub> and the start-of-day book u<sub>' + k + '</sub> are fixed. With no law on this land it simply stands at x + u = ' + pair(zn) + '.' :
        'Now the Warden moves, with the new x<sub>' + (k + 1) + '</sub> and the start-of-day book u<sub>' + k + '</sub> held fixed. It starts from the Wanderer’s spot plus the book, x<sub>' + (k + 1) + '</sub> + u<sub>' + k + '</sub> = ' + pair(xn) + ' + ' + pair(u) + ' = ' + pair(xu) + ', and steps straight to the nearest lawful spot: z<sub>' + (k + 1) + '</sub> = ' + pair(zn) + '. ' +
        (tower ? 'For the parity check that is the nearest point of the parity-polytope line.' : 'Inside a wall that means pulling each number back within the wall, if it is outside.') + ' Why add the book? The same rope cost, |x − z + u|² = |z − (x + u)|², is smallest at the lawful z nearest x + u.',
      math: '|x − z + u|² = |z − (x + u)|²' + at(0.42, '<br>z<sub>' + (k + 1) + '</sub> = Π<sub>C</sub>(x<sub>' + (k + 1) + '</sub> + u<sub>' + k + '</sub>)') + at(0.75, ' = Π<sub>C</sub>' + pair(xu) + ' = ' + pair(zn)),
      draw: function (g, p) {
        base(g); g.hero(xn, 'tw', 1, 'x' + subscript(k + 1));
        if (len(u) > 1e-9) g.arrow(xn, xu, C.orange, 2, seg(p, 0.1, 0.35));
        g.dot(xu, 5, C.ink, seg(p, 0.3, 0.4)); g.label(xu, 'x + u', C.ink, { dx: 10, dy: -12, p: seg(p, 0.35, 0.5) });
        g.line(xu, zn, C.blue, 2, seg(p, 0.5, 0.75), [5, 4]); rightAngle(g, zn, xu, seg(p, 0.7, 0.85)); warden(g, zn, seg(p, 0.7, 0.85), 'z' + subscript(k + 1) + ', the nearest lawful spot');
      } });

    var ledgerView = around([zn, add(zn, u), add(zn, un), xn], 1.2, Math.max(0.18 * cx.span, 4 * len(un), 0.32));
    out.push({ id: 'ledger', chapter: 'The Twins', title: 'The book, updated', layout: 'map', view: ledgerView, dur: 4.6,
      text: 'The Warden writes today’s gap into the book: u<sub>' + (k + 1) + '</sub> = u<sub>' + k + '</sub> + (x<sub>' + (k + 1) + '</sub> − z<sub>' + (k + 1) + '</sub>) = ' + pair(u) + ' + ' + pair(gap) + ' = ' + pair(un) + '. ' +
        (noLaw ? 'With no law the twins never part, the gap is 0 and the book stays empty.' :
          'A small gap means the twins nearly agree. But agreement alone is not enough to stop: the Warden must also have stopped moving. When all is settled, the book holds the wall’s toll: ρu is the force with which the wall holds the Wanderer back.'),
      math: 'u<sub>' + (k + 1) + '</sub> = u<sub>' + k + '</sub> + x<sub>' + (k + 1) + '</sub> − z<sub>' + (k + 1) + '</sub>' + at(0.45, '<br>= ' + pair(u) + ' + ' + pair(gap)) + at(0.85, ' = ' + pair(un)),
      draw: function (g, p) {
        base(g); g.dot(zn, 7, C.blue, 1); g.label(zn, 'z' + subscript(k + 1), C.blue, { dx: -10, dy: 18, align: 'right', size: 12 }); g.hero(xn, 'tw', 1);
        var tipOld = add(zn, u);
        if (len(u) > 1e-9) { g.arrow(zn, tipOld, 'rgba(255,176,113,0.55)', 2.5, seg(p, 0.05, 0.3)); g.label(lerp2(zn, tipOld, 0.5), 'old book u' + subscript(k), 'rgba(255,176,113,0.9)', { dx: 0, dy: -18, align: 'center', p: seg(p, 0.2, 0.4), size: 12 }); }
        if (len(gap) > 1e-9) { g.arrow(tipOld, add(tipOld, gap), C.violet, 2.5, seg(p, 0.35, 0.6)); g.label(lerp2(tipOld, add(tipOld, gap), 0.5), '+ today’s gap', C.violet, { dx: 0, dy: 20, align: 'center', p: seg(p, 0.5, 0.65), size: 12 }); }
        if (len(un) > 1e-9) { g.arrow(zn, add(zn, un), C.orange, 3.5, seg(p, 0.65, 0.9)); g.tipLabel(add(zn, un), un, 'new book u' + subscript(k + 1) + ' = ' + pair(un), C.orange, seg(p, 0.85, 1)); }
        else g.label(zn, 'no gap: the book is unchanged', C.dim, { dx: 12, dy: -20, p: seg(p, 0.4, 0.7), size: 12 });
      } });

    // the next three days with the book, one move at a time (tutorial only)
    var bookDays = [];
    var bookDayText = function (d, i) {
      var sd = subscript(d), sp = subscript(d - 1), now = w[d], pr = w[d - 1], aD = now.v, aN = sub(now.z, now.u), gapD = len(sub(now.x, now.z)), gapP = len(sub(pr.x, pr.z));
      var grew = len(pr.u) > len(w[d - 2].u) + 1e-9, settling = len(now.u) - len(pr.u) < 0.02 * len(now.u);
      if (i === 1) return 'The same recipe runs every day, now with the book. Day ' + d + ' starts from yesterday’s numbers: the Warden at z' + sp + ' = ' + pair(pr.z) + ' and the book u' + sp + ' = ' + pair(pr.u) + '. ' +
        'The rope is tied to today’s aim, v' + sp + ' = z' + sp + ' − u' + sp + ' = ' + pair(aD) + '. So today’s land, F' + sd + '(x) = f(x) + ρ/2·|x − v' + sp + '|², is a new function made from yesterday’s z and u. ' +
        'Its lowest point is x' + sd + ' = ' + pair(now.x) + '. The Warden steps to the lawful spot nearest x' + sd + ' + u' + sp + ': z' + sd + ' = ' + pair(now.z) + '. ' +
        'The book adds today’s gap: u' + sd + ' = ' + pair(now.u) + '. That sets tomorrow’s aim, v' + sd + ' = ' + pair(aN) + ', and with it tomorrow’s land.';
      if (i === 2) return 'Day ' + d + ' is built from day ' + (d - 1) + ': the aim is v' + sp + ' = z' + sp + ' − u' + sp + ' = ' + pair(aD) + '. ' +
        (grew ? 'The book has grown, so the aim sits further from the Warden and the rope pulls the Wanderer further back. ' : '') +
        'Today’s lowest point is x' + sd + ' = ' + pair(now.x) + ', and the Warden steps to z' + sd + ' = ' + pair(now.z) + '. ' +
        'The gap ' + (gapD < gapP ? 'shrinks to ' : 'is ') + num(gapD) + ', and the book reads u' + sd + ' = ' + pair(now.u) + '.';
      return 'Day ' + d + ' once more: the aim v' + sp + ' = ' + pair(aD) + ', the lowest point x' + sd + ' = ' + pair(now.x) + ', the Warden z' + sd + ' = ' + pair(now.z) + '. ' +
        'The gap is now ' + num(gapD, 4) + ', and the book ' + (settling ? 'has nearly stopped growing, at' : 'reads') + ' u' + sd + ' = ' + pair(now.u) + '. ' +
        'Each day the Wanderer solved a different land, and each land was made from the day before.';
    };
    if (cx.tutorial && !noLaw && w[k + 4] && k >= 1) {
      var bdPts = [T];
      for (var bq = k + 1; bq <= k + 4; bq++) bdPts = bdPts.concat([w[bq].x, w[bq].z, w[bq].v, add(w[bq].x, w[bq].uFrom), sub(w[bq].z, w[bq].u)]);
      var bdView = around(bdPts, 0.2, 0.1 * cx.span);
      for (var bj = 2; bj <= 4; bj++) {
        var dd = k + bj;
        bookDays.push(dayPage({ id: 'book-day-' + (bj - 1), d: dd, book: true, view: bdView, text: bookDayText(dd, bj - 1),
          prev: { x: w[dd - 1].x, z: w[dd - 1].z, u: w[dd - 1].u }, now: { x: w[dd].x, z: w[dd].z, u: w[dd].u },
          aPrev: w[dd - 1].v, trail: w.slice(k, dd).map(function (q) { return q.x; }) }));
      }
      bookDays.forEach(function (pg) { out.push(pg); });
    }
    var againFrom = k;
    var ahead = w.slice(againFrom, Math.min(w.length, againFrom + 9)), xs = ahead.map(function (d) { return d.x; }), zs = ahead.map(function (d) { return d.z; });
    if (ahead.length > 2) {
      var prim = ahead.map(function (d) { return d.gap != null ? d.gap : len(sub(d.x, d.z)); }), dual = ahead.map(function (d, i) { return i ? rho * len(sub(d.z, ahead[i - 1].z)) : 0; });
      var primal = prim[1], dualNow = dual[1], n = ahead.length - 1;
      out.push({ id: 'again', chapter: 'The Twins', title: 'Day after day, until they stand together', layout: 'map+side', view: around(xs.concat(zs), 0.4, 10 * cx.h), dur: 6,
        text: 'Each circuit repeats the four moves: the aim, the Wanderer’s step, the Warden’s step, the book. ' + (bookDays.length ? 'Here are days ' + k + ' to ' + (k + n) + ' at speed, including the days just shown one at a time. ' : 'Here are the next ' + n + ' circuits. ') + 'The twins stop only when both tests are small: the gap between them, the primal residual, and the Warden’s move since yesterday times ρ, the dual residual. Today they are ' + num(primal, 4) + ' and ' + num(dualNow, 4) + '. Agreement alone is not enough: a Warden still on the move has not found the spot to dig.',
        math: 'stop when |x − z| and ρ·|z<sub>new</sub> − z<sub>old</sub>| are both small' + at(0.6, ';  today ' + num(primal, 4) + ' and ' + num(dualNow, 4)),
        draw: function (g, p) {
          base(g); star(g, T, 1); var s = seg(p, 0.05, 0.85) * n, kk = Math.floor(s), f2 = s - kk;
          g.path(xs.slice(0, kk + 1).concat(kk < n ? [lerp2(xs[kk], xs[kk + 1], ease(f2))] : []), 'rgba(230,233,238,0.8)', 2, 1);
          g.path(zs.slice(0, kk + 1).concat(kk < n ? [lerp2(zs[kk], zs[kk + 1], ease(f2))] : []), C.blue, 2, 1);
          for (var m = 1; m <= Math.min(kk, n); m++) { g.dot(xs[m], 3, '#e6e9ee', 1); g.dot(zs[m], 3, C.blue, 1); }
          var hx = kk < n ? lerp2(xs[kk], xs[kk + 1], ease(f2)) : xs[n], hz = kk < n ? lerp2(zs[kk], zs[kk + 1], ease(f2)) : zs[n];
          spring(g, hx, hz, 1); warden(g, hz, 1); g.halo(hz, 13, C.blue, 1, 2); g.hero(hx, 'tw', 1); g.labelPx(g.mapR[0] + 12, g.mapR[1] + 30, 'circuit ' + (againFrom + Math.min(kk, n)), C.gold, { size: 13 });
          var R = g.sideR, lo = -5, hi = Math.log(Math.max(Math.max.apply(null, prim.concat(dual)) * 1.5, 1e-4)) / Math.LN10, pl = g.plot(R, [0, n], [lo, hi], { title: 'the two tests, circuit by circuit (log scale)' }); pl.frame('circuits from today', 'log₁₀');
          function lg(a) { return function (t) { var i = Math.floor(t), fq = t - i; return Math.max(lo, Math.log(Math.max(a[Math.min(i, n)] * (1 - fq) + a[Math.min(i + 1, n)] * fq, 1e-9)) / Math.LN10); }; }
          pl.curve(lg(prim), C.violet, 2.2, clamp(s / n, 0, 1)); pl.curve(lg(dual), C.blue, 2.2, clamp(s / n, 0, 1));
          g.labelPx(pl.box[0] + 8, pl.box[1] + pl.box[3] - 58, 'the gap |x − z|: primal residual', C.violet, { size: 11.5, plain: true, p: seg(p, 0.1, 0.3) });
          g.labelPx(pl.box[0] + 8, pl.box[1] + pl.box[3] - 40, 'ρ × the Warden’s move: dual residual', C.blue, { size: 11.5, plain: true, p: seg(p, 0.2, 0.4) });
        } });
    }
  });
})();
