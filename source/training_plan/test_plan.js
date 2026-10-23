// Model, solver-contract, teaching-flow, drawing, and generated-page checks for "The Coach and the Physio".
// Run from anywhere with Node 12 or later:  node source/training_plan/test_plan.js
var N = require('./plan.js'), fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
var failures = 0, checks = 0;
function check(what, ok, detail) { checks++; console.log((ok ? 'ok    ' : 'FAIL  ') + what + (detail !== undefined ? '  [' + detail + ']' : '')); if (!ok) failures++; }
function near(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-9 : tol); }
function finite(x) { return typeof x === 'number' && isFinite(x); }
function f3(q) { return '(' + q[0].toFixed(3) + ', ' + q[1].toFixed(3) + ')'; }

var d = N.build(), p = d.p, pr = d.prob, S = d.sol, R = S.rounds, fin = S.final, A = d.alone;

// ---------------------------------------------------------------- 1. the body and the Coach's map
check('readiness dips below the baseline right after the session and crests above it later', pr.r(0) < 1 && pr.r(pr.crest) > 1 && pr.r(12) > 1 && pr.r(12) < pr.r(pr.crest), 'dip ' + pr.r(0).toFixed(3) + ', crest ' + pr.r(pr.crest).toFixed(3));
check('the crest found on the grid matches the closed form of one session', near(pr.crest, N.crestOf(p), 2e-3), pr.crest.toFixed(4) + ' vs ' + N.crestOf(p).toFixed(4));
check('the Coach’s favourite is the crest with load (r − r0)/2a, and J there is −g²/4a', near(pr.free[0], pr.crest, 2e-3) && near(pr.free[1], (pr.r(pr.crest) - p.r0) / (2 * p.a), 1e-3) && near(pr.freeJ, -Math.pow(pr.r(pr.crest) - p.r0, 2) / (4 * p.a), 1e-6), f3(pr.free));
check('the Coach’s favourite breaks the ramp and workload rules and keeps the other three', pr.rules.filter(function (rl) { return !N.satisfied(rl, pr.free); }).map(function (rl) { return rl.id; }).join(',') === 'ramp,workload');
check('the map is finite everywhere in view', (function () { for (var i = 0; i <= 50; i++) for (var j = 0; j <= 50; j++) if (!finite(pr.J([-1 + 15 * i / 50, -1 + 12 * j / 50]))) return false; return true; })());

// ---------------------------------------------------------------- 2. the Physio's set and its projection
var V = pr.poly.verts;
check('the safe set is a polygon with the expected corners', V.length === 5 && V.some(function (q) { return near(q[0], 5, 1e-9) && near(q[1], 5.5, 1e-9); }) && V.some(function (q) { return near(q[0], 2, 1e-9) && near(q[1], 2.8, 1e-9); }), V.map(f3).join(' '));
function stream(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
var rnd = stream(7), probes = [], k; for (k = 0; k < 60; k++) probes.push([-1 + 14 * rnd(), -1 + 12 * rnd()]);
check('every projection lands inside the rules and a safe plan projects to itself', probes.every(function (q) { var z = N.project(pr.poly, pr.rules, q); return N.inside(pr.rules, z, 1e-9) && (!N.inside(pr.rules, q) || N.norm(N.sub(z, q)) < 1e-12); }));
check('no sampled safe plan is closer than the projection (within tolerance)', probes.every(function (q) { var z = N.project(pr.poly, pr.rules, q), dz = N.norm(N.sub(z, q)); for (var m = 0; m < 400; m++) { var s = [-1 + 14 * rnd(), -1 + 12 * rnd()]; if (N.inside(pr.rules, s) && N.norm(N.sub(s, q)) < dz - 1e-9) return false; } return true; }));
check('projection is idempotent', probes.every(function (q) { var z = N.project(pr.poly, pr.rules, q), z2 = N.project(pr.poly, pr.rules, z); return N.norm(N.sub(z, z2)) < 1e-12; }));
check('the Physio’s answer to the Coach’s favourite is the ramp–workload corner, not the best safe session', near(pr.freeZ[0], 5, 1e-9) && near(pr.freeZ[1], 5.5, 1e-9) && N.norm(N.sub(pr.freeZ, pr.best.q)) > 0.3 && pr.J(pr.freeZ) > pr.best.J, f3(pr.freeZ) + ' vs ' + f3(pr.best.q));
check('the best safe session lies on the workload line alone', pr.best.active.join(',') === 'workload' && N.inside(pr.rules, pr.best.q, 1e-9));

// ---------------------------------------------------------------- 3. the Coach's step and the negotiation
var v1 = R[2].v, st = N.coachStep(pr, v1, p.rho);
check('no grid plan beats the Coach’s step for the detailed round’s aim', (function () { var val = st.value, tether = function (q) { var dq = N.sub(q, v1); return pr.J(q) + p.rho / 2 * N.dot(dq, dq); }; for (var i = 0; i <= 240; i++) for (var j = 0; j <= 200; j++) if (tether([12 * i / 240, 10 * j / 200]) < val - 1e-9) return false; return near(tether(st.x), val, 1e-12); })());
check('the load of the Coach’s step is the closed form at its day', near(st.x[1], (pr.r(st.x[0]) - p.r0 + p.rho * v1[1]) / (2 * p.a + p.rho), 1e-12));
check('every round keeps the log identity u = u_prev + x − z and the aim v = z_prev − u_prev', R.slice(1).every(function (r) { var uu = N.add(r.uPrev, N.sub(r.x, r.z)), vv = N.sub(r.zPrev, r.uPrev); return N.norm(N.sub(uu, r.u)) < 1e-12 && N.norm(N.sub(vv, r.v)) < 1e-12; }));
check('every Physio step is the projection of x + u_prev', R.slice(1).every(function (r) { return N.norm(N.sub(r.z, N.project(pr.poly, pr.rules, N.add(r.x, r.uPrev)))) < 1e-12; }));
check('the stored gauges are |x − z| and rho |z − z_prev|', R.slice(1).every(function (r) { return near(r.primal, N.norm(N.sub(r.x, r.z)), 1e-12) && near(r.dual, p.rho * N.norm(N.sub(r.z, r.zPrev)), 1e-12); }));
check('the negotiation stops when both gauges are below the tolerance, and not before', S.converged && fin.primal <= p.tol && fin.dual <= p.tol && R.slice(1, -1).every(function (r) { return r.primal > p.tol || r.dual > p.tol; }), 'round ' + S.stop);
check('the filed plan is the best safe session within the tolerance', N.norm(N.sub(fin.z, pr.best.q)) < 2 * p.tol, N.norm(N.sub(fin.z, pr.best.q)).toFixed(4));
var tight = N.solve(N.copy(pr, { p: N.copy(p, { tol: 1e-6, maxRounds: 5000 }) }));
check('run to a tight tolerance, the negotiation converges to the brute-force best safe session', tight.converged && N.norm(N.sub(tight.plan, pr.best.q)) < 1e-3, N.norm(N.sub(tight.plan, pr.best.q)).toExponential(2));
check('the settled log times rho is normal to the workload line (the rule’s toll)', (function () { var rl = pr.rules.filter(function (r) { return r.id === 'workload'; })[0], n = N.scale(rl.a, 1 / N.norm(rl.a)), m = N.scale(tight.final.u, p.rho), along = Math.abs(N.dot(m, [-n[1], n[0]])); return along < 1e-3 && N.dot(m, n) > 0; })());
check('the Coach’s copy and the Physio’s copy agree at the limit', N.norm(N.sub(tight.final.x, tight.final.z)) < 1e-5);

// ---------------------------------------------------------------- 4. the tether alone
check('with the tether alone the log stays empty and the gap settles but never closes', A.ropeAlone && A.rounds.every(function (r) { return N.norm(r.u) === 0; }) && A.final.primal > 1 && near(A.final.primal, A.rounds[A.rounds.length - 2].primal, 1e-2), A.final.primal.toFixed(3));
check('the tether-alone Physio stands on the workload line but away from the best safe session', N.active(pr.rules, A.final.z, 1e-6).map(function (r) { return r.id; }).join(',') === 'workload' && N.norm(N.sub(A.final.z, pr.best.q)) > 0.05, N.norm(N.sub(A.final.z, pr.best.q)).toFixed(3));

// ---------------------------------------------------------------- 5. the season
var plans = d.season.plans;
check('the season holds two negotiated sessions and then an empty window before the race', plans.length === 3 && !plans[0].empty && !plans[1].empty && plans[2].empty && d.sessions.length === 2, plans.length + ' plans');
check('each session obeys every rule of its own problem', plans.slice(0, 2).every(function (pl) { return N.inside(pl.prob.rules, pl.sol.plan, 1e-9) && pl.sol.converged; }));
check('the second crest is higher than the first because fitness accumulates', plans[1].prob.r(plans[1].prob.crest) > pr.r(pr.crest) + 0.1);
check('the third window is empty because recovery would end after the taper begins', (function () { var rl = plans[2].prob.rules; var rec = rl.filter(function (r) { return r.id === 'recovery'; })[0], tap = rl.filter(function (r) { return r.id === 'taper'; })[0]; return -rec.b > tap.b; })());
check('the second negotiation also reaches its best safe session', N.norm(N.sub(plans[1].sol.plan, plans[1].prob.best.q)) < 2 * p.tol);
check('the first problem’s curve does not change when later sessions join the history', near(pr.r(8), 1 + p.k1 * Math.exp(-8 / p.tau1) - p.k2 * Math.exp(-8 / p.tau2), 1e-12));
check('all recorded diagnostics are finite', R.slice(1).every(function (r) { return finite(r.primal) && finite(r.dual) && finite(r.stepValue); }));
var d2 = N.build();
check('the case is deterministic', d2.sol.stop === S.stop && N.norm(N.sub(d2.sol.plan, S.plan)) < 1e-12);

// ---------------------------------------------------------------- 6. the course in a browser-less drawing sandbox
function sandbox() {
  var elements = {}, noop = function () {};
  function ctx() { var t = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '', imageSmoothingEnabled: true };
    return new Proxy(t, { get: function (o, k) { if (k === 'measureText') return function (q) { return { width: 7 * String(q).length }; }; if (k === 'createImageData') return function (w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; }; if (k === 'createRadialGradient' || k === 'createLinearGradient') return function () { return { addColorStop: noop }; }; if (k in o) return o[k]; if (typeof k === 'string') return noop; return undefined; } }); }
  function element(id) { if (elements[id]) return elements[id]; var e = { id: id, hidden: false, textContent: '', innerHTML: '', disabled: false, width: 0, height: 0, style: {}, offsetTop: 0, offsetHeight: 0, scrollTop: 0, clientHeight: 100, classList: { toggle: noop, add: noop, remove: noop }, setAttribute: function (n, v) { this[n] = String(v); }, getAttribute: function (n) { return this[n] == null ? null : this[n]; }, addEventListener: noop, querySelectorAll: function () { return []; }, querySelector: function () { return element('q-' + Object.keys(elements).length); }, closest: function () { return null; }, getBoundingClientRect: function () { return { width: 720, height: 500, top: 0, left: 0, right: 720, bottom: 500 }; }, scrollIntoView: noop, focus: noop, getContext: function () { return ctx(); } }; return (elements[id] = e); }
  var sb = { console: console, performance: { now: function () { return 0; } }, requestAnimationFrame: function () { return 1; }, cancelAnimationFrame: noop, getComputedStyle: function () { return { fontFamily: 'sans-serif', getPropertyValue: function () { return 'monospace'; } }; },
    document: { body: {}, documentElement: {}, getElementById: element, querySelectorAll: function () { return []; }, addEventListener: noop, createElement: function () { return element('created-' + Object.keys(elements).length); } }, location: { hash: '' }, devicePixelRatio: 1, addEventListener: noop, Proxy: Proxy, Float32Array: Float32Array, Float64Array: Float64Array };
  sb.window = sb; vm.createContext(sb);
  var SIM = path.join(__dirname, '..', 'simulator');
  [[SIM, 'board.js'], [__dirname, 'plan.js'], [__dirname, 'plan_parts.js'], [__dirname, 'plan_course.js']].forEach(function (q) {
    vm.runInContext(fs.readFileSync(path.join(q[0], q[1]), 'utf8'), sb, { filename: q[1] });
    if (q[1] === 'plan.js') sb.Plan.build = function () { return d; };   // the case checked above, not a second copy
  });
  return sb;
}
var sb, course = null, courseError = null;
try { sb = sandbox(); course = sb.course; } catch (e) { courseError = e && e.stack || String(e); }
check('the course builds in the sandbox', !!course, courseError);
if (course) {
  var steps = course.steps, ids = steps.map(function (q) { return q.id; });
  var expected = ['curve', 'benefit', 'rules', 'one', 'coach-role', 'physio-role', 'rope', 'without-ledger', 'ledger-role', 'aim', 'coach', 'physio', 'ledger', 'again', 'ready', 'trained', 'next', 'block', 'bridge', 'differences'];
  check('the course has the intended 20 steps in 5 chapters', steps.length === 20 && course.chapters.length === 5 && ids.join(',') === expected.join(','), steps.length + ' steps, ' + course.chapters.length + ' chapters: ' + ids.join(','));
  var drawn = 0; steps.forEach(function (q, i) { [0, 0.5, 1].forEach(function (pp) { sb.Board.debug({ step: i, p: pp }); drawn++; }); });
  check('every step draws at three moments without an error (' + drawn + ' drawings)', (sb.kingsLandErrors || []).length === 0, (sb.kingsLandErrors || []).slice(0, 3).join(' | '));
  function text(id) { var q = steps[ids.indexOf(id)]; return ((q && q.text || '') + ' ' + (q && q.math || '')).replace(/<[^>]*>/g, ''); }
  check('the story opens with the body’s cycle and the one-session decision before any specialist', ids.indexOf('curve') < ids.indexOf('one') && /dips right after the session/.test(text('curve')) && /Only one session will happen/.test(text('one')) && /two specialists/.test(text('one')));
  check('the Coach and the Physio are met with their two jobs before the tether', ids.indexOf('coach-role') < ids.indexOf('rope') && ids.indexOf('physio-role') < ids.indexOf('rope') && /never looks at the rules/.test(text('coach-role')) && /nearest safe plan/.test(text('physio-role')) && /Safe, but not the best safe session/.test(text('physio-role')));
  check('the tether-alone page says the tether pulls but does not remember, and why that fails the athlete', /tether alone/.test(text('without-ledger')) && /does not remember/.test(text('without-ledger')) && /never name the same session/.test(text('without-ledger')));
  check('the log is defined as disagreement, not fatigue, before the aim uses it', ids.indexOf('ledger-role') < ids.indexOf('aim') && /not fatigue, fitness or training done/.test(text('ledger-role')) && /v₂ = z₁ − u₁/.test(text('aim')));
  check('the round pages come in the ADMM order: aim, Coach, Physio, log', ids.indexOf('aim') < ids.indexOf('coach') && ids.indexOf('coach') < ids.indexOf('physio') && ids.indexOf('physio') < ids.indexOf('ledger'));
  check('the Coach’s step page states the closed-form load and the scan over days', /w\(t\) = \(r\(t\) − r₀ \+ ρ·vw\)\/\(2a \+ ρ\)/.test(text('coach')) && /scanning the days/.test(text('coach')));
  check('the stopping pages name both gauges and refuse to stop on one alone', /primal residual/.test(text('again')) && /dual residual/.test(text('again')) && /Agreement alone is not enough/.test(text('again')) && /Stability alone is not enough/.test(text('again')) && /both gauges are below/.test(text('ready')));
  check('the season names the outer and inner loops and closes with the line to remember', /outer loop/.test(text('trained')) && /inner one/.test(text('trained')) && /The curve tempts, the Physio constrains, the tether coordinates, and the planning log makes every unresolved disagreement return\./.test(text('block')));
  check('the bridge keeps the four moves and names what changes', /four moves are the same/.test(text('bridge')) && /different cost, set, size, and test/.test(text('differences')));
  var source = fs.readFileSync(path.join(__dirname, 'plan_course.js'), 'utf8');
  check('no page disclaims its own teaching', !/not ADMM|not an ADMM|teaching names|counterfactual/.test(source));
}

// ---------------------------------------------------------------- 7. generated standalone freshness
var buildCheck = '';
try { buildCheck = cp.execFileSync('python3', ['-B', path.join(__dirname, 'build_plan.py'), '--check'], { encoding: 'utf8' }); }
catch (e) { buildCheck = String(e.stdout || '') + String(e.stderr || e.message || e); }
check('the standalone HTML is byte-current with its sources', /^ok the_coach_and_the_physio\.html is current/.test(buildCheck.trim()), buildCheck.trim());

console.log(failures ? failures + ' of ' + checks + ' checks FAILED' : 'all ' + checks + ' checks passed');
process.exit(failures ? 1 : 0);
