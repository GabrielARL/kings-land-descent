// The drawings of the tutorial "The BP protocol and the SAPPHIRE constraint circuit" (soldiers_course.js): soldiers and
// junctions in the decks' style, the comic of a tree or a loop with tags, messages that travel along its lines, the
// zoom on one junction with its speech bubble, the parity polytope of a three-soldier junction inside its cube, and
// small tables.  The kit g comes from board.js.
var SoldierParts = (function () {
  'use strict';
  var B = window.Board; if (!B) return null;
  var H = B.H, C = H.C, seg = H.seg, num = H.num, clamp = H.clamp, mix = H.mix, lerp2 = H.lerp2, backOut = H.backOut, sub = H.sub, add = H.add, len = H.len;
  var TAU = 2 * Math.PI, BODY = '#cfd8e2', CAP = '#3d6fa8', WRONG = '#ff9a8a', JUNCTION = '#ffd27a', CARD = '#f2f5f8', RECORD = C.violet, NOTE = C.orange, BP = C.blue, PULL = C.green;
  function rrect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function subscript(n) { var d = '₀₁₂₃₄₅₆₇₈₉'; return String(n).split('').map(function (q) { return d.charAt(Number(q)); }).join(''); }
  function sgn(v, d) { var s = num(v, d == null ? 2 : d); return v >= 0 && s.charAt(0) !== '−' ? '+' + s : s; }

  // ------------------------------------------------------------ figures, in canvas pixels
  // a soldier standing at (x, y), the middle of its body; s is its size (the body is about 2s tall)
  function soldierPx(c, x, y, s, o) {
    o = o || {}; var body = o.body || BODY, cap = o.cap || CAP;
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(8,12,18,0.9)'; c.lineWidth = Math.max(2, 0.22 * s);
    c.beginPath(); c.moveTo(x - 0.22 * s, y + 0.5 * s); c.lineTo(x - 0.24 * s, y + 1.0 * s); c.moveTo(x + 0.22 * s, y + 0.5 * s); c.lineTo(x + 0.24 * s, y + 1.0 * s); c.stroke();
    c.strokeStyle = body; c.lineWidth = Math.max(1.4, 0.13 * s); c.stroke();
    c.fillStyle = 'rgba(8,12,18,0.9)'; c.beginPath(); rrect(c, x - 0.46 * s, y - 0.5 * s, 0.92 * s, 1.08 * s, 0.25 * s); c.fill();
    c.fillStyle = body; c.beginPath(); rrect(c, x - 0.4 * s, y - 0.45 * s, 0.8 * s, 0.98 * s, 0.22 * s); c.fill();
    c.fillStyle = '#e8c9a8'; c.beginPath(); c.arc(x, y - 0.78 * s, 0.3 * s, 0, TAU); c.fill(); c.strokeStyle = 'rgba(8,12,18,0.9)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = cap; c.beginPath(); c.arc(x, y - 0.86 * s, 0.31 * s, Math.PI, TAU); c.closePath(); c.fill();
    c.fillRect(x - 0.4 * s, y - 0.88 * s, 0.8 * s, 0.09 * s);
    if (o.sash) { c.strokeStyle = o.sash; c.lineWidth = Math.max(1.5, 0.12 * s); c.beginPath(); c.moveTo(x - 0.3 * s, y - 0.4 * s); c.lineTo(x + 0.3 * s, y + 0.4 * s); c.stroke(); }
  }
  function officerPx(c, x, y, s) { soldierPx(c, x, y, s, { body: '#f2c27a', cap: '#8a4b00', sash: '#c45100' }); }
  function junctionPx(c, x, y, s, label, o) {
    o = o || {}; var w = 1.3 * s;
    c.fillStyle = o.fill || '#1a2330'; c.strokeStyle = o.col || JUNCTION; c.lineWidth = o.lw || 2.2;
    c.beginPath(); c.rect(x - w / 2, y - w / 2, w, w); c.fill(); c.stroke();
    c.fillStyle = o.col || JUNCTION; c.font = '700 ' + Math.round(0.62 * s) + 'px ' + (o.font || 'sans-serif'); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, x, y + 0.5);
  }
  // world-placed versions; o: { p, alpha, body, wrong, name (label under), size }
  function size(g) { return clamp(0.34 * g.s, 9, 19); }
  function soldier(g, q, o) {
    o = o || {}; var p = o.p == null ? 1 : o.p; if (!(p > 0)) return; var a = g.P(q), s = (o.size || size(g)) * backOut(clamp(p, 0, 1)), c = g.ctx;
    g.clip(g.mapR); c.globalAlpha = clamp(p, 0, 1) * (o.alpha == null ? 1 : o.alpha);
    if (o.officer) officerPx(c, a[0], a[1], s); else soldierPx(c, a[0], a[1], s, { body: o.wrong ? WRONG : o.body, sash: o.sash });
    c.globalAlpha = 1; c.restore();
    // The counting formation has neighbours only about 60 px apart on a phone.  Keep their names distinct there;
    // the desktop size remains unchanged for the denser mathematical figures.
    if (o.name != null) g.labelPx(a[0], a[1] + 1.32 * s + 7, o.name, o.wrong ? WRONG : C.dim, { align: 'center', size: g.W < 480 ? 9.5 : 11.5, plain: true, p: clamp(p, 0, 1) * (o.alpha == null ? 1 : o.alpha) });
  }
  function junction(g, q, k, o) {
    o = o || {}; var p = o.p == null ? 1 : o.p; if (!(p > 0)) return; var a = g.P(q), s = size(g) * 1.1, c = g.ctx;
    g.clip(g.mapR); c.globalAlpha = clamp(p, 0, 1) * (o.alpha == null ? 1 : o.alpha);
    junctionPx(c, a[0], a[1], s, 'c' + subscript(k), { col: o.col, fill: o.fill, font: g.sans });
    if (o.ring) { c.strokeStyle = o.ring; c.lineWidth = 2; c.beginPath(); c.rect(a[0] - 0.95 * s, a[1] - 0.95 * s, 1.9 * s, 1.9 * s); c.stroke(); }
    c.globalAlpha = 1; c.restore();
  }
  // a speech bubble in canvas pixels, pointing at (px, py); lines of text; o: { col, w, align }
  function bubble(g, x, y, lines, px, py, o) {
    o = o || {}; var c = g.ctx, size = o.size || 12.5, lh = size + 5, pad = 8, w = 0;
    c.font = '600 ' + size + 'px ' + g.sans; lines.forEach(function (t) { w = Math.max(w, c.measureText(t).width); });
    var bw = w + 2 * pad, bh = lines.length * lh + 2 * pad - 4, lo = o.box ? o.box[0] + 4 : 4, hi = o.box ? o.box[0] + o.box[2] - bw - 4 : g.W - bw - 4, x0 = clamp(x - (o.align === 'right' ? bw : o.align === 'center' ? bw / 2 : 0), lo, Math.max(lo, hi)), y0 = clamp(y, 4, g.H - bh - 4);
    c.globalAlpha = o.p == null ? 1 : clamp(o.p, 0, 1);
    c.fillStyle = '#fff6e6'; c.strokeStyle = o.col || C.orange; c.lineWidth = 1.6;
    c.beginPath(); rrect(c, x0, y0, bw, bh, 8); c.fill(); c.stroke();
    if (px != null) { var bx = clamp(px, x0 + 12, x0 + bw - 12), by = py < y0 ? y0 : y0 + bh; c.beginPath(); c.moveTo(bx - 7, by); c.lineTo(px, py); c.lineTo(bx + 7, by); c.closePath(); c.fill(); c.beginPath(); c.moveTo(bx - 7, by); c.lineTo(px, py); c.lineTo(bx + 7, by); c.stroke(); c.fillStyle = '#fff6e6'; c.fillRect(bx - 6, by - (py < y0 ? -1 : 2), 12, 2.5); }
    c.fillStyle = '#1b1406'; c.textAlign = 'left'; c.textBaseline = 'middle';
    lines.forEach(function (t, j) { c.fillText(t, x0 + pad, y0 + pad + lh * j + lh / 2 - 2); });
    c.globalAlpha = 1;
    return [x0, y0, bw, bh];
  }
  // a tag that travels from a to b (world spots) at fraction t of the way
  function flyTag(g, a, b, t, text, col, o) {
    o = o || {}; if (!(t > 0)) return; if (t >= 1 && o.rest == null) return; var A = g.P(a), Bp = g.P(b), f = H.ease(clamp(t, 0, 1)) * (o.rest == null ? 1 : o.rest), x = mix(A[0], Bp[0], f), y = mix(A[1], Bp[1], f);
    g.labelPx(x + (o.dx || 0), y + (o.dy || 0), text, col, { align: 'center', size: o.size || 12, p: o.p == null ? 1 : o.p, mono: true });
  }

  // ------------------------------------------------------------ the comic of a code
  // o: { code (TREE or LOOP), pos (soldier spots), jpos (junction spots), tags (texts beside the soldiers), tagCol,
  //      tagSide (dx per soldier), wrong (soldier flags), focus (junction index: the rest faded), lit (edge keys 'k,i'),
  //      litCol, names (true: 'soldier i' labels), alpha, jcol (per junction colour) }
  function comic(g, o) {
    var code = o.code, fade = function (k) { return o.focus == null || o.focus === k ? 1 : 0.28; };
    code.checks.forEach(function (c, k) { c.forEach(function (i) {
      var key = k + ',' + i, lit = o.lit && o.lit.indexOf(key) >= 0;
      g.line(o.pos[i], o.jpos[k], lit ? (o.litCol || C.orange) : 'rgba(242,245,248,0.42)', lit ? 3 : 1.6, 1);
    }); });
    code.checks.forEach(function (c, k) { junction(g, o.jpos[k], k, { alpha: fade(k), col: o.jcol && o.jcol[k] }); });
    for (var i = 0; i < code.n; i++) {
      var ks = code.checks.map(function (c, k) { return c.indexOf(i) >= 0 ? k : -1; }).filter(function (k) { return k >= 0; }), a = Math.max.apply(null, ks.map(fade));
      soldier(g, o.pos[i], { wrong: o.wrong && o.wrong[i], alpha: a, name: o.names === false ? null : 'soldier ' + i });
      if (o.tags && o.tags[i] != null) { var sz = size(g); g.label(o.pos[i], o.tags[i], o.tagCols ? o.tagCols[i] : (o.wrong && o.wrong[i] ? WRONG : (o.tagCol || C.gold)), { dy: 1.32 * sz + 26, align: 'center', size: 12, mono: true, p: a }); }
    }
  }

  // ------------------------------------------------------------ the zoom on one junction, in the side panel
  // o: { k, members (soldier indices), up (texts on the arrows towards the junction, or null), down (texts on the arrows
  //      towards the soldiers), active (index into members whose arrow is lit), bubble (lines), title, p, cards (texts
  //      under the soldiers), wrong (soldier flags), upCol, downCol }
  function zoom(g, R, o) {
    var c = g.ctx, p = o.p == null ? 1 : o.p, narrow = R[3] < 300;
    g.panel(R, o.title);
    var slim = R[2] < 480, jx = R[0] + R[2] * (slim ? 0.3 : narrow ? 0.3 : 0.38), jy = R[1] + (narrow ? 64 : 92), s = clamp(Math.min(R[2], R[3]) * 0.05, 10, 17);
    var xs = o.members.map(function (_, j) { return R[0] + R[2] * (narrow ? 0.12 + 0.18 * j : 0.16 + 0.26 * j); }), sy = R[1] + R[3] - (narrow ? 50 : 74);
    o.members.forEach(function (i, j) {
      var x = xs[j], lit = o.active === j, col = lit ? (o.downCol || C.orange) : 'rgba(242,245,248,0.55)', top = jy + 0.75 * s + 4, bot = sy - 1.4 * s;
      c.globalAlpha = clamp(p, 0, 1); c.strokeStyle = col; c.lineWidth = lit ? 2.6 : 1.6; c.beginPath(); c.moveTo(jx, top); c.lineTo(x, bot); c.stroke(); c.globalAlpha = 1;
      var upAt = lerp2([jx, top], [x, bot], narrow ? 0.8 : 0.7), downAt = lerp2([jx, top], [x, bot], o.allDown ? (narrow ? 0.8 : 0.62) : 0.42);
      if (o.up && o.up[j] != null && !lit) { g.arrowPx([x, bot], lerp2([x, bot], [jx, top], 0.82), o.upCol || C.gold, 2); g.labelPx(upAt[0], upAt[1], o.up[j], o.upCol || C.gold, { align: 'center', size: 12, mono: true, p: p }); }
      if (o.down && o.down[j] != null && (lit || o.allDown)) { g.arrowPx([jx, top], lerp2([jx, top], [x, bot], 0.86), o.downCol || C.orange, 2.4); g.labelPx(downAt[0], downAt[1], o.down[j], o.downCol || C.orange, { align: 'center', size: 12, mono: true, p: p }); }
      c.globalAlpha = clamp(p, 0, 1); soldierPx(c, x, sy, s, { body: o.wrong && o.wrong[i] ? WRONG : BODY }); c.globalAlpha = 1;
      g.labelPx(x, sy + 1.32 * s + 8, (o.shortNames ? 'bit ' : 'soldier ') + i, o.wrong && o.wrong[i] ? WRONG : C.dim, { align: 'center', size: o.nameSize || 11.5, plain: true, p: p });
      if (o.cards && o.cards[j] != null) g.labelPx(x, sy + 1.32 * s + 26, o.cards[j], o.cardCol || CARD, { align: 'center', size: o.cardSize || 12, mono: true, p: p });
    });
    c.globalAlpha = clamp(p, 0, 1); junctionPx(c, jx, jy, s * 1.05, 'c' + subscript(o.k), { font: g.sans }); c.globalAlpha = 1;
    if (o.bubble) bubble(g, jx + 1.2 * s + 10, R[1] + 30, o.bubble, jx + 0.8 * s, jy - 0.3 * s, { p: o.bubbleP == null ? p : o.bubbleP, col: o.bubbleCol, box: R, size: slim ? 11.5 : 12.5 });
  }

  // ------------------------------------------------------------ the parity polytope of three soldiers, in its cube
  // The cube [0,1]^3 of three cards, its eight corners, the four valid patterns (even number of ones) and the solid
  // they span; o: { R (pixels), yaw, pitch, p, axes (three names), from (a point), to (its projection), labelFrom,
  //      labelTo, face (true: light the face the projection lands on), cut (true: the broken corner and its cut) }
  function cube(g, o) {
    var R = o.R, c = g.ctx, p = o.p == null ? 1 : o.p, yaw = o.yaw == null ? 0.62 : o.yaw, pitch = o.pitch == null ? 0.42 : o.pitch;
    var S = Math.min(R[2], R[3]) * (o.scale || 0.42), cx = R[0] + R[2] / 2, cy = R[1] + R[3] * 0.53;
    function P3(v) { var x = v[0] - 0.5, y = v[1] - 0.5, z = v[2] - 0.5, x1 = x * Math.cos(yaw) - y * Math.sin(yaw), y1 = x * Math.sin(yaw) + y * Math.cos(yaw); return [cx + S * x1, cy - S * (z * Math.cos(pitch) - y1 * Math.sin(pitch)), y1 * Math.cos(pitch) + z * Math.sin(pitch)]; }
    var corners = []; for (var m = 0; m < 8; m++) corners.push([(m >> 2) & 1, (m >> 1) & 1, m & 1]);
    var ok = function (v) { return (v[0] + v[1] + v[2]) % 2 === 0; };
    c.save(); c.globalAlpha = clamp(p, 0, 1); c.lineCap = 'round';
    // cube edges
    c.strokeStyle = 'rgba(242,245,248,0.28)'; c.lineWidth = 1.2;
    corners.forEach(function (a) { corners.forEach(function (b) { var d = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); if (d === 1 && a < b) { var A = P3(a), Bp = P3(b); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(Bp[0], Bp[1]); c.stroke(); } }); });
    // the solid: four faces, far ones first
    var V = corners.filter(ok), faces = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]].map(function (f) { var pts = f.map(function (j) { return V[j]; }); return { pts: pts, depth: pts.reduce(function (s, q) { return s + P3(q)[2]; }, 0) / 3 }; });
    faces.sort(function (a, b) { return b.depth - a.depth; });
    var target = o.to ? [o.to[0] + o.to[1] + o.to[2]] : null;
    faces.forEach(function (f) {
      var lit = o.face && o.to && f.pts.every(function (q) { return Math.abs(q[0] + q[1] + q[2] - 2) < 1e-9; }) && Math.abs(o.to[0] + o.to[1] + o.to[2] - 2) < 1e-6;
      c.beginPath(); f.pts.forEach(function (q, j) { var a = P3(q); if (j) c.lineTo(a[0], a[1]); else c.moveTo(a[0], a[1]); }); c.closePath();
      c.fillStyle = lit ? 'rgba(217,194,255,0.30)' : 'rgba(169,205,246,0.10)'; c.fill(); c.strokeStyle = C.blue; c.lineWidth = 1.8; c.stroke();
    });
    void target;
    // corners: valid patterns blue and labelled, broken ones hollow
    corners.forEach(function (v) {
      var a = P3(v), name = '' + v[0] + v[1] + v[2], good = ok(v);
      c.beginPath(); c.arc(a[0], a[1], good ? 5.5 : 4.5, 0, TAU);
      if (good) { c.fillStyle = C.blue; c.fill(); } else { c.fillStyle = '#0b121b'; c.fill(); c.strokeStyle = 'rgba(255,154,138,0.85)'; c.lineWidth = 1.6; c.stroke(); }
      var dx = a[0] < cx ? -10 : 10;
      if (good || o.labelBroken !== false) g.labelPx(a[0] + dx, a[1] + (a[1] < cy ? -11 : 12), name, good ? C.blue : 'rgba(255,154,138,0.9)', { align: dx < 0 ? 'right' : 'left', size: 11.5, mono: true, plain: true, p: p });
    });
    if (o.axes) {
      var O3 = P3([0, 0, 0]);
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach(function (e, j) { var A = P3([e[0] * 1.45, e[1] * 1.45, e[2] * 1.4]); c.strokeStyle = 'rgba(242,245,248,0.35)'; c.lineWidth = 1; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(O3[0], O3[1]); c.lineTo(A[0], A[1]); c.stroke(); c.setLineDash([]); g.labelPx(A[0], A[1], o.axes[j], C.dim, { align: 'center', size: 11.5, plain: true, p: p }); });
    }
    c.restore();
    if (o.from) {
      var F = P3(o.from), q2 = o.moveP == null ? 1 : o.moveP;
      c.save(); c.fillStyle = CARD; c.beginPath(); c.arc(F[0], F[1], 5, 0, TAU); c.fill(); c.restore();
      if (o.labelFrom) g.labelPx(F[0] + 10, F[1] - 14, o.labelFrom, CARD, { size: 12, mono: true, p: p });
      if (o.to && q2 > 0) {
        var T = P3(o.to), M = lerp2(F, T, H.ease(q2));
        c.save(); c.strokeStyle = RECORD; c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(F[0], F[1]); c.lineTo(M[0], M[1]); c.stroke(); c.setLineDash([]);
        c.fillStyle = RECORD; c.beginPath(); c.arc(M[0], M[1], 5.5, 0, TAU); c.fill(); c.restore();
        if (o.labelTo && q2 >= 1) g.labelPx(T[0] + (o.toDx == null ? -10 : o.toDx), T[1] + (o.toDy == null ? 18 : o.toDy), o.labelTo, RECORD, { size: 12, mono: true, align: o.toAlign || 'right', p: p });
      }
    }
    return P3;
  }

  // ------------------------------------------------------------ small tables and strips
  // rows of cells; o: { head (cells), cols (relative x of each column), colours (per column or function(r, j)), p, title,
  //      rowH, size, lit (row index lit) }
  function table(g, R, rows, o) {
    o = o || {}; var p = o.p == null ? 1 : o.p, n = rows.length + (o.head ? 1 : 0), top = R[1] + (o.title ? 40 : 14), rowH = Math.min(o.rowH || 26, (R[3] - (top - R[1]) - 8) / Math.max(1, n)), size = o.size || 12;
    var stacked = R[2] < 480 && o.mono === false && o.head && rows[0] && rows[0].length >= 3;
    g.panel(R, stacked ? null : o.title);
    // Prose-heavy comparison tables cannot preserve four desktop columns in a phone-width canvas.  On narrow
    // panels, turn each source row into a small labelled card: the row subject first, then one line per comparison
    // column.  Numeric tables keep their compact grid.  Font fitting is a last few-pixel safeguard, not truncation.
    if (stacked) {
      var cardTop = R[1] + (o.title ? 38 : 10), cardH = (R[3] - (cardTop - R[1]) - 8) / Math.max(1, rows.length), c = g.ctx;
      function shortHead(t) {
        if (/BP soldier/i.test(t)) return 'BP';
        if (/note-taking soldier/i.test(t)) return 'SAPPHIRE';
        return String(t || '').replace(/\?$/, '');
      }
      function fit(text, start, least) {
        var s = start, maxW = R[2] - 28;
        while (s > least) { c.font = '600 ' + s + 'px ' + g.sans; if (c.measureText(text).width <= maxW) break; s -= 0.5; }
        return s;
      }
      if (o.title) g.labelPx(R[0] + 10, R[1] + 16, o.title, C.gold, { size: fit(o.title, 12.5, 9), plain: true, p: p });
      rows.forEach(function (r, i) {
        var q = o.reveal ? seg(p, 0.05 + 0.85 * i / rows.length, 0.15 + 0.85 * i / rows.length) : p; if (!(q > 0)) return;
        var y0 = cardTop + cardH * i, gap = Math.min(15, Math.max(10.5, (cardH - 5) / r.length)), used = gap * r.length, firstY = y0 + Math.max(3, (cardH - used) / 2) + gap / 2;
        if (o.lit === i) { c.globalAlpha = clamp(q, 0, 1); c.fillStyle = 'rgba(255,210,122,0.12)'; c.fillRect(R[0] + 6, y0 + 1, R[2] - 12, cardH - 2); c.globalAlpha = 1; }
        r.forEach(function (t, j) {
          var prefix = j ? shortHead(o.head[j]) + ' · ' : '', label = prefix + String(t), col = typeof o.colours === 'function' ? o.colours(i, j, t) : o.colours ? o.colours[j] : C.ink;
          g.labelPx(R[0] + 14, firstY + gap * j, label, col || C.ink, { size: fit(label, j ? 10.5 : 11, 8.5), plain: true, mono: false, p: q });
        });
        if (i < rows.length - 1) { c.globalAlpha = 0.55 * clamp(q, 0, 1); c.strokeStyle = 'rgba(242,245,248,0.18)'; c.lineWidth = 1; c.beginPath(); c.moveTo(R[0] + 12, y0 + cardH); c.lineTo(R[0] + R[2] - 12, y0 + cardH); c.stroke(); c.globalAlpha = 1; }
      });
      return;
    }
    var cols = o.cols || rows[0].map(function (_, j) { return j / rows[0].length; });
    function xAt(j) { return R[0] + 12 + (R[2] - 24) * cols[j]; }
    if (o.head) o.head.forEach(function (t, j) { g.labelPx(xAt(j), top + rowH / 2, t, C.dim, { size: size - 0.5, plain: true, p: p }); });
    rows.forEach(function (r, i) {
      var y = top + rowH * (i + (o.head ? 1 : 0)) + rowH / 2, q = o.reveal ? seg(p, 0.05 + 0.85 * i / rows.length, 0.15 + 0.85 * i / rows.length) : p; if (!(q > 0)) return;
      if (o.lit === i) { var c = g.ctx; c.fillStyle = 'rgba(255,210,122,0.12)'; c.fillRect(R[0] + 6, y - rowH / 2, R[2] - 12, rowH); }
      r.forEach(function (t, j) { var col = typeof o.colours === 'function' ? o.colours(i, j, t) : o.colours ? o.colours[j] : C.ink; g.labelPx(xAt(j), y, String(t), col || C.ink, { size: size, plain: true, mono: j > 0 && o.mono !== false, p: q }); });
    });
  }
  // a word as a strip of signs or bits, the wrong ones lit
  function wordText(word, sent, plus) {
    return word.map(function (v) { return plus ? (v > 0 ? '+' : '−') : String(v); }).join('');
  }
  return { BODY: BODY, CAP: CAP, WRONG: WRONG, JUNCTION: JUNCTION, CARD: CARD, RECORD: RECORD, NOTE: NOTE, BP: BP, PULL: PULL,
           soldierPx: soldierPx, officerPx: officerPx, junctionPx: junctionPx, soldier: soldier, junction: junction, bubble: bubble, flyTag: flyTag, comic: comic, zoom: zoom, cube: cube,
           table: table, wordText: wordText, subscript: subscript, sgn: sgn, size: size };
})();
