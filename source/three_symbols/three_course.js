// "Three symbols, two checks" (three_symbols_two_checks.html): the mechanism of SAPPHIRE's ADMM taught on three shared
// symbol estimates and two even-parity checks of degree two.  The conflict between the overlapping checks comes before
// the replicas; the replicas, the projection and the ledger come before the worked round; the round is the handover's
// own trace (b⁰ = c, z_a⁰ = S_a c, u_a⁰ = 0, ρ = 1); BP, CORAL and L-BFGS are set beside it at the end before the
// symbol, channel, projection and ledger blocks of the recorded-frame SAPPHIRE update.  The numbers come from three.js
// and the drawings from three_parts.js.  The toy's numerical slope/curvature step leads directly into SAPPHIRE's
// temporary quadratic, symbol, channel and constraint blocks before the comparisons with BP, CORAL and L-BFGS.
// Told on the player of the King's Land tutorials (board.js).
(function () {
  'use strict';
  var B = window.Board, T = window.Three, P = window.ThreeParts; if (!B || !T || !P) return;
  var H = B.H, C = H.C, seg = H.seg, num = H.num, at = H.at, clamp = H.clamp, mix = H.mix;
  var COL = P.COL, rich = P.rich;

  // ------------------------------------------------------------ the case and its two runs
  var d = T.build(), A = d.admm, R = A.rounds, L = d.alone.rounds, rho = d.rho, c = d.c, PASS = A.firstPass, FIN = A.final, AL = d.alone.final, N = 12;
  var R1 = R[1], R2 = R[2], RP = R[PASS], L1 = L[1], L2 = L[2], L3 = L[3], L12 = L[12];
  function f2(v) { return num(v, 2); }
  function f3(v) { return num(v, 3); }
  function v2(v) { return '(' + v.map(f2).join(', ') + ')'; }
  function v3(v) { return '(' + v.map(f3).join(', ') + ')'; }
  function word(w) { return w.join(' '); }
  // the page's symbols: bold vectors and matrices, ordinary scalars
  function bold(s) { return '<b>' + s + '</b>'; }
  function sub(x, s) { return x + '<sub>' + s + '</sub>'; }
  var b = bold('b'), cv = bold('c'), Cmat = bold('C'), cch = sub(bold('c'), 'ch'), Mmat = bold('M'), rvec = bold('r'), Hm = bold('H'), za = sub(bold('z'), 'a'), zA = sub(bold('z'), 'A'), zB = sub(bold('z'), 'B'), ua = sub(bold('u'), 'a'), uA = sub(bold('u'), 'A'), uB = sub(bold('u'), 'B');
  var Sa = sub(bold('S'), 'a'), SA = sub(bold('S'), 'A'), SB = sub(bold('S'), 'B'), ra = sub(bold('r'), 'a'), rA = sub(bold('r'), 'A'), PA = sub('𝒫', 'A'), Pa = sub('𝒫', 'a');
  function bi(i) { return sub('b', i); }
  function ze(a, i) { return sub('z', a + ',' + i); }
  function ue(a, i) { return sub('u', a + ',' + i); }
  function sup(x, k) { return x + '<sup>' + k + '</sup>'; }
  var EDGE_NAMES = [['A', 1], ['A', 2], ['B', 2], ['B', 3]];
  // the edge boxes of a state: rows of [name, value, colour]
  function boxesOf(st, o) {
    o = o || {};
    return T.EDGES.map(function (E, e) {
      var nm = EDGE_NAMES[e], rows = [];
      if (o.z !== false) rows.push(['z_{' + nm[0] + ',' + nm[1] + '}', st ? f2(st.z[E[0]][E[2]]) : '', COL.z, o.zP]);
      if (o.u) rows.push(['u_{' + nm[0] + ',' + nm[1] + '}', st ? f2(st.u[E[0]][E[2]]) : '', COL.u, o.uP]);
      return { rows: rows, p: o.p == null ? 1 : (typeof o.p === 'function' ? o.p(e) : o.p), hi: o.hi && o.hi.indexOf(e) >= 0, short: o.short, f: o.f };
    });
  }
  function names(o) { return T.EDGES.map(function (E, e) { var nm = EDGE_NAMES[e], rows = [['z_{' + nm[0] + ',' + nm[1] + '}', '', COL.z]]; if (o && o.u) rows.push(['u_{' + nm[0] + ',' + nm[1] + '}', '', COL.u, o.uP]); return { rows: rows.map(function (rw) { return ['', rw[0], rw[2], rw[3]]; }), p: o && o.p != null ? o.p : 1, hi: o && o.hi && o.hi.indexOf(e) >= 0, short: true }; }); }
  function vals(v, k) { return v.map(function (x) { return num(x, k == null ? 2 : k); }); }
  function status(st) { return T.CHECKS.map(function (ch, a) { var w = T.select(a, st.word); return w[0] === w[1] ? 'pass' : 'fail'; }); }
  // Animated flow boxes.  Wide stages run left to right; phone stages run top to bottom.
  function blockFlow(g, Rr, items, q, title) {
    var horizontal = P.wide(Rr), n = items.length, gap = horizontal ? 10 : 8, bw, bh, x0, y0, pos = [];
    g.panel(Rr, title);
    if (horizontal) {
      bw = Math.min(150, (Rr[2] - 32 - gap * (n - 1)) / n); bh = 72;
      x0 = Rr[0] + (Rr[2] - (n * bw + (n - 1) * gap)) / 2; y0 = Rr[1] + Rr[3] * 0.43;
    } else {
      bw = Math.min(300, Rr[2] - 36); bh = Math.min(62, (Rr[3] - 54 - gap * (n - 1)) / n);
      x0 = Rr[0] + (Rr[2] - bw) / 2; y0 = Rr[1] + 42;
    }
    items.forEach(function (it, i) { pos.push(horizontal ? [x0 + i * (bw + gap), y0] : [x0, y0 + i * (bh + gap)]); });
    for (var i = 0; i + 1 < n; i++) {
      var pa = seg(q, items[i + 1][3] - 0.06, items[i + 1][3] + 0.08); if (!(pa > 0)) continue;
      var A0 = horizontal ? [pos[i][0] + bw, pos[i][1] + bh / 2] : [pos[i][0] + bw / 2, pos[i][1] + bh];
      var A1 = horizontal ? [pos[i + 1][0], pos[i + 1][1] + bh / 2] : [pos[i + 1][0] + bw / 2, pos[i + 1][1]];
      g.arrowPx(A0, [mix(A0[0], A1[0], pa), mix(A0[1], A1[1], pa)], items[i + 1][2], 1.8);
    }
    items.forEach(function (it, i) { P.box(g, pos[i][0], pos[i][1], bw, bh, it[0], it[1], it[2], seg(q, it[3], it[3] + 0.12)); });
  }
  var out = [], CH = { conflict: 'The conflict', copies: 'Copies', memory: 'Memory', round: 'One round by hand', agree: 'Agreement', inside: 'Inside SAPPHIRE', beside: 'Beside other methods' };

  // ------------------------------------------------------------ 1. the conflict
  out.push({ id: 'signal', chapter: CH.conflict, title: 'Three symbols and what the signal says', layout: 'side', dur: 7,
    text: 'A transmitter sends three symbols, each a 0 or a 1. ' +
      at(0.22, 'The receiver keeps a symbol estimate b<sub>i</sub> for each one, a number between 0 and 1. An estimate of 0 or 1 is a confident decision, and a value in between is uncertainty. ') +
      at(0.52, 'On its own, the received signal prefers the values ' + cv + ' = (0.1, 0.6, 0.9). Rounding them at one half gives the word 0 1 1. ') +
      at(0.8, 'SAPPHIRE, the name this project gives its receiver, decodes thousands of such symbols in every frame. Three are enough to show how it works.'),
    math: '0 ≤ b<sub>i</sub> ≤ 1:  0 and 1 confident, values between uncertain' + at(0.52, '<br>the signal prefers ' + cv + ' = (0.1, 0.6, 0.9)<br>rounded at ½: 0 1 1'),
    draw: function (g, q) {
      var RR = P.two(g.sideR, 0.55), G = P.graph(g, RR[0], { title: 'three symbol estimates', ys: 0.42, checkP: 0, edgeP: 0, symP: function (i) { return seg(q, 0.05 + 0.08 * i, 0.2 + 0.08 * i); }, vals: seg(q, 0.5, 0.6) > 0 ? vals(c, 1) : null, valP: seg(q, 0.5, 0.62) });
      G.S.forEach(function (s, i) { rich(g, s[0], s[1] + G.r + 22, '→ ' + T.hard(c)[i], { size: 14, align: 'center', col: COL.signal, p: seg(q, 0.62 + 0.05 * i, 0.72 + 0.05 * i), mono: true }); });
      P.numberLines(g, RR[1], [0, 1, 2].map(function (i) { return { name: 'b_' + (i + 1), marks: [{ v: c[i], col: COL.signal, text: 'c_' + (i + 1) + ' = ' + num(c[i], 1), p: seg(q, 0.52 + 0.06 * i, 0.62 + 0.06 * i) }] }; }), q, 'from a confident 0 to a confident 1');
    } });

  out.push({ id: 'checks', chapter: CH.conflict, title: 'Two parity checks', layout: 'side', dur: 7,
    text: 'The code adds two parity checks. Check A watches symbols 1 and 2 and passes when the pair holds an even number of ones, so its passing pairs are 00 and 11. ' +
      at(0.3, 'Check A therefore asks for b<sub>1</sub> = b<sub>2</sub>, and check B, which watches symbols 2 and 3, asks for b<sub>2</sub> = b<sub>3</sub>. ') +
      at(0.5, 'On the Tanner graph each check is a square, joined by an edge to every symbol it watches. Each row of the parity-check matrix ' + Hm + ' marks the symbols of one check. ') +
      at(0.78, 'The rounded word 0 1 1 passes check B and fails check A.'),
    math: 'A: b<sub>1</sub> = b<sub>2</sub>,  B: b<sub>2</sub> = b<sub>3</sub>' + at(0.5, '<br>' + Hm + ' = [1 1 0; 0 1 1]') + at(0.78, '<br>' + Hm + '·(0, 1, 1) = (1, 0) mod 2 → check A fails'),
    draw: function (g, q) {
      var RR = P.two(g.sideR, 0.58), w = T.hard(c), st = { word: w };
      P.graph(g, RR[0], { title: 'the Tanner graph', vals: w.map(String), checkP: function (a) { return seg(q, 0.12 + 0.12 * a, 0.3 + 0.12 * a); }, edgeP: function (e) { return seg(q, 0.3 + 0.05 * e, 0.5 + 0.05 * e); }, status: status(st), statusP: seg(q, 0.78, 0.9) });
      var S = RR[1]; g.panel(S, 'one row of H per check'); var x = S[0] + 16, y = S[1] + 52;
      var wM = P.matrix(g, x, y, '*H', [['1', '1', '0'], ['0', '1', '1']], { lit: function (i) { return seg(q, 0.5 + 0.1 * i, 0.6 + 0.1 * i); } });
      rich(g, x + wM + 10, y + 12, 'A', { size: 13, col: C.gold, p: seg(q, 0.5, 0.6) }); rich(g, x + wM + 10, y + 35, 'B', { size: 13, col: C.gold, p: seg(q, 0.6, 0.7) });
      var y2 = y + 86; rich(g, x, y2, 'rounded word 0 1 1:', { size: 13, p: seg(q, 0.72, 0.8) });
      rich(g, x, y2 + 26, 'A: 0 + 1 = 1 (mod 2) → fails', { size: 13, mono: true, col: COL.fail, p: seg(q, 0.78, 0.86) });
      rich(g, x, y2 + 50, 'B: 1 + 1 = 0 (mod 2) → passes', { size: 13, mono: true, col: COL.pass, p: seg(q, 0.82, 0.9) });
    } });

  var askA = T.project(T.select(0, c)), askB = T.project(T.select(1, c));
  out.push({ id: 'conflict', chapter: CH.conflict, title: 'Two checks pull on one symbol', layout: 'side', dur: 7,
    text: 'Each check alone has an easy repair. It moves its pair to the nearest equal pair, which replaces both numbers by their average. ' +
      at(0.3, 'Check A turns (0.1, 0.6) into ' + v2(askA) + ', and check B turns (0.6, 0.9) into ' + v2(askB) + '. ') +
      at(0.6, 'Symbol 2 belongs to both checks and now receives two requests, ' + f2(askA[1]) + ' from A and ' + f2(askB[0]) + ' from B. ') +
      at(0.8, 'Writing either answer into b<sub>2</sub> undoes the repair of the other check, so one shared estimate cannot carry both requests.'),
    math: 'A: (0.10, 0.60) → ' + v2(askA) + at(0.45, '<br>B: (0.60, 0.90) → ' + v2(askB)) + at(0.6, '<br>b<sub>2</sub>: ' + f2(askA[1]) + ' or ' + f2(askB[0]) + '?'),
    draw: function (g, q) {
      var G = P.graph(g, g.sideR, { title: 'each check asks for its own repair', vals: vals(c), hi: 1, hiP: seg(q, 0.6, 0.7),
        arrows: [{ e: 0, text: f2(askA[0]), col: COL.z, p: seg(q, 0.3, 0.45), side: -1 }, { e: 1, text: f2(askA[1]), col: COL.z, p: seg(q, 0.3, 0.45), side: -1 },
                 { e: 2, text: f2(askB[0]), col: COL.z, p: seg(q, 0.45, 0.6), side: 1 }, { e: 3, text: f2(askB[1]), col: COL.z, p: seg(q, 0.45, 0.6), side: 1 }] });
      var s2 = G.S[1]; rich(g, s2[0], s2[1] - G.r - 44, f2(askA[1]) + ' or ' + f2(askB[0]) + '?', { size: 14, align: 'center', col: C.gold, p: seg(q, 0.62, 0.75), box: true, weight: '700' });
    } });

  // ------------------------------------------------------------ 2. copies
  out.push({ id: 'jobs', chapter: CH.copies, title: 'Two jobs, two kinds of copy', layout: 'side', dur: 7,
    text: 'The task mixes two jobs. The signal wants the estimates close to ' + cv + ', and the checks want equal neighbours. Each job is easy alone; the difficulty is doing both at once. ' +
      at(0.38, 'The alternating direction method of multipliers (ADMM) attaches the signal cost f(' + b + ') to the shared estimates ' + b + '. ') +
      at(0.58, 'Each check receives its own temporary copy of the symbols it watches, and that copy carries its parity rule. ') +
      at(0.78, 'A penalty couples their updates. The shared update therefore feels both the signal cost and the current requests from the checks. At agreement, one answer remains.'),
    math: b + ': carries the signal cost f(' + b + ')' + at(0.58, '<br>the checks’ copies: carry their parity rules') + at(0.78, '<br>the penalty couples their updates → one agreed answer'),
    draw: function (g, q) {
      var Rr = g.sideR, wideNow = P.wide(Rr), w = wideNow ? Math.min(250, Rr[2] * 0.34) : Rr[2] - 40, h = 92, xA, yA, xB, yB;
      g.panel(Rr, 'one word, two temporary copies');
      if (wideNow) { xA = Rr[0] + Rr[2] * 0.08; xB = Rr[0] + Rr[2] * 0.92 - w; yA = yB = Rr[1] + Rr[3] * 0.42; }
      else { xA = xB = Rr[0] + 20; yA = Rr[1] + Rr[3] * 0.2; yB = Rr[1] + Rr[3] * 0.62; }
      P.box(g, xA, yA, w, h, 'the shared estimates *b', 'carry the signal cost f(*b)', COL.b, seg(q, 0.38, 0.5));
      P.box(g, xB, yB, w, h, 'the checks’ copies', 'carry each parity rule', COL.z, seg(q, 0.58, 0.7));
      rich(g, xA + w / 2, yA - 18, '↓ the signal *c = (0.1, 0.6, 0.9)', { size: 12.5, align: 'center', col: COL.signal, p: seg(q, 0.42, 0.55) });
      rich(g, xB + w / 2, yB - 18, '↓ checks A and B', { size: 12.5, align: 'center', col: COL.z, p: seg(q, 0.6, 0.72) });
      var p8 = seg(q, 0.78, 0.92); if (p8 > 0) {
        var a0 = wideNow ? [xA + w, yA + h / 2] : [xA + w * 0.88, yA + h], a1 = wideNow ? [xB, yB + h / 2] : [xB + w * 0.88, yB], cx = g.ctx;
        cx.strokeStyle = COL.u; cx.lineWidth = 2; cx.globalAlpha = p8; cx.beginPath(); var n = 10; for (var k = 0; k <= 2 * n; k++) { var t = k / (2 * n), x = mix(a0[0], a1[0], t), y = mix(a0[1], a1[1], t), s = (k % 2 ? 1 : -1) * (k && k < 2 * n ? 6 : 0); if (wideNow) y += s; else x += s; if (k) cx.lineTo(x, y); else cx.moveTo(x, y); } cx.stroke(); cx.globalAlpha = 1;
        var mx = (a0[0] + a1[0]) / 2 + (wideNow ? 0 : -16), my = (a0[1] + a1[1]) / 2;
        rich(g, mx, wideNow ? my - 34 : my - 8, 'a penalty ρ', { size: 12, col: COL.u, align: wideNow ? 'center' : 'right', p: p8 });
        rich(g, mx, wideNow ? my - 18 : my + 8, 'pulls them together', { size: 12, col: COL.u, align: wideNow ? 'center' : 'right', p: p8 });
      }
      rich(g, xA + w / 2, yA + h + 22, 'f(*b) = ½‖*b − *c‖² is smallest at *b = *c', { size: 12, align: 'center', col: COL.signal, p: seg(q, 0.45, 0.58) });
      rich(g, xB + w / 2, yB + h + 22, 'each copy lies in its parity polytope', { size: 12, align: 'center', col: COL.z, p: seg(q, 0.62, 0.75) });
      rich(g, Rr[0] + Rr[2] / 2, Rr[1] + Rr[3] - 20, 'at the end the copies agree, and one answer remains', { size: 12.5, align: 'center', col: C.ink, p: seg(q, 0.86, 0.96) });
    } });

  out.push({ id: 'replicas', chapter: CH.copies, title: 'Every check keeps its own copy', layout: 'side', dur: 7.5,
    text: 'A single copy for both checks would bring the conflict back, because symbol 2 would again need one value that suits A and B together. ' +
      at(0.28, 'Each check therefore keeps its own copy of just the symbols it watches. These copies are the replica variables. ') +
      at(0.48, zA + ' = (' + ze('A', 1) + ', ' + ze('A', 2) + ') is check A’s copy of (b<sub>1</sub>, b<sub>2</sub>), and ' + zB + ' = (' + ze('B', 2) + ', ' + ze('B', 3) + ') is check B’s copy of (b<sub>2</sub>, b<sub>3</sub>). ') +
      at(0.75, 'Symbol 2 keeps one shared estimate b<sub>2</sub> and appears in two replicas, ' + ze('A', 2) + ' and ' + ze('B', 2) + '. Each check can repair its own copy without waiting for the other, so the two copies may disagree while the run is under way.'),
    math: zA + ' ≈ (b<sub>1</sub>, b<sub>2</sub>),  ' + zB + ' ≈ (b<sub>2</sub>, b<sub>3</sub>)' + at(0.75, '<br>two copies of b<sub>2</sub>: ' + ze('A', 2) + ' = ' + f2(askA[1]) + ',  ' + ze('B', 2) + ' = ' + f2(askB[0])),
    draw: function (g, q) {
      var st = { z: [askA, askB], u: [[0, 0], [0, 0]] };
      P.graph(g, g.sideR, { title: 'a replica on every edge', vals: vals(c), hi: 1, hiP: seg(q, 0.75, 0.85), checkNote: ['*z_A ∈ 𝒫_A', '*z_B ∈ 𝒫_B'], checkNoteP: seg(q, 0.55, 0.7),
        boxes: boxesOf(st, { p: function (e) { return seg(q, 0.3 + 0.08 * e, 0.42 + 0.08 * e); }, hi: q > 0.75 ? [1, 2] : [] }) });
    } });

  out.push({ id: 'select', chapter: CH.copies, title: 'Picking out the symbols of a check', layout: 'side', dur: 7,
    text: 'A selection matrix picks out the symbols of one check and keeps them as a vector. ' +
      at(0.2, SA + ' keeps symbols 1 and 2, so ' + SA + b + ' = (b<sub>1</sub>, b<sub>2</sub>). ' + SB + ' keeps symbols 2 and 3, so ' + SB + b + ' = (b<sub>2</sub>, b<sub>3</sub>). ') +
      at(0.55, 'A row of ' + Hm + ' does a different job. It adds the symbols of its check modulo 2 to express the parity check, and the result is a single number, 0 when the check passes. ') +
      at(0.82, 'Each replica should match its check’s view of the shared estimates, ' + za + ' = ' + Sa + b + '.'),
    math: SA + ' = [1 0 0; 0 1 0],  ' + SA + b + ' = (b<sub>1</sub>, b<sub>2</sub>)<br>' + SB + ' = [0 1 0; 0 0 1],  ' + SB + b + ' = (b<sub>2</sub>, b<sub>3</sub>)' + at(0.55, '<br>row A of ' + Hm + ': b<sub>1</sub> + b<sub>2</sub> mod 2'),
    draw: function (g, q) {
      var Rr = g.sideR; g.panel(Rr, 'select and keep, or add and test'); var small = Rr[2] < 560, sz = small ? 12 : 13.5, x = Rr[0] + 16, y = Rr[1] + 50, gapY = small ? 78 : 92;
      [0, 1].forEach(function (a) {
        var p = seg(q, 0.2 + 0.18 * a, 0.36 + 0.18 * a); if (!(p > 0)) return; var yy = y + gapY * a, Sm = d.S[a].map(function (row) { return row.map(String); });
        var w1 = P.matrix(g, x, yy, '*S_' + ['A', 'B'][a], Sm, { size: sz, lit: function () { return p; }, colOf: function (i, j) { return d.S[a][i][j] ? C.gold : C.ink; } });
        var w2 = g.matrix(x + w1 + 8, yy - (sz + 10) * 0.5, [['b₁'], ['b₂'], ['b₃']], function (i) { return T.CHECKS[a].of.indexOf(i) >= 0 ? p : 0.35 * p; }, { size: sz });
        var sel = T.CHECKS[a].of.map(function (i) { return ['b' + '₁₂₃'.charAt(i)]; });
        rich(g, x + w1 + w2 + 18, yy + (sz + 10), '=', { size: 15, p: p });
        g.matrix(x + w1 + w2 + 34, yy, sel, function () { return p; }, { size: sz, colOf: function () { return C.gold; } });
      });
      var yH = y + 2 * gapY + 18, pH = seg(q, 0.55, 0.7);
      rich(g, x, yH, 'row A of *H:  1·b₁ + 1·b₂ + 0·b₃  (mod 2)', { size: sz, p: pH, mono: true });
      rich(g, x, yH + 26, '→ one number: 0 when A passes', { size: sz, p: seg(q, 0.62, 0.75), col: COL.pass });
      rich(g, x, yH + 56, '*z_a should equal *S_a*b', { size: sz + 1, p: seg(q, 0.82, 0.92), col: COL.z, weight: '700' });
    } });

  out.push({ id: 'polytope', chapter: CH.copies, title: 'What the projection of a check does', layout: 'side', dur: 9,
    text: 'The pairs of check A live in a unit square, with b<sub>1</sub> across and b<sub>2</sub> up. Its hard patterns 00 and 11 are two corners. ' +
      at(0.22, 'The parity polytope ' + PA + ' is the segment between them, every pair (t, t) with 0 ≤ t ≤ 1. A point such as (0.35, 0.35) is a legal point of this relaxation; it is not a hard decision. ') +
      at(0.5, 'The projection finds the nearest legal point. From (0.1, 0.6) it drops straight onto the diagonal at ' + v2(askA) + ', and from (0.6, 0.9) check B drops to ' + v2(askB) + '. ') +
      at(0.82, 'The whole pair moves together. Clipping each value to [0, 1] separately would leave (0.1, 0.6) where it is, and that pair is not legal.'),
    math: PA + ' = {(t, t) : 0 ≤ t ≤ 1}' + at(0.5, '<br>Π<sub>' + PA + '</sub>(q) = (t, t),  t = clip((q<sub>1</sub> + q<sub>2</sub>)/2, 0, 1)<br>Π<sub>' + PA + '</sub>(0.1, 0.6) = ' + v2(askA)),
    draw: function (g, q) {
      var RR = P.sideBySide(g.sideR);
      P.square(g, RR[0], { title: 'check A', x: 'b_1', y: 'b_2', name: '𝒫_A', q: [c[0], c[1]], qText: '(0.10, 0.60)', z: askA, zText: v2(askA), boxP: seg(q, 0, 0.18), segP: seg(q, 0.22, 0.4), qP: seg(q, 0.5, 0.58), footP: seg(q, 0.58, 0.74), clipP: seg(q, 0.84, 0.95) });
      P.square(g, RR[1], { title: 'check B', x: 'b_2', y: 'b_3', name: '𝒫_B', q: [c[1], c[2]], qText: '(0.60, 0.90)', z: askB, zText: v2(askB), boxP: seg(q, 0.05, 0.22), segP: seg(q, 0.26, 0.44), qP: seg(q, 0.62, 0.68), footP: seg(q, 0.68, 0.8) });
    } });

  out.push({ id: 'problem', chapter: CH.copies, title: 'The problem, written once', layout: 'side', dur: 8,
    text: 'The whole task can now be written as one problem. The cost of the signal is f(' + b + ') = ½‖' + b + ' − ' + cv + '‖², which is zero only at ' + b + ' = ' + cv + '. ' +
      at(0.3, 'Each replica must lie in the parity polytope of its check. An indicator function I<sub>' + Pa + '</sub>, which is 0 inside ' + Pa + ' and infinite outside, expresses this. ') +
      at(0.58, 'Each replica must also equal its check’s view of the shared estimates, and every estimate stays between 0 and 1. ') +
      at(0.8, 'This problem stays fixed for the whole run. What changes from round to round is a temporary objective built from it.'),
    math: 'min<sub>' + b + ', ' + za + '</sub>  f(' + b + ') + Σ<sub>a</sub> I<sub>' + Pa + '</sub>(' + za + ')' + at(0.58, '<br>subject to ' + Sa + b + ' = ' + za + ' for every check a,  0 ≤ b<sub>i</sub> ≤ 1'),
    draw: function (g, q) {
      var RR = P.two(g.sideR, 0.56);
      P.graph(g, RR[0], { title: 'where each term lives', sig: ['c_1 = 0.1', 'c_2 = 0.6', 'c_3 = 0.9'], sigP: seg(q, 0.05, 0.25), vals: ['b₁', 'b₂', 'b₃'], names: ['', '', ''], checkNote: ['I_{𝒫A}(*z_A)', 'I_{𝒫B}(*z_B)'], checkNoteP: seg(q, 0.3, 0.45),
        boxes: T.EDGES.map(function (E, e) { return { rows: [['', '=', C.ink]], p: seg(q, 0.58 + 0.05 * e, 0.68 + 0.05 * e), short: true }; }) });
      P.lines(g, RR[1], [{ text: 'f(*b) = ½‖*b − *c‖²', col: COL.signal, p: seg(q, 0.05, 0.2) }, { text: '   the signal’s cost', col: C.ink, p: seg(q, 0.1, 0.25) },
        { text: 'I_{𝒫a}(*z_a)', col: COL.z, p: seg(q, 0.3, 0.45) }, { text: '   0 if legal, ∞ if not', col: C.ink, p: seg(q, 0.35, 0.5) },
        { text: '*S_a*b = *z_a', col: COL.b, p: seg(q, 0.58, 0.7) }, { text: '   every copy agrees', col: C.ink, p: seg(q, 0.62, 0.75) },
        { text: '0 ≤ b_i ≤ 1', col: C.dim, p: seg(q, 0.66, 0.78) }], q, 'the fixed problem');
    } });

  // ------------------------------------------------------------ 3. memory
  out.push({ id: 'no-ledger-arithmetic', chapter: CH.memory, title: 'Where those numbers come from', layout: 'side', dur: 10,
    text: 'The fixed problem remains the target. First make a deliberate counterfactual: hold every ledger at zero in every round. This is not ADMM; it isolates what the ledger contributes. ' +
      at(0.24, 'Use ρ = 1 and start from ' + sup(b, 0) + ' = ' + cv + ' = (0.1, 0.6, 0.9), with every replica copying its symbols. The first shared update leaves ' + sup(b, 1) + ' = ' + cv + '. ') +
      at(0.45, 'The checks project those pairs, giving ' + sup(zA, 1) + ' = (0.35, 0.35) and ' + sup(zB, 1) + ' = (0.75, 0.75). ') +
      at(0.64, 'The next shared update averages each c<sub>i</sub> with the replica coordinates attached to that symbol. It gives ' + sup(b, 2) + ' = (0.225, 0.567, 0.825). ') +
      at(0.86, 'Project again and repeat. By round 12, ' + b + ' = ' + v3(L12.b) + ', ' + zA + ' = ' + v3(L12.z[0]) + ' and ' + zB + ' = ' + v3(L12.z[1]) + '. The next page rounds them to two decimals.'),
    math: 'counterfactual: ' + sup(ua, 'k') + ' = 0 for every check a and round k' +
      at(0.24, '<br>b<sub>i</sub><sup>k+1</sup> = (c<sub>i</sub> + Σ<sub>a∋i</sub> z<sub>a,i</sub><sup>k</sup>) / (1 + d<sub>i</sub>)') +
      at(0.45, '<br>' + sup(za, 'k+1') + ' = Π<sub>' + Pa + '</sub>(' + Sa + sup(b, 'k+1') + ')') +
      at(0.64, '<br>' + sup(bi(1), 2) + ' = (0.1 + 0.35)/2 = ' + f3(L2.b[0]) + ',  ' + sup(bi(2), 2) + ' = (0.6 + 0.35 + 0.75)/3 = ' + f3(L2.b[1]) + ',  ' + sup(bi(3), 2) + ' = (0.9 + 0.75)/2 = ' + f3(L2.b[2])),
    draw: function (g, q) {
      var RR = P.two(g.sideR, 0.53);
      P.numberLines(g, RR[0], [
        { name: 'b_1', marks: [{ v: c[0], col: COL.signal, text: 'c₁ 0.10', p: seg(q, 0.18, 0.3) }, { v: L1.z[0][0], col: COL.z, text: 'A 0.35', p: seg(q, 0.36, 0.48) }, { v: L2.b[0], col: COL.b, big: true, below: false, text: 'b₁² 0.225', p: seg(q, 0.58, 0.7) }] },
        { name: 'b_2', marks: [{ v: c[1], col: COL.signal, text: 'c₂ 0.60', p: seg(q, 0.18, 0.3) }, { v: L1.z[0][1], col: COL.z, text: 'A 0.35', p: seg(q, 0.36, 0.48) }, { v: L1.z[1][0], col: COL.z, text: 'B 0.75', p: seg(q, 0.42, 0.54) }, { v: L2.b[1], col: COL.b, big: true, below: false, text: 'b₂² 0.567', p: seg(q, 0.58, 0.7) }] },
        { name: 'b_3', marks: [{ v: c[2], col: COL.signal, text: 'c₃ 0.90', p: seg(q, 0.18, 0.3) }, { v: L1.z[1][1], col: COL.z, text: 'B 0.75', p: seg(q, 0.42, 0.54) }, { v: L2.b[2], col: COL.b, big: true, below: false, text: 'b₃² 0.825', p: seg(q, 0.58, 0.7) }] }
      ], q, 'round 2: average the signal and copies');
      P.table3(g, RR[1], [
        ['1', v3(L1.b), 'A ' + f3(L1.z[0][0]) + ' · B ' + f3(L1.z[1][0])],
        ['2', v3(L2.b), 'A ' + f3(L2.z[0][0]) + ' · B ' + f3(L2.z[1][0])],
        ['3', v3(L3.b), 'A ' + f3(L3.z[0][0]) + ' · B ' + f3(L3.z[1][0])],
        ['12', v3(L12.b), 'A ' + f3(L12.z[0][0]) + ' · B ' + f3(L12.z[1][0])]
      ], seg(q, 0.42, 0.92), 'repeat the same two updates', { head: ['round', '*b^k', 'equal value in each copy'], shares: [0.17, 0.55], size: 11.5, rowH: 50 });
    } });

  out.push({ id: 'no-ledger', chapter: CH.memory, title: 'Repeat the two updates: the gap remains', layout: 'side', dur: 8.5,
    text: 'The counterfactual now repeats those two updates through round 12. The graph reads ' + b + ' = ' + v2(L12.b) + ', ' + zA + ' = ' + v2(L12.z[0]) + ' and ' + zB + ' = ' + v2(L12.z[1]) + '. ' +
      at(0.32, 'Each replica is legal because both entries in its pair are equal. But the replicas do not equal the shared estimates: their gap is ' + f2(L12.gap) + '. The rounded word stays ' + word(L12.word) + ', and check A fails. ') +
      at(0.6, 'More rounds approach ' + b + ' = ' + v3(AL.b) + ', almost the same numbers. This is not a solution of the fixed problem. That problem forces b<sub>1</sub> = b<sub>2</sub> = b<sub>3</sub>, whose best common value is ' + f3(d.mean) + '. ') +
      at(0.84, 'The disagreements keep returning, but the zero-ledger run erases them. The next page returns to the first projection and keeps one, so it can change what happens next.'),
    math: 'round 12: ' + b + ' = ' + v2(L12.b) + ',  ' + zA + ' = ' + v2(L12.z[0]) + ',  ' + zB + ' = ' + v2(L12.z[1]) + at(0.32, '<br>legal copies, but ‖' + Sa + b + ' − ' + za + '‖ = ' + f2(L12.gap)) + at(0.6, '<br>fixed problem: ' + b + '<sup>★</sup> = (' + f3(d.mean) + ', ' + f3(d.mean) + ', ' + f3(d.mean) + '), gap = 0'),
    draw: function (g, q) {
      var RR = P.two(g.sideR, 0.52), k = Math.min(N, Math.floor(seg(q, 0.12, 0.6) * N)), st = L[Math.max(1, k)];
      P.graph(g, RR[0], { title: 'without a ledger, round ' + Math.max(1, k), vals: vals(st.b), status: status(st), statusP: seg(q, 0.58, 0.68), boxes: boxesOf(st, { short: true, p: 1 }) });
      P.trace(g, RR[1], { rounds: L, n: N, upto: seg(q, 0.12, 0.6), title: 'no ledger: the estimates stall' });
    } });

  out.push({ id: 'ledger', chapter: CH.memory, title: 'Keep the gap the failed run erased', layout: 'side', dur: 10,
    text: 'The previous page ended with a ' + f2(L12.gap) + ' gap. The no-ledger run computed signed differences, then erased them. Return to the first projection and keep check A’s difference. ' +
      at(0.25, 'Check A saw ' + SA + sup(b, 1) + ' = (0.10, 0.60), but its legal copy was ' + sup(zA, 1) + ' = (0.35, 0.35), so ' + sup(rA, 1) + ' = (−0.25, 0.25). Without memory, ' + uA + ' stays zero and A requests (0.35, 0.35) again. ') +
      at(0.55, 'ADMM writes the difference into the ledger: ' + sup(uA, 1) + ' = (−0.25, 0.25). The next shared update uses ' + zA + ' − ' + uA + ', changing A’s request to (0.60, 0.10). The negative entry raises the first request; the positive entry lowers the second. ') +
      at(0.82, 'Later differences are added to the same ' + uA + ' instead of resetting. In ADMM, ' + ua + ' is the scaled dual variable: running signed disagreement that changes the next request.'),
    math: sup(rA, 1) + ' = (0.10, 0.60) − (0.35, 0.35) = (−0.25, 0.25)' +
      at(0.42, '<br>no ledger: ' + sup(uA, 1) + ' = (0, 0)  →  next request = (0.35, 0.35)') +
      at(0.58, '<br>ADMM: ' + sup(uA, 1) + ' = ' + sup(rA, 1) + '  →  ' + sup(zA, 1) + ' − ' + sup(uA, 1) + ' = (0.60, 0.10)') +
      at(0.82, '<br>later: ' + sup(ua, 'k') + ' = ' + sup(ua, 'k−1') + ' + ' + sup(ra, 'k') + '  (one u<sub>a,i</sub> per edge)'),
    draw: function (g, q) {
      blockFlow(g, g.sideR, [
        ['shared pair', '*S_A*b^1 = (0.10, 0.60)', COL.b, 0.05],
        ['legal copy', '*z_A^1 = (0.35, 0.35)', COL.z, 0.22],
        ['signed difference', '*r_A^1 = (−0.25, 0.25)', COL.fail, 0.4],
        ['do not erase it', '*u_A^1 = *r_A^1', COL.u, 0.58],
        ['next request', '*z_A^1 − *u_A^1 = (0.60, 0.10)', COL.target, 0.76]
      ], q, 'the missing line between the two pages');
    } });

  out.push({ id: 'edges', chapter: CH.memory, title: 'What every edge carries', layout: 'side', dur: 8,
    text: 'The two A entries just stored stay on A’s two edges. Check B keeps its own two entries, so every check–symbol edge carries a replica coordinate and a scaled dual variable. ' +
      at(0.28, 'The edge A–b<sub>1</sub> holds ' + ze('A', 1) + ' and ' + ue('A', 1) + ', and the edge B–b<sub>3</sub> holds ' + ze('B', 3) + ' and ' + ue('B', 3) + '. ') +
      at(0.52, 'Symbol 2 is one shared estimate inside two independent edge states, (' + ze('A', 2) + ', ' + ue('A', 2) + ') and (' + ze('B', 2) + ', ' + ue('B', 2) + '). ') +
      at(0.76, 'Overlapping checks may request different corrections to the same shared estimate, and this is the main reason for the replicas. SAPPHIRE keeps exactly this state, one b<sub>i</sub> per symbol and one pair per edge.'),
    math: 'symbol node i: b<sub>i</sub>' + at(0.28, '<br>edge (a, i): ' + ze('a', 'i') + ', ' + ue('a', 'i')) + at(0.52, '<br>b<sub>2</sub>: (' + ze('A', 2) + ', ' + ue('A', 2) + ') and (' + ze('B', 2) + ', ' + ue('B', 2) + ')'),
    draw: function (g, q) {
      var RR = P.two(g.sideR, 0.56), hi = q > 0.52 ? [1, 2] : [];
      P.graph(g, RR[0], { title: 'the state of SAPPHIRE on the graph', vals: ['b₁', 'b₂', 'b₃'], names: ['', '', ''], hi: 1, hiP: seg(q, 0.52, 0.62), boxes: names({ u: true, hi: hi }) });
      P.table(g, RR[1], [['A–b_1', 'z_{A,1}, u_{A,1}'], ['A–b_2', 'z_{A,2}, u_{A,2}', q > 0.52 ? C.gold : null], ['B–b_2', 'z_{B,2}, u_{B,2}', q > 0.52 ? C.gold : null], ['B–b_3', 'z_{B,3}, u_{B,3}']], seg(q, 0.15, 0.5), 'edge state', { head: ['edge', 'state'], leftW: 110 });
    } });

  // ------------------------------------------------------------ 4. one round by hand
  var R0 = R[0];
  out.push({ id: 'start', chapter: CH.round, title: 'The start: every copy copies the signal', layout: 'side', dur: 7.5,
    text: 'Now replay that same first round slowly as full ADMM. The run starts from the signal, ' + sup(b, 0) + ' = ' + cv + ' = (0.1, 0.6, 0.9). Each replica starts as a plain copy of its symbols, ' + sup(zA, 0) + ' = (0.1, 0.6) and ' + sup(zB, 0) + ' = (0.6, 0.9), and both ledgers start at zero. ' +
      at(0.55, 'Round 1 opens with the shared update, and that update has nothing to settle. The signal and the replicas already agree, so ' + sup(b, 1) + ' = (0.1, 0.6, 0.9). ') +
      at(0.82, 'However, neither replica is legal yet, since neither pair is equal.'),
    math: sup(b, 0) + ' = (0.1, 0.6, 0.9)<br>' + sup(zA, 0) + ' = (0.1, 0.6),  ' + sup(zB, 0) + ' = (0.6, 0.9),  ' + sup(uA, 0) + ' = ' + sup(uB, 0) + ' = (0, 0)' + at(0.55, '<br>' + sup(b, 1) + ' = ' + sup(b, 0)),
    draw: function (g, q) {
      P.graph(g, g.sideR, { title: 'round 0: the start', vals: vals(R0.b), checkNote: ['copy not legal', 'copy not legal'], checkNoteCol: COL.fail, checkNoteP: seg(q, 0.82, 0.92),
        boxes: boxesOf(R0, { u: true, p: function (e) { return seg(q, 0.15 + 0.06 * e, 0.3 + 0.06 * e); }, uP: seg(q, 0.35, 0.5) }) });
    } });

  out.push({ id: 'project', chapter: CH.round, title: 'Round 1: each check makes its copy legal', layout: 'side', dur: 8,
    text: 'Each check projects its view of the shared estimates, plus its ledger, onto its parity polytope. ' +
      at(0.25, 'Check A projects ' + SA + sup(b, 1) + ' + ' + sup(uA, 0) + ' = (0.1, 0.6) and gets ' + sup(zA, 1) + ' = ' + v2(R1.z[0]) + '. Check B projects (0.6, 0.9) and gets ' + sup(zB, 1) + ' = ' + v2(R1.z[1]) + '. ') +
      at(0.72, 'Both copies are legal now, and both disagree with ' + b + '. The two copies of symbol 2 hold ' + f2(R1.z[0][1]) + ' and ' + f2(R1.z[1][0]) + '.'),
    math: za + ' ← Π<sub>' + Pa + '</sub>(' + Sa + b + ' + ' + ua + ')' + at(0.25, '<br>' + sup(zA, 1) + ' = Π(0.10, 0.60) = ' + v2(R1.z[0])) + at(0.45, '<br>' + sup(zB, 1) + ' = Π(0.60, 0.90) = ' + v2(R1.z[1])),
    draw: function (g, q) {
      var RR = P.two(g.sideR, 0.56), pA = seg(q, 0.25, 0.42), pB = seg(q, 0.45, 0.62);
      var st = { z: [pA >= 1 ? R1.z[0] : R0.z[0], pB >= 1 ? R1.z[1] : R0.z[1]], u: R0.u };
      P.graph(g, RR[0], { title: 'round 1: projection', vals: vals(R1.b), status: [pA >= 1 ? 'pass' : null, pB >= 1 ? 'pass' : null], checkNote: [pA >= 1 ? 'copy legal' : '', pB >= 1 ? 'copy legal' : ''], checkNoteCol: COL.pass,
        hi: 1, hiP: seg(q, 0.72, 0.82), boxes: boxesOf(st, { short: true, hi: q > 0.72 ? [1, 2] : [] }) });
      var SS = P.sideBySide(RR[1]);
      P.square(g, SS[0], { title: 'check A', x: 'b_1', y: 'b_2', name: '𝒫_A', q: R1.q[0], z: R1.z[0], zText: v2(R1.z[0]), qP: seg(q, 0.2, 0.28), footP: pA });
      P.square(g, SS[1], { title: 'check B', x: 'b_2', y: 'b_3', name: '𝒫_B', q: R1.q[1], z: R1.z[1], zText: v2(R1.z[1]), qP: seg(q, 0.4, 0.46), footP: pB });
    } });

  out.push({ id: 'record', chapter: CH.round, title: 'Round 1: each check records the disagreement', layout: 'side', dur: 8,
    text: 'Each check now adds its disagreement to its ledger. ' +
      at(0.22, 'Check A records ' + SA + sup(b, 1) + ' − ' + sup(zA, 1) + ' = (0.1 − 0.35, 0.6 − 0.35) = ' + v2(R1.u[0]) + '. Symbol 1 sat below the copy of A, and symbol 2 sat above it. ') +
      at(0.55, 'Check B records (0.6 − 0.75, 0.9 − 0.75) = ' + v2(R1.u[1]) + '. ') +
      at(0.76, 'On edge A the ledger entry of symbol 2 is positive, so it will pull b<sub>2</sub> down. On edge B it is negative and will pull b<sub>2</sub> up.'),
    math: ua + ' ← ' + ua + ' + ' + Sa + b + ' − ' + za + at(0.22, '<br>' + sup(uA, 1) + ' = ' + v2(R1.u[0])) + at(0.55, '<br>' + sup(uB, 1) + ' = ' + v2(R1.u[1])),
    draw: function (g, q) {
      var uA1 = seg(q, 0.22, 0.4), uB1 = seg(q, 0.55, 0.7);
      var G = P.graph(g, g.sideR, { title: 'round 1: the ledgers', vals: vals(R1.b), ys: g.sideR[2] < 520 ? 0.3 : 0.24, hi: 1, hiP: seg(q, 0.76, 0.86),
        boxes: T.EDGES.map(function (E, e) { var nm = EDGE_NAMES[e], up = E[0] ? uB1 : uA1; return { rows: [['z_{' + nm[0] + ',' + nm[1] + '}', f2(R1.z[E[0]][E[2]]), COL.z], ['u_{' + nm[0] + ',' + nm[1] + '}', f2(R1.u[E[0]][E[2]]), COL.u, up]], p: 1, hi: q > 0.76 && (e === 1 || e === 2) }; }),
      });
      var s2 = G.S[1];
      if (G.compact) { rich(g, s2[0], s2[1] - G.r - 60, '↓ A pulls b₂ down', { size: 12, align: 'center', col: COL.target, p: seg(q, 0.8, 0.9), box: true }); rich(g, s2[0], s2[1] - G.r - 38, 'B pulls b₂ up ↑', { size: 12, align: 'center', col: COL.target, p: seg(q, 0.84, 0.94), box: true }); }
      else { rich(g, s2[0] - G.r - 16, s2[1] + 4, '↓ A pulls b₂ down', { size: 12.5, align: 'right', col: COL.target, p: seg(q, 0.8, 0.9), box: true }); rich(g, s2[0] + G.r + 16, s2[1] + 4, 'B pulls b₂ up ↑', { size: 12.5, col: COL.target, p: seg(q, 0.84, 0.94), box: true }); }
    } });

  out.push({ id: 'targets', chapter: CH.round, title: 'Round 2: the corrected target of each check', layout: 'side', dur: 8,
    text: 'The next shared update asks ' + Sa + b + ' to sit near ' + za + ' − ' + ua + ', the corrected target of check a, because ‖' + Sa + b + ' − ' + za + ' + ' + ua + '‖² = ‖' + Sa + b + ' − (' + za + ' − ' + ua + ')‖². ' +
      at(0.38, 'Check A asks for (0.35 + 0.25, 0.35 − 0.25) = ' + v2(R2.targets[0]) + '. It aims past its own copy, upward for symbol 1 and downward for symbol 2. ') +
      at(0.7, 'Check B asks for (0.75 + 0.15, 0.75 − 0.15) = ' + v2(R2.targets[1]) + '.'),
    math: 'the target of check a: ' + za + ' − ' + ua + at(0.38, '<br>A: ' + v2(R1.z[0]) + ' − ' + v2(R1.u[0]) + ' = ' + v2(R2.targets[0])) + at(0.7, '<br>B: ' + v2(R1.z[1]) + ' − ' + v2(R1.u[1]) + ' = ' + v2(R2.targets[1])),
    draw: function (g, q) {
      var RR = P.two(g.sideR, 0.55), t = R2.targets, pa = seg(q, 0.38, 0.55), pb = seg(q, 0.7, 0.86);
      P.graph(g, RR[0], { title: 'round 2: what each check asks for', vals: vals(R1.b),
        arrows: [{ e: 0, text: f2(t[0][0]), col: COL.target, p: pa, side: -1 }, { e: 1, text: f2(t[0][1]), col: COL.target, p: pa, side: -1 }, { e: 2, text: f2(t[1][0]), col: COL.target, p: pb, side: 1 }, { e: 3, text: f2(t[1][1]), col: COL.target, p: pb, side: 1 }] });
      P.numberLines(g, RR[1], [
        { name: 'b_1', marks: [{ v: R1.z[0][0], col: COL.z, text: 'copy', p: seg(q, 0.3, 0.38) }, { v: t[0][0], col: COL.target, text: 'A asks', p: pa }], arrows: [{ from: R1.z[0][0], to: t[0][0], col: COL.target, p: pa }] },
        { name: 'b_2', marks: [{ v: R1.z[0][1], col: COL.z, text: 'A', p: seg(q, 0.3, 0.38) }, { v: R1.z[1][0], col: COL.z, text: 'B', p: seg(q, 0.62, 0.7) }, { v: t[0][1], col: COL.target, text: 'A asks', p: pa }, { v: t[1][0], col: COL.target, text: 'B asks', p: pb }],
          arrows: [{ from: R1.z[0][1], to: t[0][1], col: COL.target, p: pa }, { from: R1.z[1][0], to: t[1][0], col: COL.target, p: pb }] },
        { name: 'b_3', marks: [{ v: R1.z[1][1], col: COL.z, text: 'copy', p: seg(q, 0.62, 0.7) }, { v: t[1][1], col: COL.target, text: 'B asks', p: pb }], arrows: [{ from: R1.z[1][1], to: t[1][1], col: COL.target, p: pb }] }], q, 'each target aims past its copy');
    } });

  var sharedCalcs = [
    { i: 0, start: 0.06, end: 0.25, edges: [0], checks: ['A'], signal: c[0], targets: [R2.targets[0][0]], result: R2.b[0], den: 2 },
    { i: 1, start: 0.25, end: 0.49, edges: [1, 2], checks: ['A', 'B'], signal: c[1], targets: [R2.targets[0][1], R2.targets[1][0]], result: R2.b[1], den: 3 },
    { i: 2, start: 0.49, end: 0.68, edges: [3], checks: ['B'], signal: c[2], targets: [R2.targets[1][1]], result: R2.b[2], den: 2 }
  ];
  function sharedCalcAt(q) { return q < 0.06 ? null : q < 0.25 ? sharedCalcs[0] : q < 0.49 ? sharedCalcs[1] : q < 0.68 ? sharedCalcs[2] : sharedCalcs[1]; }
  function sharedCalcLines(calc) {
    var i = calc.i + 1, sum = calc.signal + calc.targets.reduce(function (s, v) { return s + v; }, 0);
    var targetText = calc.checks.map(function (a, j) { return a + ' = ' + f2(calc.targets[j]); }).join(',  ');
    var terms = [f2(calc.signal)].concat(calc.targets.map(f2)).join(' + ');
    return [
      { text: 'signal c_' + i + ' = ' + f2(calc.signal), col: COL.signal },
      { text: 'corrected target' + (calc.targets.length > 1 ? 's: ' : ': ') + targetText, col: COL.target },
      { text: 'b_' + i + '^2 = (' + terms + ') / (1 + ' + (calc.den - 1) + ')', col: COL.b },
      { text: '= ' + f2(sum) + ' / ' + calc.den + ' = ' + (i === 2 ? f3(calc.result) : f2(calc.result)), col: C.gold, weight: '700' }
    ];
  }
  function sharedRuleLines() {
    return [
      { text: 'ρ = 1: every incoming value has equal weight', col: C.ink },
      { text: 'top: c_i + Σ_{a∋i}(z_{a,i}^1 − u_{a,i}^1)', col: COL.target },
      { text: 'bottom: 1 signal value + d_i check requests', col: COL.b },
      { text: 'b_i^2 = clip_[0,1](top / bottom)', col: C.gold, weight: '700' }
    ];
  }
  function sharedProofLines(q) {
    if (q < 0.79) return { title: 'symbol 2: the three quadratic terms', start: 0.68, end: 0.79, lines: [
      { text: 'φ_2(t) = ½(t − 0.60)^2', col: COL.signal },
      { text: '          + ½(t − 0.10)^2', col: COL.target },
      { text: '          + ½(t − 0.90)^2', col: COL.target }
    ] };
    if (q < 0.90) return { title: 'at the old value b₂¹ = 0.600', start: 0.79, end: 0.90, lines: [
      { text: 'slope: signal 0 + A 0.500 + B (−0.300)', col: COL.signal },
      { text: 'total slope = 0.200', col: C.gold, weight: '700' },
      { text: 'each ½(t − centre)^2 term adds curvature 1', col: COL.target },
      { text: 'total curvature = 1 + 1 + 1 = 3', col: C.gold, weight: '700' },
    ] };
    return { title: 'the same answer as the average', start: 0.90, end: 1.01, lines: [
      { text: 'old value − slope / curvature', col: C.ink },
      { text: '0.600 − 0.200 / 3', col: COL.signal },
      { text: '= 0.533', col: C.gold, weight: '700' },
      { text: 'already inside [0,1], so clipping does nothing', col: COL.b }
    ] };
  }
  function drawSharedCalculation(g, Rr, q, calc) {
    var lineH = Math.round(Rr[3] * 0.41), gap = 8;
    var NR = [Rr[0], Rr[1], Rr[2], lineH], ER = [Rr[0], Rr[1] + lineH + gap, Rr[2], Rr[3] - lineH - gap];
    var local = calc ? clamp((q - calc.start) / (calc.end - calc.start), 0, 1) : clamp(q / 0.06, 0, 1), proofMode = q >= 0.68;
    var marks = calc ? [{ v: calc.signal, col: COL.signal, text: proofMode ? 'old b_2^1 ' + f2(calc.signal) : 'c_' + (calc.i + 1) + ' ' + f2(calc.signal), p: seg(local, 0.02, 0.18) }].concat(calc.targets.map(function (v, j) {
      return { v: v, col: COL.target, text: calc.checks[j] + ' ' + f2(v), p: seg(local, 0.12 + 0.08 * j, 0.3 + 0.08 * j) };
    })).concat([{ v: calc.result, col: COL.b, big: true, below: false, text: proofMode ? 'new b_2^2 ' + f3(calc.result) : 'b_' + (calc.i + 1) + '^2 ' + (calc.i === 1 ? f3(calc.result) : f2(calc.result)), p: seg(local, 0.68, 0.88) }]) : [];
    P.numberLines(g, NR, [{ name: calc ? 'b_' + (calc.i + 1) : 'b_i', marks: marks }], 1, calc ? 'the values for symbol ' + (calc.i + 1) : 'the same rule moves across the graph');
    if (q < 0.68) {
      var lines = calc ? sharedCalcLines(calc) : sharedRuleLines();
      lines.forEach(function (it, j) { it.p = j === 3 ? seg(local, 0.68, 0.86) : seg(local, 0.05 + 0.15 * j, 0.22 + 0.15 * j); });
      P.lines(g, ER, lines, 1, calc ? 'substitute only the highlighted values' : 'the shared-update rule, with ρ = 1', { size: ER[2] < 390 ? 11.5 : 12.5, rowH: 30 });
    } else {
      var proof = sharedProofLines(q), pp = clamp((q - proof.start) / (proof.end - proof.start), 0, 1);
      proof.lines.forEach(function (it, j) { it.p = seg(pp, 0.04 + 0.16 * j, 0.24 + 0.16 * j); });
      P.lines(g, ER, proof.lines, 1, proof.title, { size: ER[2] < 390 ? 11.5 : 12.5, rowH: 30 });
    }
  }

  out.push({ id: 'shared', chapter: CH.round, title: 'Round 2: the shared update', layout: 'side', dur: 13.5,
    text: 'Each symbol estimate combines one signal value with one corrected target from every check that touches it. Here d<sub>i</sub> counts those checks. With ρ = 1, the animation substitutes equal-weight values into the same rule. ' +
      at(0.06, 'Symbol 1 has one check: ' + sup(bi(1), 2) + ' = (0.1 + 0.6)/2 = ' + f2(R2.b[0]) + '. ') +
      at(0.25, 'Symbol 2 has two checks: ' + sup(bi(2), 2) + ' = (0.6 + 0.1 + 0.9)/3 = ' + f3(R2.b[1]) + '. ') +
      at(0.49, 'Symbol 3 has one check: ' + sup(bi(3), 2) + ' = (0.9 + 0.6)/2 = ' + f2(R2.b[2]) + '. ') +
      at(0.68, 'The last view returns to symbol 2. At its old value 0.600, the three quadratic terms have total slope 0.200 and curvature 3. Because the slope is positive, downhill is toward a smaller value. The move 0.600 − 0.200/3 = 0.533 reaches the same minimum as the average. Clipping changes nothing because the answer is already in [0,1].'),
    math: '',
    draw: function (g, q) {
      var RR = P.two(g.sideR, 0.52), t = R2.targets, calc = sharedCalcAt(q), focus = calc ? calc.i : null;
      var done = sharedCalcs.map(function (s) { return q >= s.start + 0.68 * (s.end - s.start); });
      var activeEdges = calc ? calc.edges : [];
      P.graph(g, RR[0], { title: q < 0.06 ? 'round 2: one rule, three symbols' : q < 0.68 ? 'now update symbol ' + (focus + 1) : 'why symbol 2 lands at 0.533',
        vals: R1.b.map(function (v, i) { return done[i] ? (i === 1 ? f3(R2.b[i]) : f2(R2.b[i])) : f2(v); }),
        valCol: function (i) { return i === focus ? C.gold : COL.b; }, hi: focus, hiP: focus == null ? 0 : 1,
        sig: ['c_1 = 0.10', 'c_2 = 0.60', 'c_3 = 0.90'], sigP: 1,
        edgeCol: function (e) { return activeEdges.indexOf(e) >= 0 ? COL.target : 'rgba(242,245,248,0.28)'; },
        edgeW: function (e) { return activeEdges.indexOf(e) >= 0 ? 2.5 : 1.3; },
        arrows: activeEdges.map(function (e) { var E = T.EDGES[e]; return { e: e, text: f2(t[E[0]][E[2]]), col: COL.target, p: 1, side: E[0] ? 1 : -1 }; })
      });
      drawSharedCalculation(g, RR[1], q, calc);
    } });

  out.push({ id: 'roles', chapter: CH.round, title: 'Three updates, three jobs', layout: 'side', dur: 7,
    text: 'One round runs three updates in a fixed order. ' +
      at(0.18, 'The shared update combines the evidence of the signal with the corrected request of every check. ') +
      at(0.4, 'The projection makes the copy of each check legal. ') +
      at(0.6, 'The ledger update remembers what is still unresolved. ') +
      at(0.8, 'Each update solves an easy problem, and the rounds hand the hard problem from one update to the next until the copies agree.'),
    math: b + ': combine the signal and the corrected requests' + at(0.4, '<br>' + za + ': make check a legal') + at(0.6, '<br>' + ua + ': remember the unresolved disagreement'),
    draw: function (g, q) {
      var Rr = g.sideR, cx = Rr[0] + Rr[2] / 2, cy = Rr[1] + Rr[3] / 2 + 10, rad = Math.min(Rr[2] * 0.32, Rr[3] * 0.32), w = Math.min(210, Rr[2] * 0.4), h = 64, off = Math.min(Math.max(rad * 1.1, w * 0.62 + 40), Rr[2] / 2 - w / 2 - 10); g.panel(Rr, 'one round');
      var spots = [[cx, cy - rad], [cx + off, cy + rad * 0.6], [cx - off, cy + rad * 0.6]], ps = [seg(q, 0.18, 0.3), seg(q, 0.4, 0.5), seg(q, 0.6, 0.7)];
      var labels = [['1. shared update', 'signal + corrected requests', COL.b], ['2. projection', 'each copy made legal', COL.z], ['3. ledger update', 'remember the disagreement', COL.u]];
      var carry = ['*S_a*b + *u_a', '*S_a*b − *z_a', '*z_a − *u_a'];
      [0, 1, 2].forEach(function (k) {
        var a = spots[k], bq = spots[(k + 1) % 3], pa = seg(q, [0.32, 0.52, 0.8][k], [0.42, 0.62, 0.92][k]); if (!(pa > 0)) return;
        var dx = bq[0] - a[0], dy = bq[1] - a[1], L0 = Math.hypot(dx, dy) || 1, tEdge = Math.min(Math.abs(dx) > 1e-9 ? (w / 2 + 8) / Math.abs(dx) : 9, Math.abs(dy) > 1e-9 ? (h / 2 + 8) / Math.abs(dy) : 9);
        var A0 = [a[0] + dx * tEdge, a[1] + dy * tEdge], B0 = [bq[0] - dx * tEdge, bq[1] - dy * tEdge];
        g.arrowPx(A0, [mix(A0[0], B0[0], pa), mix(A0[1], B0[1], pa)], 'rgba(242,245,248,0.7)', 2);
        var m = [mix(a[0], bq[0], 0.5), mix(a[1], bq[1], 0.5)], out0 = [m[0] - cx, m[1] - cy], ol = Math.hypot(out0[0], out0[1]) || 1;
        rich(g, m[0] + out0[0] / ol * 34, m[1] + out0[1] / ol * 22, carry[k], { size: 12, align: 'center', col: [COL.z, COL.u, COL.target][k], p: seg(pa, 0.5, 1), box: true });
      });
      spots.forEach(function (s, k) { P.box(g, s[0] - w / 2, s[1] - h / 2, w, h, labels[k][0], labels[k][1], labels[k][2], ps[k]); });
    } });

  // ------------------------------------------------------------ 5. agreement
  var gapList = R.slice(1, 6).map(function (r) { return r.gap < 0.03 ? f3(r.gap) : f2(r.gap); }).join(', ');
  out.push({ id: 'rounds', chapter: CH.agree, title: 'Round after round, until the copies agree', layout: 'side', dur: 9,
    text: 'The same three updates repeat. In this example the gap between the copies and the shared estimates halves in every round, ' + gapList + '. ' +
      at(0.42, 'In round ' + PASS + ' symbol 1 crosses one half, and the rounded word becomes ' + word(RP.word) + ', which passes both checks. ') +
      at(0.66, 'The estimates keep moving after that, until all three agree at ' + f3(d.mean) + '. ') +
      at(0.84, 'The dashed lines repeat the run without the ledger, which stays at ' + word(AL.word) + '.'),
    math: 'gap: ' + gapList + at(0.42, '<br>round ' + PASS + ': ' + b + ' = ' + v2(RP.b) + ' → ' + word(RP.word) + ' passes A and B') + at(0.66, '<br>limit: b<sub>1</sub> = b<sub>2</sub> = b<sub>3</sub> = ' + f3(d.mean)),
    draw: function (g, q) {
      var RR = P.two(g.sideR, 0.55), up = seg(q, 0.08, 0.7);
      P.trace(g, RR[0], { rounds: R, alone: L, aloneP: seg(q, 0.84, 1), n: N, upto: up, passAt: up * N >= PASS ? PASS : null, passText: 'round ' + PASS + ': ' + word(RP.word) + ' passes', title: 'the symbol estimates, round by round' });
      P.gaps(g, RR[1], { rounds: R, alone: L, aloneP: seg(q, 0.84, 1), n: N, upto: up });
    } });

  var force = [FIN.u[0][0], FIN.u[0][1] + FIN.u[1][0], FIN.u[1][1]];
  out.push({ id: 'answer', chapter: CH.agree, title: 'What the answer means', layout: 'side', dur: 8.5,
    text: 'The checks force the three estimates to agree, and the signal sets their common level, the average (0.1 + 0.6 + 0.9)/3 = ' + f3(d.mean) + '. That value sits just above one half, so the agreed word is ' + word(FIN.word) + ', held with little confidence. ' +
      at(0.42, 'The ledgers do not return to zero. They settle at ' + uA + ' = ' + v2(FIN.u[0]) + ' and ' + uB + ' = ' + v2(FIN.u[1]) + '. ') +
      at(0.66, 'Each settled ledger is the force its check needs to hold the estimates away from what the signal prefers. For symbol 1 the signal asks for 0.1, the answer is ' + f3(d.mean) + ', and 0.1 − ' + f3(d.mean) + ' = ' + f2(FIN.u[0][0]) + ' = ' + ue('A', 1) + '.'),
    math: b + ' → ' + v3(FIN.b) + at(0.42, '<br>' + uA + ' → ' + v3(FIN.u[0]) + ',  ' + uB + ' → ' + v3(FIN.u[1])) + at(0.66, '<br>c<sub>i</sub> − b<sub>i</sub> = ρ Σ<sub>a∋i</sub> u<sub>a,i</sub>'),
    draw: function (g, q) {
      var lab = ['u_{A,1} = ' + f2(force[0]), 'u_{A,2} + u_{B,2} = ' + f2(force[1]), 'u_{B,3} = ' + f2(force[2])];
      P.numberLines(g, g.sideR, [0, 1, 2].map(function (i) { return { name: 'b_' + (i + 1), marks: [{ v: c[i], col: COL.signal, text: 'signal ' + num(c[i], 1), p: seg(q, 0.05 + 0.04 * i, 0.15 + 0.04 * i) }, { v: FIN.b[i], col: COL.b, big: true, text: f3(FIN.b[i]), below: false, p: seg(q, 0.2 + 0.05 * i, 0.32 + 0.05 * i) }],
        arrows: [{ from: c[i], to: FIN.b[i], col: COL.u, text: lab[i], p: seg(q, 0.66 + 0.06 * i, 0.8 + 0.06 * i), lift: 2 }] }; }), q, 'where the signal points, where the checks hold it');
    } });

  // ------------------------------------------------------------ 6. beside other methods
  function bpArrows(q, pE) {
    var lab = [null, ['L_{2→A}', 'L_{A→2}'], ['L_{2→B}', 'L_{B→2}'], null], out0 = [];
    T.EDGES.forEach(function (E, e) {
      var dim = pE && e === 1 ? 0.35 : 1;
      out0.push({ e: e, back: true, side: -1, col: COL.bp, text: lab[e] ? lab[e][0] : '', p: seg(q, 0.12, 0.3), size: 13 });
      out0.push({ e: e, side: 1, col: e === 1 && pE ? 'rgba(127,214,180,0.35)' : COL.bp, text: lab[e] ? lab[e][1] : '', size: 13, p: seg(q, 0.18, 0.36) * dim, dash: e === 1 && pE ? [4, 4] : null });
    });
    return out0;
  }
  out.push({ id: 'bp', chapter: CH.beside, title: 'Same graph, different edge state', layout: 'side', dur: 9,
    text: 'Belief propagation (BP) runs on the same Tanner graph and stores something else on each edge, two directed messages. ' +
      at(0.22, 'A variable-to-check message L<sub>i→a</sub> and a check-to-variable message L<sub>a→i</sub> each carry a belief about one symbol as a log-likelihood ratio (LLR). ') +
      at(0.48, 'The message from symbol 2 to check A leaves out what check A last sent, so A hears only extrinsic information, the evidence that came from elsewhere. ') +
      at(0.74, 'SAPPHIRE keeps the pair (' + ze('a', 'i') + ', ' + ue('a', 'i') + ') on each edge instead, a replica coordinate and a scaled dual variable, and neither is a message. BP passes beliefs around the Tanner graph; SAPPHIRE runs a constrained negotiation on the same graph.'),
    math: 'BP, edge (a, i): L<sub>i→a</sub>, L<sub>a→i</sub>' + at(0.48, '<br>L<sub>2→A</sub> uses the signal and L<sub>B→2</sub>, not L<sub>A→2</sub>') + at(0.74, '<br>SAPPHIRE, edge (a, i): ' + ze('a', 'i') + ', ' + ue('a', 'i')),
    draw: function (g, q) {
      var RR = P.sideBySide(g.sideR), pE = q > 0.48;
      P.graph(g, RR[0], { title: 'BP: two directed messages per edge', vals: ['b₁', 'b₂', 'b₃'], names: ['', '', ''], hi: pE ? 1 : null, hiP: seg(q, 0.48, 0.58), arrows: bpArrows(q, pE), edgeCol: function () { return 'rgba(242,245,248,0.2)'; } });
      if (pE) rich(g, RR[0][0] + RR[0][2] / 2, RR[0][1] + RR[0][3] - 14, 'L_{2→A} leaves out L_{A→2}: extrinsic', { size: 11.5, align: 'center', col: COL.bp, p: seg(q, 0.52, 0.64) });
      P.graph(g, RR[1], { title: 'SAPPHIRE: a replica and a ledger per edge', vals: ['b₁', 'b₂', 'b₃'], names: ['', '', ''], boxes: names({ u: true, p: seg(q, 0.74, 0.86) }), symP: seg(q, 0.7, 0.8), checkP: seg(q, 0.7, 0.8), edgeP: seg(q, 0.72, 0.84) });
    } });

  var bridgeBowls = [
    { i: 0, start: 0.08, end: 0.18, old: R1.b[0], centre: R2.b[0], curvature: R2.den[0], slope: R2.den[0] * (R1.b[0] - R2.b[0]), terms: '½(t − 0.10)^2 + ½(t − 0.60)^2' },
    { i: 1, start: 0.18, end: 0.28, old: R1.b[1], centre: R2.b[1], curvature: R2.den[1], slope: R2.den[1] * (R1.b[1] - R2.b[1]), terms: '½(t − 0.60)^2 + ½(t − 0.10)^2 + ½(t − 0.90)^2' },
    { i: 2, start: 0.28, end: 0.38, old: R1.b[2], centre: R2.b[2], curvature: R2.den[2], slope: R2.den[2] * (R1.b[2] - R2.b[2]), terms: '½(t − 0.90)^2 + ½(t − 0.60)^2' }
  ];
  function bridgeBowlCost(bowl, t) { var d0 = t - bowl.centre; return bowl.curvature * d0 * d0 / 2; }
  function bridgeSignalCost(bowl, t) { var d0 = t - bowl.old; return bridgeBowlCost(bowl, t) - 0.08 * d0 * d0 * (1 + 0.15 * Math.sin(7 * t)); }
  // A schematic two-coordinate receiver slice.  At response coordinate r = 0 its bright cross-section is exactly the
  // one-symbol quadratic above.  Away from that slice the sheet exists only to give the response block a visible
  // direction; it is not a sampled surface from the recorded receiver.
  var bridgeResponse = { current: 0, quadratic: 0.16, slope: -0.10, coupling: 0.05 };
  function bridgeJointCost(bowl, t, r, costFn) {
    var base = costFn ? costFn(bowl, t) : bridgeBowlCost(bowl, t);
    return base + bridgeResponse.quadratic * r * r + (bridgeResponse.slope + bridgeResponse.coupling * (t - bowl.old)) * r;
  }
  function bridgeResponseMinimum(bowl, t) {
    return clamp(-(bridgeResponse.slope + bridgeResponse.coupling * (t - bowl.old)) / (2 * bridgeResponse.quadratic), -1, 1);
  }
  function bridgeFocus(q) { return q < 0.08 ? null : q < 0.18 ? 0 : q < 0.28 ? 1 : q < 0.38 ? 2 : q < 0.54 ? null : q < 0.84 ? 1 : null; }
  function bridgeCardProgress(q) {
    if (q < 0.08) return seg(q, 0, 0.08);
    if (q < 0.18) return seg(q, 0.08, 0.18);
    if (q < 0.28) return seg(q, 0.18, 0.28);
    if (q < 0.38) return seg(q, 0.28, 0.38);
    if (q < 0.54) return seg(q, 0.38, 0.54);
    if (q < 0.70) return seg(q, 0.54, 0.70);
    if (q < 0.84) return seg(q, 0.70, 0.84);
    if (q < 0.94) return seg(q, 0.84, 0.94);
    return seg(q, 0.94, 1);
  }
  function bridgePosition(bowl, q) {
    if (q < 0.38) return bowl.old;
    if (q < 0.54) return mix(bowl.old, bowl.centre, seg(q, 0.38, 0.52));
    if (bowl.i !== 1 || q >= 0.84) return bowl.centre;
    if (q < 0.70) return bowl.old;
    return mix(bowl.old, bowl.centre, seg(q, 0.70, 0.84));
  }
  function bridgeLines(q) {
    if (q < 0.08) return { title: 'how to read the 3D view', lines: [
      { text: 'left–right: one symbol estimate b_i', col: COL.b },
      { text: 'front–back: one real coordinate of *C', col: C.gold },
      { text: 'up: cost', col: COL.target },
      { text: 'bright slice: hold *C at *C^k', col: COL.pass }
    ] };
    if (q < 0.38) {
      var bowl = bridgeBowls[bridgeFocus(q)], j = bowl.i + 1;
      return { title: 'cost for this update: symbol ' + j, lines: [
        { text: bowl.terms, col: COL.target, size: j === 2 ? 10.5 : 12 },
        { text: 'bottom b_' + j + '^2 = ' + f3(bowl.centre), col: COL.pass },
        { text: 'curvature ' + bowl.curvature + (j === 2 ? ': the narrowest bowl' : ''), col: C.gold },
        { text: 'old b_' + j + '^1 = ' + f3(bowl.old) + ', slope ' + (bowl.slope >= 0 ? '+' : '−') + f3(Math.abs(bowl.slope)), col: COL.signal }
      ] };
    }
    if (q < 0.54) return { title: 'one shared symbol update', lines: [
      { text: 'old *b^1 = (0.100, 0.600, 0.900)', col: COL.signal },
      { text: 'the same old vector feeds all three', col: C.ink },
      { text: 'three markers move together', col: COL.pass },
      { text: 'new *b^2 = (0.350, 0.533, 0.750)', col: C.gold, weight: '700' }
    ] };
    if (q < 0.70) return { title: 'replay symbol 2', lines: [
      { text: 'old b_2^1 = 0.600', col: COL.signal },
      { text: 'slope at the old value = +0.200', col: COL.signal },
      { text: 'curvature = 3', col: COL.target },
      { text: 'positive slope means move toward smaller t', col: C.ink }
    ] };
    if (q < 0.84) return { title: 'one exact jump to the bottom', lines: [
      { text: 'old value − slope / curvature', col: C.ink },
      { text: '0.600 − 0.200 / 3', col: COL.signal },
      { text: '= 0.533', col: C.gold, weight: '700' },
      { text: 'inside [0,1], so clipping changes nothing', col: COL.pass }
    ] };
    if (q < 0.94) return { title: 'fixed-C signal slice', lines: [
      { text: 'gold: received-signal cost', col: COL.signal },
      { text: 'violet: upper quadratic model', col: COL.target },
      { text: 'bright slice preserves the toy curve', col: C.gold },
      { text: 'touch; then add binary + ADMM terms', col: COL.pass }
    ] };
    return { title: 'freeze the response', lines: [
      { text: 'the depth direction belongs to *C', col: C.gold },
      { text: 'the symbol update holds *C = *C^k', col: COL.b },
      { text: 'also hold weights, *z and *u fixed', col: COL.signal },
      { text: 'next: open two symbol coordinates', col: COL.pass }
    ] };
  }
  function bridgeView(F, unfold) {
    var dx = -F[2] * 0.17 * unfold, dy = -F[3] * 0.12 * unfold;
    return { F: F, ox: F[0] + F[2] * 0.22, oy: F[1] + F[3] * 0.84, xw: F[2] * 0.71, dx: dx, dy: dy, zh: F[3] * 0.61, zmax: 0.72 };
  }
  function bridgeProject(V, t, r, cost) {
    var d = (r + 1) / 2;
    return [V.ox + t * V.xw + d * V.dx, V.oy + d * V.dy - cost / V.zmax * V.zh];
  }
  function bridgePath3D(g, V, bowl, p, col, width, r, costFn, dash) {
    if (!(p > 0)) return; var cx = g.ctx, n = 56; cx.save(); cx.globalAlpha = clamp(p, 0, 1); cx.strokeStyle = col; cx.lineWidth = width; cx.lineCap = 'round'; if (dash) cx.setLineDash(dash); cx.beginPath();
    for (var j = 0; j <= n; j++) { var t = j / n, a = bridgeProject(V, t, r, bridgeJointCost(bowl, t, r, costFn)); if (!j) cx.moveTo(a[0], a[1]); else cx.lineTo(a[0], a[1]); }
    cx.stroke(); cx.restore();
  }
  function drawBridgeSurface3D(g, V, bowl, p, o) {
    if (!(p > 0)) return; o = o || {}; var cx = g.ctx, nt = V.F[2] < 330 ? 14 : 20, nr = V.F[2] < 330 ? 6 : 8, costFn = o.costFn;
    cx.save(); cx.fillStyle = o.col || COL.target; cx.strokeStyle = o.meshCol || 'rgba(203,186,255,0.42)'; cx.lineWidth = 0.7;
    for (var ir = nr - 1; ir >= 0; ir--) {
      var ra = -1 + 2 * ir / nr, rb = -1 + 2 * (ir + 1) / nr;
      for (var it = 0; it < nt; it++) {
        var ta = it / nt, tb = (it + 1) / nt;
        var a = bridgeProject(V, ta, ra, bridgeJointCost(bowl, ta, ra, costFn));
        var b0 = bridgeProject(V, tb, ra, bridgeJointCost(bowl, tb, ra, costFn));
        var c0 = bridgeProject(V, tb, rb, bridgeJointCost(bowl, tb, rb, costFn));
        var d0 = bridgeProject(V, ta, rb, bridgeJointCost(bowl, ta, rb, costFn));
        cx.globalAlpha = clamp(p, 0, 1) * (o.fill == null ? 0.085 : o.fill) * (0.75 + 0.25 * (nr - ir) / nr);
        cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b0[0], b0[1]); cx.lineTo(c0[0], c0[1]); cx.lineTo(d0[0], d0[1]); cx.closePath(); cx.fill();
      }
    }
    cx.globalAlpha = clamp(p, 0, 1) * (o.mesh == null ? 0.34 : o.mesh);
    for (var jr = 0; jr <= nr; jr++) {
      var rr = -1 + 2 * jr / nr; cx.beginPath();
      for (var jt = 0; jt <= nt; jt++) { var tt = jt / nt, pr = bridgeProject(V, tt, rr, bridgeJointCost(bowl, tt, rr, costFn)); if (!jt) cx.moveTo(pr[0], pr[1]); else cx.lineTo(pr[0], pr[1]); }
      cx.stroke();
    }
    for (var kt = 0; kt <= nt; kt += 4) {
      var tx = kt / nt; cx.beginPath();
      for (var kr = 0; kr <= nr; kr++) { var rx = -1 + 2 * kr / nr, pp = bridgeProject(V, tx, rx, bridgeJointCost(bowl, tx, rx, costFn)); if (!kr) cx.moveTo(pp[0], pp[1]); else cx.lineTo(pp[0], pp[1]); }
      cx.stroke();
    }
    cx.restore();
  }
  function drawBridgeCurtain(g, V, bowl, p, o) {
    if (!(p > 0)) return; o = o || {}; var cx = g.ctx, costFn = o.costFn, r = o.r == null ? 0 : o.r, n = 28;
    cx.save(); cx.globalAlpha = clamp(p, 0, 1) * 0.075; cx.fillStyle = o.col || C.gold;
    for (var j = 0; j < n; j++) {
      var ta = j / n, tb = (j + 1) / n, a = bridgeProject(V, ta, r, 0), b0 = bridgeProject(V, tb, r, 0), c0 = bridgeProject(V, tb, r, bridgeJointCost(bowl, tb, r, costFn)), d0 = bridgeProject(V, ta, r, bridgeJointCost(bowl, ta, r, costFn));
      cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b0[0], b0[1]); cx.lineTo(c0[0], c0[1]); cx.lineTo(d0[0], d0[1]); cx.closePath(); cx.fill();
    }
    cx.restore();
  }
  function drawBridgeAxes3D(g, V, p, i, compact) {
    if (!(p > 0)) return; var O = bridgeProject(V, 0, -1, 0), X = bridgeProject(V, 1, -1, 0), D = bridgeProject(V, 0, 1, 0), Z = bridgeProject(V, 0, -1, V.zmax * 0.78);
    g.arrowPx(O, X, COL.b, 1.3); g.arrowPx(O, D, C.gold, 1.3); g.arrowPx(O, Z, COL.target, 1.3);
    rich(g, X[0] - 2, X[1] + 13, compact ? 'b_' + (i + 1) : 'symbol estimate b_' + (i + 1), { size: compact ? 9.5 : 11, align: 'right', col: COL.b, p: p });
    if (!compact) rich(g, D[0] - 2, D[1] - 12, 'one real coordinate of *C', { size: 10.5, align: 'left', col: C.gold, p: p });
    rich(g, Z[0] - 5, Z[1] - 2, 'cost', { size: compact ? 9.5 : 10.5, align: 'right', col: COL.target, p: p });
  }
  function drawBridgeDot3D(g, a, radius, col, p) {
    if (!(p > 0)) return; var cx = g.ctx; cx.save(); cx.globalAlpha = clamp(p, 0, 1); cx.shadowColor = 'rgba(0,0,0,0.65)'; cx.shadowBlur = radius; cx.shadowOffsetY = 3; cx.fillStyle = col; cx.beginPath(); cx.arc(a[0], a[1], radius, 0, Math.PI * 2); cx.fill(); cx.shadowColor = 'transparent'; cx.strokeStyle = 'rgba(255,255,255,0.72)'; cx.lineWidth = 1; cx.stroke(); cx.restore();
  }
  function drawBridgeTangent3D(g, V, bowl, p) {
    if (!(p > 0)) return; var cx = g.ctx, span = 0.14, ta = clamp(bowl.old - span, 0, 1), tb = clamp(bowl.old + span, 0, 1), y0 = bridgeBowlCost(bowl, bowl.old);
    var a = bridgeProject(V, ta, 0, y0 + bowl.slope * (ta - bowl.old)), b0 = bridgeProject(V, tb, 0, y0 + bowl.slope * (tb - bowl.old));
    cx.save(); cx.globalAlpha = clamp(p, 0, 1); cx.strokeStyle = COL.signal; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b0[0], b0[1]); cx.stroke(); cx.restore();
  }
  function drawBridgeResponseSlice(g, V, bowl, p) {
    if (!(p > 0)) return; var cx = g.ctx, t = bowl.centre, n = 40;
    cx.save(); cx.globalAlpha = clamp(p, 0, 1); cx.strokeStyle = C.gold; cx.lineWidth = 3; cx.beginPath();
    for (var j = 0; j <= n; j++) { var r = -1 + 2 * j / n, a = bridgeProject(V, t, r, bridgeJointCost(bowl, t, r)); if (!j) cx.moveTo(a[0], a[1]); else cx.lineTo(a[0], a[1]); } cx.stroke(); cx.restore();
    var old = bridgeProject(V, t, 0, bridgeJointCost(bowl, t, 0)); drawBridgeDot3D(g, old, 6, C.gold, p);
    var compact = V.F[2] < 360, labelX = compact ? V.F[0] + V.F[2] - 8 : old[0] + 10;
    rich(g, labelX, old[1] - 15, compact ? '*C stays fixed' : 'response direction; *C stays fixed', { size: 10.5, align: compact ? 'right' : 'left', col: C.gold, p: seg(p, 0.35, 0.75), box: true });
  }
  function drawBridgeRails(g, Rr, q) {
    var cx = g.ctx, left = Rr[0] + 36, right = Rr[0] + Rr[2] - 18, top = Rr[1] + Rr[3] - 66, move = seg(q, 0.38, 0.52);
    bridgeBowls.forEach(function (bowl, i) {
      var y = top + i * 18, a = mix(left, right, bowl.old), b0 = mix(left, right, bowl.centre), x = mix(a, b0, move); cx.strokeStyle = 'rgba(242,245,248,0.28)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(left, y); cx.lineTo(right, y); cx.stroke();
      rich(g, left - 8, y, 'b_' + (i + 1), { size: 9.5, align: 'right', col: COL.b }); drawBridgeDot3D(g, [x, y], 3.5, COL.signal, 1); rich(g, Rr[0] + Rr[2] - 4, y, f3(mix(bowl.old, bowl.centre, move)), { size: 9.5, align: 'right', col: C.gold, mono: true });
    });
  }
  function drawBridgeOne3D(g, F, bowl, q, o) {
    o = o || {}; var reveal = o.reveal == null ? 1 : o.reveal, V = bridgeView(F, o.unfold == null ? 1 : o.unfold), active = o.active == null ? 1 : o.active, finalModel = o.finalModel;
    if (finalModel) {
      drawBridgeSurface3D(g, V, bowl, reveal * seg(q, 0.84, 0.91), { col: COL.signal, meshCol: 'rgba(244,190,87,0.5)', fill: 0.055, mesh: 0.28, costFn: function (b0, t) { return bridgeSignalCost(b0, t); } });
      drawBridgeSurface3D(g, V, bowl, reveal * seg(q, 0.87, 0.94), { col: COL.target, fill: 0.04, mesh: 0.46 });
      drawBridgeCurtain(g, V, bowl, seg(q, 0.87, 0.94), { col: C.gold });
      bridgePath3D(g, V, bowl, seg(q, 0.84, 0.91), COL.signal, 2.2, 0, function (b0, t) { return bridgeSignalCost(b0, t); });
      bridgePath3D(g, V, bowl, seg(q, 0.87, 0.94), COL.target, 3.2, 0);
      var touch = bridgeProject(V, bowl.old, 0, bridgeBowlCost(bowl, bowl.old)), touchP = seg(q, 0.88, 0.93) * (1 - seg(q, 0.94, 0.97)); drawBridgeDot3D(g, touch, 6, C.gold, touchP);
      rich(g, touch[0] + 10, touch[1] - 17, 'touch on *C = *C^k', { size: 10.5, col: C.gold, p: touchP, box: true });
    } else {
      drawBridgeSurface3D(g, V, bowl, reveal * active, { col: COL.target });
      drawBridgeCurtain(g, V, bowl, reveal * active, { col: C.gold });
      bridgePath3D(g, V, bowl, reveal * active, COL.target, o.compact ? 2.2 : 3.2, 0);
      var pos = bridgePosition(bowl, q), ball = bridgeProject(V, pos, 0, bridgeBowlCost(bowl, pos)), bottom = bridgeProject(V, bowl.centre, 0, 0);
      drawBridgeDot3D(g, bottom, o.compact ? 3.5 : 5, COL.pass, reveal * active); drawBridgeDot3D(g, ball, o.compact ? 4.5 : 6.5, COL.signal, reveal * active);
      if (o.tangent) drawBridgeTangent3D(g, V, bowl, reveal * active);
    }
    drawBridgeAxes3D(g, V, reveal * active, bowl.i, !!o.compact);
    if (o.response) { rich(g, F[0] + F[2] / 2, F[1] + 18, 'hold *C = *C^k for the symbol update', { size: 11, align: 'center', col: COL.signal, p: seg(q, 0.94, 0.97), box: true }); drawBridgeResponseSlice(g, V, bowl, seg(q, 0.94, 1)); }
    else rich(g, bridgeProject(V, 0.08, 0, 0)[0], bridgeProject(V, 0.08, 0, 0)[1] + 12, '*C = *C^k', { size: o.compact ? 9 : 10.5, col: C.gold, p: reveal * active, box: !o.compact });
  }
  function drawBridge3D(g, Rr, q) {
    var focus = bridgeFocus(q), shared = q >= 0.38 && q < 0.54, single = !shared, compactStage = Rr[2] < 390, tabbed = q < 0.38, title = q < 0.84 ? '3D view: symbol, response and cost' : q < 0.94 ? '3D signal surface: fixed-C slice' : 'freeze C for the symbol view';
    g.panel(Rr, title);
    var inner = [Rr[0] + 6, Rr[1] + (tabbed ? 44 : 28), Rr[2] - 12, Rr[3] - (tabbed ? 52 : 44)];
    if (single) {
      var idx = focus == null ? (q >= 0.84 ? 1 : 0) : focus, bowl = bridgeBowls[idx], unfold = q < 0.08 ? seg(q, 0, 0.075) : 1;
      drawBridgeOne3D(g, inner, bowl, q, { reveal: q < 0.08 ? seg(q, 0, 0.075) : seg(q, bowl.start, bowl.start + 0.07), unfold: unfold, tangent: focus === idx && (q < 0.38 || (q >= 0.54 && q < 0.84)), finalModel: q >= 0.84, response: q >= 0.94 });
      if (q < 0.38) {
        [0, 1, 2].forEach(function (i) { rich(g, Rr[0] + Rr[2] * (0.36 + 0.14 * i), Rr[1] + 37, 'b_' + (i + 1), { size: 10.5, align: 'center', col: idx === i ? C.gold : C.dim, p: q < 0.08 ? seg(q, 0.02, 0.07) : 1, box: idx === i }); });
      }
    } else if (!compactStage && Rr[3] >= 390) {
      var gap = 2, rowH = (inner[3] - 2 * gap) / 3;
      bridgeBowls.forEach(function (bowl, i) { drawBridgeOne3D(g, [inner[0], inner[1] + i * (rowH + gap), inner[2], rowH], bowl, q, { reveal: 1, active: 1, compact: true }); });
      rich(g, Rr[0] + Rr[2] / 2, Rr[1] + 43, 'freeze *C: all three markers move together', { size: 11, align: 'center', col: COL.pass, p: seg(q, 0.38, 0.45), box: true, weight: '700' });
    } else {
      var upper = [inner[0], inner[1], inner[2], inner[3] - 72]; drawBridgeOne3D(g, upper, bridgeBowls[1], q, { reveal: 1 }); drawBridgeRails(g, Rr, q);
      rich(g, Rr[0] + Rr[2] / 2, Rr[1] + 44, 'one shared update: three synchronized values', { size: 10.5, align: 'center', col: COL.pass, p: seg(q, 0.38, 0.45), box: true, weight: '700' });
    }
    if (q < 0.08) rich(g, Rr[0] + Rr[2] / 2, Rr[1] + Rr[3] - 15, 'the old curve opens into a second receiver direction', { size: 10.5, align: 'center', col: C.dim, p: seg(q, 0.02, 0.08) });
    if (q >= 0.94) rich(g, Rr[0] + Rr[2] / 2, Rr[1] + Rr[3] - 15, 'C moves later; next open b_1 and b_2 together', { size: 10.5, align: 'center', col: COL.pass, p: seg(q, 0.95, 1), box: true });
    var cx = g.ctx; cx.save(); cx.fillStyle = 'rgba(20,27,36,0.96)'; cx.fillRect(Rr[0] + 5, Rr[1] + 4, Rr[2] - 10, 23); cx.font = '700 12.5px ' + g.sans; cx.fillStyle = C.gold; cx.textAlign = 'left'; cx.textBaseline = 'top'; cx.fillText(title, Rr[0] + 10, Rr[1] + 8); cx.restore();
  }
  function drawBridge(g, Rr, q) {
    var RR = P.two(Rr, 0.66), info = bridgeLines(q); drawBridge3D(g, RR[0], q);
    var cardP = bridgeCardProgress(q); info.lines.forEach(function (it, i) { it.p = seg(cardP, 0.02 + 0.10 * i, 0.16 + 0.10 * i); });
    P.lines(g, RR[1], info.lines, 1, info.title, { size: RR[1][2] < 390 ? 11 : 12, rowH: 29 });
  }

  // A two-symbol teaching slice for comparing the cost of one frozen b block with the temporary quadratic used to
  // choose its update.  It preserves the preceding old point, slopes, curvatures and new point.  The nonnegative
  // squared gap makes the violet surface an exact upper bound for this schematic slice; neither surface is sampled
  // from a recorded receiver frame or presented as the complete high-dimensional SAPPHIRE objective.
  var surrogateDemo = { old: [0.10, 0.60], next: [0.350, 8 / 15], curvature: [2, 3], base: 0.10, gap: 0.30 };
  function surrogateUpper(x, y) {
    var dx = x - surrogateDemo.next[0], dy = y - surrogateDemo.next[1];
    return surrogateDemo.base + dx * dx + 1.5 * dy * dy;
  }
  function surrogateGap(x, y) {
    var d1 = x - surrogateDemo.old[0], d2 = y - surrogateDemo.old[1], d = d1 - d2;
    return surrogateDemo.gap * d * d;
  }
  function surrogateActual(x, y) { return surrogateUpper(x, y) - surrogateGap(x, y); }
  function surrogateSlope() {
    return [surrogateDemo.curvature[0] * (surrogateDemo.old[0] - surrogateDemo.next[0]), surrogateDemo.curvature[1] * (surrogateDemo.old[1] - surrogateDemo.next[1])];
  }
  function surrogateView(F) {
    return { F: F, ox: F[0] + F[2] * 0.29, oy: F[1] + F[3] * 0.82, xw: F[2] * 0.64, dx: -F[2] * 0.23, dy: -F[3] * 0.16, zh: F[3] * 0.56, zmin: 0.02, zmax: 0.80 };
  }
  function surrogateProject(V, x, y, z) {
    return [V.ox + x * V.xw + y * V.dx, V.oy + y * V.dy - (z - V.zmin) / (V.zmax - V.zmin) * V.zh];
  }
  function drawSurrogateSurface(g, V, costFn, p, o) {
    if (!(p > 0)) return; o = o || {}; var cx = g.ctx, nx = V.F[2] < 360 ? 13 : 19, ny = V.F[2] < 360 ? 8 : 11, grow = o.grow == null ? 1 : o.grow;
    cx.save(); cx.fillStyle = o.fillCol || COL.signal; cx.strokeStyle = o.meshCol || 'rgba(244,190,87,0.58)'; cx.lineWidth = o.width || 0.8;
    for (var iy = ny - 1; iy >= 0; iy--) {
      var ya = iy / ny, yb = (iy + 1) / ny;
      for (var ix = 0; ix < nx; ix++) {
        var xa = ix / nx, xb = (ix + 1) / nx, xm = (xa + xb) / 2, ym = (ya + yb) / 2;
        var dist = Math.hypot(xm - surrogateDemo.old[0], ym - surrogateDemo.old[1]) / 1.28;
        var gp = seg(grow, dist * 0.78, dist * 0.78 + 0.18); if (!(gp > 0)) continue;
        var a0 = surrogateProject(V, xa, ya, costFn(xa, ya)), b0 = surrogateProject(V, xb, ya, costFn(xb, ya));
        var c0 = surrogateProject(V, xb, yb, costFn(xb, yb)), d0 = surrogateProject(V, xa, yb, costFn(xa, yb));
        cx.globalAlpha = clamp(p, 0, 1) * gp * (o.fill == null ? 0.10 : o.fill);
        cx.beginPath(); cx.moveTo(a0[0], a0[1]); cx.lineTo(b0[0], b0[1]); cx.lineTo(c0[0], c0[1]); cx.lineTo(d0[0], d0[1]); cx.closePath(); cx.fill();
      }
    }
    var meshP = clamp(p, 0, 1) * seg(grow, 0.48, 0.92) * (o.mesh == null ? 0.44 : o.mesh); cx.globalAlpha = meshP;
    for (var jy = 0; jy <= ny; jy++) {
      var yy = jy / ny; cx.beginPath();
      for (var jx = 0; jx <= nx; jx++) { var xx = jx / nx, py = surrogateProject(V, xx, yy, costFn(xx, yy)); if (!jx) cx.moveTo(py[0], py[1]); else cx.lineTo(py[0], py[1]); }
      cx.stroke();
    }
    for (var kx = 0; kx <= nx; kx += 3) {
      var xxx = kx / nx; cx.beginPath();
      for (var ky = 0; ky <= ny; ky++) { var yyy = ky / ny, px = surrogateProject(V, xxx, yyy, costFn(xxx, yyy)); if (!ky) cx.moveTo(px[0], px[1]); else cx.lineTo(px[0], px[1]); }
      cx.stroke();
    }
    cx.restore();
  }
  function drawSurrogateAxes(g, V) {
    var O = surrogateProject(V, 0, 0, V.zmin), X = surrogateProject(V, 1, 0, V.zmin), Y = surrogateProject(V, 0, 1, V.zmin), Z = surrogateProject(V, 0, 0, V.zmax * 0.88), compact = V.F[2] < 360;
    g.arrowPx(O, X, COL.b, 1.4); g.arrowPx(O, Y, COL.z, 1.4); g.arrowPx(O, Z, COL.target, 1.4);
    rich(g, X[0], X[1] + 13, compact ? 'b_1' : 'symbol estimate b_1', { size: compact ? 9.5 : 10.5, align: 'right', col: COL.b });
    rich(g, Y[0] - 3, Y[1] - 11, compact ? 'b_2' : 'symbol estimate b_2', { size: compact ? 9.5 : 10.5, align: 'left', col: COL.z });
    rich(g, Z[0] - 5, Z[1], 'cost', { size: compact ? 9.5 : 10.5, align: 'right', col: COL.target });
  }
  function drawSurrogatePoint(g, point, radius, col, p) { drawBridgeDot3D(g, point, radius, col, p); }
  function drawSurrogateSlopes(g, V, p) {
    if (!(p > 0)) return; var old = surrogateDemo.old, slope = surrogateSlope(), z0 = surrogateActual(old[0], old[1]), P0 = surrogateProject(V, old[0], old[1], z0), step = 0.19;
    var T1 = surrogateProject(V, old[0] + step, old[1], z0 + slope[0] * step), T2 = surrogateProject(V, old[0], old[1] + step, z0 + slope[1] * step);
    g.arrowPx(P0, [mix(P0[0], T1[0], p), mix(P0[1], T1[1], p)], COL.b, 2);
    g.arrowPx(P0, [mix(P0[0], T2[0], p), mix(P0[1], T2[1], p)], COL.z, 2);
    rich(g, T1[0] + 4, T1[1] - 10, '∂/∂b_1', { size: 10, col: COL.b, p: seg(p, 0.45, 0.9), box: true });
    rich(g, T2[0] - 4, T2[1] - 10, '∂/∂b_2', { size: 10, align: 'right', col: COL.z, p: seg(p, 0.45, 0.9), box: true });
  }
  function drawSurrogateScan(g, V, q) {
    var p = seg(q, 0.55, 0.67); if (!(p > 0)) return; var cx = g.ctx, y = q < 0.59 ? surrogateDemo.old[1] : mix(0.08, 0.92, seg(q, 0.59, 0.67)), n = 46;
    function line(fn, col, width) { cx.save(); cx.globalAlpha = p; cx.strokeStyle = col; cx.lineWidth = width; cx.beginPath(); for (var i = 0; i <= n; i++) { var x = i / n, a = surrogateProject(V, x, y, fn(x, y)); if (!i) cx.moveTo(a[0], a[1]); else cx.lineTo(a[0], a[1]); } cx.stroke(); cx.restore(); }
    line(surrogateActual, COL.signal, 2.6); line(surrogateUpper, COL.target, 2.6);
    cx.save(); cx.globalAlpha = p * 0.65; cx.strokeStyle = C.gold; cx.lineWidth = 1; cx.setLineDash([3, 3]);
    for (var j = 1; j < 7; j++) { var xx = j / 7, a0 = surrogateProject(V, xx, y, surrogateActual(xx, y)), b0 = surrogateProject(V, xx, y, surrogateUpper(xx, y)); cx.beginPath(); cx.moveTo(a0[0], a0[1]); cx.lineTo(b0[0], b0[1]); cx.stroke(); }
    cx.restore();
  }
  function surrogateCardProgress(q) {
    if (q < 0.12) return seg(q, 0, 0.12); if (q < 0.23) return seg(q, 0.12, 0.23); if (q < 0.36) return seg(q, 0.23, 0.36);
    if (q < 0.55) return seg(q, 0.36, 0.55); if (q < 0.67) return seg(q, 0.55, 0.67); if (q < 0.80) return seg(q, 0.67, 0.80);
    if (q < 0.91) return seg(q, 0.80, 0.91); return seg(q, 0.91, 1);
  }
  function surrogateLines(q) {
    if (q < 0.12) return { title: 'an honest two-symbol view', lines: [
      { text: 'gold: Φ_k(b_1,b_2)', col: COL.signal }, { text: 'actual frozen block cost', col: C.ink },
      { text: 'schematic teaching slice', col: C.gold }, { text: 'not the full receiver objective', col: C.dim }
    ] };
    if (q < 0.23) return { title: 'freeze everything else', lines: [
      { text: '*b^k = (0.100, 0.600)', col: COL.b }, { text: 'Φ_k(*b^k) = 0.169', col: COL.signal },
      { text: 'fixed: *C, weights, *z, *u', col: C.gold }, { text: 'and every unshown symbol', col: C.dim }
    ] };
    if (q < 0.36) return { title: 'read two partial derivatives', lines: [
      { text: '∂Φ_k/∂b_1 = −0.500', col: COL.b }, { text: '∂Φ_k/∂b_2 = +0.200', col: COL.z },
      { text: 'evaluated from explicit formulas', col: C.gold }, { text: 'the estimate has not moved', col: C.dim }
    ] };
    if (q < 0.55) return { title: 'grow the easy stand-in', lines: [
      { text: 'violet: temporary surrogate Φ̂_k', col: COL.target }, { text: 'same height and slopes at *b^k', col: C.gold },
      { text: 'curvatures: 2 and 3', col: COL.b }, { text: 'a separable quadratic function', col: COL.pass }
    ] };
    if (q < 0.67) return { title: 'why the stand-in is safe', lines: [
      { text: 'Φ̂_k − Φ_k = 0.30(Δb_1 − Δb_2)^2', col: C.gold, size: 10.5 }, { text: 'therefore Φ̂_k ≥ Φ_k', col: COL.target },
      { text: 'the moving slice shows the gap', col: C.ink }, { text: 'the gap is zero at *b^k', col: COL.pass }
    ] };
    if (q < 0.80) return { title: 'minimize the easy bowl', lines: [
      { text: 'arg min Φ̂_k = (0.350, 0.533)', col: C.gold, size: 10.5 }, { text: 'minimize the quadratic function directly', col: COL.pass, size: 10.5 },
      { text: 'both coordinates move together', col: COL.b }, { text: 'not gradient-descent steps', col: C.dim }
    ] };
    if (q < 0.91) return { title: 'return to the actual cost', lines: [
      { text: 'Φ_k(new) = 0.070', col: COL.signal }, { text: 'Φ̂_k(new) = 0.100', col: COL.target },
      { text: 'Φ_k(old) = Φ̂_k(old) = 0.169', col: C.gold, size: 10.5 }, { text: 'the frozen cost fell', col: COL.pass }
    ] };
    return { title: 'what changes next round', lines: [
      { text: 'the constrained problem stays fixed', col: COL.pass }, { text: '*C, weights, *z and *u move', col: C.gold },
      { text: 'their new values reshape Φ_{k+1}', col: COL.signal }, { text: 'then SAPPHIRE builds a new surrogate', col: COL.target }
    ] };
  }
  function drawSurrogateDemo(g, Rr, q) {
    var share = P.wide(Rr) ? 0.71 : 0.66, RR = P.two(Rr, share), plot = RR[0], card = RR[1], title = q < 0.36 ? 'actual cost with the other state frozen' : q < 0.67 ? 'actual cost and temporary surrogate' : q < 0.80 ? 'one direct surrogate minimum' : q < 0.91 ? 'the actual cost at the new coordinates' : 'the fixed problem continues';
    g.panel(plot, title); var F = [plot[0] + 7, plot[1] + 50, plot[2] - 14, plot[3] - 60], V = surrogateView(F);
    var actualP = seg(q, 0, 0.12), grow = seg(q, 0.36, 0.55), fadeSur = 1 - seg(q, 0.91, 0.98), surP = seg(q, 0.36, 0.47) * fadeSur;
    drawSurrogateSurface(g, V, surrogateActual, actualP, { fillCol: COL.signal, meshCol: 'rgba(244,190,87,0.64)', fill: q >= 0.67 ? 0.045 : 0.09, mesh: q >= 0.67 ? 0.34 : 0.5 });
    drawSurrogateSurface(g, V, surrogateUpper, surP, { fillCol: COL.target, meshCol: 'rgba(203,186,255,0.72)', fill: 0.075, mesh: 0.55, grow: grow });
    drawSurrogateAxes(g, V); drawSurrogateScan(g, V, q);
    var old = surrogateDemo.old, next = surrogateDemo.next, oldPt = surrogateProject(V, old[0], old[1], surrogateActual(old[0], old[1]));
    var upperNext = surrogateProject(V, next[0], next[1], surrogateUpper(next[0], next[1])), actualNext = surrogateProject(V, next[0], next[1], surrogateActual(next[0], next[1]));
    var drop = seg(q, 0.12, 0.22), oldStart = [oldPt[0], F[1] + 8]; drawSurrogatePoint(g, [mix(oldStart[0], oldPt[0], drop), mix(oldStart[1], oldPt[1], drop)], 6, C.gold, drop * (1 - seg(q, 0.79, 0.9)));
    rich(g, oldPt[0] + 9, oldPt[1] - 16, '*b^k', { size: 10.5, col: C.gold, p: seg(q, 0.17, 0.24) * (1 - seg(q, 0.79, 0.9)), box: true });
    drawSurrogateSlopes(g, V, seg(q, 0.23, 0.36) * (1 - seg(q, 0.42, 0.50)));
    var arrowP = seg(q, 0.67, 0.78); if (arrowP > 0) g.arrowPx(oldPt, [mix(oldPt[0], upperNext[0], arrowP), mix(oldPt[1], upperNext[1], arrowP)], COL.target, 2.6);
    drawSurrogatePoint(g, upperNext, 6, COL.target, seg(q, 0.73, 0.80) * (1 - seg(q, 0.82, 0.86)));
    rich(g, upperNext[0] + 8, upperNext[1] - 14, 'arg min Φ̂_k', { size: 10, col: COL.target, p: seg(q, 0.74, 0.81) * (1 - seg(q, 0.82, 0.86)), box: true });
    var downP = seg(q, 0.80, 0.89); if (downP > 0) g.arrowPx(upperNext, [mix(upperNext[0], actualNext[0], downP), mix(upperNext[1], actualNext[1], downP)], COL.pass, 2.2);
    drawSurrogatePoint(g, actualNext, 6, COL.pass, seg(q, 0.83, 0.91));
    rich(g, actualNext[0] + 8, actualNext[1] + 18, 'same new coordinates', { size: 10, col: COL.pass, p: seg(q, 0.86, 0.92), box: true });
    rich(g, plot[0] + plot[2] / 2, plot[1] + 38, 'fixed constrained problem: unchanged', { size: plot[2] < 390 ? 9.5 : 10.5, align: 'center', col: COL.pass, p: 1, box: true });
    if (q >= 0.91) rich(g, plot[0] + plot[2] / 2, plot[1] + plot[3] - 14, 'new frozen values → a new Φ_{k+1} and a new surrogate', { size: plot[2] < 390 ? 9.5 : 10.5, align: 'center', col: COL.target, p: seg(q, 0.91, 0.98), box: true });
    var cx = g.ctx; cx.save(); cx.fillStyle = 'rgba(20,27,36,0.96)'; cx.fillRect(plot[0] + 5, plot[1] + 4, plot[2] - 10, 23); cx.font = '700 12.5px ' + g.sans; cx.fillStyle = C.gold; cx.textAlign = 'left'; cx.textBaseline = 'top'; cx.fillText(title, plot[0] + 10, plot[1] + 8); cx.restore();
    var info = surrogateLines(q), cardP = surrogateCardProgress(q); info.lines.forEach(function (it, i) { it.p = seg(cardP, 0.02 + 0.10 * i, 0.16 + 0.10 * i); });
    P.lines(g, card, info.lines, 1, info.title, { size: card[2] < 390 ? 10.5 : 11.5, rowH: 28 });
  }

  out.push({ id: 'sapphire-bridge', chapter: CH.inside, title: 'Three temporary bowls inside a 3D receiver view', layout: 'side', dur: 34,
    text: 'For this toy shared update, the objective function separates into three quadratic functions, one for each symbol estimate. The 3D drawing adds one real coordinate of SAPPHIRE’s frequency-domain response <b>C</b>. That response includes carrier coupling used to model intercarrier interference (ICI). Left–right is b<sub>i</sub>, front–back is that response coordinate, and height is cost. Demodulation is the operation, not a plotted variable. The bright <b>C</b> = <b>C</b><sup>k</sup> slice preserves the earlier one-symbol curve exactly. The entire receiver view, including the surrounding sheet, is schematic. ' +
      at(0.08, 'On that bright slice, the first bowl has curvature 2 and bottom 0.350. ') +
      at(0.18, 'The second slice has three equal-weight terms: one signal term and two check requests. Its curvature is 3, so its bowl is narrower, and its bottom is 0.533. ') +
      at(0.28, 'The third slice returns to curvature 2 and has its bottom at 0.750. ') +
      at(0.38, 'SAPPHIRE holds <b>C</b> fixed and moves all three symbol estimates together because they use the same old vector. This is one shared <b>b</b>-block update, not three coordinate-descent steps. ') +
      at(0.54, 'The replay enlarges symbol 2. Its positive slope 0.200 sends the estimate toward a smaller value. ') +
      at(0.70, 'Subtracting slope divided by curvature jumps directly from 0.600 to 0.533. The answer is already inside [0,1], so clipping does nothing. ') +
      at(0.84, 'SAPPHIRE builds an upper quadratic model of the fixed-weight received-signal cost. Here the bright fixed-response slice illustrates its touch, common slope and upper-bound relationship. Binary and ADMM terms then form the full temporary bowl. ') +
      at(0.94, 'The response direction exists, but this symbol update holds <b>C</b> fixed. Hold the weights, replicas, ledgers and every unshown symbol estimate fixed as well. The next page opens two symbol coordinates together and compares their cost with its temporary bowl.'),
    math: '',
    bowlModel: { bowls: bridgeBowls, cost: bridgeBowlCost, signalCost: bridgeSignalCost, jointCost: bridgeJointCost, responseMinimum: bridgeResponseMinimum, response: bridgeResponse },
    draw: function (g, q) { drawBridge(g, g.sideR, q); } });

  out.push({ id: 'sapphire-surrogate', chapter: CH.inside, title: 'The coupled surface and the easy bowl', layout: 'side', dur: 30,
    text: 'The previous page showed each symbol estimate on its own one-dimensional slice while the response stayed fixed. Now keep that frozen state and open two symbol coordinates together. The gold surface is a schematic teaching slice, not the complete receiver objective or a sampled receiver frame. ' +
      at(0.12, 'For this symbol update, hold <b>C</b><sup>k</sup>, the weights, the replicas, the ledgers and every unshown symbol estimate fixed. The resulting cost Φ<sub>k</sub>(b<sub>1</sub>,b<sub>2</sub>) is the actual cost of this frozen block. ') +
      at(0.23, 'At <b>b</b><sup>k</sup> = (0.100, 0.600), the two partial derivatives are −0.500 and +0.200. The implementation evaluates them from explicit formulas. They describe the local slopes; they do not move the estimates. ') +
      at(0.36, 'SAPPHIRE uses those slopes and safe curvatures to build the violet surrogate function. It is a quadratic function with one separate term for each shown symbol. It has the same height and the same slopes as the gold surface at the old point. ') +
      at(0.55, 'For this teaching slice, Φ̂<sub>k</sub> − Φ<sub>k</sub> = 0.30(Δb<sub>1</sub> − Δb<sub>2</sub>)². The difference is never negative and is zero at the old point, so the violet surface touches the gold surface and stays above it. ') +
      at(0.67, 'The solver jumps directly to the bottom of the violet bowl, (0.350, 0.533). Both coordinates come from the same old vector and move as one block. The solver minimizes the quadratic function directly; it does not take a sequence of gradient-descent steps. ') +
      at(0.80, 'At those new coordinates, the actual frozen cost is 0.070, no higher than the surrogate value 0.100 or the old value 0.169. This certifies a decrease for this frozen block; it does not certify a global minimum. ') +
      at(0.91, 'The constrained problem and its formula stay fixed. After the other blocks move, their new values produce Φ<sub>k+1</sub>, and the next round builds a new surrogate. The following page opens the violet bowl and reads its closed-form symbol rule.'),
    math: '',
    surrogateModel: { old: surrogateDemo.old, next: surrogateDemo.next, curvature: surrogateDemo.curvature, upper: surrogateUpper, actual: surrogateActual, gap: surrogateGap, slope: surrogateSlope },
    draw: function (g, q) { drawSurrogateDemo(g, g.sideR, q); } });

  out.push({ id: 'lbfgs', chapter: CH.beside, title: 'ADMM and L-BFGS work at different levels', layout: 'side', dur: 9,
    text: 'The constrained problem stays fixed for the whole run. What changes between rounds is the temporary objective Φ<sub>k</sub>(' + b + ') = f(' + b + ') + (ρ/2) Σ<sub>a</sub> ‖' + Sa + b + ' − ' + sup(za, 'k') + ' + ' + sup(ua, 'k') + '‖², the part of the augmented Lagrangian that depends on ' + b + ', with the replicas and the ledgers frozen. ' +
      at(0.36, 'Within one round Φ<sub>k</sub> does not change, so an inner optimizer can solve it. When Φ<sub>k</sub> is smooth and its gradients are available, the limited-memory Broyden–Fletcher–Goldfarb–Shanno method (L-BFGS), with the box bounds handled separately, could do that inner solve. ') +
      at(0.68, 'ADMM organizes the constrained problem, and L-BFGS could solve one frozen subproblem, so the two are not alternatives at the same level. The toy has a closed-form solution. Current SAPPHIRE instead uses the closed-form temporary-quadratic rule shown earlier.'),
    math: 'Φ<sub>k</sub>(' + b + ') = f(' + b + ') + (ρ/2) Σ<sub>a</sub> ‖' + Sa + b + ' − ' + sup(za, 'k') + ' + ' + sup(ua, 'k') + '‖²' + at(0.36, '<br>freeze ' + sup(za, 'k') + ', ' + sup(ua, 'k') + ' → minimize Φ<sub>k</sub> → update ' + za + ' → update ' + ua + ' → build Φ<sub>k+1</sub>'),
    draw: function (g, q) {
      var Rr = g.sideR, wideNow = Rr[2] >= 560; g.panel(Rr, 'an outer round and its inner solve');
      var items = [['freeze *z^k, *u^k', '', C.ink], ['minimize Φ_k(*b)', 'inner solver', COL.b], ['update *z', 'projections', COL.z], ['update *u', 'ledgers', COL.u], ['build Φ_{k+1}', '', COL.target]];
      var n = items.length, bw = wideNow ? Math.min(150, (Rr[2] - 40) / n - 14) : Math.min(260, Rr[2] - 60), bh = wideNow ? 62 : Math.min(54, (Rr[3] - 130) / n - 10), pos = [];
      if (!wideNow) bw = Rr[2] * 0.5;
      items.forEach(function (it, k) { var x = wideNow ? Rr[0] + 20 + k * (bw + 14) : Rr[0] + 28, y = wideNow ? Rr[1] + Rr[3] * 0.34 : Rr[1] + 44 + k * (bh + 10); pos.push([x, y]); P.box(g, x, y, bw, bh, it[0], it[1], it[2], seg(q, 0.36 + 0.06 * k, 0.46 + 0.06 * k)); });
      for (var k = 0; k + 1 < n; k++) { var p = seg(q, 0.42 + 0.06 * k, 0.5 + 0.06 * k); if (!(p > 0)) continue; var a0 = wideNow ? [pos[k][0] + bw, pos[k][1] + bh / 2] : [pos[k][0] + bw / 2, pos[k][1] + bh], a1 = wideNow ? [pos[k + 1][0], pos[k + 1][1] + bh / 2] : [pos[k + 1][0] + bw / 2, pos[k + 1][1]]; g.arrowPx(a0, [mix(a0[0], a1[0], p), mix(a0[1], a1[1], p)], 'rgba(242,245,248,0.7)', 1.8); }
      var mid = pos[1], pin = seg(q, 0.6, 0.75), inner = wideNow ? [mid[0] + bw / 2, mid[1] + bh + 46] : [mid[0] + bw + 4, mid[1] + bh / 2];
      if (pin > 0) {
        var cx = g.ctx; cx.save(); cx.globalAlpha = pin; cx.strokeStyle = COL.b; cx.lineWidth = 1.6; cx.beginPath(); cx.arc(inner[0] + (wideNow ? 0 : 20), inner[1] + (wideNow ? 0 : 0), 14, 0.2, 5.6); cx.stroke(); cx.restore();
        rich(g, wideNow ? inner[0] : inner[0] + 40, wideNow ? inner[1] + 28 : inner[1] - 8, wideNow ? 'the toy: one closed form' : 'the toy: closed form', { size: 11.5, col: COL.b, align: wideNow ? 'center' : 'left', p: pin });
        rich(g, wideNow ? inner[0] : inner[0] + 40, wideNow ? inner[1] + 46 : inner[1] + 10, wideNow ? 'smooth Φ_k: L-BFGS iterations' : 'smooth Φ_k: L-BFGS', { size: 11.5, col: COL.b, align: wideNow ? 'center' : 'left', p: seg(q, 0.66, 0.8) });
      }
      var yc = wideNow ? Rr[1] + Rr[3] * 0.74 : Rr[1] + Rr[3] - 40;
      rich(g, Rr[0] + 20, yc, 'within a round: Φ_k is fixed, and any good minimizer may solve it', { size: wideNow ? 13 : 11.5, col: COL.b, p: seg(q, 0.36, 0.5) });
      rich(g, Rr[0] + 20, yc + 24, 'between rounds: *z and *u move, so Φ_k changes', { size: wideNow ? 13 : 11.5, col: COL.target, p: seg(q, 0.72, 0.86) });
      var back = seg(q, 0.72, 0.86); if (back > 0) { var last = pos[n - 1], first = pos[0];
        var yb = wideNow ? Rr[1] + Rr[3] * 0.34 - 26 : Rr[1] + 34, cx2 = g.ctx; cx2.save(); cx2.globalAlpha = back; cx2.strokeStyle = COL.target; cx2.lineWidth = 1.6; cx2.setLineDash([5, 4]); cx2.beginPath();
        if (wideNow) { cx2.moveTo(last[0] + bw / 2, last[1]); cx2.lineTo(last[0] + bw / 2, yb); cx2.lineTo(first[0] + bw / 2, yb); cx2.stroke(); cx2.restore(); g.arrowPx([first[0] + bw / 2, yb], [first[0] + bw / 2, first[1] - 2], COL.target, 1.6); rich(g, (first[0] + last[0] + bw) / 2, yb - 12, 'the next round, k + 1', { size: 12, col: COL.target, align: 'center', p: back }); }
        else { var xl = Rr[0] + 12; cx2.moveTo(last[0], last[1] + bh / 2); cx2.lineTo(xl, last[1] + bh / 2); cx2.lineTo(xl, first[1] + bh / 2); cx2.stroke(); cx2.restore(); g.arrowPx([xl, first[1] + bh / 2], [first[0] - 2, first[1] + bh / 2], COL.target, 1.6); }
      }
    } });

  out.push({ id: 'sapphire-symbols', chapter: CH.inside, title: 'The clipped rule for each free symbol estimate', layout: 'side', dur: 11,
    text: 'A recorded frame is harder than the toy: one estimated channel links many symbol costs, so there is no separate average for each estimate. ' +
      at(0.16, 'SAPPHIRE freezes the channel ' + Cmat + ', the current sample weights, the replicas, the ledgers and the old vector ' + sup(b, 'k') + '. ') +
      at(0.34, 'For every free estimate, g<sub>i</sub><sup>k</sup> is the partial derivative, or slope, of the fixed-weight signal part of the objective function at ' + sup(b, 'k') + '. The value h<sub>i</sub><sup>k</sup> supplies a safe curvature for its temporary quadratic. ') +
      at(0.56, 'The binary push β pulls an uncertain estimate toward 0 or 1. The corrected requests ' + sup(ze('a', 'i'), 'k') + ' − ' + sup(ue('a', 'i'), 'k') + ' bring in every incident check. ') +
      at(0.76, 'The displayed fraction is the exact bottom of that one quadratic function. Clipping keeps it in [0,1]. Every free estimate uses the same old vector, so all free estimates update together; configured known symbols stay fixed. ') +
      at(0.93, 'Together, the bowls are a separable quadratic approximation. SAPPHIRE exactly minimizes them, not the full coupled symbol cost. This is majorization-minimization; it uses derivatives but is not gradient descent and does not run a separate iterative inner solver.'),
    math: 'g<sub>i</sub><sup>k</sup>: slope of the fixed-weight signal fit at ' + sup(b, 'k') +
      at(0.4, '<br>h<sub>i</sub><sup>k</sup>: safe curvature; η<sub>i</sub><sup>k</sup> = ρd<sub>i</sub> − 2β + h<sub>i</sub><sup>k</sup> &gt; 0') +
      at(0.6, '<br>β: push toward 0 or 1;  ' + sup(ze('a', 'i'), 'k') + ' − ' + sup(ue('a', 'i'), 'k') + ': corrected request from check a') +
      at(0.78, '<br>for each free i: ' + sup(bi('i'), 'k+1') + ' = Π<sub>[0,1]</sub>((ρ Σ<sub>a∋i</sub>(' + sup(ze('a', 'i'), 'k') + ' − ' + sup(ue('a', 'i'), 'k') + ') − g<sub>i</sub><sup>k</sup> − β + h<sub>i</sub><sup>k</sup>' + sup(bi('i'), 'k') + ')/η<sub>i</sub><sup>k</sup>)') +
      at(0.93, '<br>exact temporary-quadratic minimum ≠ exact minimum of the full coupled symbol cost'),
    draw: function (g, q) {
      blockFlow(g, g.sideR, [
        ['freeze the round', '*C + weights + old state', C.ink, 0.06],
        ['signal slope', 'g_i', COL.signal, 0.24],
        ['safe bend', 'h_i', COL.target, 0.4],
        ['two more pulls', 'β and *z − *u', COL.b, 0.58],
        ['bottom and clip', 'new *b^{k+1}', COL.pass, 0.78]
      ], q, 'every ingredient of the clipped rule has one job');
      rich(g, g.sideR[0] + g.sideR[2] / 2, g.sideR[1] + g.sideR[3] - 18, 'same old vector: all free estimates update together', { size: 12, col: COL.b, align: 'center', p: seg(q, 0.82, 0.94) });
    } });

  out.push({ id: 'sapphire-channel', chapter: CH.inside, title: 'The channel block solves one linear system', layout: 'side', dur: 9,
    text: 'After ' + b + ' moves, SAPPHIRE recomputes how much to trust each received sample. It then freezes ' + b + ' and those refreshed weights. With both fixed, the channel objective is a quadratic function. ' +
      at(0.3, 'The movable entries of the channel array ' + Cmat + ' are packed into the vector ' + cch + '. This is only a temporary view of the same channel. ') +
      at(0.5, 'The bottom satisfies the normal equations ' + Mmat + cch + ' = ' + rvec + '. The matrix ' + Mmat + ' says how the movable channel values affect one another. The vector ' + rvec + ' gathers what the received samples and current symbol estimates ask for. ') +
      at(0.76, 'For fixed ' + b + ' and weights, solving this system gives the exact channel minimum. The implementation uses a Cholesky factorization, then stores the solved entries back in ' + Cmat + '. ') +
      at(0.92, 'The updated channel changes the signal fit. The code constraints take their turn next.'),
    math: b + ' moved → recompute the weights → freeze ' + b + ' and the weights' + at(0.5, '<br>' + Mmat + cch + ' = ' + rvec + ' → solve for ' + cch) + at(0.76, '<br>Cholesky factorization → restore the entries in ' + Cmat),
    draw: function (g, q) {
      blockFlow(g, g.sideR, [
        ['*b moved', 'new symbol estimates', COL.b, 0.06],
        ['refresh weights', 'then freeze them', COL.signal, 0.22],
        ['pack the channel', 'movable *C → *c_ch', C.ink, 0.38],
        ['linear solve', '*M*c_ch = *r', COL.target, 0.56],
        ['restore *C', 'write the entries back', COL.pass, 0.8]
      ], q, 'the channel job after the symbol estimates move');
    } });

  out.push({ id: 'sapphire', chapter: CH.inside, title: 'Projection and ledger finish the update', layout: 'side', dur: 10,
    text: 'With ' + b + ' and ' + Cmat + ' updated, the code constraints take their turn. Check a receives ' + Sa + b + ' + ' + ua + ' and projects the whole vector onto its parity polytope. ' +
      at(0.28, 'The result ' + za + ' is the nearest legal replica vector. SAPPHIRE does not differentiate the parity constraints; it performs the same joint projection as the toy. ') +
      at(0.52, 'The scaled dual variable ' + ua + ' then adds the remaining disagreement ' + Sa + b + ' − ' + za + '. This carries unfinished disagreement into the next round; it is not a gradient calculation. Neither update uses derivatives. ') +
      at(0.76, 'The whole round is now visible: weights already entering the round, ' + b + ', weights refreshed after ' + b + ' moves, ' + Cmat + ', then ' + za + ' and ' + ua + '. ') +
      at(0.86, 'Implementation note: the registered run uses β = 0.8 and ρ = 3. It starts from hard decisions, with each replica at the projection of its symbol estimates. ') +
      at(0.9, 'It stops at the first rounded word that passes every check and the cyclic redundancy check (CRC), or after 200 updates. It also stops immediately if a symbol or channel calculation fails its numerical accuracy check.'),
    math: sup(za, 'k+1') + ' = Π<sub>𝒫a</sub>(' + Sa + sup(b, 'k+1') + ' + ' + sup(ua, 'k') + ')' +
      at(0.52, '<br>' + sup(ua, 'k+1') + ' = ' + sup(ua, 'k') + ' + ' + Sa + sup(b, 'k+1') + ' − ' + sup(za, 'k+1')) +
      at(0.76, '<br>current weights → ' + b + ' → refreshed weights → ' + Cmat + ' → ' + za + ' → ' + ua),
    draw: function (g, q) {
      blockFlow(g, g.sideR, [
        ['check input', '*S_a*b + *u_a', COL.b, 0.08],
        ['joint projection', 'nearest legal *z_a', COL.z, 0.26],
        ['what remains', '*S_a*b − *z_a', COL.target, 0.48],
        ['ledger update', '*u_a adds it', COL.u, 0.68]
      ], q, 'the two constraint updates use no derivatives');
      var fp = seg(q, 0.78, 0.92), fx = g.sideR[0] + g.sideR[2] / 2, fy = g.sideR[1] + g.sideR[3];
      if (P.wide(g.sideR)) rich(g, fx, fy - 18, 'β = 0.8, ρ = 3 • hard start • checks + CRC • 200 max • failed numerical check stops', { size: 12, col: C.dim, align: 'center', p: fp });
      else {
        rich(g, fx, fy - 34, 'β = 0.8, ρ = 3 • hard start', { size: 10.5, col: C.dim, align: 'center', p: fp });
        rich(g, fx, fy - 16, 'checks + CRC • 200 max • failed self-check stops', { size: 10.5, col: C.dim, align: 'center', p: fp });
      }
    } });

  out.push({ id: 'remember', chapter: CH.beside, title: 'What a method remembers decides where it can go', layout: 'side', dur: 9,
    text: 'The same three symbols and the same projection led to two endings. Without a ledger the run stopped at ' + word(AL.word) + ' with its copies ' + f2(AL.gap) + ' away; with a ledger it reached ' + word(FIN.word) + ' and full agreement. ' +
      at(0.3, 'CORAL, another receiver of this project, keeps one soft estimate per coded symbol and nothing persistent on Tanner-graph edges. SAPPHIRE keeps the same shared estimate plus one replica coordinate and one ledger entry on every edge. ') +
      at(0.55, 'Those persistent edge states are the fundamental difference: overlapping checks can retain separate, remembered requests for the same symbol. BP instead carries directed beliefs, while L-BFGS carries a short history of steps and gradient changes. ') +
      at(0.82, 'What an optimization method remembers, and how it represents constraints, determines where it can go.'),
    math: 'CORAL: one soft estimate per coded symbol' + at(0.3, '<br>SAPPHIRE: b<sub>i</sub> per symbol + (' + ze('a', 'i') + ', ' + ue('a', 'i') + ') per edge') + at(0.82, '<br>what it remembers + how it holds the constraints → where it can go'),
    draw: function (g, q) {
      P.table3(g, g.sideR, [['repair and average', '*b only', 'projections, forgotten each round'], ['SAPPHIRE (ADMM)', '*b, and *z_a, *u_a per edge', 'one parity polytope per check'], ['BP', 'L_{i→a}, L_{a→i} per edge', 'the check-node rule'],
        ['CORAL', 'one soft estimate per symbol', 'parity contributions in each update'], ['L-BFGS', 'recent steps and gradient changes', 'none: one smooth objective']], seg(q, 0.3, 0.8), 'what each method carries between iterations', { head: ['method', 'remembers', 'holds the constraints as'], shares: [0.27, 0.6], rowH: 58 });
    } });

  // ------------------------------------------------------------ player, chapter bar, keyboard, and deep links
  // Keep the mechanism contiguous: finish the toy, enter SAPPHIRE, then compare it with other methods.
  var lessonOrder = ['signal', 'checks', 'conflict', 'jobs', 'replicas', 'select', 'polytope', 'problem', 'no-ledger-arithmetic', 'no-ledger', 'ledger', 'edges', 'start', 'project', 'record', 'targets', 'shared', 'roles', 'rounds', 'answer', 'sapphire-bridge', 'sapphire-surrogate', 'sapphire-symbols', 'sapphire-channel', 'sapphire', 'bp', 'lbfgs', 'remember'];
  out.sort(function (a, bq) { return lessonOrder.indexOf(a.id) - lessonOrder.indexOf(bq.id); });
  var chapters = [];
  out.forEach(function (s, i) { if (!chapters.length || chapters[chapters.length - 1].name !== s.chapter) chapters.push({ name: s.chapter, start: i, n: 0 }); chapters[chapters.length - 1].n++; });
  var bar = document.getElementById('progress');
  if (bar) {
    bar.innerHTML = chapters.map(function (ch, k) { return '<button type="button" class="seg" data-k="' + k + '" style="flex-grow:' + ch.n + '" title="' + ch.name + '"><span class="fill"></span><span class="name">' + ch.name + '</span></button>'; }).join('');
    bar.addEventListener('click', function (e) { var bt = e.target.closest ? e.target.closest('[data-k]') : null; if (bt) B.go(chapters[+bt.getAttribute('data-k')].start); });
  }
  B.onStep(function (i) {
    if (!bar) return;
    Array.prototype.forEach.call(bar.querySelectorAll('[data-k]'), function (bt, k) { var ch = chapters[k], f = clamp((i - ch.start + 1) / ch.n, 0, 1); bt.querySelector('.fill').style.width = Math.round(f * 100) + '%'; bt.classList.toggle('on', i >= ch.start && i < ch.start + ch.n); });
  });
  document.addEventListener('keydown', function (e) { if (e.ctrlKey || e.metaKey || e.altKey) return; if (e.target && /^(INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY)$/.test(e.target.tagName) && (e.key === ' ' || e.key === 'Enter')) return; B.key(e); });
  B.openSteps(out, { embedded: true });
  window.course = { steps: out, chapters: chapters, three: d };
  var hash = (window.location && window.location.hash) || '', ms = /step=([^&]+)/.exec(hash), mp = /p=([0-9.]+)/.exec(hash);
  if (ms) { var st0 = decodeURIComponent(ms[1]); B.debug({ step: /^\d+$/.test(st0) ? +st0 : st0, p: mp ? +mp[1] : 1 }); }
})();
