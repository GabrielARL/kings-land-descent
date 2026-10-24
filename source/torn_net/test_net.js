// Engine, mathematical-contract, teaching-flow, drawing, and generated-page checks.
// Run from anywhere with Node 12 or later:  node paper/torn_net/test_net.js
var N = require('./net.js'), fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
var failures = 0, checks = 0;
function check(what, ok, detail) { checks++; console.log((ok ? 'ok    ' : 'FAIL  ') + what + (detail !== undefined ? '  [' + detail + ']' : '')); if (!ok) failures++; }
function near(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-9 : tol); }
function finite(x) { return typeof x === 'number' && isFinite(x); }

var d = N.build(), p = d.p, lat = d.lat, S = d.solution, fin = S.final, R = S.rounds;

// ---------------------------------------------------------------- 1. synthetic model and image evidence
check('the hidden net satisfies every idealized parallelogram rule', lat.meshes.every(function (m) { var q = m.knots.map(function (i) { return d.truth[i]; }), h = N.sub(N.add(q[0], q[2]), N.add(q[1], q[3])); return N.norm(h) < 1e-12; }));
check('the hidden first column lies on the side rope', lat.knots.every(function (k, i) { return k.i !== 0 || Math.abs(d.truth[i][0] - d.ropeX) < 1e-12; }));
check('the noisy tag observation is distinct from hidden truth but close to it', N.norm(N.sub(d.truth[lat.K(0, 0)], d.det.tag)) > 0 && N.norm(N.sub(d.truth[lat.K(0, 0)], d.det.tag)) < 3 * p.tagNoise);
check('evidence has the documented effective-look normalization', (function () {
  var e = lat.T(4, 2, 'h'), t = lat.twines[e], ev = N.evidence(d.image, d.truth[t.a], d.truth[t.b], p), sum = 0, mu1 = p.background + p.twineBright, mu0 = p.background;
  for (var k = 0; k < p.samples; k++) { var q = N.add(d.truth[t.a], N.scale(N.sub(d.truth[t.b], d.truth[t.a]), (k + 0.5) / p.samples * 0.8 + 0.1)), v = N.sample(d.image, q, p.background); sum += (mu1 - mu0) * (2 * v - mu0 - mu1) / (2 * p.noise * p.noise); }
  return near(ev.llr, sum * p.effective / p.samples, 1e-10);
})());
check('at hidden locations, the posterior score separates torn and intact twines', lat.twines.every(function (t, e) { var score = N.evidence(d.image, d.truth[t.a], d.truth[t.b], p).llr + p.prior; return d.brokenIds.indexOf(e) >= 0 ? score < 0 : score > 0; }));
check('the robust penalty derivative matches half its frozen weight', (function () { var E = 7.3, h = 1e-5, derivative = (N.huber(E + h, p.delta) - N.huber(E - h, p.delta)) / (2 * h); return near(derivative, N.huberWeight(E, p.delta) / 2, 1e-7); })());
var HO = N.hollows(d, p);
check('detection-only registration has several aliases and the correct one is not lowest', HO.all.length >= 5 && HO.lowest !== HO.truest && N.norm(HO.truest.q) < 0.35 && HO.truest.c < 1.5 * HO.lowest.c, HO.all.length + ' aliases; lowest ' + JSON.stringify(HO.lowest.q));
check('the rope and tag select the correctly labeled integer shift', (function () { var best = null; for (var u = -1; u <= 1; u++) for (var v = -1; v <= 1; v++) { var c = N.shiftCost(d, p, u, v) + N.anchorCost(d, p, u, v); if (!best || c < best.c) best = { u: u, v: v, c: c }; } return best.u === 0 && best.v === 0; })());

// ---------------------------------------------------------------- 2. projections and consensus diagnostics
var meshLaw = S.laws.filter(function (law) { return law.kind === 'mesh'; })[0];
var testPts = [[0.2, 0.1], [1.8, -0.2], [2.6, 1.9], [-0.3, 1.2]], testZ = N.project(meshLaw, testPts, d), testGap = N.norm(N.sub(N.add(testPts[0], testPts[2]), N.add(testPts[1], testPts[3])));
check('mesh projection lands exactly on the affine rule', N.norm(N.sub(N.add(testZ[0], testZ[2]), N.add(testZ[1], testZ[3]))) < 1e-12);
check('each mesh-corner projection correction equals one quarter of the closure gap', testZ.every(function (q, j) { return near(N.norm(N.sub(testPts[j], q)), testGap / 4, 1e-12); }));
check('every local projection is idempotent', S.laws.every(function (law) { var pts = law.at.map(function (i, j) { return [0.37 + i * 0.13 + j, -0.2 + i * 0.07 - j]; }), z1 = N.project(law, pts, d), z2 = N.project(law, z1, d); return z1.every(function (q, j) { return N.norm(N.sub(q, z2[j])) < 1e-12; }); }));
check('round zero reports the decisions encoded by its word', R[0].flagged.join(',') === R[0].word.map(function (b, e) { return b ? e : -1; }).filter(function (e) { return e >= 0; }).join(','), R[0].flagged.length);
check('round zero stores projected copies and scaled dual variables', R[0].z.length === S.laws.length && R[0].u.length === S.laws.length);
check('every frozen position sweep lowers its assembled block surrogate', R.slice(1).every(function (r) { return r.blockCostAfter <= r.blockCostBefore + 1e-8 && finite(r.blockCostAfter); }));
check('stored primal residual equals an independent assembly', (function () { var sum = 0; S.laws.forEach(function (law, li) { law.at.forEach(function (i, j) { var q = N.sub(fin.pos[i], fin.z[li][j]); sum += q[0] * q[0] + q[1] * q[1]; }); }); return near(Math.sqrt(sum), fin.consensus.primal, 1e-10); })());
check('stored dual residual equals rho times the assembled copy-change adjoint', (function () { var prev = R[R.length - 2], agg = lat.knots.map(function () { return [0, 0]; }); S.laws.forEach(function (law, li) { law.at.forEach(function (i, j) { var q = N.sub(fin.z[li][j], prev.z[li][j]); agg[i][0] += q[0]; agg[i][1] += q[1]; }); }); var sum = agg.reduce(function (s, q) { return s + q[0] * q[0] + q[1] * q[1]; }, 0); return near(p.rho * Math.sqrt(sum), fin.consensus.dual, 1e-9); })());
check('all recorded diagnostics are finite', R.slice(1).every(function (r) { return finite(r.lawDistance) && finite(r.geometry.meshClosure) && finite(r.consensus.primal) && finite(r.consensus.dual) && finite(r.moved) && finite(r.dz); }));

// ---------------------------------------------------------------- 3. outcome and honest stopping boundary
check('the operational gate verifies a geometry-admissible candidate', S.accepted != null && S.stopReason === 'verified geometry' && fin.closeup.accepted && fin.geometry.projectionCorrection <= p.tol, S.accepted);
check('the final twine identities exactly match hidden simulator truth', fin.flagged.join(',') === d.brokenIds.join(','), fin.flagged.join(','));
check('the exact open-mesh identities are 7,12,13,18', fin.open.join(',') === '7,12,13,18', fin.open.join(','));
check('every final knot lies within one tenth of a mesh of hidden truth', fin.regError < 0.1, fin.regError);
check('the displayed mesh closure is four times the largest mesh projection correction', (function () { var maxMeshCorrection = 0; lat.meshes.forEach(function (m) { var pts = m.knots.map(function (i) { return fin.pos[i]; }), z = N.project({ kind: 'mesh' }, pts, d); pts.forEach(function (q, j) { maxMeshCorrection = Math.max(maxMeshCorrection, N.norm(N.sub(q, z[j]))); }); }); return near(fin.geometry.meshClosure, 4 * maxMeshCorrection, 1e-10); })());
check('acceptance is demonstrably separate from iterate settling', fin.moved > p.tol || fin.dz > p.tol, 'move ' + fin.moved.toFixed(4) + ', copy change ' + fin.dz.toFixed(4));
check('targeted verification covers less than the whole patch and records hidden-truth simulation', fin.closeup.checked < fin.closeup.total && fin.closeup.usesHiddenTruth === true, fin.closeup.checked + '/' + fin.closeup.total);
check('an earlier targeted follow-up rejects an incorrect candidate', R[5].closeup && !R[5].closeup.accepted, R[5].closeup.agreed + '/' + R[5].closeup.checked);
var d2 = N.build();
check('the seeded synthetic experiment is deterministic', d2.solution.accepted === S.accepted && d2.solution.final.flagged.join(',') === fin.flagged.join(',') && near(d2.solution.final.regError, fin.regError, 1e-12));

// ---------------------------------------------------------------- 4. the course in a browser-less drawing sandbox
function sandbox() {
  var elements = {}, noop = function () {};
  function ctx() { var t = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '', imageSmoothingEnabled: true };
    return new Proxy(t, { get: function (o, k) { if (k === 'measureText') return function (q) { return { width: 7 * String(q).length }; }; if (k === 'createImageData') return function (w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; }; if (k === 'createRadialGradient' || k === 'createLinearGradient') return function () { return { addColorStop: noop }; }; if (k in o) return o[k]; if (typeof k === 'string') return noop; return undefined; } }); }
  function element(id) { if (elements[id]) return elements[id]; var e = { id: id, hidden: false, textContent: '', innerHTML: '', disabled: false, width: 0, height: 0, style: {}, offsetTop: 0, offsetHeight: 0, scrollTop: 0, clientHeight: 100, classList: { toggle: noop, add: noop, remove: noop }, setAttribute: function (n, v) { this[n] = String(v); }, getAttribute: function (n) { return this[n] == null ? null : this[n]; }, addEventListener: noop, querySelectorAll: function () { return []; }, querySelector: function () { return element('q-' + Object.keys(elements).length); }, closest: function () { return null; }, getBoundingClientRect: function () { return { width: 720, height: 500, top: 0, left: 0, right: 720, bottom: 500 }; }, scrollIntoView: noop, focus: noop, getContext: function () { return ctx(); } }; return (elements[id] = e); }
  var sb = { console: console, performance: { now: function () { return 0; } }, requestAnimationFrame: function () { return 1; }, cancelAnimationFrame: noop, getComputedStyle: function () { return { fontFamily: 'sans-serif', getPropertyValue: function () { return 'monospace'; } }; },
    document: { body: {}, documentElement: {}, getElementById: element, querySelectorAll: function () { return []; }, addEventListener: noop, createElement: function () { return element('created-' + Object.keys(elements).length); } }, location: { hash: '' }, devicePixelRatio: 1, addEventListener: noop, Proxy: Proxy, Float32Array: Float32Array };
  sb.window = sb; vm.createContext(sb);
  var SIM = path.join(__dirname, '..', 'simulator');
  [[SIM, 'board.js'], [__dirname, 'net.js'], [__dirname, 'net_parts.js'], [__dirname, 'net_course.js']].forEach(function (q) {
    vm.runInContext(fs.readFileSync(path.join(q[0], q[1]), 'utf8'), sb, { filename: q[1] });
    // Reuse the already verified deterministic case. Building the image and solving it again inside a VM is slow
    // and tests JavaScript context overhead rather than a second mathematical contract.
    if (q[1] === 'net.js') { sb.Net.build = function () { return d; }; sb.Net.hollows = function () { return HO; }; }
  });
  return sb;
}
var sb, course = null, courseError = null;
try { sb = sandbox(); course = sb.course; } catch (e) { courseError = e && e.stack || String(e); }
check('the course builds in the sandbox', !!course, courseError);
if (course) {
  var steps = course.steps, ids = steps.map(function (q) { return q.id; });
  var expected = ['job','truth','unknowns','detections','association','robust','samples','llr','decision','coupling','geometry','anchors','impostors','program','difficulty','shared','symbols','position','probes','bitstep','project','dual','round','run','stopping','verification','result','bridge','differences','learned'];
  check('the course has the intentional 30-step, 7-chapter learning path', steps.length === 30 && course.chapters.length === 7 && ids.join(',') === expected.join(','), steps.length + ' steps, ' + course.chapters.length + ' chapters');
  var drawn = 0; steps.forEach(function (q, i) { (q.id === 'impostors' ? [0.25, 0.8] : [0, 0.5, 1]).forEach(function (pp) { sb.Board.debug({ step: i, p: pp }); drawn++; }); });
  check('every step draws at three moments without an error (' + drawn + ' drawings)', (sb.kingsLandErrors || []).length === 0, (sb.kingsLandErrors || []).slice(0, 3).join(' | '));
  function text(id) { var q = steps[ids.indexOf(id)]; return ((q && q.text || '') + ' ' + (q && q.math || '')).replace(/<[^>]*>/g, ''); }
  check('binary coding and the LLR sign are introduced before the decision formula', ids.indexOf('unknowns') < ids.indexOf('llr') && ids.indexOf('llr') < ids.indexOf('decision') && /0 = intact and 1 = torn/.test(text('unknowns')) && /Positive ℓ supports intact/.test(text('llr')));
  check('the displayed LLR includes effective-look normalization', /m_eff\/n/.test(text('llr')));
  check('the threshold page derives torn iff ell plus lambda is negative', /choose torn iff ℓₑ \+ λ < 0/.test(text('decision')));
  check('p, z, u, and z minus u are defined before any update page', ids.indexOf('symbols') < ids.indexOf('position') && ids.indexOf('symbols') < ids.indexOf('project') && /scaled dual variable/.test(text('symbols')) && /vᵣₙ = zᵣₙ − uᵣₙ/.test(text('symbols')));
  check('the course states that twine bits have no replicas or parity projection', /no relaxed twine variable, parity rule, copy, or ADMM projection/.test(text('decision')));
  check('the run page starts from the true round-zero flagged count', text('run').indexOf(String(S.rounds[0].flagged.length) + ' twines torn') >= 0);
  check('the stopping page separates diagnostics and rejects a convergence claim', /geometry correction ≠ primal residual/.test(text('stopping')) && /not because textbook ADMM residual thresholds proved convergence/.test(text('stopping')));
  check('verification is labeled targeted, partial, hidden-truth simulation rather than a CRC', /only .* of .* twines are inspected/.test(text('verification')) && /cannot rule out a missed tear elsewhere/.test(text('verification')) && /not a cyclic redundancy check/.test(text('verification')));
  check('the result separates field-style output from simulator-only evaluation', /field-style output/.test(text('result')) && /simulator can compare against hidden truth/.test(text('result')));
  check('the SAPPHIRE bridge preserves the copy-variable and acceptance differences', /SAPPHIRE the shared variable is a relaxed bit/.test(text('bridge')) && /hard independent twine thresholds/.test(text('differences')) && /syndrome followed by cyclic redundancy check/.test(text('differences')));
  var source = fs.readFileSync(path.join(__dirname, 'net_course.js'), 'utf8');
  check('retired overclaims do not reappear', !/SAPPHIRE[’']s CRC|same guarantees|SAPPHIRE[’']s order|anatomy, not its algebra|no formula, only samples/.test(source));
}

// ---------------------------------------------------------------- 5. generated standalone freshness
var buildCheck = '';
try { buildCheck = cp.execFileSync('python3', ['-B', path.join(__dirname, 'build_net.py'), '--check'], { encoding: 'utf8' }); }
catch (e) { buildCheck = String(e.stdout || '') + String(e.stderr || e.message || e); }
check('the standalone HTML is byte-current with its sources', /^ok finding_the_tear\.html is current/.test(buildCheck.trim()), buildCheck.trim());

console.log(failures ? failures + ' of ' + checks + ' checks FAILED' : 'all ' + checks + ' checks passed');
process.exit(failures ? 1 : 0);
