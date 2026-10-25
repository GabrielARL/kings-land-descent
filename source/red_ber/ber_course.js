// "Six receivers on the Red recordings": how to read the Red-channel receiver BER table.  Chapter 1 defines the
// experiment and its units; chapter 2 distinguishes six complete receiver routes; chapter 3 establishes the comparison
// population before any pooled claim; chapter 4 reads the principal and supporting result views; chapter 5 separates
// descriptive evidence from mechanism and provenance.  Every number below is computed from ber_data.js.
(function () {
  'use strict';
  var B = window.Board, M = window.Ber, P = window.BerParts; if (!B || !M || !P) return;
  var H = B.H, C = H.C, seg = H.seg, num = H.num, at = H.at, clamp = H.clamp, ease = H.ease;
  var D = M.D, RX = P.RX, ORDER = P.ORDER, sci = P.sci, group = P.group, pow10 = P.pow10;
  var out = [], CH = { what: 'What was measured', rx: 'Six receivers', read: 'Reading the table', shows: 'What the table shows', claims: 'What it supports' };
  function pct(r) { return (r % 1 ? String(r) : String(r)) + '%'; }
  function pi(r) { return M.pilotIndex(r); }
  function si(s) { return M.snrIndex(s); }
  function chanText(c) { return 'Red ' + c.red + ', hydrophone ' + c.hyd; }
  function list(items) { return items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]; }
  function dB(s) { return s == null ? 'never' : s + ' dB'; }
  function subN(n) { return String(n).split('').map(function (ch) { return '₀₁₂₃₄₅₆₇₈₉'.charAt(+ch); }).join(''); }
  function curveReady(k, i) { return CURVES[k][i].some(function (q) { return !!q; }); }
  function firstSentence(i) { return ORDER.map(function (k) { return M.NAME[k] + ': ' + (curveReady(k, i) ? dB(FIRST[k][i]) : 'missing'); }).join('; '); }
  function choice(name, legend, values) {
    return '<fieldset class="predict"><legend>' + legend + '</legend>' + values.map(function (v) {
      return '<label><input type="radio" name="' + name + '"> <span>' + v + '</span></label>';
    }).join('') + '<p>Keep that choice, then select <strong>Next</strong> to reveal the recorded result.</p></fieldset>';
  }
  var cov = M.coverage(), avail = cov.reduce(function (s, q) { return s + q.available; }, 0), miss = cov.reduce(function (s, q) { return s + q.missing; }, 0);
  var PIL = D.pilots, LO = PIL[0], HI = PIL[PIL.length - 1], NCH = M.CHANNELS.length, PER = PIL.length * D.snrs.length;
  // Every panel uses the same four case labels, where all six receivers are complete at all five pilot ratios.
  var CURVES = {}; ORDER.forEach(function (k) { CURVES[k] = PIL.map(function (p, i) { return M.curve(k, i); }); });
  var FIRST = {}, ZERO = {}, LOWEST = {};
  ORDER.forEach(function (k) { FIRST[k] = CURVES[k].map(function (cv) { return M.firstAtMost(cv, 1e-3); }); ZERO[k] = CURVES[k].map(function (cv) { return M.zeroFrom(cv); }); LOWEST[k] = CURVES[k].map(function (cv) { return M.lowest(cv); }); });
  var commonBits = function (i) { return M.COMMON.length * M.bits(i); };

  // ------------------------------------------------------------ 1. what was measured
  out.push({ id: 'question', chapter: CH.what, title: 'One question for six receivers', layout: 'side', dur: 6,
    text: 'This tutorial reads one table of results. Each row asks: when a receiver decodes recorded frames, how many payload bits does it get wrong? The answer is a bit error rate (BER). ' +
      'Red is a family of measured shallow-water channel recordings from a drifting acoustic link near Singapore at a 25 kHz carrier. Generated orthogonal frequency-division multiplexing (OFDM) frames are replayed through those measured channels and observed on three hydrophones. ' +
      'Here, the signal-to-noise ratio (SNR) is the sample signal power in the replay divided by the expected noise power added during replay, not E_b/N_0. A larger value means less added noise relative to the signal. ' +
      'Every row reports a fast Fourier transform (FFT) length of ' + D.fftLength + ', code rate ' + D.codeRate + ', and ' + D.frames + ' one-second frames.',
    math: 'rows = ' + D.recordings.length + ' recordings × ' + D.hydrophones.length + ' hydrophones × ' + PIL.length + ' pilot ratios × ' + D.snrs.length + ' SNRs × ' + ORDER.length + ' receivers = ' + group(D.rows),
    draw: function (g, p) {
      var R = g.sideR, c = g.ctx, narrow = R[2] < 560; g.panel(R, 'one recorded frame, six receivers');
      var fx = R[0] + 16, fy = R[1] + 50, fw = narrow ? R[2] - 32 : R[2] * 0.36, fh = narrow ? 64 : 90, q0 = seg(p, 0, 0.25);
      // the frame: OFDM symbols as columns, pilots as gold ticks
      c.save(); c.globalAlpha = q0; c.fillStyle = 'rgba(169,205,246,0.08)'; c.strokeStyle = C.faint; c.lineWidth = 1; c.beginPath(); P.rrect(c, fx, fy, fw, fh, 6); c.fill(); c.stroke();
      for (var s = 0; s < 12; s++) { var x = fx + 8 + s * (fw - 16) / 12; c.strokeStyle = 'rgba(242,245,248,0.18)'; c.beginPath(); c.moveTo(x, fy + 8); c.lineTo(x, fy + fh - 8); c.stroke();
        for (var k = 0; k < 6; k++) { var y = fy + 10 + k * (fh - 20) / 5; c.fillStyle = (s + k) % 4 === 0 ? C.gold : 'rgba(242,245,248,0.45)'; c.fillRect(x + 3, y - 1.5, (fw - 16) / 12 - 6, 3); } }
      c.restore();
      g.labelPx(fx + fw / 2, fy + fh + 14, 'one second, Red r, hydrophone h; gold: pilots', C.dim, { plain: true, size: 11, align: 'center', p: q0 });
      var rx0 = narrow ? R[0] + 16 : R[0] + R[2] * 0.47, ry0 = narrow ? fy + fh + 44 : R[1] + 56, rh = narrow ? 35 : Math.min(74, (R[3] - 100) / ORDER.length);
      ORDER.forEach(function (id, i) {
        var q = seg(p, 0.25 + 0.1 * i, 0.4 + 0.1 * i); if (!(q > 0)) return;
        var y = ry0 + i * rh + rh / 2;
        c.save(); c.globalAlpha = q * 0.5; c.strokeStyle = RX[id].col; c.lineWidth = 1.2; c.setLineDash([4, 4]); c.beginPath();
        if (narrow) { c.moveTo(fx + fw / 2, fy + fh + 26); c.lineTo(rx0 + 6, y); } else { c.moveTo(fx + fw + 4, fy + fh / 2); c.lineTo(rx0 - 6, y); }
        c.stroke(); c.restore();
        P.rxMarker(c, rx0 + 10, y, id, 6, { alpha: q });
        g.labelPx(rx0 + 24, y, RX[id].name, RX[id].col, { plain: true, size: narrow ? 12 : 13, p: q });
        g.labelPx(R[0] + R[2] - 16, y, 'bits wrong?', C.ink, { plain: true, size: 12, align: 'right', p: seg(p, 0.75, 0.9) });
      });
    } });

  var tile = M.CHANNELS[0];
  out.push({ id: 'grid', chapter: CH.what, title: 'Twelve cases, eighty test conditions each', layout: 'side', dur: 6.5,
    text: 'Call one recording observed on one hydrophone a recording–hydrophone case. ' + D.recordings.length + ' recordings times ' + D.hydrophones.length + ' hydrophones make ' + NCH + ' cases. ' +
      'Each case has ' + PIL.length + ' pilot ratios times ' + D.snrs.length + ' sampled SNR values, from ' + D.snrs[0] + ' to ' + D.snrs[D.snrs.length - 1] + ' dB in 2 dB steps. That makes ' + PER + ' test conditions per case. ' +
      'A receiver result is one receiver evaluated at one test condition in one case. The table has ' + group(D.rows) + ' such rows.',
    math: NCH + ' cases × ' + PER + ' test conditions × ' + ORDER.length + ' receivers = ' + group(D.rows) + ' receiver results',
    draw: function (g, p) {
      var R = g.sideR, narrow = R[2] < 560, TR = narrow ? [R[0], R[1], R[2], R[3] * 0.5] : [R[0], R[1], R[2] * 0.48, R[3]];
      g.panel(R, 'the grid of the table');
      P.tiles(g, [TR[0] + 4, TR[1] + 30, TR[2] - 8, TR[3] - 34], M.CHANNELS, { top: 18, maxH: narrow ? 40 : 66, cell: function (ch, i) {
        var q = seg(p, 0.02 + 0.025 * i, 0.08 + 0.025 * i), hot = ch === tile;
        return { p: q, col: hot ? C.gold : C.faint, lw: hot ? 2 : 1.2, text: ch.key, size: 11.5, sub: hot ? 'zoomed' : '', subCol: C.gold }; } });
      // one case's test conditions: pilot ratios down, SNR across
      var ZR = narrow ? [R[0] + 14, R[1] + R[3] * 0.53, R[2] - 28, R[3] * 0.4] : [R[0] + R[2] * 0.52, R[1] + 70, R[2] * 0.45, R[3] * 0.62], q = seg(p, 0.35, 0.7), c = g.ctx;
      var lw = 44, cw = (ZR[2] - lw) / D.snrs.length, ch = Math.min(26, (ZR[3] - 40) / PIL.length);
      g.labelPx(ZR[0], ZR[1] - 16, chanText(tile) + ': ' + PER + ' test conditions', C.gold, { plain: true, size: 12, p: q });
      PIL.forEach(function (pl, r) {
        g.labelPx(ZR[0] + lw - 6, ZR[1] + 10 + r * ch, pct(pl.ratio), C.dim, { plain: true, size: 10.5, align: 'right', p: q });
        D.snrs.forEach(function (s, k) { var qq = seg(q, (r * D.snrs.length + k) / PER * 0.8, (r * D.snrs.length + k) / PER * 0.8 + 0.2); if (!(qq > 0)) return; c.save(); c.globalAlpha = qq; c.fillStyle = 'rgba(242,245,248,0.55)'; c.beginPath(); c.arc(ZR[0] + lw + cw * (k + 0.5), ZR[1] + 10 + r * ch, Math.min(3.2, cw / 3), 0, 2 * Math.PI); c.fill(); c.restore(); });
      });
      [0, 10, 20, 30].forEach(function (s) { g.labelPx(ZR[0] + lw + cw * (si(s) + 0.5), ZR[1] + 10 + PIL.length * ch, s + ' dB', C.dim, { plain: true, size: 10, align: 'center', p: q }); });
      var y5 = ZR[1] + 26 + PIL.length * ch, q5 = seg(p, 0.72, 0.9);
      ORDER.forEach(function (id, i) { P.rxMarker(c, ZR[0] + lw + 8 + i * 18, y5 + 10, id, 5, { alpha: q5 }); });
      g.labelPx(ZR[0] + lw + 8 + ORDER.length * 18 + 4, y5 + 10, '× ' + ORDER.length + ' receiver results per condition', C.ink, { plain: true, size: 12, p: q5 });
    } });

  out.push({ id: 'pilots', chapter: CH.what, title: 'More pilots, fewer payload bits', layout: 'side', dur: 5.5,
    text: 'A pilot is a transmitted value the receiver knows in advance, so it can measure the channel there. Here, the configured pilot ratio uses the low-density parity-check codeword length—the number of coded bits—as its denominator. ' +
      'The table compares ' + PIL.length + ' pilot ratios, from ' + pct(LO.ratio) + ' to ' + pct(HI.ratio) + '. ' +
      'In this configuration a higher pilot ratio leaves fewer payload bits in each one-second frame: ' + group(LO.payload) + ' at ' + pct(LO.ratio) + ' pilots, down to ' + group(HI.payload) + ' at ' + pct(HI.ratio) + '. ' +
      'So one receiver result scores ' + group(M.bits(0)) + ' bits at ' + pct(LO.ratio) + ' pilots, but only ' + group(M.bits(PIL.length - 1)) + ' at ' + pct(HI.ratio) + '.',
    math: 'bits per receiver result = ' + D.frames + ' frames × payload bits per frame' + at(0.6, ';  ' + PIL.map(function (pl, i) { return pct(pl.ratio) + ': ' + group(M.bits(i)); }).join(',  ')),
    draw: function (g, p) {
      var R = g.sideR, c = g.ctx, narrow = R[2] < 560; g.panel(R, 'payload bits per one-second frame');
      var L = R[0] + 54, Bt = R[1] + R[3] - 70, T = R[1] + 60, maxV = 2500, bw = (R[2] - 80) / PIL.length;
      c.save(); c.strokeStyle = C.faint; c.lineWidth = 1; c.beginPath(); c.moveTo(L - 8, Bt); c.lineTo(R[0] + R[2] - 16, Bt); c.stroke(); c.restore();
      [0, 1000, 2000].forEach(function (v) { var y = Bt - v / maxV * (Bt - T); g.labelPx(L - 12, y, group(v), C.dim, { plain: true, mono: true, size: 10.5, align: 'right' }); });
      PIL.forEach(function (pl, i) {
        var q = ease(seg(p, 0.05 + 0.12 * i, 0.3 + 0.12 * i)), x = L + i * bw + bw * 0.15, w = bw * 0.6, h = pl.payload / maxV * (Bt - T) * q;
        c.save(); c.fillStyle = 'rgba(169,205,246,0.55)'; c.fillRect(x, Bt - h, w, h); c.restore();
        g.labelPx(x + w / 2, Bt - h - 12, group(pl.payload), C.ink, { plain: true, mono: true, size: narrow ? 10.5 : 12, align: 'center', p: q });
        g.labelPx(x + w / 2, Bt + 14, pct(pl.ratio), C.gold, { plain: true, size: 12, align: 'center', p: q });
        g.labelPx(x + w / 2, Bt + 34, '× ' + D.frames + ' = ' + group(M.bits(i)), C.dim, { plain: true, mono: true, size: narrow ? 9 : 10.5, align: 'center', p: seg(p, 0.75, 0.95) });
      });
      g.labelPx(L - 8, Bt + 14, 'pilots', C.gold, { plain: true, size: 11, align: 'right', p: seg(p, 0, 0.2) });
    } });

  var EX = { id: 'ofdm+fec', c: M.CHANNELS[0], ratio: 7.5, snr: 10 }, exP = M.point(EX.id, EX.c, pi(EX.ratio), si(EX.snr));
  out.push({ id: 'pooled', chapter: CH.what, title: 'One receiver result: 47 frames', layout: 'side', dur: 6,
    text: 'Each receiver result decodes ' + D.frames + ' one-second frames. Its information BER counts the wrong payload bits over all ' + D.frames + ' frames and divides by all payload bits scored in them. ' +
      'Take OFDM + FEC, the OFDM receiver followed by forward error correction (FEC), on ' + chanText(EX.c) + ', at ' + pct(EX.ratio) + ' pilots and ' + EX.snr + ' dB. ' +
      'It got ' + group(exP.errors) + ' of ' + group(exP.bits) + ' payload bits wrong, so its information BER is ' + sci(exP.ber, 2) + '. ' +
      'The table keeps both integers, so every BER can be recomputed from them.',
    math: 'information BER = total bit errors / total payload bits' + at(0.6, ' = ' + group(exP.errors) + ' / ' + group(exP.bits) + ' = ' + sci(exP.ber, 2)),
    draw: function (g, p) {
      var R = g.sideR, c = g.ctx, narrow = R[2] < 560; g.panel(R, D.frames + ' frames, ' + group(D.pilots[pi(EX.ratio)].payload) + ' payload bits each');
      var cols = narrow ? 8 : 12, fw = (R[2] - 32 - (cols - 1) * 6) / cols, fh = narrow ? 22 : 30, x0 = R[0] + 16, y0 = R[1] + 46;
      for (var f = 0; f < D.frames; f++) {
        var q = seg(p, 0.02 + f * 0.009, 0.06 + f * 0.009); if (!(q > 0)) continue;
        var x = x0 + (f % cols) * (fw + 6), y = y0 + Math.floor(f / cols) * (fh + 6);
        c.save(); c.globalAlpha = q; c.fillStyle = 'rgba(169,205,246,0.12)'; c.strokeStyle = 'rgba(169,205,246,0.5)'; c.lineWidth = 1; c.beginPath(); P.rrect(c, x, y, fw, fh, 4); c.fill(); c.stroke(); c.restore();
        g.labelPx(x + fw / 2, y + fh / 2, String(f + 1), C.dim, { plain: true, mono: true, size: 9.5, align: 'center', p: q });
      }
      var yb = y0 + Math.ceil(D.frames / cols) * (fh + 6) + 24, q2 = seg(p, 0.5, 0.75), q3 = seg(p, 0.75, 0.95);
      g.labelPx(R[0] + 16, yb, 'payload bits sent:  ' + D.frames + ' × ' + group(D.pilots[pi(EX.ratio)].payload) + ' = ' + group(exP.bits), C.ink, { plain: true, mono: true, size: narrow ? 11 : 13, p: q2 });
      g.labelPx(R[0] + 16, yb + 26, 'received in error:  ' + group(exP.errors), C.red, { plain: true, mono: true, size: narrow ? 11 : 13, p: q2 });
      g.labelPx(R[0] + 16, yb + 58, 'information BER = ' + group(exP.errors) + ' / ' + group(exP.bits) + ' = ' + sci(exP.ber, 2), C.gold, { plain: true, mono: true, size: narrow ? 11.5 : 14, p: q3 });
      g.labelPx(R[0] + 16, yb + 84, 'OFDM + FEC, ' + chanText(EX.c) + ', ' + pct(EX.ratio) + ' pilots, ' + EX.snr + ' dB', C.dim, { plain: true, size: 11, p: q3 });
    } });

  var one = function (i) { return 1 / M.bits(i); };
  out.push({ id: 'zero', chapter: CH.what, title: 'No error seen is not a BER of zero', layout: 'side', dur: 6,
    text: 'Sometimes all ' + D.frames + ' frames decode without a single wrong bit. The table then keeps information BER = 0 and sets zero_observed_errors to true. ' +
      'That zero says only that no error appeared among the bits scored. At ' + pct(LO.ratio) + ' pilots one error in ' + group(M.bits(0)) + ' bits would already be a BER of ' + sci(one(0), 1) + '; at ' + pct(HI.ratio) + ' pilots, one in ' + group(M.bits(PIL.length - 1)) + ' would be ' + sci(one(PIL.length - 1), 1) + '. ' +
      'To place a zero on a logarithmic plot, the table gives a plotting value, 0.5 divided by the bits scored. It is not a measured BER. This tutorial draws such points hollow, with a short arrow down.',
    math: 'no error in N bits:  BER kept as 0;  plotted at 0.5 / N' + at(0.55, ';  one error would be 1 / N'),
    draw: function (g, p) {
      var R = g.sideR, c = g.ctx, narrow = R[2] < 560; g.panel(R, 'what one error would be, and where a zero is drawn');
      var L = R[0] + 60, Rt = R[0] + R[2] - 20, T = R[1] + 56, Bt = R[1] + R[3] - 64, d0 = -6, d1 = -4;
      function Y(v) { return Bt - (Math.log(v) / Math.LN10 - d0) / (d1 - d0) * (Bt - T); }
      for (var d = d0; d <= d1; d++) { c.save(); c.strokeStyle = 'rgba(242,245,248,0.1)'; c.beginPath(); c.moveTo(L, Y(Math.pow(10, d))); c.lineTo(Rt, Y(Math.pow(10, d))); c.stroke(); c.restore(); P.powPx(g, L - 8, Y(Math.pow(10, d)), d, C.dim, { size: 12, align: 'right' }); }
      var bw = (Rt - L) / PIL.length;
      PIL.forEach(function (pl, i) {
        var q = seg(p, 0.1 + 0.12 * i, 0.3 + 0.12 * i), x = L + bw * (i + 0.5), y1 = Y(one(i)), y0 = Y(0.5 / M.bits(i));
        if (!(q > 0)) return;
        c.save(); c.globalAlpha = q; c.strokeStyle = C.red; c.lineWidth = 2; c.beginPath(); c.moveTo(x - bw * 0.3, y1); c.lineTo(x + bw * 0.3, y1); c.stroke(); c.restore();
        P.marker(c, x, y0, 'circle', 5, C.ink, { hollow: true, alpha: q }); P.zeroArrow(c, x, y0 + 6, C.ink, q);
        g.labelPx(x, Bt + 16, pct(pl.ratio), C.gold, { plain: true, size: 12, align: 'center', p: q });
        g.labelPx(x, y1 - 12, sci(one(i), 1), C.red, { plain: true, size: narrow ? 10 : 12, align: 'center', p: q });
      });
      g.labelPx(L, Bt + 38, 'red line: one error in one receiver result', C.red, { plain: true, size: 11.5, p: seg(p, 0.7, 0.85) });
      g.labelPx(L, Bt + 56, 'hollow circle: where a zero is drawn, 0.5 / bits', C.ink, { plain: true, size: 11.5, p: seg(p, 0.8, 0.95) });
    } });

  // ------------------------------------------------------------ 2. the six receivers
  var ROUTE = {
    'ofdm+fec': ['pilot-assisted|channel estimation', 'BP once', 'no feedback'],
    'pfft+fec': ['partial FFT|outputs', 'BP once', 'no feedback'],
    jade: ['channel response +|variables for coded bits', 'normalized min-sum', 'decoder feedback'],
    pearl: ['channel response +|variables for coded bits', 'normalized min-sum', 'messages persist|between iterations'],
    coral: ['channel response +|variables for coded bits', 'penalty term|from parity checks', 'backtracking|line search'],
    cajode: ['channel response +|shared relaxed bits', 'parity polytopes|as constraints', 'ADMM blocks|of one problem']
  };
  var ROUTE_PHONE = {
    'ofdm+fec': ['pilots', 'BP once', 'no feedback'],
    'pfft+fec': ['partial FFT', 'BP once', 'no feedback'],
    jade: ['channel +|bits', 'min-sum', 'feedback'],
    pearl: ['channel +|bits', 'min-sum', 'messages persist'],
    coral: ['channel +|bits', 'penalty term', 'line search'],
    cajode: ['channel +|bits', 'parity constraints', 'ADMM blocks']
  };
  out.push({ id: 'routes', chapter: CH.rx, title: 'Six receivers, six complete routes', layout: 'side', dur: 6.5,
    text: 'Belief propagation is a decoder component, while the six rows in the mechanism map are complete receiver routes. The first two estimate from pilots and then decode once. ' +
      'JADE returns extrinsic information from the decoder to the next estimation pass. PEARL is the Persistent-Edge Alternating Receiver Loop. It carries its check-to-variable and variable-to-check messages from one message-passing iteration to the next while it updates the channel estimate. CORAL includes the code constraints as penalty terms without a separate decoder. SAPPHIRE gives each parity check a constrained local copy and represents its disagreement with scaled dual variables. ' +
      'The next five pages unpack those differences before any performance curve appears.',
    math: 'ask of each route: how is the response estimated?  where does the code enter?  what computation repeats?',
    a11y: 'Receiver mechanism map. OFDM plus FEC uses pilot-assisted channel estimation, runs the belief-propagation decoder once and provides no feedback. Partial FFT plus FEC combines partial FFT outputs, then runs the belief-propagation decoder once and provides no feedback. JADE returns extrinsic information from the normalized min-sum decoder to another estimation pass. PEARL is the Persistent-Edge Alternating Receiver Loop. It keeps its check-to-variable and variable-to-check messages between message-passing iterations while updating the channel estimate. CORAL uses a penalty term formed from parity checks and no belief-propagation decoder. SAPPHIRE projects a local copy of the bit variables for each parity check onto its parity polytope and updates scaled dual variables.',
    draw: function (g, p) {
      var R = g.sideR, narrow = R[2] < 560; g.panel(R, 'compare mechanisms before curves');
      P.matrix(g, R, { rows: ORDER, cols: narrow ? ['response', 'code', 'repeats'] : ['observation / response', 'how code enters', 'what repeats'], labelW: narrow ? 104 : 146, top: 64, maxH: narrow ? 43 : 54, size: narrow ? 9.5 : 11, headSize: narrow ? 9.5 : 11, p: p,
        cell: function (id, k) { return { text: (narrow ? ROUTE_PHONE : ROUTE)[id][k], fill: k === 1 ? 'rgba(169,205,246,0.08)' : 'rgba(255,255,255,0.04)' }; } });
    } });

  out.push({ id: 'pilot-only', chapter: CH.rx, title: 'Two receivers that use the pilots alone', layout: 'side', dur: 7,
    text: 'Two receivers estimate the channel from the pilots alone, then decode once. OFDM + FEC interpolates the channel response between the pilots and equalizes each carrier with one coefficient, a one-tap equalizer. ' +
      'A belief-propagation (BP) decoder then decodes the low-density parity-check (LDPC) code. ' +
      'Partial FFT + FEC first splits each OFDM symbol into partial FFT outputs and combines them with weights fitted on the pilots. It then equalizes and decodes the same way. In both, nothing flows back from the decoder to the channel estimate.',
    math: 'pilots → channel response → one-tap equalizer → BP decoder → payload bits',
    draw: function (g, p) {
      var R = g.sideR, narrow = R[2] < 560; g.panel(R, 'estimate from the pilots, then decode once');
      var y = P.pipeline(g, R, { title: 'OFDM + FEC', col: RX['ofdm+fec'].col, q: seg(p, 0, 0.5), y: R[1] + 46, h: narrow ? 44 : 66, none: 'no path back from the decoder', boxes: ['pilots', 'channel response|between pilots', 'one-tap|equalizer', 'BP decoder|LDPC code', 'payload bits'] });
      P.pipeline(g, R, { title: 'Partial FFT + FEC', col: RX['pfft+fec'].col, q: seg(p, 0.45, 0.95), y: y + (narrow ? 4 : 30), h: narrow ? 44 : 66, none: 'no path back from the decoder', boxes: ['partial FFT|outputs', 'weights fitted|on the pilots', 'one-tap|equalizer', 'BP decoder|LDPC code', 'payload bits'] });
    } });

  out.push({ id: 'jade', chapter: CH.rx, title: 'JADE: the decoder feeds the next estimate', layout: 'side', dur: 7,
    text: 'JADE, Joint Acoustic Decoding and Equalization, estimates the channel response and variables representing the coded bits jointly. The implementation restricts the response matrix to a band and each such variable to its permitted interval. The current estimate produces one channel log-likelihood ratio (LLR), Lch, per coded bit. ' +
      'A separately initialized belief-propagation (BP) decoder runs normalized min-sum message-passing iterations and returns an a posteriori LLR, Lpost. ' +
      'The extrinsic information is Lext = Lpost − Lch. JADE scales Lext by α, adds it to Lch, and applies the hyperbolic tangent function to initialize the next estimation pass.',
    math: 'Lext = Lpost − Lch;  next pass applies the hyperbolic tangent function to Lch + α·Lext',
    draw: function (g, p) {
      var R = g.sideR, narrow = R[2] < 560; g.panel(R, narrow ? 'JADE: feedback from the decoder' : 'joint estimation, with feedback from the decoder');
      P.pipeline(g, R, { title: 'JADE', col: RX.jade.col, q: p, y: R[1] + 50, perRow: 3, h: R[2] < 560 ? 50 : 76, rowGap: 64, back: 'the next estimation pass', boxes: ['channel LLR|Lch', 'BP decoder|normalized min-sum', 'extrinsic|Lext = Lpost − Lch', 'Lch + α·Lext', 'hyperbolic tangent|function', 'estimate channel +|variables for bits'] });
    } });

  out.push({ id: 'pearl', chapter: CH.rx, title: 'PEARL: messages persist across iterations', layout: 'side', dur: 7,
    text: 'PEARL is the Persistent-Edge Alternating Receiver Loop and names the frozen R2-V1 receiver profile. It estimates the channel response and variables representing the coded bits jointly. ' +
      'Within the normalized min-sum computation, its check-to-variable and variable-to-check messages carry from one message-passing iteration to the next instead of being reinitialized for each channel update. ' +
      'The profile updates the channel estimate after every second message-passing iteration and permits at most 80 iterations. The plotted rows use this frozen profile; the table does not tune it from the reported BER.',
    math: 'keep check-to-variable and variable-to-check messages → update the channel estimate every second iteration → continue, at most 80 iterations',
    a11y: 'PEARL is the Persistent-Edge Alternating Receiver Loop and uses the frozen R2-V1 profile. Its check-to-variable and variable-to-check messages persist from one message-passing iteration to the next. It updates the channel estimate after every second iteration and permits at most 80 iterations. The BER table does not tune this profile.',
    draw: function (g, p) {
      var R = g.sideR, narrow = R[2] < 560; g.panel(R, narrow ? 'PEARL: retain messages' : 'retain messages while the channel estimate is updated');
      P.pipeline(g, R, { title: 'PEARL', col: RX.pearl.col, q: p, y: R[1] + 50, perRow: 3, h: narrow ? 50 : 76, rowGap: 64,
        back: 'retain both directed messages', boxes: ['channel LLR', 'variable-to-check|message', 'check-to-variable|message', 'normalized|min-sum', 'update channel|every second iteration', 'posterior|coded bits'] });
    } });

  out.push({ id: 'coral', chapter: CH.rx, title: 'CORAL: parity modifies the search direction', layout: 'side', dur: 6.5,
    text: 'CORAL is the table’s project label for the source profile jcade_regularized_power; it is a name, not an expanded acronym. It estimates the channel response and variables representing the coded bits jointly. The implementation restricts the response matrix to a band and each bit variable to its permitted interval. ' +
      'Its objective function combines a term measuring mismatch to the received signal, a regularization term on the response, a pull toward binary values, and a penalty term formed from products computed over each parity check. It calls no BP or min-sum decoder. ' +
      'On a violated parity check, the production profile modifies the parity component of the search direction. Each trial is projected to the permitted interval. A backtracking line search accepts it only when the objective function decreases. The resulting direction is not the gradient of the objective function.',
    math: 'the objective function scores each trial;  a modified parity component proposes it;  projection and a backtracking line search accept or reject it',
    draw: function (g, p) {
      var R = g.sideR, narrow = R[2] < 560; g.panel(R, narrow ? 'CORAL: no BP decoder' : 'estimate channel and bit variables without BP');
      var y = P.pipeline(g, R, { title: 'CORAL', col: RX.coral.col, q: seg(p, 0, 0.75), y: R[1] + 50, perRow: narrow ? 2 : 3, h: narrow ? 50 : 76, rowGap: 62,
        back: narrow ? 'repeat estimation' : 'repeat the estimation and search', boxes: ['channel response +|variables for coded bits', 'mismatch +|regularization', 'modify parity part|of search direction', 'project bit variables|to their interval', 'backtracking|line search', 'hard bits'] });
      if (!narrow) {
        var q = seg(p, 0.72, 1), yy = Math.min(R[1] + R[3] - 52, y + 18);
        g.labelPx(R[0] + 18, yy, 'proposal: modify the parity part on violated checks', RX.coral.col, { plain: true, size: 12.5, p: q });
        g.labelPx(R[0] + 18, yy + 24, 'gate: accept only when the objective function decreases', C.ink, { plain: true, size: 12.5, p: q });
      }
    } });

  out.push({ id: 'cajode', chapter: CH.rx, title: 'SAPPHIRE: one constrained problem, solved by ADMM', layout: 'side', dur: 8,
    text: 'SAPPHIRE performs channel estimation, OFDM data detection, and error-correction decoding in one constrained optimization problem. ' +
      'Its unknowns are the channel response C, shared relaxed coded bits b, and a local copy z_a for each parity check. ' +
      'The alternating direction method of multipliers (ADMM) repeats block updates within that same problem; it does not exchange outputs between a separate detector and decoder. ' +
      'Its objective function compares the received samples with samples predicted by C and b. As their residual energy grows, this term increases more slowly than squared error. ' +
      'Other terms keep C near an estimate obtained from the pilots, discourage large differences across adjacent carriers and symbols, and use β Σ bᵢ(1−bᵢ) to pull b toward binary values. ' +
      'The constraints keep b in [0,1], hold configured bits fixed, place each z_a in its parity polytope, and require z_a to agree with the corresponding entries of b. ' +
      'One ADMM iteration computes one weight per observation, updates b by majorization–minimization, recomputes those weights, solves the linear system for C, projects z, and updates the scaled dual variables u. ' +
      'After each iteration, the receiver thresholds b to form a candidate. Parity checks, configured bits, and the cyclic redundancy check (CRC) decide acceptance. ' +
      'That acceptance test is separate from ADMM convergence. This table permits at most 50 ADMM iterations. ' +
      'The public name is SAPPHIRE. The evidence snapshot retains the legacy receiver key cajode and source label CAJODE so its data provenance remains stable.',
    math: 'min over C, b, {zₐ}  J(C,b),  subject to b ∈ [0,1]ⁿ, zₐ ∈ Pₐ and zₐ = b_N(a)' + at(0.55, ';  ADMM: one weight per observation → b → weights → C → z → u') + at(0.82, ';  then threshold b and check it'),
    a11y: 'The SAPPHIRE diagram has three separate regions. The first gives one constrained optimization problem over the channel response, shared relaxed bits and local copies constrained to parity polytopes. The second shows one ADMM solver iteration within that problem: one weight per observation, a majorization–minimization bit update, recomputed weights, a linear solve for the channel response, parity-polytope projections and scaled-dual updates. There is no exchange between a separate detector and decoder. The third region thresholds b to form one candidate, then applies the parity, configured-bit and CRC acceptance tests. Candidate acceptance is separate from ADMM convergence.',
    draw: function (g, p) { P.cajodeSolver(g, g.sideR, { p: p, col: RX.cajode.col }); } });

  var coh = {}; D.receivers.forEach(function (r) { (coh[r.cohort] = coh[r.cohort] || []).push(r.id); });
  var replay = coh.four_receivers_red_replay || [], modern = coh.modern_r3_ber || [], persistent = coh.persistent_r2_v1 || [];
  out.push({ id: 'cohorts', chapter: CH.rx, title: 'Three cohorts in one table', layout: 'side', dur: 6,
    text: 'The table joins three sets of runs and records the source cohort on every row. ' + list(replay.map(function (k) { return M.NAME[k]; })) + ' come from the authenticated four-receiver Red replay. ' +
      'That replay also contained an older jade_bp output, which this table excludes instead of mixing it into the modern JADE curve. ' + list(modern.map(function (k) { return M.NAME[k]; })) + ' come from the newer R3 BER campaign. ' +
      list(persistent.map(function (k) { return M.NAME[k]; })) + ' comes from the frozen persistent R2-V1 campaign. The cohort records share configuration labels, but their provenance does not establish identical payload bits, transmitted waveforms, received samples, or noise realizations across all three campaigns.',
    math: 'source_cohort:  four_receivers_red_replay,  modern_r3_ber,  or  persistent_r2_v1',
    a11y: 'Cohort map. OFDM plus FEC, Partial FFT plus FEC and CORAL are from the authenticated four-receiver Red replay. The replay’s older jade_bp output is excluded. Modern JADE and SAPPHIRE are from the newer R3 BER campaign. PEARL is from the frozen persistent R2-V1 campaign. Shared labels provide common coverage, but the table does not establish identical payload bits, transmitted waveforms, received samples, or noise realizations across all three cohorts.',
    draw: function (g, p) {
      var R = g.sideR, c = g.ctx, narrow = R[2] < 560; g.panel(R, 'where each receiver’s rows come from');
      var boxes = [['the four-receiver Red replay', replay], ['the newer R3 BER campaign', modern], ['the persistent R2-V1 campaign', persistent]], bw = narrow ? R[2] - 32 : (R[2] - 64) / 3, bh = narrow ? 82 : 170;
      boxes.forEach(function (b, i) {
        var q = seg(p, 0.08 + 0.22 * i, 0.34 + 0.22 * i), x = narrow ? R[0] + 16 : R[0] + 16 + i * (bw + 16), y = narrow ? R[1] + 38 + i * (bh + 10) : R[1] + 50; if (!(q > 0)) return;
        c.save(); c.globalAlpha = q; c.fillStyle = 'rgba(255,255,255,0.04)'; c.strokeStyle = C.faint; c.lineWidth = 1.2; c.beginPath(); P.rrect(c, x, y, bw, bh, 8); c.fill(); c.stroke(); c.restore();
        g.labelPx(x + 12, y + 18, b[0], C.gold, { plain: true, size: 12.5, p: q });
        b[1].forEach(function (id, k) { var yy = y + 42 + k * (narrow ? 20 : 30); P.rxMarker(c, x + 22, yy, id, 6, { alpha: q }); g.labelPx(x + 36, yy, RX[id].name + (id === 'cajode' ? ', at most 50 updates' : id === 'pearl' ? ', at most 80 iterations' : ''), RX[id].col, { plain: true, size: narrow ? 10.5 : 12, p: q }); });
      });
      var yk = narrow ? R[1] + 38 + 3 * (bh + 10) + 2 : R[1] + 50 + bh + 34, qk = seg(p, 0.75, 0.95);
      g.labelPx(R[0] + 16, yk, 'every available row keeps:', C.ink, { plain: true, size: 12.5, p: qk });
      g.labelPx(R[0] + 16, yk + 22, 'cohort · source file · evidence file · SHA-256 of each', C.dim, { plain: true, mono: true, size: narrow ? 10 : 12, p: qk });
    } });

  // ------------------------------------------------------------ 3. reading the table
  out.push({ id: 'missing', chapter: CH.read, title: 'Missing is not zero', layout: 'side', dur: 6.5,
    text: 'Of the ' + group(D.rows) + ' rows, ' + group(miss) + ' have no result. They stay in the table, marked missing, with blank BER fields and a reason. ' +
      'OFDM + FEC, Partial FFT + FEC, JADE, CORAL and SAPPHIRE each have all 960 rows. ' +
      'PEARL has 384 of 960 rows: all five pilot ratios on the four-case plot scope, 7.5% on three additional cases, and 2.5% on Red 2, hydrophone 2. The active sequential fill queue covers the remaining 36 conditions. Each stays blank until its complete result passes the admission checks. A missing result is never drawn as zero.',
    math: 'available ' + group(avail) + ' + missing ' + group(miss) + ' = ' + group(D.rows) + ' rows',
    a11y: 'Coverage table across twelve recording–hydrophone cases and five pilot ratios. OFDM plus FEC, Partial FFT plus FEC, JADE, CORAL and SAPPHIRE each have 960 of 960 receiver results. PEARL has 384 of 960: all five pilot ratios on the fixed four cases, 7.5 percent on three additional cases, and 2.5 percent on Red 2, hydrophone 2. The active sequential fill queue covers the remaining 36 conditions. They stay blank until complete results pass the admission checks; missing entries are never zero.',
    draw: function (g, p) {
      var R = g.sideR, narrow = R[2] < 560; g.panel(R, 'which receiver has results in which case');
      var cols = M.CHANNELS.map(function (ch) { return ch.key; });
      var res = P.matrix(g, [R[0], R[1], R[2] - (narrow ? 0 : 92), narrow ? R[3] * 0.62 : R[3] - 40], { rows: ORDER, cols: cols, labelW: narrow ? 104 : 150, top: 56, maxH: narrow ? 30 : 40, headSize: narrow ? 8.5 : 10.5, p: seg(p, 0, 0.6),
        cell: function (id, k) { var ch = M.CHANNELS[k], np = PIL.filter(function (_, i) { return M.has(id, ch, i); }).length;
          if (np) return { fill: RX[id].col.replace(')', ',0.35)').replace('rgb(', 'rgba(').replace(/^#(..)(..)(..)$/, function (m, a, b, c2) { return 'rgba(' + parseInt(a, 16) + ',' + parseInt(b, 16) + ',' + parseInt(c2, 16) + ',0.35)'; }), text: np === PIL.length || narrow ? '' : np + '/' + PIL.length, textCol: C.ink };
          return { hatch: true, text: narrow ? '' : 'none', textCol: C.dim }; } });
      cov.forEach(function (q, r) {
        var y = res.top + r * (res.ch + 4) + res.ch / 2, qq = seg(p, 0.6 + 0.06 * r, 0.75 + 0.06 * r);
        if (!narrow) g.labelPx(R[0] + R[2] - 12, y, group(q.available) + ' / ' + group(q.available + q.missing), q.missing ? C.gold : C.ink, { plain: true, mono: true, size: 11, align: 'right', p: qq });
      });
      var yk = res.bottom + 26, qk = seg(p, 0.8, 1);
      if (narrow) cov.forEach(function (q, r) { g.labelPx(R[0] + 16 + (r % 2) * (R[2] / 2), yk + Math.floor(r / 2) * 20, RX[q.id].name + ': ' + group(q.available) + ' / ' + group(q.available + q.missing), RX[q.id].col, { plain: true, size: 10.5, p: qk }); });
      else g.labelPx(R[0] + 16, yk, 'fraction: available pilot ratios; hatched: no complete source result', C.dim, { plain: true, size: 11, p: qk });
    } });

  var notCommon = M.CHANNELS.filter(function (ch) { return M.COMMON.indexOf(ch) < 0; });
  out.push({ id: 'common', chapter: CH.read, title: 'One fixed four-case plot scope', layout: 'side', dur: 6,
    text: 'All five pilot panels use the same four recording–hydrophone labels: Red 1 on all three hydrophones and Red 2 on hydrophone 1. All six receivers have complete curves at all five pilot ratios on these cases. ' +
      'Pooling adds errors and bits before dividing, so one resulting value is a pooled curve point. Matching case labels make coverage comparable, but they do not establish identical payload bits, transmitted waveforms, received samples, or noise realizations across the three cohorts.',
    math: 'pooled curve point = Σ errors / Σ bits over R1h1, R1h2, R1h3 and R2h1;  six complete curves at every pilot ratio',
    a11y: 'Every plotted curve uses the same four recording–hydrophone labels: Red 1 hydrophones 1, 2 and 3, and Red 2 hydrophone 1. All six receivers have complete curves there at all five pilot ratios. Shared labels do not prove that the three cohorts used identical payload bits, transmitted waveforms, received samples, or noise realizations.',
    draw: function (g, p) {
      var R = g.sideR, narrow = R[2] < 560; g.panel(R, M.COMMON.length + ' fixed cases for every pilot panel');
      P.tiles(g, [R[0] + 8, R[1] + 30, R[2] - 16, R[3] - 40], M.CHANNELS, { top: 26, maxH: R[2] < 560 ? 70 : 84, cell: function (ch, i) {
        var common = M.COMMON.indexOf(ch) >= 0, q = seg(p, 0.05 + 0.04 * i, 0.2 + 0.04 * i);
        return common ? { p: q, col: C.gold, lw: 2, fill: 'rgba(255,210,122,0.12)', text: ch.key, sub: 'plot scope', subCol: C.gold } : { p: q, alpha: 0.6, hatch: true, text: ch.key, textCol: C.dim, sub: narrow ? 'outside' : 'outside plot scope', subSize: narrow ? 9 : 10 };
      } });
    } });

  var EXC = { id: 'ofdm+fec', c: M.CHANNELS.filter(function (c) { return c.red === 1 && c.hyd === 3; })[0], ratio: 7.5 };
  var exCurve = M.channelCurve(EXC.id, EXC.c, pi(EXC.ratio)), exZero = M.zeroFrom(exCurve), ex0 = exCurve[0];
  var steepFrom = null; for (var sx = 1; sx < exCurve.length; sx++) if (!steepFrom && exCurve[sx].ber < exCurve[sx - 1].ber / 3) steepFrom = exCurve[sx - 1].snr;
  out.push({ id: 'one-curve-predict', chapter: CH.read, title: 'Predict the first curve', layout: 'side', dur: 3.5,
    text: 'The first curve will show OFDM + FEC on ' + chanText(EXC.c) + ' at ' + pct(EXC.ratio) + ' pilots. Its horizontal axis is sampled SNR; its vertical axis is information BER on a logarithmic scale. ' +
      'At ' + ex0.snr + ' dB, where will its first point lie?' + choice('one-curve-choice', 'Choose before the curve is shown', ['Near zero', 'Near one half', 'Somewhere between']),
    math: 'predict first;  the next page reveals the measured curve',
    a11y: 'An empty logarithmic BER chart asks where the first measured point will lie at 0 dB. The three choices are near zero, near one half, or somewhere between. No result is shown on this page.',
    draw: function (g, p) {
      var R = g.sideR, pl = P.berPlot(g, [R[0], R[1], R[2], R[3]], { title: 'prediction: OFDM + FEC, ' + chanText(EXC.c) + ', ' + pct(EXC.ratio) + ' pilots', curves: [] });
      g.labelPx(pl.box[0] + pl.box[2] / 2, pl.box[1] + pl.box[3] / 2, 'Where will the 0 dB point lie?', C.gold, { size: R[2] < 560 ? 12 : 14, align: 'center', p: seg(p, 0.1, 0.35) });
      g.labelPx(pl.box[0] + pl.box[2] / 2, pl.box[1] + pl.box[3] / 2 + 28, 'choose in the story panel, then select Next', C.ink, { plain: true, size: R[2] < 560 ? 10.5 : 12, align: 'center', p: seg(p, 0.3, 0.55) });
    } });
  out.push({ id: 'one-curve', chapter: CH.read, title: 'Reading one BER curve', layout: 'side', dur: 7,
    text: 'A BER curve puts the SNR along the bottom and the information BER up the side, on a logarithmic axis: each gridline is ten times smaller than the one above it. ' +
      'For OFDM + FEC on ' + chanText(EXC.c) + ' at ' + pct(EXC.ratio) + ' pilots, the ' + ex0.snr + ' dB result has about ' + num(ex0.ber, 2) + ' of its bits wrong. ' +
      'The sampled curve falls steeply from ' + steepFrom + ' dB. From ' + exZero + ' dB onward, no error is observed among ' + group(M.bits(pi(EXC.ratio))) + ' scored bits at each receiver result. Each hollow marker is plotted at 0.5 / N only for visibility.',
    math: 'x: SNR in dB;  y: information BER, logarithmic' + at(0.7, ';  no error seen from ' + exZero + ' dB'),
    a11y: 'BER curve for OFDM plus FEC, Red 1 hydrophone 3, 7.5 percent pilots. At 0 dB the information BER is about ' + num(ex0.ber, 2) + '. The sampled curve falls steeply from ' + steepFrom + ' dB. From ' + exZero + ' dB through 30 dB, each receiver result has zero observed errors and is plotted as a hollow marker at 0.5 divided by the bits scored.',
    draw: function (g, p) {
      var R = g.sideR, pl = P.berPlot(g, [R[0], R[1], R[2], R[3]], { title: 'OFDM + FEC, ' + chanText(EXC.c) + ', ' + pct(EXC.ratio) + ' pilots', curves: [{ id: EXC.id, pts: exCurve, p: seg(p, 0.15, 0.85) }] });
      var a = exCurve[0], z = exCurve[si(exZero)];
      var mid = exCurve[Math.min(exCurve.length - 1, si(steepFrom) + 2)];
      g.labelPx(pl.X(a.snr) + 12, pl.Y(a.plot) - 16, 'about ' + num(a.ber, 2) + ' wrong', C.ink, { size: 12, p: seg(p, 0.15, 0.3) });
      g.labelPx(pl.X(mid.snr) + 14, pl.Y(mid.plot), 'falls steeply', C.ink, { size: 12, p: seg(p, 0.5, 0.65) });
      g.labelPx(pl.X(z.snr) - 10, pl.Y(z.plot) + 26, 'no error seen: hollow, plotted at 0.5 / N', C.ink, { size: 12, align: 'right', p: seg(p, 0.85, 1) });
    } });

  // ------------------------------------------------------------ 4. what the table shows (pooled over the fixed four-case scope)
  var i75 = pi(7.5);
  function curvesAt(i, p, o) { o = o || {}; return ORDER.map(function (k, n) { return { id: k, pts: CURVES[k][i], p: o.all ? p : seg(p, 0.1 + 0.13 * n, 0.3 + 0.13 * n) }; }); }
  var coralFloor = Math.min.apply(null, LOWEST.coral);
  out.push({ id: 'p75-predict', chapter: CH.shows, title: 'Predict the six-way comparison', layout: 'side', dur: 3.5,
    text: 'The next page overlays the six pooled curves at ' + pct(7.5) + ' pilots. Use the mechanism map, not a result already shown, to predict which curve will remain highest at the sampled high-SNR end. ' +
      choice('p75-choice', 'Choose one receiver before the curves are shown', ORDER.map(function (k) { return M.NAME[k]; })),
    math: 'prediction first;  the next page reveals all six sampled curves',
    a11y: 'An empty logarithmic BER chart asks which of the six receiver curves will remain highest at the sampled high-SNR end. The six receiver names are available as radio-button choices. No curve or outcome is shown on this page.',
    draw: function (g, p) {
      var R = g.sideR, narrow = R[2] < 560, lh = narrow ? 64 : 34;
      P.berPlot(g, [R[0], R[1], R[2], R[3] - lh], { title: 'prediction: pooled over ' + M.COMMON.length + ' cases, ' + pct(7.5) + ' pilots', decades: [-7, 0], ref: 1e-3, refP: seg(p, 0.2, 0.4), curves: [] });
      P.legend(g, R[0] + 16, R[1] + R[3] - lh + 10, ORDER, { p: seg(p, 0, 0.5), size: narrow ? 11 : 12, wrap: R[0] + R[2] - 170 });
      g.labelPx(R[0] + R[2] / 2, R[1] + R[3] * 0.5, 'Which curve will remain highest?', C.gold, { size: narrow ? 12 : 14, align: 'center', p: seg(p, 0.25, 0.55) });
    } });
  out.push({ id: 'p75', chapter: CH.shows, title: 'At 7.5% pilots', layout: 'side', dur: 7.5,
    text: 'These are the six pooled curves at ' + pct(7.5) + ' pilots. Their first sampled SNR values at a pooled BER of 10⁻³ or less are ' + firstSentence(i75) + '. ' +
      'CORAL’s lowest sampled pooled BER is ' + sci(LOWEST.coral[i75], 1) + ', so it does not reach 10⁻³ on this grid. ' +
      'The dashed line is only a reading aid; the table sets no target BER. This observation does not by itself identify which receiver mechanism caused a difference.',
    math: 'pooled over ' + M.COMMON.length + ' cases;  first sampled SNR with BER ≤ 10⁻³:  ' + ORDER.map(function (k) { return M.NAME[k] + ' ' + dB(FIRST[k][i75]); }).join(',  '),
    a11y: 'Six pooled BER curves at 7.5 percent pilots over the fixed four-case scope. First sampled SNR at or below 10 to the minus 3: ' + firstSentence(i75) + '. CORAL never reaches that line; its lowest sampled pooled BER is ' + sci(LOWEST.coral[i75], 1) + '. The threshold is a reading aid, not a configured receiver target.',
    draw: function (g, p) {
      var R = g.sideR, narrow = R[2] < 560, lh = narrow ? 64 : 34;
      P.berPlot(g, [R[0], R[1], R[2], R[3] - lh], { title: 'pooled over ' + M.COMMON.length + ' cases, ' + pct(7.5) + ' pilots', decades: [-7, 0], ref: 1e-3, refP: seg(p, 0.75, 0.9), curves: curvesAt(i75, p) });
      P.legend(g, R[0] + 16, R[1] + R[3] - lh + 10, ORDER, { p: seg(p, 0, 0.6), size: narrow ? 11 : 12, wrap: R[0] + R[2] - 170 });
      g.labelPx(R[0] + R[2] - 16, R[1] + R[3] - (narrow ? 14 : lh - 10), 'dashed: 10⁻³, a reading aid', C.gold, { plain: true, size: 11.5, align: 'right', p: seg(p, 0.75, 0.9) });
    } });

  var twoFive = Math.min.apply(null, ORDER.map(function (k) { return LOWEST[k][0]; }));
  var firstPilotOnly = PIL.map(function (pl, i) { return FIRST['ofdm+fec'][i] != null && FIRST['pfft+fec'][i] != null; }).indexOf(true);
  out.push({ id: 'sweep', chapter: CH.shows, title: 'Supporting view: all pilot sweeps', layout: 'side', dur: 9,
    text: 'These panels retain the full curves behind the threshold grid. With ' + pct(LO.ratio) + ' pilots none of the six pooled curves reaches 10⁻³; the lowest sampled BER is ' + sci(twoFive, 1) + '. PEARL now appears in every panel and first reaches 10⁻³ at ' + dB(FIRST.pearl[pi(5)]) + ' with 5% pilots. ' +
      'OFDM + FEC and Partial FFT + FEC first reach 10⁻³ from ' + pct(PIL[firstPilotOnly].ratio) + ' pilots. The sampled results do not obey a pointwise rule that more pilots always lowers every curve. ' +
      'For example, CORAL’s lowest pooled BER is ' + sci(LOWEST.coral[pi(12)], 1) + ' at 12% pilots and ' + sci(LOWEST.coral[pi(15)], 1) + ' at 15% pilots.',
    math: 'lowest pooled BER of CORAL:  ' + PIL.map(function (pl, i) { return pct(pl.ratio) + ' ' + sci(LOWEST.coral[i], 1); }).join(',  '),
    a11y: 'Supporting sweep of pooled BER against sampled SNR at five pilot ratios over the same four cases. All six receivers are drawn in every panel. At 2.5 percent pilots none reaches 10 to the minus 3; the lowest sampled BER is ' + sci(twoFive, 1) + '. PEARL first reaches 10 to the minus 3 at ' + dB(FIRST.pearl[pi(5)]) + ' with 5 percent pilots. OFDM plus FEC and Partial FFT plus FEC first reach 10 to the minus 3 at 7.5 percent pilots. CORAL’s minimum is ' + sci(LOWEST.coral[pi(12)], 1) + ' at 12 percent and ' + sci(LOWEST.coral[pi(15)], 1) + ' at 15 percent, so the result is not pointwise monotonic in pilot ratio.',
    draw: function (g, p) {
      var R = g.sideR, narrow = R[2] < 560; g.panel(R);
      var cols = narrow ? 2 : 3, rows = Math.ceil(PIL.length / cols), lh = narrow ? 60 : 30, w = (R[2] - 12) / cols, h = (R[3] - lh - 8) / rows;
      PIL.forEach(function (pl, i) {
        var q = seg(p, 0.05 + 0.17 * i, 0.25 + 0.17 * i), x = R[0] + 6 + (i % cols) * w, y = R[1] + 4 + Math.floor(i / cols) * h;
        P.berPlot(g, [x, y, w - 6, h - 6], { compact: true, title: pct(pl.ratio) + ' pilots', decades: [-7, 0], ref: 1e-3, refP: q, curves: curvesAt(i, q, { all: true }) });
      });
      if (!narrow || PIL.length % cols) {
        var lx = narrow ? R[0] + 16 : R[0] + 6 + (PIL.length % cols) * w + 16, ly = narrow ? R[1] + R[3] - lh + 6 : R[1] + 4 + (rows - 1) * h + 30;
        P.legend(g, lx, ly, ORDER, { vertical: !narrow, rowH: 22, size: 12, p: seg(p, 0, 0.3), wrap: R[0] + R[2] - 140 });
        if (!narrow) g.labelPx(lx, ly + ORDER.length * 22 + 10, 'dashed: 10⁻³, a reading aid', C.gold, { plain: true, size: 11, p: seg(p, 0.2, 0.4) });
      }
    } });

  var i12 = pi(12);
  out.push({ id: 'thresholds', chapter: CH.shows, title: 'Main comparison: first sampled SNR at 10⁻³', layout: 'side', dur: 6.5,
    text: 'This grid reads one number from each pooled curve: the first sampled SNR at which its BER is 10⁻³ or less. A dash means none of the 0-to-30 dB samples reaches that level. ' +
      'Read across a row to see what pilots do for one receiver; read down a column to compare receivers at one pilot ratio. ' +
      'At ' + pct(12) + ' pilots, for example, the six entries are ' + firstSentence(i12) + '.',
    math: 'cell = first sampled SNR with pooled BER ≤ 10⁻³ over the fixed four cases;  — : not sampled by 30 dB;  missing: no authenticated curve',
    a11y: 'Main threshold table. Columns are pilot ratios. At 2.5 percent: ' + firstSentence(pi(2.5)) + '. At 5 percent: ' + firstSentence(pi(5)) + '. At 7.5 percent: ' + firstSentence(pi(7.5)) + '. At 12 percent: ' + firstSentence(pi(12)) + '. At 15 percent: ' + firstSentence(pi(15)) + '. Never means no sampled SNR from 0 through 30 dB reaches a pooled BER of 10 to the minus 3. Missing means no authenticated curve exists.',
    draw: function (g, p) {
      var R = g.sideR, narrow = R[2] < 560; g.panel(R, narrow ? 'first sampled SNR at 10⁻³' : 'first SNR at which the pooled BER is 10⁻³ or less');
      P.matrix(g, R, { rows: ORDER, cols: PIL.map(function (pl) { return pct(pl.ratio) + (narrow ? '' : ' pilots'); }), labelW: narrow ? 112 : 160, top: 64, maxH: narrow ? 40 : 56, size: narrow ? 12 : 14, headSize: narrow ? 10 : 11.5, p: p,
        cell: function (id, k) { var s = FIRST[id][k]; if (!curveReady(id, k)) return { hatch: true, text: narrow ? 'miss.' : 'missing', textCol: C.dim }; return s == null ? { text: '—', textCol: C.dim } : { fill: 'rgba(169,205,246,' + num(0.12 + 0.5 * (1 - s / 30), 2) + ')', text: s + ' dB' }; } });
    } });

  var i15 = pi(15);
  function zeroSentence(i) { return 'from ' + list(ORDER.filter(function (k) { return ZERO[k][i] != null; }).map(function (k) { return M.NAME[k] + ' at ' + ZERO[k][i] + ' dB'; })); }
  out.push({ id: 'zeros', chapter: CH.shows, title: 'Where no error was seen', layout: 'side', dur: 6.5,
    text: 'Pooled over the ' + M.COMMON.length + ' cases, some curves end in points with no error seen. At ' + pct(12) + ' pilots the hollow run starts ' + zeroSentence(i12) + '. ' +
      'At ' + pct(15) + ' pilots it starts ' + zeroSentence(i15) + '. CORAL shows errors at every one of its ' + group(cov[ORDER.indexOf('coral')].available) + ' receiver results, across all ' + NCH + ' cases. ' +
      'Each pooled zero says only that no error appeared among ' + group(commonBits(i15)) + ' bits at ' + pct(15) + ' pilots, or ' + group(commonBits(i12)) + ' at ' + pct(12) + '.',
    math: 'a run of hollow points = zero observed errors in every later sampled pooled curve point',
    a11y: 'Zero-observation runs in pooled curves. At 12 percent pilots they start ' + zeroSentence(i12) + '. At 15 percent pilots they start ' + zeroSentence(i15) + '. CORAL has observed errors at all 960 available receiver results. Hollow markers use 0.5 divided by scored bits only for logarithmic plotting.',
    draw: function (g, p) {
      var R = g.sideR, c = g.ctx, narrow = R[2] < 560; g.panel(R, narrow ? 'no error seen: hollow points' : 'pooled points with no error seen (hollow) at the two highest pilot ratios');
      [i12, i15].forEach(function (pIdx, b) {
        var top = R[1] + 46 + b * (R[3] - 56) / 2, q = seg(p, 0.05 + 0.45 * b, 0.45 + 0.45 * b), lw = narrow ? 96 : 150, cw = (R[2] - lw - 20) / D.snrs.length, rh = Math.min(26, ((R[3] - 56) / 2 - 40) / ORDER.length);
        g.labelPx(R[0] + 12, top, pct(PIL[pIdx].ratio) + ' pilots', C.gold, { plain: true, size: 12.5, p: q });
        D.snrs.forEach(function (s, k) { if (s % 10 === 0) g.labelPx(R[0] + lw + cw * (k + 0.5), top, s + ' dB', C.dim, { plain: true, size: 10, align: 'center', p: q }); });
        ORDER.forEach(function (id, r) {
          var y = top + 20 + r * rh + rh / 2; g.labelPx(R[0] + 12, y, RX[id].name, RX[id].col, { plain: true, size: P.fitSize(g, RX[id].name, lw - 20, narrow ? 10 : 11.5), p: q });
          CURVES[id][pIdx].forEach(function (pt, k) { var qq = seg(q, k / D.snrs.length * 0.7, k / D.snrs.length * 0.7 + 0.3); if (!(qq > 0)) return; P.marker(c, R[0] + lw + cw * (k + 0.5), y, RX[id].shape, Math.min(5, cw / 3.2), pt.zero ? RX[id].col : 'rgba(242,245,248,0.25)', { hollow: pt.zero, alpha: qq }); });
        });
      });
    } });

  var iC = pi(5), sC = 20, perChan = {}; ORDER.forEach(function (k) { perChan[k] = M.CHANNELS.map(function (ch) { return M.point(k, ch, iC, si(sC)); }); });
  var hardest = M.CHANNELS.reduce(function (a, ch, k) { return perChan['ofdm+fec'][k].ber > perChan['ofdm+fec'][a].ber ? k : a; }, 0);
  var h3Lowest = D.recordings.every(function (r) { var ks = M.CHANNELS.map(function (ch, k) { return ch.red === r ? k : -1; }).filter(function (k) { return k >= 0; }), best = ks.reduce(function (a, k) { return perChan['ofdm+fec'][k].ber <= perChan['ofdm+fec'][a].ber ? k : a; }, ks[0]); return M.CHANNELS[best].hyd === 3; });
  out.push({ id: 'channels', chapter: CH.shows, title: 'Case by case before pooling', layout: 'side', dur: 6.5,
    text: 'Pooling hides how much the recording–hydrophone cases differ. This map shows every case at one test condition: ' + pct(5) + ' pilots and ' + sC + ' dB. ' +
      chanText(M.CHANNELS[hardest]) + ' is the hardest there: OFDM + FEC leaves ' + sci(perChan['ofdm+fec'][hardest].ber, 1) + ', JADE ' + sci(perChan.jade[hardest].ber, 1) + ' and SAPPHIRE ' + sci(perChan.cajode[hardest].ber, 1) + '. ' +
      (h3Lowest ? 'On every recording, hydrophone 3 gives OFDM + FEC its lowest BER at this point. ' : '') +
      'At this 5% condition, PEARL is available on the four fixed plot-scope cases; the other eight have no complete source result. The other five receivers have results on all 12 cases.',
    math: 'one test condition: ' + pct(5) + ' pilots, ' + sC + ' dB, every recording–hydrophone case, ' + D.frames + ' frames each',
    a11y: 'Case-by-case information BER at 5 percent pilots and 20 dB. ' + chanText(M.CHANNELS[hardest]) + ' has the largest OFDM plus FEC BER, ' + sci(perChan['ofdm+fec'][hardest].ber, 1) + '; JADE is ' + sci(perChan.jade[hardest].ber, 1) + ' and SAPPHIRE is ' + sci(perChan.cajode[hardest].ber, 1) + ' there. PEARL is available on the four fixed plot-scope cases and missing on the other eight. Hydrophone 3 has the lowest OFDM plus FEC BER within every recording at this condition. The other five receivers have results on all twelve cases.',
    draw: function (g, p) {
      var R = g.sideR, narrow = R[2] < 560; g.panel(R, narrow ? 'BER by case: ' + pct(5) + ' pilots, ' + sC + ' dB' : 'information BER per case at ' + pct(5) + ' pilots, ' + sC + ' dB');
      var res = P.matrix(g, [R[0], R[1], R[2], R[3] - 40], { rows: ORDER, cols: M.CHANNELS.map(function (ch) { return ch.key; }), labelW: narrow ? 104 : 150, top: 56, maxH: narrow ? 34 : 50, headSize: narrow ? 8.5 : 10.5, size: narrow ? 8.5 : 10.5, p: p,
        cell: function (id, k) { var q = perChan[id][k]; if (!q) return { hatch: true }; return q.zero ? { fill: 'rgba(38,70,112,0.6)', text: '0', textCol: C.ink } : { fill: P.berColour(q.ber), text: narrow ? '' : sci(q.ber, 0) }; } });
      if (narrow) {
        g.labelPx(R[0] + 12, res.bottom + 20, 'colour: BER (blue low, warm high)', C.dim, { plain: true, size: 9.5, p: seg(p, 0.75, 0.95) });
        g.labelPx(R[0] + 12, res.bottom + 35, 'hatch: missing result', C.dim, { plain: true, size: 9.5, p: seg(p, 0.75, 0.95) });
      } else g.labelPx(R[0] + 16, res.bottom + 22, 'colour: information BER on a logarithmic scale, blue small, warm large;  0: no error seen;  hatched: missing', C.dim, { plain: true, size: 11, p: seg(p, 0.75, 0.95) });
    } });

  // ------------------------------------------------------------ 5. what the table supports
  var fromFive = PIL.map(function (pl, i) { return i; }).filter(function (i) { return PIL[i].ratio >= 5; });
  var jointLead = fromFive.every(function (i) { return ['jade', 'cajode'].every(function (k) { return FIRST[k][i] != null && ['ofdm+fec', 'pfft+fec', 'coral'].every(function (o) { return FIRST[o][i] == null || FIRST[o][i] > FIRST[k][i]; }); }); });
  var SUPPORT = [
    'At 2.5% pilots, none of the six pooled curves reaches 10⁻³; the lowest sampled BER is ' + sci(twoFive, 1) + '.',
    (jointLead ? 'From 5% to 15% pilots, JADE and SAPPHIRE first sample 10⁻³ at a lower SNR than OFDM + FEC, Partial FFT + FEC and CORAL.' : ''),
    'OFDM + FEC and Partial FFT + FEC first sample 10⁻³ only from ' + pct(PIL[firstPilotOnly].ratio) + ' pilots.',
    'CORAL shows errors at every available receiver result; its lowest pooled BER is ' + sci(coralFloor, 1) + '.',
    'At 12% and 15% pilots, JADE and SAPPHIRE show runs with no error seen.',
    'PEARL has authenticated pooled curves at all five pilot ratios on the fixed four-case scope.'
  ].filter(Boolean);
  var NOT = [
    'A six-receiver comparison on every Red channel: PEARL coverage outside the fixed four-case scope is incomplete.',
    'A measured BER of 0.5/N: that value only places a zero-observation marker on a logarithmic plot.',
    'Anything about speed: the table holds no timing.',
    'A causal explanation: the table compares outcomes but does not isolate which mechanism caused a difference.',
    'Other pilot ratios, code rates or FFT lengths, such as the older 20% pilot runs.',
    'SAPPHIRE with more than 50 updates.',
    'One paired run for all six: the three cohorts are separate experiment families.'
  ];
  out.push({ id: 'supports', chapter: CH.claims, title: 'What the table supports, and what it does not', layout: 'side', dur: 7,
    text: 'Read with its settings and the fixed ' + M.COMMON.length + '-case plot scope, the table supports descriptive statements like those marked with a tick. PEARL participates only where its curve is authenticated. ' +
      'It does not support those marked with a cross. The observations are descriptive for this table, not causal explanations or universal receiver rankings. A rebuild recomputes every ticked statement from the counts.',
    math: 'supported: descriptive, pooled over the fixed four cases, at these settings;  not supported: missing-curve rankings, causality, universality or speed',
    a11y: 'Evidence boundary. Supported statements: ' + SUPPORT.join(' ') + ' Not supported: ' + NOT.join(' '),
    draw: function (g, p) {
      var R = g.sideR, c = g.ctx, narrow = R[2] < 560; g.panel(R);
      var colW = narrow ? R[2] - 32 : (R[2] - 48) / 2, blocks = [['The table supports', SUPPORT, C.green], ['It does not support', NOT, C.red]];
      var yNext = R[1] + 22;
      blocks.forEach(function (b, k) {
        var x = narrow ? R[0] + 16 : R[0] + 16 + k * (colW + 16), y = narrow ? yNext : R[1] + 22, q = seg(p, 0.05 + 0.45 * k, 0.25 + 0.45 * k);
        g.labelPx(x, y, b[0], b[2], { plain: true, size: narrow ? 12.5 : 14, p: q }); y += narrow ? 22 : 30;
        b[1].forEach(function (t, i) {
          var qq = seg(p, 0.08 + 0.45 * k + 0.06 * i, 0.2 + 0.45 * k + 0.06 * i), lines = wrap(c, g, t, colW - 22, narrow ? 11 : 12.5);
          g.labelPx(x, y, k ? '✕' : '✓', b[2], { plain: true, size: 12, p: qq });
          lines.forEach(function (ln, j) { g.labelPx(x + 18, y + j * (narrow ? 15 : 18), ln, C.ink, { plain: true, size: narrow ? 11 : 12.5, p: qq }); });
          y += lines.length * (narrow ? 15 : 18) + (narrow ? 6 : 10);
        });
        yNext = y + 8;
      });
    } });
  function wrap(c, g, text, maxW, size) {
    c.font = '600 ' + size + 'px ' + g.sans; var words = text.split(' '), lines = [], line = '';
    words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line); return lines;
  }

  out.push({ id: 'snapshot', chapter: CH.claims, title: 'Provenance appendix: the data snapshot', layout: 'side', dur: 5,
    text: 'These pages read the table rebuilt at ' + D.snapshot + '. Its CSV file has the SHA-256 hash ' + D.csvSha256.slice(0, 12) + '…' + D.csvSha256.slice(-4) + '. ' +
      'The table can be rebuilt from its sibling result repositories; rows now missing are filled once their runs produce authenticated aggregates. ' +
      'Rebuilding this page then recomputes every number in it, including the statements on the previous page.',
    math: 'python3 -B results/red_hydrophone_ber/build_table.py;  python3 -B source/red_ber/build_ber.py',
    draw: function (g, p) {
      var R = g.sideR, narrow = R[2] < 560; g.panel(R, 'the table these pages read');
      var rows = [['snapshot', D.snapshot], ['rows', group(D.rows) + ': ' + group(avail) + ' available, ' + group(miss) + ' missing'], ['CSV SHA-256', D.csvSha256.slice(0, 32)], ['', D.csvSha256.slice(32)],
        ['settings', 'FFT ' + D.fftLength + ', code rate ' + D.codeRate + ', ' + D.frames + ' frames per result'], ['cases', NCH + ' (' + D.recordings.length + ' recordings × ' + D.hydrophones.length + ' hydrophones)'], ['plot scope', M.COMMON.map(function (c) { return c.key; }).join(' ')]];
      rows.forEach(function (r, i) {
        var y = R[1] + 56 + i * (narrow ? 34 : 40), q = seg(p, 0.05 + 0.1 * i, 0.25 + 0.1 * i);
        if (r[0]) g.labelPx(R[0] + 16, y, r[0], C.gold, { plain: true, size: 12, p: q });
        g.labelPx(R[0] + (narrow ? 16 : 150), y + (narrow ? 16 : 0), r[1], C.ink, { plain: true, mono: true, size: narrow ? 10 : 12.5, p: q });
      });
    } });

  out.push({ id: 'synthesis', chapter: CH.claims, title: 'Six routes, one bounded conclusion', layout: 'side', dur: 6.5,
    text: 'The first two routes estimate from pilots and decode once. JADE supplies extrinsic information from the decoder to the next estimation pass. PEARL retains its check-to-variable and variable-to-check messages across message-passing iterations while updating the channel estimate. CORAL includes code constraints as penalty terms and no BP decoder. SAPPHIRE projects a local copy of the bit variables for each parity check onto its parity polytope and updates scaled dual variables. ' +
      (jointLead ? 'On the fixed four case labels and this table’s settings, JADE and SAPPHIRE first sample 10⁻³ at lower SNR values than OFDM + FEC, Partial FFT + FEC and CORAL from 5% through 15% pilots. ' : '') +
      'PEARL is present at all five pilot ratios on the fixed four-case scope. These sentences report observed patterns, not causes or promises for another channel, code, pilot ratio, update budget, or cohort.',
    math: 'mechanism map + coverage boundary + counted errors = an interpretable descriptive result',
    a11y: 'Final synthesis. OFDM plus FEC and Partial FFT plus FEC use pilot-assisted channel estimation, decode once, and provide no feedback. JADE adds extrinsic information from the decoder to the next estimation pass. PEARL retains check-to-variable and variable-to-check messages across message-passing iterations while updating the channel estimate. CORAL uses penalty terms and no BP decoder. SAPPHIRE projects local copies onto parity polytopes and updates scaled dual variables. PEARL is plotted at all five pilot ratios on the fixed four cases. Every threshold statement is descriptive over those labels, not a causal or universal conclusion.',
    draw: function (g, p) {
      var R = g.sideR, c = g.ctx, narrow = R[2] < 560; g.panel(R, narrow ? 'three questions for the next table' : 'carry three questions to the next result table');
      var cards = [
        ['1', 'Where does the code enter?', 'after demodulation, as feedback, in penalty terms, or through parity-polytope constraints', 'after demodulation or as feedback|in penalty terms, or in parity polytopes'],
        ['2', 'What returns to the next update?', 'nothing, decoder information, the current estimates, or scaled dual variables', 'nothing, decoder information,|current estimates, or scaled dual variables'],
        ['3', 'What was actually compared?', 'the same received samples and noise realization, or only common configuration labels', 'same received samples and noise|or only common configuration labels']
      ];
      cards.forEach(function (a, i) {
        var q = seg(p, 0.08 + 0.24 * i, 0.34 + 0.24 * i), x = R[0] + 18, y = R[1] + 52 + i * (narrow ? 102 : 112), w = R[2] - 36, h = narrow ? 84 : 92;
        c.save(); c.globalAlpha = q; c.fillStyle = 'rgba(255,255,255,0.045)'; c.strokeStyle = i === 2 ? C.gold : C.faint; c.lineWidth = i === 2 ? 1.8 : 1.1; c.beginPath(); P.rrect(c, x, y, w, h, 8); c.fill(); c.stroke(); c.restore();
        g.labelPx(x + 18, y + 21, a[0], i === 2 ? C.gold : C.blue, { plain: true, mono: true, size: 14, p: q });
        g.labelPx(x + 44, y + 21, a[1], C.ink, { plain: true, size: narrow ? 12 : 14, p: q });
        if (narrow) P.fitText(g, x + 44 + (w - 62) / 2, y + 54, a[3], C.dim, w - 62, 9.5, q);
        else g.labelPx(x + 44, y + 52, a[2], C.dim, { plain: true, size: P.fitSize(g, a[2], w - 62, 12), p: q });
      });
    } });

  // ------------------------------------------------------------ player, chapter bar, keyboard, and deep links
  var STEP_ORDER = ['question', 'grid', 'pilots', 'pooled', 'zero', 'routes', 'pilot-only', 'jade', 'pearl', 'coral', 'cajode', 'cohorts',
    'missing', 'common', 'one-curve-predict', 'one-curve', 'channels', 'p75-predict', 'p75', 'thresholds', 'zeros', 'sweep', 'snapshot', 'supports', 'synthesis'];
  out.sort(function (a, b) { return STEP_ORDER.indexOf(a.id) - STEP_ORDER.indexOf(b.id); });
  var chapters = [];
  out.forEach(function (s, i) { if (!chapters.length || chapters[chapters.length - 1].name !== s.chapter) chapters.push({ name: s.chapter, start: i, n: 0 }); chapters[chapters.length - 1].n++; });
  var bar = document.getElementById('progress');
  if (bar) {
    bar.innerHTML = chapters.map(function (ch, k) { return '<button type="button" class="seg" data-k="' + k + '" style="flex-grow:' + ch.n + '" title="' + ch.name + '"><span class="fill"></span><span class="name">' + ch.name + '</span></button>'; }).join('');
    bar.addEventListener('click', function (e) { var b = e.target.closest ? e.target.closest('[data-k]') : null; if (b) B.go(chapters[+b.getAttribute('data-k')].start); });
  }
  B.onStep(function (i) {
    if (!bar) return;
    Array.prototype.forEach.call(bar.querySelectorAll('[data-k]'), function (b, k) { var ch = chapters[k], f = clamp((i - ch.start + 1) / ch.n, 0, 1); b.querySelector('.fill').style.width = Math.round(f * 100) + '%'; b.classList.toggle('on', i >= ch.start && i < ch.start + ch.n); });
  });
  document.addEventListener('keydown', function (e) { if (e.ctrlKey || e.metaKey || e.altKey) return; if (e.target && /^(INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY)$/.test(e.target.tagName)) return; B.key(e); });
  B.openSteps(out, { embedded: true });
  window.course = { steps: out, chapters: chapters, ber: { curves: CURVES, first: FIRST, zero: ZERO, lowest: LOWEST, support: SUPPORT, not: NOT } };
  var hash = (window.location && window.location.hash) || '', ms = /step=([^&]+)/.exec(hash), mp = /p=([0-9.]+)/.exec(hash);
  if (ms) { var st = decodeURIComponent(ms[1]); B.debug({ step: /^\d+$/.test(st) ? +st : st, p: mp ? +mp[1] : 1 }); }
})();
