// The soldiers of the tutorial "The BP protocol and the SAPPHIRE circuit" (bp_and_cajode.html).  The first decoding
// example is a connected, cycle-free six-bit Tanner chain.  The second is the retained six-bit loop from deck p5.  In
// both examples a positive channel LLR favours binary zero.  BP passes sum-product messages, while the known-channel
// reduction of SAPPHIRE keeps one relaxed bit variable, one per-check replica variable per edge and one scaled dual variable per
// edge.  The optional loop detour also retains CORAL's gradient walk.  Plain JavaScript (Node 12 or later).
var Soldiers = (function () {
  function clip(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function atanh(x) { return 0.5 * Math.log((1 + x) / (1 - x)); }
  function prod(a) { var p = 1; for (var i = 0; i < a.length; i++) p *= a[i]; return p; }
  function copyArr(a) { return a.map(function (r) { return Array.isArray(r) ? r.slice() : r; }); }

  // ---------------------------------------------------------------- the counting soldiers (deck p2's formation)
  // The officer O stands next to soldier 1 and adds no soldier; soldier 2 forks to soldiers 3 and 5.
  var COUNT = { nodes: ['O', 1, 2, 3, 4, 5, 6, 7], edges: [['O', 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 7]] };
  function counting() {
    var nb = {}; COUNT.nodes.forEach(function (k) { nb[k] = []; });
    COUNT.edges.forEach(function (e) { nb[e[0]].push(e[1]); nb[e[1]].push(e[0]); });
    var memo = {};
    function own(k) { return k === 'O' ? 0 : 1; }
    function message(i, j) { var key = i + '>' + j; if (!(key in memo)) memo[key] = own(i) + nb[i].filter(function (k) { return k !== j; }).reduce(function (s, k) { return s + message(k, i); }, 0); return memo[key]; }
    var towards = [[4, 3], [3, 2], [7, 6], [6, 5], [5, 2], [2, 1], [1, 'O']], back = [['O', 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 7]];
    var totals = {}; COUNT.nodes.forEach(function (k) { if (k !== 'O') totals[k] = own(k) + nb[k].reduce(function (s, m) { return s + message(m, k); }, 0); });
    return { towards: towards.map(function (e) { return { from: e[0], to: e[1], value: message(e[0], e[1]) }; }), back: back.map(function (e) { return { from: e[0], to: e[1], value: message(e[0], e[1]) }; }), totals: totals, nb: nb };
  }

  // ---------------------------------------------------------------- the parity polytope of a junction
  // The exact Euclidean projection onto the convex hull of the even-weight binary patterns: clip, choose the odd set
  // the clipped point points at, test its one inequality, and bisect on one multiplier (the decks' port of the retained
  // decoder's projection, 52 halvings).
  function projectEven(inp) {
    var n = inp.length, out = inp.map(function (v) { return clip(v, 0, 1); }), signs = out.map(function (v) { return v > 0.5 ? 1 : -1; });
    var positive = signs.filter(function (s) { return s === 1; }).length, closest = 0, k;
    for (k = 1; k < n; k++) if (Math.abs(out[k] - 0.5) < Math.abs(out[closest] - 0.5)) closest = k;
    if (positive % 2 === 0) { signs[closest] = -signs[closest]; positive += signs[closest] === 1 ? 1 : -1; }
    var bound = positive - 1, lhs = -bound; for (k = 0; k < n; k++) lhs += signs[k] * out[k];
    if (lhs <= 0) return { z: out, cut: null, mu: 0, signs: signs };
    var low = 0, high = Math.max.apply(null, inp.map(Math.abs)) + 1;
    for (var it = 0; it < 52; it++) {
      var mu = (low + high) / 2, r = -bound; for (k = 0; k < n; k++) r += signs[k] * clip(inp[k] - mu * signs[k], 0, 1);
      if (r > 0) low = mu; else high = mu;
    }
    var m = (low + high) / 2;
    return { z: inp.map(function (v, j) { return clip(v - m * signs[j], 0, 1); }), cut: signs.slice(), mu: m, signs: signs, bound: bound };
  }
  function evenPatterns(n) { var out = []; for (var m = 0; m < (1 << n); m++) { var p = [], ones = 0; for (var j = 0; j < n; j++) { var bit = (m >> (n - 1 - j)) & 1; p.push(bit); ones += bit; } if (ones % 2 === 0) out.push(p); } return out; }

  // ---------------------------------------------------------------- the connected, cycle-free Tanner chain
  // This is the later loop opened at edge c0--bit0.  Adding that one edge closes the loop used later.  A
  // positive channel LLR favours binary zero, and a junction holds when it contains an even number of binary ones.
  var TREE = { n: 6, checks: [[1, 2], [2, 3, 4], [4, 5, 0]], y: [-0.12, 0.80, 0.16, -0.60, -0.16, -0.16], s2: 0.4,
               sent: [0, 0, 0, 1, 1, 1] };
  TREE.L = TREE.y.map(function (v) { return 2 * v / TREE.s2; });
  function syndrome(word, checks) { return checks.map(function (c) { return c.reduce(function (s, i) { return s + word[i]; }, 0) % 2; }); }
  function valid(word, checks) { return syndrome(word, checks).every(function (v) { return v === 0; }); }
  function checkOf(checks, n) { var out = []; for (var i = 0; i < n; i++) out.push(checks.map(function (c, k) { return c.indexOf(i) >= 0 ? k : -1; }).filter(function (k) { return k >= 0; })); return out; }
  function hardBits(llr) { return llr.map(function (v) { return v >= 0 ? 0 : 1; }); }

  // Flooding sum-product.  V stores variable-to-check messages and U stores check-to-variable messages.  The recipient
  // is excluded in both directions. `bits` is the single binary convention used throughout the BP and SAPPHIRE lesson;
  // `word` retains the equivalent bipolar form only for the optional gradient comparison.
  function bpWalk(T, rule, iterations, stopWhenValid) {
    var checks = T.checks, L = T.L, n = T.n, V = {}, trace = [];
    checks.forEach(function (c, k) { c.forEach(function (i) { V[k + ',' + i] = L[i]; }); });
    for (var s = 1; s <= iterations; s++) {
      var U = {};
      checks.forEach(function (c, k) { c.forEach(function (i) {
        var inc = c.filter(function (j) { return j !== i; }).map(function (j) { return V[k + ',' + j]; });
        if (rule === 'ms') U[k + ',' + i] = T.alpha * prod(inc.map(function (v) { return v >= 0 ? 1 : -1; })) * Math.min.apply(null, inc.map(Math.abs));
        else U[k + ',' + i] = 2 * atanh(clip(prod(inc.map(function (v) { return Math.tanh(v / 2); })), -0.999999999, 0.999999999));
      }); });
      var B = [];
      for (var i = 0; i < n; i++) {
        var total = L[i];
        checks.forEach(function (c, k) { if (c.indexOf(i) >= 0) total += U[k + ',' + i]; });
        B.push(total);
      }
      var bits = hardBits(B), syn = syndrome(bits, checks), oldV = {};
      Object.keys(V).forEach(function (key) { oldV[key] = V[key]; });
      trace.push({ s: s, B: B, U: U, V: oldV, bits: bits, word: bits.map(function (b) { return b ? -1 : 1; }), syn: syn });
      var nextV = {};
      checks.forEach(function (c, k) { c.forEach(function (i) {
        var q = L[i];
        checks.forEach(function (cc, kk) { if (kk !== k && cc.indexOf(i) >= 0) q += U[kk + ',' + i]; });
        nextV[k + ',' + i] = q;
      }); });
      V = nextV;
      if (stopWhenValid && syn.every(function (v) { return v === 0; })) break;
    }
    return trace;
  }

  function treeBP() {
    var trace = bpWalk(TREE, 'sp', 3, false), before = hardBits(TREE.L), acceptedAt = 0;
    trace.forEach(function (h) { if (!acceptedAt && h.syn.every(function (v) { return v === 0; })) acceptedAt = h.s; });
    return { trace: trace, before: before, synBefore: syndrome(before, TREE.checks), acceptedAt: acceptedAt,
             after: trace[acceptedAt - 1].bits.slice(), exact: trace[trace.length - 1].B.slice() };
  }

  // ---------------------------------------------------------------- the SAPPHIRE constraint circuit with the channel known
  // A card is a relaxed bit variable, not a posterior probability.  bitLLR is the bit-zero channel LLR.  Start: cards
  // from hard channel decisions, per-check replica variables projected from them, scaled dual variables zero.  One circuit:
  // update every relaxed bit from the fit and its incident (z-u) terms; project every replica variable; add b-z to
  // every scaled dual variable.  Stop at the first parity-valid hard word in this decoder-only teaching reduction.
  function noteWalk(bitLLR, checks, o) {
    o = o || {}; var rho = o.rho || 3, beta = o.beta == null ? 0.8 : o.beta, budget = o.budget || 200, n = bitLLR.length;
    var deg = checkOf(checks, n).map(function (a) { return a.length; });
    var b = bitLLR.map(function (v) { return v < 0 ? 1 : 0; });
    var z = checks.map(function (c) { return projectEven(c.map(function (i) { return b[i]; })).z; });
    var u = checks.map(function (c) { return c.map(function () { return 0; }); });
    var hist = [{ b: b.slice(), z: copyArr(z), u: copyArr(u), tell: null, sums: null, proj: null, primalRms: null, word: b.map(function (v) { return v >= 0.5 ? 1 : 0; }) }];
    for (var t = 0; t < budget; t++) {
      var tell = []; for (var i = 0; i < n; i++) { var s = 0; checks.forEach(function (c, k) { var j = c.indexOf(i); if (j >= 0) s += z[k][j] - u[k][j]; }); tell.push(s); }
      b = bitLLR.map(function (l, i) { return clip((rho * tell[i] - l - beta) / (rho * deg[i] - 2 * beta), 0, 1); });
      var sums = [], projs = [], sq = 0, edges = 0;
      checks.forEach(function (c, k) {
        var sum = c.map(function (i, j) { return b[i] + u[k][j]; }), pj = projectEven(sum);
        sums.push(sum); projs.push(pj); z[k] = pj.z;
        u[k] = c.map(function (i, j) { return u[k][j] + b[i] - z[k][j]; });
        c.forEach(function (i, j) { var d = b[i] - z[k][j]; sq += d * d; edges++; });
      });
      var word = b.map(function (v) { return v >= 0.5 ? 1 : 0; });
      hist.push({ b: b.slice(), z: copyArr(z), u: copyArr(u), tell: tell, sums: sums, proj: projs, primalRms: Math.sqrt(sq / edges), word: word });
      if (valid(word, checks)) break;
    }
    return { hist: hist, circuits: hist.length - 1, rho: rho, beta: beta, deg: deg, checks: checks };
  }
  function treeNotes() { return noteWalk(TREE.L.slice(), TREE.checks); }

  // ---------------------------------------------------------------- deck p5's loop
  // Positive LLRs favour + (binary zero); a junction holds when the signs of its three soldiers multiply to +.
  var LOOP = { n: 6, checks: [[0, 1, 2], [2, 3, 4], [4, 5, 0]], y: [0.18, 0.54, 1.30, -0.21, 0.70, -0.68], s2: 0.3, sent: [1, 1, 1, -1, -1, -1], muP: 8, muB: 0.2, alpha: 0.8 };
  LOOP.L = LOOP.y.map(function (v) { return 2 * v / LOOP.s2; });
  function signs(v) { return v.map(function (x) { return x >= 0 ? 1 : -1; }); }
  function synSigns(word, checks) { return checks.map(function (c) { return c.reduce(function (s, i) { return s + (1 - word[i]) / 2; }, 0) % 2; }); }
  LOOP.sentBits = LOOP.sent.map(function (v) { return v > 0 ? 0 : 1; });
  // BP on the loop: flooding sum-product with directed messages kept on every edge
  function loopBP(rule, iterations) {
    return bpWalk(LOOP, rule, iterations || 80, true);
  }
  // the note-taking soldier on the loop: a card is a relaxed bit variable, with values near one representing bit one
  function loopNotes() { return noteWalk(LOOP.L.slice(), LOOP.checks); }
  // the gradient soldier on the loop: CORAL's cost, a diagonal preconditioner, backtracking from a step of 0.2, at most
  // 170 steps, stopping when no step lowers the cost
  function objective(x) {
    var T = LOOP, n = T.n, s = 0, i;
    for (i = 0; i < n; i++) s += (T.y[i] - x[i]) * (T.y[i] - x[i]) / (2 * T.s2) + T.muB * Math.pow(1 - x[i] * x[i], 2);
    T.checks.forEach(function (c) { s += T.muP * Math.pow(1 - prod(c.map(function (j) { return x[j]; })), 2); });
    return s / n;
  }
  function gradient(x) {
    var T = LOOP, n = T.n, g = x.map(function (v, i) { return (v - T.y[i]) / (n * T.s2) + 4 * T.muB / n * v * (v * v - 1); }), parts = x.map(function () { return []; });
    T.checks.forEach(function (c, k) {
      var p = prod(c.map(function (j) { return x[j]; }));
      c.forEach(function (i) { var others = prod(c.filter(function (j) { return j !== i; }).map(function (j) { return x[j]; })), d = -2 * T.muP / n * (1 - p) * others; g[i] += d; parts[i].push({ check: k, slope: d }); });
    });
    return { g: g, parts: parts };
  }
  function coral() {
    var T = LOOP, n = T.n, deg = checkOf(T.checks, n).map(function (a) { return a.length; }), D = deg.map(function (d) { return (1 / T.s2 + 2 * T.muP * d + 8 * T.muB) / n; });
    var x = T.L.map(function (v) { return Math.tanh(v / 2); }), trace = [{ it: 0, x: x.slice(), J: objective(x), word: signs(x) }];
    for (var it = 1; it <= 170; it++) {
      var g = gradient(x).g, cur = objective(x), step = 0.2, acc = null;
      for (var bt = 0; bt <= 29; bt++) { var cand = x.map(function (v, i) { return clip(v - step * g[i] / D[i], -1, 1); }); if (objective(cand) < cur - 1e-15) { acc = cand; break; } step *= 0.5; }
      if (!acc) break;
      x = acc; trace.push({ it: it, x: x.slice(), J: objective(x), word: signs(x) });
    }
    return { trace: trace, D: D };
  }
  function hill(stop, steps) {
    var sent = LOOP.sent, out = [];
    for (var k = 0; k <= steps; k++) { var t = k / steps; out.push({ t: t, J: objective(stop.map(function (v, i) { return (1 - t) * v + t * sent[i]; })) }); }
    return out;
  }

  return { COUNT: COUNT, counting: counting, projectEven: projectEven, evenPatterns: evenPatterns, TREE: TREE, LOOP: LOOP, syndrome: syndrome, valid: valid, synSigns: synSigns, checkOf: checkOf,
           hardBits: hardBits, bpWalk: bpWalk, treeBP: treeBP, treeNotes: treeNotes, noteWalk: noteWalk, loopBP: loopBP, loopNotes: loopNotes, coral: coral, objective: objective, gradient: gradient, hill: hill, clip: clip, signs: signs };
})();
if (typeof module !== 'undefined') module.exports = Soldiers;
