// The parts of the step-by-step board that only some days need: the height of the tower lands (the old fort and the
// ridge), the Cartographer's journal, reading and stride tests, and the Twins' aim, rope, Warden and ledger.  Each
// part is registered with Board.register(name, function (cx, out, H) { ... out.push(step) ... }); see board.js.
(function () {
  'use strict';
  var B = window.Board; if (!B) return;
  var H = B.H, C = H.C, seg = H.seg, num = H.num, pair = H.pair, par = H.par, at = H.at, frac = H.frac, add = H.add, sub = H.sub, dot = H.dot;
  var lerp2 = H.lerp2, len = H.len, scale = H.scale, around = H.around, clamp = H.clamp, mix = H.mix, ease = H.ease;
  var TAU = 2 * Math.PI;
  function sign(v) { return v >= 0 ? '+' : '−'; }
  function order(q) { return '(' + sign(q[0]) + ', ' + sign(q[1]) + ')'; }
  function boxPath(b) { return [[b[0], b[0]], [b[1], b[0]], [b[1], b[1]], [b[0], b[1]], [b[0], b[0]]]; }
  // a strided name: 1, ½, ¼, ⅛, then 1/2^j
  function strideName(s) { var j = Math.round(-Math.log(s) / Math.LN2); return j === 0 ? '1' : j === 1 ? '½' : j === 2 ? '¼' : j === 3 ? '⅛' : '1/' + Math.pow(2, j); }

  // ------------------------------------------------------------ the tower lands: two sentries' cards
  B.register('towerHeight', function (cx, out) {
    var land = cx.land, P = cx.p, x = cx.x, y = land.y, s2 = P.s2, mb = P.muB, mp = P.muP, s = land.lawSign, tw = cx.hero === 'tw';
    var dx = [x[0] - y[0], x[1] - y[1]], lan = (dx[0] * dx[0] + dx[1] * dx[1]) / (2 * s2);
    var f1 = Math.pow(1 - x[0] * x[0], 2), f2 = Math.pow(1 - x[1] * x[1], 2), fl = mb * (f1 + f2);
    var r = 1 - s * x[0] * x[1], law = mp * r * r;
    var gLan = [dx[0] / s2, dx[1] / s2], gFl = [-4 * mb * x[0] * (1 - x[0] * x[0]), -4 * mb * x[1] * (1 - x[1] * x[1])], gLaw = [-2 * mp * r * s * x[1], -2 * mp * r * s * x[0]];
    cx.parts.push({ name: 'lanterns', value: lan, col: C.gold }, { name: 'flags', value: fl, col: C.green });
    cx.gradParts.push({ name: 'lanterns (x − y)/σ²', vec: gLan, col: C.gold }, { name: 'flags', vec: gFl, col: C.green });
    if (!tw) { cx.parts.push({ name: 'the law', value: law, col: C.violet }); cx.gradParts.push({ name: 'the law', vec: gLaw, col: C.violet }); }
    var view = [-1.32, 1.32, -1.32, 1.32], T = land.treasure, seg2 = land.lawSegment, weather = !!(land.ripples || land.holes);
    var lanFn = function (q) { return ((q[0] - y[0]) * (q[0] - y[0]) + (q[1] - y[1]) * (q[1] - y[1])) / (2 * s2); };
    var flFn = function (q) { return mb * (Math.pow(1 - q[0] * q[0], 2) + Math.pow(1 - q[1] * q[1], 2)); };
    var lawFn = function (q) { var rr = 1 - s * q[0] * q[1]; return mp * rr * rr; };
    var SQ = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]], CORN = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    function square(g, p, col) { g.path(SQ, col || 'rgba(255,210,122,0.7)', 1.5, p, [6, 4]); }
    function corners(g, p, marks) {
      CORN.forEach(function (q, i) {
        var ok = q[0] * q[1] === s, q0 = seg(p, i * 0.1, i * 0.1 + 0.2), col = marks ? (ok ? C.blue : C.orange) : C.ink;
        g.dot(q, 5, col, q0);
        g.label(q, order(q) + (marks ? (ok ? ' lawful' : ' broken') : ''), col, { dx: q[0] > 0 ? 9 : -9, dy: q[1] > 0 ? -13 : 14, align: q[0] > 0 ? 'left' : 'right', p: q0, size: 12 });
      });
    }
    var lean = function (v) { return Math.abs(v) < 0.2 ? 'is unsure' : v > 0 ? 'leans to +' : 'leans to −'; };
    out.push({ id: 'cards', chapter: 'The height', title: 'Two sentries, two cards', layout: 'map', view: view, dur: 4,
      text: 'On this land a spot is a pair of cards, one for each of two sentries: x₁ for the first, x₂ for the second. A card lies between −1 and +1. ' +
        '+1 and −1 are the two flags a sentry can raise; a card in between means the sentry is still unsure. The four corners of the square are the four orders the sentries could give, and the King’s true order is ' + order(T) + '. ' +
        'Today the first sentry ' + lean(x[0]) + ' (x₁ = ' + num(x[0]) + ') and the second ' + lean(x[1]) + ' (x₂ = ' + num(x[1]) + ').',
      math: at(0.75, 'x = (x₁, x₂) = ' + pair(x) + ', each card in [−1, 1]'),
      draw: function (g, p) {
        g.land(cx.J, { lo: cx.shade.lo, hi: cx.shade.hi, id: 'J', alpha: 0.45, pits: cx.shade.pits }); g.axes();
        square(g, seg(p, 0, 0.3)); corners(g, seg(p, 0.2, 0.7), false);
        g.halo(T, 14, C.gold, seg(p, 0.6, 0.75), 2.5); g.label(T, 'the true order', C.gold, { dx: T[0] > 0 ? 18 : -18, dy: T[1] > 0 ? 14 : -14, align: T[0] > 0 ? 'left' : 'right', p: seg(p, 0.65, 0.8) });
        g.hero(x, cx.hero, seg(p, 0.7, 0.85));
        var q = seg(p, 0.82, 1), v = g.vis; g.line(x, [x[0], v[2]], C.gold, 1.5, q, [5, 4]); g.line(x, [v[0], x[1]], C.gold, 1.5, q, [5, 4]);
      } });
    out.push({ id: 'formula', chapter: 'The height', title: 'The King’s formula: three parts', layout: 'map', view: view, dur: 3.6,
      text: 'The height of a spot is the King’s formula J(x), in three parts: the lanterns, the flags and the tower’s law' + (weather ? ', with the weather added on top' : '') + '. ' +
        (tw ? 'The Wanderer carries only the first two: its twin, the Warden, keeps the law instead. ' : '') + 'Dark is low and warm is high. We take the parts one at a time.',
      math: 'J(x) = ' + at(0.25, 'lanterns') + at(0.45, ' + flags') + at(0.65, ' + law') + (land.ripples ? at(0.8, ' + R(x)') : '') + (land.holes ? at(0.85, ' + B(x)') : '') + (tw ? at(0.9, '<br>the Wanderer’s land: f(x) = J(x) − law') : ''),
      draw: function (g, p) { g.land(cx.J, { lo: cx.shade.lo, hi: cx.shade.hi, id: 'J', alpha: seg(p, 0, 0.6), pits: cx.shade.pits }); g.axes(); square(g, 1); g.hero(x, cx.hero, seg(p, 0.5, 0.7)); } });
    out.push({ id: 'lanterns', chapter: 'The height', title: 'The lanterns: what the sentries saw', layout: 'map', view: view, dur: 4.2,
      text: 'The lanterns say y = (y₁, y₂) = ' + pair(y, 2) + ': what each sentry saw in the night. The first part grows with the distance from y, ' +
        '[(x₁ − y₁)² + (x₂ − y₂)²]/(2σ²). σ² = ' + num(s2, 2) + ' says how far the lanterns can be trusted: the smaller it is, the harder they pull. Here x − y = ' + pair(dx) + ', so the lanterns add ' + num(lan, 4) + '.',
      math: 'lanterns = ' + frac('(x₁ − y₁)² + (x₂ − y₂)²', '2σ²') + at(0.5, ' = ' + frac(par(dx[0]) + '² + ' + par(dx[1]) + '²', num(2 * s2, 2))) + at(0.85, ' = ' + num(lan, 4)),
      draw: function (g, p) {
        g.land(lanFn, { id: 'lan', rings: 10 }); g.axes(); square(g, 1, 'rgba(242,245,248,0.35)');
        g.dot(y, 7, C.gold, seg(p, 0, 0.15)); g.halo(y, 12 + 8 * seg(p, 0.1, 0.4), C.gold, seg(p, 0.05, 0.2) * (1 - seg(p, 0.4, 0.55)));
        g.label(y, 'y, the lanterns', C.gold, { dx: 12, dy: -14, p: seg(p, 0.1, 0.25) });
        g.hero(x, cx.hero, 1);
        var corner = [x[0], y[1]];
        g.line(y, corner, C.violet, 2, seg(p, 0.25, 0.45), [6, 4]); g.line(corner, x, C.violet, 2, seg(p, 0.45, 0.6), [6, 4]);
        g.label(lerp2(y, corner, 0.5), 'x₁ − y₁ = ' + num(dx[0]), C.violet, { dy: 16, p: seg(p, 0.35, 0.5), align: 'center' });
        g.label(lerp2(corner, x, 0.5), 'x₂ − y₂ = ' + num(dx[1]), C.violet, { dx: 10, p: seg(p, 0.55, 0.65) });
        g.ring(lan, C.gold, 2.5, seg(p, 0.7, 0.85)); g.label(x, 'lanterns ' + num(lan, 4), C.gold, { dx: 14, dy: -16, p: seg(p, 0.85, 1) });
      } });
    var fmax = mb * 1.08;
    out.push({ id: 'flags', chapter: 'The height', title: 'The flags: each card wants +1 or −1', layout: 'map+side', view: view, dur: 4.4,
      text: 'The second part pulls each card toward a flag. Each card adds μ_b(1 − t²)²: 0 at t = −1 and at t = +1, and largest at t = 0, so an unsure card costs height. ' +
        'With μ_b = ' + num(mb, 2) + ': card 1 (x₁ = ' + num(x[0]) + ') adds ' + num(mb * f1, 4) + ', card 2 (x₂ = ' + num(x[1]) + ') adds ' + num(mb * f2, 4) + ', together ' + num(fl, 4) + '.',
      math: 'flags = μ_b[(1 − x₁²)² + (1 − x₂²)²] = ' + at(0.45, num(mb, 2) + '·[' + num(f1, 4) + ' + ' + num(f2, 4) + ']') + at(0.85, ' = ' + num(fl, 4)),
      draw: function (g, p) {
        g.land(flFn, { id: 'flags', rings: 8 }); g.axes(); square(g, 1, 'rgba(242,245,248,0.35)'); g.hero(x, cx.hero, 1);
        CORN.forEach(function (q) { g.halo(q, 9, C.green, seg(p, 0.05, 0.25), 1.5); });
        var pl = g.plot(g.sideR, [-1.2, 1.2], [0, fmax], { title: 'one card’s part: μ_b(1 − t²)²' });
        pl.frame('t →', ''); pl.curve(function (t) { return mb * Math.pow(1 - t * t, 2); }, C.green, 2.2, seg(p, 0.1, 0.4));
        pl.point(x[0], mb * f1, C.orange, 'card 1: ' + num(mb * f1, 4), seg(p, 0.45, 0.6), x[0] > 0.5 ? 'left' : 'right');
        pl.point(x[1], mb * f2, C.blue, 'card 2: ' + num(mb * f2, 4), seg(p, 0.6, 0.75), x[1] > 0.5 ? 'left' : 'right');
      } });
    var lawOK = CORN.filter(function (q) { return q[0] * q[1] === s; }).map(order).join(' and ');
    out.push({ id: 'law', chapter: 'The height', title: 'The tower’s law', layout: 'map', view: view, dur: 4.4,
      text: 'The tower has one law. s = +1 says the two flags must agree; s = −1 that they must differ. Here s = ' + (s > 0 ? '+1' : '−1') + ', so the lawful orders are ' + lawOK + '. ' +
        'The third part, μ_p(1 − s·x₁x₂)², is 0 where s·x₁x₂ = 1 and grows as the cards break the law; μ_p = ' + num(mp, 2) + ' says how hard the law pushes. At x, s·x₁x₂ = ' + num(s * x[0] * x[1]) + ', so the law adds ' + num(law, 4) + '.' +
        (tw ? ' The Wanderer does not carry this part: the Warden keeps the law, standing on the lawful line between the two lawful corners.' : ''),
      math: 'law = μ_p(1 − s·x₁x₂)² = ' + at(0.45, num(mp, 2) + '·(1 − ' + par(s * x[0] * x[1]) + ')²') + at(0.85, ' = ' + num(law, 4)),
      draw: function (g, p) {
        g.land(lawFn, { id: 'law', rings: 9 }); g.axes(); square(g, 1, 'rgba(242,245,248,0.35)'); corners(g, seg(p, 0.05, 0.5), true);
        g.line(seg2[0], seg2[1], C.blue, 3, seg(p, 0.45, 0.7)); g.label(lerp2(seg2[0], seg2[1], 0.3), 'the lawful line', C.blue, { dx: 10, dy: -10, p: seg(p, 0.6, 0.75) });
        g.hero(x, cx.hero, 1); g.ring(law, C.violet, 2.5, seg(p, 0.7, 0.85)); g.label(x, 'law ' + num(law, 4), C.violet, { dx: 14, dy: -16, p: seg(p, 0.85, 1) });
      } });
  });

  // ------------------------------------------------------------ the Cartographer: its journal, its course, its stride tests
  // A FIFO table drawn on the canvas: rows [{ n, day, s, y, col, strike, mark, lit }], oldest at the top.
  function fifo(g, R, rows, m, p, o) {
    o = o || {}; var c = g.ctx, top = R[1] + 34, rh = Math.min(22, (R[3] - 80) / Math.max(rows.length + 1, 4)), X = [R[0] + 12, R[0] + 40, R[0] + 92, R[0] + 92 + Math.min(170, Math.max(120, (R[2] - 110) / 2))];
    g.panel(R, o.title || 'The journal: a queue of m = ' + m + ' pages');
    c.font = '600 11.5px ' + g.sans; c.fillStyle = C.dim; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText('↑ out: the oldest page leaves first', X[0], top);
    c.font = '12px ' + g.mono; c.fillStyle = C.blue;
    ['#', 'day', 'stride s', 'slope change y'].forEach(function (h, i) { c.fillText(h, X[i], top + rh); });
    rows.forEach(function (r, i) {
      var q = r.p == null ? 1 : r.p; if (!(q > 0)) return;
      var y = top + rh * (i + 2), dy = (1 - q) * 10;
      c.globalAlpha = clamp(q, 0, 1) * (r.strike ? 0.55 : 1);
      if (r.lit) { c.fillStyle = 'rgba(255,210,122,0.2)'; c.fillRect(R[0] + 6, y - rh / 2 + dy, R[2] - 12, rh); }
      c.fillStyle = r.col || C.ink; c.font = '12px ' + g.mono;
      [r.n, r.day == null ? '' : 'day ' + r.day, r.s ? pair(r.s, 3) : '', r.y ? pair(r.y, 3) : ''].forEach(function (t, k) { c.fillText(String(t), X[k], y + dy); });
      if (r.strike) { c.strokeStyle = r.col || C.ink; c.lineWidth = 1; c.beginPath(); c.moveTo(X[0], y + dy); c.lineTo(R[0] + R[2] - 70, y + dy); c.stroke(); }
      if (r.mark) { c.textAlign = 'right'; c.font = '600 11.5px ' + g.sans; c.fillText(r.mark, R[0] + R[2] - 10, y + dy); c.textAlign = 'left'; }
      c.globalAlpha = 1;
    });
    c.font = '600 11.5px ' + g.sans; c.fillStyle = C.dim; c.fillText('↓ in: each new page joins here', X[0], top + rh * (rows.length + 2) + 2);
  }
  function pageRows(pages, extra) { return pages.map(function (pg, i) { var r = { n: i + 1, day: pg.day, s: pg.s, y: pg.y }; for (var k in (extra && extra(pg, i)) || {}) r[k] = extra(pg, i)[k]; return r; }); }
  function stretcher(land) {
    var b = land.box; if (!b) return null;
    var lo = b[0], w = b[1] - b[0];
    return { lo: lo, w: w, toX: function (t) { return [lo + w * (1 + Math.tanh(t[0])) / 2, lo + w * (1 + Math.tanh(t[1])) / 2]; },
             dxdt: function (t) { return t.map(function (v) { var th = Math.tanh(v); return w * (1 - th * th) / 2; }); } };
  }
  function unit(v) { var l = len(v) || 1; return [v[0] / l, v[1] / l]; }
  function degBetween(a, b) { var d = Math.atan2(a[0] * b[1] - a[1] * b[0], dot(a, b)); return Math.round(Math.abs(d) * 180 / Math.PI); }

  B.register('lbDay', function (cx, out) {
    var rec = cx.rec, w = cx.walk, land = cx.land, mm = Math.round(cx.p.m), x = cx.x, k = cx.k;
    if (!rec) return;
    var st = rec.stretched ? stretcher(land) : null, t0 = rec.t, d = rec.d, gt = rec.gt;
    var toX = st ? st.toX : function (t) { return t.slice(); }, J = cx.J;
    var D = st ? st.dxdt(t0) : [1, 1], dirX = unit([D[0] * d[0], D[1] * d[1]]), downX = unit([-D[0] * gt[0], -D[1] * gt[1]]), turn = degBetween(downX, dirX);
    var queue = rec.queue || [], pagesIn = function (pages) { return pages.map(function (pg) { return [w[Math.max(0, pg.day - 1)].x, w[Math.min(pg.day, w.length - 1)].x]; }); };
    var span = cx.span, near = around([x, rec.x].concat(queue.length ? [].concat.apply([], pagesIn(queue)) : []), 0.5, 10 * cx.h);
    function course(tau) { return toX([t0[0] + tau * d[0], t0[1] + tau * d[1]]); }
    function base(g) { g.land(J, cx.shade); g.axes(); if (land.box) g.path(boxPath(land.box), C.blue, 1.5, 1); }
    // 1. the journal
    var torn = rec.torn || [];
    out.push({ id: 'journal', chapter: 'The journal', title: 'The journal: a queue of the last m strides', layout: 'map+side', view: near, dur: 4.2,
      text: mm === 0 ? 'This Cartographer keeps no journal (m = 0): it goes straight downhill and only tests its strides.' :
        'The Cartographer keeps a journal of its last m = ' + mm + ' strides. It works like a queue: each new page joins at the bottom, and once there are m pages the oldest leaves at the top. ' +
        (rec.restart ? 'Today its pages pointed it uphill, so it tears all ' + torn.length + ' out and starts again with none.' : queue.length ? 'Today it holds ' + queue.length + (queue.length === 1 ? ' page' : ' pages') + ', each written on the day its stride was taken; on the map each page is the stride it remembers.' : 'Today is its first day, so the journal is still empty.'),
      math: mm === 0 ? 'm = 0' : at(0.2, 'm = ' + mm) + at(0.6, ', pages today: ' + queue.length),
      draw: function (g, p) {
        base(g); g.path(cx.path, C.blue, 1.5, 1, [4, 4]); g.hero(x, 'lb', 1);
        var shown = rec.restart ? torn : queue, segs = pagesIn(shown);
        segs.forEach(function (sg, i) { var q = seg(p, 0.15 + 0.6 * i / Math.max(segs.length, 1), 0.15 + 0.6 * (i + 1) / Math.max(segs.length, 1)); g.arrow(sg[0], sg[1], rec.restart ? C.red : C.gold, 3, q); g.label(lerp2(sg[0], sg[1], 0.5), 'page ' + (i + 1), rec.restart ? C.red : C.gold, { dx: 8, dy: -12, p: q, size: 12 }); });
        if (mm > 0) fifo(g, g.sideR, pageRows(shown, function (pg, i) { return { p: seg(p, 0.15 + 0.6 * i / Math.max(shown.length, 1), 0.15 + 0.6 * (i + 1) / Math.max(shown.length, 1)), strike: rec.restart, col: rec.restart ? C.red : C.ink, mark: rec.restart ? 'torn out' : '' }; }).concat(shown.length < mm ? [{ n: '', day: null, p: seg(p, 0.75, 0.9), col: C.dim, mark: (mm - shown.length) + ' empty' }] : []), mm, p);
        else g.panel(g.sideR, 'No journal');
      } });
    // 2. one page
    var last = queue[queue.length - 1];
    if (last && !rec.restart) {
      var a = w[last.day - 1].x, b = w[last.day].x, gb = w[last.day].g, ga = w[last.day + 1] ? w[last.day + 1].g : rec.g, curve = dot(last.y, last.s) / dot(last.s, last.s);
      var pv = around([a, b], 0.9, 12 * cx.h), gl = Math.max(len(ga), len(gb), 1e-12), kk = 0.32 * (pv[1] - pv[0]) / gl;
      out.push({ id: 'page', chapter: 'The journal', title: 'What one page says', layout: 'map+side', view: pv, dur: 4.4,
        text: 'Take the newest page, from day ' + last.day + '. It holds the stride s, from where the Cartographer stood to where it went, and y, how the slope ∇J changed over that stride (the slope after minus the slope before). ' +
          'Together they say how the land bends along that stride: curve = yᵀs/sᵀs = ' + num(curve, 2) + ', large when the slope grows fast.' + (st ? ' (On this walled land the journal is kept on a stretched map, so its numbers are measured there; see the next step.)' : ''),
        math: at(0.3, 's = ' + pair(last.s)) + at(0.5, ',  y = ' + pair(last.y)) + at(0.8, '<br>curve = yᵀs/sᵀs = ' + num(curve, 2)),
        draw: function (g, p) {
          base(g); g.arrow(a, b, C.gold, 3, seg(p, 0.05, 0.3)); g.label(lerp2(a, b, 0.5), 's, the stride', C.gold, { dx: 8, dy: -14, p: seg(p, 0.2, 0.35) });
          g.arrow(a, add(a, gb, kk), C.orange, 2.5, seg(p, 0.35, 0.5)); g.tipLabel(add(a, gb, kk), gb, 'slope before', C.orange, seg(p, 0.45, 0.55));
          g.arrow(b, add(b, ga, kk), C.orange, 2.5, seg(p, 0.5, 0.65)); g.tipLabel(add(b, ga, kk), ga, 'slope after', C.orange, seg(p, 0.6, 0.7));
          var dy = sub(ga, gb); g.arrow(add(b, gb, kk), add(add(b, gb, kk), dy, kk), C.violet, 2.5, seg(p, 0.7, 0.85)); g.tipLabel(add(add(b, gb, kk), dy, kk), dy, 'y: the change', C.violet, seg(p, 0.8, 0.9));
          g.line(b, add(b, gb, kk), 'rgba(255,176,113,0.45)', 1.5, seg(p, 0.65, 0.75), [4, 4]);
          var R = g.sideR; g.panel(R, 'Page from day ' + last.day);
          [['stride s', pair(last.s), C.gold], ['slope change y', pair(last.y), C.violet], ['curve yᵀs/sᵀs', num(curve, 2), C.ink]].forEach(function (row, i) {
            g.labelPx(R[0] + 14, R[1] + 52 + 30 * i, row[0], row[2], { plain: true, p: seg(p, 0.3 + 0.2 * i, 0.45 + 0.2 * i) });
            g.labelPx(R[0] + 150, R[1] + 52 + 30 * i, row[1], C.ink, { plain: true, mono: true, p: seg(p, 0.3 + 0.2 * i, 0.45 + 0.2 * i) });
          });
        } });
    }
    // 3. the stretched map
    if (st) {
      out.push({ id: 'stretch', chapter: 'The course', title: 'The stretched map', layout: 'side', dur: 4.2,
        text: 'Inside a wall the Cartographer never steps out, because it walks on a stretched map t instead of on x: x = lo + w·(1 + tanh t)/2 for each coordinate, with lo = ' + num(st.lo, 2) + ' and w = ' + num(st.w, 2) + '. ' +
          'Every t, however large, lands inside the wall, and the wall itself is infinitely far away. Near the wall a step in t moves x very little, so the Cartographer slows down there.',
        math: 'x = lo + w·(1 + tanh t)/2;  today t = ' + pair(t0) + at(0.7, ' ↔ x = ' + pair(x)),
        draw: function (g, p) {
          var R = g.sideR, T = Math.max(3, Math.abs(t0[0]) + 0.5, Math.abs(t0[1]) + 0.5), pl = g.plot(R, [-T, T], [st.lo - 0.08 * st.w, st.lo + 1.08 * st.w], { title: 'from the stretched map t to the land x' });
          pl.frame('t →', 'x'); pl.seg(-T, st.lo, T, st.lo, C.blue, 1.5, 1, [5, 4]); pl.seg(-T, st.lo + st.w, T, st.lo + st.w, C.blue, 1.5, 1, [5, 4]);
          pl.curve(function (t) { return st.lo + st.w * (1 + Math.tanh(t)) / 2; }, C.gold, 2.5, seg(p, 0.05, 0.4));
          pl.point(t0[0], x[0], C.orange, 't₁ → x₁ = ' + num(x[0]), seg(p, 0.45, 0.6), t0[0] > 0 ? 'left' : 'right');
          pl.point(t0[1], x[1], C.violet, 't₂ → x₂ = ' + num(x[1]), seg(p, 0.6, 0.75), t0[1] > 0 ? 'left' : 'right');
          g.labelPx(pl.box[0] + 8, pl.Y(st.lo + st.w) - 12, 'the wall', C.blue, { plain: true, size: 12, p: seg(p, 0.75, 0.9) });
        } });
    }
    // 4. reading the journal: the two-loop recursion
    var rd = rec.reading || {}, n = queue.length, aw = 0.3 * (cx.zoom[1] - cx.zoom[0]), cv = [x[0] - 4.5 * cx.h, x[0] + 4.5 * cx.h, x[1] - 4.5 * cx.h, x[1] + 4.5 * cx.h];
    out.push({ id: 'read', chapter: 'The course', title: 'Reading the journal', layout: 'map+side', view: cv, dur: 5,
      text: rec.restart ? 'Its pages would have turned it uphill, so it trusts none of them today: it heads straight downhill' + (st ? ' on its stretched map' : '') + ', d = −∇J.' :
        !n ? 'With no pages yet there is nothing to bend: it heads straight downhill' + (st ? ' on its stretched map' : '') + ', d = −∇J, like the Pilgrim. Unlike the Pilgrim, it will test its stride before it takes it.' :
        'To choose its course it reads its pages twice: from the newest to the oldest, then back from the oldest to the newest. Each page bends the course to match how the land curved along that stride, and in between it scales by γ = sᵀy/yᵀy of the newest page, ' + num(rd.gamma, 4) + '. ' +
        'The result is d = −H∇J: ' + turn + '° away from straight downhill' + (st ? ' on its stretched map' : '') + '.',
      math: (n && !rec.restart ? at(0.45, 'γ = sᵀy/yᵀy = ' + num(rd.gamma, 4)) + '<br>' : '') + at(0.85, 'd = ' + (n && !rec.restart ? '−H∇J = ' : '−∇J = ') + pair(d) + ', ' + turn + '° from straight downhill'),
      draw: function (g, p) {
        g.land(J, { id: 'J', rings: 9 }); g.axes(); g.hero(x, 'lb', 1);
        g.arrow(x, add(x, downX, aw), C.ink, 2.5, seg(p, 0.05, 0.25), [6, 4]); g.label(lerp2(x, add(x, downX, aw), 0.6), 'straight downhill', C.ink, { dx: downX[1] > 0 ? 12 : -12, dy: downX[0] > 0 ? 14 : -14, align: downX[1] > 0 ? 'left' : 'right', p: seg(p, 0.15, 0.3), size: 12 });
        var sw = seg(p, 0.6, 0.95), a0 = Math.atan2(downX[1], downX[0]), a1 = Math.atan2(dirX[1], dirX[0]), da = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)), ang = a0 + da * sw, dv = [Math.cos(ang), Math.sin(ang)];
        g.arrow(x, add(x, dv, aw * 1.15), C.blue, 3.5, seg(p, 0.55, 0.65)); if (sw > 0.95) g.tipLabel(add(x, dv, aw * 1.15), dv, 'd, its course', C.blue, 1);
        if (mm > 0) {
          var order1 = [], r;
          for (r = n - 1; r >= 0; r--) order1.push(r);
          for (r = 0; r < n; r++) order1.push(r);
          var pos = rec.restart || !n ? -1 : Math.floor(seg(p, 0.1, 0.55) * order1.length * 0.999), cur = pos >= 0 ? order1[pos] : -1, second = pos >= n;
          fifo(g, g.sideR, pageRows(rec.restart ? torn : queue, function (pg, i) {
            var aI = rd.alphas ? rd.alphas[n - 1 - i] : null, bI = rd.betas ? rd.betas[i] : null, firstDone = pos >= 0 && (second || order1.indexOf(i) <= pos), secondDone = second && i <= cur;
            return { lit: i === cur, strike: rec.restart, col: rec.restart ? C.red : C.ink, mark: rec.restart ? 'torn out' : secondDone ? 'β = ' + num(bI, 3) : firstDone && aI != null ? 'α = ' + num(aI, 3) : '' };
          }), mm, p, { title: rec.restart ? 'Torn out today' : second ? 'Reading back: oldest to newest' : 'Reading: newest to oldest' });
        } else g.panel(g.sideR, 'No journal');
      } });
    // 5. testing the stride (Armijo)
    var tr = (rec.trials || []).map(function (q) { return { tau: q.step, f: q.f, need: q.need, x: q.x, ok: false }; });
    tr.push({ tau: rec.step, f: rec.felt, need: rec.need, x: rec.x, ok: true });
    var gd = dot(gt, d), tmin = Math.min.apply(null, tr.map(function (q) { return q.tau; })), u0 = Math.log(tmin) / Math.LN2 - 0.6, u1 = 0.6;
    var sv = around([x].concat(tr.map(function (q) { return q.x; })), 0.4, 10 * cx.h);
    var hs = [], uu; for (uu = u0; uu <= u1; uu += (u1 - u0) / 60) hs.push(J(course(Math.pow(2, uu))));
    tr.forEach(function (q) { hs.push(q.f, q.need); }); hs.push(rec.fromF);
    var vlo = Math.min.apply(null, hs), vhi = Math.max.apply(null, hs), vp = (vhi - vlo) * 0.15 || 1e-3;
    var words = tr.map(function (q) { return 'stride ' + strideName(q.tau) + ': ' + num(q.f, 4) + (q.ok ? ' ≤ ' : ' > ') + num(q.need, 4) + (q.ok ? ' ✓' : ' ✗'); });
    out.push({ id: 'tests', chapter: 'The stride', title: 'Testing the stride', layout: 'map+side', view: sv, dur: Math.min(6, 3.4 + 0.4 * tr.length),
      text: 'It never trusts a stride blindly. It tries the full stride 1 along d; if the land there is not lower by enough, it halves the stride and tries again. ' +
        '“Enough” is the Armijo test: the height must be at most f(x) + 10⁻⁴·stride·(∇J·d), a hair below the ' + num(rec.fromF, 4) + ' where it stands. ' +
        (tr.length > 1 ? 'Today it tried ' + tr.length + ' strides; ' + strideName(rec.step) + ' passed.' : 'Today the full stride passed at once.') + (cx.haze ? ' In this haze every height it tries is a tap, off by about σ, so the dots need not sit on the curve.' : ''),
      math: words.slice(0, 4).map(function (wd, i) { return at(0.2 + 0.6 * i / Math.min(4, words.length), wd); }).join('<br>') + (words.length > 4 ? '<br>' + at(0.85, '… ' + (words.length - 4) + ' more') : ''),
      draw: function (g, p) {
        base(g); g.hero(x, 'lb', 1);
        var crv = []; for (var i = 0; i <= 40; i++) crv.push(course(i / 40)); g.path(crv, C.blue, 2, seg(p, 0, 0.2), [6, 4]);
        tr.forEach(function (q, i) { var s0 = seg(p, 0.2 + 0.6 * i / tr.length, 0.2 + 0.6 * (i + 1) / tr.length); g.dot(q.x, 6, q.ok ? C.green : C.red, s0); if (i < 6 || q.ok) g.label(q.x, strideName(q.tau) + (q.ok ? ' ✓' : ' ✗'), q.ok ? C.green : C.red, { dx: 9, dy: -11, p: s0, size: 12 }); });
        var pl = g.plot(g.sideR, [u0, u1], [vlo - vp, vhi + vp], { title: 'the height along its course, by stride', tTicks: false }), U = function (tau) { return Math.log(tau) / Math.LN2; };
        pl.frame('stride, halving to the left', 'J');
        var nT = Math.round(-U(tmin)), every = Math.max(1, Math.ceil((nT + 1) / 7)); g.ctx.font = '11px ' + g.mono; g.ctx.fillStyle = C.dim; g.ctx.textAlign = 'center'; g.ctx.textBaseline = 'top';
        for (var jj = 0; jj <= nT; jj += every) g.ctx.fillText(strideName(Math.pow(2, -jj)), pl.X(-jj), pl.box[1] + pl.box[3] + 4);
        pl.curve(function (u) { return J(course(Math.pow(2, u))); }, C.dim, 1.8, seg(p, 0.05, 0.25));
        pl.curve(function (u) { return rec.fromF + 1e-4 * Math.pow(2, u) * gd; }, C.gold, 1.5, seg(p, 0.1, 0.3));
        g.labelPx(pl.box[0] + pl.box[2] - 4, pl.Y(rec.fromF) - 12, 'the bar to pass', C.gold, { align: 'right', size: 11.5, p: seg(p, 0.2, 0.35) });
        tr.forEach(function (q, i) { pl.point(U(q.tau), q.f, q.ok ? C.green : C.red, i < 5 || q.ok ? strideName(q.tau) + (q.ok ? ' ✓' : ' ✗') : '', seg(p, 0.2 + 0.6 * i / tr.length, 0.2 + 0.6 * (i + 1) / tr.length), U(q.tau) > (u0 + u1) / 2 ? 'left' : 'right'); });
      } });
    // 6. the stride
    var mv = around([x, rec.x], 0.6, 10 * cx.h);
    out.push({ id: 'stride', chapter: 'The stride', title: 'The stride', layout: 'map', view: mv, dur: 3.6,
      text: 'It takes the stride that passed, ' + strideName(rec.step) + ' along d: from ' + pair(x) + ' to ' + pair(rec.x) + '. The height goes from ' + num(cx.Jx, 4) + ' to ' + num(rec.J, 4) + '.',
      math: 'x ← ' + at(0.5, pair(rec.x)) + at(0.85, ';  J: ' + num(cx.Jx, 4) + ' → ' + num(rec.J, 4)),
      draw: function (g, p) {
        base(g); var q = seg(p, 0.1, 0.7), pts = []; for (var i = 0; i <= 30; i++) pts.push(course(rec.step * i / 30 * q));
        g.path(pts, C.blue, 3, 1); g.hero(pts[pts.length - 1], 'lb', 1);
        g.label(x, 'J = ' + num(cx.Jx, 4), C.dim, { dx: 12, dy: 16 }); g.label(rec.x, 'J = ' + num(rec.J, 4), C.gold, { dx: 12, dy: -16, p: seg(p, 0.75, 0.9) });
      } });
    // 7. a new page
    if (mm > 0) {
      var after = rec.after || [], dropped = rec.dropped || [];
      out.push({ id: 'newpage', chapter: 'The journal', title: rec.wrote ? 'A new page joins the queue' : 'No page today', layout: 'side', dur: 4,
        text: rec.wrote ? 'After the stride it writes today’s page at the bottom of the journal: s = ' + pair(rec.wrote.s) + ', y = ' + pair(rec.wrote.y) + '. ' +
            (dropped.length ? 'The journal already held m = ' + mm + ' pages, so the oldest, from day ' + dropped[0].day + ', leaves at the top: first in, first out.' : 'The journal now holds ' + after.length + ' of its ' + mm + ' pages; pages leave only once it is full.')
          : 'It writes no page today: the slope did not grow along this stride (yᵀs ≤ 0), and such a page would mislead its reading.',
        math: rec.wrote ? at(0.5, 'in: day ' + rec.wrote.day) + (dropped.length ? at(0.75, ',  out: day ' + dropped[0].day) : '') : 'yᵀs ≤ 0: no page',
        draw: function (g, p) {
          var rows = dropped.map(function (pg) { return { n: '−', day: pg.day, s: pg.s, y: pg.y, strike: true, col: C.red, mark: '← leaves', p: 1 - 0.6 * seg(p, 0.55, 0.9) }; });
          rows = rows.concat(pageRows(after, function (pg) { var fresh = rec.wrote && pg.day === rec.wrote.day; return fresh ? { col: C.green, mark: '← joins', p: seg(p, 0.15, 0.5) } : {}; }));
          if (after.length < mm) rows.push({ n: '', day: null, col: C.dim, mark: (mm - after.length) + ' empty' });
          fifo(g, g.sideR, rows, mm, p);
        } });
    }
    // 8. and again
    var ahead = w.slice(k, Math.min(w.length, k + 9)).map(function (q) { return q.x; });
    if (ahead.length > 2) {
      out.push({ id: 'again', chapter: 'The stride', title: 'And again, day after day', layout: 'map', view: around(ahead, 0.35, 10 * cx.h), dur: 4,
        text: 'Each day it reads its pages, tests its stride and writes one more page. Here are its next ' + (ahead.length - 1) + ' days. The pages teach it the shape of the land, so its course bends toward the bottom instead of zigzagging across the valley.',
        math: 'd = −H∇J,  x ← x + stride·d',
        draw: function (g, p) {
          base(g); var nn = ahead.length - 1, s = seg(p, 0.05, 0.9) * nn, kk = Math.floor(s), f = s - kk;
          g.path(ahead.slice(0, kk + 1).concat(kk < nn ? [lerp2(ahead[kk], ahead[kk + 1], ease(f))] : []), C.blue, 2.5, 1);
          ahead.slice(1, kk + 1).forEach(function (q, i) { g.dot(q, 4, C.blue, 1); g.label(q, 'day ' + (k + i + 1), C.dim, { dx: 8, dy: -10, size: 11 }); });
          g.hero(kk < nn ? lerp2(ahead[kk], ahead[kk + 1], ease(f)) : ahead[nn], 'lb', 1);
        } });
    }
    if (cx.last && w.why === 'line search') {
      out.push({ id: 'stall', chapter: 'The stride', title: 'Why it stops', layout: 'map', view: around([w[w.length - 1].x], 0, 12 * cx.h), dur: 3.4,
        text: 'On day ' + (w.length) + ' it halved its stride again and again, down to almost nothing, and no stride passed the test: ' + (cx.haze ? 'in this haze its taps contradict each other, so even a tiny step looks too high.' : 'along its course this is as low as it can measure.') + ' So it stops for good.',
        math: 'no stride ≥ 10⁻¹⁶ passed',
        draw: function (g, p) { g.land(J, { id: 'J', rings: 9 }); g.axes(); var q = w[w.length - 1].x; g.hero(q, 'lb', 1); g.halo(q, 14 + 10 * seg(p, 0.2, 0.8), C.red, 1 - seg(p, 0.8, 1), 2); } });
    }
  });

  // ------------------------------------------------------------ the Twins: aim, rope, the Wanderer's step, the Warden, the ledger
  B.register('twDay', function (cx, out) {
    var rec = cx.rec, w = cx.walk, land = cx.land, P = cx.p, rho = P.rho, k = cx.k;
    if (!rec) return;
    var x = rec.from, z = rec.zFrom, u = rec.uFrom, v = rec.v, xn = rec.x, zn = rec.z, un = rec.u, tower = land.kind === 'tower', box = land.box;
    var lawName = tower ? 'on the lawful line between the two lawful corners' : box ? (cx.key === 'wall' ? 'inside the wall' : 'inside the realm') : '';
    var noLaw = !tower && !box, f = land.f, rope = function (q) { var dq = sub(q, v); return f(q) + rho / 2 * dot(dq, dq); };
    var splitMeaning = cx.key === 'wall' ? 'The height was called J earlier. In this split, f = J is the cost assigned to the Wanderer, while z ∈ C carries the wall law.' :
      tower ? 'At the fort, f contains the lantern and flag costs but not the law term, because the Warden enforces that law.' :
      'Here f names the cost assigned to the Wanderer.';
    var xu = add(xn, u), view = around([x, z, v, xn, zn, xu, add(z, u)], 0.5, 0.3 * cx.span);
    function law(g, p) { if (tower) g.line(land.lawSegment[0], land.lawSegment[1], C.blue, 3, p); else if (box) g.path(boxPath(box), C.blue, 2, p); }
    function warden(g, q, p, label) { if (!(p > 0)) return; g.dot(q, 7, C.blue, p); g.label(q, label || 'Warden z', C.blue, { dx: 10, dy: 14, p: p, size: 12 }); }
    function base(g, shade) { g.land(shade || cx.J, shade ? { id: 'rope', rings: 10 } : cx.shade); g.axes(); law(g, 1); }
    out.push({ id: 'twins', chapter: 'The Twins', title: 'One answer, two temporary copies', layout: 'map', view: view, dur: 4.2,
      text: 'ADMM temporarily makes two copies of one final decision so that two jobs can be handled separately. The Wanderer, x, searches for low cost. The Warden, z, keeps the other copy where the law allows' + (noLaw ? '; with no law here, it simply copies the Wanderer.' : ': ' + lawName + '.') +
        ' The rope and the scaled dual variable u—the ledger—drive the copies back toward one answer. ' + splitMeaning + ' Today x = ' + pair(x) + ', z = ' + pair(z) + ', u = ' + pair(u) + '.',
      math: at(0.2, 'same final decision: x = z') + at(0.45, '<br>x = ' + pair(x)) + at(0.65, ',  z = ' + pair(z)) + at(0.82, ',  u = ' + pair(u)),
      draw: function (g, p) {
        base(g); law(g, seg(p, 0, 0.3)); g.label(tower ? lerp2(land.lawSegment[0], land.lawSegment[1], 0.25) : box ? [box[0], box[1]] : x, noLaw ? '' : 'the law', C.blue, { dx: 8, dy: -12, p: seg(p, 0.15, 0.3) });
        g.hero(x, 'tw', seg(p, 0.25, 0.4), 'Wanderer x'); warden(g, z, seg(p, 0.45, 0.6));
        if (len(u) > 1e-9) { g.arrow(z, add(z, u), C.orange, 2.5, seg(p, 0.7, 0.9)); g.tipLabel(add(z, u), u, 'ledger u', C.orange, seg(p, 0.8, 0.95)); }
      } });
    out.push({ id: 'aim', chapter: 'The Twins', title: 'The aim: v = z − u', layout: 'map', view: view, dur: 3.8,
      text: 'Before it moves, the Wanderer takes its aim: the Warden’s spot, corrected by the ledger, v = z − u = ' + pair(z) + ' − ' + pair(u) + ' = ' + pair(v) + '. ' +
        (len(u) > 1e-9 ? 'The ledger remembers which way the law has kept pushing, and leans the aim the other way.' : 'The ledger is still empty, so the aim is the Warden’s own spot.'),
      math: 'v = z − u = ' + at(0.4, pair(z) + ' − ' + pair(u)) + at(0.8, ' = ' + pair(v)),
      draw: function (g, p) {
        base(g); g.hero(x, 'tw', 1); warden(g, z, 1);
        if (len(u) > 1e-9) { g.arrow(z, sub(z, u), C.violet, 2.5, seg(p, 0.2, 0.6)); }
        g.dot(v, 6, C.violet, seg(p, 0.55, 0.7)); g.halo(v, 12, C.violet, seg(p, 0.6, 0.75), 1.5); g.label(v, 'v, the aim', C.violet, { dx: 12, dy: -14, p: seg(p, 0.65, 0.85) });
      } });
    var rr = Math.min(rec.reach, cx.span);
    out.push({ id: 'rope', chapter: 'The Twins', title: 'The rope', layout: 'map', view: view, dur: 4.2,
      text: 'The Wanderer is tied to its aim v by a rope of stiffness ρ = ' + num(rho, 2) + '. It looks for the spot that is lowest for its land and its rope together: f(x) + ρ/2·|x − v|². ' +
        'A stiff rope keeps it close to v; a slack one lets the land decide. The shading shows that sum; no spot farther than ' + num(rr) + ' from v can beat v itself (the dashed ring).',
      math: 'minimise f(x) + ρ/2·|x − v|²,  ρ = ' + num(rho, 2),
      draw: function (g, p) {
        g.land(rope, { id: 'rope' + v[0] + ',' + v[1], rings: 10, alpha: seg(p, 0, 0.5) }); g.axes(); law(g, 1);
        g.hero(x, 'tw', 1); g.dot(v, 6, C.violet, 1); g.label(v, 'v', C.violet, { dx: 10, dy: -12 });
        g.line(x, v, C.orange, 2, seg(p, 0.3, 0.55), [4, 3]); g.label(lerp2(x, v, 0.5), 'the rope', C.orange, { dx: 8, dy: -12, p: seg(p, 0.45, 0.6) });
        if (rr > 0) g.halo(v, rr * g.s, C.ink, seg(p, 0.6, 0.8), 1.2, [5, 4]);
      } });
    // the Wanderer's step: by a formula, sentry by sentry, or in small steps
    var mv = around([x, v, xn], 0.6, 0.25 * cx.span), stepText, stepMath, side = null;
    if (rec.exact && !tower) {
      var A = land.A, c = land.c, M = [[A[0][0] + rho, A[0][1]], [A[1][0], A[1][1] + rho]], rhs = [A[0][0] * c[0] + A[0][1] * c[1] + rho * v[0], A[1][0] * c[0] + A[1][1] * c[1] + rho * v[1]];
      stepText = 'The Wanderer first aims at v = z − u = ' + pair(v) + '. It then lowers the cost f(x) plus the rope penalty ρ/2·|x − v|². On this valley a formula gives the lowest spot at once: setting the slope of the sum to zero gives (A + ρI)·x = Ac + ρv, two equations for the two numbers of x. Solved: x = ' + pair(xn) + '.';
      stepMath = '(A + ρI) = [[' + num(M[0][0]) + ', ' + num(M[0][1]) + '], [' + num(M[1][0]) + ', ' + num(M[1][1]) + ']]' + at(0.4, '<br>Ac + ρv = ' + pair(rhs)) + at(0.8, '<br>x = (A + ρI)⁻¹(Ac + ρv) = ' + pair(xn));
      side = function (g, p) {
        var R = g.sideR; g.panel(R, 'Two equations, two unknowns');
        var y0 = R[1] + 44, wM = g.matrix(R[0] + 14, y0, [[num(M[0][0]), num(M[0][1])], [num(M[1][0]), num(M[1][1])]], function () { return seg(p, 0.1, 0.3); }, { size: 13 });
        g.labelPx(R[0] + 22 + wM, y0 + 24, '· x =', C.ink, { plain: true, p: seg(p, 0.2, 0.35) });
        g.matrix(R[0] + 70 + wM, y0, [[num(rhs[0])], [num(rhs[1])]], function () { return seg(p, 0.35, 0.55); }, { size: 13, col: C.violet });
        g.labelPx(R[0] + 14, y0 + 84, 'x = ' + pair(xn), C.gold, { plain: true, mono: true, size: 14, p: seg(p, 0.7, 0.85) });
      };
    } else if (rec.exact && tower) {
      var y = land.y, s2 = P.s2, mb = P.muB, phi = function (t, i) { return (y[i] - t) * (y[i] - t) / (2 * s2) + mb * Math.pow(1 - t * t, 2) + rho / 2 * (t - v[i]) * (t - v[i]); };
      stepText = 'The Wanderer first aims at v = z − u = ' + pair(v) + ', then lowers f plus the rope penalty. On a tower land the two sentries can choose their cards one at a time: each card is the lowest point on [−1, 1] of its lantern part, its flag part and its share of the rope, φ(t) = (y − t)²/(2σ²) + μ_b(1 − t²)² + ρ/2·(t − v)². The lowest points: x = ' + pair(xn) + '.';
      stepMath = at(0.4, 'card 1: lowest φ at ' + num(xn[0])) + at(0.7, ',  card 2: lowest φ at ' + num(xn[1]));
      side = function (g, p) {
        var R = g.sideR, h2 = (R[3] - 8) / 2;
        [0, 1].forEach(function (i) {
          var Rr = [R[0], R[1] + i * (h2 + 8), R[2], h2], vals = []; for (var q = 0; q <= 40; q++) vals.push(phi(-1 + q / 20, i));
          var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pl = g.plot(Rr, [-1, 1], [lo - 0.08 * (hi - lo), hi + 0.08 * (hi - lo)], { title: 'sentry ' + (i + 1) + ': φ(t)' });
          pl.frame('card t', ''); pl.curve(function (t) { return phi(t, i); }, i ? C.blue : C.orange, 2, seg(p, 0.1 + 0.25 * i, 0.35 + 0.25 * i));
          pl.point(xn[i], phi(xn[i], i), C.gold, 'lowest: ' + num(xn[i]), seg(p, 0.35 + 0.25 * i, 0.5 + 0.25 * i), xn[i] > 0.3 ? 'left' : 'right');
        });
      };
    } else {
      stepText = 'The Wanderer first aims at v = z − u = ' + pair(v) + ', then lowers f plus the rope penalty. With ' + (cx.haze ? 'haze' : 'ripples or pits') + ' on the land there is no formula. It walks down that combined cost in ' + Math.max(rec.path.length - 1, 0) + ' small steps, feeling the way with its staff, until it is as low as it can tell: x = ' + pair(xn) + '.';
      stepMath = at(0.8, 'x = ' + pair(xn));
    }
    out.push({ id: 'wander', chapter: 'The Twins', title: 'The Wanderer’s step', layout: side ? 'map+side' : 'map', view: mv, dur: 4.6,
      text: stepText, math: stepMath,
      draw: function (g, p) {
        g.land(rope, { id: 'rope' + v[0] + ',' + v[1], rings: 10 }); g.axes(); law(g, 1); g.dot(v, 6, C.violet, 1); g.label(v, 'v', C.violet, { dx: 10, dy: -12 });
        var path = rec.path && rec.path.length > 1 ? rec.path : [x, xn], q = seg(p, 0.35, 0.9);
        g.path(path, C.ink, 2, q, [4, 3]);
        var L = 0, segL = []; for (var i = 1; i < path.length; i++) { segL.push(len(sub(path[i], path[i - 1]))); L += segL[i - 1]; }
        var goal = L * q, pos = path[0]; for (i = 1; i < path.length; i++) { if (goal <= segL[i - 1]) { pos = lerp2(path[i - 1], path[i], segL[i - 1] ? goal / segL[i - 1] : 1); break; } goal -= segL[i - 1]; pos = path[i]; }
        g.hero(pos, 'tw', 1); if (q >= 1) g.label(xn, 'new x', C.gold, { dx: 12, dy: -14 });
        if (side) side(g, p);
      } });
    out.push({ id: 'warden', chapter: 'The Twins', title: 'The Warden keeps the law', layout: 'map', view: view, dur: 4.2,
      text: noLaw ? 'With no law on this land, the Warden just stands at x + u = ' + pair(zn) + '.' :
        'The Warden goes to the lawful spot nearest to x + u = ' + pair(xn) + ' + ' + pair(u) + ' = ' + pair(xu) + ': z = ' + pair(zn) + '. ' +
        (tower ? 'On the tower the nearest lawful spot is the nearest point of the lawful line.' : 'Inside a wall that means pulling each number back within the wall, if it is outside.') +
        ' This game shows the constraint form of ADMM, so the Warden projects. In general ADMM, the second copy may have another cost and its update need not be a projection.',
      math: 'z = Π' + '<sub>C</sub>(x + u) = Π<sub>C</sub>' + pair(xu) + at(0.75, ' = ' + pair(zn)),
      draw: function (g, p) {
        base(g); g.hero(xn, 'tw', 1);
        if (len(u) > 1e-9) g.arrow(xn, xu, C.orange, 2, seg(p, 0.1, 0.35));
        g.dot(xu, 5, C.ink, seg(p, 0.3, 0.4)); g.label(xu, 'x + u', C.ink, { dx: 10, dy: -12, p: seg(p, 0.35, 0.5) });
        g.line(xu, zn, C.blue, 2, seg(p, 0.5, 0.75), [5, 4]); warden(g, zn, seg(p, 0.7, 0.85), 'new z');
      } });
    var gap = sub(xn, zn);
    out.push({ id: 'ledger', chapter: 'The Twins', title: 'The ledger', layout: 'map', view: view, dur: 4.2,
      text: 'The scaled dual variable u—the ledger—adds today’s signed gap between the copies: u ← u + (x − z) = ' + pair(u) + ' + ' + pair(gap) + ' = ' + pair(un) + '. ' +
        (noLaw ? 'With no law the twins never part, the gap is 0 and the ledger stays empty.' :
          'A small gap means the copies agree, but agreement alone is not enough to stop: the Warden’s copy must also have nearly stopped moving. At a settled solution, ρu is the corresponding unscaled dual variable.'),
      math: 'u ← u + x − z = ' + at(0.45, pair(u) + ' + ' + pair(gap)) + at(0.85, ' = ' + pair(un)),
      draw: function (g, p) {
        base(g); g.hero(xn, 'tw', 1); warden(g, zn, 1);
        g.arrow(zn, xn, C.violet, 2, seg(p, 0.05, 0.3)); g.label(lerp2(zn, xn, 0.5), 'gap x − z', C.violet, { dx: 8, dy: 14, p: seg(p, 0.2, 0.35) });
        if (len(u) > 1e-9) g.arrow(zn, add(zn, u), 'rgba(255,176,113,0.55)', 2, seg(p, 0.35, 0.55));
        g.arrow(add(zn, u), add(add(zn, u), gap), C.violet, 2, seg(p, 0.5, 0.7), [4, 3]);
        if (len(un) > 1e-9) { g.arrow(zn, add(zn, un), C.orange, 3, seg(p, 0.7, 0.9)); g.tipLabel(add(zn, un), un, 'new ledger u', C.orange, seg(p, 0.85, 1)); }
      } });
    var primal = len(sub(xn, zn)), dual = rho * len(sub(zn, z));
    var ahead = w.slice(k, Math.min(w.length, k + 9));
    if (ahead.length > 2) {
      var xs = ahead.map(function (q) { return q.x; }), zs = ahead.map(function (q) { return q.z; });
      out.push({ id: 'again', chapter: 'The Twins', title: 'Repeat—and know when to stop', layout: 'map', view: around(xs.concat(zs), 0.35, 0.2 * cx.span), dur: 4,
        text: 'Each circuit repeats the four moves: aim, lower the cost plus rope, keep the law, and update the ledger. Stop only when both tests are small: the primal residual measures whether the two copies agree, and the dual residual measures whether the Warden’s copy has stopped moving. Today they are ' + num(primal, 4) + ' and ' + num(dual, 4) + '. Agreement alone is not enough.',
        math: 'primal residual: |x − z| = ' + num(primal, 4) + '<br>dual residual: ρ|z<sub>new</sub> − z<sub>old</sub>| = ' + num(dual, 4) + '<br>stop when both are small',
        draw: function (g, p) {
          base(g); var q = seg(p, 0.05, 0.9);
          g.path(xs, C.ink, 2.5, q); g.path(zs, C.blue, 2.5, q, [5, 3]);
          var nn = xs.length - 1, s = q * nn, kk = Math.min(Math.floor(s), nn - 1), f2 = s - kk;
          g.hero(lerp2(xs[kk], xs[kk + 1], ease(Math.min(f2, 1))), 'tw', 1); warden(g, lerp2(zs[kk], zs[kk + 1], ease(Math.min(f2, 1))), 1, 'Warden');
        } });
    }
  });
})();
