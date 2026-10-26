// OFDM-first SAPPHIRE tutorial.  The numerical examples and walks come from keep.js; the drawings come from
// advanced_parts.js and the small receiver diagrams below.  The old Jade Keep language survives only as a
// secondary memory aid: the receiver variables and operations are always named first.
(function () {
  'use strict';
  var E = window.Engine, B = window.Board, K = window.Keep, P = window.KeepParts; if (!E || !B || !K || !P) return;
  var H = B.H, C = H.C, seg = H.seg, num = H.num, pair = H.pair, at = H.at, add = H.add, sub = H.sub,
      lerp2 = H.lerp2, clamp = H.clamp;
  var JADE = P.JADE, word = P.word;

  // ------------------------------------------------------------ frozen teaching examples
  var Kb = K.build('keep'), kw = Kb.walk, land = Kb.land, rho = Kb.p.rho, VIEW = K.VIEW;
  var Vb = K.build('veil'), vw = Vb.walk, veil = Vb.land;
  var Rb = K.build('row'), rw = Rb.walk;
  var keepShade = P.shadeOf(land.J, VIEW, 'keep-ofdm');
  var hd = kw.herald, rec = kw[3], b2 = rec.from, z2 = rec.zFrom, u2 = rec.uFrom, v2 = rec.v,
      b3 = rec.x, z3 = rec.z, u3 = rec.u;
  var vr = vw[3], vhd = vw.herald, vRest = vw.rest == null ? vw.length - 1 : vw.rest, vEnd = vw[vRest];
  var vb0 = vr.from, vb1 = vr.b, vz = vr.zFrom, vu = vr.uFrom, vv = vr.v, cF = vr.cFrom, cN = vr.c;
  function firstGapAtMost(walk, tol) { for (var i = 0; i < walk.length; i++) if (walk[i].gap <= tol) return i; return walk.length - 1; }
  var vMeet = firstGapAtMost(vw, 1e-12);
  function kb(g, o) { P.keepBase(g, land.J, keepShade, o); }
  function split(R, share, gap) {
    gap = gap || 8;
    if (R[2] >= R[3] * 1.25 && R[2] >= 600) { var w = Math.round((R[2] - gap) * share); return [[R[0], R[1], w, R[3]], [R[0] + w + gap, R[1], R[2] - w - gap, R[3]]]; }
    var h = Math.round((R[3] - gap) * share); return [[R[0], R[1], R[2], h], [R[0], R[1] + h + gap, R[2], R[3] - h - gap]];
  }
  function tick(ok) { return ok ? '✓' : '✗'; }
  function rrect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function box(g, x, y, w, h, title, detail, col, p) {
    if (!(p > 0)) return; var c = g.ctx; c.globalAlpha = clamp(p, 0, 1); c.fillStyle = 'rgba(255,255,255,0.045)';
    c.strokeStyle = col || C.faint; c.lineWidth = 1.5; c.beginPath(); rrect(c, x, y, w, h, 8); c.fill(); c.stroke(); c.globalAlpha = 1;
    g.labelPx(x + w / 2, y + h * 0.40, title, col || C.ink, { align: 'center', plain: true, size: 12.5, p: p });
    if (detail) g.labelPx(x + w / 2, y + h * 0.68, detail, C.dim, { align: 'center', plain: true, size: 10.5, p: p, mono: true });
  }
  function flow(g, R, items, p, title, feedback) {
    g.panel(R, title); var horizontal = R[2] >= 540, n = items.length, c = g.ctx, i, q;
    if (horizontal) {
      var gap = 22, w = Math.min(145, (R[2] - 30 - gap * (n - 1)) / n), h = Math.min(94, R[3] - 100), y = R[1] + (R[3] - h) / 2, x0 = R[0] + (R[2] - (n * w + (n - 1) * gap)) / 2;
      for (i = 0; i < n; i++) { q = seg(p, i / (n + 0.7), (i + 1) / (n + 0.7)); box(g, x0 + i * (w + gap), y, w, h, items[i][0], items[i][1], items[i][2], q); if (i && q > 0) g.arrowPx([x0 + (i - 1) * (w + gap) + w + 4, y + h / 2], [x0 + i * (w + gap) - 4, y + h / 2], C.dim, 1.8); }
      if (feedback && p > 0.65) { c.strokeStyle = C.violet; c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(x0 + (n - 0.5) * w + (n - 1) * gap, y + h + 9); c.lineTo(x0 + (n - 0.5) * w + (n - 1) * gap, y + h + 31); c.lineTo(x0 + w / 2, y + h + 31); c.lineTo(x0 + w / 2, y + h + 9); c.stroke(); c.setLineDash([]); g.labelPx(x0 + (n * w + (n - 1) * gap) / 2, y + h + 48, feedback, C.violet, { align: 'center', plain: true, size: 11.5, p: seg(p, 0.65, 1) }); }
    } else {
      var gh = 14, bh = Math.min(62, (R[3] - 54 - gh * (n - 1)) / n), bw = Math.min(R[2] - 32, 310), xx = R[0] + (R[2] - bw) / 2, yy = R[1] + 40;
      for (i = 0; i < n; i++) { q = seg(p, i / (n + 0.7), (i + 1) / (n + 0.7)); box(g, xx, yy + i * (bh + gh), bw, bh, items[i][0], items[i][1], items[i][2], q); if (i && q > 0) g.arrowPx([xx + bw / 2, yy + (i - 1) * (bh + gh) + bh + 2], [xx + bw / 2, yy + i * (bh + gh) - 2], C.dim, 1.6); }
      if (feedback) g.labelPx(R[0] + R[2] / 2, R[1] + R[3] - 16, '↺ ' + feedback, C.violet, { align: 'center', plain: true, size: 10.5, p: seg(p, 0.72, 1) });
    }
  }
  function qpskPicture(g, R, p) {
    g.panel(R, 'two bit variables determine one QPSK symbol'); var cx = R[0] + R[2] / 2, cy = R[1] + R[3] / 2, rad = Math.min(R[2], R[3]) * 0.28, c = g.ctx;
    c.strokeStyle = C.faint; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx - rad - 24, cy); c.lineTo(cx + rad + 24, cy); c.moveTo(cx, cy - rad - 24); c.lineTo(cx, cy + rad + 24); c.stroke();
    [[-1, -1, '11'], [-1, 1, '10'], [1, -1, '01'], [1, 1, '00']].forEach(function (a, i) { var q = seg(p, 0.1 * i, 0.35 + 0.1 * i), x = cx + a[0] * rad, y = cy - a[1] * rad; c.globalAlpha = q; c.fillStyle = JADE; c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; g.labelPx(x + (a[0] < 0 ? -10 : 10), y + (a[1] > 0 ? -14 : 14), a[2], C.ink, { align: a[0] < 0 ? 'right' : 'left', plain: true, mono: true, size: 11.5, p: q }); });
    g.labelPx(cx + rad + 26, cy + 16, 'I', C.dim, { plain: true, size: 11.5 }); g.labelPx(cx + 10, cy - rad - 24, 'Q', C.dim, { plain: true, size: 11.5 });
  }
  function walkTo(g, walk, upto, col, w, key) {
    key = key || 'x'; var n = Math.min(walk.length - 1, Math.floor(upto)), f = clamp(upto - n, 0, 1), pts = [];
    for (var k = 0; k <= n; k++) pts.push(walk[k][key]); var now = n < walk.length - 1 ? lerp2(walk[n][key], walk[n + 1][key], f) : walk[n][key]; pts.push(now); g.path(pts, col, w || 2.5, 1); return now;
  }

  var out = [], CH = {
    physical: 'Why the OFDM model breaks', observations: 'Keep the received evidence', joint: 'One receiver, two unknown blocks',
    admm: 'ADMM for the code constraints', coupled: 'Alternating channel and bits', scale: 'From toy receiver to SAPPHIRE'
  };

  // ------------------------------------------------------------ 1. Why the OFDM model breaks
  out.push({ id: 'received-grid', chapter: CH.physical, title: 'Start with the received OFDM frame', layout: 'side', dur: 5.4,
    text: 'The receiver starts with received samples from an OFDM frame. After synchronization, cyclic-prefix removal, and the chosen FFT measurements, it knows where the pilot symbols were placed but not the coded data bits. SAPPHIRE explains those observations with both an estimated frequency-domain response, including carrier coupling, and a code-consistent bit word. This tutorial teaches that SAPPHIRE problem, not the separate JADE block-feedback schedule. The full name is introduced after all of its technical terms have been explained.',
    math: 'observed: y;  known: pilot symbols and receiver configuration;  unknown: response C and coded bits b',
    draw: function (g, p) { P.resourceGrid(g, g.sideR, { p: p, title: 'received OFDM resource grid', carriers: 8, symbols: 4 }); } });
  out.push({ id: 'one-tap', chapter: CH.physical, title: 'When one-tap equalization is valid', layout: 'side', dur: 5.2,
    text: 'The familiar scalar model needs two physical conditions: the cyclic prefix must cover the effective channel memory, and the channel must be nearly invariant over the useful OFDM interval after carrier-offset correction. Then the frequency-domain matrix is approximately diagonal, so each received carrier is explained mainly by the transmitted symbol on that same carrier.',
    math: 'adequate CP + near time invariance ⇒ Y<sub>q</sub> ≈ H<sub>q</sub>X<sub>q</sub> + ν<sub>q</sub>',
    draw: function (g, p) { var R = split(g.sideR, 0.50); P.cyclicPrefixTimeline(g, R[0], { p: p, title: 'condition 1: the CP covers channel memory', adequate: true }); P.iciCouplingMatrix(g, R[1], { p: seg(p, 0.25, 1), title: 'condition 2: an approximately diagonal response', oneTap: true, size: 7 }); } });
  out.push({ id: 'ici', chapter: CH.physical, title: 'Residual Doppler creates intercarrier interference (ICI)', layout: 'side', dur: 5.4,
    text: 'Residual Doppler breaks carrier orthogonality and creates intercarrier interference (ICI). A received carrier is then a sum of contributions from several transmitted carriers, not one scalar symbol times one scalar gain. The diagram is a generic physical ICI illustration with two neighbours on either side; SAPPHIRE’s documented prediction later keeps half-width one. Any band is a modelling approximation justified by decaying coupling, not a claim that all farther coefficients are exactly zero.',
    math: 'Y<sub>q</sub> ≈ Σ<sub>r near q</sub> C<sub>q,r</sub>X<sub>r</sub> + ν<sub>q</sub>  (same OFDM symbol)',
    draw: function (g, p) { var R = split(g.sideR, 0.44); P.carrierMixing(g, R[0], { p: p, title: 'one transmitted carrier spreads to neighbours', carriers: 7 }); P.iciCouplingMatrix(g, R[1], { p: seg(p, 0.22, 1), title: 'generic physical ICI illustration: two neighbours per side', band: 2, size: 7, focusRow: 3 }); } });
  out.push({ id: 'isi-boundary', chapter: CH.physical, title: 'A short cyclic prefix is a different coupling', layout: 'side', dur: 5.6,
    text: 'If the cyclic prefix is too short, the FFT window also contains a tail from the preceding OFDM symbol. That creates intersymbol interference as well as loss of within-symbol orthogonality. The current SAPPHIRE teaching model and the four-observation toy on this page cover intercarrier interference within the current OFDM symbol only. They do not contain the preceding-symbol term, so they do not demonstrate a short-prefix receiver.',
    math: 'short CP: Y<sub>s</sub> = H₀X<sub>s</sub> + J<sub>−</sub>X<sub>s−1</sub> + ν<sub>s</sub>' + at(0.68, '<br>current scope: J<sub>−</sub>X<sub>s−1</sub> is omitted'),
    draw: function (g, p) { var R = split(g.sideR, 0.56); P.cyclicPrefixTimeline(g, R[0], { p: p, title: 'channel memory longer than the cyclic prefix', adequate: false, showPreviousTail: true }); P.iciCouplingMatrix(g, R[1], { p: seg(p, 0.32, 1), title: 'the missing prior-symbol block', band: 1, size: 6, showPreviousSymbol: true }); } });

  // ------------------------------------------------------------ 2. Keep the received evidence
  out.push({ id: 'partial-fft', chapter: CH.observations, title: 'A deck-side alternative: retain several FFT views', layout: 'side', dur: 5.8,
    text: 'The supplied OFDM deck first motivates a Partial-FFT front end: split the useful interval into time segments and keep several weighted observations of each carrier before any scalar combination. This creates no new information; it only avoids an early compression, and that fact alone does not prove a performance gain. The vector is not an input to the documented SAPPHIRE engine. From the next page onward, SAPPHIRE starts with one standard post-FFT observation y<sub>s,k</sub> per active carrier and represents coupling among carriers of the current symbol with the banded response C.',
    math: 'deck contrast: [Y<sub>1,k</sub>, …, Y<sub>M,k</sub>]ᵀ;  SAPPHIRE here: one y<sub>s,k</sub> per active carrier',
    draw: function (g, p) { P.partialFFTViews(g, g.sideR, { p: p, title: 'Partial FFT as front-end motivation, not the SAPPHIRE input', views: 4, collapse: false, note: 'deck alternative: retain an M-component vector before scalar combination' }); } });
  out.push({ id: 'separate-chain', chapter: CH.observations, title: 'The conventional chain commits early', layout: 'side', dur: 5.4,
    text: 'A conventional receiver estimates the channel from pilots, applies an equalizer or combiner, forms decoder inputs, and then decodes. That modular chain is useful, but information normally travels only forward: a later code constraint cannot revise an earlier channel fit. If a Partial-FFT front end is used, reducing its views to one scalar at this stage is also an irreversible compression.',
    math: 'pilots → channel estimate → equalize/combine → decoder inputs → decoded word',
    draw: function (g, p) { P.receiverFlow(g, g.sideR, { p: p, title: 'one-way conventional receiver chain', mode: 'conventional', conventional: ['received samples', 'pilot channel estimate', 'equalize / combine', 'decoder inputs', 'hard bits'] }); } });
  out.push({ id: 'joint-loop', chapter: CH.observations, title: 'What joint detection and decoding means here', layout: 'side', dur: 6,
    text: 'SAPPHIRE keeps the standard post-FFT carrier observations inside one objective and alternates between two unknown blocks. That is how joint detection and decoding works here: pilots anchor the channel/ICI response, while code constraints restrict the coded bits. The two sources of structure cooperate through the banded observation model, but neither replaces the other: parity checks do not turn unknown data into pilots, and pilots do not enforce a valid codeword.',
    math: 'post-FFT y<sub>s,k</sub> ← prediction C·s(b);  pilots constrain C;  parity checks constrain b',
    draw: function (g, p) { P.receiverFlow(g, g.sideR, { p: p, title: 'joint OFDM receiver flow', mode: 'joint', joint: ['post-FFT carrier observations', 'joint fit of C and b', 'parity-constrained updates', 'parity / fixed-bit / CRC test'], showSupports: true }); } });

  // ------------------------------------------------------------ 3. One receiver, two unknown blocks
  out.push({ id: 'variables', chapter: CH.joint, title: 'Name every receiver variable before the algorithm', layout: 'side', dur: 6.2,
    text: 'The shared bit vector in the continuous relaxation is b. Each parity check a keeps a local replica z<sub>a</sub> of the bits that touch that check, with a scaled dual variable u<sub>a</sub> on the same check–bit edges. The quantity v<sub>a</sub> = z<sub>a</sub> − u<sub>a</sub> is derived at the start of an update; it is not another stored state. The observation model uses C and the modulation map s(b).',
    math: 'state: C, b, {z<sub>a</sub>,u<sub>a</sub>};  derived target: v<sub>a</sub> = z<sub>a</sub> − u<sub>a</sub>',
    draw: function (g, p) { P.lines(g, g.sideR, [
      { text: 'y      post-FFT carrier observations (fixed input)', col: C.ink, mono: true },
      { text: 'C      estimated frequency-domain channel/ICI response', col: C.gold, mono: true },
      { text: 'b      shared coded-bit vector in [0,1]', col: JADE, mono: true },
      { text: 'z_a    parity-check a’s local replica of its incident bits', col: C.blue, mono: true },
      { text: 'u_a    scaled dual on those same check–bit edges', col: C.orange, mono: true },
      { text: 'v_a    z_a − u_a, recomputed; not a stored receiver state', col: C.violet, mono: true }], p, 'receiver notation'); } });
  out.push({ id: 'bits-to-symbols', chapter: CH.joint, title: 'Bit variables in [0,1] still predict modulation symbols', layout: 'side', dur: 5.8,
    text: 'During optimization, each coded bit coordinate lies in [0,1] rather than only at 0 or 1. Pairs of bit coordinates enter the quadrature phase-shift keying (QPSK) modulation map s(b); binary endpoints give the four constellation points. A concave penalty βb(1 − b) discourages values near one half. The small engine later uses the real map s = 1 − 2b only to make the coupling visible on a two-dimensional canvas.',
    math: 'x<sub>i</sub> = 1 − 2b<sub>i</sub>;  d = (x<sub>I</sub> + jx<sub>Q</sub>)/√2' + at(0.55, '<br>00 → (+1,+1); 01 → (+1,−1); 10 → (−1,+1); 11 → (−1,−1)'),
    draw: function (g, p) { qpskPicture(g, g.sideR, p); } });
  out.push({ id: 'anchors-and-constraints', chapter: CH.joint, title: 'Pilots and code constraints do different jobs', layout: 'side', dur: 5.8,
    text: 'Known pilot symbols provide fixed references for estimating C and regularizing changes from the pilot estimate C⁰. On data positions, the low-density parity-check (LDPC) code supplies parity relations among the unknown bits. Separately, the receiver configuration fixes any known bit positions, and the CRC tests a hard candidate. These are distinct sources of information; none substitutes for another.',
    math: 'pilots anchor C = C⁰ + Δ;  LDPC checks constrain b;  configuration fixes selected bits;  CRC tests a candidate',
    draw: function (g, p) { var R = split(g.sideR, 0.5); P.lines(g, R[0], [{ text: 'known pilot symbols', col: C.gold }, { text: 'pilot estimate C⁰', col: C.gold }, { text: 'regularize the change Δ', col: C.ink }], seg(p, 0, 0.7), 'anchor the channel/ICI response'); P.lines(g, R[1], [{ text: 'LDPC: parity relations among data bits', col: C.blue }, { text: 'configuration: selected bit values', col: JADE }, { text: 'CRC: test the hard candidate', col: C.ink }], seg(p, 0.3, 1), 'three distinct bit-side roles'); } });
  out.push({ id: 'prediction', chapter: CH.joint, title: 'The coupling sits in the prediction', layout: 'side', dur: 5.8,
    text: 'The predicted received observations are formed by applying the estimated response C to the symbols s(b). With b and the current robust weights fixed, the response update is a regularized quadratic problem. With C fixed, the bit update still contains modulation, binary encouragement, and code constraints. Jointly, C and b multiply inside the prediction, so the surface is nonconvex and can contain ambiguities or competing basins.',
    math: 'ŷ(C,b) = C·s(b);  residual r = y − ŷ(C,b)',
    draw: function (g, p) { flow(g, g.sideR, [['bits b', 's(b)', JADE], ['response C', 'C·s(b)', C.gold], ['observations y', 'residual y − C·s(b)', C.blue]], p, 'prediction and residual', 'the residual changes both blocks'); } });
  out.push({ id: 'robust-objective', chapter: CH.joint, title: 'What the objective asks for', layout: 'side', dur: 6.2,
    text: 'The SAPPHIRE objective J combines a robust fit to the post-FFT carrier observations, pilot anchoring, frequency smoothness of the correction Δ = C − C⁰, a temporal prior on the full response C, and encouragement toward binary bit values. Hard code feasibility is separate: every local replica must lie in its parity polytope, z<sub>a</sub> ∈ P<sub>a</sub>. ADMM adds augmented agreement terms to make each z<sub>a</sub> match the shared b. The supplied deck’s smooth parity penalty is a different formulation; it must not be confused with SAPPHIRE’s parity-polytope projection. The estimated C is a model representation, not unique physical channel truth. SAPPHIRE stands for <strong>S</strong>ymbol detection <strong>A</strong>ided by code through <strong>P</strong>arity constraints and <strong>P</strong>olytope projections, with <strong>H</strong>alf-quadratic weighting under <strong>I</strong>CI in a joint OFDM <strong>R</strong>eceiver with <strong>E</strong>rror-correction decoding.',
    math: 'J(C,b) = robust fit + response regularization + binary pull;  z<sub>a</sub> ∈ P<sub>a</sub>;  ADMM augments b = z<sub>a</sub>',
    draw: function (g, p) { P.objectiveBlocks(g, g.sideR, { p: p, title: 'objective, hard constraint, and ADMM mechanism', terms: [
      { tag: 'R', label: 'robust data fit in J', note: 'C·s(b) against y', col: C.blue },
      { tag: 'P', label: 'response terms in J', note: 'Δ smooth in frequency; full-C time prior', col: C.gold },
      { tag: 'B', label: 'binary-end pull in J', note: 'b toward 0 or 1', col: JADE },
      { tag: 'H', label: 'hard parity set', note: 'z_a ∈ P_a', col: C.violet },
      { tag: 'A', label: 'ADMM agreement', note: 'shared b, local z_a, dual u_a', col: C.orange }], result: 'minimize J subject to hard parity sets; ADMM enforces agreement' }); } });
  out.push({ id: 'why-alternate', chapter: CH.joint, title: 'Why the solver alternates', layout: 'side', dur: 5.8,
    text: 'There is no closed-form minimizer for the coupled nonconvex objective. SAPPHIRE therefore uses a disciplined block schedule: robust weights, a majorized bit step, new weights, an exact sparse channel step for the fixed bit block, parity projections, and a scaled-dual update. A checked decrease for one block is narrow evidence about that step; it is not a certificate of the global solution.',
    math: 'coupled nonconvex problem → checked block updates, not one closed-form solve',
    draw: function (g, p) { flow(g, g.sideR, [['bit block b', 'majorized update', JADE], ['response block C', 'sparse linear solve', C.gold], ['code copies z,u', 'projection + dual', C.blue]], p, 'alternating block schedule', 'repeat, then test a hard candidate'); } });

  // ------------------------------------------------------------ 4. ADMM for the code constraints
  out.push({ id: 'parity-polytope', chapter: CH.admm, title: 'A two-bit parity set', layout: 'map+side', view: VIEW, dur: 5.4,
    text: 'To isolate the ADMM mechanism, first hold the channel evidence fixed. The teaching check contains two bits and requires even parity, so the valid binary words are 00 and 11. Its relaxed parity polytope is the blue line z₁ = z₂. Full LDPC checks have higher-dimensional parity polytopes; the line is only the smallest drawable example.',
    math: 'shared bits b ∈ [0,1]²;  local replica z ∈ P;  here P = {z : z₁ = z₂}',
    draw: function (g, p) { kb(g, { squareP: seg(p, 0, 0.35), lawP: seg(p, 0.25, 0.65) }); P.corners(g, seg(p, 0.35, 0.9), land.lawful); P.lines(g, g.sideR, [{ text: '00 and 11: valid binary words', col: C.blue }, { text: '01 and 10: fail this parity check', col: C.orange }, { text: 'blue line: relaxed parity polytope P', col: C.ink }], p, 'one even-parity check'); } });
  var r1 = rw[1], r2 = rw[2], mid = 1, targetSum = r2.advice[mid];
  out.push({ id: 'local-copies', chapter: CH.admm, title: 'One shared bit can touch several checks', layout: 'side', dur: 5.8,
    text: 'The receiver stores one shared bit vector b in the continuous relaxation. Every parity check a owns only a local replica z<sub>a</sub> of the bit coordinates incident on that check, plus a scaled dual u<sub>a</sub> on those edges. Thus a bit shared by two checks is not duplicated in b; it receives two ADMM agreement terms. In the old Keep analogy, z<sub>a</sub> was a Warden’s copy and u<sub>a</sub> its ledger.',
    math: 'shared b;  for every check a: z<sub>a</sub> ∈ P<sub>a</sub> and u<sub>a</sub> on edges (a,i)',
    draw: function (g, p) { P.parityGraph(g, g.sideR, { p: p, title: 'two parity checks share one bit variable', bits: 3, checks: [[0, 1], [1, 2]], b: r2.b, z: r2.z, u: r2.u, showCopies: true, showDual: true }); } });
  out.push({ id: 'aim', chapter: CH.admm, title: 'Form the derived target v = z − u', layout: 'map+side', view: VIEW, dur: 5.2,
    text: 'To make the numbers concrete, follow ADMM iteration 3 of the frozen known-channel teaching trace. It starts from b⁽²⁾, z⁽²⁾, and u⁽²⁾. Before updating b, compute v⁽²⁾ = z⁽²⁾ − u⁽²⁾ = ' + pair(v2) + '. This v is only the centre of the current quadratic agreement term. It is derived from z and u, is not independently optimized, and is not a physical receiver observation.',
    math: 'v<sup>(2)</sup> = z<sup>(2)</sup> − u<sup>(2)</sup> = ' + pair(z2) + ' − ' + pair(u2) + ' = ' + pair(v2),
    draw: function (g, p) { kb(g); P.bitNode(g, b2, 1, 'shared b(2)'); P.warden(g, z2, 1, 'local z(2)'); g.arrow(z2, v2, C.violet, 3, seg(p, 0.25, 0.7)); g.dot(v2, 6, C.violet, seg(p, 0.6, 0.8)); g.label(v2, 'derived v(2)', C.violet, { dx: 12, dy: -10, p: seg(p, 0.7, 1) }); P.lines(g, g.sideR, [{ text: 'z(2)  local parity replica  ' + pair(z2), col: C.blue, mono: true }, { text: 'u(2)  scaled dual          ' + pair(u2), col: C.orange, mono: true }, { text: 'v(2)  z(2) − u(2)       ' + pair(v2), col: C.violet, mono: true }], p, 'not three kinds of bits'); } });
  out.push({ id: 'bit-update', chapter: CH.admm, title: 'Update the shared bit variables in [0,1]', layout: 'map+side', view: VIEW, dur: 5.8,
    text: 'With the channel evidence and v⁽²⁾ fixed, the two-bit toy minimizes the bit-zero log-likelihood-ratio (LLR) term ℓ<sub>i</sub>b<sub>i</sub>, the binary penalty, and the quadratic ADMM agreement term. Positive ℓ<sub>i</sub> supports bit zero. Because ρ − 2β is positive here, each coordinate has one unconstrained minimizer and is clipped to [0,1]. The update gives b⁽³⁾ = ' + pair(b3) + '. This is a block update, not a decoded word.',
    math: 'b<sub>i</sub><sup>(3)</sup> = clip(' + at(0.28, '<br>(ρv<sub>i</sub><sup>(2)</sup> − ℓ<sub>i</sub> − β)/(ρ − 2β), 0, 1)') + at(0.68, '<br>b<sup>(3)</sup> = ' + pair(b3)),
    draw: function (g, p) { var ropeK = function (b) { return land.f(b) + rho / 2 * ((b[0] - v2[0]) * (b[0] - v2[0]) + (b[1] - v2[1]) * (b[1] - v2[1])); }; g.land(ropeK, { id: 'fixed-bit-update', rings: 10 }); P.axes(g, 'shared bit b₁ →', '↑ shared bit b₂'); P.square(g); P.lawLine(g); g.dot(v2, 6, C.violet, 1); var q = seg(p, 0.25, 0.82); g.path([b2, b3], JADE, 3, q); P.bitNode(g, lerp2(b2, b3, q), 1, q >= 1 ? 'new b(3)' : ''); P.lines(g, g.sideR, [{ text: 'bit-zero LLR term: ℓ_i b_i', col: C.gold, mono: true }, { text: 'binary term: β b_i(1 − b_i)', col: JADE, mono: true }, { text: 'agreement term: ρ/2 |b − v|²', col: C.violet, mono: true }], p, 'what this update minimizes'); } });
  var bu = add(b3, u2);
  out.push({ id: 'projection', chapter: CH.admm, title: 'Project each local copy onto its parity set', layout: 'map+side', view: VIEW, dur: 5.2,
    text: 'Now hold the new shared bits b⁽³⁾ and the old scaled dual u⁽²⁾ fixed. The local update projects b⁽³⁾ + u⁽²⁾ onto the parity polytope P. In this two-bit example, projection onto z₁ = z₂ replaces the coordinates by their clipped mean, giving z⁽³⁾ = ' + pair(z3) + '. Longer checks use their actual parity-polytope projection, not this mean shortcut.',
    math: 'z<sup>(3)</sup> = Π<sub>P</sub>(b<sup>(3)</sup> + u<sup>(2)</sup>) = Π<sub>P</sub>' + pair(bu) + ' = ' + pair(z3),
    draw: function (g, p) { kb(g); P.bitNode(g, b3, 1, 'shared b(3)'); g.arrow(b3, bu, C.orange, 2, seg(p, 0.1, 0.35)); g.dot(bu, 5, C.ink, seg(p, 0.3, 0.45)); g.label(bu, 'b(3) + u(2)', C.ink, { dx: 10, dy: -12, p: seg(p, 0.35, 0.55) }); g.line(bu, z3, C.blue, 2.5, seg(p, 0.5, 0.82), [5, 4]); P.warden(g, z3, seg(p, 0.72, 1), 'projected z(3)'); P.lines(g, g.sideR, [{ text: 'input: shared b(3) + old u(2)', col: C.ink }, { text: 'operation: nearest point in P', col: C.blue }, { text: 'output: parity-feasible local replica z(3)', col: JADE }], p, 'one check’s projection'); } });
  var gap3 = sub(b3, z3);
  out.push({ id: 'dual-update', chapter: CH.admm, title: 'Accumulate disagreement in the scaled dual', layout: 'map+side', view: VIEW, dur: 5.2,
    text: 'Only after both new vectors exist does the scaled dual add their signed disagreement. Here u⁽³⁾ = u⁽²⁾ + b⁽³⁾ − z⁽³⁾ = ' + pair(u3) + '. The signs matter because the next derived target is z⁽³⁾ − u⁽³⁾. Standard ADMM diagnostics are the primal residual r, which measures shared-to-local agreement, and the dual residual s, which measures motion of the local replicas. A nonzero u can remain even when b and z later agree; it balances the other objective terms.',
    math: 'u<sup>(k)</sup> = u<sup>(k−1)</sup> + b<sub>N</sub><sup>(k)</sup> − z<sup>(k)</sup>' + at(0.5, '<br>r<sup>(k)</sup> = b<sub>N</sub><sup>(k)</sup> − z<sup>(k)</sup>;  s<sup>(k)</sup> = ρ(z<sup>(k)</sup> − z<sup>(k−1)</sup>)') + at(0.84, '<br>iteration 3: u = ' + pair(u2) + ' + ' + pair(gap3) + ' = ' + pair(u3)),
    draw: function (g, p) { kb(g); P.bitNode(g, b3, 1, 'b(3)'); P.warden(g, z3, 1, 'z(3)'); g.arrow(z3, b3, C.violet, 3, seg(p, 0.1, 0.48)); g.label(lerp2(z3, b3, 0.5), 'signed residual b − z', C.violet, { dx: 10, dy: -10, p: seg(p, 0.35, 0.6), size: 11.5 }); P.lines(g, g.sideR, [{ text: 'old scaled dual u(2) = ' + pair(u2), col: C.orange, mono: true }, { text: 'add b(3) − z(3) = ' + pair(gap3), col: C.violet, mono: true }, { text: 'new scaled dual u(3) = ' + pair(u3), col: JADE, mono: true }], p, 'dual update'); } });
  out.push({ id: 'acceptance', chapter: CH.admm, title: 'Separate the toy oracle from receiver acceptance', layout: 'map+side', view: VIEW, dur: 6,
    text: 'After the complete ADMM update, threshold the shared b—not a local z—to form a hard candidate. At iteration ' + hd + ', the toy gives ' + word(kw[hd].word) + ' and its hidden-truth “Seal” oracle reports a match; the toy does not evaluate a CRC. A real SAPPHIRE candidate is accepted only if every parity check passes, every bit fixed by the receiver configuration has its required value, and the CRC passes. Candidate acceptance is not ADMM convergence and does not prove a global optimum.',
    math: 'toy trace: Seal = hidden-word match;  real receiver: parity ✓ + configured fixed bits ✓ + CRC ✓',
    draw: function (g, p) { kb(g); var up = seg(p, 0, 0.5) * hd, bq = walkTo(g, kw, up, JADE, 2.5, 'x'), zq = walkTo(g, kw, up, C.blue, 2, 'z'); P.bitNode(g, bq, 1, 'shared b'); P.warden(g, zq, 1, 'local z'); P.verdict(g, b3, true, seg(p, 0.52, 0.7)); P.lines(g, g.sideR, [{ text: 'threshold shared b  →  ' + word(kw[hd].word), col: JADE, mono: true }, { text: 'toy Seal oracle: hidden-word match       ' + tick(kw[hd].sealed), col: C.blue, mono: true }, { text: 'real SAPPHIRE: parity + fixed bits + CRC', col: C.gold, mono: true }, { text: 'agreement gap still ' + num(kw[hd].gap) + ': oracle match ≠ convergence', col: C.orange, mono: true }], seg(p, 0.45, 1), 'toy oracle versus real receiver test'); } });

  // ------------------------------------------------------------ 5. Alternating channel and bits
  out.push({ id: 'robust-weights', chapter: CH.coupled, title: 'Robust weights limit a poor observation', layout: 'side', dur: 5.8,
    text: 'Restore the unknown response, while keeping the miniature explicit: its four real-valued observations comprise two known endpoint pilots and two data positions; it has two bit variables in [0,1], one two-bit parity check, and two real response coefficients—the direct coefficient c₀ and neighbouring-carrier coefficient c₁. Full SAPPHIRE instead uses complex, carrier- and OFDM-symbol-indexed C<sub>s,k,ℓ</sub>. For toy observation s, the energy E<sub>s</sub> includes prediction error and bit uncertainty, then divides by v<sub>s</sub>, the pilot-estimate interpolation-error variance used as that observation’s scale—not generic noise variance and not the ADMM target v<sub>a</sub>. The parameter δ is the pseudo-Huber scale; large E<sub>s</sub> gives a smaller weight without deleting the observation.',
    math: 'E<sub>s</sub> = (squared prediction error + bit-uncertainty term)/v<sub>s</sub>' + at(0.42, '<br>w<sub>s</sub> = 1/√(1 + E<sub>s</sub>/δ²)') + at(0.76, '<br>δ = pseudo-Huber scale'),
    draw: function (g, p) { var after = p > 0.62, w = after ? vr.w2 : vr.w1, En = after ? vr.E2 : vr.E1, b = after ? vr.b : vr.from, R = split(g.sideR, 0.54); P.hall(g, R[0], { land: veil, b: b, w: w, p: 1, technical: true, title: 'four model observations: pilots at the ends' }); P.lines(g, R[1], En.map(function (e, k) { return { text: (k === 0 || k === 3 ? 'pilot ' : 'data  ') + k + ': E ' + num(e.E, 3) + ', w ' + num(w[k], 2), col: w[k] < 0.9 ? C.orange : C.ink, mono: true }; }), after ? 1 : seg(p, 0.15, 0.7), 'current robust weights'); } });
  var ropeV = function (b) { return veil.J(cF, b) + veil.rope(b, vz, vu, rho); };
  out.push({ id: 'bit-majorizer', chapter: CH.coupled, title: 'Majorize the coupled bit block, then minimize it', layout: 'map+side', view: VIEW, dur: 6.2,
    text: 'With C, z, u, and the first weight set fixed, neighbouring-carrier coupling makes the bit coordinates interact. SAPPHIRE evaluates partial derivatives at the current b and adds diagonal curvature h<sub>i</sub> large enough for a surrogate to touch the coupled term at that point and stay above it. Minimizing that surrogate updates all bits together and clips them to [0,1]. The old “Bowl” is only an analogy for this majorizing surrogate.',
    math: 'surrogate = gᵀ(b − b<sup>prev</sup>)' + at(0.38, '<br>+ ½Σh<sub>i</sub>(b<sub>i</sub> − b<sub>i</sub><sup>prev</sup>)²') + at(0.74, '<br>+ binary + ADMM terms'),
    draw: function (g, p) { g.land(ropeV, { id: 'coupled-bit-step', rings: 10 }); P.axes(g, 'bit variable b₁ →', '↑ bit variable b₂'); P.square(g); P.lawLine(g); g.dot(vv, 6, C.violet, 1); var q = seg(p, 0.45, 0.88); g.path([vb0, vb1], JADE, 3, q); P.bitNode(g, lerp2(vb0, vb1, q), 1, q >= 1 ? 'majorized bit step' : ''); P.lines(g, g.sideR, [{ text: 'evaluate partial derivatives at b_prev', col: C.ink }, { text: 'choose diagonal curvature h_i', col: C.gold }, { text: 'minimize the surrogate for all b_i', col: JADE }, { text: 'clip each coordinate to [0,1]', col: C.blue }], p, 'one coupled bit update'); } });
  var lm = vr.loom, loomRel = lm.plumb / Math.max(Math.hypot(lm.r[0], lm.r[1]), 1e-30), loomView = [-2.4, 2.4, -2.4, 2.4];
  var loomFn = function (cq) { return veil.veilCost(vr.w2, vb1, cq); }, loomShade = P.shadeOf(loomFn, loomView, 'channel-solve', 12);
  out.push({ id: 'channel-solve', chapter: CH.coupled, title: 'With bits fixed, solve the response block', layout: 'map+side', view: loomView, dur: 5.8,
    text: 'After recomputing the weights at the new b, hold both fixed. The toy response objective is quadratic in c = (c₀,c₁), so its minimizer solves the two-by-two normal equations M c = r. The residual check confirms this linear solve, not the global joint problem. Full SAPPHIRE performs the corresponding sparse solve for C = C⁰ + Δ with its response regularization.',
    math: 'M c = r;  c: ' + pair(cF) + ' → ' + pair(cN) + ';  relative equation residual ' + loomRel.toExponential(1),
    draw: function (g, p) { g.land(loomFn, loomShade); P.axes(g, 'direct coefficient c₀ →', '↑ neighbour coefficient c₁'); g.dot(cF, 6, C.ink, 1); var q = seg(p, 0.28, 0.75); g.arrow(cF, cN, JADE, 3, q); if (q >= 1) { g.dot(cN, 6, JADE, 1); g.label(cN, 'linear-system solution', JADE, { dx: 10, dy: -14, size: 11.5 }); } P.lines(g, g.sideR, [{ text: 'bits b and robust weights w held fixed', col: C.ink }, { text: 'solve M c = r exactly for this toy block', col: C.gold, mono: true }, { text: 'absolute residual ' + lm.plumb.toExponential(1), col: C.blue, mono: true }, { text: 'relative residual ' + loomRel.toExponential(1), col: JADE, mono: true }], p, 'response-block certificate'); } });
  out.push({ id: 'iteration-order', chapter: CH.coupled, title: 'One complete SAPPHIRE-style iteration', layout: 'side', dur: 6.5,
    text: 'Order matters. First derive every v<sub>a</sub> = z<sub>a</sub> − u<sub>a</sub>. Then compute robust weights, take the majorized bit update, recompute the weights because b changed, solve the response block, project each local replica, and update every scaled dual. Only then form and test a hard candidate. The parity projection is an exact feasibility operation, but it is not one of the objective-descent certificates.',
    math: 'v → weights → b → weights → C → parity projections z → scaled duals u → candidate test',
    draw: function (g, p) { P.updateLoop(g, g.sideR, { p: p, title: 'one complete SAPPHIRE-style iteration', steps: [
      { tag: '0', label: 'derive v = z − u', col: C.violet }, { tag: '1', label: 'robust weights', col: C.blue },
      { tag: '2', label: 'majorized bit step', col: JADE }, { tag: '3', label: 'refresh weights', col: C.blue },
      { tag: '4', label: 'response solve', col: C.gold }, { tag: '5', label: 'parity projections', col: C.violet },
      { tag: '6', label: 'scaled-dual update', col: C.orange }, { tag: '7', label: 'candidate test', col: C.green }],
      footnote: 'Projection enforces local feasibility; the candidate test is not a global-optimality certificate.' }); } });
  out.push({ id: 'milestones', chapter: CH.coupled, title: 'Toy oracle, consensus, and full-state threshold differ', layout: 'side', dur: 6.6,
    text: 'The unknown-response toy’s hidden-truth Seal oracle first matches on iteration ' + vhd + ', while b and z are still ' + num(vw[vhd].gap) + ' apart. If the simulator ignores that oracle match only to expose the dynamics, the replicas first agree on iteration ' + vMeet + ', and the change in the full toy state (C, b, z, u) falls below its internal threshold on iteration ' + vRest + '. These events are not interchangeable with standard ADMM residual tests. The documented SAPPHIRE engine stops when a real candidate passes parity, configured-bit and CRC tests, when the update budget is reached, or when a numerical certificate fails—not when r and s cross convergence tolerances. The toy endpoint c = ' + pair(vEnd.c, 2) + ' is not known channel truth and is not a certified global optimum.',
    math: 'toy oracle match: ' + vhd + ';  first r = 0: ' + vMeet + ';  full-state change threshold: ' + vRest,
    draw: function (g, p) { P.milestoneTimeline(g, g.sideR, { p: p, title: 'three different stopping statements', min: 0, max: vRest, items: [
      { at: 0, label: 'initial state', note: 'toy oracle not matched', col: C.ink, shape: 'circle' },
      { at: vhd, label: 'toy oracle match', note: '|b − z| = ' + num(vw[vhd].gap), col: C.gold, shape: 'diamond' },
      { at: vMeet, label: 'first replica agreement', note: 'b = z in the toy', col: JADE, shape: 'square' },
      { at: vRest, label: 'full-state change threshold', note: 'change in C, b, z and u is below the toy threshold', col: C.blue, shape: 'circle' }] }); } });

  // ------------------------------------------------------------ 6. From toy receiver to SAPPHIRE
  out.push({ id: 'shared-bits', chapter: CH.scale, title: 'Sum the incident ADMM targets for each bit', layout: 'side', dur: 5.8,
    text: 'For a bit i that belongs to d<sub>i</sub> parity checks, every incident edge contributes one target z<sub>a,i</sub> − u<sub>a,i</sub>. Their sum enters the bit formula, while the combined quadratic penalty has stiffness d<sub>i</sub>ρ and centre equal to their average. In the three-bit engine below, the middle bit touches two checks and moves from ' + num(r1.b[mid]) + ' to ' + num(r2.b[mid]) + ' using incident-target sum ' + num(targetSum, 3) + '.',
    math: 'S<sub>i</sub> = Σ<sub>a∋i</sub>(z<sub>a,i</sub> − u<sub>a,i</sub>);  quadratic centre = S<sub>i</sub>/d<sub>i</sub>',
    draw: function (g, p) { var R = split(g.sideR, 0.64); P.parityGraph(g, R[0], { p: p, title: 'degree two: two check edges meet b₂', bits: 3, checks: [[0, 1], [1, 2]], b: r2.b, z: r2.z, u: r2.u, showCopies: true, showDual: true }); P.lines(g, R[1], [{ text: 'degree d₂ = 2', col: C.ink, mono: true }, { text: 'incident-target sum S₂ = ' + num(targetSum, 3), col: C.violet, mono: true }, { text: 'quadratic centre S₂/d₂ = ' + num(targetSum / 2, 3), col: C.gold, mono: true }, { text: 'b₂: ' + num(r1.b[mid]) + ' → ' + num(r2.b[mid]), col: JADE, mono: true }], p, 'sum the incident ADMM targets'); } });
  out.push({ id: 'full-frame', chapter: CH.scale, title: 'Scale the response model across carriers and symbols', layout: 'side', dur: 6.2,
    text: 'The full response is C = C⁰ + Δ over the represented carriers and OFDM symbols. The documented prediction keeps carrier offsets ℓ = −1, 0, 1, a half-width-one band. Pilots produce C⁰ and the temporal coefficient a<sub>s</sub>. The frequency regularizer makes the correction Δ = C − C⁰ smooth across carriers; separately, the temporal prior acts on the full response, C<sub>s+1</sub> ≈ a<sub>s</sub>C<sub>s</sub>. One sparse linear system updates the represented response block. This remains a model of intercarrier interference within each current symbol. Supporting a too-short cyclic prefix requires an explicit preceding-symbol term and the corresponding additional data symbols.',
    math: 'ℓ ∈ {−1,0,1}' + at(0.30, '<br>Δ = C − C⁰ is smooth across carriers') + at(0.56, '<br>C<sub>s+1</sub> ≈ a<sub>s</sub>C<sub>s</sub>') + at(0.80, '<br>short-CP extension would add J<sub>−</sub>X<sub>s−1</sub>'),
    draw: function (g, p) { var R = split(g.sideR, 0.58); P.iciCouplingMatrix(g, R[0], { p: p, title: 'documented half-width-one response: ℓ = −1, 0, 1', band: 1, size: 8, approximation: true }); P.lines(g, R[1], [{ text: 'C = C⁰ + Δ', col: C.gold, mono: true }, { text: 'frequency: smooth Δ = C − C⁰ across carriers', col: JADE }, { text: 'time: C_s+1 ≈ a_s C_s for the full response', col: C.blue, mono: true }, { text: 'short CP needs an added prior-symbol block', col: C.red }], p, 'scale from the toy to the represented frame'); } });
  out.push({ id: 'takeaway', chapter: CH.scale, title: 'What to carry from the tutorial', layout: 'side', dur: 7,
    text: 'SAPPHIRE starts from one post-FFT observation per active carrier, couples neighbouring carriers through a pilot-anchored response C, estimates C together with bit variables b in [0,1], and uses ADMM local copies to enforce the code constraints. The fixed-channel examples reproduce selected values from a frozen Julia decode_llr trace. The four-observation unknown-channel example is a teaching model built from the documented equations, not a run or performance validation of the full receiver. No page here claims BER gain, convergence to a global optimum, recovery of physical channel truth, or short-CP operation.',
    math: 'retain evidence → couple C and b → enforce parity with {z<sub>a</sub>,u<sub>a</sub>} → test a hard candidate',
    draw: function (g, p) { P.keyTable(g, g.sideR, [
      ['OFDM evidence', 'The deck shows Partial FFT; documented SAPPHIRE uses one post-FFT y_s,k per active carrier.'],
      ['channel and bits', 'Pilots anchor C; code constraints restrict b; neither replaces the other.'],
      ['ADMM variables', 'b is shared; z_a is local; u_a is the scaled dual; v_a = z_a − u_a is derived.'],
      ['acceptance', 'Parity, configured fixed bits, and CRC accept a candidate; acceptance is not convergence.'],
      ['Jade Keep analogy', 'Veil = C, tiles = b, Wardens = z_a, ledgers = u_a, Herald = candidate test.']], p, 'receiver meaning first; analogy second'); } });

  // ------------------------------------------------------------ page player and chapter bar
  var chapters = [];
  out.forEach(function (s, i) { if (!chapters.length || chapters[chapters.length - 1].name !== s.chapter) chapters.push({ name: s.chapter, start: i, n: 0 }); chapters[chapters.length - 1].n++; });
  var bar = document.getElementById('progress');
  if (bar) {
    bar.innerHTML = chapters.map(function (ch, k) { return '<button type="button" class="seg" data-k="' + k + '" style="flex-grow:' + ch.n + '" title="' + ch.name + '"><span class="fill"></span><span class="name">' + ch.name + '</span></button>'; }).join('');
    bar.addEventListener('click', function (e) { var b = e.target.closest ? e.target.closest('[data-k]') : null; if (b) B.go(chapters[+b.getAttribute('data-k')].start); });
  }
  B.onStep(function (i) {
    if (!bar) return;
    Array.prototype.forEach.call(bar.querySelectorAll('[data-k]'), function (b, k) { var ch = chapters[k], f = clamp((i - ch.start + 1) / ch.n, 0, 1); b.querySelector('.fill').style.width = Math.round(f * 100) + '%'; b.classList.toggle('on', i >= ch.start && i < ch.start + ch.n); });
  });
  document.addEventListener('keydown', function (e) { if (e.ctrlKey || e.metaKey || e.altKey) return; if (e.target && /^(INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY)$/.test(e.target.tagName) && (e.key === ' ' || e.key === 'Enter')) return; B.key(e); });
  B.openSteps(out, { embedded: true });
  window.course = { steps: out, chapters: chapters, walks: { keep: kw, veil: vw, row: rw } };
  var hash = (window.location && window.location.hash) || '', ms = /step=([^&]+)/.exec(hash), mp = /p=([0-9.]+)/.exec(hash);
  if (ms) { var st = decodeURIComponent(ms[1]); B.debug({ step: /^\d+$/.test(st) ? +st : st, p: mp ? +mp[1] : 1 }); }
})();
