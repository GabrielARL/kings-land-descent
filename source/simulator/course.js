// The tutorial "Three heroes downhill": the tale of three optimisers told as one line of steps.  The reader only
// clicks Next.  Each step is a line or two of the story, its formula with real numbers, and an animation on the map
// of the land.  The lands and the walks come from engine.js; the drawing kit, the step player and the day-by-day steps
// (feeling the slope, the Pilgrim's stride, the Cartographer's journal, the Twins' day) from board.js and
// board_parts.js.
(function () {
  'use strict';
  var E = window.Engine, B = window.Board; if (!E || !B) return;
  var H = B.H, C = H.C, seg = H.seg, num = H.num, pair = H.pair, at = H.at, add = H.add, sub = H.sub, dot = H.dot, len = H.len;
  var scale = H.scale, lerp2 = H.lerp2, around = H.around, ease = H.ease, clamp = H.clamp, TAU = 2 * Math.PI;
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
  function ctxOf(W, hero, day) { return { hero: hero, name: NAMES[hero], key: W.key, L: { view: W.view, kind: W.K.kind }, land: W.land, p: W.p, x0: W.x0, day: day, walk: W.walks[hero] }; }
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

  // ------------------------------------------------------------ the course
  var Wc = world('canyon'), Wlong = world('canyon', { alpha: 0.22 }), Ww = world('wall'), Wf = world('fort'), Wm = world('misty');
  var out = [], CH = { land: 'The King’s land', feel: 'Feeling the slope', pg: 'The Pilgrim: gradient descent', lb: 'The Cartographer: L-BFGS', tw: 'The Twins: ADMM and the King’s law', fort: 'The old fort', cajode: 'From the fort to CAJODE', misty: 'The misty hills', end: 'What we learned' };
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
    text: 'The Cartographer also feels the slope with a staff, but it keeps a journal: its last m = ' + Math.round(Wc.p.m) + ' strides, each with how the slope changed over it. From those pages it learns the shape of the land, and bends its course toward the bottom instead of going straight downhill. It also tests every stride before it trusts it. This is L-BFGS, a quasi-Newton method.',
    math: 'x<sub>k+1</sub> = x<sub>k</sub> + t·d,  d = −H∇J',
    draw: function (g, p) { base(g, Wc); g.flag(x0, 1); star(g, T, 1); var up = seg(p, 0.1, 0.9) * 2, q = walkTo(g, wc2, up, C.blue, 3); g.hero(q, 'lb', 1, 'the Cartographer'); } });
  out = out.concat(pick(Wc, 'lb', 2, ['journal', 'page', 'read', 'tests', 'newpage'], CH.lb));
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
  out.push({ id: 'twins', chapter: CH.tw, title: 'The Twins', layout: 'map', view: wallView, dur: 4.4,
    text: 'ADMM temporarily makes two copies of one final decision. The Wanderer x handles the land cost; the Warden z handles the law; and the scaled dual variable u keeps the running sum of their signed gaps. Day by day the rope and ledger restore agreement. This is the alternating direction method of multipliers.',
    math: 'one final decision, two temporary copies:  x for the cost,  z ∈ C for the law',
    draw: function (g, p) {
      base(g, Ww); star(g, Tw, 1); var up = seg(p, 0.1, 0.9) * 5;
      var qx = walkTo(g, wtw, up, '#e6e9ee', 2.5, 'x'), qz = walkTo(g, wtw, up, C.blue, 2.5, 'z');
      g.hero(qx, 'tw', 1, 'the Wanderer'); g.dot(qz, 7, C.blue, 1); g.label(qz, 'the Warden', C.blue, { dx: 10, dy: 14 });
    } });
  out = out.concat(pick(Ww, 'tw', 3, ['aim', 'rope', 'wander', 'warden', 'ledger', 'again'], CH.tw));
  var Dw = Math.max(dPg, dLb, dTw) + 1;
  out.push({ id: 'race2', chapter: CH.tw, title: 'Three heroes at the wall', layout: 'map+side', view: [0.0, 1.6, -0.2, 1.4], dur: 6,
    text: 'At the wall the Cartographer is within 0.001 of the treasure on day ' + dLb + ', the Twins’ Warden on day ' + dTw + ' and the Pilgrim on day ' + dPg + '. At the Twins’ settled endpoint, both tests are small: the primal residual is ' + num(primalEnd, 5) + ' and the dual residual is ' + num(dualEnd, 5) + '. The ledger is the scaled dual variable u = ' + pair(uEnd) + '; there it approaches −∇J(x*)/ρ = ' + pair(uTheory) + '.',
    math: 'days to within 0.001:  Cartographer ' + at(0.25, String(dLb)) + ',  Twins ' + at(0.42, String(dTw)) + ',  Pilgrim ' + at(0.58, String(dPg)) + '<br>' + at(0.72, 'primal residual ' + num(primalEnd, 5) + ';  dual residual ' + num(dualEnd, 5)) + '<br>' + at(0.88, 'scaled dual u → −∇J(x*)/ρ = ' + pair(uTheory)),
    draw: function (g, p) {
      base(g, Ww); star(g, Tw, 1); var up = seg(p, 0, 0.95) * Dw;
      var a = walkTo(g, wpw, up, C.orange, 2), b = walkTo(g, wlw, up, C.blue, 2.5), z = walkTo(g, wtw, up, '#9ec5f3', 2, 'z');
      g.hero(a, 'pg', 1); g.hero(b, 'lb', 1); g.dot(z, 6, '#6aa2e3', 1);
      chart(g, g.sideR, [series(Ww, 'pg', Dw, 'x', dPg), series(Ww, 'lb', Dw, 'x', dLb), series(Ww, 'tw', Dw, 'z', dTw, 'Twins')], up);
    } });

  // 6. the old fort
  var fT = Wf.T, fw = Wf.walks, fDays = {}; ['pg', 'lb', 'tw'].forEach(function (h) { fDays[h] = E.settled(fw[h], h === 'tw' ? 'z' : 'x', 1e-3 * 2.4); });
  function word(q) { return '(' + (q[0] >= 0 ? '+' : '−') + ', ' + (q[1] >= 0 ? '+' : '−') + ')'; }
  out.push({ id: 'fort', chapter: CH.fort, title: 'Two sentries and a law', layout: 'map', view: [-1.3, 1.3, -1.3, 1.3], dur: 5,
    text: 'Not every land is a valley. The old fort is the smallest coding example in this tale: two coded bits, one parity check and a known channel. A spot is a pair of cards held by two sentries, each between −1 and +1. The lanterns hint at what each sentry saw, the flags pull every card toward +1 or −1, and the tower’s law says the two flags must agree. Each card is a bit not yet decided, the lanterns are what was received, and the law is the one parity check.',
    math: 'J(x) = lanterns + flags + law;  the true order ' + word(fT),
    draw: function (g, p) {
      base(g, Wf, { alpha: seg(p, 0, 0.4) });
      g.path([[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]], 'rgba(255,210,122,0.6)', 1.5, seg(p, 0.2, 0.5), [6, 4]);
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (q, i) { var ok = q[0] * q[1] === Wf.land.lawSign; g.dot(q, 5, ok ? C.blue : C.orange, seg(p, 0.4 + 0.08 * i, 0.5 + 0.08 * i)); g.label(q, word(q) + (ok ? ' lawful' : ' broken'), ok ? C.blue : C.orange, { dx: q[0] > 0 ? 9 : -9, dy: q[1] > 0 ? -13 : 14, align: q[0] > 0 ? 'left' : 'right', p: seg(p, 0.45 + 0.08 * i, 0.6 + 0.08 * i), size: 12 }); });
      star(g, fT, seg(p, 0.8, 1), 'the true order');
    } });
  var Df = Math.min(60, Math.max(fDays.pg, fDays.lb, fDays.tw) + 1);
  out.push({ id: 'fortwalks', chapter: CH.fort, title: 'Who reaches the true order?', layout: 'map', view: [-1.3, 1.3, -1.3, 1.3], dur: 6,
    text: 'All three heroes start from what the lanterns suggest and all three reach the true order ' + word(fT) + '. They settle on day ' + fDays.lb + ' (the Cartographer), ' + fDays.tw + ' (the Twins) and ' + fDays.pg + ' (the Pilgrim). Here the law is part of the height for the Pilgrim and the Cartographer, while the Twins hand it to the Warden, who walks only on the lawful line.',
    math: 'settled on day:  Cartographer ' + fDays.lb + ',  Twins ' + fDays.tw + ',  Pilgrim ' + fDays.pg,
    draw: function (g, p) {
      base(g, Wf); star(g, fT, 1); var up = seg(p, 0, 0.95) * Df;
      var a = walkTo(g, fw.pg, up, C.orange, 2), b = walkTo(g, fw.lb, up, C.blue, 2.5), z = walkTo(g, fw.tw, up, '#9ec5f3', 2, 'z');
      g.hero(a, 'pg', 1); g.hero(b, 'lb', 1); g.dot(z, 6, '#6aa2e3', 1); g.labelPx(g.mapR[0] + 12, g.mapR[1] + 30, 'day ' + Math.floor(up), C.gold, { size: 14 });
    } });

  // The fort is an analogy for one parity check. These pages state exactly what full CAJODE adds, and keep
  // acceptance of a decoded word separate from convergence of its continuous optimisation variables.
  out.push({ id: 'cajode-copies', chapter: CH.cajode, title: 'One tower becomes many checks', layout: 'side', dur: 4.8,
    text: 'A real LDPC code has many overlapping parity checks. CAJODE keeps one shared variable bᵢ ∈ [0, 1] for each coded bit. Every check keeps its own replica variables zₐ, constrained to that check’s parity polytope. Every occurrence of a bit in a check has its own scaled dual variable uₐ,ᵢ: its ledger entry for signed disagreement. The two-bit fort is only an analogy for one of those checks.',
    math: 'shared variable bᵢ ↔ check replica zₐ,ᵢ;  ledger entry uₐ,ᵢ',
    draw: function (g, p) {
      var R = g.sideR, c = g.ctx, x = R[0] + R[2] * 0.28, xr = R[0] + R[2] * 0.72, ys = [R[1] + R[3] * 0.27, R[1] + R[3] * 0.50, R[1] + R[3] * 0.73];
      g.panel(R, 'Shared variables and check replicas');
      g.labelPx(x, R[1] + 50, 'shared coded bit bᵢ', C.gold, { align: 'center', plain: true, p: seg(p, 0.05, 0.25) });
      ys.forEach(function (y, i) {
        var q = seg(p, 0.2 + 0.14 * i, 0.42 + 0.14 * i); if (!(q > 0)) return;
        c.globalAlpha = q; c.strokeStyle = C.violet; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 12, R[1] + R[3] * 0.48); c.lineTo(xr - 38, y); c.stroke(); c.globalAlpha = 1;
        g.labelPx(xr, y, 'check ' + (i + 1) + ': zₐ,ᵢ   uₐ,ᵢ', i === 1 ? C.blue : C.ink, { align: 'center', plain: true, p: q });
      });
      g.labelPx(xr, R[1] + R[3] - 28, 'each zₐ stays in its parity polytope', C.dim, { align: 'center', plain: true, p: seg(p, 0.72, 0.9), size: 12.5 });
    } });
  out.push({ id: 'cajode-circuit', chapter: CH.cajode, title: 'One full CAJODE circuit', layout: 'side', dur: 5.6,
    text: 'At the old fort, the lantern readings are fixed because the channel is known. Full CAJODE also updates the channel. One circuit computes one weight for each received sample, updates all shared bit values, recomputes those weights, updates the channel coefficients, projects each check’s replica variables onto its parity polytope, and then updates every scaled dual variable.',
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
    ['lb', 'The Cartographer · L-BFGS', 'Keeps m pages of memory, learns the land’s shape and tests each stride. Fastest on smooth land; haze can stall it.'],
    ['tw', 'The Twins · ADMM', 'Give two copies different jobs, then use the rope and scaled dual variable to restore agreement. Stop when both residuals are small.']];
  out.push({ id: 'summary', chapter: CH.end, title: 'Three ways down', layout: 'side', dur: 5,
    text: cards.map(function (cd) { return '<b>' + cd[1] + '.</b> ' + cd[2]; }).join('<br><br>'),
    math: 'canyon: Pilgrim ' + pgDays + ' days, Cartographer ' + lbDays + ';  wall: Cartographer ' + dLb + ', Twins ' + dTw + ', Pilgrim ' + dPg,
    draw: function (g, p) {
      var R = g.sideR, wd = (R[2] - 16) / 3;
      cards.forEach(function (cd, i) {
        var q = seg(p, 0.1 + 0.25 * i, 0.4 + 0.25 * i); if (!(q > 0)) return;
        var Rr = [R[0] + i * (wd + 8), R[1], wd, R[3]], keep = g.mapR; g.mapR = [Rr[0] + 4, Rr[1] + 34, Rr[2] - 8, Rr[3] - 40];
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
})();
