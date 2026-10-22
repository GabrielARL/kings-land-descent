// The drawing parts of the tutorial "Finding the tear" (net_course.js): the camera image of the net, the lattice of
// knots and twines with their states, the detections, the tag and the rope, the meshes and their copies, the
// samples along a twine, and the panels of rows and tables.  The kit g comes from board.js; the case from net.js.
var NetParts = (function () {
  'use strict';
  var B = window.Board; if (!B) return null;
  var H = B.H, C = H.C, seg = H.seg, num = H.num, clamp = H.clamp, mix = H.mix, backOut = H.backOut, nice = H.nice;
  var TAU = 2 * Math.PI, JADE = '#7fd6b4';
  function places(step) { return clamp(Math.ceil(-Math.log(step) / Math.LN10 - 1e-9), 0, 7); }
  function rrect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function subscript(n) { var d = '₀₁₂₃₄₅₆₇₈₉'; return String(n).split('').map(function (q) { return d.charAt(Number(q)); }).join(''); }

  // ------------------------------------------------------------ the camera image on the map
  function axes(g, xl, yl) {
    var c = g.ctx, R = g.mapR, v = g.vis, step = nice((v[1] - v[0]) / 5), d = places(step);
    c.font = '11px ' + g.mono; c.fillStyle = C.dim; c.strokeStyle = C.faint; c.lineWidth = 1; c.textAlign = 'center'; c.textBaseline = 'bottom';
    for (var t = Math.ceil(v[0] / step) * step; t <= v[1]; t += step) { var a = g.P([t, v[2]]); if (a[0] < R[0] + 18 || a[0] > R[0] + R[2] - 24) continue; c.beginPath(); c.moveTo(a[0], R[1] + R[3]); c.lineTo(a[0], R[1] + R[3] - 5); c.stroke(); c.fillText(num(t, d), a[0], R[1] + R[3] - 6); }
    c.textAlign = 'left'; c.textBaseline = 'middle';
    for (t = Math.ceil(v[2] / step) * step; t <= v[3]; t += step) { var b = g.P([v[0], t]); if (b[1] < R[1] + 22 || b[1] > R[1] + R[3] - 30) continue; c.beginPath(); c.moveTo(R[0], b[1]); c.lineTo(R[0] + 5, b[1]); c.stroke(); c.fillText(num(t, d), R[0] + 7, b[1]); }
    c.font = '600 12px ' + g.sans; c.fillStyle = C.ink; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(xl, R[0] + R[2] - 6, R[1] + R[3] - 4);
    c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(yl, R[0] + 6, R[1] + 5);
  }
  // the raster as the camera sees it: an underwater green-grey, drawn once into an offscreen canvas per raster
  var cache = {};
  function image(g, im, o) {
    o = o || {}; var key = o.id || 'image', c = g.ctx, cv = cache[key];
    if (!cv || cv.raster !== im) {
      cv = document.createElement('canvas'); cv.width = im.N; cv.height = im.N; cv.raster = im;
      var cc = cv.getContext('2d'), id = cc.createImageData(im.N, im.N), lo = o.lo == null ? -0.2 : o.lo, hi = o.hi == null ? 1.6 : o.hi;
      for (var y = 0; y < im.N; y++) for (var x = 0; x < im.N; x++) { var t = clamp((im.data[y * im.N + x] - lo) / (hi - lo), 0, 1), k = ((im.N - 1 - y) * im.N + x) * 4; id.data[k] = 20 + 160 * t; id.data[k + 1] = 40 + 190 * t; id.data[k + 2] = 55 + 170 * t; id.data[k + 3] = 255; }
      cc.putImageData(id, 0, 0); cache[key] = cv;
    }
    var R = im.region, A = g.P([R[0], R[3]]), Bq = g.P([R[1], R[2]]); g.clip(g.mapR);
    c.imageSmoothingEnabled = true; c.globalAlpha = o.alpha == null ? 1 : o.alpha; c.drawImage(cv, A[0], A[1], Bq[0] - A[0], Bq[1] - A[1]); c.globalAlpha = 1; c.restore();
  }
  // the lattice: twines as lines coloured by state, knots as dots; o: { pos, word (1 = broken), col, broken (col), p,
  //      knots (draw knots), lw, labels (knot indices) }
  function lattice(g, lat, o) {
    var p = o.p == null ? 1 : o.p; if (!(p > 0)) return; var c = g.ctx; g.clip(g.mapR); c.globalAlpha = clamp(p, 0, 1);
    lat.twines.forEach(function (t, e) {
      var broken = o.word && o.word[e] === 1, a = g.P(o.pos[t.a]), b = g.P(o.pos[t.b]);
      c.strokeStyle = broken ? (o.broken || C.red) : (o.col || JADE); c.lineWidth = o.lw || 2; c.setLineDash(broken ? [4, 4] : []);
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    });
    c.setLineDash([]);
    if (o.knots !== false) o.pos.forEach(function (q, i) { var a = g.P(q); c.fillStyle = o.knotCol || C.ink; c.beginPath(); c.arc(a[0], a[1], o.r || 3.5, 0, TAU); c.fill(); });
    c.globalAlpha = 1; c.restore();
    if (o.labels) o.pos.forEach(function (q, i) { var k = lat.knots[i]; g.label(q, '(' + k.i + ',' + k.j + ')', C.dim, { dx: 5, dy: -9, size: 10, plain: true, p: p }); });
  }
  // the detections: small crosses; o: { dets, p, col, spurious (col for the false ones) }
  function detections(g, dets, o) {
    var p = o.p == null ? 1 : o.p; if (!(p > 0)) return; var c = g.ctx; g.clip(g.mapR); c.globalAlpha = clamp(p, 0, 1); c.lineWidth = 2; c.lineCap = 'round';
    dets.forEach(function (dq, k) { var a = g.P(dq.q), s = 5, false_ = dq.knot < 0; c.strokeStyle = false_ ? (o.spurious || C.orange) : (o.col || C.gold); c.beginPath(); c.moveTo(a[0] - s, a[1] - s); c.lineTo(a[0] + s, a[1] + s); c.moveTo(a[0] + s, a[1] - s); c.lineTo(a[0] - s, a[1] + s); c.stroke(); });
    c.globalAlpha = 1; c.restore();
  }
  // the tag: a gold ring with its number; the rope: a vertical line
  function tag(g, q, p, label) { if (!(p > 0)) return; g.halo(q, 11, C.gold, p, 2.5); g.dot(q, 3, C.gold, p); if (label) g.label(q, label, C.gold, { dx: -16, dy: -14, align: 'right', p: seg(p, 0.4, 1), size: 12 }); }
  function rope(g, x, y0, y1, p, label) { if (!(p > 0)) return; g.line([x, y0], [x, y1], 'rgba(255,210,122,0.85)', 4, p); if (label) g.label([x, y1], label, C.gold, { dx: 8, dy: -10, p: seg(p, 0.4, 1), size: 12 }); }
  // a mesh outlined, with its four knot copies; o: { pos (positions of its 4 knots), col, p, fill, label }
  function mesh(g, pts, o) {
    var p = o.p == null ? 1 : o.p; if (!(p > 0)) return; var c = g.ctx, P = pts.map(g.P, g); g.clip(g.mapR); c.globalAlpha = clamp(p, 0, 1);
    c.beginPath(); P.forEach(function (a, i) { if (i) c.lineTo(a[0], a[1]); else c.moveTo(a[0], a[1]); }); c.closePath();
    if (o.fill) { c.fillStyle = o.fill; c.fill(); }
    c.strokeStyle = o.col || C.blue; c.lineWidth = o.lw || 2; if (o.dash) c.setLineDash(o.dash); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; c.restore();
    if (o.label) { var cx = pts.reduce(function (s, q) { return [s[0] + q[0] / 4, s[1] + q[1] / 4]; }, [0, 0]); g.label(cx, o.label, o.col || C.blue, { align: 'center', dy: 4, p: p, size: 11.5 }); }
  }
  function copyDot(g, q, from, p, label, o) {
    o = o || {}; if (!(p > 0)) return; if (from) g.line(from, q, 'rgba(169,205,246,0.6)', 1.5, p, [3, 3]);
    g.dot(q, 4.5, C.blue, p); if (label) g.label(q, label, C.blue, { dx: o.dx == null ? 8 : o.dx, dy: o.dy == null ? 12 : o.dy, align: o.align || 'left', p: seg(p, 0.5, 1), size: 11.5 });
  }
  // the samples along a twine, seen from the side: o: { samples, mu0, mu1, p, title, llr }
  function sampleStrip(g, R, o) {
    var vals = o.samples, n = vals.length, lo = Math.min(o.mu0 - 0.3, Math.min.apply(null, vals)), hi = Math.max(o.mu1 + 0.3, Math.max.apply(null, vals)), p = o.p == null ? 1 : o.p;
    var pl = g.plot(R, [0, 1], [lo, hi], { title: o.title + (o.llr != null ? ':  ℓ = ' + num(o.llr, 1) + (o.llr > 0 ? ', favors intact' : ', favors torn') : ''), tTicks: false }), short = pl.box[3] < 130;   // a short plot (a phone) keeps its labels inside
    pl.frame(short ? '' : 'along the predicted twine', 'intensity');
    pl.seg(0, o.mu1, 1, o.mu1, JADE, 1.5, seg(p, 0, 0.3), [5, 4]); g.labelPx(pl.X(1) - 4, pl.Y(o.mu1) - 12, 'intact: ' + num(o.mu1, 2), JADE, { align: 'right', size: 11.5, plain: true, p: seg(p, 0.1, 0.3) });
    pl.seg(0, o.mu0, 1, o.mu0, C.red, 1.5, seg(p, 0.1, 0.4), [5, 4]); g.labelPx(pl.X(1) - 4, pl.Y(o.mu0) + (short ? -12 : 14), 'broken: ' + num(o.mu0, 2), C.red, { align: 'right', size: 11.5, plain: true, p: seg(p, 0.2, 0.4) });
    for (var k = 0; k < n; k++) { var q = seg(p, 0.3 + 0.5 * k / n, 0.4 + 0.5 * k / n); if (!(q > 0)) continue; var t = (k + 0.5) / n * 0.8 + 0.1; pl.point(t, vals[k], C.gold, '', q); }
    return pl;
  }
  // bars of evidence per twine: items [{ name, value, col }]
  function bars(g, R, items, p, title) { g.bars(R, items, p, { title: title, d: 1, nameW: 150 }); }

  // ------------------------------------------------------------ panels of rows and tables
  function lines(g, R, items, p, title, o) {
    o = o || {}; var n = items.length, top = R[1] + (title ? 44 : 16), rowH = Math.min(o.rowH || 34, (R[3] - (top - R[1]) - 8) / n);
    g.panel(R, title);
    items.forEach(function (it, i) { var q = seg(p, i / (n + 0.4), (i + 1) / (n + 0.4)); if (!(q > 0)) return; g.labelPx(R[0] + 14 + (it.indent || 0), top + rowH * i + rowH / 2, it.text, it.col || C.ink, { size: it.size || 12.5, plain: true, mono: !!it.mono, p: q }); });
  }
  function table(g, R, rows, p, title, o) {
    o = o || {}; var n = rows.length + (o.head ? 1 : 0), top = R[1] + 40, rowH = Math.min(40, (R[3] - 50) / n), mid = R[0] + 12 + Math.min(o.leftW || 230, R[2] * 0.42);
    g.panel(R, title); var all = (o.head ? [o.head] : []).concat(rows);
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
  return { JADE: JADE, axes: axes, image: image, lattice: lattice, detections: detections, tag: tag, rope: rope, mesh: mesh, copyDot: copyDot, sampleStrip: sampleStrip, bars: bars, lines: lines, table: table, split: split, subscript: subscript };
})();
