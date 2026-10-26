// The drawing parts of the advanced tutorial "The Jade Keep" (advanced_course.js): the Keep's map of two tiles, a
// tile's track, the hall of four windows with its lanterns and tiles, the plot of readings against tiles, the
// Candle, the row of towers, the Veil's weave, the Herald and the key table.  The kit g comes from board.js
// (Board.H holds the shared helpers); the lands and walks from keep.js.
var KeepParts = (function () {
  'use strict';
  var B = window.Board; if (!B) return null;
  var H = B.H, C = H.C, seg = H.seg, num = H.num, clamp = H.clamp, mix = H.mix, backOut = H.backOut, nice = H.nice;
  var TAU = 2 * Math.PI, JADE = '#7fd6b4';
  function narrow(g) { return g.W < 520; }
  function fitSize(g, text, maxWidth, wanted, least, mono) {
    var c = g.ctx, size = wanted;
    while (size > least) {
      c.font = (mono ? '' : '600 ') + size + 'px ' + (mono ? g.mono : g.sans);
      if (c.measureText(text).width <= maxWidth) break;
      size -= 0.5;
    }
    return size;
  }
  function wrapWords(g, text, maxWidth, size, mono) {
    var c = g.ctx, words = String(text || '').trim().split(/\s+/), lines = [], line = '';
    c.font = (mono ? '' : '600 ') + size + 'px ' + (mono ? g.mono : g.sans);
    words.forEach(function (w) {
      var next = line ? line + ' ' + w : w;
      if (line && c.measureText(next).width > maxWidth) { lines.push(line); line = w; }
      else line = next;
    });
    if (line) lines.push(line);
    return lines;
  }
  function fitWrapped(g, text, maxWidth, wanted, least, maxLines, mono) {
    var size = wanted, lines;
    while (size > least) {
      lines = wrapWords(g, text, maxWidth, size, mono);
      if (lines.length <= maxLines) return { size: size, lines: lines };
      size -= 0.5;
    }
    return { size: least, lines: wrapWords(g, text, maxWidth, least, mono) };
  }
  function shortMark(text) {
    return String(text || '').replace('the track’s bottom:', 'track bottom').replace('the Bowl’s bottom:', 'Bowl bottom').replace('both bottoms:', 'both bottoms');
  }
  function places(step) { return clamp(Math.ceil(-Math.log(step) / Math.LN10 - 1e-9), 0, 7); }
  function rrect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function subscript(n) { var d = '₀₁₂₃₄₅₆₇₈₉'; return String(n).split('').map(function (q) { return d.charAt(Number(q)); }).join(''); }
  function word(w) { return w.join(''); }
  function isBeacon(k) { return k === 0 || k === 3; }

  // The OFDM lesson reuses the old two-dimensional map for bit variables.  Keep the shared variable visually
  // neutral: it is a node labelled b, not the Wanderer character from the original story.
  function sharedBitMarker(g, q, p, label) {
    if (!(p > 0)) return; var c = g.ctx, a = g.P(q), r = 9 * backOut(p);
    c.globalAlpha = clamp(p, 0, 1); c.fillStyle = 'rgba(8,12,18,0.88)'; c.beginPath(); c.arc(a[0], a[1], r + 3, 0, TAU); c.fill();
    c.fillStyle = 'rgba(127,214,180,0.30)'; c.strokeStyle = JADE; c.lineWidth = 2; c.beginPath(); c.arc(a[0], a[1], r, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = JADE; c.font = '700 11px ' + g.mono; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('b', a[0], a[1] + 0.5); c.globalAlpha = 1;
    if (label) g.labelPx(a[0] + 14, a[1] - 12, label, JADE, { p: seg(p, 0.5, 1) });
  }
  // ------------------------------------------------------------ the Keep's map: tile b1 across, tile b2 up
  // The shading's range of a height over a view, so that every page of a land shades it the same way.
  function shadeOf(fn, v, id, rings) {
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i <= 40; i++) for (var j = 0; j <= 40; j++) { var z = fn([v[0] + (v[1] - v[0]) * i / 40, v[2] + (v[3] - v[2]) * j / 40]); if (isFinite(z)) { lo = Math.min(lo, z); hi = Math.max(hi, z); } }
    return { id: id, lo: lo, hi: hi, rings: rings == null ? 12 : rings };
  }
  // Ticks and names along the map's edges (board.js's axes name the axes x1 and x2; the Keep's are tiles).
  function axes(g, xl, yl) {
    var c = g.ctx, R = g.mapR, v = g.vis, step = nice((v[1] - v[0]) / 5), d = places(step);
    c.font = '11px ' + g.mono; c.fillStyle = C.dim; c.strokeStyle = C.faint; c.lineWidth = 1; c.textAlign = 'center'; c.textBaseline = 'bottom';
    for (var t = Math.ceil(v[0] / step) * step; t <= v[1]; t += step) { var a = g.P([t, v[2]]); if (a[0] < R[0] + 18 || a[0] > R[0] + R[2] - 24) continue; c.beginPath(); c.moveTo(a[0], R[1] + R[3]); c.lineTo(a[0], R[1] + R[3] - 5); c.stroke(); c.fillText(num(t, d), a[0], R[1] + R[3] - 6); }
    c.textAlign = 'left'; c.textBaseline = 'middle';
    for (t = Math.ceil(v[2] / step) * step; t <= v[3]; t += step) { var b = g.P([v[0], t]); if (b[1] < R[1] + 22 || b[1] > R[1] + R[3] - 30) continue; c.beginPath(); c.moveTo(R[0], b[1]); c.lineTo(R[0] + 5, b[1]); c.stroke(); c.fillText(num(t, d), R[0] + 7, b[1]); }
    c.font = '600 12px ' + g.sans; c.fillStyle = C.ink; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(xl, R[0] + R[2] - 6, R[1] + R[3] - 4);
    c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(yl, R[0] + 6, R[1] + 5);
  }
  var SQ = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
  function square(g, p) { g.path(SQ, 'rgba(255,210,122,0.6)', 1.5, p == null ? 1 : p, [6, 4]); }
  function lawLine(g, p, w) { g.line([0, 0], [1, 1], C.blue, w || 2.5, p == null ? 1 : p, [6, 4]); }
  // the Keep seen from above: the height's shading, the tiles' square and the lawful line
  function keepBase(g, fn, shade, o) {
    o = o || {}; var sh = {}, k; for (k in shade) sh[k] = shade[k]; if (o.alpha != null) sh.alpha = o.alpha;
    g.land(fn, sh); axes(g, 'tile b₁ →', '↑ tile b₂');
    if (o.square !== false) square(g, o.squareP);
    if (o.law !== false) lawLine(g, o.lawP);
  }
  // the four corners: the four words, lawful in blue and broken in orange
  function corners(g, p, lawful, marks) {
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function (q, i) {
      var ok = lawful(q), q0 = seg(p, i * 0.1, i * 0.1 + 0.25), col = marks === false ? C.ink : ok ? C.blue : C.orange;
      g.dot(q, 5, col, q0);
      g.label(q, word(q) + (marks === false ? '' : ok ? ' lawful' : ' broken'), col, { dx: q[0] > 0 ? 9 : -9, dy: q[1] > 0 ? -13 : 14, align: q[0] > 0 ? 'left' : 'right', p: q0, size: 12 });
    });
  }
  function warden(g, q, p, label) {
    if (!(p > 0)) return; g.dot(q, 7, C.blue, p); if (!label) return;
    if (!narrow(g)) { g.label(q, label, C.blue, { dx: 10, dy: 14, p: p, size: 12 }); return; }
    // Long coordinate labels hid both the Herald and the aim on the phone.  The prose and formula retain the
    // numbers, while the map keeps the role and index.  Early Wardens sit above/right of their neighbours; later
    // projected points near the origin have clearer space on their right.
    var compact = label.replace(/^the /, '').replace(/\s*=.*$/, ''), nearOrigin = q[0] < 0.25 && q[1] < 0.25;
    g.label(q, compact, C.blue, nearOrigin ? { dx: 10, dy: 17, p: p, size: 11.5 } : { dx: -10, dy: -18, align: 'right', p: p, size: 11.5 });
  }
  // the Herald: a gold rider with a red pennant
  function heraldPx(g, X, Y, p, label) {
    if (!(p > 0)) return; var c = g.ctx, r = 9 * backOut(p);
    c.beginPath(); c.arc(X, Y, r + 3, 0, TAU); c.fillStyle = 'rgba(8,12,18,0.85)'; c.fill();
    c.beginPath(); c.arc(X, Y, r, 0, TAU); c.fillStyle = C.gold; c.fill();
    c.strokeStyle = C.gold; c.lineWidth = 2; c.beginPath(); c.moveTo(X + r, Y - r); c.lineTo(X + r, Y - r - 16); c.stroke();
    c.fillStyle = C.red; c.beginPath(); c.moveTo(X + r, Y - r - 16); c.lineTo(X + r + 12, Y - r - 12); c.lineTo(X + r, Y - r - 8); c.closePath(); c.fill();
    if (p > 0.6) { c.fillStyle = '#1b1406'; c.font = '700 11px ' + g.sans; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', X, Y + 0.5); }
    if (label) g.labelPx(X + 14, Y + 16, label, C.gold, { p: seg(p, 0.5, 1) });
  }
  function herald(g, q, p, label) { if (!(p > 0)) return; var a = g.P(q); heraldPx(g, a[0], a[1], p, label); }
  // a cross or a tick over a spot: the Herald's verdict on a word
  function verdict(g, q, ok, p) {
    if (!(p > 0)) return; var c = g.ctx, a = g.P(q), s = 9 * backOut(p);
    c.globalAlpha = clamp(p, 0, 1); c.strokeStyle = ok ? JADE : C.red; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath();
    if (ok) { c.moveTo(a[0] - s, a[1] + 1); c.lineTo(a[0] - s / 3, a[1] + s * 0.7); c.lineTo(a[0] + s, a[1] - s * 0.7); }
    else { c.moveTo(a[0] - s, a[1] - s); c.lineTo(a[0] + s, a[1] + s); c.moveTo(a[0] + s, a[1] - s); c.lineTo(a[0] - s, a[1] + s); }
    c.stroke(); c.globalAlpha = 1;
  }

  // ------------------------------------------------------------ a tile's track, seen from the side
  // o: { title, curves: [{ fn, col, w, p, dash, label, at }], marks: [{ t, v, col, text, p, side }], tile: { t, p, col },
  //      range: [lo, hi] (else from the curves), vLabel, beyond: { fn, col, p } (the curve continued past the notches) }
  function track(g, R, o) {
    var curves = o.curves || [], n = 60, lo = Infinity, hi = -Infinity, c = g.ctx;
    curves.forEach(function (cv) { for (var i = 0; i <= n; i++) { var y = cv.fn(i / n); if (isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); } } });
    (o.marks || []).forEach(function (m) { if (isFinite(m.v)) { lo = Math.min(lo, m.v); hi = Math.max(hi, m.v); } });
    if (o.range) { lo = o.range[0]; hi = o.range[1]; }
    if (!(hi > lo)) { lo = lo - 0.5; hi = hi + 0.5; }
    var pad = (hi - lo) * 0.14, pl = g.plot(R, [-0.1, 1.1], [lo - pad, hi + pad], { title: o.title, tTicks: false });
    if (narrow(g) && R[3] < 140) {
      // The phone stacks two tracks below the map.  Full axes leave only a few pixels for the curves, so use a
      // compact strip: same curves and minima, a small colour key, and the two physical notches.
      var L = R[0] + 18, Rt = R[0] + R[2] - 12, T = R[1] + 42, Bot = R[1] + R[3] - 25;
      if (Bot < T + 18) T = Bot - 18;
      var X = function (t) { return L + (t + 0.1) / 1.2 * (Rt - L); }, Y = function (v) { return Bot - (v - lo + pad) / (hi - lo + 2 * pad) * (Bot - T); };
      g.panel(R, o.title);
      var shown = curves.filter(function (cv) { return cv.label && (cv.p == null ? 1 : cv.p) >= 1; });
      shown.forEach(function (cv, j) {
        var slot = R[2] / Math.max(1, shown.length), text = cv.label.replace(/^the /, '');
        g.labelPx(R[0] + slot * (j + 0.5), R[1] + 30, text, cv.col, { align: 'center', size: fitSize(g, text, slot - 8, 10.5, 8.5, false), plain: true });
      });
      curves.forEach(function (cv) {
        var cp = cv.p == null ? 1 : cv.p; if (!(cp > 0)) return; c.save(); c.beginPath(); c.rect(L, T - 4, Rt - L, Bot - T + 4); c.clip();
        c.strokeStyle = cv.col; c.lineWidth = cv.w || 2; if (cv.dash) c.setLineDash(cv.dash); c.beginPath();
        var last = Math.round(n * clamp(cp, 0, 1)); for (var ii = 0; ii <= last; ii++) { var tt = ii / n, yy = clamp(Y(cv.fn(tt)), T - 20, Bot + 20); if (ii) c.lineTo(X(tt), yy); else c.moveTo(X(tt), yy); }
        c.stroke(); c.setLineDash([]); c.restore();
      });
      c.strokeStyle = C.faint; c.lineWidth = 1; c.beginPath(); c.moveTo(X(0), Bot); c.lineTo(X(1), Bot); c.stroke();
      [0, 1].forEach(function (t) { c.strokeStyle = C.gold; c.lineWidth = 2; c.beginPath(); c.moveTo(X(t), Bot); c.lineTo(X(t), Bot - 7); c.stroke(); g.labelPx(X(t), Bot + 9, 'notch ' + t, C.gold, { align: 'center', size: 10.5, plain: true }); });
      (o.marks || []).forEach(function (m, j) {
        var mp = m.p == null ? 1 : m.p; if (!(mp > 0)) return; c.globalAlpha = clamp(mp, 0, 1); c.fillStyle = m.col; c.beginPath(); c.arc(X(m.t), Y(m.v), 4, 0, TAU); c.fill(); c.globalAlpha = 1;
        var mt = shortMark(m.text); if (mt) g.labelPx(X(m.t) + (m.side === 'left' ? -7 : 7), clamp(Y(m.v) - 10 - 14 * j, T + 5, Bot - 8), mt, m.col, { align: m.side === 'left' ? 'right' : 'left', size: fitSize(g, mt, R[2] * 0.58, 10.5, 8.5, false), p: seg(mp, 0.4, 1) });
      });
      if (o.tile && o.tile.p > 0) { var tp0 = clamp(o.tile.p, 0, 1), tx = X(o.tile.t); c.globalAlpha = tp0; c.fillStyle = o.tile.col || JADE; c.beginPath(); rrect(c, tx - 6, Bot - 10, 12, 12, 3); c.fill(); c.globalAlpha = 1; }
      return { X: X, Y: Y, box: [L, T, Rt - L, Bot - T] };
    }
    pl.frame('', o.vLabel || '');
    [0, 1].forEach(function (t) {
      c.strokeStyle = C.gold; c.lineWidth = 2; c.beginPath(); c.moveTo(pl.X(t), pl.box[1] + pl.box[3]); c.lineTo(pl.X(t), pl.box[1] + pl.box[3] - 9); c.stroke();
      g.labelPx(pl.X(t), pl.box[1] + pl.box[3] + 8, 'notch ' + t, C.gold, { align: 'center', size: 11.5, plain: true });
    });
    curves.forEach(function (cv) {
      var p = cv.p == null ? 1 : cv.p; if (!(p > 0)) return;
      if (cv.dash) c.setLineDash(cv.dash);
      pl.curve(function (t) { return t < -1e-9 || t > 1 + 1e-9 ? NaN : cv.fn(t); }, cv.col, cv.w || 2, p);
      c.setLineDash([]);
      if (cv.label && p >= 1) { var ta = cv.at == null ? 0.5 : cv.at; g.labelPx(pl.X(ta), pl.Y(cv.fn(ta)) - 13, cv.label, cv.col, { align: 'center', size: 11.5, plain: true }); }
    });
    if (o.beyond && o.beyond.p > 0) {           // the curve continued past the notches, dashed
      var bf = o.beyond.fn, bp = o.beyond.p; c.save(); c.beginPath(); c.rect(pl.box[0] - 30, pl.box[1] - 6, pl.box[2] + 60, pl.box[3] + 6); c.clip();
      c.globalAlpha = clamp(bp, 0, 1); c.strokeStyle = o.beyond.col || C.red; c.lineWidth = 1.5; c.setLineDash([4, 4]);
      [[-0.1, 0], [1, 1.1]].forEach(function (rg) { c.beginPath(); for (var i = 0; i <= 12; i++) { var t = rg[0] + (rg[1] - rg[0]) * i / 12, Y = clamp(pl.Y(bf(t)), pl.box[1] - 30, pl.box[1] + pl.box[3] + 30); if (i) c.lineTo(pl.X(t), Y); else c.moveTo(pl.X(t), Y); } c.stroke(); });
      c.setLineDash([]); c.globalAlpha = 1; c.restore();
    }
    (o.marks || []).forEach(function (m) { pl.point(m.t, m.v, m.col, m.text, m.p == null ? 1 : m.p, m.side); });
    if (o.tile && o.tile.p > 0) {               // the tile: a jade square sliding along the track's floor
      var tp = clamp(o.tile.p, 0, 1), X = pl.X(o.tile.t), Y = pl.box[1] + pl.box[3] - 7;
      c.globalAlpha = tp; c.fillStyle = o.tile.col || JADE; c.beginPath(); rrect(c, X - 7, Y - 7, 14, 14, 3); c.fill(); c.globalAlpha = 1;
      if (o.tile.text) g.labelPx(X, Y - 20, o.tile.text, o.tile.col || JADE, { align: 'center', size: 11.5, p: tp });
    }
    return pl;
  }

  // ------------------------------------------------------------ the hall of four windows
  // o: { land, b, w (weight per window, else full), p, title, spill (show the spill between windows), leans (show
  //      each sentry's lean), dim (shade the brightness by w), technical (use OFDM-first labels) }
  function hall(g, R, o) {
    var c = g.ctx, land = o.land, y = land.y, n = 4, W = R[2] / n, y0 = R[1] + (o.title ? 40 : 18), hW = Math.max(60, R[3] - (y0 - R[1]) - 58), technical = !!o.technical;
    if (narrow(g)) {
      // Four tall desktop windows become four compact status cards.  Short symbolic rows keep readings, weights,
      // leans and tiles distinct even when the panel is only half of a phone canvas.
      g.panel(R, o.title); var pad = 6, gap = 4, cardW = (R[2] - 2 * pad - 3 * gap) / 4;
      var cardY = R[1] + (o.title ? 38 : 8), cardBot = R[1] + R[3] - 8, cardH = cardBot - cardY, cxs = [];
      for (var k0 = 0; k0 < n; k0++) {
        var left = R[0] + pad + k0 * (cardW + gap), cx0 = left + cardW / 2, q0 = seg(o.p == null ? 1 : o.p, k0 * 0.1, k0 * 0.1 + 0.3); cxs.push(cx0); if (!(q0 > 0)) continue;
        var w0 = o.w ? o.w[k0] : 1, bright0 = o.dim === false ? 1 : 0.3 + 0.7 * w0, beacon0 = isBeacon(k0), ly0 = cardY + 20;
        c.globalAlpha = q0; c.strokeStyle = C.faint; c.lineWidth = 1.3; c.beginPath(); rrect(c, left, cardY, cardW, cardH, 8); c.stroke();
        var gl0 = c.createRadialGradient(cx0, ly0, 1, cx0, ly0, 22); gl0.addColorStop(0, 'rgba(255,210,122,' + (0.9 * bright0).toFixed(3) + ')'); gl0.addColorStop(1, 'rgba(255,210,122,0)'); c.fillStyle = gl0; c.beginPath(); c.arc(cx0, ly0, 22, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,210,122,' + bright0.toFixed(3) + ')'; c.beginPath(); c.arc(cx0, ly0, 7, 0, TAU); c.fill();
        var role = beacon0 ? (technical ? 'pilot' : 'Beacon') : (technical ? 'data position ' + k0 : 'sentry ' + k0); g.labelPx(cx0, ly0 + 26, role, beacon0 ? C.gold : C.ink, { align: 'center', size: fitSize(g, role, cardW - 5, 10.5, 8.5, false), plain: true });
        g.labelPx(cx0, ly0 + 43, 'y' + subscript(k0) + ' ' + num(y[k0], 2), C.ink, { align: 'center', size: fitSize(g, 'y' + subscript(k0) + ' ' + num(y[k0], 2), cardW - 5, 10.5, 8.5, true), plain: true, mono: true });
        var row0 = ly0 + 60;
        if (o.w) { g.labelPx(cx0, row0, 'w ' + num(w0, 2), w0 < 0.9 ? C.orange : C.dim, { align: 'center', size: 10, plain: true, mono: true }); row0 += 16; }
        if (o.leans && !beacon0) { var lean0 = technical ? 'bit coefficient ℓ' + subscript(k0) + ' ' + num(o.leans[k0 - 1], 2) : 'ℓ' + subscript(k0) + ' ' + num(o.leans[k0 - 1], 2); g.labelPx(cx0, row0, lean0, C.violet, { align: 'center', size: fitSize(g, lean0, cardW - 4, 10, 8.5, true), plain: true, mono: true }); }
        var bk0 = beacon0 ? 0 : o.b[k0 - 1], ty0 = cardBot - 21, txa = left + 8, txb = left + cardW - 8;
        if (cardH > 112) { c.strokeStyle = C.faint; c.lineWidth = 2.5; c.beginPath(); c.moveTo(txa, ty0); c.lineTo(txb, ty0); c.stroke(); c.fillStyle = beacon0 ? C.gold : JADE; c.beginPath(); rrect(c, mix(txa, txb, bk0) - 5, ty0 - 5, 10, 10, 3); c.fill(); }
        var state = beacon0 ? (technical ? 'known symbol' : 'known 0') : 'b' + subscript(k0) + ' ' + num(bk0, 2); g.labelPx(cx0, cardBot - 6, state, C.dim, { align: 'center', size: fitSize(g, state, cardW - 4, 10, 8.5, true), plain: true, mono: true }); c.globalAlpha = 1;
      }
      if (o.spill && o.spill > 0) {
        c.globalAlpha = clamp(o.spill, 0, 1); var sy0 = cardY + 20;
        for (k0 = 0; k0 < n - 1; k0++) { g.arrowPx([cxs[k0] + 10, sy0], [cxs[k0 + 1] - 10, sy0], C.violet, 1.5); g.arrowPx([cxs[k0 + 1] - 10, sy0 + 7], [cxs[k0] + 10, sy0 + 7], C.violet, 1.5); if (!technical) g.labelPx((cxs[k0] + cxs[k0 + 1]) / 2, sy0 + 14, 'c₁', C.violet, { align: 'center', size: 9.5, plain: true }); }
        if (technical) g.labelPx(R[0] + R[2] / 2, cardY - 7, 'neighbour coupling c₁', C.violet, { align: 'center', size: 10, plain: true });
        c.globalAlpha = 1;
      }
      return { cxs: cxs, y0: cardY, hW: cardH };
    }
    g.panel(R, o.title); var cxs = [];
    for (var k = 0; k < n; k++) {
      var cx = R[0] + W * (k + 0.5), q = seg(o.p == null ? 1 : o.p, k * 0.1, k * 0.1 + 0.3); cxs.push(cx); if (!(q > 0)) continue;
      var w = o.w ? o.w[k] : 1, bright = o.dim === false ? 1 : 0.3 + 0.7 * w, beacon = isBeacon(k);
      c.globalAlpha = q; c.strokeStyle = C.faint; c.lineWidth = 1.5; c.beginPath(); rrect(c, cx - W * 0.4, y0, W * 0.8, hW, 10); c.stroke();
      var ly = y0 + 40, gl = c.createRadialGradient(cx, ly, 2, cx, ly, 36); gl.addColorStop(0, 'rgba(255,210,122,' + (0.9 * bright).toFixed(3) + ')'); gl.addColorStop(1, 'rgba(255,210,122,0)');
      c.fillStyle = gl; c.beginPath(); c.arc(cx, ly, 36, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,210,122,' + bright.toFixed(3) + ')'; c.beginPath(); c.arc(cx, ly, 9, 0, TAU); c.fill();
      g.labelPx(cx, ly + 30, beacon ? (technical ? 'pilot' : 'Beacon') : (technical ? 'data position ' + k : 'sentry ' + k), beacon ? C.gold : C.ink, { align: 'center', size: 12, plain: true });
      g.labelPx(cx, ly + 48, 'y' + subscript(k) + ' = ' + num(y[k], 2), C.ink, { align: 'center', size: 12, plain: true, mono: true });
      var row = ly + 66;
      if (o.w) { g.labelPx(cx, row, 'w = ' + num(w, 2), w < 0.9 ? C.orange : C.dim, { align: 'center', size: 12, plain: true, mono: true }); row += 18; }
      if (o.leans && !beacon) { g.labelPx(cx, row, (technical ? 'bit coefficient ℓ = ' : 'lean ℓ = ') + num(o.leans[k - 1], 2), C.violet, { align: 'center', size: 12, plain: true, mono: true }); row += 18; }
      var ty = y0 + hW - 16, tx0 = cx - W * 0.3, tx1 = cx + W * 0.3, bk = beacon ? 0 : o.b[k - 1];
      c.strokeStyle = C.faint; c.lineWidth = 3; c.beginPath(); c.moveTo(tx0, ty); c.lineTo(tx1, ty); c.stroke();
      c.fillStyle = beacon ? C.gold : JADE; c.beginPath(); rrect(c, mix(tx0, tx1, bk) - 6, ty - 6, 12, 12, 3); c.fill();
      g.labelPx(cx, ty + 18, beacon ? (technical ? 'known symbol' : 'known, 0') : 'b' + subscript(k) + ' = ' + num(bk, 2), C.dim, { align: 'center', size: 11.5, plain: true, mono: true });
      c.globalAlpha = 1;
    }
    if (o.spill && o.spill > 0) {
      var sy = y0 + 40; c.globalAlpha = clamp(o.spill, 0, 1);
      for (k = 0; k < n - 1; k++) {
        var a = cxs[k] + W * 0.4, b = cxs[k + 1] - W * 0.4;
        g.arrowPx([a + 2, sy - 5], [b - 2, sy - 5], C.violet, 2); g.arrowPx([b - 2, sy + 5], [a + 2, sy + 5], C.violet, 2);
        if (!technical) g.labelPx((a + b) / 2, sy + 20, 'c₁', C.violet, { align: 'center', size: 12, plain: true });
      }
      if (technical) g.labelPx(R[0] + R[2] / 2, y0 - 7, 'neighbour coupling c₁', C.violet, { align: 'center', size: 11, plain: true });
      c.globalAlpha = 1;
    }
    return { cxs: cxs, y0: y0, hW: hW };
  }
  // the readings against the tiles: the Veil's line y = c0 (1 - 2b), each lantern's reading and what the tiles
  // and the Veil predict for it; o: { land, c, b, w, p, title }
  function lanternPlot(g, R, o) {
    var land = o.land, y = land.y, cc = o.c, en = land.energies(cc, o.b), xs = land.xs(o.b), bs = xs.map(function (x) { return (1 - x) / 2; });
    var lo = Infinity, hi = -Infinity; y.forEach(function (v) { lo = Math.min(lo, v); hi = Math.max(hi, v); }); en.forEach(function (e) { lo = Math.min(lo, e.hat); hi = Math.max(hi, e.hat); });
    lo = Math.min(lo, -Math.abs(cc[0])); hi = Math.max(hi, Math.abs(cc[0])); var pad = (hi - lo) * 0.12 || 0.5;
    if (narrow(g)) {
      // At b = 0 three readings share one x-coordinate.  A small legend above the graph is clearer than three
      // labels fighting for that same point.
      g.panel(R, o.title); var legendY = R[1] + 35;
      y.forEach(function (v, k0) {
        var beacon0 = isBeacon(k0), text0 = (beacon0 ? 'B' : 'S') + subscript(k0) + '  ' + num(v, 2), col0 = beacon0 ? C.gold : C.orange;
        g.labelPx(R[0] + R[2] * (k0 % 2 ? 0.55 : 0.08), legendY + 16 * Math.floor(k0 / 2), text0, col0, { size: 10.5, plain: true, mono: true });
      });
      var plotR0 = [R[0] + 2, R[1] + 64, R[2] - 4, Math.max(80, R[3] - 66)], pl0 = g.plot(plotR0, [-0.08, 1.08], [lo - pad, hi + pad], { tTicks: false }); pl0.frame('tile b', 'reading y');
      var c0 = g.ctx, p0 = o.p == null ? 1 : o.p; pl0.curve(function (t) { return cc[0] * (1 - 2 * t); }, JADE, 2, seg(p0, 0.05, 0.4));
      for (var k1 = 0; k1 < 4; k1++) { var q1 = seg(p0, 0.35 + 0.1 * k1, 0.55 + 0.1 * k1); if (!(q1 > 0)) continue; var w1 = o.w ? o.w[k1] : 1, col1 = isBeacon(k1) ? C.gold : C.orange; c0.globalAlpha = 0.35 + 0.65 * w1; pl0.seg(bs[k1], en[k1].hat, bs[k1], y[k1], C.violet, 1.5, q1, [3, 3]); c0.beginPath(); c0.arc(pl0.X(bs[k1]), pl0.Y(en[k1].hat), 4, 0, TAU); c0.strokeStyle = JADE; c0.lineWidth = 2; c0.stroke(); pl0.point(bs[k1], y[k1], col1, '', q1); c0.globalAlpha = 1; }
      return pl0;
    }
    var pl = g.plot(R, [-0.08, 1.08], [lo - pad, hi + pad], { title: o.title, tTicks: false }); pl.frame('tile b (0 shows +1, 1 shows −1)', 'reading y');
    var c = g.ctx; [0, 1].forEach(function (t) { c.strokeStyle = C.faint; c.lineWidth = 1; c.setLineDash([3, 3]); pl.seg(t, lo - pad, t, hi + pad, C.faint, 1, 1, [3, 3]); c.setLineDash([]); });
    g.labelPx(pl.X(0), pl.box[1] + pl.box[3] + 8, '0', C.dim, { align: 'center', size: 11, plain: true }); g.labelPx(pl.X(1), pl.box[1] + pl.box[3] + 8, '1', C.dim, { align: 'center', size: 11, plain: true });
    var p = o.p == null ? 1 : o.p;
    pl.curve(function (t) { return cc[0] * (1 - 2 * t); }, JADE, 2, seg(p, 0.05, 0.4));
    if (seg(p, 0.05, 0.4) >= 1) {   // the Veil's name above the line, or below it on a short plot (a phone), clear of the lanterns' labels
      var short = pl.box[3] < 220, tv = short ? 0.62 : 0.3;
      g.labelPx(pl.X(tv), pl.Y(cc[0] * (1 - 2 * tv)) + (short ? 18 : -16), 'the Veil: y = c₀·(1 − 2b), c₀ = ' + num(cc[0], 2), JADE, { size: 11.5, plain: true, align: 'center' });
    }
    var DY = [-3, 19, -14, 23];   // the three lanterns at b = 0 stack their labels: Beacon beside, sentry 1 below, the other Beacon lower
    for (var k = 0; k < 4; k++) {
      var q = seg(p, 0.35 + 0.1 * k, 0.55 + 0.1 * k); if (!(q > 0)) continue;
      var w = o.w ? o.w[k] : 1, col = isBeacon(k) ? C.gold : C.orange;
      c.globalAlpha = 0.35 + 0.65 * w;
      pl.seg(bs[k], en[k].hat, bs[k], y[k], C.violet, 1.5, q, [3, 3]);
      c.beginPath(); c.arc(pl.X(bs[k]), pl.Y(en[k].hat), 5, 0, TAU); c.strokeStyle = JADE; c.lineWidth = 2; c.stroke();
      pl.point(bs[k], y[k], col, '', q);
      g.labelPx(pl.X(bs[k]) + (bs[k] > 0.5 ? -10 : 10), pl.Y(y[k]) + DY[k], (isBeacon(k) ? 'Beacon' : 'sentry ' + k) + '  y = ' + num(y[k], 2), col, { p: seg(q, 0.4, 1), align: bs[k] > 0.5 ? 'right' : 'left', size: 12 });
      c.globalAlpha = 1;
    }
    return pl;
  }

  // ------------------------------------------------------------ the Candle, the row of towers, the weave, the key
  // o: { p, marks (the circuits the candle lasts), burnt (share burnt), note (text shown when burnt), count }
  function candle(g, R, o) {
    var c = g.ctx, p = o.p == null ? 1 : o.p, cx = R[0] + R[2] * 0.3, top = R[1] + 60, bottom = R[1] + R[3] - 40, Hc = bottom - top, burnt = clamp(o.burnt == null ? p : o.burnt, 0, 1);
    g.panel(R, o.title);
    c.strokeStyle = C.faint; c.lineWidth = 1; c.beginPath(); c.moveTo(cx - 40, bottom); c.lineTo(cx + 40, bottom); c.stroke();
    var h = Math.max(6, Hc * (1 - burnt)), y = bottom - h;
    c.fillStyle = '#f0e4c8'; c.beginPath(); rrect(c, cx - 14, y, 28, h, 4); c.fill();
    for (var m = 0; m <= 10; m++) { var my = bottom - Hc * m / 10; c.strokeStyle = m % 5 ? C.faint : C.dim; c.beginPath(); c.moveTo(cx + 18, my); c.lineTo(cx + (m % 5 ? 26 : 32), my); c.stroke(); if (m % 5 === 0) g.labelPx(cx + 36, my, String(Math.round(o.marks * m / 10)), C.dim, { size: 11, plain: true, mono: true }); }
    if (burnt < 1) { var fl = c.createRadialGradient(cx, y - 10, 1, cx, y - 10, 16); fl.addColorStop(0, 'rgba(255,230,160,0.95)'); fl.addColorStop(1, 'rgba(255,140,40,0)'); c.fillStyle = fl; c.beginPath(); c.ellipse ? c.ellipse(cx, y - 12, 9, 15, 0, 0, TAU) : c.arc(cx, y - 12, 12, 0, TAU); c.fill(); }
    g.labelPx(cx, top - 24, 'circuit ' + Math.round(burnt * o.marks) + ' of ' + o.marks, C.gold, { align: 'center', size: 13, plain: true, mono: true });
    if (o.note && burnt >= 1) { var nx = R[0] + R[2] * 0.62, ny = R[1] + R[3] * 0.4; c.fillStyle = C.box; c.beginPath(); rrect(c, nx - 110, ny - 40, 220, 80, 8); c.fill(); g.labelPx(nx, ny - 14, 'the Herald’s note', C.gold, { align: 'center', size: 12.5, plain: true }); g.labelPx(nx, ny + 12, o.note, C.ink, { align: 'center', size: 12, plain: true }); }
  }
  // Three tiles on tracks with two towers above them; the middle tile answers to both.  o: { land, day (a record of
  // the row walk), from (the previous record), p, title }
  function towers(g, R, o) {
    var c = g.ctx, land = o.land, rec = o.day, prev = o.from, p = o.p == null ? 1 : o.p, n = land.n, W = R[2] / n, ty = R[1] + R[3] - 56;
    if (narrow(g)) {
      // The wide network cannot be shrunk legibly.  Stack its two parity checks and repeat the shared tile in
      // both check cards; a single track at the foot then shows the shared variable's move.
      g.panel(R, o.title); var xL = R[0] + R[2] * 0.27, xR = R[0] + R[2] * 0.73, shared = 1;
      land.checks.forEach(function (ch, a) {
        var q0 = seg(p, 0.05 + 0.1 * a, 0.25 + 0.1 * a); if (!(q0 > 0)) return; var top0 = R[1] + 66 + a * 132, mid0 = (xL + xR) / 2;
        c.globalAlpha = q0; c.strokeStyle = C.blue; c.lineWidth = 2; c.beginPath(); c.moveTo(xL, top0 + 24); c.lineTo(mid0, top0); c.lineTo(xR, top0 + 24); c.stroke();
        var title0 = 'tower ' + (a + 1) + ': tiles ' + (ch[0] + 1) + '–' + (ch[1] + 1) + ' agree'; g.labelPx(mid0, top0 - 15, title0, C.blue, { align: 'center', size: fitSize(g, title0, R[2] - 18, 11.5, 9.5, false), plain: true });
        ch.forEach(function (bit, j) { var e0 = 2 * a + j, ex0 = j ? xR : xL, ey0 = top0 + 34, q2 = seg(p, 0.35 + 0.08 * e0, 0.5 + 0.08 * e0); if (!(q2 > 0)) return; c.globalAlpha = q2; c.fillStyle = C.box; c.beginPath(); rrect(c, ex0 - 57, ey0, 114, 45, 6); c.fill(); var name0 = bit === shared ? 'shared tile 2' : 'tile ' + (bit + 1); g.labelPx(ex0, ey0 + 10, name0 + ' · z ' + num(rec.z[e0], 2), bit === shared ? C.violet : C.blue, { align: 'center', size: fitSize(g, name0 + ' · z ' + num(rec.z[e0], 2), 104, 10.5, 8.5, true), plain: true, mono: true }); g.labelPx(ex0, ey0 + 29, 'ledger u ' + num(rec.u[e0], 2), C.orange, { align: 'center', size: 10, plain: true, mono: true }); });
        c.globalAlpha = 1;
      });
      var yT = R[1] + R[3] - 31, aT = R[0] + 42, bT = R[0] + R[2] - 42, move0 = seg(p, 0.7, 0.95), from0 = prev ? prev.b[shared] : rec.b[shared], bt0 = mix(from0, rec.b[shared], move0);
      c.strokeStyle = C.faint; c.lineWidth = 3; c.beginPath(); c.moveTo(aT, yT); c.lineTo(bT, yT); c.stroke(); [0, 1].forEach(function (t) { c.strokeStyle = C.gold; c.lineWidth = 2; c.beginPath(); c.moveTo(mix(aT, bT, t), yT - 7); c.lineTo(mix(aT, bT, t), yT + 7); c.stroke(); }); c.fillStyle = JADE; c.beginPath(); rrect(c, mix(aT, bT, bt0) - 7, yT - 7, 14, 14, 3); c.fill();
      var moveText = 'shared tile 2: ' + num(from0, 3) + ' → ' + num(bt0, 3) + ' · two Wardens'; g.labelPx((aT + bT) / 2, yT - 19, moveText, C.violet, { align: 'center', size: fitSize(g, moveText, R[2] - 18, 11, 8.5, false), plain: true });
      return [xL, (xL + xR) / 2, xR];
    }
    g.panel(R, o.title); var cxs = [];
    for (var i = 0; i < n; i++) cxs.push(R[0] + W * (i + 0.5));
    land.checks.forEach(function (ch, a) {                 // the towers: a roof over the two sentries they watch
      var q = seg(p, 0.05 + 0.1 * a, 0.25 + 0.1 * a); if (!(q > 0)) return;
      var x0 = cxs[ch[0]], x1 = cxs[ch[1]], top = R[1] + 46 + 118 * a, mid = (x0 + x1) / 2;
      c.globalAlpha = q; c.strokeStyle = C.blue; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, top + 40); c.lineTo(mid, top); c.lineTo(x1, top + 40); c.stroke();
      g.labelPx(mid, top - 12, 'tower ' + (a + 1) + ': tiles ' + (ch[0] + 1) + ' and ' + (ch[1] + 1) + ' must agree', C.blue, { align: 'center', size: 12, plain: true });
      ch.forEach(function (bit, j) {                     // each edge: the Warden's replica and the ledger entry
        var e = 2 * a + j, ex = cxs[bit] + (land.degree[bit] === 2 ? (a === 0 ? -52 : 52) : 0), ey = top + 50, q2 = seg(p, 0.35 + 0.08 * e, 0.5 + 0.08 * e); if (!(q2 > 0)) return;
        c.globalAlpha = q2; c.fillStyle = C.box; c.beginPath(); rrect(c, ex - 46, ey - 4, 92, 36, 5); c.fill();
        g.labelPx(ex, ey + 7, 'z = ' + num(rec.z[e], 2), C.blue, { align: 'center', size: 11.5, plain: true, mono: true });
        g.labelPx(ex, ey + 23, 'u = ' + num(rec.u[e], 2), C.orange, { align: 'center', size: 11.5, plain: true, mono: true });
        c.strokeStyle = C.faint; c.lineWidth = 1; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(ex, ey + 32); c.lineTo(cxs[bit], ty - 14); c.stroke(); c.setLineDash([]);
      });
      c.globalAlpha = 1;
    });
    var move = seg(p, 0.7, 0.95);
    for (i = 0; i < n; i++) {                            // the tiles, sliding from the previous circuit's spot
      var q = seg(p, 0.02 * i, 0.15 + 0.02 * i); if (!(q > 0)) continue;
      var tx0 = cxs[i] - W * 0.32, tx1 = cxs[i] + W * 0.32, b0 = prev ? prev.b[i] : rec.b[i], b1 = rec.b[i], bt = mix(b0, b1, move);
      c.globalAlpha = q; c.strokeStyle = C.faint; c.lineWidth = 3; c.beginPath(); c.moveTo(tx0, ty); c.lineTo(tx1, ty); c.stroke();
      [0, 1].forEach(function (t) { c.strokeStyle = C.gold; c.lineWidth = 2; c.beginPath(); c.moveTo(mix(tx0, tx1, t), ty - 8); c.lineTo(mix(tx0, tx1, t), ty + 8); c.stroke(); });
      c.fillStyle = JADE; c.beginPath(); rrect(c, mix(tx0, tx1, bt) - 7, ty - 7, 14, 14, 3); c.fill();
      g.labelPx(cxs[i], ty + 22, 'tile ' + (i + 1) + ': b = ' + num(bt, 3) + '   lean ℓ = ' + num(land.leans[i], 1), C.ink, { align: 'center', size: 11.5, plain: true, mono: true });
      g.labelPx(cxs[i], ty + 40, land.degree[i] === 2 ? 'two Wardens, two ledgers' : 'one Warden, one ledger', land.degree[i] === 2 ? C.violet : C.dim, { align: 'center', size: 11.5, plain: true });
      c.globalAlpha = 1;
    }
    return cxs;
  }
  // The weave: windows across, nights down; Beacon columns lit; o: { p, title, windows, nights, beacons }
  function weave(g, R, o) {
    var c = g.ctx, p = o.p == null ? 1 : o.p, nw = o.windows || 9, nn = o.nights || 4, x0 = R[0] + 70, y0 = R[1] + 56, cw = Math.min(52, (R[2] - 150) / nw), ch = Math.min(44, (R[3] - 130) / nn);
    g.panel(R, o.title);
    for (var j = 0; j < nn; j++) for (var i = 0; i < nw; i++) {
      var q = seg(p, 0.03 * i + 0.08 * j, 0.2 + 0.03 * i + 0.08 * j); if (!(q > 0)) continue;
      var beacon = o.beacons.indexOf(i) >= 0, X = x0 + i * cw, Y = y0 + j * ch;
      c.globalAlpha = q; c.fillStyle = beacon ? 'rgba(255,210,122,0.75)' : 'rgba(127,214,180,' + (0.25 + 0.12 * ((i * 7 + j * 3) % 4)) + ')'; c.beginPath(); rrect(c, X + 2, Y + 2, cw - 4, ch - 4, 4); c.fill();
      if (beacon && j === 0) g.labelPx(X + cw / 2, Y - 12, 'Beacon', C.gold, { align: 'center', size: 11, plain: true });
      c.globalAlpha = 1;
    }
    for (j = 0; j < nn; j++) g.labelPx(x0 - 8, y0 + j * ch + ch / 2, 'night ' + (j + 1), C.dim, { align: 'right', size: 11.5, plain: true, p: seg(p, 0.08 * j, 0.2 + 0.08 * j) });
    g.labelPx(x0 + nw * cw / 2, y0 + nn * ch + 12, 'windows across the hall →', C.dim, { align: 'center', size: 11.5, plain: true });
    var q1 = seg(p, 0.55, 0.75), q2 = seg(p, 0.75, 0.95);
    if (q1 > 0) { g.arrowPx([x0 + 1.5 * cw, y0 + nn * ch + 34], [x0 + 2.5 * cw, y0 + nn * ch + 34], C.violet, 2); g.labelPx(x0 + 2 * cw, y0 + nn * ch + 50, 'threads beside each other are alike', C.violet, { align: 'center', size: 11.5, p: q1 }); }
    if (q2 > 0) { g.arrowPx([x0 + nw * cw + 14, y0 + ch / 2], [x0 + nw * cw + 14, y0 + ch * 1.5], C.orange, 2); g.labelPx(x0 + nw * cw + 22, y0 + ch, 'tonight = last night, stretched', C.orange, { size: 11.5, p: q2 }); }
  }
  // the key table: rows [element, meaning] revealed in turn
  function keyTable(g, R, rows, p, title) {
    if (narrow(g)) {
      var n0 = rows.length;
      if (n0 <= 5) {
        // The recap is split into short groups on the phone.  Give every metaphor its receiver meaning rather
        // than dropping the second column: the meaning wraps beneath the gold name and may shrink a little.
        var c0 = g.ctx, top0 = R[1] + 38, rowH0 = (R[3] - 44) / Math.max(1, n0), textW0 = R[2] - 24;
        g.panel(R, title);
        rows.forEach(function (r, i) {
          var q0 = seg(p, i / (n0 + 0.5), (i + 1) / (n0 + 0.5)); if (!(q0 > 0)) return;
          var y0 = top0 + rowH0 * i, name0 = '• ' + r[0], nameSize0 = fitSize(g, name0, textW0, 12, 9.5, false);
          var maxLines0 = Math.max(1, Math.floor((rowH0 - 27) / 12)), wrapped0 = fitWrapped(g, r[1], textW0, 10.5, 8.5, maxLines0, false), lineH0 = wrapped0.size + 3;
          g.labelPx(R[0] + 12, y0 + 10, name0, C.gold, { size: nameSize0, plain: true, p: q0 });
          wrapped0.lines.forEach(function (line0, j) { g.labelPx(R[0] + 12, y0 + 29 + lineH0 * j, line0, C.ink, { size: wrapped0.size, plain: true, p: q0 }); });
          if (i < n0 - 1) { c0.globalAlpha = clamp(q0, 0, 1); c0.strokeStyle = C.faint; c0.lineWidth = 1; c0.beginPath(); c0.moveTo(R[0] + 12, y0 + rowH0 - 4); c0.lineTo(R[0] + R[2] - 12, y0 + rowH0 - 4); c0.stroke(); c0.globalAlpha = 1; }
        });
        return;
      }
      // A long unsplit table remains usable as a compact index instead of squeezing meanings into unreadable
      // columns.  The normal course uses the full name-and-meaning form above on three short recap pages.
      var cols0 = n0 > 8 ? 2 : 1, per0 = Math.ceil(n0 / cols0), top1 = R[1] + 62, colW0 = R[2] / cols0, rowH1 = Math.min(39, (R[3] - 72) / per0);
      g.panel(R, title); g.labelPx(R[0] + 10, R[1] + 34, 'Meanings were introduced earlier.', C.dim, { size: 10.5, plain: true });
      rows.forEach(function (r, i) { var q1 = seg(p, i / (n0 + 0.5), (i + 1) / (n0 + 0.5)); if (!(q1 > 0)) return; var col0 = Math.floor(i / per0), row0 = i % per0, x0 = R[0] + col0 * colW0 + 10, y1 = top1 + rowH1 * row0 + rowH1 / 2, text0 = '• ' + r[0]; g.labelPx(x0, y1, text0, C.gold, { size: fitSize(g, text0, colW0 - 18, 11.5, 8.5, false), plain: true, p: q1 }); });
      return;
    }
    var n = rows.length, top = R[1] + 40, rowH = Math.min(40, (R[3] - 50) / n), nameW = Math.min(196, R[2] * 0.3);
    g.panel(R, title);
    rows.forEach(function (r, i) {
      var q = seg(p, i / (n + 0.5), (i + 1) / (n + 0.5)); if (!(q > 0)) return; var y = top + rowH * i + rowH / 2;
      g.labelPx(R[0] + 12, y, r[0], C.gold, { size: 12.5, plain: true, p: q });
      g.labelPx(R[0] + 20 + nameW, y, r[1], C.ink, { size: 12, plain: true, p: q });
    });
  }
  // rows of text lit in turn in a panel: items [{ text, col, mono }]
  function lines(g, R, items, p, title, o) {
    o = o || {}; R = R.slice(); var overflow = R[1] + R[3] - (g.H - 8); if (overflow > 0) R[3] = Math.max(34, R[3] - overflow);
    var n = items.length, top = R[1] + (title ? 44 : (overflow > 0 ? 8 : 16)), rowH = Math.min(o.rowH || 34, (R[3] - (top - R[1]) - 5) / n), tight = rowH < 16;
    g.panel(R, title);
    items.forEach(function (it, i) {
      var q = seg(p, i / (n + 0.4), (i + 1) / (n + 0.4)); if (!(q > 0)) return;
      var size = it.size || (tight ? 10.5 : 12.5);
      if (narrow(g)) size = fitSize(g, it.text, R[2] - 28, size, 8.5, !!it.mono);
      g.labelPx(R[0] + 14, top + rowH * i + rowH / 2, it.text, it.col || C.ink, { size: size, plain: true, mono: !!it.mono, p: q });
    });
  }

  // ------------------------------------------------------------ OFDM-first teaching diagrams
  // These parts use receiver terms as their primary labels.  Colour is always paired with a letter, number,
  // shape or line style so that the mechanism remains legible without colour.  Every helper accepts an options
  // object and draws inside R; p reveals the mechanism in reading order.
  function partTop(R, title) { return R[1] + (title ? 40 : 10); }
  function partProgress(o) { return o && o.p != null ? o.p : 1; }
  function drawCard(g, Bx, text, col, p, o) {
    if (!(p > 0)) return; o = o || {}; var c = g.ctx, fill = o.fill || 'rgba(8,12,18,0.72)', radius = o.radius == null ? 7 : o.radius;
    c.globalAlpha = clamp(p, 0, 1); c.fillStyle = fill; c.strokeStyle = col || C.faint; c.lineWidth = o.lineWidth || 1.5;
    c.beginPath(); rrect(c, Bx[0], Bx[1], Bx[2], Bx[3], radius); c.fill(); c.stroke(); c.globalAlpha = 1;
    var fit = fitWrapped(g, text, Math.max(20, Bx[2] - 12), o.size || 11.5, 10, o.lines || 2, !!o.mono), lh = fit.size + 3;
    fit.lines.slice(0, o.lines || 2).forEach(function (line, i) {
      g.labelPx(Bx[0] + Bx[2] / 2, Bx[1] + Bx[3] / 2 + (i - (fit.lines.length - 1) / 2) * lh, line, o.textCol || col || C.ink,
        { align: 'center', size: fit.size, plain: true, mono: !!o.mono, p: p });
    });
  }
  function drawBracket(g, x0, x1, y, text, col, p, above) {
    if (!(p > 0)) return; var c = g.ctx, d = above ? 6 : -6;
    c.globalAlpha = clamp(p, 0, 1); c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0, y + d); c.lineTo(x0, y); c.lineTo(x1, y); c.lineTo(x1, y + d); c.stroke(); c.globalAlpha = 1;
    g.labelPx((x0 + x1) / 2, y + (above ? -12 : 13), text, col, { align: 'center', size: 10.5, plain: true, p: p });
  }
  function inList(list, a, b) {
    if (!list) return false;
    for (var i = 0; i < list.length; i++) {
      if (Array.isArray(list[i]) && list[i][0] === a && list[i][1] === b) return true;
      if (!Array.isArray(list[i]) && list[i] === a) return true;
    }
    return false;
  }

  // An OFDM resource grid. o: { p, title, carriers, symbols, pilots [[carrier,symbol],...], pilotAt(q,s),
  // focusCarrier, focusSymbol, showLegend }.  Pilot cells say P and data cells say D; focus has a double outline.
  function resourceGrid(g, R, o) {
    o = o || {}; var c = g.ctx, p = partProgress(o), nq = o.carriers || (narrow(g) ? 6 : 8), ns = o.symbols || 4;
    var title = o.title || 'OFDM resource grid', top = partTop(R, title) + 10, left = R[0] + (narrow(g) ? 38 : 58), right = R[0] + R[2] - 12;
    var legendH = o.showLegend === false ? 34 : 58, bottom = R[1] + R[3] - legendH, cw = (right - left) / ns, ch = (bottom - top) / nq;
    g.panel(R, title);
    function pilot(q, s) {
      if (typeof o.pilotAt === 'function') return !!o.pilotAt(q, s);
      if (o.pilots) return inList(o.pilots, q, s);
      return (s % 2 === 0 && (q === 0 || q === nq - 1)) || (s % 2 === 1 && q === Math.floor(nq / 2));
    }
    for (var q = 0; q < nq; q++) for (var s = 0; s < ns; s++) {
      var k = q * ns + s, show = seg(p, k / (nq * ns + 1), (k + 3) / (nq * ns + 1)); if (!(show > 0)) continue;
      var x = left + s * cw + 2, y = top + (nq - 1 - q) * ch + 2, w = Math.max(5, cw - 4), h = Math.max(5, ch - 4), isP = pilot(q, s);
      c.globalAlpha = clamp(show, 0, 1); c.fillStyle = isP ? 'rgba(255,210,122,0.42)' : 'rgba(127,214,180,0.23)'; c.strokeStyle = isP ? C.gold : JADE; c.lineWidth = 1.2;
      c.beginPath(); rrect(c, x, y, w, h, 3); c.fill(); c.stroke();
      c.fillStyle = isP ? C.gold : C.ink; c.font = '700 ' + Math.max(10, Math.min(12, h * 0.48)) + 'px ' + g.sans; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(isP ? 'P' : 'D', x + w / 2, y + h / 2 + 0.5);
      if (q === o.focusCarrier && s === o.focusSymbol) { c.strokeStyle = C.violet; c.lineWidth = 2.5; c.beginPath(); rrect(c, x - 2, y - 2, w + 4, h + 4, 4); c.stroke(); }
      c.globalAlpha = 1;
    }
    c.strokeStyle = C.faint; c.lineWidth = 1; c.beginPath(); c.moveTo(left, top); c.lineTo(left, bottom); c.lineTo(right, bottom); c.stroke();
    for (s = 0; s < ns; s++) g.labelPx(left + (s + 0.5) * cw, bottom + 10, String(s), C.dim, { align: 'center', size: 10, plain: true, mono: true, p: seg(p, 0.2, 0.5) });
    var qStep = nq > 8 ? 2 : 1;
    for (q = 0; q < nq; q += qStep) g.labelPx(left - 8, top + (nq - q - 0.5) * ch, String(q), C.dim, { align: 'right', size: 10, plain: true, mono: true, p: seg(p, 0.2, 0.5) });
    g.labelPx((left + right) / 2, bottom + 26, 'OFDM symbol s →', C.dim, { align: 'center', size: 10.5, plain: true, p: seg(p, 0.35, 0.65) });
    g.labelPx(R[0] + 8, (top + bottom) / 2, 'carrier q', C.dim, { size: 10.5, plain: true, p: seg(p, 0.35, 0.65) });
    if (o.showLegend !== false) {
      var ly = R[1] + R[3] - 9, lx = narrow(g) ? R[0] + R[2] * 0.26 : R[0] + R[2] * 0.34;
      g.labelPx(lx, ly, 'P = known pilot', C.gold, { align: 'center', size: 10.5, plain: true, p: seg(p, 0.65, 0.9) });
      g.labelPx(narrow(g) ? R[0] + R[2] * 0.73 : R[0] + R[2] * 0.68, ly, 'D = coded data', JADE, { align: 'center', size: 10.5, plain: true, p: seg(p, 0.72, 0.97) });
    }
    return { left: left, top: top, right: right, bottom: bottom, cellWidth: cw, cellHeight: ch };
  }

  // Two transmitted OFDM symbols and the receiver FFT window. o: { p, title, cpRatio, channelRatio, adequate,
  // showPreviousTail }.  When the impulse response is longer than the CP, the unmatched part is labelled ISI.
  function cyclicPrefixTimeline(g, R, o) {
    o = o || {}; var c = g.ctx, p = partProgress(o), title = o.title || 'Cyclic prefix and the FFT window'; g.panel(R, title);
    var top = partTop(R, title) + (narrow(g) ? 22 : 28), x0 = R[0] + 16, x1 = R[0] + R[2] - 16, W = x1 - x0;
    var gap = Math.max(5, W * 0.018), sw = (W - gap) / 2, cpRatio = o.cpRatio == null ? 0.22 : clamp(o.cpRatio, 0.08, 0.42), cpw = sw * cpRatio, hRatio = o.channelRatio == null ? (o.adequate === false ? cpRatio * 1.55 : cpRatio * 0.72) : o.channelRatio;
    if (narrow(g)) {
      // Two half-width symbols made the CP, useful interval, channel-memory bracket and ISI callout occupy the
      // same few pixels on a phone.  Stack the symbols and reserve the bottom of the panel for the FFT and result.
      var nx0 = R[0] + 48, nx1 = R[0] + R[2] - 14, nw = nx1 - nx0, ncpw = nw * cpRatio;
      var nTop = partTop(R, title) + 8, nBarH = 36, previousY = nTop + 8, currentY = R[1] + R[3] - 72 - nBarH;
      if (currentY < previousY + nBarH + 22) { nBarH = Math.max(27, (R[1] + R[3] - 94 - previousY) / 2); currentY = previousY + nBarH + 22; }
      function compactSymbol(y, index, q0) {
        c.globalAlpha = clamp(q0, 0, 1); c.fillStyle = 'rgba(255,210,122,0.30)'; c.strokeStyle = C.gold; c.lineWidth = 1.4; c.fillRect(nx0, y, ncpw, nBarH); c.strokeRect(nx0, y, ncpw, nBarH);
        c.fillStyle = 'rgba(169,205,246,0.18)'; c.strokeStyle = C.blue; c.fillRect(nx0 + ncpw, y, nw - ncpw, nBarH); c.strokeRect(nx0 + ncpw, y, nw - ncpw, nBarH); c.globalAlpha = 1;
        g.labelPx(nx0 - 9, y + nBarH / 2, index, C.ink, { align: 'right', size: 10.5, plain: true, mono: true, p: q0 });
        g.labelPx(nx0 + ncpw / 2, y + nBarH / 2, 'CP', C.gold, { align: 'center', size: 10, plain: true, p: q0 });
        g.labelPx(nx0 + ncpw + (nw - ncpw) / 2, y + nBarH / 2, 'useful samples', C.blue, { align: 'center', size: 10, plain: true, p: q0 });
      }
      compactSymbol(previousY, 's−1', seg(p, 0, 0.35)); compactSymbol(currentY, 's', seg(p, 0.12, 0.47));
      var nfft0 = nx0 + ncpw, nfft1 = nx1, nh0 = nx0, nh1 = nx0 + nw * hRatio, ncpEnd = nx0 + ncpw;
      var nAdequate = o.adequate !== false && nh1 <= ncpEnd + 1;
      drawBracket(g, nfft0, nfft1, currentY + nBarH + 8, 'FFT useful interval', C.blue, seg(p, 0.32, 0.62), false);
      drawBracket(g, nh0, nh1, currentY - 9, 'memory Lh−1', nAdequate ? C.green : C.red, seg(p, 0.5, 0.78), true);
      c.globalAlpha = seg(p, 0.62, 0.86); c.strokeStyle = nAdequate ? C.green : C.red; c.lineWidth = 2; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(ncpEnd, currentY - 16); c.lineTo(ncpEnd, currentY + nBarH + 3); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      if (!nAdequate || o.showPreviousTail) {
        var ntail0 = Math.max(nfft0, nh1 - nw * 0.18), ntail1 = Math.min(nfft1, Math.max(nfft0 + 10, nh1));
        c.globalAlpha = seg(p, 0.68, 0.92); c.fillStyle = C.red; c.fillRect(ntail0, currentY + 3, Math.max(4, ntail1 - ntail0), 6); c.globalAlpha = 1;
        g.labelPx(nx1, currentY - 11, 's−1 tail enters here', C.red, { align: 'right', size: 10, plain: true, p: seg(p, 0.72, 0.96) });
      }
      var nCondition = nAdequate ? ['CP covers channel memory', 'no s−1 tail enters the FFT window'] : ['channel memory exceeds the CP', 's−1 tail enters the FFT window'];
      g.labelPx((nx0 + nx1) / 2, R[1] + R[3] - 24, nCondition[0], nAdequate ? C.green : C.red,
        { align: 'center', size: fitSize(g, nCondition[0], R[2] - 24, 10.5, 9.5, false), plain: true, p: seg(p, 0.72, 1) });
      g.labelPx((nx0 + nx1) / 2, R[1] + R[3] - 10, nCondition[1], nAdequate ? C.green : C.red,
        { align: 'center', size: fitSize(g, nCondition[1], R[2] - 24, 10.5, 9.5, false), plain: true, p: seg(p, 0.72, 1) });
      return { firstSymbol: [nx0, previousY, nw, nBarH], currentSymbol: [nx0, currentY, nw, nBarH], fft: [nfft0, nfft1], channelEnd: nh1, adequate: nAdequate };
    }
    var barY = top + (narrow(g) ? 54 : 62), barH = Math.max(58, Math.min(100, R[3] * 0.27));
    function symbol(x, index, q0) {
      c.globalAlpha = clamp(q0, 0, 1); c.fillStyle = 'rgba(255,210,122,0.30)'; c.strokeStyle = C.gold; c.lineWidth = 1.4; c.fillRect(x, barY, cpw, barH); c.strokeRect(x, barY, cpw, barH);
      c.fillStyle = 'rgba(169,205,246,0.18)'; c.strokeStyle = C.blue; c.fillRect(x + cpw, barY, sw - cpw, barH); c.strokeRect(x + cpw, barY, sw - cpw, barH);
      c.globalAlpha = 1; g.labelPx(x + cpw / 2, barY + barH / 2, 'CP', C.gold, { align: 'center', size: 10.5, plain: true, p: q0 });
      g.labelPx(x + cpw + (sw - cpw) / 2, barY + barH / 2, 'useful samples', C.blue, { align: 'center', size: narrow(g) ? 10 : 11.5, plain: true, p: q0 });
      g.labelPx(x + sw / 2, barY - 17, 'symbol ' + index, C.ink, { align: 'center', size: 11, plain: true, p: q0 });
      for (var m = 0; m < 4; m++) { var yy = barY + 10 + m * (barH - 20) / 3; c.globalAlpha = q0; c.strokeStyle = C.gold; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 4, yy); c.lineTo(x + cpw - 4, yy); c.moveTo(x + sw - cpw + 4, yy); c.lineTo(x + sw - 4, yy); c.stroke(); c.globalAlpha = 1; }
    }
    symbol(x0, 's−1', seg(p, 0, 0.35)); symbol(x0 + sw + gap, 's', seg(p, 0.12, 0.47));
    var sx = x0 + sw + gap, fft0 = sx + cpw, fft1 = sx + sw;
    drawBracket(g, fft0, fft1, barY + barH + 19, 'receiver FFT uses the useful interval', C.blue, seg(p, 0.32, 0.62), false);
    var h0 = sx, h1 = sx + sw * hRatio, hy = barY - 38, cpEnd = sx + cpw, adequate = o.adequate !== false && h1 <= cpEnd + 1;
    drawBracket(g, h0, h1, hy, 'channel memory Lh−1', adequate ? C.green : C.red, seg(p, 0.5, 0.78), true);
    c.globalAlpha = seg(p, 0.62, 0.86); c.strokeStyle = adequate ? C.green : C.red; c.lineWidth = 2; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(cpEnd, hy - 7); c.lineTo(cpEnd, barY + barH + 6); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    var condition = adequate ? 'CP covers channel memory: no preceding-symbol tail in the FFT window' : 'channel memory exceeds CP: preceding-symbol tail enters the FFT window';
    g.labelPx((x0 + x1) / 2, R[1] + R[3] - (narrow(g) ? 24 : 28), condition, adequate ? C.green : C.red,
      { align: 'center', size: fitSize(g, condition, R[2] - 24, 11.5, 10, false), plain: true, p: seg(p, 0.72, 1) });
    if (!adequate || o.showPreviousTail) {
      var tail0 = Math.max(fft0, h1 - sw * 0.18), tail1 = Math.min(fft1, Math.max(fft0 + 12, h1));
      c.globalAlpha = seg(p, 0.68, 0.92) * 0.5; c.fillStyle = C.red; c.fillRect(tail0, barY + 3, Math.max(4, tail1 - tail0), barH - 6); c.globalAlpha = 1;
      g.labelPx((tail0 + tail1) / 2, barY + barH / 2, 'ISI', C.red, { align: 'center', size: 10.5, plain: true, p: seg(p, 0.72, 0.96) });
    }
    return { firstSymbol: [x0, barY, sw, barH], currentSymbol: [sx, barY, sw, barH], fft: [fft0, fft1], channelEnd: h1, adequate: adequate };
  }

  // A frequency-domain coupling matrix. o: { p, title, size, band, oneTap, focusRow, showPreviousSymbol,
  // approximation }.  D marks the desired diagonal; I marks intercarrier interference within the current symbol; S marks ISI.
  function iciCouplingMatrix(g, R, o) {
    o = o || {}; var c = g.ctx, p = partProgress(o), title = o.title || (o.oneTap ? 'One-tap diagonal model' : 'Residual Doppler couples carriers'); g.panel(R, '');
    g.labelPx(R[0] + 10, R[1] + 15, title, C.gold, { size: fitSize(g, title, R[2] - 20, 12.5, 9, false), plain: true });
    var isNarrow = narrow(g), n = Math.max(3, Math.min(o.size || (isNarrow ? 6 : 8), isNarrow ? 7 : 10)), top = partTop(R, title) + 14, label = isNarrow ? 34 : 42;
    var priorW = o.showPreviousSymbol ? (isNarrow ? Math.min(74, Math.max(62, R[2] * 0.22)) : 78) : 0, priorGap = o.showPreviousSymbol ? (isNarrow ? 8 : 20) : 0;
    var noteH = isNarrow ? 72 : 54, availW = R[2] - label - 22 - priorW - priorGap, availH = R[3] - (top - R[1]) - noteH;
    var cell = Math.max(isNarrow ? 10 : 13, Math.min(availW / n, availH / n, isNarrow ? 38 : 46)), mw = cell * n, mh = cell * n, left = R[0] + label + Math.max(0, (availW - mw) / 2);
    var band = o.oneTap ? 0 : (o.band == null ? 1 : Math.max(0, o.band));
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      var d = Math.abs(i - j), kind = d === 0 ? 'D' : d <= band ? 'I' : '·', q = seg(p, (i * n + j) / (n * n + 5), (i * n + j + 5) / (n * n + 5)); if (!(q > 0)) continue;
      var x = left + j * cell, y = top + i * cell, focus = i === o.focusRow;
      c.globalAlpha = clamp(q, 0, 1); c.fillStyle = kind === 'D' ? 'rgba(127,214,180,0.42)' : kind === 'I' ? 'rgba(217,194,255,' + (0.14 + 0.18 / Math.max(1, d)) + ')' : 'rgba(255,255,255,0.025)';
      c.strokeStyle = focus ? C.gold : C.faint; c.lineWidth = focus ? 1.5 : 0.8; c.fillRect(x + 1, y + 1, cell - 2, cell - 2); c.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
      if (kind !== '·' && cell >= 22) { c.fillStyle = kind === 'D' ? JADE : C.violet; c.font = '700 ' + Math.max(10, Math.min(12, cell * 0.38)) + 'px ' + g.sans; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(kind, x + cell / 2, y + cell / 2); }
      c.globalAlpha = 1;
    }
    var tickStep = n > 8 ? 2 : 1;
    for (i = 0; i < n; i += tickStep) {
      g.labelPx(left - 7, top + (i + 0.5) * cell, String(i), C.dim, { align: 'right', size: 10, plain: true, mono: true, p: seg(p, 0.25, 0.55) });
      g.labelPx(left + (i + 0.5) * cell, top + mh + 10, String(i), C.dim, { align: 'center', size: 10, plain: true, mono: true, p: seg(p, 0.25, 0.55) });
    }
    g.labelPx(left + mw / 2, top + mh + 27, 'input carrier q →', C.dim, { align: 'center', size: 10.5, plain: true, p: seg(p, 0.35, 0.65) });
    var axisP = seg(p, 0.35, 0.65); if (axisP > 0) {
      c.save(); c.globalAlpha = axisP; c.fillStyle = C.dim; c.font = '600 10.5px ' + g.sans; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.translate(R[0] + 11, top + mh / 2); c.rotate(-Math.PI / 2); c.fillText('output carrier k', 0, 0); c.restore();
    }
    var notes = o.oneTap ? ['D = desired carrier', 'off-diagonal terms = 0'] : ['D = desired   I = neighbouring-carrier coupling'];
    if (o.approximation !== false && !o.oneTap) notes.push('· = omitted by the banded approximation');
    var noteP = seg(p, 0.62, 0.9), noteStart = R[1] + R[3] - (notes.length > 1 ? 25 : 11);
    notes.forEach(function (note, ni) {
      g.labelPx(R[0] + R[2] / 2, noteStart + ni * 15, note, C.ink,
        { align: 'center', size: fitSize(g, note, R[2] - 22, 10.5, 8.5, false), plain: true, p: noteP });
    });
    if (o.showPreviousSymbol) {
      var bx = left + mw + priorGap, bw = priorW, bh = Math.min(isNarrow ? 62 : 72, Math.max(48, mh * (isNarrow ? 0.78 : 0.5))), by = top + Math.max(0, (mh - bh) / 2);
      c.globalAlpha = seg(p, 0.68, 0.94); c.fillStyle = 'rgba(255,154,138,0.20)'; c.strokeStyle = C.red; c.lineWidth = 1.5; c.setLineDash([4, 3]); c.fillRect(bx, by, bw, bh); c.strokeRect(bx, by, bw, bh); c.setLineDash([]); c.globalAlpha = 1;
      g.labelPx(bx + bw / 2, by + bh / 2 - 13, 'S', C.red, { align: 'center', size: 13, plain: true, p: seg(p, 0.7, 0.95) });
      g.labelPx(bx + bw / 2, by + bh / 2 + 3, 'prior symbol', C.red, { align: 'center', size: fitSize(g, 'prior symbol', bw - 6, 10, 8.5, false), plain: true, p: seg(p, 0.72, 0.97) });
      g.labelPx(bx + bw / 2, by + bh / 2 + 16, 'ISI', C.red, { align: 'center', size: 10, plain: true, p: seg(p, 0.72, 0.97) });
    }
    return { matrix: [left, top, mw, mh], size: n, band: band };
  }

  // A single carrier spreading into neighboring received carriers. o: { p, title, carriers, focus, width,
  // corrected }.  Stem labels and D/I tags duplicate the colour coding.
  function carrierMixing(g, R, o) {
    o = o || {}; var c = g.ctx, p = partProgress(o), title = o.title || 'How residual Doppler creates intercarrier interference'; g.panel(R, title);
    var n = Math.max(5, o.carriers || 7), focus = o.focus == null ? Math.floor(n / 2) : clamp(o.focus, 1, n - 2), spread = o.width == null ? 1.15 : Math.max(0.4, o.width);
    var left = R[0] + 24, right = R[0] + R[2] - 18, base = R[1] + R[3] - 52, top = partTop(R, title) + 25, dx = (right - left) / (n - 1), amp = Math.max(60, base - top);
    c.strokeStyle = C.faint; c.lineWidth = 1; c.beginPath(); c.moveTo(left - 8, base); c.lineTo(right + 8, base); c.stroke();
    for (var k = 0; k < n; k++) {
      var dist = Math.abs(k - focus), a = o.corrected ? (dist === 0 ? 0.92 : 0.02) : Math.exp(-dist * dist / (2 * spread * spread)) * (dist === 0 ? 0.92 : 0.46), q = seg(p, k / (n + 2), (k + 2) / (n + 2));
      var x = left + k * dx, h = amp * a, kind = dist === 0 ? 'D' : 'I';
      c.globalAlpha = clamp(q, 0, 1); c.strokeStyle = dist === 0 ? JADE : C.violet; c.lineWidth = dist === 0 ? 5 : 3; c.beginPath(); c.moveTo(x, base); c.lineTo(x, base - h); c.stroke();
      c.fillStyle = dist === 0 ? JADE : C.violet; c.beginPath(); c.arc(x, base - h, dist === 0 ? 6 : 4, 0, TAU); c.fill(); c.globalAlpha = 1;
      g.labelPx(x, base + 13, 'k' + (k === focus ? '' : k < focus ? '−' + (focus - k) : '+' + (k - focus)), C.dim, { align: 'center', size: 10, plain: true, mono: true, p: q });
      if (dist <= 2) g.labelPx(x, base - h - 13, kind, dist === 0 ? JADE : C.violet, { align: 'center', size: 10.5, plain: true, p: q });
    }
    var captions = o.corrected ? ['after correction: energy is concentrated on D'] : ['D = desired carrier', 'I = leakage into neighbouring carriers'];
    captions.forEach(function (caption, i) {
      g.labelPx(R[0] + R[2] / 2, R[1] + R[3] - (captions.length > 1 ? 25 : 12) + i * 15, caption, o.corrected ? C.green : C.ink,
        { align: 'center', size: fitSize(g, caption, R[2] - 24, 11, 9, false), plain: true, p: seg(p, 0.62, 0.92) });
    });
    return { base: base, focusX: left + focus * dx, carrierSpacing: dx };
  }

  // Split one useful OFDM interval into M windows. o: { p, title, views, collapse, carrier, note }.
  // With collapse=false the vector is kept for the joint receiver; collapse=true also shows the M-to-1 scalar output.
  function partialFFTViews(g, R, o) {
    o = o || {}; var c = g.ctx, p = partProgress(o), title = o.title || 'Partial FFT keeps several views of one carrier', M = Math.max(2, Math.min(o.views || 4, 8)); g.panel(R, title);
    var top = partTop(R, title), left = R[0] + 18, right = R[0] + R[2] - 18, stripY = top + 26, stripH = narrow(g) ? 56 : 70, stripW = right - left, segW = stripW / M;
    c.globalAlpha = seg(p, 0, 0.28); c.fillStyle = 'rgba(169,205,246,0.12)'; c.strokeStyle = C.blue; c.lineWidth = 1.5; c.fillRect(left, stripY, stripW, stripH); c.strokeRect(left, stripY, stripW, stripH); c.globalAlpha = 1;
    for (var m = 0; m < M; m++) {
      var q = seg(p, 0.05 + m * 0.06, 0.28 + m * 0.06), x = left + m * segW;
      c.globalAlpha = q; c.fillStyle = m % 2 ? 'rgba(217,194,255,0.12)' : 'rgba(127,214,180,0.12)'; c.fillRect(x + 1, stripY + 1, segW - 2, stripH - 2);
      c.strokeStyle = C.faint; c.lineWidth = 1; c.beginPath(); c.moveTo(x, stripY); c.lineTo(x, stripY + stripH); c.stroke();
      c.strokeStyle = m % 2 ? C.violet : JADE; c.lineWidth = 1.5; c.beginPath();
      for (var j = 0; j <= 24; j++) { var xx = x + j * segW / 24, yy = stripY + stripH / 2 - Math.sin((j / 24 * 2 + m * 0.22) * Math.PI) * stripH * 0.22; if (j) c.lineTo(xx, yy); else c.moveTo(xx, yy); } c.stroke(); c.globalAlpha = 1;
      g.labelPx(x + segW / 2, stripY + stripH + 12, 'window ' + (m + 1), m % 2 ? C.violet : JADE, { align: 'center', size: fitSize(g, 'window ' + (m + 1), segW - 4, 10.5, 10, false), plain: true, p: q });
    }
    c.strokeStyle = C.faint; c.beginPath(); c.moveTo(right, stripY); c.lineTo(right, stripY + stripH); c.stroke();
    g.labelPx((left + right) / 2, stripY - 14, 'same useful interval, divided before the FFT sums', C.ink, { align: 'center', size: fitSize(g, 'same useful interval, divided before the FFT sums', stripW, 11, 10, false), plain: true, p: seg(p, 0.18, 0.45) });
    var vectorTop = stripY + stripH + (narrow(g) ? 48 : 54), gap = narrow(g) ? 4 : 8, vw = Math.min(narrow(g) ? 58 : 82, (stripW - gap * (M - 1)) / M), total = M * vw + (M - 1) * gap, vx0 = (left + right - total) / 2, centers = [];
    for (m = 0; m < M; m++) {
      var vp = seg(p, 0.34 + m * 0.055, 0.55 + m * 0.055), bx = vx0 + m * (vw + gap), txt = 'Y' + subscript(m) + '[k]'; centers.push([bx + vw / 2, vectorTop + 24]);
      drawCard(g, [bx, vectorTop, vw, 48], txt, m % 2 ? C.violet : JADE, vp, { mono: true, size: 11.5, lines: 1 });
      if (vp > 0) { c.globalAlpha = vp; g.arrowPx([left + (m + 0.5) * segW, stripY + stripH + 22], [bx + vw / 2, vectorTop], C.faint, 1.2); c.globalAlpha = 1; }
    }
    var outY = R[1] + R[3] - 46, reveal = seg(p, 0.62, 0.9);
    if (o.collapse) {
      centers.forEach(function (a) { if (reveal > 0) { c.globalAlpha = reveal; g.arrowPx([a[0], vectorTop + 50], [(left + right) / 2, outY - 5], C.orange, 1.2); c.globalAlpha = 1; } });
      drawCard(g, [(left + right) / 2 - Math.min(92, stripW * 0.28), outY - 4, Math.min(184, stripW * 0.56), 38], 'one scalar output Ỹ[k]', C.orange, reveal, { size: 11, lines: 1 });
      g.labelPx((left + right) / 2, outY + 45, o.note || 'M observations compressed to one decoder input', C.orange, { align: 'center', size: fitSize(g, o.note || 'M observations compressed to one decoder input', stripW, 10.5, 10, false), plain: true, p: seg(p, 0.75, 1) });
    } else {
      var jointText = o.note || 'retain the M-component observation vector for the joint fit';
      drawBracket(g, vx0, vx0 + total, outY - 2, 'vector y[k]', JADE, reveal, true);
      g.labelPx((left + right) / 2, outY + 17, jointText, JADE, { align: 'center', size: fitSize(g, jointText, stripW, 10.5, 10, false), plain: true, p: seg(p, 0.72, 1) });
    }
    return { strip: [left, stripY, stripW, stripH], views: centers, collapsed: !!o.collapse };
  }

  // Conventional chain versus joint processing. o: { p, title, mode ('compare'|'conventional'|'joint'),
  // conventional [labels], joint [labels], showSupports, showRepeat }.  The joint row shows pilots and code checks
  // as two different sources of information; neither is drawn as replacing the other.  A return arrow is opt-in so
  // a constrained joint problem is not accidentally presented as detector-decoder feedback.
  function receiverFlow(g, R, o) {
    o = o || {}; var c = g.ctx, p = partProgress(o), title = o.title || 'Conventional and joint OFDM receiver flows', mode = o.mode || 'compare'; g.panel(R, title);
    var conventional = o.conventional || ['received samples', 'FFT + one-tap equalizer', 'channel LLRs', 'LDPC decoder', 'hard bits'];
    var joint = o.joint || ['Partial-FFT observations', 'joint fit of C and b', 'parity-constrained updates', 'parity / CRC candidate test'];
    var top = partTop(R, title) + 6, bottom = R[1] + R[3] - 12, showSupports = o.showSupports !== false;
    function drawHorizontal(labels, y, h, heading, col, start) {
      var headW = narrow(g) ? 0 : 94, x0 = R[0] + 12 + headW, x1 = R[0] + R[2] - 12, gap = 12, w = (x1 - x0 - gap * (labels.length - 1)) / labels.length, boxes = [];
      if (headW) g.labelPx(R[0] + 18, y + h / 2, heading, col, { size: 11.5, plain: true, p: seg(p, start, start + 0.2) });
      labels.forEach(function (lab, i) { boxes.push([x0 + i * (w + gap), y, w, h]); });
      for (var i = 0; i + 1 < boxes.length; i++) { var q = seg(p, start + 0.07 * i, start + 0.22 + 0.07 * i); if (q > 0) { c.globalAlpha = q; g.arrowPx([boxes[i][0] + boxes[i][2], y + h / 2], [boxes[i + 1][0], y + h / 2], col, 1.6); c.globalAlpha = 1; } }
      boxes.forEach(function (b, i) { drawCard(g, b, labels[i], col, seg(p, start + 0.055 * i, start + 0.23 + 0.055 * i), { size: 11, lines: 2 }); });
      return boxes;
    }
    function drawVertical(labels, x, y, w, h, heading, col, start) {
      var gap = 12, headH = 28, bh = (h - headH - gap * (labels.length - 1)) / labels.length, boxes = [];
      g.labelPx(x + w / 2, y + 11, heading, col, { align: 'center', size: fitSize(g, heading, w, 11.5, 10, false), plain: true, p: seg(p, start, start + 0.18) });
      for (var i = 0; i < labels.length; i++) boxes.push([x, y + headH + i * (bh + gap), w, bh]);
      for (i = 0; i + 1 < boxes.length; i++) { var q = seg(p, start + 0.065 * i, start + 0.22 + 0.065 * i); if (q > 0) { c.globalAlpha = q; g.arrowPx([x + w / 2, boxes[i][1] + bh], [x + w / 2, boxes[i + 1][1]], col, 1.5); c.globalAlpha = 1; } }
      boxes.forEach(function (b, i) { drawCard(g, b, labels[i], col, seg(p, start + 0.055 * i, start + 0.22 + 0.055 * i), { size: 10.5, lines: 2 }); });
      return boxes;
    }
    var convBoxes = [], jointBoxes = [];
    if (narrow(g)) {
      var both = mode === 'compare', gapN = 10, colW = both ? (R[2] - 26 - gapN) / 2 : R[2] - 28, colH = bottom - top, xC = R[0] + 14;
      if (mode !== 'joint') convBoxes = drawVertical(conventional, xC, top, colW, colH, 'conventional', C.blue, 0);
      if (mode !== 'conventional') jointBoxes = drawVertical(joint, both ? xC + colW + gapN : xC, top, colW, colH, 'joint', JADE, mode === 'compare' ? 0.12 : 0);
    } else {
      var rows = mode === 'compare' ? 2 : 1, rowGap = 42, rowH = Math.min(72, (bottom - top - rowGap * (rows - 1)) / rows);
      if (mode !== 'joint') convBoxes = drawHorizontal(conventional, top, rowH, 'conventional', C.blue, 0);
      if (mode !== 'conventional') jointBoxes = drawHorizontal(joint, mode === 'compare' ? top + rowH + rowGap : top, rowH, 'joint', JADE, mode === 'compare' ? 0.12 : 0);
    }
    if (jointBoxes.length > 1) {
      var fitBox = jointBoxes[1], checkBox = jointBoxes[Math.min(2, jointBoxes.length - 1)], supportP = seg(p, 0.62, 0.86);
      if (showSupports && supportP > 0) {
        var pilotText = 'P: known pilots anchor C', codeText = 'H: code checks constrain b';
        if (narrow(g)) {
          g.labelPx(fitBox[0] + fitBox[2] / 2, fitBox[1] + 10, 'P anchors C', C.gold, { align: 'center', size: 10, plain: true, p: supportP });
          g.labelPx(checkBox[0] + checkBox[2] / 2, checkBox[1] + checkBox[3] - 10, 'H constrains b', C.violet, { align: 'center', size: 10, plain: true, p: supportP });
        } else {
          g.labelPx(fitBox[0] + fitBox[2] / 2, fitBox[1] - 12, pilotText, C.gold, { align: 'center', size: 10.5, plain: true, p: supportP });
          g.labelPx(checkBox[0] + checkBox[2] / 2, checkBox[1] + checkBox[3] + 13, codeText, C.violet, { align: 'center', size: 10.5, plain: true, p: supportP });
        }
      }
      if (o.showRepeat === true) {
        var repeat = seg(p, 0.74, 0.98), A = [checkBox[0] + checkBox[2] * 0.18, checkBox[1]], B = [fitBox[0] + fitBox[2] * 0.82, fitBox[1] + fitBox[3]];
        if (repeat > 0) { c.globalAlpha = repeat; g.arrowPx(A, B, C.orange, 1.3, [4, 3]); c.globalAlpha = 1; g.labelPx((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, 'repeat', C.orange, { align: 'center', size: 10, plain: true, p: repeat }); }
      }
    }
    return { conventional: convBoxes, joint: jointBoxes };
  }

  // Tanner/parity graph with optional ADMM edge state. o: { p, title, bits, checks, b, z, u, showCopies,
  // showDual }. checks lists zero-based bit indices. Circles are shared bits; squares are local parity checks.
  function parityGraph(g, R, o) {
    o = o || {}; var c = g.ctx, p = partProgress(o), title = o.title || 'Code graph: shared bits and local parity checks', bits = o.bits || 3, checks = o.checks || [[0, 1], [1, 2]]; g.panel(R, title);
    var top = partTop(R, title) + 12, bottom = R[1] + R[3] - (narrow(g) ? 25 : 58), bitPos = [], checkPos = [], i;
    if (narrow(g)) {
      for (i = 0; i < bits; i++) bitPos.push([R[0] + 54, top + (bottom - top) * (i + 0.5) / bits]);
      for (i = 0; i < checks.length; i++) checkPos.push([R[0] + R[2] - 56, top + (bottom - top) * (i + 0.5) / checks.length]);
    } else {
      for (i = 0; i < bits; i++) bitPos.push([R[0] + R[2] * (i + 1) / (bits + 1), bottom]);
      for (i = 0; i < checks.length; i++) checkPos.push([R[0] + R[2] * (i + 1) / (checks.length + 1), top]);
    }
    var edge = 0, edgeInfo = [];
    checks.forEach(function (members, a) { members.forEach(function (bit) {
      if (bit < 0 || bit >= bitPos.length) return; var A = checkPos[a], Bp = bitPos[bit], q = seg(p, 0.08 + edge * 0.045, 0.3 + edge * 0.045), ex = mix(A[0], Bp[0], narrow(g) ? 0.54 : 0.48), ey = mix(A[1], Bp[1], narrow(g) ? 0.54 : 0.48);
      if (q > 0) { c.globalAlpha = q; c.strokeStyle = C.faint; c.lineWidth = 1.5; c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(Bp[0], Bp[1]); c.stroke(); c.globalAlpha = 1; }
      if (o.showCopies !== false && seg(p, 0.32 + edge * 0.04, 0.56 + edge * 0.04) > 0) {
        var valZ = o.z && o.z[edge] != null ? '=' + num(o.z[edge], 2) : '', textZ = 'z' + subscript(edge + 1) + valZ, qp = seg(p, 0.32 + edge * 0.04, 0.56 + edge * 0.04);
        drawCard(g, [ex - 25, ey - (o.showDual === false ? 11 : 18), 50, o.showDual === false ? 22 : 36], textZ, C.blue, qp, { mono: true, size: 10, lines: 1 });
        if (o.showDual !== false) { var valU = o.u && o.u[edge] != null ? '=' + num(o.u[edge], 2) : '', textU = 'u' + subscript(edge + 1) + valU; g.labelPx(ex, ey + 9, textU, C.orange, { align: 'center', size: 10, plain: true, mono: true, p: qp }); }
      }
      edgeInfo.push({ check: a, bit: bit, midpoint: [ex, ey], edge: edge }); edge++;
    }); });
    bitPos.forEach(function (a, bit) {
      var q = seg(p, 0.02 + bit * 0.05, 0.24 + bit * 0.05), value = o.b && o.b[bit] != null ? '=' + num(o.b[bit], 2) : '', textB = 'b' + subscript(bit + 1) + value;
      if (!(q > 0)) return; c.globalAlpha = q; c.fillStyle = 'rgba(127,214,180,0.28)'; c.strokeStyle = JADE; c.lineWidth = 2; c.beginPath(); c.arc(a[0], a[1], narrow(g) ? 24 : 27, 0, TAU); c.fill(); c.stroke(); c.globalAlpha = 1;
      g.labelPx(a[0], a[1], textB, JADE, { align: 'center', size: 10.5, plain: true, mono: true, p: q });
      if (narrow(g)) g.labelPx(a[0], a[1] + 34, 'shared bit', C.dim, { align: 'center', size: 10, plain: true, p: q });
    });
    checkPos.forEach(function (a, k) {
      var q = seg(p, 0.12 + k * 0.07, 0.34 + k * 0.07), w = narrow(g) ? 74 : 86, h = 48;
      drawCard(g, [a[0] - w / 2, a[1] - h / 2, w, h], 'H' + subscript(k + 1) + ': even parity', C.violet, q, { size: 10.5, lines: 2 });
    });
    var legendP = seg(p, 0.7, 1);
    if (narrow(g)) {
      g.labelPx(R[0] + R[2] / 2, R[1] + R[3] - 23, 'circle b: shared bit in [0,1]', C.dim,
        { align: 'center', size: 9.5, plain: true, p: legendP });
      g.labelPx(R[0] + R[2] / 2, R[1] + R[3] - 9, 'square H: local parity check', C.dim,
        { align: 'center', size: 9.5, plain: true, p: legendP });
    } else {
      var legend = 'circle b = shared bit variable in [0,1]   square H = local parity check';
      g.labelPx(R[0] + R[2] / 2, R[1] + R[3] - 10, legend, C.dim,
        { align: 'center', size: fitSize(g, legend, R[2] - 18, 10.5, 9, false), plain: true, p: legendP });
    }
    return { bits: bitPos, checks: checkPos, edges: edgeInfo };
  }

  // Blocks of the joint/augmented objective. o: { p, title, terms [{tag,label,note,col}], result }.
  // The labels, tags and borders all identify a term; colour is supplementary.
  function objectiveBlocks(g, R, o) {
    o = o || {}; var p = partProgress(o), title = o.title || 'What the joint receiver balances'; g.panel(R, title);
    var terms = o.terms || [
      { tag: 'R', label: 'robust data fit', note: 'received samples', col: C.blue },
      { tag: 'P', label: 'pilot anchor', note: 'known symbols', col: C.gold },
      { tag: 'S', label: 'response smoothness', note: 'neighboring coefficients', col: C.violet },
      { tag: 'B', label: 'binary-end pull', note: 'coded-bit variables in [0,1]', col: JADE },
      { tag: 'A', label: 'ADMM consensus', note: 'b, z and u', col: C.orange }
    ];
    var cols = narrow(g) ? 1 : Math.min(3, terms.length), rows = Math.ceil(terms.length / cols), top = partTop(R, title) + 8, foot = 44, gapX = 12, gapY = 12;
    var areaW = R[2] - 24, areaH = R[3] - (top - R[1]) - foot, cw = (areaW - gapX * (cols - 1)) / cols, ch = (areaH - gapY * (rows - 1)) / rows, boxes = [];
    terms.forEach(function (term, i) {
      var row = Math.floor(i / cols), col = i % cols, x = R[0] + 12 + col * (cw + gapX), y = top + row * (ch + gapY), q = seg(p, i / (terms.length + 1), (i + 1.8) / (terms.length + 1)); boxes.push([x, y, cw, ch]);
      drawCard(g, [x, y, cw, ch], '', term.col || C.ink, q, { lines: 1 });
      if (!(q > 0)) return;
      var badge = Math.max(18, Math.min(26, ch * 0.44)); var c = g.ctx; c.globalAlpha = q; c.fillStyle = term.col || C.ink; c.beginPath(); c.arc(x + 12 + badge / 2, y + ch / 2, badge / 2, 0, TAU); c.fill(); c.fillStyle = C.bg; c.font = '700 ' + Math.max(10, badge * 0.48) + 'px ' + g.sans; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(term.tag || String(i + 1), x + 12 + badge / 2, y + ch / 2 + 0.5); c.globalAlpha = 1;
      var tx = x + 24 + badge, tw = cw - 34 - badge, labelSize = fitSize(g, term.label, tw, 11.5, 10, false); g.labelPx(tx, y + ch / 2 - (term.note ? 8 : 0), term.label, term.col || C.ink, { size: labelSize, plain: true, p: q });
      if (term.note) g.labelPx(tx, y + ch / 2 + 11, term.note, C.dim, { size: fitSize(g, term.note, tw, 10.5, 10, false), plain: true, p: q });
    });
    var result = o.result || 'sum = augmented joint objective';
    g.labelPx(R[0] + R[2] / 2, R[1] + R[3] - 17, result, C.ink, { align: 'center', size: fitSize(g, result, R[2] - 24, 12, 10, false), plain: true, mono: true, p: seg(p, 0.72, 1) });
    return boxes;
  }

  // One solver round in its actual order. o: { p, title, steps [string|{tag,label,col}], active, loop,
  // footnote }.  The numbered tags make the sequence independent of colour.
  function updateLoop(g, R, o) {
    o = o || {}; var c = g.ctx, p = partProgress(o), title = o.title || 'One SAPPHIRE update round'; g.panel(R, title);
    var steps = o.steps || [
      { tag: '1', label: 'robust weights', col: C.blue },
      { tag: '2', label: 'majorized bit step', col: JADE },
      { tag: '3', label: 'refresh weights', col: C.blue },
      { tag: '4', label: 'sparse channel solve', col: C.gold },
      { tag: '5', label: 'parity projection', col: C.violet },
      { tag: '6', label: 'scaled-dual update', col: C.orange },
      { tag: '7', label: 'candidate test', col: C.green }
    ].map(function (s) { return typeof s === 'string' ? { label: s } : s; });
    var cols = narrow(g) ? 2 : Math.min(4, steps.length), rows = Math.ceil(steps.length / cols), top = partTop(R, title) + 8, footH = narrow(g) ? 60 : 44, gapX = narrow(g) ? 12 : 20, gapY = 22;
    var areaW = R[2] - 24, areaH = R[3] - (top - R[1]) - footH, cw = (areaW - gapX * (cols - 1)) / cols, ch = Math.min(68, (areaH - gapY * (rows - 1)) / rows), pos = [], boxes = [];
    steps.forEach(function (step, i) {
      var row = Math.floor(i / cols), slot = i % cols, col = row % 2 ? cols - 1 - slot : slot, x = R[0] + 12 + col * (cw + gapX), y = top + row * (ch + gapY); boxes.push([x, y, cw, ch]); pos.push([x + cw / 2, y + ch / 2]);
    });
    for (var i = 0; i + 1 < pos.length; i++) {
      var aq = seg(p, i / (steps.length + 1), (i + 1.5) / (steps.length + 1)); if (!(aq > 0)) continue;
      c.globalAlpha = aq; g.arrowPx(pos[i], pos[i + 1], C.faint, 1.8); c.globalAlpha = 1;
    }
    // Draw the return path before the cards.  It leaves the final card at its edge, runs through the outer
    // gutter, and re-enters the first card at its edge, so neither the path nor its arrowhead crosses a label.
    if (o.loop !== false && boxes.length > 1) {
      var lp = seg(p, 0.78, 1), lastBox = boxes[boxes.length - 1], firstBox = boxes[0], edgeX = R[0] + 3;
      var loopStart = [lastBox[0], lastBox[1] + lastBox[3] / 2], loopEnd = [firstBox[0], firstBox[1] + firstBox[3] / 2];
      if (lp > 0) { c.globalAlpha = lp; c.strokeStyle = C.orange; c.lineWidth = 1.3; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(loopStart[0], loopStart[1]); c.lineTo(edgeX, loopStart[1]); c.lineTo(edgeX, loopEnd[1]); c.stroke(); c.setLineDash([]); g.arrowPx([edgeX, loopEnd[1]], loopEnd, C.orange, 1.3, [5, 4]); c.globalAlpha = 1; }
    }
    steps.forEach(function (step, i) {
      var q = seg(p, i / (steps.length + 1), (i + 1.7) / (steps.length + 1)), col = step.col || C.ink, b = boxes[i];
      drawCard(g, b, step.label, col, q, { size: 11, lines: 2, lineWidth: o.active === i ? 3 : 1.5, fill: o.active === i ? 'rgba(255,210,122,0.12)' : 'rgba(8,12,18,0.72)' });
      if (q > 0) { c.globalAlpha = q; c.fillStyle = col; c.beginPath(); c.arc(b[0] + 15, b[1] + 15, 10, 0, TAU); c.fill(); c.fillStyle = C.bg; c.font = '700 10px ' + g.sans; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(step.tag || String(i + 1), b[0] + 15, b[1] + 15 + 0.5); c.globalAlpha = 1; }
    });
    var foot = o.footnote || 'The candidate test accepts a word; it is not a proof of global optimality.';
    var footFit = fitWrapped(g, foot, R[2] - 22, 10.5, 9, narrow(g) ? 2 : 1, false), footLines = footFit.lines.slice(0, narrow(g) ? 2 : 1), footStart = R[1] + R[3] - (footLines.length > 1 ? 27 : 14);
    footLines.forEach(function (line, fi) { g.labelPx(R[0] + R[2] / 2, footStart + fi * 14, line, C.dim, { align: 'center', size: footFit.size, plain: true, p: seg(p, 0.72, 1) }); });
    return { boxes: boxes, centers: pos };
  }

  // A generic iteration/milestone timeline. o: { p, title, items [{at,label,note,col,shape}], min, max }.
  // Shapes may be circle, square or diamond; labels and tick values remain present without colour.
  function milestoneTimeline(g, R, o) {
    o = o || {}; var c = g.ctx, p = partProgress(o), title = o.title || 'Iteration milestones'; g.panel(R, title);
    var items = o.items || [
      { at: 0, label: 'start', shape: 'circle', col: C.blue },
      { at: 3, label: 'candidate passes', shape: 'diamond', col: C.green },
      { at: 9, label: 'consensus small', shape: 'square', col: C.violet },
      { at: 24, label: 'iteration budget', shape: 'circle', col: C.orange }
    ];
    var lo = o.min == null ? Math.min.apply(null, items.map(function (x) { return x.at; })) : o.min, hi = o.max == null ? Math.max.apply(null, items.map(function (x) { return x.at; })) : o.max; if (!(hi > lo)) hi = lo + 1;
    var vertical = narrow(g), start = vertical ? [R[0] + 54, partTop(R, title) + 20] : [R[0] + 42, R[1] + R[3] * 0.52], end = vertical ? [R[0] + 54, R[1] + R[3] - 28] : [R[0] + R[2] - 42, start[1]];
    c.globalAlpha = seg(p, 0, 0.3); c.strokeStyle = C.faint; c.lineWidth = 3; c.beginPath(); c.moveTo(start[0], start[1]); c.lineTo(end[0], end[1]); c.stroke(); c.globalAlpha = 1;
    var points = [];
    items.forEach(function (it, i) {
      var t = clamp((it.at - lo) / (hi - lo), 0, 1), x = mix(start[0], end[0], t), y = mix(start[1], end[1], t), q = seg(p, 0.12 + i * 0.08, 0.38 + i * 0.08), r = 8, col = it.col || C.ink; points.push([x, y]); if (!(q > 0)) return;
      c.globalAlpha = q; c.fillStyle = col; c.strokeStyle = C.bg; c.lineWidth = 2; c.beginPath();
      if (it.shape === 'square') c.rect(x - r, y - r, 2 * r, 2 * r);
      else if (it.shape === 'diamond') { c.moveTo(x, y - r - 1); c.lineTo(x + r + 1, y); c.lineTo(x, y + r + 1); c.lineTo(x - r - 1, y); c.closePath(); }
      else c.arc(x, y, r, 0, TAU); c.fill(); c.stroke(); c.globalAlpha = 1;
      var tick = 'iteration ' + it.at, label = it.label + (it.note ? ' — ' + it.note : '');
      if (vertical) { g.labelPx(x + 18, y - 8, tick, col, { size: 10, plain: true, mono: true, p: q }); g.labelPx(x + 18, y + 10, label, C.ink, { size: fitSize(g, label, R[2] - 88, 10.5, 10, false), plain: true, p: q }); }
      else { var dy = i % 2 ? 42 : -42; g.labelPx(x, y + (dy > 0 ? 16 : -16), tick, col, { align: 'center', size: 10, plain: true, mono: true, p: q }); g.labelPx(x, y + dy, label, C.ink, { align: 'center', size: fitSize(g, label, Math.max(90, (end[0] - start[0]) / Math.max(1, items.length - 1) - 6), 10.5, 10, false), plain: true, p: q }); }
    });
    return points;
  }

  return { JADE: JADE, shadeOf: shadeOf, axes: axes, square: square, lawLine: lawLine, keepBase: keepBase, corners: corners, warden: warden, herald: herald, heraldPx: heraldPx,
           bitNode: sharedBitMarker, verdict: verdict, track: track, hall: hall, lanternPlot: lanternPlot, candle: candle, towers: towers, weave: weave, keyTable: keyTable, lines: lines,
           resourceGrid: resourceGrid, cyclicPrefixTimeline: cyclicPrefixTimeline, iciCouplingMatrix: iciCouplingMatrix, carrierMixing: carrierMixing,
           partialFFTViews: partialFFTViews, receiverFlow: receiverFlow, parityGraph: parityGraph, objectiveBlocks: objectiveBlocks, updateLoop: updateLoop,
           milestoneTimeline: milestoneTimeline, subscript: subscript, word: word };
})();
