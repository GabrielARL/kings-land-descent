// The Jade Keep: the lands and walks of the advanced tutorial (jade_keep_tutorial.html), the second stronghold of
// the tale "Three heroes downhill".  Plain JavaScript without optional chaining, so that Node 12 runs test_keep.js.
//
// Two lands.  (1) The Keep with the Veil lifted: each sentry holds a jade tile b in [0, 1]; its lantern leans it
// with a steady push l (a bit-zero log-likelihood ratio), a ridge beta b (1 - b) tips it toward a notch, and the
// tower's law is that the two tiles agree (the lawful corners 00 and 11, the segment between them).  The Twins'
// circuit on it is, number for number, CAJODE's known-channel kernel decode_llr (joint_cbz_temporal_receiver.jl):
// the bit update with zero curvature, the exact projection onto the check's parity polytope and the scaled dual
// step; test_keep.js checks it against a trace of that Julia code.  (2) The Keep with the Veil down: four windows
// in a row, a Beacon (a known tile) at each end and the two sentries between; every lantern shows its own tile
// through the Veil's thickness c0 plus the spill c1 of its two neighbours.  The Twins learn the Veil while they
// read the lanterns, with the moves of CAJODE's documentation: the Scales (pseudo-Huber weights), one
// Bowl stride for the tiles (the Gershgorin majorizer, eq. bits), the Loom (the exact channel solve) with its
// plumb line (the normal equations' residual), the Wardens and ledgers, and the Herald (the hard word, the law
// and the Seal).  This land is written from the documentation's equations, not from CAJODE's own code.
var Keep = (function () {
  function clip(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function norm(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s); }
  function sub(a, b) { return a.map(function (v, i) { return v - b[i]; }); }
  function add(a, b) { return a.map(function (v, i) { return v + b[i]; }); }
  function copy(o, extra) { var r = {}, k; for (k in o) r[k] = o[k]; for (k in (extra || {})) r[k] = extra[k]; return r; }
  // the tower's law for two tiles: the convex hull of the even words 00 and 11, and the nearest lawful spot
  function projectPair(w) { var t = clip((w[0] + w[1]) / 2, 0, 1); return [t, t]; }
  // the Herald's reading: a tile at or above one half is read as 1 (CAJODE's hard word)
  function hardWord(b) { return b.map(function (v) { return v >= 0.5 ? 1 : 0; }); }
  function sameWord(a, b) { for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  // one tile's track with the Veil lifted: lean l t + ridge beta t (1 - t) + rope rho/2 (t - v)^2 + a guard
  // h/2 (t - b0)^2 (zero with the Veil lifted); its lowest point, caught by the notches 0 and 1
  function tileStep(l, v, rho, beta, h, b0, degree) {
    return clip((rho * v - l - beta + h * b0) / (rho * degree - 2 * beta + h), 0, 1);
  }

  // ---------------------------------------------------------------- the Keep, Veil lifted (one tower, two tiles)
  function keepLand(p) {
    var l = [p.l1, p.l2], beta = p.beta, sent = p.sent.slice();
    function f(b) { return l[0] * b[0] + l[1] * b[1] + beta * (b[0] * (1 - b[0]) + b[1] * (1 - b[1])); }
    function fgrad(b) { return [l[0] + beta * (1 - 2 * b[0]), l[1] + beta * (1 - 2 * b[1])]; }
    function wanderer(v, rho) { return [tileStep(l[0], v[0], rho, beta, 0, 0, 1), tileStep(l[1], v[1], rho, beta, 0, 0, 1)]; }
    // where the tiles start: each the way its lantern leans (CAJODE's hard decision from the LLR)
    var start = [l[0] < 0 ? 1 : 0, l[1] < 0 ? 1 : 0];
    return { kind: 'keep', J: f, f: f, grad: fgrad, fgrad: fgrad, wanderer: wanderer, project: projectPair, box: [0, 1], wanderBox: [0, 1],
             lawSegment: [[0, 0], [1, 1]], leans: l, beta: beta, sent: sent, treasure: sent.slice(), start: start, degree: [1, 1],
             lawful: function (w) { return w[0] === w[1]; }, sealed: function (w) { return sameWord(w, sent); } };
  }

  // The Twins' circuit at the Keep with the Veil lifted, with the Herald at the gate: aim v = z - u, the tiles'
  // lowest points, the Warden's projection of x + u, the ledger u + x - z, then the Herald reads the word.  The
  // walk goes on past the Herald's ride (out.herald) so that the page can show what the Twins would do next.
  function twins(land, p) {
    var rho = p.rho, days = p.days, x = land.start.slice(), z = land.project(x), u = [0, 0], k;
    function read(b) { var w = hardWord(b); return { word: w, lawful: land.lawful(w), sealed: land.sealed(w) }; }
    var r0 = read(x), out = [copy(r0, { x: x, z: z, u: u, J: land.J(x), gap: norm(sub(x, z)), primal: norm(sub(x, z)), dual: 0 })];
    out.herald = r0.sealed ? 0 : null; out.lawfulDay = r0.lawful ? 0 : null;
    for (k = 1; k <= days; k++) {
      var v = sub(z, u), nx = land.wanderer(v, rho), nz = land.project(add(nx, u)), nu = add(u, sub(nx, nz)), r = read(nx);
      var rec = copy(r, { x: nx, z: nz, u: nu, J: land.J(nx), from: x, zFrom: z, uFrom: u, v: v, gap: norm(sub(nx, nz)),
                          primal: norm(sub(nx, nz)), dual: rho * norm(sub(nz, z)), exact: true, path: [x, nx], reach: land.span || 1 });
      out.push(rec);
      if (out.lawfulDay == null && r.lawful) out.lawfulDay = k;
      if (out.herald == null && r.sealed) out.herald = k;
      var still = norm(sub(nx, x)) + norm(sub(nz, z)) + norm(sub(nu, u));
      x = nx; z = nz; u = nu;
      if (still < 1e-13) { out.rest = k; break; }
    }
    out.candle = days;
    return out;
  }

  // ---------------------------------------------------------------- a row of towers (several tiles, Veil lifted)
  // The same kernel on a row of tiles where neighbouring towers share a sentry (checks of two tiles).  Every
  // edge (tower, tile) keeps its own replica z and ledger u, as CAJODE's parity layer does.
  function rowLand(p) {
    var l = p.leans.slice(), beta = p.beta, checks = p.checks.map(function (c) { return c.slice(); }), n = l.length, sent = p.sent.slice();
    var edges = [], degree = l.map(function () { return 0; }), edgesOf = l.map(function () { return []; });
    checks.forEach(function (c, a) { if (c.length !== 2) throw new Error('a tower watches two sentries'); c.forEach(function (i) { edges.push({ check: a, bit: i }); degree[i]++; edgesOf[i].push(edges.length - 1); }); });
    function f(b) { var s = 0; for (var i = 0; i < n; i++) s += l[i] * b[i] + beta * b[i] * (1 - b[i]); return s; }
    function lawful(w) { return checks.every(function (c) { return w[c[0]] === w[c[1]]; }); }
    var start = l.map(function (v) { return v < 0 ? 1 : 0; });
    return { kind: 'row', n: n, leans: l, beta: beta, checks: checks, edges: edges, degree: degree, edgesOf: edgesOf, f: f, J: f, sent: sent, start: start,
             lawful: lawful, sealed: function (w) { return sameWord(w, sent); } };
  }
  function rowTwins(land, p) {
    var rho = p.rho, n = land.n, b = land.start.slice(), z = [], u = [], k;
    // replicas start at the projection of the tiles, ledgers at zero
    land.checks.forEach(function (c) { var t = projectPair([b[c[0]], b[c[1]]]); z.push(t[0], t[1]); u.push(0, 0); });
    function read(q) { var w = hardWord(q); return { word: w, lawful: land.lawful(w), sealed: land.sealed(w) }; }
    var out = [copy(read(b), { b: b.slice(), z: z.slice(), u: u.slice() })];
    out.herald = out[0].sealed ? 0 : null;
    for (k = 1; k <= p.days; k++) {
      var nb = [], advice = [];
      for (var i = 0; i < n; i++) {
        var s = 0; land.edgesOf[i].forEach(function (ei) { s += z[ei] - u[ei]; }); advice.push(s);
        nb.push(clip((rho * s - land.leans[i] - land.beta) / (rho * land.degree[i] - 2 * land.beta), 0, 1));
      }
      var nz = z.slice(), nu = u.slice(), inputs = [];
      land.checks.forEach(function (c, a) {
        var e0 = 2 * a, e1 = 2 * a + 1, w = [nb[c[0]] + u[e0], nb[c[1]] + u[e1]], t = projectPair(w);
        inputs.push(w); nz[e0] = t[0]; nz[e1] = t[1]; nu[e0] = u[e0] + nb[c[0]] - t[0]; nu[e1] = u[e1] + nb[c[1]] - t[1];
      });
      var still = norm(sub(nb, b)) + norm(sub(nz, z)) + norm(sub(nu, u));
      out.push(copy(read(nb), { b: nb, z: nz, u: nu, from: b.slice(), zFrom: z.slice(), uFrom: u.slice(), advice: advice, inputs: inputs }));
      if (out.herald == null && out[out.length - 1].sealed) out.herald = k;
      b = nb; z = nz; u = nu;
      if (still < 1e-13) { out.rest = k; break; }
    }
    return out;
  }

  // ---------------------------------------------------------------- the Keep, Veil down (four windows, two tiles)
  // Windows 0 and 3 hold the Beacons (tiles known, x = +1); windows 1 and 2 the sentries.  A lantern's reading is
  // y_k = c0 x_k + c1 (x_{k-1} + x_{k+1}) + noise.  The expected energy of a window counts the variance that an
  // unsure tile adds (CAJODE's eq. energy), and the pseudo-Huber scale delta turns it into a weight.
  function veilLand(p) {
    var y = p.readings.slice(), kappa = p.kappa, delta = p.delta, beta = p.beta, sent = p.sent.slice(), vn = p.variance || 1;
    var c0 = [(y[0] + y[3]) / 2, 0];                      // the Beacons' reading of the Veil: no spill assumed
    // With CAJODE's unnormalised E = (residual^2 + expected variance)/v and x = 1 - 2b,
    // the coefficient multiplying b at the all-zero word is 4 c0 y/v.  (The complex QPSK model carries its own 1/sqrt(2) scaling.)
    var leans = [4 * c0[0] * y[1] / vn, 4 * c0[0] * y[2] / vn];
    var start = leans.map(function (v) { return v < 0 ? 1 : 0; });
    function xs(b) { return [1, 1 - 2 * b[0], 1 - 2 * b[1], 1]; }
    // the spread an unsure tile adds, 4 b (1 - b); kept at zero outside the track so that the land stays finite on the map
    function vars(b) { return [0, Math.max(0, 4 * b[0] * (1 - b[0])), Math.max(0, 4 * b[1] * (1 - b[1])), 0]; }
    // the design of window k: its own tile and the sum of its neighbours' tiles
    function rows(b) { var x = xs(b), out = []; for (var k = 0; k < 4; k++) out.push([x[k], (k > 0 ? x[k - 1] : 0) + (k < 3 ? x[k + 1] : 0)]); return out; }
    function energies(c, b) {
      var x = xs(b), vv = vars(b), out = [];
      for (var k = 0; k < 4; k++) {
        var hat = c[0] * x[k] + c[1] * ((k > 0 ? x[k - 1] : 0) + (k < 3 ? x[k + 1] : 0));
        var variance = c[0] * c[0] * vv[k] + c[1] * c[1] * ((k > 0 ? vv[k - 1] : 0) + (k < 3 ? vv[k + 1] : 0));
        out.push({ hat: hat, residual: hat - y[k], E: ((hat - y[k]) * (hat - y[k]) + variance) / vn, variance: variance / vn });
      }
      return out;
    }
    function huber(E) { return 2 * delta * delta * (Math.sqrt(1 + E / (delta * delta)) - 1); }
    function weight(E) { return 1 / Math.sqrt(1 + E / (delta * delta)); }
    function weights(c, b) { return energies(c, b).map(function (e) { return weight(e.E); }); }
    function ridge(b) { return beta * (b[0] * (1 - b[0]) + b[1] * (1 - b[1])); }
    function anchor(c) { return kappa / vn * ((c[0] - c0[0]) * (c[0] - c0[0]) + (c[1] - c0[1]) * (c[1] - c0[1])); }
    // the height: the lanterns through the Scales' law, the anchor to the Beacons' Veil, the ridges
    function J(c, b) { var s = 0; energies(c, b).forEach(function (e) { s += huber(e.E); }); return s + anchor(c) + ridge(b); }
    // the weighted height at fixed weights, which touches J at the point the weights were taken (eq. halfquadratic)
    function Q(w, c, b) { var s = 0; energies(c, b).forEach(function (e, k) { s += w[k] * e.E + delta * delta * (1 - w[k]) * (1 - w[k]) / w[k]; }); return s + anchor(c) + ridge(b); }
    // the rope's pull at frozen Warden and ledger; the height under the rope, L = J + rope, is what a stride may not raise
    function rope(b, z, u, rho) { var d0 = b[0] - z[0] + u[0], d1 = b[1] - z[1] + u[1]; return rho / 2 * (d0 * d0 + d1 * d1); }
    // the slope of the weighted fit in the tiles and the Bowl's curvature (the Gershgorin guard, 4 D - 2 vc)
    function bitSlope(w, c, b) {
      var x = xs(b), en = energies(c, b), g = [0, 0], h = [0, 0];
      // the coefficient of tile l in window k: C[k][l]; windows 1 and 2 see both sentries
      var Cm = [[c[1], 0], [c[0], c[1]], [c[1], c[0]], [0, c[1]]];
      for (var l = 0; l < 2; l++) {
        var gx = 0, off = 0;
        for (var k = 0; k < 4; k++) {
          var Ckl = Cm[k][l]; if (!Ckl) continue;
          gx += w[k] / vn * (2 * en[k].residual * Ckl - 2 * Ckl * Ckl * x[l + 1]);
          var Ckm = Cm[k][1 - l]; off += 2 * w[k] / vn * Math.abs(Ckl * Ckm);
        }
        g[l] = -2 * gx; h[l] = 4 * off;
      }
      return { g: g, h: h };
    }
    // the Loom: at fixed weights and tiles the Veil's cost is a bowl; its bottom by the normal equations
    function loom(w, b) {
      var A = rows(b), vv = vars(b), M = [[kappa / vn, 0], [0, kappa / vn]], r = [kappa / vn * c0[0], kappa / vn * c0[1]];
      for (var k = 0; k < 4; k++) {
        var a = A[k], V0 = vv[k], V1 = (k > 0 ? vv[k - 1] : 0) + (k < 3 ? vv[k + 1] : 0), wk = w[k] / vn;
        M[0][0] += wk * (a[0] * a[0] + V0); M[0][1] += wk * a[0] * a[1]; M[1][0] += wk * a[0] * a[1]; M[1][1] += wk * (a[1] * a[1] + V1);
        r[0] += wk * y[k] * a[0]; r[1] += wk * y[k] * a[1];
      }
      var det = M[0][0] * M[1][1] - M[0][1] * M[1][0], c = [(M[1][1] * r[0] - M[0][1] * r[1]) / det, (M[0][0] * r[1] - M[1][0] * r[0]) / det];
      var plumb = norm([M[0][0] * c[0] + M[0][1] * c[1] - r[0], M[1][0] * c[0] + M[1][1] * c[1] - r[1]]);
      return { c: c, M: M, r: r, plumb: plumb };
    }
    function veilCost(w, b, c) { var s = 0; energies(c, b).forEach(function (e, k) { s += w[k] * e.E; }); return s + anchor(c); }
    return { kind: 'veil', y: y, c0: c0, kappa: kappa, delta: delta, beta: beta, variance: vn, sent: sent, leans: leans, start: start, treasure: sent.slice(),
             xs: xs, energies: energies, huber: huber, weight: weight, weights: weights, J: J, Q: Q, ridge: ridge, anchor: anchor,
             bitSlope: bitSlope, loom: loom, veilCost: veilCost, rope: rope, project: projectPair, lawSegment: [[0, 0], [1, 1]], box: [0, 1],
             lawful: function (wd) { return wd[0] === wd[1]; }, sealed: function (wd) { return sameWord(wd, sent); } };
  }

  // One circuit at the Keep with the Veil down, in CAJODE's order: Scales, tiles (one Bowl stride), Scales, Loom,
  // Wardens, ledgers, then the Herald.  Each block carries its certificate: the height must not rise at the
  // tiles' stride or at the Loom, and the Loom's plumb line must hang true (residual within 1e-10).
  function veilTwins(land, p) {
    var rho = p.rho, beta = land.beta, days = p.days, tol = 1e-10;
    var c = land.c0.slice(), b = land.start.slice(), z = land.project(b), u = [0, 0], k;
    function read(q) { var w = hardWord(q); return { word: w, lawful: land.lawful(w), sealed: land.sealed(w) }; }
    var out = [copy(read(b), { b: b, x: b, c: c, z: z, u: u, J: land.J(c, b), w: land.weights(c, b), gap: norm(sub(b, z)), primal: norm(sub(b, z)), dual: 0 })];
    out.herald = out[0].sealed ? 0 : null; out.lawfulDay = out[0].lawful ? 0 : null; out.failed = null;
    for (k = 1; k <= days; k++) {
      var w1 = land.weights(c, b), sl = land.bitSlope(w1, c, b), v = sub(z, u), r0 = land.rope(b, z, u, rho);
      var J0 = land.J(c, b), L0 = J0 + r0, Q0 = land.Q(w1, c, b) + r0;
      var nb = [0, 1].map(function (l) { return tileStep(sl.g[l], v[l], rho, beta, sl.h[l], b[l], 1); });
      var ground = [0, 1].map(function (l) { return tileStep(sl.g[l], v[l], rho, beta, 0, b[l], 1); });   // the track's own bottom
      var r1 = land.rope(nb, z, u, rho), J1 = land.J(c, nb), L1 = J1 + r1, Q1 = land.Q(w1, c, nb) + r1;
      var bitOk = L1 <= L0 + tol * Math.max(1, Math.abs(L0)) && Q1 <= Q0 + tol * Math.max(1, Math.abs(Q0));
      var w2 = land.weights(c, nb), lm = land.loom(w2, nb), nc = lm.c, J2 = land.J(nc, nb), L2 = J2 + r1;
      var loomOk = lm.plumb <= tol && L2 <= L1 + tol * Math.max(1, Math.abs(L1));
      var nz = land.project(add(nb, u)), nu = add(u, sub(nb, nz)), r = read(nb);
      var rec = copy(r, { b: nb, x: nb, c: nc, z: nz, u: nu, from: b, cFrom: c, zFrom: z, uFrom: u, v: v, w1: w1, w2: w2, E1: land.energies(c, b), E2: land.energies(c, nb),
                          g: sl.g, h: sl.h, ground: ground, J0: J0, J1: J1, J2: J2, L0: L0, L1: L1, L2: L2, Q0: Q0, Q1: Q1, J: J2, loom: lm, bitOk: bitOk, loomOk: loomOk,
                          gap: norm(sub(nb, nz)), primal: norm(sub(nb, nz)), dual: rho * norm(sub(nz, z)), path: [b, nb] });
      out.push(rec);
      if (!bitOk || !loomOk) { out.failed = k; break; }
      if (out.lawfulDay == null && r.lawful) out.lawfulDay = k;
      if (out.herald == null && r.sealed) out.herald = k;
      var still = norm(sub(nb, b)) + norm(sub(nz, z)) + norm(sub(nu, u)) + norm(sub(nc, c));
      b = nb; c = nc; z = nz; u = nu;
      if (still < 1e-13) { out.rest = k; break; }
    }
    out.candle = days;
    return out;
  }

  // ---------------------------------------------------------------- the lands as the tale starts them
  var PRESETS = {
    // the Keep with the Veil lifted: the lanterns' leans (bit-zero LLRs), CAJODE's ridge and rope, the sent word
    keep: { l1: 1.0, l2: -0.6, beta: 0.8, rho: 3, days: 200, sent: [0, 0] },
    // the row of two towers sharing the middle sentry
    row: { leans: [1.2, -0.5, 0.9], beta: 0.8, rho: 3, days: 200, checks: [[0, 1], [1, 2]], sent: [0, 0, 0] },
    // the Keep with the Veil down: the four lanterns' readings (Beacon, sentry, sentry, Beacon), the anchor weight,
    // the Scales' scale delta (CAJODE's fixed values), the ridge, the rope, the sent word
    veil: { readings: [1.15, 1.0, -0.3, 0.85], variance: 1, kappa: 4, delta: 0.926, beta: 0.8, rho: 3, days: 200, sent: [0, 0], truth: [1.0, 0.25] }
  };
  var VIEW = [-0.22, 1.22, -0.22, 1.22];
  function build(key, over) {
    var p = copy(PRESETS[key], over);
    if (key === 'keep') { var land = keepLand(p); land.view = VIEW; land.span = VIEW[1] - VIEW[0]; land.h = 0.01; land.sigma = 0; land.seed = 1; land.exactStep = true; return { key: key, p: p, land: land, view: VIEW, walk: twins(land, p) }; }
    if (key === 'row') { var rl = rowLand(p); return { key: key, p: p, land: rl, walk: rowTwins(rl, p) }; }
    var vl = veilLand(p); vl.view = VIEW; vl.span = VIEW[1] - VIEW[0]; return { key: key, p: p, land: vl, view: VIEW, walk: veilTwins(vl, p) };
  }

  return { keepLand: keepLand, twins: twins, rowLand: rowLand, rowTwins: rowTwins, veilLand: veilLand, veilTwins: veilTwins, build: build,
           PRESETS: PRESETS, VIEW: VIEW, hardWord: hardWord, projectPair: projectPair, tileStep: tileStep, norm: norm, sub: sub, add: add, clip: clip };
})();
if (typeof module !== 'undefined') module.exports = Keep;
