// Reading the Red BER table.  One point is one receiver on one channel (a recording and a hydrophone) at one pilot
// ratio and SNR: the bit errors in 47 one-second frames over the payload bits of those frames.  A pooled point adds the
// errors and the bits of several channels.  Works in the page (window.BerData) and in Node (require).
(function (root) {
  'use strict';
  var D = root.BerData || (typeof require === 'function' ? require('./ber_data.js') : null);
  if (!D) return;
  var IDS = D.receivers.map(function (r) { return r.id; });
  var BASE_IDS = IDS.filter(function (id) { return id !== 'pearl'; });
  // The evidence snapshot retains its historical `cajode` / `CAJODE` identifiers.  Keep that provenance intact and
  // map the stable receiver ID to its current public name only at the presentation boundary.
  var PUBLIC_NAME = { cajode: 'SAPPHIRE' };
  var NAME = {}; D.receivers.forEach(function (r) { NAME[r.id] = PUBLIC_NAME[r.id] || r.name; });
  function chan(red, hyd) { return { red: red, hyd: hyd, key: 'R' + red + 'h' + hyd, label: 'Red ' + red + ', hydrophone ' + hyd }; }
  var CHANNELS = []; D.recordings.forEach(function (r) { D.hydrophones.forEach(function (h) { CHANNELS.push(chan(r, h)); }); });
  function counts(rec, c) { var byReceiver = D.errors[rec]; return byReceiver ? byReceiver[c.red - 1][c.hyd - 1] : null; }
  // With a pilot index, availability is for that exact channel/pilot condition.  Without one, the channel must be
  // complete at all five pilot ratios.  This prevents partial PEARL coverage from being treated as a full channel.
  function has(rec, c, pi) {
    var e = counts(rec, c); if (!e) return false;
    if (pi != null) return !!e[pi];
    return e.length === D.pilots.length && e.every(function (row) { return !!row; });
  }
  function bits(pi) { return D.frames * D.pilots[pi].payload; }
  function pilotIndex(ratio) { for (var i = 0; i < D.pilots.length; i++) if (Math.abs(D.pilots[i].ratio - ratio) < 1e-9) return i; return -1; }
  function snrIndex(snr) { return D.snrs.indexOf(snr); }
  // Keep the five-panel comparison population fixed at the six approved Red 1 and Red 2 cases.  Every receiver must
  // have all five pilot ratios on every retained case; a missing PEARL curve therefore fails closed instead of
  // changing the population in just one panel.
  var BASE_COMMON = CHANNELS.filter(function (c) { return BASE_IDS.every(function (k) { return has(k, c); }); });
  var PEARL_PILOTS = D.pilots.map(function (_, pi) { return pi; });
  var PLOT_SCOPE_KEYS = ['R1h1', 'R1h2', 'R1h3', 'R2h1', 'R2h2', 'R2h3'];
  var PLOT_SCOPE = BASE_COMMON.filter(function (c) {
    return PLOT_SCOPE_KEYS.indexOf(c.key) >= 0 && PEARL_PILOTS.every(function (pi) { return has('pearl', c, pi); });
  });
  var COMMON = PLOT_SCOPE;
  // one point; an observed zero keeps BER 0 and gets the table's plotting value 0.5/bits, which is not a measured BER
  function point(rec, c, pi, si) {
    var e = counts(rec, c); if (!e || !e[pi]) return null;
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
  function lowest(cv) { var m = Infinity; cv.forEach(function (q) { if (q && q.ber < m) m = q.ber; }); return m === Infinity ? null : m; }
  // rows available and missing, per receiver
  function coverage() {
    var total = CHANNELS.length * D.pilots.length * D.snrs.length;
    return IDS.map(function (k) {
      var pilots = 0, channels = 0, completeChannels = 0;
      CHANNELS.forEach(function (c) {
        var any = false; D.pilots.forEach(function (_, pi) { if (has(k, c, pi)) { pilots++; any = true; } });
        if (any) channels++; if (has(k, c)) completeChannels++;
      });
      var available = pilots * D.snrs.length;
      return { id: k, name: NAME[k], channels: channels, completeChannels: completeChannels, available: available, missing: total - available };
    });
  }
  function zeroPoints(rec) { var n = 0; CHANNELS.forEach(function (c) { var e = counts(rec, c); if (e) e.forEach(function (row) { if (row) row.forEach(function (x) { if (x === 0) n++; }); }); }); return n; }
  function missingOf(rec, c, pi) {
    for (var i = 0; i < D.missing.length; i++) {
      var m = D.missing[i];
      if (m.receiver === rec && m.red === c.red && m.hydrophone === c.hyd && (pi == null || m.pilot === D.pilots[pi].id)) return m.reason;
    }
    return null;
  }
  var api = { D: D, IDS: IDS, BASE_IDS: BASE_IDS, NAME: NAME, CHANNELS: CHANNELS, BASE_COMMON: BASE_COMMON, PLOT_SCOPE: PLOT_SCOPE, COMMON: COMMON, bits: bits, has: has, pilotIndex: pilotIndex, snrIndex: snrIndex,
              point: point, pooled: pooled, curve: curve, channelCurve: channelCurve, firstAtMost: firstAtMost, zeroFrom: zeroFrom, lowest: lowest,
              coverage: coverage, zeroPoints: zeroPoints, missingOf: missingOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Ber = api;
})(this);
