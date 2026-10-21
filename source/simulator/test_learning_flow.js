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
['game.js', 'board.js', 'board_parts.js'].forEach(function (name) {
  var source = name === 'game.js' ? game : name === 'board.js' ? board : parts, ok = true, why = '';
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

// ---------------------------------------------------------------- compulsory ADMM walkthrough
var idsMatch = game.match(/boardIds\s*:\s*\[([^\]]+)\]/);
var guidedIds = idsMatch ? (idsMatch[1].match(/['"]([^'"]+)['"]/g) || []).map(function (s) { return s.slice(1, -1); }) : [];
var expectedIds = ['twins', 'wander', 'warden', 'ledger', 'again'];
check('guided ADMM board has the five intended pages in order', same(guidedIds, expectedIds), guidedIds.join(', '));
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
