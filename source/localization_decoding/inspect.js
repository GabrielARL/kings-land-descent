// The inspection dive of the tutorial "Localization is decoding" (localization_is_decoding.html): a vehicle
// circles a monopile at a fixed standoff, photographs it, and must tag every photo with where it was taken.  The
// reference is the model of the pile's circumference built on last year's visit; the image evidence is how well a photo
// matches the model at each heading.  The vehicle's operating rule and sensor tolerances define allowed sets for
// the positions: a standoff band, range bands, and odometry-error balls.  A consensus-ADMM teaching solver gives
// every allowed set its own position copies, then alternates fit, projection and scaled-dual updates.  This is the
// same splitting pattern used by an ADMM decoder, not the same optimization problem.  Plain JavaScript without
// optional chaining, so that Node 12 runs test_dive.js.
var Dive = (function () {
  var TAU = 2 * Math.PI, DEG = Math.PI / 180;
  function norm(a) { return Math.hypot(a[0], a[1]); }
  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function scale(a, s) { return [a[0] * s, a[1] * s]; }
  function limit(a, r) { var n = norm(a); return n > r && n > 0 ? scale(a, r / n) : a; }
  function wrap(deg) { deg = deg % 360; return deg < 0 ? deg + 360 : deg; }
  function heading(x) { return wrap(Math.atan2(x[1], x[0]) / DEG); }
  function onCircle(deg, r) { return [r * Math.cos(deg * DEG), r * Math.sin(deg * DEG)]; }
  function copy(o, extra) { var r = {}, k; for (k in o) r[k] = o[k]; for (k in (extra || {})) r[k] = extra[k]; return r; }
  // a seeded stream of numbers (mulberry32) with normal draws: the same dive every time
  function stream(seed) {
    var a = (seed >>> 0) || 1;
    function u() { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    return { u: u, normal: function () { return Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(TAU * u()); } };
  }

  // ---------------------------------------------------------------- the reference appearance around the pile
  // The model m(theta), one value per degree: four identical anodes a quarter turn apart, marine growth that
  // repeats every quarter turn, and one unique tag.  Everything but the tag looks the same from four headings.
  function texture(p) {
    var m = new Float64Array(360), r = stream(p.seed * 7919 + 1), growth = [];
    for (var k = 0; k < 90; k++) growth.push(0);
    for (var w = 0; w < 6; w++) { var ph = r.u() * TAU, f = 1 + Math.floor(r.u() * 5), amp = 0.12 + 0.1 * r.u(); for (k = 0; k < 90; k++) growth[k] += amp * Math.sin(f * k / 90 * TAU + ph); }
    for (var d = 0; d < 360; d++) {
      var v = growth[d % 90];
      [0, 90, 180, 270].forEach(function (a) { var dd = Math.abs(((d - a) % 360 + 540) % 360 - 180); v += p.anode * Math.exp(-dd * dd / (2 * 4 * 4)); });
      var dt = Math.abs(((d - p.tagAt) % 360 + 540) % 360 - 180); v += p.tag * Math.exp(-dt * dt / (2 * 2.5 * 2.5));
      m[d] = v;
    }
    return m;
  }
  function at(m, deg) { var a = wrap(deg), i = Math.floor(a), f = a - i; return m[i] * (1 - f) + m[(i + 1) % 360] * f; }
  // a photo: the model seen through a window of +-w degrees around the true heading, plus noise
  function photo(m, theta, p, r) {
    var out = [], offs = [];
    for (var o = -p.window; o <= p.window; o += 1) { offs.push(o); out.push(at(m, theta + o) + p.sigma * r.normal()); }
    return { samples: out, offsets: offs, theta: theta };
  }
  // the match cost over headings, on half-degree bins: the squared mismatch of the photo against the model.
  // Under the stated Gaussian camera-noise model it is a negative log-likelihood, up to an additive constant.
  function matchCost(m, ph, p) {
    var n = 720, c = new Float64Array(n), s2 = 2 * p.sigma * p.sigma;
    for (var i = 0; i < n; i++) { var phi = i / 2, v = 0; for (var k = 0; k < ph.samples.length; k++) { var d = ph.samples[k] - at(m, phi + ph.offsets[k]); v += d * d; } c[i] = v / s2; }
    return c;
  }
  function costAt(c, deg) { var a = wrap(deg) * 2, i = Math.floor(a), f = a - i; return c[i] * (1 - f) + c[(i + 1) % 720] * f; }
  // the local minima of a cost curve, lowest first
  function minima(c) {
    var out = [];
    for (var i = 0; i < 720; i++) { var l = c[(i + 719) % 720], rr = c[(i + 1) % 720]; if (c[i] < l && c[i] <= rr) out.push({ deg: i / 2, cost: c[i] }); }
    out.sort(function (a, b) { return a.cost - b.cost; });
    return out;
  }

  // ---------------------------------------------------------------- the dive
  // T positions on the standoff circle, a quarter-turn apart from the tag so that every photo is ambiguous;
  // odometry between consecutive positions and acoustic ranges to the beacon, some of them dropped.
  function dive(p) {
    var r = stream(p.seed), m = texture(p), rho = p.pileRadius + p.standoff, out = { p: p, m: m, rho: rho, beacon: p.beacon.slice(), truth: [], theta: [], photos: [], costs: [], odo: [], ranges: [], photoOnly: [], candidates: [] };
    for (var t = 0; t < p.T; t++) {
      var th = p.theta0 + t * p.step, x = onCircle(th, rho); out.theta.push(th); out.truth.push(x);
      var ph = photo(m, th, p, r), c = matchCost(m, ph, p), mins = minima(c);
      out.photos.push(ph); out.costs.push(c); out.candidates.push(mins.slice(0, 4));
      out.photoOnly.push(onCircle(mins[0].deg, rho));
      // This teaching trace uses truncated synthetic sensor errors, so the hidden truth is guaranteed to lie inside
      // the displayed allowances.  A field deployment would calibrate those allowances from its own sensor data.
      if (t > 0) {
        var d = sub(x, out.truth[t - 1]), ne = limit([p.odoSigma * r.normal(), p.odoSigma * r.normal()], p.odoTol);
        out.odo.push(add(d, ne));
      }
      if (p.rangesAt.indexOf(t) >= 0) {
        var er = clamp(p.rangeSigma * r.normal(), -p.rangeTol, p.rangeTol);
        out.ranges.push({ t: t, r: norm(sub(x, p.beacon)) + er });
      }
    }
    // the tag's photo, for the page that shows a unique mark: one photo taken facing the tag
    var tagPhoto = photo(m, p.tagAt, p, r); out.tagPhoto = tagPhoto; out.tagCost = matchCost(m, tagPhoto, p); out.tagCandidates = minima(out.tagCost).slice(0, 4);
    return out;
  }

  // ---------------------------------------------------------------- the solver: split, fit, project, ledger
  // Allowed sets, each with its own copy z and scaled dual u of the positions it involves:
  //   standoff   ||x_t| - rho| <= eps_s                    (one position)
  //   range      ||x_t - beacon| - r_t| <= eps_r           (one position)
  //   odometry   |(x_{t+1} - x_t) - d_t| <= eps_d          (two positions)
  function facts(d) {
    var out = [];
    for (var t = 0; t < d.p.T; t++) out.push({ kind: 'standoff', at: [t], r: d.rho, tol: d.p.standoffTol });
    d.ranges.forEach(function (q) { out.push({ kind: 'range', at: [q.t], r: q.r, tol: d.p.rangeTol }); });
    for (t = 0; t + 1 < d.p.T; t++) out.push({ kind: 'odometry', at: [t, t + 1], d: d.odo[t], tol: d.p.odoTol });
    return out;
  }
  function radialBand(q, centre, r, tol) {
    var e = sub(q, centre), n = norm(e), lo = Math.max(0, r - tol), hi = r + tol;
    if (n >= lo && n <= hi) return q.slice();
    var target = clamp(n, lo, hi);
    return n > 1e-12 ? add(centre, scale(e, target / n)) : add(centre, [target, 0]);
  }
  // The projections: clip a point's radius to an allowed band.  For odometry, leave a pair alone when its
  // displacement error is inside the allowed ball; otherwise move both ends equally to the ball's boundary.
  function project(f, pts, beacon) {
    if (f.kind === 'standoff') return [radialBand(pts[0], [0, 0], f.r, f.tol)];
    if (f.kind === 'range') return [radialBand(pts[0], beacon, f.r, f.tol)];
    var gap = sub(sub(pts[1], pts[0]), f.d), ng = norm(gap);
    if (ng <= f.tol) return [pts[0].slice(), pts[1].slice()];
    var correction = scale(gap, (ng - f.tol) / (2 * ng));
    return [add(pts[0], correction), sub(pts[1], correction)];
  }
  // Physical overrun of an allowed set.  This is deliberately not inferred from projection distance: for an
  // odometry pair the projection divides a displacement correction equally between two endpoints.
  function factExcess(f, pts, beacon) {
    if (f.kind === 'standoff') return Math.max(0, Math.abs(norm(pts[0]) - f.r) - f.tol);
    if (f.kind === 'range') return Math.max(0, Math.abs(norm(sub(pts[0], beacon)) - f.r) - f.tol);
    return Math.max(0, norm(sub(sub(pts[1], pts[0]), f.d)) - f.tol);
  }
  // the fit step for one position: the photo's cost at the heading plus the ropes to every copy's aim, lowest
  // point on a half-degree grid of headings with the radius solved exactly, then a golden-section polish
  function fit(c, aims, rhoAdmm) {
    var K = aims.length;
    function radiusAt(phi) { var e = [Math.cos(phi * DEG), Math.sin(phi * DEG)], s = 0; for (var k = 0; k < K; k++) s += aims[k][0] * e[0] + aims[k][1] * e[1]; return Math.max(0.05, s / K); }
    function total(phi) { var rr = radiusAt(phi), x = [rr * Math.cos(phi * DEG), rr * Math.sin(phi * DEG)], s = costAt(c, phi); for (var k = 0; k < K; k++) { var dx = x[0] - aims[k][0], dy = x[1] - aims[k][1]; s += rhoAdmm / 2 * (dx * dx + dy * dy); } return s; }
    var best = 0, bv = Infinity;
    for (var i = 0; i < 720; i++) { var v = total(i / 2); if (v < bv) { bv = v; best = i / 2; } }
    var a = best - 0.5, b = best + 0.5, g = (Math.sqrt(5) - 1) / 2;
    for (var it = 0; it < 30; it++) { var x1 = b - g * (b - a), x2 = a + g * (b - a); if (total(x1) < total(x2)) b = x2; else a = x1; }
    var phi = (a + b) / 2, rr = radiusAt(phi);
    return { x: [rr * Math.cos(phi * DEG), rr * Math.sin(phi * DEG)], phi: wrap(phi), r: rr, value: total(phi),
             gridPhi: wrap(best), gridValue: bv, bracket: [wrap(best - 0.5), wrap(best + 0.5)] };
  }
  // the fit's cost over all headings, for the page that shows the move: the photo's cost plus the ropes, with the
  // radius solved at each heading
  function fitCurve(c, aims, rhoAdmm) {
    var K = aims.length, out = [], radii = [];
    for (var i = 0; i < 720; i++) {
      var phi = i / 2, e = [Math.cos(phi * DEG), Math.sin(phi * DEG)], s = 0;
      for (var k = 0; k < K; k++) s += aims[k][0] * e[0] + aims[k][1] * e[1];
      var rr = Math.max(0.05, s / K), v = c[i];
      for (k = 0; k < K; k++) { var dx = rr * e[0] - aims[k][0], dy = rr * e[1] - aims[k][1]; v += rhoAdmm / 2 * (dx * dx + dy * dy); }
      out.push(v); radii.push(rr);
    }
    return { total: out, radius: radii };
  }
  function solve(d, p) {
    var rhoAdmm = p.rhoAdmm, maxIt = p.maxIt, T = d.p.T, F = facts(d), x = [], k, t;
    for (t = 0; t < T; t++) x.push(p.start === 'photo' ? d.photoOnly[t].slice() : p.start[t].slice());
    var z = F.map(function (f) { return project(f, f.at.map(function (i) { return x[i]; }), d.beacon); });
    var u = F.map(function (f) { return f.at.map(function () { return [0, 0]; }); });
    var occurrences = 0; F.forEach(function (f) { occurrences += f.at.length; });
    var out = { facts: F, iterations: [], admissibleAt: null, feasible: null, converged: false, convergedAt: null,
                stopReason: 'maximum iterations reached', occurrences: occurrences };
    // Standard consensus residuals for A*x = z.  A duplicates each shared position once per allowed set.
    function primalResidual(xx, zz) {
      var s = 0; F.forEach(function (f, i) { f.at.forEach(function (ti, j) { var e = sub(xx[ti], zz[i][j]); s += e[0] * e[0] + e[1] * e[1]; }); }); return Math.sqrt(s);
    }
    function dualResidual(zz, old) {
      var a = []; for (var ii = 0; ii < T; ii++) a.push([0, 0]);
      F.forEach(function (f, i) { f.at.forEach(function (ti, j) { a[ti] = add(a[ti], sub(zz[i][j], old[i][j])); }); });
      var s = 0; a.forEach(function (e) { s += e[0] * e[0] + e[1] * e[1]; }); return rhoAdmm * Math.sqrt(s);
    }
    function stackNormX(xx) {
      var s = 0; F.forEach(function (f) { f.at.forEach(function (ti) { s += xx[ti][0] * xx[ti][0] + xx[ti][1] * xx[ti][1]; }); }); return Math.sqrt(s);
    }
    function stackNormZ(zz) {
      var s = 0; F.forEach(function (f, i) { f.at.forEach(function (ti, j) { void ti; s += zz[i][j][0] * zz[i][j][0] + zz[i][j][1] * zz[i][j][1]; }); }); return Math.sqrt(s);
    }
    function dualScale(uu) {
      var a = []; for (var ii = 0; ii < T; ii++) a.push([0, 0]);
      F.forEach(function (f, i) { f.at.forEach(function (ti, j) { a[ti] = add(a[ti], uu[i][j]); }); });
      var s = 0; a.forEach(function (e) { s += e[0] * e[0] + e[1] * e[1]; }); return rhoAdmm * Math.sqrt(s);
    }
    function thresholds(xx, zz, uu) {
      return { epsPri: Math.sqrt(2 * occurrences) * p.epsAbs + p.epsRel * Math.max(stackNormX(xx), stackNormZ(zz)),
               epsDual: Math.sqrt(2 * T) * p.epsAbs + p.epsRel * dualScale(uu) };
    }
    function photoCost(xx) { var s = 0; for (var i = 0; i < T; i++) s += costAt(d.costs[i], heading(xx[i])); return s; }
    function maxExcess(xx) { var v = 0; F.forEach(function (f) { v = Math.max(v, factExcess(f, f.at.map(function (i) { return xx[i]; }), d.beacon)); }); return v; }
    var th0 = thresholds(x, z, u);
    out.iterations.push({ x: x.map(function (q) { return q.slice(); }), z: z, u: u, primal: primalResidual(x, z), dual: null,
                          epsPri: th0.epsPri, epsDual: th0.epsDual, cost: photoCost(x), excess: maxExcess(x), violation: maxExcess(x) });
    for (k = 1; k <= maxIt; k++) {
      var nx = [], aims = [], fits = [];
      for (t = 0; t < T; t++) aims.push([]);
      F.forEach(function (f, i) { f.at.forEach(function (ti, j) { aims[ti].push(sub(z[i][j], u[i][j])); }); });
      for (t = 0; t < T; t++) { var ft = fit(d.costs[t], aims[t], rhoAdmm); nx.push(ft.x); fits.push(ft); }
      var nz = F.map(function (f, i) { return project(f, f.at.map(function (ti, j) { return add(nx[ti], u[i][j]); }), d.beacon); });
      var nu = F.map(function (f, i) { return f.at.map(function (ti, j) { return add(u[i][j], sub(nx[ti], nz[i][j])); }); });
      var dual = dualResidual(nz, z);
      var th = thresholds(nx, nz, nu), excess = maxExcess(nx);
      var rec = { x: nx, z: nz, u: nu, aims: aims, fits: fits, primal: primalResidual(nx, nz), dual: dual,
                  epsPri: th.epsPri, epsDual: th.epsDual, cost: photoCost(nx), excess: excess, violation: excess };
      out.iterations.push(rec);
      x = nx; z = nz; u = nu;
      if (out.admissibleAt == null && rec.excess <= p.feasTol) { out.admissibleAt = k; out.feasible = k; }
      if (rec.excess <= p.feasTol && rec.primal <= rec.epsPri && dual <= rec.epsDual) {
        out.converged = true; out.convergedAt = k; out.stopReason = 'admissible and both residual tests passed'; break;
      }
    }
    out.x = x; out.final = out.iterations[out.iterations.length - 1];
    return out;
  }
  // the errors of an estimate against the truth, per position and at most
  function errors(d, xs) { var e = xs.map(function (q, t) { return norm(sub(q, d.truth[t])); }); return { each: e, max: Math.max.apply(null, e), mean: e.reduce(function (a, b) { return a + b; }, 0) / e.length }; }

  var PRESET = { seed: 7, pileRadius: 3, standoff: 2, beacon: [10, 6], anode: 1.0, tag: 0.9, tagAt: 10, window: 14, sigma: 0.15,
                 T: 7, theta0: 62, step: 17, odoSigma: 0.02, rangeSigma: 0.02, rangesAt: [0, 1, 4, 6], rhoAdmm: 120,
                 standoffTol: 0.02, rangeTol: 0.06, odoTol: 0.06, feasTol: 0.001, epsAbs: 0.0001, epsRel: 0.0001,
                 maxIt: 140, start: 'photo' };
  function build(over) { var p = copy(PRESET, over), d = dive(p); d.solution = solve(d, p); d.errPhoto = errors(d, d.photoOnly); d.errSolved = errors(d, d.solution.x); return d; }

  return { PRESET: PRESET, build: build, dive: dive, solve: solve, facts: facts, project: project, factExcess: factExcess, fit: fit, fitCurve: fitCurve, texture: texture, photo: photo, matchCost: matchCost, costAt: costAt, at: at,
           minima: minima, errors: errors, heading: heading, onCircle: onCircle, wrap: wrap, norm: norm, sub: sub, add: add, scale: scale, stream: stream };
})();
if (typeof module !== 'undefined') module.exports = Dive;
