// Model, teaching-flow, wording, drawing and generated-page checks for "Three symbols, two checks" (three_symbols_two_checks.html).
// Run from anywhere with Node 12 or later:  node source/three_symbols/test_three.js
var T = require('./three.js'), fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
var failures = 0, checks = 0;
function check(what, ok, detail) { checks++; console.log((ok ? 'ok    ' : 'FAIL  ') + what + (detail !== undefined ? '  [' + detail + ']' : '')); if (!ok) failures++; }
function near(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-12 : tol); }
function nearV(a, b, tol) { return a.length === b.length && a.every(function (v, i) { return near(v, b[i], tol); }); }
function f3(v) { return '(' + v.map(function (x) { return x.toFixed(3); }).join(', ') + ')'; }

var d = T.build(), A = d.admm, R = A.rounds, L = d.alone.rounds, c = d.c, rho = d.rho;

// ---------------------------------------------------------------- 1. the example and its matrices
check('the signal prefers c = (0.1, 0.6, 0.9) and the checks are A on symbols 1, 2 and B on symbols 2, 3', nearV(c, [0.1, 0.6, 0.9]) && T.CHECKS[0].of.join() === '0,1' && T.CHECKS[1].of.join() === '1,2');
check('H combines symbols; S_a selects them and keeps them as a vector', JSON.stringify(T.H) === '[[1,1,0],[0,1,1]]' && JSON.stringify(d.S[0]) === '[[1,0,0],[0,1,0]]' && JSON.stringify(d.S[1]) === '[[0,1,0],[0,0,1]]' && nearV(T.select(0, [7, 8, 9]), [7, 8]) && nearV(T.select(1, [7, 8, 9]), [8, 9]));
check('symbol 2 has degree two, the outer symbols degree one, and four edges carry state', T.degree(0) === 1 && T.degree(1) === 2 && T.degree(2) === 1 && T.EDGES.length === 4);
check('the rounded signal 0 1 1 fails check A and passes check B', T.hard(c).join('') === '011' && T.syndrome([0, 1, 1]).join() === '1,0' && T.passes([1, 1, 1]) && T.passes([0, 0, 0]));

// ---------------------------------------------------------------- 2. the projection onto a degree-two parity polytope
function brute(q) { var best = null, bd = Infinity; for (var k = 0; k <= 20000; k++) { var t = k / 20000, dd = (q[0] - t) * (q[0] - t) + (q[1] - t) * (q[1] - t); if (dd < bd) { bd = dd; best = [t, t]; } } return best; }
var probes = [[0.1, 0.6], [0.6, 0.9], [1.4, 0.9], [-0.3, 0.1], [0.2, 0.2], [1, 0], [0.73, -0.5]];
check('the projection is the nearest point of {(t, t) : 0 ≤ t ≤ 1} (brute force)', probes.every(function (q) { return nearV(T.project(q), brute(q), 6e-5); }));
check('the projection is idempotent and lands on the segment', probes.every(function (q) { var z = T.project(q), z2 = T.project(z); return nearV(z, z2) && z[0] === z[1] && z[0] >= 0 && z[0] <= 1; }));
check('the pair moves jointly: clipping (0.1, 0.6) coordinatewise leaves it illegal, the projection gives (0.35, 0.35)', nearV(T.project([0.1, 0.6]), [0.35, 0.35]) && nearV([0.1, 0.6].map(T.clip), [0.1, 0.6]));

// ---------------------------------------------------------------- 3. the handover's trace, round by round
var R0 = R[0], R1 = R[1], R2 = R[2];
check('start: b⁰ = c, z_A⁰ = (0.1, 0.6), z_B⁰ = (0.6, 0.9), u⁰ = 0', nearV(R0.b, c) && nearV(R0.z[0], [0.1, 0.6]) && nearV(R0.z[1], [0.6, 0.9]) && nearV(R0.u[0], [0, 0]) && nearV(R0.u[1], [0, 0]));
check('round 1: the shared update does not move', nearV(R1.b, c, 1e-15), f3(R1.b));
check('round 1: z_A¹ = (0.35, 0.35), z_B¹ = (0.75, 0.75)', nearV(R1.z[0], [0.35, 0.35], 1e-15) && nearV(R1.z[1], [0.75, 0.75], 1e-15));
check('round 1: u_A¹ = (−0.25, 0.25), u_B¹ = (−0.15, 0.15)', nearV(R1.u[0], [-0.25, 0.25], 1e-15) && nearV(R1.u[1], [-0.15, 0.15], 1e-15));
check('round 2: corrected targets z − u = (0.60, 0.10) and (0.90, 0.60)', nearV(R2.targets[0], [0.6, 0.1], 1e-15) && nearV(R2.targets[1], [0.9, 0.6], 1e-15));
check('round 2: b² = ((0.1 + 0.6)/2, (0.6 + 0.1 + 0.9)/3, (0.9 + 0.6)/2) = (0.35, 0.533, 0.75)', nearV(R2.b, [0.35, 1.6 / 3, 0.75], 1e-15), f3(R2.b));
check('every round projects S_a b + u_a(prev) and adds S_a b − z_a to the ledger', R.slice(1).every(function (r) { return [0, 1].every(function (a) { var sb = T.select(a, r.b), q = [sb[0] + r.uPrev[a][0], sb[1] + r.uPrev[a][1]], z = T.project(q); return nearV(z, r.z[a], 1e-15) && nearV(r.u[a], [r.uPrev[a][0] + sb[0] - z[0], r.uPrev[a][1] + sb[1] - z[1]], 1e-15); }); }));
check('the ledger is the running sum of the disagreements r_a = S_a b − z_a', R.slice(1).every(function (r, k) { return [0, 1].every(function (a) { var s = [0, 0]; for (var j = 1; j <= k + 1; j++) { s[0] += R[j].r[a][0]; s[1] += R[j].r[a][1]; } return nearV(s, r.u[a], 1e-12); }); }));

// ---------------------------------------------------------------- 4. the shared update minimizes the frozen objective
function stepIsMinimizer(cc, z, u, rr) {
  var st = T.sharedStep(cc, z, u, rr), phi = T.phi(cc, z, u, rr), v0 = phi(st.b), ok = true;
  for (var k = 0; k < 400 && ok; k++) { var dlt = [Math.sin(k * 1.7) * 0.2, Math.cos(k * 2.3) * 0.2, Math.sin(k * 0.9 + 1) * 0.2].map(function (x) { return x * ((k % 7) + 1) / 7; }); var bb = st.b.map(function (v, i) { return T.clip(v + dlt[i]); }); if (phi(bb) < v0 - 1e-12) ok = false; }
  return ok;
}
check('every shared update is the minimizer of Φ_k over [0, 1]³ (ρ = 1, every round)', R.slice(1).every(function (r) { return stepIsMinimizer(c, r.zPrev, r.uPrev, rho); }));
var d3 = T.build({ rho: 3 });
check('the closed form also minimizes Φ_k for ρ = 3, where it is not a plain average', d3.admm.rounds.slice(1, 12).every(function (r) { return stepIsMinimizer(c, r.zPrev, r.uPrev, 3); }) && d3.admm.rounds[2].den[1] === 7);
function sharedGradient(i, x, cc, z, u, rr) {
  var g = x - cc[i];
  T.EDGES.forEach(function (e) { if (e[1] === i) g += rr * (x - z[e[0]][e[2]] + u[e[0]][e[2]]); });
  return g;
}
function boxKkt(x, g) { return x <= 1e-12 ? g >= -1e-10 : x >= 1 - 1e-12 ? g <= 1e-10 : Math.abs(g) <= 1e-10; }
check('the toy closed form uses curvature 1 + ρd_i and satisfies the box KKT condition', [1, 3].every(function (rr) {
  var Q = T.build({ rho: rr }).admm.rounds;
  return Q.slice(1).every(function (r) { var s = T.sharedStep(c, r.zPrev, r.uPrev, rr); return s.b.every(function (x, i) { return near(s.den[i], 1 + rr * T.degree(i)) && boxKkt(x, sharedGradient(i, x, c, r.zPrev, r.uPrev, rr)); }); });
}));

// ---------------------------------------------------------------- 5. agreement and its meaning
var gaps = R.slice(1, 11).map(function (r) { return r.gap; }), ratios = gaps.slice(1).map(function (g, i) { return g / gaps[i]; });
check('the gap halves in every round (ratios within 0.48–0.52)', ratios.every(function (x) { return x > 0.48 && x < 0.52; }), ratios.map(function (x) { return x.toFixed(3); }).join(' '));
check('the first passing rounded word is 1 1 1 in round 5; rounds 1–4 round to 0 1 1', A.firstPass === 5 && R[5].word.join('') === '111' && [1, 2, 3, 4].every(function (k) { return R[k].word.join('') === '011'; }));
check('all three estimates settle at the mean of c, 0.533, with the copies in agreement', R[40].b.every(function (v) { return near(v, d.mean, 1e-9); }) && R[40].gap < 1e-9 && near(d.mean, 1.6 / 3));
check('the settled ledgers are u_A = (−0.433, 0.433), u_B = (−0.367, 0.367): not zero', nearV(R[40].u[0], [0.1 - d.mean, d.mean - 0.1], 1e-9) && nearV(R[40].u[1], [d.mean - 0.9, 0.9 - d.mean], 1e-9));
check('at agreement the ledgers balance the signal: c_i − b_i = ρ Σ_{a∋i} u_{a,i}', (function () { var F = R[40], s = [F.u[0][0], F.u[0][1] + F.u[1][0], F.u[1][1]]; return [0, 1, 2].every(function (i) { return near(c[i] - F.b[i], rho * s[i], 1e-9); }); })());
check('the limit is the best word in the relaxation: f(t, t, t) is smallest at t = mean(c) (brute force)', (function () { var best = 0, bv = Infinity; for (var k = 0; k <= 10000; k++) { var t = k / 10000, v = 0.5 * ((t - c[0]) * (t - c[0]) + (t - c[1]) * (t - c[1]) + (t - c[2]) * (t - c[2])); if (v < bv) { bv = v; best = t; } } return near(best, d.mean, 1e-4); })());

// ---------------------------------------------------------------- 6. the same rounds without the ledger
var AL = d.alone.final;
check('without the ledger u stays zero and the copies stop moving', L.every(function (r) { return r.u.every(function (ua) { return ua[0] === 0 && ua[1] === 0; }); }) && AL.move < 1e-6);
check('the zero-ledger trace starts with the no-op shared update, then the two first projections', nearV(L[1].b, c, 1e-15) && nearV(L[1].z[0], [0.35, 0.35], 1e-15) && nearV(L[1].z[1], [0.75, 0.75], 1e-15));
check('its next shared update and projections are b² = (0.225, 0.567, 0.825), z_A² = (0.396, 0.396), z_B² = (0.696, 0.696)', nearV(L[2].b, [0.225, 17 / 30, 0.825], 1e-15) && nearV(L[2].z[0], [19 / 48, 19 / 48], 1e-15) && nearV(L[2].z[1], [167 / 240, 167 / 240], 1e-15));
check('round 12 produces the Tanner-graph values before display rounding', nearV(L[12].b, [0.2533561122090603, 0.5600304142198278, 0.7866895091206814], 1e-15) && nearV(L[12].z[0], [0.4066932632144441, 0.4066932632144441], 1e-15) && nearV(L[12].z[1], [0.6733599616702546, 0.6733599616702546], 1e-15) && near(L[12].gap, 0.2696511383390264, 1e-15));
check('without the ledger b stalls near (0.253, 0.560, 0.787) and the gap stays 0.27', nearV(AL.b, [0.2533, 0.5600, 0.7867], 2e-4) && AL.gap > 0.26 && AL.gap < 0.28, f3(AL.b) + ', gap ' + AL.gap.toFixed(4));
check('without the ledger the rounded word stays 0 1 1 and check A never passes', d.alone.firstPass === null && L.every(function (r) { return r.word.join('') === '011'; }));
check('the run is deterministic', (function () { var e = T.build(); return nearV(e.admm.final.b, A.final.b, 0) && e.admm.firstPass === A.firstPass; })());

// ---------------------------------------------------------------- 7. the course in a browser-less drawing sandbox
function sandbox(stageW, stageH) {
  var elements = {}, noop = function () {}; stageW = stageW || 720; stageH = stageH || 500;
  function ctx() { var t = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '', imageSmoothingEnabled: true };
    return new Proxy(t, { get: function (o, k) { if (k === 'measureText') return function (q) { return { width: 7 * String(q).length }; }; if (k === 'createImageData') return function (w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; }; if (k === 'createRadialGradient' || k === 'createLinearGradient') return function () { return { addColorStop: noop }; }; if (k in o) return o[k]; if (typeof k === 'string') return noop; return undefined; } }); }
  function element(id) { if (elements[id]) return elements[id]; var e = { id: id, hidden: false, textContent: '', innerHTML: '', disabled: false, width: 0, height: 0, style: {}, offsetTop: 0, offsetHeight: 0, scrollTop: 0, clientHeight: 100, classList: { toggle: noop, add: noop, remove: noop }, setAttribute: function (n, v) { this[n] = String(v); }, getAttribute: function (n) { return this[n] == null ? null : this[n]; }, addEventListener: noop, querySelectorAll: function () { return []; }, querySelector: function () { return element('q-' + Object.keys(elements).length); }, closest: function () { return null; }, getBoundingClientRect: function () { return { width: stageW, height: stageH, top: 0, left: 0, right: stageW, bottom: stageH }; }, scrollIntoView: noop, focus: noop, getContext: function () { return ctx(); } }; return (elements[id] = e); }
  var sb = { console: console, performance: { now: function () { return 0; } }, requestAnimationFrame: function () { return 1; }, cancelAnimationFrame: noop, getComputedStyle: function () { return { fontFamily: 'sans-serif', getPropertyValue: function () { return 'monospace'; } }; },
    document: { body: {}, documentElement: {}, getElementById: element, querySelectorAll: function () { return []; }, addEventListener: noop, createElement: function () { return element('created-' + Object.keys(elements).length); } }, location: { hash: '' }, devicePixelRatio: 1, addEventListener: noop, Proxy: Proxy, Float32Array: Float32Array, Float64Array: Float64Array };
  sb.window = sb; vm.createContext(sb);
  var SIM = path.join(__dirname, '..', 'simulator');
  [[SIM, 'board.js'], [__dirname, 'three.js'], [__dirname, 'three_parts.js'], [__dirname, 'three_course.js']].forEach(function (q) { vm.runInContext(fs.readFileSync(path.join(q[0], q[1]), 'utf8'), sb, { filename: q[1] }); });
  return sb;
}
var sb, course = null, courseError = null;
try { sb = sandbox(); course = sb.course; } catch (e) { courseError = e && e.stack || String(e); }
check('the course builds in the sandbox', !!course, courseError);
if (course) {
  var steps = course.steps, ids = steps.map(function (q) { return q.id; });
  var expected = ['signal', 'checks', 'conflict', 'jobs', 'replicas', 'select', 'polytope', 'problem', 'no-ledger-arithmetic', 'no-ledger', 'ledger', 'edges', 'start', 'project', 'record', 'targets', 'shared', 'roles', 'rounds', 'answer', 'sapphire-bridge', 'sapphire-surrogate', 'sapphire-symbols', 'sapphire-channel', 'sapphire', 'bp', 'lbfgs', 'remember'];
  check('the course has the intended 28 steps in 7 chapters', steps.length === 28 && course.chapters.length === 7 && ids.join(',') === expected.join(','), steps.length + ' steps, ' + course.chapters.length + ' chapters');
  var drawn = 0; steps.forEach(function (q, i) { [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1].forEach(function (pp) { sb.Board.debug({ step: i, p: pp }); drawn++; }); });
  check('every step draws at seven moments without an error (' + drawn + ' drawings)', (sb.kingsLandErrors || []).length === 0, (sb.kingsLandErrors || []).slice(0, 3).join(' | '));
  var phone = null, phoneError = null; try { phone = sandbox(450, 560); } catch (e) { phoneError = e && e.stack || String(e); }
  var phoneDrawn = 0; if (phone) phone.course.steps.forEach(function (q, i) { [0, 0.1, 0.5, 0.9, 1].forEach(function (pp) { phone.Board.debug({ step: i, p: pp }); phoneDrawn++; }); });
  check('every step also draws on a phone-shaped stage without an error (' + phoneDrawn + ' drawings)', !!phone && (phone.kingsLandErrors || []).length === 0, phoneError || (phone && (phone.kingsLandErrors || []).slice(0, 3).join(' | ')));

  function raw(id) { var q = steps[ids.indexOf(id)]; return (q && q.text || '') + ' ' + (q && q.math || ''); }
  function text(id) { return raw(id).replace(/<[^>]*>/g, ''); }
  var allRaw = steps.map(function (q) { return (q.text || '') + ' ' + (q.math || ''); }).join('\n');
  var all = steps.map(function (q) { return ((q.text || '') + ' ' + (q.math || '')).replace(/<[^>]*>/g, ''); }).join('\n');
  var allText = steps.map(function (q) { return (q.text || '').replace(/<[^>]*>/g, ''); }).join('\n');
  function before(a, b) { return ids.indexOf(a) >= 0 && ids.indexOf(a) < ids.indexOf(b); }

  // the teaching order the handover asks for
  check('the conflict between overlapping checks comes before the replicas, and mechanism before notation', before('conflict', 'replicas') && before('replicas', 'select') && /two requests, 0\.35 from A and 0\.75 from B/.test(text('conflict')) && /one shared estimate cannot carry both requests/.test(text('conflict')));
  check('the five questions come in order: two copies, a replica per check, projection, the ledger, the three updates', before('jobs', 'replicas') && before('replicas', 'polytope') && before('polytope', 'no-ledger-arithmetic') && before('no-ledger-arithmetic', 'no-ledger') && before('no-ledger', 'ledger') && before('ledger', 'roles') && /temporary copy of the symbols it watches/.test(text('jobs')) && /These copies are the replica variables/.test(text('replicas')) && /nearest legal point/.test(text('polytope')) && /differences are added to the same.*instead of resetting/.test(text('ledger')) && /three updates in a fixed order/.test(text('roles')));
  check('the worked round follows the order shared update, projection, ledger, then targets and the next shared update', before('start', 'project') && before('project', 'record') && before('record', 'targets') && before('targets', 'shared') && /has nothing to settle/.test(text('start')));
  check('agreement leads directly into the five SAPPHIRE pages, then the method comparisons and closing message', before('answer', 'sapphire-bridge') && before('sapphire-bridge', 'sapphire-surrogate') && before('sapphire-surrogate', 'sapphire-symbols') && before('sapphire-symbols', 'sapphire-channel') && before('sapphire-channel', 'sapphire') && before('sapphire', 'bp') && before('bp', 'lbfgs') && before('lbfgs', 'remember') && ids[ids.length - 1] === 'remember');

  // the numbers in the text are the model's
  var arithmetic = text('no-ledger-arithmetic'), arithmeticRaw = raw('no-ledger-arithmetic');
  check('the numerical bridge labels the zero-ledger run as a counterfactual rather than ADMM', /deliberate counterfactual/.test(arithmetic) && /This is not ADMM/.test(arithmetic) && /<b>u<\/b><sub>a<\/sub><sup>k<\/sup> = 0 for every check a and round k/.test(arithmeticRaw));
  check('the numerical bridge derives round 1, round 2 and the unrounded round-12 values', /zA1 = \(0\.35, 0\.35\)/.test(arithmetic) && /zB1 = \(0\.75, 0\.75\)/.test(arithmetic) && /b12 = \(0\.1 \+ 0\.35\)\/2 = 0\.225/.test(arithmetic) && /b22 = \(0\.6 \+ 0\.35 \+ 0\.75\)\/3 = 0\.567/.test(arithmetic) && /b32 = \(0\.9 \+ 0\.75\)\/2 = 0\.825/.test(arithmetic) && /round 12, b = \(0\.253, 0\.560, 0\.787\), zA = \(0\.407, 0\.407\) and zB = \(0\.673, 0\.673\)/.test(arithmetic));
  check('the projection page quotes z_A¹ and z_B¹ from the run', /zA1 = \(0\.35, 0\.35\)/.test(text('project')) && /zB1 = \(0\.75, 0\.75\)/.test(text('project')));
  check('the record page quotes u_A¹ and u_B¹ from the run', text('record').indexOf('(−0.25, 0.25)') >= 0 && text('record').indexOf('(−0.15, 0.15)') >= 0);
  check('the target page quotes (0.60, 0.10) and (0.90, 0.60)', text('targets').indexOf('(0.60, 0.10)') >= 0 && text('targets').indexOf('(0.90, 0.60)') >= 0);
  check('the shared page quotes b² = 0.35, 0.533, 0.75 with their averages', /\(0\.1 \+ 0\.6\)\/2 = 0\.35/.test(text('shared')) && /\(0\.6 \+ 0\.1 \+ 0\.9\)\/3 = 0\.533/.test(text('shared')) && /\(0\.9 \+ 0\.6\)\/2 = 0\.75/.test(text('shared')));
  var sharedStep = steps[ids.indexOf('shared')], sharedDraw = String(sharedStep.draw), sharedSource = fs.readFileSync(path.join(__dirname, 'three_course.js'), 'utf8');
  check('the shared update replaces the static formula box with live per-symbol equations', sharedStep.math === '' && sharedStep.dur >= 13 && /animation substitutes equal-weight values/.test(text('shared')) && /sharedCalcAt/.test(sharedDraw) && /drawSharedCalculation/.test(sharedDraw) && /j === 3 \? seg\(local, 0\.68, 0\.86\)/.test(sharedSource) && /s\.start \+ 0\.68 \* \(s\.end - s\.start\)/.test(sharedDraw));
  var sharedErrorsBefore = (sb.kingsLandErrors || []).length;
  [0.06, 0.19, 0.25, 0.42, 0.49, 0.62, 0.68, 0.79, 0.90, 1].forEach(function (pp) { sb.Board.debug({ step: ids.indexOf('shared'), p: pp }); });
  check('the live equations draw at every symbol and slope-curvature transition', (sb.kingsLandErrors || []).length === sharedErrorsBefore, (sb.kingsLandErrors || []).slice(sharedErrorsBefore).join(' | '));
  check('the agreement pages quote the halving gap, round 5, 1 1 1, the limit 0.533 and the settled ledgers', /0\.41, 0\.20, 0\.10, 0\.05, 0\.025/.test(text('rounds')) && /In round 5/.test(text('rounds')) && /1 1 1/.test(text('rounds')) && /agree at 0\.533/.test(text('rounds')) && text('answer').indexOf('(−0.43, 0.43)') >= 0 && text('answer').indexOf('(−0.37, 0.37)') >= 0 && /do not return to zero/.test(text('answer')));
  check('the no-ledger page connects round 12 to the constrained target', text('no-ledger').indexOf('(0.25, 0.56, 0.79)') >= 0 && text('no-ledger').indexOf('(0.41, 0.41)') >= 0 && text('no-ledger').indexOf('(0.67, 0.67)') >= 0 && /stays 0 1 1/.test(text('no-ledger')) && /gap is 0\.27/.test(text('no-ledger')) && /This is not a solution of the fixed problem/.test(text('no-ledger')) && /best common value is 0\.533/.test(text('no-ledger')));
  check('the failed run hands its erased edge differences directly to the ledger page', /zero-ledger run erases them/.test(text('no-ledger')) && /next page returns to the first projection and keeps one/.test(text('no-ledger')) && /previous page ended with a 0\.27 gap/.test(text('ledger')) && /then erased them/.test(text('ledger')) && /Return to the first projection/.test(text('ledger')));
  check('the ledger page turns check A’s first signed difference into its corrected next request', /rA1 = \(−0\.25, 0\.25\)/.test(text('ledger')) && /no ledger: uA1 = \(0, 0\)  →  next request = \(0\.35, 0\.35\)/.test(text('ledger')) && /ADMM: uA1 = rA1  →  zA1 − uA1 = \(0\.60, 0\.10\)/.test(text('ledger')));
  check('the preview hands into per-edge state and then a slow replay of the same round', /two A entries just stored stay on A’s two edges/.test(text('edges')) && /Check B keeps its own two entries/.test(text('edges')) && /replay that same first round slowly as full ADMM/.test(text('start')));

  // the handover's distinctions
  check('a row of H adds symbols to express a check; S_a selects them and keeps them as a vector', /picks out the symbols of one check and keeps them as a vector/.test(text('select')) && /adds the symbols of its check modulo 2/.test(text('select')));
  check('fractional points are legal points of the relaxation, and projection is joint, not coordinatewise clipping', /legal point of this relaxation; it is not a hard decision/.test(text('polytope')) && /The whole pair moves together/.test(text('polytope')) && /Clipping each value to \[0, 1\] separately/.test(text('polytope')));
  check('the ledger carries signed disagreement and its sign changes the next request', /running signed disagreement that changes the next request/.test(text('ledger')) && /negative entry raises the first request/.test(text('ledger')) && /positive entry lowers the second/.test(text('ledger')) && /scaled dual variable/.test(text('ledger')));
  check('every edge carries one replica coordinate and one scaled dual variable; b₂ sits in two edge states', /a replica coordinate and a scaled dual variable/.test(text('edges')) && /\(zA,2, uA,2\) and \(zB,2, uB,2\)/.test(text('edges')) && /main reason for the replicas/.test(text('edges')));
  var bridge = text('sapphire-bridge'), bridgeStep = steps[ids.indexOf('sapphire-bridge')], bowlModel = bridgeStep.bowlModel;
  check('the toy average becomes three exact temporary bowls before SAPPHIRE', /old value 0\.600.*total slope 0\.200 and curvature 3/.test(text('shared')) && /0\.600 − 0\.200\/3 = 0\.533/.test(text('shared')) && /objective function separates into three quadratic functions, one for each symbol estimate/.test(bridge) && /Subtracting slope divided by curvature jumps directly from 0\.600 to 0\.533/.test(bridge));
  check('the 3D view uses the model centres, curvatures and old-point slopes', bowlModel && nearV(bowlModel.bowls.map(function (x) { return x.centre; }), R2.b, 1e-15) && nearV(bowlModel.bowls.map(function (x) { return x.old; }), R1.b, 1e-15) && nearV(bowlModel.bowls.map(function (x) { return x.curvature; }), [2, 3, 2], 1e-15) && nearV(bowlModel.bowls.map(function (x) { return x.slope; }), [-0.5, 0.2, 0.3], 1e-12));
  check('every displayed bowl is lowest at its stated centre and has the stated slope at the old estimate', bowlModel.bowls.every(function (x) { var e = 1e-6, atCentre = bowlModel.cost(x, x.centre), slope = (bowlModel.cost(x, x.old + e) - bowlModel.cost(x, x.old - e)) / (2 * e); return near(atCentre, 0, 1e-15) && near(slope, x.slope, 1e-9); }));
  check('the recorded-frame schematic touches at the old estimate and stays below its quadratic function', bowlModel.bowls.every(function (x) { var e = 1e-6, bowlSlope = (bowlModel.cost(x, x.old + e) - bowlModel.cost(x, x.old - e)) / (2 * e), signalSlope = (bowlModel.signalCost(x, x.old + e) - bowlModel.signalCost(x, x.old - e)) / (2 * e); if (!near(bowlModel.cost(x, x.old), bowlModel.signalCost(x, x.old), 1e-15) || !near(bowlSlope, signalSlope, 1e-9)) return false; for (var j = 0; j <= 100; j++) { var t = j / 100; if (bowlModel.cost(x, t) < bowlModel.signalCost(x, t) - 1e-15) return false; } return true; }));
  check('the highlighted fixed-response slice preserves every exact one-symbol cost', bowlModel && bowlModel.jointCost && bowlModel.bowls.every(function (x) { for (var j = 0; j <= 100; j++) { var t = j / 100; if (!near(bowlModel.jointCost(x, t, bowlModel.response.current), bowlModel.cost(x, t), 1e-12)) return false; if (!near(bowlModel.jointCost(x, t, bowlModel.response.current, function (b0, tt) { return bowlModel.signalCost(b0, tt); }), bowlModel.signalCost(x, t), 1e-12)) return false; } return true; }));
  check('the schematic response coordinate changes cost and has a finite displayed minimum', bowlModel.bowls.every(function (x) { var t = x.centre, r = bowlModel.responseMinimum(x, t); return r > -1 && r < 1 && Math.abs(bowlModel.jointCost(x, t, 0.7) - bowlModel.jointCost(x, t, 0)) > 1e-6 && bowlModel.jointCost(x, t, r) <= bowlModel.jointCost(x, t, r - 1e-4) && bowlModel.jointCost(x, t, r) <= bowlModel.jointCost(x, t, r + 1e-4); }));
  check('the 3D axes connect the exact toy slice to a schematic response direction with ICI meaning', bridgeStep.math === '' && bridgeStep.dur >= 32 && /one real coordinate of SAPPHIRE’s frequency-domain response C/.test(bridge) && /carrier coupling used to model intercarrier interference \(ICI\)/.test(bridge) && /Left–right is bi, front–back is that response coordinate, and height is cost/.test(bridge) && /Demodulation is the operation, not a plotted variable/.test(bridge) && /bright C = Ck slice preserves the earlier one-symbol curve exactly/.test(bridge) && /entire receiver view, including the surrounding sheet, is schematic/.test(bridge));
  check('the shared symbol move is one block update rather than three coordinate steps', /holds C fixed and moves all three symbol estimates together/.test(bridge) && /one shared b-block update, not three coordinate-descent steps/.test(bridge));
  check('the 3D signal view uses its fixed-response slice to illustrate the upper model', /builds an upper quadratic model of the fixed-weight received-signal cost/.test(bridge) && /bright fixed-response slice illustrates its touch, common slope and upper-bound relationship/.test(bridge) && /Binary and ADMM terms then form the full temporary bowl/.test(bridge));
  check('the 3D view keeps the response direction but freezes it before the two-symbol surface', /response direction exists, but this symbol update holds C fixed/.test(bridge) && /weights, replicas, ledgers and every unshown symbol estimate fixed/.test(bridge) && /next page opens two symbol coordinates together/.test(bridge) && !/decoder feedback|decoder output|message returned/.test(bridge));
  var bridgeErrorsBefore = (sb.kingsLandErrors || []).length, phoneBridgeErrorsBefore = (phone.kingsLandErrors || []).length;
  [0, 0.04, 0.08, 0.18, 0.28, 0.38, 0.46, 0.54, 0.70, 0.76, 0.84, 0.88, 0.92, 0.94, 0.98, 1].forEach(function (pp) { sb.Board.debug({ step: ids.indexOf('sapphire-bridge'), p: pp }); phone.Board.debug({ step: ids.indexOf('sapphire-bridge'), p: pp }); });
  check('desktop and phone draw every 3D surface and slice transition without an error', (sb.kingsLandErrors || []).length === bridgeErrorsBefore && (phone.kingsLandErrors || []).length === phoneBridgeErrorsBefore, (sb.kingsLandErrors || []).slice(bridgeErrorsBefore).concat((phone.kingsLandErrors || []).slice(phoneBridgeErrorsBefore)).join(' | '));
  var surrogate = text('sapphire-surrogate'), surrogateStep = steps[ids.indexOf('sapphire-surrogate')], surrogateModel = surrogateStep.surrogateModel;
  check('the new surface is an honest two-symbol teaching slice rather than a global receiver surface', surrogateStep.math === '' && surrogateStep.dur >= 28 && /schematic teaching slice, not the complete receiver objective or a sampled receiver frame/.test(surrogate) && /actual cost of this frozen block/.test(surrogate));
  check('the two-symbol slice preserves the preceding old point, slopes, curvatures and new point', surrogateModel && nearV(surrogateModel.old, [0.1, 0.6], 1e-15) && nearV(surrogateModel.next, [0.35, 8 / 15], 1e-15) && nearV(surrogateModel.curvature, [2, 3], 1e-15) && nearV(surrogateModel.slope(), [-0.5, 0.2], 1e-12));
  check('the surrogate touches the actual frozen cost and has the same two partial derivatives at the old point', (function () { var o = surrogateModel.old, e = 1e-6, qa = surrogateModel.upper(o[0], o[1]), fa = surrogateModel.actual(o[0], o[1]); function grad(fn) { return [(fn(o[0] + e, o[1]) - fn(o[0] - e, o[1])) / (2 * e), (fn(o[0], o[1] + e) - fn(o[0], o[1] - e)) / (2 * e)]; } return near(qa, fa, 1e-15) && nearV(grad(surrogateModel.upper), grad(surrogateModel.actual), 1e-9) && nearV(grad(surrogateModel.actual), [-0.5, 0.2], 1e-9); })());
  check('the surrogate is an upper bound over the displayed square', (function () { for (var i = 0; i <= 50; i++) for (var j = 0; j <= 50; j++) { var x = i / 50, y = j / 50; if (surrogateModel.upper(x, y) < surrogateModel.actual(x, y) - 1e-14 || surrogateModel.gap(x, y) < -1e-14) return false; } return true; })());
  check('the displayed new point is the exact in-box surrogate minimum', (function () { var n = surrogateModel.next, best = surrogateModel.upper(n[0], n[1]); if (!near(best, 0.1, 1e-15)) return false; for (var i = 0; i <= 50; i++) for (var j = 0; j <= 50; j++) if (surrogateModel.upper(i / 50, j / 50) < best - 1e-14) return false; return true; })());
  check('the numerical chain certifies decrease only for the frozen block', (function () { var o = surrogateModel.old, n = surrogateModel.next, fo = surrogateModel.actual(o[0], o[1]), qo = surrogateModel.upper(o[0], o[1]), fn = surrogateModel.actual(n[0], n[1]), qn = surrogateModel.upper(n[0], n[1]); return near(fo, 0.16916666666666663, 1e-12) && near(fn, 0.06991666666666668, 1e-12) && fn <= qn && qn <= qo && near(qo, fo, 1e-15) && /certifies a decrease for this frozen block; it does not certify a global minimum/.test(surrogate); })());
  check('partial derivatives shape the surrogate before one direct block move', /evaluates them from explicit formulas/.test(surrogate) && /They describe the local slopes; they do not move the estimates/.test(surrogate) && /Both coordinates come from the same old vector and move as one block/.test(surrogate) && /minimizes the quadratic function directly; it does not take a sequence of gradient-descent steps/.test(surrogate));
  check('the fixed problem is separated from the round-dependent block cost', /constrained problem and its formula stay fixed/.test(surrogate) && /new values produce Φk\+1/.test(surrogate) && /next round builds a new surrogate/.test(surrogate));
  var surrogateErrorsBefore = (sb.kingsLandErrors || []).length, phoneSurrogateErrorsBefore = (phone.kingsLandErrors || []).length;
  [0, 0.06, 0.12, 0.18, 0.23, 0.3, 0.36, 0.46, 0.55, 0.61, 0.67, 0.74, 0.8, 0.86, 0.91, 0.96, 1].forEach(function (pp) { sb.Board.debug({ step: ids.indexOf('sapphire-surrogate'), p: pp }); phone.Board.debug({ step: ids.indexOf('sapphire-surrogate'), p: pp }); });
  check('desktop and phone draw every actual-cost and surrogate transition without an error', (sb.kingsLandErrors || []).length === surrogateErrorsBefore && (phone.kingsLandErrors || []).length === phoneSurrogateErrorsBefore, (sb.kingsLandErrors || []).slice(surrogateErrorsBefore).concat((phone.kingsLandErrors || []).slice(phoneSurrogateErrorsBefore)).join(' | '));
  check('BP and SAPPHIRE share the graph but not the edge state; BP messages are directed and extrinsic', /variable-to-check message/.test(text('bp')) && /check-to-variable message/.test(text('bp')) && /extrinsic information/.test(text('bp')) && /neither is a message/.test(text('bp')) && /BP passes beliefs around the Tanner graph; SAPPHIRE runs a constrained negotiation on the same graph/.test(text('bp')));
  check('CORAL keeps one soft estimate per coded symbol; SAPPHIRE adds persistent per-edge replicas and ledgers', /one soft estimate per coded symbol and nothing persistent on Tanner-graph edges/.test(text('remember')) && /one replica coordinate and one ledger entry on every edge/.test(text('remember')) && /persistent edge states are the fundamental difference/.test(text('remember')));
  check('ADMM and L-BFGS are placed at different levels around a frozen Φ_k', /not alternatives at the same level/.test(text('lbfgs')) && /augmented Lagrangian/.test(text('lbfgs')) && /replicas and the ledgers frozen/.test(text('lbfgs')) && /box bounds handled separately/.test(text('lbfgs')) && /closed-form temporary-quadratic rule shown earlier/.test(text('lbfgs')));
  var symbols = text('sapphire-symbols'), symbolsRaw = raw('sapphire-symbols');
  check('SAPPHIRE gives g_i and h_i their exact jobs', /gi.*partial derivative, or slope, of the fixed-weight signal part of the objective function/.test(symbols) && /hi.*supplies a safe curvature/.test(symbols) && /separable quadratic approximation/.test(symbols));
  check('SAPPHIRE minimizes one quadratic per free symbol from one preceding vector', /displayed fraction is the exact bottom of that one quadratic function/.test(symbols) && /Clipping keeps it in \[0,1\]/.test(symbols) && /Every free estimate uses the same old vector, so all free estimates update together/.test(symbols) && /known symbols stay fixed/.test(symbols));
  check('the displayed symbol rule contains every production term with the correct signs and a positive denominator', /ηik = ρdi − 2β \+ hik &gt; 0/.test(symbols) && /for each free i: bi.*k\+1.*Π\[0,1\].*Σa∋i\(za,ik − ua,ik\) − gik − β \+ hikbik/.test(symbols));
  check('the symbol block uses derivatives but is not gradient descent and does not claim a full coupled minimum', /majorization-minimization/.test(symbols) && /uses derivatives but is not gradient descent/.test(symbols) && /not the full coupled symbol cost/.test(symbols) && /does not run a separate iterative inner solver/.test(symbols));
  var channel = text('sapphire-channel'), channelRaw = raw('sapphire-channel');
  check('the channel block recomputes weights and solves the normal equations', /recomputes how much to trust each received sample/.test(channel) && /channel objective is a quadratic function/.test(channel) && /normal equations/.test(channel) && /Cholesky factorization/.test(channel));
  check('the channel solve is exact only for fixed symbol estimates and weights', /For fixed b and weights, solving this system gives the exact channel minimum/.test(channel) && /only a temporary view of the same channel/.test(channel));
  check('the channel equation uses a bold matrix and bold vectors, then restores the channel array', /<b>M<\/b><b>c<\/b><sub>ch<\/sub> = <b>r<\/b>/.test(channelRaw) && /stores the solved entries back in <b>C<\/b>/.test(channelRaw));
  var constraints = text('sapphire');
  check('replicas are projected and ledgers carry disagreement without derivatives', /projects the whole vector onto its parity polytope/.test(constraints) && /does not differentiate the parity constraints/.test(constraints) && /adds the remaining disagreement/.test(constraints) && /carries unfinished disagreement into the next round/.test(constraints) && /Neither update uses derivatives/.test(constraints));
  check('the final SAPPHIRE page keeps β, ρ, start, acceptance, budget and numerical-failure facts', ['β = 0.8', 'ρ = 3', 'hard decisions', 'projection of its symbol estimates', 'cyclic redundancy check (CRC)', '200 updates', 'numerical accuracy check'].every(function (s) { return constraints.indexOf(s) >= 0; }));
  check('the course closes on the handover’s core message', /What an optimization method remembers, and how it represents constraints, determines where it can go\./.test(text('remember')));

  // notation: bold vectors and matrices, ordinary scalars
  check('vectors and matrices are bold, scalar entries are not', /<b>z<\/b><sub>A<\/sub>/.test(raw('replicas')) && /z<sub>A,1<\/sub>/.test(raw('replicas')) && /<b>u<\/b><sub>a<\/sub>/.test(raw('ledger')) && /u<sub>a,i<\/sub>/.test(raw('ledger')) && /<b>S<\/b><sub>A<\/sub><b>b<\/b>/.test(raw('select')) && /<b>H<\/b>/.test(raw('checks')) && /<b>c<\/b>/.test(raw('signal')) && /<b>C<\/b>/.test(channelRaw));
  check('SAPPHIRE and CORAL are marked as this project’s names where they first appear', /SAPPHIRE, the name this project gives its receiver/.test(text('signal')) && allText.indexOf('SAPPHIRE') === allText.indexOf('SAPPHIRE, the name this project') && /CORAL, another receiver of this project/.test(text('remember')) && allText.indexOf('CORAL') === allText.indexOf('CORAL, another receiver'));

  // wording
  var BADTERMS = /relaxed bit|local replica|half[- ]bit|\bsweep/i;
  check('terminology: no “relaxed bit”, “local replica”, “half bit” or “sweep”', !BADTERMS.test(all), (all.match(BADTERMS) || []).join(','));
  var GOOD = ['Tanner graph', 'variable-to-check message', 'check-to-variable message', 'extrinsic information', 'replica variable', 'scaled dual variable', 'augmented Lagrangian', 'parity polytope', 'symbol estimate', 'partial derivative', 'quadratic approximation', 'majorization-minimization', 'normal equations', 'Cholesky factorization', 'closed-form solution'];
  check('terminology: every approved term appears', GOOD.every(function (t) { return all.indexOf(t) >= 0; }), GOOD.filter(function (t) { return all.indexOf(t) < 0; }).join(', '));
  var msgPages = ids.filter(function (id) { return /message/i.test(text(id)); });
  check('only the BP comparison and the closing table speak of messages', msgPages.every(function (id) { return ['bp', 'remember'].indexOf(id) >= 0; }), msgPages.join(','));
  check('no ranking: nothing beats, outperforms or is better or faster than anything', !/\b(beats?|outperforms?|better than|faster than|superior to|the best method)\b/i.test(all));
  var ACRO = { ADMM: 'alternating direction method of multipliers', BP: 'belief propagation', LLR: 'log-likelihood ratio', 'L-BFGS': 'limited-memory Broyden–Fletcher–Goldfarb–Shanno method', CRC: 'cyclic redundancy check' };
  var unexpanded = Object.keys(ACRO).filter(function (a) { var m = new RegExp('(^|[^A-Za-z-])' + a.replace('-', '\\-') + '(?![A-Za-z-])').exec(allText); if (!m) return true; var i = m.index + m[1].length; return allText.slice(Math.max(0, i - ACRO[a].length - 2), i).toLowerCase() !== ACRO[a].toLowerCase() + ' ('; });
  check('every acronym is expanded at its first use', unexpanded.length === 0, unexpanded.join(', '));
  var withoutBoldChannel = allRaw.replace(/<b>C<\/b>/g, '');
  check('the signal owns bold lowercase c, and the channel matrix is bold uppercase C', /<b>c<\/b>/.test(raw('signal')) && /<b>C<\/b>/.test(channelRaw) && !/(^|[^A-Za-z0-9_’'\-])C(?![A-Za-z0-9_’'\-])/.test(withoutBoldChannel));
  var BANNED = /\b(novel|state-of-the-art|framework|paradigm|leverage|utili[sz]e|in order to|crucial|vital|clearly|obviously|natural(ly)?|elegant|principled)\b|It is worth noting/i;
  var CONTRACTION = /\b\w+(n’t|n't)\b|\b(it|that|there|let|we|you|they|he|she|what|who)(’|')(s|re|ll|ve|d)\b/i;
  check('house rules: no banned words, contractions or exclamation marks', !BANNED.test(all) && !CONTRACTION.test(all) && !/!/.test(all), (all.match(BANNED) || all.match(CONTRACTION) || all.match(/.{20}!/) || []).join(','));
  var long = []; steps.forEach(function (q) { (q.text || '').replace(/<[^>]*>/g, '').split(/(?<=[.;])\s+/).forEach(function (s) { var n = s.split(/\s+/).filter(Boolean).length; if (n > 42) long.push(q.id + ': ' + n); }); });
  check('no sentence runs past 42 words', long.length === 0, long.join(', '));
}

// ---------------------------------------------------------------- 8. generated standalone freshness
var buildCheck = '';
try { buildCheck = cp.execFileSync('python3', ['-B', path.join(__dirname, 'build_three.py'), '--check'], { encoding: 'utf8' }); }
catch (e) { buildCheck = String(e.stdout || '') + String(e.stderr || e.message || e); }
check('the standalone HTML is byte-current with its sources', /^ok three_symbols_two_checks\.html is current/.test(buildCheck.trim()), buildCheck.trim());

console.log(failures ? failures + ' of ' + checks + ' checks FAILED' : 'all ' + checks + ' checks passed');
process.exit(failures ? 1 : 0);
