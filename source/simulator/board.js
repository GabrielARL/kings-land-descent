// The step-by-step board of kings_land_descent.html.  It cuts one day's reckoning of a hero (or yours, after you feel
// the slope) into small steps.  Each step has a few plain words, its formula with that day's numbers, and an
// animation on a flat chart of the land: where the hero stands, how the height is made, the four taps, the slopes
// they give, and the hero's move.  game.js opens the board with the day's context; Board.register adds the steps of
// one part of the reckoning (this file holds the parts every hero shares, board_parts.js the others).
//
// A step is { id, chapter, title, text, math, layout, view, dur, draw }:
//   layout  'map' (the land seen from above), 'map+side' (the map and a panel beside it) or 'side' (a panel only);
//   view    the part of the land the map shows, [x1min, x1max, x2min, x2max]; the board glides from one view to the next;
//   dur     seconds the animation takes; text and math are HTML, and a part wrapped by at(p, html) shows from
//           progress p of the animation on;
//   draw(g, p) draws the step at progress p in [0, 1] with the kit g (g.mapR and g.sideR are the two panels).
var Board = (function () {
  'use strict';
  var TAU = 2 * Math.PI;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  // the progress of a part of a step's animation that runs from a to b
  function seg(p, a, b) { return ease((p - a) / (b - a)); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function lerp2(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function add(a, b, s) { s = s == null ? 1 : s; return [a[0] + s * b[0], a[1] + s * b[1]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
  function len(a) { return Math.hypot(a[0], a[1]); }
  function scale(a, s) { return [a[0] * s, a[1] * s]; }
  function backOut(t) { var s = 1.6; t = clamp(t, 0, 1) - 1; return t * t * ((s + 1) * t + s) + 1; }
  function num(v, d) {
    if (v == null || !isFinite(v)) return '—';
    var s = v.toFixed(d == null ? 3 : d);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    return s.replace('-', '−');
  }
  function pair(v, d) { return '(' + num(v[0], d) + ', ' + num(v[1], d) + ')'; }
  // a number ready to be multiplied: negative numbers in brackets
  function par(v, d) { var t = num(v, d); return v < 0 && t !== '0.000' ? '(' + t + ')' : t; }
  function at(p, html) { return '<span class="bp" data-at="' + p + '">' + html + '</span>'; }
  function frac(a, b) { return '<span class="fr"><span>' + a + '</span><span>' + b + '</span></span>'; }
  // a view around some points: their box, widened by a share of its size, at least `least` wide
  function around(pts, grow, least) {
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach(function (q) { if (!q) return; x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = Math.max((x1 - x0) * (1 + grow), (y1 - y0) * (1 + grow), least);
    return [cx - w / 2, cx + w / 2, cy - w / 2, cy + w / 2];
  }

  var C = { bg: '#0b121b', ink: '#f2f5f8', dim: 'rgba(242,245,248,0.6)', faint: 'rgba(242,245,248,0.22)', gold: '#ffd27a',
            orange: '#ffb071', blue: '#a9cdf6', green: '#b9f0a8', red: '#ff9a8a', violet: '#d9c2ff', box: 'rgba(8,12,18,0.82)' };
  var HERO = { pg: { col: '#ffb071', letter: 'P' }, lb: { col: '#a9cdf6', letter: 'C' }, tw: { col: '#e6e9ee', letter: 'W' }, you: { col: '#ffd27a', letter: 'Y' } };

  // ------------------------------------------------------------ the drawing kit
  // Drawings in world spots keep inside the map's panel when a side panel shares the canvas.
  function mapOnly(fn) { return function () { if (!this.sideR || !this.mapR) return fn.apply(this, arguments); var c = this.ctx, R = this.mapR; c.save(); c.beginPath(); c.rect(R[0], R[1], R[2], R[3]); c.clip(); try { return fn.apply(this, arguments); } finally { c.restore(); } }; }
  function Kit(canvas) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.W = 0; this.H = 0; this.grid = null; this.lines = {}; }
  Kit.prototype.fit = function () {
    var r = this.cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = Math.max(240, Math.round(r.width)), H = Math.max(180, Math.round(r.height));
    if (this.cv.width !== Math.round(W * dpr) || this.cv.height !== Math.round(H * dpr)) { this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); }
    this.W = W; this.H = H; this.dpr = dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.sans = getComputedStyle(document.body).fontFamily || 'sans-serif';
    this.mono = (getComputedStyle(document.documentElement).getPropertyValue('--mono') || '').trim() || 'monospace';
  };
  Kit.prototype.clear = function () { var c = this.ctx; c.globalAlpha = 1; c.setLineDash([]); c.fillStyle = C.bg; c.fillRect(0, 0, this.W, this.H); };
  Kit.prototype.layout = function (kind) {
    var W = this.W, H = this.H, m = 8;
    this.mapR = this.sideR = null;
    if (kind === 'side') this.sideR = [m, m, W - 2 * m, H - 2 * m];
    else if (kind === 'map+side') {
      if (W >= H * 1.1) { var w = Math.round((W - 3 * m) * 0.54); this.mapR = [m, m, w, H - 2 * m]; this.sideR = [2 * m + w, m, W - 3 * m - w, H - 2 * m]; }
      else { var h = Math.round((H - 3 * m) * 0.55); this.mapR = [m, m, W - 2 * m, h]; this.sideR = [m, 2 * m + h, W - 2 * m, H - 3 * m - h]; }
    } else this.mapR = [m, m, W - 2 * m, H - 2 * m];
  };
  // The map: world spot q = (x1, x2) to canvas, x1 to the right and x2 up, one scale for both.
  Kit.prototype.view = function (v) {
    var R = this.mapR, vw = v[1] - v[0], vh = v[3] - v[2], s = Math.min(R[2] / vw, R[3] / vh);
    this.s = s; this.ox = R[0] + R[2] / 2 - (v[0] + v[1]) / 2 * s; this.oy = R[1] + R[3] / 2 + (v[2] + v[3]) / 2 * s;
    this.vis = [(R[0] - this.ox) / s, (R[0] + R[2] - this.ox) / s, (this.oy - R[1] - R[3]) / s, (this.oy - R[1]) / s];
  };
  Kit.prototype.P = function (q) { return [this.ox + q[0] * this.s, this.oy - q[1] * this.s]; };
  Kit.prototype.clip = function (R) { var c = this.ctx; c.save(); c.beginPath(); rrect(c, R[0], R[1], R[2], R[3], 8); c.clip(); };
  function rrect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function ramp(t) {
    var lo = [26, 58, 92], mid = [92, 112, 120], hi = [150, 98, 58], u = clamp(t, 0, 1);
    return u < 0.5 ? [mix(lo[0], mid[0], u * 2), mix(lo[1], mid[1], u * 2), mix(lo[2], mid[2], u * 2)] : [mix(mid[0], hi[0], u * 2 - 1), mix(mid[1], hi[1], u * 2 - 1), mix(mid[2], hi[2], u * 2 - 1)];
  }
  // The land as shading and rings of equal height.  fn is the height; o.lo, o.hi fix the shading's range (else the
  // range in view), o.rings the number of rings (spaced so that a bowl gets evenly spaced rings), o.id names fn.
  Kit.prototype.land = function (fn, o) {
    o = o || {};
    var R = this.mapR, v = this.vis, cell = o.cell || 4, nx = Math.max(40, Math.round(R[2] / cell)), ny = Math.max(30, Math.round(R[3] / cell));
    var key = (o.id || 'J') + '|' + v.map(function (a) { return a.toPrecision(7); }).join(',') + '|' + nx + 'x' + ny;
    var g = this.grid && this.grid.key === key ? this.grid : null;
    if (!g) {
      var vals = new Float64Array((nx + 1) * (ny + 1)), lo = Infinity, hi = -Infinity;
      for (var j = 0; j <= ny; j++) for (var i = 0; i <= nx; i++) {
        var z = fn([v[0] + (v[1] - v[0]) * i / nx, v[2] + (v[3] - v[2]) * j / ny]); vals[j * (nx + 1) + i] = z;
        if (isFinite(z)) { if (z < lo) lo = z; if (z > hi) hi = z; }
      }
      g = this.grid = { key: key, vals: vals, nx: nx, ny: ny, lo: lo, hi: hi, img: null, imgKey: '', rings: null, ringKey: '' };
      this.lines = {};
    }
    var lo = o.lo != null ? o.lo : g.lo, hi = o.hi != null ? o.hi : g.hi; if (!(hi > lo)) hi = lo + 1;
    var c = this.ctx;
    if (g.imgKey !== lo + '|' + hi + '|' + !!o.pits) {
      var cv = document.createElement('canvas'); cv.width = g.nx + 1; cv.height = g.ny + 1;
      var cc = cv.getContext('2d'), im = cc.createImageData(cv.width, cv.height);
      for (j = 0; j <= g.ny; j++) for (i = 0; i <= g.nx; i++) {
        var t = (g.vals[j * (g.nx + 1) + i] - lo) / (hi - lo), col = ramp(Math.sqrt(clamp(t, 0, 1))), k4 = ((g.ny - j) * cv.width + i) * 4;
        if (t < 0 && o.pits) { var b = clamp(-t * 4, 0, 1); col = [mix(26, 6, b), mix(58, 8, b), mix(92, 12, b)]; }
        im.data[k4] = col[0]; im.data[k4 + 1] = col[1]; im.data[k4 + 2] = col[2]; im.data[k4 + 3] = 255;
      }
      cc.putImageData(im, 0, 0); g.img = cv; g.imgKey = lo + '|' + hi + '|' + !!o.pits; g.ringKey = '';
    }
    this.clip(R);
    c.imageSmoothingEnabled = true; c.globalAlpha = o.alpha == null ? 1 : o.alpha;
    var A = this.P([v[0], v[3]]), B = this.P([v[1], v[2]]);
    c.drawImage(g.img, A[0], A[1], B[0] - A[0], B[1] - A[1]);
    var n = o.rings == null ? 12 : o.rings, rk = lo + '|' + hi + '|' + n;
    if (n > 0) {
      if (g.ringKey !== rk) { g.rings = []; for (var q = 1; q <= n; q++) g.rings.push(this.contour(g, lo + (hi - lo) * Math.pow(q / (n + 1), 2))); g.ringKey = rk; }
      c.strokeStyle = 'rgba(214,230,246,0.33)'; c.lineWidth = 1;
      g.rings.forEach(function (sg) { strokeSegs(c, sg, this); }, this);
    }
    c.globalAlpha = 1; c.restore();
  };
  // One ring: the spots of the grid in view where the height is `level` (marching squares).
  Kit.prototype.contour = function (g, level) {
    var v = this.vis, nx = g.nx, ny = g.ny, out = [], vals = g.vals, w = nx + 1;
    function X(i) { return v[0] + (v[1] - v[0]) * i / nx; } function Y(j) { return v[2] + (v[3] - v[2]) * j / ny; }
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var a = vals[j * w + i], b = vals[j * w + i + 1], cc = vals[(j + 1) * w + i + 1], d = vals[(j + 1) * w + i];
      var idx = (a > level ? 1 : 0) | (b > level ? 2 : 0) | (cc > level ? 4 : 0) | (d > level ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      var e = [];
      if ((idx & 1) !== (idx >> 1 & 1)) e.push([X(i + (level - a) / (b - a)), Y(j)]);
      if ((idx >> 1 & 1) !== (idx >> 2 & 1)) e.push([X(i + 1), Y(j + (level - b) / (cc - b))]);
      if ((idx >> 2 & 1) !== (idx >> 3 & 1)) e.push([X(i + (level - d) / (cc - d)), Y(j + 1)]);
      if ((idx >> 3 & 1) !== (idx & 1)) e.push([X(i), Y(j + (level - a) / (d - a))]);
      if (e.length === 2) out.push(e[0], e[1]); else if (e.length === 4) out.push(e[0], e[1], e[2], e[3]);
    }
    return out;
  };
  function strokeSegs(c, sg, k) {
    c.beginPath();
    for (var i = 0; i + 1 < sg.length; i += 2) { var a = k.P(sg[i]), b = k.P(sg[i + 1]); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
    c.stroke();
  }
  // The ring through one height, lit (uses the grid of the last land()).
  Kit.prototype.ring = function (level, col, w, p) {
    if (!this.grid || p <= 0) return;
    var k = String(level), sg = this.lines[k] || (this.lines[k] = this.contour(this.grid, level)), c = this.ctx;
    this.clip(this.mapR); c.globalAlpha = clamp(p, 0, 1); c.strokeStyle = col; c.lineWidth = w || 2.5; strokeSegs(c, sg, this); c.globalAlpha = 1; c.restore();
  };
  // Ticks along the map's bottom (x1) and left (x2) edges.
  Kit.prototype.axes = function () {
    var c = this.ctx, R = this.mapR, v = this.vis, step = nice((v[1] - v[0]) / 5), d = places(step);
    c.font = '11px ' + this.mono; c.fillStyle = C.dim; c.strokeStyle = C.faint; c.lineWidth = 1;
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    for (var t = Math.ceil(v[0] / step) * step; t <= v[1]; t += step) { var a = this.P([t, v[2]]); if (a[0] < R[0] + 18 || a[0] > R[0] + R[2] - 24) continue; c.beginPath(); c.moveTo(a[0], R[1] + R[3]); c.lineTo(a[0], R[1] + R[3] - 5); c.stroke(); c.fillText(num(t, d), a[0], R[1] + R[3] - 6); }
    c.textAlign = 'left'; c.textBaseline = 'middle';
    for (t = Math.ceil(v[2] / step) * step; t <= v[3]; t += step) { var b = this.P([v[0], t]); if (b[1] < R[1] + 22 || b[1] > R[1] + R[3] - 30) continue; c.beginPath(); c.moveTo(R[0], b[1]); c.lineTo(R[0] + 5, b[1]); c.stroke(); c.fillText(num(t, d), R[0] + 7, b[1]); }
    c.font = '600 12px ' + this.sans; c.fillStyle = C.ink; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText('x₁ →', R[0] + R[2] - 6, R[1] + R[3] - 4);
    c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('↑ x₂', R[0] + 6, R[1] + 5);
  };
  function places(step) { return clamp(Math.ceil(-Math.log(step) / Math.LN10 - 1e-9), 0, 7); }
  function nice(x) { var e = Math.pow(10, Math.floor(Math.log(x) / Math.LN10)), f = x / e; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e; }
  Kit.prototype.dot = mapOnly(function (q, r, col, p) {
    if (!(p > 0)) return; var c = this.ctx, a = this.P(q);
    c.beginPath(); c.arc(a[0], a[1], r * backOut(p), 0, TAU); c.fillStyle = col; c.fill(); c.lineWidth = 2; c.strokeStyle = C.bg; c.stroke();
  });
  Kit.prototype.halo = mapOnly(function (q, rPx, col, p, w, dash) {
    if (!(p > 0)) return; var c = this.ctx, a = this.P(q);
    c.globalAlpha = clamp(p, 0, 1); c.strokeStyle = col; c.lineWidth = w || 1.5; if (dash) c.setLineDash(dash);
    c.beginPath(); c.arc(a[0], a[1], rPx, 0, TAU); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
  });
  // a ring spreading from a spot, as when the staff touches the ground
  Kit.prototype.tap = mapOnly(function (q, col, p) {
    if (!(p > 0) || p >= 1) return; var c = this.ctx, a = this.P(q);
    c.globalAlpha = 1 - p; c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(a[0], a[1], 4 + 22 * p, 0, TAU); c.stroke(); c.globalAlpha = 1;
  });
  Kit.prototype.hero = mapOnly(function (q, who, p, label) {
    if (!(p > 0)) return; var h = HERO[who] || HERO.you, c = this.ctx, a = this.P(q), r = 9 * backOut(p);
    c.beginPath(); c.arc(a[0], a[1], r + 3, 0, TAU); c.fillStyle = 'rgba(8,12,18,0.85)'; c.fill();
    c.beginPath(); c.arc(a[0], a[1], r, 0, TAU); c.fillStyle = h.col; c.fill();
    if (p > 0.6) { c.fillStyle = '#1b1406'; c.font = '700 11px ' + this.sans; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(h.letter, a[0], a[1] + 0.5); }
    if (label) this.labelPx(a[0] + 14, a[1] - 12, label, h.col, { p: seg(p, 0.5, 1) });
  });
  Kit.prototype.flag = mapOnly(function (q, p) {
    if (!(p > 0)) return; var c = this.ctx, a = this.P(q), k = backOut(p);
    c.strokeStyle = C.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(a[0], a[1] - 22 * k); c.stroke();
    c.fillStyle = '#f7f3ea'; c.beginPath(); c.moveTo(a[0], a[1] - 22 * k); c.lineTo(a[0] + 14 * k, a[1] - 17 * k); c.lineTo(a[0], a[1] - 12 * k); c.closePath(); c.fill();
    c.fillStyle = '#c45100'; c.beginPath(); c.arc(a[0] + 5 * k, a[1] - 17 * k, 2.2 * k, 0, TAU); c.fill();
  });
  // an arrow from a to b (world spots), drawn as far as progress p
  Kit.prototype.arrow = mapOnly(function (a, b, col, w, p, dash) { if (!(p > 0)) return; var A = this.P(a), B = this.P(b); this.arrowPx(A, [mix(A[0], B[0], p), mix(A[1], B[1], p)], col, w, dash); });
  Kit.prototype.arrowPx = function (A, B, col, w, dash) {
    var c = this.ctx, dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy); if (L < 0.5) return;
    var ux = dx / L, uy = dy / L, hl = Math.min(9 + 2 * w, L * 0.5), hw = hl * 0.55;
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; c.lineCap = 'round'; if (dash) c.setLineDash(dash);
    c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0] - ux * hl * 0.7, B[1] - uy * hl * 0.7); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.moveTo(B[0], B[1]); c.lineTo(B[0] - ux * hl - uy * hw, B[1] - uy * hl + ux * hw); c.lineTo(B[0] - ux * hl + uy * hw, B[1] - uy * hl - ux * hw); c.closePath(); c.fill();
  };
  Kit.prototype.line = mapOnly(function (a, b, col, w, p, dash) {
    if (!(p > 0)) return; var c = this.ctx, A = this.P(a), B = this.P(b);
    c.strokeStyle = col; c.lineWidth = w || 1.5; c.lineCap = 'round'; if (dash) c.setLineDash(dash);
    c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(mix(A[0], B[0], p), mix(A[1], B[1], p)); c.stroke(); c.setLineDash([]);
  });
  // a path through world spots, drawn as far as progress p of its length
  Kit.prototype.path = mapOnly(function (pts, col, w, p, dash) {
    if (!(p > 0) || pts.length < 2) return; var c = this.ctx, P = pts.map(this.P, this), L = 0, i;
    for (i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    var left = L * clamp(p, 0, 1);
    c.strokeStyle = col; c.lineWidth = w || 2; c.lineJoin = 'round'; c.lineCap = 'round'; if (dash) c.setLineDash(dash);
    c.beginPath(); c.moveTo(P[0][0], P[0][1]);
    for (i = 1; i < P.length && left > 0; i++) {
      var l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]), t = l > left ? left / l : 1;
      c.lineTo(mix(P[i - 1][0], P[i][0], t), mix(P[i - 1][1], P[i][1], t)); left -= l;
    }
    c.stroke(); c.setLineDash([]);
  });
  Kit.prototype.label = mapOnly(function (q, text, col, o) { var a = this.P(q); o = o || {}; this.labelPx(a[0] + (o.dx || 0), a[1] + (o.dy || 0), text, col, o); });
  // a label: text on a dark rounded box; o: { p, size, align ('left', 'center', 'right'), mono, plain (no box), base }
  Kit.prototype.labelPx = function (x, y, text, col, o) {
    o = o || {}; var p = o.p == null ? 1 : o.p; if (!(p > 0)) return;
    var c = this.ctx, size = o.size || 13; c.font = (o.mono ? '' : '600 ') + size + 'px ' + (o.mono ? this.mono : this.sans);
    var w = c.measureText(text).width, align = o.align || 'left', x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    x0 = clamp(x0, 4, this.W - w - 4); var yc = clamp(y, size / 2 + 4, this.H - size / 2 - 4);
    c.globalAlpha = clamp(p, 0, 1);
    if (!o.plain) { c.fillStyle = C.box; c.beginPath(); rrect(c, x0 - 5, yc - size / 2 - 4, w + 10, size + 8, 5); c.fill(); }
    c.fillStyle = col || C.ink; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(text, x0, yc + 0.5); c.globalAlpha = 1;
    return [x0 - 5, yc - size / 2 - 4, w + 10, size + 8];
  };
  // a label just beyond the tip of an arrow pointing along dir (a world direction)
  Kit.prototype.tipLabel = mapOnly(function (tip, dir, text, col, p) {
    var a = this.P(tip), l = len(dir) || 1, ux = dir[0] / l, uy = -dir[1] / l;
    return this.labelPx(a[0] + ux * 14, a[1] + uy * 14 + (Math.abs(ux) < 0.4 ? (uy < 0 ? -4 : 4) : 0), text, col, { p: p, align: ux > 0.35 ? 'left' : ux < -0.35 ? 'right' : 'center', size: 12.5 });
  });
  // a key in a corner of the map: rows of [colour, text, dash]
  Kit.prototype.legend = function (rows, p) {
    if (!(p > 0)) return; var c = this.ctx, R = this.mapR, x = R[0] + 10, y = R[1] + 26, w = 0;
    c.font = '12px ' + this.mono; rows.forEach(function (r) { w = Math.max(w, c.measureText(r[1]).width); });
    c.globalAlpha = clamp(p, 0, 1); c.fillStyle = C.box; c.beginPath(); rrect(c, x, y, w + 40, rows.length * 19 + 10, 6); c.fill();
    rows.forEach(function (r, k) { c.strokeStyle = r[0]; c.lineWidth = 3; if (r[2]) c.setLineDash(r[2]); c.beginPath(); c.moveTo(x + 8, y + 15 + 19 * k); c.lineTo(x + 26, y + 15 + 19 * k); c.stroke(); c.setLineDash([]); c.fillStyle = C.ink; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(r[1], x + 32, y + 15 + 19 * k); });
    c.globalAlpha = 1;
  };
  // A right angle marker at corner q between directions u and v (unit vectors), size in pixels.
  Kit.prototype.square = mapOnly(function (q, u, v, size, col, p) {
    if (!(p > 0)) return; var c = this.ctx, a = this.P(q), s = size, U = [u[0] * s, -u[1] * s], V = [v[0] * s, -v[1] * s];
    c.globalAlpha = clamp(p, 0, 1); c.strokeStyle = col; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(a[0] + U[0], a[1] + U[1]); c.lineTo(a[0] + U[0] + V[0], a[1] + U[1] + V[1]); c.lineTo(a[0] + V[0], a[1] + V[1]); c.stroke(); c.globalAlpha = 1;
  });
  Kit.prototype.panel = function (R, title) {
    var c = this.ctx; c.fillStyle = 'rgba(255,255,255,0.035)'; c.beginPath(); rrect(c, R[0], R[1], R[2], R[3], 8); c.fill();
    if (title) { c.font = '700 12.5px ' + this.sans; c.fillStyle = C.gold; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(title, R[0] + 10, R[1] + 8); }
  };
  // A 2-by-2 table of numbers in brackets, with cells lit in turn; returns its width.  cells[i][j] are strings,
  // lit(i, j) in [0, 1] how much cell (i, j) shows.
  Kit.prototype.matrix = function (x, y, cells, lit, o) {
    o = o || {}; var c = this.ctx, size = o.size || 14; c.font = size + 'px ' + this.mono;
    var cw = Math.max.apply(null, cells.map(function (r) { return Math.max.apply(null, r.map(function (s) { return c.measureText(s).width; })); })) + 14;
    var rows = cells.length, cols = cells[0].length, h = rows * (size + 10), w = cols * cw + 10;
    c.strokeStyle = o.col || C.ink; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x + 6, y); c.lineTo(x, y); c.lineTo(x, y + h); c.lineTo(x + 6, y + h); c.stroke();
    c.beginPath(); c.moveTo(x + w - 6, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h); c.lineTo(x + w - 6, y + h); c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (var i = 0; i < rows; i++) for (var j = 0; j < cols; j++) {
      var l = lit ? lit(i, j) : 1; if (!(l > 0)) continue;
      c.globalAlpha = clamp(l, 0, 1); c.fillStyle = (o.colOf && o.colOf(i, j)) || C.ink; c.fillText(cells[i][j], x + 5 + cw * (j + 0.5), y + (size + 10) * (i + 0.5)); c.globalAlpha = 1;
    }
    return w;
  };
  // Bars for a sum: items [{ name, value, col }] grow in turn from a zero line; the last item may be the total.
  Kit.prototype.bars = function (R, items, p, o) {
    o = o || {}; var c = this.ctx, n = items.length, top = R[1] + (o.title ? 34 : 12), rowH = Math.min(46, (R[3] - (top - R[1]) - 10) / n);
    var pos = 0, neg = 0; items.forEach(function (it) { if (it.value > 0) pos = Math.max(pos, it.value); else neg = Math.max(neg, -it.value); });
    var whole = pos + neg || 1, nameW = Math.min(R[2] * 0.46, o.nameW || 200), x0 = R[0] + nameW + 14, x1 = R[0] + R[2] - 92;
    var zero = x0 + (x1 - x0) * neg / whole, unit = (x1 - x0) / whole;
    if (o.title) this.panel(R, o.title); else this.panel(R);
    c.strokeStyle = C.faint; c.lineWidth = 1; c.beginPath(); c.moveTo(zero, top - 4); c.lineTo(zero, top + rowH * n); c.stroke();
    items.forEach(function (it, i) {
      var q = seg(p, i / (n + 0.3), (i + 1) / (n + 0.3)); if (!(q > 0)) return;
      var y = top + rowH * i + rowH / 2, w = it.value * unit * q, total = o.total && i === n - 1;
      if (total) { c.strokeStyle = C.faint; c.beginPath(); c.moveTo(R[0] + 8, y - rowH / 2); c.lineTo(R[0] + R[2] - 8, y - rowH / 2); c.stroke(); }
      c.globalAlpha = clamp(q * 1.5, 0, 1);
      c.font = (total ? '700 ' : '600 ') + '12.5px ' + this.sans; c.fillStyle = it.col || C.ink; c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText(it.name, R[0] + nameW, y);
      c.fillStyle = it.col || C.ink; c.globalAlpha *= total ? 1 : 0.85; c.fillRect(Math.min(zero, zero + w), y - rowH * 0.28, Math.abs(w), rowH * 0.56); c.globalAlpha = clamp(q * 1.5, 0, 1);
      c.font = (total ? '700 ' : '') + '12.5px ' + this.mono; c.fillStyle = C.ink; c.textAlign = 'right';
      c.fillText(num(it.value * (q < 1 ? q : 1), o.d == null ? 4 : o.d), R[0] + R[2] - 10, y); c.globalAlpha = 1;
    }, this);
  };
  // A side panel's plot: t across, v up.  Returns helpers in canvas pixels.
  Kit.prototype.plot = function (R, tr, vr, o) {
    o = o || {}; var k = this, c = this.ctx, L = R[0] + 44, Rt = R[0] + R[2] - 14, T = R[1] + (o.title ? 34 : 14), B = R[1] + R[3] - 30;
    var X = function (t) { return L + (t - tr[0]) / (tr[1] - tr[0]) * (Rt - L); }, Y = function (v) { return B - (v - vr[0]) / (vr[1] - vr[0]) * (B - T); };
    var P = {
      X: X, Y: Y, box: [L, T, Rt - L, B - T],
      frame: function (tl, vl) {
        if (o.title) k.panel(R, o.title); else k.panel(R);
        c.strokeStyle = C.faint; c.lineWidth = 1; c.beginPath(); c.moveTo(L, T); c.lineTo(L, B); c.lineTo(Rt, B); c.stroke();
        c.font = '11px ' + k.mono; c.fillStyle = C.dim; c.textAlign = 'center'; c.textBaseline = 'top';
        var st = nice((tr[1] - tr[0]) / 4), d = places(st);
        if (o.tTicks !== false) for (var t = Math.ceil(tr[0] / st) * st; t <= tr[1] + 1e-12; t += st) c.fillText(num(t, d), X(t), B + 4);
        var sv = nice((vr[1] - vr[0]) / 4), dv = places(sv); c.textAlign = 'right'; c.textBaseline = 'middle';
        for (var v = Math.ceil(vr[0] / sv) * sv; v <= vr[1] + 1e-12; v += sv) c.fillText(num(v, dv), L - 4, Y(v));
        c.font = '600 12px ' + k.sans; c.fillStyle = C.ink; c.textAlign = 'right'; c.textBaseline = 'bottom'; if (tl) c.fillText(tl, Rt, B - 4);
        c.textAlign = 'left'; c.textBaseline = 'top'; if (vl) c.fillText(vl, L + 6, T);
      },
      curve: function (fn, col, w, p) {
        if (!(p > 0)) return;
        c.save(); c.beginPath(); c.rect(L, T - 6, Rt - L, B - T + 6); c.clip();
        c.strokeStyle = col; c.lineWidth = w || 2; c.lineJoin = 'round'; c.beginPath();
        var n = 160, last = Math.round(n * clamp(p, 0, 1));
        for (var i = 0; i <= last; i++) { var t = tr[0] + (tr[1] - tr[0]) * i / n, y = clamp(Y(fn(t)), T - 40, B + 40); if (i) c.lineTo(X(t), y); else c.moveTo(X(t), y); }
        c.stroke(); c.restore();
      },
      point: function (t, v, col, text, p, side) {
        if (!(p > 0)) return; c.beginPath(); c.arc(X(t), Y(v), 5 * backOut(p), 0, TAU); c.fillStyle = col; c.fill(); c.lineWidth = 2; c.strokeStyle = C.bg; c.stroke();
        if (text) k.labelPx(X(t) + (side === 'left' ? -10 : 10), Y(v) - 14, text, col, { p: seg(p, 0.4, 1), align: side === 'left' ? 'right' : 'left', size: 12 });
      },
      seg: function (t1, v1, t2, v2, col, w, p, dash) {
        if (!(p > 0)) return; c.strokeStyle = col; c.lineWidth = w || 1.5; if (dash) c.setLineDash(dash);
        c.beginPath(); c.moveTo(X(t1), Y(v1)); c.lineTo(mix(X(t1), X(t2), p), mix(Y(v1), Y(v2), p)); c.stroke(); c.setLineDash([]);
      },
      // a bracket along t at height v (run) or along v at t (rise), with its text
      run: function (t1, t2, v, text, col, p) {
        if (!(p > 0)) return; var y = Y(v) + 14; c.globalAlpha = clamp(p, 0, 1); c.strokeStyle = col; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(X(t1), y - 5); c.lineTo(X(t1), y); c.lineTo(X(t2), y); c.lineTo(X(t2), y - 5); c.stroke(); c.globalAlpha = 1;
        k.labelPx((X(t1) + X(t2)) / 2, y + 12, text, col, { p: p, align: 'center', size: 12 });
      },
      rise: function (t, v1, v2, text, col, p) {
        if (!(p > 0)) return; var x = X(t) + 10; c.globalAlpha = clamp(p, 0, 1); c.strokeStyle = col; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(x - 5, Y(v1)); c.lineTo(x, Y(v1)); c.lineTo(x, Y(v2)); c.lineTo(x - 5, Y(v2)); c.stroke(); c.globalAlpha = 1;
        k.labelPx(x + 6, (Y(v1) + Y(v2)) / 2, text, col, { p: p, size: 12 });
      }
    };
    return P;
  };

  // ------------------------------------------------------------ the parts of a day's reckoning
  var parts = {};
  function register(name, fn) { parts[name] = fn; }
  // The day under study, from game.js's context: who, the day, where it stood, what it felt; the parts add their
  // terms of the height (cx.parts) and of the slope (cx.gradParts) for the steps that add them up.
  function study(ctx) {
    var cx = {}, k;
    for (k in ctx) cx[k] = ctx[k];
    var land = ctx.land;
    cx.J = land.J; cx.span = land.span; cx.landView = ctx.L.view; cx.h = land.h; cx.sigma = land.sigma || 0; cx.haze = cx.sigma > 0;
    cx.you = ctx.hero === 'you';
    cx.who = cx.you ? 'you' : ctx.name; cx.Who = cx.you ? 'You' : ctx.name.charAt(0).toUpperCase() + ctx.name.slice(1);
    if (cx.you) {
      cx.x = ctx.at.slice(); cx.path = [cx.x]; cx.k = ctx.day;
      cx.taps = ctx.felt ? ctx.felt.taps : null; cx.gTaps = ctx.felt ? ctx.felt.g : null; cx.g = cx.gTaps;
    } else {
      var w = ctx.walk; cx.k = Math.max(0, Math.min(ctx.day, w.length - 2)); cx.last = ctx.day > w.length - 2;
      cx.here = w[cx.k]; cx.rec = w.length > 1 ? w[cx.k + 1] : null;
      cx.x = cx.rec && cx.rec.from ? cx.rec.from.slice() : cx.here.x.slice();
      cx.path = w.slice(0, cx.k + 1).map(function (d) { return d.x; });
      cx.taps = cx.rec && cx.rec.taps ? cx.rec.taps : null; cx.gTaps = cx.rec ? cx.rec.gFelt : null; cx.g = cx.rec ? cx.rec.g : null;
    }
    cx.gTrue = land.grad(cx.x); cx.F = ctx.hero === 'tw' ? land.f : land.J; cx.Jx = cx.F(cx.x);
    // the shading's range: the land without its pits, over the whole map
    var v = cx.landView, lo = Infinity, hi = -Infinity, sm = land.smooth || land.J;
    for (var i = 0; i <= 40; i++) for (var j = 0; j <= 40; j++) { var z = sm([v[0] + (v[1] - v[0]) * i / 40, v[2] + (v[3] - v[2]) * j / 40]); if (z < lo) lo = z; if (z > hi) hi = z; }
    cx.shade = { lo: lo, hi: hi, id: 'J', pits: !!land.holes };
    cx.zoom = [cx.x[0] - 3.6 * cx.h, cx.x[0] + 3.6 * cx.h, cx.x[1] - 3.6 * cx.h, cx.x[1] + 3.6 * cx.h];
    cx.parts = []; cx.gradParts = [];
    return cx;
  }
  function plan(ctx) {
    var cx = study(ctx), out = [];
    function run(name) { if (parts[name]) parts[name](cx, out, H); }
    run('where');
    run(cx.land.kind === 'tower' ? 'towerHeight' : 'quadHeight');
    run('weather');
    if (cx.hero !== 'tw' && cx.taps) run('taps');
    run({ pg: 'pgStride', lb: 'lbDay', tw: 'twDay', you: 'youDown' }[cx.hero]);
    return { cx: cx, steps: out };
  }

  // ------------------------------------------------------------ the board: open, play, step, close
  var embedded = false, stepHook = null, kit = null, cx = null, steps = [], visited = [], i = 0, t0 = 0, playing = false, raf = 0, opened = false, viewNow = null, viewFrom = null, closeHook = null, frozen = null;
  // A road (realm.js): a short list of steps played in place of the course, after which the course resumes; on a page
  // without a course (the game) the road opens the board by itself and closes it at the end.  Watchers see every step,
  // the road's included; the course's own step hook sees only its own steps.
  var road = null, watchers = [];
  function now() { return frozen != null ? frozen : performance.now(); }
  function open(ctx, o) {
    o = o || {}; var pl = plan(ctx); if (!pl.steps.length) return false;
    if (road) { var r0 = road; road = null; if (r0.onEnd) r0.onEnd(true); }   // the reader opened the board for their own spot: the road gives way
    cx = pl.cx; steps = pl.steps; embedded = false;
    if (o.ids && o.ids.length) {
      var all = steps;
      steps = o.ids.map(function (id) { return all.filter(function (s) { return s.id === id; })[0]; }).filter(Boolean);
      if (steps.length !== o.ids.length) return false;
    }
    visited = steps.map(function () { return false; });
    if (!kit) { kit = new Kit($('board-canvas')); bind(); }
    $('board').hidden = false; opened = true; playing = false; viewNow = null; playLabel();
    $('board-title').textContent = o.title || (cx.you ? 'Your reckoning, step by step' : 'How ' + cx.who + ' reckons day ' + cx.k + ' → ' + (cx.k + 1) + (cx.last ? ' (its last step)' : ''));
    list(); go(0);
    return true;
  }
  function close() {
    if (road && road.standalone) { endRoad(true); return; }
    if (!opened || embedded) return; opened = false; playing = false; cancelAnimationFrame(raf); raf = 0; $('board').hidden = true;
    if (closeHook) closeHook({ completed: visited.length === steps.length && visited.every(function (v) { return v; }), visited: visited.filter(Boolean).length, count: steps.length });
  }
  function go(n) {
    if (!steps.length) return;
    i = clamp(n, 0, steps.length - 1); visited[i] = true; viewFrom = viewNow; t0 = now();
    var s = steps[i];
    $('board-chapter').textContent = s.chapter || '';
    $('board-step').textContent = s.title;
    $('board-text').innerHTML = s.text || '';
    $('board-math').innerHTML = s.math || ''; $('board-math').hidden = !s.math;
    $('board-count').textContent = road ? road.label + ' · ' + (i + 1) + ' of ' + steps.length : 'Step ' + (i + 1) + ' of ' + steps.length;
    $('board-prev').disabled = i === 0;
    var last = i === steps.length - 1;
    $('board-next').textContent = last ? (road ? road.next : embedded ? 'The end' : 'Done ✓') : (embedded ? 'Next →' : 'Next ▶');
    $('board-next').disabled = embedded && last && !road;
    if (stepHook && !road) stepHook(i, steps[i], steps);
    watchers.forEach(function (f) { try { f(i, steps[i], !!road); } catch (e) { (window.kingsLandErrors = window.kingsLandErrors || []).push('watcher: ' + (e && e.stack || e)); } });
    Array.prototype.forEach.call($('board-list').querySelectorAll('[data-i]'), function (li) {
      var j = +li.getAttribute('data-i'); li.classList.toggle('on', j === i); li.classList.toggle('done', j < i);
      if (j === i && li.scrollIntoView) { var box = $('board-list'); if (li.offsetTop < box.scrollTop || li.offsetTop + li.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = li.offsetTop - box.clientHeight / 2; }
    });
    tick();
  }
  function list() {
    var html = '', chap = null;
    steps.forEach(function (s, j) {
      if (s.chapter !== chap) { chap = s.chapter; html += '<li class="bl-chap">' + chap + '</li>'; }
      html += '<li class="bl-step" data-i="' + j + '"><span>' + (j + 1) + '</span>' + s.title + '</li>';
    });
    $('board-list').innerHTML = html;
  }
  function hold(s) { var words = ((s.text || '') + ' ' + (s.math || '')).replace(/<[^>]*>/g, ' ').split(/\s+/).length; return clamp(1.6 + 0.07 * words, 3, 10); }
  function estimateSeconds(list0) {
    return (list0 || []).reduce(function (sum, s) { return sum + (s.dur || 3) + hold(s); }, 0);
  }
  function glide(a, b, t) {
    var ca = [(a[0] + a[1]) / 2, (a[2] + a[3]) / 2], cb = [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2], wa = a[1] - a[0], wb = b[1] - b[0], ha = a[3] - a[2], hb = b[3] - b[2];
    var c = lerp2(ca, cb, t), w = wa * Math.pow(wb / wa, t), h = ha * Math.pow(hb / ha, t);
    return [c[0] - w / 2, c[0] + w / 2, c[1] - h / 2, c[1] + h / 2];
  }
  function render(p, tSec) {
    var s = steps[i];
    kit.fit(); kit.clear(); kit.layout(s.layout || 'map');
    if (kit.mapR) {
      var target = s.view || viewNow || cx.landView, v = target;
      if (viewFrom && tSec < 0.9) v = glide(viewFrom, target, ease(tSec / 0.9));
      viewNow = v; kit.view(v);
    }
    try { s.draw(kit, p); } catch (e) { (window.kingsLandErrors = window.kingsLandErrors || []).push('board ' + s.id + ': ' + (e && e.stack || e)); }
    if (tSec < 0.3) { kit.ctx.globalAlpha = 1 - tSec / 0.3; kit.ctx.fillStyle = C.bg; kit.ctx.fillRect(0, 0, kit.W, kit.H); kit.ctx.globalAlpha = 1; }
    Array.prototype.forEach.call(document.querySelectorAll('#board .bp'), function (el) { el.classList.toggle('on', p >= +el.getAttribute('data-at') - 1e-9); });
  }
  function tick() {
    if (!opened) return;
    cancelAnimationFrame(raf); raf = 0;
    var s = steps[i], tSec = (now() - t0) / 1000, dur = s.dur || 3, p = clamp(tSec / dur, 0, 1);
    render(p, tSec);
    if (playing && tSec > dur + hold(s)) { if (i < steps.length - 1) { go(i + 1); return; } if (road) { endRoad(false); return; } playing = false; playLabel(); }
    if (frozen == null && (p < 1 || tSec < 0.9 || playing)) raf = requestAnimationFrame(tick);
  }
  function playLabel() { var b = $('board-play'); if (b) { b.textContent = playing ? '⏸ Pause' : '⏵ Play'; b.setAttribute('aria-pressed', String(playing)); } }
  function play() { playing = !playing; if (playing && i === steps.length - 1 && (now() - t0) / 1000 > (steps[i].dur || 3)) go(0); playLabel(); tick(); }
  function next() { if (i < steps.length - 1) go(i + 1); else if (road) endRoad(false); else close(); }
  function bind() {
    if ($('board-close')) $('board-close').addEventListener('click', close);
    $('board-prev').addEventListener('click', function () { playing = false; playLabel(); go(i - 1); });
    $('board-next').addEventListener('click', function () { playing = false; playLabel(); next(); });
    $('board-replay').addEventListener('click', function () { go(i); });
    $('board-play').addEventListener('click', play);
    $('board-list').addEventListener('click', function (e) { var li = e.target.closest ? e.target.closest('[data-i]') : null; if (li) { playing = false; playLabel(); go(+li.getAttribute('data-i')); } });
    window.addEventListener('resize', function () { if (opened) tick(); });
  }
  // Keys while the board is open; true when the board used the key.
  function key(e) {
    if (!opened) return false;
    var k = e.key;
    if (k === 'ArrowRight' || k === 'Enter') { playing = false; playLabel(); next(); }
    else if (k === 'ArrowLeft') { playing = false; playLabel(); go(i - 1); }
    else if (k === ' ') play();
    else if (k === 'r' || k === 'R') go(i);
    else if (!embedded && (k === 'Escape' || k === 'b' || k === 'B')) close();
    else return false;
    e.preventDefault(); return true;
  }
  // A course: a list of prepared steps played inside the page itself (no close; the last step is the end).
  function openSteps(list0, o) {
    o = o || {}; embedded = !!o.embedded; cx = o.cx || { landView: [-1, 1, -1, 1] }; steps = list0; visited = steps.map(function () { return false; });
    if (!steps.length) return false;
    if (!kit) { kit = new Kit($('board-canvas')); bind(); }
    $('board').hidden = false; opened = true; playing = false; viewNow = null; playLabel();
    if (o.title && $('board-title')) $('board-title').textContent = o.title;
    list(); go(o.start || 0);
    return true;
  }
  // A road: play `list0` now, then return to the course at step o.then (an index or an id; else where it was).
  // o: { then, label (the count's prefix), next (the last step's button), title (the board's title when standalone),
  //      onEnd(skipped), start }.
  function interlude(list0, o) {
    o = o || {}; if (!list0 || !list0.length || road) return false;
    var standalone = !opened || !embedded, titleEl = $('board-title');
    road = { steps: steps, visited: visited, i: i, cx: cx, then: o.then, standalone: standalone, wasOpen: opened, label: o.label || 'On the road',
             next: o.next || 'Continue →', onEnd: o.onEnd || null, title: titleEl ? titleEl.textContent : null };
    steps = list0; visited = steps.map(function () { return false; });
    if (!kit) { kit = new Kit($('board-canvas')); bind(); }
    if (standalone) { embedded = false; cx = o.cx || cx || { landView: [0, 1, 0, 1] }; if (o.title && titleEl) titleEl.textContent = o.title; }
    $('board').hidden = false; opened = true; playing = false; viewNow = null; viewFrom = null; playLabel();
    list(); go(o.start || 0);
    return true;
  }
  function endRoad(skipped) {
    if (!road) return; var r = road; road = null; viewNow = null; viewFrom = null;
    if (r.standalone && r.title != null && $('board-title')) $('board-title').textContent = r.title;
    if (r.standalone && !r.wasOpen) { opened = false; playing = false; cancelAnimationFrame(raf); raf = 0; $('board').hidden = true; steps = r.steps; visited = r.visited; cx = r.cx; }
    else {
      steps = r.steps; visited = r.visited; cx = r.cx; list();
      var to = r.standalone ? r.i : typeof r.then === 'string' ? steps.map(function (s) { return s.id; }).indexOf(r.then) : r.then;
      go(to == null || to < 0 ? r.i : to);
    }
    if (r.onEnd) r.onEnd(!!skipped);
  }
  // For tests: show step n (an index or an id) at progress p, with time stopped.
  function debug(o) {
    o = o || {};
    if (o.step != null && steps.length) {
      var n = typeof o.step === 'number' ? o.step : steps.map(function (s) { return s.id; }).indexOf(o.step);
      if (n >= 0) { frozen = 0; viewNow = null; viewFrom = null; go(n); }
    }
    if (o.p != null && opened) { frozen = 1e9; t0 = frozen - 1000 * (o.p * (steps[i].dur || 3)) - 1000; render(o.p, 5); }
    if (o.live) frozen = null;
    return { open: opened, i: i, n: steps.length, id: steps[i] && steps[i].id, title: steps[i] && steps[i].title, road: !!road };
  }

  var H = { C: C, HERO: HERO, clamp: clamp, ease: ease, seg: seg, mix: mix, lerp2: lerp2, add: add, sub: sub, dot: dot, len: len, scale: scale,
            num: num, pair: pair, par: par, at: at, frac: frac, around: around, nice: nice, backOut: backOut };

  // ------------------------------------------------------------ where the hero stands
  register('where', function (cx, out) {
    var x = cx.x, x0 = cx.x0, moved = cx.path.length > 1, col = HERO[cx.hero].col;
    out.push({ id: 'where', chapter: 'Where', title: cx.you ? 'Where you stand: x' : 'Where ' + cx.who + ' stands: x', layout: 'map', view: cx.landView, dur: 3.6,
      text: 'A spot on the King’s map is a pair of numbers, x = (x₁, x₂): x₁ grows to the east, x₂ to the north. ' +
        (cx.you ? 'You stand at x = ' + pair(x) + '.' : 'Every hero sets out from the start flag, x₀ = ' + pair(x0) + ', on day 0. ' +
          (cx.k === 0 ? 'Today is day 0, so ' + cx.who + ' is still at the flag: x = x₀.' : 'After ' + cx.k + (cx.k === 1 ? ' day' : ' days') + ' of walking, ' + cx.who + ' stands at x = ' + pair(x) + '.')),
      math: (cx.you ? '' : at(0.15, 'x₀ = ' + pair(x0)) + '<br>') + at(0.7, 'x = (x₁, x₂) = ' + pair(x)),
      draw: function (g, p) {
        g.land(cx.J, cx.shade); g.axes();
        if (!cx.you) { g.flag(x0, seg(p, 0, 0.2)); g.label(x0, 'x₀, the start flag', C.ink, { dx: 18, dy: -22, p: seg(p, 0.1, 0.3) }); }
        if (moved) g.path(cx.path, col, 2.5, seg(p, 0.25, 0.55));
        g.hero(x, cx.hero, seg(p, moved ? 0.5 : 0.3, moved ? 0.62 : 0.45));
        var q = seg(p, 0.62, 0.86), v = g.vis, foot = [x[0], v[2]], side = [v[0], x[1]];
        g.line(x, foot, C.gold, 1.5, q, [5, 4]); g.line(x, side, C.gold, 1.5, q, [5, 4]);
        g.label(foot, 'x₁ = ' + num(x[0]), C.gold, { dx: 6, dy: -34, p: seg(p, 0.8, 1) });
        g.label(side, 'x₂ = ' + num(x[1]), C.gold, { dx: 34, dy: -14, p: seg(p, 0.8, 1) });
      } });
  });

  // ------------------------------------------------------------ the height of a valley land: ½(x − c)ᵀA(x − c)
  register('quadHeight', function (cx, out) {
    var land = cx.land, P = cx.p, x = cx.x, c = land.c, A = land.A, d = sub(x, c), th = (P.theta || 0) * Math.PI / 180;
    var u1 = [Math.cos(th), Math.sin(th)], u2 = [-Math.sin(th), Math.cos(th)], l1 = P.l1, l2 = P.l2, round = Math.abs(l1 - l2) < 1e-9;
    var Ad = [A[0][0] * d[0] + A[0][1] * d[1], A[1][0] * d[0] + A[1][1] * d[1]], q = dot(d, Ad), val = q / 2, a = dot(d, u1), b = dot(d, u2);
    var valley = land.base.J, weather = !!(land.ripples || land.holes), view = around([x, c], 0.7, 0.3 * cx.span);
    var box = land.box, cOut = box && (c[0] < box[0] || c[0] > box[1] || c[1] < box[0] || c[1] > box[1]);
    var vshade = { id: 'valley', lo: 0, rings: 10 };
    cx.parts.push({ name: 'valley', value: val, col: C.gold });
    cx.gradParts.push({ name: 'valley A(x − c)', vec: Ad, col: C.gold });
    function base(g, p, noX) { g.land(valley, vshade); g.axes(); g.dot(c, 6, C.blue, 1); g.label(c, 'c', C.blue, { dx: 10, dy: 12 }); if (!noX) g.hero(x, cx.hero, 1); }
    var who = cx.you ? 'you' : cx.who;
    out.push({ id: 'formula', chapter: 'The height', title: 'The King’s formula for the height', layout: 'map', view: cx.landView, dur: 3.4,
      text: 'The height of a spot is the King’s formula, J(x). On this land it is a smooth valley, ½(x − c)ᵀA(x − c)' +
        (land.ripples ? ', plus ripples R(x)' : '') + (land.holes ? ', plus black holes B(x)' : '') +
        '. Dark is low and warm is high; each ring joins spots of the same height. We build the valley first, one symbol at a time.',
      math: 'J(x) = ' + at(0.3, '½(x − c)ᵀA(x − c)') + (land.ripples ? at(0.55, ' + R(x)') : '') + (land.holes ? at(0.7, ' + B(x)') : ''),
      draw: function (g, p) { g.land(cx.J, { lo: cx.shade.lo, hi: cx.shade.hi, alpha: seg(p, 0, 0.6) }); g.axes(); g.hero(x, cx.hero, seg(p, 0.5, 0.7)); } });
    out.push({ id: 'c', chapter: 'The height', title: 'c, the bottom of the valley', layout: 'map', view: view, dur: 3.4,
      text: 'Here is the valley alone, without ' + (weather ? 'its weather' : 'anything else') + '. c = (c₁, c₂) = ' + pair(c) + ' is its lowest spot: there x − c = 0, so the valley’s height is 0. ' +
        (cOut ? 'This c lies outside the wall, so no lawful spot reaches it. ' : weather ? 'Ripples and pits move the land’s true lowest spot a little away from c. ' : 'With no weather, c is the treasure. ') +
        'The rings around c are spots of equal height, higher and higher outward.',
      math: at(0.6, 'c = ' + pair(c)),
      draw: function (g, p) {
        g.land(valley, vshade); g.axes(); g.hero(x, cx.hero, 1);
        g.ring(val * Math.pow(1 - seg(p, 0.05, 0.6), 2) + 1e-9 * val, C.gold, 2.5, seg(p, 0, 0.1) * (1 - seg(p, 0.6, 0.75)));
        g.dot(c, 6, C.blue, seg(p, 0.55, 0.7)); g.halo(c, 10 + 10 * seg(p, 0.6, 1), C.blue, seg(p, 0.6, 0.7) * (1 - seg(p, 0.85, 1)));
        g.label(c, 'c = ' + pair(c), C.blue, { dx: 10, dy: 14, p: seg(p, 0.65, 0.85) });
      } });
    out.push({ id: 'd', chapter: 'The height', title: 'x − c: from the bottom to ' + who, layout: 'map', view: view, dur: 3.6,
      text: 'Subtract c from x, part by part. The result, x − c = ' + pair(d) + ', is the arrow from the bottom c to ' + who + ': ' +
        num(Math.abs(d[0])) + (d[0] < 0 ? ' to the west' : ' to the east') + ' and ' + num(Math.abs(d[1])) + (d[1] < 0 ? ' to the south.' : ' to the north.'),
      math: 'x − c = (' + at(0.35, num(x[0]) + ' − ' + par(c[0])) + ', ' + at(0.6, num(x[1]) + ' − ' + par(c[1])) + ')' + at(0.85, ' = ' + pair(d)),
      draw: function (g, p) {
        base(g, p);
        var corner = [x[0], c[1]];
        g.line(c, corner, C.violet, 2, seg(p, 0.2, 0.45), [6, 4]); g.label(lerp2(c, corner, 0.5), 'x₁ − c₁ = ' + num(d[0]), C.violet, { dy: 18, dx: -30, p: seg(p, 0.35, 0.5) });
        g.line(corner, x, C.violet, 2, seg(p, 0.45, 0.7), [6, 4]); g.label(lerp2(corner, x, 0.5), 'x₂ − c₂ = ' + num(d[1]), C.violet, { dx: 10, p: seg(p, 0.6, 0.75) });
        g.arrow(c, x, C.gold, 3, seg(p, 0.72, 0.95)); g.label(lerp2(c, x, 0.5), 'x − c', C.gold, { dx: -50, dy: -16, p: seg(p, 0.85, 1) });
      } });
    if (!round) {
      var thDeg = num(P.theta, 0), Lr = 0.42 * (view[1] - view[0]);
      out.push({ id: 'axes', chapter: 'The height', title: 'The valley’s two directions', layout: 'map', view: view, dur: 3.8,
        text: 'This valley is long and narrow. Along its floor, in direction u₁ (θ = ' + thDeg + '° turned from east), it rises slowly: steepness λ₁ = ' + num(l1, 2) + '. ' +
          'Across it, in direction u₂, it rises with steepness λ₂ = ' + num(l2, 2) + ', ' + num(Math.max(l1, l2) / Math.min(l1, l2), 1) + ' times as steep' + (l2 > l1 ? '' : ' the other way') + '. That is why the rings are long ovals: far apart along the valley, close together across it.',
        math: at(0.3, 'u₁ = (cos θ, sin θ) = ' + pair(u1) + ',  λ₁ = ' + num(l1, 2)) + '<br>' + at(0.6, 'u₂ = (−sin θ, cos θ) = ' + pair(u2) + ',  λ₂ = ' + num(l2, 2)),
        draw: function (g, p) {
          base(g, p);
          var t = th * seg(p, 0.1, 0.5), e1 = [Math.cos(t), Math.sin(t)], e2 = [-Math.sin(t), Math.cos(t)], r = Lr;
          g.line(add(c, e1, -r), add(c, e1, r), C.green, 1.5, 1, [8, 6]); g.line(add(c, e2, -r * 0.6), add(c, e2, r * 0.6), C.orange, 1.5, 1, [8, 6]);
          g.arrow(c, add(c, e1, r * 0.55), C.green, 3, seg(p, 0.45, 0.65)); g.arrow(c, add(c, e2, r * 0.35), C.orange, 3, seg(p, 0.55, 0.75));
          g.tipLabel(add(c, e1, r * 0.55), e1, 'u₁: gentle, λ₁ = ' + num(l1, 2), C.green, seg(p, 0.6, 0.8));
          g.tipLabel(add(c, e2, r * 0.35), e2, 'u₂: steep, λ₂ = ' + num(l2, 2), C.orange, seg(p, 0.7, 0.9));
          if (th > 0.01) { var ctx = g.ctx, C0 = g.P(c), rr = 34; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(C0[0], C0[1], rr, -t, 0); ctx.stroke(); g.labelPx(C0[0] + rr + 6, C0[1] - 10, 'θ = ' + thDeg + '°', C.ink, { p: seg(p, 0.4, 0.6), size: 12 }); }
        } });
    }
    var a11 = A[0][0], a12 = A[0][1], a22 = A[1][1], cs = Math.cos(th), sn = Math.sin(th);
    out.push({ id: 'A', chapter: 'The height', title: 'A: the valley’s shape in four numbers', layout: 'map+side', view: view, dur: 4.2,
      text: round ? 'This valley is round: it is equally steep every way, λ₁ = λ₂ = ' + num(l1, 2) + '. Then A = ' + num(l1, 2) + '·I, a table with ' + num(l1, 2) + ' on its diagonal and 0 elsewhere, and the rings are circles.'
        : 'A puts the two directions and their steepness into one table of four numbers, A = λ₁u₁u₁ᵀ + λ₂u₂u₂ᵀ. Its diagonal says how steep the valley is due east (a₁₁) and due north (a₂₂); a₁₂ mixes the two, because the valley runs at a slant. ' +
          'Steeper means closer rings: a circle of the gentle valley is squeezed across into the oval of this one.',
      math: round ? 'A = ' + at(0.5, '[[' + num(a11) + ', ' + num(a12) + '], [' + num(a12) + ', ' + num(a22) + ']]') :
        at(0.3, 'a₁₁ = λ₁cos²θ + λ₂sin²θ = ' + num(l1, 2) + '·' + num(cs * cs) + ' + ' + num(l2, 2) + '·' + num(sn * sn) + ' = ' + num(a11)) + '<br>' +
        at(0.5, 'a₁₂ = (λ₁ − λ₂)·cos θ·sin θ = ' + par(l1 - l2, 2) + '·' + num(cs) + '·' + num(sn) + ' = ' + num(a12)) + '<br>' +
        at(0.7, 'a₂₂ = λ₁sin²θ + λ₂cos²θ = ' + num(l1, 2) + '·' + num(sn * sn) + ' + ' + num(l2, 2) + '·' + num(cs * cs) + ' = ' + num(a22)),
      draw: function (g, p) {
        base(g, p);
        // a ring of the valley through x, from the circle it would be if the valley were gentle every way
        var r1 = Math.sqrt(2 * val / Math.min(l1, l2)), r2 = Math.sqrt(2 * val / Math.max(l1, l2)), sq = seg(p, 0.2, 0.75), pts = [];
        var ua = l1 <= l2 ? u1 : u2, ub = l1 <= l2 ? u2 : u1;
        for (var k = 0; k <= 72; k++) { var t = k / 72 * TAU; pts.push(add(add(c, ua, r1 * Math.cos(t)), ub, mix(r1, r2, sq) * Math.sin(t))); }
        g.path(pts, C.gold, 2.5, 1);
        var R = g.sideR, cells = [[num(a11), num(a12)], [num(a12), num(a22)]];
        g.panel(R, 'A, the valley’s shape');
        var lit = function (r, s) { return seg(p, r === 0 && s === 0 ? 0.25 : r !== s ? 0.45 : 0.65, (r === 0 && s === 0 ? 0.25 : r !== s ? 0.45 : 0.65) + 0.12); };
        g.ctx.font = '600 16px ' + g.sans; g.ctx.fillStyle = C.ink; g.ctx.textAlign = 'right'; g.ctx.textBaseline = 'middle'; g.ctx.fillText('A =', R[0] + 70, R[1] + 66);
        g.matrix(R[0] + 80, R[1] + 42, cells, lit, { size: 15, colOf: function (r, s) { return r === s ? C.gold : C.violet; } });
        var y = R[1] + 118, rows = round ? ['every way: λ = ' + num(l1, 2)] : ['a₁₁: steepness due east', 'a₂₂: steepness due north', 'a₁₂: how east and north mix'];
        rows.forEach(function (t, k) { g.labelPx(R[0] + 14, y + 24 * k, t, k === 2 ? C.violet : C.gold, { p: seg(p, 0.3 + 0.2 * k, 0.45 + 0.2 * k), plain: true, size: 13 }); });
        if (!round) g.labelPx(R[0] + 14, y + 86, 'gentle λ₁ = ' + num(l1, 2) + ' along u₁, steep λ₂ = ' + num(l2, 2) + ' along u₂', C.dim, { p: seg(p, 0.8, 1), plain: true, size: 12 });
      } });
    out.push({ id: 'Ad', chapter: 'The height', title: 'Multiply: A(x − c)', layout: 'map+side', view: view, dur: 4.4,
      text: 'A times x − c gives a new arrow, one row of A at a time. ' + (round ? 'A round valley just scales x − c by λ = ' + num(l1, 2) + '.' :
        'Seen along the valley’s directions, A stretches the part of x − c across the valley by λ₂ = ' + num(l2, 2) + ' and the part along it by λ₁ = ' + num(l1, 2) + ', so the new arrow swings toward the steep direction.'),
      math: 'A(x − c) = (' + at(0.3, num(a11) + '·' + par(d[0]) + ' + ' + par(a12) + '·' + par(d[1])) + ', ' + at(0.5, par(a12) + '·' + par(d[0]) + ' + ' + num(a22) + '·' + par(d[1])) + ')' + at(0.85, ' = ' + pair(Ad)),
      draw: function (g, p) {
        base(g, p);
        g.arrow(c, x, C.gold, 2.5, 1);
        var R = g.sideR; g.panel(R, round ? 'A scales the arrow' : 'What A does to x − c');
        // a small diagram of its own: x − c, its parts along u₁ and u₂, the parts stretched by λ, and their sum
        var pa = scale(u1, a), pb = scale(u2, b), sa = scale(u1, l1 * a), sb = scale(u2, l2 * b), pts = [[0, 0], d, Ad, pa, pb, sa, sb];
        var bx0 = Math.min.apply(null, pts.map(function (v) { return v[0]; })), bx1 = Math.max.apply(null, pts.map(function (v) { return v[0]; }));
        var by0 = Math.min.apply(null, pts.map(function (v) { return v[1]; })), by1 = Math.max.apply(null, pts.map(function (v) { return v[1]; }));
        var mx = Math.min(70, R[2] * 0.2), my = Math.min(44, R[3] * 0.16), inner = [R[0] + mx, R[1] + my, R[2] - 2 * mx, R[3] - my - 26], k = Math.min(inner[2] / Math.max(bx1 - bx0, 1e-9), inner[3] / Math.max(by1 - by0, 1e-9));
        var O = [inner[0] + (inner[2] - (bx1 - bx0) * k) / 2 - bx0 * k, inner[1] + (inner[3] - (by1 - by0) * k) / 2 + by1 * k];
        function Q(v) { return [O[0] + v[0] * k, O[1] - v[1] * k]; }
        function tip(v, text, col, q) { var A0 = Q(v), l = len(v) || 1; g.labelPx(A0[0] + v[0] / l * 12, A0[1] - v[1] / l * 12, text, col, { p: q, size: 12, align: v[0] > 0.3 * l ? 'left' : v[0] < -0.3 * l ? 'right' : 'center' }); }
        var ctx = g.ctx; ctx.strokeStyle = C.faint; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(R[0] + 10, O[1]); ctx.lineTo(R[0] + R[2] - 10, O[1]); ctx.moveTo(O[0], R[1] + 30); ctx.lineTo(O[0], R[1] + R[3] - 8); ctx.stroke();
        g.arrowPx(O, Q(d), C.blue, 2.5); tip(d, 'x − c', C.blue, 1);
        if (!round) {
          var grow = seg(p, 0.35, 0.75), la = scale(u1, a * mix(1, l1, grow)), lb = scale(u2, b * mix(1, l2, grow));
          ctx.globalAlpha = seg(p, 0.1, 0.3) * 0.8; g.arrowPx(O, Q(pa), C.green, 1.5, [4, 3]); g.arrowPx(O, Q(pb), C.orange, 1.5, [4, 3]); ctx.globalAlpha = 1;
          g.arrowPx(O, Q(la), C.green, 2.5); g.arrowPx(O, Q(lb), C.orange, 2.5);
          tip(sa, 'along × λ₁ = ' + num(l1, 2), C.green, seg(p, 0.45, 0.65)); tip(sb, 'across × λ₂ = ' + num(l2, 2), C.orange, seg(p, 0.45, 0.65));
          var s2 = seg(p, 0.75, 0.95);
          if (s2 > 0) { ctx.globalAlpha = s2; ctx.setLineDash([3, 3]); ctx.strokeStyle = C.faint; ctx.beginPath(); ctx.moveTo(Q(sa)[0], Q(sa)[1]); ctx.lineTo(Q(Ad)[0], Q(Ad)[1]); ctx.lineTo(Q(sb)[0], Q(sb)[1]); ctx.stroke(); ctx.setLineDash([]); g.arrowPx(O, Q(Ad), C.gold, 3); ctx.globalAlpha = 1; tip(Ad, 'A(x − c) = ' + pair(Ad), C.gold, s2); }
        } else { var s3 = seg(p, 0.4, 0.9); g.arrowPx(O, Q(scale(d, mix(1, l1, s3))), C.gold, 3); tip(Ad, 'A(x − c) = ' + pair(Ad), C.gold, s3); }
      } });
    out.push({ id: 'dot', chapter: 'The height', title: 'Then (x − c)ᵀ times A(x − c)', layout: 'side', dur: 3.6,
      text: '(x − c)ᵀ is x − c laid on its side, ready to multiply A(x − c) part by part: the first parts together, the second parts together, then add. This is called a dot product, and it gives a single number.',
      math: '(x − c)ᵀA(x − c) = ' + at(0.3, par(d[0]) + '·' + par(Ad[0])) + at(0.55, ' + ' + par(d[1]) + '·' + par(Ad[1])) + at(0.8, ' = ' + num(d[0] * Ad[0]) + ' + ' + par(d[1] * Ad[1]) + ' = ' + num(q)),
      draw: function (g, p) {
        g.bars(g.sideR, [
          { name: 'first parts: ' + num(d[0]) + ' × ' + num(Ad[0]), value: d[0] * Ad[0], col: C.blue },
          { name: 'second parts: ' + num(d[1]) + ' × ' + num(Ad[1]), value: d[1] * Ad[1], col: C.violet },
          { name: '(x − c)ᵀA(x − c)', value: q, col: C.gold }], p, { total: true, title: 'Multiply part by part, then add', nameW: 260, d: 3 });
      } });
    out.push({ id: 'half', chapter: 'The height', title: 'Half of it: the valley’s height', layout: 'map', view: view, dur: 3.2,
      text: 'Halve it: ½·' + num(q) + ' = ' + num(val) + '. That is the valley’s height at x, and every spot on the lit ring has the same height. ' +
        '(The ½ is there so that the slope of the valley comes out as exactly A(x − c), the arrow of the last steps.)',
      math: '½(x − c)ᵀA(x − c) = ½·' + num(q) + at(0.5, ' = ' + num(val)),
      draw: function (g, p) {
        base(g, p, true); g.ring(val, C.gold, 3, seg(p, 0.3, 0.6)); g.hero(x, cx.hero, 1);
        g.label(x, 'valley height ' + num(val), C.gold, { dx: 14, dy: -16, p: seg(p, 0.5, 0.7) });
      } });
    if (!round) {
      var T = Math.max(Math.abs(a), Math.abs(b)) * 1.35 || 1, top = 0.5 * Math.max(l1, l2) * T * T;
      out.push({ id: 'parts', chapter: 'The height', title: 'Why it is a valley', layout: 'side', dur: 4.2,
        text: 'The same number another way. x − c goes a = ' + num(a) + ' along the valley (u₁) and b = ' + num(b) + ' across it (u₂). Each part costs height like a parabola, ½·λ·(part)²: ' +
          'along, ½·' + num(l1, 2) + '·' + par(a) + '² = ' + num(0.5 * l1 * a * a) + '; across, ½·' + num(l2, 2) + '·' + par(b) + '² = ' + num(0.5 * l2 * b * b) + '. ' +
          'Together ' + num(val) + ', as before. A step across the valley costs ' + num(Math.max(l1, l2) / Math.min(l1, l2), 1) + ' times the height of the same step along it.',
        math: '½(λ₁a² + λ₂b²) = ' + at(0.45, num(0.5 * l1 * a * a)) + at(0.7, ' + ' + num(0.5 * l2 * b * b)) + at(0.9, ' = ' + num(val)),
        draw: function (g, p) {
          var R = g.sideR, h2 = (R[3] - 8) / 2, top1 = [R[0], R[1], R[2], h2], bot = [R[0], R[1] + h2 + 8, R[2], h2];
          [[top1, l1, a, C.green, 'along the valley: ½·λ₁·a²', 0.1], [bot, l2, b, C.orange, 'across the valley: ½·λ₂·b²', 0.35]].forEach(function (row) {
            var pl = g.plot(row[0], [-T, T], [0, top], { title: row[4] }), lam = row[1], t1 = row[2], s0 = row[5];
            pl.frame('', ''); pl.curve(function (t) { return 0.5 * lam * t * t; }, row[3], 2, seg(p, s0, s0 + 0.2));
            var tt = t1 * seg(p, s0 + 0.2, s0 + 0.45); pl.point(tt, 0.5 * lam * tt * tt, row[3], seg(p, s0 + 0.2, s0 + 0.3) > 0 ? num(0.5 * lam * tt * tt) : '', seg(p, s0 + 0.2, s0 + 0.3), tt < 0 ? 'left' : 'right');
          });
        } });
    }
  });

  // ------------------------------------------------------------ the weather: ripples, black holes, and the sum
  register('weather', function (cx, out) {
    var land = cx.land, x = cx.x, W = land.weather || {}, rip = land.ripples, hol = land.holes;
    if (rip) {
      var rx = rip.R(x), view = around([x], 0, Math.min(cx.span, 5 * W.L));
      out.push({ id: 'ripples', chapter: 'The weather', title: 'Ripples: R(x)', layout: 'map', view: view, dur: 4.6,
        text: 'Ripples are six waves laid over the land, each running its own way with its own start. Each wave is about L = ' + num(W.L) + ' long (ripple length ' + num(cx.p.ripL, 2) + ' × map width ' + num(cx.span, 2) + ') ' +
          'and together they are about A = ' + num(W.A) + ' high (ripple height ' + num(cx.p.ripA, 2) + ' × the land’s height range ' + num(land.heightRange, 2) + '). At x they add R(x) = ' + num(rx, 4) + '.',
        math: 'R(x) = ' + frac('A', '√6') + '·Σₖ sin(ωₖ·x + φₖ)' + at(0.85, ' = ' + num(rx, 4)),
        draw: function (g, p) {
          g.land(rip.R, { id: 'R', rings: 0, alpha: seg(p, 0.7, 0.95) });
          g.axes();
          var v = g.vis, ctx = g.ctx;
          rip.waves.forEach(function (wv, k) {
            var q = seg(p, 0.05 + k * 0.1, 0.15 + k * 0.1) * (1 - 0.7 * seg(p, 0.7, 0.9)); if (!(q > 0)) return;
            var wl = len(wv.w), n = scale(wv.w, 1 / wl), tdir = [-n[1], n[0]], cen = [(v[0] + v[1]) / 2, (v[2] + v[3]) / 2], reach = (v[1] - v[0]) * 0.8;
            var s0 = dot(cen, n), first = Math.ceil(((s0 - reach) * wl + wv.phi - Math.PI / 2) / TAU), last = Math.floor(((s0 + reach) * wl + wv.phi - Math.PI / 2) / TAU);
            g.clip(g.mapR); ctx.globalAlpha = q * 0.75;
            for (var m = first; m <= last; m++) { var off = (Math.PI / 2 + TAU * m - wv.phi) / wl, base = add(scale(n, off), tdir, dot(cen, tdir)); g.line(add(base, tdir, -reach), add(base, tdir, reach), k % 2 ? C.blue : C.violet, 1.2, 1); }
            ctx.globalAlpha = 1; ctx.restore();
          });
          g.hero(x, cx.hero, 1);
          g.label(x, 'R(x) = ' + num(rx, 4), C.gold, { dx: 14, dy: -16, p: seg(p, 0.85, 1) });
        } });
    }
    if (hol) {
      var bx = hol.B(x), near = hol.at.map(function (q) { return { q: q, d: len(sub(x, q)) }; }).sort(function (a, b) { return a.d - b.d; })[0];
      out.push({ id: 'holes', chapter: 'The weather', title: 'Black holes: B(x)', layout: 'map+side', view: cx.landView, dur: 4.4,
        text: 'Black holes are narrow, deep pits: each is a bell-shaped dip of depth D = ' + num(hol.D, 3) + ' and width w = ' + num(hol.w, 3) + ' at its spot pⱼ. ' +
          'Far from them B is almost 0. The nearest hole is ' + num(near.d) + ' away (' + num(near.d / hol.w, 1) + ' widths), so at x, B(x) = ' + num(bx, 4) + '.',
        math: 'B(x) = −Σⱼ D·exp(−' + frac('|x − pⱼ|²', '2w²') + ')' + at(0.85, ' = ' + num(bx, 4)),
        draw: function (g, p) {
          g.land(cx.J, cx.shade); g.axes();
          hol.at.forEach(function (q, k) { g.halo(q, Math.max(4, hol.w * g.s), C.red, seg(p, 0.1 + 0.1 * k, 0.2 + 0.1 * k), 2); g.halo(q, Math.max(7, 2 * hol.w * g.s), C.red, seg(p, 0.15 + 0.1 * k, 0.25 + 0.1 * k), 1, [3, 3]); });
          g.hero(x, cx.hero, 1); g.line(x, near.q, C.red, 1.5, seg(p, 0.45, 0.65), [5, 4]); g.label(lerp2(x, near.q, 0.5), num(near.d) + ' away', C.red, { dy: -14, p: seg(p, 0.6, 0.75) });
          var R = g.sideR, rmax = Math.max(4 * hol.w, Math.min(near.d * 1.15, 12 * hol.w)), pl = g.plot(R, [0, rmax], [-hol.D * 1.08, hol.D * 0.15], { title: 'one pit, seen from the side' });
          pl.frame('distance from its centre', 'B'); pl.curve(function (r) { return -hol.D * Math.exp(-r * r / (2 * hol.w * hol.w)); }, C.red, 2.2, seg(p, 0.3, 0.6));
          var dd = Math.min(near.d, rmax); pl.point(dd, -hol.D * Math.exp(-dd * dd / (2 * hol.w * hol.w)), cx.hero === 'you' ? C.gold : HERO[cx.hero].col, near.d > rmax ? 'x is farther out' : 'x', seg(p, 0.6, 0.75));
        } });
    }
    var items = cx.parts.slice();
    if (rip) items.push({ name: 'ripples R(x)', value: rip.R(x), col: C.blue });
    if (hol) items.push({ name: 'black holes B(x)', value: hol.B(x), col: C.red });
    if (items.length > 1) {
      items.push({ name: cx.hero === 'tw' ? 'f(x)' : 'J(x)', value: cx.Jx, col: C.ink });
      out.push({ id: 'total', chapter: 'The weather', title: 'Add the parts: the height J(x)', layout: 'side', dur: 3.4,
        text: (cx.hero === 'tw' ? 'Add the parts: the Wanderer’s height at x is f(x) = ' : 'Add the parts: the height at x is J(x) = ') + num(cx.Jx, 4) + '.' + (cx.haze ? ' In this haze nobody can know this number exactly: every tap of the ground carries an error of about σ = ' + num(cx.sigma, 4) + '.' : ''),
        math: (cx.hero === 'tw' ? 'f(x) = ' : 'J(x) = ') + items.slice(0, -1).map(function (it, k) { return at(0.2 + 0.5 * k / items.length, (k ? ' + ' : '') + par(it.value, 4)); }).join('') + at(0.85, ' = ' + num(cx.Jx, 4)),
        draw: function (g, p) { g.bars(g.sideR, items, p, { total: true, title: 'The height, part by part', nameW: 220 }); } });
    }
  });

  // ------------------------------------------------------------ feeling the slope: the staff, the four taps, the slopes
  register('taps', function (cx, out) {
    var x = cx.x, h = cx.h, taps = cx.taps, J = cx.J, land = cx.land, names = ['East', 'West', 'North', 'South'], dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var gT = [(taps[0].J - taps[1].J) / (2 * h), (taps[2].J - taps[3].J) / (2 * h)], mid = (taps[0].J + taps[1].J + taps[2].J + taps[3].J) / 4;
    var who = cx.you ? 'you' : cx.who, has = cx.you ? 'have' : 'has', zoom = cx.zoom;
    function ground(g) { g.land(J, { id: 'J', rings: 9 }); g.axes(); }
    function tapCol(k) { return taps[k].J > mid ? C.orange : C.blue; }
    out.push({ id: 'staff', chapter: 'Feeling the slope', title: 'The staff: h', layout: 'map', view: zoom, dur: 3.4,
      text: 'In the fog nobody can see the land. A hero learns heights only by tapping the ground with a staff, a length h from where it stands: ' +
        'h = staff share × map width = ' + num(cx.p.staff || 0.01, 3) + ' × ' + num(cx.span, 2) + ' = ' + num(h, 4) + '. We zoom in to look closely at the ground around x.',
      math: 'h = ' + num(cx.p.staff || 0.01, 3) + ' × ' + num(cx.span, 2) + ' = ' + at(0.5, num(h, 4)),
      draw: function (g, p) {
        ground(g); g.hero(x, cx.hero, 1);
        g.halo(x, h * g.s, C.gold, seg(p, 0.35, 0.55), 1.5, [5, 4]);
        dirs.forEach(function (dv, k) { g.line(x, add(x, dv, h), C.faint, 1.5, seg(p, 0.45 + 0.08 * k, 0.6 + 0.08 * k)); });
        g.label(add(x, [0.5, 0.5], h * 0.72), 'h = ' + num(h, 4), C.gold, { dx: 8, p: seg(p, 0.7, 0.9) });
      } });
    out.push({ id: 'four', chapter: 'Feeling the slope', title: 'Four taps, four heights', layout: 'map', view: zoom, dur: 4.2,
      text: 'The staff touches the ground four times: east, west, north and south of x, each h away. Each tap gives the height there, worked out with the same formula J. ' +
        (cx.haze ? 'In this haze every tap is off by a random amount of about σ = ' + num(cx.sigma, 4) + ', and nobody can tell by how much. ' : '') +
        'Orange taps are higher than the average of the four, blue ones lower.',
      math: taps.map(function (tp, k) { return at(0.15 + 0.2 * k, names[k] + ' ' + pair(tp.at) + ': J = ' + num(tp.J, 4)); }).join('<br>'),
      draw: function (g, p) {
        ground(g); g.hero(x, cx.hero, 1); g.halo(x, h * g.s, C.faint, 1, 1, [5, 4]);
        taps.forEach(function (tp, k) {
          var s = seg(p, 0.1 + 0.2 * k, 0.25 + 0.2 * k); g.tap(tp.at, C.gold, seg(p, 0.1 + 0.2 * k, 0.35 + 0.2 * k)); g.dot(tp.at, 6, tapCol(k), s);
          g.label(tp.at, names[k] + ' ' + num(tp.J, 4), tapCol(k), { dx: k === 1 ? -110 : 10, dy: k === 2 ? -16 : k === 3 ? 16 : -14, p: s });
        });
      } });
    function slopeStep(id, i1, i2, axis) {
      var a = taps[i1], b = taps[i2], s = (a.J - b.J) / (2 * h), along = axis === 0 ? [1, 0] : [0, 1], nm = axis === 0 ? ['East', 'West'] : ['North', 'South'];
      var line = function (t) { var q = x.slice(); q[axis] = t; return J(q); }, t0 = x[axis], tr = [t0 - 2.6 * h, t0 + 2.6 * h];
      var vs = [], k; for (k = 0; k <= 40; k++) vs.push(line(tr[0] + (tr[1] - tr[0]) * k / 40)); vs.push(a.J, b.J);
      var vlo = Math.min.apply(null, vs), vhi = Math.max.apply(null, vs), pad = (vhi - vlo) * 0.25 || 1e-3;
      var fall = s < 0, dirWord = axis === 0 ? (fall ? 'east' : 'west') : (fall ? 'north' : 'south');
      out.push({ id: id, chapter: 'Feeling the slope', title: nm[0] + ' minus ' + nm[1].toLowerCase() + ': the slope along x' + (axis ? '₂' : '₁'), layout: 'map+side', view: zoom, dur: 4.6,
        text: 'Going from the ' + nm[1].toLowerCase() + ' tap to the ' + nm[0].toLowerCase() + ' tap moves 2h = ' + num(2 * h, 4) + (axis ? ' north' : ' east') + ' and changes the height by J' + (axis ? '<sub>North</sub> − J<sub>South</sub>' : '<sub>East</sub> − J<sub>West</sub>') + ' = ' + num(a.J, 4) + ' − ' + par(b.J, 4) + ' = ' + num(a.J - b.J, 4) + '. ' +
          'Height change over distance is the slope: ' + num(a.J - b.J, 4) + '/' + num(2 * h, 4) + ' = ' + num(s) + '. ' + (Math.abs(s) < 1e-9 ? 'The land is level this way.' : 'The land falls toward the ' + dirWord + '.') +
          (cx.haze ? ' The haze moved the taps off the true ground (the curve), so this slope is a little wrong.' : ''),
        math: '∂J/∂x' + (axis ? '₂' : '₁') + ' ≈ ' + frac('J<sub>' + nm[0] + '</sub> − J<sub>' + nm[1] + '</sub>', '2h') + at(0.45, ' = ' + frac(num(a.J, 4) + ' − ' + par(b.J, 4), num(2 * h, 4))) + at(0.85, ' = ' + num(s)),
        draw: function (g, p) {
          ground(g); g.hero(x, cx.hero, 1);
          g.line(b.at, a.at, C.gold, 2.5, seg(p, 0.05, 0.25)); g.dot(a.at, 6, tapCol(i1), 1); g.dot(b.at, 6, tapCol(i2), 1);
          g.label(a.at, nm[0], tapCol(i1), { dx: 8, dy: -12 }); g.label(b.at, nm[1], tapCol(i2), { dx: axis ? 8 : -50, dy: axis ? 14 : -12 });
          var pl = g.plot(g.sideR, tr, [vlo - pad, vhi + pad], { title: 'the ground along x' + (axis ? '₂' : '₁') + ', seen from the side' });
          pl.frame('x' + (axis ? '₂' : '₁') + ' →', 'J');
          pl.curve(line, C.dim, 1.8, seg(p, 0.05, 0.3));
          pl.point(b.at[axis], b.J, tapCol(i2), nm[1] + ' ' + num(b.J, 4), seg(p, 0.25, 0.35), 'left');
          pl.point(a.at[axis], a.J, tapCol(i1), nm[0] + ' ' + num(a.J, 4), seg(p, 0.35, 0.45), 'right');
          pl.seg(b.at[axis], b.J, a.at[axis], a.J, C.gold, 2.5, seg(p, 0.45, 0.6));
          pl.run(b.at[axis], a.at[axis], Math.min(a.J, b.J) - pad * 0.45, 'run 2h = ' + num(2 * h, 4), C.ink, seg(p, 0.55, 0.7));
          pl.rise(Math.max(a.at[axis], b.at[axis]) + 0.15 * h, b.J, a.J, 'rise ' + num(a.J - b.J, 4), C.ink, seg(p, 0.65, 0.8));
          g.labelPx(pl.box[0] + pl.box[2] / 2, pl.box[1] + 14, 'slope = rise/run = ' + num(s), C.gold, { align: 'center', p: seg(p, 0.85, 1), size: 13 });
        } });
      return s;
    }
    slopeStep('ew', 0, 1, 0); slopeStep('ns', 2, 3, 1);
    var gl = len(gT), k0 = gl > 0 ? 0.32 * 7.2 * h / gl : 1;
    out.push({ id: 'grad', chapter: 'Feeling the slope', title: 'The gradient ∇J: both slopes in one arrow', layout: 'map', view: zoom, dur: 4.4,
      text: 'Put the two slopes together as one arrow, the gradient ∇J ≈ ' + pair(gT) + ': ' + num(Math.abs(gT[0])) + (gT[0] < 0 ? ' westward' : ' eastward') + ' and ' + num(Math.abs(gT[1])) + (gT[1] < 0 ? ' southward' : ' northward') + ', drawn shrunk to fit. ' +
        'It points straight uphill, at right angles to the ring of equal height through x. Its length, ' + num(gl) + ', says how steep the ground is.',
      math: '∇J ≈ (∂J/∂x₁, ∂J/∂x₂) = ' + at(0.75, pair(gT)),
      draw: function (g, p) {
        ground(g); g.ring(cx.Jx, C.ink, 2, seg(p, 0.05, 0.25)); g.hero(x, cx.hero, 1);
        var e1 = add(x, [gT[0] * k0, 0]), tip = add(x, gT, k0);
        g.arrow(x, e1, C.violet, 2.5, seg(p, 0.2, 0.4)); g.label(e1, num(gT[0]), C.violet, { dx: gT[0] < 0 ? -60 : 8, dy: 14, p: seg(p, 0.3, 0.45) });
        g.arrow(e1, tip, C.violet, 2.5, seg(p, 0.4, 0.6)); g.label(lerp2(e1, tip, 0.5), num(gT[1]), C.violet, { dx: 8, p: seg(p, 0.5, 0.65) });
        g.arrow(x, tip, C.orange, 3.5, seg(p, 0.62, 0.85)); g.tipLabel(tip, gT, '∇J, uphill', C.orange, seg(p, 0.8, 1));
        if (gl > 0) g.square(x, scale(gT, 1 / gl), [-gT[1] / gl, gT[0] / gl], 12, C.ink, seg(p, 0.85, 1));
      } });
    // the exact slope: the parts' slopes, tip to tail, beside the taps' arrow
    var parts = cx.gradParts.slice(), gx = cx.gTrue;
    if (land.ripples) parts.push({ name: 'ripples ∇R(x)', vec: land.ripples.grad(x), col: C.blue });
    if (land.holes) parts.push({ name: 'black holes ∇B(x)', vec: land.holes.grad(x), col: C.red });
    var top = Math.max(len(gx), gl, 1e-12), k1 = 0.32 * 7.2 * h / top;
    var tapNote = cx.haze ? 'The taps can differ because haze perturbs every measured height' + (land.ripples || land.holes ? ', and finite spacing also averages the changing slope between the taps.' : '.') :
      (land.ripples || land.holes ? 'The taps can differ because finite spacing averages a slope that changes between the taps.' : 'On this quadratic land, centred taps recover the exact slope; any displayed mismatch is only rounding.');
    out.push({ id: 'exact', chapter: 'Feeling the slope', title: 'The slope, exactly', layout: 'map', view: zoom, dur: 4.4,
      text: 'The formula also gives the slope exactly, with no taps: ' + parts.map(function (q) { return q.name + ' = ' + pair(q.vec); }).join(', ') + (parts.length > 1 ? ', together ' : ': ') + '∇J(x) = ' + pair(gx) + '. ' +
        'The taps said ' + pair(gT) + '. ' + tapNote + ' ' +
        (cx.haze ? 'In this haze the heroes cannot use the formula: they only have their taps.' : cx.you ? 'Your staff only ever gives the taps.' : 'In clear air the heroes use the exact slope.'),
      math: '∇J(x) = ' + parts.map(function (q, k) { return at(0.15 + 0.25 * k, (k ? ' + ' : '') + pair(q.vec)); }).join('') + at(0.8, ' = ' + pair(gx)),
      draw: function (g, p) {
        ground(g); g.hero(x, cx.hero, 1);
        var from = x;
        parts.forEach(function (q, k) { var to = add(from, q.vec, k1), s = seg(p, 0.1 + 0.25 * k, 0.3 + 0.25 * k); g.arrow(from, to, q.col, 2.5, s); from = to; });
        g.arrow(x, add(x, gx, k1), C.ink, 3.5, seg(p, 0.7, 0.9));
        g.arrow(x, add(x, gT, k1), C.orange, 2, seg(p, 0.85, 1), [6, 4]);
        g.legend(parts.map(function (q) { return [q.col, q.name + ' = ' + pair(q.vec)]; }).concat([[C.ink, 'exact ∇J = ' + pair(gx)], [C.orange, 'taps ∇J ≈ ' + pair(gT), [6, 4]]]), seg(p, 0.05, 0.2));
      } });
  });

  // ------------------------------------------------------------ the Pilgrim's stride
  register('pgStride', function (cx, out) {
    var rec = cx.rec; if (!rec) return;
    var x = cx.x, g0 = rec.g, a = cx.p.alpha, stp = scale(g0, -a), raw = rec.raw, nx = rec.x, gl = len(g0), k0 = gl > 0 ? 0.32 * 7.2 * cx.h / gl : 1, land = cx.land;
    out.push({ id: 'down', chapter: 'The stride', title: 'Downhill is −∇J', layout: 'map', view: cx.zoom, dur: 3.2,
      text: 'The gradient points uphill, so the Pilgrim turns the other way: downhill is −∇J = ' + pair(scale(g0, -1)) + '.' + (cx.haze ? ' (In this haze it uses the slope its taps gave.)' : ''),
      math: '−∇J = ' + at(0.6, pair(scale(g0, -1))),
      draw: function (g, p) {
        g.land(cx.J, { id: 'J', rings: 9 }); g.axes(); g.hero(x, 'pg', 1);
        var ang = Math.atan2(g0[1], g0[0]) + Math.PI * seg(p, 0.2, 0.7), dir = [Math.cos(ang), Math.sin(ang)];
        g.arrow(x, add(x, dir, gl * k0), p < 0.7 ? C.orange : C.ink, 3.5, 1); g.tipLabel(add(x, dir, gl * k0), dir, p < 0.7 ? '∇J' : 'downhill, −∇J', p < 0.7 ? C.orange : C.ink, 1);
      } });
    var v2 = around([x, raw, nx], 0.5, 12 * cx.h);
    out.push({ id: 'alpha', chapter: 'The stride', title: 'How far: α times the slope', layout: 'map', view: v2, dur: 3.6,
      text: 'The Pilgrim has no memory and no map. Its stride is always the same share α = ' + num(a) + ' of the slope: −α∇J = −' + num(a) + '·' + pair(g0) + ' = ' + pair(stp) + '. On steep ground the stride is long; on flat ground it is short.',
      math: '−α∇J = −' + num(a) + '·' + pair(g0) + at(0.6, ' = ' + pair(stp)),
      draw: function (g, p) {
        g.land(cx.J, cx.shade); g.axes(); g.hero(x, 'pg', 1);
        g.arrow(x, raw, C.ink, 3.5, seg(p, 0.2, 0.75)); g.label(lerp2(x, raw, 0.55), '−α∇J', C.ink, { dx: 10, dy: -14, p: seg(p, 0.6, 0.8) });
        if (land.box) { var b = land.box; g.path([[b[0], b[0]], [b[1], b[0]], [b[1], b[1]], [b[0], b[1]], [b[0], b[0]]], C.blue, 2, 1); }
      } });
    out.push({ id: 'new', chapter: 'The stride', title: 'The new spot', layout: 'map', view: v2, dur: 3.6,
      text: 'x ← x − α∇J = ' + pair(x) + ' + ' + pair(stp) + ' = ' + pair(raw) + '. ' + (rec.clipped ? 'That spot lies outside the ' + (cx.key === 'wall' ? 'wall' : 'realm') + ', so the Pilgrim is set back to the nearest spot inside, ' + pair(nx) + '. ' : '') +
        'There the height is J = ' + num(rec.J, 4) + ', ' + (rec.J < cx.Jx ? 'down' : 'up') + ' from ' + num(cx.Jx, 4) + '.',
      math: 'x ← x − α∇J = ' + at(0.4, pair(raw)) + (rec.clipped ? at(0.7, ' → set back to ' + pair(nx)) : '') + '<br>' + at(0.85, 'J: ' + num(cx.Jx, 4) + ' → ' + num(rec.J, 4)),
      draw: function (g, p) {
        g.land(cx.J, cx.shade); g.axes();
        if (land.box) { var b = land.box; g.path([[b[0], b[0]], [b[1], b[0]], [b[1], b[1]], [b[0], b[1]], [b[0], b[0]]], C.blue, 2, 1); }
        var m1 = seg(p, 0.1, 0.55), at1 = lerp2(x, raw, m1);
        g.path([x, at1], 'rgba(255,176,113,0.6)', 2.5, 1);
        if (rec.clipped) { var m2 = seg(p, 0.6, 0.8); g.line(raw, nx, C.blue, 2, m2, [5, 4]); g.hero(m2 > 0 ? lerp2(raw, nx, m2) : at1, 'pg', 1); }
        else g.hero(at1, 'pg', 1);
        g.label(x, 'J = ' + num(cx.Jx, 4), C.dim, { dx: 12, dy: 16 });
        g.label(nx, 'J = ' + num(rec.J, 4), C.gold, { dx: 12, dy: -16, p: seg(p, 0.85, 1) });
      } });
    var w = cx.walk, ahead = w.slice(cx.k, Math.min(w.length, cx.k + 9)).map(function (d) { return d.x; });
    if (ahead.length > 2) {
      var turns = 0; for (var j = 2; j < ahead.length; j++) { var s1 = sub(ahead[j - 1], ahead[j - 2]), s2 = sub(ahead[j], ahead[j - 1]); if (dot(s1, s2) < -0.3 * len(s1) * len(s2)) turns++; }
      out.push({ id: 'again', chapter: 'The stride', title: 'And again, day after day', layout: 'map', view: around(ahead, 0.35, 10 * cx.h), dur: 4.2,
        text: 'Tomorrow the Pilgrim starts from the new spot and does it all again: four taps, the slope, one stride. Here are its next ' + (ahead.length - 1) + ' days.' +
          (turns >= 2 ? ' Each stride overshoots the valley’s floor, so the Pilgrim zigzags from side to side: its fixed share α cannot tell a steep side from a long way down.' : ''),
        math: 'x<sub>k+1</sub> = x<sub>k</sub> − α∇J(x<sub>k</sub>)',
        draw: function (g, p) {
          g.land(cx.J, cx.shade); g.axes();
          var n = ahead.length - 1, s = seg(p, 0.05, 0.9) * n, kk = Math.floor(s), f = s - kk;
          g.path(ahead.slice(0, kk + 1).concat(kk < n ? [lerp2(ahead[kk], ahead[kk + 1], ease(f))] : []), C.orange, 2.5, 1);
          ahead.slice(1, kk + 1).forEach(function (q, m) { g.dot(q, 4, C.orange, 1); g.label(q, 'day ' + (cx.k + m + 1), C.dim, { dx: 8, dy: -10, size: 11 }); });
          g.hero(kk < n ? lerp2(ahead[kk], ahead[kk + 1], ease(f)) : ahead[n], 'pg', 1);
        } });
    }
  });

  // ------------------------------------------------------------ your own move
  register('youDown', function (cx, out) {
    var x = cx.x, gT = cx.gTaps, gl = len(gT), k0 = gl > 0 ? 0.32 * 7.2 * cx.h / gl : 1, dn = scale(gT, -1), ang = Math.atan2(dn[1], dn[0]);
    var names = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'], toward = names[Math.round(((ang % TAU) + TAU) % TAU / (Math.PI / 4)) % 8];
    out.push({ id: 'walk', chapter: 'Your move', title: 'Downhill is −∇J: turn and walk', layout: 'map', view: cx.zoom, dur: 3.4,
      text: 'Your taps say the land rises toward ∇J ≈ ' + pair(gT) + ', so downhill is −∇J = ' + pair(dn) + ', toward the ' + toward + '. ' +
        'Turn to face it and walk (W). The slope changes as you go, so feel again (F) every few steps: that is gradient descent, done by hand.',
      math: '−∇J = ' + at(0.6, pair(dn)),
      draw: function (g, p) {
        g.land(cx.J, { id: 'J', rings: 9 }); g.axes(); g.hero(x, 'you', 1);
        var a0 = Math.atan2(gT[1], gT[0]) + Math.PI * seg(p, 0.2, 0.7), dir = [Math.cos(a0), Math.sin(a0)];
        g.arrow(x, add(x, dir, gl * k0), p < 0.7 ? C.orange : C.ink, 3.5, 1); g.tipLabel(add(x, dir, gl * k0), dir, p < 0.7 ? '∇J' : 'downhill: walk this way', p < 0.7 ? C.orange : C.ink, 1);
      } });
  });

  return { register: register, open: open, openSteps: openSteps, onStep: function (f) { stepHook = f; }, go: function (n) { playing = false; playLabel(); go(n); }, close: close, key: key, debug: debug, plan: plan, H: H, Kit: Kit,
           isOpen: function () { return opened; }, onClose: function (f) { closeHook = f; },
           interlude: interlude, endInterlude: function () { endRoad(true); }, onRoad: function () { return !!road; }, onAnyStep: function (f) { watchers.push(f); },
           estimateSeconds: estimateSeconds,
           steps: function () { return steps.map(function (s) { return { id: s.id, chapter: s.chapter, title: s.title, text: s.text, math: s.math, layout: s.layout }; }); } };
})();
