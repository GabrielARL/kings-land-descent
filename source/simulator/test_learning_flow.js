// Focused regressions for the Apprentice's Trial learning flow.
// Run from anywhere with:
//     node paper/lbgfs_admm_diff_no_math/lbgfs_admm_diff_no_math_assets/simulator/test_learning_flow.js
//
// This deliberately complements test_engine.js: that file checks the numerical
// model, while this one protects the teaching sequence and the small Board API
// used by the compulsory ADMM walkthrough.
'use strict';

var fs = require('fs'), path = require('path'), vm = require('vm');
var dir = __dirname;
var game = fs.readFileSync(path.join(dir, 'game.js'), 'utf8');
var board = fs.readFileSync(path.join(dir, 'board.js'), 'utf8');
var parts = fs.readFileSync(path.join(dir, 'board_parts.js'), 'utf8');
var course = fs.readFileSync(path.join(dir, 'course.js'), 'utf8');
var page = fs.readFileSync(path.join(dir, 'page.html'), 'utf8');
var failures = 0, checks = 0;

function check(what, ok, detail) {
  checks++;
  console.log((ok ? 'ok    ' : 'FAIL  ') + what + (detail == null || detail === '' ? '' : '  [' + detail + ']'));
  if (!ok) failures++;
}
function count(s, re) { var m = s.match(re); return m ? m.length : 0; }
function same(a, b) { return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); }

// Return a source slice from `start` through the matching closing delimiter.
// The source is ES5-style, but this scanner still skips strings and comments so
// a bracket in learner-facing prose cannot end the slice early.
function balancedSlice(src, start, open, close) {
  var at = src.indexOf(open, start), depth = 0, quote = '', line = false, block = false, escaped = false;
  if (at < 0) return '';
  for (var i = at; i < src.length; i++) {
    var c = src[i], n = src[i + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '*' && n === '/') { block = false; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { line = true; i++; continue; }
    if (c === '/' && n === '*') { block = true; i++; continue; }
    if (c === '\'' || c === '"' || c === '`') { quote = c; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return src.slice(at, i + 1);
  }
  return '';
}

// ---------------------------------------------------------------- syntax and Board API
['game.js', 'board.js', 'board_parts.js', 'course.js'].forEach(function (name) {
  var source = name === 'game.js' ? game : name === 'board.js' ? board : name === 'board_parts.js' ? parts : course, ok = true, why = '';
  try { new Function(source); } catch (e) { ok = false; why = e.message; }
  check(name + ' parses as JavaScript', ok, why);
});

// Exercise Board.open({ids}) and the completion result in Node.  Five tiny
// side-panel steps avoid testing canvas artwork; this is a contract test for
// selection order and the compulsory walkthrough gate itself.
function boardRuntime() {
  var elements = {};
  function element(id) {
    if (elements[id]) return elements[id];
    var e = {
      id: id, hidden: false, textContent: '', innerHTML: '', disabled: false,
      width: 0, height: 0, style: {},
      classList: { toggle: function () {}, add: function () {}, remove: function () {} },
      setAttribute: function (name, value) { this[name] = String(value); },
      getAttribute: function (name) { return this[name] == null ? null : this[name]; },
      addEventListener: function () {}, querySelectorAll: function () { return []; },
      getBoundingClientRect: function () { return { width: 640, height: 360, top: 0, left: 0, right: 640, bottom: 360 }; },
      scrollIntoView: function () {}, focus: function () {}
    };
    if (id === 'board-canvas') {
      e.getContext = function () {
        return { globalAlpha: 1, fillStyle: '', setTransform: function () {}, setLineDash: function () {}, fillRect: function () {} };
      };
    }
    return (elements[id] = e);
  }
  var sandbox = {
    console: console, Math: Math, Float64Array: Float64Array,
    performance: { now: function () { return 0; } },
    requestAnimationFrame: function () { return 1; }, cancelAnimationFrame: function () {},
    getComputedStyle: function () { return { fontFamily: 'sans-serif', getPropertyValue: function () { return 'monospace'; } }; },
    document: {
      body: {}, documentElement: {}, getElementById: element,
      querySelectorAll: function () { return []; },
      createElement: function () { return element('created-' + Object.keys(elements).length); }
    },
    window: { devicePixelRatio: 1, addEventListener: function () {} }
  };
  vm.runInNewContext(board + '\nthis.__Board = Board;', sandbox, { filename: 'board.js' });
  var B = sandbox.__Board, ids = ['twins', 'wander', 'warden', 'ledger', 'again'];
  // Replace the normal numerical/drawing parts: this test is about the board
  // controller contract, not a particular terrain's algebra.
  ['quadHeight', 'weather', 'youDown'].forEach(function (name) { B.register(name, function () {}); });
  B.register('where', function (cx, out) {
    ids.forEach(function (id) { out.push({ id: id, chapter: 'test', title: id, text: '', layout: 'side', draw: function () {} }); });
  });
  var land = { kind: 'quad', span: 2, h: 0.01, sigma: 0, J: function () { return 0; }, smooth: function () { return 0; }, grad: function () { return [0, 0]; } };
  var context = { hero: 'you', name: 'you', at: [0, 0], day: 0, felt: null, land: land, L: { view: [-1, 1, -1, 1] }, p: {} };
  var reports = [];
  B.onClose(function (r) { reports.push(r); });
  var requested = ['ledger', 'twins', 'again', 'wander', 'warden'];
  var opened = B.open(context, { ids: requested, title: 'test guide' });
  var selected = B.steps().map(function (s) { return s.id; });
  B.close();
  var incomplete = reports.pop();
  opened = opened && B.open(context, { ids: requested, title: 'test guide' });
  for (var i = 1; i < requested.length; i++) B.go(i);
  B.close();
  var complete = reports.pop();
  return {
    opened: opened, selected: selected, requested: requested,
    incomplete: incomplete, complete: complete,
    rejectsMissing: B.open(context, { ids: ['twins', 'not-a-step'] }) === false
  };
}

try {
  var br = boardRuntime();
  check('Board selects the requested five pages in order', br.opened && same(br.selected, br.requested), br.selected.join(', '));
  check('Board close reports an incomplete guide', br.incomplete && !br.incomplete.completed && br.incomplete.visited === 1 && br.incomplete.count === 5);
  check('Board close reports completion only after all five pages', br.complete && br.complete.completed && br.complete.visited === 5 && br.complete.count === 5);
  check('Board rejects a guide with a missing page ID', br.rejectsMissing);
} catch (e) {
  check('Board selection/completion runtime contract', false, e && e.stack || e);
}

// ---------------------------------------------------------------- Cartographer's day-2 journal page
var cartoAt = course.indexOf("pick(Wc, 'lb', 1"), cartoPick = cartoAt < 0 ? '' : course.slice(cartoAt, cartoAt + 360);
var cartoIds = ['journal', 'read', 'tests', 'stride', 'page-stride', 'page-slopes', 'page-change', 'page-curve', 'newpage'];
check('Cartographer tutorial follows day 2 instead of jumping to day 3',
  /tutorial\s*:\s*true/.test(course) && cartoAt >= 0);
check('Cartographer tutorial creates the page in causal order',
  cartoIds.every(function (id, i) { return cartoPick.indexOf("'" + id + "'") >= 0 && (!i || cartoPick.indexOf("'" + cartoIds[i - 1] + "'") < cartoPick.indexOf("'" + id + "'")); }), cartoIds.join(', '));

var detailIds = ['page-stride', 'page-slopes', 'page-change', 'page-curve'];
check('the overloaded journal explanation is split into four detail pages',
  detailIds.every(function (id, i) { return parts.indexOf("id: '" + id + "'") >= 0 && (!i || parts.indexOf("id: '" + detailIds[i - 1] + "'") < parts.indexOf("id: '" + id + "'")); }), detailIds.join(', '));
check('step length and vector stride are explicitly distinguished',
  /step length[^;]+one number; the stride[^;]+two-coordinate move/.test(parts) &&
  /s' \+ si \+ ' = x' \+ sj \+ ' − x' \+ si \+ ' = t' \+ si \+ 'd'/.test(parts));
check('gradient endpoints and y construction are explicit',
  /g' \+ si \+ ' = ∇J\(x' \+ si/.test(parts) && /y' \+ si \+ ' = g' \+ sj \+ ' − g' \+ si/.test(parts));
check('the denominator is explained as rise over distance travelled',
  parts.indexOf("frac('change in uphill slope along the stride', 'distance travelled')") >= 0 &&
  parts.indexOf("\u2016s' + si + '\u2016² = s'") >= 0);
check('tutorial says L-BFGS stores and reads the complete s and y vectors',
  /stores the complete vectors/.test(parts) && /reads both vectors/.test(parts) && /different denominator/.test(parts));

try {
  var E = require(path.join(dir, 'engine.js')), cp = {}, pk;
  for (pk in E.PRESETS.canyon) cp[pk] = E.PRESETS.canyon[pk];
  var cLand = E.buildLand('canyon', cp), cWalk = E.cartographer(cLand, [cp.sx, cp.sy], Math.round(cp.m), 3), day2 = cWalk[2];
  var s1 = day2.wrote.s, y1 = day2.wrote.y, dx1 = [day2.x[0] - cWalk[1].x[0], day2.x[1] - cWalk[1].x[1]];
  var dg1 = [cLand.grad(day2.x)[0] - day2.g[0], cLand.grad(day2.x)[1] - day2.g[1]];
  function close2(a, b, tol) { return Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol; }
  check('day-2 s1 equals x2 minus x1 and accepted t1 d1',
    day2.wrote.day === 2 && close2(s1, dx1, 1e-12) && close2(s1, [day2.step * day2.d[0], day2.step * day2.d[1]], 1e-12));
  check('day-2 y1 equals g2 minus g1', close2(y1, dg1, 1e-12));
  var q1 = (y1[0] * s1[0] + y1[1] * s1[1]) / (s1[0] * s1[0] + s1[1] * s1[1]);
  check('day-2 rise-over-run quotient is 1.883662645', Math.abs(q1 - 1.8836626451765306) < 1e-12, q1.toFixed(9));

  var wp = {}, wk; for (wk in E.PRESETS.wall) wp[wk] = E.PRESETS.wall[wk];
  var wLand = E.buildLand('wall', wp), wWalk = E.cartographer(wLand, [wp.sx, wp.sy], Math.round(wp.m), 3), wallDay2 = wWalk[2];
  var wallStored = wallDay2.wrote.s, wallPhysical = [wallDay2.x[0] - wWalk[1].x[0], wallDay2.x[1] - wWalk[1].x[1]];
  check('stretched-map journal s is step length times d, not the physical x move',
    close2(wallStored, [wallDay2.step * wallDay2.d[0], wallDay2.step * wallDay2.d[1]], 1e-12) && !close2(wallStored, wallPhysical, 1e-3) &&
    /physical move is not the stored s/.test(parts) && /st \? 'step length, halving to the left'/.test(parts));
} catch (e) {
  check('Cartographer day-2 numerical contract', false, e && e.stack || e);
}

// ---------------------------------------------------------------- compulsory ADMM walkthrough
var guidedLists = [], idsRe = /boardIds\s*:\s*\[([^\]]+)\]/g, idsMatch;
while ((idsMatch = idsRe.exec(game))) guidedLists.push((idsMatch[1].match(/['"]([^'"]+)['"]/g) || []).map(function (s) { return s.slice(1, -1); }));
var expectedIntro = ['twins', 'wanderer-role', 'warden-role'];
var expectedCircuit = ['ledger-role', 'without-ledger', 'aim', 'rope', 'wander', 'warden', 'ledger', 'again'];
check('guided ADMM introduction defines both copies before the ledger',
  guidedLists.length >= 1 && same(guidedLists[0], expectedIntro), guidedLists[0] ? guidedLists[0].join(', ') : 'missing');
check('guided ADMM circuit introduces the ledger before the aim and updates',
  guidedLists.length >= 2 && same(guidedLists[1], expectedCircuit), guidedLists[1] ? guidedLists[1].join(', ') : 'missing');
check('guided ADMM board is a completion gate, not an optional detour',
  /done\s*:\s*function\s*\(b\)\s*\{\s*return\s+stats\.boardCompletions\s*>\s*b\.boardCompletions/.test(game) &&
  /function\s+snapshot\s*\([^)]*\)\s*\{[^}]*boardCompletions\s*:\s*stats\.boardCompletions/.test(game));
var openBoardBody = balancedSlice(game, game.indexOf('function openBoard'), '{', '}');
check('guided board IDs and title reach Board.open',
  /boardIds/.test(openBoardBody) && /boardTitle/.test(openBoardBody) && /Board\.open\s*\(\s*boardContext\(\)\s*,/.test(openBoardBody));
check('only a fully visited guide increments the completion counter',
  /Board\.onClose\s*\(\s*function\s*\([^)]/.test(game) && /\.completed/.test(game) && /boardCompletions\s*\+\+/.test(game));

var lowerParts = parts.toLowerCase();
check('ADMM stopping requires both named residuals',
  lowerParts.indexOf('primal residual') >= 0 && lowerParts.indexOf('dual residual') >= 0 &&
  lowerParts.indexOf('stop only when both') >= 0);
check('ADMM stopping explains agreement plus stopped movement',
  lowerParts.indexOf('agreement alone is not enough') >= 0 && lowerParts.indexOf('stopped moving') >= 0);

var roleIds = ['wanderer-role', 'warden-role', 'ledger-role', 'without-ledger', 'aim'];
check('ADMM concepts are introduced in causal page order',
  roleIds.every(function (id, i) { return parts.indexOf("id: '" + id + "'") >= 0 && (!i || parts.indexOf("id: '" + roleIds[i - 1] + "'") < parts.indexOf("id: '" + id + "'")); }), roleIds.join(', '));
check('game metaphors are distinguished from standard ADMM objects',
  /teaching names, not extra people in the standard equations/.test(parts) &&
  /scaled dual variable u/.test(parts) && /not another copy, person, or final answer/.test(parts) &&
  /firstWallContact/.test(parts) && /lawful copy/.test(parts) && /no gap: u unchanged/.test(parts));
check('aim is derived as the centre of the same quadratic penalty',
  /\|x − z \+ u\|² = \|x − \(z − u\)\|²/.test(parts) && /its centre is v = z − u/.test(parts));
check('ledger-free comparison is clearly marked as not ADMM',
  /counterfactual is not ADMM/.test(parts) && /force u = 0 every circuit/.test(parts));

var admmAt = course.indexOf("pick(Ww, 'tw', 4"), admmPick = admmAt < 0 ? '' : course.slice(admmAt, admmAt + 520);
check('standalone ADMM lesson uses the first nonzero-ledger circuit',
  admmAt >= 0 && /Earlier versions used day 3, where u = 0 and v = z hid the mechanism/.test(course));
check('standalone ADMM lesson follows the expanded causal order',
  expectedIntro.slice(1).concat(expectedCircuit).every(function (id, i, ids) {
    return admmPick.indexOf("'" + id + "'") >= 0 && (!i || admmPick.indexOf("'" + ids[i - 1] + "'") < admmPick.indexOf("'" + id + "'"));
  }), expectedIntro.slice(1).concat(expectedCircuit).join(', '));

try {
  var AE = require(path.join(dir, 'engine.js')), ap = {}, ak;
  for (ak in AE.PRESETS.wall) ap[ak] = AE.PRESETS.wall[ak];
  var aLand = AE.buildLand('wall', ap), aWalk = AE.twins(aLand, [ap.sx, ap.sy], ap.rho, 20);
  var firstWall = aWalk[4], nextAim = aWalk[5];
  function near2(a, b, tol) { return Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol; }
  check('first wall contact creates the first nonzero ledger entry',
    near2(firstWall.uFrom, [0, 0], 1e-12) && near2(firstWall.v, firstWall.zFrom, 1e-12) && Math.hypot(firstWall.u[0], firstWall.u[1]) > 0.04,
    'u4=' + firstWall.u.map(function (q) { return q.toFixed(4); }).join(','));
  check('the next aim visibly subtracts that ledger from the Warden',
    near2(nextAim.uFrom, firstWall.u, 1e-12) && near2(nextAim.v, [nextAim.zFrom[0] - nextAim.uFrom[0], nextAim.zFrom[1] - nextAim.uFrom[1]], 1e-12) &&
    Math.hypot(nextAim.v[0] - nextAim.zFrom[0], nextAim.v[1] - nextAim.zFrom[1]) > 0.04,
    'z4=' + nextAim.zFrom.map(function (q) { return q.toFixed(4); }).join(',') + ' v4=' + nextAim.v.map(function (q) { return q.toFixed(4); }).join(','));
  var nlz = aWalk[0].z.slice(), nlx;
  for (var ai = 0; ai < 10; ai++) { nlx = aLand.wanderer(nlz, ap.rho); nlz = aLand.project(nlx); }
  check('the ledger-free counterfactual is lawful but misses this wall minimum',
    near2(aLand.project(nlz), nlz, 1e-12) && Math.hypot(nlz[0] - aLand.treasure[0], nlz[1] - aLand.treasure[1]) > 0.05 &&
    Math.hypot(aWalk[10].z[0] - aLand.treasure[0], aWalk[10].z[1] - aLand.treasure[1]) < 0.001,
    'without=' + nlz.map(function (q) { return q.toFixed(4); }).join(',') + ' ADMM=' + aWalk[10].z.map(function (q) { return q.toFixed(4); }).join(','));
  check('every worked wall circuit follows the scaled ADMM identities', aWalk.slice(1).every(function (q) {
    return near2(q.v, [q.zFrom[0] - q.uFrom[0], q.zFrom[1] - q.uFrom[1]], 1e-11) &&
      near2(q.z, aLand.project([q.x[0] + q.uFrom[0], q.x[1] + q.uFrom[1]]), 1e-11) &&
      near2(q.u, [q.uFrom[0] + q.x[0] - q.z[0], q.uFrom[1] + q.x[1] - q.z[1]], 1e-11);
  }));
} catch (e) {
  check('expanded ADMM numerical teaching contract', false, e && e.stack || e);
}

// ---------------------------------------------------------------- Old Fort bridge and misty-hills synthesis
check('Old Fort-to-CAJODE is its own guided lesson',
  game.indexOf('The Old Fort and CAJODE') >= 0 && /goLand\s*\(\s*['"]fort['"]\s*\)/.test(game) &&
  /bridge to CAJODE, not a simulation of the full receiver/i.test(game));
check('CAJODE bridge maps shared bits, replicas, checks, duals and channel update',
  /shared variable/.test(game) && /replica variables/.test(game) && /parity polytope/.test(game) &&
  /scaled dual variable/.test(game) && /updates all channel coefficients/.test(game));
check('receiver acceptance is not presented as continuous convergence',
  /pass every parity check and the CRC even while continuous residuals remain nonzero/.test(game) &&
  /do not prove continuous convergence or stationarity/.test(game));

var stepsAt = game.indexOf('var STEPS = ['), steps = balancedSlice(game, stepsAt, '[', ']');
check('guided trial no longer requires finding the misty treasure',
  steps.length > 0 && !/return\s+found\b/.test(steps) && /treasure hunt remains open in free exploration/.test(steps));
check('misty lesson ends with a diagnosis check',
  /ripples create extra hollows; haze changes measurements; a narrow pit gives no clue until it is sampled/i.test(steps));

// Quiz data without UI wiring strands the learner, so protect both halves.
check('all three concept checks have working quiz UI hooks',
  count(steps, /quiz\s*:/g) === 3 && /id=["']quest-answers["']/.test(page) &&
  /quest-answers/.test(game) && /\.quiz\.correct|quiz\.correct/.test(game));

// ---------------------------------------------------------------- coherent resume
var lessonStartBody = balancedSlice(game, game.indexOf('function lessonStart'), '{', '}');
var resumeBody = balancedSlice(game, game.indexOf('function resumeTrial'), '{', '}');
check('resume bookmark is rewound to the lesson start',
  /STEPS\[i\s*-\s*1\]\.lesson\s*===\s*lesson/.test(lessonStartBody) &&
  /resumeAt\s*=\s*lessonStart\s*\(\s*s\.step\s*\)/.test(game));
check('resume rebuilds a coherent world before restarting the lesson',
  /var\s+start\s*=\s*lessonStart\s*\(i\)/.test(resumeBody) && /api\.restart\s*\(\s*\)/.test(resumeBody) &&
  /ride\s*=\s*null/.test(resumeBody) && /startTrial\s*\(\s*start\s*\)/.test(resumeBody));

console.log(failures ? failures + ' of ' + checks + ' check(s) failed' : 'all ' + checks + ' learning-flow checks passed');
process.exit(failures ? 1 : 0);
