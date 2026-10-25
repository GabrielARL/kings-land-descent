// The drawing parts of the tutorial "The Coach and the Physio" (plan_course.js): the map of plans (days across,
// load up), the two specialists, the allowed polygon and its rules, the tether, the planning log, and the side panels:
// the readiness curve, the Coach's scan, the two gauges, and the season's calendar.  The kit g comes from board.js.
var PlanParts = (function () {
  'use strict';
  var B = window.Board; if (!B) return null;
  var H = B.H, C = H.C, seg = H.seg, num = H.num, clamp = H.clamp, mix = H.mix, backOut = H.backOut, nice = H.nice, sub = H.sub, add = H.add, scale = H.scale, len = H.len;
  var TAU = 2 * Math.PI, COACH = '#e6e9ee', PHYSIO = C.blue, LOG = C.orange, AIM = C.violet, SAFE = 'rgba(169,205,246,0.10)';
  function places(step) { return clamp(Math.ceil(-Math.log(step) / Math.LN10 - 1e-9), 0, 7); }
  function rrect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function subscript(n) { var d = '₀₁₂₃₄₅₆₇₈₉'; return String(n).split('').map(function (q) { return d.charAt(Number(q)); }).join(''); }

  // ------------------------------------------------------------ the map of plans
  function axes(g, xl, yl) {
    var c = g.ctx, R = g.mapR, v = g.vis, step = nice((v[1] - v[0]) / 5), d = places(step);
    c.font = '600 12px ' + g.sans; var titleW = c.measureText(xl).width;
    c.font = '11px ' + g.mono; c.fillStyle = C.dim; c.strokeStyle = C.faint; c.lineWidth = 1; c.textAlign = 'center'; c.textBaseline = 'bottom';
    for (var t = Math.ceil(v[0] / step) * step; t <= v[1]; t += step) { var a = g.P([t, v[2]]); if (a[0] < R[0] + 18 || a[0] > R[0] + R[2] - titleW - 20) continue; c.beginPath(); c.moveTo(a[0], R[1] + R[3]); c.lineTo(a[0], R[1] + R[3] - 5); c.stroke(); c.fillText(num(t, d), a[0], R[1] + R[3] - 6); }
    c.textAlign = 'left'; c.textBaseline = 'middle';
    for (t = Math.ceil(v[2] / step) * step; t <= v[3]; t += step) { var b = g.P([v[0], t]); if (b[1] < R[1] + 22 || b[1] > R[1] + R[3] - 30) continue; c.beginPath(); c.moveTo(R[0], b[1]); c.lineTo(R[0] + 5, b[1]); c.stroke(); c.fillText(num(t, d), R[0] + 7, b[1]); }
    c.font = '600 12px ' + g.sans; c.fillStyle = C.ink; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(xl, R[0] + R[2] - 6, R[1] + R[3] - 4);
    c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(yl, R[0] + 6, R[1] + 5);
  }
  // a person on the map: a disc with a letter (the Coach a pale C, the Physio a blue P); o: { dx, dy, align, size }
  function figure(g, q, col, letter, p, label, o) {
    if (!(p > 0)) return; o = o || {}; var c = g.ctx, a = g.P(q), r = (o.r || 9) * backOut(p), R = g.mapR;
    g.clip(R);
    c.beginPath(); c.arc(a[0], a[1], r + 3, 0, TAU); c.fillStyle = 'rgba(8,12,18,0.85)'; c.fill();
    c.beginPath(); c.arc(a[0], a[1], r, 0, TAU); c.fillStyle = col; c.fill();
    if (p > 0.6) { c.fillStyle = '#1b1406'; c.font = '700 11px ' + g.sans; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(letter, a[0], a[1] + 0.5); }
    c.restore();
    if (label) g.labelPx(a[0] + (o.dx == null ? 14 : o.dx), a[1] + (o.dy == null ? -12 : o.dy), label, col, { p: seg(p, 0.5, 1), align: o.align || 'left', size: o.size || 12.5 });
  }
  function coach(g, q, p, label, o) { figure(g, q, COACH, 'C', p, label, o); }
  function physio(g, q, p, label, o) { figure(g, q, PHYSIO, 'P', p, label, o); }
  // the best allowed session: a gold star
  function star(g, q, p, text, o) {
    if (!(p > 0)) return; o = o || {}; var c = g.ctx, a = g.P(q), r = 10 * backOut(p);
    g.clip(g.mapR); c.beginPath(); for (var i = 0; i < 10; i++) { var an = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(a[0] + rr * Math.cos(an), a[1] + rr * Math.sin(an)); }
    c.closePath(); c.fillStyle = C.gold; c.fill(); c.strokeStyle = '#8a4b00'; c.lineWidth = 1.2; c.stroke(); c.restore();
    if (text) g.label(q, text, C.gold, { dx: o.dx == null ? 14 : o.dx, dy: o.dy == null ? 14 : o.dy, align: o.align, p: seg(p, 0.4, 1), size: 12 });
  }
  // the tether, drawn as a spring between two plans
  function spring(g, a, b, p, col) {
    if (!(p > 0)) return; var c = g.ctx, A = g.P(a), B2 = g.P(b), dx = B2[0] - A[0], dy = B2[1] - A[1], L = Math.hypot(dx, dy); if (L < 3) return;
    var ux = dx / L, uy = dy / L, n = 9, amp = Math.min(6, L / 30), end = Math.min(14, 0.15 * L), span = L - 2 * end;
    g.clip(g.mapR); c.globalAlpha = clamp(p, 0, 1); c.strokeStyle = col || C.orange; c.lineWidth = 2; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(A[0] + ux * end, A[1] + uy * end);
    for (var i = 1; i < 2 * n; i++) { var t = end + span * i / (2 * n), s = i % 2 ? amp : -amp; c.lineTo(A[0] + ux * t - uy * s, A[1] + uy * t + ux * s); }
    c.lineTo(B2[0] - ux * end, B2[1] - uy * end); c.lineTo(B2[0], B2[1]); c.stroke(); c.globalAlpha = 1; c.restore();
  }
  // the mark of a nearest point: a right angle at the foot, between the rule's line and the leash to the point
  function rightAngle(g, foot, from, p) { var d = sub(from, foot), l = len(d); if (l < 1e-9 || !(p > 0)) return; var n = scale(d, 1 / l); g.square(foot, [-n[1], n[0]], n, 10, PHYSIO, p); }
  // the allowed set: the polygon of all the rules, filled faintly and outlined in the Physio's blue
  function polygon(g, verts, o) {
    o = o || {}; var p = o.p == null ? 1 : o.p; if (!(p > 0) || verts.length < 3) return; var c = g.ctx, P = verts.map(g.P, g);
    g.clip(g.mapR); c.globalAlpha = clamp(p, 0, 1);
    c.beginPath(); P.forEach(function (a, i) { if (i) c.lineTo(a[0], a[1]); else c.moveTo(a[0], a[1]); }); c.closePath();
    if (o.fill !== false) { c.fillStyle = o.fill || SAFE; c.fill(); }
    c.strokeStyle = o.col || PHYSIO; c.lineWidth = o.lw || 2; if (o.dash) c.setLineDash(o.dash); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; c.restore();
  }
  // the line of one rule, a.q = b, across the visible map, drawn as far as progress p; o: { col, dash, label, at (0..1 along
  // the line), dx, dy, align, labelP }.  The forbidden side gets short hatch marks.
  function ruleLine(g, rule, p, o) {
    if (!(p > 0)) return; o = o || {}; var v = g.vis, a = rule.a, b = rule.b, pts = [];
    function push(q) { if (q[0] >= v[0] - 1e-9 && q[0] <= v[1] + 1e-9 && q[1] >= v[2] - 1e-9 && q[1] <= v[3] + 1e-9) pts.push(q); }
    if (Math.abs(a[1]) > 1e-12) { push([v[0], (b - a[0] * v[0]) / a[1]]); push([v[1], (b - a[0] * v[1]) / a[1]]); }
    if (Math.abs(a[0]) > 1e-12) { push([(b - a[1] * v[2]) / a[0], v[2]]); push([(b - a[1] * v[3]) / a[0], v[3]]); }
    if (pts.length < 2) return; var A = pts[0], Bq = pts[pts.length - 1]; for (var i = 1; i < pts.length; i++) if (len(sub(pts[i], A)) > len(sub(Bq, A))) Bq = pts[i];
    if (A[0] > Bq[0]) { var tmp = A; A = Bq; Bq = tmp; }
    g.line(A, Bq, o.col || PHYSIO, o.lw || 2, p, o.dash);
    // hatches on the forbidden side (where a.q > b)
    var c = g.ctx, PA = g.P(A), PB = g.P(Bq), L = Math.hypot(PB[0] - PA[0], PB[1] - PA[1]), ux = (PB[0] - PA[0]) / L, uy = (PB[1] - PA[1]) / L;
    var nrm = [a[0], -a[1]], nl = Math.hypot(nrm[0], nrm[1]); nrm = [nrm[0] / nl, nrm[1] / nl];   // the forbidden side in canvas pixels (y down)
    g.clip(g.mapR); c.globalAlpha = 0.55 * clamp(p, 0, 1); c.strokeStyle = o.col || PHYSIO; c.lineWidth = 1;
    c.beginPath(); for (var s = 10; s < L * clamp(p, 0, 1); s += 12) { var x = PA[0] + ux * s, y = PA[1] + uy * s; c.moveTo(x, y); c.lineTo(x + nrm[0] * 7, y + nrm[1] * 7); } c.stroke(); c.globalAlpha = 1; c.restore();
    if (o.label) { var at = o.at == null ? 0.5 : o.at, q = [A[0] + (Bq[0] - A[0]) * at, A[1] + (Bq[1] - A[1]) * at]; g.label(q, o.label, o.col || PHYSIO, { dx: o.dx || 0, dy: o.dy == null ? -14 : o.dy, align: o.align || 'center', p: o.labelP == null ? seg(p, 0.6, 1) : o.labelP, size: 12 }); }
  }

  // ------------------------------------------------------------ panels
  function lines(g, R, items, p, title, o) {
    o = o || {}; var n = items.length, top = R[1] + (title ? 44 : 16), rowH = Math.min(o.rowH || 34, (R[3] - (top - R[1]) - 8) / n);
    g.panel(R, title);
    items.forEach(function (it, i) { var q = it.p != null ? it.p : seg(p, i / (n + 0.4), (i + 1) / (n + 0.4)); if (!(q > 0)) return; g.labelPx(R[0] + 14 + (it.indent || 0), top + rowH * i + rowH / 2, it.text, it.col || C.ink, { size: it.size || 12.5, plain: true, mono: !!it.mono, p: q }); });
  }
  function table(g, R, rows, p, title, o) {
    o = o || {}; var n = rows.length + (o.head ? 1 : 0), top = R[1] + 40, rowH = Math.min(40, (R[3] - 50) / n), mid = R[0] + 12 + Math.min(o.leftW || 230, R[2] * 0.42);
    g.panel(R, title); var all = (o.head ? [o.head] : []).concat(rows);
    all.forEach(function (r, i) {
      var q = seg(p, i / (n + 0.5), (i + 1) / (n + 0.5)); if (!(q > 0)) return; var y = top + rowH * i + rowH / 2, head = o.head && i === 0;
      g.labelPx(R[0] + 12, y, r[0], head ? C.dim : (o.leftCol || C.gold), { size: head ? 11.5 : 12.5, plain: true, p: q });
      g.labelPx(mid, y, r[1], head ? C.dim : (o.rightCol || C.ink), { size: head ? 11.5 : 12.5, plain: true, p: q, mono: !!o.mono });
      if (head) { var c = g.ctx; c.strokeStyle = C.faint; c.beginPath(); c.moveTo(R[0] + 10, y + rowH / 2 - 4); c.lineTo(R[0] + R[2] - 10, y + rowH / 2 - 4); c.stroke(); }
    });
  }
  function split(R, share, gap) {
    gap = gap || 8;
    if (R[2] >= R[3] * 1.25 && R[2] >= 600) { var w = Math.round((R[2] - gap) * share); return [[R[0], R[1], w, R[3]], [R[0] + w + gap, R[1], R[2] - w - gap, R[3]]]; }
    var h = Math.round((R[3] - gap) * share); return [[R[0], R[1], R[2], h], [R[0], R[1] + h + gap, R[2], R[3] - h - gap]];
  }
  // The readiness curve r(t) over days, with the rested baseline and the Coach's zero-worth line; o: { r, rOld, t: [t0, t1],
  // v: [lo, hi], p, title, r0, sessions: [{t, w}], marks: [{t, text, col, side}], old (label for rOld), short }.
  function curvePanel(g, R, o) {
    var p = o.p == null ? 1 : o.p, pl = g.plot(R, o.t, o.v, { title: o.title }), short = pl.box[3] < 200;
    pl.frame(o.xLabel || (short ? 'days' : 'day on the calendar'), 'readiness');
    pl.seg(o.t[0], 1, o.t[1], 1, 'rgba(242,245,248,0.45)', 1.2, seg(p, 0, 0.2), [5, 4]); g.labelPx(pl.X(o.baseAt == null ? o.t[1] : o.baseAt) - 4, pl.Y(1) + (o.baseBelow ? 12 : -11), 'rested baseline 1', C.dim, { align: 'right', size: 11, plain: true, p: seg(p, 0.05, 0.2) });
    if (o.r0 != null) { pl.seg(o.t[0], o.r0, o.t[1], o.r0, C.red, 1.2, seg(p, 0, 0.2), [3, 4]); g.labelPx(pl.X(o.t[1]) - 4, pl.Y(o.r0) - 12, 'below ' + num(o.r0, 1) + ': negative linear gain', C.red, { align: 'right', size: 11, plain: true, p: seg(p, 0.05, 0.2) }); }
    // the target: the dunk line, labelled at its right end (below the line when o.targetBelow); the game: a red day line
    if (o.target != null) { pl.seg(o.t[0], o.target, o.t[1], o.target, C.orange, 1.4, seg(p, 0, 0.2), [6, 4]); g.labelPx(pl.X(o.targetAt == null ? o.t[1] : o.targetAt) - 4, pl.Y(o.target) + (o.targetBelow ? 12 : -11), 'a dunk: ' + num(o.target, 1), C.orange, { align: 'right', size: 11, plain: true, p: seg(p, 0.05, 0.2) }); }
    if (o.game != null && o.game <= o.t[1]) { pl.seg(o.game, o.v[0], o.game, o.v[1], C.red, 1.5, seg(p, 0, 0.2)); g.labelPx(pl.X(o.game) - 5, pl.box[1] + pl.box[3] - 12, 'game, day ' + o.game, C.red, { align: 'right', size: 11, plain: true, p: seg(p, 0.05, 0.2) }); }
    (o.sessions || []).forEach(function (s, i) { var q = seg(p, 0.1 + 0.1 * i, 0.2 + 0.1 * i); if (!(q > 0)) return; pl.seg(s.t, o.v[0], s.t, o.v[0] + (o.v[1] - o.v[0]) * 0.18 * s.w / 5, s.col || C.gold, 6, q); if (s.text && !short) g.labelPx(pl.X(s.t) + 8, pl.Y(o.v[0] + (o.v[1] - o.v[0]) * 0.09 * s.w / 5), s.text, s.col || C.gold, { size: 11, plain: true, p: q }); });
    if (o.rOld) { pl.curve(o.rOld, 'rgba(242,245,248,0.35)', 1.8, seg(p, 0.1, 0.3)); if (o.old) g.labelPx(pl.X(o.oldAt || o.t[1]) - 4, pl.Y(o.rOld(o.oldAt || o.t[1])) - 12, o.old, C.dim, { align: 'right', size: 11, plain: true, p: seg(p, 0.2, 0.35) }); }
    pl.curve(o.r, o.col || C.gold, 2.4, seg(p, o.from == null ? 0.2 : o.from, o.to == null ? 0.75 : o.to));
    (o.marks || []).forEach(function (m) {
      var q = m.p != null ? m.p : seg(p, m.at == null ? 0.75 : m.at, (m.at == null ? 0.75 : m.at) + 0.12);
      if (short) {   // a short plot (a phone): below the point, and to its right when the left would run into the axis
        pl.point(m.t, o.r(m.t), m.col || C.gold, '', q); g.ctx.font = '600 11.5px ' + g.sans; var toRight = pl.X(m.t) - 10 - g.ctx.measureText(m.text).width < pl.box[0] + 2;
        g.labelPx(pl.X(m.t) + (toRight ? 10 : -10), pl.Y(o.r(m.t)) + 18, m.text, m.col || C.gold, { align: toRight ? 'left' : 'right', size: 11.5, p: seg(q, 0.4, 1) });
      }
      else pl.point(m.t, o.r(m.t), m.col || C.gold, m.text, q, m.side);
    });
    return pl;
  }
  // The Coach's scan: its cost along the days, each day with its best load; o: { along, t: [t0, t1], p, title, scan
  // (progress of the sweep, 0..1), best: [t, value], label }.
  function scanPanel(g, R, o) {
    var vals = [], n = 120, i; for (i = 0; i <= n; i++) vals.push(o.along(o.t[0] + (o.t[1] - o.t[0]) * i / n));
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = 0.1 * (hi - lo) || 1, pl = g.plot(R, o.t, [lo - pad, hi + pad], { title: o.title }), short = pl.box[3] < 130;
    pl.frame(short ? 'day' : 'the day of the session', 'cost + tether');
    var sweep = o.scan == null ? 1 : clamp(o.scan, 0, 1);
    pl.curve(o.along, COACH, 2.2, sweep);
    if (sweep > 0 && sweep < 1) { var ts = o.t[0] + (o.t[1] - o.t[0]) * sweep; pl.seg(ts, lo - pad, ts, hi + pad, C.gold, 1.2, 1, [4, 3]); }
    if (o.best && o.bestP > 0) pl.point(o.best[0], o.best[1], C.gold, o.label, o.bestP, o.best[0] > (o.t[0] + o.t[1]) / 2 ? 'left' : 'right');
    return pl;
  }
  // The two gauges round by round on a log scale: the gap |x − z| and rho times the Physio's move.
  function gaugePanel(g, R, rounds, p, o) {
    o = o || {}; var n = rounds.length - 1, prim = rounds.map(function (r) { return r.primal; }), dual = rounds.map(function (r) { return r.dual == null ? prim[0] : r.dual; });
    var lo = -3.2, hi = Math.log(Math.max(Math.max.apply(null, prim.concat(dual)) * 1.5, 1e-2)) / Math.LN10, pl = g.plot(R, [0, n], [lo, hi], { title: o.title || 'the two gauges, round by round (log scale)' });
    pl.frame(o.xl || 'round', 'log₁₀');
    function lg(a) { return function (t) { var i = Math.floor(t), fq = t - i; return Math.max(lo, Math.log(Math.max(a[Math.min(i, n)] * (1 - fq) + a[Math.min(i + 1, n)] * fq, 1e-9)) / Math.LN10); }; }
    var s = o.upto == null ? 1 : clamp(o.upto, 0, 1);
    if (o.tol) { pl.seg(0, Math.log(o.tol) / Math.LN10, n, Math.log(o.tol) / Math.LN10, C.dim, 1.2, 1, [4, 4]); g.labelPx(pl.X(n) - 4, pl.Y(Math.log(o.tol) / Math.LN10) - 11, 'small enough: ' + num(o.tol, 2), C.dim, { align: 'right', size: 11, plain: true }); }
    pl.curve(lg(prim), AIM, 2.2, s); pl.curve(lg(dual), PHYSIO, 2.2, s);
    g.labelPx(pl.box[0] + pl.box[2] - 6, pl.box[1] + 12, 'gap |x − z|: do they agree?', AIM, { size: 11.5, plain: true, align: 'right', p: seg(p, 0.1, 0.3) });
    g.labelPx(pl.box[0] + pl.box[2] - 6, pl.box[1] + 30, 'ρ × Physio’s move: has it settled?', PHYSIO, { size: 11.5, plain: true, align: 'right', p: seg(p, 0.2, 0.4) });
    return pl;
  }
  // The season on a calendar: days across, sessions as bars with their loads, the taper band and the race flag;
  // o: { race, taper, sessions: [{t, w, text, col}], p, title, planned (index from which sessions are 'next') }.
  function calendar(g, R, o) {
    var p = o.p == null ? 1 : o.p, pl = g.plot(R, [0, o.race + 0.5], [0, 7], { title: o.title }), c = g.ctx;
    pl.frame('day', 'load');
    var tq = seg(p, 0.55, 0.7); if (tq > 0) { c.globalAlpha = 0.18 * tq; c.fillStyle = PHYSIO; c.fillRect(pl.X(o.race - o.taper), pl.box[1], pl.X(o.race) - pl.X(o.race - o.taper), pl.box[3]); c.globalAlpha = 1; g.labelPx((pl.X(o.race - o.taper) + pl.X(o.race)) / 2, pl.box[1] + 14, 'taper', PHYSIO, { align: 'center', size: 11.5, plain: true, p: tq }); }
    var rq = seg(p, 0.7, 0.85); if (rq > 0) { pl.seg(o.race, 0, o.race, 6.5, C.red, 2, rq); g.labelPx(pl.X(o.race) - 6, pl.box[1] + pl.box[3] - 30, 'game, day ' + o.race, C.red, { align: 'right', size: 11.5, plain: true, p: rq }); }   // the game label sits low, clear of the taper and session labels
    var prevRight = -Infinity;   // a label that would run into the previous session's label is lifted above it
    o.sessions.forEach(function (s, i) {
      var q = seg(p, 0.05 + 0.16 * i, 0.2 + 0.16 * i); if (!(q > 0)) return; var x = pl.X(s.t), y0 = pl.Y(0), y1 = pl.Y(s.w * q), w = 9;
      c.globalAlpha = 0.9; c.fillStyle = s.col || C.gold; c.fillRect(x - w / 2, y1, w, y0 - y1); c.globalAlpha = 1;
      if (s.text) { c.font = '600 11.5px ' + g.sans; var tw = c.measureText(s.text).width, lift = x - tw / 2 < prevRight + 6 ? 18 : 0; g.labelPx(x, y1 - 12 - lift, s.text, s.col || C.gold, { align: 'center', size: 11.5, plain: true, p: seg(q, 0.6, 1) }); prevRight = lift ? prevRight : x + tw / 2; }
    });
    return pl;
  }
  // The two effects of one hard session over the days after it: fitness (small, slow to fade) above zero and fatigue
  // (large, quick to fade) below; o: { fit(t), fat(t) (its size, positive), fitAmp, fatAmp, t: [t0, t1], p, title }.
  function effectsPanel(g, R, o) {
    var p = o.p == null ? 1 : o.p, pl = g.plot(R, o.t, [-o.fatAmp * 1.15, o.fitAmp * 1.3], { title: o.title }), short = pl.box[3] < 130;
    pl.frame(short ? 'days' : 'days after the hard session', 'effect');
    pl.seg(o.t[0], 0, o.t[1], 0, 'rgba(242,245,248,0.45)', 1.2, seg(p, 0, 0.15), [5, 4]);
    pl.curve(o.fit, C.green, 2.4, seg(p, 0.05, 0.35));
    pl.curve(function (t) { return -o.fat(t); }, C.red, 2.4, seg(p, 0.3, 0.6));
    var tf = o.t[0] + (o.t[1] - o.t[0]) * 0.42;
    g.labelPx(pl.X(tf), pl.Y(o.fit(tf)) - 14, 'fitness: +' + num(o.fitAmp, 1) + ' at first, lasts', C.green, { size: 12, plain: true, p: seg(p, 0.25, 0.4) });
    var ta = o.t[0] + (o.t[1] - o.t[0]) * 0.14;
    g.labelPx(pl.X(ta) + 8, pl.Y(-o.fat(ta)) + 16, 'fatigue: −' + num(o.fatAmp, 1) + ' at first, fades fast', C.red, { size: 12, plain: true, p: seg(p, 0.5, 0.65) });
    return pl;
  }
  // What one session gains and what it costs as its load grows, on one day: the gain is a straight line, the price of
  // doing too much at once a parabola, and the benefit is the gap between them; o: { worth (gain per unit of load), a,
  // wMax, p, title, example (a load), best (the load with the largest gap) }.
  function gainPricePanel(g, R, o) {
    var p = o.p == null ? 1 : o.p, wm = o.wMax, gain = function (w) { return o.worth * w; }, price = function (w) { return o.a * w * w; };
    var top = Math.max(gain(wm), price(wm)) * 1.06, pl = g.plot(R, [0, wm], [0, top], { title: o.title }), c = g.ctx, short = pl.box[3] < 130;
    pl.frame(short ? 'load' : 'load of the session', '');
    pl.curve(gain, C.green, 2.4, seg(p, 0.05, 0.3)); pl.curve(price, C.red, 2.4, seg(p, 0.2, 0.45));
    var wl = wm * 0.62, wp = wm * 0.7;
    g.labelPx(pl.X(wl) - 8, pl.Y(gain(wl)) - 12, 'gain = ' + num(o.worth, 3) + ' × load', C.green, { size: 12, plain: true, align: 'right', p: seg(p, 0.2, 0.35) });
    g.labelPx(pl.X(wp) + 10, pl.Y(price(wp)) + 16, 'price = ' + num(o.a, 2) + ' × load²', C.red, { size: 12, plain: true, p: seg(p, 0.35, 0.5) });
    if (pl.box[3] > 260) g.labelPx(pl.box[0] + pl.box[2] - 4, pl.box[1] + pl.box[3] - 26, 'gold bars: benefit = gain − price', C.gold, { size: 12, plain: true, align: 'right', p: seg(p, 0.5, 0.65) });
    function gap(w, text, side, q) {
      if (!(q > 0)) return; var x = pl.X(w), y0 = pl.Y(price(w)), y1 = pl.Y(gain(w));
      c.globalAlpha = clamp(q, 0, 1); c.strokeStyle = C.gold; c.lineWidth = 2.6; c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke();
      c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 5, y0); c.lineTo(x + 5, y0); c.moveTo(x - 5, y1); c.lineTo(x + 5, y1); c.stroke(); c.globalAlpha = 1;
      g.labelPx(x + (side < 0 ? -9 : 9), (y0 + y1) / 2, text, C.gold, { size: 12, plain: true, align: side < 0 ? 'right' : 'left', p: q });
    }
    gap(o.example, num(gain(o.example) - price(o.example), 2), 1, seg(p, 0.5, 0.65));
    gap(o.best, num(gain(o.best) - price(o.best), 2), 1, seg(p, 0.68, 0.82));
    g.labelPx(pl.X(o.best), pl.Y(gain(o.best)) - 14, 'largest at load ' + num(o.best, 2), C.gold, { size: 12, plain: true, align: 'right', p: seg(p, 0.75, 0.88) });
    var wz = o.worth / o.a; if (wz < wm) pl.point(wz, gain(wz), C.red, 'gap gone at load ' + num(wz, 1), seg(p, 0.85, 1), 'left');
    return pl;
  }
  // ------------------------------------------------------------ the athlete: the court and the thigh
  // The court: the story's readiness score against its dunk line; o: { h (the score now), rim (the target), rimP,
  // today (the rested baseline, marked with a dashed line), todayP, gapP, question, questionP, title }.
  function courtPanel(g, R, o) {
    var c = g.ctx; g.panel(R, o.title);
    var floor = R[1] + R[3] - 38, unit = (R[3] - 104) / (1.25 + o.rim), fig = 1.1 * unit, xA = R[0] + R[2] * 0.44, xRim = R[0] + R[2] * 0.74, reach = floor - fig;
    function Y(h) { return reach - h * unit; }   // the fingertips at a jump of h
    c.strokeStyle = C.faint; c.lineWidth = 1.5; c.beginPath(); c.moveTo(R[0] + 14, floor); c.lineTo(R[0] + R[2] - 14, floor); c.stroke();
    var xs = R[0] + 36; c.lineWidth = 1; c.beginPath(); c.moveTo(xs, Y(0)); c.lineTo(xs, Y(o.rim + 0.15)); c.stroke();
    c.font = '11px ' + g.mono; c.fillStyle = C.dim; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (var v = 0; v <= o.rim + 0.01; v += 0.5) { c.beginPath(); c.moveTo(xs, Y(v)); c.lineTo(xs + 4, Y(v)); c.stroke(); c.fillText(num(v, 1), xs - 5, Y(v)); }
    g.labelPx(xs - 22, Y(o.rim + 0.15) - 12, 'readiness score', C.dim, { size: 11, plain: true });
    var rimP = o.rimP == null ? 1 : o.rimP;
    if (rimP > 0) {
      c.globalAlpha = clamp(rimP, 0, 1);
      c.strokeStyle = 'rgba(242,245,248,0.8)'; c.lineWidth = 3; c.beginPath(); c.moveTo(xRim + 30, Y(o.rim) - 34); c.lineTo(xRim + 30, Y(o.rim) + 8); c.stroke();   // the backboard
      c.strokeStyle = C.orange; c.lineWidth = 3; c.beginPath(); c.moveTo(xRim - 8, Y(o.rim)); c.lineTo(xRim + 30, Y(o.rim)); c.stroke();   // the rim
      c.strokeStyle = 'rgba(242,245,248,0.55)'; c.lineWidth = 1; c.beginPath();
      for (var k = 0; k < 5; k++) { c.moveTo(xRim - 8 + k * 9.5, Y(o.rim)); c.lineTo(xRim - 2 + k * 6.5, Y(o.rim) + 24); }
      c.moveTo(xRim - 2, Y(o.rim) + 24); c.lineTo(xRim + 24, Y(o.rim) + 24); c.stroke();   // the net
      c.globalAlpha = 1;
      g.labelPx(R[0] + R[2] - 10, Y(o.rim) - 48, 'story dunk line: ' + num(o.rim, 1), C.orange, { size: 12, plain: true, align: 'right', p: rimP, within: R });
    }
    // the athlete: a stick figure with the arms up and the ball in hand, lifted by the jump h
    var h = Math.max(0, o.h || 0), base = floor - h * unit, head = 0.09 * fig, air = h > 0.03, knee = air ? fig * 0.16 : 0;
    c.strokeStyle = C.gold; c.fillStyle = C.gold; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.arc(xA, base - fig + head * 1.1, head, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(xA, base - fig + 2.2 * head); c.lineTo(xA, base - fig * 0.42); c.stroke();
    c.beginPath(); c.moveTo(xA, base - fig * 0.42); c.lineTo(xA - fig * 0.13, base - fig * 0.2 - knee); c.lineTo(xA - fig * 0.1, base - knee * 1.6);
    c.moveTo(xA, base - fig * 0.42); c.lineTo(xA + fig * 0.13, base - fig * 0.2 - knee); c.lineTo(xA + fig * 0.1, base - knee * 1.6); c.stroke();
    c.beginPath(); c.moveTo(xA, base - fig + 2.6 * head); c.lineTo(xA - fig * 0.12, base - fig); c.moveTo(xA, base - fig + 2.6 * head); c.lineTo(xA + fig * 0.12, base - fig); c.stroke();
    c.fillStyle = C.orange; c.beginPath(); c.arc(xA + fig * 0.12, base - fig - 6, 6.5, 0, TAU); c.fill();
    if (o.today != null && o.todayP > 0) {
      c.globalAlpha = clamp(o.todayP, 0, 1); c.strokeStyle = C.gold; c.lineWidth = 1.2; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(xs, Y(o.today)); c.lineTo(xRim + 30, Y(o.today)); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      g.labelPx(xs + 10, Y(o.today) + 12, 'rested baseline: ' + num(o.today, 1), C.gold, { size: 12, plain: true, p: o.todayLabelP == null ? o.todayP : o.todayLabelP });
    }
    if (o.today != null && o.gapP > 0) {
      var xg = xRim - 24; c.globalAlpha = clamp(o.gapP, 0, 1); c.strokeStyle = C.red; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(xg - 5, Y(o.today)); c.lineTo(xg, Y(o.today)); c.lineTo(xg, Y(o.rim)); c.lineTo(xg - 5, Y(o.rim)); c.stroke(); c.globalAlpha = 1;
      g.labelPx(xg - 8, (Y(o.today) + Y(o.rim)) / 2, num(o.rim - o.today, 1) + ' short', C.red, { size: 12, plain: true, align: 'right', p: o.gapP });
    }
    if (o.questionP > 0) g.labelPx(R[0] + R[2] / 2, floor + 19, o.question || 'how many days until the jump reaches the rim?', C.ink, { size: 12.5, align: 'center', p: o.questionP, within: R });
    return { Y: Y, floor: floor, unit: unit };
  }
  // One fibre of the thigh as a striped band, each column a sarcomere; o: { torn (the share of the fibre out of order,
  // 0..1), extra (how much thicker than rested the rebuilt fibre is), crew (clean-up activity, 0..1), build (rebuilding
  // activity, 0..1), time (days; moves the cells), title, note (top right), stat (bottom left), captions: [{ text,
  // col, above, x (0..1 along the fibre), p }] }.  Returns the band's geometry.
  var FIBRE = 'rgb(176,96,106)', FIBRE_BAND = 'rgba(118,52,66,0.85)', FIBRE_LINE = 'rgba(70,20,34,0.8)', NEW = 'rgba(185,240,168,0.55)', NEW_LINE = 'rgba(70,110,60,0.75)', CELL = 'rgba(226,230,238,0.92)';
  function tearOrder(n) {   // the columns in the order they tear, the same every frame: a fixed shuffle of 1..n-2
    var idx = [], i, a = 12345; for (i = 1; i < n - 1; i++) idx.push(i);
    for (i = idx.length - 1; i > 0; i--) { a = (a * 1103515245 + 12345) % 2147483648; var j = a % (i + 1), t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    return idx;
  }
  function fibrePanel(g, R, o) {
    var c = g.ctx; g.panel(R, o.title);
    var xL = R[0] + 16, xR = R[0] + R[2] - 16, cw = 14, n = Math.max(6, Math.floor((xR - xL) / cw)), L = n * cw; xL = Math.round((xL + xR - L) / 2); xR = xL + L;
    var h0 = Math.min(R[3] * 0.15, 28), yc = R[1] + Math.round(R[3] * 0.55), ex = Math.max(0, o.extra || 0) * 2 * h0, order = tearOrder(n), torn = clamp(o.torn || 0, 0, 1) * order.length, tm = o.time || 0, k;
    if (ex > 0.5) {   // the rebuilt layer, each side, with its own stripes
      c.save(); c.beginPath(); rrect(c, xL, yc - h0 - ex, L, 2 * h0 + 2 * ex, h0 + ex); c.clip();
      c.fillStyle = NEW; c.fillRect(xL, yc - h0 - ex, L, 2 * h0 + 2 * ex);
      c.strokeStyle = NEW_LINE; c.lineWidth = 1.2; c.beginPath(); for (k = 0; k <= n; k++) { c.moveTo(xL + k * cw, yc - h0 - ex); c.lineTo(xL + k * cw, yc + h0 + ex); } c.stroke(); c.restore();
    }
    c.save(); c.beginPath(); rrect(c, xL, yc - h0, L, 2 * h0, h0); c.clip();   // the fibre body: pink, a dark Z line between the columns, a darker band in each
    c.fillStyle = FIBRE; c.fillRect(xL, yc - h0, L, 2 * h0);
    c.fillStyle = FIBRE_BAND; for (k = 0; k < n; k++) c.fillRect(xL + k * cw + cw * 0.3, yc - h0, cw * 0.4, 2 * h0);
    c.strokeStyle = FIBRE_LINE; c.lineWidth = 1.5; c.beginPath(); for (k = 0; k <= n; k++) { c.moveTo(xL + k * cw, yc - h0); c.lineTo(xL + k * cw, yc + h0); } c.stroke();
    var tears = [];   // the first `torn` columns of the order are cut through, the last of them only partly
    for (k = 0; k < order.length; k++) {
      var open = clamp(torn - k, 0, 1); if (!(open > 0)) break;
      var x0 = xL + order[k] * cw + cw / 2, wd = 1 + 4 * open; tears.push([x0, open]);
      c.fillStyle = C.bg; c.beginPath();
      c.moveTo(x0 - wd, yc - h0 - 1); c.lineTo(x0 + wd * 0.3, yc - h0 * 0.5); c.lineTo(x0 - wd * 0.6, yc); c.lineTo(x0 + wd * 0.4, yc + h0 * 0.5); c.lineTo(x0 - wd * 0.2, yc + h0 + 1);
      c.lineTo(x0 + wd * 1.2, yc + h0 + 1); c.lineTo(x0 + wd * 1.8, yc + h0 * 0.5); c.lineTo(x0 + wd * 0.8, yc); c.lineTo(x0 + wd * 1.7, yc - h0 * 0.5); c.lineTo(x0 + wd, yc - h0 - 1); c.closePath(); c.fill();
      c.strokeStyle = C.red; c.lineWidth = 1.4; c.globalAlpha = 0.9; c.stroke(); c.globalAlpha = 1;
    }
    c.restore();
    var crew = clamp(o.crew || 0, 0, 1);   // the clean-up cells, grey, drifting in the open tears
    if (crew > 0) tears.forEach(function (tx, i) {
      var a = crew * tx[1]; if (!(a > 0.05)) return; c.globalAlpha = a; c.fillStyle = CELL; c.strokeStyle = 'rgba(40,50,70,0.9)'; c.lineWidth = 1;
      for (var m = 0; m < 2; m++) { var ph = tm * 5 + i * 1.7 + m * 2.1; c.beginPath(); c.arc(tx[0] + 3 * Math.sin(ph) + (m ? 4 : -3), yc + (m ? -0.45 : 0.4) * h0 + 3 * Math.cos(ph * 0.8), 3.4, 0, TAU); c.fill(); c.stroke(); }
      c.globalAlpha = 1;
    });
    var build = clamp(o.build || 0, 0, 1);   // the builders, green, along both edges
    if (build > 0) {
      c.globalAlpha = build; c.fillStyle = C.green; c.strokeStyle = 'rgba(30,60,30,0.9)'; c.lineWidth = 1;
      for (k = 1; k < n - 1; k += 3) { var ph2 = tm * 4 + k, bx = xL + (k + 0.5) * cw + 4 * Math.sin(ph2); c.beginPath(); c.arc(bx, yc - h0 - ex - 4 + 1.5 * Math.cos(ph2), 3.2, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.arc(bx + 6, yc + h0 + ex + 4 - 1.5 * Math.cos(ph2), 3.2, 0, TAU); c.fill(); c.stroke(); }
      c.globalAlpha = 1;
    }
    if (o.note) g.labelPx(R[0] + R[2] - 10, R[1] + 16, o.note, C.gold, { align: 'right', size: 12, plain: true });
    if (o.stat) g.labelPx(R[0] + 10, R[1] + R[3] - 14, o.stat, C.ink, { size: 12, plain: true });
    (o.captions || []).forEach(function (cp) { if (!(cp.p > 0)) return; g.labelPx(xL + L * cp.x, cp.above ? yc - h0 - ex - 22 : yc + h0 + ex + 22, cp.text, cp.col || C.ink, { align: cp.align || 'center', size: 12, p: cp.p, within: R }); });
    return { xL: xL, xR: xR, yc: yc, h0: h0, ex: ex };
  }
  // The model's bookkeeping for one day as a bar: the rested jump 1, plus fitness, minus fatigue, equals readiness;
  // o: { fit, fat, r, top (the scale's top), target, title, rows (false: no table of the four numbers) }.
  function sumBar(g, R, o) {
    var c = g.ctx; g.panel(R, o.title);
    var rowsH = o.rows === false ? 0 : 68, T = R[1] + (o.title ? 34 : 16), B = R[1] + R[3] - 14 - rowsH, top = o.top || 1.8, x = R[0] + Math.round(R[2] * 0.46), bw = Math.min(26, Math.round(R[2] * 0.2));
    function Y(v) { return B - clamp(v, 0, top) / top * (B - T); }
    c.strokeStyle = C.faint; c.lineWidth = 1; c.beginPath(); c.moveTo(x - bw, B); c.lineTo(x + bw * 1.3, B); c.stroke();
    c.font = '11px ' + g.mono; c.fillStyle = C.dim; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (var v = 0; v <= top + 1e-9; v += 0.5) { c.fillText(num(v, 1), x - bw / 2 - 7, Y(v)); c.beginPath(); c.moveTo(x - bw / 2 - 4, Y(v)); c.lineTo(x - bw / 2, Y(v)); c.stroke(); }
    c.setLineDash([4, 4]); c.strokeStyle = 'rgba(242,245,248,0.45)'; c.beginPath(); c.moveTo(x - bw / 2 - 4, Y(1)); c.lineTo(x + bw * 1.2, Y(1)); c.stroke();
    if (o.target != null) { c.strokeStyle = C.orange; c.beginPath(); c.moveTo(x - bw / 2 - 4, Y(o.target)); c.lineTo(x + bw * 1.2, Y(o.target)); c.stroke(); g.labelPx(x + bw * 1.2 + 3, Y(o.target), 'dunk', C.orange, { size: 11, plain: true }); }
    c.setLineDash([]); g.labelPx(x + bw * 1.2 + 3, Y(1), 'rested', C.dim, { size: 11, plain: true });
    var fit = Math.max(0, o.fit || 0), fat = Math.max(0, o.fat || 0), r = o.r, yTop = Y(1 + fit), yR = Y(Math.max(0, r));
    c.fillStyle = 'rgba(242,245,248,0.28)'; c.fillRect(x - bw / 2, Y(1), bw, B - Y(1));   // the rested jump
    c.fillStyle = C.green; c.globalAlpha = 0.85; c.fillRect(x - bw / 2, yTop, bw, Y(1) - yTop); c.globalAlpha = 1;   // plus fitness
    if (yR > yTop + 0.5) {   // minus fatigue: a hatched red block from the top down to r
      c.save(); c.beginPath(); c.rect(x - bw / 2, yTop, bw, yR - yTop); c.clip(); c.fillStyle = 'rgba(255,154,138,0.16)'; c.fillRect(x - bw / 2, yTop, bw, yR - yTop);
      c.strokeStyle = C.red; c.lineWidth = 1.2; c.beginPath(); for (var s = -bw; s < yR - yTop + bw; s += 6) { c.moveTo(x - bw / 2, yTop + s); c.lineTo(x + bw / 2, yTop + s - bw); } c.stroke(); c.restore();
      c.strokeStyle = C.red; c.lineWidth = 1.2; c.strokeRect(x - bw / 2, yTop, bw, yR - yTop);
    }
    c.strokeStyle = C.gold; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - bw / 2 - 5, yR); c.lineTo(x + bw / 2 + 5, yR); c.stroke();   // equals readiness
    if (rowsH) [['rested', '1', C.dim], ['+ fitness', num(fit, 2), C.green], ['− fatigue', num(fat, 2), C.red], ['= readiness', num(r, 2), C.gold]].forEach(function (rw, i) {
      var yy = B + 18 + i * 14; g.labelPx(R[0] + 10, yy, rw[0], rw[2], { size: 11.5, plain: true }); g.labelPx(R[0] + R[2] - 10, yy, rw[1], rw[2], { size: 11.5, plain: true, align: 'right', mono: true });
    });
    return { Y: Y, x: x };
  }
  // The two effects of one session and their sum, written as the days pass; o: { fit(t), fat(t), fitAmp, fatAmp,
  // t: [t0, t1], upto (the day reached so far), title }: fitness above zero in green, fatigue below in red, and
  // fitness minus fatigue, the jump above rested, in gold.
  function tracesPanel(g, R, o) {
    var c = g.ctx, pl = g.plot(R, o.t, [-o.fatAmp * 1.15, Math.max(o.fitAmp, 0.5) * 1.3], { title: o.title }), short = pl.box[3] < 130;
    pl.frame(short ? 'days' : 'days after the session', short ? '' : 'effect');
    pl.seg(o.t[0], 0, o.t[1], 0, 'rgba(242,245,248,0.45)', 1.2, 1, [5, 4]);
    var rows = [['fitness', C.green], ['fatigue', C.red], ['fitness − fatigue: the jump above rested', C.gold]], xk = pl.box[0] + pl.box[2] - 6;
    rows.forEach(function (rw, i) { g.labelPx(xk, pl.box[1] + 10 + 15 * i, rw[0], rw[1], { size: 11.5, plain: true, align: 'right' }); });
    var f = clamp((o.upto - o.t[0]) / (o.t[1] - o.t[0]), 0, 1); if (!(f > 0)) return pl;
    pl.curve(o.fit, C.green, 2.2, f); pl.curve(function (t) { return -o.fat(t); }, C.red, 2.2, f); pl.curve(function (t) { return o.fit(t) - o.fat(t); }, C.gold, 2.6, f);
    var tu = o.t[0] + (o.t[1] - o.t[0]) * f;
    c.strokeStyle = C.faint; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(pl.X(tu), pl.box[1]); c.lineTo(pl.X(tu), pl.box[1] + pl.box[3]); c.stroke(); c.setLineDash([]);
    pl.point(tu, o.fit(tu), C.green, '', 1); pl.point(tu, -o.fat(tu), C.red, '', 1); pl.point(tu, o.fit(tu) - o.fat(tu), C.gold, '', 1);
    return pl;
  }
  // A key for the shading of the Coach's cost (drawn with a scale centred on zero cost): a box in the lower right
  // corner of a tall map, one line along the top of a short one (a phone).
  var KEY = [['rgb(26,58,92)', 'blue: big benefit, low cost', 'blue: benefit'], ['rgb(92,112,120)', 'grey: small benefit', 'grey: small'], ['rgb(150,98,58)', 'brown: negative benefit', 'brown: negative']];
  function costKey(g, p) {
    if (!(p > 0)) return; var c = g.ctx, R = g.mapR, a = clamp(p, 0, 1);
    if (R[3] < 400) {
      c.font = '600 11.5px ' + g.sans; var widths = KEY.map(function (k) { return c.measureText(k[2]).width + 24; }), total = widths.reduce(function (x, y) { return x + y; }, 0) + 8;
      var x0 = R[0] + R[2] - total - 8, y0 = R[1] + 8, xx = x0 + 8;
      c.globalAlpha = a; c.fillStyle = C.box; c.fillRect(x0, y0, total, 22);
      KEY.forEach(function (k, j) { c.globalAlpha = a; c.fillStyle = k[0]; c.fillRect(xx, y0 + 6, 12, 10); c.globalAlpha = 1; g.labelPx(xx + 16, y0 + 11, k[2], C.ink, { size: 11.5, plain: true, p: p }); xx += widths[j]; });
      c.globalAlpha = 1; return;
    }
    var w = 214, h = 66, x = R[0] + R[2] - w - 10, y = R[1] + R[3] - h - 30;
    c.globalAlpha = a; c.fillStyle = C.box; c.fillRect(x, y, w, h);
    KEY.forEach(function (k, j) { c.globalAlpha = a; c.fillStyle = k[0]; c.fillRect(x + 8, y + 8 + 19 * j, 14, 12); c.globalAlpha = 1; g.labelPx(x + 28, y + 14 + 19 * j, k[1], C.ink, { size: 11.5, plain: true, p: p }); });
    c.globalAlpha = 1;
  }
  return { COACH: COACH, PHYSIO: PHYSIO, LOG: LOG, AIM: AIM, axes: axes, figure: figure, coach: coach, physio: physio, star: star, spring: spring, rightAngle: rightAngle, polygon: polygon, ruleLine: ruleLine,
           lines: lines, table: table, split: split, subscript: subscript, curvePanel: curvePanel, effectsPanel: effectsPanel, gainPricePanel: gainPricePanel, costKey: costKey, scanPanel: scanPanel, gaugePanel: gaugePanel, calendar: calendar,
           courtPanel: courtPanel, fibrePanel: fibrePanel, sumBar: sumBar, tracesPanel: tracesPanel };
})();
