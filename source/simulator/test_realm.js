// Checks of the curated roads between the six pages (realm.js): every road starts and lands on a real step, the
// prominent cards answer the question at their source, secondary comparisons stay folded, map-only roads stay on the
// map, interludes draw and land, repeat visits shorten without losing full replay, return tickets nest, and the built
// pages carry the current player and realm source.  Run from anywhere with Node 12 or later:
//   node source/simulator/test_realm.js
var fs = require('fs'), path = require('path'), vm = require('vm');
var SRC = path.join(__dirname, '..'), ROOT = path.join(__dirname, '..', '..');
var failures = 0, checks = 0;
function check(what, ok, detail) { checks++; console.log((ok ? 'ok    ' : 'FAIL  ') + what + (detail !== undefined && detail !== '' ? '  [' + detail + ']' : '')); if (!ok) failures++; }
function sameMembers(a, b) { return a.slice().sort().join('|') === b.slice().sort().join('|'); }

function memoryStorage(seed) {
  var data = seed || {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; },
    clear: function () { Object.keys(data).forEach(function (k) { delete data[k]; }); },
    data: data
  };
}
function sandbox(files, pageId, hash, storage) {
  var elements = {}, listeners = {}, created = 0, noop = function () {};
  function ctx() { var t = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '', imageSmoothingEnabled: true };
    return new Proxy(t, { get: function (o, k) { if (k === 'measureText') return function (q) { return { width: 7 * String(q).length }; }; if (k === 'createImageData') return function (w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; }; if (k === 'createRadialGradient' || k === 'createLinearGradient') return function () { return { addColorStop: noop }; }; if (k in o) return o[k]; if (typeof k === 'string') return noop; return undefined; } }); }
  function element(id) { if (elements[id]) return elements[id]; var e = { id: id, hidden: false, textContent: '', innerHTML: '', disabled: false, width: 0, height: 0, style: {}, offsetTop: 0, offsetHeight: 0, scrollTop: 0, clientHeight: 100,
    classList: { toggle: noop, add: noop, remove: noop, contains: function () { return false; } }, setAttribute: function (n, v) { this[n] = String(v); }, getAttribute: function (n) { return this[n] == null ? null : this[n]; }, hasAttribute: function (n) { return this[n] != null; },
    addEventListener: noop, appendChild: noop, insertBefore: noop, querySelectorAll: function () { return []; }, querySelector: function () { return null; }, closest: function () { return null; },
    getBoundingClientRect: function () { return { width: 960, height: 660, top: 0, left: 0, right: 960, bottom: 660 }; }, scrollIntoView: noop, focus: noop, getContext: function () { return ctx(); } }; return (elements[id] = e); }
  var location = { hash: hash || '', href: '' }, history = { urls: [], replaceState: function (state, title, url) { this.urls.push(String(url)); if (String(url).charAt(0) === '#') location.hash = String(url); } };
  var doc = { body: element('body'), documentElement: {}, head: null, getElementById: element, querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    addEventListener: function (kind, f) { listeners[kind] = f; }, createElement: function () { return element('created-' + (++created)); } };
  var sb = { console: console, Math: Math, Float64Array: Float64Array, Float32Array: Float32Array, Uint8ClampedArray: Uint8ClampedArray, Proxy: Proxy, JSON: JSON,
    performance: { now: function () { return 0; } }, requestAnimationFrame: function () { return 1; }, cancelAnimationFrame: noop,
    getComputedStyle: function () { return { fontFamily: 'sans-serif', getPropertyValue: function () { return 'monospace'; } }; },
    document: doc, location: location, history: history, localStorage: storage || memoryStorage(), devicePixelRatio: 1, addEventListener: noop,
    matchMedia: function () { return { matches: false }; }, REALM_PAGE: pageId };
  sb.window = sb; vm.createContext(sb);
  files.forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), sb, { filename: f }); });
  sb.__el = elements; sb.__listeners = listeners; sb.__history = history;
  return sb;
}
function elementWithClass(sb, cls) {
  var found = null; Object.keys(sb.__el).forEach(function (id) { if (sb.__el[id].className === cls) found = sb.__el[id]; }); return found;
}

var PAGES = {
  game: ['simulator/engine.js', 'simulator/board.js', 'simulator/board_parts.js', 'simulator/realm.js'],
  tutorial: ['simulator/engine.js', 'simulator/board.js', 'simulator/board_parts.js', 'simulator/course.js', 'simulator/realm.js'],
  keep: ['simulator/engine.js', 'simulator/board.js', 'simulator/keep.js', 'simulator/advanced_parts.js', 'simulator/advanced_course.js', 'simulator/realm.js'],
  soldiers: ['simulator/board.js', 'soldiers/soldiers.js', 'soldiers/soldiers_parts.js', 'soldiers/soldiers_course.js', 'simulator/realm.js'],
  coach: ['simulator/board.js', 'training_plan/plan.js', 'training_plan/plan_parts.js', 'training_plan/plan_course.js', 'simulator/realm.js'],
  dive: ['simulator/board.js', 'localization_decoding/inspect.js', 'localization_decoding/dive_parts.js', 'localization_decoding/dive_course.js', 'simulator/realm.js'],
  net: ['simulator/board.js', 'torn_net/net.js', 'torn_net/net_parts.js', 'torn_net/net_course.js', 'simulator/realm.js']
};
var LANDS = ['canyon', 'wall', 'fort', 'ridge', 'misty'];

// ---------------------------------------------------------------- every page in a sandbox, with its roads
var boxes = {}, ids = {};
Object.keys(PAGES).forEach(function (k) {
  var t0 = Date.now(), sb = null, err = null;
  try { sb = sandbox(PAGES[k], k); } catch (e) { err = e && e.stack || String(e); }
  boxes[k] = sb; ids[k] = sb && sb.course ? sb.course.steps.map(function (s) { return s.id; }) : [];
  check('the ' + k + ' page loads with its roads (' + (Date.now() - t0) + ' ms)', !!(sb && sb.Realm) && !(sb.kingsLandErrors || []).length, err || (sb && (sb.kingsLandErrors || []).slice(0, 2).join(' | ')));
});
var R = boxes.tutorial.Realm, ROADS = R.ROADS, PLACES = R.PLACES, ORDER = R.ORDER;
function road(id) { return R.road(id); }

// ---------------------------------------------------------------- the curated roads and their prerequisites
var PRIMARY = ['tale-staff', 'tale-misty-game', 'game-canyon', 'game-wall', 'game-fort', 'game-misty', 'twins-coach', 'light-keep', 'tale-done', 'tale-dive', 'tale-net', 'keep-light-shared', 'keep-twins', 'keep-coach', 'keep-dive', 'keep-net', 'coach-twins', 'coach-dive', 'dive-light', 'dive-net-aliases', 'dive-keep', 'dive-net-next', 'net-misty-game', 'net-keep-copies', 'net-keep-circuit', 'light-soldiers', 'soldiers-light', 'soldiers-twins', 'keep-soldiers', 'soldiers-keep', 'soldiers-coach'];
var SECONDARY = ['coach-soldiers', 'misty-net', 'keep-light', 'keep-net-robust', 'keep-net-blocks', 'keep-net-done', 'keep-fort-game', 'coach-wall-game', 'dive-twins', 'net-misty', 'net-twins'];
var MAP_ONLY = ['tale-twins-game', 'game-ridge', 'coach-keep', 'dive-coach', 'net-keep-robust', 'net-keep-blocks', 'net-keep-done', 'net-dive-aliases'];
var REMOVED = ['game-wall-coach', 'game-fort-keep', 'game-misty-net', 'light-dive', 'coach-dive-next'];
check('the curation has exactly 50 roads: 31 primary, 11 secondary and 8 map-only', ROADS.length === 50 && R.PRIMARY_ROADS.length === 31 && R.SECONDARY_ROADS.length === 11 && R.MAP_ROADS.length === 8, ROADS.length + ' = ' + R.PRIMARY_ROADS.length + ' + ' + R.SECONDARY_ROADS.length + ' + ' + R.MAP_ROADS.length);
check('the three road tiers contain the approved ids', sameMembers(R.PRIMARY_ROADS, PRIMARY) && sameMembers(R.SECONDARY_ROADS, SECONDARY) && sameMembers(R.MAP_ROADS, MAP_ONLY));
check('the removed duplicate roads stay removed', REMOVED.every(function (id) { return !road(id); }), REMOVED.filter(function (id) { return road(id); }).join(', '));
check('every road id is unique and belongs to exactly one tier', ROADS.map(function (r) { return r.id; }).filter(function (id, j, a) { return a.indexOf(id) !== j; }).length === 0 && ROADS.every(function (r) { return [PRIMARY, SECONDARY, MAP_ONLY].filter(function (a) { return a.indexOf(r.id) >= 0; }).length === 1 && r.tier === (PRIMARY.indexOf(r.id) >= 0 ? 'primary' : SECONDARY.indexOf(r.id) >= 0 ? 'secondary' : 'map'); }));
check('every road joins two different places that exist', ROADS.every(function (r) { return PLACES[r.from] && PLACES[r.to] && r.from !== r.to; }));
var badAt = []; ROADS.forEach(function (r) { if (r.from === 'game') { if (LANDS.indexOf(r.onLand) < 0) badAt.push(r.id + '@' + r.onLand); } else (r.at || []).forEach(function (id) { if (ids[r.from].indexOf(id) < 0) badAt.push(r.id + '@' + id); }); if (r.from !== 'game' && !(r.at || []).length) badAt.push(r.id + ' has no step'); });
check('every road starts on a real step of its page (or a real land of the game)', badAt.length === 0, badAt.join(', '));
var badLand = ROADS.filter(function (r) { return r.to === 'game' ? LANDS.indexOf(r.land) < 0 : ids[r.to].indexOf(r.land) < 0; }).map(function (r) { return r.id + '→' + r.land; });
check('every road lands after the destination prerequisite (or on a real game land)', badLand.length === 0, badLand.join(', '));
check('every full interlude opens with the map and ends with a key', ROADS.every(function (r) { return r.scenes.length >= 2 && r.scenes[0].kind === 'map' && r.scenes[r.scenes.length - 1].kind === 'key'; }));
check('every scene kind exists and every key has rows and a “New here” line', ROADS.every(function (r) { return r.scenes.every(function (s) { return s.kind === 'map' || (s.kind === 'key' ? s.rows.length >= 3 && /^New here: /.test(s.fresh) : typeof R.SCENES[s.kind] === 'function'); }); }));
check('every primary road has an action-specific CTA and explicit Same/Changes copy', PRIMARY.every(function (id) { var r = road(id); return r && r.cta && !/take the road/i.test(r.cta) && r.same && r.different && R.ROAD_KINDS[r.role]; }));
check('all secondary and map-only roads have a named role and CTA', SECONDARY.concat(MAP_ONLY).every(function (id) { var r = road(id); return r && R.ROAD_KINDS[r.role] && r.cta; }));

var expected = {
  'game-canyon': ['game', 'canyon', 'tutorial', 'canyon-pg-staff'],
  'game-ridge': ['game', 'ridge', 'tutorial', 'misty'],
  'tale-done': ['tutorial', 'cajode-done', 'keep', 'milestones'],
  'coach-wall-game': ['coach', 'without-ledger', 'game', 'wall'],
  'dive-light': ['dive', 'analogy', 'tutorial', 'light-patterns'],
  'dive-keep': ['dive', 'cajode_adds', 'keep', 'iteration-order'],
  'dive-net-next': ['dive', 'end', 'net', 'job'],
  'net-keep-copies': ['net', 'bridge', 'keep', 'local-copies'],
  'coach-twins': ['coach', 'without-ledger', 'tutorial', 'wall-tw-without-ledger'],
  'keep-twins': ['keep', 'aim', 'tutorial', 'wall-tw-without-ledger'],
  'game-wall': ['game', 'wall', 'tutorial', 'wall-tw-twins']
};
var wrongPrereq = [];
Object.keys(expected).forEach(function (id) { var r = road(id), x = expected[id], source = r && (r.from === 'game' ? r.onLand : (r.at || []).length === 1 ? r.at[0] : ''); if (!r || r.from !== x[0] || source !== x[1] || r.to !== x[2] || r.land !== x[3]) wrongPrereq.push(id); });
check('the corrected roads appear only after their source idea and land after the destination prerequisite', wrongPrereq.length === 0, wrongPrereq.join(', '));
check('the milestone comparison is now a two-card map-and-key road', road('tale-done').scenes.length === 2 && road('tale-done').scenes[0].kind === 'map' && road('tale-done').scenes[1].kind === 'key');

var primarySpots = {};
PRIMARY.forEach(function (id) { var r = road(id), ats = r.from === 'game' ? [r.onLand] : r.at; ats.forEach(function (at) { var k = r.from + '@' + at; primarySpots[k] = (primarySpots[k] || []).concat(id); }); });
var crowded = Object.keys(primarySpots).filter(function (k) { return primarySpots[k].length > 1; }).sort();
check('only the three course-end choosers show several primary cards together', sameMembers(crowded, ['keep@takeaway', 'soldiers@carry', 'tutorial@end']), crowded.map(function (k) { return k + ': ' + primarySpots[k].join(','); }).join(' | '));

function offers(ids0, step) { return ids0.map(function (id) { return R.offer(road(id), step); }).sort(function (a, b) { return a.order - b.order; }); }
var taleChoice = offers(['twins-coach', 'light-keep', 'tale-dive', 'tale-net'], 'end');
check('the tutorial ends with Coach, CAJODE, Dive and Net direct choices in that order', taleChoice.map(function (r) { return r.id; }).join('|') === 'twins-coach|light-keep|tale-dive|tale-net' && taleChoice.every(function (r) { return r.role === 'chooser' && r.direct; }));
check('the Coach is the tutorial’s single recommended first application', taleChoice.filter(function (r) { return r.recommended; }).length === 1 && taleChoice[0].recommended);
var keepChoice = offers(['keep-net', 'keep-coach', 'keep-dive'], 'takeaway');
check('CAJODE ends with Net recommended, then Coach and Dive, all direct', keepChoice.map(function (r) { return r.id; }).join('|') === 'keep-net|keep-coach|keep-dive' && keepChoice[0].recommended && keepChoice.every(function (r) { return r.role === 'chooser' && r.direct; }));
var soldierChoice = offers(['soldiers-keep', 'soldiers-light', 'soldiers-coach'], 'carry');
check('the soldiers end with CAJODE recommended, then the light board and the Coach, all direct', soldierChoice.map(function (r) { return r.id; }).join('|') === 'soldiers-keep|soldiers-light|soldiers-coach' && soldierChoice[0].recommended && soldierChoice.filter(function (r) { return r.recommended; }).length === 1 && soldierChoice.every(function (r) { return r.role === 'chooser' && r.direct; }));
check('later course hand-offs open the next prerequisite directly', R.offer(road('coach-dive'), 'differences').direct && R.offer(road('coach-dive'), 'differences').land === 'job' && R.offer(road('dive-net-next'), 'end').direct);

function reach(from) { var seen = {}, todo = [from]; seen[from] = 1; while (todo.length) { var a = todo.pop(); ROADS.forEach(function (r) { if (r.from === a && !seen[r.to]) { seen[r.to] = 1; todo.push(r.to); } }); } return Object.keys(seen).length; }
check('the curated directed roads still let every place reach every other', ORDER.every(function (k) { return reach(k) === ORDER.length; }));

// ---------------------------------------------------------------- the texts keep the house rules
var BANNED = /\b(novel|state-of-the-art|framework|paradigm|leverage|utili[sz]e|in order to|crucial|vital|clearly|obviously|natural(ly)?|elegant|principled|lifting)\b|It is worth noting/i;
var CONTRACTION = /\b\w+(n’t|n't)\b|\b(it|that|there|let|we|you|they|he|she|what|who)(’|')(s|re|ll|ve|d)\b/i;
var ACRO = { OFDM: 'orthogonal frequency-division multiplexing', ICI: 'intercarrier interference', CRC: 'cyclic redundancy check', LLR: 'log-likelihood ratio', LDPC: 'low-density parity-check', FFT: 'fast Fourier transform', ADMM: 'alternating direction method of multipliers' };
var bad = [];
ROADS.forEach(function (r) {
  var all = [r.sign, r.hook, r.cta, r.same || '', r.different || ''], inter = [];
  r.scenes.forEach(function (s) { inter.push(s.text || '', s.math || '', s.title || ''); if (s.kind === 'key') { inter.push(s.fresh); s.rows.forEach(function (rw) { inter.push(rw[0][1], rw[1][1]); }); } });
  all.concat(inter).forEach(function (t) { if (BANNED.test(t)) bad.push(r.id + ': banned word in “' + t.slice(0, 50) + '”'); if (CONTRACTION.test(t)) bad.push(r.id + ': contraction in “' + t.slice(0, 50) + '”'); if (/!/.test(t)) bad.push(r.id + ': exclamation'); });
  r.scenes.forEach(function (s) { String(s.text || '').split(/(?<=[.;])\s+/).forEach(function (sent) { var n = sent.split(/\s+/).filter(Boolean).length; if (n > 40) bad.push(r.id + ': a sentence of ' + n + ' words'); }); });
  var txt = inter.join(' ');
  Object.keys(ACRO).forEach(function (a) { if (new RegExp('\\b' + a + '\\b').test(txt) && txt.toLowerCase().indexOf(ACRO[a].toLowerCase()) < 0) bad.push(r.id + ': ' + a + ' is not expanded'); });
});
check('road copy: no banned words, contractions or exclamations; no run-on scene sentences; every acronym expanded', bad.length === 0, bad.slice(0, 8).join(' | ') + (bad.length > 8 ? ' … ' + bad.length + ' in all' : ''));

// ---------------------------------------------------------------- predictions, arrivals, contextual cards and the map
var badPred = [];
ROADS.forEach(function (r) { var p = R.predictionFor(r), unique = p && p.choices.filter(function (q, j, a) { return a.indexOf(q) === j; }); if (!p || p.choices.length < 2 || p.choices.length > 3 || unique.length !== p.choices.length || p.correct < 0 || p.correct >= p.choices.length || p.choices[p.correct] !== p.answer) badPred.push(r.id); });
check('every road asks one answerable prediction with distinct choices before its key', badPred.length === 0, badPred.join(', '));
var missingFromMap = [];
ORDER.forEach(function (k) { var html = boxes[k].Realm.mapStep(k, k === 'game' ? null : function (id) { return ids[k].indexOf(id); }).text; ROADS.filter(function (r) { return r.from === k; }).forEach(function (r) { if (html.indexOf('via=' + r.id) < 0) missingFromMap.push(r.id); }); });
check('the map exposes all 50 roads, including every map-only comparison', missingFromMap.length === 0, missingFromMap.join(', '));

Object.keys(PAGES).forEach(function (k) {
  var sb = boxes[k]; if (!sb) return; var B = sb.Board, Rk = sb.Realm, into = ROADS.filter(function (r) { return r.to === k; }), drawn = 0, landed = [], wrong = [];
  into.forEach(function (r) {
    if (B.onRoad()) B.endInterlude();
    if (k !== 'game') B.go(0);
    var ok = Rk.arrive(r.id, k === 'game' ? '' : 'source-step', { full: true }), d = B.debug({});
    if (!ok || !d.road || d.n !== r.scenes.length) { wrong.push(r.id + ' did not open in full'); return; }
    for (var j = 0; j < r.scenes.length; j++) [0, 1].forEach(function (p) { B.debug({ step: j, p: p }); drawn++; });
    B.debug({ step: 0, p: 1 });
    for (j = 0; j < r.scenes.length; j++) B.key({ key: 'ArrowRight', preventDefault: function () {} });
    var e = B.debug({});
    if (k === 'game') { if (e.open || e.road) wrong.push(r.id + ' left the board open'); else landed.push(r.id); }
    else if (e.road || e.id !== r.land) wrong.push(r.id + ' landed on ' + e.id); else landed.push(r.id);
  });
  var errs = (sb.kingsLandErrors || []);
  check('the ' + k + ' page: all ' + into.length + ' full arrivals draw (' + drawn + ' drawings) and continue to their prerequisite-safe landing', wrong.length === 0 && errs.length === 0 && landed.length === into.length, wrong.concat(errs.slice(0, 2)).join(' | '));
  if (k !== 'game') {
    var fork = elementWithClass(sb, 'realm-fork'), missing = [], leaked = [];
    ROADS.filter(function (r) { return r.from === k; }).forEach(function (r) { r.at.forEach(function (id) {
      B.go(ids[k].indexOf(id)); var o = Rk.offer(r, id), html = fork ? fork.innerHTML : '';
      if (r.tier === 'map') { if (html.indexOf('via=' + r.id) >= 0) leaked.push(r.id + '@' + id); return; }
      var route = o.direct ? '#at=' + encodeURIComponent(o.land || r.land) : '#via=' + r.id;
      if (!fork || fork.hidden || html.indexOf(o.sign) < 0 || html.indexOf(route) < 0 || (r.tier === 'secondary' && html.indexOf('More connections') < 0)) missing.push(r.id + '@' + id);
    }); });
    var quiet = ids[k].filter(function (id) { return !ROADS.some(function (r) { return r.from === k && r.tier !== 'map' && r.at.indexOf(id) >= 0; }); })[0];
    if (quiet) B.go(ids[k].indexOf(quiet));
    check('the ' + k + ' page: primary cards appear in context, secondary cards stay under More connections, and map-only roads do not leak in', missing.length === 0 && leaked.length === 0 && (!quiet || fork.hidden), missing.concat(leaked).join(', '));
    var before = B.debug({}).i, opened = Rk.openMap(), m = B.debug({}), mapHtml = sb.Board.steps()[0] && sb.Board.steps()[0].text || ''; B.debug({ p: 1 }); B.key({ key: 'ArrowRight', preventDefault: function () {} }); var after = B.debug({});
    var absent = ROADS.filter(function (r) { return r.from === k && mapHtml.indexOf('via=' + r.id) < 0; }).map(function (r) { return r.id; });
    check('the ' + k + ' page: the map offers every outgoing road and returns to the same step', opened && m.road && m.id === 'realm-map' && !after.road && after.i === before && absent.length === 0 && !(sb.kingsLandErrors || []).length, absent.join(', '));
  }
});

// ---------------------------------------------------------------- adaptive repeat, replay, direct-open and nested return tickets
(function () {
  var shared = memoryStorage(), r = road('twins-coach');
  var first = sandbox(PAGES.coach, 'coach', '', shared), fFork = elementWithClass(first, 'realm-fork');
  first.Realm.arrive(r.id, 'end'); var d1 = first.Board.debug({}), prediction = fFork && fFork.innerHTML;
  for (var j = 0; j < r.scenes.length; j++) first.Board.key({ key: 'ArrowRight', preventDefault: function () {} });
  var state = JSON.parse(shared.getItem('kings-land-roads-v1') || '{}');
  check('a first road visit plays the full map-to-key sequence and asks the prediction accessibly', d1.n === r.scenes.length && d1.id === 'road-twins-coach-0' && prediction.indexOf('Predict before the key') >= 0 && prediction.indexOf('aria-live="polite"') >= 0 && prediction.indexOf('data-realm-predict') >= 0);
  check('finishing a road records both its road state and the page-pair state', state.roads && state.roads[r.id] && state.roads[r.id].done && state.pairs && state.pairs['tutorial|coach']);
  var repeat = sandbox(PAGES.coach, 'coach', '', shared); repeat.Realm.arrive(r.id, 'end'); var d2 = repeat.Board.debug({});
  check('a repeated page pair omits the opening map but keeps the translation cards', repeat.Realm.ticket().compact && !repeat.Realm.ticket().first && d2.n === r.scenes.length - 1 && d2.id === 'road-twins-coach-1');
  var replay = sandbox(PAGES.coach, 'coach', '', shared); replay.Realm.arrive(r.id, 'end', { full: true }); var d3 = replay.Board.debug({});
  check('Replay full road restores the complete sequence', !replay.Realm.ticket().compact && d3.n === r.scenes.length && d3.id === 'road-twins-coach-0');
  var source = sandbox(PAGES.tutorial, 'tutorial', '', shared), sourceFork = elementWithClass(source, 'realm-fork'); source.Board.go(ids.tutorial.indexOf('wall-tw-again'));
  check('a completed connection is labelled and offers full replay on its source card', sourceFork.innerHTML.indexOf('Completed road') >= 0 && sourceFork.innerHTML.indexOf('Replay full road') >= 0 && sourceFork.innerHTML.indexOf('Open page directly') >= 0);
})();

(function () {
  var direct = sandbox(PAGES.coach, 'coach', '#at=curve&ret=twins-coach&from=end'), d = direct.Board.debug({}), bar = elementWithClass(direct, 'realm-bar'), h = bar && bar.innerHTML || '';
  check('a direct-open address lands without an interlude and keeps a return ticket', !d.road && d.id === 'curve' && direct.Realm.ticket() && !direct.Realm.ticket().playing && h.indexOf('Back to Three heroes downhill') >= 0);
  check('the return ticket appears before Map and the page pills', h.indexOf('realm-return') >= 0 && h.indexOf('realm-return') < h.indexOf('realm-mapbtn') && h.indexOf('realm-mapbtn') < h.indexOf('realm-place'));
  var trail = encodeURIComponent(JSON.stringify([['twins-coach', 'end']]));
  var nested = sandbox(PAGES.dive, 'dive', '#at=job&ret=coach-dive&from=differences&trail=' + trail), nb = elementWithClass(nested, 'realm-bar'), nh = nb && nb.innerHTML || '';
  check('a nested return first goes back to the page that launched the latest connection', nested.Realm.ticket() && nested.Realm.ticket().parent && nh.indexOf('the_coach_and_the_physio.html#at=differences&amp;ret=twins-coach&amp;from=end') >= 0);
  var parent = sandbox(PAGES.coach, 'coach', '#at=differences&ret=twins-coach&from=end'), pb = elementWithClass(parent, 'realm-bar'), ph = pb && pb.innerHTML || '';
  check('the restored parent ticket then returns to its own source step', parent.Realm.ticket() && ph.indexOf('tutorial.html#at=end') >= 0);
})();

// Addresses, chooser markup and visible accessibility states.
(function () {
  var via = sandbox(PAGES.coach, 'coach', '#via=twins-coach&from=end'), d = via.Board.debug({});
  check('a #via address plays that road first', d.road && d.id === 'road-twins-coach-0' && via.Realm.ticket() && via.Realm.ticket().from === 'end');
  var at = sandbox(PAGES.coach, 'coach', '#at=physio-role'), d2 = at.Board.debug({});
  check('a plain #at address opens at that step', !d2.road && d2.id === 'physio-role');
  var tale = sandbox(PAGES.tutorial, 'tutorial'), tf = elementWithClass(tale, 'realm-fork'); tale.Board.go(ids.tutorial.indexOf('end')); var th = tf.innerHTML;
  check('the tutorial end renders one four-way direct chooser with the Coach first and recommended', th.indexOf('Choose what to learn next') >= 0 && (th.match(/realm-road-primary/g) || []).length === 4 && th.indexOf('Plan one safe training session') < th.indexOf('Follow CAJODE') && th.indexOf('Recommended') >= 0 && th.indexOf('#via=') < 0);
  var keep = sandbox(PAGES.keep, 'keep'), kf = elementWithClass(keep, 'realm-fork'); keep.Board.go(ids.keep.indexOf('takeaway')); var kh = kf.innerHTML;
  check('the CAJODE takeaway renders Net first in its three-way direct chooser', (kh.match(/realm-road-primary/g) || []).length === 3 && kh.indexOf('Carry the joint-block idea') < kh.indexOf('Strip CAJODE down') && kh.indexOf('Recommended') >= 0 && kh.indexOf('#via=') < 0);
  var seeded = memoryStorage({ 'kings-land-roads-v1': JSON.stringify({ seen: { tutorial: 1, coach: 1 }, done: { keep: 1 } }) });
  var access = sandbox(PAGES.tutorial, 'tutorial', '', seeded), ab = elementWithClass(access, 'realm-bar'), ah = ab && ab.innerHTML || '';
  check('page progress uses visible marks plus screen-reader and aria-label status text', ah.indexOf('Coach and Physio, visited') >= 0 && ah.indexOf('CAJODE receiver, reached the end') >= 0 && ah.indexOf('aria-hidden="true"') >= 0 && ah.indexOf('realm-sr') >= 0);
  check('the old generic “Take the road” CTA is absent from all contextual cards', ROADS.every(function (r) { return !/take the road/i.test(r.cta || ''); }));
})();

// ---------------------------------------------------------------- every built page carries the roads exactly once
var realmSrc = fs.readFileSync(path.join(__dirname, 'realm.js'), 'utf8'), boardSrc = fs.readFileSync(path.join(__dirname, 'board.js'), 'utf8');
var built = { 'index.html': 'game', 'tutorial.html': 'tutorial', 'bp_and_cajode.html': 'soldiers', 'jade_keep_tutorial.html': 'keep', 'the_coach_and_the_physio.html': 'coach', 'localization_is_decoding.html': 'dive', 'finding_the_tear.html': 'net' };
Object.keys(built).forEach(function (f) {
  var html = fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8') : '';
  check(f + ' carries the current player and roads once, and names itself “' + built[f] + '”', html.split(realmSrc).length === 2 && html.split(boardSrc).length === 2 && html.indexOf('<meta name="kings-land-page" content="' + built[f] + '">') >= 0);
});

console.log(failures ? failures + ' of ' + checks + ' checks FAILED' : 'all ' + checks + ' checks passed');
process.exit(failures ? 1 : 0);
