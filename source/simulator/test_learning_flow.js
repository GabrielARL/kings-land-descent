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

// Build the actual tutorial player around a proxy canvas.  Numerical checks
// below protect the lesson's claims; this sandbox also catches drawing errors
// in the new pages at the two aspect ratios used by the public player.
function courseSandbox(width, height) {
  var elements = {}, noop = function () {};
  function context2d() {
    var state = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '' };
    return new Proxy(state, { get: function (o, key) {
      if (key === 'measureText') return function (q) { return { width: 7 * String(q).length }; };
      if (key === 'createImageData') return function (w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; };
      if (key === 'createRadialGradient' || key === 'createLinearGradient') return function () { return { addColorStop: noop }; };
      if (key in o) return o[key];
      return typeof key === 'string' ? noop : undefined;
    } });
  }
  function element(id) {
    if (elements[id]) return elements[id];
    var e = {
      id: id, hidden: false, textContent: '', innerHTML: '', disabled: false, width: 0, height: 0, style: {},
      offsetTop: 0, offsetHeight: 0, scrollTop: 0, clientHeight: height,
      classList: { toggle: noop, add: noop, remove: noop },
      setAttribute: function (name, value) { this[name] = String(value); },
      getAttribute: function (name) { return this[name] == null ? null : this[name]; },
      addEventListener: noop, querySelectorAll: function () { return []; },
      querySelector: function () { return element('q-' + Object.keys(elements).length); },
      closest: function () { return null; }, scrollIntoView: noop, focus: noop,
      getBoundingClientRect: function () { return { width: width, height: height, top: 0, left: 0, right: width, bottom: height }; },
      getContext: function () { return context2d(); }
    };
    return (elements[id] = e);
  }
  var box = {
    console: console, Math: Math, Float64Array: Float64Array, Uint8ClampedArray: Uint8ClampedArray, Proxy: Proxy,
    performance: { now: function () { return 0; } }, requestAnimationFrame: function () { return 1; }, cancelAnimationFrame: noop,
    getComputedStyle: function () { return { fontFamily: 'sans-serif', getPropertyValue: function () { return 'monospace'; } }; },
    document: {
      body: {}, documentElement: {}, getElementById: element, querySelectorAll: function () { return []; },
      addEventListener: noop, createElement: function () { return element('created-' + Object.keys(elements).length); }
    },
    location: { hash: '' }, devicePixelRatio: 1, addEventListener: noop
  };
  box.window = box; vm.createContext(box);
  ['engine.js', 'board.js', 'board_parts.js', 'course.js'].forEach(function (name) {
    vm.runInContext(fs.readFileSync(path.join(dir, name), 'utf8'), box, { filename: name });
  });
  return box;
}

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
check('tutorial says L-BFGS stores and reads the complete vectors and bounds its race claim',
  /stores the complete vectors/.test(parts) && /reads both vectors/.test(parts) && /different denominator/.test(parts) &&
  /Fastest on this smooth canyon/.test(course) && !/Fastest on smooth land/.test(course));

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
// the tutorial meets the Warden in three pages: who it is, its own problem for c, and why nearest is not lowest
var expectedCourseIntro = ['wanderer-role', 'warden-role', 'warden-steps', 'warden-not-lowest'];
var expectedCircuit = ['rope', 'without-ledger', 'ledger-role', 'aim', 'wander', 'wander-balance', 'warden', 'ledger', 'again'];
// the tutorial adds day-by-day pages: the first three days with the rope alone, and three days with the book after the detailed circuit
var expectedCourseCircuit = ['rope', 'rope-day-1', 'rope-day-2', 'rope-day-3', 'without-ledger', 'ledger-role', 'aim', 'wander', 'wander-balance', 'warden', 'ledger',
  'book-day-1', 'book-day-2', 'book-day-3', 'again'];
check('guided ADMM introduction defines both copies before the ledger',
  guidedLists.length >= 1 && same(guidedLists[0], expectedIntro), guidedLists[0] ? guidedLists[0].join(', ') : 'missing');
check('guided ADMM circuit shows the rope fail before the book, then the aim and the updates',
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
check('ADMM stopping explains agreement plus stopped movement and names the scaled move',
  lowerParts.indexOf('agreement alone is not enough') >= 0 && lowerParts.indexOf('stopped moving') >= 0 &&
  /ρ times the Warden’s move/.test(course));

var roleIds = ['wanderer-role', 'warden-role', 'rope', 'without-ledger', 'ledger-role', 'aim'];
check('ADMM concepts are introduced in causal page order',
  roleIds.every(function (id, i) { return parts.indexOf("id: '" + id + "'") >= 0 && (!i || parts.indexOf("id: '" + roleIds[i - 1] + "'") < parts.indexOf("id: '" + id + "'")); }), roleIds.join(', '));
check('the Twins are introduced by the King’s request and their two jobs before any mechanism',
  /one spot to dig/.test(parts) && /never looks at the law/.test(parts) && /nearest lawful spot/.test(parts) &&
  /keeps a book/.test(parts) && /scaled dual variable u/.test(parts) &&
  /firstWallContact/.test(parts) && /no gap: the book is unchanged/.test(parts));
check('aim is derived as the centre of the same quadratic penalty',
  /\|x − z \+ u\|² = \|x − \(z − u\)\|²/.test(parts) && /its centre is v = z − u/.test(parts));
check('the rope-alone comparison says the rope pulls but does not remember',
  /rope alone/.test(parts) && /does not remember/.test(parts) && /counterfactual, not ADMM/.test(parts) &&
  /with the book \(next\)/.test(parts));

var admmAt = course.indexOf("pick(Ww, 'tw', 4"), admmPick = admmAt < 0 ? '' : course.slice(admmAt, admmAt + 520);
check('standalone ADMM lesson uses the first nonzero-ledger circuit',
  admmAt >= 0 && /Earlier versions used day 3, where u = 0 and v = z hid the mechanism/.test(course));
check('standalone ADMM lesson follows the expanded causal order',
  expectedCourseIntro.concat(expectedCourseCircuit).every(function (id, i, ids) {
    return admmPick.indexOf("'" + id + "'") >= 0 && (!i || admmPick.indexOf("'" + ids[i - 1] + "'") < admmPick.indexOf("'" + id + "'"));
  }), expectedCourseIntro.concat(expectedCourseCircuit).join(', '));

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

// ---------------------------------------------------------------- self-checking light board, CAJODE bridge and misty-hills synthesis
var lightPages = [
  ['light-patterns', 'Four patterns, two pass'],
  ['light-picture', 'Build a self-checking picture'],
  ['light-shared', 'One lamp belongs to two checks'],
  ['light-single-error', 'One glitch is easy'],
  ['light-uncertain', 'Several glows are uncertain'],
  ['light-replicas', 'One check keeps one replica'],
  ['light-polytope', 'Inside the cube: the even-parity polytope'],
  ['light-corrections', 'One lamp receives two corrections'],
  ['light-rounds', 'Run all checks together'],
  ['light-ldpc', 'From the light board to an LDPC graph']
];
check('the ten light-board pages appear in exact order', lightPages.every(function (page, i) {
  var here = course.indexOf("id: '" + page[0] + "'"), title = course.indexOf("title: '" + page[1] + "'", here);
  var previous = i ? course.indexOf("id: '" + lightPages[i - 1][0] + "'") : -1;
  return here > previous && title > here;
}), lightPages.map(function (p) { return p[0]; }).join(', '));
check('the board construction states its exact parity structure',
  /3 row checks \+ 3 column checks/.test(course) && /Six checks are visible, although only five are independent/.test(course) &&
  /one physical decision participates in one row check and one column check/.test(course));
check('single-error localization is explicitly limited to its assumption',
  /only because we assumed exactly one hard decision was wrong/.test(course) && /one-error assumption/.test(course));
check('received glow and channel LLR are kept distinct',
  /measures a brightness yᵢ; a channel model turns that observation into a channel LLR/.test(course) &&
  /log\[p\(yᵢ\|0\)\/p\(yᵢ\|1\)\]/.test(course) && /negative favours 1/.test(course));
check('the polytope page defines the hull as every mixture and says why it is convex',
  /every mixture of the four passing corners/.test(course) && /This set of all mixtures is the convex hull of the four corners/.test(course) && /It is convex: the straight segment between any two of its points stays inside it/.test(course) &&
  /again a mixture of the same four corners/.test(course) && /sliced off by one flat cut/.test(course));
// the legend's two mixtures A and B, and the white dot between them: its blended weights stay ≥ 0, add to 1 and give its place
(function () {
  var names = ['000', '011', '101', '110'], C3 = { '000': [0, 0, 0], '011': [0, 1, 1], '101': [1, 0, 1], '110': [1, 1, 0] };
  var WA = [0, 0.5, 0, 0.5], WB = [0.7, 0, 0.3, 0], PA = [0.5, 1, 0.5], PB = [0.3, 0, 0.3], ok = true;
  function placeOf(w) { return [0, 1, 2].map(function (i) { return names.reduce(function (sum, nm, k) { return sum + w[k] * C3[nm][i]; }, 0); }); }
  for (var it = 0; it <= 20; it++) {
    var t = it / 20, w = WA.map(function (a, k) { return (1 - t) * a + t * WB[k]; }), pt = placeOf(w);
    ok = ok && w.every(function (q) { return q >= 0; }) && Math.abs(w[0] + w[1] + w[2] + w[3] - 1) < 1e-12 &&
      pt.every(function (q, i) { return Math.abs(q - ((1 - t) * PA[i] + t * PB[i])) < 1e-12; });
  }
  check('the white dot between A and B is a mixture at every point: weights at least 0, sum 1, and the right place',
    ok && /A = ½·011 \+ ½·110 = \(0\.5, 1, 0\.5\)/.test(course) && /B = 0\.7·000 \+ 0\.3·101 = \(0\.3, 0, 0\.3\)/.test(course) &&
    /WA = \[0, 0\.5, 0, 0\.5\], WB = \[0\.7, 0, 0\.3, 0\]/.test(course) && /Watch the white dot slide from A to B/.test(course) && /a second reason it is convex/.test(course));
})();
check('replicas are vectors, projections may be fractional and duals live on edges',
  /replica vector z<sub>R2<\/sub>/.test(course) && /projection may be fractional/.test(course) &&
  /Each check-bit edge has its own replica coordinate/.test(course) && /all 18 edge duals/.test(course));
check('product-code example is bounded before the LDPC generalization',
  /small regular product code/.test(course) && /LDPC code uses a much larger sparse graph/.test(course) &&
  /same ADMM bookkeeping remains/.test(course));
check('light-board-to-CAJODE is its own guided lesson',
  game.indexOf('The light board and CAJODE') >= 0 && /goLand\s*\(\s*['"]fort['"]\s*\)/.test(game) &&
  /bridge to the light board, not a simulation of the full receiver/i.test(game));
check('CAJODE bridge maps shared bits, replicas, checks, duals and channel update',
  /shared variable/.test(game) && /replica variables/.test(game) && /parity polytope/.test(game) &&
  /scaled dual variable/.test(game) && /updates all channel coefficients/.test(game));
check('receiver acceptance is not presented as continuous convergence',
  /pass every parity check and the CRC even while continuous residuals remain nonzero/.test(game) &&
  /do not prove continuous convergence or stationarity/.test(game) &&
  /zero syndrome is therefore not the same event as ADMM convergence/.test(course));

try {
  var lm0 = course.indexOf('var LIGHT_CHECKS'), lm1 = course.indexOf('\n\n  function lamp', lm0), lightSandbox = { Math: Math };
  vm.runInNewContext('function clamp(v,a,b){return v<a?a:v>b?b:v;}\n' + course.slice(lm0, lm1) +
    '\nthis.model={checks:LIGHT_CHECKS,valid:LIGHT_VALID,glow:LIGHT_GLOW,llr:LIGHT_LLR,syndrome:lightSyndrome,hard:lightHard,project:projectEven,trace:LIGHT_TRACE};', lightSandbox);
  var LM = lightSandbox.model;
  check('the 3-by-3 fixture has six passing checks and eighteen check-bit edges',
    LM.checks.length === 6 && LM.checks.reduce(function (s, q) { return s + q.length; }, 0) === 18 &&
    LM.syndrome(LM.valid).every(function (q) { return q === 0; }));
  var oneGlitch = LM.valid.slice(); oneGlitch[4] = 0;
  check('the centre glitch fails exactly R2 and C2', same(LM.syndrome(oneGlitch), [0, 1, 0, 0, 1, 0]), LM.syndrome(oneGlitch).join(','));
  var observedHard = LM.hard(LM.glow);
  check('the uncertain hard board fails C2 and C3', same(observedHard, [1, 0, 1, 1, 0, 1, 0, 1, 1]) &&
    same(LM.syndrome(observedHard), [0, 0, 0, 0, 1, 1]), LM.syndrome(observedHard).join(','));
  var words = [];
  for (var mask = 0; mask < 512; mask++) {
    var word = []; for (var bit = 0; bit < 9; bit++) word.push((mask >> bit) & 1);
    if (LM.syndrome(word).every(function (q) { return q === 0; })) words.push({ word: word, value: LM.llr.reduce(function (s, ell, i) { return s + ell * word[i]; }, 0) });
  }
  words.sort(function (a, b) { return a.value - b.value; });
  check('the LLR fixture has one unique best valid board', words.length === 16 && same(words[0].word, LM.valid) && words[1].value - words[0].value > 0.9,
    words[0].word.join('') + ' gap=' + (words[1].value - words[0].value).toFixed(3));
  var projected = LM.project([0.9, 0.8, 0.7]), reprojected = LM.project(projected);
  check('the degree-three parity-polytope projector is idempotent', projected.every(function (q, i) { return Math.abs(q - reprojected[i]) < 1e-12; }));
  var r2in = [3, 4, 5].map(function (bit, j) { return LM.trace[4].b[bit] + LM.trace[3].u[1][j]; }), r2z = LM.trace[4].z[1];
  var EVEN = [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]], kkt = Math.max.apply(null, EVEN.map(function (v) { return v.reduce(function (s, q, i) { return s + (r2in[i] - r2z[i]) * (q - r2z[i]); }, 0); }));
  var cuts = [r2z[0] + r2z[1] + r2z[2] - 2, r2z[0] - r2z[1] - r2z[2], r2z[1] - r2z[0] - r2z[2], r2z[2] - r2z[0] - r2z[1]];
  check('the polytope page projects row R2 in round 4 onto the face that cuts off 100, certified nearest', cuts.every(function (q) { return q <= 1e-9; }) && Math.abs(cuts[1]) < 1e-9 && kkt <= 1e-9 &&
    Math.hypot(r2in[0] - r2z[0], r2in[1] - r2z[1], r2in[2] - r2z[2]) > 0.1 && r2z.some(function (q) { return q > 0.05 && q < 0.95; }), r2z.map(function (q) { return q.toFixed(3); }).join(', ') + ', kkt ' + kkt.toExponential(1));
  var firstClear = LM.trace.findIndex(function (q) { return q.syndrome.every(function (v) { return v === 0; }); });
  check('syndrome clears before the computed ADMM trace settles', firstClear === 3 && LM.trace[3].primal > 0.02 && LM.trace[3].dual > 0.6 &&
    LM.trace[8].primal < 1e-12 && LM.trace[8].dual < 1e-12,
    'first clear=' + firstClear + ' r3=' + LM.trace[3].primal.toFixed(6) + ' s3=' + LM.trace[3].dual.toFixed(6));
} catch (e) {
  check('light-board numerical teaching contract', false, e && e.stack || e);
}

try {
  var desktopCourse = courseSandbox(960, 660), desktopIds = desktopCourse.course.steps.map(function (q) { return q.id; }), desktopDraws = 0;
  lightPages.forEach(function (page) { [0, 0.25, 0.5, 0.75, 1].forEach(function (p) { desktopCourse.Board.debug({ step: page[0], p: p }); desktopDraws++; }); });
  check('the complete 66-page course builds in the drawing sandbox', desktopCourse.course.steps.length === 66 && lightPages.every(function (q) { return desktopIds.indexOf(q[0]) >= 0; }));
  check('all ten light-board pages draw at five desktop moments without an error', desktopDraws === 50 && (desktopCourse.kingsLandErrors || []).length === 0,
    (desktopCourse.kingsLandErrors || []).slice(0, 3).join(' | '));
  var mobileCourse = courseSandbox(390, 488), mobileDraws = 0;
  lightPages.forEach(function (page) { mobileCourse.Board.debug({ step: page[0], p: 1 }); mobileDraws++; });
  check('all ten light-board pages draw at the phone-stage size without an error', mobileDraws === 10 && (mobileCourse.kingsLandErrors || []).length === 0,
    (mobileCourse.kingsLandErrors || []).slice(0, 3).join(' | '));
} catch (e) {
  check('light-board drawing sandbox', false, e && e.stack || e);
}

// The Warden is met in three pages on the wall: who it is, with C and Π in words; its own problem for c, solved by a
// circle that grows from c and then one direction at a time; and why that nearest lawful spot is not the lowest one.
try {
  var WW = require(path.join(dir, 'engine.js')), wpp = {}, wkk; for (wkk in WW.PRESETS.wall) wpp[wkk] = WW.PRESETS.wall[wkk];
  var wLand = WW.buildLand('wall', wpp), wc = wLand.c, wA = wLand.A, wT = wLand.treasure, wb = wLand.box, wz = wLand.project(wc), wf = wLand.f;
  var wfmt = function (v) { var t = v.toFixed(3); if (/^-0(\.0*)?$/.test(t)) t = t.slice(1); return t.replace('-', '−'); };
  var wpr = function (v) { return '(' + wfmt(v[0]) + ', ' + wfmt(v[1]) + ')'; }, wdist = function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  var wsb = courseSandbox(960, 660), wIds = wsb.course.steps.map(function (q) { return q.id; }), wPage = function (id) { return wsb.course.steps.filter(function (q) { return q.id === 'wall-tw-' + id; })[0]; };
  var wPlain = function (q) { return (q && q.text || '').replace(/<[^>]*>/g, ''); };
  var wOrder = ['wanderer-role', 'warden-role', 'warden-steps', 'warden-not-lowest', 'rope'].map(function (id) { return wIds.indexOf('wall-tw-' + id); });
  check('the course meets the Warden in three pages, after the Wanderer and before the rope',
    wOrder.every(function (k, i) { return k >= 0 && (!i || k === wOrder[i - 1] + 1); }), wOrder.join(', '));
  // the nearest lawful spot: each coordinate of c clipped to the wall, and no lawful spot on a fine grid is nearer
  var clipped = [Math.min(Math.max(wc[0], wb[0]), wb[1]), Math.min(Math.max(wc[1], wb[0]), wb[1])], nearer = 0;
  for (var gi = 0; gi <= 400; gi++) for (var gj = 0; gj <= 400; gj++) { var gq = [wb[0] + (wb[1] - wb[0]) * gi / 400, wb[0] + (wb[1] - wb[0]) * gj / 400]; if (wdist(gq, wc) < wdist(wz, wc) - 1e-12) nearer++; }
  check('Π(c) is c with each coordinate clipped to the wall, and no lawful spot is nearer to c',
    wdist(wz, clipped) < 1e-12 && nearer === 0 && wz[0] === wb[1] && Math.abs(wz[1] - wc[1]) < 1e-12, 'Π(c)=' + wpr(wz) + ' nearer=' + nearer);
  // the land's ring through x* just touches the wall at x*: its westmost point is x*, on the line x₁ = 1
  var det = wA[0][0] * wA[1][1] - wA[0][1] * wA[1][0], inv00 = wA[1][1] / det, inv10 = -wA[1][0] / det, lvl = wf(wT) - wf(wc), sR = Math.sqrt(2 * lvl / inv00);
  var westmost = [wc[0] - sR * inv00, wc[1] - sR * inv10];
  check('the land’s ring through x* first touches the wall at x*, while Π(c) is higher on the same wall',
    Math.abs(westmost[0] - wb[1]) < 1e-9 && wdist(westmost, wT) < 1e-6 && wT[0] === wz[0] && wf(wz) - wf(wT) > 0.1 && wdist(wz, wT) > 0.2,
    'westmost=' + wpr(westmost) + ' x*=' + wpr(wT) + ' J(Π(c))=' + wfmt(wf(wz)) + ' J(x*)=' + wfmt(wf(wT)));
  var p1 = wPage('warden-role'), p2 = wPage('warden-steps'), p3 = wPage('warden-not-lowest'), t1 = wPlain(p1), t2 = wPlain(p2), t3 = wPlain(p3);
  check('the first Warden page defines C and says in words what Π stands for',
    /We call the set of lawful spots C, the shaded square on the map\./.test(t1) && /0 ≤ x₁ ≤ 1 and 0 ≤ x₂ ≤ 1/.test(t1) &&
    /Π<sub>C<\/sub>\(v\), the projection of v onto C, or Π\(v\) for short/.test(p1.text) &&
    /Π is the capital Greek letter pi\. Here Π<sub>C<\/sub>\(v\) denotes the Euclidean projection of v onto C\./.test(p1.text));
  check('the second Warden page says what c is and solves the Warden’s problem one direction at a time, with the computed numbers',
    t2.indexOf('c = ' + wpr(wc) + '. This c is the valley’s floor, the lowest point of the land with no wall') >= 0 &&
    /the point z in C with the smallest distance \|z − c\|, which is an optimisation problem of its own/.test(t2) &&
    t2.indexOf('East–west, ' + wc[0].toFixed(2) + ' lies past the wall at 1, so z₁ = 1.') >= 0 &&
    t2.indexOf('North–south, ' + wc[1].toFixed(2) + ' is already between 0 and 1, so it stays.') >= 0 &&
    t2.indexOf('Both ways give Π(c) = ' + wpr(wz) + ', ' + wfmt(wdist(wz, wc)) + ' from c.') >= 0, t2.slice(0, 120));
  check('the third Warden page compares the nearest and the lowest lawful spots with the computed heights',
    t3.indexOf('J = ' + wfmt(wf(wz)) + ' at Π(c)') >= 0 && t3.indexOf('x* = ' + wpr(wT) + ', is lower, at J = ' + wfmt(wf(wT))) >= 0 &&
    t3.indexOf(wfmt(wdist(wz, wT)) + ' away from Π(c) along the wall') >= 0 && /an equal move raises J ten times more across the valley than along it/.test(t3) &&
    /the first lawful spot they reach is x\*, not Π\(c\)/.test(t3) && /Every lawful spot in the gold patch is no higher than Π\(c\)/.test(t3) &&
    /Each twin has half of the skill the job needs\./.test(t3));
  var wSentences = [t1, t2, t3].join(' ').split(/[.?]\s+(?=[A-ZΠ])/), wLong = wSentences.filter(function (q) { return q.split(/\s+/).length > 35; });
  var wBanned = /\b(novel|state-of-the-art|framework|paradigm|leverage|utili[sz]e|in order to|crucial|vital|clearly|obviously|natural|elegant|principled|lifting)\b|It is worth noting|n’t\b|n't\b|\b(it|that|there)’s\b|’(re|ve|ll|d)\b|!/i;
  check('the Warden pages keep sentences within 35 words, with no contractions, exclamations or banned words',
    wLong.length === 0 && !wBanned.test([t1, t2, t3].join(' ')), wLong.slice(0, 2).join(' | '));
  var wDraws = 0, wPhone = courseSandbox(390, 488);
  ['warden-role', 'warden-steps', 'warden-not-lowest'].forEach(function (id) {
    [0, 0.1, 0.2, 0.35, 0.5, 0.62, 0.8, 0.92, 1].forEach(function (pp) { wsb.Board.debug({ step: 'wall-tw-' + id, p: pp }); wDraws++; });
    [0.5, 0.72, 0.82, 1].forEach(function (pp) { wPhone.Board.debug({ step: 'wall-tw-' + id, p: pp }); wDraws++; });
  });
  check('the Warden pages draw at nine desktop moments and four phone moments without an error', wDraws === 39 &&
    (wsb.kingsLandErrors || []).length === 0 && (wPhone.kingsLandErrors || []).length === 0, (wsb.kingsLandErrors || []).concat(wPhone.kingsLandErrors || []).slice(0, 3).join(' | '));
} catch (e) {
  check('the Warden’s three pages', false, e && e.stack || e);
}

// Day by day: each day the Wanderer faces a new land, the valley plus the rope's bowl around a spot made from the day
// before (yesterday's z with the rope alone, the aim z − u with the book). Its lowest point is where the Wanderer
// stops; tomorrow's spot is made from today's result; every day page draws at desktop and phone sizes.
try {
  var DE = require(path.join(dir, 'engine.js')), dpp = {}, dkk; for (dkk in DE.PRESETS.wall) dpp[dkk] = DE.PRESETS.wall[dkk];
  var dLand = DE.buildLand('wall', dpp), dWalk = DE.twins(dLand, [dpp.sx, dpp.sy], dpp.rho, 12), dA = dLand.A, dc = dLand.c, drho = dpp.rho;
  var SUBS = '₀₁₂₃₄₅₆₇₈₉', fmt = function (v) { var t = v.toFixed(3); if (/^-0(\.0*)?$/.test(t)) t = t.slice(1); return t.replace('-', '−'); };
  var pr3 = function (v) { return '(' + fmt(v[0]) + ', ' + fmt(v[1]) + ')'; }, minus = function (a, b) { return [a[0] - b[0], a[1] - b[1]]; };
  // x is the lowest point of f + ρ/2·|x − aim|² when the land's pull and the rope's pull cancel: A(x − c) + ρ(x − aim) = 0
  var lowestOf = function (x, aim) {
    var g0 = dA[0][0] * (x[0] - dc[0]) + dA[0][1] * (x[1] - dc[1]) + drho * (x[0] - aim[0]), g1 = dA[1][0] * (x[0] - dc[0]) + dA[1][1] * (x[1] - dc[1]) + drho * (x[1] - aim[1]);
    return Math.hypot(g0, g1) < 1e-9;
  };
  var ropeX = [dWalk[0].x], ropeZ = [dWalk[0].z]; for (var rdd = 1; rdd <= 4; rdd++) { ropeX.push(dLand.wanderer(ropeZ[rdd - 1], drho)); ropeZ.push(dLand.project(ropeX[rdd])); }
  var dsb = courseSandbox(960, 660), dPage = function (id) { return dsb.course.steps.filter(function (q) { return q.id === 'wall-tw-' + id; })[0]; };
  var plainOf = function (q) { return ((q && q.text || '') + ' ' + (q && q.math || '')).replace(/<[^>]*>/g, ''); };
  var ropeDaysOk = [1, 2, 3].every(function (d) {
    var q = dPage('rope-day-' + d), t = plainOf(q);
    return !!q && q.title === 'Day ' + d + ': today’s land is built from z' + SUBS[d - 1] && lowestOf(ropeX[d], ropeZ[d - 1]) &&
      t.indexOf('F' + SUBS[d] + '(x) = f(x) + ρ/2·|x − z' + SUBS[d - 1] + '|²') >= 0 && t.indexOf('z' + SUBS[d - 1] + ' = ' + pr3(ropeZ[d - 1])) >= 0 &&
      t.indexOf('x' + SUBS[d] + ' = the lowest point of F' + SUBS[d] + ' = ' + pr3(ropeX[d])) >= 0 && t.indexOf('z' + SUBS[d] + ' = Π(x' + SUBS[d] + ') = ' + pr3(ropeZ[d])) >= 0;
  });
  check('rope-alone days 1–3: each land is tied to yesterday’s Warden, and the Wanderer stops at its lowest point', ropeDaysOk &&
    [1, 2, 3].every(function (d) { return Math.hypot(ropeX[d][0] - ropeZ[d][0], ropeX[d][1] - ropeZ[d][1]) < 1e-12; }) && ropeZ[4][0] < ropeX[4][0],
    'x1..x3 = ' + ropeX.slice(1, 4).map(pr3).join(' '));
  var bookDaysOk = [6, 7, 8].every(function (d, i) {
    var q = dPage('book-day-' + (i + 1)), t = plainOf(q), now = dWalk[d], pr = dWalk[d - 1], aim = minus(pr.z, pr.u), aimNext = minus(now.z, now.u);
    return !!q && q.title === 'Day ' + d + ': today’s land is built from z' + SUBS[d - 1] + ' and u' + SUBS[d - 1] && lowestOf(now.x, aim) &&
      t.indexOf('v' + SUBS[d - 1] + ' = z' + SUBS[d - 1] + ' − u' + SUBS[d - 1] + ' = ' + pr3(aim)) >= 0 && t.indexOf('F' + SUBS[d] + '(x) = f(x) + ρ/2·|x − v' + SUBS[d - 1] + '|²') >= 0 &&
      t.indexOf('x' + SUBS[d] + ' = the lowest point of F' + SUBS[d] + ' = ' + pr3(now.x)) >= 0 && t.indexOf('z' + SUBS[d] + ' = Π(x' + SUBS[d] + ' + u' + SUBS[d - 1] + ') = ' + pr3(now.z)) >= 0 &&
      t.indexOf('u' + SUBS[d] + ' = u' + SUBS[d - 1] + ' + x' + SUBS[d] + ' − z' + SUBS[d] + ' = ' + pr3(now.u)) >= 0 && t.indexOf('v' + SUBS[d] + ' = ' + pr3(aimNext)) >= 0;
  });
  check('days 6–8 with the book: each land is tied to the aim z − u from the day before, and tomorrow’s aim comes from today', bookDaysOk,
    [6, 7, 8].map(function (d) { return 'v' + (d - 1) + '=' + pr3(minus(dWalk[d - 1].z, dWalk[d - 1].u)); }).join(' '));
  check('the rope-alone page continues from day 3 and says when the gap first opens', /For 3 days the twins end together\. From day 4 the Wanderer’s lowest point lies past the wall/.test(plainOf(dPage('without-ledger'))));
  check('after the day pages, the fast page replays days 4 to 12 and says so', /Here are days 4 to 12 at speed, including the days just shown one at a time\./.test(plainOf(dPage('again'))));
  var dayIds = ['rope-day-1', 'rope-day-2', 'rope-day-3', 'without-ledger', 'book-day-1', 'book-day-2', 'book-day-3', 'again'], dayDraws = 0, phoneSb = courseSandbox(390, 488);
  dayIds.forEach(function (id) {
    [0, 0.1, 0.2, 0.35, 0.5, 0.62, 0.8, 0.92, 1].forEach(function (pp) { dsb.Board.debug({ step: 'wall-tw-' + id, p: pp }); dayDraws++; });
    [0.3, 1].forEach(function (pp) { phoneSb.Board.debug({ step: 'wall-tw-' + id, p: pp }); dayDraws++; });
  });
  check('the day pages draw at nine desktop moments and two phone moments without an error', dayDraws === 88 &&
    (dsb.kingsLandErrors || []).length === 0 && (phoneSb.kingsLandErrors || []).length === 0, (dsb.kingsLandErrors || []).concat(phoneSb.kingsLandErrors || []).slice(0, 3).join(' | '));
} catch (e) {
  check('day-by-day pages', false, e && e.stack || e);
}

// The Wanderer's step is told as gradient descent on land plus rope, then as the balance of two pulls.  Its pages must
// draw on every land the game offers, including the last circuit, where the twins have settled and the walk is flat.
try {
  var wsb = courseSandbox(960, 660), WE = wsb.Engine, WB = wsb.Board, wanderErrors = [], wanderDraws = 0;
  ['canyon', 'wall', 'fort', 'ridge', 'misty'].forEach(function (key) {
    var wp = {}, kk; for (kk in WE.PRESETS[key]) wp[kk] = WE.PRESETS[key][kk];
    var WK = WE.KINDS[key], wland = WE.buildLand(key, wp), wx0 = WK.kind === 'tower' && wp.sx == null ? WE.lanternStart(wp) : [wp.sx, wp.sy], ww = WE.twins(wland, wx0, wp.rho, Math.round(wp.days));
    [0, 4, ww.length + 5].forEach(function (day) {
      var ok = WB.open({ hero: 'tw', name: 'the Wanderer', key: key, L: { view: WK.view, kind: WK.kind }, land: wland, p: wp, x0: wx0, day: day, walk: ww }, { ids: ['wander', 'wander-balance'], title: 't' });
      if (!ok) { wanderErrors.push(key + ' day ' + day + ' did not open'); return; }
      [0, 1].forEach(function (si) { [0, 0.5, 1].forEach(function (pp) { WB.debug({ step: si, p: pp }); wanderDraws++; }); });
      WB.steps().forEach(function (st) { if (/undefined|NaN/.test(st.text + st.math)) wanderErrors.push(key + ' day ' + day + ' ' + st.id + ' has undefined or NaN'); });
      WB.close();
    });
  });
  check('the Wanderer’s two pages draw on all five lands, including the settled last circuit', wanderDraws === 90 && wanderErrors.length === 0 && (wsb.kingsLandErrors || []).length === 0,
    wanderErrors.concat(wsb.kingsLandErrors || []).slice(0, 3).join(' | '));
  var wallStep = wsb.course.steps.filter(function (q) { return q.id === 'wall-tw-wander'; })[0], wallBal = wsb.course.steps.filter(function (q) { return q.id === 'wall-tw-wander-balance'; })[0];
  var plain = function (q) { return ((q && q.text || '') + ' ' + (q && q.math || '')).replace(/<[^>]*>/g, ''); };
  check('the Wanderer’s step is first told as gradient descent on land plus rope',
    /One way to find that lowest point is the Pilgrim’s: feel the slope of F and step downhill/.test(plain(wallStep)) && /x ← x − α·∇F\(x\)/.test(plain(wallStep)) && /the lowest point of F/.test(plain(wallStep)));
  check('the Wanderer’s slope is told as two pulls, and downhill on F is their sum',
    /downhill on F is the sum of two pulls: the land’s pull −∇f\(x\), downhill on the valley, and the rope’s pull ρ\(v − x\), toward the aim/.test(plain(wallStep)) &&
    /downhill: −∇F\(x\) = −∇f\(x\) \+ ρ\(v₄ − x\)/.test(plain(wallStep)));
  check('where the walk stops, the two pulls cancel and give the two equations the Wanderer solves',
    /the two pulls on the Wanderer cancel/.test(plain(wallBal)) && /equal and opposite/.test(plain(wallBal)) && /one equation for each direction of the map/.test(plain(wallBal)) && /one solve, and the same spot the walk reaches/.test(plain(wallBal)));
} catch (e) {
  check('Wanderer-step drawing sandbox', false, e && e.stack || e);
}

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
