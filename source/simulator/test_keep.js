// Checks of keep.js and of the advanced tutorial (the Jade Keep), run with Node 12 or later from this folder:
//     node test_keep.js
// 1. The Keep with the Veil lifted reproduces SAPPHIRE's own known-channel kernel, decode_llr: the numbers below are
//    a trace of that Julia code (bit_update! and Parity.consensus_update!, joint_cbz_temporal_receiver.jl and
//    joint_parity_admm.jl in GabrielARL/SAPPHIRE) on the two-bit tower and on the row of two towers, printed by
//    the script keep_trace.jl that produced them (CODE checks=[[1, 2]] llr=[1.0, -0.6] and llr=[16/3, -10/3];
//    checks=[[1, 2], [2, 3]] llr=[1.2, -0.5, 0.9]; rho 3, beta 0.8).
// 2. The Keep with the Veil down keeps the documentation's promises: the Bowl lies above the ground and touches
//    it at the Wanderer's feet, a stride never raises the height under the rope, the Loom's plumb line hangs
//    true, and the Herald rides with the sent word.
// 3. The advanced course builds, every page draws at several moments without an error, and the page's words
//    quote the walks' numbers.
var K = require('./keep.js'), fs = require('fs'), path = require('path'), vm = require('vm');
var failures = 0, checks = 0;
function check(what, ok, detail) { checks++; console.log((ok ? 'ok    ' : 'FAIL  ') + what + (detail !== undefined ? '  [' + detail + ']' : '')); if (!ok) failures++; }
function close(a, b, tol) { return Math.abs(a - b) <= (tol || 1e-12) * Math.max(1, Math.abs(b)); }
function closeAll(a, b, tol) { return a.length === b.length && a.every(function (v, i) { return close(v, b[i], tol); }); }

// ---------------------------------------------------------------- 1. the Keep against SAPPHIRE's decode_llr
var JULIA = {
  keep: [ // iter: b, z, u (the Keep's default leans 1.0 and -0.6)
    { b: [0.0, 1.0], z: [0.4999999999999999, 0.5000000000000001], u: [0.0, 0.0], hard: '01' },
    { b: [0.0, 0.9285714285714289], z: [0.4642857142857145, 0.4642857142857144], u: [-0.4642857142857145, 0.4642857142857145], hard: '01' },
    { b: [0.7040816326530625, 0.0], z: [0.3520408163265313, 0.35204081632653117], u: [-0.11224489795918335, 0.11224489795918335], hard: '10' },
    { b: [0.0, 0.37099125364431673], z: [0.18549562682215837, 0.18549562682215837], u: [-0.2977405247813417, 0.2977405247813417], hard: '00' },
    { b: [0.0, 0.0], z: [0.0, 0.0], u: [-0.2977405247813417, 0.2977405247813417], hard: '00' }],
  keepFirstAccepted: 3, keepRelaxed: [0.0, 0.37099125364431673],
  strong: [ // leans 16/3 and -10/3
    { b: [0.0, 1.0], z: [0.4999999999999999, 0.5000000000000001], u: [0.0, 0.0] },
    { b: [0.0, 1.0], z: [0.4999999999999999, 0.5000000000000001], u: [-0.4999999999999999, 0.4999999999999999] },
    { b: [0.0, 1.0], z: [0.5, 0.5000000000000001], u: [-0.9999999999999999, 0.9999999999999998] },
    { b: [0.0, 0.7380952380952388], z: [0.3690476190476194, 0.3690476190476193], u: [-1.3690476190476193, 1.3690476190476193] },
    { b: [0.0, 0.0], z: [0.0, 0.0], u: [-1.3690476190476193, 1.3690476190476193] }],
  strongFirstAccepted: 4,
  row: [ // checks [[1, 2], [2, 3]], leans 1.2, -0.5, 0.9; z and u by edge (1,1) (1,2) (2,2) (2,3)
    { b: [0.0, 1.0, 0.0], z: [0.4999999999999999, 0.5000000000000001, 0.5000000000000001, 0.4999999999999999], u: [0.0, 0.0, 0.0, 0.0] },
    { b: [0.0, 0.6136363636363639, 0.0], z: [0.306818181818182, 0.3068181818181819, 0.3068181818181819, 0.306818181818182], u: [-0.306818181818182, 0.306818181818182, 0.306818181818182, -0.306818181818182] },
    { b: [0.0, 0.0, 0.10064935064935135], z: [0.0, 0.0, 0.05032467532467577, 0.05032467532467555], u: [-0.306818181818182, 0.306818181818182, 0.2564935064935062, -0.2564935064935062] },
    { b: [0.0, 0.0, 0.0], z: [0.0, 0.0, 0.0, 0.0], u: [-0.306818181818182, 0.306818181818182, 0.2564935064935062, -0.2564935064935062] }],
  rowFirstAccepted: 2
};
var keep = K.build('keep'), kw = keep.walk;
JULIA.keep.forEach(function (ref, k) {
  check('Keep iteration ' + k + ': tiles, Warden and ledger as decode_llr', closeAll(kw[k].x, ref.b, 1e-12) && closeAll(kw[k].z, ref.z, 1e-12) && closeAll(kw[k].u, ref.u, 1e-12), JSON.stringify(kw[k].x));
  check('Keep iteration ' + k + ': the Herald reads ' + ref.hard, kw[k].word.join('') === ref.hard);
});
check('Keep: the toy truth oracle first matches on iteration ' + JULIA.keepFirstAccepted + ' (decode_llr first_accepted)', kw.herald === JULIA.keepFirstAccepted, kw.herald);
check('Keep: the Twins stand apart when the Herald rides', kw[kw.herald].gap > 0.2, kw[kw.herald].gap);
check('Keep: the replicas agree at the true order one iteration later', kw[kw.herald + 1].gap === 0 && kw[kw.herald + 1].x[0] === 0 && kw[kw.herald + 1].x[1] === 0);
var strong = K.build('keep', { l1: 16 / 3, l2: -10 / 3 }), sw = strong.walk;
JULIA.strong.forEach(function (ref, k) { check('strong lanterns, iteration ' + k + ' as decode_llr', closeAll(sw[k].x, ref.b, 1e-12) && closeAll(sw[k].z, ref.z, 1e-12) && closeAll(sw[k].u, ref.u, 1e-12)); });
check('strong lanterns: the toy truth oracle first matches on iteration ' + JULIA.strongFirstAccepted, sw.herald === JULIA.strongFirstAccepted, sw.herald);
var row = K.build('row'), rw = row.walk;
JULIA.row.forEach(function (ref, k) { check('row of two towers, iteration ' + k + ' as decode_llr', closeAll(rw[k].b, ref.b, 1e-12) && closeAll(rw[k].z, ref.z, 1e-12) && closeAll(rw[k].u, ref.u, 1e-12), JSON.stringify(rw[k].b)); });
check('row: the toy truth oracle first matches on iteration ' + JULIA.rowFirstAccepted, rw.herald === JULIA.rowFirstAccepted, rw.herald);
check('row: the middle sentry carries two ledgers', row.land.edgesOf[1].length === 2 && row.land.degree[1] === 2);
check('hard-word boundary: values below one half read 0 and one half itself reads 1', K.hardWord([0, 0.499999999999, 0.5, 1]).join('') === '0011');
check('degree-two projection takes the clipped mean on the line z1=z2', closeAll(K.projectPair([0.2, 0.8]), [0.5, 0.5]) && closeAll(K.projectPair([-2, 0.4]), [0, 0]) && closeAll(K.projectPair([1.6, 0.8]), [1, 1]));


// ---------------------------------------------------------------- 2. the Keep with the Veil down
var V = K.build('veil'), vl = V.land, vw = V.walk, rho = V.p.rho, beta = vl.beta;
function energySum(c, b) { return vl.energies(c, b).reduce(function (s, e) { return s + e.E; }, 0); }
var zeroBitsEnergy = energySum(vl.c0, [0, 0]);
var energyCoefficients = [0, 1].map(function (i) { var b = [0, 0]; b[i] = 1; return energySum(vl.c0, b) - zeroBitsEnergy; });
var energyAffine = [0, 1].every(function (i) { return [0, 0.2, 0.5, 0.8, 1].every(function (t) { var b = [0, 0]; b[i] = t; return close(energySum(vl.c0, b) - zeroBitsEnergy, t * vl.leans[i], 1e-12); }); });
check('Veil: the first raw bit-zero coefficients are 4 c0 y / v', closeAll(vl.leans, [4 * vl.c0[0] * vl.y[1] / vl.variance, 4 * vl.c0[0] * vl.y[2] / vl.variance]) && vl.c0[1] === 0, JSON.stringify(vl.leans));
check('Veil: each displayed lean equals the matching linear coefficient of the stated expected energy', closeAll(vl.leans, energyCoefficients, 1e-12) && energyAffine, JSON.stringify(energyCoefficients));
check('Veil: the tiles start the way the lanterns lean (0, 1)', vl.start[0] === 0 && vl.start[1] === 1);
check('Veil: the toy Seal is an exact-truth oracle, not merely the parity law', vl.lawful([1, 1]) && !vl.sealed([1, 1]) && vl.lawful([0, 0]) && vl.sealed([0, 0]));
check('Veil: no iteration failed its certificates', vw.failed == null, vw.failed);
check('Veil: every stride lowers or keeps the height under the rope, and so does every Loom pass', vw.slice(1).every(function (r) { return r.L1 <= r.L0 + 1e-10 * Math.max(1, Math.abs(r.L0)) && r.L2 <= r.L1 + 1e-10 * Math.max(1, Math.abs(r.L1)); }));
check('Veil: the plumb line hangs true on every iteration (residual within 1e-10)', vw.slice(1).every(function (r) { return r.loom.plumb <= 1e-10; }), Math.max.apply(null, vw.slice(1).map(function (r) { return r.loom.plumb; })).toExponential(1));
check('Veil: the toy truth oracle first matches the sent word on iteration 4', vw.herald === 4 && vw[4].word.join('') === vl.sent.join(''), vw.herald);
check('Veil: the twins stand apart when the Herald rides', vw[vw.herald].gap > 0.1, vw[vw.herald].gap);
var firstConsensus = null;
for (var vc = 0; vc < vw.length; vc++) if (vw[vc].gap <= 1e-13) { firstConsensus = vc; break; }
check('Veil: the relaxed variables first reach parity consensus on iteration 9', firstConsensus === 9 && closeAll(vw[9].b, vw[9].z, 1e-12), firstConsensus);
check('Veil: full-state change reaches the toy threshold on iteration 24, after consensus', vw.rest === 24 && vw[vw.length - 1].gap === 0 && vw[vw.length - 1].word.join('') === '00', vw.rest);
check('Veil: every iteration uses v=z-u, z=projection(b+old u), and u=old u+b-z', vw.slice(1).every(function (r) {
  return closeAll(r.v, K.sub(r.zFrom, r.uFrom), 1e-12) && closeAll(r.z, vl.project(K.add(r.b, r.uFrom)), 1e-12) && closeAll(r.u, K.add(r.uFrom, K.sub(r.b, r.z)), 1e-12);
}));
check('Veil: the Bowl has curvature on iteration 3 and stops short of the track’s own bottom', vw[3].h[1] > 1 && Math.abs(vw[3].b[1] - vw[3].ground[1]) > 0.3, JSON.stringify([vw[3].h, vw[3].b, vw[3].ground]));
// the Scales: the weight is the minimiser of the half-quadratic form, and the form is above the pseudo-Huber value elsewhere
var okScales = [0.01, 0.3, 1, 2.5, 7].every(function (E) {
  var w = vl.weight(E), d2 = vl.delta * vl.delta, atW = w * E + d2 * (1 - w) * (1 - w) / w;
  return close(atW, vl.huber(E), 1e-12) && [0.2, 0.5, 0.8, 1].every(function (w2) { return w2 * E + d2 * (1 - w2) * (1 - w2) / w2 >= vl.huber(E) - 1e-12; });
});
check('Veil: w = 1/sqrt(1 + E/delta^2) is the half-quadratic minimiser and the form lies above f_delta', okScales);
// the Bowl lies above the weighted fit everywhere on the square and touches it at the Wanderer's feet
function fit(w, c, b) { return vl.Q(w, c, b) - vl.ridge(b) - vl.anchor(c); }
var r3 = vw[3], b0 = r3.from, c3 = r3.cFrom, w3 = r3.w1, f0 = fit(w3, c3, b0), okBowl = true, worst = -Infinity;
for (var i = 0; i <= 20; i++) for (var j = 0; j <= 20; j++) {
  var b = [i / 20, j / 20], d0 = b[0] - b0[0], d1 = b[1] - b0[1];
  var bowl = f0 + r3.g[0] * d0 + r3.g[1] * d1 + 0.5 * (r3.h[0] * d0 * d0 + r3.h[1] * d1 * d1), gapB = fit(w3, c3, b) - bowl;
  worst = Math.max(worst, gapB); if (gapB > 1e-9) okBowl = false;
}
check('Veil: the Bowl lies above the weighted fit on the whole square (Gershgorin majorizer)', okBowl, 'worst excess ' + worst.toExponential(2));
check('Veil: the Bowl touches the fit at the Wanderer’s feet', close(fit(w3, c3, b0), f0));
check('Veil: along one track the fit is a straight line of slope g', [0, 0.25, 0.5, 0.75, 1].every(function (t) { var b = [b0[0], t]; return close(fit(w3, c3, b) - f0, r3.g[1] * (t - b0[1]), 1e-9); }));
check('Veil: the Loom’s weave solves its balance equations', (function () { var lm = r3.loom, c = lm.c; return close(lm.M[0][0] * c[0] + lm.M[0][1] * c[1], lm.r[0], 1e-10) && close(lm.M[1][0] * c[0] + lm.M[1][1] * c[1], lm.r[1], 1e-10); })());
check('Veil: the Loom’s weave is the lowest weave at fixed tiles and weights', (function () { var lm = r3.loom, best = vl.veilCost(r3.w2, r3.b, lm.c); for (var k = 0; k < 200; k++) { var c = [lm.c[0] + 0.3 * (Math.random() - 0.5), lm.c[1] + 0.3 * (Math.random() - 0.5)]; if (vl.veilCost(r3.w2, r3.b, c) < best - 1e-12) return false; } return true; })());

// ---------------------------------------------------------------- 3. the course in a browser-less sandbox
function sandbox() {
  var elements = {}, drawnText = [], noop = function () {};
  function ctx() {
    var t = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '',
      fillText: function (s) { drawnText.push(String(s)); }, strokeText: function (s) { drawnText.push(String(s)); } };
    return new Proxy(t, { get: function (o, k) {
      if (k === 'measureText') return function (s) { return { width: 7 * String(s).length }; };
      if (k === 'createImageData') return function (w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; };
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return function () { return { addColorStop: noop }; };
      if (k in o) return o[k]; if (typeof k === 'string') return noop; return undefined;
    } });
  }
  function element(id) {
    if (elements[id]) return elements[id];
    var e = { id: id, hidden: false, textContent: '', innerHTML: '', disabled: false, width: 0, height: 0, style: {}, offsetTop: 0, offsetHeight: 0, scrollTop: 0, clientHeight: 100,
      classList: { toggle: noop, add: noop, remove: noop }, setAttribute: function (n, v) { this[n] = String(v); }, getAttribute: function (n) { return this[n] == null ? null : this[n]; },
      addEventListener: noop, querySelectorAll: function () { return []; }, querySelector: function () { return element('q-' + Object.keys(elements).length); }, closest: function () { return null; },
      getBoundingClientRect: function () { return { width: 960, height: 660, top: 0, left: 0, right: 960, bottom: 660 }; }, scrollIntoView: noop, focus: noop,
      getContext: function () { return ctx(); } };
    return (elements[id] = e);
  }
  var sb = { console: console, __drawnText: drawnText, performance: { now: function () { return 0; } }, requestAnimationFrame: function () { return 1; }, cancelAnimationFrame: noop,
    getComputedStyle: function () { return { fontFamily: 'sans-serif', getPropertyValue: function () { return 'monospace'; } }; },
    document: { body: {}, documentElement: {}, getElementById: element, querySelectorAll: function () { return []; }, addEventListener: noop, createElement: function () { return element('created-' + Object.keys(elements).length); } },
    location: { hash: '' }, devicePixelRatio: 1, addEventListener: noop, Proxy: Proxy };
  sb.window = sb;
  vm.createContext(sb);
  ['engine.js', 'board.js', 'keep.js', 'advanced_parts.js', 'advanced_course.js'].forEach(function (name) { vm.runInContext(fs.readFileSync(path.join(__dirname, name), 'utf8'), sb, { filename: name }); });
  return sb;
}
var sb, course = null, errors = [];
try { sb = sandbox(); course = sb.course; } catch (e) { errors.push('course failed to build: ' + (e && e.stack || e)); }
check('the advanced course builds in the sandbox', !!course, errors[0]);
if (course) {
  var steps = course.steps, ids = steps.map(function (s) { return s.id; });
  var EXPECTED_IDS = [
    'received-grid', 'one-tap', 'ici', 'isi-boundary',
    'partial-fft', 'separate-chain', 'joint-loop',
    'variables', 'bits-to-symbols', 'anchors-and-constraints', 'prediction', 'robust-objective', 'why-alternate',
    'parity-polytope', 'local-copies', 'aim', 'bit-update', 'projection', 'dual-update', 'acceptance',
    'robust-weights', 'bit-majorizer', 'channel-solve', 'iteration-order', 'milestones',
    'shared-bits', 'full-frame', 'takeaway'
  ];
  var EXPECTED_CHAPTERS = [
    ['Why the OFDM model breaks', 0, 4],
    ['Keep the received evidence', 4, 3],
    ['One receiver, two unknown blocks', 7, 6],
    ['ADMM for the code constraints', 13, 7],
    ['Alternating channel and bits', 20, 5],
    ['From toy receiver to SAPPHIRE', 25, 3]
  ];
  function raw(id) { var s = steps[ids.indexOf(id)]; return s ? s.text + ' ' + s.math : ''; }
  function text(id) { var s = steps[ids.indexOf(id)]; return s ? (s.text + ' ' + s.math).replace(/<[^>]*>/g, '') : ''; }
  function shown(v, d) { var s = v.toFixed(d == null ? 3 : d); return (/^-0(\.0*)?$/.test(s) ? s.slice(1) : s).replace('-', '−'); }
  function shownPair(v, d) { return '(' + shown(v[0], d) + ', ' + shown(v[1], d) + ')'; }
  function drawnText(id, p) { sb.__drawnText.length = 0; sb.Board.debug({ step: id, p: p == null ? 1 : p }); return sb.__drawnText.join(' | '); }

  check('the OFDM-first course has the exact approved 28-step order', steps.length === 28 && ids.join('|') === EXPECTED_IDS.join('|'), ids.join(', '));
  check('the 28 steps form the exact six chapter blocks', course.chapters.length === EXPECTED_CHAPTERS.length && course.chapters.every(function (ch, i) {
    return ch.name === EXPECTED_CHAPTERS[i][0] && ch.start === EXPECTED_CHAPTERS[i][1] && ch.n === EXPECTED_CHAPTERS[i][2];
  }), course.chapters.map(function (ch) { return ch.name + ':' + ch.start + '+' + ch.n; }).join(' | '));
  check('every step has a unique id, a title, a text and a draw function', ids.every(function (id, i) { return ids.indexOf(id) === i; }) && steps.every(function (s) { return s.id && s.title && typeof s.text === 'string' && typeof s.draw === 'function'; }));
  check('all 28 steps retain an exact equation transcript for the in-animation display and accessibility', steps.every(function (s) { return typeof s.math === 'string' && s.math.trim().length > 0; }));
  var drawn = 0;
  steps.forEach(function (s, i) { [0, 0.25, 0.5, 0.75, 1].forEach(function (p) { sb.Board.debug({ step: i, p: p }); drawn++; }); });
  var errs = sb.kingsLandErrors || [];
  check('every step draws at five moments without an error (140 drawings) and uses neutral technical bit markers', drawn === 140 && errs.length === 0 && steps.every(function (s) { return !/g\.hero\(/.test(String(s.draw)); }), errs.slice(0, 3).join(' | '));

  var opening = text('received-grid');
  check('the opening names SAPPHIRE and introduces carrier coupling before the ICI abbreviation', /SAPPHIRE explains those observations/.test(opening) && /frequency-domain response, including carrier coupling/.test(opening) && /response C and coded bits b/.test(opening) && opening.indexOf('ICI') < 0);
  check('the opening says this teaches SAPPHIRE rather than the separate JADE block-feedback schedule', /teaches that SAPPHIRE problem/.test(opening) && /not the separate JADE block-feedback schedule/.test(opening));

  var oneTap = text('one-tap'), ici = text('ici'), isi = text('isi-boundary');
  check('the physical story orders one-tap conditions, same-symbol ICI, then the short-CP ISI boundary', ids.indexOf('one-tap') < ids.indexOf('ici') && ids.indexOf('ici') < ids.indexOf('isi-boundary'));
  check('one-tap equalization is tied to adequate CP and near time invariance', /cyclic prefix must cover the effective channel memory/.test(oneTap) && /nearly invariant over the useful OFDM interval/.test(oneTap) && /approximately diagonal/.test(oneTap));
  check('the ICI page expands the term and labels its half-width-two drawing as generic rather than SAPPHIRE’s band', /intercarrier interference \(ICI\)/.test(ici) && /same OFDM symbol/.test(ici) && /generic physical ICI illustration with two neighbours on either side/.test(ici) && /documented prediction later keeps half-width one/.test(ici) && /modelling approximation/.test(ici) && /not a claim that all farther coefficients are exactly zero/.test(ici));
  check('the ISI page states the current-symbol scope and excludes a demonstrated short-prefix receiver', /tail from the preceding OFDM symbol/.test(isi) && /intercarrier interference within the current OFDM symbol only/.test(isi) && /do not demonstrate a short-prefix receiver/.test(isi));

  var partial = text('partial-fft');
  check('Partial FFT is explicitly a supplied-deck contrast, not an input to documented SAPPHIRE', /supplied OFDM deck/.test(partial) && /not an input to the documented SAPPHIRE engine/.test(partial) && /SAPPHIRE starts with one standard post-FFT observation/.test(partial));
  check('Partial FFT is not credited with new information or a guaranteed gain', /creates no new information/.test(partial) && /does not prove a performance gain/.test(partial));
  check('the conventional one-way receiver appears before the single constrained SAPPHIRE problem', ids.indexOf('separate-chain') < ids.indexOf('joint-loop') && /information normally travels only forward/.test(text('separate-chain')) && /one constrained optimization problem/.test(text('joint-loop')));
  check('the joint problem keeps pilot anchoring and code constraints distinct', /Pilots anchor the channel\/ICI response/.test(text('joint-loop')) && /code constraints restrict the coded bits/.test(text('joint-loop')) && /do not turn unknown data into pilots/.test(text('joint-loop')));
  check('SAPPHIRE is not drawn or described as decoder feedback', /does not run a separate decoder and feed decoder messages back to a detector/.test(text('joint-loop')) && /not messages between a detector and a separate decoder/.test(text('why-alternate')) && /No BP or decoder message is returned/.test(text('iteration-order')) && /P\.objectiveBlocks/.test(String(steps[ids.indexOf('joint-loop')].draw)) && /loop: false/.test(String(steps[ids.indexOf('why-alternate')].draw)) && /loop: false/.test(String(steps[ids.indexOf('iteration-order')].draw)) && !/residual changes both blocks/.test(String(steps[ids.indexOf('prediction')].draw)));

  var roles = text('anchors-and-constraints');
  check('pilots, LDPC parity, configured bits, and CRC have four distinct roles', /Known pilot symbols provide fixed references/.test(roles) && /low-density parity-check \(LDPC\) code supplies parity relations/.test(roles) && /receiver configuration fixes any known bit positions/.test(roles) && /CRC tests a hard candidate/.test(roles) && /none substitutes for another/.test(roles));
  var qpsk = text('bits-to-symbols');
  check('the QPSK page expands the term and gives the correct bit-to-sign mapping', /quadrature phase-shift keying \(QPSK\)/.test(qpsk) && /d = \(xI \+ jxQ\)\/√2/.test(qpsk) && /00 → \(\+1,\+1\); 01 → \(\+1,−1\); 10 → \(−1,\+1\); 11 → \(−1,−1\)/.test(qpsk));

  var notation = raw('variables'), aimText = text('aim');
  check('the receiver notation defines shared b, local z_a, scaled-dual u_a, and derived v_a before ADMM', ids.indexOf('variables') < ids.indexOf('aim') && /shared bit vector/.test(notation) && /z<sub>a<\/sub>/.test(notation) && /scaled dual variable u<sub>a<\/sub>/.test(notation) && /v<sub>a<\/sub> = z<sub>a<\/sub> − u<sub>a<\/sub> is derived/.test(notation));
  check('v = z − u is neither stored state nor a physical observation', /not another stored state/.test(text('variables')) && /not independently optimized/.test(aimText) && /not a physical receiver observation/.test(aimText));
  var objective = text('robust-objective');
  check('the objective separates response priors and distinguishes the deck’s parity penalty from SAPPHIRE projection', /frequency smoothness of the correction Δ = C − C⁰/.test(objective) && /temporal prior on the full response C/.test(objective) && /supplied deck’s smooth parity penalty is a different formulation/.test(objective) && /SAPPHIRE’s parity-polytope projection/.test(objective) && /Hard code feasibility is separate/.test(objective));
  check('the full SAPPHIRE expansion appears only after its receiver terms have been introduced', ids.indexOf('robust-objective') > ids.indexOf('ici') && /SAPPHIRE stands for Symbol detection Aided by code through Parity constraints and Polytope projections, with Half-quadratic weighting under ICI in a joint OFDM Receiver with Error-correction decoding/.test(objective));
  var alternation = raw('why-alternate'), majorizer = raw('bit-majorizer');
  check('the block-schedule page visibly introduces the bit partial derivatives and response normal equations', /partial derivatives of the received-signal part of the cost/.test(alternation) && /∂Q<sub>w<\/sub>\/∂b<sub>i<\/sub>/.test(alternation) && /∂Q<sub>w<\/sub>\/∂C\*/.test(alternation) && /M C<sup>k\+1<\/sup> = r/.test(alternation));
  check('the bit page defines g as a partial derivative and distinguishes its closed-form majorized step from gradient descent', /partial derivatives g<sub>i<\/sub>/.test(majorizer) && /∂Q<sub>w<\/sub>\/∂b<sub>i<\/sub>/.test(majorizer) && /temporary quadratic/.test(majorizer) && /does not take a gradient-descent step/.test(majorizer));

  var k3 = kw[3], iteration3 = text('aim') + ' ' + text('bit-update') + ' ' + text('projection') + ' ' + text('dual-update');
  check('the fixed-channel ADMM pages identify the frozen trace and quote iteration 3 values for v, b, z, and u', /frozen known-channel teaching trace/.test(iteration3) && /bit-zero log-likelihood-ratio \(LLR\) term/.test(iteration3) && iteration3.indexOf(shownPair(k3.v)) >= 0 && iteration3.indexOf(shownPair(k3.x)) >= 0 && iteration3.indexOf(shownPair(k3.z)) >= 0 && iteration3.indexOf(shownPair(k3.u)) >= 0, [shownPair(k3.v), shownPair(k3.x), shownPair(k3.z), shownPair(k3.u)].join(' | '));
  check('the projection page limits the mean shortcut and calls z parity-feasible', /clipped mean/.test(text('projection')) && /Longer checks use their actual parity-polytope projection/.test(text('projection')) && /parity-feasible local replica z\(3\)/.test(drawnText('projection', 1)));

  var acceptance = text('acceptance'), acceptanceDrawing = drawnText('acceptance', 1);
  check('the toy-oracle page quotes iteration 3 and its nonzero agreement gap', acceptance.indexOf('iteration ' + kw.herald) >= 0 && acceptance.indexOf(k3.word.join('')) >= 0 && acceptanceDrawing.indexOf(shown(k3.gap)) >= 0, acceptanceDrawing);
  check('the page separates the hidden-truth toy oracle from real parity, configured-bit, and CRC acceptance', /threshold the shared b—not a local z/.test(acceptance) && /hidden-truth “Seal” oracle reports a match/.test(acceptance) && /toy does not evaluate a CRC/.test(acceptance) && /every parity check passes/.test(acceptance) && /every bit fixed by the receiver configuration/.test(acceptance) && /CRC passes/.test(acceptance));
  check('candidate acceptance is not convergence or a global-optimality certificate', /Candidate acceptance is not ADMM convergence/.test(acceptance) && /does not prove a global optimum/.test(acceptance));

  var weightsBefore = drawnText('robust-weights', 0.5), weightsAfter = drawnText('robust-weights', 1), v3 = vw[3];
  check('the robust-weight drawing quotes the changed observation weight', weightsBefore.indexOf(shown(v3.w1[2], 2)) >= 0 && weightsAfter.indexOf(shown(v3.w2[2], 2)) >= 0, shown(v3.w1[2], 2) + ' → ' + shown(v3.w2[2], 2));
  var robust = text('robust-weights');
  check('the robust-weight page bounds the toy and defines its observation scale and pseudo-Huber scale', /four real-valued observations/.test(robust) && /two known endpoint pilots/.test(robust) && /two data positions/.test(robust) && /two bit variables in \[0,1\]/.test(robust) && /one two-bit parity check/.test(robust) && /two real response coefficients/.test(robust) && /direct coefficient c₀/.test(robust) && /neighbouring-carrier coefficient c₁/.test(robust) && /complex, carrier- and OFDM-symbol-indexed C/.test(robust) && /pilot-estimate interpolation-error variance/.test(robust) && /not generic noise variance/.test(robust) && /δ is the pseudo-Huber scale/.test(robust));
  var channel = text('channel-solve'), relativeResidual = v3.loom.plumb / Math.max(Math.hypot(v3.loom.r[0], v3.loom.r[1]), 1e-30);
  check('the channel-solve page quotes the response before, after, and equation residual', channel.indexOf(shownPair(v3.cFrom)) >= 0 && channel.indexOf(shownPair(v3.c)) >= 0 && channel.indexOf(relativeResidual.toExponential(1)) >= 0, channel);
  check('the channel certificate is limited to the fixed-bit, fixed-weight response block', /b and the current robust weights fixed/.test(text('prediction')) && /hold both fixed/.test(channel) && /Setting its response derivative to zero/.test(channel) && /not a gradient iteration/.test(channel) && /residual check confirms this linear solve, not the global joint problem/.test(channel) && /sparse solve for C = C⁰ \+ Δ/.test(channel));

  var updateOrder = text('iteration-order'), dualDiagnostics = raw('dual-update');
  check('the full update order is weights, bits, refreshed weights, channel, projection, dual, then test', /robust weights, take the majorized bit update, recompute the weights/.test(updateOrder) && /solve the response block, project each local replica, and update every scaled dual/.test(updateOrder) && /Only then form and test a hard candidate/.test(updateOrder));
  check('projection remains a feasibility operation and both standard ADMM residuals are defined', /parity projection is an exact feasibility operation/.test(updateOrder) && /not one of the objective-descent certificates/.test(updateOrder) && /primal residual/.test(dualDiagnostics) && /dual residual/.test(dualDiagnostics) && /r<sup>\(k\)<\/sup> = b<sub>N<\/sub><sup>\(k\)<\/sup> − z<sup>\(k\)<\/sup>/.test(dualDiagnostics) && /s<sup>\(k\)<\/sup> = ρ\(z<sup>\(k\)<\/sup> − z<sup>\(k−1\)<\/sup>\)/.test(dualDiagnostics));

  var milestones = text('milestones');
  check('the milestone page separates toy-oracle match, consensus, and full-state threshold from SAPPHIRE stopping', milestones.indexOf('iteration ' + vw.herald) >= 0 && milestones.indexOf('iteration ' + firstConsensus) >= 0 && milestones.indexOf('iteration ' + vw.rest) >= 0 && /hidden-truth Seal oracle/.test(milestones) && /still .* apart/.test(milestones) && /full toy state/.test(milestones) && /real candidate passes parity, configured-bit and CRC tests/.test(milestones) && /update budget is reached/.test(milestones) && /numerical certificate fails/.test(milestones) && /not when r and s cross convergence tolerances/.test(milestones));
  check('the toy endpoint is neither channel truth nor a certified global optimum', /not known channel truth/.test(milestones) && /not a certified global optimum/.test(milestones));

  var shared = text('shared-bits'), row2 = rw[2], row1 = rw[1];
  check('the degree-two shared-bit page names and quotes its incident-target sum, average, and bit move', /Sum the incident ADMM targets for each bit/.test(steps[ids.indexOf('shared-bits')].title) && /touches two checks/.test(shared) && /incident-target sum/.test(shared) && shared.indexOf(shown(row2.advice[1])) >= 0 && shared.indexOf(shown(row1.b[1])) >= 0 && shared.indexOf(shown(row2.b[1])) >= 0 && /centre equal to their average/.test(shared));
  var fullFrame = text('full-frame'), fullFrameDraw = String(steps[ids.indexOf('full-frame')].draw);
  check('the full-frame page uses documented half-width one, frequency smoothness on Delta, and a full-C temporal prior', /carrier offsets ℓ = −1, 0, 1/.test(fullFrame) && /half-width-one band/.test(fullFrame) && /correction Δ = C − C⁰ smooth across carriers/.test(fullFrame) && /temporal prior acts on the full response/.test(fullFrame) && /Cs\+1 ≈ asCs/.test(fullFrame) && /band: 1/.test(fullFrameDraw) && /intercarrier interference within each current symbol/.test(fullFrame) && /short cyclic prefix requires an explicit preceding-symbol term/.test(fullFrame));

  var evidence = text('takeaway');
  check('the takeaway preserves the frozen Julia trace and documented teaching-toy boundary', /selected values from a frozen Julia decode_llr trace/.test(evidence) && /teaching model built from the documented equations/.test(evidence) && /not a run or performance validation of the full receiver/.test(evidence));
  check('the takeaway makes no BER, global-optimum, physical-truth, or short-CP claim', /No page here claims BER gain, convergence to a global optimum, recovery of physical channel truth, or short-CP operation/.test(evidence));

  var shell = fs.readFileSync(path.join(__dirname, 'advanced.html'), 'utf8');
  check('the shell title, H1, and summary use the approved SAPPHIRE presentation', /<title>SAPPHIRE: A Joint OFDM Receiver for Data Detection and Error-Correction Decoding under Intercarrier Interference<\/title>/.test(shell) && /<h1 id="board-title">SAPPHIRE: A Joint OFDM Receiver<\/h1>/.test(shell) && /Pilots anchor the frequency-domain response, including carrier coupling; code constraints help resolve the data bits\./.test(shell));
  var canvasAt = shell.indexOf('id="board-canvas"'), liveEquationAt = shell.indexOf('id="board-equation"'), transcriptAt = shell.indexOf('id="board-math"'), storyAt = shell.indexOf('<section class="story"');
  check('the visible equation is overlaid inside the animation rather than placed in a rail or story card', /<div class="stage-visual">[\s\S]*<canvas[^>]*id="board-canvas"[\s\S]*<div class="stage-equation" id="board-equation" aria-hidden="true"><\/div>[\s\S]*<\/div>/.test(shell) && canvasAt >= 0 && canvasAt < liveEquationAt && liveEquationAt < transcriptAt && transcriptAt < storyAt && (shell.match(/id="board-equation"/g) || []).length === 1 && !/stage-math/.test(shell) && /\.stage-equation \{[^}]*position: absolute;/.test(shell) && /\.stage canvas \{[^}]*height: calc\(100% - var\(--equation-height\)\);/.test(shell));
  check('the exact equation transcript remains visually hidden and describes the canvas', /<div class="sr-only" id="board-math"><\/div>/.test(shell) && (shell.match(/id="board-math"/g) || []).length === 1 && /\.sr-only \{[^}]*position: absolute !important;/.test(shell) && /<canvas id="board-canvas" role="img"[^>]*aria-describedby="board-step board-text board-math"/.test(shell) && /Your browser does not support the tutorial diagram\.<\/canvas>/.test(shell));
  var liveEquation = sb.document.getElementById('board-equation'), everyEquationVisible = steps.every(function (s, i) { sb.Board.debug({ step: i, p: 1 }); return liveEquation.innerHTML && liveEquation.innerHTML.trim().length > 0; });
  check('every one of the 28 steps finishes with a visible equation inside the animation', everyEquationVisible);
  sb.Board.debug({ step: 'why-alternate', p: 0.25 }); var liveBitDerivative = liveEquation.innerHTML;
  sb.Board.debug({ step: 'why-alternate', p: 0.55 }); var liveChannelDerivative = liveEquation.innerHTML;
  sb.Board.debug({ step: 'why-alternate', p: 0.75 }); var liveConstraintUpdate = liveEquation.innerHTML;
  check('the alternation animation changes from the bit derivative to the response equation and then ADMM', /∂Q<sub>w<\/sub>\/∂b<sub>i<\/sub>/.test(liveBitDerivative) && /∂Q<sub>w<\/sub>\/∂C\*/.test(liveChannelDerivative) && /Π<sub>𝒫a<\/sub>/.test(liveConstraintUpdate) && /u<sub>a<\/sub><sup>k\+1<\/sup>/.test(liveConstraintUpdate));
  check('the shell uses legible technical display, body, and monospace fonts', /Atkinson\+Hyperlegible/.test(shell) && /IBM\+Plex\+Mono/.test(shell) && /--mono: 'IBM Plex Mono'/.test(shell));
}

console.log(failures ? failures + ' of ' + checks + ' checks FAILED' : 'all ' + checks + ' checks passed');
process.exit(failures ? 1 : 0);
