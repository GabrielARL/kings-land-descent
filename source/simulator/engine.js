// The three heroes' walks on a land of two coordinates, for kings_land_descent.html, the companion page of deck
// lbgfs_admm_diff_no_math (Three heroes downhill).  Plain JavaScript without optional chaining, so that Node 12
// runs test_engine.js on it.
// A land gives J (the walkers' land) and its gradient, f (the Twins' land, J without a law hill), the Wanderer's
// step argmin f + rho/2 |x - v|^2, the Warden's projection onto the law, and the box the walkers keep to (null on
// the open plane).  Weather adds ripples to the heights and haze to every tap of the ground.
var Engine = (function () {
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
  function add(a, b, s) { return [a[0] + s * b[0], a[1] + s * b[1]]; }
  function norm(a) { return Math.sqrt(dot(a, a)); }
  function clip(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function clipBox(x, box) { return box ? [clip(x[0], box[0], box[1]), clip(x[1], box[0], box[1])] : x.slice(); }
  function finite(x) { return isFinite(x[0]) && isFinite(x[1]) && Math.abs(x[0]) < 1e6 && Math.abs(x[1]) < 1e6; }

  // A seeded stream of numbers (mulberry32) with normal draws (Box-Muller): a hazy walk is the same every time.
  function stream(seed) {
    var a = (seed >>> 0) || 1;
    function u() {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return { u: u, normal: function () { return Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u()); } };
  }

  // ---------------------------------------------------------------- the quadratic lands (canyon, wall, misty hills)
  function quadLand(p) {
    var th = p.theta * Math.PI / 180, co = Math.cos(th), si = Math.sin(th);
    var a11 = p.l1 * co * co + p.l2 * si * si, a22 = p.l1 * si * si + p.l2 * co * co, a12 = (p.l1 - p.l2) * co * si;
    var c = [p.c1, p.c2], box = p.box || null;
    function J(x) { var d0 = x[0] - c[0], d1 = x[1] - c[1]; return 0.5 * (d0 * (a11 * d0 + a12 * d1) + d1 * (a12 * d0 + a22 * d1)); }
    function grad(x) { var d0 = x[0] - c[0], d1 = x[1] - c[1]; return [a11 * d0 + a12 * d1, a12 * d0 + a22 * d1]; }
    function wanderer(v, rho) {      // (A + rho I) x = A c + rho v
      var b0 = a11 * c[0] + a12 * c[1] + rho * v[0], b1 = a12 * c[0] + a22 * c[1] + rho * v[1];
      var m11 = a11 + rho, m22 = a22 + rho, det = m11 * m22 - a12 * a12;
      return [(m22 * b0 - a12 * b1) / det, (m11 * b1 - a12 * b0) / det];
    }
    function project(w) { return clipBox(w, box); }
    // The treasure: c, or the lowest point of the box (on an edge when c is outside).
    function treasure() {
      if (!box || (c[0] >= box[0] && c[0] <= box[1] && c[1] >= box[0] && c[1] <= box[1])) return c.slice();
      var best = null;
      [[0, box[0]], [0, box[1]], [1, box[0]], [1, box[1]]].forEach(function (e) {
        var k = e[0], fixed = e[1], free = 1 - k;          // coordinate k held at fixed, the other free
        var aff = k === 0 ? a22 : a11;
        var t = c[free] - a12 * (fixed - c[k]) / aff;       // dJ/dfree = 0
        var x = [0, 0]; x[k] = fixed; x[free] = clip(t, box[0], box[1]);
        if (!best || J(x) < J(best)) best = x;
      });
      return best;
    }
    return { kind: 'quad', J: J, f: J, grad: grad, fgrad: grad, wanderer: wanderer, project: project, box: box, wanderBox: null,
             lawBox: box, A: [[a11, a12], [a12, a22]], c: c, treasure: treasure() };
  }

  // ---------------------------------------------------------------- the tower lands (fort, ridge)
  // Cards x in [-1, 1]; the lanterns y; CORAL's three terms with one tower over the two sentries.
  // s = +1: the tower's law is that the two flags agree (x1 x2 = +1); s = -1: that they differ.
  function towerLand(p) {
    var y = [p.y1, p.y2], s2 = p.s2, muP = p.muP, muB = p.muB, s = p.law;
    function f(x) {
      var v = 0;
      for (var i = 0; i < 2; i++) v += (y[i] - x[i]) * (y[i] - x[i]) / (2 * s2) + muB * Math.pow(1 - x[i] * x[i], 2);
      return v;
    }
    function J(x) { var r = 1 - s * x[0] * x[1]; return f(x) + muP * r * r; }
    function fgrad(x) { return [0, 1].map(function (i) { return (x[i] - y[i]) / s2 - 4 * muB * x[i] * (1 - x[i] * x[i]); }); }
    function grad(x) {
      var r = 1 - s * x[0] * x[1], g = fgrad(x);
      return [g[0] - 2 * muP * r * s * x[1], g[1] - 2 * muP * r * s * x[0]];
    }
    // One sentry's best card on [-1, 1]: phi(x) = (y-x)^2/(2 s2) + muB (1-x^2)^2 + rho/2 (x - v)^2,
    // phi'(x) = 4 muB x^3 + (1/s2 - 4 muB + rho) x - (y/s2 + rho v): the real roots of a depressed cubic and both ends.
    function phi(x, yi, v, rho) { return (yi - x) * (yi - x) / (2 * s2) + muB * Math.pow(1 - x * x, 2) + rho / 2 * (x - v) * (x - v); }
    function bestCard(yi, v, rho) {
      var a = 4 * muB, b = 1 / s2 - 4 * muB + rho, c0 = -(yi / s2 + rho * v);
      var cands = [-1, 1], roots = [];
      if (a < 1e-14) { roots.push(-c0 / b); }
      else {
        var P = b / a, Q = c0 / a, disc = Q * Q / 4 + P * P * P / 27;
        if (Math.abs(P) < 1e-12) roots.push(Math.cbrt(-Q));
        else if (disc > 0) { var sq = Math.sqrt(disc); roots.push(Math.cbrt(-Q / 2 + sq) + Math.cbrt(-Q / 2 - sq)); }
        else {
          var r = Math.sqrt(-P / 3), ang = Math.acos(clip(3 * Q / (2 * P) * Math.sqrt(-3 / P), -1, 1)) / 3;
          for (var k = 0; k < 3; k++) roots.push(2 * r * Math.cos(ang - 2 * Math.PI * k / 3));
        }
      }
      roots.forEach(function (t) { if (t > -1 && t < 1) cands.push(t); });
      var best = cands[0];
      cands.forEach(function (t) { if (phi(t, yi, v, rho) < phi(best, yi, v, rho)) best = t; });
      return best;
    }
    function wanderer(v, rho) { return [bestCard(y[0], v[0], rho), bestCard(y[1], v[1], rho)]; }
    // The law's set: the segment between the two lawful corners (the tower's parity polytope).
    var lawA = s > 0 ? [1, 1] : [1, -1], lawB = s > 0 ? [-1, -1] : [-1, 1];
    function project(w) {
      var d = [lawB[0] - lawA[0], lawB[1] - lawA[1]];
      var t = clip(dot([w[0] - lawA[0], w[1] - lawA[1]], d) / dot(d, d), 0, 1);
      return [lawA[0] + t * d[0], lawA[1] + t * d[1]];
    }
    // The King's true order: the lawful corner the lanterns favour.
    var lantern = function (q) { return (y[0] - q[0]) * (y[0] - q[0]) + (y[1] - q[1]) * (y[1] - q[1]); };
    var truth = lantern(lawA) <= lantern(lawB) ? lawA : lawB;
    return { kind: 'tower', J: J, f: f, grad: grad, fgrad: fgrad, wanderer: wanderer, project: project, box: [-1, 1], wanderBox: [-1, 1],
             lawSegment: [lawA, lawB], lawSign: s, y: y, treasure: truth.slice(), bestCard: bestCard };
  }

  // ---------------------------------------------------------------- weather
  // Ripples: R(x) = A/sqrt(6) sum_k sin(w_k . x + phi_k), six waves of random heading, a length within 25% of L
  // and a random phase.
  function ripples(A, L, seed) {
    var r = stream(seed * 7919 + 17), waves = [];
    for (var k = 0; k < 6; k++) {
      var th = 2 * Math.PI * r.u(), len = L * (0.75 + 0.5 * r.u()), w = 2 * Math.PI / len;
      waves.push({ w: [w * Math.cos(th), w * Math.sin(th)], phi: 2 * Math.PI * r.u(), len: len });
    }
    var a = A / Math.sqrt(6);
    return {
      A: A, L: L, amp: a, waves: waves,
      R: function (x) { var s = 0; for (var k = 0; k < 6; k++) s += Math.sin(dot(waves[k].w, x) + waves[k].phi); return a * s; },
      grad: function (x) {
        var g0 = 0, g1 = 0;
        for (var k = 0; k < 6; k++) { var c = Math.cos(dot(waves[k].w, x) + waves[k].phi); g0 += c * waves[k].w[0]; g1 += c * waves[k].w[1]; }
        return [a * g0, a * g1];
      }
    };
  }
  // Black holes: B(x) = -sum_j D exp(-|x - p_j|^2 / (2 w^2)), narrow deep wells at seeded places inside the realm,
  // kept off the start flag and apart from each other.
  function holes(n, D, w, seed, region, avoid) {
    var r = stream(seed * 104729 + 7), at = [], tries = 0;
    var x0 = region[0] + 0.06 * (region[1] - region[0]), x1 = region[1] - 0.06 * (region[1] - region[0]);
    var y0 = region[2] + 0.06 * (region[3] - region[2]), y1 = region[3] - 0.06 * (region[3] - region[2]);
    while (at.length < n && tries < 500) {
      tries++;
      var q = [x0 + (x1 - x0) * r.u(), y0 + (y1 - y0) * r.u()];
      if (avoid && norm([q[0] - avoid[0], q[1] - avoid[1]]) < 6 * w) continue;
      if (at.some(function (p) { return norm([p[0] - q[0], p[1] - q[1]]) < 8 * w; })) continue;
      at.push(q);
    }
    var k2 = 1 / (2 * w * w);
    return {
      n: at.length, D: D, w: w, at: at,
      B: function (x) { var v = 0; for (var j = 0; j < at.length; j++) { var dx = x[0] - at[j][0], dy = x[1] - at[j][1]; v -= D * Math.exp(-(dx * dx + dy * dy) * k2); } return v; },
      grad: function (x) {
        var g0 = 0, g1 = 0;
        for (var j = 0; j < at.length; j++) { var dx = x[0] - at[j][0], dy = x[1] - at[j][1], e = D * Math.exp(-(dx * dx + dy * dy) * k2) / (w * w); g0 += e * dx; g1 += e * dy; }
        return [g0, g1];
      },
      // how much of x lies inside a hole, 0 to 1, for drawing them black
      depth: function (x) { var m = 0; for (var j = 0; j < at.length; j++) { var dx = x[0] - at[j][0], dy = x[1] - at[j][1]; m = Math.max(m, Math.exp(-(dx * dx + dy * dy) * k2)); } return m; }
    };
  }
  // Where the heroes may stand: the cards' box on the tower lands, the map elsewhere.
  function realm(land) { return land.kind === 'tower' ? [-1, 1, -1, 1] : land.view; }
  function scan(fn, region, n) {
    var lo = Infinity, hi = -Infinity, at = null;
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      var x = [region[0] + (region[1] - region[0]) * i / (n - 1), region[2] + (region[3] - region[2]) * j / (n - 1)], z = fn(x);
      if (z < lo) { lo = z; at = x; }
      if (z > hi) hi = z;
    }
    return { lo: lo, hi: hi, at: at };
  }
  // The lowest spot of J where the walkers may stand: a grid, then projected steps downhill.
  function lowestSpot(land) {
    var region = land.box ? [land.box[0], land.box[1], land.box[0], land.box[1]] : land.view, width = region[1] - region[0];
    var shortest = Math.min(land.ripples ? 0.75 * land.ripples.L : width, land.holes ? 2 * land.holes.w : width), n = Math.max(161, Math.min(601, Math.ceil(12 * width / shortest)));
    var pts = [];
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      var x = [region[0] + width * i / (n - 1), region[2] + (region[3] - region[2]) * j / (n - 1)];
      pts.push([land.J(x), x]);
    }
    pts.sort(function (a, b) { return a[0] - b[0]; });
    var best = null, seeds = land.holes ? land.holes.at.map(function (p) { return p.slice(); }) : [];
    for (var k = 0; k < pts.length && seeds.length < 8 + (land.holes ? land.holes.n : 0); k++) {
      if (seeds.every(function (s0) { return norm([s0[0] - pts[k][1][0], s0[1] - pts[k][1][1]]) > 0.5 * shortest; })) seeds.push(pts[k][1]);
    }
    seeds.forEach(function (q) {
      var Jq = land.J(q), t = 0.01 * land.span;
      for (var it = 0; it < 4000 && t > 1e-14; it++) {
        var g = land.grad(q), gn = norm(g); if (gn < 1e-13) break;
        var nq = clipBox(add(q, g, -t / gn), land.box), Jn = land.J(nq);
        if (Jn < Jq) { q = nq; Jq = Jn; t *= 1.2; } else t *= 0.5;
      }
      if (!best || Jq < best[0]) best = [Jq, q];
    });
    return best[1];
  }
  // Weather on a land.  A and the haze sigma are shares of the land's height range where the heroes may stand; the
  // ripple length L and the staff h are shares of the map's width.  The walkers feel the slope with four taps of
  // the staff; in haze each tap is the height plus N(0, sigma^2), and the slope they use is what the taps say.
  function withWeather(base, view, p) {
    var land = {}, k;
    for (k in base) land[k] = base[k];
    land.base = base; land.view = view; land.span = view[1] - view[0];
    var range = scan(base.J, realm(land), 61);
    land.heightRange = range.hi - range.lo;
    var A = (p.ripA || 0) * land.heightRange, L = (p.ripL || 0.2) * land.span;
    var sigma = (p.haze || 0) * land.heightRange, h = (p.staff || 0.01) * land.span, seed = Math.round(p.seed || 1);
    var rip = A > 0 ? ripples(A, L, seed) : null;
    var nh = Math.round(p.holes || 0), bh = nh > 0 ? holes(nh, (p.holeDepth || 0.6) * land.heightRange, (p.holeWidth || 0.025) * land.span, seed, realm(land), p.sx != null ? [p.sx, p.sy] : (base.kind === 'tower' ? lanternStart(p) : null)) : null;
    land.weather = { A: A, L: L, sigma: sigma, h: h, seed: seed };
    land.ripples = rip; land.holes = bh && bh.n ? bh : null; land.sigma = sigma; land.h = h; land.seed = seed;
    var extra = [], extraGrad = [];
    if (rip) { extra.push(rip.R); extraGrad.push(rip.grad); }
    if (land.holes) { extra.push(land.holes.B); extraGrad.push(land.holes.grad); }
    if (extra.length) {
      var plus = function (fn) { return function (x) { var v = fn(x); for (var i = 0; i < extra.length; i++) v += extra[i](x); return v; }; };
      var plusG = function (fn) { return function (x) { var g = fn(x), a = g[0], b = g[1]; for (var i = 0; i < extraGrad.length; i++) { var q = extraGrad[i](x); a += q[0]; b += q[1]; } return [a, b]; }; };
      land.J = plus(base.J); land.f = plus(base.f); land.grad = plusG(base.grad); land.fgrad = plusG(base.fgrad);
    }
    // the land without its holes, for scaling pictures so that the holes go below the rest
    land.smooth = rip ? function (x) { return base.J(x) + rip.R(x); } : base.J;
    land.floor = scan(land.smooth, realm(land), 61).lo;
    land.exactStep = !extra.length && !(sigma > 0);
    land.fmin = scan(land.f, realm(land), 121).lo;
    if (land.holes) land.holes.at.forEach(function (q) { land.fmin = Math.min(land.fmin, land.f(q)); });
    if (extra.length && base.kind === 'quad') land.treasure = lowestSpot(land);
    return land;
  }

  // ---------------------------------------------------------------- feeling the slope
  // Four taps of the staff, east, west, north and south of x, and the two central differences.
  function feel(land, x, fn, r) {
    var h = land.h, taps = [];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      var q = [x[0] + h * d[0], x[1] + h * d[1]];
      taps.push({ at: q, J: fn(q) + (land.sigma > 0 ? land.sigma * r.normal() : 0) });
    });
    return { taps: taps, g: [(taps[0].J - taps[1].J) / (2 * h), (taps[2].J - taps[3].J) / (2 * h)] };
  }
  // The slope a walker uses: the land's formula in clear air (the taps are then only shown), the taps in haze.
  function slope(land, x, r) {
    var exact = land.grad(x), felt = feel(land, x, land.J, r);
    return { g: land.sigma > 0 ? felt.g : exact, gTrue: exact, taps: felt.taps, gFelt: felt.g };
  }
  // A height as a walker learns it: exact in clear air, one tap in haze.
  function tap(land, x, r) { return land.J(x) + (land.sigma > 0 ? land.sigma * r.normal() : 0); }

  // ---------------------------------------------------------------- the walks
  // Each walk is a list of days; day 0 is the start.  A hero who stops moving rests where he is.  Day k records the
  // place reached and what was felt and reckoned at the place of day k - 1.
  function pilgrim(land, x0, alpha, days) {
    var r = stream(land.seed * 1009 + 1), x = clipBox(x0, land.box), out = [{ x: x, raw: null, J: land.J(x) }];
    for (var k = 1; k <= days; k++) {
      var s = slope(land, x, r), raw = add(x, s.g, -alpha), nx = clipBox(raw, land.box);
      if (!finite(nx)) { out.lost = k; break; }
      var moved = norm([nx[0] - x[0], nx[1] - x[1]]);
      out.push({ x: nx, raw: raw, J: land.J(nx), clipped: raw[0] !== nx[0] || raw[1] !== nx[1], from: x, taps: s.taps,
                 g: s.g, gTrue: s.gTrue, gFelt: s.gFelt });
      x = nx;
      if (moved < 1e-13) { out.rest = k; break; }
    }
    return out;
  }

  // Deck p9's lbfgs (card_cost.lbfgs): two-loop recursion over the last m pairs, a step halved from one until
  // the cost falls by 1e-4 step g.d; a direction that does not go downhill is replaced by -g and the journal emptied.
  // On a land with a box the Cartographer walks on t, x = lo + (hi - lo)(1 + tanh t)/2.
  function cartographer(land, x0, m, days) {
    var box = land.box, toX, toT, dxdt, r = stream(land.seed * 1009 + 2);
    if (box) {
      var lo = box[0], w = box[1] - box[0];
      toX = function (t) { return [lo + w * (1 + Math.tanh(t[0])) / 2, lo + w * (1 + Math.tanh(t[1])) / 2]; };
      toT = function (x) { return x.map(function (v) { var u = clip(2 * (v - lo) / w - 1, -0.99, 0.99); return 0.5 * Math.log((1 + u) / (1 - u)); }); };  // the edge itself is infinitely far on the stretched map
      dxdt = function (t) { return t.map(function (v) { var th = Math.tanh(v); return w * (1 - th * th) / 2; }); };
    } else {
      toX = function (t) { return t.slice(); }; toT = toX; dxdt = function () { return [1, 1]; };
    }
    function fun(t) {
      var x = toX(t), s = slope(land, x, r), d = dxdt(t);
      return { f: tap(land, x, r), g: [s.g[0] * d[0], s.g[1] * d[1]], x: x, taps: s.taps, gx: s.g, gTrue: s.gTrue, gFelt: s.gFelt };
    }
    var t = toT(clipBox(x0, box)), cur = fun(t), S = [], Y = [], D = [];
    var book = function () { return S.map(function (sv, i) { return { day: D[i], s: sv.slice(), y: Y[i].slice() }; }); };
    var out = [{ x: toX(t), J: land.J(toX(t)), step: null, trials: [], pages: 0, queue: [], after: [] }];
    for (var k = 1; k <= days; k++) {
      var q = cur.g.slice(), alphas = [], betas = [], gam = null;
      for (var i = S.length - 1; i >= 0; i--) { var a = dot(S[i], q) / dot(Y[i], S[i]); alphas.push(a); q = add(q, Y[i], -a); }
      if (S.length) { gam = dot(S[S.length - 1], Y[Y.length - 1]) / dot(Y[Y.length - 1], Y[Y.length - 1]); q = [q[0] * gam, q[1] * gam]; }
      for (var j = 0; j < S.length; j++) { var bb = dot(Y[j], q) / dot(Y[j], S[j]); betas.push(bb); q = add(q, S[j], alphas[S.length - 1 - j] - bb); }
      var reading = { alphas: alphas, betas: betas, gamma: gam, d: [-q[0], -q[1]] };     // the two readings of the journal, newest page first, then oldest first
      var d = [-q[0], -q[1]], restart = false, torn = null;
      if (dot(cur.g, d) >= 0) { d = [-cur.g[0], -cur.g[1]]; torn = book(); S = []; Y = []; D = []; restart = true; }
      var pages = S.length, queue = book(), step = 1, trials = [], nt, nf, need;
      while (true) {
        nt = add(t, d, step);
        need = cur.f + 1e-4 * step * dot(cur.g, d);
        if (finite(nt)) {
          nf = fun(nt);
          if (nf.f <= need) break;
          trials.push({ x: nf.x, f: nf.f, need: need, step: step });
        }
        step /= 2;
        if (step < 1e-16) { out.rest = k; out.why = 'line search'; return out; }
      }
      var sv = [nt[0] - t[0], nt[1] - t[1]], yv = [nf.g[0] - cur.g[0], nf.g[1] - cur.g[1]], wrote = null, dropped = [];
      if (dot(sv, yv) > 1e-12 * Math.sqrt(dot(sv, sv) * dot(yv, yv))) {
        S.push(sv); Y.push(yv); D.push(k); wrote = { day: k, s: sv.slice(), y: yv.slice() };
        while (S.length > m) { dropped.push({ day: D[0], s: S[0], y: Y[0] }); S.shift(); Y.shift(); D.shift(); }
      }
      if (m === 0) { S = []; Y = []; D = []; }
      out.push({ x: nf.x, J: land.J(nf.x), step: step, trials: trials, pages: pages, restart: restart, from: cur.x, fromF: cur.f,
                 felt: nf.f, need: need, taps: cur.taps, g: cur.gx, gTrue: cur.gTrue, gFelt: cur.gFelt,
                 queue: queue, torn: torn, wrote: wrote, dropped: dropped, after: book(),
                 t: t.slice(), gt: cur.g.slice(), d: d.slice(), reading: reading, stretched: !!box });
      t = nt; cur = nf;
      if (Math.max(Math.abs(cur.g[0]), Math.abs(cur.g[1])) < 1e-10) { out.rest = k; out.why = 'flat'; break; }
    }
    return out;
  }

  // The rope's reach: no spot farther from v than r = sqrt(2 (f(v) - fmin) / rho) can beat v itself.
  function reachOf(land, v, rho) { return Math.sqrt(2 * Math.max(land.f(v) - land.fmin, 0) / rho); }
  // The Wanderer's step where no formula gives it, as an ADMM solver takes it: from where the Wanderer stands,
  // small steps down f + rho/2 |x - v|^2 until they stop paying.  In haze both the slope and the heights compared
  // are taps.  The steps are kept, so the page can show the Wanderer's day as a short walk on the rope.
  function wanderLocally(land, x, v, rho, r) {
    var box = land.wanderBox, sig = land.sigma, q = clipBox(x, box), path = [q];
    function rope(p) { return rho / 2 * ((p[0] - v[0]) * (p[0] - v[0]) + (p[1] - v[1]) * (p[1] - v[1])); }
    function height(p) { return land.f(p) + (sig > 0 ? sig * r.normal() : 0) + rope(p); }
    var hq = height(q), t = 0.04 * land.span;
    for (var it = 0; it < 60 && t > 1e-7 * land.span; it++) {
      var g = sig > 0 ? feel(land, q, land.f, r).g : land.fgrad(q);
      g = [g[0] + rho * (q[0] - v[0]), g[1] + rho * (q[1] - v[1])];
      var gn = norm(g); if (gn < 1e-12) break;
      if (sig > 0) hq = height(q);
      var nq = clipBox(add(q, g, -t / gn), box), hn = height(nq);
      if (hn < hq) { q = nq; hq = hn; path.push(q); t *= 1.3; } else t *= 0.5;
    }
    return { x: q, path: path, reach: Math.min(reachOf(land, v, rho), land.span) };
  }

  // ADMM in scaled form: the Wanderer x, the Warden z (always lawful) and the ledger u.
  function twins(land, x0, rho, days) {
    var r = stream(land.seed * 1009 + 3), x = clipBox(x0, land.box), z = land.project(x), u = [0, 0];
    var out = [{ x: x, z: z, u: u, J: land.J(z) }];
    for (var k = 1; k <= days; k++) {
      var v = [z[0] - u[0], z[1] - u[1]], step;
      if (land.exactStep) { var ex = land.wanderer(v, rho); step = { x: ex, path: [x, ex], reach: Math.min(reachOf(land, v, rho), land.span) }; }
      else step = wanderLocally(land, x, v, rho, r);
      var nx = step.x, nz = land.project(add(nx, u, 1)), nu = [u[0] + nx[0] - nz[0], u[1] + nx[1] - nz[1]];
      if (!finite(nx) || !finite(nu)) { out.lost = k; break; }
      var still = norm([nx[0] - x[0], nx[1] - x[1]]) + norm([nz[0] - z[0], nz[1] - z[1]]) + norm([nu[0] - u[0], nu[1] - u[1]]);
      out.push({ x: nx, z: nz, u: nu, J: land.J(nz), gap: norm([nx[0] - nz[0], nx[1] - nz[1]]), from: x, zFrom: z, uFrom: u,
                 v: v, reach: step.reach, path: step.path, exact: land.exactStep });
      x = nx; z = nz; u = nu;
      if (still < 1e-13 && !(land.sigma > 0)) { out.rest = k; break; }
    }
    return out;
  }

  // The first day from which a walk stays within tol of where it ends.
  function settled(walk, key, tol) {
    var end = walk[walk.length - 1][key || 'x'], day = walk.length - 1;
    for (var k = walk.length - 1; k >= 0; k--) {
      var p = walk[k][key || 'x'];
      if (norm([p[0] - end[0], p[1] - end[1]]) <= tol) day = k; else break;
    }
    return day;
  }

  // ---------------------------------------------------------------- the five lands
  var KINDS = {
    canyon: { kind: 'quad', box: null, view: [-0.25, 1.25, -0.25, 1.25] },
    wall: { kind: 'quad', box: [0, 1], view: [-0.3, 1.8, -0.55, 1.55] },
    fort: { kind: 'tower', view: [-1.2, 1.2, -1.2, 1.2] },
    ridge: { kind: 'tower', view: [-1.2, 1.2, -1.2, 1.2] },
    misty: { kind: 'quad', box: [-1.5, 1.5], view: [-1.65, 1.65, -1.65, 1.65] }
  };
  // The lands as the tale starts them, with the heroes' settings and the weather; the page's "Restore this land"
  // returns to these.  The canyon and the wall are deck lbfgs_admm_pg's plane (part A of methods_numbers.py); the
  // fort and the ridge use CORAL's three terms (deck p5) on two sentries; sx, sy null: start from the lanterns.
  var CLEAR = { ripA: 0, ripL: 0.2, haze: 0, staff: 0.01, seed: 1, holes: 0, holeDepth: 0.6, holeWidth: 0.025 };
  function preset(p, w) { var out = {}, k; for (k in p) out[k] = p[k]; for (k in (w || CLEAR)) out[k] = (w || CLEAR)[k]; return out; }
  var PRESETS = {
    canyon: preset({ l1: 1, l2: 10, theta: 30, c1: 0.62, c2: 0.48, sx: 0.03, sy: 0.31, alpha: 0.18, m: 10, rho: 3, days: 120 }),
    wall: preset({ l1: 1, l2: 10, theta: 30, c1: 1.45, c2: 0.75, sx: 0.1, sy: 0.15, alpha: 0.18, m: 10, rho: 3, days: 120 }),
    fort: preset({ y1: 0.8, y2: -0.5, s2: 0.3, muP: 8, muB: 0.2, law: 1, sx: null, sy: null, alpha: 0.03, m: 10, rho: 3, days: 120 }),
    ridge: preset({ y1: 0.7, y2: -0.4, s2: 0.3, muP: 1, muB: 2, law: 1, sx: null, sy: null, alpha: 0.03, m: 10, rho: 3, days: 120 }),
    misty: preset({ l1: 1, l2: 1, theta: 0, c1: 0.35, c2: -0.25, sx: -1.2, sy: 1.15, alpha: 0.05, m: 10, rho: 1, days: 120 },
                  { ripA: 0.05, ripL: 0.2, haze: 0.002, staff: 0.02, seed: 25, holes: 3, holeDepth: 0.6, holeWidth: 0.025 })
  };
  function buildLand(key, p) {
    var K = KINDS[key], base = K.kind === 'quad'
      ? quadLand({ l1: p.l1, l2: p.l2, theta: p.theta, c1: p.c1, c2: p.c2, box: K.box })
      : towerLand({ y1: p.y1, y2: p.y2, s2: p.s2, muP: p.muP, muB: p.muB, law: p.law });
    return withWeather(base, K.view, p);
  }
  // CORAL's start, x = tanh(L/2) with L = 2y/sigma^2, kept inside the box so that the Cartographer's t is finite.
  function lanternStart(p) { return [clip(Math.tanh(p.y1 / p.s2), -0.98, 0.98), clip(Math.tanh(p.y2 / p.s2), -0.98, 0.98)]; }

  return { quadLand: quadLand, towerLand: towerLand, withWeather: withWeather, buildLand: buildLand, ripples: ripples, holes: holes,
           pilgrim: pilgrim, cartographer: cartographer, twins: twins, wanderLocally: wanderLocally, reachOf: reachOf, feel: feel,
           settled: settled, norm: norm, clipBox: clipBox, stream: stream, KINDS: KINDS, PRESETS: PRESETS, lanternStart: lanternStart };
})();
if (typeof module !== 'undefined') module.exports = Engine;
