// Drawings for "Five receivers on the Red recordings": bit error rate (BER) plots on a logarithmic axis, one colour and
// marker per receiver, receiver pipelines, the twelve channels, the coverage map and a heat map.  Uses the kit of
// board.js.  The colours follow the soldier tutorial: JADE blue, CAJODE orange, CORAL green.
(function () {
  'use strict';
  var B = window.Board; if (!B) return;
  var H = B.H, C = H.C, clamp = H.clamp, seg = H.seg, num = H.num, TAU = 2 * Math.PI;
  var RX = {
    'ofdm+fec': { name: 'OFDM + FEC', col: '#d4dbe3', shape: 'circle' },
    'pfft+fec': { name: 'Partial FFT + FEC', col: C.violet, shape: 'square' },
    'jade': { name: 'JADE', col: C.blue, shape: 'triangle' },
    'coral': { name: 'CORAL', col: C.green, shape: 'diamond' },
    'cajode': { name: 'CAJODE', col: C.orange, shape: 'pentagon' }
  };
  var ORDER = ['ofdm+fec', 'pfft+fec', 'jade', 'coral', 'cajode'], MISSING = 'rgba(242,245,248,0.28)';
  // berColour records the unrounded value behind each returned colour. Dense matrices can then print a BER-decade
  // cue instead of relying on hue alone; the course's accessible HTML table carries the full values.
  var BER_FILL_META = Object.create(null);
  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function pow10(k) { return '10' + String(k).split('').map(function (ch) { return SUP[ch] || ch; }).join(''); }
  // 3.7×10⁻⁴; a value of at least 0.01 is written plainly
  function sci(v, d) {
    if (v === 0) return '0'; if (v >= 0.01) return num(v, v >= 0.1 ? 2 : 3);
    var e = Math.floor(Math.log(v) / Math.LN10 + 1e-12), m = v / Math.pow(10, e), s = m.toFixed(d == null ? 1 : d);
    if (+s >= 10) { e += 1; s = (v / Math.pow(10, e)).toFixed(d == null ? 1 : d); }
    return s + '×' + pow10(e);
  }
  // 10 with a raised exponent, drawn in two sizes; align 'right' ends the text at x
  function powPx(g, x, y, k, col, o) {
    o = o || {}; var c = g.ctx, size = o.size || 11, small = Math.round(size * 0.78), base = '10', exp = String(k).replace('-', '−');
    c.save(); c.globalAlpha = o.p == null ? 1 : clamp(o.p, 0, 1); c.fillStyle = col || C.dim; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.font = size + 'px ' + g.sans; var w1 = c.measureText(base).width; c.font = small + 'px ' + g.sans; var w2 = c.measureText(exp).width;
    var x0 = o.align === 'right' ? x - w1 - w2 - 1 : o.align === 'center' ? x - (w1 + w2 + 1) / 2 : x;
    c.font = size + 'px ' + g.sans; c.fillText(base, x0, y + 0.5); c.font = small + 'px ' + g.sans; c.fillText(exp, x0 + w1 + 1, y - size * 0.38);
    c.restore();
  }
  function group(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function rrect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  // a receiver's marker; o.hollow draws its outline on the night background, o.alpha fades it
  function marker(c, x, y, shape, r, col, o) {
    o = o || {}; c.save(); c.globalAlpha = o.alpha == null ? 1 : clamp(o.alpha, 0, 1); c.beginPath();
    if (shape === 'circle') c.arc(x, y, r, 0, TAU);
    else if (shape === 'square') c.rect(x - r * 0.88, y - r * 0.88, r * 1.76, r * 1.76);
    else {
      var n = shape === 'triangle' ? 3 : shape === 'diamond' ? 4 : 5, rr = shape === 'triangle' ? r * 1.25 : shape === 'diamond' ? r * 1.2 : r * 1.1;
      for (var i = 0; i < n; i++) { var a = -Math.PI / 2 + i * TAU / n; if (i) c.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); else c.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); }
      c.closePath();
    }
    if (o.hollow) { c.fillStyle = C.bg; c.fill(); c.lineWidth = 1.8; c.strokeStyle = col; c.stroke(); }
    else { c.fillStyle = col; c.fill(); c.lineWidth = 1.2; c.strokeStyle = C.bg; c.stroke(); }
    c.restore();
  }
  function rxMarker(c, x, y, id, r, o) { marker(c, x, y, RX[id].shape, r, RX[id].col, o); }

  // A BER plot: the signal-to-noise ratio (SNR) in dB along the bottom, the information BER on a logarithmic axis up
  // the side.  o: { title, x: [0, 30], decades: [-6, 0], curves: [{ id, pts, p, alpha }], ref, refLabel, compact }.
  // pts[i] = { snr, ber, plot, zero } or null.  A point with no observed error is drawn hollow at its plotting value
  // with a short arrow down: a plotting position, not a measured BER or an upper bound.  Returns X, Y and the plotting box.
  function berPlot(g, R, o) {
    o = o || {}; var c = g.ctx, compact = !!o.compact;
    var L = R[0] + (compact ? 36 : 52), Rt = R[0] + R[2] - (compact ? 10 : 16), T = R[1] + (o.title ? (compact ? 28 : 54) : 30), Bt = R[1] + R[3] - (compact ? 22 : 34);
    var xr = o.x || [0, 30], dr = o.decades || [-6, 0];
    function X(s) { return L + (s - xr[0]) / (xr[1] - xr[0]) * (Rt - L); }
    function Y(b) { var lg = b > 0 ? Math.log(b) / Math.LN10 : dr[0] - 1; return Bt - (clamp(lg, dr[0] - 0.4, dr[1]) - dr[0]) / (dr[1] - dr[0]) * (Bt - T); }
    g.panel(R, o.title);
    c.save(); c.lineWidth = 1; c.strokeStyle = 'rgba(242,245,248,0.08)';
    var d, s, xstep = compact ? 10 : 5, dstep = compact && dr[1] - dr[0] > 4 ? 2 : 1;
    for (d = dr[0]; d <= dr[1]; d++) { c.beginPath(); c.moveTo(L, Y(Math.pow(10, d))); c.lineTo(Rt, Y(Math.pow(10, d))); c.stroke(); }
    for (s = xr[0]; s <= xr[1]; s += xstep) { c.beginPath(); c.moveTo(X(s), T); c.lineTo(X(s), Bt); c.stroke(); }
    c.strokeStyle = C.faint; c.beginPath(); c.moveTo(L, T - 4); c.lineTo(L, Bt); c.lineTo(Rt, Bt); c.stroke();
    c.restore();
    for (d = dr[0]; d <= dr[1]; d += dstep) powPx(g, L - 5, Y(Math.pow(10, d)), d, C.dim, { size: compact ? 10 : 11.5, align: 'right' });
    c.save(); c.font = (compact ? '10px ' : '11px ') + g.mono; c.fillStyle = C.dim; c.textAlign = 'center'; c.textBaseline = 'top';
    for (s = xr[0]; s <= xr[1]; s += xstep) c.fillText(String(s), X(s), Bt + 4);
    if (!compact) {
      c.font = '600 12px ' + g.sans; c.fillStyle = C.ink; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText('SNR (dB)', Rt, Bt + 17);
      c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillText('information BER', L - 40, T - 9);
    }
    c.restore();
    if (o.ref) {
      var yr = Y(o.ref); c.save(); c.globalAlpha = o.refP == null ? 1 : clamp(o.refP, 0, 1); c.strokeStyle = 'rgba(255,210,122,0.6)'; c.lineWidth = 1.2; c.setLineDash([5, 4]);
      c.beginPath(); c.moveTo(L, yr); c.lineTo(Rt, yr); c.stroke(); c.restore();
      if (o.refLabel) g.labelPx(Rt - 4, yr - 9, o.refLabel, C.gold, { align: 'right', plain: true, size: compact ? 10 : 11.5, p: o.refP == null ? 1 : o.refP });
    }
    (o.curves || []).forEach(function (cv) { drawCurve(g, X, Y, cv, compact); });
    return { X: X, Y: Y, box: [L, T, Rt - L, Bt - T] };
  }
  function drawCurve(g, X, Y, cv, compact) {
    var p = cv.p == null ? 1 : cv.p; if (!(p > 0)) return;
    var c = g.ctx, st = RX[cv.id], pts = cv.pts, n = pts.length, upto = p * (n - 1), r = compact ? 2.8 : 4.2, al = cv.alpha == null ? 1 : cv.alpha;
    c.save(); c.globalAlpha = al; c.strokeStyle = st.col; c.lineWidth = compact ? 1.5 : 2; c.lineJoin = 'round';
    for (var i = 1; i < n && i - 1 < upto; i++) {
      var a = pts[i - 1], b = pts[i]; if (!a || !b) continue;
      var f = Math.min(1, upto - (i - 1)), xa = X(a.snr), ya = Y(a.plot), xb = X(b.snr), yb = Y(b.plot);
      c.setLineDash(a.zero || b.zero ? [3, 3] : []);
      c.beginPath(); c.moveTo(xa, ya); c.lineTo(xa + (xb - xa) * f, ya + (yb - ya) * f); c.stroke();
    }
    c.setLineDash([]); c.restore();
    for (var j = 0; j < n && j <= upto + 1e-9; j++) {
      var q = pts[j]; if (!q) continue;
      var x = X(q.snr), y = Y(q.plot);
      if (q.zero) {
        marker(c, x, y, st.shape, r, st.col, { hollow: true, alpha: al });
        zeroArrow(c, x, y + r + 1, st.col, al, compact ? 0.8 : 1);
      } else marker(c, x, y, st.shape, r, st.col, { alpha: al });
    }
  }

  // the "below this" arrow under a point with no error seen
  function zeroArrow(c, x, y, col, alpha, k) {
    k = k || 1; c.save(); c.globalAlpha = clamp(alpha == null ? 1 : alpha, 0, 1); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 8 * k); c.stroke();
    c.beginPath(); c.moveTo(x - 3.8 * k, y + 7 * k); c.lineTo(x + 3.8 * k, y + 7 * k); c.lineTo(x, y + 12.5 * k); c.closePath(); c.fill(); c.restore();
  }
  // the receivers' key: marker and name in a row (or a column), each fading in with p
  function legend(g, x, y, ids, o) {
    o = o || {}; var c = g.ctx, size = o.size || 12, gap = o.gap || 18, xx = x, yy = y;
    ids.forEach(function (id, i) {
      var q = o.p == null ? 1 : seg(o.p, i / ids.length * 0.6, i / ids.length * 0.6 + 0.4); if (!(q > 0)) return;
      rxMarker(c, xx + 6, yy, id, size * 0.36, { alpha: q });
      g.labelPx(xx + 16, yy, RX[id].name, RX[id].col, { plain: true, size: size, p: q });
      c.font = '600 ' + size + 'px ' + g.sans; var w = c.measureText(RX[id].name).width;
      if (o.vertical) yy += o.rowH || size + 9; else { xx += w + 16 + gap; if (o.wrap && xx > o.wrap && i < ids.length - 1) { xx = x; yy += size + 9; } }
    });
  }

  // a receiver as a row of boxes joined by arrows; o: { title, col, boxes, q, back (a feedback label), none (a crossed
  // back arrow with its label), y, h }.  Narrow stages stack the boxes in two rows.
  function pipeline(g, R, o) {
    var c = g.ctx, q = o.q == null ? 1 : o.q, nb = o.boxes.length, narrow = R[2] < 560, col = o.col;
    var top = o.y == null ? R[1] + 34 : o.y, size = narrow ? 10.5 : 11.5;
    g.labelPx(R[0] + 14, top, o.title, col, { plain: true, size: narrow ? 12 : 13, p: seg(q, 0, 0.15) });
    var perRow = o.perRow || (narrow ? Math.ceil(nb / 2) : nb), gap = narrow ? 14 : 18, bw = (R[2] - 28 - gap * (perRow - 1)) / perRow, bh = o.h || (narrow ? 40 : 46), rowGap = o.rowGap || 24;
    var pos = o.boxes.map(function (t, i) { var row = Math.floor(i / perRow), k = i % perRow; if (row % 2) k = perRow - 1 - k; return [R[0] + 14 + k * (bw + gap), top + 18 + row * (bh + rowGap)]; });
    o.boxes.forEach(function (t, i) {
      var s = seg(q, 0.1 + 0.6 * i / nb, 0.1 + 0.6 * (i + 1) / nb); if (!(s > 0)) return;
      var P = pos[i]; c.save(); c.globalAlpha = s; c.fillStyle = 'rgba(255,255,255,0.05)'; c.strokeStyle = col; c.lineWidth = 1.4;
      c.beginPath(); rrect(c, P[0], P[1], bw, bh, 7); c.fill(); c.stroke(); c.restore();
      fitText(g, P[0] + bw / 2, P[1] + bh / 2, t, C.ink, bw - 10, size, s);
      if (i) {
        var A = pos[i - 1], sameRow = Math.abs(A[1] - P[1]) < 1;
        c.save(); c.globalAlpha = s;
        if (sameRow) { var dir = P[0] > A[0] ? 1 : -1; g.arrowPx([dir > 0 ? A[0] + bw + 2 : A[0] - 2, A[1] + bh / 2], [dir > 0 ? P[0] - 2 : P[0] + bw + 2, P[1] + bh / 2], col, 1.4); }
        else g.arrowPx([A[0] + bw / 2, A[1] + bh + 2], [P[0] + bw / 2, P[1] - 2], col, 1.4);
        c.restore();
      }
    });
    var last = pos[nb - 1], first = pos[0], yb = Math.max(last[1], first[1]) + bh + 16, qb = seg(q, 0.75, 0.95);
    if (o.back && qb > 0 && Math.abs(last[0] - first[0]) < 1 && last[1] > first[1]) {
      // the last box sits under the first: the feedback goes straight up between the two rows
      var xs = first[0] + bw * 0.3; c.save(); c.globalAlpha = qb; c.strokeStyle = col; c.lineWidth = 1.3; c.setLineDash([5, 4]);
      c.beginPath(); c.moveTo(xs, last[1] - 2); c.lineTo(xs, first[1] + bh + 8); c.stroke(); c.setLineDash([]); g.arrowPx([xs, first[1] + bh + 9], [xs, first[1] + bh + 2], col, 1.3); c.restore();
      g.labelPx(xs + 10, (first[1] + bh + last[1]) / 2, o.back, col, { plain: true, size: narrow ? 10.5 : 12, p: qb });
      return last[1] + bh + 26;
    }
    if ((o.back || o.none) && qb > 0) {
      var xa = last[0] + bw / 2, xf = first[0] + bw / 2;
      c.save(); c.globalAlpha = qb; c.strokeStyle = o.none ? 'rgba(242,245,248,0.45)' : col; c.lineWidth = 1.3; c.setLineDash([5, 4]);
      c.beginPath(); c.moveTo(xa, last[1] + bh + 2); c.lineTo(xa, yb); c.lineTo(xf, yb); c.lineTo(xf, first[1] + bh + 6); c.stroke(); c.setLineDash([]); c.restore();
      if (o.none) { var xm = (xa + xf) / 2; c.save(); c.globalAlpha = qb; c.strokeStyle = C.red; c.lineWidth = 2; c.beginPath(); c.moveTo(xm - 7, yb - 7); c.lineTo(xm + 7, yb + 7); c.moveTo(xm + 7, yb - 7); c.lineTo(xm - 7, yb + 7); c.stroke(); c.restore(); }
      else { c.save(); c.globalAlpha = qb; g.arrowPx([xf, yb], [xf, first[1] + bh + 2], col, 1.3); c.restore(); }
      g.labelPx((xa + xf) / 2, yb + 15, o.back || o.none, o.none ? C.dim : col, { plain: true, size: narrow ? 10.5 : 11.5, align: 'center', p: qb });
    }
    return yb + 26;
  }

  // CAJODE is one constrained optimization problem with an internal ADMM schedule.  It deliberately does not use
  // pipeline(): a receiver-style return arrow would make the numerical iteration look like decoder feedback.
  function cajodeSolver(g, R, o) {
    o = o || {}; var c = g.ctx, p = o.p == null ? 1 : o.p, col = o.col || RX.cajode.col, narrow = R[2] < 560;
    g.panel(R, narrow ? 'CAJODE: objective + ADMM iteration' : 'one objective function and one ADMM iteration');

    var margin = narrow ? 11 : 14, x = R[0] + margin, w = R[2] - 2 * margin, top = R[1] + 36;
    var oh = narrow ? 124 : 142, qo = seg(p, 0, 0.24);
    c.save(); c.globalAlpha = qo; c.fillStyle = 'rgba(255,176,113,0.055)'; c.strokeStyle = col; c.lineWidth = 1.5;
    c.beginPath(); rrect(c, x, top, w, oh, 9); c.fill(); c.stroke(); c.restore();
    g.labelPx(x + 12, top + (narrow ? 14 : 16), 'ONE OBJECTIVE FUNCTION AND ITS CONSTRAINTS', col, { plain: true, size: narrow ? 10.5 : 12, p: qo });
    g.labelPx(x + w / 2, top + (narrow ? 37 : 42), 'min over C, b, {zₐ}   J(C, b)', C.ink, { plain: true, size: narrow ? 14 : 17, align: 'center', p: qo });

    if (narrow) {
      g.labelPx(x + w / 2, top + 59, 'J: received ↔ predicted samples; C ↔ estimate from pilots', C.dim, { plain: true, size: 10.2, align: 'center', p: qo });
      g.labelPx(x + w / 2, top + 75, '+ adjacent C differences + β Σ bᵢ(1−bᵢ)', C.dim, { plain: true, size: 10.2, align: 'center', p: qo });
      g.labelPx(x + w / 2, top + 98, 'constraints: b ∈ [0,1]ⁿ; configured bits held', C.gold, { plain: true, size: 9.9, align: 'center', p: qo });
      g.labelPx(x + w / 2, top + 115, 'zₐ ∈ Pₐ   and   zₐ = b_N(a)', C.gold, { plain: true, size: 9.9, align: 'center', p: qo });
    } else {
      var terms = ['received vs predicted', 'near estimate from pilots', 'adjacent carriers', 'adjacent symbols', 'β Σ bᵢ(1−bᵢ)'];
      var tg = 7, tw = (w - 24 - tg * (terms.length - 1)) / terms.length, ty = top + 59, th = 27;
      terms.forEach(function (term, i) {
        var tx = x + 12 + i * (tw + tg); c.save(); c.globalAlpha = qo; c.fillStyle = 'rgba(255,255,255,0.045)'; c.strokeStyle = C.faint; c.lineWidth = 1;
        c.beginPath(); rrect(c, tx, ty, tw, th, 6); c.fill(); c.stroke(); c.restore();
        fitText(g, tx + tw / 2, ty + th / 2, term, C.dim, tw - 8, 10.5, qo);
      });
      g.labelPx(x + w / 2, top + 108, 'b ∈ [0,1]ⁿ; configured bits held; zₐ ∈ Pₐ; zₐ = b_N(a)', C.gold, { plain: true, size: 11.5, align: 'center', p: qo });
      g.labelPx(x + w / 2, top + 128, 'C: channel response   b: shared relaxed bits   zₐ: check a’s local copy', C.dim, { plain: true, size: 10.8, align: 'center', p: qo });
    }

    var headingY = top + oh + (narrow ? 18 : 20), qh = seg(p, 0.2, 0.34);
    g.labelPx(x, headingY, 'ONE ADMM ITERATION — NOT A DECODER ITERATION', col, { plain: true, size: narrow ? 10.5 : 12, p: qh });
    var labels = ['1  one weight|per observation', '2  relaxed bits b|majorization–minimization', '3  recompute weights|after b moves',
                  '4  channel response C|solve its linear system', '5  local copies zₐ|project onto Pₐ', '6  scaled duals uₐ|uₐ ← uₐ + b_N(a) − zₐ'];
    var cols = narrow ? 2 : 3, gapX = narrow ? 12 : 16, gapY = narrow ? 7 : 13, bh = narrow ? 39 : 55;
    var bw = (w - gapX * (cols - 1)) / cols, gridTop = headingY + (narrow ? 14 : 15);
    var pos = labels.map(function (_, i) {
      var row = Math.floor(i / cols), k = i % cols; if (row % 2) k = cols - 1 - k;
      return [x + k * (bw + gapX), gridTop + row * (bh + gapY)];
    });
    labels.forEach(function (label, i) {
      var qs = seg(p, 0.3 + 0.42 * i / labels.length, 0.3 + 0.42 * (i + 1) / labels.length), pt = pos[i]; if (!(qs > 0)) return;
      c.save(); c.globalAlpha = qs; c.fillStyle = 'rgba(255,255,255,0.05)'; c.strokeStyle = col; c.lineWidth = 1.35;
      c.beginPath(); rrect(c, pt[0], pt[1], bw, bh, 7); c.fill(); c.stroke(); c.restore();
      fitText(g, pt[0] + bw / 2, pt[1] + bh / 2, label, C.ink, bw - 10, narrow ? 9.3 : 11, qs);
      if (i) {
        var prev = pos[i - 1], sameRow = Math.abs(prev[1] - pt[1]) < 1; c.save(); c.globalAlpha = qs;
        if (sameRow) {
          var dir = pt[0] > prev[0] ? 1 : -1;
          g.arrowPx([dir > 0 ? prev[0] + bw + 2 : prev[0] - 2, prev[1] + bh / 2], [dir > 0 ? pt[0] - 2 : pt[0] + bw + 2, pt[1] + bh / 2], col, 1.35);
        } else g.arrowPx([prev[0] + bw / 2, prev[1] + bh + 2], [pt[0] + bw / 2, pt[1] - 2], col, 1.35);
        c.restore();
      }
    });

    var rows = Math.ceil(labels.length / cols), gridBottom = gridTop + rows * bh + (rows - 1) * gapY, qstate = seg(p, 0.68, 0.82);
    var sx = x + w * 0.34, ex = x + w * 0.66, stateY = gridBottom + (narrow ? 13 : 17);
    g.labelPx(sx - 9, stateY, 'state k', C.dim, { plain: true, size: narrow ? 10 : 11, align: 'right', p: qstate });
    c.save(); c.globalAlpha = qstate; g.arrowPx([sx, stateY], [ex, stateY], col, 1.35); c.restore();
    g.labelPx(ex + 9, stateY, 'state k + 1', C.dim, { plain: true, size: narrow ? 10 : 11, p: qstate });

    var ay = gridBottom + (narrow ? 28 : 34), ah = narrow ? 64 : 61, qa = seg(p, 0.8, 1);
    c.save(); c.globalAlpha = qa; c.fillStyle = 'rgba(255,210,122,0.055)'; c.strokeStyle = C.gold; c.lineWidth = 1.35;
    c.beginPath(); rrect(c, x, ay, w, ah, 8); c.fill(); c.stroke(); c.restore();
    g.labelPx(x + 11, ay + 15, 'AFTER THE ITERATION: CHECK THE THRESHOLDED BITS', C.gold, { plain: true, size: narrow ? 9.7 : 11.5, p: qa });
    g.labelPx(x + w / 2, ay + (narrow ? 34 : 35), 'threshold b → parity → configured fixed bits → CRC', C.ink, { plain: true, size: narrow ? 10.2 : 12, align: 'center', p: qa });
    g.labelPx(x + w / 2, ay + (narrow ? 54 : 53), 'passing these checks ≠ ADMM convergence; at most 50 iterations here', C.dim, { plain: true, size: narrow ? 9.1 : 10.8, align: 'center', p: qa });
  }
  // the largest bold size, from start down to 8, at which text fits maxW
  function fitSize(g, text, maxW, start) { var c = g.ctx, s = start; while (s > 8) { c.font = '600 ' + s + 'px ' + g.sans; if (c.measureText(text).width <= maxW) break; s -= 0.5; } return s; }
  // text centred at (x, y), shrunk until it fits maxW; two lines when it holds a '|'
  function fitText(g, x, y, text, col, maxW, start, p) {
    var c = g.ctx, lines = text.split('|'), s = start;
    while (s > 8.5) { c.font = '600 ' + s + 'px ' + g.sans; if (lines.every(function (l) { return c.measureText(l).width <= maxW; })) break; s -= 0.5; }
    lines.forEach(function (l, i) { g.labelPx(x, y + (i - (lines.length - 1) / 2) * (s + 3), l, col, { plain: true, size: s, align: 'center', p: p }); });
  }

  // the twelve channels as tiles: recordings down, hydrophones across.  o.cell(c) returns { col, alpha, text, sub }.
  function tiles(g, R, chans, o) {
    var c = g.ctx, cols = 3, rows = 4, gap = o.gap || 8, lw = o.labelW || 62, top = R[1] + (o.top || 30);
    var tw = (R[2] - lw - gap * (cols - 1) - 12) / cols, th = Math.min(o.maxH || 60, (R[3] - (o.top || 30) - gap * (rows - 1) - 26) / rows);
    for (var h = 1; h <= cols; h++) g.labelPx(R[0] + lw + (h - 1) * (tw + gap) + tw / 2, top - 10, 'hydrophone ' + h, C.dim, { plain: true, size: 11, align: 'center', p: o.p });
    chans.forEach(function (ch, i) {
      var x = R[0] + lw + (ch.hyd - 1) * (tw + gap), y = top + (ch.red - 1) * (th + gap), st = o.cell(ch, i) || {};
      if (ch.hyd === 1) g.labelPx(R[0] + 8, y + th / 2, 'Red ' + ch.red, C.ink, { plain: true, size: 12, p: o.p });
      var q = st.p == null ? (o.p == null ? 1 : o.p) : st.p; if (!(q > 0)) return;
      c.save(); c.globalAlpha = q * (st.alpha == null ? 1 : st.alpha); c.fillStyle = st.fill || 'rgba(255,255,255,0.06)'; c.strokeStyle = st.col || C.faint; c.lineWidth = st.lw || 1.2;
      c.beginPath(); rrect(c, x, y, tw, th, 6); c.fill(); c.stroke(); c.restore();
      if (st.hatch) hatch(c, x, y, tw, th, q);
      if (st.text) g.labelPx(x + tw / 2, y + th / 2 - (st.sub ? 8 : 0), st.text, st.textCol || C.ink, { plain: true, size: st.size || 12, align: 'center', p: q });
      if (st.sub) g.labelPx(x + tw / 2, y + th / 2 + 9, st.sub, st.subCol || C.dim, { plain: true, size: st.subSize || 10.5, align: 'center', p: q });
    });
    return { tw: tw, th: th, top: top, bottom: top + rows * th + (rows - 1) * gap };
  }
  function hatch(c, x, y, w, h, q) {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.globalAlpha = clamp(q, 0, 1) * 0.5; c.strokeStyle = MISSING; c.lineWidth = 1;
    for (var t = -h; t < w; t += 7) { c.beginPath(); c.moveTo(x + t, y + h); c.lineTo(x + t + h, y); c.stroke(); }
    c.restore();
  }

  // a matrix of cells: rows of receivers, columns of anything; cell(r, k) returns { fill, text, textCol, hatch }
  function matrix(g, R, o) {
    var c = g.ctx, nr = o.rows.length, nc = o.cols.length, compact = R[2] < 560, dense = compact && nc >= 9;
    var lw = dense ? Math.min(o.labelW || 104, 88) : o.labelW || 132, top = R[1] + (o.top || 52), gap = dense ? 2 : 4;
    var cw = (R[2] - lw - 16 - gap * (nc - 1)) / nc, ch = Math.min(o.maxH || 46, (R[3] - (o.top || 52) - 20 - gap * (nr - 1)) / nr);
    o.cols.forEach(function (t, k) {
      var heading = String(t), m = dense && heading.match(/^(R\d+)(h\d+)$/); if (m) heading = m[1] + '|' + m[2];
      fitText(g, R[0] + lw + k * (cw + gap) + cw / 2, top - 14, heading, C.dim, Math.max(10, cw + gap - 2), dense ? 9.5 : o.headSize || 11, o.p == null ? 1 : o.p);
    });
    var sawBer = false;
    o.rows.forEach(function (id, r) {
      var y = top + r * (ch + gap), q = o.p == null ? 1 : seg(o.p, 0.1 + 0.5 * r / nr, 0.3 + 0.5 * r / nr);
      if (RX[id]) {
        rxMarker(c, R[0] + (compact ? 11 : 16), y + ch / 2, id, compact ? 4.2 : 5, { alpha: q });
        if (compact) {
          var shortName = { 'ofdm+fec': 'OFDM +|FEC', 'pfft+fec': 'Partial FFT|+ FEC' }[id] || RX[id].name;
          fitText(g, R[0] + (lw + 20) / 2, y + ch / 2, shortName, RX[id].col, lw - 26, 9.5, q);
        } else g.labelPx(R[0] + 27, y + ch / 2, RX[id].name, RX[id].col, { plain: true, size: fitSize(g, RX[id].name, lw - 33, lw < 110 ? 10.5 : 12), p: q });
      }
      else g.labelPx(R[0] + 10, y + ch / 2, id, C.ink, { plain: true, size: 12, p: q });
      o.cols.forEach(function (t, k) {
        var x = R[0] + lw + k * (cw + gap), st = o.cell(id, k) || {}; if (!(q > 0)) return;
        var meta = st.fill && BER_FILL_META[st.fill]; if (meta) sawBer = true;
        c.save(); c.globalAlpha = q; c.fillStyle = st.fill || 'rgba(255,255,255,0.05)'; c.beginPath(); rrect(c, x, y, cw, ch, 4); c.fill(); c.restore();
        if (st.hatch) hatch(c, x, y, cw, ch, q);
        var cellText = st.text;
        if (!cellText && dense && meta && meta.ber > 0) cellText = '−' + Math.abs(Math.floor(Math.log(meta.ber) / Math.LN10 + 1e-12));
        if (cellText) fitText(g, x + cw / 2, y + ch / 2, cellText, st.textCol || (meta && meta.ber >= 0.01 ? C.bg : C.ink), Math.max(9, cw - 3), dense ? 8.5 : o.size || 11.5, q);
      });
    });
    var bottom = top + nr * ch + (nr - 1) * gap;
    if (sawBer && nc >= 9) {
      var keyY = bottom + 15, keyX = R[0] + (dense ? 8 : lw), keyW = (R[0] + R[2] - 8 - keyX) / 6;
      for (var e = -6; e <= -1; e++) {
        var bx = keyX + (e + 6) * keyW, fill = berColour(Math.pow(10, e), 0.9);
        c.save(); c.globalAlpha = o.p == null ? 1 : clamp(o.p, 0, 1); c.fillStyle = fill; c.beginPath(); rrect(c, bx + 1, keyY - 8, keyW - 2, 17, 3); c.fill(); c.restore();
        g.labelPx(bx + keyW / 2, keyY, pow10(e), e >= -2 ? C.bg : C.ink, { plain: true, size: dense ? 8.5 : 10, align: 'center', p: o.p == null ? 1 : o.p });
      }
      if (!dense) g.labelPx(R[0] + 12, keyY, 'BER decade', C.dim, { plain: true, size: 10.5, p: o.p == null ? 1 : o.p });
      bottom += 28;
    }
    return { top: top, bottom: bottom, cw: cw, ch: ch, lw: lw };
  }
  // a colour for a BER on a logarithmic ramp: deep blue for small, warm for large
  function berColour(b, alpha) {
    var t = b <= 0 ? 0 : clamp((Math.log(b) / Math.LN10 + 6) / 6, 0, 1);
    var stops = [[38, 70, 112], [52, 120, 150], [120, 160, 120], [222, 170, 90], [235, 110, 90]], f = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), u = f - i;
    var a = stops[i], b2 = stops[i + 1];
    var fill = 'rgba(' + Math.round(a[0] + (b2[0] - a[0]) * u) + ',' + Math.round(a[1] + (b2[1] - a[1]) * u) + ',' + Math.round(a[2] + (b2[2] - a[2]) * u) + ',' + (alpha == null ? 0.9 : alpha) + ')';
    BER_FILL_META[fill] = { ber: b }; return fill;
  }

  window.BerParts = { RX: RX, ORDER: ORDER, MISSING: MISSING, pow10: pow10, powPx: powPx, zeroArrow: zeroArrow, sci: sci, group: group, marker: marker, rxMarker: rxMarker, berPlot: berPlot, legend: legend,
                      pipeline: pipeline, cajodeSolver: cajodeSolver, fitText: fitText, fitSize: fitSize, tiles: tiles, hatch: hatch, matrix: matrix, berColour: berColour, rrect: rrect };
})();
