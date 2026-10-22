// The drawing parts of the tutorial "Localization is decoding" (dive_course.js): the top-down map of the monopile,
// the standoff and range bands, the beacon, the vehicle, the circumference strip and a photo's window, the match
// cost over headings, the fit curve, and the panels of rows and tables.  The kit g comes from board.js (Board.H
// holds the shared helpers); the dive and the solver from inspect.js.
var DiveParts = (function () {
  'use strict';
  var B = window.Board; if (!B) return null;
  var H = B.H, C = H.C, seg = H.seg, num = H.num, clamp = H.clamp, mix = H.mix, backOut = H.backOut, nice = H.nice;
  var TAU = 2 * Math.PI, JADE = '#7fd6b4', STEEL = 'rgba(150,160,172,0.55)';
  function places(step) { return clamp(Math.ceil(-Math.log(step) / Math.LN10 - 1e-9), 0, 7); }
  function rrect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function subscript(n) { var d = '₀₁₂₃₄₅₆₇₈₉'; return String(n).split('').map(function (q) { return d.charAt(Number(q)); }).join(''); }

  // ------------------------------------------------------------ the map, seen from above
  function axes(g, xl, yl) {
    var c = g.ctx, R = g.mapR, v = g.vis, step = nice((v[1] - v[0]) / 5), d = places(step);
    c.font = '11px ' + g.mono; c.fillStyle = C.dim; c.strokeStyle = C.faint; c.lineWidth = 1; c.textAlign = 'center'; c.textBaseline = 'bottom';
    for (var t = Math.ceil(v[0] / step) * step; t <= v[1]; t += step) { var a = g.P([t, v[2]]); if (a[0] < R[0] + 18 || a[0] > R[0] + R[2] - 24) continue; c.beginPath(); c.moveTo(a[0], R[1] + R[3]); c.lineTo(a[0], R[1] + R[3] - 5); c.stroke(); c.fillText(num(t, d), a[0], R[1] + R[3] - 6); }
    c.textAlign = 'left'; c.textBaseline = 'middle';
    for (t = Math.ceil(v[2] / step) * step; t <= v[3]; t += step) { var b = g.P([v[0], t]); if (b[1] < R[1] + 22 || b[1] > R[1] + R[3] - 30) continue; c.beginPath(); c.moveTo(R[0], b[1]); c.lineTo(R[0] + 5, b[1]); c.stroke(); c.fillText(num(t, d), R[0] + 7, b[1]); }
    c.font = '600 12px ' + g.sans; c.fillStyle = C.ink; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(xl, R[0] + R[2] - 6, R[1] + R[3] - 4);
    c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(yl, R[0] + 6, R[1] + 5);
  }
  function circle(g, centre, r, col, w, p, dash) {
    if (!(p > 0)) return; var c = g.ctx, a = g.P(centre); g.clip(g.mapR);
    c.globalAlpha = clamp(p, 0, 1); c.strokeStyle = col; c.lineWidth = w || 1.5; if (dash) c.setLineDash(dash);
    c.beginPath(); c.arc(a[0], a[1], r * g.s, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p, 0, 1)); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; c.restore();
  }
  // A radial allowed set, drawn as a translucent strip between its two boundary circles.
  function annulus(g, centre, r, tol, col, p) {
    if (!(p > 0)) return; var c = g.ctx, a = g.P(centre), q = clamp(p, 0, 1), lo = Math.max(0, r - tol), hi = r + tol;
    g.clip(g.mapR); c.globalAlpha = 0.16 * q; c.strokeStyle = col; c.lineWidth = Math.max(2, 2 * tol * g.s);
    c.beginPath(); c.arc(a[0], a[1], r * g.s, -Math.PI / 2, -Math.PI / 2 + TAU * q); c.stroke(); c.globalAlpha = 1; c.restore();
    circle(g, centre, lo, col, 1, q, [3, 3]); circle(g, centre, hi, col, 1, q, [3, 3]);
  }
  // the monopile: a steel disc at the origin
  function pile(g, R, p, label) {
    if (!(p > 0)) return; var c = g.ctx, a = g.P([0, 0]); g.clip(g.mapR);
    c.globalAlpha = clamp(p, 0, 1); c.fillStyle = STEEL; c.beginPath(); c.arc(a[0], a[1], R * g.s, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(220,228,236,0.8)'; c.lineWidth = 2; c.stroke(); c.globalAlpha = 1; c.restore();
    if (label) g.label([0, 0], label, C.ink, { align: 'center', dy: 4, p: p, size: 12 });
  }
  // the beacon on the surface vessel: a gold diamond
  function beacon(g, s, p, label) {
    if (!(p > 0)) return; var c = g.ctx, a = g.P(s), r = 9 * backOut(p); g.clip(g.mapR);
    c.fillStyle = C.gold; c.beginPath(); c.moveTo(a[0], a[1] - r); c.lineTo(a[0] + r, a[1]); c.lineTo(a[0], a[1] + r); c.lineTo(a[0] - r, a[1]); c.closePath(); c.fill();
    c.strokeStyle = C.bg; c.lineWidth = 2; c.stroke(); c.restore();
    if (label) g.label(s, label, C.gold, { dx: 12, dy: -14, p: seg(p, 0.5, 1), size: 12 });
  }
  // the vehicle: a jade disc with an R, and a headlight toward the pile
  function vehicle(g, q, p, label) {
    if (!(p > 0)) return; var c = g.ctx, a = g.P(q), r = 9 * backOut(p); g.clip(g.mapR);
    var ang = Math.atan2(-q[1], -q[0]), gl = c.createRadialGradient(a[0], a[1], 2, a[0], a[1], 28);
    gl.addColorStop(0, 'rgba(255,230,160,0.35)'); gl.addColorStop(1, 'rgba(255,230,160,0)');
    c.fillStyle = gl; c.beginPath(); c.moveTo(a[0], a[1]); c.arc(a[0], a[1], 28, ang - 0.5, ang + 0.5); c.closePath(); c.fill();
    c.beginPath(); c.arc(a[0], a[1], r + 3, 0, TAU); c.fillStyle = 'rgba(8,12,18,0.85)'; c.fill();
    c.beginPath(); c.arc(a[0], a[1], r, 0, TAU); c.fillStyle = JADE; c.fill();
    if (p > 0.6) { c.fillStyle = '#0b1a14'; c.font = '700 11px ' + g.sans; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('R', a[0], a[1] + 0.5); }
    c.restore();
    if (label) g.label(q, label, JADE, { dx: 14, dy: -14, p: seg(p, 0.5, 1), size: 12 });
  }
  // a mark on a spot: a gold star for the truth, a red cross for a wrong tag, a jade dot for the solved
  function star(g, q, p, text) {
    if (!(p > 0)) return; var c = g.ctx, a = g.P(q), r = 9 * backOut(p); g.clip(g.mapR);
    c.beginPath(); for (var i = 0; i < 10; i++) { var an = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(a[0] + rr * Math.cos(an), a[1] + rr * Math.sin(an)); }
    c.closePath(); c.fillStyle = C.gold; c.fill(); c.strokeStyle = '#8a4b00'; c.lineWidth = 1; c.stroke(); c.restore();
    if (text) g.label(q, text, C.gold, { dx: 12, dy: 14, p: seg(p, 0.4, 1), size: 12 });
  }
  function cross(g, q, p, col) {
    if (!(p > 0)) return; var c = g.ctx, a = g.P(q), s = 7 * backOut(p); g.clip(g.mapR);
    c.strokeStyle = col || C.red; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(a[0] - s, a[1] - s); c.lineTo(a[0] + s, a[1] + s); c.moveTo(a[0] + s, a[1] - s); c.lineTo(a[0] - s, a[1] + s); c.stroke(); c.restore();
  }
  function tick(g, q, p, col) {
    if (!(p > 0)) return; var c = g.ctx, a = g.P(q), s = 8 * backOut(p); g.clip(g.mapR);
    c.strokeStyle = col || JADE; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(a[0] - s, a[1] + 1); c.lineTo(a[0] - s / 3, a[1] + s * 0.7); c.lineTo(a[0] + s, a[1] - s * 0.7); c.stroke(); c.restore();
  }
  // a copy of a position kept by one fact: a small blue dot with a short leash to the position
  function copyDot(g, q, from, p, label, o) {
    o = o || {}; if (!(p > 0)) return; if (from) g.line(from, q, 'rgba(169,205,246,0.6)', 1.5, p, [3, 3]);
    g.dot(q, 5, C.blue, p); if (label) g.label(q, label, C.blue, { dx: o.dx == null ? 9 : o.dx, dy: o.dy == null ? 12 : o.dy, align: o.align || 'left', p: seg(p, 0.5, 1), size: 11.5 });
  }

  // ------------------------------------------------------------ the circumference strip and the photo
  // o: { m (the model), window: [lo, hi] degrees highlighted, samples: [{deg, v}] photo samples, anodes, tag,
  //      p, title, vLabel, marks: [{deg, text, col}] }
  function strip(g, R, o) {
    var m = o.m, lo = Infinity, hi = -Infinity, p = o.p == null ? 1 : o.p;
    for (var i = 0; i < 360; i++) { lo = Math.min(lo, m[i]); hi = Math.max(hi, m[i]); }
    (o.samples || []).forEach(function (s) { lo = Math.min(lo, s.v); hi = Math.max(hi, s.v); });
    var pad = (hi - lo) * 0.15 || 0.5, pl = g.plot(R, [0, 360], [lo - pad, hi + pad], { title: o.title }); pl.frame('heading around the pile, degrees', o.vLabel || 'what the model shows');
    var c = g.ctx;
    if (o.window && seg(p, 0, 0.2) > 0) { var w0 = o.window[0], w1 = o.window[1]; c.globalAlpha = 0.18 * seg(p, 0, 0.2); c.fillStyle = C.gold; [[w0, w1], [w0 + 360, w1 + 360], [w0 - 360, w1 - 360]].forEach(function (ww) { var a = clamp(ww[0], 0, 360), b = clamp(ww[1], 0, 360); if (b > a) c.fillRect(pl.X(a), pl.box[1], pl.X(b) - pl.X(a), pl.box[3]); }); c.globalAlpha = 1; }
    pl.curve(function (t) { return m[Math.min(359, Math.max(0, Math.round(t)))]; }, JADE, 2, seg(p, 0, 0.6));
    if (o.anodes !== false) [0, 90, 180, 270].forEach(function (a, i) { var q = seg(p, 0.5 + 0.08 * i, 0.6 + 0.08 * i); if (!(q > 0)) return; pl.point(a, m[a], C.gold, i === 0 ? 'anode' : '', q, 'right'); if (i) g.labelPx(pl.X(a), pl.Y(m[a]) - 14, 'anode', C.gold, { align: 'center', size: 11.5, plain: true, p: q }); });
    if (o.tag != null) { var qt = seg(p, 0.82, 0.95); pl.point(o.tag, m[o.tag], C.orange, 'the unique tag', qt, 'right'); }
    (o.samples || []).forEach(function (s, i) { var q = seg(p, 0.3 + 0.4 * i / o.samples.length, 0.5 + 0.4 * i / o.samples.length); if (!(q > 0)) return; c.globalAlpha = q; c.fillStyle = C.ink; c.beginPath(); c.arc(pl.X(s.deg), pl.Y(s.v), 3, 0, TAU); c.fill(); c.globalAlpha = 1; });
    (o.marks || []).forEach(function (mk) { var q = mk.p == null ? 1 : mk.p; if (!(q > 0)) return; pl.seg(mk.deg, lo - pad, mk.deg, hi + pad, mk.col || C.violet, 1.5, q, [4, 4]); if (mk.text) g.labelPx(pl.X(mk.deg), pl.box[1] + 14, mk.text, mk.col || C.violet, { align: 'center', size: 11.5, p: q }); });
    return pl;
  }
  // the match cost over headings: o: { c (720 bins), p, title, minima: [{deg, cost}], marks, cursor (a heading),
  //      deltaLog (plot log10(1 + cost - minimum)), vLabel, lineCol }
  function costPlot(g, R, o) {
    var c = o.c, p = o.p == null ? 1 : o.p, mn = Infinity; for (var j = 0; j < 720; j++) mn = Math.min(mn, c[j]);
    var f = o.deltaLog ? function (v) { return Math.log(1 + Math.max(0, v - mn)) / Math.LN10; } : function (v) { return v; };
    var lo = Infinity, hi = -Infinity; for (var i = 0; i < 720; i++) { lo = Math.min(lo, f(c[i])); hi = Math.max(hi, f(c[i])); }
    var pad = (hi - lo) * 0.12 || 1, pl = g.plot(R, [0, 360], [lo - pad, hi + pad], { title: o.title }); pl.frame('heading, degrees', o.vLabel || (o.deltaLog ? 'log₁₀(1 + cost − minimum)' : 'match cost'));
    pl.curve(function (t) { var a = ((t % 360) + 360) % 360 * 2, k = Math.floor(a), fr = a - k; return f(c[k] * (1 - fr) + c[(k + 1) % 720] * fr); }, o.lineCol || C.gold, 2, seg(p, 0, 0.7));
    (o.minima || []).forEach(function (mn, i) { var q = seg(p, 0.6 + 0.08 * i, 0.72 + 0.08 * i); if (!(q > 0)) return; pl.point(mn.deg, f(mn.cost), mn.col || C.orange, mn.text == null ? (Math.round(mn.deg * 2) / 2) + '°' : mn.text, q, mn.deg > 250 ? 'left' : 'right'); });
    (o.marks || []).forEach(function (mk) { var q = mk.p == null ? 1 : mk.p; if (!(q > 0)) return; pl.seg(mk.deg, lo - pad, mk.deg, hi + pad, mk.col || C.violet, 1.5, q, [4, 4]); if (mk.text) g.labelPx(pl.X(mk.deg), pl.box[1] + 14 + (mk.dy || 0), mk.text, mk.col || C.violet, { align: 'center', size: 11.5, p: q }); });
    if (o.cursor != null) { var qc = o.cursorP == null ? 1 : o.cursorP; pl.seg(o.cursor, lo - pad, o.cursor, hi + pad, C.ink, 1, qc); }
    return pl;
  }

  // ------------------------------------------------------------ panels of rows and tables
  function lines(g, R, items, p, title, o) {
    o = o || {}; var n = items.length, top = R[1] + (title ? 44 : 16), rowH = Math.min(o.rowH || 34, (R[3] - (top - R[1]) - 8) / n);
    g.panel(R, title);
    items.forEach(function (it, i) {
      var q = seg(p, i / (n + 0.4), (i + 1) / (n + 0.4)); if (!(q > 0)) return;
      g.labelPx(R[0] + 14 + (it.indent || 0), top + rowH * i + rowH / 2, it.text, it.col || C.ink, { size: it.size || 12.5, plain: true, mono: !!it.mono, p: q });
    });
  }
  // two columns revealed row by row: rows [left, right]; o: { leftCol, rightCol, head: [l, r] }
  function table(g, R, rows, p, title, o) {
    o = o || {}; var n = rows.length + (o.head ? 1 : 0), top = R[1] + 40, rowH = Math.min(40, (R[3] - 50) / n), mid = R[0] + 12 + Math.min(o.leftW || 230, R[2] * 0.42);
    g.panel(R, title);
    var all = (o.head ? [o.head] : []).concat(rows);
    all.forEach(function (r, i) {
      var q = seg(p, i / (n + 0.5), (i + 1) / (n + 0.5)); if (!(q > 0)) return; var y = top + rowH * i + rowH / 2, head = o.head && i === 0;
      g.labelPx(R[0] + 12, y, r[0], head ? C.dim : (o.leftCol || C.gold), { size: head ? 11.5 : 12.5, plain: true, p: q });
      g.labelPx(mid, y, r[1], head ? C.dim : (o.rightCol || C.ink), { size: head ? 11.5 : 12.5, plain: true, p: q });
      if (head) { var c = g.ctx; c.strokeStyle = C.faint; c.beginPath(); c.moveTo(R[0] + 10, y + rowH / 2 - 4); c.lineTo(R[0] + R[2] - 10, y + rowH / 2 - 4); c.stroke(); }
    });
  }
  function split(R, share, gap) {
    gap = gap || 8;
    if (R[2] >= R[3] * 1.25 && R[2] >= 600) { var w = Math.round((R[2] - gap) * share); return [[R[0], R[1], w, R[3]], [R[0] + w + gap, R[1], R[2] - w - gap, R[3]]]; }
    var h = Math.round((R[3] - gap) * share); return [[R[0], R[1], R[2], h], [R[0], R[1] + h + gap, R[2], R[3] - h - gap]];
  }

  return { JADE: JADE, axes: axes, circle: circle, annulus: annulus, pile: pile, beacon: beacon, vehicle: vehicle, star: star, cross: cross, tick: tick, copyDot: copyDot,
           strip: strip, costPlot: costPlot, lines: lines, table: table, split: split, subscript: subscript };
})();
