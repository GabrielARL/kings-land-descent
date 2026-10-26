// Data, model, wording, drawing and generated-page checks for "Six receivers on the Red recordings".
// Run from anywhere with Node 12 or later:  node source/red_ber/test_ber.js
var fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process'), crypto = require('crypto');
var D = require('./ber_data.js'), M = require('./ber.js');
var failures = 0, checks = 0;
function check(what, ok, detail) { checks++; console.log((ok ? 'ok    ' : 'FAIL  ') + what + (detail !== undefined && detail !== '' ? '  [' + detail + ']' : '')); if (!ok) failures++; }
var CSV = path.join(__dirname, '..', '..', 'results', 'red_hydrophone_ber', 'red_hydrophone_ber.csv');

// ---------------------------------------------------------------- 1. the data file against the CSV, read independently
var rows = null;
if (fs.existsSync(CSV)) {
  var raw = fs.readFileSync(CSV), lines = raw.toString('utf8').split(/\r?\n/).filter(Boolean), head = lines[0].split(',');
  rows = lines.slice(1).map(function (l) { var v = l.split(','), r = {}; head.forEach(function (h, i) { r[h] = v[i]; }); return r; });
  check('the data file records the CSV it was made from', crypto.createHash('sha256').update(raw).digest('hex') === D.csvSha256 && rows.length === D.rows && rows[0].snapshot_utc === D.snapshot);
  var bad = 0;
  rows.forEach(function (r) {
    var e = D.errors[r.receiver][+r.red - 1][+r.hydrophone - 1], pi = M.pilotIndex(+r.pilot_ratio_percent), si = M.snrIndex(+r.snr_db);
    if (r.status === 'missing') { if (!e || e[pi] !== null) bad++; return; }
    if (!e || !e[pi] || e[pi][si] !== +r.total_bit_errors || M.bits(pi) !== +r.total_payload_bits) bad++;
  });
  check('every one of the 5,760 rows matches the data file: counts, bits and pilot-specific missing conditions', bad === 0, bad + ' mismatches');
} else check('the CSV is absent; the committed data file is used as it is', true);

// ---------------------------------------------------------------- 2. the model
var cov = M.coverage();
check('six receiver records include PEARL with its frozen cohort',
  M.IDS.join(',') === 'ofdm+fec,pfft+fec,jade,coral,cajode,pearl' && D.receivers.filter(function (r) { return r.id === 'pearl' && r.name === 'PEARL' && r.cohort === 'persistent_r2_v1'; }).length === 1);
check('the legacy evidence identity is presented publicly as SAPPHIRE',
  D.receivers.filter(function (r) { return r.id === 'cajode' && r.name === 'CAJODE' && r.cohort === 'modern_r3_ber'; }).length === 1 &&
  M.NAME.cajode === 'SAPPHIRE' && cov.filter(function (r) { return r.id === 'cajode' && r.name === 'SAPPHIRE'; }).length === 1);
check('coverage: all 5,760 rows are available, including all 960 PEARL rows',
  cov.reduce(function (s, q) { return s + q.available; }, 0) === 5760 && cov.reduce(function (s, q) { return s + q.missing; }, 0) === 0 &&
  cov.map(function (q) { return q.available; }).join(',') === '960,960,960,960,960,960');
check('the five established receivers have twelve complete base cases',
  M.BASE_COMMON.map(function (c) { return c.key; }).join(' ') === 'R1h1 R1h2 R1h3 R2h1 R2h2 R2h3 R3h1 R3h2 R3h3 R4h1 R4h2 R4h3');
check('the fixed six-receiver plot scope is six cases complete at all five pilot ratios',
  M.COMMON === M.PLOT_SCOPE && M.COMMON.map(function (c) { return c.key; }).join(' ') === 'R1h1 R1h2 R1h3 R2h1 R2h2 R2h3' &&
  [2.5, 5, 7.5, 12, 15].every(function (ratio) { var pi = M.pilotIndex(ratio); return M.COMMON.every(function (c) { return M.has('pearl', c, pi); }); }));
// pooled BER is the sum of errors over the sum of bits, read here straight from the CSV rows
function pooledFromRows(rec, ratio, snr) {
  var E = 0, N = 0; rows.forEach(function (r) { if (r.status === 'available' && r.receiver === rec && +r.pilot_ratio_percent === ratio && +r.snr_db === snr && M.COMMON.some(function (c) { return c.red === +r.red && c.hyd === +r.hydrophone; })) { E += +r.total_bit_errors; N += +r.total_payload_bits; } });
  return N ? { E: E, N: N } : null;
}
if (rows) {
  var okPool = true;
  M.IDS.forEach(function (k) { [2.5, 7.5, 15].forEach(function (ratio) { [0, 12, 30].forEach(function (snr) { var a = pooledFromRows(k, ratio, snr), b = M.pooled(k, M.pilotIndex(ratio), M.snrIndex(snr)); if ((!a) !== (!b) || a && (a.E !== b.errors || a.N !== b.bits)) okPool = false; }); }); });
  check('pooled points add errors and bits over the same six cases before dividing, or remain null', okPool);
}
var z = M.point('jade', M.COMMON[0], M.pilotIndex(15), M.snrIndex(30));
check('a point with no error seen keeps BER 0 and is plotted at 0.5 / bits', z.zero && z.ber === 0 && Math.abs(z.plot - 0.5 / z.bits) < 1e-18);
check('PEARL is available on the fixed plot scope at all five pilot ratios',
  [2.5, 5, 7.5, 12, 15].every(function (r) { return M.curve('pearl', M.pilotIndex(r)).every(function (q) { return q !== null; }); }));
check('PEARL has all five pilot ratios on all twelve recording–hydrophone cases',
  M.CHANNELS.every(function (c) { return [2.5, 5, 7.5, 12, 15].every(function (ratio) { return M.has('pearl', c, M.pilotIndex(ratio)) && M.missingOf('pearl', c, M.pilotIndex(ratio)) === null; }); }));
check('full-table coverage does not expand the fixed six-case pooled scope',
  M.point('pearl', M.CHANNELS[11], M.pilotIndex(15), 0) !== null && M.COMMON.indexOf(M.CHANNELS[5]) >= 0 && M.COMMON.indexOf(M.CHANNELS[6]) < 0 &&
  M.pooled('pearl', M.pilotIndex(15), 0) !== null);

// ---------------------------------------------------------------- 3. the course in a browser-less sandbox
function sandbox(width, height) {
  var elements = {}, noop = function () {};
  function context2d() {
    var state = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '', imageSmoothingEnabled: true };
    return new Proxy(state, { get: function (o, key) {
      if (key === 'measureText') return function (q) { return { width: 6.6 * String(q).length }; };
      if (key === 'createImageData') return function (w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; };
      if (key === 'createRadialGradient' || key === 'createLinearGradient') return function () { return { addColorStop: noop }; };
      if (key in o) return o[key];
      return typeof key === 'string' ? noop : undefined;
    } });
  }
  function element(id) {
    if (elements[id]) return elements[id];
    var e = { id: id, hidden: false, textContent: '', innerHTML: '', disabled: false, width: 0, height: 0, style: {}, offsetTop: 0, offsetHeight: 0, scrollTop: 0, clientHeight: height,
      classList: { toggle: noop, add: noop, remove: noop, contains: function () { return false; } }, setAttribute: function (n, v) { this[n] = String(v); }, getAttribute: function (n) { return this[n] == null ? null : this[n]; },
      addEventListener: noop, querySelectorAll: function () { return []; }, querySelector: function () { return element('q-' + Object.keys(elements).length); }, closest: function () { return null; },
      scrollIntoView: noop, focus: noop, getBoundingClientRect: function () { return { width: width, height: height, top: 0, left: 0, right: width, bottom: height }; }, getContext: function () { return context2d(); } };
    return (elements[id] = e);
  }
  var sb = { console: console, performance: { now: function () { return 0; } }, requestAnimationFrame: function () { return 1; }, cancelAnimationFrame: noop,
    getComputedStyle: function () { return { fontFamily: 'sans-serif', getPropertyValue: function () { return 'monospace'; } }; },
    document: { body: {}, documentElement: {}, getElementById: element, querySelectorAll: function () { return []; }, addEventListener: noop, createElement: function () { return element('created-' + Object.keys(elements).length); } },
    location: { hash: '' }, devicePixelRatio: 1, addEventListener: noop, Proxy: Proxy, Float32Array: Float32Array, Float64Array: Float64Array, Uint8ClampedArray: Uint8ClampedArray };
  sb.window = sb; vm.createContext(sb);
  [[path.join(__dirname, '..', 'simulator'), 'board.js'], [__dirname, 'ber_data.js'], [__dirname, 'ber.js'], [__dirname, 'ber_parts.js'], [__dirname, 'ber_course.js']].forEach(function (q) {
    vm.runInContext(fs.readFileSync(path.join(q[0], q[1]), 'utf8'), sb, { filename: q[1] });
  });
  return sb;
}
var sb = null, course = null, err = null;
try { sb = sandbox(960, 660); course = sb.course; } catch (e) { err = e && e.stack || String(e); }
check('the course builds in the sandbox', !!course, err);
if (course) {
  var steps = course.steps, ids = steps.map(function (q) { return q.id; });
  var expected = ['question', 'grid', 'pilots', 'pooled', 'zero', 'routes', 'pilot-only', 'jade', 'pearl', 'coral', 'cajode', 'cohorts', 'missing', 'common', 'one-curve-predict', 'one-curve', 'channels', 'p75-predict', 'p75', 'thresholds', 'zeros', 'sweep', 'snapshot', 'supports', 'synthesis'];
  check('the six-receiver course has the intended 25 steps in 5 chapters', steps.length === 25 && course.chapters.length === 5 && ids.join(',') === expected.join(','), steps.length + ' steps: ' + ids.join(','));
  check('the drawing key gives PEARL a red hexagon after SAPPHIRE',
    sb.BerParts.ORDER.join(',') === 'ofdm+fec,pfft+fec,jade,coral,cajode,pearl' && sb.BerParts.RX.pearl.name === 'PEARL' && sb.BerParts.RX.pearl.col === '#ff9a8a' && sb.BerParts.RX.pearl.shape === 'hexagon');
  var drawn = 0, errs = [];
  [[960, 660], [420, 900]].forEach(function (size) {
    var s2 = size[0] === 960 ? sb : sandbox(size[0], size[1]);
    s2.course.steps.forEach(function (q, i) { [0, 0.15, 0.35, 0.5, 0.7, 0.9, 1].forEach(function (pp) { s2.Board.debug({ step: i, p: pp }); drawn++; }); });
    errs = errs.concat(s2.kingsLandErrors || []);
  });
  check('every step draws at seven moments, at desktop and phone sizes, without an error (' + drawn + ' drawings)', drawn === steps.length * 7 * 2 && errs.length === 0, errs.slice(0, 3).join(' | '));
  function text(id) { var q = steps[ids.indexOf(id)]; return ((q && q.text || '') + ' ' + (q && q.math || '')).replace(/<[^>]*>/g, ''); }
  var all = steps.map(function (q) { return q.title + ' ' + text(q.id); }).join(' ');
  var courseSrc = fs.readFileSync(path.join(__dirname, 'ber_course.js'), 'utf8'), ca = courseSrc.indexOf("id: 'cajode'"), cb = courseSrc.indexOf('var coh =', ca);
  var cajodeStep = steps[ids.indexOf('cajode')], cajodeSrc = ca >= 0 && cb > ca ? courseSrc.slice(ca, cb) : '', cajodeCopy = text('cajode') + ' ' + (cajodeStep && cajodeStep.a11y || '');

  // the pages' statements, recomputed here from the CSV rows
  if (rows) {
    function firstAtMost(rec, ratio) { for (var s = 0; s <= 30; s += 2) { var a = pooledFromRows(rec, ratio, s); if (a && a.E / a.N <= 1e-3) return s; } return null; }
    function zeroFrom(rec, ratio) { var from = null; for (var s = 30; s >= 0; s -= 2) { var a = pooledFromRows(rec, ratio, s); if (a && a.E === 0) from = s; else break; } return from; }
    var t75 = {}; M.IDS.forEach(function (k) { t75[k] = firstAtMost(k, 7.5); });
    check('the 7.5% page exposes all six recomputed sampled thresholds', M.IDS.every(function (k) { return text('p75').indexOf(M.NAME[k] + ': ' + (t75[k] == null ? 'never' : t75[k] + ' dB')) >= 0; }), JSON.stringify(t75));
    var table = [2.5, 5, 7.5, 12, 15].map(function (r) { return M.IDS.map(function (k) { return firstAtMost(k, r); }); });
    check('the threshold grid matches the CSV at every pilot ratio', [2.5, 5, 7.5, 12, 15].every(function (r, i) { return M.IDS.every(function (k, j) { return course.ber.first[k][i] === table[i][j]; }); }), JSON.stringify(table));
    check('the zero runs on the zeros page start where the CSV’s pooled zeros start', [12, 15].every(function (r) { var i = M.pilotIndex(r); return M.IDS.every(function (k) { return course.ber.zero[k][i] === zeroFrom(k, r); }); }));
    var coralZeros = rows.filter(function (r) { return r.receiver === 'coral' && r.zero_observed_errors === 'true'; }).length;
    check('CORAL shows an error at every available receiver result', coralZeros === 0 && /CORAL shows errors at every one of its 960 receiver results/.test(text('zeros')));
    var at25 = Infinity; M.IDS.forEach(function (k) { for (var s = 0; s <= 30; s += 2) { var a = pooledFromRows(k, 2.5, s); if (a) at25 = Math.min(at25, a.E / a.N); } });
    var at25Text = at25 >= 0.01 ? at25.toFixed(at25 >= 0.1 ? 2 : 3) : (at25 * 1e3).toFixed(1) + '×10⁻³';
    check('at 2.5% pilots the page quotes the lowest of all six pooled curves', at25 >= 1e-3 && text('sweep').indexOf('none of the six pooled curves reaches 10⁻³; the lowest sampled BER is ' + at25Text) >= 0, at25.toExponential(3));
    check('the course draws PEARL at all five pilot ratios', [2.5, 5, 7.5, 12, 15].every(function (r) { return course.ber.curves.pearl[M.pilotIndex(r)].every(function (q) { return q !== null; }); }) && /PEARL now appears in every panel/.test(text('sweep')));
    var ex = rows.filter(function (r) { return r.receiver === 'ofdm+fec' && r.red === '1' && r.hydrophone === '1' && r.pilot_ratio_percent === '7.5' && r.snr_db === '10'; })[0];
    check('the one-point page quotes that point’s integers', text('pooled').indexOf(ex.total_bit_errors.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' of ' + ex.total_payload_bits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')) >= 0, ex.total_bit_errors + '/' + ex.total_payload_bits);
    var reasons = {}; rows.forEach(function (r) { if (r.status === 'missing') reasons[r.receiver + ' R' + r.red + 'h' + r.hydrophone + ' ' + r.pilot_id] = r.missing_reason; });
    check('all six receivers have complete coverage and the page reports the validated PEARL fill',
      Object.keys(reasons).length === 0 && /All 5,760 rows now have authenticated results/.test(text('missing')) &&
      /37-job sequential PEARL fill is validated complete/.test(text('missing')) && /No row is missing in this snapshot/.test(text('missing')), Object.keys(reasons).length + ' missing conditions');
  }
  check('the mechanism map distinguishes complete receiver routes from decoder components', /Belief propagation is a decoder component/.test(text('routes')) && /estimate from pilots and then decode once/.test(text('routes')) && /scaled dual variables/.test(text('routes')) && /parity polytopes\|as constraints/.test(courseSrc) && /ADMM blocks\|of one problem/.test(courseSrc));
  check('PEARL is expanded consistently with the retained receiver name', /PEARL is the Persistent-Edge Alternating Receiver Loop/.test(text('routes')) && /PEARL is the Persistent-Edge Alternating Receiver Loop/.test(text('pearl')));
  check('the receivers are described in the series’ sourced wording', /one-tap equalizer/.test(text('pilot-only')) && /partial FFT outputs/.test(text('pilot-only')) && /nothing flows back from the decoder/.test(text('pilot-only')) &&
    /a posteriori LLR/.test(text('jade')) && /extrinsic information/.test(text('jade')) && /normalized min-sum message-passing iterations/.test(text('jade')) && /hyperbolic tangent function/.test(text('jade')) &&
    /frozen R2-V1 receiver profile/.test(text('pearl')) && /check-to-variable/.test(text('pearl')) && /variable-to-check/.test(text('pearl')) && /at most 80 iterations/.test(text('pearl')) &&
    /name, not an expanded acronym/.test(text('coral')) && /jcade_regularized_power/.test(text('coral')) && /modifies the parity component/.test(text('coral')) && /objective function decreases/.test(text('coral')) &&
    !/every update is a gradient step|changes it only by gradient steps|Coded One-scalar Relaxation/.test(text('coral')) &&
    /ADMM: one weight per observation → b → weights → C → z → u/.test(text('cajode')) && /thresholds b to form a candidate/.test(text('cajode')) && /Parity checks, configured bits, and the cyclic redundancy check/.test(text('cajode')) && /at most 50 ADMM iterations/.test(text('cajode')));
  check('SAPPHIRE separates its constrained problem, ADMM solver iteration and candidate test',
    /constrained optimization problem/.test(cajodeCopy) && /objective function/.test(cajodeCopy) && /repeats block updates within that same problem/.test(cajodeCopy) && /does not exchange outputs between a separate detector and decoder/.test(cajodeCopy) && /thresholds b to form a candidate/.test(cajodeCopy) && /acceptance.*separate from ADMM convergence/.test(cajodeCopy));
  check('SAPPHIRE is not rendered with the feedback-pipeline primitive', ca >= 0 && cb > ca && !/P\.pipeline\s*\(/.test(cajodeSrc) && !/\bback\s*:/.test(cajodeSrc));
  check('the SAPPHIRE accessible description preserves the three-part distinction', /constrained optimization problem/.test(cajodeStep && cajodeStep.a11y || '') && /ADMM solver iteration within that problem/.test(cajodeStep && cajodeStep.a11y || '') && /thresholds b to form one candidate/.test(cajodeStep && cajodeStep.a11y || '') && /Candidate acceptance is separate from ADMM convergence/.test(cajodeStep && cajodeStep.a11y || ''));
  check('CAJODE appears in reader copy only as an explicit legacy evidence label', (all.match(/CAJODE/g) || []).length === 1 && /legacy receiver key cajode and source label CAJODE/.test(text('cajode')));
  check('the three cohorts and the fixed six-case boundary are explicit', /authenticated four-receiver Red replay/.test(text('cohorts')) && /older jade_bp output/.test(text('cohorts')) && /newer R3 BER campaign/.test(text('cohorts')) && /frozen persistent R2-V1 campaign/.test(text('cohorts')) &&
    /does not establish identical payload bits, transmitted waveforms, received samples, or noise realizations across all three campaigns/.test(text('cohorts')) && /same six recording–hydrophone labels/.test(text('common')) && /all five pilot ratios/.test(text('common')));
  check('zero observations and absent results are stated without a false bound', /It is not a measured BER/.test(text('zero')) && /an absent result would keep its BER fields blank instead of becoming zero/.test(text('missing')) &&
    /plotted at 0.5 \/ N/.test(text('one-curve')) && !/upper bound/i.test(all));
  check('the 5% case map has all twelve PEARL cases while retaining the six-case pooled scope', /All six receivers have results on all 12 cases/.test(text('channels')) && /pooled pilot panels still use only the fixed six-case scope/.test(text('channels')));
  check('result language refers to sampled thresholds and does not claim monotonic pilot improvement', /first sampled SNR/.test(text('thresholds')) && /do not obey a pointwise rule/.test(text('sweep')) && !/all (five|six) curves fall earlier and lower/.test(all));
  check('the experimental units have stable names', /recording–hydrophone case/.test(text('grid')) && /test condition/.test(text('grid')) && /receiver result/.test(text('pooled')) && /pooled curve point/.test(text('common')));
  check('Red, SNR and the pilot-ratio denominator are introduced', /measured shallow-water channel recordings/.test(text('question')) && /near Singapore at a 25 kHz carrier/.test(text('question')) && /sample signal power in the replay divided by the expected noise power added during replay, not E_b\/N_0/.test(text('question')) && /pilot ratio uses the low-density parity-check codeword length/.test(text('pilots')));
  check('no ranking or speed claim beyond the table', !/\b(outperform|superior|best receiver|faster|slower|beats)\b/i.test(all) && course.ber.not.some(function (s) { return /no timing/.test(s); }));
  var predict = ['one-curve-predict', 'p75-predict'].map(function (id) { return steps[ids.indexOf(id)]; });
  check('two prediction pages require an explicit radio choice before separate reveal pages', predict.every(function (q) { return q && /<fieldset class="predict">/.test(q.text || '') && /type="radio"/.test(q.text || '') && /select <strong>Next<\/strong> to reveal/.test(q.text || ''); }) &&
    ids.indexOf('one-curve-predict') + 1 === ids.indexOf('one-curve') && ids.indexOf('p75-predict') + 1 === ids.indexOf('p75') &&
    !/about [0-9]|falls steeply|no error is observed/.test(text('one-curve-predict')) && !/does not reach|lowest sampled pooled BER/.test(text('p75-predict')));
  var dense = ['missing', 'common', 'one-curve', 'channels', 'thresholds', 'p75', 'zeros', 'sweep', 'supports'];
  check('data-dense canvases have equivalent plain-text summaries', dense.every(function (id) { var q = steps[ids.indexOf(id)]; return q && typeof q.a11y === 'string' && q.a11y.length > 80; }), dense.filter(function (id) { var q = steps[ids.indexOf(id)]; return !q || !q.a11y || q.a11y.length <= 80; }).join(', '));
  check('the worked six-way curve leads to the main threshold grid before the supporting sweep, and the lesson ends in synthesis', ids.indexOf('channels') < ids.indexOf('p75') && ids.indexOf('p75') < ids.indexOf('thresholds') && ids.indexOf('thresholds') < ids.indexOf('sweep') && ids.indexOf('snapshot') < ids.indexOf('supports') && ids[ids.length - 1] === 'synthesis');
  // the house rules for wording
  var BANNED = /\b(novel|state-of-the-art|framework|paradigm|leverage|utili[sz]e|in order to|crucial|vital|clearly|obviously|natural(ly)?|elegant|principled|lifting)\b|It is worth noting/i, CONTRACTION = /\b\w+(n’t|n't)\b|\b(it|that|there|let|we|you|they|he|she|what|who)(’|')(s|re|ll|ve|d)\b/i;
  var badw = [];
  steps.forEach(function (q) { var tx = text(q.id) + ' ' + q.title; if (BANNED.test(tx)) badw.push(q.id + ': banned word'); if (CONTRACTION.test(tx)) badw.push(q.id + ': contraction'); if (/!/.test(tx)) badw.push(q.id + ': exclamation');
    String(q.text || '').replace(/<[^>]*>/g, ' ').split(/(?<=[.;:?])\s+/).forEach(function (s) { if (s.split(/\s+/).filter(Boolean).length > 35) badw.push(q.id + ': a sentence over 35 words: ' + s.slice(0, 50)); }); });
  var ACRO = { BER: 'bit error rate', OFDM: 'orthogonal frequency-division multiplexing', SNR: 'signal-to-noise ratio', FFT: 'fast Fourier transform', FEC: 'forward error correction', BP: 'belief-propagation', LDPC: 'low-density parity-check', LLR: 'log-likelihood ratio', ADMM: 'alternating direction method of multipliers', CRC: 'cyclic redundancy check' };
  Object.keys(ACRO).forEach(function (a) { var first = steps.filter(function (q) { return new RegExp('\\b' + a + '\\b').test(q.text || ''); })[0]; if (!first || (first.text || '').indexOf(ACRO[a]) < 0) badw.push(a + ' is not expanded where it first appears'); });
  check('wording: no banned words, contractions or exclamations, sentences of at most 35 words, every acronym expanded at first use', badw.length === 0, badw.slice(0, 5).join(' | '));
}

// ---------------------------------------------------------------- 4. the generated standalone page
var shell = fs.readFileSync(path.join(__dirname, 'five_receivers.html'), 'utf8');
check('the stable page filename presents the six-receiver title in metadata and on screen',
  /<title>Six receivers on the Red recordings<\/title>/.test(shell) && /<h1 id="board-title">Six receivers on the Red recordings<\/h1>/.test(shell));
var buildCheck = '';
try { buildCheck = cp.execFileSync('python3', ['-B', path.join(__dirname, 'build_ber.py'), '--check'], { encoding: 'utf8' }); }
catch (e) { buildCheck = String(e.stdout || '') + String(e.stderr || e.message || e); }
check('the data file and the standalone HTML are byte-current with their sources', /^ok five_receivers_on_red\.html is current/.test(buildCheck.trim()), buildCheck.trim());

console.log(failures ? failures + ' of ' + checks + ' checks FAILED' : 'all ' + checks + ' checks passed');
process.exit(failures ? 1 : 0);
