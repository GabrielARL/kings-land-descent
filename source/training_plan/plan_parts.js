// The drawing parts of the tutorial "The Coach and the Physio" (plan_course.js): the map of plans (days across,
// load up), the two specialists, the safe polygon and its rules, the tether, the planning log, and the side panels:
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
    c.font = '11px ' + g.mono; c.fillStyle = C.dim; c.strokeStyle = C.faint; c.lineWidth = 1; c.textAlign = 'center'; c.textBaseline = 'bottom';
    for (var t = Math.ceil(v[0] / step) * step; t <= v[1]; t += step) { var a = g.P([t, v[2]]); if (a[0] < R[0] + 18 || a[0] > R[0] + R[2] - 24) continue; c.beginPath(); c.moveTo(a[0], R[1] + R[3]); c.lineTo(a[0], R[1] + R[3] - 5); c.stroke(); c.fillText(num(t, d), a[0], R[1] + R[3] - 6); }
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
  // the best safe session: a gold star
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
  // the safe set: the polygon of all the rules, filled faintly and outlined in the Physio's blue
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
  // The readiness curve r(t) over days, with the rested baseline and the harm line; o: { r, rOld, t: [t0, t1],
  // v: [lo, hi], p, title, r0, sessions: [{t, w}], marks: [{t, text, col, side}], old (label for rOld), short }.
  function curvePanel(g, R, o) {
    var p = o.p == null ? 1 : o.p, pl = g.plot(R, o.t, o.v, { title: o.title }), short = pl.box[3] < 200;
    pl.frame(short ? 'days' : 'days since the last hard session', 'readiness');
    pl.seg(o.t[0], 1, o.t[1], 1, 'rgba(242,245,248,0.45)', 1.2, seg(p, 0, 0.2), [5, 4]); g.labelPx(pl.X(o.t[1]) - 4, pl.Y(1) - 11, 'rested baseline 1', C.dim, { align: 'right', size: 11, plain: true, p: seg(p, 0.05, 0.2) });
    if (o.r0 != null) { pl.seg(o.t[0], o.r0, o.t[1], o.r0, C.red, 1.2, seg(p, 0, 0.2), [3, 4]); g.labelPx(pl.X(o.t[1]) - 4, pl.Y(o.r0) - 12, 'below ' + num(o.r0, 1) + ' a session does harm', C.red, { align: 'right', size: 11, plain: true, p: seg(p, 0.05, 0.2) }); }
    (o.sessions || []).forEach(function (s, i) { var q = seg(p, 0.1 + 0.1 * i, 0.2 + 0.1 * i); if (!(q > 0)) return; pl.seg(s.t, o.v[0], s.t, o.v[0] + (o.v[1] - o.v[0]) * 0.18 * s.w / 5, s.col || C.gold, 6, q); if (s.text && !short) g.labelPx(pl.X(s.t) + 8, pl.Y(o.v[0] + (o.v[1] - o.v[0]) * 0.09 * s.w / 5), s.text, s.col || C.gold, { size: 11, plain: true, p: q }); });
    if (o.rOld) { pl.curve(o.rOld, 'rgba(242,245,248,0.35)', 1.8, seg(p, 0.1, 0.3)); if (o.old) g.labelPx(pl.X(o.oldAt || o.t[1]) - 4, pl.Y(o.rOld(o.oldAt || o.t[1])) - 12, o.old, C.dim, { align: 'right', size: 11, plain: true, p: seg(p, 0.2, 0.35) }); }
    pl.curve(o.r, o.col || C.gold, 2.4, seg(p, o.from == null ? 0.2 : o.from, o.to == null ? 0.75 : o.to));
    (o.marks || []).forEach(function (m) {
      var q = m.p != null ? m.p : seg(p, m.at == null ? 0.75 : m.at, (m.at == null ? 0.75 : m.at) + 0.12);
      if (short) { pl.point(m.t, o.r(m.t), m.col || C.gold, '', q); g.labelPx(pl.X(m.t) - 10, pl.Y(o.r(m.t)) + 18, m.text, m.col || C.gold, { align: 'right', size: 11.5, p: seg(q, 0.4, 1) }); }   // a short plot (a phone): below, clear of the axis title
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
    var rq = seg(p, 0.7, 0.85); if (rq > 0) { pl.seg(o.race, 0, o.race, 6.5, C.red, 2, rq); g.labelPx(pl.X(o.race) - 6, pl.Y(6.5) + 2, 'race, day ' + o.race, C.red, { align: 'right', size: 11.5, plain: true, p: rq }); }
    o.sessions.forEach(function (s, i) {
      var q = seg(p, 0.05 + 0.16 * i, 0.2 + 0.16 * i); if (!(q > 0)) return; var x = pl.X(s.t), y0 = pl.Y(0), y1 = pl.Y(s.w * q), w = 9;
      c.globalAlpha = 0.9; c.fillStyle = s.col || C.gold; c.fillRect(x - w / 2, y1, w, y0 - y1); c.globalAlpha = 1;
      if (s.text) g.labelPx(x, y1 - 12, s.text, s.col || C.gold, { align: 'center', size: 11.5, plain: true, p: seg(q, 0.6, 1) });
    });
    return pl;
  }
  return { COACH: COACH, PHYSIO: PHYSIO, LOG: LOG, AIM: AIM, axes: axes, figure: figure, coach: coach, physio: physio, star: star, spring: spring, rightAngle: rightAngle, polygon: polygon, ruleLine: ruleLine,
           lines: lines, table: table, split: split, subscript: subscript, curvePanel: curvePanel, scanPanel: scanPanel, gaugePanel: gaugePanel, calendar: calendar };
})();
