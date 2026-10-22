// Engine, course and generated-artifact checks for "Localization through a decoder's lens".
// Run from any directory with Node 12 or later:
//     node paper/localization_decoding/test_dive.js
var D = require('./inspect.js'), fs = require('fs'), path = require('path'), vm = require('vm'), child = require('child_process');
var failures = 0, checks = 0;
function check(what, ok, detail) {
  checks++; console.log((ok ? 'ok    ' : 'FAIL  ') + what + (detail !== undefined ? '  [' + detail + ']' : ''));
  if (!ok) failures++;
}
function close(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-9 : tol); }
function finite(x) { return typeof x === 'number' && isFinite(x); }
function pointClose(a, b, tol) { return close(a[0], b[0], tol) && close(a[1], b[1], tol); }
function angleGap(a, b) { return Math.abs(D.wrap(a - b + 180) - 180); }
function countOf(haystack, needle) { return haystack.split(needle).length - 1; }

var d = D.build(), p = d.p, s = d.solution, last = s.final;

// ---------------------------------------------------------------- 1. Seeded data and its stated meaning
var d2 = D.build();
check('the default dive is deterministic', JSON.stringify(d.ranges) === JSON.stringify(d2.ranges) &&
  JSON.stringify(d.odo) === JSON.stringify(d2.odo) && close(d.solution.final.cost, d2.solution.final.cost));
var wrong = d.photoOnly.map(function (q, t) { return d.errPhoto.each[t] > 0.5 ? t : null; }).filter(function (t) { return t != null; });
check('photo-only tags are wrong at photos 4, 5 and 6', wrong.join(',') === '4,5,6', wrong.join(','));
check('the wrong photo-only tags are quarter-turn aliases', wrong.every(function (t) { return Math.abs(angleGap(D.heading(d.photoOnly[t]), d.theta[t]) - 90) < 2; }));
check('photo 4 has the four expected nearly equal minima', d.candidates[4].map(function (q) { return q.deg; }).join(',') === '40,130,220,310' &&
  Math.max.apply(null, d.candidates[4].map(function (q) { return q.cost; })) - Math.min.apply(null, d.candidates[4].map(function (q) { return q.cost; })) < 1e-6);
check('the tag photo has one decisively cheaper minimum', d.tagCandidates[0].deg === p.tagAt && d.tagCandidates[1].cost - d.tagCandidates[0].cost > 50,
  (d.tagCandidates[1].cost - d.tagCandidates[0].cost).toFixed(2));
check('ranges answered at photos 0, 1, 4 and 6', d.ranges.map(function (q) { return q.t; }).join(',') === '0,1,4,6');
check('hidden truth belongs to every configured allowed set', s.facts.every(function (f) {
  return D.factExcess(f, f.at.map(function (t) { return d.truth[t]; }), d.beacon) <= 1e-10;
}));
var range4 = d.ranges.filter(function (q) { return q.t === 4; })[0];
var allowedCandidates = d.candidates[4].filter(function (q) {
  return Math.abs(D.norm(D.sub(D.onCircle(q.deg, d.rho), d.beacon)) - range4.r) <= p.rangeTol + 1e-12;
});
check('only the 130-degree photo-4 candidate lies in its range band', allowedCandidates.length === 1 && allowedCandidates[0].deg === 130,
  allowedCandidates.map(function (q) { return q.deg; }).join(','));

// ---------------------------------------------------------------- 2. Deterministic projections into allowed sets
var standoff = { kind: 'standoff', at: [0], r: 5, tol: 0.2 };
var low = D.project(standoff, [[4, 0]], d.beacon)[0], inside = D.project(standoff, [[5.1, 0]], d.beacon)[0], high = D.project(standoff, [[6, 0]], d.beacon)[0];
check('radial projection clips a point below the band to its inner edge', close(D.norm(low), 4.8));
check('radial projection leaves a point inside the band unchanged', pointClose(inside, [5.1, 0]));
check('radial projection clips a point above the band to its outer edge', close(D.norm(high), 5.2));
var centre = D.project(standoff, [[0, 0]], d.beacon)[0];
check('radial projection has a deterministic finite centre case', pointClose(centre, [4.8, 0]) && centre.every(finite));
var rangeFact = { kind: 'range', at: [0], r: 3, tol: 0.25 }, rangeProj = D.project(rangeFact, [[10, 6]], d.beacon)[0];
check('range-band projection is measured from the beacon', close(D.norm(D.sub(rangeProj, d.beacon)), 2.75));
var odoFact = { kind: 'odometry', at: [0, 1], d: [1, 0], tol: 0.2 }, odoPts = [[0, 0], [2, 1]], odoProj = D.project(odoFact, odoPts, d.beacon);
check('outside odometry pair reaches the displacement-error boundary', close(D.factExcess(odoFact, odoProj, d.beacon), 0, 1e-10) &&
  close(D.norm(D.sub(D.sub(odoProj[1], odoProj[0]), odoFact.d)), odoFact.tol, 1e-10));
check('odometry projection preserves the pair midpoint', pointClose(D.add(odoProj[0], odoProj[1]), D.add(odoPts[0], odoPts[1]), 1e-10));
var odoInside = [[0, 0], [1.1, 0.05]], odoInsideProj = D.project(odoFact, odoInside, d.beacon);
check('odometry projection leaves an allowed pair unchanged', pointClose(odoInside[0], odoInsideProj[0]) && pointClose(odoInside[1], odoInsideProj[1]));
var projectionCases = [[standoff, [[4, 0]]], [standoff, [[5.1, 0]]], [rangeFact, [[10, 6]]], [odoFact, odoPts], [odoFact, odoInside]];
check('all projection cases are idempotent', projectionCases.every(function (q) {
  var once = D.project(q[0], q[1], d.beacon), twice = D.project(q[0], once, d.beacon);
  return once.every(function (x, i) { return pointClose(x, twice[i], 1e-10); });
}));

// ---------------------------------------------------------------- 3. The sampled-and-polished fit
var aims = s.iterations[1].aims[4], ft = D.fit(d.costs[4], aims, p.rhoAdmm), curve = D.fitCurve(d.costs[4], aims, p.rhoAdmm);
var gridIndex = 0; for (var gi = 1; gi < curve.total.length; gi++) if (curve.total[gi] < curve.total[gridIndex]) gridIndex = gi;
check('fit records the lowest of all 720 heading samples', ft.gridPhi === gridIndex / 2 && close(ft.gridValue, curve.total[gridIndex], 1e-9), ft.gridPhi + ' degrees');
check('local polishing never raises the best sampled objective', ft.value <= ft.gridValue + 1e-9, ft.value + ' <= ' + ft.gridValue);
check('the polished heading stays inside the winning half-degree neighbourhood', angleGap(ft.phi, ft.gridPhi) <= 0.500001, ft.gridPhi + ' -> ' + ft.phi);
function frozenObjective(c, aa, x) {
  var value = D.costAt(c, D.heading(x));
  aa.forEach(function (a) { var dx = x[0] - a[0], dy = x[1] - a[1]; value += p.rhoAdmm / 2 * (dx * dx + dy * dy); });
  return value;
}
check('fit metadata matches the returned point objective', close(ft.value, frozenObjective(d.costs[4], aims, ft.x), 1e-7));
var everyFitDescends = true;
for (var k = 1; k < s.iterations.length && everyFitDescends; k++) {
  var rec = s.iterations[k], prev = s.iterations[k - 1];
  for (var tt = 0; tt < p.T; tt++) if (rec.fits[tt].value > frozenObjective(d.costs[tt], rec.aims[tt], prev.x[tt]) + 1e-7) everyFitDescends = false;
}
check('every stored fit step lowers its frozen local objective', everyFitDescends);

// ---------------------------------------------------------------- 4. Consensus residuals, thresholds and acceptance
check('the split has 17 local sets and 23 position occurrences', s.facts.length === 17 && s.occurrences === 23, s.facts.length + ', ' + s.occurrences);
check('every local replica lies in its own allowed set at every round', s.iterations.every(function (rec) {
  return s.facts.every(function (f, i) { return D.factExcess(f, rec.z[i], d.beacon) <= 1e-9; });
}));
function primal(rec) {
  var sum = 0; s.facts.forEach(function (f, i) { f.at.forEach(function (ti, j) { var e = D.sub(rec.x[ti], rec.z[i][j]); sum += e[0] * e[0] + e[1] * e[1]; }); });
  return Math.sqrt(sum);
}
check('stored primal residuals recompute from x and z', s.iterations.every(function (rec) { return close(rec.primal, primal(rec), 1e-10); }));
function dualAt(k) {
  var acc = []; for (var i = 0; i < p.T; i++) acc.push([0, 0]);
  s.facts.forEach(function (f, fi) { f.at.forEach(function (ti, j) { acc[ti] = D.add(acc[ti], D.sub(s.iterations[k].z[fi][j], s.iterations[k - 1].z[fi][j])); }); });
  return p.rhoAdmm * Math.sqrt(acc.reduce(function (sum, q) { return sum + q[0] * q[0] + q[1] * q[1]; }, 0));
}
var dualsAgree = s.iterations[0].dual === null;
for (k = 1; k < s.iterations.length; k++) dualsAgree = dualsAgree && close(s.iterations[k].dual, dualAt(k), 1e-9);
check('stored dual residuals recompute from successive replicas', dualsAgree);
function thresholds(rec) {
  var nx = 0, nz = 0, acc = []; for (var i = 0; i < p.T; i++) acc.push([0, 0]);
  s.facts.forEach(function (f, fi) { f.at.forEach(function (ti, j) {
    nx += rec.x[ti][0] * rec.x[ti][0] + rec.x[ti][1] * rec.x[ti][1];
    nz += rec.z[fi][j][0] * rec.z[fi][j][0] + rec.z[fi][j][1] * rec.z[fi][j][1];
    acc[ti] = D.add(acc[ti], rec.u[fi][j]);
  }); });
  var ndual = Math.sqrt(acc.reduce(function (sum, q) { return sum + q[0] * q[0] + q[1] * q[1]; }, 0));
  return { pri: Math.sqrt(2 * s.occurrences) * p.epsAbs + p.epsRel * Math.max(Math.sqrt(nx), Math.sqrt(nz)),
    dual: Math.sqrt(2 * p.T) * p.epsAbs + p.epsRel * p.rhoAdmm * ndual };
}
check('absolute-plus-relative residual thresholds recompute independently', s.iterations.every(function (rec) {
  var e = thresholds(rec); return close(rec.epsPri, e.pri, 1e-10) && close(rec.epsDual, e.dual, 1e-10);
}));
check('all recorded numerical diagnostics are finite', s.iterations.every(function (rec, k) {
  return finite(rec.primal) && (k === 0 ? rec.dual === null : finite(rec.dual)) && finite(rec.epsPri) && finite(rec.epsDual) && finite(rec.excess) && finite(rec.cost);
}));
var firstAllowed = s.iterations.findIndex(function (rec) { return rec.excess <= p.feasTol; });
check('physical admissibility is a separate gate at round 69', firstAllowed === 69 && s.admissibleAt === firstAllowed, firstAllowed);
var firstAll = s.iterations.findIndex(function (rec, k) { return k > 0 && rec.excess <= p.feasTol && rec.primal <= rec.epsPri && rec.dual <= rec.epsDual; });
check('all three acceptance tests first pass at round 96', firstAll === 96 && s.convergedAt === firstAll, firstAll);
check('the final iterate passes physical, primal and dual tests independently', last.excess <= p.feasTol && last.primal <= last.epsPri && last.dual <= last.epsDual,
  [last.excess, last.primal + '/' + last.epsPri, last.dual + '/' + last.epsDual].join(', '));
check('solver status reports why it stopped', s.converged && s.stopReason === 'admissible and both residual tests passed' && s.iterations.length - 1 < p.maxIt, s.stopReason);
var short = D.build({ maxIt: 1 }).solution;
check('a one-round budget reports maximum iterations, not convergence', !short.converged && short.stopReason === 'maximum iterations reached' && short.iterations.length === 2);
check('the seeded result stays within five centimetres of hidden truth', d.errSolved.max < 0.05, d.errSolved.max);
check('constraints trade a small image-cost increase for a coherent path', last.cost > s.iterations[0].cost && last.cost - s.iterations[0].cost < 5,
  s.iterations[0].cost.toFixed(3) + ' -> ' + last.cost.toFixed(3));

// ---------------------------------------------------------------- 5. Course construction and responsive drawing
function sandbox(width, height) {
  var elements = {}, noop = function () {};
  function ctx() {
    var state = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '' };
    return new Proxy(state, { get: function (o, key) {
      if (key === 'measureText') return function (q) { return { width: 7 * String(q).length }; };
      if (key === 'createImageData') return function (w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; };
      if (key === 'createRadialGradient' || key === 'createLinearGradient') return function () { return { addColorStop: noop }; };
      if (key in o) return o[key]; if (typeof key === 'string') return noop; return undefined;
    } });
  }
  function element(id) {
    if (elements[id]) return elements[id];
    var e = { id: id, hidden: false, textContent: '', innerHTML: '', disabled: false, width: 0, height: 0, style: {}, offsetTop: 0, offsetHeight: 0, scrollTop: 0, clientHeight: height,
      classList: { toggle: noop, add: noop, remove: noop }, setAttribute: function (n, v) { this[n] = String(v); }, getAttribute: function (n) { return this[n] == null ? null : this[n]; },
      addEventListener: noop, querySelectorAll: function () { return []; }, querySelector: function () { return element('q-' + Object.keys(elements).length); }, closest: function () { return null; },
      getBoundingClientRect: function () { return { width: width, height: height, top: 0, left: 0, right: width, bottom: height }; }, scrollIntoView: noop, focus: noop, getContext: function () { return ctx(); } };
    return (elements[id] = e);
  }
  var box = { console: console, performance: { now: function () { return 0; } }, requestAnimationFrame: function () { return 1; }, cancelAnimationFrame: noop,
    getComputedStyle: function () { return { fontFamily: 'sans-serif', getPropertyValue: function () { return 'monospace'; } }; },
    document: { body: {}, documentElement: {}, getElementById: element, querySelectorAll: function () { return []; }, addEventListener: noop, createElement: function () { return element('created-' + Object.keys(elements).length); } },
    location: { hash: '' }, devicePixelRatio: 1, addEventListener: noop, Proxy: Proxy };
  box.window = box; vm.createContext(box);
  var simulator = path.join(__dirname, '..', 'simulator');
  [[simulator, 'board.js'], [__dirname, 'inspect.js'], [__dirname, 'dive_parts.js'], [__dirname, 'dive_course.js']].forEach(function (q) {
    vm.runInContext(fs.readFileSync(path.join(q[0], q[1]), 'utf8'), box, { filename: q[1] });
  });
  return box;
}
var desktop, course = null, courseError = null;
try { desktop = sandbox(960, 660); course = desktop.course; } catch (e) { courseError = e && e.stack || String(e); }
check('the course builds in a browser-less sandbox', !!course, courseError);
if (course) {
  var expectedIds = 'job,sensors,model,photo,match,tagphoto,readings,allowed,impostors,analogy,program,copies,symbols,fit,project,ledger,run,result,evidence,shared_structure,cajode_adds,cajode_doorway,learned,end';
  var steps = course.steps, ids = steps.map(function (q) { return q.id; });
  check('the course has the intended 24-step learning sequence', ids.join(',') === expectedIds, ids.join(','));
  check('the 24 steps form 9 chapters', steps.length === 24 && course.chapters.length === 9,
    steps.length + ' steps, ' + course.chapters.length + ' chapters');
  check('every page ID is unique', new Set(ids).size === ids.length);
  check('every page has finite timing, prose, mathematics and a drawing', steps.every(function (q) {
    return finite(q.dur) && q.dur > 0 && typeof q.text === 'string' && typeof q.math === 'string' && typeof q.draw === 'function' && !/\b(?:NaN|undefined|Infinity)\b/.test(q.text + ' ' + q.math);
  }));
  var drawn = 0; steps.forEach(function (q, i) { [0, 0.25, 0.5, 0.75, 1].forEach(function (pp) { desktop.Board.debug({ step: i, p: pp }); drawn++; }); });
  check('all pages draw at five desktop moments without error', (desktop.kingsLandErrors || []).length === 0 && drawn === 120, (desktop.kingsLandErrors || []).slice(0, 3).join(' | '));
  var mobile = null, mobileError = null;
  try { mobile = sandbox(420, 740); mobile.course.steps.forEach(function (q, i) { mobile.Board.debug({ step: i, p: 1 }); }); } catch (e) { mobileError = e && e.stack || String(e); }
  check('all pages draw at mobile size without error', !!mobile && (mobile.kingsLandErrors || []).length === 0, mobileError || (mobile && mobile.kingsLandErrors || []).slice(0, 3).join(' | '));
  function stepText(id) { var q = steps[ids.indexOf(id)]; return q.title + ' ' + q.text + ' ' + q.math; }
  check('x, z, u and derived v are introduced before the fit equation', ids.indexOf('symbols') < ids.indexOf('fit') && /stored/.test(stepText('symbols')) && /v = z − u/.test(stepText('symbols')));
  check('dynamic pages quote the actual allowances, rounds, costs and errors', stepText('allowed').indexOf((100 * p.standoffTol).toFixed(0) + ' cm') >= 0 &&
    stepText('allowed').indexOf((100 * p.rangeTol).toFixed(0) + ' cm') >= 0 && stepText('fit').indexOf(String(p.rhoAdmm)) >= 0 && stepText('fit').indexOf('720') >= 0 &&
    stepText('run').indexOf(String(s.admissibleAt)) >= 0 && stepText('run').indexOf(String(s.convergedAt)) >= 0 &&
    stepText('result').indexOf(s.iterations[0].cost.toFixed(1)) >= 0 && stepText('result').indexOf(last.cost.toFixed(1)) >= 0 &&
    stepText('result').indexOf(d.errSolved.max.toFixed(3)) >= 0);
  var readerText = steps.map(function (q) { return q.title + ' ' + q.text + ' ' + q.math; }).join('\n');
  var required = ['negative log-likelihood', 'ADMM penalty parameter', 'primal residual', 'dual residual', 'parity polytope', 'known unit channel', 'CRC', 'does not prove'];
  check('the course contains every required technical boundary', required.every(function (q) { return readerText.indexOf(q) >= 0; }), required.filter(function (q) { return readerText.indexOf(q) < 0; }).join(', '));
  var banned = ['same relaxation', 'the same solver', 'log-likelihood ratio of a bit', 'proof of optimality', 'lower photo cost than any impostor', 'needs nothing new', 'falls round by round'];
  check('the retired overclaims are absent', banned.every(function (q) { return readerText.toLowerCase().indexOf(q) < 0; }), banned.filter(function (q) { return readerText.toLowerCase().indexOf(q) >= 0; }).join(', '));
  check('the result states the image-cost trade in the correct direction', /slightly higher/.test(stepText('result')) && last.cost > s.iterations[0].cost);
  check('the evidence page separates convergence from global and field claims', /NOT ESTABLISHED/.test(stepText('evidence')) || /not a global-optimality certificate/.test(stepText('evidence')));
}

// ---------------------------------------------------------------- 6. Generated standalone page is current and self-contained
var buildOutput = '', buildOkay = true;
try { buildOutput = child.execFileSync('python3', ['-B', path.join(__dirname, 'build_dive.py'), '--check'], { encoding: 'utf8' }).trim(); }
catch (e) { buildOkay = false; buildOutput = String(e.stdout || '') + String(e.stderr || '') + String(e.message || e); }
check('build_dive.py --check confirms the standalone page is current', buildOkay, buildOutput);
var htmlPath = path.join(__dirname, '..', '..', 'localization_is_decoding.html'), html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';
check('the generated page has no external script tags', html.length > 0 && !/<script\s+src=/i.test(html));
var simulator = path.join(__dirname, '..', 'simulator');
var embedded = [[simulator, 'board.js'], [__dirname, 'inspect.js'], [__dirname, 'dive_parts.js'], [__dirname, 'dive_course.js']].every(function (q) {
  return countOf(html, fs.readFileSync(path.join(q[0], q[1]), 'utf8')) === 1;
});
check('the generated page embeds each current source script exactly once', embedded);

console.log(failures ? failures + ' of ' + checks + ' checks FAILED' : 'all ' + checks + ' checks passed');
process.exit(failures ? 1 : 0);
