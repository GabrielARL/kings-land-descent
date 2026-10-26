// The drawings of "Three symbols, two checks": the Tanner graph with values in its nodes and state on its edges, the
// unit square of one check with its parity polytope, traces over the rounds, matrices, number lines and flow boxes.
// Everything is drawn in canvas pixels inside the rectangle it is given.  Colours follow the owners: the signal gold,
// the shared estimates pale, the replicas blue, the ledgers orange, the corrected targets violet, BP messages teal.
var ThreeParts = (function () {
  'use strict';
  var B = window.Board; if (!B) return null;
  var H = B.H, C = H.C, seg = H.seg, num = H.num, clamp = H.clamp, mix = H.mix, backOut = H.backOut;
  var TAU = 2 * Math.PI, EDGES = window.Three ? window.Three.EDGES : [[0, 0, 0], [0, 1, 1], [1, 1, 0], [1, 2, 1]];
  var COL = { signal: C.gold, b: '#e6e9ee', z: C.blue, u: C.orange, target: C.violet, pass: C.green, fail: C.red, bp: '#7fd6b4', faint: C.faint, dim: C.dim };
  function rrect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function f2(v) { return num(v, 2); }

  // ------------------------------------------------------------ text with bold vectors and subscripts
  // "*b" sets the next letter bold (a vector or a matrix); "_x" or "_{A,1}" is a subscript, "^k" or "^{k+1}" a superscript.
  function pieces(s) {
    var out = [], i = 0, bold = false, cur = '';
    function flush() { if (cur) { out.push({ t: cur }); cur = ''; } }
    function group() { if (s.charAt(i) === '{') { var j = s.indexOf('}', i); var g0 = s.slice(i + 1, j < 0 ? s.length : j); i = j < 0 ? s.length : j + 1; return g0; } var ch = s.charAt(i); i++; return ch; }
    while (i < s.length) {
      var ch = s.charAt(i);
      if (ch === '*' && i + 1 < s.length && /[A-Za-z]/.test(s.charAt(i + 1))) { flush(); out.push({ t: s.charAt(i + 1), bold: true }); i += 2; continue; }
      if ((ch === '_' || ch === '^') && i + 1 < s.length) { flush(); i++; out.push({ t: group(), sub: ch === '_', sup: ch === '^' }); continue; }
      cur += ch; i++;
    }
    flush(); return out;
  }
  function fontOf(g, pc, size, o) { var sz = pc.sub || pc.sup ? size * 0.72 : size; return (pc.bold ? '700 ' : (o.weight || '400') + ' ') + sz.toFixed(1) + 'px ' + (o.mono && !pc.bold ? g.mono : g.sans); }
  function richWidth(g, s, o) { o = o || {}; var c = g.ctx, size = o.size || 13, w = 0; pieces(s).forEach(function (pc) { c.font = fontOf(g, pc, size, o); w += c.measureText(pc.t).width; }); return w; }
  // draw s with its left, centre or right at x and its middle at y; o: { size, col, align, p, box, mono, weight }; returns its box
  function rich(g, x, y, s, o) {
    o = o || {}; var p = o.p == null ? 1 : o.p; if (!(p > 0) || !s) return null;
    var c = g.ctx, size = o.size || 13, w = richWidth(g, s, o), x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    c.save(); c.globalAlpha = clamp(p, 0, 1);
    if (o.box) { c.fillStyle = C.box; c.beginPath(); rrect(c, x0 - 5, y - size / 2 - 4, w + 10, size + 8, 5); c.fill(); if (o.border) { c.strokeStyle = o.border; c.lineWidth = 1; c.stroke(); } }
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = o.col || C.ink;
    pieces(s).forEach(function (pc) { c.font = fontOf(g, pc, size, o); var dy = pc.sub ? size * 0.3 : pc.sup ? -size * 0.36 : 0; c.fillText(pc.t, x0, y + dy + 0.5); x0 += c.measureText(pc.t).width; });
    c.restore(); return [x - (o.align === 'center' ? w / 2 : o.align === 'right' ? w : 0) - 5, y - size / 2 - 4, w + 10, size + 8];
  }

  // ------------------------------------------------------------ layout helpers
  function wide(R) { return R[2] >= 600 && R[2] >= R[3] * 1.2; }
  function two(R, share, gap) {
    gap = gap || 8; share = share || 0.56;
    if (wide(R)) { var w = Math.round((R[2] - gap) * share); return [[R[0], R[1], w, R[3]], [R[0] + w + gap, R[1], R[2] - w - gap, R[3]]]; }
    var h = Math.round((R[3] - gap) * share); return [[R[0], R[1], R[2], h], [R[0], R[1] + h + gap, R[2], R[3] - h - gap]];
  }
  function sideBySide(R, gap) { gap = gap || 8; if (R[2] >= R[3] * 0.9) { var w = Math.round((R[2] - gap) / 2); return [[R[0], R[1], w, R[3]], [R[0] + w + gap, R[1], R[2] - w - gap, R[3]]]; } var h = Math.round((R[3] - gap) / 2); return [[R[0], R[1], R[2], h], [R[0], R[1] + h + gap, R[2], R[3] - h - gap]]; }
  // a panel of lines; items: { text, col, size, p, indent, mono }; text may use the rich marks
  function lines(g, R, items, p, title, o) {
    o = o || {}; var n = items.length, top = R[1] + (title ? 42 : 14), rowH = Math.min(o.rowH || 32, (R[3] - (top - R[1]) - 6) / Math.max(n, 1));
    g.panel(R, title);
    var size = o.size || (R[2] < 360 ? 12 : 13);
    items.forEach(function (it, i) { var q = it.p != null ? it.p : seg(p, i / (n + 0.4), (i + 1) / (n + 0.4)); if (!(q > 0)) return; rich(g, R[0] + 14 + (it.indent || 0), top + rowH * i + rowH / 2, it.text, { size: it.size || size, col: it.col || C.ink, p: q, mono: it.mono, weight: it.weight }); });
  }
  // a two-column table; rows: [left, right, colLeft?, colRight?]; o: { head: [l, r], leftW }
  function table(g, R, rows, p, title, o) {
    o = o || {}; var all = (o.head ? [o.head] : []).concat(rows), n = all.length, top = R[1] + (title ? 40 : 12), rowH = Math.min(o.rowH || 34, (R[3] - (top - R[1]) - 6) / n);
    var size = o.size || (R[2] < 380 ? 11.5 : 12.5), mid = R[0] + 12 + Math.min(o.leftW || 200, R[2] * (o.share || 0.42));
    g.panel(R, title);
    all.forEach(function (r, i) {
      var q = seg(p, i / (n + 0.5), (i + 1) / (n + 0.5)); if (!(q > 0)) return; var y = top + rowH * i + rowH / 2, head = o.head && i === 0;
      rich(g, R[0] + 12, y, r[0], { size: head ? size - 1 : size, col: head ? C.dim : (r[2] || o.leftCol || C.gold), p: q, weight: head ? '400' : '700' });
      rich(g, mid, y, r[1], { size: head ? size - 1 : size, col: head ? C.dim : (r[3] || o.rightCol || C.ink), p: q });
      if (head) { var c = g.ctx; c.strokeStyle = C.faint; c.lineWidth = 1; c.beginPath(); c.moveTo(R[0] + 10, y + rowH / 2 - 3); c.lineTo(R[0] + R[2] - 10, y + rowH / 2 - 3); c.stroke(); }
    });
  }

  // a three-column table; rows: [first, second, third]; o: { head: [..], shares: [a, b] (column starts as parts of the width) }
  function table3(g, R, rows, p, title, o) {
    o = o || {}; var all = (o.head ? [o.head] : []).concat(rows), n = all.length, top = R[1] + (title ? 40 : 12), rowH = Math.min(o.rowH || 46, (R[3] - (top - R[1]) - 6) / n);
    var narrow = R[2] < 560, size = o.size || (R[2] < 420 ? 11 : R[2] < 560 ? 11.5 : 13.5), sh = narrow ? [0.42, 0.42] : (o.shares || [0.3, 0.64]), xs = [R[0] + 12, R[0] + R[2] * sh[0], R[0] + R[2] * sh[1]], cols = o.cols || [C.gold, C.ink, COL.z];
    if (narrow) rowH = Math.min(58, (R[3] - (top - R[1]) - 6) / n);
    g.panel(R, title);
    all.forEach(function (r, i) {
      var q = seg(p, i / (n + 0.5), (i + 1) / (n + 0.5)); if (!(q > 0)) return; var y = top + rowH * i + rowH / 2, head = o.head && i === 0;
      r.forEach(function (cell, j) { var dy = narrow ? (j === 2 ? 9 : -8) : 0; rich(g, xs[j], y + dy, cell, { size: head ? size - 0.5 : size, col: head ? C.dim : cols[j], p: q, weight: j === 0 && !head ? '700' : '400' }); });
      if (head) { var c = g.ctx; c.strokeStyle = C.faint; c.lineWidth = 1; c.beginPath(); c.moveTo(R[0] + 10, y + rowH / 2 - 3); c.lineTo(R[0] + R[2] - 10, y + rowH / 2 - 3); c.stroke(); }
    });
  }

  // ------------------------------------------------------------ the Tanner graph
  // symbols on top (b₁, b₂, b₃), checks below (A, B); the four edges A–1, A–2, B–2, B–3
  function geo(R, o) {
    o = o || {}; var top = R[1] + (o.title ? 34 : 10), h = R[1] + R[3] - top - 8, W = R[2];
    var r = clamp(Math.min(W * 0.055, h * 0.085), 13, 23), ys = top + h * (o.ys == null ? 0.24 : o.ys), yk = top + h * (o.yk == null ? 0.8 : o.yk);
    var xs = o.xs || [0.13, 0.5, 0.87], xk = o.xk || [0.31, 0.69];
    return { R: R, r: r, S: xs.map(function (f) { return [R[0] + W * f, ys]; }), K: xk.map(function (f) { return [R[0] + W * f, yk]; }), compact: W < 520, tiny: W < 400 };
  }
  function ends(G, e) { var E = EDGES[e]; return [G.S[E[1]], G.K[E[0]]]; }
  function along(G, e, f) { var q = ends(G, e); return [mix(q[0][0], q[1][0], f), mix(q[0][1], q[1][1], f)]; }
  function graph(g, R, o) {
    o = o || {}; var c = g.ctx, G = geo(R, o), r = G.r, symP = o.symP == null ? 1 : o.symP, chkP = o.checkP == null ? 1 : o.checkP, edgeP = o.edgeP == null ? 1 : o.edgeP;
    if (o.panel !== false) g.panel(R, o.title);
    // edges first, under the nodes
    EDGES.forEach(function (E, e) {
      var q = ends(G, e), p = typeof edgeP === 'function' ? edgeP(e) : edgeP; if (!(p > 0)) return;
      var col = o.edgeCol ? o.edgeCol(e) : 'rgba(242,245,248,0.45)';
      c.strokeStyle = col; c.lineWidth = o.edgeW ? o.edgeW(e) : 1.6; c.beginPath(); c.moveTo(q[1][0], q[1][1] - r * 0.8); c.lineTo(mix(q[1][0], q[0][0], p), mix(q[1][1] - r * 0.8, q[0][1] + r, p)); c.stroke();
    });
    // symbol nodes
    G.S.forEach(function (s, i) {
      var p = typeof symP === 'function' ? symP(i) : symP; if (!(p > 0)) return; var rr = r * backOut(p);
      var isHi = o.hi === i || (o.hi && o.hi.indexOf && o.hi.indexOf(i) >= 0), lift = isHi && (o.hiP == null || o.hiP > 0) ? 7 : 0;
      if (isHi) { c.strokeStyle = C.gold; c.globalAlpha = clamp(o.hiP == null ? 1 : o.hiP, 0, 1); c.lineWidth = 2.5; c.beginPath(); c.arc(s[0], s[1], rr + 6, 0, TAU); c.stroke(); c.globalAlpha = 1; }
      c.beginPath(); c.arc(s[0], s[1], rr, 0, TAU); c.fillStyle = '#121c28'; c.fill(); c.lineWidth = 2; c.strokeStyle = o.symCol ? o.symCol(i) : COL.b; c.stroke();
      var v = o.vals ? o.vals[i] : null;
      if (v != null && p > 0.5) { c.font = '500 ' + Math.round(r * 0.62) + 'px ' + g.mono; c.fillStyle = o.valCol ? o.valCol(i) : COL.b; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = clamp(o.valP == null ? 1 : o.valP, 0, 1); c.fillText(v, s[0], s[1] + 0.5); c.globalAlpha = 1; }
      rich(g, s[0], s[1] - rr - 11 - lift, (o.names || ['b_1', 'b_2', 'b_3'])[i], { size: G.tiny ? 12 : 13.5, align: 'center', col: COL.b, p: seg(p, 0.4, 1) });
      if (o.sig) rich(g, s[0], s[1] - rr - 29 - lift, o.sig[i], { size: G.tiny ? 11 : 12, align: 'center', col: COL.signal, p: o.sigP == null ? 1 : o.sigP });
    });
    // check nodes
    G.K.forEach(function (k, a) {
      var p = typeof chkP === 'function' ? chkP(a) : chkP; if (!(p > 0)) return; var half = r * 0.85 * backOut(p), st = o.status ? o.status[a] : null, stP = o.statusP == null ? 1 : o.statusP;
      var edge = st && stP > 0 ? (st === 'pass' ? COL.pass : COL.fail) : 'rgba(242,245,248,0.85)';
      c.fillStyle = '#121c28'; c.beginPath(); rrect(c, k[0] - half, k[1] - half, 2 * half, 2 * half, 4); c.fill(); c.lineWidth = 2; c.strokeStyle = edge; c.stroke();
      c.font = '700 ' + Math.round(r * 0.75) + 'px ' + g.sans; c.fillStyle = C.ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(['A', 'B'][a], k[0], k[1] + 0.5);
      if (st && stP > 0) rich(g, k[0], k[1] + half + 15, st === 'pass' ? '✓ passes' : '✗ fails', { size: 12.5, align: 'center', col: edge, p: stP, weight: '700' });
      if (o.checkNote && o.checkNote[a]) rich(g, k[0], k[1] + half + (st ? 33 : 15), o.checkNote[a], { size: G.tiny ? 11 : 12, align: 'center', col: o.checkNoteCol || COL.z, p: o.checkNoteP == null ? 1 : o.checkNoteP });
    });
    // state on the edges: boxes of rows [name, value, colour]
    if (o.boxes) o.boxes.forEach(function (bx, e) { if (bx) edgeBox(g, G, e, bx); });
    if (o.arrows) o.arrows.forEach(function (ar) { edgeArrow(g, G, ar); });
    return G;
  }
  // a box on edge e: bx = { rows: [[name, value, col]], p, f (place along the edge from the symbol), hi }
  function edgeBox(g, G, e, bx) {
    var p = bx.p == null ? 1 : bx.p; if (!(p > 0)) return; var c = g.ctx, at = along(G, e, bx.f == null ? 0.5 : bx.f), size = G.tiny ? 10.5 : G.compact ? 11 : 12;
    var rows = bx.rows.filter(Boolean), texts = rows.map(function (rw) { return G.compact || bx.short ? rw[1] : rw[0] + ' ' + rw[1]; });
    var w = Math.max.apply(null, texts.map(function (t) { return richWidth(g, t, { size: size, mono: true }); })) + 12, h = rows.length * (size + 5) + 6;
    c.save(); c.globalAlpha = clamp(p, 0, 1); c.fillStyle = 'rgba(8,12,18,0.92)'; c.beginPath(); rrect(c, at[0] - w / 2, at[1] - h / 2, w, h, 5); c.fill();
    c.lineWidth = bx.hi ? 2 : 1; c.strokeStyle = bx.hi ? C.gold : (rows[0] && rows[0][2]) || C.faint; c.stroke(); c.restore();
    rows.forEach(function (rw, j) {
      var y = at[1] - h / 2 + 3 + (size + 5) * (j + 0.5) + 1, val = rw[1];
      if (G.compact || bx.short) rich(g, at[0], y, val, { size: size, mono: true, align: 'center', col: rw[2] || C.ink, p: p * (rw[3] == null ? 1 : rw[3]) });
      else { var nw = richWidth(g, rw[0] + ' ', { size: size, mono: true }), x0 = at[0] - w / 2 + 6; rich(g, x0, y, rw[0], { size: size, mono: true, col: rw[2] || C.ink, p: p * (rw[3] == null ? 1 : rw[3]) }); rich(g, x0 + nw, y, val, { size: size, mono: true, col: C.ink, p: p * (rw[3] == null ? 1 : rw[3]) }); }
    });
  }
  // an arrow beside edge e, from the check toward the symbol (or back); ar = { e, text, col, p, back, side (±1), at (label place) }
  function edgeArrow(g, G, ar) {
    var p = ar.p == null ? 1 : ar.p; if (!(p > 0)) return; var q = ends(G, ar.e), dx = q[0][0] - q[1][0], dy = q[0][1] - q[1][1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, side = ar.side || 1, off = G.r * 0.75 * side;
    var A = [mix(q[1][0], q[0][0], 0.2) + nx * off, mix(q[1][1], q[0][1], 0.2) + ny * off], Bp = [mix(q[1][0], q[0][0], 0.78) + nx * off, mix(q[1][1], q[0][1], 0.78) + ny * off];
    if (ar.back) { var t0 = A; A = Bp; Bp = t0; }
    g.arrowPx(A, [mix(A[0], Bp[0], p), mix(A[1], Bp[1], p)], ar.col || COL.z, ar.w || 2, ar.dash);
    if (ar.text) { var lp = ar.at == null ? 0.55 : ar.at, x = mix(A[0], Bp[0], lp) + nx * (G.r * 0.9) * side, y = mix(A[1], Bp[1], lp) + ny * (G.r * 0.9) * side; rich(g, x, y, ar.text, { size: ar.size || (G.tiny ? 11 : 12), col: ar.col || COL.z, align: 'center', p: seg(p, 0.5, 1), box: true, mono: ar.mono }); }
  }

  // ------------------------------------------------------------ one check's unit square and its parity polytope
  // o: { title, x: 'b_1', y: 'b_2', q: [x, y], qText, z, zText, name ('𝒫_A'), boxP, segP, qP, footP, clipP }
  function square(g, R, o) {
    o = o || {}; var c = g.ctx; g.panel(R, o.title);
    var top = R[1] + (o.title ? 44 : 18), side = Math.max(60, Math.min(R[2] - 100, R[3] - (top - R[1]) - 48)), x0 = R[0] + Math.max(54, (R[2] - side) / 2), y0 = top + side;
    function P(q) { return [x0 + q[0] * side, y0 - q[1] * side]; }
    var boxP = o.boxP == null ? 1 : o.boxP;
    if (boxP > 0) {
      c.save(); c.globalAlpha = clamp(boxP, 0, 1); c.strokeStyle = 'rgba(242,245,248,0.35)'; c.lineWidth = 1.2; c.strokeRect(x0, y0 - side, side, side);
      c.font = '11px ' + g.mono; c.fillStyle = C.dim; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText('0.5', x0 + side / 2, y0 + 4);
      c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText('0.5', x0 - 5, y0 - side / 2); c.restore();
      rich(g, x0 + side * 0.82, y0 + 24, (o.x || 'b_1') + ' →', { size: 12.5, align: 'center', p: boxP });
      rich(g, x0 - 6, y0 - side * 0.8, '↑ ' + (o.y || 'b_2'), { size: 12.5, align: 'right', p: boxP });
      [[0, 0, '00', COL.signal], [1, 1, '11', COL.signal], [0, 1, '01', COL.fail], [1, 0, '10', COL.fail]].forEach(function (k) {
        var a = P([k[0], k[1]]); c.globalAlpha = clamp(boxP, 0, 1); c.beginPath(); c.arc(a[0], a[1], 5, 0, TAU); c.fillStyle = k[3]; c.fill(); c.globalAlpha = 1;
        rich(g, a[0] + (k[0] ? 9 : -9), a[1] + (k[1] ? -11 : 11), k[2], { size: 12, mono: true, col: k[3], align: k[0] ? 'left' : 'right', p: boxP });
      });
    }
    var segP = o.segP == null ? 1 : o.segP;
    if (segP > 0) { var a0 = P([0, 0]), a1 = P([1, 1]); c.strokeStyle = COL.z; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(a0[0], a0[1]); c.lineTo(mix(a0[0], a1[0], segP), mix(a0[1], a1[1], segP)); c.stroke(); c.lineCap = 'butt';
      var lab = P([0.16, 0.16]); rich(g, lab[0] + 12, lab[1] + 6, o.name || '𝒫_A', { size: 14, col: COL.z, p: seg(segP, 0.6, 1), weight: '700' }); }
    if (o.clipP > 0 && o.q) { c.save(); c.globalAlpha = clamp(o.clipP, 0, 1); c.strokeStyle = COL.fail; c.setLineDash([5, 4]); c.lineWidth = 1.5; c.strokeRect(x0 - 3, y0 - side - 3, side + 6, side + 6); c.restore();
      var qa = P(o.q); rich(g, qa[0] + 10, qa[1] - 30, o.clipText || 'clipping to [0, 1] leaves it here', { size: 11.5, col: COL.fail, p: o.clipP, box: true }); }
    if (o.q && o.qP > 0) { var A = P(o.q); c.beginPath(); c.arc(A[0], A[1], 6 * backOut(o.qP), 0, TAU); c.fillStyle = COL.b; c.fill(); c.lineWidth = 2; c.strokeStyle = C.bg; c.stroke();
      if (o.qText) rich(g, A[0] + 10, A[1] - 13, o.qText, { size: 12, col: COL.b, p: seg(o.qP, 0.4, 1), box: true }); }
    if (o.q && o.z && o.footP > 0) {
      var Aq = P(o.q), Z = P(o.z), fp = clamp(o.footP, 0, 1);
      c.save(); c.setLineDash([4, 4]); c.strokeStyle = 'rgba(242,245,248,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(Aq[0], Aq[1]); c.lineTo(mix(Aq[0], Z[0], fp), mix(Aq[1], Z[1], fp)); c.stroke(); c.restore();
      if (fp > 0.9) { var ux = (Aq[0] - Z[0]), uy = (Aq[1] - Z[1]), l = Math.hypot(ux, uy) || 1, s = 9; ux /= l; uy /= l; var vx = Math.SQRT1_2, vy = -Math.SQRT1_2;
        c.strokeStyle = COL.z; c.lineWidth = 1.4; c.beginPath(); c.moveTo(Z[0] + ux * s, Z[1] + uy * s); c.lineTo(Z[0] + ux * s + vx * s, Z[1] + uy * s + vy * s); c.lineTo(Z[0] + vx * s, Z[1] + vy * s); c.stroke(); }
      c.beginPath(); c.arc(Z[0], Z[1], 6 * backOut(seg(fp, 0.7, 1)), 0, TAU); c.fillStyle = COL.z; c.fill(); c.lineWidth = 2; c.strokeStyle = C.bg; c.stroke();
      if (o.zText) { var zw = richWidth(g, o.zText, { size: 12 }), right = Z[0] + 12 + zw + 6 < R[0] + R[2]; rich(g, right ? Z[0] + 12 : Z[0] - 12, Z[1] + 16, o.zText, { size: 12, col: COL.z, p: seg(fp, 0.8, 1), box: true, align: right ? 'left' : 'right' }); }
    }
    return { P: P, side: side };
  }

  // ------------------------------------------------------------ traces over the rounds
  function series(rounds, pick) { return function (t) { var i = Math.floor(t), f = t - i, a = rounds[Math.min(i, rounds.length - 1)], b2 = rounds[Math.min(i + 1, rounds.length - 1)]; return pick(a) * (1 - f) + pick(b2) * f; }; }
  // o: { rounds, alone, n, upto, aloneP, passAt, title, half }
  function trace(g, R, o) {
    o = o || {}; var n = o.n || 12, pl = g.plot(R, [0, n], [0, 1], { title: o.title || 'the symbol estimates, round by round' }), up = o.upto == null ? 1 : clamp(o.upto, 0, 1), c = g.ctx;
    pl.frame('round', '');
    if (o.half !== false) { pl.seg(0, 0.5, n, 0.5, C.dim, 1.2, 1, [4, 4]); rich(g, pl.X(0) + 8, pl.Y(0.5) + 11, 'rounding at ½', { size: 11, col: C.dim }); }
    var cols = ['#f2f5f8', '#cfd8e2', '#aeb9c6'];
    if (o.alone && o.aloneP > 0) [0, 1, 2].forEach(function (i) {
      c.save(); c.setLineDash([5, 4]); pl.curve(series(o.alone, function (r) { return r.b[i]; }), 'rgba(255,154,138,0.85)', 1.8, o.aloneP); c.restore();
      if (o.aloneP >= 1) { var v = o.alone[Math.min(n, o.alone.length - 1)].b[i]; rich(g, pl.X(n) - 4, pl.Y(v) + (i === 1 ? -9 : 9), 'no ledger: ' + f2(v), { size: 11, col: COL.fail, align: 'right' }); }
    });
    if (o.rounds && up > 0) [0, 1, 2].forEach(function (i) { pl.curve(series(o.rounds, function (r) { return r.b[i]; }), cols[i], 2.2, up); });
    if (o.rounds) [0, 1, 2].forEach(function (i) { var v = o.rounds[0].b[i]; rich(g, pl.X(0) + 6, pl.Y(v) + (i === 0 ? 10 : -10), 'b_' + (i + 1), { size: 12, col: cols[i], p: seg(up, 0, 0.1) }); });
    if (o.passAt != null && up * n >= o.passAt) { var x = pl.X(o.passAt); c.strokeStyle = COL.pass; c.lineWidth = 1.3; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(x, pl.box[1]); c.lineTo(x, pl.box[1] + pl.box[3]); c.stroke(); c.setLineDash([]);
      rich(g, x + 6, pl.box[1] + 12, o.passText || 'round ' + o.passAt + ': 1 1 1 passes', { size: 11.5, col: COL.pass, p: o.passP == null ? 1 : o.passP }); }
    return pl;
  }
  // the disagreement ‖S_a b − z_a‖ over both checks, on a log scale; o: { rounds, alone, n, upto, aloneP, title }
  function gaps(g, R, o) {
    o = o || {}; var n = o.n || 12, lo = -3, hi = 0, pl = g.plot(R, [1, n], [lo, hi], { title: o.title || 'gap between the copies and b, log scale' }), up = o.upto == null ? 1 : clamp(o.upto, 0, 1);
    pl.frame('round', 'log₁₀ gap');
    function lg(rounds) { return series(rounds, function (r) { return Math.max(lo, Math.log(Math.max(r.gap, 1e-9)) / Math.LN10); }); }
    if (o.alone && o.aloneP > 0) { g.ctx.save(); g.ctx.setLineDash([5, 4]); pl.curve(lg(o.alone), 'rgba(255,154,138,0.85)', 1.8, o.aloneP); g.ctx.restore(); rich(g, pl.X(n) - 4, pl.Y(Math.log(o.alone[n].gap) / Math.LN10) - 11, 'no ledger: stays at ' + f2(o.alone[n].gap), { size: 11, col: COL.fail, align: 'right', p: o.aloneP }); }
    if (o.rounds && up > 0) { pl.curve(lg(o.rounds), COL.target, 2.2, up); rich(g, pl.X(Math.min(n, 5)) + 8, pl.Y(Math.log(o.rounds[5].gap) / Math.LN10) + 4, 'with the ledger: halves each round', { size: 11, col: COL.target, p: seg(up, 0.5, 1) }); }
    return pl;
  }

  // ------------------------------------------------------------ number lines: one row per symbol, 0 to 1
  // rows: [{ name, marks: [{ v, col, text, p, big, below }], arrow: { from, to, col, text, p } }]
  function numberLines(g, R, rows, p, title) {
    g.panel(R, title); var c = g.ctx, top = R[1] + (title ? 44 : 14), n = rows.length, rowH = (R[3] - (top - R[1]) - 26) / n, x0 = R[0] + 52, x1 = R[0] + R[2] - 22;
    function X(v) { return x0 + (x1 - x0) * v; }
    rows.forEach(function (row, i) {
      var y = top + rowH * (i + 0.55);
      rich(g, R[0] + 14, y, row.name, { size: 13.5, col: COL.b });
      c.strokeStyle = 'rgba(242,245,248,0.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(X(0), y); c.lineTo(X(1), y); c.stroke();
      [0, 0.5, 1].forEach(function (t) { c.beginPath(); c.moveTo(X(t), y - 4); c.lineTo(X(t), y + 4); c.stroke(); });
      if (i === n - 1) { c.font = '11px ' + g.mono; c.fillStyle = C.dim; c.textAlign = 'center'; c.textBaseline = 'top'; ['0', '½', '1'].forEach(function (t, j) { c.fillText(t, X(j / 2), y + 30); }); }
      (row.arrows || (row.arrow ? [row.arrow] : [])).forEach(function (ar, j) {
        if (!(ar.p > 0) || Math.abs(ar.to - ar.from) < 1e-6) return; var ya = y - 13 - 12 * (ar.lift || 0);
        g.arrowPx([X(ar.from), ya], [mix(X(ar.from), X(ar.to), clamp(ar.p, 0, 1)), ya], ar.col || COL.u, 2);
        if (ar.text) rich(g, (X(ar.from) + X(ar.to)) / 2, ya - 12, ar.text, { size: 11.5, col: ar.col || COL.u, align: 'center', p: seg(ar.p, 0.5, 1), mono: true });
      });
      (row.marks || []).forEach(function (m, j) {
        var q = m.p == null ? 1 : m.p; if (!(q > 0)) return; var rr = (m.big ? 7 : 5) * backOut(q);
        c.beginPath(); c.arc(X(m.v), y, rr, 0, TAU); c.fillStyle = m.col; c.fill(); c.lineWidth = 2; c.strokeStyle = C.bg; c.stroke();
        if (m.text) rich(g, X(m.v), y + (m.below === false ? -16 : 17), m.text, { size: 11.5, col: m.col, align: 'center', p: seg(q, 0.4, 1), mono: true });
      });
    });
    return X;
  }

  // ------------------------------------------------------------ matrices and boxes
  // a matrix with a name: rows of strings; o: { name, col, size, colOf(i, j), lit(i, j) } at (x, y) top-left; returns its width
  function matrix(g, x, y, name, rows, o) {
    o = o || {}; var w0 = name ? richWidth(g, name + ' = ', { size: 14 }) : 0, size = o.size || 13.5, h = rows.length * (size + 10);
    if (name) rich(g, x, y + h / 2, name + ' =', { size: 14, col: o.col || C.ink, p: o.p });
    var w = g.matrix(x + w0 + 4, y, rows, o.lit, { size: size, col: o.col || C.ink, colOf: o.colOf });
    return w0 + 4 + w;
  }
  function box(g, x, y, w, h, title, sub, col, p) {
    if (!(p > 0)) return; var c = g.ctx; c.save(); c.globalAlpha = clamp(p, 0, 1); c.fillStyle = 'rgba(8,12,18,0.9)'; c.beginPath(); rrect(c, x, y, w, h, 7); c.fill(); c.strokeStyle = col || C.ink; c.lineWidth = 1.6; c.stroke(); c.restore();
    rich(g, x + w / 2, y + (sub ? h * 0.36 : h / 2), title, { size: 13, col: col || C.ink, align: 'center', p: p, weight: '700' });
    if (sub) rich(g, x + w / 2, y + h * 0.7, sub, { size: 11.5, col: C.ink, align: 'center', p: p });
  }

  return { COL: COL, pieces: pieces, rich: rich, richWidth: richWidth, wide: wide, two: two, sideBySide: sideBySide, lines: lines, table: table, table3: table3,
           geo: geo, along: along, graph: graph, edgeBox: edgeBox, edgeArrow: edgeArrow, square: square, trace: trace, gaps: gaps, numberLines: numberLines, matrix: matrix, box: box };
})();
