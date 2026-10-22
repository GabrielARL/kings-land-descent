// Checks of keep.js and of the advanced tutorial (the Jade Keep), run with Node 12 or later from this folder:
//     node test_keep.js
// 1. The Keep with the Veil lifted reproduces CAJODE's own known-channel kernel, decode_llr: the numbers below are
//    a trace of that Julia code (bit_update! and Parity.consensus_update!, joint_cbz_temporal_receiver.jl and
//    joint_parity_admm.jl in GabrielARL/CAJODE) on the two-bit tower and on the row of two towers, printed by
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

// ---------------------------------------------------------------- 1. the Keep against CAJODE's decode_llr
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
  check('Keep circuit ' + k + ': tiles, Warden and ledger as decode_llr', closeAll(kw[k].x, ref.b, 1e-12) && closeAll(kw[k].z, ref.z, 1e-12) && closeAll(kw[k].u, ref.u, 1e-12), JSON.stringify(kw[k].x));
  check('Keep circuit ' + k + ': the Herald reads ' + ref.hard, kw[k].word.join('') === ref.hard);
});
check('Keep: the Herald rides on circuit ' + JULIA.keepFirstAccepted + ' (decode_llr first_accepted)', kw.herald === JULIA.keepFirstAccepted, kw.herald);
check('Keep: the Twins stand apart when the Herald rides', kw[kw.herald].gap > 0.2, kw[kw.herald].gap);
check('Keep: the Twins meet at the true order one circuit later', kw[kw.herald + 1].gap === 0 && kw[kw.herald + 1].x[0] === 0 && kw[kw.herald + 1].x[1] === 0);
var strong = K.build('keep', { l1: 16 / 3, l2: -10 / 3 }), sw = strong.walk;
JULIA.strong.forEach(function (ref, k) { check('strong lanterns, circuit ' + k + ' as decode_llr', closeAll(sw[k].x, ref.b, 1e-12) && closeAll(sw[k].z, ref.z, 1e-12) && closeAll(sw[k].u, ref.u, 1e-12)); });
check('strong lanterns: the Herald rides on circuit ' + JULIA.strongFirstAccepted, sw.herald === JULIA.strongFirstAccepted, sw.herald);
var row = K.build('row'), rw = row.walk;
JULIA.row.forEach(function (ref, k) { check('row of two towers, circuit ' + k + ' as decode_llr', closeAll(rw[k].b, ref.b, 1e-12) && closeAll(rw[k].z, ref.z, 1e-12) && closeAll(rw[k].u, ref.u, 1e-12), JSON.stringify(rw[k].b)); });
check('row: the Herald rides on circuit ' + JULIA.rowFirstAccepted, rw.herald === JULIA.rowFirstAccepted, rw.herald);
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
check('Veil: no circuit failed its certificates', vw.failed == null, vw.failed);
check('Veil: every stride lowers or keeps the height under the rope, and so does every Loom pass', vw.slice(1).every(function (r) { return r.L1 <= r.L0 + 1e-10 * Math.max(1, Math.abs(r.L0)) && r.L2 <= r.L1 + 1e-10 * Math.max(1, Math.abs(r.L1)); }));
check('Veil: the plumb line hangs true on every circuit (residual within 1e-10)', vw.slice(1).every(function (r) { return r.loom.plumb <= 1e-10; }), Math.max.apply(null, vw.slice(1).map(function (r) { return r.loom.plumb; })).toExponential(1));
check('Veil: the Herald rides with the sent word on circuit 4', vw.herald === 4 && vw[4].word.join('') === vl.sent.join(''), vw.herald);
check('Veil: the twins stand apart when the Herald rides', vw[vw.herald].gap > 0.1, vw[vw.herald].gap);
var firstConsensus = null;
for (var vc = 0; vc < vw.length; vc++) if (vw[vc].gap <= 1e-13) { firstConsensus = vc; break; }
check('Veil: the relaxed tiles first reach parity consensus on circuit 9', firstConsensus === 9 && closeAll(vw[9].b, vw[9].z, 1e-12), firstConsensus);
check('Veil: the full state rests on circuit 24, after consensus', vw.rest === 24 && vw[vw.length - 1].gap === 0 && vw[vw.length - 1].word.join('') === '00', vw.rest);
check('Veil: every circuit uses v=z-u, z=projection(b+old u), and u=old u+b-z', vw.slice(1).every(function (r) {
  return closeAll(r.v, K.sub(r.zFrom, r.uFrom), 1e-12) && closeAll(r.z, vl.project(K.add(r.b, r.uFrom)), 1e-12) && closeAll(r.u, K.add(r.uFrom, K.sub(r.b, r.z)), 1e-12);
}));
check('Veil: the Bowl has curvature on circuit 3 and stops short of the track’s own bottom', vw[3].h[1] > 1 && Math.abs(vw[3].b[1] - vw[3].ground[1]) > 0.3, JSON.stringify([vw[3].h, vw[3].b, vw[3].ground]));
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
  var elements = {}, noop = function () {};
  function ctx() {
    var t = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '' };
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
  var sb = { console: console, performance: { now: function () { return 0; } }, requestAnimationFrame: function () { return 1; }, cancelAnimationFrame: noop,
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
  function text(id) { var s = steps[ids.indexOf(id)]; return s ? (s.text + ' ' + s.math).replace(/<[^>]*>/g, '') : ''; }
  check('the expanded course has 28 steps in 9 chapters', steps.length === 28 && course.chapters.length === 9, steps.length + ' steps, ' + course.chapters.length + ' chapters');
  check('every step has a unique id, a title, a text and a draw function', ids.every(function (id, i) { return ids.indexOf(id) === i; }) && steps.every(function (s) { return s.id && s.title && typeof s.text === 'string' && typeof s.draw === 'function'; }));
  var drawn = 0;
  steps.forEach(function (s, i) { [0, 0.25, 0.5, 0.75, 1].forEach(function (p) { sb.Board.debug({ step: i, p: p }); drawn++; }); });
  var errs = sb.kingsLandErrors || [];
  check('every step draws at five moments without an error (' + drawn + ' drawings)', errs.length === 0, errs.slice(0, 3).join(' | '));
  check('the opening expands CAJODE and identifies the tutorial as its teaching model', /CAJODE/.test(text('road')) && /Code-Aided Joint OFDM Demodulation and Error Correction/.test(text('road')));
  var castText = text('cast'), aimText = text('aim');
  check('the cast defines b, z, u, the hard threshold, and the toy-oracle/real-CRC boundary before the circuit', ids.indexOf('cast') < ids.indexOf('aim') && /vector b of shared bit variables/.test(castText) && /replica variable z/.test(castText) && /ledger u/i.test(castText) && /1\/2/.test(castText) && /truth oracle/.test(castText) && /CRC/.test(castText));
  check('the two-bit parity law is introduced before the parity polytope for longer checks', ids.indexOf('keep') < ids.indexOf('warden') && /two sentries/.test(text('keep')) && /parity check involving both/.test(text('keep')) && /parity polytope for each longer check/.test(text('keep')));
  check('the aim is introduced only after b, z and u and is defined as a derived target, not a state', ids.indexOf('cast') < ids.indexOf('aim') && /aim v/.test(aimText) && /z/.test(aimText) && /u/.test(aimText) && /derived rope target/.test(aimText) && /not a fourth state/.test(aimText));
  check('the Veil section states the toy/full channel boundary before using c0 and c1', ids.indexOf('veil-overview') < ids.indexOf('veil') && /real-valued/.test(text('veil-overview')) && /full CAJODE/i.test(text('veil-overview')) && /complex channel/.test(text('veil-overview')) && /C [−-] C⁰/.test(text('veil-overview')));
  var courseSource = fs.readFileSync(path.join(__dirname, 'advanced_course.js'), 'utf8');
  var keyMatch = /var KEY = (\[[\s\S]*?\]);\n  out\.push\(\{ id: 'key-foundations'/.exec(courseSource);
  var keyRows = keyMatch ? vm.runInNewContext('(' + keyMatch[1] + ')') : [];
  var keyLabels = ['the Coral Fort', 'the Jade Keep', 'the jade tile', 'the lean ℓ', 'the ridge', 'the rope, the aim', 'the Wardens', 'the ledgers', 'the Veil', 'the Beacons', 'the Scales', 'the Bowl', 'the Loom, the plumb line', 'the Herald, the Seal', 'the Candle, the note'];
  var keyMarkers = ['CORAL', 'Code-Aided Joint OFDM Demodulation and Error Correction', 'bit variable b', 'coefficient multiplying b', 'β·b', 'ADMM penalty', 'parity polytope', 'scaled dual', 'C = C⁰ + Δ', 'pilots', 'one weight per reading', 'surrogate function', 'normal equations', 'CRC', '200 updates'];
  check('the three key pages are consecutive and precede the ending', ids.indexOf('key-foundations') + 1 === ids.indexOf('key-veil') && ids.indexOf('key-veil') + 1 === ids.indexOf('key-evidence') && ids.indexOf('key-evidence') + 1 === ids.indexOf('end'));
  check('key-foundations renders mappings 1 through 5', ids.indexOf('key-foundations') >= 0 && String(steps[ids.indexOf('key-foundations')].draw).indexOf('KEY.slice(0, 5)') >= 0);
  check('key-veil renders mappings 6 through 10', ids.indexOf('key-veil') >= 0 && String(steps[ids.indexOf('key-veil')].draw).indexOf('KEY.slice(5, 10)') >= 0);
  check('key-evidence renders mappings 11 through 15', ids.indexOf('key-evidence') >= 0 && String(steps[ids.indexOf('key-evidence')].draw).indexOf('KEY.slice(10, 15)') >= 0);
  check('the key contains all 15 named mappings with their required meanings', keyRows.length === 15 && keyRows.every(function (r, i) { return r.length === 2 && r[0] === keyLabels[i] && r[1].indexOf(keyMarkers[i]) >= 0; }), keyRows.length + ' mappings');
  check('the key gives the exact CAJODE expansion', keyRows.length === 15 && keyRows[1][1] === 'CAJODE: Code-Aided Joint OFDM Demodulation and Error Correction');
  var evidenceText = text('key-evidence');
  check('the evidence key preserves the frozen-trace and documented-toy boundary', /selected values[\s\S]*match one frozen Julia decode_llr trace/.test(evidenceText) && /teaching toy built from CAJODE’s documented equations/.test(evidenceText) && /not a trace or validation of the complete CAJODE or CORAL receiver/.test(evidenceText));
  check('the Herald page quotes the walk: circuit ' + kw.herald + ', gap ' + kw[kw.herald].gap.toFixed(3), text('herald').indexOf('circuit ' + kw.herald) >= 0 && text('herald').indexOf(kw[kw.herald].gap.toFixed(3)) >= 0);
  check('the rope page quotes circuit 3’s aim and the second tile’s rest', text('rope-track').indexOf(kw[3].x[1].toFixed(3)) >= 0 && text('rope-track').indexOf(kw[3].v[0].toFixed(3)) >= 0);
  check('the Bowl page quotes the stride and the track’s own bottom', text('bowl').indexOf(vw[3].b[1].toFixed(3)) >= 0 && text('bowl').indexOf(vw[3].ground[1].toFixed(3)) >= 0 && text('bowl').indexOf(vw[3].h[1].toFixed(2)) >= 0);
  check('the Loom page quotes the weave before and after', text('loom').indexOf(vw[3].c[0].toFixed(3)) >= 0 && text('loom').indexOf(vw[3].cFrom[0].toFixed(3)) >= 0);
  check('the Scales page quotes the second lantern’s weight before and after the stride', text('scales').indexOf(vw[3].w1[2].toFixed(2)) >= 0 && text('scales').indexOf(vw[3].w2[2].toFixed(2)) >= 0);
  check('the spill page gives the raw 4 c0 y/v coefficient and its two values', /4c₀y\/ν/.test(text('spill')) && text('spill').indexOf(vl.leans[0].toFixed(1)) >= 0 && text('spill').indexOf(Math.abs(vl.leans[1]).toFixed(1)) >= 0);
  check('the walk page distinguishes acceptance, first consensus, and full-state rest', text('veil-walk').indexOf('circuit ' + vw.herald) >= 0 && text('veil-walk').indexOf('circuit ' + firstConsensus) >= 0 && text('veil-walk').indexOf('circuit ' + vw.rest) >= 0);
  check('the towers page quotes the middle tile’s advice and rest', text('two-towers').indexOf(rw[2].advice[1].toFixed(3)) >= 0 && text('two-towers').indexOf(rw[2].b[1].toFixed(3)) >= 0);
  check('the towers page distinguishes the advice sum from the rope’s average target', /sum S/.test(text('two-towers')) && /average advice, not the sum/.test(text('two-towers')));
}

console.log(failures ? failures + ' of ' + checks + ' checks FAILED' : 'all ' + checks + ' checks passed');
process.exit(failures ? 1 : 0);
