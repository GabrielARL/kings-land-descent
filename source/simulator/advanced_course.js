// The advanced tutorial "The Jade Keep": the second stronghold of the tale "Three heroes downhill", told as one
// line of steps that the reader clicks through.  The Twins go on alone to a Keep where the sentries hold jade
// tiles, a Veil hangs over the lanterns, Wardens keep the towers' laws and a Herald waits at the gate.  Each new
// teaching name is tied to its receiver meaning when it first appears; the key near the end is a recap.  The lands
// and walks come from keep.js, the drawing parts from advanced_parts.js, the player and kit from board.js.
(function () {
  'use strict';
  var E = window.Engine, B = window.Board, K = window.Keep, P = window.KeepParts; if (!E || !B || !K || !P) return;
  var H = B.H, C = H.C, seg = H.seg, num = H.num, pair = H.pair, at = H.at, add = H.add, sub = H.sub, len = H.len, lerp2 = H.lerp2, around = H.around, ease = H.ease, clamp = H.clamp, scale = H.scale;
  var JADE = P.JADE, sb = P.subscript, word = P.word, TAU = 2 * Math.PI;

  // ------------------------------------------------------------ the lands and the walks
  var Kb = K.build('keep'), kw = Kb.walk, land = Kb.land, rho = Kb.p.rho, beta = land.beta, leans = land.leans, VIEW = K.VIEW;
  var Vb = K.build('veil'), vw = Vb.walk, veil = Vb.land;
  var Rb = K.build('row'), rw = Rb.walk;
  var fortP = E.PRESETS.fort, fort = E.buildLand('fort', fortP), fortView = [-1.3, 1.3, -1.3, 1.3], fortShade = P.shadeOf(fort.J, fortView, 'fort', 14);
  var keepShade = P.shadeOf(land.J, VIEW, 'keep'), shades = {};
  function veilShade(c, id) { if (!shades[id]) shades[id] = P.shadeOf(function (b) { return veil.J(c, b); }, VIEW, id); return shades[id]; }
  var hd = kw.herald, rec = kw[3], b2 = rec.from, z2 = rec.zFrom, u2 = rec.uFrom, v2 = rec.v, b3 = rec.x, z3 = rec.z, u3 = rec.u;
  var b0 = kw[0].x, z0 = kw[0].z, u0 = kw[0].u, gate = [1.12, 0.55];
  var vr = vw[3], vhd = vw.herald, vD = vw.length - 1, vRest = vw.rest == null ? vD : vw.rest, vEnd = vw[vRest];
  function firstGapAtMost(walk, tol) { for (var i = 0; i < walk.length; i++) if (walk[i].gap <= tol) return i; return walk.length - 1; }
  function circuitSpan(ks) {
    if (!ks.length) return '';
    var runs = [], a = ks[0], b = a;
    for (var i = 1; i < ks.length; i++) { if (ks[i] === b + 1) b = ks[i]; else { runs.push(a === b ? String(a) : a + '–' + b); a = b = ks[i]; } }
    runs.push(a === b ? String(a) : a + '–' + b); return runs.join(', ');
  }
  var vMeet = firstGapAtMost(vw, 1e-12), postSealChanges = [];
  for (var vk = vhd + 1; vk <= vRest; vk++) if (word(vw[vk].word) !== word(vw[vhd].word)) postSealChanges.push(vk);
  function kb(g, o) { P.keepBase(g, land.J, keepShade, o); }
  function star(g, q, p, text) {
    if (!(p > 0)) return; var c = g.ctx, a = g.P(q), r = 11 * H.backOut(p);
    var gl = c.createRadialGradient(a[0], a[1], 0, a[0], a[1], 30); gl.addColorStop(0, 'rgba(255,210,122,0.55)'); gl.addColorStop(1, 'rgba(255,210,122,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(a[0], a[1], 30, 0, TAU); c.fill();
    c.beginPath(); for (var i = 0; i < 10; i++) { var an = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(a[0] + rr * Math.cos(an), a[1] + rr * Math.sin(an)); }
    c.closePath(); c.fillStyle = '#ffd27a'; c.fill(); c.strokeStyle = '#8a4b00'; c.lineWidth = 1.2; c.stroke();
    if (text) g.label(q, text, C.gold, { dx: 16, dy: 14, p: seg(p, 0.4, 1), size: 12.5 });
  }
  function walkTo(g, walk, upto, col, w, key) {
    key = key || 'x'; var n = Math.min(walk.length - 1, Math.floor(upto)), f = clamp(upto - n, 0, 1), pts = [];
    for (var k = 0; k <= n; k++) pts.push(walk[k][key]);
    var now = n < walk.length - 1 ? lerp2(walk[n][key], walk[n + 1][key], ease(f)) : walk[n][key];
    pts.push(now); g.path(pts, col, w || 2.5, 1);
    for (k = 1; k <= n; k++) g.dot(walk[k][key], 2.8, col, 1);
    return now;
  }
  function split(R, share, gap) {  // a panel cut in two, side by side when wide enough, else top and bottom
    gap = gap || 8;
    if (R[2] >= R[3] * 1.25 && R[2] >= 600) { var w = Math.round((R[2] - gap) * share); return [[R[0], R[1], w, R[3]], [R[0] + w + gap, R[1], R[2] - w - gap, R[3]]]; }
    var h = Math.round((R[3] - gap) * share); return [[R[0], R[1], R[2], h], [R[0], R[1] + h + gap, R[2], R[3] - h - gap]];
  }
  function tick(ok) { return ok ? '✓' : '✗'; }
  var out = [], CH = { road: 'The road to the Keep', tile: 'The jade tile', first: 'The Herald’s first word', circuit: 'One circuit at the Keep', herald: 'The Herald rides',
                       veil: 'The Veil', towers: 'Two towers, one sentry', weave: 'The Veil’s weave', key: 'Behind the tale' };

  // ------------------------------------------------------------ 1. the road to the Keep
  var fT = fort.treasure, fx0 = E.lanternStart(fortP);
  out.push({ id: 'road', chapter: CH.road, title: 'The road to the Jade Keep', layout: 'map', view: fortView, dur: 5,
    text: 'This advanced tale continues “Three heroes downhill,” especially its ADMM chapter. Beyond the Coral Fort stands the Jade Keep, a teaching model for CAJODE—Code-Aided Joint OFDM Demodulation and Error Correction. The Pilgrim and Cartographer stay behind. The Twins go on: the Wanderer will carry bit variables in their continuous relaxation, the Warden will keep a replica variable associated with the parity check inside its lawful set, and the ledger will remember their disagreement.',
    math: 'recap: bit variables b in [0,1];  lawful replica variable z;  scaled dual variable u;  final agreement b = z',
    draw: function (g, p) {
      g.land(fort.J, fortShade); g.axes(); g.path([[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]], 'rgba(255,210,122,0.6)', 1.5, 1, [6, 4]); g.line(fort.lawSegment[0], fort.lawSegment[1], C.blue, 2, 1, [6, 4]);
      g.labelPx(g.mapR[0] + g.mapR[2] / 2, g.mapR[1] + 24, 'the Coral Fort', C.gold, { align: 'center', size: 14 });
      star(g, fT, 1); g.hero(add(fT, [-0.2, 0.02]), 'pg', 1); g.hero(add(fT, [-0.02, -0.2]), 'lb', 1);
      var q = seg(p, 0.3, 0.9), tw = lerp2(fT, [1.22, 1.22], q); g.hero(tw, 'tw', 1, q < 0.05 ? 'the Twins' : ''); P.warden(g, add(tw, [0.06, -0.06]), 1);
      g.labelPx(g.mapR[0] + g.mapR[2] - 14, g.mapR[1] + 64, 'to the Jade Keep →', JADE, { align: 'right', p: seg(p, 0.5, 0.8), size: 12.5 });
      g.label(fT, 'the Pilgrim and the Cartographer stay', C.dim, { dx: -34, dy: 56, align: 'right', p: seg(p, 0.7, 0.95), size: 12 });
    } });
  out.push({ id: 'keep', chapter: CH.road, title: 'The Jade Keep', layout: 'map', view: VIEW, dur: 5,
    text: 'This smallest Keep has two sentries and one parity check involving both of them. The check enforces even parity, so the two decided bits must agree. Each sentry holds a relaxed tile b between 0 and 1. The Warden’s replica may stand anywhere on the blue line z₁ = z₂; only the endpoints are binary words, 00 and 11. The King sent 00, shown here only as hidden ground truth for the lesson. The receiver does not get to compare its candidate with that truth. Full CAJODE uses the parity polytope for each longer check.',
    math: 'bit variables b = (b₁, b₂) ∈ [0, 1]²;  one check on bits 1 and 2: z₁ = z₂;  hidden truth ' + at(0.8, word(land.sent)),
    draw: function (g, p) {
      kb(g, { squareP: seg(p, 0, 0.3), lawP: seg(p, 0.3, 0.55) }); P.corners(g, seg(p, 0.2, 0.7), land.lawful);
      g.label([0.5, 0.5], 'the lawful line', C.blue, { dx: 10, dy: -12, p: seg(p, 0.45, 0.6), size: 12 });
      star(g, land.treasure, seg(p, 0.75, 1), 'the true order, 00');
    } });
  out.push({ id: 'cast', chapter: CH.road, title: 'The four working objects', layout: 'map+side', view: VIEW, dur: 5.4,
    text: 'The Wanderer carries the vector b of shared bit variables in the continuous relaxation; the earlier tale called this cost copy x. The Warden keeps the replica variable z on the lawful blue line. The ledger u is the scaled dual variable: after a circuit it adds the signed gap b − z. The Herald thresholds the Wanderer’s b—not the Warden’s z—at 1/2: values below the threshold become 0, and values at or above it become 1. In this two-bit toy only, the King’s Seal is a truth oracle that accepts the intended word; a real receiver instead tests all parity checks, verifies every bit whose value is fixed by the receiver configuration, and tests the candidate’s CRC, without knowing the transmitted word.',
    math: 'Wanderer b;  Warden z;  ledger u' + at(0.42, '<br>hard decision hᵢ = 0 below 1/2, else 1') + at(0.78, '<br>receiver acceptance = parity checks + configured bit values + CRC'),
    draw: function (g, p) {
      kb(g); P.corners(g, 1, land.lawful); g.hero(b0, 'tw', seg(p, 0.05, 0.25), 'Wanderer b'); P.warden(g, z0, seg(p, 0.2, 0.4), 'Warden z');
      P.herald(g, gate, seg(p, 0.35, 0.55)); g.line(gate, b0, C.gold, 1.5, seg(p, 0.45, 0.65), [4, 4]);
      P.lines(g, g.sideR, [{ text: 'b   bit variables in [0,1], read by the Herald', col: C.gold, mono: true }, { text: 'z   replica variable, kept lawful', col: C.blue, mono: true },
                           { text: 'u   scaled dual variable, remembers b − z', col: C.orange, mono: true }, { text: 'hard decision: threshold b at 1/2', col: JADE, mono: true }], p, 'Keep these roles separate');
    } });

  // ------------------------------------------------------------ 2. the jade tile
  var ridge = function (t) { return beta * t * (1 - t); };
  function tracks(g, p, make) { var R = split(g.sideR, 0.5)[0], R2 = split(g.sideR, 0.5)[1]; [0, 1].forEach(function (l) { make(g, l ? R2 : R, l, seg(p, 0.08 * l, 1 - 0.3 * (1 - l))); }); }
  out.push({ id: 'lean', chapter: CH.tile, title: 'A tile and its lantern', layout: 'side', dur: 4.6,
    text: 'A tile slides in its track between two notches, 0 and 1. Its lantern leans it with a steady push ℓ: the cost of a tile is ℓ times b, so a positive push drives the tile toward notch 0 and a negative one toward notch 1. The first lantern pushes with ℓ₁ = ' + num(leans[0], 1) + ', the second with ℓ₂ = ' + num(leans[1], 1) + ': the second leans the wrong way.',
    math: 'the lean’s cost: ℓ·b' + at(0.4, ';  ℓ₁ = ' + num(leans[0], 1) + ' → notch 0') + at(0.7, ',  ℓ₂ = ' + num(leans[1], 1) + ' → notch 1'),
    draw: function (g, p) {
      tracks(g, p, function (g, R, l, q) {
        var fn = function (t) { return leans[l] * t; }, notch = leans[l] < 0 ? 1 : 0;
        P.track(g, R, { title: 'sentry ' + (l + 1) + ': the lean, ℓ' + sb(l + 1) + '·b with ℓ' + sb(l + 1) + ' = ' + num(leans[l], 1), curves: [{ fn: fn, col: C.gold, p: seg(q, 0, 0.5), label: 'lean', at: 0.5 }],
                         tile: { t: H.mix(0.5, notch, seg(q, 0.5, 0.95)), p: seg(q, 0.3, 0.5), text: 'the tile' } });
      });
    } });
  out.push({ id: 'ridge', chapter: CH.tile, title: 'The ridge in the track', layout: 'side', dur: 4.6,
    text: 'A rounded ridge runs across the middle of every track: β·b(1 − b), highest at one half and level with the floor at both notches, with β = ' + num(beta, 1) + '. It tips an undecided tile off the centre. Lean and ridge together still leave each tile at a notch, but the ridge makes the middle of the track the worst place to rest.',
    math: 'ridge: β·b(1 − b),  β = ' + num(beta, 1) + at(0.5, ';  lean + ridge: ℓ·b + β·b(1 − b)'),
    draw: function (g, p) {
      tracks(g, p, function (g, R, l, q) {
        var lean = function (t) { return leans[l] * t; }, both = function (t) { return lean(t) + ridge(t); }, notch = leans[l] < 0 ? 1 : 0;
        P.track(g, R, { title: 'sentry ' + (l + 1) + ': lean + ridge', curves: [{ fn: lean, col: C.gold, w: 1.5, dash: [4, 4], label: 'lean', at: 0.78 }, { fn: ridge, col: JADE, p: seg(q, 0, 0.4), label: 'ridge', at: 0.5 }, { fn: both, col: C.ink, w: 2.5, p: seg(q, 0.35, 0.75), label: 'lean + ridge', at: 0.28 }],
                         tile: { t: notch, p: seg(q, 0.7, 0.9), text: 'still at notch ' + notch } });
      });
    } });
  // ------------------------------------------------------------ 3. the Herald's first word
  out.push({ id: 'first-word', chapter: CH.first, title: 'The Herald reads the first word', layout: 'map', view: VIEW, dur: 5,
    text: 'Before circuit 1, the Wanderer sets the relaxed tiles from the two fixed linear coefficients introduced above: b⁽⁰⁾ = ' + pair(b0) + '. The Herald thresholds that b at one half and reads ' + word(kw[0].word) + '. Its bits disagree, so their parity check fails and no Seal test is needed. The Warden initializes the replica at the nearest point on the relaxed lawful line, z⁽⁰⁾ = ' + pair(z0) + ', and the ledger—the scaled dual variable—starts at u⁽⁰⁾ = ' + pair(u0) + '.',
    math: 'threshold b⁽⁰⁾ = ' + pair(b0) + ' → hard decision ' + word(kw[0].word) + ': parity fails' + at(0.66, '<br>z⁽⁰⁾ = ' + pair(z0) + ';  u⁽⁰⁾ = ' + pair(u0)),
    draw: function (g, p) {
      kb(g); P.corners(g, 1, land.lawful); star(g, land.treasure, 1);
      g.hero(b0, 'tw', seg(p, 0, 0.2), 'Wanderer b⁽⁰⁾'); P.herald(g, gate, seg(p, 0.15, 0.35)); g.label(gate, 'the Herald thresholds b', C.gold, { dx: -16, dy: 30, align: 'right', p: seg(p, 0.2, 0.4), size: 12 });
      g.line(gate, b0, C.gold, 1.5, seg(p, 0.35, 0.55), [4, 4]); P.verdict(g, b0, false, seg(p, 0.5, 0.65));
      g.label(b0, 'hard decision ' + word(kw[0].word) + ': parity fails', C.red, { dx: 14, dy: 24, p: seg(p, 0.55, 0.7), size: 12 });
      g.line(b0, z0, C.blue, 2, seg(p, 0.7, 0.85), [5, 4]); P.warden(g, z0, seg(p, 0.8, 0.95), 'Warden z⁽⁰⁾ = ' + pair(z0, 2));
    } });

  // ------------------------------------------------------------ 4. one circuit at the Keep (Veil lifted), circuit 3
  var bu = add(b3, u2), cview = around([b2, z2, v2, b3, z3, bu, [1.2, 0], [b2[0], -0.2]], 0.5, 0.7);
  out.push({ id: 'aim', chapter: CH.circuit, title: 'The aim: v = z − u', layout: 'map+side', view: cview, dur: 4.8,
    text: 'Now follow circuit 3. A superscript names the completed circuit: circuit 3 starts from b⁽²⁾, z⁽²⁾ and u⁽²⁾, then produces the states with superscript (3). First form the ADMM aim v⁽²⁾ by subtracting the ledger u⁽²⁾, the scaled dual variable, from the Warden’s replica: v⁽²⁾ = z⁽²⁾ − u⁽²⁾ = ' + pair(v2) + '. The aim is a derived rope target, not a fourth state or another character.',
    math: 'v<sup>(2)</sup> = z<sup>(2)</sup> − u<sup>(2)</sup>' + at(0.5, ' = ' + pair(z2) + ' − ' + pair(u2)) + at(0.8, ' = ' + pair(v2)),
    draw: function (g, p) {
      kb(g); g.hero(b2, 'tw', 1, 'Wanderer b(2)'); P.warden(g, z2, 1, 'Warden z(2)');
      g.arrow(z2, v2, C.violet, 3, seg(p, 0.25, 0.58)); g.label(lerp2(z2, v2, 0.5), 'move by −u(2)', C.violet, { dx: -12, dy: 20, align: 'right', p: seg(p, 0.45, 0.68), size: 12 });
      g.dot(v2, 6, C.violet, seg(p, 0.55, 0.7)); g.label(v2, 'aim v(2)', C.violet, { dx: 12, dy: -6, p: seg(p, 0.68, 0.86), size: 12 });
      P.lines(g, g.sideR, [{ text: '1. Warden z(2)  ' + pair(z2), col: C.blue, mono: true }, { text: '2. ledger u(2)  ' + pair(u2), col: C.orange, mono: true },
                           { text: '3. move by −u(2) ' + pair(scale(u2, -1)), col: C.violet, mono: true }, { text: '4. aim v(2)     ' + pair(v2), col: C.gold, mono: true }], p, 'Build the aim for circuit 3');
    } });
  out.push({ id: 'rope-track', chapter: CH.circuit, title: 'The rope on each track', layout: 'side', dur: 5.2,
    text: 'The ADMM rope adds the quadratic penalty ρ/2·(bᵢ − v⁽²⁾ᵢ)², with stiffness ρ = ' + num(rho, 0) + '. For this toy, ρ − 2β is positive, so each scalar track has one unconstrained minimizer. The operation clip(q, 0, 1) means: keep q when it lies in the track, otherwise use the nearest notch. On circuit 3, v⁽²⁾ = ' + pair(v2) + '; the first unconstrained value lies below 0 and is clipped to 0, while the second becomes ' + num(b3[1]) + '.',
    math: 'bᵢ<sup>(3)</sup> = clip((ρvᵢ<sup>(2)</sup> − ℓᵢ − β)/(ρ − 2β), 0, 1)' + at(0.48, '<br>clip(q,0,1) = nearest value to q in [0,1]') + at(0.76, '<br>b<sup>(3)</sup> = ' + pair(b3)),
    draw: function (g, p) {
      tracks(g, p, function (g, R, l, q) {
        var both = function (t) { return leans[l] * t + ridge(t); }, rope = function (t) { return rho / 2 * (t - v2[l]) * (t - v2[l]); }, all = function (t) { return both(t) + rope(t); };
        var un = (rho * v2[l] - leans[l] - beta) / (rho - 2 * beta), bt = b3[l];
        P.track(g, R, { title: 'tile ' + (l + 1) + ': aim v(2)' + sb(l + 1) + ' = ' + num(v2[l]), curves: [{ fn: both, col: C.ink, w: 1.5, dash: [4, 4], label: 'lean + ridge', at: 0.8 }, { fn: rope, col: C.orange, p: seg(q, 0, 0.35), label: 'ADMM rope', at: 0.97 }, { fn: all, col: C.gold, w: 2.5, p: seg(q, 0.3, 0.7), label: 'sum', at: 0.93 }],
                         beyond: un < 0 || un > 1 ? { fn: all, col: C.red, p: seg(q, 0.6, 0.85) } : null,
                         marks: [{ t: bt, v: all(bt), col: C.gold, text: 'update: ' + num(bt) + (un < 0 || un > 1 ? ' (clipped)' : ''), p: seg(q, 0.65, 0.85), side: bt > 0.5 ? 'left' : 'right' }],
                         tile: { t: H.mix(b2[l], bt, seg(q, 0.7, 0.95)), p: 1 } });
      });
    } });
  var ropeK = function (b) { return land.f(b) + rho / 2 * ((b[0] - v2[0]) * (b[0] - v2[0]) + (b[1] - v2[1]) * (b[1] - v2[1])); };
  out.push({ id: 'wander', chapter: CH.circuit, title: 'The Wanderer takes the two tile updates', layout: 'map', view: cview, dur: 4.6,
    text: 'The two scalar updates now form the Wanderer’s new vector of bit variables b⁽³⁾ = ' + pair(b3) + '. The first tile is at notch 0 and the second remains between notches. On the shaded map, v⁽²⁾ is held fixed; the displayed objective is the tile cost plus the ADMM rope toward that aim. It is not a claim that the full joint receiver has reached a global minimum.',
    math: 'b<sup>(2)</sup> = ' + pair(b2) + at(0.45, ' → b<sup>(3)</sup> = ' + pair(b3)) + at(0.78, ';  aim held at v<sup>(2)</sup> = ' + pair(v2)),
    draw: function (g, p) {
      g.land(ropeK, { id: 'ropeK', rings: 10 }); P.axes(g, 'tile b₁ →', '↑ tile b₂'); P.square(g); P.lawLine(g); g.dot(v2, 6, C.violet, 1); g.label(v2, 'aim v(2)', C.violet, { dx: 10, dy: -12 });
      var q = seg(p, 0.25, 0.82); g.path([b2, b3], C.ink, 2, q, [4, 3]); g.hero(lerp2(b2, b3, q), 'tw', 1); if (q >= 1) g.label(b3, 'b(3) = ' + pair(b3), C.gold, { dx: 12, dy: -14 });
    } });
  out.push({ id: 'warden', chapter: CH.circuit, title: 'The Warden keeps the law', layout: 'map', view: cview, dur: 4.4,
    text: 'Now hold b⁽³⁾ and the ledger u⁽²⁾ from the start of the circuit fixed. The symbol Π<sub>P</sub> means Euclidean projection: choose the nearest point in the parity polytope P. When one parity check involves two bits, P is the blue line and projection replaces the two coordinates by their clipped mean. Thus the Warden projects b⁽³⁾ + u⁽²⁾ = ' + pair(bu) + ' to z⁽³⁾ = ' + pair(z3) + '. Longer checks use their full parity polytopes, not this mean rule.',
    math: 'z<sup>(3)</sup> = Π<sub>P</sub>(b<sup>(3)</sup> + u<sup>(2)</sup>)' + at(0.45, ' = Π<sub>P</sub>' + pair(bu)) + at(0.75, ' = ' + pair(z3)),
    draw: function (g, p) {
      kb(g); g.hero(b3, 'tw', 1, 'b(3)');
      g.arrow(b3, bu, C.orange, 2, seg(p, 0.1, 0.35)); g.dot(bu, 5, C.ink, seg(p, 0.3, 0.4)); g.label(bu, 'b(3) + u(2)', C.ink, { dx: 10, dy: -12, p: seg(p, 0.35, 0.5) });
      g.line(bu, z3, C.blue, 2, seg(p, 0.5, 0.75), [5, 4]); P.warden(g, z3, seg(p, 0.7, 0.85), 'Warden z(3) = ' + pair(z3));
    } });
  var gap3 = sub(b3, z3), lview = around([b3, z3, add(z3, u2), add(z3, u3)], 1.2, 0.6);
  out.push({ id: 'ledger', chapter: CH.circuit, title: 'The ledger remembers', layout: 'map', view: lview, dur: 4.6,
    text: 'Only after the new b⁽³⁾ and z⁽³⁾ exist does the ledger u, the scaled dual variable, add their signed gap: u⁽³⁾ = u⁽²⁾ + (b⁽³⁾ − z⁽³⁾) = ' + pair(u2) + ' + ' + pair(gap3) + ' = ' + pair(u3) + '. Its signs retain the direction of repeated disagreement, which changes the next aim.',
    math: 'u<sup>(3)</sup> = u<sup>(2)</sup> + (b<sup>(3)</sup> − z<sup>(3)</sup>)' + at(0.45, ' = ' + pair(u2) + ' + ' + pair(gap3)) + at(0.8, ' = ' + pair(u3)),
    draw: function (g, p) {
      kb(g); P.warden(g, z3, 1, 'z(3)'); g.hero(b3, 'tw', 1, 'b(3)');
      g.arrow(z3, b3, C.violet, 3, seg(p, 0.1, 0.4)); g.label(lerp2(z3, b3, 0.5), 'signed gap b(3) − z(3)', C.violet, { dx: 10, dy: -8, p: seg(p, 0.3, 0.5), size: 12 });
      g.arrow(z3, add(z3, u2), 'rgba(255,176,113,0.5)', 2.5, seg(p, 0.45, 0.6)); g.label(add(z3, u2), 'old ledger u(2)', 'rgba(255,176,113,0.8)', { dx: -10, dy: -14, align: 'right', p: seg(p, 0.55, 0.7), size: 12 });
      g.arrow(z3, add(z3, u3), C.orange, 3, seg(p, 0.65, 0.9)); g.tipLabel(add(z3, u3), u3, 'new ledger u(3) = ' + pair(u3), C.orange, seg(p, 0.85, 1));
    } });

  // ------------------------------------------------------------ 5. the Herald rides
  var ride = [1.25, 0.08];
  out.push({ id: 'herald', chapter: CH.herald, title: 'The Herald rides', layout: 'map+side', view: VIEW, dur: 6,
    text: 'After every complete circuit the Herald thresholds the Wanderer’s b and tests the resulting candidate word. On circuit ' + hd + ', b⁽³⁾ = ' + pair(b3) + ' becomes ' + word(kw[hd].word) + ': the parity check passes, and the Seal, which is a truth oracle in this toy, accepts it. A real CAJODE candidate must instead pass every parity check, have the required value at every bit fixed by the receiver configuration, and pass its CRC. The Herald can ride before continuous ADMM consensus: here b⁽³⁾ and z⁽³⁾ remain ' + num(kw[hd].gap) + ' apart.',
    math: 'threshold b<sup>(3)</sup> → ' + word(kw[hd].word) + ': parity ✓, toy Seal ✓' + at(0.72, '<br>continuous gap |b<sup>(3)</sup> − z<sup>(3)</sup>| = ' + num(kw[hd].gap)),
    draw: function (g, p) {
      kb(g); star(g, land.treasure, 1); var up = seg(p, 0, 0.55) * hd, n = Math.floor(up);
      var zq = walkTo(g, kw, up, '#9ec5f3', 2, 'z'), xq = walkTo(g, kw, up, '#e6e9ee', 2.5, 'x');
      for (var k = 0; k <= Math.min(n, hd); k++) g.label(kw[k].x, 'circuit ' + k + ': ' + word(kw[k].word), kw[k].lawful ? C.blue : C.orange, { dx: k === 0 ? 14 : 12, dy: k === 0 ? -20 : k === hd ? 26 : 16, size: 11.5 });
      g.hero(xq, 'tw', 1); P.warden(g, zq, 1);
      var q = seg(p, 0.6, 1); if (q > 0) { P.verdict(g, b3, true, seg(q, 0, 0.3)); var hq = lerp2(b3, ride, seg(q, 0.3, 1)); P.herald(g, hq, 1, seg(q, 0.3, 1) < 0.9 ? 'rides with ' + word(kw[hd].word) : ''); }
      P.lines(g, g.sideR, kw.slice(0, hd + 1).map(function (r, k) { return { text: 'circuit ' + k + ': ' + word(r.word) + '   law ' + tick(r.lawful) + '   Seal ' + tick(r.sealed) + '   gap ' + num(r.gap, 2), col: r.sealed ? JADE : r.lawful ? C.blue : C.ink, mono: true }; }), seg(p, 0, 0.7), 'The Herald’s book');
    } });
  var late = kw.length - 1;
  out.push({ id: 'late', chapter: CH.herald, title: 'If the Herald were late', layout: 'map+side', view: VIEW, dur: 5.6,
    text: 'The toy Seal accepted the candidate word before the relaxed copies agreed. Had the Herald been late, the channel would have remained fixed and the toy would have continued: on circuit ' + (hd + 1) + ', b and z meet at 00, the gap is 0, and after that this toy no longer moves. The ledger remains at ' + pair(kw[late].u) + ': a nonzero scaled dual variable can remain at agreement because it records the force needed to balance the tile cost.',
    math: 'gap per circuit: ' + kw.map(function (r, k) { return at(0.12 * k, num(r.gap, 2) + (k < late ? ', ' : '')); }).join(''),
    draw: function (g, p) {
      kb(g); star(g, land.treasure, 1); var up = seg(p, 0, 0.8) * late;
      var zq = walkTo(g, kw, up, '#9ec5f3', 2, 'z'), xq = walkTo(g, kw, up, '#e6e9ee', 2.5, 'x'); g.hero(xq, 'tw', 1); P.warden(g, zq, 1);
      if (up >= hd + 1) g.label(land.treasure, 'met at the true order', JADE, { dx: 14, dy: -20, size: 12 });
      var R = g.sideR, pl = g.plot(R, [-0.5, late + 0.5], [0, 0.8], { title: 'the gap between the twins, circuit by circuit' }); pl.frame('circuit', 'gap |b − z|');
      kw.forEach(function (r, k) { var q = clamp(up - k + 1, 0, 1); if (q > 0) { pl.seg(k, 0, k, r.gap * q, k === hd ? JADE : C.violet, 10, 1); if (k === hd && q >= 1) pl.point(k, r.gap, JADE, 'the Herald rides', 1, 'right'); } });
    } });
  // ------------------------------------------------------------ 6. the Veil
  var c00 = veil.c0, bStart = veil.start, vLeans = veil.leans, y = veil.y;
  out.push({ id: 'veil-overview', chapter: CH.veil, title: 'What changes when the Veil falls?', layout: 'side', dur: 5.6,
    text: 'With the Veil lifted, the lantern coefficients were fixed and only the bit variables moved. With the Veil down, the receiver alternates between the bits and a channel model inside the same objective and the same circuit. The next pages use a deliberately small, real-valued teaching toy with four windows and one symbol, built from CAJODE’s documented equations; they are not an execution of the full receiver. Full CAJODE uses a complex channel C across many carriers and OFDM symbols. It starts from the pilot-based estimate C⁰, writes C = C⁰ + Δ, and applies regularization to Δ.',
    math: 'this toy: b and c = (c₀,c₁)' + at(0.48, '<br>full CAJODE: b and C = C⁰ + Δ across carriers and OFDM symbols') + at(0.8, '<br>Δ = C − C⁰ is the change from the pilot-based estimate'),
    draw: function (g, p) {
      var RR = split(g.sideR, 0.58); P.hall(g, RR[0], { land: veil, b: bStart, p: seg(p, 0, 0.55), title: 'The four-window teaching toy' });
      P.lines(g, RR[1], [{ text: 'toy: two real coefficients c₀ and c₁', col: JADE, mono: true }, { text: 'full: complex channel C over many bins', col: C.ink, mono: true },
                          { text: 'pilot-based estimate C⁰; change Δ = C − C⁰', col: C.gold, mono: true }], seg(p, 0.45, 1), 'Keep the model boundary visible');
    } });
  out.push({ id: 'veil', chapter: CH.veil, title: 'The Veil falls', layout: 'side', dur: 5.6,
    text: 'A tile b produces the bipolar light s = 1 − 2b: tile 0 gives s = +1 and tile 1 gives s = −1. We use s so that b continues to denote the bit variables throughout the tale. The Beacons at the two ends hold known pilot tiles. For its initial estimate only, the toy assumes c₁ = 0, so light does not spill between windows, and averages the Beacon readings ' + num(y[0], 2) + ' and ' + num(y[3], 2) + ' to obtain c₀ = ' + num(c00[0], 2) + '. This estimate follows the assumption c₁ = 0; it is not direct knowledge of the true Veil.',
    math: 'bipolar light s = 1 − 2b' + at(0.36, ';  initial model y ≈ c₀s + noise, c₁ = 0') + at(0.68, '<br>c₀<sup>init</sup> = (' + num(y[0], 2) + ' + ' + num(y[3], 2) + ')/2 = ' + num(c00[0], 2)),
    draw: function (g, p) { var RR = split(g.sideR, 0.52); P.hall(g, RR[0], { land: veil, b: bStart, p: seg(p, 0, 0.6), title: 'The hall: two Beacons, two sentries' }); P.lanternPlot(g, RR[1], { land: veil, c: c00, b: bStart, p: seg(p, 0.3, 1), title: 'readings against tiles' }); } });
  out.push({ id: 'spill', chapter: CH.veil, title: 'The spill', layout: 'side', dur: 5,
    text: 'A little light from each neighbouring window spills into the current reading; the toy calls that coefficient c₁. Thus a window predicts c₀ times its own bipolar light plus c₁ times the neighbouring lights. At the initial estimate with c₁ = 0, the coefficient ℓ multiplying b in the toy objective is 4c₀y/ν. It starts at ℓ = ' + pair(vLeans, 1) + ', so the second tile still leans the wrong way. Its scale follows the stated variance convention, so it is not labelled as an LLR.',
    math: 'prediction ŷ_k = c₀s_k + c₁(s_{k−1} + s_{k+1})' + at(0.5, '<br>initial c₁ = 0:  ℓ = 4c₀y/ν = ' + pair(vLeans, 1)),
    draw: function (g, p) { P.hall(g, g.sideR, { land: veil, b: bStart, p: 1, spill: seg(p, 0.1, 0.5), leans: seg(p, 0.6, 1) > 0 ? vLeans : null, title: 'The spill between neighbouring windows' }); } });
  out.push({ id: 'scales', chapter: CH.veil, title: 'The Scales', layout: 'side', dur: 6,
    text: 'The Scales compute one weight for each reading. First, E is the squared prediction error plus the variance contributed by bit variables in [0,1], divided by the noise variance ν. Then w = 1/√(1 + E/δ²), with δ = ' + num(veil.delta, 3) + ', reduces the influence of a badly fitted reading without discarding it. The weights are recomputed after the bits move; on circuit 3 the second sentry changes from ' + num(vr.w1[2], 2) + ' to ' + num(vr.w2[2], 2) + '.',
    math: 'E = [(prediction − reading)² + variance from bit variables]/ν' + at(0.42, ';  w = 1/√(1 + E/δ²)') + at(0.72, '<br>sentry 2 on circuit 3: ' + num(vr.w1[2], 2) + ' → ' + num(vr.w2[2], 2)),
    draw: function (g, p) {
      var after = p > 0.62, w = after ? vr.w2 : vr.w1, En = after ? vr.E2 : vr.E1, b = after ? vr.b : vr.from, RR = split(g.sideR, 0.5);
      P.hall(g, RR[0], { land: veil, b: b, w: w, p: 1, title: after ? 'before the Loom: the tiles have moved' : 'before the tiles move' });
      P.lines(g, RR[1], En.map(function (e, k) { return { text: (k === 0 || k === 3 ? 'Beacon  ' : 'sentry ' + k + ' ') + ' E = ' + num(e.E, 3) + '   w = ' + num(w[k], 2), col: w[k] < 0.9 ? C.orange : C.ink, mono: true }; }), after ? 1 : seg(p, 0.1, 0.6), 'The Scales: residual energy and weights');
    } });
  var vb0 = vr.from, vb1 = vr.b, vz = vr.zFrom, vu = vr.uFrom, vv = vr.v, cF = vr.cFrom, cN = vr.c, bview = around([vb0, vb1, vv], 1.0, 0.9);
  var ropeV = function (b) { return veil.J(cF, b) + veil.rope(b, vz, vu, rho); };
  out.push({ id: 'bowl', chapter: CH.veil, title: 'The Bowl: one cautious stride', layout: 'map+side', view: bview, dur: 6,
    text: 'With spill, one bit affects more than one reading, so the bit coordinates are coupled. CAJODE therefore updates all bits together by minimizing one surrogate function; it does not update each bit while pretending the other bit is fixed. Let b<sup>prev</sup> be the vector before the update, and let g contain the partial derivatives evaluated there with the weights held fixed. The values hᵢ are chosen from the terms that couple the bits, so the surrogate function touches that part of the objective at b<sup>prev</sup> and stays above it elsewhere. Minimizing the surrogate updates every bit at once; it does not minimize the full receiver objective, which is nonconvex. On circuit 3 the second tile moves from ' + num(vb0[1], 1) + ' to ' + num(vb1[1]) + '; if h₂ were omitted, minimizing the remaining expression for that tile would choose ' + num(vr.ground[1]) + '.',
    math: 'up to a constant:  Bowl = gᵀ(b − b<sup>prev</sup>) + 1/2·Σhᵢ(bᵢ − bᵢ<sup>prev</sup>)² + ridge + rope' + at(0.58, '<br>tile 2: h₂ = ' + num(vr.h[1], 2) + ';  Bowl stride ' + num(vb1[1]) + ';  without h₂ ' + num(vr.ground[1])),
    draw: function (g, p) {
      g.land(ropeV, { id: 'ropeV3', rings: 10 }); P.axes(g, 'tile b₁ →', '↑ tile b₂'); P.square(g); P.lawLine(g); g.dot(vv, 6, C.violet, 1); g.label(vv, 'aim v', C.violet, { dx: 10, dy: -12 });
      var q = seg(p, 0.55, 0.85); g.path([vb0, vb1], C.ink, 2, q, [4, 3]); g.hero(lerp2(vb0, vb1, q), 'tw', 1, q >= 1 ? 'one stride' : '');
      tracks(g, p, function (g, R, l, qq) {
        var b0 = vb0[l], gl = vr.g[l], hl = vr.h[l], vl = vv[l];
        var ground = function (t) { return gl * (t - b0) + ridge(t) - ridge(b0) + rho / 2 * ((t - vl) * (t - vl) - (b0 - vl) * (b0 - vl)); }, bowl = function (t) { return ground(t) + hl / 2 * (t - b0) * (t - b0); };
        var same = Math.abs(vr.ground[l] - vb1[l]) < 0.02;
        P.track(g, R, { title: 'tile ' + (l + 1) + ': compare h = 0 with h = ' + num(hl, 2), curves: [{ fn: ground, col: C.gold, w: 2, p: seg(qq, 0, 0.3), label: 'without h', at: b0 > 0.5 ? 0.62 : 0.4 }, { fn: bowl, col: JADE, w: 2.5, p: seg(qq, 0.25, 0.55), label: 'Bowl with h', at: b0 > 0.5 ? 0.18 : 0.82 }],
                         marks: [{ t: vr.ground[l], v: ground(vr.ground[l]), col: C.red, text: same ? 'same minimum: ' + num(vb1[l]) : 'without h: ' + num(vr.ground[l]), p: seg(qq, 0.4, 0.6), side: vr.ground[l] > 0.5 ? 'left' : 'right' },
                                 { t: vb1[l], v: bowl(vb1[l]), col: JADE, text: same ? '' : 'Bowl minimum: ' + num(vb1[l]), p: seg(qq, 0.5, 0.7), side: vb1[l] > 0.5 ? 'left' : 'right' }],
                         tile: { t: H.mix(b0, vb1[l], seg(qq, 0.55, 0.85)), p: 1 } });
      });
    } });
  var lm = vr.loom, loomRel = lm.plumb / Math.max(len(lm.r), 1e-30), loomView = around([cF, cN], 3, 0.3), loomFn = function (cq) { return veil.veilCost(vr.w2, vb1, cq); }, loomShade = P.shadeOf(loomFn, loomView, 'loom3', 12);
  out.push({ id: 'loom', chapter: CH.veil, title: 'The Loom', layout: 'map+side', view: loomView, dur: 5.6,
    text: 'With bits and weights fixed, this toy’s objective is quadratic in c = (c₀,c₁). Its balance equations are M·c = r: the matrix M in the normal equations has two rows and two columns, and r is the right-hand side. Solving them gives the value of c that minimizes this quadratic, moving from ' + pair(cF) + ' to ' + pair(cN) + ' in one pass; this does not establish a global minimum of the alternating nonconvex problem. The plumb line shown here is the absolute residual |M·c − r| = ' + lm.plumb.toExponential(1) + '. The corresponding relative residual is ' + loomRel.toExponential(1) + '; it divides by |r| and is a different quantity. Full CAJODE instead solves a much larger sparse system for C = C⁰ + Δ with regularization on Δ.',
    math: 'solve for c: M·c = r,  c = (c₀,c₁)' + at(0.42, '<br>absolute residual |M·c − r| = ' + lm.plumb.toExponential(1) + ';  relative = ' + loomRel.toExponential(1)) + at(0.76, '<br>height under the rope: ' + num(vr.L1, 3) + ' → ' + num(vr.L2, 3)),
    draw: function (g, p) {
      g.land(loomFn, loomShade); P.axes(g, 'thickness c₀ →', '↑ spill c₁');
      g.dot(cF, 6, C.ink, 1); g.label(cF, 'before: ' + pair(cF), C.ink, { dx: 10, dy: -14, size: 12 });
      var q = seg(p, 0.3, 0.7); g.arrow(cF, cN, JADE, 3, q); if (q >= 1) { g.dot(cN, 6, JADE, 1); g.label(cN, 'after: ' + pair(cN), JADE, { dx: -10, dy: 18, align: 'right', size: 12 }); }
      var R = g.sideR; g.panel(R, 'The balance equations and the plumb line'); var y0 = R[1] + 44;
      var wM = g.matrix(R[0] + 14, y0, [[num(lm.M[0][0], 2), num(lm.M[0][1], 2)], [num(lm.M[1][0], 2), num(lm.M[1][1], 2)]], function () { return seg(p, 0.1, 0.3); }, { size: 13 });
      g.labelPx(R[0] + 22 + wM, y0 + 24, '· c =', C.ink, { plain: true, p: seg(p, 0.2, 0.35) });
      g.matrix(R[0] + 70 + wM, y0, [[num(lm.r[0], 2)], [num(lm.r[1], 2)]], function () { return seg(p, 0.35, 0.55); }, { size: 13, col: C.violet });
      P.lines(g, [R[0], y0 + 70, R[2], R[3] - 80], [{ text: 'solution c = ' + pair(cN), col: JADE, mono: true }, { text: 'absolute ' + lm.plumb.toExponential(1) + '; relative ' + loomRel.toExponential(1), col: C.gold, mono: true }, { text: 'height: ' + num(vr.L1, 3) + ' → ' + num(vr.L2, 3) + '  ✓ not raised', col: C.ink, mono: true }], seg(p, 0.6, 1));
    } });
  var vbu = add(vb1, vu), vzn = vr.z, vun = vr.u, circView = around([vb0, vb1, vz, vzn, [1, 1], [0, 0]], 0.5, 1.1);
  out.push({ id: 'circuit', chapter: CH.veil, title: 'One circuit: an aim, then six updates', layout: 'map+side', view: circView, dur: 7,
    text: 'At the start, form the derived aim v = z − u; this calculation does not update a stored state. Then the six updates run in order: compute the weights, minimize the surrogate function to update b, recompute the weights, solve the normal equations for c, apply the parity-polytope projection, and update the scaled dual variable. Only after all six does the Herald threshold b and test the candidate word. Circuit 3 below follows that order.',
    math: 'form v = z − u → weights → bits → weights → channel → projection → scaled dual → hard decision',
    draw: function (g, p) {
      P.keepBase(g, function (b) { return veil.J(cF, b); }, veilShade(cF, 'veil3')); g.dot(vv, 5, C.violet, 1);
      var q = seg(p, 0.15, 0.35); g.path([vb0, vb1], C.ink, 2, q, [4, 3]); g.hero(lerp2(vb0, vb1, q), 'tw', 1);
      P.warden(g, vz, 1, 'z(2)'); if (seg(p, 0.5, 0.7) > 0) { g.arrow(vb1, vbu, C.orange, 2, seg(p, 0.5, 0.6)); g.line(vbu, vzn, C.blue, 2, seg(p, 0.58, 0.7), [5, 4]); P.warden(g, vzn, seg(p, 0.62, 0.72), 'z(3)'); }
      if (seg(p, 0.72, 0.9) > 0) {   // the ledger is long: draw it as far as the map shows, and say so
        var vis = g.vis, tEnd = 1; [0, 1].forEach(function (i) { var lo = vis[2 * i] + 0.08, hi = vis[2 * i + 1] - 0.08, d = vun[i]; if (d > 1e-9) tEnd = Math.min(tEnd, (hi - vzn[i]) / d); else if (d < -1e-9) tEnd = Math.min(tEnd, (lo - vzn[i]) / d); });
        var uEnd = add(vzn, scale(vun, Math.max(0.05, tEnd))); g.arrow(vzn, uEnd, C.orange, 3, seg(p, 0.72, 0.9)); g.label(uEnd, 'ledger u(3) = ' + pair(vun, 2) + (tEnd < 1 ? ', off the map' : ''), C.orange, { dx: 12, dy: 18, p: seg(p, 0.85, 1), size: 12 });
      }
      P.lines(g, g.sideR, [
        { text: '0  aim          v = ' + pair(vv, 2), col: C.violet, mono: true },
        { text: '1  Scales       w = (' + vr.w1.map(function (v) { return num(v, 2); }).join(', ') + ')', col: C.ink, mono: true },
        { text: '2  tiles        b: ' + pair(vb0, 2) + ' → ' + pair(vb1, 2), col: JADE, mono: true },
        { text: '3  Scales       w = (' + vr.w2.map(function (v) { return num(v, 2); }).join(', ') + ')', col: C.ink, mono: true },
        { text: '4  Loom         c: ' + pair(cF, 2) + ' → ' + pair(cN, 2), col: C.gold, mono: true },
        { text: '5  Warden       z = ' + pair(vzn, 2), col: C.blue, mono: true },
        { text: '6  ledger       u = ' + pair(vun, 2), col: C.orange, mono: true },
        { text: '   Herald       word ' + word(vr.word) + '   law ' + tick(vr.lawful), col: vr.lawful ? JADE : C.red, mono: true }], p, 'Circuit 3, move by move');
    } });
  out.push({ id: 'candle', chapter: CH.veil, title: 'The Candle and the certificates', layout: 'side', dur: 6,
    text: 'The Candle is the update budget: at most ' + vw.candle + ' complete circuits. If no candidate passes the parity checks and Seal before it gutters, the receiver returns its latest candidate with a failure note. The update of b and the solution for c also carry narrow certificates at the current Warden and ledger: neither may raise the height under the fixed ADMM rope, and the channel equations must meet their residual test. These checks certify those two steps only; they do not prove global convergence of the full nonconvex problem.',
    math: 'budget: ' + vw.candle + ' circuits' + at(0.45, '<br>update b: height must not rise;  solve for c: height must not rise') + at(0.78, '<br>normal equations: residual test must pass'),
    draw: function (g, p) { P.candle(g, g.sideR, { p: p, burnt: seg(p, 0.05, 0.85), marks: vw.candle, note: 'budget ended or a certificate failed', title: 'The Candle' }); } });
  out.push({ id: 'veil-walk', chapter: CH.veil, title: 'Circuit after circuit', layout: 'map+side', view: VIEW, dur: 7,
    text: 'The three milestones are different. The toy Seal first accepts candidate word ' + word(vw[vhd].word) + ' on circuit ' + vhd + ', while the relaxed copies are still ' + num(vw[vhd].gap) + ' apart. If we ignore that stop and continue only to study the dynamics, ' + (postSealChanges.length ? 'the decision after thresholding moves away from the accepted word on circuits ' + circuitSpan(postSealChanges) + ' before returning; ' : '') + 'b and z first reach consensus on circuit ' + vMeet + '. The complete toy state, including its Veil coefficients, meets the simulator’s rest test on circuit ' + vRest + ', at c = ' + pair(vEnd.c, 2) + '. Those endpoint coefficients are what this toy reached; they are not claimed to be the true channel or a global optimum.',
    math: 'candidate accepted: circuit ' + vhd + at(0.38, ';  first b = z: circuit ' + vMeet) + at(0.62, ';  all toy state rests: circuit ' + vRest) + at(0.82, '<br>endpoint c = ' + pair(vEnd.c, 2)),
    draw: function (g, p) {
      P.keepBase(g, function (b) { return veil.J(vEnd.c, b); }, veilShade(vEnd.c, 'veilEnd')); star(g, land.treasure, 1);
      var up = seg(p, 0, 0.85) * vRest, zq = walkTo(g, vw, up, '#9ec5f3', 2, 'z'), xq = walkTo(g, vw, up, '#e6e9ee', 2.5, 'x'); g.hero(xq, 'tw', 1); P.warden(g, zq, 1);
      if (up >= vhd) { P.verdict(g, vw[vhd].x, true, 1); var hq = lerp2(vw[vhd].x, ride, clamp((up - vhd) / 2, 0, 1)); P.herald(g, hq, 1, up - vhd < 1.5 ? 'rides with ' + word(vw[vhd].word) : ''); }
      var R = g.sideR, phone = g.W < 520, lo = Infinity, hi = -Infinity; vw.forEach(function (r) { lo = Math.min(lo, r.c[0], r.c[1], r.gap); hi = Math.max(hi, r.c[0], r.c[1], r.gap); });
      var plotR = R;
      if (phone) {
        // Keep the three curve names and the terminal milestone out of the same upper-right corner on a phone.
        // The legend gets its own two rows; the graph below retains the actual coloured curves and milestone dots.
        g.panel(R, 'the toy channel and consensus gap');
        plotR = [R[0] + 2, R[1] + 58, R[2] - 4, R[3] - 60];
        g.labelPx(R[0] + 14, R[1] + 33, 'thickness c₀', JADE, { size: 10.5, plain: true });
        g.labelPx(R[0] + R[2] * 0.52, R[1] + 33, 'spill c₁', C.violet, { size: 10.5, plain: true });
        g.labelPx(R[0] + 14, R[1] + 49, 'gap |b − z|', C.orange, { size: 10.5, plain: true });
        g.labelPx(R[0] + R[2] * 0.52, R[1] + 49, '● full toy rests', C.gold, { size: 10.5, plain: true });
      }
      var pl = g.plot(plotR, [0, vRest], [lo - 0.1, hi + 0.15], phone ? {} : { title: 'the toy channel and consensus gap' }); pl.frame('circuit', '');
      [['c', 0, JADE, 'thickness c₀'], ['c', 1, C.violet, 'spill c₁'], ['gap', null, C.orange, 'gap |b − z|']].forEach(function (s, i) {
        var val = function (k) { var r = vw[Math.min(k, vRest)]; return s[1] == null ? r[s[0]] : r[s[0]][s[1]]; };
        pl.curve(function (t) { var k = Math.floor(t), u = t - k; return val(k) * (1 - u) + val(k + 1) * u; }, s[2], 2, clamp(up / vRest, 0, 1));
        if (!phone) g.labelPx(pl.X(vRest) - 4, pl.box[1] + 14 + 16 * i, s[3], s[2], { align: 'right', size: 11.5, plain: true });
      });
      if (up >= vhd) pl.point(vhd, vw[vhd].gap, C.orange, 'the Herald rides', 1, 'right');
      if (up >= vMeet) pl.point(vMeet, vw[vMeet].gap, JADE, 'first b = z', 1, 'right');
      if (up >= vRest) pl.point(vRest, vEnd.c[0], C.gold, phone ? '' : 'full toy rests', 1, 'left');
    } });

  // ------------------------------------------------------------ 7. two towers, one sentry
  var r1 = rw[1], r2 = rw[2], rl = Rb.land, mid = 1, advice = r2.advice[mid];
  out.push({ id: 'two-towers', chapter: CH.towers, title: 'Two towers, one sentry', layout: 'side', dur: 6.4,
    text: 'In a larger code, neighbouring parity checks can share a bit. Every check keeps its own replica z and its own entry u in the scaled dual variable on that check–bit edge. If a bit has degree d, it receives d pieces of advice a = z − u. Their sum S = Σa enters the update formula, while the combined quadratic rope has stiffness dρ and geometric target S/d—the average advice, not the sum. Here the middle tile has d = 2. On circuit 2 its aggregate advice is S = ' + num(advice, 3) + ', its effective aim is S/2 = ' + num(advice / 2, 3) + ', and it moves from ' + num(r1.b[mid]) + ' to ' + num(r2.b[mid]) + '.',
    math: 'S₂ = Σ<sub>a∋2</sub>(z<sub>a,2</sub> − u<sub>a,2</sub>);  effective aim = S₂/d₂' + at(0.45, '<br>b₂ = clip((ρS₂ − ℓ₂ − β)/(d₂ρ − 2β), 0, 1)') + at(0.78, '<br>d₂ = 2;  S₂ = ' + num(advice, 3) + ';  b₂ = ' + num(r2.b[mid])),
    draw: function (g, p) { P.towers(g, g.sideR, { land: rl, day: r2, from: r1, p: p, title: 'A row of two towers, circuit 1 → 2' }); } });

  // ------------------------------------------------------------ 8. the Veil's weave
  out.push({ id: 'weave', chapter: CH.weave, title: 'The Veil’s weave', layout: 'side', dur: 5.6,
    text: 'Now return from the teaching toy to full CAJODE. Its channel is C = C⁰ + Δ, where C⁰ is the pilot-based estimate and Δ = C − C⁰ represents the change from that estimate. The values of Δ are regularized to vary smoothly between neighbouring carriers. Across adjacent OFDM symbols, Δ<sub>next</sub> is encouraged to resemble a·Δ<sub>prev</sub>; a is estimated from pilots and scales the preceding difference. One sparse linear system updates the represented OFDM symbols together. The toy’s two absolute coefficients c₀ and c₁ illustrated coupling, but did not implement the full array Δ.',
    math: 'Δ = C − C⁰;  neighbouring values of Δ vary smoothly' + at(0.52, '<br>Δ<sub>next</sub> ≈ a·Δ<sub>prev</sub>, where a is estimated from pilots') + at(0.82, '<br>full solve: all represented OFDM symbols together'),
    draw: function (g, p) { P.weave(g, g.sideR, { p: p, title: 'The weave of the great hall', windows: 9, nights: 4, beacons: [0, 4, 8] }); } });

  // ------------------------------------------------------------ 9. behind the tale
  var KEY = [
    ['the Coral Fort', 'CORAL’s cost: cards in [−1, 1], quartic flags, the law as a penalty hill'],
    ['the Jade Keep', 'CAJODE: Code-Aided Joint OFDM Demodulation and Error Correction'],
    ['the jade tile', 'a bit variable b in the continuous relaxation [0, 1]; its notches are the decided values'],
    ['the lean ℓ', 'the coefficient multiplying b in the toy objective; its scale follows the stated variance convention'],
    ['the ridge', 'the penalty β·b(1 − b) that pushes bits to 0 or 1 (β = 0.8)'],
    ['the rope, the aim', 'the ADMM penalty ρ/2·|b − z + u|² with ρ = 3; the aim is z − u'],
    ['the Wardens', 'one replica per parity check, projected exactly onto its parity polytope'],
    ['the ledgers', 'the scaled dual variables, one per (check, bit) edge'],
    ['the Veil', 'toy: c = (thickness, spill); full receiver: C = C⁰ + Δ'],
    ['the Beacons', 'the pilots; their estimate C⁰ anchors the full channel C = C⁰ + Δ'],
    ['the Scales', 'one weight per reading: w = 1/√(1 + E/δ²), δ = 0.926'],
    ['the Bowl', 'a surrogate function that updates every bᵢ together, then clips each value to [0, 1]'],
    ['the Loom, the plumb line', 'solve normal equations for c with bits and weights fixed; then check the stated residual'],
    ['the Herald, the Seal', 'threshold b; then parity checks, values fixed by the receiver configuration, and CRC (truth oracle only in this toy)'],
    ['the Candle, the note', 'the budget of 200 updates; the failure report of a certificate']];
  out.push({ id: 'key-foundations', chapter: CH.key, title: 'The key: foundations', layout: 'side', dur: 6,
    text: 'These five mappings recap the Coral Fort’s CORAL model, the Jade Keep’s CAJODE model, and the ingredients of one relaxed tile. Each item was introduced earlier; the key only gathers them.',
    math: 'CORAL → CAJODE;  bit variable b ∈ [0,1];  lean ℓ;  ridge βb(1 − b)',
    draw: function (g, p) { P.keyTable(g, g.sideR, KEY.slice(0, 5), p, 'The key: foundations'); } });
  out.push({ id: 'key-veil', chapter: CH.key, title: 'The key: ADMM and the Veil', layout: 'side', dur: 6,
    text: 'These five mappings recap the ADMM rope, the replica variables and scaled dual variables associated with the parity checks, and the pilot-based estimate that anchors the Veil.',
    math: 'aim z − u → update b → parity projection → scaled dual variable;  C = C⁰ + Δ',
    draw: function (g, p) { P.keyTable(g, g.sideR, KEY.slice(5, 10), p, 'The key: ADMM and the Veil'); } });
  out.push({ id: 'key-evidence', chapter: CH.key, title: 'The key: updates and evidence', layout: 'side', dur: 7,
    text: 'These last five mappings recap one Veil circuit and its stop conditions. A real candidate must pass every parity check, have the required value at every bit fixed by the receiver configuration, and pass its CRC. Evidence stays narrow: with the Veil lifted, selected values from the two-bit Keep and three-bit row match one frozen Julia decode_llr trace. With the Veil down, the four-window hall is a teaching toy built from CAJODE’s documented equations, not a trace or validation of the complete CAJODE or CORAL receiver.',
    math: 'weights → update b → solve for c → projection → acceptance or failure note',
    draw: function (g, p) { P.keyTable(g, g.sideR, KEY.slice(10, 15), p, 'The key: updates and evidence'); } });
  out.push({ id: 'end', chapter: CH.key, title: 'The end of the tale', layout: 'map', view: VIEW, dur: 5,
    text: 'That is the tale of the Jade Keep: the Twins alone, a Veil to learn, a Bowl for cautious strides, a Loom for the weave, Wardens for every tower, and a Herald who rides when the candidate passes the Seal. Use Back, or the contents, to visit any step again.',
    math: '',
    draw: function (g, p) {
      kb(g); star(g, land.treasure, 1); var up = seg(p, 0, 0.9) * late;
      var zq = walkTo(g, kw, up, '#9ec5f3', 2, 'z'), xq = walkTo(g, kw, up, '#e6e9ee', 2.5, 'x'); g.hero(xq, 'tw', 1); P.warden(g, zq, 1);
      if (up >= late) { g.arrow(land.treasure, add(land.treasure, kw[late].u), C.orange, 2.5, 1); g.label(land.treasure, 'the Twins, met at the true order', JADE, { dx: 16, dy: -22, size: 12 }); }
    } });

  // ------------------------------------------------------------ the page: the player, the chapter bar
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
  window.course = { steps: out, chapters: chapters, walks: { keep: kw, veil: vw, row: rw } };
  // #step=ID&p=0.5 opens a step at a moment of its animation, with time stopped (for screenshots and checks)
  var hash = (window.location && window.location.hash) || '', ms = /step=([^&]+)/.exec(hash), mp = /p=([0-9.]+)/.exec(hash);
  if (ms) { var st = decodeURIComponent(ms[1]); B.debug({ step: /^\d+$/.test(st) ? +st : st, p: mp ? +mp[1] : 1 }); }
})();
