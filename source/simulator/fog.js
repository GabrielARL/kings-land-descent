// The first-person view of kings_land_descent.html: the land seen from a hero's eyes through the fog, drawn the way
// 1990s games drew terrain (one screen column at a time, near to far, each column only growing upward) at 320 x 200
// with square pixels, like Doom.  Figures, taps, arrows and ropes share the land's depth buffer, so hills hide them.
var Fog = (function () {
  'use strict';
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ramp(t, c) {
    t = clamp(t, 0, 1);
    var u = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5, p = t < 0.5 ? c[0] : c[1], q = t < 0.5 ? c[1] : c[2];
    return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u];
  }

  // Smooth value noise, for a faint texture on the ground.
  function hash2(i, j) { var h = Math.imul(i, 374761393) + Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y) {
    var i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    var a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1), top = a + (b - a) * sx;
    return top + (c + (d - c) * sx - top) * sy;
  }

  // ---------------------------------------------------------------- the world: heights and colours on a grid
  // o: { J, view, margin, n, lo, hi, root, relief, ramp: [low, mid, high], box, dark }.  Heights are (J - lo)/(hi - lo),
  // square-rooted when o.root (downhill stays downhill under any rising rescale), kept within +-1.6, times the relief;
  // a black hole goes below lo, so its pit sinks below the rest of the land.  o.dark(x) in [0, 1] paints holes black.
  function World(o) {
    var v = o.view, span = v[1] - v[0], m = (o.margin == null ? 0.6 : o.margin) * span;
    var X0 = v[0] - m, Y0 = v[2] - m, size = span + 2 * m, n = o.n || 320, cell = size / n;
    var H = new Float32Array(n * n), N = new Float32Array(n * n), C = new Uint8ClampedArray(n * n * 3);
    var HZ = (o.relief || 0.22) * span, lo = o.lo, hi = o.hi > o.lo ? o.hi : o.lo + 1;
    var i, j, k;
    for (j = 0; j < n; j++) for (i = 0; i < n; i++) {
      var t = (o.J([X0 + (i + 0.5) * cell, Y0 + (j + 0.5) * cell]) - lo) / (hi - lo);
      t = t >= 0 ? (o.root ? Math.sqrt(t) : t) : -(o.root ? Math.sqrt(-t) : -t);
      if (!(t < 1.6)) t = 1.6; if (t < -1.6) t = -1.6;
      N[j * n + i] = t; H[j * n + i] = t * HZ;
    }
    var L = [-0.45, 0.55, 0.7], ll = Math.sqrt(L[0] * L[0] + L[1] * L[1] + L[2] * L[2]);
    L = [L[0] / ll, L[1] / ll, L[2] / ll];
    var grid = o.grid || span / 10, cs = 1 / 20, box = o.box;
    for (j = 0; j < n; j++) for (i = 0; i < n; i++) {
      k = j * n + i;
      var i0 = i > 0 ? i - 1 : i, i1 = i < n - 1 ? i + 1 : i, j0 = j > 0 ? j - 1 : j, j1 = j < n - 1 ? j + 1 : j;
      var dx = (H[j * n + i1] - H[j * n + i0]) / ((i1 - i0) * cell), dy = (H[j1 * n + i] - H[j0 * n + i]) / ((j1 - j0) * cell);
      var nl = Math.sqrt(dx * dx + dy * dy + 1), shade = 0.48 + 0.62 * Math.max(0, (-dx * L[0] - dy * L[1] + L[2]) / nl);
      var q = N[k] / cs, fq = q - Math.floor(q); if (fq < 0.07) shade *= 0.88 + 0.12 * fq / 0.07;
      var x = X0 + (i + 0.5) * cell, y = Y0 + (j + 0.5) * cell, gx = x / grid, gy = y / grid;
      if (Math.abs(gx - Math.round(gx)) * grid < 0.5 * cell || Math.abs(gy - Math.round(gy)) * grid < 0.5 * cell) shade *= 0.95;
      shade *= 0.92 + 0.1 * (0.6 * vnoise(x * 36 / span, y * 36 / span) + 0.4 * vnoise(x * 140 / span, y * 140 / span));
      if (box && (x < box[0] || x > box[1] || y < box[0] || y > box[1])) shade *= 0.72;
      var c = ramp(clamp(N[k], 0, 1), o.ramp);
      c = [c[0] * shade, c[1] * shade, c[2] * shade];
      if (o.dark) {
        var dk = o.dark([x, y]);
        // black from just inside the lip (about 2w from the centre) down; a thin orange glow on the lip itself
        if (dk > 0.12) { var b = Math.min(1, (dk - 0.12) / 0.3); b = b * b * (3 - 2 * b) * 0.97; c = [c[0] * (1 - b) + 4 * b, c[1] * (1 - b) + 3 * b, c[2] * (1 - b) + 6 * b]; }
        else if (dk > 0.05) { var e = 0.65 * (1 - Math.abs(dk - 0.085) / 0.035); if (e > 0) c = [c[0] + (236 - c[0]) * e, c[1] + (124 - c[1]) * e, c[2] + (20 - c[2]) * e]; }
      }
      C[3 * k] = c[0]; C[3 * k + 1] = c[1]; C[3 * k + 2] = c[2];
    }
    function height(x, y) {
      var fx = clamp((x - X0) / cell - 0.5, 0, n - 1.001), fy = clamp((y - Y0) / cell - 0.5, 0, n - 1.001);
      var a = fx | 0, b = fy | 0, s = fx - a, t = fy - b, kk = b * n + a;
      return (H[kk] * (1 - s) + H[kk + 1] * s) * (1 - t) + (H[kk + n] * (1 - s) + H[kk + n + 1] * s) * t;
    }
    return { X0: X0, Y0: Y0, size: size, n: n, cell: cell, H: H, C: C, span: span, HZ: HZ, height: height };
  }

  // ---------------------------------------------------------------- the renderer
  function Renderer(canvas) {
    this.canvas = canvas; this.W = canvas.width; this.H = canvas.height;
    this.ctx = canvas.getContext('2d');
    this.img = this.ctx.createImageData(this.W, this.H);
    this.zbuf = new Float32Array(this.W * this.H); this.ybuf = new Int32Array(this.W);
    this.scale = this.W / 320;
  }
  // cam: { x, y, heading, pitch, eye, fov, fogStart, fogEnd, fogRGB, skyRGB }
  Renderer.prototype.frame = function (world, cam) {
    var W = this.W, H = this.H, d = this.img.data, zb = this.zbuf, yb = this.ybuf;
    var tanHalf = Math.tan(cam.fov / 2), focal = W / 2 / tanHalf, horizon = H * 0.42 + cam.pitch * H;
    var fx = Math.cos(cam.heading), fy = Math.sin(cam.heading), rx = fy, ry = -fx;
    var eye = world.height(cam.x, cam.y) + cam.eye, fog = cam.fogRGB, fs = cam.fogStart, fe = cam.fogEnd;
    this.world = world;
    this.view = { W: W, H: H, focal: focal, horizon: horizon, fx: fx, fy: fy, rx: rx, ry: ry, cx: cam.x, cy: cam.y, eye: eye,
                  near: world.span * 0.002, fs: fs, fe: fe, fog: fog };
    var c, y, o;
    for (c = 0; c < W; c++) yb[c] = H;
    zb.fill(1e30);
    var Hm = world.H, Cm = world.C, n = world.n, X0 = world.X0, Y0 = world.Y0, cell = world.cell, last = n - 1.001;
    var z = world.span * 0.003, dz = world.span * 0.0011;
    while (z < fe) {
      var w = z * tanHalf, lx = cam.x + fx * z - rx * w, ly = cam.y + fy * z - ry * w, sx = 2 * rx * w / W, sy = 2 * ry * w / W;
      var t = z <= fs ? 0 : (z - fs) / (fe - fs); if (t > 1) t = 1; t = t * t * (3 - 2 * t);
      var inv = focal / z;
      for (c = 0; c < W; c++) {
        if (yb[c] <= 0) continue;
        var gx = (lx + sx * (c + 0.5) - X0) / cell - 0.5, gy = (ly + sy * (c + 0.5) - Y0) / cell - 0.5;
        if (gx < 0) gx = 0; else if (gx > last) gx = last;
        if (gy < 0) gy = 0; else if (gy > last) gy = last;
        var a = gx | 0, b = gy | 0, s = gx - a, u = gy - b, k = b * n + a;
        var h = (Hm[k] * (1 - s) + Hm[k + 1] * s) * (1 - u) + (Hm[k + n] * (1 - s) + Hm[k + n + 1] * s) * u;
        var top = ((eye - h) * inv + horizon) | 0;
        if (top < yb[c]) {
          var k3 = 3 * k, w00 = (1 - s) * (1 - u), w10 = s * (1 - u), w01 = (1 - s) * u, w11 = s * u, n3 = 3 * n;
          var cr = Cm[k3] * w00 + Cm[k3 + 3] * w10 + Cm[k3 + n3] * w01 + Cm[k3 + n3 + 3] * w11;
          var cg = Cm[k3 + 1] * w00 + Cm[k3 + 4] * w10 + Cm[k3 + n3 + 1] * w01 + Cm[k3 + n3 + 4] * w11;
          var cb = Cm[k3 + 2] * w00 + Cm[k3 + 5] * w10 + Cm[k3 + n3 + 2] * w01 + Cm[k3 + n3 + 5] * w11;
          var r = cr + (fog[0] - cr) * t, g = cg + (fog[1] - cg) * t, bl = cb + (fog[2] - cb) * t;
          var y0 = top < 0 ? 0 : top;
          for (y = y0; y < yb[c]; y++) { o = y * W + c; var o4 = o << 2; d[o4] = r; d[o4 + 1] = g; d[o4 + 2] = bl; d[o4 + 3] = 255; zb[o] = z; }
          yb[c] = y0;
        }
      }
      z += dz; dz *= 1.0072;
    }
    var sky = cam.skyRGB;
    for (c = 0; c < W; c++) for (y = 0; y < yb[c]; y++) {
      var v = clamp((horizon - y) / (H * 0.55), 0, 1); v = Math.sqrt(v);
      o = (y * W + c) << 2;
      d[o] = fog[0] + (sky[0] - fog[0]) * v; d[o + 1] = fog[1] + (sky[1] - fog[1]) * v; d[o + 2] = fog[2] + (sky[2] - fog[2]) * v; d[o + 3] = 255;
    }
  };
  Renderer.prototype.fogT = function (z) {
    var v = this.view, t = z <= v.fs ? 0 : (z - v.fs) / (v.fe - v.fs); if (t > 1) t = 1;
    return t * t * (3 - 2 * t);
  };
  // A point of the world at height h (world units) on the screen: [x, y, depth], or null behind the eye.
  Renderer.prototype.project = function (x, y, h) {
    var v = this.view, dx = x - v.cx, dy = y - v.cy, z = dx * v.fx + dy * v.fy;
    if (z < v.near) return null;
    var s = dx * v.rx + dy * v.ry;
    return [v.W / 2 + s * v.focal / z, v.horizon + (v.eye - h) * v.focal / z, z];
  };
  Renderer.prototype.ground = function (x, y, lift) { return this.project(x, y, this.world.height(x, y) + (lift || 0) * this.world.span); };
  // One pixel, hidden by nearer land, faded by the fog.
  Renderer.prototype.plot = function (x, y, z, rgb, a) {
    var W = this.W; x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= W || y >= this.H) return false;
    var o = y * W + x;
    if (z > this.zbuf[o] * 1.02 + this.view.near * 2) return false;
    var t = this.fogT(z), fog = this.view.fog, d = this.img.data, o4 = o << 2;
    if (a == null) a = 1;
    a *= 1 - t * 0.85;
    d[o4] += (rgb[0] + (fog[0] - rgb[0]) * t - d[o4]) * a;
    d[o4 + 1] += (rgb[1] + (fog[1] - rgb[1]) * t - d[o4 + 1]) * a;
    d[o4 + 2] += (rgb[2] + (fog[2] - rgb[2]) * t - d[o4 + 2]) * a;
    return true;
  };
  Renderer.prototype.segment = function (p, q, rgb, width, a) {
    var dx = q[0] - p[0], dy = q[1] - p[1], n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))) || 1;
    if (n > 2000) return;
    var w = Math.max(1, Math.round((width || 1) * Math.max(1, this.scale * 0.7))), half = (w - 1) / 2;
    for (var i = 0; i <= n; i++) {
      var t = i / n, x = p[0] + dx * t, y = p[1] + dy * t, z = p[2] + (q[2] - p[2]) * t;
      for (var ox = 0; ox < w; ox++) for (var oy = 0; oy < w; oy++) this.plot(x + ox - half, y + oy - half, z, rgb, a);
    }
  };
  // A path that follows the ground between successive points; dash skips every other piece.
  Renderer.prototype.groundPath = function (pts, rgb, width, lift, a, dash) {
    var span = this.world.span, piece = 0;
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i - 1], q = pts[i], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      var m = Math.max(1, Math.min(400, Math.ceil(len / (span / 260)))), prev = this.ground(p[0], p[1], lift);
      for (var s = 1; s <= m; s++) {
        var x = p[0] + (q[0] - p[0]) * s / m, y = p[1] + (q[1] - p[1]) * s / m, cur = this.ground(x, y, lift);
        if (prev && cur && (!dash || (piece++ % 2 === 0))) this.segment(prev, cur, rgb, width, a);
        prev = cur;
      }
    }
  };
  Renderer.prototype.post = function (x, y, height, rgb, width, a) {
    var g = this.world.height(x, y), p = this.project(x, y, g), q = this.project(x, y, g + height * this.world.span);
    if (p && q) this.segment(p, q, rgb, width, a);
    return q;
  };
  Renderer.prototype.ring = function (x, y, r, rgb, width, lift, a, dash) {
    var pts = [];
    for (var i = 0; i <= 72; i++) pts.push([x + r * Math.cos(i * Math.PI / 36), y + r * Math.sin(i * Math.PI / 36)]);
    this.groundPath(pts, rgb, width, lift, a, dash);
  };
  Renderer.prototype.arrow = function (from, to, rgb, width, lift, a) {
    var dx = to[0] - from[0], dy = to[1] - from[1], len = Math.hypot(dx, dy);
    if (len < 1e-9) return;
    this.groundPath([from, to], rgb, width, lift, a);
    var h = Math.min(len * 0.35, this.world.span * 0.025), ux = dx / len, uy = dy / len;
    this.groundPath([to, [to[0] - h * (ux * 0.87 - uy * 0.5), to[1] - h * (uy * 0.87 + ux * 0.5)]], rgb, width, lift, a);
    this.groundPath([to, [to[0] - h * (ux * 0.87 + uy * 0.5), to[1] - h * (uy * 0.87 - ux * 0.5)]], rgb, width, lift, a);
  };
  // A pixel-art figure standing at (x, y), worldH tall (a share of the map's width).  Returns where its head is.
  Renderer.prototype.sprite = function (x, y, pattern, palette, worldH, lift, a) {
    var g = this.world.height(x, y) + (lift || 0) * this.world.span;
    var foot = this.project(x, y, g), head = this.project(x, y, g + worldH * this.world.span);
    if (!foot || !head) return null;
    if (foot[2] < 0.012 * this.world.span) return null;
    var rows = pattern.length, cols = pattern[0].length, pix = Math.min((foot[1] - head[1]) / rows, 24);
    if (pix < 0.25) { this.plot(foot[0], foot[1] - 1, foot[2], palette[pattern[Math.floor(rows / 2)][Math.floor(cols / 2)]] || palette.o, a); return { x: foot[0], y: head[1], z: foot[2] }; }
    var x0 = foot[0] - cols * pix / 2, y0 = head[1];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var ch = pattern[r].charAt(c); if (ch === '.') continue;
      var rgb = palette[ch]; if (!rgb) continue;
      var xa = x0 + c * pix, ya = foot[1] - (rows - r) * pix, xb = xa + pix, yb = ya + pix;
      var pxa = Math.max(0, Math.floor(xa)), pxb = Math.min(this.W, Math.max(Math.floor(xa) + 1, Math.ceil(xb)));
      var pya = Math.max(0, Math.floor(ya)), pyb = Math.min(this.H, Math.max(Math.floor(ya) + 1, Math.ceil(yb)));
      for (var py = pya; py < pyb; py++) for (var px = pxa; px < pxb; px++) this.plot(px, py, foot[2], rgb, a);
    }
    return { x: foot[0], y: foot[1] - rows * pix, z: foot[2] };
  };
  // Something held in the hands, drawn over everything at the bottom of the screen.
  Renderer.prototype.hand = function (pattern, palette, cx, bottom, pix) {
    var d = this.img.data, W = this.W, rows = pattern.length, cols = pattern[0].length;
    var x0 = Math.round(cx - cols * pix / 2), y0 = Math.round(bottom - rows * pix);
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var ch = pattern[r].charAt(c); if (ch === '.') continue;
      var rgb = palette[ch]; if (!rgb) continue;
      for (var py = 0; py < pix; py++) for (var px = 0; px < pix; px++) {
        var x = x0 + c * pix + px, y = y0 + r * pix + py;
        if (x < 0 || y < 0 || x >= W || y >= this.H) continue;
        var o = (y * W + x) << 2; d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2];
      }
    }
  };
  Renderer.prototype.screenLine = function (p, q, rgb, width) {
    var d = this.img.data, W = this.W, dx = q[0] - p[0], dy = q[1] - p[1], n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))) || 1;
    for (var i = 0; i <= n; i++) {
      var x = Math.round(p[0] + dx * i / n), y = Math.round(p[1] + dy * i / n);
      for (var ox = 0; ox < (width || 1); ox++) {
        var xx = x + ox; if (xx < 0 || y < 0 || xx >= W || y >= this.H) continue;
        var o = (y * W + xx) << 2; d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2];
      }
    }
  };
  // Whether a point drawn at depth z at this pixel is in front of the land (for labels drawn on top).
  Renderer.prototype.seen = function (x, y, z) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return false;
    return z <= this.zbuf[y * this.W + x] * 1.03 + this.view.near * 2 && this.fogT(z) < 0.9;
  };
  Renderer.prototype.present = function () { this.ctx.putImageData(this.img, 0, 0); };
  // The first row in column c, between r0 and r1, where land nearer than depth z hides what stands behind it.
  Renderer.prototype.occluder = function (c, r0, r1, z) {
    var W = this.W, zb = this.zbuf, lim = z * 0.985 - this.view.near;
    for (var r = r0; r <= r1; r++) if (zb[r * W + c] < lim) return r;
    return r1 + 6;
  };

  // ---------------------------------------------------------------- figures (9 x 14) and things held in the hand
  var FIGURES = {
    pilgrim: ['...ddd...', '..ooooo..', '..owwwo..', '..owwwo.s', '...ooo..s', '..ooooo.s', '.ooooooos', '.ooooooos',
              '..ooooo.s', '..ooooo.s', '..oo.oo.s', '..oo.oo.s', '..dd.dd.s', '.........'],
    cartographer: ['..ddddd..', '.ddddddd.', '..wwwww..', '..wwwww..', '...www...', '..ooooo..', '.ooobbbo.', '.ooobbbo.',
                   '..ooooo..', '..ooooo..', '..oo.oo..', '..oo.oo..', '..dd.dd..', '.........'],
    wanderer: ['...ooo...', '..ooooo..', '..owwwo..', '..owwwo..', '...ooo...', '..ooooo..', '.ooooooo.', '.ooorroo.',
               '..oorro..', '..ooooo..', '..oo.oo..', '..oo.oo..', '..oo.oo..', '.........'],
    warden: ['.ooooooo.', '...www...', '..wwwww..', '..w.w.w..', '...www...', '..o.o.o..', '.o.o.o.o.', '..o.o.o..',
             '.o.o.o.o.', '..o.o.o..', '..o...o..', '..o...o..', '..o...o..', '.........'],
    king: ['.r.r.r.r.', '.rrrrrrr.', '..wwwww..', '..wwwww..', '...www...', '.ooooooo.', 'ooooooooo', 'oorooooro',
           '.ooooooo.', '.ooooooo.', '..oo.oo..', '..oo.oo..', '..dd.dd..', '.........'],
    star: ['....r....', '...rrr...', 'rrrrrrrrr', '.rrrrrrr.', '..rrrrr..', '.rrr.rrr.', '.rr...rr.', '.........'],
    lantern: ['..kkk..', '.rrrrr.', '.rwwwr.', '.rwwwr.', '.rrrrr.', '..kkk..', '...k...', '...k...', '...k...',
              '...k...', '...k...', '...k...', '..kkk..'],
    flag: ['kwwww...', 'kwwwwww.', 'kwwww...', 'k.......', 'k.......', 'k.......', 'k.......', 'k.......', 'kk......']
  };
  var HANDS = {
    staff: ['..........s.', '.........s..', '........s...', '.......s....', '......s.....', '.....s......', '....s.......',
            '...gs.......', '..ggg.......', '.gggg.......', 'ggggg.......', 'gggg........'],
    journal: ['..bbbbbbbbbbbbbb..', '.bwwwwwwbwwwwwwwb.', '.bwkkkkwbwkkkkkwb.', '.bwwwwwwbwwwwwwwb.', '.bwkkkkwbwkkkwwwb.',
              '.bwwwwwwbwwwwwwwb.', '.bwkkkwwbwkkkkkwb.', '.bwwwwwwbwwwwwwwb.', '..bbbbbbbbbbbbbb..', 'gg..............gg',
              'ggg............ggg'],
    rope: ['....rrrr....', '..rr....rr..', '.r..rrrr..r.', 'r..r....r..r', 'r..r....r..r', '.r..rrrr..r.', '..rr....rr..',
           '....rrrr....', '...gggggg...', '..gggggggg..']
  };
  return { World: World, Renderer: Renderer, FIGURES: FIGURES, HANDS: HANDS, ramp: ramp };
})();
if (typeof module !== 'undefined') module.exports = Fog;
