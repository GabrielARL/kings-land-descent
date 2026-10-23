// "The BP protocol and the CAJODE constraint circuit": a mechanism-first comparison.  A receiver roadmap creates the need for
// the comparison; the counting formation introduces recipient-excluding messages; a connected Tanner chain teaches
// variable-to-check and check-to-variable BP; the known-channel CAJODE reduction handles the same evidence with
// relaxed bits, per-check replica variables and scaled dual variables; a loop shows what changes when information can return;
// and the last chapter restores the full OFDM receiver.  The numerical walks come from soldiers.js.
(function () {
  'use strict';
  var B = window.Board, M = window.Soldiers, P = window.SoldierParts; if (!B || !M || !P) return;
  var H = B.H, C = H.C, seg = H.seg, num = H.num, at = H.at, lerp2 = H.lerp2, ease = H.ease, clamp = H.clamp, sub = H.sub, add = H.add, scale = H.scale;
  var sgn = P.sgn, sub_ = P.subscript, BPC = P.BP, NOTE = P.NOTE, RECORD = P.RECORD, CARD = P.CARD, WRONG = P.WRONG;

  // ------------------------------------------------------------ the cases and their walks
  var T = M.TREE, L6 = M.LOOP, count = M.counting(), bp = M.treeBP(), BPH = bp.trace, nt = M.treeNotes(), NH = nt.hist;
  var lbp = M.loopBP('sp'), lnt = M.loopNotes(), LH = lnt.hist, co = M.coral(), CT = co.trace, cStop = CT[CT.length - 1], hill = M.hill(cStop.x, 240);
  var hillPeak = hill.reduce(function (a, b) { return b.J > a.J ? b : a; }), jSent = M.objective(L6.sent);
  function bits(w) { return w.join(''); }
  function signsOf(w) { return w.map(function (v) { return v > 0 ? '+' : '−'; }).join(''); }
  function bitWord(b) { return b.map(function (v) { return v >= 0.5 ? 1 : 0; }); }
  function bitsFromSigns(w) { return w.map(function (v) { return v > 0 ? 0 : 1; }); }
  function wordChanges(words) { var out = [[0, words[0]]]; for (var t = 1; t < words.length; t++) if (words[t].join() !== words[t - 1].join()) out.push([t, words[t]]); return out; }
  function triple(v, d) { return '(' + v.map(function (x) { return num(x, d == null ? 3 : d); }).join(', ') + ')'; }
  var cOf = M.checkOf(T.checks, 6);
  function slot(k, i) { return T.checks[k].indexOf(i); }

  // ------------------------------------------------------------ where everyone stands
  var TREEV = [-4.6, 4.6, -2.3, 2.25], TP = [[4.0, -1.2], [-3.5, -1.2], [-1.0, 0], [0.35, 1.55], [1.75, 0], [4.0, 1.2]], TJ = [[-2.3, 0], [0.35, 0], [2.85, 0]];
  var tpos = TP, tagAtTree = [[48, 6], [-48, 6], [-44, 26], [0, -44], [0, 30], [48, -6]];
  function polar(r, deg) { var a = deg * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)]; }
  var LOOPV = [-4.3, 4.3, -4.25, 3.85], LP = [polar(2.3, 240), polar(3.5, 180), polar(2.3, 120), polar(3.5, 60), polar(2.3, 0), polar(3.5, 300)], LJ = [polar(1.35, 180), polar(1.35, 60), polar(1.35, 300)];
  var tagAtLoop = LP.map(function (q) { var r = Math.hypot(q[0], q[1]); return [q[0] / r * 50, -q[1] / r * 40 - 4]; });
  var COUNTV = [-6.3, 6.4, -2.9, 2.75], CP = { O: [-5, 0], 1: [-3, 0], 2: [-1, 0], 3: [1, 1.4], 4: [3, 1.4], 5: [1, -1.4], 6: [3, -1.4], 7: [5, -1.4] };
  function cp(k) { return CP[k]; }

  // the comic of the tree with tags; o: { tags, tagCols, focus, lit, wrong, litCol }
  var startBits = M.hardBits(T.L), startWrong = startBits.map(function (v, i) { return v !== T.sent[i]; });
  function treeComic(g, o) { o = o || {}; P.comic(g, { code: T, pos: tpos, jpos: TJ, tags: o.tags, tagCols: o.tagCols, tagAt: tagAtTree, wrong: o.wrong || startWrong, focus: o.focus, lit: o.lit, litCol: o.litCol }); }
  var loopStartBits = M.hardBits(L6.L), loopWrong = loopStartBits.map(function (v, i) { return v !== L6.sentBits[i]; });
  function loopComic(g, o) { o = o || {}; P.comic(g, { code: L6, pos: LP, jpos: LJ, tags: o.tags, tagCols: o.tagCols, tagAt: tagAtLoop, wrong: o.wrong || loopWrong, focus: o.focus, lit: o.lit, litCol: o.litCol }); }
  function cardTags(b) { return b.map(function (v) { return num(v, 2); }); }
  function cardCols(b, sent) { return b.map(function (v, i) { return (v >= 0.5 ? 1 : 0) === sent[i] ? CARD : WRONG; }); }
  function wrongCards(b, sent) { return b.map(function (v, i) { return (v >= 0.5 ? 1 : 0) !== sent[i]; }); }

  var out = [], CH = { why: 'Why compare them?', count: 'Counting messages', bp: 'BP on an open chain', nt: 'CAJODE on the same chain', cmp: 'Same decoding task, different mechanism', loop: 'A related loop', optional: 'Optional: why not one gradient?', rx: 'Back inside the receiver' };

  // ------------------------------------------------------------ 0. why the receiver needs both lessons
  out.push({ id: 'roadmap', chapter: CH.why, title: 'One received OFDM frame, two ways to use the code', layout: 'side', dur: 6.2,
    text: 'An orthogonal frequency-division multiplexing (OFDM) receiver must infer the channel before it can form reliable bit evidence. In JADE, a channel estimate forms one channel log-likelihood ratio (LLR) for each coded bit, and belief propagation (BP) produces a posteriori information. The receiver subtracts the applied channel LLR from the a posteriori LLR to obtain extrinsic information. It adds α times that extrinsic term to the channel LLR and applies a tanh map to initialize joint channel estimation and decoding on the next pass. Here x = 1−2b, so x near +1 represents bit 0, and T is the initialization temperature. The channel evidence therefore remains in the initialization. CAJODE instead keeps the relaxed bits, channel, replica variables and scaled dual variables inside one alternating circuit. We first freeze the channel. Here, a constraint circuit means one pass through CAJODE’s resulting known-channel alternating direction method of multipliers (ADMM) updates; CAJODE does not call BP.',
    math: 'JADE: Lext = Lpost − Lch;  x₀ = tanh[(Lch + α Lext)/(2T)];  x = 1−2b;  x ≈ +1 ↔ bit 0;  T is the initialization temperature' + at(0.55, '<br>CAJODE: weights → relaxed bits → weights → channel → replica variables → scaled dual variables'),
    draw: function (g, p) {
      var R = g.sideR, c = g.ctx, mobile = R[2] < 520;
      g.panel(R, 'The destination of the lesson');
      function lane(y, title, boxes, col, q) {
        g.labelPx(R[0] + 16, y, title, col, { plain: true, size: 13, p: q });
        var n = boxes.length, gap = mobile ? 5 : 12, bw = mobile ? R[2] - 52 : (R[2] - 32 - gap * (n - 1)) / n, bh = mobile ? 23 : 40;
        boxes.forEach(function (name, j) {
          var x = mobile ? R[0] + 26 : R[0] + 16 + j * (bw + gap), yy = mobile ? y + 18 + j * (bh + gap) : y + 23, qq = seg(q, j / (n + 1), (j + 1.2) / (n + 1));
          if (!(qq > 0)) return; c.globalAlpha = qq; c.strokeStyle = col; c.fillStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 1.5; c.beginPath(); c.rect(x, yy, bw, bh); c.fill(); c.stroke(); c.globalAlpha = 1;
          var labelSize = mobile ? 11.5 : 11;
          if (!mobile) while (labelSize > 8.5) { c.font = '600 ' + labelSize + 'px ' + g.sans; if (c.measureText(name).width <= bw - 8) break; labelSize -= 0.5; }
          g.labelPx(x + bw / 2, yy + bh / 2, name, C.ink, { plain: true, size: labelSize, align: 'center', p: qq });
          if (j) { if (mobile) g.arrowPx([x + bw / 2, yy - 7], [x + bw / 2, yy - 1], col, 1.4); else g.arrowPx([x - gap + 2, yy + bh / 2], [x - 2, yy + bh / 2], col, 1.4); }
        });
      }
      lane(R[1] + 46, 'JADE: modules exchange soft information', ['channel LLR Lch', 'BP posterior Lpost', 'Lext = Lpost − Lch', 'Lch + α Lext', 'tanh map', 'next joint step'], BPC, seg(p, 0.05, 0.55));
      lane(R[1] + (mobile ? 258 : 160), 'CAJODE: variables share one constrained objective', ['weights', 'relaxed bits', 'weights', 'channel', 'replica variables', 'scaled dual variables'], NOTE, seg(p, 0.45, 0.95));
    } });

  // ------------------------------------------------------------ 1. counting soldiers
  var EDGES = count.towards.map(function (m) { return [m.from, m.to]; });
  function formation(g, p, o) {
    o = o || {};
    M.COUNT.edges.forEach(function (e, j) { g.line(cp(e[0]), cp(e[1]), 'rgba(242,245,248,0.42)', 1.6, o.appear ? seg(p, 0.05 + 0.04 * j, 0.15 + 0.04 * j) : 1); });
    M.COUNT.nodes.forEach(function (k, j) { var q = o.appear ? seg(p, 0.02 + 0.05 * j, 0.14 + 0.05 * j) : 1; P.soldier(g, cp(k), { officer: k === 'O', p: q, name: k === 'O' ? 'officer' : 'soldier ' + k }); });
  }
  function restTag(from, to, side) { var m = lerp2(cp(from), cp(to), 0.5); return add(m, [0, side * 0.32]); }
  out.push({ id: 'count', chapter: CH.count, title: 'How many soldiers are there?', layout: 'map', view: COUNTV, dur: 5.4,
    text: 'Soldiers stand in a line that forks, and nobody can see the whole formation. The officer wants to know how many soldiers there are, yet each soldier hears only the soldiers next to it. The BP soldier’s rule, from belief propagation (BP), counts them anyway: tell each neighbour 1 plus the numbers you heard from all your other neighbours.',
    math: 'the BP soldier’s rule: to each neighbour, 1 + the numbers heard from all the other neighbours',
    draw: function (g, p) {
      formation(g, p, { appear: true });
      var O = g.P(cp('O')), S2 = g.P(cp(2));
      P.bubble(g, O[0] - 30, O[1] - 110, ['How many', 'soldiers are there?'], O[0] + 4, O[1] - 26, { p: seg(p, 0.45, 0.6) });
      P.bubble(g, S2[0] - 210, S2[1] + 62, ['I hear three soldiers:', 'one on my left,', 'two on my right.'], S2[0] - 4, S2[1] + 44, { p: seg(p, 0.62, 0.78), col: C.blue });
    } });
  var towardsOrder = [[0, 2], [1, 3], [4], [5], [6]], backOrder = [[0], [1], [2, 4], [3, 5], [6]];
  function trip(g, p, list, order, side, col, keep) {
    order.forEach(function (grp, w) {
      var q = seg(p, 0.08 + 0.16 * w, 0.24 + 0.16 * w);
      grp.forEach(function (j) { var m = list[j]; if (q < 1) P.flyTag(g, cp(m.from), cp(m.to), q, String(m.value), col); else g.label(restTag(m.from, m.to, side), String(m.value), col, { align: 'center', size: 12.5, mono: true }); });
    });
    if (keep) keep.forEach(function (m) { g.label(restTag(m.from, m.to, -side), String(m.value), 'rgba(169,205,246,0.55)', { align: 'center', size: 12, mono: true }); });
  }
  out.push({ id: 'towards', chapter: CH.count, title: 'Towards the officer', layout: 'map', view: COUNTV, dur: 6.4,
    text: 'The count starts at the tips. A soldier at a tip has no other neighbour, so it sends 1. Soldier 3 hears 1 from soldier 4 and sends 2; soldier 5 hears 2 from soldier 6 and sends 3. At the fork, soldier 2 adds both branches and itself and sends 6. Soldier 1 adds itself and tells the officer 7.<details class="predict"><summary>Predict the fork’s message</summary><p>Soldier 2 has heard 2 from above and 3 from below. What should it tell soldier 1 if it also counts itself? Reveal: 2 + 3 + 1 = 6.</p></details>',
    math: '4→3: 1,  7→6: 1,  3→2: 2,  6→5: 2,  5→2: 3,  2→1: 6,  1→officer: ' + at(0.85, '7'),
    draw: function (g, p) {
      formation(g, p); trip(g, p, count.towards, towardsOrder, 1, BPC);
      var O = g.P(cp('O')); P.bubble(g, O[0] - 20, O[1] - 96, ['Seven.'], O[0] + 4, O[1] - 26, { p: seg(p, 0.9, 1) });
    } });
  out.push({ id: 'return', chapter: CH.count, title: 'The return trip', layout: 'map', view: COUNTV, dur: 6.4,
    text: 'The officer now knows 7, but the soldiers in the branches know only their own side. So numbers travel back. The officer adds no soldier and sends 0. At the fork, soldier 2 sends a different number to each branch, and each number leaves out what that branch told it: 1 + 3 + 1 = 5 up, without the upper branch’s 2, and 1 + 2 + 1 = 4 down.',
    math: 'officer→1: 0,  1→2: 1,  2→3: 5,  2→5: 4,  3→4: 6,  5→6: 5,  6→7: 6',
    draw: function (g, p) {
      formation(g, p); trip(g, p, count.back, backOrder, -1, NOTE, count.towards);
      var S2 = g.P(cp(2)); P.bubble(g, S2[0] - 230, S2[1] + 62, ['Up I send 5, down I send 4:', 'each leaves out what', 'that branch told me.'], S2[0] - 4, S2[1] + 44, { p: seg(p, 0.5, 0.66), col: NOTE });
    } });
  out.push({ id: 'everyone', chapter: CH.count, title: 'Everyone knows the count', layout: 'map', view: COUNTV, dur: 5.6,
    text: 'Each soldier adds every number it heard, one per neighbour, plus its own 1, and every total is 7. No soldier ever sent a neighbour back that neighbour’s own number, so nobody was counted twice. The BP soldier keeps one number per neighbour, each way. Two trips are enough because the formation has no loop.',
    math: 'soldier 2: 1 + 2 + 3 + 1 = 7;  ' + at(0.6, 'every soldier: 7'),
    draw: function (g, p) {
      formation(g, p);
      count.towards.forEach(function (m) { g.label(restTag(m.from, m.to, 1), String(m.value), 'rgba(169,205,246,0.6)', { align: 'center', size: 11.5, mono: true }); });
      count.back.forEach(function (m) { g.label(restTag(m.from, m.to, -1), String(m.value), 'rgba(255,176,113,0.6)', { align: 'center', size: 11.5, mono: true }); });
      [1, 2, 3, 4, 5, 6, 7].forEach(function (k, j) { var q = seg(p, 0.15 + 0.08 * j, 0.3 + 0.08 * j), heard = count.nb[k].map(function (m) { return count.towards.concat(count.back).filter(function (x) { return x.from === m && x.to === k; })[0].value; }); g.label(cp(k), heard.join(' + ') + ' + 1 = 7', C.gold, { dy: -50, align: 'center', size: 12.5, p: q }); });
      g.labelPx(g.mapR[0] + 14, g.mapR[1] + 18, 'each total: the numbers heard, one per neighbour, plus the soldier’s own 1', C.gold, { size: 12.5, p: seg(p, 0.75, 0.9) });
    } });

  // ------------------------------------------------------------ 2. BP on a connected cycle-free Tanner graph
  var llrTags = T.L.map(function (v) { return sgn(v); }), I1 = BPH[0], I2 = BPH[1], I3 = BPH[2];
  out.push({ id: 'key', chapter: CH.bp, title: 'Translate the formation into a decoder', layout: 'side', dur: 5.4,
    text: 'The counting rule was the analogy; the reusable idea is that every directed message summarizes everything except the neighbour receiving it. Now a soldier is one coded bit and a junction is one parity check. The channel supplies a channel LLR, not a hard truth. We use one convention throughout: a positive channel LLR favours bit 0, a negative one favours bit 1, and a relaxed bit value near 1 represents bit 1.',
    math: 'Lᶜʰ(i) = log[p(y(i) | b(i)=0) / p(y(i) | b(i)=1)]' + at(0.62, '<br>bit 0 ↔ positive LLR ↔ relaxed bit 0;  bit 1 ↔ negative LLR ↔ relaxed bit 1'),
    draw: function (g, p) {
      P.table(g, g.sideR, [['soldier', 'coded bit b(i)'], ['junction', 'parity check c(a)'], ['number sent towards a junction', 'variable-to-check message q(i→a)'], ['number sent back', 'check-to-variable message r(a→i)'], ['final total', 'a posteriori LLR']], { head: ['formation', 'decoder'], cols: [0, 0.47], title: 'What transfers from the analogy', p: p, reveal: true, mono: false, colours: function (i, j) { return j ? C.ink : C.gold; } });
    } });
  out.push({ id: 'tree', chapter: CH.bp, title: 'An open chain: six bits, three parity checks', layout: 'map+side', view: TREEV, dur: 5.8,
    text: 'The graph is connected and has no loop. Bits 2 and 4 each belong to two parity checks, so evidence must cross them. Every check requires an even number of ones. The channel initially decides ' + bits(bp.before) + '; only bit 0 is wrong, and its channel LLR has the smallest magnitude. Only check c₂ fails. The sent word is visible to us for teaching but unavailable to the receiver.',
    math: 'c₀={1,2},  c₁={2,3,4},  c₂={4,5,0}' + at(0.55, '<br>sent ' + bits(T.sent) + ';  channel decision ' + bits(bp.before) + ';  syndrome (' + bp.synBefore.join(',') + ')'),
    draw: function (g, p) {
      treeComic(g, { tags: llrTags });
      var rows = [0, 1, 2, 3, 4, 5].map(function (i) { return [String(i), sgn(T.y[i]), sgn(T.L[i]), String(T.sent[i]), String(bp.before[i])]; });
      P.table(g, g.sideR, rows, { head: ['bit', 'sample y', 'channel LLR', 'sent*', 'decides'], cols: [0, 0.16, 0.38, 0.7, 0.85], title: '*sent is visible only to the learner', p: p, reveal: true, colours: function (i, j) { return i === 0 && (j === 2 || j === 4) ? WRONG : j === 0 ? C.dim : C.ink; } });
    } });
  out.push({ id: 'listen', chapter: CH.bp, title: 'Iteration 1 starts with channel evidence', layout: 'map+side', view: TREEV, dur: 5.6,
    text: 'Before any reply exists, every variable-to-check message is its channel LLR. Shared bits 2 and 4 send the same initial number toward both neighbouring checks. Later, each adds the reply from its other check while still excluding the check it is answering. <details class="predict"><summary>Predict before revealing the next page</summary><p>When c₀ replies to bit 2, may it reuse bit 2’s own +0.80? Decide before continuing.</p></details>',
    math: 'q(i→a) = Lᶜʰ(i) + Σ r(a′→i),  a′ ≠ a' + at(0.58, '<br>iteration 1: no replies yet, so q(i→a) = Lᶜʰ(i)'),
    draw: function (g, p) {
      treeComic(g, { tags: llrTags });
      T.checks.forEach(function (c, k) { c.forEach(function (i, j) { var q = seg(p, 0.05 + 0.08 * j + 0.24 * k, 0.25 + 0.08 * j + 0.24 * k); if (q > 0 && q < 1) P.flyTag(g, TP[i], TJ[k], q, sgn(T.L[i]), C.gold); }); });
      P.zoom(g, g.sideR, { k: 0, members: T.checks[0], up: T.checks[0].map(function (i) { return sgn(T.L[i]); }), wrong: startWrong, title: 'Iteration 1 at c₀', bubble: ['The first messages are', 'channel LLRs only.'], bubbleP: seg(p, 0.55, 0.75), p: 1 });
    } });
  out.push({ id: 'reply-c0', chapter: CH.bp, title: 'A check reply excludes its recipient', layout: 'map+side', view: TREEV, dur: 6.4,
    text: 'The answer is no. Check c₀ contains only bits 1 and 2. Its reply to bit 2 uses bit 1 alone, so r(c₀→2) = +4.00. Its reply to bit 1 uses bit 2 alone, so r(c₀→1) = +0.80. A check-to-variable message is extrinsic support: the reply never reuses the recipient’s own incoming message.',
    math: 'r(a→i) = 2 atanh ∏ⱼ≠ᵢ tanh[q(j→a)/2]' + at(0.5, '<br>r(c₀→2) = q(1→c₀) = ' + sgn(I1.U['0,2'])) + at(0.76, ';  r(c₀→1) = q(2→c₀) = ' + sgn(I1.U['0,1'])),
    draw: function (g, p) {
      var q = seg(p, 0.18, 0.72), active = p < 0.58 ? 0 : 1, members = T.checks[0], target = active ? 2 : 1;
      treeComic(g, { tags: llrTags, focus: 0, lit: ['0,' + target], litCol: BPC });
      P.flyTag(g, TJ[0], TP[target], q, sgn(I1.U['0,' + target]), BPC);
      P.zoom(g, g.sideR, { k: 0, members: members, up: members.map(function (i) { return sgn(T.L[i]); }), down: active ? [null, sgn(I1.U['0,2'])] : [sgn(I1.U['0,1']), null], active: active, wrong: startWrong, title: 'The two replies of c₀', bubble: active ? ['For bit 2, I use', 'bit 1 only.'] : ['For bit 1, I use', 'bit 2 only.'], bubbleP: seg(p, active ? 0.6 : 0.1, active ? 0.8 : 0.35) });
    } });
  out.push({ id: 'reply-c1', chapter: CH.bp, title: 'Evidence crosses a shared bit', layout: 'map+side', view: TREEV, dur: 6.2,
    text: 'Bit 2 receives +4.00 from c₀. When it next answers c₁, it adds that support to its own +0.80, giving q(2→c₁) = +4.80; it still excludes c₁’s own previous reply. Check c₁ can now give bit 4 much stronger support for one: r(c₁→4) changes from −0.72 to −2.85. This is the counting rule doing useful work: information has crossed c₀, bit 2, and c₁ without being echoed straight back.',
    math: 'q(2→c₁) = Lᶜʰ(2) + r(c₀→2) = 0.80 + 4.00 = ' + sgn(I2.V['1,2']) + at(0.55, '<br>r(c₁→4): ' + sgn(I1.U['1,4']) + ' → ' + sgn(I2.U['1,4'])),
    draw: function (g, p) {
      var phone = g.W < 480;
      treeComic(g, { tags: llrTags, lit: ['0,2', '1,2', '1,4'], litCol: BPC });
      // The two travelling values share one short horizontal run.  Put them on opposite sides of the edge so the
      // labels do not cover the central check or the receiving soldier when the map is stacked on a phone.
      P.flyTag(g, TP[2], TJ[1], seg(p, 0.12, 0.48), sgn(I2.V['1,2'], phone ? 1 : 2), BPC, { rest: 0.45, dx: -24, dy: -28, size: phone ? 11 : 12 });
      P.flyTag(g, TJ[1], TP[4], seg(p, 0.5, 0.88), sgn(I2.U['1,4']), BPC, { rest: 0.45, dx: 24, dy: -28, size: phone ? 11 : 12 });
      P.table(g, g.sideR, [['c₀→bit 2', 'support arrives', sgn(I1.U['0,2'])], ['bit 2→c₁', '0.80 + 4.00', sgn(I2.V['1,2'])], ['c₁→bit 4', 'reply strengthens', sgn(I2.U['1,4'])]], { head: ['edge', 'mechanism', 'value'], cols: [0, 0.36, 0.78], title: 'The wave moves one edge per half-step', p: p, reveal: true, mono: false, colours: function (i, j) { return j === 2 ? BPC : C.ink; } });
    } });
  out.push({ id: 'decide', chapter: CH.bp, title: 'Evidence crosses the chain before the word settles', layout: 'map+side', view: TREEV, dur: 6.4,
    text: 'The hard word stays ' + bits(bp.before) + ' after iterations 1 and 2 because the wave has not yet reached bit 0 strongly enough. Meanwhile c₂’s reply to bit 0 grows from +0.29 to +0.50 and then +0.76. On iteration 3 it finally outweighs bit 0’s channel LLR of −0.60, so bit 0 turns to zero and all checks accept ' + bits(I3.bits) + '. On a cycle-free graph, sum-product BP is exact after information has had time to traverse the graph—not necessarily after one flooding iteration.',
    math: 'r(c₂→0): ' + sgn(I1.U['2,0']) + ' → ' + sgn(I2.U['2,0']) + ' → ' + sgn(I3.U['2,0']) + at(0.58, '<br>hard words: ' + bits(bp.before) + ' → ' + bits(I1.bits) + ' → ' + bits(I2.bits) + ' → ' + bits(I3.bits)),
    draw: function (g, p) {
      var s = Math.min(3, Math.floor(seg(p, 0.06, 0.9) * 4)), state = s ? BPH[s - 1] : null, word = state ? state.bits : bp.before, totals = state ? state.B : T.L;
      treeComic(g, { tags: totals.map(function (v) { return sgn(v, 2); }), tagCols: word.map(function (v, i) { return v === T.sent[i] ? BPC : WRONG; }), wrong: word.map(function (v, i) { return v !== T.sent[i]; }) });
      var rows = [['channel', bits(bp.before), '(' + bp.synBefore.join(',') + ')'], ['iteration 1', bits(I1.bits), '(' + I1.syn.join(',') + ')'], ['iteration 2', bits(I2.bits), '(' + I2.syn.join(',') + ')'], ['iteration 3', bits(I3.bits), '(' + I3.syn.join(',') + ')']];
      P.table(g, g.sideR, rows.slice(0, s + 1), { head: ['stage', 'hard word', 'syndrome'], cols: [0, 0.44, 0.74], title: 'Hard decisions and parity checks', p: 1, lit: s, mono: false, colours: function (i, j) { return j === 1 && rows[i][1] === bits(T.sent) ? C.gold : j === 2 ? C.dim : C.ink; } });
    } });

  // ------------------------------------------------------------ 3. CAJODE's constraint circuit on the same chain
  var H0 = NH[0], H1 = NH[1], H2 = NH[2], H3 = NH[3];
  // markers on the comic: a per-check replica variable beside each check and a scaled-dual dot on every edge
  function recordTag(g, k, z, p) { g.label(TJ[k], 'replica z', RECORD, { dy: k === 1 ? -34 : 34, align: 'center', size: 11.5, p: p }); }
  function noteTags(g, u, p) { T.checks.forEach(function (c, k) { c.forEach(function (i, j) { g.dot(lerp2(TJ[k], TP[i], 0.55), 3.5 + 4 * Math.min(1, Math.abs(u[k][j]) / 0.4), P.NOTE, p); }); }); }
  out.push({ id: 'cast', chapter: CH.nt, title: 'Three kinds of optimization variable, with clear owners', layout: 'map+side', view: TREEV, dur: 6,
    text: 'CAJODE, the project’s code-aided joint OFDM demodulation and error-correction receiver, uses the alternating direction method of multipliers (ADMM). Here the channel is frozen, leaving the part we call its constraint circuit. Each bit owns one relaxed bit variable b(i) between 0 and 1. Each check owns one replica variable z(a,i) for every incident bit and keeps that vector inside its parity polytope. Each check–bit edge owns one scaled dual variable u(a,i), which accumulates continuous disagreement b(i)−z(a,i). The drawings call z a record and u a note. These are optimization variables, not BP beliefs or BP messages.',
    math: 'bit i: b(i) ∈ [0,1];  check a: z(a) ∈ parity polytope;  edge (a,i): scaled dual u(a,i)',
    draw: function (g, p) {
      treeComic(g, { tags: cardTags(H0.b), tagCols: cardCols(H0.b, T.sent), wrong: wrongCards(H0.b, T.sent) });
      recordTag(g, 0, H0.z[0], seg(p, 0.5, 0.65)); recordTag(g, 1, H0.z[1], seg(p, 0.55, 0.7)); recordTag(g, 2, H0.z[2], seg(p, 0.6, 0.75)); noteTags(g, H0.u, seg(p, 0.72, 0.88));
      g.labelPx(g.mapR[0] + 14, g.mapR[1] + 18, 'orange dot: one scaled dual variable on each check–bit edge', P.NOTE, { size: 12, p: seg(p, 0.78, 0.94) });
      var R = g.sideR; g.panel(R, 'Ownership in the CAJODE constraint circuit');
      var items = [[CARD, 'bit i owns b(i) ∈ [0,1]', 'one shared relaxed bit variable'], [RECORD, 'check a owns vector z(a)', 'one entry for every incident bit'], [NOTE, 'edge (a,i) owns u(a,i)', 'accumulated relaxed disagreement']];
      items.forEach(function (it, j) { var y = R[1] + 56 + j * 52, q = seg(p, 0.1 + 0.12 * j, 0.25 + 0.12 * j); g.labelPx(R[0] + 16, y, it[1], it[0], { plain: true, size: 13, p: q }); g.labelPx(R[0] + 16, y + 19, it[2], C.dim, { plain: true, size: 12, p: q }); });
      g.labelPx(R[0] + 16, R[1] + 230, 'The next pages introduce the valid set, then initialize these variables, then run the circuit.', C.gold, { plain: true, size: 12, p: seg(p, 0.58, 0.78) });
    } });
  var AX0 = ['bit 4', 'bit 5', 'bit 0'];
  out.push({ id: 'polytope', chapter: CH.nt, title: 'First define the allowed replica values', layout: 'map', view: TREEV, dur: 6.8,
    text: 'For the three local entries of c₂, the eight binary patterns are the cube’s corners. The four patterns 000, 011, 101 and 110 have even parity and are valid. Their mixtures fill the parity polytope, the blue solid. The channel’s hard pattern at c₂ is 111, outside that solid. First identify the allowed set; only then should we project onto it.<details class="predict"><summary>Predict the nearest lawful direction</summary><p>Should 111 jump to one valid corner, or land at a mixture of several valid corners? Decide before continuing.</p></details>',
    math: 'valid corners: 000, 011, 101, 110;  parity polytope = their convex hull',
    draw: function (g, p) {
      P.cube(g, { R: g.mapR, yaw: 0.35 + 0.5 * ease(p), pitch: 0.42, p: seg(p, 0, 0.25), axes: AX0, from: p > 0.55 ? [1, 1, 1] : null, labelFrom: 'hard pattern 111' });
      g.labelPx(g.mapR[0] + 14, g.mapR[1] + 18, 'check c₂: the cube of its three local entries', C.gold, { size: 13 });
      g.labelPx(g.mapR[0] + 14, g.mapR[1] + g.mapR[3] - 18, 'blue: the four valid patterns and the solid they span', C.blue, { size: 12, p: seg(p, 0.25, 0.4) });
    } });
  function tellOf(h, i) { return h.tell[i]; }
  function edgeRows(h) { var rows = []; T.checks.forEach(function (c, k) { c.forEach(function (i, j) { rows.push([String(i), 'c' + sub_(k), h.tell ? num(h.tell[i], 2) : '—', num(h.b[i], 2), num(h.z[k][j], 2), num(h.u[k][j], 2)]); }); }); return rows; }
  out.push({ id: 'start', chapter: CH.nt, title: 'Initialize the three kinds of variable', layout: 'map+side', view: TREEV, dur: 6.2,
    text: 'Now the walk may start. The channel hard decisions initialize the shared relaxed bits: b = ' + bits(H0.word) + '. Each check initializes its own replica at the nearest point in its parity polytope. Checks c₀ and c₁ already see valid patterns, while c₂’s 111 becomes the symmetric mixture (⅔, ⅔, ⅔). Every scaled dual variable starts at zero. The prediction answer is therefore a mixture, not one arbitrarily chosen corner.',
    math: 'b = ' + triple(H0.b, 0) + ';  z(c₂) = Π(1,1,1) = ' + triple(H0.z[2]) + ';  u(a,i) = 0',
    draw: function (g, p) {
      treeComic(g, { tags: cardTags(H0.b), tagCols: cardCols(H0.b, T.sent), wrong: wrongCards(H0.b, T.sent), focus: 2 });
      recordTag(g, 0, H0.z[0], seg(p, 0.25, 0.4)); recordTag(g, 1, H0.z[1], seg(p, 0.35, 0.5)); recordTag(g, 2, H0.z[2], seg(p, 0.45, 0.6)); noteTags(g, H0.u, 1);
      P.zoom(g, g.sideR, { k: 2, members: T.checks[2], up: ['1', '1', '1'], upCol: CARD, cards: H0.z[2].map(function (v) { return 'z ' + num(v, 2); }), cardCol: RECORD, wrong: wrongCards(H0.b, T.sent), title: 'Initialization at c₂', bubble: ['111 is not valid;', 'the nearest lawful mixture', 'is (⅔, ⅔, ⅔).'], bubbleP: seg(p, 0.55, 0.8) });
    } });
  out.push({ id: 'read1', chapter: CH.nt, title: 'Circuit 1: the soldiers read', layout: 'map+side', view: TREEV, dur: 6.2,
    text: 'A circuit starts with the shared relaxed bits. Bit i combines its channel LLR with one record-minus-dual term from every check it belongs to. The parameter ρ = 3 weights agreement, while β = 0.8 pushes relaxed values toward 0 or 1. In circuit 1 the channel evidence is still strong enough that none of the hard decisions changes: the cards remain ' + bits(H1.word) + '. That matters—the dual variables must first remember the continuous disagreement before the wrong hard bit can turn.',
    math: 'b(i) ← Π[0,1][(ρ Σₐ(z(a,i) − u(a,i)) − Lᶜʰ(i) − β)/(ρ d(i) − 2β)]' + at(0.62, '<br>circuit 1: b = ' + triple(H1.b, 2) + ', hard word ' + bits(H1.word)),
    draw: function (g, p) {
      var q = seg(p, 0.15, 0.55), done = p > 0.6, b = done ? H1.b : H0.b;
      treeComic(g, { tags: cardTags(b), tagCols: cardCols(b, T.sent), wrong: wrongCards(b, T.sent) });
      T.checks.forEach(function (c, k) { c.forEach(function (i, j) { if (q > 0 && q < 1) P.flyTag(g, TJ[k], TP[i], q, num(H0.z[k][j] - H0.u[k][j], 2), RECORD); }); });
      P.table(g, g.sideR, [0, 2, 4].map(function (i) { return [String(i), String(cOf[i].length), num(tellOf(H1, i), 2), num(T.L[i], 2), num(H1.b[i], 2)]; }), { head: ['bit', 'checks', 'Σ(z−u)', 'channel LLR', 'new b'], cols: [0, 0.16, 0.34, 0.58, 0.82], title: 'Three bits along the chain', p: p, reveal: true, colours: function (i, j) { return j === 4 ? CARD : j === 2 ? RECORD : C.ink; } });
    } });
  out.push({ id: 'project1', chapter: CH.nt, title: 'Circuit 1: each check projects its replica', layout: 'map+side', view: TREEV, dur: 6.6,
    text: 'Next each check reads its incident cards plus its edge duals and replaces its local replica by the nearest point in the parity polytope. At c₂ the input is still 111. Its nearest point is not one valid corner: it is the equal mixture (⅔, ⅔, ⅔) on the face that cuts off 111. Checks c₀ and c₁ already receive points in their valid sets, so those replicas stay put.',
    math: 'z(a) ← Πparity-polytope[b(a) + u(a)]' + at(0.5, ';  z(c₂) = Π' + triple(H1.sums[2]) + ' = ' + triple(H1.z[2])),
    draw: function (g, p) {
      var phone = g.W < 480;
      P.cube(g, { R: g.mapR, yaw: 0.55 + 0.25 * ease(p), pitch: 0.42, p: 1, axes: AX0, from: H1.sums[2], to: H1.z[2], moveP: seg(p, 0.35, 0.7),
        labelFrom: phone ? 'input (1, 1, 1)' : 'cards plus duals ' + triple(H1.sums[2], 2), labelTo: 'replica ' + triple(H1.z[2], 2), labelBroken: !phone, face: true });
      g.labelPx(g.mapR[0] + 14, g.mapR[1] + 18, phone ? 'check c₂: project onto the valid solid' : 'check c₂: Euclidean projection onto the valid solid', C.gold, { size: phone ? 12 : 13 });
      P.zoom(g, g.sideR, { k: 2, members: T.checks[2], up: T.checks[2].map(function (i, j) { return num(H1.sums[2][j], 2); }), upCol: CARD, cards: T.checks[2].map(function (i, j) { return 'z ' + num(H1.z[2][j], 2); }), cardCol: RECORD, wrong: wrongCards(H1.b, T.sent), title: 'Zoom on check c₂', bubble: ['The nearest valid point', 'is ' + triple(H1.z[2], 2) + '.'], bubbleP: seg(p, 0.6, 0.8) });
    } });
  out.push({ id: 'notes1', chapter: CH.nt, title: 'Circuit 1: the notes', layout: 'map+side', view: TREEV, dur: 5.6,
    text: 'Last, each edge dual adds its signed relaxed disagreement b(i)−z(a,i). At c₂ every card is 1 while every local replica is ⅔, so its three duals become +⅓. The other duals remain zero. A dual changes whenever b and z disagree continuously; it is not a flag saying that the thresholded parity check failed. Here both happen together, but the later comparison will separate them.',
    math: 'u(a,i) ← u(a,i) + b(i) − z(a,i)' + at(0.45, ';  u(c₂) = ' + triple(H1.u[2]) + ';  other duals = 0') + at(0.8, '<br>hard word ' + bits(H1.word) + ', syndrome (' + M.syndrome(H1.word, T.checks).join(',') + ')'),
    draw: function (g, p) {
      treeComic(g, { tags: cardTags(H1.b), tagCols: cardCols(H1.b, T.sent), wrong: wrongCards(H1.b, T.sent), lit: p > 0.2 ? ['2,4', '2,5', '2,0'] : null, litCol: NOTE });
      recordTag(g, 2, H1.z[2], 1); noteTags(g, H1.u, seg(p, 0.3, 0.55));
      g.labelPx(g.mapR[0] + 14, g.mapR[1] + 18, 'three c₂ edge duals grow from 0 to +⅓', P.NOTE, { size: 12, p: seg(p, 0.5, 0.7) });
      P.zoom(g, g.sideR, { k: 2, members: T.checks[2], up: T.checks[2].map(function (i, j) { return 'u ' + num(H1.u[2][j], 2); }), upCol: NOTE, cards: T.checks[2].map(function (i) { return num(H1.b[i], 2); }), wrong: wrongCards(H1.b, T.sent), title: 'Zoom on check c₂', bubble: ['Each dual adds', 'card minus replica.'], bubbleP: seg(p, 0.45, 0.65) });
    } });
  out.push({ id: 'read2', chapter: CH.nt, title: 'Circuit 2: the cards begin to yield', layout: 'map+side', view: TREEV, dur: 6.4,
    text: 'In circuit 2, every bit reads the previous replicas minus the accumulated edge duals. Bit 0 falls from 1 to ' + num(H2.b[0], 3) + ', but remains just above the 0.5 decision boundary. Bit 4 becomes ' + num(H2.b[4], 3) + ' and bit 5 becomes ' + num(H2.b[5], 3) + '. The hard word is therefore still ' + bits(H2.word) + '. The continuous variables are moving before any hard decision changes.<details class="predict"><summary>Predict the next hard change</summary><p>Bit 0 is the only wrong hard decision and is now closest to 0.5. Which bit should cross the boundary next?</p></details>',
    math: 'b(0) = [3(' + num(H1.z[2][2], 3) + ' − ' + num(H1.u[2][2], 3) + ') − (' + num(T.L[0], 1) + ') − 0.8]/1.4 = ' + num(H2.b[0], 3),
    draw: function (g, p) {
      var q = seg(p, 0.15, 0.55), done = p > 0.6, b = done ? H2.b : H1.b;
      treeComic(g, { tags: cardTags(b), tagCols: cardCols(b, T.sent), wrong: wrongCards(b, T.sent) });
      T.checks.forEach(function (c, k) { c.forEach(function (i, j) { if (q > 0 && q < 1) P.flyTag(g, TJ[k], TP[i], q, num(H1.z[k][j] - H1.u[k][j], 2), RECORD); }); });
      P.table(g, g.sideR, [[0, H1.z[2][2] - H1.u[2][2], H2.b[0]], [4, tellOf(H2, 4), H2.b[4]], [5, tellOf(H2, 5), H2.b[5]]].map(function (r) { return [String(r[0]), num(r[1], 3), num(r[2], 3), r[2] >= 0.5 ? 'bit 1' : 'bit 0']; }), { head: ['bit', 'Σ(z−u)', 'new b', 'hard decision'], cols: [0, 0.2, 0.48, 0.72], title: 'Circuit 2: movement before a decision changes', p: p, reveal: true, colours: function (i, j) { return j === 2 ? CARD : j === 1 ? RECORD : C.ink; } });
    } });
  out.push({ id: 'circuit2', chapter: CH.nt, title: 'Circuit 3: the hard word passes before consensus', layout: 'map+side', view: TREEV, dur: 6.2,
    text: 'The prediction is bit 0. In circuit 3 it falls to ' + num(H3.b[0], 3) + ', crosses below 0.5, and the hard word becomes ' + bits(H3.word) + '. Every parity check now passes, so this decoder-only walk accepts the word. But the relaxed bits and replica variables do not yet agree: the RMS consensus error is ' + num(H3.primalRms, 3) + ', not zero. Accepting the hard word and checking the continuous variables are different tests.',
    math: 'hard word ' + bits(H3.word) + ', syndrome (' + M.syndrome(H3.word, T.checks).join(',') + ')' + at(0.48, ';  e_RMS = sqrt(mean over edges of (b(i) − z(a,i))²)') + at(0.76, ' = ' + num(H3.primalRms, 6) + ' ≠ 0'),
    draw: function (g, p) {
      treeComic(g, { tags: cardTags(H3.b), tagCols: cardCols(H3.b, T.sent), wrong: wrongCards(H3.b, T.sent) });
      noteTags(g, H3.u, seg(p, 0.3, 0.5));
      var R = g.sideR, rows = edgeRows(H3), phone = R[2] < 480 && R[3] < 300;
      if (!phone) {
        P.table(g, R, rows, { head: ['bit', 'check', 'bit Σ', 'b', 'z', 'u'], cols: [0, 0.14, 0.3, 0.51, 0.68, 0.84], title: 'After circuit 3: Σ is the bit total across checks', p: p, reveal: true,
          colours: function (i, j) { return j === 3 ? CARD : j === 4 ? RECORD : j === 5 ? NOTE : j === 2 ? RECORD : C.dim; } });
      } else {
        var c = g.ctx, colW = (R[2] - 26) / 2, top = R[1] + 38, rowH = (R[3] - 46) / 4;
        g.panel(R, 'After circuit 3: eight edges; Σ is a bit total');
        rows.forEach(function (r, i) {
          var col = i < 4 ? 0 : 1, rr = i % 4, x = R[0] + 10 + col * (colW + 6), y = top + rr * rowH, q = seg(p, 0.05 + 0.85 * i / rows.length, 0.15 + 0.85 * i / rows.length);
          if (!(q > 0)) return;
          if (rr) { c.globalAlpha = 0.45 * q; c.strokeStyle = 'rgba(242,245,248,0.18)'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + colW - 4, y); c.stroke(); c.globalAlpha = 1; }
          g.labelPx(x, y + 10, r[1] + '–b' + r[0] + '   Σ ' + r[2], C.dim, { plain: true, size: 11, p: q });
          g.labelPx(x, y + 27, 'b ' + r[3] + '   z ' + r[4] + '   u ' + r[5], C.ink, { plain: true, mono: true, size: 10.5, p: q });
        });
      }
    } });

  // ------------------------------------------------------------ 4. one tree, two soldiers
  out.push({ id: 'reply-record', chapter: CH.cmp, title: 'The same edge carries different objects', layout: 'side', dur: 6.4,
    text: 'Compare what check c₂ sends toward bit 0. In BP, r(c₂→0) deliberately excludes bit 0 and summarizes the incoming messages from bits 4 and 5. In the CAJODE constraint circuit, bit 0 instead reads its own c₂ replica minus the scaled dual on that edge. That replica came from a projection involving all three local entries, including bit 0. The graph is the same, but the mathematical objects and update rules are not.',
    math: 'BP, iteration 3: r(c₂→0) = ' + sgn(I3.U['2,0'], 3) + at(0.5, '<br>CAJODE before circuit 3: z(c₂,0) − u(c₂,0) = ' + num(H2.z[2][2], 3) + ' − ' + num(H2.u[2][2], 3) + ' = ' + num(H2.z[2][2] - H2.u[2][2], 3)),
    draw: function (g, p) {
      var R = g.sideR, half = R[2] >= 600 ? [[R[0], R[1], R[2] / 2 - 4, R[3]], [R[0] + R[2] / 2 + 4, R[1], R[2] / 2 - 4, R[3]]] : [[R[0], R[1], R[2], R[3] / 2 - 4], [R[0], R[1] + R[3] / 2 + 4, R[2], R[3] / 2 - 4]];
      P.zoom(g, half[0], { k: 2, members: T.checks[2], up: [sgn(I3.V['2,4']), sgn(I3.V['2,5']), null], down: [null, null, sgn(I3.U['2,0'], 3)], active: 2, wrong: startWrong, title: 'BP: a check-to-variable message', bubble: ['For bit 0, I use', 'bits 4 and 5 only.'], bubbleP: seg(p, 0.1, 0.3), p: seg(p, 0, 0.2) });
      P.zoom(g, half[1], { k: 2, members: T.checks[2], up: H2.z[2].map(function (v, j) { return num(v, 2) + ' − ' + num(H2.u[2][j], 2); }), upCol: RECORD, down: [null, null, num(H2.z[2][2] - H2.u[2][2], 3)], active: 2, downCol: RECORD, wrong: wrongCards(H2.b, T.sent), title: 'CAJODE: replica minus scaled dual', bubble: ['My replica used all three;', 'this edge also keeps', 'its own disagreement.'], bubbleP: seg(p, 0.5, 0.7), p: seg(p, 0.4, 0.6) });
    } });
  var bpCount = 2 * T.checks.reduce(function (s, c) { return s + c.length; }, 0), ntCount = 6 + 2 * T.checks.reduce(function (s, c) { return s + c.length; }, 0);
  out.push({ id: 'keeps', chapter: CH.cmp, title: 'What each soldier keeps', layout: 'side', dur: 6,
    text: 'This tree has eight check–bit edges. BP keeps two directed messages per edge: ' + bpCount + ' numbers. The CAJODE reduction keeps six shared relaxed bits, eight replica entries and eight scaled duals: ' + ntCount + ' numbers. Here BP accepts after three iterations and the CAJODE reduction after three circuits. The update units do different work. These counts explain state ownership; they are not a speed or complexity ranking.',
    math: 'BP: 2 × 8 directed messages = ' + bpCount + at(0.5, ';  CAJODE reduction: 6 b + 8 z + 8 u = ' + ntCount),
    draw: function (g, p) {
      var R = g.sideR, c = g.ctx; g.panel(R, 'Numbers kept between rounds, on the tree');
      var rows = [{ name: 'BP protocol', blocks: [[BPC, bpCount, 'directed messages']], tail: 'two directions on each edge' }, { name: 'CAJODE constraint circuit', blocks: [[CARD, 6, 'shared b values'], [RECORD, 8, 'replica entries'], [NOTE, 8, 'scaled duals']], tail: 'different state, different work' }];
      if (R[2] < 480) {
        var x0 = R[0] + 22, cellN = Math.min(17, (R[2] - 48 - 15 * 3) / 16), gapN = 3;
        function blocks(x, y, n, col, q) { for (var k = 0; k < n; k++) { var vis = clamp(q * n - k, 0, 1); if (vis > 0) { c.globalAlpha = vis; c.fillStyle = col; c.fillRect(x + k * (cellN + gapN), y, cellN, cellN); c.globalAlpha = 1; } } }
        var qBP = seg(p, 0.1, 0.45), yBP = R[1] + 72;
        g.labelPx(x0, yBP - 24, rows[0].name, BPC, { plain: true, size: 13.5, p: seg(p, 0.05, 0.2) });
        blocks(x0, yBP, bpCount, BPC, qBP);
        g.labelPx(x0, yBP + cellN + 17, bpCount + ' directed messages', BPC, { plain: true, size: 12, p: qBP });
        g.labelPx(x0, yBP + cellN + 39, rows[0].tail, C.gold, { plain: true, size: 12.5, p: seg(qBP, 0.7, 1) });
        var titleY = R[1] + 192, y0 = titleY + 25, qCJ = seg(p, 0.5, 0.92), drawn = 0, total = 22;
        g.labelPx(x0, titleY, rows[1].name, C.ink, { plain: true, size: 13.5, p: seg(p, 0.45, 0.6) });
        rows[1].blocks.forEach(function (bl, j) {
          var q = seg(qCJ, drawn / total, (drawn + bl[1]) / total), y = y0 + j * 52, stripW = bl[1] * (cellN + gapN) - gapN;
          blocks(x0, y, bl[1], bl[0], q);
          g.labelPx(x0 + stripW + 12, y + cellN / 2, bl[1] + ' ' + bl[2], bl[0], { plain: true, size: 11.5, p: q });
          drawn += bl[1];
        });
        g.labelPx(x0, y0 + 3 * 52 + 3, rows[1].tail, C.gold, { plain: true, size: 12.5, p: seg(qCJ, 0.78, 1) });
        return;
      }
      var cell = Math.min(22, (R[2] - 70) / 22);
      rows.forEach(function (rw, r) {
        var y = R[1] + 70 + r * 130, x = R[0] + 24, q = seg(p, 0.1 + 0.4 * r, 0.45 + 0.4 * r), drawn = 0, total = rw.blocks.reduce(function (s, b) { return s + b[1]; }, 0);
        g.labelPx(x, y - 22, rw.name, r ? C.ink : BPC, { plain: true, size: 13.5, p: seg(p, 0.05 + 0.4 * r, 0.2 + 0.4 * r) });
        rw.blocks.forEach(function (bl) { for (var k = 0; k < bl[1]; k++) { var vis = clamp(q * total - drawn, 0, 1); if (vis > 0) { c.globalAlpha = vis; c.fillStyle = bl[0]; c.fillRect(x + drawn * (cell + 3), y, cell, cell); c.globalAlpha = 1; } drawn++; } });
        var lx = x; rw.blocks.forEach(function (bl) { g.labelPx(lx, y + cell + 16, bl[1] + ' ' + bl[2], bl[0], { plain: true, size: 12, p: q }); lx += bl[1] * (cell + 3); });
        g.labelPx(x, y + cell + 40, rw.tail, C.gold, { plain: true, size: 12.5, p: seg(q, 0.7, 1) });
      });
    } });
  var c1Residual2 = T.checks[1].map(function (i, j) { return H2.b[i] - H2.z[1][j]; });
  out.push({ id: 'support', chapter: CH.cmp, title: 'Support or disagreement?', layout: 'map+side', view: TREEV, dur: 6,
    text: 'Neither object is a hard parity-failure flag. BP’s c₁ replies carry extrinsic support from the other incoming messages, whether the thresholded pattern passes or fails. In CAJODE circuit 2, c₁’s hard pattern is 011 and already has even parity. Its current residual b−z is ' + triple(c1Residual2, 3) + ', so the accumulated scaled dual changes by that vector and becomes ' + triple(H2.u[1], 3) + '. A nonzero dual alone does not prove current disagreement; it may remain nonzero after b and z agree.',
    math: 'c₁: hard pattern 011 passes;  Δu = b − z = ' + triple(c1Residual2, 3) + at(0.58, ';  new u = ' + triple(H2.u[1], 3)),
    draw: function (g, p) {
      treeComic(g, { tags: cardTags(H2.b), focus: 1, lit: ['1,2', '1,3', '1,4'], litCol: BPC });
      [2, 3, 4].forEach(function (i, j) { var q = seg(p, 0.1 + 0.1 * j, 0.4 + 0.1 * j); if (q > 0 && q < 1) P.flyTag(g, TJ[1], TP[i], q, sgn(I2.U['1,' + i], 2), BPC, { dy: i === 4 ? -15 : i === 2 ? 15 : 0, size: g.W < 480 ? 10.5 : 12 }); });
      var R = g.sideR, half = R[3] > 360 ? [[R[0], R[1], R[2], R[3] / 2 - 4], [R[0], R[1] + R[3] / 2 + 4, R[2], R[3] / 2 - 4]] : [[R[0], R[1], R[2] / 2 - 4, R[3]], [R[0] + R[2] / 2 + 4, R[1], R[2] / 2 - 4, R[3]]];
      var phone = R[2] < 480 && R[3] < 300;
      P.zoom(g, half[0], { k: 1, members: T.checks[1], down: phone ? T.checks[1].map(function () { return ''; }) : T.checks[1].map(function (i) { return sgn(I2.U['1,' + i], 2); }), allDown: true, downCol: BPC,
        cards: phone ? T.checks[1].map(function (i) { return sgn(I2.U['1,' + i], 2).replace('0.', '.'); }) : null, cardCol: BPC, shortNames: phone, nameSize: phone ? 9.5 : 11.5, cardSize: phone ? 9.5 : 12,
        title: phone ? 'BP: soft support' : 'BP at c₁: soft support', bubble: ['My replies summarize', 'the other inputs.'], bubbleP: seg(p, 0.3, 0.5), bubbleCol: BPC, p: seg(p, 0, 0.2) });
      P.zoom(g, half[1], { k: 1, members: T.checks[1], up: phone ? T.checks[1].map(function () { return ''; }) : T.checks[1].map(function (i, j) { return 'u ' + num(H2.u[1][j], 2); }), upCol: NOTE,
        cards: phone ? T.checks[1].map(function (i, j) { return sgn(H2.u[1][j], 2).replace('0.', '.'); }) : T.checks[1].map(function (i) { return num(H2.b[i], 2); }), cardCol: phone ? NOTE : CARD,
        shortNames: phone, nameSize: phone ? 9.5 : 11.5, cardSize: phone ? 9.5 : 12, title: phone ? 'CAJODE: b − z' : 'CAJODE at c₁: continuous disagreement', bubble: ['011 passes parity,', 'yet b and z still differ.'], bubbleP: seg(p, 0.6, 0.8), p: seg(p, 0.45, 0.65) });
    } });

  // ------------------------------------------------------------ 5. the loop
  var lTags = L6.L.map(function (v) { return sgn(v); }), lstart = M.hardBits(L6.L);
  out.push({ id: 'loop', chapter: CH.loop, title: 'A related loop: one more edge, different evidence', layout: 'map+side', view: LOOPV, dur: 5.8,
    text: 'We keep the same six-bit transmitted word and add the missing edge from c₀ to bit 0. Bits 0, 2 and 4 now belong to two checks, so information can return to where it started. This second fixture also uses a different, harder channel observation to expose that recirculation; it is not a topology-only comparison. The convention remains: a positive LLR favours bit 0. The channel decides ' + bits(lstart) + '; bit 4 is wrong, so c₁ and c₂ fail.<details class="predict"><summary>Predict what the loop changes</summary><p>Does each check still exclude its current recipient, and can older evidence nevertheless circle back in a later iteration?</p></details>',
    math: 'related fixture: add edge (c₀, bit 0) and change the channel evidence' + at(0.42, ';  sent ' + bits(L6.sentBits) + ', decision ' + bits(lstart)) + at(0.72, ';  syndrome (' + M.syndrome(lstart, L6.checks).join(',') + ')'),
    draw: function (g, p) {
      loopComic(g, { tags: lTags });
      var rows = [0, 1, 2, 3, 4, 5].map(function (i) { return [String(i), num(L6.y[i], 2), sgn(L6.L[i]), String(L6.sentBits[i]), String(lstart[i])]; });
      P.table(g, g.sideR, rows, { head: ['bit', 'sample y', 'channel LLR', 'sent*', 'decides'], cols: [0, 0.2, 0.44, 0.68, 0.84], title: 'Same bit convention on the loop', p: p, reveal: true, colours: function (i, j) { return i === 4 && (j === 4 || j === 2) ? WRONG : j === 0 ? C.dim : C.ink; } });
    } });
  function bpTotals(s) { return s === 0 ? L6.L : lbp[s - 1].B; }
  function bpWord(s) { return s === 0 ? lstart : lbp[s - 1].bits; }
  function disagree(word) { var syn = M.syndrome(word, L6.checks); var d = syn.map(function (v, k) { return v ? 'c' + sub_(k) : null; }).filter(Boolean); return d.length ? d.join(', ') : 'none'; }
  out.push({ id: 'loop-bp', chapter: CH.loop, title: 'The BP protocol on a loop', layout: 'map+side', view: LOOPV, dur: 8,
    text: 'The answer has two parts. Each check update still excludes its recipient’s current incoming message, but older evidence can return after circling the graph. BP on a loop is therefore iterative and generally approximate. Here all directed messages update together. The hard word changes from ' + bits(lstart) + ' to ' + bits(lbp[0].bits) + ', then ' + bits(lbp[1].bits) + ', and finally ' + bits(lbp[2].bits) + '. At iteration 3 every parity check passes and the result matches the sent word. This fixture shows the mechanism, not a guarantee for every loopy graph.',
    math: 'B(i) = Lᶜʰ(i) + Σₐ r(a→i)' + at(0.3, '<br>' + [0, 1, 2, 3].map(function (s) { return bits(bpWord(s)); }).join(' → ')),
    draw: function (g, p) {
      var sNow = Math.min(3, Math.floor(seg(p, 0.05, 0.9) * 4)), B0 = bpTotals(sNow), w = bpWord(sNow), pulse = (seg(p, 0.05, 0.9) * 4) % 1;
      loopComic(g, { tags: B0.map(function (v) { return sgn(v); }), tagCols: w.map(function (v, i) { return v === L6.sentBits[i] ? BPC : WRONG; }), wrong: w.map(function (v, i) { return v !== L6.sentBits[i]; }), lit: sNow < 3 && pulse < 0.5 ? L6.checks.reduce(function (a, c, k) { return a.concat(c.map(function (i) { return k + ',' + i; })); }, []) : null, litCol: 'rgba(169,205,246,0.75)' });
      g.labelPx(g.mapR[0] + 12, g.mapR[1] + 18, sNow ? 'iteration ' + sNow : 'start', C.gold, { size: 13 });
      var rows = [0, 1, 2, 3].map(function (s) { return [s ? String(s) : 'start', bits(bpWord(s))].concat(bpTotals(s).map(function (v) { return sgn(v, 2); })); });
      P.table(g, g.sideR, rows.slice(0, sNow + 1), { head: ['iter.', 'hard word', '0', '1', '2', '3', '4', '5'], cols: [0, 0.11, 0.29, 0.41, 0.53, 0.65, 0.77, 0.89], title: 'BP a posteriori LLRs and hard decisions', p: 1, size: 11.5,
        colours: function (i, j, t) { return j >= 2 ? (M.hardBits([bpTotals(i)[j - 2]])[0] === L6.sentBits[j - 2] ? BPC : WRONG) : j === 0 ? C.dim : C.ink; } });
      if (sNow >= 0) g.labelPx(g.sideR[0] + 14, g.sideR[1] + g.sideR[3] - 18, 'disagreeing junctions: ' + disagree(bpWord(sNow)), C.dim, { plain: true, size: 12 });
    } });
  var U14 = lbp[1].U['1,4'], U24 = lbp[1].U['2,4'], B42 = lbp[1].B[4];
  out.push({ id: 'loop-why', chapter: CH.loop, title: 'What turns soldier 4 under BP', layout: 'map+side', view: LOOPV, dur: 5.8,
    text: 'In iteration 2, bit 4 hears ' + sgn(U14) + ' from c₁ and ' + sgn(U24) + ' from c₂. Together they outweigh its misleading positive channel LLR of +4.67. Its a posteriori LLR becomes ' + sgn(B42) + ', so the hard decision turns from bit 0 to bit 1. The bit convention stays the same; only the accumulated soft evidence changes.',
    math: 'B(4) = L(4) + U(c₁→4) + U(c₂→4) = +4.67 ' + sgn(U14).replace('−', '− ') + ' ' + sgn(U24).replace('−', '− ') + ' = ' + at(0.6, sgn(B42)),
    draw: function (g, p) {
      loopComic(g, { tags: lbp[1].B.map(function (v) { return sgn(v); }), tagCols: lbp[1].bits.map(function (v, i) { return v === L6.sentBits[i] ? BPC : WRONG; }), wrong: lbp[1].bits.map(function (v, i) { return v !== L6.sentBits[i]; }), lit: ['1,4', '2,4'], litCol: BPC });
      P.flyTag(g, LJ[1], LP[4], seg(p, 0.1, 0.45), sgn(U14), BPC, { rest: 0.38 }); P.flyTag(g, LJ[2], LP[4], seg(p, 0.25, 0.6), sgn(U24), BPC, { rest: 0.38 });
      var R = g.sideR; g.panel(R, 'soldier 4 in iteration 2');
      var lines2 = [['its reading', sgn(L6.L[4]), WRONG], ['the reply of c₁', sgn(U14), BPC], ['the reply of c₂', sgn(U24), BPC], ['total', sgn(B42), C.gold]];
      lines2.forEach(function (ln, j) { var y = R[1] + 64 + 34 * j, q = seg(p, 0.1 + 0.18 * j, 0.25 + 0.18 * j); g.labelPx(R[0] + 18, y, ln[0], C.ink, { plain: true, size: 13, p: q }); g.labelPx(R[0] + R[2] - 18, y, ln[1], ln[2], { plain: true, size: 14, mono: true, align: 'right', p: q }); });
      g.labelPx(R[0] + 18, R[1] + 64 + 34 * 4 + 10, 'two replies outweigh the channel: bit 4 turns to 1', C.gold, { plain: true, size: 12.5, p: seg(p, 0.85, 1) });
    } });
  var LW = LH.map(function (h) { return bitWord(h.b); }), nChanges = wordChanges(LW), NC = lnt.circuits;
  function noteAt(h, k, i) { var j = L6.checks[k].indexOf(i); return h.u[k][j]; }
  out.push({ id: 'loop-notes', chapter: CH.loop, title: 'The note-taking soldier walks the loop', layout: 'map+side', view: LOOPV, dur: 9,
    text: 'The CAJODE constraint circuit uses the same relaxed-bit convention: b near 1 means bit 1. For two circuits no hard decision moves, while the edge duals accumulate relaxed disagreement. The hard words then change at circuits 3, 4 and 9. At circuit ' + NC + ', bit 4 finally crosses the 0.5 boundary and the hard word becomes the sent word. Unlike BP replies, the duals do not claim to be extrinsic LLRs.',
    math: 'b(i) ← Π[0,1][(ρ Σ(z − u) − Lᶜʰ(i) − β)/(ρ d(i) − 2β)]' + at(0.3, '<br>' + nChanges.map(function (c) { return bits(c[1]) + ' (' + (c[0] ? c[0] : 'start') + ')'; }).join(' → ')),
    draw: function (g, p) {
      var f = seg(p, 0.04, 0.88) * NC, t = Math.min(NC, Math.floor(f)), h = LH[t], w = LW[t];
      loopComic(g, { tags: cardTags(h.b), tagCols: w.map(function (v, i) { return v === L6.sentBits[i] ? CARD : WRONG; }), wrong: w.map(function (v, i) { return v !== L6.sentBits[i]; }) });
      if (g.s > 45) [[1, 4], [2, 4]].forEach(function (e) { var m = lerp2(LJ[e[0]], LP[e[1]], 0.3); g.label(m, 'u ' + sgn(noteAt(h, e[0], e[1]), 2), NOTE, { dx: 26, dy: e[0] === 1 ? -14 : 22, size: 11.5, mono: true }); });
      g.labelPx(g.mapR[0] + 12, g.mapR[1] + 18, t ? 'circuit ' + t + ':  ' + bits(w) : 'start:  ' + bits(w), C.gold, { size: 13 });
      var R = g.sideR, parts = R[3] > 340 ? [[R[0], R[1], R[2], R[3] / 2 - 4], [R[0], R[1] + R[3] / 2 + 4, R[2], R[3] / 2 - 4]] : [[R[0], R[1], R[2] / 2 - 4, R[3]], [R[0] + R[2] / 2 + 4, R[1], R[2] / 2 - 4, R[3]]];
      var slim = parts[0][2] < 330, pl = g.plot(parts[0], [0, NC], [0, 1], { title: slim ? 'relaxed bits' : 'relaxed bits b(0), b(3), b(4)' }); pl.frame('circuit', 'b');
      [[0, C.blue], [3, C.green], [4, WRONG]].forEach(function (s) { pl.curve(function (x) { var k = Math.min(NC, Math.floor(x)), fr = x - k; return LH[k].b[s[0]] * (1 - fr) + LH[Math.min(NC, k + 1)].b[s[0]] * fr; }, s[1], 2, clamp(f / NC, 0, 1)); });
      pl.seg(0, 0.5, NC, 0.5, 'rgba(242,245,248,0.35)', 1, 1, [4, 4]);
      [['bit 0', C.blue], ['bit 3', C.green], ['bit 4', WRONG]].forEach(function (k, j) { g.labelPx(pl.box[0] + pl.box[2] - 4, pl.box[1] + 12 + 15 * j, k[0], k[1], { plain: true, size: 11, align: 'right' }); });
      var lo = -2, hi = 0.6, pl2 = g.plot(parts[1], [0, NC], [lo, hi], { title: slim ? 'soldier 4’s notes' : 'soldier 4’s notes at c₁ and c₂' }); pl2.frame('circuit', 'note');
      [[1, C.violet], [2, NOTE]].forEach(function (e) { pl2.curve(function (x) { var k = Math.min(NC, Math.floor(x)), fr = x - k; return noteAt(LH[k], e[0], 4) * (1 - fr) + noteAt(LH[Math.min(NC, k + 1)], e[0], 4) * fr; }, e[1], 2, clamp(f / NC, 0, 1)); });
      g.labelPx(pl2.box[0] + pl2.box[2] - 4, pl2.box[1] + 12, 'c₁’s note', C.violet, { plain: true, size: 11.5, align: 'right' }); g.labelPx(pl2.box[0] + pl2.box[2] - 4, pl2.box[1] + 27, 'c₂’s note', NOTE, { plain: true, size: 11.5, align: 'right' });
    } });
  var h11 = LH[NC - 1], h12 = LH[NC], zu = [1, 2].map(function (k) { var j = L6.checks[k].indexOf(4); return [h11.z[k][j], h11.u[k][j]]; }), tell4 = zu[0][0] - zu[0][1] + zu[1][0] - zu[1][1];
  out.push({ id: 'loop-turn', chapter: CH.loop, title: 'What turns soldier 4 in circuit ' + NC, layout: 'map+side', view: LOOPV, dur: 6,
    text: 'In circuit ' + NC + ', soldier 4 hears its two records less their notes: ' + num(zu[0][0], 2) + ' − (' + sgn(zu[0][1], 2) + ') from c₁ and ' + num(zu[1][0], 2) + ' − (' + sgn(zu[1][1], 2) + ') from c₂, ' + num(tell4, 2) + ' in all. Most of it is c₂’s note of ' + sgn(zu[1][1], 2) + ', the disagreement c₂ has added up over the circuits. The card becomes (3 × ' + num(tell4, 2) + ' − 4.67 − 0.8)/4.4 = ' + num(h12.b[4], 2) + ', above one half, so soldier 4 turns to bit 1.',
    math: 'b(4) = Π[0,1][(ρ Σ(z − u) − L(4) − β)/(2ρ − 2β)]' + at(0.5, ' = (3 × ' + num(tell4, 2) + ' − 4.67 − 0.8)/4.4 = ' + num(h12.b[4], 2)),
    draw: function (g, p) {
      var b = p > 0.65 ? h12.b : h11.b, w = bitWord(b);
      loopComic(g, { tags: cardTags(b), tagCols: w.map(function (v, i) { return v === L6.sentBits[i] ? CARD : WRONG; }), wrong: w.map(function (v, i) { return v !== L6.sentBits[i]; }), lit: ['1,4', '2,4'], litCol: RECORD });
      P.flyTag(g, LJ[1], LP[4], seg(p, 0.1, 0.45), num(zu[0][0] - zu[0][1], 2), RECORD, { rest: 0.38 }); P.flyTag(g, LJ[2], LP[4], seg(p, 0.25, 0.6), num(zu[1][0] - zu[1][1], 2), RECORD, { rest: 0.38 });
      var R = g.sideR; g.panel(R, 'soldier 4 in circuit ' + NC);
      var rows2 = [['c₁: replica less dual', num(zu[0][0], 2) + ' − (' + sgn(zu[0][1], 2) + ')', RECORD], ['c₂: replica less dual', num(zu[1][0], 2) + ' − (' + sgn(zu[1][1], 2) + ')', NOTE], ['sum', num(tell4, 2), C.ink], ['channel LLR', sgn(L6.L[4]), WRONG], ['relaxed bit', num(h12.b[4], 2) + ': decides bit 1', C.gold]];
      rows2.forEach(function (ln, j) { var y = R[1] + 62 + 32 * j, q = seg(p, 0.1 + 0.16 * j, 0.24 + 0.16 * j); g.labelPx(R[0] + 16, y, ln[0], C.ink, { plain: true, size: 12.5, p: q }); g.labelPx(R[0] + R[2] - 16, y, ln[1], ln[2], { plain: true, size: 13, mono: true, align: 'right', p: q }); });
    } });
  var gWords = CT.map(function (s) { return bitsFromSigns(s.word); }), gChanges = wordChanges(gWords), x0 = CT[0].x, gparts = M.gradient(x0), slope0 = {}; gparts.parts[0].forEach(function (pp) { slope0[pp.check] = pp.slope; });
  var g0 = gparts.g[0], fit0 = g0 - slope0[0] - slope0[2], notes12 = [noteAt(h12, 0, 0), noteAt(h12, 2, 0)];
  out.push({ id: 'loop-gradient', chapter: CH.optional, title: 'Why not put every constraint in one penalty?', layout: 'map+side', view: LOOPV, dur: 7,
    text: 'An optional third walk replaces the separate parity replicas and scaled duals by one smooth penalty. Preconditioned projected gradient descent differentiates the data fit, parity penalties and binary penalty, adds all partial derivatives for each bit, projects each trial point onto the box, and backtracks until the cost falls. On this fixture it stops after ' + cStop.it + ' steps at hard word ' + bits(bitsFromSigns(cStop.word)) + ', which satisfies parity but has three wrong bits. The sent word has slightly lower cost, yet the cost rises along the straight line between the two points. This illustrates a local trap along that line; it is not a general ranking of algorithms.',
    math: 'J = (1/6)[Σ(y − ξ)²/(2σ²) + 8 Σ(1 − ∏ξ)² + 0.2 Σ(1 − ξ²)²]' + at(0.5, '<br>stop ' + bits(bitsFromSigns(cStop.word)) + ', J = ' + num(cStop.J, 4) + ';  sent ' + bits(L6.sentBits) + ', J = ' + num(jSent, 4)),
    draw: function (g, p) {
      var f = seg(p, 0.04, 0.5), k = Math.min(CT.length - 1, Math.floor(f * (CT.length - 1))), st = CT[k];
      var wb = bitsFromSigns(st.word);
      loopComic(g, { tags: st.x.map(function (v) { return sgn(v, 2); }), tagCols: wb.map(function (v, i) { return v === L6.sentBits[i] ? P.PULL : WRONG; }), wrong: wb.map(function (v, i) { return v !== L6.sentBits[i]; }) });
      g.labelPx(g.mapR[0] + 12, g.mapR[1] + 18, 'projected gradient step ' + st.it + ':  ' + bits(wb), P.PULL, { size: 13 });
      var lo = 1, hi = 3.6, pl = g.plot(g.sideR, [0, 1], [lo, hi], { title: 'the cost between the stop and the sent word' }); pl.frame('t', 'J');
      pl.curve(function (t) { var j = Math.min(hill.length - 1, Math.round(t * (hill.length - 1))); return hill[j].J; }, P.PULL, 2.4, seg(p, 0.5, 0.85));
      pl.point(0, cStop.J, P.PULL, 'the stop ' + num(cStop.J, 4), seg(p, 0.55, 0.65), 'right'); pl.point(1, jSent, C.gold, 'the sent word ' + num(jSent, 4), seg(p, 0.85, 0.95), 'left'); pl.point(hillPeak.t, hillPeak.J, WRONG, 'a hill: ' + num(hillPeak.J, 2), seg(p, 0.72, 0.82), 'right');
    } });
  out.push({ id: 'apart', chapter: CH.optional, title: 'One summed slope or separate constraint memory', layout: 'map+side', view: LOOPV, dur: 6,
    text: 'Bit 0 belongs to c₀ and c₂. The penalty walk adds c₀’s partial derivative, ' + sgn(slope0[0]) + ', c₂’s partial derivative, ' + sgn(slope0[2]) + ', and the remaining objective terms into one number, ' + sgn(g0) + '. The CAJODE circuit also combines both checks when updating the shared bit, but it retains a separate replica and scaled dual for each check–bit edge. At circuit ' + NC + ', bit 0’s two dual values are still distinguishable: ' + sgn(notes12[0]) + ' at c₀ and ' + sgn(notes12[1]) + ' at c₂.',
    math: 'gradient soldier: ' + sgn(slope0[0]) + [slope0[2], fit0].map(function (v) { return (v < 0 ? ' − ' : ' + ') + num(Math.abs(v), 2); }).join('') + ' = ' + sgn(g0) + ', one number' + at(0.5, '<br>note-taking soldier: notes ' + sgn(notes12[0]) + ' (c₀) and ' + sgn(notes12[1]) + ' (c₂), two numbers'),
    draw: function (g, p) {
      loopComic(g, { tags: [null, null, null, null, null, null], focus: null, lit: ['0,0', '2,0'], litCol: NOTE });
      var q1 = seg(p, 0.1, 0.4), q2 = seg(p, 0.55, 0.85);
      if (q1 > 0 && q2 <= 0) { P.flyTag(g, LJ[0], LP[0], q1, sgn(slope0[0]), P.PULL, { rest: 0.6 }); P.flyTag(g, LJ[2], LP[0], q1, sgn(slope0[2]), P.PULL, { rest: 0.6 }); }
      if (q1 >= 1 && q2 <= 0) g.label(LP[0], 'kept: one number, ' + sgn(g0), P.PULL, { dy: 70, align: 'center', size: 12.5 });
      if (q2 > 0) { var m0 = lerp2(LJ[0], LP[0], 0.5), m2 = lerp2(LJ[2], LP[0], 0.5); g.label(m0, 'note ' + sgn(notes12[0]), NOTE, { dx: -10, align: 'right', size: 12, p: q2 }); g.label(m2, 'note ' + sgn(notes12[1]), NOTE, { dx: 10, size: 12, p: q2 }); }
      var R = g.sideR; g.panel(R, 'bit 0, incident to c₀ and c₂');
      var rows3 = [['projected gradient with one penalty function', '', P.PULL], ['c₀ partial derivative', sgn(slope0[0]), C.ink], ['c₂ partial derivative', sgn(slope0[2]), C.ink], ['fit and binary terms', sgn(fit0), C.ink], ['kept: their sum', sgn(g0), P.PULL], ['CAJODE circuit ' + NC, '', NOTE], ['scaled dual at c₀', sgn(notes12[0]), NOTE], ['scaled dual at c₂', sgn(notes12[1]), NOTE]];
      rows3.forEach(function (ln, j) { var y = R[1] + 56 + 27 * j, q = seg(p, j < 5 ? 0.05 + 0.08 * j : 0.5 + 0.08 * (j - 5), j < 5 ? 0.15 + 0.08 * j : 0.6 + 0.08 * (j - 5)); g.labelPx(R[0] + (ln[1] ? 26 : 14), y, ln[0], ln[1] ? C.ink : ln[2], { plain: true, size: ln[1] ? 12.5 : 13, p: q }); if (ln[1]) g.labelPx(R[0] + R[2] - 16, y, ln[1], ln[2], { plain: true, size: 13, mono: true, align: 'right', p: q }); });
    } });
  var walks = [{ name: 'BP protocol', unit: 'iterations', changes: [0, 1, 2, 3].map(function (s) { return [s, bpWord(s)]; }), end: 3, keeps: 18, col: BPC },
               { name: 'CAJODE constraint circuit', unit: 'circuits', changes: nChanges, end: NC, keeps: 6 + 2 * 9, col: CARD },
               { name: 'projected gradient with one penalty', unit: 'steps', changes: gChanges.concat([[cStop.it, bitsFromSigns(cStop.word)]]), end: cStop.it, keeps: 6, col: P.PULL }];
  out.push({ id: 'ends', chapter: CH.optional, title: 'Three traces, not a race', layout: 'side', dur: 7,
    text: 'The three traces end differently on this chosen loop. BP accepts the sent word in 3 message-passing iterations. The known-channel CAJODE reduction accepts it in ' + NC + ' constraint circuits. Projected gradient descent with one penalty function stops at a different word that passes every parity check after ' + cStop.it + ' steps. Their update units and per-update work are not comparable, so the counts are not a speed ranking. The useful abstraction is structural: BP passes extrinsic information, and each reply excludes its recipient’s current input. CAJODE preserves one replica variable and one scaled dual per edge. The penalty function combines the instantaneous constraint contributions into one summed partial derivative.',
    math: 'this fixture: BP 3 iterations;  CAJODE reduction ' + NC + ' circuits;  single penalty ' + cStop.it + ' steps',
    draw: function (g, p) {
      var R = g.sideR, phone = R[2] < 480; g.panel(R, 'each walk: its start, every change of word, its end');
      walks.forEach(function (wk, r) {
        var y = R[1] + (phone ? 63 : 70) + r * (phone ? 111 : Math.min(110, (R[3] - 90) / 3)), q = seg(p, 0.05 + 0.3 * r, 0.3 + 0.3 * r), ch = wk.changes.filter(function (c, j, a) { return j === 0 || c[1].join() !== a[j - 1][1].join() || j === a.length - 1; });
        var shownName = phone && r === 2 ? 'gradient descent + one penalty' : wk.name + ' (' + wk.unit + ')';
        g.labelPx(R[0] + 14, y - 22, shownName, wk.col, { plain: true, size: phone ? 12 : 13, p: q });
        var last = ch[ch.length - 1][1], ok = last.join() === L6.sentBits.join(), statusY = phone ? y - 5 : y - 22;
        g.labelPx(R[0] + R[2] - 16, statusY, ok ? 'the sent word' : 'valid, three wrong', ok ? C.gold : WRONG, { plain: true, size: phone ? 11.5 : 12.5, align: 'right', p: seg(q, 0.8, 1) });
        var x0 = R[0] + 16, step = phone ? (R[2] - 92) / Math.max(1, ch.length - 1) : (R[2] - 40) / Math.max(4, ch.length), traceY = phone ? y + 12 : y;
        ch.forEach(function (c, j) {
          var qq = seg(q, j / ch.length, (j + 1) / ch.length), x = x0 + j * step, wrong = c[1].some(function (v, i) { return v !== L6.sentBits[i]; });
          g.labelPx(x, traceY + 4, j === 0 ? 'start' : String(c[0]), C.dim, { plain: true, size: phone ? 10.5 : 11.5, p: qq });
          g.labelPx(x, traceY + 24, bits(c[1]), wrong ? WRONG : C.gold, { size: phone ? 11.5 : 13, mono: true, p: qq });
          if (j > 0) g.arrowPx([x - step + (phone ? 50 : 66), traceY + 24], [x - 6, traceY + 24], 'rgba(242,245,248,0.45)', 1.4);
        });
      });
    } });

  // ------------------------------------------------------------ 6. inside a receiver
  out.push({ id: 'officer', chapter: CH.rx, title: 'Inside a receiver: the officer’s map', layout: 'side', dur: 8,
    text: 'So far the channel was frozen. In the full OFDM receiver it must be estimated jointly with the data. JADE uses a BP decoder whose check nodes run normalized min-sum. It returns a posteriori LLRs Lpost from channel LLRs Lch. The receiver computes extrinsic information Lext = Lpost−Lch, then forms Lch+αLext. A tanh map turns that sum into x, which initializes joint channel estimation and decoding on the next pass. Here x = 1−2b, so x near +1 represents bit 0, and T is the initialization temperature. Thus α damps only the extrinsic addition; the channel evidence remains. The receiver does not differentiate through BP or feed a hard word back as the channel estimate. Our small graph walks used sum-product BP to expose recipient exclusion. The referenced JADE implementation instead uses normalized min-sum at each check node while retaining the directed messages. CAJODE updates the channel, relaxed bits, replica variables and scaled dual variables within each ADMM iteration.',
    math: 'Lext = Lpost − Lch;  x₀ = tanh[(Lch + α Lext)/(2T)];  x = 1−2b;  x ≈ +1 ↔ bit 0;  T is the initialization temperature' + at(0.5, '<br>CAJODE: weights → relaxed bits → weights → channel → replica variables → scaled dual variables'),
    draw: function (g, p) {
      var R = g.sideR, c = g.ctx, half = (R[3] - 30) / 2;
      function lane(y, title, boxes, col, loopBack, q, token) {
        g.labelPx(R[0] + 14, y, title, col, { plain: true, size: 13, p: q });
        var n = boxes.length, bw = Math.min(118, (R[2] - 40 - (n - 1) * 14) / n), x0 = R[0] + 16, by = y + 22, bh = 38;
        boxes.forEach(function (t, j) {
          var x = x0 + j * (bw + 14), qq = seg(q, j / (n + 1), (j + 1) / (n + 1)); if (!(qq > 0)) return;
          c.globalAlpha = qq; c.fillStyle = 'rgba(255,255,255,0.05)'; c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath(); c.rect(x, by, bw, bh); c.fill(); c.stroke(); c.globalAlpha = 1;
          g.labelPx(x + bw / 2, by + bh / 2, t, C.ink, { plain: true, size: t.length > 16 ? 10.5 : 11.5, align: 'center', p: qq });
          if (j) g.arrowPx([x - 13, by + bh / 2], [x - 2, by + bh / 2], col, 1.4);
        });
        if (loopBack && q > 0.9) { var xa = x0 + (n - 1) * (bw + 14) + bw / 2, xb = x0 + bw / 2; c.strokeStyle = col; c.lineWidth = 1.4; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(xa, by + bh); c.lineTo(xa, by + bh + 18); c.lineTo(xb, by + bh + 18); c.stroke(); c.setLineDash([]); g.arrowPx([xb, by + bh + 18], [xb, by + bh + 2], col, 1.4); g.labelPx((xa + xb) / 2, by + bh + 30, loopBack, col, { plain: true, size: 11.5, align: 'center' }); }
        if (token != null) { var tx = x0 + (bw + 14) * token + bw / 2; c.fillStyle = C.gold; c.beginPath(); c.arc(tx, by - 6, 4.5, 0, 2 * Math.PI); c.fill(); }
      }
      g.panel(R, 'where the officer’s map is drawn');
      var t1 = seg(p, 0.05, 0.45), t2 = seg(p, 0.5, 0.92);
      lane(R[1] + 46, 'JADE: soft information initializes the next step', ['channel LLR Lch', 'BP posterior Lpost', 'Lext = Lpost − Lch', 'Lch + α Lext', 'tanh map', 'next joint step'], BPC, 'the joint step produces the next channel estimate', t1, t1 >= 1 ? Math.floor((p * 24) % 6) : null);
      lane(R[1] + 46 + half, 'CAJODE: one ADMM iteration', ['weights', 'relaxed bits', 'weights', 'channel', 'replica variables', 'scaled dual variables'], NOTE, 'one ADMM iteration under one objective function', t2, t2 >= 1 ? Math.floor((p * 30) % 6) : null);
    } });
  var FIVE = [['1. robust weights', 'w', 'no', 'closed form; evaluated twice'], ['2. relaxed bits', 'b(i)', 'yes', 'closed form; evaluated together'], ['3. channel response', 'C', 'yes', 'normal equations; sparse solve'], ['4. replica variables', 'z(a)', 'no', 'projection onto the parity polytope'], ['5. scaled dual variables', 'u(a,i)', 'no', 'add b(i) − z(a,i) per edge']];
  out.push({ id: 'five', chapter: CH.rx, title: 'Five update types; the weights are evaluated twice', layout: 'side', dur: 6.4,
    text: 'On a measured frame, one CAJODE circuit has five update types. The robust weights are evaluated twice: before the relaxed-bit update and again before the channel update. The relaxed-bit block uses partial derivatives of the objective function in a majorization-minimization step. Its quadratic approximation separates across the bits not fixed by the configured constraints, so their closed-form updates use the same preceding state. In the displayed rule, g(i) is the fit partial derivative, h(i) is the nonnegative diagonal coefficient of the quadratic approximation, and d(i) counts incident checks. The table’s C is the channel response. This update is not ordinary gradient descent. The channel block solves normal equations for its quadratic objective. The parity constraints are never differentiated; they are projected. The scaled dual variables then accumulate b−z per edge.',
    math: 'b_new(i) ← Π[0,1][(ρ Σ(z − u) − g(i) − β + h(i) b_old(i))/(ρ d(i) − 2β + h(i))]' + at(0.6, ';  on the teaching reductions: g = channel LLR, h = 0'),
    draw: function (g, p) { P.table(g, g.sideR, FIVE, { head: ['step', 'moves', 'derivative?', 'how'], cols: [0, 0.26, 0.45, 0.62], title: 'one CAJODE circuit on a measured frame', p: p, reveal: true, size: 11.5, mono: false, colours: function (i, j) { return j === 2 ? (FIVE[i][2] === 'no' ? C.dim : C.gold) : j === 0 ? C.ink : C.ink; } }); } });
  out.push({ id: 'stop', chapter: CH.rx, title: 'When does each soldier stop?', layout: 'side', dur: 6,
    text: 'Stopping is not convergence. A hard word that passes every parity check can be accepted even when the primal and dual residuals are not small. In these teaching walks, BP and the known-channel CAJODE reduction stop when every hard parity check passes, subject to a budget. In the full CAJODE receiver, acceptance also requires the configured fixed bits and the cyclic redundancy check (CRC) to pass. Small primal and dual residuals describe continuous settling; by themselves they certify neither stationarity nor a global optimum. On our tree, circuit 3 is accepted while its RMS consensus error is still ' + num(H3.primalRms, 3) + '.',
    math: 'hard acceptance: parity checks + configured fixed bits + CRC' + at(0.52, ';  settling diagnostics: primal and dual criteria') + at(0.78, '<br>tree circuit 3: e_RMS = ' + num(H3.primalRms, 6) + ' ≠ 0'),
    draw: function (g, p) {
      var rows = [['BP teaching walk', 'all hard parity checks pass', 'iteration budget'], ['CAJODE reduction', 'all hard parity checks pass', 'circuit budget'], ['full CAJODE receiver', 'checks, fixed bits and CRC pass', 'configured update budget'], ['primal and dual residuals', 'below configured thresholds', 'do not certify a global optimum']];
      P.table(g, g.sideR, rows, { head: ['test', 'condition', 'fallback'], cols: [0, 0.29, 0.72], title: 'Acceptance is not convergence', p: p, reveal: true, size: 12, mono: false, colours: function (i, j) { return j === 0 ? (i === 0 ? BPC : i < 3 ? NOTE : C.gold) : C.ink; } });
      var R = g.sideR; g.labelPx(R[0] + 14, R[1] + R[3] - 22, 'accepted hard word ' + bits(H3.word) + ', but b and z still differ: e_RMS ' + num(H3.primalRms, 3), C.gold, { plain: true, size: 12.5, p: seg(p, 0.8, 1) });
    } });
  var CARRY = [['state', 'q and r on each directed edge', 'shared b; replica z and dual u per edge'], ['a check contributes', 'extrinsic soft information', 'projected replica minus scaled dual'], ['recipient’s own input', 'excluded from that reply', 'included in the projection'], ['hard parity already passes', 'messages can remain nonzero', 'u changes whenever b−z is nonzero'], ['sum-product tree lesson', 'exact after information traverses it', 'accepted after 3 circuits here'], ['loop lesson', 'iterative, generally approximate', 'constraint memory remains per edge'], ['full receiver', 'Lch + αLext, then tanh', 'channel updates in each ADMM iteration'], ['acceptance', 'hard checks, within a budget', 'checks + fixed bits + CRC'], ['continuous status', 'separate from correctness', 'settling is not a global certificate']];
  out.push({ id: 'carry', chapter: CH.rx, title: 'What to carry', layout: 'side', dur: 6.6,
    text: 'The transferable distinction is now precise. BP is a message-passing algorithm: each variable-to-check or check-to-variable message excludes the recipient’s current input, although older evidence can recirculate on a loop. The CAJODE constraint block uses ADMM: shared relaxed bits must agree with projected replica variables, and one scaled dual variable per edge remembers any remaining b−z disagreement. In JADE, Lch+αLext passes through a tanh map to initialize joint channel estimation and decoding on the next pass. CAJODE updates the channel inside each ADMM iteration. Accepting the hard word remains separate from continuous settling, which does not certify a global optimum.',
    math: 'BP passes extrinsic information; each reply excludes its recipient’s current input.  CAJODE enforces replica agreement and accumulates b − z',
    draw: function (g, p) { P.table(g, g.sideR, CARRY, { head: ['', 'BP protocol', 'CAJODE constraint circuit'], cols: [0, 0.3, 0.64], title: 'same code graph, different mathematical mechanism', p: p, reveal: true, size: 12, mono: false, colours: function (i, j) { return j === 0 ? C.dim : j === 1 ? BPC : NOTE; } }); } });

  // ------------------------------------------------------------ player, chapter bar, keyboard, and deep links
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
  window.course = { steps: out, chapters: chapters, soldiers: { bp: bp, notes: nt, loopBP: lbp, loopNotes: lnt, coral: co, hill: hill } };
  var hash = (window.location && window.location.hash) || '', ms = /step=([^&]+)/.exec(hash), mp = /p=([0-9.]+)/.exec(hash);
  if (ms) { var st = decodeURIComponent(ms[1]); B.debug({ step: /^\d+$/.test(st) ? +st : st, p: mp ? +mp[1] : 1 }); }
})();
