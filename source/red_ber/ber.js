// Reading the Red BER table.  One point is one receiver on one channel (a recording and a hydrophone) at one pilot
// ratio and SNR: the bit errors in 47 one-second frames over the payload bits of those frames.  A pooled point adds the
// errors and the bits of several channels.  Works in the page (window.BerData) and in Node (require).
(function (root) {
  'use strict';
  var D = root.BerData || (typeof require === 'function' ? require('./ber_data.js') : null);
  if (!D) return;
  var IDS = D.receivers.map(function (r) { return r.id; });
  var NAME = {}; D.receivers.forEach(function (r) { NAME[r.id] = r.name; });
  function chan(red, hyd) { return { red: red, hyd: hyd, key: 'R' + red + 'h' + hyd, label: 'Red ' + red + ', hydrophone ' + hyd }; }
  var CHANNELS = []; D.recordings.forEach(function (r) { D.hydrophones.forEach(function (h) { CHANNELS.push(chan(r, h)); }); });
  function counts(rec, c) { return D.errors[rec][c.red - 1][c.hyd - 1]; }
  function has(rec, c) { return !!counts(rec, c); }
  function bits(pi) { return D.frames * D.pilots[pi].payload; }
  // the channels on which every receiver has results: the only fair ground for a five-way comparison
  var COMMON = CHANNELS.filter(function (c) { return IDS.every(function (k) { return has(k, c); }); });
  function pilotIndex(ratio) { for (var i = 0; i < D.pilots.length; i++) if (Math.abs(D.pilots[i].ratio - ratio) < 1e-9) return i; return -1; }
  function snrIndex(snr) { return D.snrs.indexOf(snr); }
  // one point; an observed zero keeps BER 0 and gets the table's plotting value 0.5/bits, which is not a measured BER
  function point(rec, c, pi, si) {
    var e = counts(rec, c); if (!e) return null;
    var n = bits(pi), x = e[pi][si];
    return { errors: x, bits: n, ber: x / n, zero: x === 0, plot: x === 0 ? 0.5 / n : x / n, snr: D.snrs[si] };
  }
  // a pooled point: the errors and the bits added over the channels; null if any channel has no result
  function pooled(rec, pi, si, chans) {
    var E = 0, N = 0; chans = chans || COMMON;
    for (var i = 0; i < chans.length; i++) { var q = point(rec, chans[i], pi, si); if (!q) return null; E += q.errors; N += q.bits; }
    return { errors: E, bits: N, ber: E / N, zero: E === 0, plot: E === 0 ? 0.5 / N : E / N, snr: D.snrs[si] };
  }
  function curve(rec, pi, chans) { return D.snrs.map(function (s, si) { return pooled(rec, pi, si, chans); }); }
  function channelCurve(rec, c, pi) { return D.snrs.map(function (s, si) { return point(rec, c, pi, si); }); }
  // the lowest SNR at which a curve's BER is at most `level`, or null when it never gets there
  function firstAtMost(cv, level) { for (var i = 0; i < cv.length; i++) if (cv[i] && cv[i].ber <= level) return cv[i].snr; return null; }
  // the lowest SNR from which every higher point shows no observed error, or null
  function zeroFrom(cv) { var from = null; for (var i = cv.length - 1; i >= 0; i--) { if (cv[i] && cv[i].zero) from = cv[i].snr; else break; } return from; }
  function lowest(cv) { var m = Infinity; cv.forEach(function (q) { if (q && q.ber < m) m = q.ber; }); return m; }
  // rows available and missing, per receiver
  function coverage() {
    var per = D.pilots.length * D.snrs.length;
    return IDS.map(function (k) { var n = CHANNELS.filter(function (c) { return has(k, c); }).length; return { id: k, name: NAME[k], channels: n, available: n * per, missing: (CHANNELS.length - n) * per }; });
  }
  function zeroPoints(rec) { var n = 0; CHANNELS.forEach(function (c) { var e = counts(rec, c); if (e) e.forEach(function (row) { row.forEach(function (x) { if (x === 0) n++; }); }); }); return n; }
  function missingOf(rec, c) { for (var i = 0; i < D.missing.length; i++) { var m = D.missing[i]; if (m.receiver === rec && m.red === c.red && m.hydrophone === c.hyd) return m.reason; } return null; }
  var api = { D: D, IDS: IDS, NAME: NAME, CHANNELS: CHANNELS, COMMON: COMMON, bits: bits, has: has, pilotIndex: pilotIndex, snrIndex: snrIndex,
              point: point, pooled: pooled, curve: curve, channelCurve: channelCurve, firstAtMost: firstAtMost, zeroFrom: zeroFrom, lowest: lowest,
              coverage: coverage, zeroPoints: zeroPoints, missingOf: missingOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Ber = api;
})(this);
