// "Localization through a decoder's lens": a monopile inspection dive used to teach allowed sets and consensus
// ADMM.  The useful connection to decoding is the replica/projection/scaled-dual pattern; the objectives, local
// updates and guarantees remain application-specific.  The dive comes from inspect.js, drawings from
// dive_parts.js, and the player from board.js.
(function () {
  'use strict';
  var B = window.Board, D = window.Dive, P = window.DiveParts; if (!B || !D || !P) return;
  var H = B.H, C = H.C, seg = H.seg, num = H.num, pair = H.pair, at = H.at, add = H.add, sub = H.sub,
      lerp2 = H.lerp2, around = H.around, ease = H.ease, clamp = H.clamp;
  var JADE = P.JADE, sb = P.subscript;

  // ------------------------------------------------------------ the seeded dive and its result
  var d = D.build(), p = d.p, T = p.T, rho = d.rho, S = d.beacon, truth = d.truth;
  var sol = d.solution, F = sol.facts, its = sol.iterations, final = sol.final;
  var VIEW = [-7.5, 12.5, -4.5, 9.5], K_ADMISS = sol.admissibleAt, K_END = its.length - 1;
  var wrong = [], t; for (t = 0; t < T; t++) if (d.errPhoto.each[t] > 0.5) wrong.push(t);
  var rangeTs = d.ranges.map(function (q) { return q.t; }), droppedTs = [];
  for (t = 0; t < T; t++) if (rangeTs.indexOf(t) < 0) droppedTs.push(t);
  function factIndex(kind, t0) { for (var i = 0; i < F.length; i++) if (F[i].kind === kind && F[i].at[0] === t0) return i; return -1; }
  function rangeOf(t0) { for (var i = 0; i < d.ranges.length; i++) if (d.ranges[i].t === t0) return d.ranges[i].r; return null; }
  function deg(x) { return num(D.heading(x), 1) + '°'; }
  function cm(x, places) { return num(100 * x, places == null ? 1 : places) + ' cm'; }
  function log10(x) { return Math.log(Math.max(x, 1e-12)) / Math.LN10; }
  function mapBase(g, o) {
    o = o || {}; P.axes(g, 'east, m →', '↑ north, m'); P.pile(g, p.pileRadius, 1, o.pileLabel);
    if (o.standoff !== false) {
      if (o.standoffBand) P.annulus(g, [0, 0], rho, p.standoffTol, C.gold, o.standoffP == null ? 1 : o.standoffP);
      else P.circle(g, [0, 0], rho, 'rgba(255,210,122,0.7)', 1.5, o.standoffP == null ? 1 : o.standoffP, [6, 5]);
    }
    if (o.beacon !== false) P.beacon(g, S, o.beaconP == null ? 1 : o.beaconP, o.beaconLabel);
  }
  function path(g, pts, upto, col, w) {
    var n = Math.min(pts.length - 1, Math.floor(upto)), f = clamp(upto - n, 0, 1), out = [];
    for (var k = 0; k <= n; k++) out.push(pts[k]);
    var now = n < pts.length - 1 ? lerp2(pts[n], pts[n + 1], ease(f)) : pts[n]; out.push(now);
    g.path(out, col, w || 2, 1); return now;
  }

  var T4 = 4, cand4 = d.candidates[T4], r4 = rangeOf(T4), ph4 = d.photos[T4];
  var it1 = its[1], aims4 = it1.aims[T4], fit4 = it1.fits[T4], curve4 = D.fitCurve(d.costs[T4], aims4, p.rhoAdmm);
  var iStd = factIndex('standoff', T4), iRng = factIndex('range', T4), iOdoIn = factIndex('odometry', T4 - 1), iOdoOut = factIndex('odometry', T4);
  var x4n = it1.x[T4], zStd = it1.z[iStd][0], zRng = it1.z[iRng][0], zIn = it1.z[iOdoIn], zOut = it1.z[iOdoOut];
  var x3n = it1.x[3], x5n = it1.x[5], u4 = it1.u[iStd][0], v4 = sub(zStd, u4);
  var candPts = cand4.map(function (q) { return D.onCircle(q.deg, rho); });
  var inRangeBand = candPts.map(function (x) { return Math.abs(D.norm(sub(x, S)) - r4) <= p.rangeTol + 1e-12; });
  var tagGap = d.tagCandidates[1].cost - d.tagCandidates[0].cost;
  var maxRangeErr = 0, maxOdoErr = 0;
  d.ranges.forEach(function (q) { maxRangeErr = Math.max(maxRangeErr, Math.abs(D.norm(sub(truth[q.t], S)) - q.r)); });
  d.odo.forEach(function (q, i) { maxOdoErr = Math.max(maxOdoErr, D.norm(sub(q, sub(truth[i + 1], truth[i])))); });

  var out = [], CH = { job: 'The job', reference: 'The reference', image: 'Image likelihood', sets: 'Allowed sets',
    lens: 'The decoding lens', admm: 'Consensus ADMM', run: 'The run', cajode: 'Back to CAJODE', learned: 'What we learned' };

  // ------------------------------------------------------------ 1. the job
  out.push({ id: 'job', chapter: CH.job, title: 'Tag every photo with where it was taken', layout: 'map', view: VIEW, dur: 6,
    text: 'A monopile at an offshore wind farm is inspected every year. A small vehicle circles it at a standoff of ' + num(p.standoff, 0) + ' m and photographs the steel. The owner wants each new photo attached to its position, so a crack can be compared with the same place last year. This dive has ' + T + ' photos. The gold stars show the hidden simulated positions; the vehicle does not know them.',
    math: 'unknown: positions x₀ … x' + sb(T - 1) + ';  pile radius ' + num(p.pileRadius, 0) + ' m;  nominal standoff ' + num(p.standoff, 0) + ' m',
    draw: function (g, pr) {
      mapBase(g, { pileLabel: 'monopile', beaconLabel: 'acoustic beacon on the vessel' });
      var up = seg(pr, 0.1, 0.9) * (T - 1), q = path(g, truth, up, 'rgba(255,210,122,0.5)', 1.5);
      for (var k = 0; k <= Math.min(T - 1, Math.floor(up)); k++) { P.star(g, truth[k], 1); g.halo(truth[k], 16, C.gold, clamp(1 - (up - k), 0, 1), 1.5); }
      P.vehicle(g, q, 1, up >= T - 1 ? 'the vehicle' : '');
      g.label(truth[0], 'photo 0', C.gold, { dx: 12, dy: 16, size: 11.5 });
      if (up >= T - 1) g.label(truth[T - 1], 'photo ' + (T - 1), C.gold, { dx: -12, dy: 16, align: 'right', size: 11.5 });
    } });

  out.push({ id: 'sensors', chapter: CH.job, title: 'Three useful sources, none sufficient alone', layout: 'map+side', view: VIEW, dur: 6,
    text: 'There is no GPS under water. The camera sees the steel sharply, but most of this pile repeats every quarter turn. An acoustic beacon reports a range at only ' + rangeTs.length + ' of the ' + T + ' photos. A Doppler log reports the displacement between neighbouring photos, but small errors accumulate. The task is to combine these sources without pretending that a reported reading is exact.',
    math: 'range at photos ' + rangeTs.join(', ') + ';  no range at photos ' + droppedTs.join(', '),
    draw: function (g, pr) {
      mapBase(g); truth.forEach(function (x) { P.star(g, x, 1); });
      d.ranges.forEach(function (q, i) { P.circle(g, S, q.r, 'rgba(169,205,246,0.8)', 1.5, seg(pr, 0.08 + 0.1 * i, 0.24 + 0.1 * i), [4, 4]); });
      droppedTs.forEach(function (j, i) { P.cross(g, truth[j], seg(pr, 0.5 + 0.07 * i, 0.62 + 0.07 * i), C.red); });
      for (var j = 0; j + 1 < T; j++) g.arrow(truth[j], truth[j + 1], 'rgba(230,233,238,0.7)', 2, seg(pr, 0.66 + 0.035 * j, 0.78 + 0.035 * j));
      P.lines(g, g.sideR, [{ text: 'camera: detailed images', col: C.gold }, { text: 'but quarter-turn aliases', col: C.gold },
        { text: 'acoustic range: sparse', col: C.blue }, { text: 'answers at ' + rangeTs.join(', '), col: C.blue, mono: true },
        { text: 'Doppler log: local steps', col: C.ink }, { text: 'small errors accumulate', col: C.ink },
        { text: 'reference model: appearance', col: JADE }, { text: 'around the whole pile', col: JADE }], pr, 'What the vehicle has', { rowH: 34 });
    } });

  // ------------------------------------------------------------ 2. the reference
  out.push({ id: 'model', chapter: CH.reference, title: 'Last year’s reference model', layout: 'side', dur: 5.6,
    text: 'Last year’s reconstruction supplies a reference appearance m(θ): what this strip of steel is expected to show at each heading around the pile. It is not the vehicle’s position and it is not a probability distribution. Four identical anodes and repeating marine growth make most headings ambiguous; one unique tag at ' + num(p.tagAt, 0) + '° breaks the pattern locally.',
    math: 'reference appearance: m(θ),  0° ≤ θ < 360°',
    draw: function (g, pr) { P.strip(g, g.sideR, { m: d.m, p: pr, title: 'reference appearance around the pile', tag: p.tagAt }); } });

  // ------------------------------------------------------------ 3. image likelihood
  var win4 = [d.theta[T4] - p.window, d.theta[T4] + p.window];
  out.push({ id: 'photo', chapter: CH.image, title: 'A photo is a noisy window on the reference', layout: 'side', dur: 5.4,
    text: 'Photo ' + T4 + ' came from heading ' + num(d.theta[T4], 0) + '° in this simulation. The camera sees a ' + num(2 * p.window + 1, 0) + '°-wide window of the circumference. The dots are the noisy image samples; the line is the reference appearance. The vehicle knows the dots and the full line, but not where the window belongs.',
    math: 'y(t,k) = m(θ(t) + offset(k)) + image noise',
    draw: function (g, pr) { P.strip(g, g.sideR, { m: d.m, p: pr, title: 'photo ' + T4 + ': a window cut from the reference', window: win4,
      samples: ph4.samples.map(function (v, i) { return { deg: d.theta[T4] + ph4.offsets[i], v: v }; }), anodes: false,
      marks: [{ deg: d.theta[T4], text: 'hidden heading ' + num(d.theta[T4], 0) + '°', col: C.gold, p: seg(pr, 0.7, 0.9) }] }); } });

  out.push({ id: 'match', chapter: CH.image, title: 'Slide the photo and score every heading', layout: 'side', dur: 6.4,
    text: 'Assume independent Gaussian image-sample noise. Apart from a constant, the squared match cost c_t(θ) is the negative log-likelihood of heading θ: lower means a better image match. Photo ' + T4 + ' has four nearly equal minima at ' + cand4.map(function (q) { return num(q.deg, 0) + '°'; }).join(', ') + '. This is not a bit log-likelihood ratio. An LLR compares two bit hypotheses; this curve compares every heading.',
    math: 'c_t(θ) = sum over k of [y(t,k) − m(θ + offset(k))]² / (2σ²)',
    draw: function (g, pr) {
      var R = P.split(g.sideR, 0.42), sweep = seg(pr, 0, 0.6) * 360;
      P.strip(g, R[0], { m: d.m, p: 1, title: 'slide the photo to ' + num(sweep, 0) + '°', window: [sweep - p.window, sweep + p.window],
        samples: ph4.samples.map(function (v, i) { return { deg: sweep + ph4.offsets[i], v: v }; }), anodes: false });
      P.costPlot(g, R[1], { c: d.costs[T4], p: seg(pr, 0, 0.6) + 0.0001, title: 'negative log-likelihood cost over headings',
        minima: cand4.map(function (q) { return { deg: q.deg, cost: q.cost }; }), cursor: sweep, cursorP: pr < 0.6 ? 1 : 0, deltaLog: true });
    } });

  out.push({ id: 'tagphoto', chapter: CH.image, title: 'A unique mark would settle one photo', layout: 'side', dur: 5,
    text: 'When the unique tag is visible, the best heading is ' + num(d.tagCandidates[0].deg, 0) + '° and the next local minimum has a negative-log-likelihood cost larger by ' + num(tagGap, 1) + '. Most photos do not show such a marker. If we simply choose each photo’s cheapest heading independently, photos ' + wrong.join(', ') + ' land about a quarter turn away from their hidden positions.',
    math: 'photo-only tagging: wrong at photos ' + wrong.join(', ') + ';  largest simulated position error ' + num(d.errPhoto.max, 2) + ' m',
    draw: function (g, pr) { P.costPlot(g, g.sideR, { c: d.tagCost, p: pr, title: 'a photo that sees the unique tag',
      minima: d.tagCandidates.map(function (q, i) { return { deg: q.deg, cost: q.cost, col: i ? C.dim : C.orange, text: i ? '' : 'unique tag, ' + num(q.deg, 0) + '°' }; }), deltaLog: true }); } });

  // ------------------------------------------------------------ 4. readings become allowed sets
  var r0 = rangeOf(0), odoShow = 2, odoTrue = sub(truth[odoShow + 1], truth[odoShow]), odoRead = d.odo[odoShow];
  out.push({ id: 'readings', chapter: CH.sets, title: 'A reading is not a law', layout: 'map+side', view: VIEW, dur: 6,
    text: 'The acoustic range and Doppler displacement are reported readings. Their tildes matter: the true path need not lie exactly on a reported range circle or reproduce a reported arrow. Enforcing equality would turn sensor error into a false physical law. In this seeded trace, the largest range difference is ' + cm(maxRangeErr) + ' and the largest displacement difference is ' + cm(maxOdoErr) + '.',
    math: 'r̃(t) = ‖x(t) − s‖ + η_r(t);   d̃(t) = x(t+1) − x(t) + η_d(t)',
    draw: function (g, pr) {
      mapBase(g); truth.forEach(function (x) { P.star(g, x, 1); });
      P.circle(g, S, r0, C.blue, 2, seg(pr, 0.05, 0.35), [4, 4]);
      g.arrow(truth[odoShow], add(truth[odoShow], odoTrue), C.gold, 3, seg(pr, 0.32, 0.58));
      g.arrow(truth[odoShow], add(truth[odoShow], odoRead), C.violet, 2, seg(pr, 0.5, 0.76));
      P.lines(g, g.sideR, [{ text: 'reported range r̃₀ = ' + num(r0, 3) + ' m', col: C.blue, mono: true },
        { text: 'true simulated range differs', col: C.dim }, { text: 'by ' + cm(Math.abs(D.norm(sub(truth[0], S)) - r0)), col: C.blue },
        { text: 'reported displacement d̃₂', col: C.violet, mono: true }, { text: pair(odoRead, 3) + ' m', col: C.violet, mono: true },
        { text: 'hidden true displacement', col: C.gold }, { text: pair(odoTrue, 3) + ' m', col: C.gold, mono: true }], pr, 'Reported is not exact', { rowH: 37 });
    } });

  out.push({ id: 'allowed', chapter: CH.sets, title: 'Give each reading an allowed set', layout: 'map+side', view: VIEW, dur: 6.6,
    text: 'Each reported value now comes with a stated error allowance. A position is allowed when its standoff differs by at most ' + cm(p.standoffTol, 0) + ' and an answered range differs by at most ' + cm(p.rangeTol, 0) + '. A neighbouring pair is allowed when its displacement differs from the Doppler reading by at most ' + cm(p.odoTol, 0) + '. The simulator truncates its generated sensor errors to these allowances; field allowances would need calibration from field data.',
    math: '|‖x(t)‖ − ρ(standoff)| ≤ ε(standoff);   |‖x(t) − s‖ − r̃(t)| ≤ ε(range);   ‖x(t+1) − x(t) − d̃(t)‖ ≤ ε(odometry)',
    draw: function (g, pr) {
      mapBase(g, { standoffBand: true, standoffP: seg(pr, 0.02, 0.3) });
      P.annulus(g, S, r4, p.rangeTol, C.blue, seg(pr, 0.28, 0.58)); truth.forEach(function (x) { P.star(g, x, 1); });
      g.arrow(truth[odoShow], add(truth[odoShow], odoRead), C.violet, 2.5, seg(pr, 0.55, 0.8));
      P.lines(g, g.sideR, [{ text: 'standoff allowance ε_s', col: C.gold }, { text: cm(p.standoffTol, 0), col: C.gold, mono: true },
        { text: 'range allowance ε_r', col: C.blue }, { text: cm(p.rangeTol, 0), col: C.blue, mono: true },
        { text: 'displacement allowance ε_d', col: C.violet }, { text: cm(p.odoTol, 0), col: C.violet, mono: true },
        { text: 'bands, not exact circles', col: C.ink }], pr, 'Three local allowed sets', { rowH: 38 });
    } });

  out.push({ id: 'impostors', chapter: CH.sets, title: 'The range band rejects three visual aliases', layout: 'map', view: VIEW, dur: 6,
    text: 'Photo ' + T4 + ' leaves four nearly equal image candidates at ' + cand4.map(function (q) { return num(q.deg, 0) + '°'; }).join(', ') + '. Only the candidate near 130° lies inside both the standoff band and the reported-range band. This resembles a parity check pruning incompatible bit patterns. The distinction matters: parity is an exact code rule, whereas this band represents a sensor reading together with a stated allowance.',
    math: '|‖x − s‖ − ' + num(r4, 2) + ' m| ≤ ' + cm(p.rangeTol, 0) + ';  one of four candidates remains',
    draw: function (g, pr) {
      g.land(function (x) { return D.costAt(d.costs[T4], D.heading(x)); }, { id: 'cost4', rings: 8, alpha: 0.55 });
      mapBase(g, { standoffBand: true });
      candPts.forEach(function (x, i) { var q = seg(pr, 0.08 + 0.07 * i, 0.23 + 0.07 * i); g.dot(x, 6, C.orange, q); g.label(x, num(cand4[i].deg, 0) + '°', C.orange, { dx: x[0] > 0 ? 10 : -10, dy: x[1] > 0 ? -14 : 16, align: x[0] > 0 ? 'left' : 'right', p: q, size: 12 }); });
      P.annulus(g, S, r4, p.rangeTol, C.blue, seg(pr, 0.36, 0.64));
      candPts.forEach(function (x, i) { if (inRangeBand[i]) P.tick(g, x, seg(pr, 0.67, 0.84)); else P.cross(g, x, seg(pr, 0.67, 0.84), C.red); });
      g.label(S, 'reported range band at photo ' + T4, C.blue, { dx: -12, dy: 18, align: 'right', p: seg(pr, 0.5, 0.7), size: 12 });
      g.label(candPts[1], 'the allowed image candidate', JADE, { dx: 14, dy: 18, p: seg(pr, 0.84, 1), size: 12 });
    } });

  // ------------------------------------------------------------ 5. the decoding lens
  var ROWS = [['coded bits b₁ … bₙ', 'photo positions x₀ … x' + sb(T - 1)],
    ['bit LLR: two hypotheses', 'negative log-likelihood over headings'],
    ['local parity polytope', 'local geometric allowed set'],
    ['bit copied into checks', 'position copied into local sets'],
    ['copies agree on one bit', 'copies agree on one position'],
    ['valid parity checks', 'compatible with stated allowances']];
  out.push({ id: 'analogy', chapter: CH.lens, title: 'Localization is not literally decoding', layout: 'side', dur: 7,
    text: 'The useful analogy is structural. Both problems have shared unknowns, local objective terms and local admissible sets. Consensus ADMM gives each local set a replica, makes all replicas agree on the shared unknown, and records disagreement with scaled dual variables. The variables and the local mathematics are different.',
    math: 'shared unknowns + local objective terms + local sets + consensus copies',
    draw: function (g, pr) { P.table(g, g.sideR, ROWS, pr, 'A role-by-role dictionary', { head: ['ADMM-LP decoding', 'this localization example'], leftW: 250 }); } });

  out.push({ id: 'program', chapter: CH.lens, title: 'Two programs, one consensus pattern', layout: 'side', dur: 7,
    text: 'The ADMM-LP decoder minimizes a linear bit cost over a convex relaxation built from local parity polytopes. The dive minimizes a multimodal image cost over continuous positions and nonconvex radial bands. Consensus splitting applies to both, but their relaxations, objectives, local updates and guarantees differ.',
    math: 'decoder: min γᵀb,  z(a) ∈ P(d(a)),  z(a) = b[N(a)];   dive: min sum over t of c_t(x(t)),  x in the stated allowed sets',
    draw: function (g, pr) {
      var R = P.split(g.sideR, 0.5);
      P.lines(g, R[0], [{ text: 'minimise γᵀb', col: C.gold, mono: true }, { text: 'b in [0,1]ⁿ', col: C.ink, mono: true },
        { text: 'z_a in parity polytope P_d', col: C.violet, mono: true }, { text: 'z_a = b on check a', col: C.blue, mono: true },
        { text: 'convex relaxation', col: JADE }], pr, 'ADMM-LP decoder', { rowH: 42 });
      P.lines(g, R[1], [{ text: 'minimise Σ c_t(x_t)', col: C.gold, mono: true }, { text: 'standoff band', col: C.ink },
        { text: 'reported-range band', col: C.blue }, { text: 'displacement-error ball', col: C.violet },
        { text: 'multimodal and nonconvex', col: C.red }], pr, 'Inspection dive', { rowH: 42 });
    } });

  // ------------------------------------------------------------ 6. consensus ADMM
  var zoom = around([d.photoOnly[T4]], 0, 6);
  out.push({ id: 'copies', chapter: CH.admm, title: 'Split: one replica per local set', layout: 'map', view: zoom, dur: 6,
    text: 'Each local set keeps a replica z of every position it touches. Position ' + T4 + ' therefore has four replicas: one for standoff, one for its answered range, and one in each neighbouring odometry pair. A scaled dual variable u accompanies every replica and accumulates signed disagreement with the shared position x. In a decoder, a bit is replicated in the parity checks that contain it.',
    math: 'shared position x(t);  local replica z(f,t);  scaled dual u(f,t)',
    draw: function (g, pr) {
      mapBase(g, { beacon: false }); var x4 = d.photoOnly[T4]; P.vehicle(g, x4, 1);
      g.label(x4, 'x' + sb(T4) + ', shared by four local sets', JADE, { dx: 0, dy: -26, align: 'center', size: 12 });
      var e = D.scale(x4, 1 / D.norm(x4)), n = [-e[1], e[0]];
      P.copyDot(g, add(x4, D.scale(e, 1.3)), x4, seg(pr, 0.08, 0.28), 'standoff replica', { dx: 12, dy: 4 });
      P.copyDot(g, add(x4, D.scale(n, 1.3)), x4, seg(pr, 0.28, 0.48), 'range replica', { dx: -12, dy: -4, align: 'right' });
      P.copyDot(g, add(x4, D.scale(n, -1.3)), x4, seg(pr, 0.48, 0.68), 'incoming-step replica', { dx: 12, dy: 14 });
      P.copyDot(g, add(x4, D.scale(e, -1.3)), x4, seg(pr, 0.68, 0.88), 'outgoing-step replica', { dx: -12, dy: 14, align: 'right' });
    } });

  var symView = around([x4n, zStd, add(zStd, u4), v4], 0.8, 2.4);
  out.push({ id: 'symbols', chapter: CH.admm, title: 'Four symbols, three stored objects', layout: 'map+side', view: symView, dur: 6.5,
    text: 'The shared position x, local replica z and scaled dual u are stored. The next fit step uses v = z − u, so we draw v as the corrected target or “aim.” It is derived from z and u; it is not another position estimate and it is not a sensor reading. The identity on the right explains the minus sign.',
    math: '‖x − z + u‖² = ‖x − (z − u)‖²;   define v = z − u',
    draw: function (g, pr) {
      mapBase(g, { beacon: false }); P.vehicle(g, x4n, 1, 'shared x');
      g.dot(zStd, 6, C.blue, 1); g.label(zStd, 'replica z', C.blue, { dx: 10, dy: -14, size: 12 });
      g.arrow(zStd, add(zStd, u4), C.orange, 2.5, seg(pr, 0.12, 0.38));
      g.label(lerp2(zStd, add(zStd, u4), 0.55), 'scaled dual u', C.orange, { dx: 10, dy: -8, p: seg(pr, 0.3, 0.5), size: 12 });
      g.arrow(zStd, v4, C.violet, 3, seg(pr, 0.48, 0.78)); g.dot(v4, 6, C.violet, seg(pr, 0.72, 0.88));
      g.label(v4, 'derived aim v = z − u', C.violet, { dx: -10, dy: 18, align: 'right', p: seg(pr, 0.78, 1), size: 12 });
      P.lines(g, g.sideR, [{ text: 'x  shared position', col: JADE }, { text: 'z  local replica', col: C.blue },
        { text: 'u  scaled dual', col: C.orange }, { text: 'v  derived aim z − u', col: C.violet },
        { text: 'stored: x, z, u', col: C.ink }, { text: 'derived when needed: v', col: C.dim }], pr, 'The symbols', { rowH: 42 });
    } });

  var aimsView = around([d.photoOnly[T4], fit4.x].concat(aims4), 0.6, 3.5);
  out.push({ id: 'fit', chapter: CH.admm, title: 'Fit: image cost plus consensus targets', layout: 'map+side', view: aimsView, dur: 6.5,
    text: 'For one position, the fit step combines its image cost with a quadratic term to every derived target v. The fixed ADMM penalty parameter is ρ = ' + num(p.rhoAdmm, 0) + '; it controls this numerical coupling, not sensor confidence. The code tests all 720 half-degree headings, keeps the best sample, then locally polishes inside that sample’s neighbourhood. This is an approximate nonlinear update, not CAJODE’s channel linear-system solve.',
    math: 'x(t) ≈ arg min over x of  c_t(x) + sum over f of (ρ/2)‖x − v(f,t)‖²;   720 samples + local polish',
    draw: function (g, pr) {
      g.land(function (x) { var val = D.costAt(d.costs[T4], D.heading(x)); for (var k = 0; k < aims4.length; k++) { var dx = x[0] - aims4[k][0], dy = x[1] - aims4[k][1]; val += p.rhoAdmm / 2 * (dx * dx + dy * dy); } return val; }, { id: 'fit4', rings: 10, alpha: 0.6 });
      mapBase(g, { beacon: false }); var x0 = d.photoOnly[T4];
      aims4.forEach(function (a, i) { g.dot(a, 5, C.violet, seg(pr, 0.04 + 0.055 * i, 0.15 + 0.055 * i)); g.line(x0, a, C.orange, 1.5, seg(pr, 0.14 + 0.055 * i, 0.3 + 0.055 * i), [4, 3]); });
      g.label(aims4[0], 'four derived aims v', C.violet, { dx: -10, dy: -14, align: 'right', p: seg(pr, 0.24, 0.4), size: 12 });
      var q = seg(pr, 0.42, 0.82); g.path([x0, fit4.x], C.ink, 2, q, [4, 3]); P.vehicle(g, lerp2(x0, fit4.x, q), 1, q >= 1 ? 'polished update: ' + deg(fit4.x) : '');
      P.costPlot(g, g.sideR, { c: curve4.total, p: pr, title: 'image cost plus consensus penalties', lineCol: C.gold,
        minima: [{ deg: fit4.phi, cost: D.costAt(curve4.total, fit4.phi), text: 'polished ' + num(fit4.phi, 1) + '°' }],
        marks: [{ deg: fit4.gridPhi, text: 'best grid sample', col: C.blue, p: seg(pr, 0.2, 0.42), dy: 18 }], vLabel: 'combined objective' });
    } });

  var projView = around([x4n, zStd, zRng, zIn[0], zIn[1], zOut[0], zOut[1]], 0.8, 2.5);
  out.push({ id: 'project', chapter: CH.admm, title: 'Project: put every replica in its allowed set', layout: 'map', view: projView, dur: 6.5,
    text: 'Each local replica starts from x + u and moves to a nearest point in its allowed set. A point already inside a standoff or range band does not move; an outside radius is clipped to the nearer edge. An odometry pair already inside its displacement allowance does not move. Otherwise both endpoints move equally until their displacement reaches the allowance boundary.',
    math: 'z(f) ← projection onto C(f) of [x(f) + u(f)],  where C(f) is one local allowed set',
    draw: function (g, pr) {
      mapBase(g, { beacon: false, standoffBand: true }); P.vehicle(g, x4n, 1, 'x' + sb(T4) + ' after the fit');
      g.dot(x3n, 5, C.ink, 1); g.dot(x5n, 5, C.ink, 1); g.label(x3n, 'x₃', C.ink, { dx: 10, dy: 14 }); g.label(x5n, 'x₅', C.ink, { dx: 10, dy: 14 });
      g.arrow(x4n, zStd, C.gold, 2.5, seg(pr, 0.08, 0.28)); g.label(zStd, 'into the standoff band', C.gold, { dx: 10, dy: -14, p: seg(pr, 0.22, 0.38), size: 11.5 });
      P.annulus(g, S, r4, p.rangeTol, C.blue, 1); g.arrow(x4n, zRng, C.blue, 2.5, seg(pr, 0.32, 0.52));
      g.label(zRng, 'into the range band', C.blue, { dx: 10, dy: 16, p: seg(pr, 0.46, 0.62), size: 11.5 });
      g.arrow(x3n, zIn[0], C.violet, 2, seg(pr, 0.58, 0.78)); g.arrow(x4n, zIn[1], C.violet, 2, seg(pr, 0.58, 0.78));
      g.line(zIn[0], zIn[1], C.violet, 1.5, seg(pr, 0.72, 0.88), [3, 3]);
      g.label(zIn[1], 'odometry pair: both ends move', C.violet, { dx: -12, dy: 18, align: 'right', p: seg(pr, 0.8, 0.96), size: 11.5 });
    } });

  var ledView = around([x4n, zStd, add(zStd, u4), v4], 1.2, 2.2);
  out.push({ id: 'ledger', chapter: CH.admm, title: 'Ledger: accumulate signed disagreement', layout: 'map', view: ledView, dur: 6,
    text: 'After projection, the scaled dual update adds the signed gap x − z. If that signed disagreement persists, u accumulates and the next derived target v = z − u shifts in the opposing direction. If the gap reverses, the ledger can shrink. The penalty parameter ρ stays fixed: the ledger shifts the target; it does not make the rope stiffer.',
    math: 'u ← u + x − z;   next derived target v = z − u',
    draw: function (g, pr) {
      mapBase(g, { beacon: false }); P.vehicle(g, x4n, 1, 'shared x'); g.dot(zStd, 6, C.blue, 1);
      g.label(zStd, 'replica z', C.blue, { dx: 10, dy: -14, size: 12 });
      g.arrow(zStd, x4n, C.orange, 2.5, seg(pr, 0.08, 0.36));
      g.label(lerp2(zStd, x4n, 0.55), 'add gap x − z to u', C.orange, { dx: 10, dy: -8, p: seg(pr, 0.28, 0.48), size: 12 });
      g.arrow(zStd, v4, C.violet, 3, seg(pr, 0.5, 0.8)); g.dot(v4, 6, C.violet, seg(pr, 0.72, 0.9));
      g.label(v4, 'next aim v = z − u', C.violet, { dx: -10, dy: 18, align: 'right', p: seg(pr, 0.78, 1), size: 12 });
    } });

  // ------------------------------------------------------------ 7. run and audit
  function xAt(k) {
    var a = its[Math.min(Math.floor(k), K_END)], b = its[Math.min(Math.floor(k) + 1, K_END)], f = ease(clamp(k - Math.floor(k), 0, 1));
    return a.x.map(function (q, j) { return lerp2(q, b.x[j], f); });
  }
  function metricLog(k, which) {
    var kk = clamp(k, which === 'dual' ? 1 : 0, K_END), i = Math.floor(kk), f = kk - i;
    function value(rec) {
      if (which === 'excess') return rec.excess / p.feasTol;
      if (which === 'primal') return rec.primal / rec.epsPri;
      return rec.dual / rec.epsDual;
    }
    var a = log10(value(its[i])), b = log10(value(its[Math.min(i + 1, K_END)])); return a * (1 - f) + b * f;
  }
  var resLo = -2, resHi = 2;
  for (var kr = 1; kr <= K_END; kr++) ['excess', 'primal', 'dual'].forEach(function (q) { var v = metricLog(kr, q); resLo = Math.min(resLo, v - 0.2); resHi = Math.max(resHi, v + 0.2); });

  out.push({ id: 'run', chapter: CH.run, title: 'Run all three moves—and watch three tests', layout: 'map+side', view: VIEW, dur: 8,
    text: 'Starting from the independent photo tags, each round repeats fit, projection and scaled-dual update. Three diagnostics answer different questions. Allowed-set overrun asks whether the shared path lies inside every stated band. The primal residual measures shared-position versus replica disagreement. The dual residual measures how much the replicas are still changing. The curves can rise as well as fall.',
    math: 'allowed-set overrun first passes at round ' + K_ADMISS + ';  this run accepts at round ' + K_END + ' when all three normalized tests are ≤ 1',
    draw: function (g, pr) {
      mapBase(g, { standoffBand: true }); truth.forEach(function (x) { P.star(g, x, 1); });
      var k = seg(pr, 0, 0.92) * K_END, xs = xAt(k); g.path(xs, 'rgba(127,214,180,0.7)', 2, 1);
      xs.forEach(function (x, j) { P.vehicle(g, x, 1, j === T4 ? 'round ' + Math.floor(k) : ''); });
      var pl = g.plot(g.sideR, [0, K_END], [resLo, resHi], { title: 'gold overrun · jade primal · blue dual' });
      pl.frame('round', 'log₁₀(diagnostic / threshold)'); pl.seg(0, 0, K_END, 0, C.dim, 1.5, 1, [5, 4]);
      g.labelPx(pl.X(1), pl.Y(0) - 9, 'pass line', C.dim, { size: 11, plain: true });
      pl.curve(function (kk) { return metricLog(kk, 'excess'); }, C.gold, 2, clamp(k / K_END, 0, 1));
      pl.curve(function (kk) { return metricLog(kk, 'primal'); }, JADE, 2, clamp(k / K_END, 0, 1));
      pl.curve(function (kk) { return metricLog(kk, 'dual'); }, C.blue, 2, clamp((k - 1) / (K_END - 1), 0, 1));
      if (k >= K_ADMISS) pl.seg(K_ADMISS, resLo, K_ADMISS, resHi, C.gold, 1, 1, [3, 4]);
    } });

  out.push({ id: 'result', chapter: CH.run, title: 'What happened in this seeded simulation', layout: 'map+side', view: VIEW, dur: 6.5,
    text: 'The photo-only tags miss by as much as ' + num(d.errPhoto.max, 2) + ' m. After the constrained solve, every tag is within ' + cm(d.errSolved.max) + ' of the hidden simulated position. A real inspection has no gold stars; this comparison validates this demonstration, not field accuracy. The final image cost is slightly higher—' + num(final.cost, 1) + ' instead of ' + num(its[0].cost, 1) + '—because the solver rejects visually cheap but mutually incompatible aliases.',
    math: 'largest hidden-truth error: ' + num(d.errPhoto.max, 2) + ' m → ' + num(d.errSolved.max, 3) + ' m;   image cost: ' + num(its[0].cost, 1) + ' → ' + num(final.cost, 1),
    draw: function (g, pr) {
      mapBase(g, { standoffBand: true }); truth.forEach(function (x) { P.star(g, x, 1); });
      d.photoOnly.forEach(function (x, j) { if (wrong.indexOf(j) >= 0) P.cross(g, x, seg(pr, 0.08, 0.3), C.red); });
      if (wrong.length) g.label(d.photoOnly[wrong[Math.floor(wrong.length / 2)]], 'photo-only aliases: ' + wrong.join(', '), C.red, { dx: 0, dy: 46, align: 'center', p: seg(pr, 0.2, 0.36), size: 11.5 });
      sol.x.forEach(function (x, j) { P.tick(g, x, seg(pr, 0.46 + 0.04 * j, 0.62 + 0.04 * j)); });
      P.table(g, g.sideR, truth.map(function (x, j) { return ['photo ' + j + ' (' + num(d.theta[j], 0) + '°)', num(d.errPhoto.each[j], 2) + ' m  →  ' + num(d.errSolved.each[j], 3) + ' m']; }), pr,
        'Error against hidden simulation truth', { leftW: 110, leftCol: C.gold, head: ['photo', 'photo-only → constrained'] });
    } });

  out.push({ id: 'evidence', chapter: CH.run, title: 'What this run establishes, and what it does not', layout: 'side', dur: 7,
    text: 'This is an auditable termination report, not a global-optimality certificate. The nonconvex image surface and radial sets leave open the possibility of another basin with a lower objective. In ADMM-LP decoding, an integral optimum of the convex relaxation has the maximum-likelihood certificate property. Merely satisfying the parity checks establishes only that the hard word is a valid codeword.',
    math: 'admissibility + numerical convergence + synthetic truth check  ≠  proof of a global optimum or field accuracy',
    draw: function (g, pr) { P.table(g, g.sideR, [
      ['allowed sets', 'PASS · overrun ' + cm(final.excess, 2) + ' ≤ ' + cm(p.feasTol, 1)],
      ['primal residual', 'PASS · ' + num(final.primal, 5) + ' ≤ ' + num(final.epsPri, 5)],
      ['dual residual', 'PASS · ' + num(final.dual, 5) + ' ≤ ' + num(final.epsDual, 5)],
      ['hidden simulation truth', 'PASS · largest error ' + cm(d.errSolved.max)],
      ['global optimum', 'NOT ESTABLISHED'], ['field accuracy', 'NOT ESTABLISHED']
    ], pr, 'Termination report', { head: ['question', 'answer from this run'], leftW: 210, leftCol: C.gold }); } });

  // ------------------------------------------------------------ 8. the exact bridge to CAJODE
  out.push({ id: 'shared_structure', chapter: CH.cajode, title: 'The part the dive and CAJODE genuinely share', layout: 'side', dur: 7,
    text: 'Both methods use consensus ADMM where a shared quantity appears in several local constraint sets. The dive shares positions across geometric sets; CAJODE shares bit variables across parity checks. Each local set keeps replicas z, projects them, and updates scaled dual variables u. CAJODE’s channel C is fitted jointly, but parity checks do not keep channel replicas.',
    math: 'shared pattern: shared variable → local replicas → projection → scaled-dual update',
    draw: function (g, pr) {
      var R = P.split(g.sideR, 0.5);
      P.lines(g, R[0], [{ text: 'shared: position x_t', col: C.gold }, { text: 'set: one geometric rule', col: C.ink },
        { text: 'replica z per occurrence', col: C.blue }, { text: 'scaled dual u', col: C.orange },
        { text: 'project onto geometric set', col: C.violet }, { text: 'extra fitted state: none', col: C.dim }], pr, 'Inspection dive', { rowH: 38 });
      P.lines(g, R[1], [{ text: 'shared: bit variable b_i', col: C.gold }, { text: 'set: one parity polytope', col: C.ink },
        { text: 'replica z per check', col: C.blue }, { text: 'scaled dual u', col: C.orange },
        { text: 'project onto parity polytope', col: C.violet }, { text: 'channel C: fitted, not copied', col: JADE }], pr, 'CAJODE', { rowH: 38 });
    } });

  out.push({ id: 'cajode_adds', chapter: CH.cajode, title: 'What CAJODE adds to that shared skeleton', layout: 'side', dur: 7,
    text: 'CAJODE is a joint channel-and-bit receiver, so one update is richer than this dive. It chooses pseudo-Huber observation weights, updates the bounded bit variables, chooses the weights again, solves all channel coefficients together, projects each check replica onto its parity polytope, and then updates the scaled dual variables. The exact shared lines are the replica projection and scaled-dual update; the earlier fitted-variable update is application-specific.',
    math: 'CAJODE: weights → bits → weights → channel → parity replicas → scaled duals',
    draw: function (g, pr) {
      var R = P.split(g.sideR, 0.4);
      P.lines(g, R[0], [{ text: '1  sampled image cost', col: C.gold }, { text: '2  search and polish positions', col: JADE },
        { text: '3  project geometric replicas', col: C.violet }, { text: '4  update scaled duals', col: C.orange }], pr, 'This dive', { rowH: 42 });
      P.lines(g, R[1], [{ text: '1  weight each observation', col: C.blue }, { text: '2  update bit variables b', col: C.gold },
        { text: '3  choose weights again', col: C.blue }, { text: '4  solve channel coefficients C', col: JADE },
        { text: '5  project parity replicas z', col: C.violet }, { text: '6  update scaled duals u', col: C.orange }], pr, 'One CAJODE update', { rowH: 38 });
    } });

  out.push({ id: 'cajode_doorway', chapter: CH.cajode, title: 'The exact doorway from CAJODE to a decoder', layout: 'side', dur: 7,
    text: 'With a known unit channel, unit observation weights and no channel update, CAJODE’s bit step reduces to the penalized ADMM decoder run on the bit LLRs. Full CAJODE restores the unknown channel, the pseudo-Huber weights and the joint updates. The dive reports primal and dual residuals; CAJODE accepts the first parity-valid hard word that passes its CRC. CRC acceptance does not prove continuous convergence, stationarity or a global optimum.',
    math: 'known unit channel + unit weights + no channel step ⇒ penalized ADMM decoder;   parity + CRC is a different finish line',
    draw: function (g, pr) {
      var R = P.split(g.sideR, 0.5);
      P.lines(g, R[0], [{ text: 'known unit channel', col: C.blue }, { text: 'unit observation weights', col: C.blue },
        { text: 'no channel update', col: C.dim }, { text: 'g_i becomes the bit LLR', col: C.gold },
        { text: 'penalized ADMM decoder', col: JADE }], pr, 'Exact reduction', { rowH: 42 });
      P.lines(g, R[1], [{ text: 'dive: primal residual', col: C.blue }, { text: 'dive: dual residual', col: C.blue },
        { text: 'CAJODE: parity-valid word', col: C.violet }, { text: 'CAJODE: CRC passes', col: C.gold },
        { text: 'does not prove convergence', col: C.red }, { text: 'or a global optimum', col: C.red }], pr, 'Different finish lines', { rowH: 38 });
    } });

  // ------------------------------------------------------------ 9. what we learned
  var KEY = [['ADMM-LP decoder', 'bit LLR objective + parity polytopes'],
    ['CAJODE', 'joint channel/bit objective + parity replicas'],
    ['monopile dive', 'image likelihood + geometric allowed sets'],
    ['shared machinery', 'replicas, projections, scaled dual variables'],
    ['application-specific', 'local updates, stopping tests, guarantees']];
  out.push({ id: 'learned', chapter: CH.learned, title: 'The reusable lesson', layout: 'side', dur: 7,
    text: 'The lesson is not that localization and decoding are identical. It is that local objective terms and local constraints can be coordinated through shared variables, local replicas, projections and scaled-dual updates. That consensus-ADMM skeleton is reusable. Every application still needs its own objective, local solvers, stopping tests and claims.',
    math: 'reuse the architecture; re-derive the application',
    draw: function (g, pr) { P.table(g, g.sideR, KEY, pr, 'Same architecture, different mathematics', { leftW: 180 }); } });

  out.push({ id: 'end', chapter: CH.learned, title: 'The dive, in one sentence', layout: 'map', view: VIEW, dur: 5,
    text: T + ' ambiguous photos, ' + rangeTs.length + ' sparse ranges and ' + (T - 1) + ' odometry readings were joined through local allowed sets and consensus copies; in this seeded simulation, the final tags lie within ' + cm(d.errSolved.max) + ' of hidden truth. Revisit “Four symbols” for x, z, u and v, or “The exact doorway” for the CAJODE connection.',
    math: 'image likelihood proposes; allowed sets reject; consensus ADMM coordinates',
    draw: function (g, pr) { mapBase(g, { standoffBand: true }); truth.forEach(function (x) { P.star(g, x, 1); }); var up = seg(pr, 0.1, 0.9) * (T - 1), q = path(g, sol.x, up, JADE, 2); P.vehicle(g, q, 1); } });

  // ------------------------------------------------------------ player and chapter bar
  var chapters = [];
  out.forEach(function (s, i) { if (!chapters.length || chapters[chapters.length - 1].name !== s.chapter) chapters.push({ name: s.chapter, start: i, n: 0 }); chapters[chapters.length - 1].n++; });
  var bar = document.getElementById('progress');
  if (bar) {
    bar.innerHTML = chapters.map(function (ch, k) { return '<button type="button" class="seg" data-k="' + k + '" style="flex-grow:' + ch.n + '" title="' + ch.name + '"><span class="fill"></span><span class="name">' + ch.name + '</span></button>'; }).join('');
    bar.addEventListener('click', function (e) { var b = e.target.closest ? e.target.closest('[data-k]') : null; if (b) B.go(chapters[+b.getAttribute('data-k')].start); });
  }
  B.onStep(function (i) {
    if (!bar) return;
    Array.prototype.forEach.call(bar.querySelectorAll('[data-k]'), function (b, k) {
      var ch = chapters[k], f = clamp((i - ch.start + 1) / ch.n, 0, 1); b.querySelector('.fill').style.width = Math.round(f * 100) + '%'; b.classList.toggle('on', i >= ch.start && i < ch.start + ch.n);
    });
  });
  document.addEventListener('keydown', function (e) { if (e.ctrlKey || e.metaKey || e.altKey) return; if (e.target && /^(INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY)$/.test(e.target.tagName) && (e.key === ' ' || e.key === 'Enter')) return; B.key(e); });
  B.openSteps(out, { embedded: true });
  window.course = { steps: out, chapters: chapters, dive: d };
  var hash = (window.location && window.location.hash) || '', ms = /step=([^&]+)/.exec(hash), mp = /p=([0-9.]+)/.exec(hash);
  if (ms) { var st = decodeURIComponent(ms[1]); B.debug({ step: /^\d+$/.test(st) ? +st : st, p: mp ? +mp[1] : 1 }); }
})();
