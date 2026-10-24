// Model, numerical-trace, teaching-flow, drawing, wording and generated-page checks for "The BP protocol and the
// SAPPHIRE circuit".  Run from anywhere with Node 12 or later:  node source/soldiers/test_soldiers.js
var M = require('./soldiers.js'), fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
var failures = 0, checks = 0;
function check(what, ok, detail) { checks++; console.log((ok ? 'ok    ' : 'FAIL  ') + what + (detail !== undefined && detail !== '' ? '  [' + detail + ']' : '')); if (!ok) failures++; }
function near(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-9 : tol); }
function allNear(a, b, tol) { return a.length === b.length && a.every(function (v, i) { return near(v, b[i], tol); }); }
function signs(w) { return w.map(function (v) { return v > 0 ? '+' : '-'; }).join(''); }
function bits(w) { return w.join(''); }
function flatNear(a, b, tol) { return a.length === b.length && a.every(function (r, i) { return allNear(r, b[i], tol); }); }

// The connected-chain teaching fixture is deliberately small enough to audit here.  The retained loop fixture still
// matches the decoder log copied with the soldier deck (decoder source digest fa6c107e…0609).
var TREE_BP_TOTALS = [[-0.30924643967160637, 4.8, 5.517040896686184, -3.290753560328393, -1.2947623561493242, -0.5777214594631408],
  [-0.10355918406774572, 5.517040896686184, 5.320275571922954, -3.567770463528431, -3.425153499997592, -0.42258349595239436],
  [0.15526681253333086, 5.320275571922953, 5.320275571922954, -3.567770463528431, -3.425153499997592, -0.23218832694615443]];
var TREE_ADMM = {
  cards: [[1, 0, 0, 1, 1, 1], [1, 0, 0, 1, 1, 1], [0.5714285714285718, 0, 0, 1, 0.9090909090909091, 0.7142857142857145], [0.08905380333951854, 0, 0, 1, 0.9651711924439197, 0.5380333951762531]],
  primalRms: [0.20412414523193148, 0.04388124444310243, 0.09430626517039606]
};
var LOOP_LOG = { updates: 12, word: '000111', syndromes: [2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  primalRms: [0.2721655269759086, 0.2721655269759086, 0.14537239906098995, 0.12367602526003954, 0.1368850984737399, 0.14515651512071392, 0.1448799996617391, 0.1365606311679844, 0.12214459480543138, 0.11976792920461762, 0.116437282516718, 0.04345562701232141],
  relaxed: [0.014464684577617008, 0.0, 0.0, 0.7856380241803824, 0.6386447178994987, 0.7886335544829831] };

// ---------------------------------------------------------------- 1. the counting soldiers
var count = M.counting();
check('the counting soldiers send p2’s numbers towards the officer and back', count.towards.map(function (m) { return m.value; }).join(',') === '1,2,1,2,3,6,7' && count.back.map(function (m) { return m.value; }).join(',') === '0,1,5,6,4,5,6');
check('every counting soldier’s total is 7', Object.keys(count.totals).every(function (k) { return count.totals[k] === 7; }) && Object.keys(count.totals).length === 7);

// ---------------------------------------------------------------- 2. the parity polytope of a junction
var EVEN = M.evenPatterns(3);
check('a junction of three has the four valid patterns 000, 011, 101, 110', EVEN.map(function (p) { return p.join(''); }).join(',') === '000,011,101,110');
function stream(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
var rnd = stream(5), certified = true, idem = true, worst = 0;
for (var k = 0; k < 400; k++) {
  var x = [rnd() * 1.8 - 0.4, rnd() * 1.8 - 0.4, rnd() * 1.8 - 0.4], z = M.projectEven(x).z;
  var feasible = z.every(function (v) { return v >= -1e-12 && v <= 1 + 1e-12; }) && z[0] <= z[1] + z[2] + 1e-9 && z[1] <= z[0] + z[2] + 1e-9 && z[2] <= z[0] + z[1] + 1e-9 && z[0] + z[1] + z[2] <= 2 + 1e-9;
  var kkt = Math.max.apply(null, EVEN.map(function (v) { return (x[0] - z[0]) * (v[0] - z[0]) + (x[1] - z[1]) * (v[1] - z[1]) + (x[2] - z[2]) * (v[2] - z[2]); }));
  worst = Math.max(worst, kkt); if (!feasible || kkt > 1e-9) certified = false;
  var z2 = M.projectEven(z).z; if (z2.some(function (v, i) { return Math.abs(v - z[i]) > 1e-12; })) idem = false;
}
check('every projection lands in the parity polytope and is certified nearest at every valid pattern', certified, 'largest (x − z)·(v − z) = ' + worst.toExponential(2));
check('projection is idempotent', idem);
check('the broken corner 111 projects to the middle of the face that cuts it off', allNear(M.projectEven([1, 1, 1]).z, [2 / 3, 2 / 3, 2 / 3], 1e-12));
check('a two-bit check projects the broken pattern 01 to the lawful line b1 = b2', allNear(M.projectEven([0, 1]).z, [0.5, 0.5], 1e-12));

// ---------------------------------------------------------------- 3. the BP soldier on the tree
var T = M.TREE, bp = M.treeBP();
check('the new fixture is the approved six-bit open chain with one bit convention', T.n === 6 && T.checks.map(function (c) { return c.join(''); }).join('|') === '12|234|450'
  && allNear(T.L, [-0.6, 4, 0.8, -3, -0.8, -0.8], 1e-12) && bits(T.sent) === '000111' && bits(M.hardBits(T.L)) === '100111');
var treeEdges = T.checks.reduce(function (n, c) { return n + c.length; }, 0), treeNodes = T.n + T.checks.length, seen = { b0: true }, todo = ['b0'];
while (todo.length) {
  var v = todo.pop(), next = [];
  if (v.charAt(0) === 'b') { var bi = +v.slice(1); T.checks.forEach(function (c, a) { if (c.indexOf(bi) >= 0) next.push('c' + a); }); }
  else T.checks[+v.slice(1)].forEach(function (i) { next.push('b' + i); });
  next.forEach(function (q) { if (!seen[q]) { seen[q] = true; todo.push(q); } });
}
check('the Tanner fixture is connected and acyclic', Object.keys(seen).length === treeNodes && treeEdges === treeNodes - 1, treeEdges + ' edges, ' + treeNodes + ' nodes');
var closed = T.checks.map(function (c) { return c.slice(); }); closed[0].push(0);
function canonicalChecks(checks) { return checks.map(function (c) { return c.slice().sort().join(''); }).join('|'); }
check('adding the missing edge (c0, bit 0) closes exactly the later loop', canonicalChecks(closed) === canonicalChecks(M.LOOP.checks));
var errors = bp.before.map(function (b, i) { return b !== T.sent[i] ? i : -1; }).filter(function (i) { return i >= 0; }), weakest = T.L.map(Math.abs).reduce(function (a, v, i, all) { return v < all[a] ? i : a; }, 0);
check('the channel begins with one error, at the uniquely weakest bit 0', errors.join() === '0' && weakest === 0 && T.L.filter(function (v) { return Math.abs(v) === Math.abs(T.L[0]); }).length === 1);

var candidates = [];
for (var mask = 0; mask < (1 << T.n); mask++) {
  var candidate = []; for (var ci = 0; ci < T.n; ci++) candidate.push((mask >> (T.n - 1 - ci)) & 1);
  if (M.valid(candidate, T.checks)) candidates.push({ bits: bits(candidate), score: candidate.reduce(function (s, b, i) { return s + (1 - 2 * b) * T.L[i]; }, 0) });
}
candidates.sort(function (a, b) { return b.score - a.score; });
check('000111 is the unique maximum-likelihood word with score margin 0.4', candidates[0].bits === bits(T.sent) && near(candidates[0].score - candidates[1].score, 0.4, 1e-12), candidates[0].bits + ' by ' + (candidates[0].score - candidates[1].score).toFixed(3));
check('flooding BP carries the expected posterior totals for all three iterations', bp.trace.length === 3 && bp.trace.every(function (h, i) { return allNear(h.B, TREE_BP_TOTALS[i], 1e-12); }));
check('the BP hard word stays 100111 twice, then becomes the sent word at iteration 3', bp.acceptedAt === 3 && bp.trace.map(function (h) { return bits(h.bits); }).join(',') === '100111,100111,000111'
  && bp.trace.map(function (h) { return bits(h.syn); }).join(',') === '001,001,000' && bits(bp.after) === bits(T.sent));
check('the BP evidence wave crosses c0, c1 and c2 before bit 0 turns', near(bp.trace[0].U['0,2'], 4, 1e-12)
  && near(bp.trace[0].U['1,4'], -0.7170408966861834, 1e-12) && near(bp.trace[1].U['1,4'], -2.8474320405344513, 1e-12)
  && allNear(bp.trace.map(function (h) { return h.U['2,0']; }), [0.2907535603283936, 0.49644081593225425, 0.7552668125333308], 1e-12)
  && bp.trace[0].B[0] < 0 && bp.trace[1].B[0] < 0 && bp.trace[2].B[0] > 0);
function sumProductReply(values) { var p = values.reduce(function (q, v) { return q * Math.tanh(v / 2); }, 1); return Math.log((1 + p) / (1 - p)); }
check('each BP reply is keyed per check-bit edge and excludes its recipient', bp.trace.every(function (h) {
  return Object.keys(h.U).length === treeEdges && T.checks.every(function (c, a) { return c.every(function (i) {
    var key = a + ',' + i, other = c.filter(function (j) { return j !== i; }).map(function (j) { return h.V[a + ',' + j]; });
    return Object.prototype.hasOwnProperty.call(h.U, key) && near(h.U[key], sumProductReply(other), 1e-12);
  }); });
}));

// ---------------------------------------------------------------- 4. the note-taking soldier on the tree
var nt = M.treeNotes(), NH = nt.hist;
check('SAPPHIRE initializes one relaxed bit vector, projected per-check replica variables and zero scaled duals', bits(NH[0].b) === '100111'
  && NH[0].z[0].join() === '0,0' && NH[0].z[1].join() === '0,1,1' && allNear(NH[0].z[2], [2 / 3, 2 / 3, 2 / 3], 1e-12)
  && NH[0].u.every(function (r) { return r.every(function (v) { return v === 0; }); }));
check('the three SAPPHIRE circuits reproduce the approved relaxed-bit and RMS consensus-error trace', nt.circuits === 3 && NH.length === 4
  && NH.every(function (h, i) { return allNear(h.b, TREE_ADMM.cards[i], 1e-12); })
  && allNear(NH.slice(1).map(function (h) { return h.primalRms; }), TREE_ADMM.primalRms, 1e-12));
check('the hard word remains 100111 for two circuits and passes all checks in circuit 3', NH.slice(1).map(function (h) { return bits(h.word); }).join(',') === '100111,100111,000111'
  && NH.slice(1).map(function (h) { return M.syndrome(h.word, T.checks).reduce(function (s, v) { return s + v; }, 0); }).join() === '1,1,0');
check('circuit 1 records the 111 projection as three equal positive dual increments', allNear(NH[1].z[2], [2 / 3, 2 / 3, 2 / 3], 1e-12) && allNear(NH[1].u[2], [1 / 3, 1 / 3, 1 / 3], 1e-12));
var c1bits = T.checks[1].map(function (i) { return NH[2].word[i]; });
check('c1 has valid hard parity in circuit 2 while its continuous replica disagreement and dual remain nonzero', M.syndrome(c1bits, [[0, 1, 2]])[0] === 0
  && NH[2].u[1].some(function (v) { return Math.abs(v) > 1e-12; })
  && T.checks[1].some(function (i, j) { return Math.abs(NH[2].b[i] - NH[2].z[1][j]) > 1e-12; }));
check('shared bit 4 has two distinct replicas and two signed duals in circuit 2', near(NH[2].z[1][2], 0.9393939393939396, 1e-12) && near(NH[2].u[1][2], -0.030303030303030498, 1e-12)
  && near(NH[2].z[2][0], 0.844155844155844, 1e-12) && near(NH[2].u[2][0], 0.3982683982683982, 1e-12));
check('bit 0 turns from the preceding c2 record less its dual', near(NH[3].tell[0], 0.10822510822510867, 1e-12)
  && near((nt.rho * NH[3].tell[0] - T.L[0] - nt.beta) / (nt.rho * nt.deg[0] - 2 * nt.beta), NH[3].b[0], 1e-12));
check('parity acceptance is not continuous convergence', bits(NH[3].word) === bits(T.sent) && NH[3].primalRms > 0.09 && near(NH[3].primalRms, 0.09430626517039606, 1e-12));

// ---------------------------------------------------------------- 5. the loop
var L6 = M.LOOP, lbp = M.loopBP('sp'), table = [[0.89, 4.80, 8.42, 3.25, 2.10, -3.36], [1.76, 0.91, 5.01, 2.10, -0.70, -1.46], [1.76, 1.78, 6.58, -0.70, -0.68, -1.47]];
check('positive LLR means bit 0 in both examples and bipolar signs are only an equivalent loop view', bits(M.hardBits([2, -2])) === '01' && bits(L6.sentBits) === '000111'
  && lbp.every(function (h) { return h.bits.every(function (b, i) { return b === (h.word[i] > 0 ? 0 : 1); }); }));
check('the BP soldier walks the loop in 3 iterations through the deck’s words and totals', lbp.length === 3 && lbp.map(function (t) { return bits(t.bits); }).join(',') === '000001,000011,000111' && lbp.every(function (t, s) { return allNear(t.B, table[s], 0.005 + 1e-9); }));
var hear = lbp[1].U['1,4'] + lbp[1].U['2,4'];
check('in iteration 2 soldier 4 hears −1.40 and −3.96, which outweigh its +4.67 by 0.70', near(lbp[1].U['1,4'], -1.40, 0.005) && near(lbp[1].U['2,4'], -3.96, 0.005) && near(hear, -5.36, 0.005) && near(lbp[1].B[4], -0.70, 0.005));
var smart = M.loopBP('ms');
check('the cautious rule of the slides stays on +++-+- for its 80 iterations', smart.length === 80 && signs(smart[79].word) === '+++-+-');
var ln = M.loopNotes(), LH = ln.hist, words = LH.map(function (h) { return h.b.map(function (v) { return v >= 0.5 ? -1 : 1; }); });
var changes = []; for (var t = 1; t < words.length; t++) if (signs(words[t]) !== signs(words[t - 1])) changes.push(t + ':' + signs(words[t]));
check('the note-taking soldier changes word at circuits 3, 4, 9 and 12, ending on the sent word', ln.circuits === 12 && changes.join(',') === '3:+++++-,4:-++++-,9:+++++-,12:+++---');
check('the loop walk matches the retained decoder’s log to 1e-12', ln.circuits === LOOP_LOG.updates && bits(LH[12].word) === LOOP_LOG.word && allNear(LH.slice(1).map(function (h) { return h.primalRms; }), LOOP_LOG.primalRms, 1e-12) && allNear(LH[12].b, LOOP_LOG.relaxed, 1e-12)
  && LH.slice(1).map(function (h) { return M.synSigns(h.b.map(function (v) { return v >= 0.5 ? -1 : 1; }), L6.checks).reduce(function (s, v) { return s + v; }, 0); }).join() === LOOP_LOG.syndromes.join());
var h11 = LH[11], tell4 = [1, 2].reduce(function (s, k) { var j = L6.checks[k].indexOf(4); return s + h11.z[k][j] - h11.u[k][j]; }, 0);
check('soldier 4 turns in circuit 12 from records less notes of 2.76: (3 × 2.76 − 4.67 − 0.8)/4.4 = 0.64', near(tell4, 2.76, 0.005) && near(LH[12].b[4], 0.64, 0.005) && near(LH[12].tell[4], tell4, 1e-12) && near((3 * tell4 - L6.L[4] - 0.8) / 4.4, LH[12].b[4], 1e-12));
check('soldier 0’s two notes in circuit 12 are +1.42 at c₀ and −1.79 at c₂', near(LH[12].u[0][L6.checks[0].indexOf(0)], 1.42, 0.005) && near(LH[12].u[2][L6.checks[2].indexOf(0)], -1.79, 0.005));
var co = M.coral(), CT = co.trace, stop = CT[CT.length - 1];
check('the gradient soldier stops after 102 steps on ++++++ with cost 1.2838; the sent word costs 1.2751', stop.it === 102 && signs(stop.word) === '++++++' && near(stop.J, 1.2838, 5e-5) && near(M.objective(L6.sent), 1.2751, 5e-5));
var hl = M.hill(stop.x, 1200), peak = hl.reduce(function (a, b) { return b.J > a.J ? b : a; });
check('a hill 1.99 high, peaking at 3.27, stands between the stop and the sent word', near(peak.J, 3.27, 0.005) && near(peak.J - stop.J, 1.99, 0.005) && hl[hl.length - 1].J < hl[0].J);
var gp = M.gradient(CT[0].x), slope = {}; gp.parts[0].forEach(function (q) { slope[q.check] = q.slope; });
check('the gradient soldier adds soldier 0’s slopes −1.24 (c₀) and +3.88 (c₂) and +0.15 (the fit) into +2.79', near(slope[0], -1.24, 0.005) && near(slope[2], 3.88, 0.005) && near(gp.g[0] - slope[0] - slope[2], 0.15, 0.005) && near(gp.g[0], 2.79, 0.005));
check('its first step moves soldier 0’s card from +0.54 to +0.45 with the preconditioner 6.16', near(co.D[0], 6.16, 0.005) && near(CT[0].x[0], 0.54, 0.005) && near(CT[1].x[0], 0.45, 0.005));
check('the walks are deterministic', M.loopNotes().hist[12].b.join() === LH[12].b.join() && M.coral().trace.length === CT.length);

// ---------------------------------------------------------------- 6. the course in a browser-less drawing sandbox
function sandbox(width, height) {
  var elements = {}, noop = function () {};
  function ctx() { var t = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '', imageSmoothingEnabled: true };
    return new Proxy(t, { get: function (o, k) { if (k === 'measureText') return function (q) { return { width: 7 * String(q).length }; }; if (k === 'createImageData') return function (w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; }; if (k === 'createRadialGradient' || k === 'createLinearGradient') return function () { return { addColorStop: noop }; }; if (k in o) return o[k]; if (typeof k === 'string') return noop; return undefined; } }); }
  function element(id) { if (elements[id]) return elements[id]; var e = { id: id, hidden: false, textContent: '', innerHTML: '', disabled: false, width: 0, height: 0, style: {}, offsetTop: 0, offsetHeight: 0, scrollTop: 0, clientHeight: 100, classList: { toggle: noop, add: noop, remove: noop }, setAttribute: function (n, v) { this[n] = String(v); }, getAttribute: function (n) { return this[n] == null ? null : this[n]; }, addEventListener: noop, querySelectorAll: function () { return []; }, querySelector: function () { return element('q-' + Object.keys(elements).length); }, closest: function () { return null; }, getBoundingClientRect: function () { return { width: width, height: height, top: 0, left: 0, right: width, bottom: height }; }, scrollIntoView: noop, focus: noop, getContext: function () { return ctx(); } }; return (elements[id] = e); }
  var sb = { console: console, performance: { now: function () { return 0; } }, requestAnimationFrame: function () { return 1; }, cancelAnimationFrame: noop, getComputedStyle: function () { return { fontFamily: 'sans-serif', getPropertyValue: function () { return 'monospace'; } }; },
    document: { body: {}, documentElement: {}, getElementById: element, querySelectorAll: function () { return []; }, addEventListener: noop, createElement: function () { return element('created-' + Object.keys(elements).length); } }, location: { hash: '' }, devicePixelRatio: 1, addEventListener: noop, Proxy: Proxy, Float32Array: Float32Array, Float64Array: Float64Array, Uint8ClampedArray: Uint8ClampedArray };
  sb.window = sb; vm.createContext(sb);
  [[path.join(__dirname, '..', 'simulator'), 'board.js'], [__dirname, 'soldiers.js'], [__dirname, 'soldiers_parts.js'], [__dirname, 'soldiers_course.js']].forEach(function (q) { vm.runInContext(fs.readFileSync(path.join(q[0], q[1]), 'utf8'), sb, { filename: q[1] }); });
  return sb;
}
var sb = null, course = null, err = null;
try { sb = sandbox(960, 660); course = sb.course; } catch (e) { err = e && e.stack || String(e); }
check('the course builds in the sandbox', !!course, err);
if (course) {
  var steps = course.steps, ids = steps.map(function (q) { return q.id; });
  var expected = ['roadmap', 'count', 'towards', 'return', 'everyone', 'key', 'tree', 'listen', 'reply-c0', 'reply-c1', 'decide', 'cast', 'polytope', 'start', 'read1', 'project1', 'notes1', 'read2', 'circuit2', 'reply-record', 'keeps', 'support', 'loop', 'loop-bp', 'loop-why', 'loop-notes', 'loop-turn', 'loop-gradient', 'apart', 'ends', 'officer', 'five', 'stop', 'carry'];
  check('the course has the intended 34 steps in 8 chapters', steps.length === 34 && course.chapters.length === 8 && ids.join(',') === expected.join(','), steps.length + ' steps: ' + ids.join(','));
  check('all road-sensitive soldier destinations remain stable', ['count', 'keeps', 'notes1', 'officer', 'carry'].every(function (id) { return ids.indexOf(id) >= 0; }));
  var drawn = 0; [[960, 660], [420, 900]].forEach(function (size) { var s2 = size[0] === 960 ? sb : sandbox(size[0], size[1]); s2.course.steps.forEach(function (q, i) { [0, 0.5, 1].forEach(function (pp) { s2.Board.debug({ step: i, p: pp }); drawn++; }); }); if (s2 !== sb) (s2.kingsLandErrors || []).forEach(function (e) { (sb.kingsLandErrors = sb.kingsLandErrors || []).push(e); }); });
  check('every step draws at three moments, at desktop and phone sizes, without an error (' + drawn + ' drawings)', (sb.kingsLandErrors || []).length === 0, (sb.kingsLandErrors || []).slice(0, 3).join(' | '));
  function text(id) { var q = steps[ids.indexOf(id)]; return ((q && q.text || '') + ' ' + (q && q.math || '')).replace(/<[^>]*>/g, ''); }
  var all = steps.map(function (q) { return q.title + ' ' + text(q.id); }).join(' ');
  check('the receiver need comes first, before either decoding mechanism', ids.indexOf('roadmap') === 0 && ids.indexOf('roadmap') < ids.indexOf('count')
    && /JADE/.test(text('roadmap')) && /SAPPHIRE/.test(text('roadmap')) && /Lext = Lpost − Lch/.test(text('roadmap')) && /x = 1−2b/.test(text('roadmap'))
    && /initialization temperature/.test(text('roadmap')) && /SAPPHIRE does not call BP/.test(text('roadmap')));
  check('one explicit convention bridges channel LLRs, hard bits and relaxed bits before decoding', ids.indexOf('key') < ids.indexOf('tree')
    && /positive channel LLR favours bit 0/.test(text('key')) && /relaxed bit value near 1 represents bit 1/.test(text('key'))
    && !/positive (?:channel )?LLR favours (?:binary )?one/i.test(all));
  check('the connected-chain pages teach a three-iteration evidence wave rather than a one-round tree rule', /connected/.test(text('tree')) && /no loop/.test(text('tree'))
    && /iteration 3/.test(text('decide')) && /not necessarily after one flooding iteration/.test(text('decide')) && !/exact in one round|one round of replies is exact/i.test(all));
  check('the reply pages state recipient exclusion and propagation through a shared bit', /reply never reuses the recipient/.test(text('reply-c0'))
    && /excludes c₁/.test(text('reply-c1')) && /c₀/.test(text('reply-c1')) && /c₂/.test(text('decide')));
  check('SAPPHIRE introduces owners before the lawful set, then initializes before the first circuit', ids.indexOf('cast') < ids.indexOf('polytope') && ids.indexOf('polytope') < ids.indexOf('start') && ids.indexOf('start') < ids.indexOf('read1')
    && /relaxed bit variable/.test(text('cast')) && /replica variable/.test(text('cast')) && /Each check owns/.test(text('cast')) && /scaled dual variable/.test(text('cast'))
    && /000, 011, 101 and 110/.test(text('polytope')) && /parity polytope/.test(text('polytope')));
  check('the course never misnames a relaxed bit variable as a probability or BP belief', !/card is (?:the )?probability|belief in a binary one|b(?:\(i\)|ᵢ)? is a belief/i.test(all));
  check('the comparison distinguishes extrinsic support from signed continuous disagreement', /extrinsic support/.test(text('reply-record') + ' ' + text('support'))
    && /Δu = b − z|card.*record|relaxed.*disagree/i.test(text('support')) && /hard pattern/.test(text('support')) && /nonzero dual alone does not prove current disagreement/.test(text('support')));
  var predictSteps = steps.filter(function (q) { return /<details class="predict">/.test(q.text || ''); });
  check('at least four accessible native prediction details interrupt the passive animation', predictSteps.length >= 4
    && predictSteps.every(function (q) { return /<details class="predict"><summary>[^<]+<\/summary><p>[^<]+<\/p><\/details>/.test(q.text); })
    && ['towards', 'listen', 'polytope'].every(function (id) { return predictSteps.some(function (q) { return q.id === id; }); })
    && predictSteps.some(function (q) { return q.chapter === 'A related loop'; }), predictSteps.map(function (q) { return q.id; }).join(','));
  check('prediction answers land after the learner has committed to an idea', ids.indexOf('listen') < ids.indexOf('reply-c0') && /answer is no/i.test(text('reply-c0'))
    && ids.indexOf('polytope') < ids.indexOf('start') && ids.indexOf('start') < ids.indexOf('project1') && /mixture|nearest point|nearest lawful/i.test(text('project1')));
  check('the memory comparison counts 16 directed BP messages and 22 SAPPHIRE values on the open chain', /16/.test(text('keeps')) && /22/.test(text('keeps')) && /three iterations|3 iterations/.test(text('keeps')) && /three circuits|3 circuits/.test(text('keeps')));
  check('the loop ends with a structural conclusion and a no-ranking boundary', /BP passes extrinsic information/.test(text('ends'))
    && /each reply excludes its recipient’s current input/.test(text('ends')) && /one replica variable and one scaled dual per edge/.test(text('ends')) && /not a speed ranking/.test(text('ends')));
  check('the gradient comparison is visibly optional rather than part of the BP-versus-SAPPHIRE core', steps[ids.indexOf('loop-gradient')].chapter === 'Optional: why not one gradient?');
  check('the receiver chapter keeps projection, acceptance and settling claims separate', /never differentiated; they are projected/.test(text('five')) && /Stopping is not convergence/.test(text('stop')) && /cyclic redundancy check \(CRC\)/.test(text('stop')) && /neither stationarity nor a global optimum/.test(text('stop')));
  check('JADE separates and damps extrinsic information without replacing the channel evidence', /Lext = Lpost − Lch/.test(text('roadmap')) && /Lch \+ α Lext/.test(text('roadmap')) && /tanh/.test(text('roadmap')) && /x = 1−2b/.test(text('officer')) && /initialization temperature/.test(text('officer')) && /sum-product BP/.test(text('officer')) && /normalized min-sum/.test(text('officer')) && !/BP → hard word →/.test(all));
  check('message-passing steps are iterations, never sweeps', !/\bsweep/i.test(all) && /iteration/.test(text('loop-bp')));
  check('no measured-frame performance claim appears', !/\bBER\b|bit error rate|outperform|better than/i.test(all));
  // the house rules for wording
  var BANNED = /\b(novel|state-of-the-art|framework|paradigm|leverage|utili[sz]e|in order to|crucial|vital|clearly|obviously|natural(ly)?|elegant|principled|lifting)\b|It is worth noting/i, CONTRACTION = /\b\w+(n’t|n't)\b|\b(it|that|there|let|we|you|they|he|she|what|who)(’|')(s|re|ll|ve|d)\b/i;
  var bad = [];
  steps.forEach(function (q) { var tx = text(q.id) + ' ' + q.title; if (BANNED.test(tx)) bad.push(q.id + ': banned word'); if (CONTRACTION.test(tx)) bad.push(q.id + ': contraction'); if (/!/.test(tx)) bad.push(q.id + ': exclamation'); String(q.text || '').replace(/<[^>]*>/g, '').split(/(?<=[.;:])\s+/).forEach(function (s) { if (s.split(/\s+/).filter(Boolean).length > 35) bad.push(q.id + ': a sentence over 35 words'); }); });
  var ACRO = { BP: 'belief propagation', LLR: 'log-likelihood ratio', OFDM: 'orthogonal frequency-division multiplexing', ADMM: 'alternating direction method of multipliers', CRC: 'cyclic redundancy check' };
  Object.keys(ACRO).forEach(function (a) { var first = steps.filter(function (q) { return new RegExp('\\b' + a + '\\b').test(q.text || ''); })[0]; if (!first || (first.text || '').indexOf(ACRO[a]) < 0) bad.push(a + ' is not expanded where it first appears'); });
  check('wording: no banned words, contractions or exclamations, sentences of at most 35 words, every acronym expanded at first use', bad.length === 0, bad.slice(0, 6).join(' | '));
}

// ---------------------------------------------------------------- 7. the generated standalone page
var buildCheck = '';
try { buildCheck = cp.execFileSync('python3', ['-B', path.join(__dirname, 'build_soldiers.py'), '--check'], { encoding: 'utf8' }); }
catch (e) { buildCheck = String(e.stdout || '') + String(e.stderr || e.message || e); }
check('the standalone HTML is byte-current with its sources', /^ok bp_and_cajode\.html is current/.test(buildCheck.trim()), buildCheck.trim());

console.log(failures ? failures + ' of ' + checks + ' checks FAILED' : 'all ' + checks + ' checks passed');
process.exit(failures ? 1 : 0);
