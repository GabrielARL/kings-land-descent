// The torn-net case study of the tutorial "Finding the tear" (finding_the_tear.html): an ROV photographs a patch
// of a salmon-cage net; the inspector must find the broken twines and say which meshes they open, counted from a
// numbered tag on the side rope.  Unknowns: the image position of every knot (the net bellies in the current) and
// the broken-or-intact state of every twine.  Soft terms: the knot detections (robust, pseudo-Huber), the twine
// evidence read from the image along each predicted twine, a prior against breaks.  Geometric constraints: each
// mesh is a parallelogram, the rope's column lies on the rope, and the tagged knot sits on the tag.  The positions
// use an ADMM-style split into shared knots and one projected copy per geometric rule.  The binary twine states do
// not have copies or parity constraints: each is updated by an LLR threshold.  Plain JavaScript without optional
// chaining (Node 12).
var Net = (function () {
  var TAU = 2 * Math.PI;
  function norm(a) { return Math.hypot(a[0], a[1]); }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function scale(a, s) { return [a[0] * s, a[1] * s]; }
  function copy(o, extra) { var r = {}, k; for (k in o) r[k] = o[k]; for (k in (extra || {})) r[k] = extra[k]; return r; }
  function stream(seed) {
    var a = (seed >>> 0) || 1;
    function u() { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    return { u: u, normal: function () { return Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(TAU * u()); } };
  }

  // ---------------------------------------------------------------- the lattice
  // Model knots (i, j) for i, j in 0..n-1; twines between lattice neighbours; meshes (i, j) for i, j in 0..n-2
  // with knots a = (i, j), b = (i+1, j), c = (i+1, j+1), d = (i, j+1), in that order round the mesh.
  function lattice(n) {
    var knots = [], index = {}, twines = [], meshes = [], i, j;
    for (j = 0; j < n; j++) for (i = 0; i < n; i++) { index[i + ',' + j] = knots.length; knots.push({ i: i, j: j }); }
    function K(i, j) { return index[i + ',' + j]; }
    for (j = 0; j < n; j++) for (i = 0; i < n; i++) {
      if (i + 1 < n) twines.push({ a: K(i, j), b: K(i + 1, j), i: i, j: j, dir: 'h' });
      if (j + 1 < n) twines.push({ a: K(i, j), b: K(i, j + 1), i: i, j: j, dir: 'v' });
    }
    function T(i, j, dir) { for (var e = 0; e < twines.length; e++) if (twines[e].i === i && twines[e].j === j && twines[e].dir === dir) return e; return -1; }
    for (j = 0; j + 1 < n; j++) for (i = 0; i + 1 < n; i++) meshes.push({ i: i, j: j, knots: [K(i, j), K(i + 1, j), K(i + 1, j + 1), K(i, j + 1)], twines: [T(i, j, 'h'), T(i + 1, j, 'v'), T(i, j + 1, 'h'), T(i, j, 'v')] });
    var twinesOf = knots.map(function () { return []; }); twines.forEach(function (t, e) { twinesOf[t.a].push(e); twinesOf[t.b].push(e); });
    var meshesOf = knots.map(function () { return []; }); meshes.forEach(function (m, k) { m.knots.forEach(function (kn) { meshesOf[kn].push(k); }); });
    return { n: n, knots: knots, K: K, T: T, twines: twines, meshes: meshes, twinesOf: twinesOf, meshesOf: meshesOf };
  }
  // where the net really is: the column on the side rope is straight, and the rows sag more and more away from it
  // (every column is shifted as a whole, so each mesh stays a parallelogram: the law holds exactly for the true net)
  function trueKnot(p, i, j) { return [i, j - p.belly * Math.sin(Math.PI * i / (2 * (p.n - 1)))]; }

  // ---------------------------------------------------------------- the image
  // A raster of intensities over the region, with the real lattice drawn beyond the model's patch (the net goes on
  // past the picture), the rope, the tag, two fish, and noise.  Read by bilinear interpolation: that rule is what
  // makes the evidence a defined function of the knot positions.
  function raster(p, broken, r) {
    var N = p.pixels, R = p.region, w = R[1] - R[0], img = new Float32Array(N * N), lines = [];
    var lo = -p.beyond, hi = p.n - 1 + p.beyond;
    for (var j = lo; j <= hi; j++) for (var i = lo; i <= hi; i++) {
      var a = trueKnot(p, i, j);
      if (i + 1 <= hi) { var bb = trueKnot(p, i + 1, j); if (!isBroken(broken, i, j, 'h', p.n)) lines.push([a, bb]); }
      if (j + 1 <= hi) { var cc = trueKnot(p, i, j + 1); if (!isBroken(broken, i, j, 'v', p.n)) lines.push([a, cc]); }
    }
    function segDist(q, s) { var d = sub(s[1], s[0]), L2 = d[0] * d[0] + d[1] * d[1], t = L2 ? Math.max(0, Math.min(1, ((q[0] - s[0][0]) * d[0] + (q[1] - s[0][1]) * d[1]) / L2)) : 0; return norm(sub(q, add(s[0], scale(d, t)))); }
    var tag = trueKnot(p, 0, 0), fish = p.fish;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var q = [R[0] + w * (x + 0.5) / N, R[2] + w * (y + 0.5) / N], v = p.background;
      for (var l = 0; l < lines.length; l++) { var dd = segDist(q, lines[l]); if (dd < 0.35) v += p.twineBright * Math.exp(-dd * dd / (2 * p.twineWidth * p.twineWidth)); }
      var dr = Math.abs(q[0] - 0); if (q[1] > lo - 0.5 && q[1] < hi + 0.5) v += p.ropeBright * Math.exp(-dr * dr / (2 * p.ropeWidth * p.ropeWidth));
      var dt = norm(sub(q, tag)); if (dt < p.tagRadius) v = Math.max(v, p.tagBright);
      fish.forEach(function (f) { var fx = (q[0] - f[0]) / f[2], fy = (q[1] - f[1]) / f[3]; v += f[4] * Math.exp(-(fx * fx + fy * fy) / 2); });
      img[y * N + x] = v + p.noise * r.normal();
    }
    return { N: N, region: R, data: img };
  }
  function isBroken(broken, i, j, dir, n) { for (var k = 0; k < broken.length; k++) if (broken[k].i === i && broken[k].j === j && broken[k].dir === dir) return true; return false; }
  // the sampling rule: bilinear interpolation of the raster; outside the picture the background
  function sample(im, q, background) {
    var N = im.N, R = im.region, w = R[1] - R[0], fx = (q[0] - R[0]) / w * N - 0.5, fy = (q[1] - R[2]) / w * N - 0.5;
    if (fx < 0 || fy < 0 || fx > N - 1 || fy > N - 1) return background;
    var x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(N - 1, x0 + 1), y1 = Math.min(N - 1, y0 + 1), tx = fx - x0, ty = fy - y0, d = im.data;
    return d[y0 * N + x0] * (1 - tx) * (1 - ty) + d[y0 * N + x1] * tx * (1 - ty) + d[y1 * N + x0] * (1 - tx) * ty + d[y1 * N + x1] * tx * ty;
  }
  // the evidence of a twine between knot positions a and b: the mean of nine samples along the predicted twine,
  // turned into a log-likelihood ratio intact against broken under the two intensity models
  function evidence(im, a, b, p, sigma) {
    var s = sigma == null ? p.noise : sigma, mu1 = p.background + p.twineBright, mu0 = p.background, sum = 0, n = p.samples, vals = [];
    for (var k = 0; k < n; k++) { var t = (k + 0.5) / n * 0.8 + 0.1, q = add(a, scale(sub(b, a), t)), v = sample(im, q, p.background); vals.push(v); sum += (mu1 - mu0) * (2 * v - mu0 - mu1) / (2 * s * s); }
    // neighbouring samples see the same blur, so the nine count as p.effective independent looks
    return { llr: sum * p.effective / n, mean: vals.reduce(function (x, y) { return x + y; }, 0) / n, samples: vals };
  }

  // ---------------------------------------------------------------- the knot detections and the tag
  // The detector sees every knot in the picture, the model's patch and the net beyond it alike (knot: the model's
  // index, -2 for a real knot outside the patch, -1 for a false detection); a few knots are missed.
  function detections(p, lat, r) {
    var out = [], miss = {}, m, R = p.region, lo = -p.beyond, hi = p.n - 1 + p.beyond;
    for (m = 0; m < p.misses; m++) miss[Math.floor(r.u() * lat.knots.length)] = true;
    for (var j = lo; j <= hi; j++) for (var i = lo; i <= hi; i++) {
      var q = trueKnot(p, i, j); if (q[0] < R[0] + 0.2 || q[0] > R[1] - 0.2 || q[1] < R[2] + 0.2 || q[1] > R[3] - 0.2) continue;
      var inside = i >= 0 && i < p.n && j >= 0 && j < p.n, idx = inside ? lat.K(i, j) : -2; if (inside && miss[idx]) continue;
      out.push({ q: [q[0] + p.detectNoise * r.normal(), q[1] + p.detectNoise * r.normal()], knot: idx });
    }
    for (m = 0; m < p.spurious; m++) out.push({ q: [p.region[0] + 0.3 + (p.region[1] - p.region[0] - 0.6) * r.u(), p.region[2] + 0.3 + (p.region[3] - p.region[2] - 0.6) * r.u()], knot: -1 });
    var tag = trueKnot(p, 0, 0);
    return { knots: out, tag: [tag[0] + p.tagNoise * r.normal(), tag[1] + p.tagNoise * r.normal()], misses: Object.keys(miss).map(Number) };
  }
  function nearest(dets, q) { var best = -1, bd2 = Infinity; for (var k = 0; k < dets.length; k++) { var dx = dets[k].q[0] - q[0], dy = dets[k].q[1] - q[1], d2 = dx * dx + dy * dy; if (d2 < bd2) { bd2 = d2; best = k; } } return { k: best, d: Math.sqrt(bd2) }; }
  function huberWeight(E, delta) { return 1 / Math.sqrt(1 + E / (delta * delta)); }
  // phi(E) and its IRLS weight satisfy phi'(E) = weight(E)/2, so w*E/2 is the tangent quadratic surrogate.
  function huber(E, delta) { return delta * delta * (Math.sqrt(1 + E / (delta * delta)) - 1); }

  // ---------------------------------------------------------------- the case
  function build(over) {
    var p = copy(PRESET, over), r = stream(p.seed), lat = lattice(p.n);
    var broken = p.broken.map(function (b) { return copy(b); });
    var im = raster(p, broken, r), det = detections(p, lat, r);
    var truth = lat.knots.map(function (k) { return trueKnot(p, k.i, k.j); });
    var brokenIds = broken.map(function (b) { return lat.T(b.i, b.j, b.dir); });
    var d = { p: p, lat: lat, image: im, det: det, truth: truth, broken: broken, brokenIds: brokenIds, ropeX: 0 };
    d.closeup = raster(copy(p, { noise: p.closeNoise }), broken, stream(p.seed + 99));   // the close-up: a second, quieter look
    d.solution = solve(d, p);
    if (p.counterfactual) d.noTag = solve(d, copy(p, { anchors: false, startShift: [1, 0], maxRounds: p.maxRounds }));
    return d;
  }

  // ---------------------------------------------------------------- the solver
  // Laws, each with copies z and ledgers u of the knots it involves:
  //   mesh        the four knots form a parallelogram: a + c = b + d
  //   rope        a knot of column 0 has x = ropeX
  //   tag         the knot (0, 0) sits on the rope at the tag's height
  function laws(d, p) {
    var lat = d.lat, out = [];
    lat.meshes.forEach(function (m, k) { out.push({ kind: 'mesh', mesh: k, at: m.knots.slice() }); });
    if (p.anchors !== false) {
      for (var j = 0; j < lat.n; j++) out.push({ kind: 'rope', at: [lat.K(0, j)] });
      out.push({ kind: 'tag', at: [lat.K(0, 0)] });
    }
    return out;
  }
  function project(law, pts, d) {
    if (law.kind === 'mesh') { var g = scale(sub(add(pts[0], pts[2]), add(pts[1], pts[3])), 0.25); return [sub(pts[0], g), add(pts[1], g), sub(pts[2], g), add(pts[3], g)]; }
    if (law.kind === 'rope') return [[d.ropeX, pts[0][1]]];
    return [[d.ropeX, d.det.tag[1]]];   // the tag fixes the height of knot (0, 0) on the rope
  }
  // the cost of one knot's position at frozen weights, twine states and ropes: the detection fit, the evidence of
  // its twines, and the ropes to its copies' aims
  function knotCost(d, p, q, idx, b, pos, w, assoc, aims) {
    var c = 0, det = d.det.knots;
    if (assoc[idx] >= 0) { var r = sub(q, det[assoc[idx]].q); c += w[idx] * (r[0] * r[0] + r[1] * r[1]) / (2 * p.detectNoise * p.detectNoise); }
    d.lat.twinesOf[idx].forEach(function (e) { var t = d.lat.twines[e], a = t.a === idx ? q : pos[t.a], bb = t.b === idx ? q : pos[t.b], ev = evidence(d.image, a, bb, p); c += (1 - b[e]) * (-ev.llr); });
    for (var k = 0; k < aims.length; k++) { var dx = q[0] - aims[k][0], dy = q[1] - aims[k][1]; c += p.rho / 2 * (dx * dx + dy * dy); }
    return c;
  }
  // the knot step: first the exact lowest point of the quadratic parts (the detection and the ropes, the Loom of this
  // problem), then a short walk with four taps of the staff for the sampled image term, each stride tested
  function walkKnot(d, p, idx, b, pos, w, assoc, aims) {
    var s2 = p.detectNoise * p.detectNoise, wd = assoc[idx] >= 0 ? w[idx] / s2 : 0, det = assoc[idx] >= 0 ? d.det.knots[assoc[idx]].q : [0, 0];
    var num = [wd * det[0], wd * det[1]], den = wd; aims.forEach(function (a) { num[0] += p.rho * a[0]; num[1] += p.rho * a[1]; den += p.rho; });
    var q = den > 0 ? [num[0] / den, num[1] / den] : pos[idx].slice(), quad = q.slice();
    var h = p.tap, step = p.stride, cost = knotCost(d, p, q, idx, b, pos, w, assoc, aims), path = [pos[idx].slice(), q.slice()];
    if (knotCost(d, p, pos[idx], idx, b, pos, w, assoc, aims) < cost) { q = pos[idx].slice(); cost = knotCost(d, p, q, idx, b, pos, w, assoc, aims); path = [q.slice()]; }
    for (var it = 0; it < p.strides; it++) {
      var gx = (knotCost(d, p, [q[0] + h, q[1]], idx, b, pos, w, assoc, aims) - knotCost(d, p, [q[0] - h, q[1]], idx, b, pos, w, assoc, aims)) / (2 * h);
      var gy = (knotCost(d, p, [q[0], q[1] + h], idx, b, pos, w, assoc, aims) - knotCost(d, p, [q[0], q[1] - h], idx, b, pos, w, assoc, aims)) / (2 * h);
      var gn = Math.hypot(gx, gy); if (gn < 1e-9) break;
      var moved = false;
      for (var tries = 0; tries < 8; tries++) { var nq = [q[0] - step * gx / gn, q[1] - step * gy / gn], nc = knotCost(d, p, nq, idx, b, pos, w, assoc, aims); if (nc < cost) { q = nq; cost = nc; path.push(q.slice()); moved = true; step *= 1.3; break; } step *= 0.5; }
      if (!moved) break;
    }
    return { q: q, cost: cost, path: path, quad: quad };
  }
  function solve(d, p) {
    var lat = d.lat, L = laws(d, p), nK = lat.knots.length, nE = lat.twines.length, k, e;
    function llrs(xs, im, sigma) { return lat.twines.map(function (t) { return evidence(im, xs[t.a], xs[t.b], p, sigma).llr; }); }
    // Maximum distance, in mesh spacings, from the shared positions to the nearest point in each local geometry set.
    // For a mesh this per-corner distance is one quarter of ||a+c-b-d||.  It is not an ADMM residual.
    function lawDistance(xs) { var v = 0; L.forEach(function (law) { var pts = law.at.map(function (i) { return xs[i]; }), pj = project(law, pts, d); pts.forEach(function (q, j) { v = Math.max(v, norm(sub(q, pj[j]))); }); }); return v; }
    function assocOf(xs) { return xs.map(function (q) { var nr = nearest(d.det.knots, q); return nr.d < p.gate ? nr.k : -1; }); }
    function weightsOf(xs, assoc) { return xs.map(function (q, i) { if (assoc[i] < 0) return 0; var r = sub(q, d.det.knots[assoc[i]].q); return huberWeight((r[0] * r[0] + r[1] * r[1]) / (p.detectNoise * p.detectNoise), p.delta); }); }
    function word(bb) { return bb.map(function (v) { return v >= 0.5 ? 1 : 0; }); }
    function openMeshes(wd) { var out = []; lat.meshes.forEach(function (m, i) { if (m.twines.some(function (t) { return wd[t] === 1; })) out.push(i); }); return out; }
    function regError(xs) { var m = 0; xs.forEach(function (q, i) { m = Math.max(m, norm(sub(q, d.truth[i]))); }); return m; }
    function geometry(xs) {
      var meshGap = 0, ropeResidual = 0, tagResidual = 0;
      lat.meshes.forEach(function (m) { var q = m.knots.map(function (i) { return xs[i]; }); meshGap = Math.max(meshGap, norm(sub(add(q[0], q[2]), add(q[1], q[3])))); });
      if (p.anchors !== false) {
        for (var j = 0; j < lat.n; j++) ropeResidual = Math.max(ropeResidual, Math.abs(xs[lat.K(0, j)][0] - d.ropeX));
        tagResidual = norm(sub(xs[lat.K(0, 0)], [d.ropeX, d.det.tag[1]]));
      }
      return { projectionCorrection: lawDistance(xs), meshClosure: meshGap, ropeResidual: ropeResidual, tagResidual: tagResidual };
    }
    function xBlockCost(xs, bb, w, assoc, aims) {
      var c = 0;
      xs.forEach(function (q, i) {
        if (assoc[i] >= 0) { var r = sub(q, d.det.knots[assoc[i]].q); c += w[i] * (r[0] * r[0] + r[1] * r[1]) / (2 * p.detectNoise * p.detectNoise); }
        aims[i].forEach(function (a) { var r = sub(q, a); c += p.rho * (r[0] * r[0] + r[1] * r[1]) / 2; });
      });
      lat.twines.forEach(function (t, e) { c += (1 - bb[e]) * (-evidence(d.image, xs[t.a], xs[t.b], p).llr); });
      return c;
    }
    function consensus(xs, zz, zPrev, uu) {
      var primal2 = 0, copyMax = 0, accum = xs.map(function () { return [0, 0]; }), dual2 = 0, dualScaled2 = 0;
      L.forEach(function (law, li) { law.at.forEach(function (i, j) {
        var r = sub(xs[i], zz[li][j]), rn = norm(r); primal2 += rn * rn; copyMax = Math.max(copyMax, rn);
        if (zPrev) { var dz = sub(zz[li][j], zPrev[li][j]); accum[i][0] += dz[0]; accum[i][1] += dz[1]; }
      }); });
      if (zPrev) accum.forEach(function (q) { dualScaled2 += q[0] * q[0] + q[1] * q[1]; });
      dual2 = p.rho * p.rho * dualScaled2;
      var occurrences = L.reduce(function (s, law) { return s + law.at.length; }, 0);
      return { primal: Math.sqrt(primal2), primalRms: Math.sqrt(primal2 / Math.max(1, 2 * occurrences)), copyMax: copyMax,
               dual: zPrev ? Math.sqrt(dual2) : null, dualOverRho: zPrev ? Math.sqrt(dualScaled2) : null,
               scaledDualNorm: Math.sqrt(uu.reduce(function (s, row) { return s + row.reduce(function (t, q) { return t + q[0] * q[0] + q[1] * q[1]; }, 0); }, 0)) };
    }
    // the close-up: the flagged meshes are looked at again, close and quiet, and each of their twines is resolved
    // where it really is (a close look settles a twine whatever our registration says); the report is accepted
    // when every twine of every flagged mesh reads in the close-up as the word says
    function closeup(xs, wd) {
      var open = openMeshes(wd); if (!open.length) return { checked: 0, agreed: 0, accepted: false, open: open, total: nE, usesHiddenTruth: true };
      var ll = llrs(d.truth, d.closeup, p.closeNoise), checked = 0, agreed = 0, twinesSeen = {}; void xs;
      open.forEach(function (mi) { lat.meshes[mi].twines.forEach(function (t) { if (twinesSeen[t]) return; twinesSeen[t] = true; checked++; var says = ll[t] + p.prior < 0 ? 1 : 0; if (says === wd[t]) agreed++; }); });
      return { checked: checked, agreed: agreed, accepted: agreed === checked, open: open, total: nE, usesHiddenTruth: true };
    }
    // start: a rigid lattice of the known mesh size from the tag (or shifted, for the counterfactual); the twines
    // start as their first reading says
    var start = d.det.tag.slice(); if (p.startShift) start = add(start, p.startShift);
    var pos = lat.knots.map(function (kn) { return [start[0] + kn.i * p.mesh, start[1] + kn.j * p.mesh]; });
    var b = [], l00 = llrs(pos, d.image); for (e = 0; e < nE; e++) b.push(l00[e] + p.prior < 0 ? 1 : 0);
    var z = L.map(function (law) { return project(law, law.at.map(function (i) { return pos[i]; }), d); });
    var u = L.map(function (law) { return law.at.map(function () { return [0, 0]; }); });
    var out = { laws: L, rounds: [], accepted: null, admissible: null, feasible: null, stopReason: null };
    var l0 = llrs(pos, d.image), w0 = word(b), assoc0 = assocOf(pos);
    var flagged0 = []; for (e = 0; e < nE; e++) if (w0[e]) flagged0.push(e);
    var con0 = consensus(pos, z, null, u), law0 = lawDistance(pos);
    out.rounds.push({ pos: pos.map(function (q) { return q.slice(); }), b: b.slice(), llr: l0, word: w0, open: openMeshes(w0),
      lawDistance: law0, violation: law0, geometry: geometry(pos), consensus: con0, regError: regError(pos), assoc: assoc0, assocBefore: assoc0, weights: weightsOf(pos, assoc0), weightsBefore: weightsOf(pos, assoc0),
      z: z, u: u, closeup: null, flagged: flagged0, moved: null, dz: null, blockCostBefore: null, blockCostAfter: null });
    for (k = 1; k <= p.maxRounds; k++) {
      var assoc = assocOf(pos), w = weightsOf(pos, assoc);
      var aims = pos.map(function () { return []; }); L.forEach(function (law, li) { law.at.forEach(function (i, j) { aims[i].push(sub(z[li][j], u[li][j])); }); });
      // One sequential coordinate sweep.  Each accepted coordinate move lowers the same frozen x-block surrogate,
      // because later knots see the already-updated earlier neighbours.
      var npos = pos.map(function (q) { return q.slice(); }), walks = [], blockBefore = xBlockCost(pos, b, w, assoc, aims);
      for (var i = 0; i < nK; i++) { var wk = walkKnot(d, p, i, b, npos, w, assoc, aims[i]); npos[i] = wk.q; walks.push(wk); }
      var blockAfter = xBlockCost(npos, b, w, assoc, aims);
      var ll = llrs(npos, d.image), nb = [];
      for (e = 0; e < nE; e++) nb.push(ll[e] + p.prior < 0 ? 1 : 0);   // no law shares a twine: its step is a threshold on evidence plus prior
      var nz = L.map(function (law, li) { return project(law, law.at.map(function (i, j) { return add(npos[i], u[li][j]); }), d); });
      var nu = L.map(function (law, li) { return law.at.map(function (i, j) { return add(u[li][j], sub(npos[i], nz[li][j])); }); });
      var dz = 0; L.forEach(function (law, li) { law.at.forEach(function (i, j) { dz = Math.max(dz, norm(sub(nz[li][j], z[li][j]))); }); });
      var moved = 0; npos.forEach(function (q, i) { moved = Math.max(moved, norm(sub(q, pos[i]))); });
      var wd = word(nb), cu = closeup(npos, wd), flagged = []; for (e = 0; e < nE; e++) if (wd[e]) flagged.push(e);
      var lawDist = lawDistance(npos), con = consensus(npos, nz, z, nu);
      var rec = { pos: npos, b: nb, llr: ll, word: wd, open: openMeshes(wd), lawDistance: lawDist, violation: lawDist,
        geometry: geometry(npos), consensus: con, regError: regError(npos), assoc: assoc, assocBefore: assoc, weights: w, weightsBefore: w, aims: aims, walks: walks, z: nz, u: nu,
        dz: dz, moved: moved, closeup: cu, flagged: flagged, blockCostBefore: blockBefore, blockCostAfter: blockAfter };
      out.rounds.push(rec);
      pos = npos; b = nb; z = nz; u = nu;
      if (out.admissible == null && rec.lawDistance <= p.tol) out.admissible = out.feasible = k;
      if (cu.accepted && rec.lawDistance <= p.tol) { out.accepted = k; out.stopReason = 'verified geometry'; break; }
      if (rec.lawDistance <= p.tol && dz <= p.tol && moved <= p.tol) { out.stopReason = 'small geometry and iterate changes'; break; }
    }
    if (!out.stopReason) out.stopReason = 'round limit';
    out.final = out.rounds[out.rounds.length - 1]; out.pos = pos; out.word = out.final.word; out.open = out.final.open; out.verified = out.accepted;
    return out;
  }

  // the robust fit of a rigid lattice of the known mesh size placed at (u, v), and the anchors' pull toward the
  // rope and the tag: the two lands of the page that shows the lattice's impostors
  function shiftCost(d, p, u, v) {
    var c = 0; d.lat.knots.forEach(function (k) { var q = [u + k.i * p.mesh, v + k.j * p.mesh], nr = nearest(d.det.knots, q); c += huber(nr.d * nr.d / (p.detectNoise * p.detectNoise), p.delta); });
    return c;
  }
  function anchorCost(d, p, u, v) { var dx = u - d.ropeX, dy = v - d.det.tag[1]; return (dx * dx + dy * dy) / (2 * p.tagNoise * p.tagNoise); }
  // the hollows of the rigid fit: the local minima of shiftCost on a fine grid, within half again of the lowest;
  // the one nearest the origin is the true shift's hollow
  function hollows(d, p) {
    var NG = 57, G = [], out = [], gi, gj;
    for (gi = 0; gi < NG; gi++) { var row = []; for (gj = 0; gj < NG; gj++) row.push(shiftCost(d, p, -1.4 + 2.8 * gi / (NG - 1), -1.4 + 2.8 * gj / (NG - 1))); G.push(row); }
    var gMin = Math.min.apply(null, G.map(function (r) { return Math.min.apply(null, r); }));
    for (gi = 1; gi + 1 < NG; gi++) for (gj = 1; gj + 1 < NG; gj++) {
      var c = G[gi][gj], ok = c < 1.5 * gMin;
      for (var di = -1; di <= 1 && ok; di++) for (var dj = -1; dj <= 1; dj++) if ((di || dj) && G[gi + di][gj + dj] <= c) { ok = false; break; }
      if (ok) out.push({ q: [-1.4 + 2.8 * gi / (NG - 1), -1.4 + 2.8 * gj / (NG - 1)], c: c });
    }
    var lowest = out.reduce(function (a, b) { return b.c < a.c ? b : a; }, out[0]), truest = out.reduce(function (a, b) { return norm(b.q) < norm(a.q) ? b : a; }, out[0]);
    return { all: out, lowest: lowest, truest: truest };
  }
  var PRESET = { seed: 11, n: 6, mesh: 1, belly: 0.35, beyond: 2, region: [-1.5, 6.5, -1.5, 6.5], pixels: 200,
                 background: 0.15, twineBright: 1.0, twineWidth: 0.06, ropeBright: 1.0, ropeWidth: 0.12, tagRadius: 0.22, tagBright: 1.6, noise: 0.22, closeNoise: 0.07, samples: 9,
                 fish: [[4.3, 1.2, 0.5, 0.25, 0.9], [1.6, 4.4, 0.35, 0.2, 0.8]],
                 broken: [{ i: 2, j: 2, dir: 'h' }, { i: 3, j: 2, dir: 'v' }, { i: 3, j: 3, dir: 'h' }],
                 detectNoise: 0.03, misses: 3, spurious: 4, tagNoise: 0.02, gate: 0.45, delta: 2.5,
                 prior: 1.5, effective: 1, rho: 1000, tap: 0.02, stride: 0.03, strides: 3, tol: 0.01, maxRounds: 60, anchors: true, startShift: null };
  return { PRESET: PRESET, build: build, solve: solve, laws: laws, project: project, shiftCost: shiftCost, anchorCost: anchorCost, hollows: hollows, lattice: lattice, trueKnot: trueKnot, raster: raster, sample: sample, evidence: evidence,
           detections: detections, nearest: nearest, huber: huber, huberWeight: huberWeight, knotCost: knotCost, walkKnot: walkKnot, norm: norm, sub: sub, add: add, scale: scale, stream: stream };
})();
if (typeof module !== 'undefined') module.exports = Net;
