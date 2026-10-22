// The game of kings_land_descent.html.  You are the King's apprentice, free to walk his land in the fog among the
// heroes.  Talk to them to hear how each one reckons a day's step and to change how they walk, ask the King for
// another land or other weather, or follow a hero and watch its days: the Pilgrim's four taps and
// gradient, the Cartographer's journal pages and trial strides, the Twins' rope, Warden and ledger.
var Game = (function () {
  'use strict';
  var TAU = 2 * Math.PI, E = window.Engine;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function wrapAngle(a) { return ((a + Math.PI) % TAU + TAU) % TAU - Math.PI; }
  function lerpAngle(a, b, t) { return a + wrapAngle(b - a) * t; }
  function num(v, d) {
    if (v == null || !isFinite(v)) return '—';
    var s = v.toFixed(d == null ? 3 : d);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    return s.replace('-', '−');
  }
  function pair(v, d) { return '(' + num(v[0], d) + ', ' + num(v[1], d) + ')'; }
  function heading(v) { return Math.atan2(v[1], v[0]); }
  function bearing(a) { var deg = ((90 - a * 180 / Math.PI) % 360 + 360) % 360; return Math.round(deg); }
  function compass(a) {
    var names = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
    return names[Math.round(((a % TAU) + TAU) % TAU / (Math.PI / 4)) % 8];
  }
  function strideName(s) {
    var j = Math.round(-Math.log(s) / Math.LN2);
    return j === 0 ? '1' : j === 1 ? '½' : j === 2 ? '¼' : j === 3 ? '⅛' : '1/' + Math.pow(2, j);
  }
  function along(path, t) {
    if (!path || path.length < 2) return path ? path[path.length - 1] : null;
    var total = 0, i, segs = [];
    for (i = 1; i < path.length; i++) { var l = dist(path[i - 1], path[i]); segs.push(l); total += l; }
    if (total < 1e-15) return path[path.length - 1];
    var goal = t * total;
    for (i = 0; i < segs.length; i++) { if (goal <= segs[i] || i === segs.length - 1) return lerp(path[i], path[i + 1], segs[i] ? clamp(goal / segs[i], 0, 1) : 1); goal -= segs[i]; }
    return path[path.length - 1];
  }

  // How a day is cut into phases, as fractions of the day; "preview" is the pose shown while time stands still.
  var PHASES = {
    pg: { names: ['feel', 'reckon', 'turn', 'stride'], ends: [0.36, 0.5, 0.6, 1], preview: 0.48 },
    lb: { names: ['feel', 'journal', 'trials', 'turn', 'stride'], ends: [0.28, 0.44, 0.62, 0.7, 1], preview: 0.6 },
    tw: { names: ['anchor', 'walk', 'warden', 'ledger'], ends: [0.14, 0.55, 0.75, 1], preview: 0.13 }
  };
  function phaseOf(h, f) {
    var P = PHASES[h], start = 0;
    for (var i = 0; i < P.names.length; i++) {
      if (f < P.ends[i] || i === P.names.length - 1) return { name: P.names[i], u: clamp((f - start) / (P.ends[i] - start), 0, 1) };
      start = P.ends[i];
    }
  }
  var NAMES = { pg: 'the Pilgrim', lb: 'the Cartographer', tw: 'the Wanderer', wd: 'the Warden', king: 'the King' };
  var TITLES = { pg: 'The Pilgrim', lb: 'The Cartographer', tw: 'The Wanderer', wd: 'The Warden', king: 'The King', you: 'You' };

  function create(api) {
    var screen = $('fog-screen'), over = $('fog-overlay'), wrap = $('fog-wrap');
    var R = new Fog.Renderer(screen), octx = over.getContext('2d'), quality = 'refined';
    try { quality = localStorage.getItem('kings-land-quality') || 'refined'; } catch (e) { /* storage unavailable */ }
    // Refined draws about one land pixel per screen pixel; Balanced fewer; Retro is 320 x 200 with square pixels, like Doom.
    function ensureRenderer() {
      var css = screen.clientWidth || 640, W = quality === 'retro' ? 320 : quality === 'balanced' ? Math.min(640, css) : Math.min(960, Math.round(css * Math.min(window.devicePixelRatio || 1, 1.25)));
      W = Math.max(240, Math.round(W / 2) * 2); var H = Math.round(W * (screen.clientHeight && screen.clientWidth ? screen.clientHeight / screen.clientWidth : 10 / 16));
      if (screen.width !== W || screen.height !== H) { screen.width = W; screen.height = H; R = new Fog.Renderer(screen); }
      screen.classList.toggle('retro', quality === 'retro');
    }
    var world = null, worldFor = null, worldTheme = '', heads = null, landKey = null;
    var player = { x: 0, y: 0, heading: 0 }, look = { yaw: 0, pitch: 0 };
    var ride = null, keys = {}, felt = null, dialog = null, reveal = false, found = false, fogDist = 0.6, showCaptions = true;
    var labels = [], running = false, visible = true, lastFrame = 0, toast = null, calm = false, worldQuality = null;

    function span() { var v = api.model().L.view; return v[1] - v[0]; }
    function rgb(name) { return api.rgb(name); }

    // ------------------------------------------------------------ the world and the heroes' headings
    function rebuild() {
      var m = api.model(), land = m.land, v = m.L.view, vals = [], n = 36;
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) vals.push(land.J([v[0] + (v[1] - v[0]) * i / (n - 1), v[2] + (v[3] - v[2]) * j / (n - 1)]));
      vals.sort(function (a, b) { return a - b; });
      var lo = land.holes ? land.floor : Math.min(m.Jlow, vals[0]), hi = vals[Math.floor(0.85 * vals.length)];
      world = Fog.World({ J: land.J, view: v, margin: 0.55, n: quality === 'retro' ? (land.holes ? 320 : 260) : quality === 'balanced' ? 380 : 480, lo: lo, hi: hi, root: true, relief: 0.16,
                          ramp: [[62, 108, 158], [212, 218, 210], [198, 124, 66]], box: land.box ? [land.box[0], land.box[1]] : null,
                          dark: land.holes ? land.holes.depth : null });
      heads = {};
      ['pg', 'lb', 'tw'].forEach(function (h) {
        var w = m.walks[h], hd = [], prev = null;
        for (var j = 1; j < w.length; j++) {
          var dir = h === 'pg' ? [-w[j].g[0], -w[j].g[1]] : [w[j].x[0] - w[j - 1].x[0], w[j].x[1] - w[j - 1].x[1]];
          hd[j] = Math.hypot(dir[0], dir[1]) > 1e-12 ? heading(dir) : (prev == null ? 0 : prev);
          prev = hd[j];
        }
        hd[0] = hd.length > 1 ? hd[1] : heading([land.treasure[0] - m.x0[0], land.treasure[1] - m.x0[1]]);
        heads[h] = hd;
      });
      if (landKey !== m.key) { landKey = m.key; placePlayer(); reveal = false; found = false; }
      clampPlayer();
      worldFor = m; worldTheme = api.themeKey();
    }
    // On a boxed land the Cartographer walks on a stretched map (x = lo + w(1 + tanh t)/2); straight downhill on that map
    // is -D^2 grad J on the land, D the map's stretch, so it leans away from the edges even with an empty journal.
    function mapDownhill(x, g) {
      var b = api.model().land.box;
      if (!b) return [-g[0], -g[1]];
      var w = b[1] - b[0];
      return [0, 1].map(function (i) { var u = clamp(2 * (x[i] - b[0]) / w - 1, -0.99, 0.99), d = w / 2 * (1 - u * u); return -g[i] * d * d; });
    }
    function degrees(a, b) { return Math.round(Math.abs(wrapAngle(a - b)) * 180 / Math.PI); }
    function hdAt(h, j) { var hd = heads[h]; return hd[clamp(j, 0, hd.length - 1)]; }
    function placePlayer() {
      var m = api.model(), v = m.L.view, c = [(v[0] + v[1]) / 2, (v[2] + v[3]) / 2], s = m.x0, d = [c[0] - s[0], c[1] - s[1]], dn = Math.hypot(d[0], d[1]) || 1;
      player.x = s[0] - 0.12 * span() * d[0] / dn - 0.05 * span() * d[1] / dn; player.y = s[1] - 0.12 * span() * d[1] / dn + 0.05 * span() * d[0] / dn; player.heading = heading(d) - 0.25;
      clampPlayer(); inRealm();
    }
    function clampPlayer() { var v = api.model().L.view; player.x = clamp(player.x, v[0], v[1]); player.y = clamp(player.y, v[2], v[3]); }
    // On the tower lands only the cards' box is land to stand on; the apprentice starts inside it.
    function inRealm() { if (api.model().L.kind === 'tower') { player.x = clamp(player.x, -0.95, 0.95); player.y = clamp(player.y, -0.95, 0.95); } }
    function kingAt() { var m = api.model(), s = m.x0, sp = span(), v = m.L.view; return [clamp(s[0] + 0.05 * sp, v[0], v[1]), clamp(s[1] + 0.035 * sp, v[2], v[3])]; }

    // ------------------------------------------------------------ where everyone is on day k, a fraction f into the next
    function clock() { var t = api.time(); return { k: t.day, f: t.f }; }
    function fOf(h, t) { return t.f == null ? PHASES[h].preview : t.f; }
    function pose(h, k, f) {
      var m = api.model(), w = m.walks[h], here = w[Math.min(k, w.length - 1)], rec = k + 1 < w.length ? w[k + 1] : null;
      var o = { h: h, k: k, f: f, here: here, rec: rec, pos: here.x, heading: hdAt(h, Math.max(k, 0)) };
      if (h === 'tw') { o.z = here.z; o.led = here.u; }
      if (!rec) { o.phase = 'rest'; o.u = 0; return o; }
      var ph = phaseOf(h, f), h0 = hdAt(h, k), h1 = hdAt(h, k + 1);
      o.phase = ph.name; o.u = ph.u;
      if (h === 'pg' || h === 'lb') {
        o.heading = ph.name === 'turn' ? lerpAngle(h0, h1, ease(ph.u)) : ph.name === 'stride' ? h1 : h0;
        if (ph.name === 'stride') {
          var u = ease(ph.u);
          o.pos = h === 'pg' && rec.clipped ? (u < 0.75 ? lerp(here.x, rec.raw, u / 0.75) : lerp(rec.raw, rec.x, (u - 0.75) / 0.25)) : lerp(here.x, rec.x, u);
        }
      } else {
        var lookBack = function (r) { return r && r.z && dist(r.x, r.z) > 0.002 * span() ? heading([r.z[0] - r.x[0], r.z[1] - r.x[1]]) : null; };
        var endPrev = lookBack(k >= 1 ? w[k] : null), toWarden = lookBack(rec);
        o.heading = ph.name === 'anchor' ? lerpAngle(endPrev == null ? h0 : endPrev, h1, ease(ph.u))
          : ph.name === 'warden' && toWarden != null ? lerpAngle(h1, toWarden, ease(ph.u)) : ph.name === 'ledger' && toWarden != null ? toWarden : h1;
        if (ph.name === 'walk') o.pos = along(rec.path, ease(ph.u));
        else if (ph.name !== 'anchor') o.pos = rec.x;
        o.z = ph.name === 'warden' ? lerp(rec.zFrom, rec.z, ease(ph.u)) : ph.name === 'ledger' ? rec.z : here.z;
        o.led = ph.name === 'ledger' ? lerp(rec.uFrom, rec.u, ease(ph.u)) : here.u;
      }
      return o;
    }

    // ------------------------------------------------------------ drawing the world
    function tag(x, y, lift, text, colour, size) {
      var p = R.project(x, y, world.height(x, y) + lift * world.span);
      if (p) labels.push({ p: p, text: text, colour: colour, size: size || 12 });
    }
    function pal(h) {
      var face = [236, 224, 206], ink = rgb('twin');
      if (h === 'pg') return { o: rgb('orange'), d: shade(rgb('orange'), 0.7), w: face, s: [86, 62, 40] };
      if (h === 'lb') return { o: rgb('blue'), d: shade(rgb('blue'), 0.7), w: face, b: [250, 250, 248] };
      if (h === 'tw') return { o: ink, w: face, r: rgb('orange') };
      if (h === 'wd') return { o: rgb('blue'), w: face };
      if (h === 'king') return { o: rgb('orange'), d: shade(rgb('orange'), 0.7), w: face, r: [214, 150, 30] };
      if (h === 'star') return { r: rgb('orange') };
      if (h === 'lantern') return { k: ink, r: rgb('orange'), w: [255, 228, 150] };
      return { k: ink, w: [250, 250, 248] };
    }
    function shade(c, s) { return [c[0] * s, c[1] * s, c[2] * s]; }
    function near(pt, r) { var c = R.view; return Math.hypot(pt[0] - c.cx, pt[1] - c.cy) < r * world.span; }

    function drawLaw(m) {
      var land = m.land, blue = rgb('blue'), orange = rgb('orange');
      if (land.box && land.kind === 'quad') {
        var b = land.box, edge = [[b[0], b[0]], [b[1], b[0]], [b[1], b[1]], [b[0], b[1]], [b[0], b[0]]];
        R.groundPath(edge, blue, 2, 0.004, 0.95);
        var step = (b[1] - b[0]) / 10;
        for (var i = 0; i <= 10; i++) {
          [[b[0] + i * step, b[0]], [b[0] + i * step, b[1]], [b[0], b[0] + i * step], [b[1], b[0] + i * step]].forEach(function (q) { if (near(q, 0.9)) R.post(q[0], q[1], 0.018, blue, 2, 0.9); });
        }
      }
      if (land.kind === 'tower') {
        var s = land.lawSegment;
        R.groundPath([s[0], s[1]], blue, 3, 0.004, 0.9);
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (q) {
          var ok = q[0] * q[1] === land.lawSign, top = R.post(q[0], q[1], 0.07, ok ? blue : orange, 3, 1);
          if (top) tag(q[0], q[1], 0.08, (q[0] > 0 ? '+' : '−') + (q[1] > 0 ? '+' : '−') + (ok ? ' lawful' : ' broken'), ok ? 'blue' : 'orange', 12);
        });
        var y = land.y, ly = [clamp(y[0], -1.15, 1.15), clamp(y[1], -1.15, 1.15)];
        sprites.push({ at: ly, fig: Fog.FIGURES.lantern, pal: pal('lantern'), hgt: 0.04, name: 'lanterns', colour: 'orange' });
      }
      var T = land.treasure;
      if (reveal) R.post(T[0], T[1], 0.25, orange, 2, 0.8);
      sprites.push({ at: T, fig: Fog.FIGURES.star, pal: pal('star'), hgt: 0.02, lift: 0.006, name: m.L.kind === 'tower' ? 'true order' : 'treasure', colour: 'orange', always: reveal });
      sprites.push({ at: m.x0, fig: Fog.FIGURES.flag, pal: pal('flag'), hgt: 0.026, name: 'start', colour: 'ink' });
      sprites.push({ at: kingAt(), fig: Fog.FIGURES.king, pal: pal('king'), hgt: 0.042, name: 'the King', colour: 'orange', who: 'king' });
    }

    function drawTaps(rec, pos, u, colour, h) {
      if (!rec || !rec.taps) return;
      var shownTaps = Math.min(4, Math.floor(u * 4) + 1), dirs = ['E', 'W', 'N', 'S'];
      for (var i = 0; i < shownTaps; i++) {
        var tp = rec.taps[i].at, live = i === shownTaps - 1 && u < 1;
        R.groundPath([pos, tp], colour, 1, 0.002, 0.7);
        R.post(tp[0], tp[1], live ? 0.03 : 0.02, colour, live ? 3 : 2, 1);
        if (near(tp, 0.3)) tag(tp[0], tp[1], 0.034, dirs[i] + ' ' + num(rec.taps[i].J, 3), h, 11);
      }
    }
    function gradArrows(pos, g, alpha, colourUp, colourDown, h, label) {
      var gn = Math.hypot(g[0], g[1]); if (gn < 1e-12) return;
      var sp = world.span, upLen = 0.06 * sp, down = alpha * gn, downLen = clamp(down, 0.07 * sp, 0.35 * sp);
      var up = [pos[0] + g[0] / gn * upLen, pos[1] + g[1] / gn * upLen], dn = [pos[0] - g[0] / gn * downLen, pos[1] - g[1] / gn * downLen];
      R.arrow(pos, up, rgb('orange'), 2, 0.006, 0.9);
      R.arrow(pos, dn, colourDown, 3, 0.006, 1);
      if (near(pos, 0.4)) {
        tag(up[0], up[1], 0.02, '∇J uphill', 'orange', 11);
        tag(dn[0], dn[1], 0.02, label || ('−α∇J, ' + num(down, 3)), h, 11);
      }
    }

    function drawPilgrim(t, riding) {
      var m = api.model(), o = pose('pg', t.k, fOf('pg', t)), rec = o.rec, c = rgb('orange');
      trail('pg', t.k, o.pos, c);
      if (rec && !calm && (!ride || riding)) {
        var ph = o.phase;
        drawTaps(rec, o.here.x, ph === 'feel' ? o.u : 1, c, 'orange');
        if (ph !== 'feel') gradArrows(o.here.x, rec.g, m.p.alpha, c, rgb('twin'), 'ink');
        if (ph === 'stride' && rec.clipped) { R.post(rec.raw[0], rec.raw[1], 0.02, c, 1, 0.6); R.groundPath([rec.raw, rec.x], c, 1, 0.004, 0.8, true); }
      }
      sprites.push({ at: o.pos, fig: Fog.FIGURES.pilgrim, pal: pal('pg'), hgt: 0.04, name: 'the Pilgrim', colour: 'orange', who: 'pg', ridden: riding });
      return o;
    }
    function drawCartographer(t, riding) {
      var m = api.model(), o = pose('lb', t.k, fOf('lb', t)), rec = o.rec, c = rgb('blue'), w = m.walks.lb;
      trail('lb', t.k, o.pos, c);
      if (rec && !calm && (!ride || riding)) {
        var ph = o.phase, i = PHASES.lb.names.indexOf(ph), at0 = o.here.x;
        drawTaps(rec, at0, ph === 'feel' ? o.u : 1, c, 'blue');
        if (i >= 1) {
          // the journal: each page is a stride it took, drawn where it took it with the downhill it knew that day
          var queue = rec.queue || [], reading = ph === 'journal' ? readingAt(queue.length, o.u) : -1;
          queue.forEach(function (pg, n) {
            var a = w[Math.max(0, pg.day - 1)].x, b = w[Math.min(pg.day, w.length - 1)].x, lit = n === reading, g = w[pg.day] && w[pg.day].g, gn = g ? Math.hypot(g[0], g[1]) : 0;
            R.groundPath([a, b], lit ? rgb('orange') : c, lit ? 4 : ph === 'journal' ? 3 : 2, 0.005, ph === 'journal' ? 1 : 0.55);
            if (gn > 1e-12) R.arrow(a, [a[0] - g[0] / gn * 0.035 * world.span, a[1] - g[1] / gn * 0.035 * world.span], c, 1, 0.006, ph === 'journal' ? 0.9 : 0.4);
            if (ph === 'journal' && near(a, 0.5)) tag((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.02, 'page ' + (n + 1), lit ? 'gold' : 'blue', 10);
          });
          var gnow = rec.g, gl = Math.hypot(gnow[0], gnow[1]), mv = [rec.x[0] - at0[0], rec.x[1] - at0[1]], ml = Math.hypot(mv[0], mv[1]);
          if (gl > 1e-12 && ml > 1e-12) {
            var L = 0.08 * world.span, a0 = heading(mapDownhill(at0, gnow)), a1 = heading(mv), a = ph === 'journal' ? lerpAngle(a0, a1, ease(o.u)) : a1;
            R.groundPath([at0, [at0[0] + Math.cos(a0) * L, at0[1] + Math.sin(a0) * L]], rgb('twin'), 1, 0.006, 0.8, true);
            R.arrow(at0, [at0[0] + Math.cos(a) * L * 1.2, at0[1] + Math.sin(a) * L * 1.2], c, 3, 0.007, 1);
            var bendText = rec.pages ? 'journal turns ' + degrees(a1, a0) + '°' : api.model().land.box ? 'stretched map: ' + degrees(a0, heading([-gnow[0], -gnow[1]])) + '° off downhill' : '';
            if (bendText && near(at0, 0.6)) tag(at0[0] + Math.cos(a) * L * 1.2, at0[1] + Math.sin(a) * L * 1.2, 0.02, bendText, 'blue', 11);
          }
        }
        if (i >= 2) {
          var tr = rec.trials || [], shownTr = ph === 'trials' ? Math.floor(o.u * (tr.length + 1)) + 1 : tr.length + 1;
          for (var q = 0; q < Math.min(shownTr, tr.length); q++) {
            R.post(tr[q].x[0], tr[q].x[1], 0.03, c, 1, 0.6);
            if (near(tr[q].x, 0.7)) tag(tr[q].x[0], tr[q].x[1], 0.034, strideName(tr[q].step) + ' ✗', 'blue', 11);
          }
          if (shownTr > tr.length) { R.post(rec.x[0], rec.x[1], 0.035, c, 3, 1); if (near(rec.x, 0.7)) tag(rec.x[0], rec.x[1], 0.04, strideName(rec.step) + ' ✓', 'blue', 11); }
        }
      }
      sprites.push({ at: o.pos, fig: Fog.FIGURES.cartographer, pal: pal('lb'), hgt: 0.04, name: 'the Cartographer', colour: 'blue', who: 'lb', ridden: riding });
      return o;
    }
    function drawTwins(t, riding) {
      var o = pose('tw', t.k, fOf('tw', t)), rec = o.rec, ink = rgb('twin'), blue = rgb('blue'), orange = rgb('orange');
      trail('tw', t.k, o.pos, ink);
      if (rec && !calm && (!ride || riding)) {
        var ph = o.phase, v = rec.v, sp = world.span;
        R.post(v[0], v[1], 0.03, blue, 2, 0.9);
        R.groundPath([o.here.z, v], orange, 1, 0.004, 0.8, true);
        if (near(v, 0.6)) tag(v[0], v[1], 0.035, 'v = z − u', 'blue', 11);
        if (ph === 'anchor' || ph === 'walk') {
          var rr = Math.min(rec.reach, 0.5 * sp);
          if (rr > 0.004 * sp) R.ring(v[0], v[1], rr, ink, 1, 0.004, 0.6, true);
          if (ph === 'walk') { R.groundPath(rec.path.length > 1 ? [rec.from].concat(rec.path) : [rec.from, rec.x], ink, 1, 0.004, 0.5, true); R.groundPath([o.pos, v], orange, 2, 0.006, 0.9); }
        }
        if (ph === 'warden' || ph === 'ledger') {
          var aim = [rec.x[0] + rec.uFrom[0], rec.x[1] + rec.uFrom[1]];
          R.post(aim[0], aim[1], 0.02, blue, 1, 0.5);
          R.groundPath([aim, o.z], blue, 1, 0.004, 0.7, true);
          if (near(aim, 0.5)) tag(aim[0], aim[1], 0.025, 'x + u', 'blue', 10);
        }
      }
      var led = o.led, lz = o.z;
      if (Math.hypot(led[0], led[1]) > 1e-6) {
        R.arrow(lz, [lz[0] + led[0], lz[1] + led[1]], orange, 2, 0.008, 1);
        if (near(lz, 0.6)) tag(lz[0] + led[0], lz[1] + led[1], 0.02, 'ledger u = ' + pair(led, 2), 'orange', 11);
      }
      R.groundPath([o.pos, lz], ink, 1, 0.003, 0.7, true);
      sprites.push({ at: o.pos, fig: Fog.FIGURES.wanderer, pal: pal('tw'), hgt: 0.04, name: 'the Wanderer', colour: 'ink', who: 'tw', ridden: riding });
      sprites.push({ at: lz, fig: Fog.FIGURES.warden, pal: pal('wd'), hgt: 0.04, name: 'the Warden', colour: 'blue', who: 'wd' });
      return o;
    }
    function trail(h, k, pos, colour) {
      var w = api.model().walks[h], pts = [];
      for (var j = Math.max(0, k - 15); j <= Math.min(k, w.length - 1); j++) pts.push(w[j].x);
      pts.push(pos);
      R.groundPath(pts, colour, 1, 0.003, 0.45);
    }
    var sprites = [];
    var KIND = { 'the Pilgrim': 'pg', 'the Cartographer': 'lb', 'the Wanderer': 'tw', 'the Warden': 'wd', 'the King': 'king', 'lanterns': 'lantern', 'start': 'flag' };
    function drawSprites() {
      figs = [];
      sprites.forEach(function (s) {
        var g = world.height(s.at[0], s.at[1]) + (s.lift || 0) * world.span;
        var foot = R.project(s.at[0], s.at[1], g), head = R.project(s.at[0], s.at[1], g + s.hgt * world.span);
        if (!foot || !head || foot[0] < -R.W || foot[0] > 2 * R.W) return;
        var kind = KIND[s.name] || (s.fig === Fog.FIGURES.star ? 'star' : 'flag');
        figs.push({ kind: kind, foot: foot, head: head, z: foot[2], ridden: !!s.ridden });
        if (s.name && (s.always || near(s.at, 0.8)) && R.seen(foot[0], Math.min(foot[1], R.H - 1) - 1, foot[2] * 0.995)) labels.push({ p: [head[0], head[1] - 2, head[2]], text: s.name, colour: s.colour, size: 12, bold: true });
      });
    }
    // ------------------------------------------------------------ figures and hands, drawn smooth on the overlay
    // Each figure is drawn in vector form at its foot, faded by the fog and clipped where nearer land hides it.
    var SKIN = '#ebd4ba', figs = [], hand = null;
    function robe(ctx, x, y, u, bw, sw, top) {
      ctx.beginPath(); ctx.moveTo(x - bw * u, y);
      ctx.quadraticCurveTo(x - bw * 0.92 * u, y - top * 0.55 * u, x - sw * u, y - top * u);
      ctx.quadraticCurveTo(x, y - (top + 7) * u, x + sw * u, y - top * u);
      ctx.quadraticCurveTo(x + bw * 0.92 * u, y - top * 0.55 * u, x + bw * u, y);
      ctx.quadraticCurveTo(x, y + 3 * u, x - bw * u, y); ctx.closePath();
    }
    function sideLight(ctx, x, y, u, top, light, dark) { var g = ctx.createLinearGradient(x - 18 * u, y - top * u, x + 18 * u, y); g.addColorStop(0, light); g.addColorStop(1, dark); return g; }
    function hood(ctx, x, y, u, colour) {
      ctx.fillStyle = colour; ctx.beginPath(); ctx.moveTo(x - 11 * u, y - 60 * u);
      ctx.quadraticCurveTo(x - 14 * u, y - 83 * u, x + 1 * u, y - 93 * u); ctx.quadraticCurveTo(x + 14 * u, y - 83 * u, x + 11 * u, y - 60 * u); ctx.closePath(); ctx.fill();
    }
    function face(ctx, x, y, u, cy, rx, ry) {
      ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(x, y - cy * u, rx * u, ry * u, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3b2a1e'; ctx.beginPath(); ctx.arc(x - 2.3 * u, y - (cy + 1) * u, 0.9 * u, 0, TAU); ctx.arc(x + 2.3 * u, y - (cy + 1) * u, 0.9 * u, 0, TAU); ctx.fill();
    }
    function paintFigure(ctx, kind, x, y, h) {
      var u = h / 100;
      if (kind !== 'star' && kind !== 'flag') { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x, y, 17 * u, 4 * u, 0, 0, TAU); ctx.fill(); }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (kind === 'pg') {
        ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = Math.max(1, 2.6 * u); ctx.beginPath(); ctx.moveTo(x + 17 * u, y + u); ctx.lineTo(x + 21 * u, y - 97 * u); ctx.stroke();
        ctx.fillStyle = '#8a6440'; ctx.beginPath(); ctx.arc(x + 21 * u, y - 98 * u, 3 * u, 0, TAU); ctx.fill();
        robe(ctx, x, y, u, 17, 12, 60); ctx.fillStyle = sideLight(ctx, x, y, u, 60, '#e98a3c', '#a94400'); ctx.fill();
        ctx.strokeStyle = '#7a3500'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(x - 13 * u, y - 34 * u); ctx.quadraticCurveTo(x, y - 30 * u, x + 13 * u, y - 34 * u); ctx.stroke();
        ctx.strokeStyle = '#b84e08'; ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.moveTo(x + 8 * u, y - 54 * u); ctx.quadraticCurveTo(x + 15 * u, y - 46 * u, x + 19 * u, y - 51 * u); ctx.stroke();
        ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(x + 19.5 * u, y - 51 * u, 2.6 * u, 0, TAU); ctx.fill();
        hood(ctx, x, y, u, '#c45100'); face(ctx, x, y, u, 72, 6, 7.5);
      } else if (kind === 'lb') {
        robe(ctx, x, y, u, 15, 12, 60); ctx.fillStyle = sideLight(ctx, x, y, u, 60, '#3d80cc', '#0d3f78'); ctx.fill();
        ctx.fillStyle = '#fbfaf5'; ctx.strokeStyle = '#0d3f78'; ctx.lineWidth = Math.max(0.6, u);
        ctx.beginPath(); ctx.moveTo(x - 12 * u, y - 49 * u); ctx.lineTo(x, y - 46.5 * u); ctx.lineTo(x + 12 * u, y - 49 * u); ctx.lineTo(x + 12 * u, y - 36 * u); ctx.lineTo(x, y - 33.5 * u); ctx.lineTo(x - 12 * u, y - 36 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - 46.5 * u); ctx.lineTo(x, y - 33.5 * u); ctx.moveTo(x - 9 * u, y - 44 * u); ctx.lineTo(x - 3 * u, y - 43 * u); ctx.moveTo(x - 9 * u, y - 40 * u); ctx.lineTo(x - 3 * u, y - 39 * u);
        ctx.moveTo(x + 3 * u, y - 43 * u); ctx.lineTo(x + 9 * u, y - 44 * u); ctx.moveTo(x + 3 * u, y - 39 * u); ctx.lineTo(x + 9 * u, y - 40 * u); ctx.stroke();
        ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(x - 12.5 * u, y - 42 * u, 2.5 * u, 0, TAU); ctx.arc(x + 12.5 * u, y - 42 * u, 2.5 * u, 0, TAU); ctx.fill();
        face(ctx, x, y, u, 70, 7, 7.5);
        ctx.fillStyle = '#123a66'; ctx.beginPath(); ctx.ellipse(x, y - 77 * u, 15 * u, 3.4 * u, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - 7.5 * u, y - 91 * u, 15 * u, 14 * u, 3 * u); else ctx.rect(x - 7.5 * u, y - 91 * u, 15 * u, 14 * u); ctx.fill();
        ctx.strokeStyle = '#e07a2e'; ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.moveTo(x - 7.5 * u, y - 80 * u); ctx.lineTo(x + 7.5 * u, y - 80 * u); ctx.stroke();
      } else if (kind === 'tw' || kind === 'wd') {
        var ward = kind === 'wd';
        if (ward) ctx.globalAlpha *= 0.82;
        robe(ctx, x, y, u, 16, 12, 62); ctx.fillStyle = ward ? sideLight(ctx, x, y, u, 62, '#6aa2e3', '#1f5aa0') : sideLight(ctx, x, y, u, 62, '#4a5866', '#1b232c'); ctx.fill();
        if (ward) { ctx.setLineDash([3 * u, 2.4 * u]); ctx.strokeStyle = '#d6e7fc'; ctx.lineWidth = 1.4 * u; robe(ctx, x, y, u, 16, 12, 62); ctx.stroke(); ctx.setLineDash([]); }
        if (!ward) { ctx.strokeStyle = '#e07a2e'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.ellipse(x - 8 * u, y - 33 * u, 5.5 * u, 4.2 * u, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x - 8 * u, y - 33 * u, 3 * u, 2.2 * u, 0, 0, TAU); ctx.stroke(); }
        else { ctx.fillStyle = '#eaf3ff'; ctx.beginPath(); ctx.moveTo(x - 6 * u, y - 50 * u); ctx.lineTo(x + 6 * u, y - 50 * u); ctx.lineTo(x + 6 * u, y - 42 * u); ctx.quadraticCurveTo(x, y - 34 * u, x - 6 * u, y - 42 * u); ctx.closePath(); ctx.fill(); }
        if (ward) {
          face(ctx, x, y, u, 72, 6.5, 7.5);
          ctx.fillStyle = '#1f5aa0'; ctx.beginPath(); ctx.arc(x, y - 77 * u, 8.5 * u, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 9.5 * u, y - 78 * u, 19 * u, 2.4 * u);
        } else { hood(ctx, x, y, u, '#2a3440'); face(ctx, x, y, u, 72, 6, 7.5); }
      } else if (kind === 'king') {
        robe(ctx, x, y, u, 19, 13, 62); ctx.fillStyle = sideLight(ctx, x, y, u, 62, '#e98a3c', '#8f3a00'); ctx.fill();
        ctx.fillStyle = '#f7f3ea'; ctx.beginPath(); ctx.moveTo(x - 19 * u, y); ctx.quadraticCurveTo(x, y + 3 * u, x + 19 * u, y); ctx.lineTo(x + 18.4 * u, y - 6 * u); ctx.quadraticCurveTo(x, y - 3 * u, x - 18.4 * u, y - 6 * u); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#0d3f78'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(x - 11 * u, y - 58 * u); ctx.lineTo(x + 12 * u, y - 24 * u); ctx.stroke();
        face(ctx, x, y, u, 70, 7, 8);
        ctx.fillStyle = '#f2efe8'; ctx.beginPath(); ctx.moveTo(x - 6 * u, y - 66 * u); ctx.quadraticCurveTo(x, y - 54 * u, x + 6 * u, y - 66 * u); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8b23a'; ctx.beginPath(); ctx.moveTo(x - 8 * u, y - 77 * u); ctx.lineTo(x - 8 * u, y - 86 * u); ctx.lineTo(x - 4 * u, y - 81 * u); ctx.lineTo(x, y - 89 * u); ctx.lineTo(x + 4 * u, y - 81 * u); ctx.lineTo(x + 8 * u, y - 86 * u); ctx.lineTo(x + 8 * u, y - 77 * u); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c45100'; ctx.beginPath(); ctx.arc(x, y - 81 * u, 1.4 * u, 0, TAU); ctx.fill();
      } else if (kind === 'star') {
        var g = ctx.createRadialGradient(x, y - 50 * u, 0, x, y - 50 * u, 70 * u); g.addColorStop(0, 'rgba(255,190,90,0.55)'); g.addColorStop(1, 'rgba(255,190,90,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 50 * u, 70 * u, 0, TAU); ctx.fill();
        ctx.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 ? 16 : 38) * u; ctx.lineTo(x + rr * Math.cos(a), y - 50 * u + rr * Math.sin(a)); }
        ctx.closePath(); ctx.fillStyle = '#ffb347'; ctx.fill(); ctx.strokeStyle = '#c45100'; ctx.lineWidth = 2.5 * u; ctx.stroke();
      } else if (kind === 'lantern') {
        ctx.strokeStyle = '#2f2a26'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 75 * u); ctx.stroke();
        var gl = ctx.createRadialGradient(x, y - 85 * u, 0, x, y - 85 * u, 40 * u); gl.addColorStop(0, 'rgba(255,214,122,0.75)'); gl.addColorStop(1, 'rgba(255,214,122,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y - 85 * u, 40 * u, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffe2a0'; ctx.strokeStyle = '#2f2a26'; ctx.lineWidth = 2 * u; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - 8 * u, y - 96 * u, 16 * u, 20 * u, 3 * u); else ctx.rect(x - 8 * u, y - 96 * u, 16 * u, 20 * u); ctx.fill(); ctx.stroke();
      } else if (kind === 'flag') {
        ctx.strokeStyle = '#2f2a26'; ctx.lineWidth = 2.6 * u; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 100 * u); ctx.stroke();
        ctx.fillStyle = '#fbfaf5'; ctx.strokeStyle = '#c9c3b8'; ctx.lineWidth = u; ctx.beginPath(); ctx.moveTo(x, y - 98 * u);
        ctx.quadraticCurveTo(x + 18 * u, y - 104 * u, x + 36 * u, y - 94 * u); ctx.quadraticCurveTo(x + 22 * u, y - 84 * u, x + 36 * u, y - 72 * u); ctx.quadraticCurveTo(x + 18 * u, y - 80 * u, x, y - 74 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c45100'; ctx.beginPath(); ctx.arc(x + 15 * u, y - 86 * u, 4 * u, 0, TAU); ctx.fill();
      }
    }
    // The clip where nearer land hides a figure: for each screen column, everything above the first nearer pixel.
    function clipBehindLand(ctx, foot, topRow, z, halfCols, sx, sy) {
      var c0 = Math.max(0, Math.floor(foot[0] - halfCols)), c1 = Math.min(R.W - 1, Math.ceil(foot[0] + halfCols));
      var r0 = Math.max(0, Math.floor(topRow)), r1 = Math.min(R.H - 1, Math.ceil(foot[1] + 2));
      if (c0 > c1) return false;
      ctx.beginPath(); ctx.moveTo(c0 * sx, 0);
      for (var c = c0; c <= c1; c++) { var o = r0 > r1 ? r1 + 6 : R.occluder(c, r0, r1, z); ctx.lineTo(c * sx, o * sy); ctx.lineTo((c + 1) * sx, o * sy); }
      ctx.lineTo((c1 + 1) * sx, 0); ctx.closePath(); ctx.clip();
      return true;
    }
    function drawFigures(Wc, Hc) {
      var sx = Wc / R.W, sy = Hc / R.H;
      figs.sort(function (a, b) { return b.z - a.z; });
      figs.forEach(function (f) {
        var hPx = (f.foot[1] - f.head[1]) * sy, rows = f.foot[1] - f.head[1], star = f.kind === 'star';
        if (hPx < 2.5 || f.z < 0.015 * world.span) return;
        // someone standing almost on top of the eye is drawn faint, so they do not hide what is being shown
        var near = hPx / Hc, fade = near > 0.3 && !f.ridden ? clamp(1 - (near - 0.3) / 0.3, 0.12, 1) : 1;
        octx.save();
        octx.globalAlpha = Math.max(0, 1 - 0.92 * R.fogT(f.z)) * fade;
        if (clipBehindLand(octx, f.foot, f.head[1] - rows * (star ? 0.8 : 0.35), f.z, rows * (star ? 0.85 : 0.45), sx, sy)) paintFigure(octx, f.kind, f.foot[0] * sx, f.foot[1] * sy, hPx);
        octx.restore();
      });
    }
    // What you hold: your staff (or the Pilgrim's), the Cartographer's journal, the Wanderer's rope.
    function drawHandItem(Wc, Hc) {
      if (!hand) return;
      var u = Hc / 100, now = performance.now();
      octx.save(); octx.lineCap = 'round'; octx.lineJoin = 'round';
      if (hand.kind === 'staff') {
        var t = hand.tap, bob = hand.bob;
        var x0 = Wc * 0.8 - t * 0.6 * u, y0 = Hc + 4 * u + bob, x1 = Wc * 0.7 - t * 2.4 * u, y1 = Hc * 0.6 + t * 1.6 * u + bob;
        var sg = octx.createLinearGradient(x0, y0, x1, y1); sg.addColorStop(0, '#5b3d22'); sg.addColorStop(1, '#9a7148');
        octx.strokeStyle = sg; octx.lineWidth = 2.6 * u; octx.beginPath(); octx.moveTo(x0, y0); octx.lineTo(x1, y1); octx.stroke();
        octx.fillStyle = '#9a7148'; octx.beginPath(); octx.arc(x1, y1, 1.7 * u, 0, TAU); octx.fill();
        octx.fillStyle = hand.glove; octx.beginPath(); octx.ellipse(x0 + (x1 - x0) * 0.22, y0 + (y1 - y0) * 0.22, 4.2 * u, 3.2 * u, -0.9, 0, TAU); octx.fill();
      } else if (hand.kind === 'journal') {
        var bw = Math.min(Wc * 0.34, 46 * u), bh = 15 * u, bx = Wc / 2, by = Hc - 2 * u, flip = hand.flip;
        octx.fillStyle = '#0d3f78'; octx.beginPath(); octx.moveTo(bx - bw / 2 - 2 * u, by); octx.lineTo(bx - bw / 2 - 2 * u, by - bh); octx.lineTo(bx + bw / 2 + 2 * u, by - bh); octx.lineTo(bx + bw / 2 + 2 * u, by); octx.closePath(); octx.fill();
        octx.fillStyle = '#fbfaf5';
        octx.beginPath(); octx.moveTo(bx, by - 1 * u); octx.quadraticCurveTo(bx - bw / 4, by - bh - 2 * u, bx - bw / 2, by - bh + 1 * u); octx.lineTo(bx - bw / 2, by); octx.closePath(); octx.fill();
        octx.beginPath(); octx.moveTo(bx, by - 1 * u); octx.quadraticCurveTo(bx + bw / 4, by - bh - 2 * u, bx + bw / 2, by - bh + 1 * u); octx.lineTo(bx + bw / 2, by); octx.closePath(); octx.fill();
        octx.strokeStyle = 'rgba(40,52,68,0.55)'; octx.lineWidth = 0.5 * u;
        for (var l = 0; l < 4; l++) { var ly = by - bh + (4 + l * 2.6) * u; octx.beginPath(); octx.moveTo(bx - bw / 2 + 3 * u, ly); octx.lineTo(bx - 3 * u, ly + u * 0.4); octx.moveTo(bx + 3 * u, ly + u * 0.4); octx.lineTo(bx + bw / 2 - 3 * u, ly); octx.stroke(); }
        if (flip > 0) { var fx = bx + (bw / 2) * (1 - 2 * flip); octx.fillStyle = 'rgba(251,250,245,0.92)'; octx.beginPath(); octx.moveTo(bx, by - u); octx.quadraticCurveTo((bx + fx) / 2, by - bh - 6 * u * Math.sin(Math.PI * flip), fx, by - bh + u); octx.lineTo(fx, by); octx.closePath(); octx.fill(); }
        octx.fillStyle = SKIN; octx.beginPath(); octx.ellipse(bx - bw / 2 - 3 * u, by - 3 * u, 3.4 * u, 2.6 * u, 0.4, 0, TAU); octx.ellipse(bx + bw / 2 + 3 * u, by - 3 * u, 3.4 * u, 2.6 * u, -0.4, 0, TAU); octx.fill();
      } else if (hand.kind === 'rope') {
        var cx = Wc * 0.78, cy = Hc - 3 * u;
        if (hand.to) { octx.strokeStyle = '#e07a2e'; octx.lineWidth = 1.2 * u; octx.beginPath(); octx.moveTo(cx - 3 * u, cy - 4 * u); octx.quadraticCurveTo((cx + hand.to[0]) / 2, Math.max(cy, hand.to[1]) + 8 * u, hand.to[0], hand.to[1]); octx.stroke(); }
        octx.strokeStyle = '#e07a2e'; octx.lineWidth = 1.6 * u;
        for (var r2 = 0; r2 < 3; r2++) { octx.beginPath(); octx.ellipse(cx, cy - r2 * 1.2 * u, (7 - r2) * u, (4.5 - r2 * 0.6) * u, 0, 0, TAU); octx.stroke(); }
        octx.fillStyle = SKIN; octx.beginPath(); octx.ellipse(cx + 6 * u, cy - 1 * u, 3.6 * u, 2.6 * u, -0.5, 0, TAU); octx.fill();
      }
      octx.restore(); void now;
    }


    // ------------------------------------------------------------ the frame
    // Watching a hero's day from afar: from the side of today's stride, far enough back to frame all of it, so that
    // the hero walks across the view (left to right when it can) and the drop from one spot to the next shows.
    var followMode = 'map', camS = null, camT = 0;
    function sideCam(o, cam, sp) {
      var a = o.here.x, b = o.rec ? o.rec.x : o.here.x, dv = [b[0] - a[0], b[1] - a[1]], Ls = Math.hypot(dv[0], dv[1]);
      if (Ls < 0.02 * sp) { dv = [Math.cos(o.heading), Math.sin(o.heading)]; Ls = 0; } else dv = [dv[0] / Ls, dv[1] / Ls];
      var mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], nrm = [dv[1], -dv[0]], D = clamp(1.1 * Ls, 0.18 * sp, 0.8 * sp);
      var c1 = [mid[0] + nrm[0] * D, mid[1] + nrm[1] * D], c2 = [mid[0] - nrm[0] * D, mid[1] - nrm[1] * D];
      var ga = world.height(a[0], a[1]), gb = world.height(b[0], b[1]), gm = world.height(mid[0], mid[1]), g1 = world.height(c1[0], c1[1]), g2 = world.height(c2[0], c2[1]);
      var hiSeg = Math.max(ga, gb, gm), c = c1, gc = g1;
      if (g1 > hiSeg + 0.2 * D && g2 < g1) { c = c2; gc = g2; }
      var top = Math.max(hiSeg, gc) + 0.45 * D, focal = R.W / 2 / Math.tan(cam.fov / 2), aim = (ga + gb) / 2;
      return { x: c[0], y: c[1], eye: top, heading: Math.atan2(mid[1] - c[1], mid[0] - c[0]), pitch: clamp(0.6 - (top - aim) * focal / D / R.H - 0.42, -1.2, 0.4), D: D };
    }
    function camera() {
      var m = api.model(), sp = span(), fe = fogDist * sp, night = api.night();
      if (race.on && tnow() < race.scoutUntil) fe *= 2;
      var cam = { pitch: -0.04 + look.pitch, eye: 0.035 * sp, fov: 1.35, fogStart: 0.18 * fe, fogEnd: fe, fogRGB: rgb(night ? 'nightfog' : 'fog'), skyRGB: rgb(night ? 'nightsky' : 'sky') };
      if (ride) {
        // Following a hero: from afar at the side of the day's stride, or from behind it (C switches).
        var t = clock(), o = pose(ride, t.k, fOf(ride, t)), hd = o.heading + look.yaw, back = 0.15 * sp, lift = 0.07 * sp; void hd;
        cam.heading = hd; cam.pose = o; cam.x = o.pos[0]; cam.y = o.pos[1];
        var holes = m.land.holes, pit = holes && holes.depth(o.pos) > 0.25;
        if (pit || !world || !R) { cam.pitch -= o.phase === 'feel' ? 0.16 : 0.08; cam.own = true; camS = null; }
        else {
          var want;
          if (followMode !== 'behind') want = sideCam(o, cam, sp);
          else {
            var bx = o.pos[0] - Math.cos(o.heading) * back, by = o.pos[1] - Math.sin(o.heading) * back, gh = world.height(o.pos[0], o.pos[1]), gc = world.height(bx, by), top = Math.max(gh, gc) + lift;
            want = { x: bx, y: by, eye: top, heading: o.heading, pitch: clamp(0.68 - (top - gh) * (R.W / 2 / Math.tan(cam.fov / 2)) / back / R.H - 0.42, -1.2, 0.4), D: back };
          }
          var nowT = tnow(), dt = clamp((nowT - camT) / 1000, 0, 0.25); camT = nowT;
          if (!camS || camS.ride !== ride || camS.mode !== followMode || camS.model !== m) { camS = want; camS.ride = ride; camS.mode = followMode; camS.model = m; }
          else {
            var q = 1 - Math.exp(-3.2 * dt);
            camS.x += (want.x - camS.x) * q; camS.y += (want.y - camS.y) * q; camS.eye += (want.eye - camS.eye) * q; camS.D += (want.D - camS.D) * q;
            camS.heading += wrapAngle(want.heading - camS.heading) * q; camS.pitch += (want.pitch - camS.pitch) * q;
          }
          var gNow = world.height(camS.x, camS.y);
          cam.x = camS.x; cam.y = camS.y; cam.eye = Math.max(camS.eye - gNow, 0.02 * sp); cam.heading = camS.heading + look.yaw;
          cam.pitch = clamp(camS.pitch + look.pitch, -1.2, 0.4); cam.fogStart += camS.D; cam.fogEnd += camS.D;
        }
      }
      else { cam.x = player.x; cam.y = player.y; cam.heading = player.heading; }
      void m;
      return cam;
    }
    function frame() {
      var m = api.model();
      ensureRenderer();
      if (!world || worldFor !== m || worldTheme !== api.themeKey() || worldQuality !== quality) { rebuild(); worldQuality = quality; }
      var t = clock(), cam = camera(), mapFull = mapWanted() && mapBlend >= 1;
      labels = []; sprites = [];
      if (mapFull) { figs = []; hand = null; }
      else {
      R.frame(world, cam);
      drawLaw(m);
      var shown = api.shownAll();
      var poses = {};
      calm = trial.on && STEPS[trial.i] && STEPS[trial.i].lesson < 3;
      if (shown.tw) poses.tw = drawTwins(t, ride === 'tw');
      if (shown.lb) poses.lb = drawCartographer(t, ride === 'lb');
      if (shown.pg) poses.pg = drawPilgrim(t, ride === 'pg');
      if (felt && tnow() - felt.time < 12000) drawFelt();
      if (ride && cam.pose && cam.pose.rec && !cam.own) markDay(cam.pose, m);
      drawSprites();
      trialWorld();
      drawHand(cam);
      R.present();
      }
      drawOverlay(cam);
      mapFrame(cam);
      hud(cam, poses);
      daylineUpdate(cam);
      reckonUpdate(cam);
      journalUpdate(cam);
      trialTick();
      raceTick();
      if (!ride && !found && dist([player.x, player.y], m.land.treasure) < 0.03 * span()) {
        found = true; say(m.L.kind === 'tower' ? 'You stand on the King’s true order, ' + flags(m.land.treasure) + '.' : (m.land.holes && m.land.holes.depth(m.land.treasure) > 0.5 ? 'You found the treasure, at the bottom of the deepest black hole.' : m.land.box ? 'You found the treasure: the lowest spot inside ' + (m.key === 'wall' ? 'the wall.' : 'the realm.') : 'You found the treasure: the lowest spot of the land.'));
      }
    }
    function markDay(o, m) {
      var a = o.here.x, b = o.rec.x; if (dist(a, b) < 1e-9 * span()) return;
      R.groundPath([a, b], [255, 255, 255], 2, 0.004, o.phase === 'stride' ? 0.9 : 0.6, o.phase !== 'stride');
      tag(a[0], a[1], 0.06, 'day ' + o.k + ' · J ' + num(m.land.J(a), 3), 'ink', 11);
      tag(b[0], b[1], 0.06, 'day ' + (o.k + 1) + ' · J ' + num(m.land.J(b), 3), 'gold', 11);
      // the drop: today's ground level carried over to tomorrow's spot, and the step down from it
      var ha = world.height(a[0], a[1]), hb = world.height(b[0], b[1]), dJ = m.land.J(b) - m.land.J(a);
      if (ha - hb > 0.002 * world.span) {
        var pa = R.project(a[0], a[1], ha), pb = R.project(b[0], b[1], ha), pc = R.project(b[0], b[1], hb), gold = rgb('orange');
        if (pa && pb) R.segment(pa, pb, gold, 1, 0.75);
        if (pb && pc) { R.segment(pb, pc, gold, 2, 1); var lab = [(pb[0] + pc[0]) / 2, (pb[1] + pc[1]) / 2, pb[2]]; labels.push({ p: [lab[0] + 14, lab[1] + 6, lab[2]], text: (dJ < 0 ? 'down ' : 'up ') + num(Math.abs(dJ), 3), colour: 'orange', size: 11 }); }
      }
    }
    function flags(x) { return '(' + (x[0] >= 0 ? '+' : '−') + ', ' + (x[1] >= 0 ? '+' : '−') + ')'; }
    function drawFelt() {
      var c = rgb('twin'), at = felt.at;
      felt.taps.forEach(function (tp, i) { R.groundPath([at, tp.at], c, 1, 0.002, 0.8); R.post(tp.at[0], tp.at[1], 0.02, c, 2, 1); if (near(tp.at, 0.3)) tag(tp.at[0], tp.at[1], 0.026, ['E', 'W', 'N', 'S'][i] + ' ' + num(tp.J, 3), 'ink', 11); });
      gradArrows(at, felt.g, 0.12 * span() / Math.max(Math.hypot(felt.g[0], felt.g[1]), 1e-9), c, c, 'ink', 'downhill');
    }
    function drawHand(cam) {
      var moving = !ride && (keys.w || keys.s || keys.arrowup || keys.arrowdown || keys.a || keys.d), bob = moving ? Math.sin(performance.now() / 120) * 2 : 0;
      if (ride && !cam.own) { hand = null; return; }     // following from behind, nobody holds anything up to the view
      if (ride === 'lb') { var o = cam.pose; hand = { kind: 'journal', flip: o && o.phase === 'journal' ? (o.u * 3) % 1 : 0 }; return; }
      if (ride === 'tw') {
        var z = cam.pose ? cam.pose.z : null, p = z ? R.ground(z[0], z[1], 0.03) : null;
        hand = { kind: 'rope', to: p && p[2] > 0 ? [p[0] * over.clientWidth / R.W, p[1] * over.clientHeight / R.H] : null }; return;
      }
      var tapping = 0;
      if (ride === 'pg' && cam.pose && cam.pose.phase === 'feel') tapping = Math.abs(Math.sin(cam.pose.u * 4 * Math.PI)) * 10;
      if (!ride && felt && tnow() - felt.time < 900) tapping = Math.abs(Math.sin((tnow() - felt.time) / 900 * 4 * Math.PI)) * 10;
      hand = { kind: 'staff', tap: tapping, bob: bob, glove: ride === 'pg' ? '#c45100' : '#d2b48c' };
    }
    function drawOverlay(cam) {
      var dpr = window.devicePixelRatio || 1, Wc = over.clientWidth, Hc = over.clientHeight;
      if (over.width !== Math.round(Wc * dpr) || over.height !== Math.round(Hc * dpr)) { over.width = Math.round(Wc * dpr); over.height = Math.round(Hc * dpr); }
      octx.setTransform(dpr, 0, 0, dpr, 0, 0); octx.clearRect(0, 0, Wc, Hc);
      var sx = Wc / R.W, sy = Hc / R.H, font = getComputedStyle(document.body).fontFamily;
      var mapCover = mapBlend > 0.5;
      if (mapCover) labels = [];
      else { drawFigures(Wc, Hc); drawHandItem(Wc, Hc); }
      // Names first, then the nearer labels; a label that finds no free spot above its anchor is left out.
      var placed = [], ob = over.getBoundingClientRect(), keepOut = [regions.disc].filter(Boolean).map(function (r) { return [r[0], r[1], r[0] + r[2], r[1] + r[3]]; });
      ['quest', 'race', 'reckon', 'daysteps', 'journal', 'fog-caption', 'fog-dialogue', 'title-card'].forEach(function (id) {
        var el = $(id); if (!el || el.hidden || !el.offsetParent) return;
        var q = el.getBoundingClientRect(); if (q.width && q.height) keepOut.push([q.left - ob.left, q.top - ob.top, q.right - ob.left, q.bottom - ob.top]);
      });
      function covered(x, y, w, h) { return keepOut.some(function (k) { return x + w / 2 > k[0] && x - w / 2 < k[2] && y > k[1] && y - h < k[3]; }); }
      labels.sort(function (a, b) { return (b.bold ? 1 : 0) - (a.bold ? 1 : 0) || a.p[2] - b.p[2]; });
      labels.forEach(function (l) {
        if (!l.bold && !R.seen(l.p[0], l.p[1], l.p[2])) return;
        var size = Math.round(clamp(l.size * Wc / 720, 10, 15));
        octx.font = (l.bold ? '700 ' : '600 ') + size + 'px ' + font;
        var w = octx.measureText(l.text).width + 6, h = size + 3, x = clamp(l.p[0] * sx, w / 2 + 2, Wc - w / 2 - 2), y = l.p[1] * sy, tries = 0;
        if (y < h + 2 || y > Hc + h) return;
        while (tries < 4 && placed.some(function (r) { return Math.abs(r.x - x) < (r.w + w) / 2 && Math.abs(r.y - y) < (r.h + h) / 2; })) { y -= h; tries++; }
        if (tries === 4 || covered(x, y, w, h)) return;
        placed.push({ x: x, y: y, w: w, h: h });
        octx.textAlign = 'center'; octx.textBaseline = 'bottom';
        octx.lineWidth = 3.5; octx.lineJoin = 'round'; octx.strokeStyle = 'rgba(8,12,18,0.75)'; octx.strokeText(l.text, x, y);
        octx.fillStyle = l.colour === 'orange' ? '#ffb071' : l.colour === 'blue' ? '#a9cdf6' : l.colour === 'gold' ? '#ffd27a' : '#f2f5f8'; octx.fillText(l.text, x, y);
      });
      feet(cam, Wc, font);
      trialOverlay(cam, Wc, Hc, font);
    }
    // The ground at your feet (or the hero's): a small 3D plot that never turns, east to the right and north away from
    // you.  The surface is J near the spot, its heights stretched so the tilt shows; on it the four taps, the slope ∇J
    // climbing it and downhill going down it, with their shadows on the floor; the gold arrow on the floor is the way
    // the view faces, and on the floor's edge are the others, where they stand from here.
    var plot3 = { key: '', model: null };
    function feet(cam, Wc, font) {
      var m = api.model(), land = m.land, here = cam.pose ? cam.pose.pos : [cam.x, cam.y];
      var W3 = Math.round(clamp(Wc * 0.21, 176, 250)), H3 = Math.round(W3 * 0.84), bx = Wc - W3 - 10, by = 8;
      regions.disc = [bx, by, W3, H3 + 22];
      var taps = null, g = null, extra = null, title = 'The ground at your feet';
      if (ride) {
        var o = cam.pose, rec = o && o.rec;
        title = 'Ground at ' + NAMES[ride] + '’s feet';
        if (rec && (ride === 'pg' || ride === 'lb')) { taps = rec.taps; g = rec.g; if (ride === 'lb') extra = { move: [rec.x[0] - rec.from[0], rec.x[1] - rec.from[1]] }; }
        if (rec && ride === 'tw') extra = { v: [rec.v[0] - rec.from[0], rec.v[1] - rec.from[1]], to: [rec.x[0] - rec.from[0], rec.x[1] - rec.from[1]] };
      } else if (felt && tnow() - felt.time < 12000) { taps = felt.taps; g = felt.g; }
      // the heights on a grid around the spot, kept until the spot or the land changes
      var L = Math.max(4.5 * land.h, 0.045 * span()), n = 14, key = here[0].toFixed(6) + ',' + here[1].toFixed(6) + ',' + L;
      if (plot3.key !== key || plot3.model !== m) {
        var vals = [], lo = Infinity, hi = -Infinity;
        for (var i = 0; i <= n; i++) { vals.push([]); for (var j = 0; j <= n; j++) { var z = land.J([here[0] + L * (2 * i / n - 1), here[1] + L * (2 * j / n - 1)]); vals[i].push(z); lo = Math.min(lo, z); hi = Math.max(hi, z); } }
        plot3 = { key: key, model: m, vals: vals, lo: lo, hi: hi, J0: land.J(here) };
      }
      var P3 = plot3, J0 = P3.J0, dev = Math.max(P3.hi - J0, J0 - P3.lo, 1e-12), gam = 0.5, el = 0.62, ce = Math.cos(el), se = Math.sin(el);
      var k = W3 * 0.33 / L, zs = H3 * 0.22 / dev, cxp = bx + W3 / 2, cyp = by + H3 * 0.62, zBase = (P3.lo - J0) - 0.2 * dev;
      function pr(e, nn, z) { var u = e * Math.cos(gam) - nn * Math.sin(gam), w = e * Math.sin(gam) + nn * Math.cos(gam); return [cxp + k * u, cyp - k * w * se - z * zs * ce, w]; }
      function zAt(e, nn) { return land.J([here[0] + e, here[1] + nn]) - J0; }
      octx.save();
      octx.fillStyle = 'rgba(8,12,18,0.7)'; octx.beginPath(); if (octx.roundRect) octx.roundRect(bx, by, W3, H3 + 22, 10); else octx.rect(bx, by, W3, H3 + 22); octx.fill();
      octx.beginPath(); octx.rect(bx, by, W3, H3); octx.clip();
      // the floor, with the compass on it
      var fl = [pr(-L, -L, zBase), pr(L, -L, zBase), pr(L, L, zBase), pr(-L, L, zBase)];
      octx.fillStyle = 'rgba(242,245,248,0.06)'; octx.strokeStyle = 'rgba(242,245,248,0.35)'; octx.lineWidth = 1;
      octx.beginPath(); fl.forEach(function (q, i) { if (i) octx.lineTo(q[0], q[1]); else octx.moveTo(q[0], q[1]); }); octx.closePath(); octx.fill(); octx.stroke();
      function floorArrow(dir, len, colour, width, dash) {
        var a = pr(0, 0, zBase), b = pr(dir[0] * len, dir[1] * len, zBase), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        octx.strokeStyle = colour; octx.fillStyle = colour; octx.lineWidth = width; if (dash) octx.setLineDash(dash);
        octx.beginPath(); octx.moveTo(a[0], a[1]); octx.lineTo(b[0], b[1]); octx.stroke(); octx.setLineDash([]);
        octx.beginPath(); octx.moveTo(b[0], b[1]); octx.lineTo(b[0] - 7 * Math.cos(ang - 0.45), b[1] - 7 * Math.sin(ang - 0.45)); octx.lineTo(b[0] - 7 * Math.cos(ang + 0.45), b[1] - 7 * Math.sin(ang + 0.45)); octx.fill();
      }
      octx.font = '700 11px ' + font; octx.textAlign = 'center'; octx.textBaseline = 'middle';
      [['N', [0, 1]], ['E', [1, 0]], ['S', [0, -1]], ['W', [-1, 0]]].forEach(function (d) { var q = pr(d[1][0] * L * 1.13, d[1][1] * L * 1.13, zBase); octx.fillStyle = d[0] === 'N' ? '#ffd27a' : 'rgba(242,245,248,0.85)'; octx.fillText(d[0], q[0], q[1]); });
      // the surface, far squares first
      var quads = [];
      for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
        var e0 = L * (2 * i / n - 1), e1 = L * (2 * (i + 1) / n - 1), n0 = L * (2 * j / n - 1), n1 = L * (2 * (j + 1) / n - 1), V = P3.vals;
        var c4 = [pr(e0, n0, V[i][j] - J0), pr(e1, n0, V[i + 1][j] - J0), pr(e1, n1, V[i + 1][j + 1] - J0), pr(e0, n1, V[i][j + 1] - J0)];
        quads.push({ c: c4, w: (c4[0][2] + c4[2][2]) / 2, t: ((V[i][j] + V[i + 1][j] + V[i + 1][j + 1] + V[i][j + 1]) / 4 - P3.lo) / Math.max(P3.hi - P3.lo, 1e-12) });
      }
      quads.sort(function (a, b) { return b.w - a.w; });
      octx.lineWidth = 0.6; octx.strokeStyle = 'rgba(8,12,18,0.45)';
      quads.forEach(function (q) {
        var t = q.t, r = t < 0.5 ? 62 + (212 - 62) * t * 2 : 212 + (198 - 212) * (t * 2 - 1), gg = t < 0.5 ? 108 + (218 - 108) * t * 2 : 218 + (124 - 218) * (t * 2 - 1), b = t < 0.5 ? 158 + (210 - 158) * t * 2 : 210 + (66 - 210) * (t * 2 - 1);
        octx.fillStyle = 'rgba(' + Math.round(r) + ',' + Math.round(gg) + ',' + Math.round(b) + ',0.9)';
        octx.beginPath(); q.c.forEach(function (c, i) { if (i) octx.lineTo(c[0], c[1]); else octx.moveTo(c[0], c[1]); }); octx.closePath(); octx.fill(); octx.stroke();
      });
      // the spot: a pin from the floor
      var top = pr(0, 0, 0), foot = pr(0, 0, zBase);
      octx.strokeStyle = '#f2f5f8'; octx.lineWidth = 1.2; octx.setLineDash([3, 3]); octx.beginPath(); octx.moveTo(foot[0], foot[1]); octx.lineTo(top[0], top[1]); octx.stroke(); octx.setLineDash([]);
      // an arrow along the surface from the spot, and its shadow on the floor
      function surfArrow(dir, len, colour, width, text) {
        var pts = []; for (var s = 0; s <= 12; s++) { var e = dir[0] * len * s / 12, nn = dir[1] * len * s / 12; pts.push(pr(e, nn, zAt(e, nn))); }
        if (colour !== '#ffd27a') floorArrow(dir, len, colour === '#f2f5f8' ? 'rgba(242,245,248,0.45)' : 'rgba(255,176,113,0.5)', 1.2, [3, 3]);
        octx.strokeStyle = 'rgba(8,12,18,0.8)'; octx.lineWidth = width + 2.5; octx.beginPath(); pts.forEach(function (q, i) { if (i) octx.lineTo(q[0], q[1]); else octx.moveTo(q[0], q[1]); }); octx.stroke();
        octx.strokeStyle = colour; octx.fillStyle = colour; octx.lineWidth = width; octx.beginPath(); pts.forEach(function (q, i) { if (i) octx.lineTo(q[0], q[1]); else octx.moveTo(q[0], q[1]); }); octx.stroke();
        var b = pts[12], a = pts[10], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        octx.beginPath(); octx.moveTo(b[0], b[1]); octx.lineTo(b[0] - 8 * Math.cos(ang - 0.45), b[1] - 8 * Math.sin(ang - 0.45)); octx.lineTo(b[0] - 8 * Math.cos(ang + 0.45), b[1] - 8 * Math.sin(ang + 0.45)); octx.fill();
        if (text) { octx.font = '700 11px ' + font; octx.lineWidth = 3; octx.strokeStyle = 'rgba(8,12,18,0.85)'; octx.strokeText(text, b[0] + 6, b[1] - 6); octx.fillText(text, b[0] + 6, b[1] - 6); }
      }
      surfArrow([Math.cos(cam.heading), Math.sin(cam.heading)], 0.6 * L, '#ffd27a', 2, ride ? '' : 'you face');
      if (g && Math.hypot(g[0], g[1]) > 1e-12) {
        var gn = Math.hypot(g[0], g[1]), u = [g[0] / gn, g[1] / gn];
        surfArrow([-u[0], -u[1]], 0.8 * L, '#f2f5f8', 3, '');
        surfArrow(u, 0.8 * L, '#ffb071', 3, '∇J');
      }
      if (extra && extra.move && Math.hypot(extra.move[0], extra.move[1]) > 1e-12) { var ml = Math.hypot(extra.move[0], extra.move[1]); surfArrow([extra.move[0] / ml, extra.move[1] / ml], 0.95 * L, '#a9cdf6', 2, 'd'); }
      if (extra && extra.v) {
        [[extra.v, '#a9cdf6', 'v'], [extra.to, '#ffb071', 'new x']].forEach(function (q) {
          var d = Math.hypot(q[0][0], q[0][1]), sc = d > 0.95 * L ? 0.95 * L / d : 1, e = q[0][0] * sc, nn = q[0][1] * sc, a = pr(e, nn, d > 0.95 * L ? zBase : zAt(e, nn));
          octx.fillStyle = q[1]; octx.beginPath(); octx.arc(a[0], a[1], 4, 0, TAU); octx.fill(); octx.font = '700 10.5px ' + font; octx.fillText(q[2] + (d > 0.95 * L ? ' →' : ''), a[0] + 6, a[1] - 5);
        });
      }
      if (taps) {
        var mid = taps.reduce(function (a, b) { return a + b.J; }, 0) / 4;
        taps.forEach(function (tp, i) {
          var e = tp.at[0] - here[0], nn = tp.at[1] - here[1], q = pr(e, nn, tp.J - J0);
          octx.fillStyle = tp.J > mid ? '#ffb071' : '#a9cdf6'; octx.strokeStyle = 'rgba(8,12,18,0.9)'; octx.lineWidth = 1.5; octx.beginPath(); octx.arc(q[0], q[1], 3.4, 0, TAU); octx.fill(); octx.stroke();
        });
      }
      octx.fillStyle = '#f2f5f8'; octx.beginPath(); octx.arc(top[0], top[1], 3.6, 0, TAU); octx.fill();
      // which way is east and north, always in view in the box's corner; then the others on the floor's rim
      var o0 = [bx + 26, by + 40], pe = pr(1, 0, 0), pn = pr(0, 1, 0), p0 = pr(0, 0, 0);
      [['E', [pe[0] - p0[0], pe[1] - p0[1]], 'rgba(242,245,248,0.9)'], ['N', [pn[0] - p0[0], pn[1] - p0[1]], '#ffd27a']].forEach(function (a) {
        var l = Math.hypot(a[1][0], a[1][1]) || 1, ex = o0[0] + a[1][0] / l * 20, ey = o0[1] + a[1][1] / l * 20, an = Math.atan2(ey - o0[1], ex - o0[0]);
        octx.strokeStyle = a[2]; octx.fillStyle = a[2]; octx.lineWidth = 2; octx.beginPath(); octx.moveTo(o0[0], o0[1]); octx.lineTo(ex, ey); octx.stroke();
        octx.beginPath(); octx.moveTo(ex, ey); octx.lineTo(ex - 6 * Math.cos(an - 0.5), ey - 6 * Math.sin(an - 0.5)); octx.lineTo(ex - 6 * Math.cos(an + 0.5), ey - 6 * Math.sin(an + 0.5)); octx.fill();
        octx.font = '700 11px ' + font; octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.fillText(a[0], ex + a[1][0] / l * 9, ey + a[1][1] / l * 9);
      });
      var t3 = clock(), marks = [];
      ['pg', 'lb', 'tw'].forEach(function (kk) { if (ride !== kk && api.shownAll()[kk]) marks.push([pose(kk, t3.k, fOf(kk, t3)).pos, kk === 'pg' ? '#ffb071' : kk === 'lb' ? '#a9cdf6' : '#f2f5f8', kk === 'pg' ? 'P' : kk === 'lb' ? 'C' : 'Wa', kk]); });
      marks.push([kingAt(), '#ffd27a', 'K', 'king']);
      if (reveal) marks.push([m.land.treasure, '#ff8a3d', '★', 'star']);
      rimMarks = [];
      marks.forEach(function (mk) {
        var dx = mk[0][0] - here[0], dy = mk[0][1] - here[1]; if (Math.hypot(dx, dy) < 1e-9) return;
        var a = Math.atan2(dy, dx), c = Math.cos(a), sn = Math.sin(a), r = L / Math.max(Math.abs(c), Math.abs(sn)), q = pr(c * r, sn * r, zBase);
        octx.fillStyle = 'rgba(8,12,18,0.85)'; octx.beginPath(); octx.arc(q[0], q[1], mk[2].length > 1 ? 9 : 7.5, 0, TAU); octx.fill();
        octx.fillStyle = mk[1]; octx.font = '700 10px ' + font; octx.fillText(mk[2], q[0], q[1] + 0.5);
        rimMarks.push({ who: mk[3], at: q });
      });
      octx.restore();
      octx.font = '600 10.5px ' + font; octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.fillStyle = '#f2f5f8';
      octx.fillText(title, bx + W3 / 2, by + H3 + 11);
    }

    // ------------------------------------------------------------ the status bar and the captions
    function hud(cam, poses) {
      var m = api.model(), land = m.land, t = clock(), here = cam.pose ? cam.pose.pos : [cam.x, cam.y], g = land.grad(here);
      $('hud-day').textContent = race.on ? race.turn + '/' + race.maxTurns : String(t.k);
      $('hud-height').textContent = num(land.J(here), 3);
      $('hud-slope').textContent = num(Math.hypot(g[0], g[1]), 2);
      $('hud-role').textContent = ride ? TITLES[ride].replace('The ', '') : 'You';
      $('hud-role').setAttribute('data-who', ride || 'you');
      var nb = nearest(), ears = listeners();
      var SHORT = { pg: 'Pilgrim', lb: 'Cartog.', tw: 'Wanderer', wd: 'Warden', king: 'King' };
      $('hud-near').textContent = nb ? SHORT[nb.who] + ' ' + num(nb.d, 2) : '—';
      $('fog-talk').disabled = !ride && !ears.length;
      $('fog-leave').hidden = !ride; $('fog-cam').hidden = !ride; $('fog-cam-label').textContent = { map: '3D from afar', afar: '3D from behind', behind: 'Map' }[followMode];
      Array.prototype.forEach.call(document.querySelectorAll('[data-ride]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ride') === (ride || 'you'))); });
      $('fog-walk-label').textContent = api.playing() ? 'Pause' : 'Walk on';
      caption(poses, cam, ears);
    }
    var captionNow = '';
    function setCaption(el, html) { if (html !== captionNow) { captionNow = html; el.innerHTML = html; } }
    function caption(poses, cam, ears) {
      var el = $('fog-caption');
      if (!showCaptions || dialog) { el.hidden = true; return; }
      el.hidden = false;
      if (toast && performance.now() - toast.time < 5000) { setCaption(el, toast.html); return; }
      if (!ride) {
        if (felt && tnow() - felt.time < 12000) { setCaption(el, felt.html); return; }
        setCaption(el, ears.length
          ? 'Press <kbd>E</kbd> to talk to ' + NAMES[ears[0].who] + (ears.length > 1 ? ' (or turn to face someone else)' : '') + '.'
          : 'Walk with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrow keys, drag to look, <kbd>F</kbd> to feel the slope with your staff, <kbd>N</kbd> for the next day.');
        return;
      }
      setCaption(el, narrate(cam.pose));
    }
    function narrate(o) {
      var m = api.model(), p = m.p, land = m.land, rec = o.rec, h = land.h;
      if (!rec) {
        var walk = m.walks[o.h], off = ' Press <kbd>Esc</kbd> to step off.';
        if (walk.lost != null) return '<b>Lost.</b> The strides grew without end and carried ' + NAMES[o.h] + ' off the map.' + off;
        if (o.h === 'lb' && walk.why === 'line search') return '<b>Stalled.</b> No stride, however short, lowered the land by enough' + (land.sigma > 0 ? ': in the haze my taps contradict each other' : ': along my course this is as low as I can measure') + ', so I stop here.' + off;
        if (walk.rest != null) {
          var lastRec = walk[walk.length - 1], gEnd = land.grad(lastRec.x), steep = Math.hypot(gEnd[0], gEnd[1]) > 1e-3, edge = m.key === 'wall' ? 'the wall' : 'the edge of the realm';
          if (o.h === 'pg' && lastRec.clipped) return '<b>Held.</b> The slope here is ' + num(Math.hypot(gEnd[0], gEnd[1]), 3) + ', pushing me outward, and ' + edge + ' sets me back to the same spot each day.' + off;
          if (o.h === 'tw' && lastRec.u && Math.hypot(lastRec.u[0], lastRec.u[1]) > 1e-6) return '<b>Held.</b> My twin and I agree at last. The Warden stands where the law allows, and our ledger holds the law’s push on us, u = ' + pair(lastRec.u, 3) + '.' + off;
          if (o.h === 'lb' && steep && land.box) return '<b>Held.</b> On my stretched map ' + edge + ' is infinitely far away, so the slope I feel fades to nothing as I near it.' + off;
          if (steep) return '<b>Held.</b> The slope here is ' + num(Math.hypot(gEnd[0], gEnd[1]), 3) + ', but my rule makes no more progress.' + off;
          return '<b>Rest.</b> The ground is flat here, so ' + NAMES[o.h] + ' rests.' + off;
        }
        return '<b>Out of days.</b> Day ' + m.K + ' was the last day the King gave us, and I was still walking.' + off;
      }
      var taps = rec.taps, tapLine = function (n) { return taps.slice(0, n).map(function (tp, i) { return ['east', 'west', 'north', 'south'][i] + ' ' + num(tp.J, 4); }).join(' · '); };
      if (o.h === 'pg' || o.h === 'lb') {
        if (o.phase === 'feel') return '<b>Feel.</b> I tap the ground a staff’s length h = ' + num(h, 3) + ' to the east, west, north and south, and note the height J at each: ' + tapLine(Math.min(4, Math.floor(o.u * 4) + 1)) + '.';
        if (o.phase === 'reckon') return '<b>Reckon.</b> East minus west and north minus south, each over 2h = ' + num(2 * h, 3) + ', give the slope ∇J ≈ ' + pair(rec.gFelt, 3) + ': it points uphill.' + (land.sigma > 0 ? ' In this haze I use it as it is.' : ' The formula gives exactly ' + pair(rec.gTrue, 3) + ', which I use.') + ' <kbd>B</kbd> shows every step.';
      }
      if (o.h === 'pg') {
        var dn = heading([-rec.g[0], -rec.g[1]]);
        if (o.phase === 'turn') return '<b>Turn.</b> I face −∇J, straight downhill: bearing ' + bearing(dn) + '°, ' + compass(dn) + '.';
        return '<b>Stride.</b> x ← x − α∇J = ' + pair(rec.from, 3) + ' − ' + num(p.alpha, 3) + '·' + pair(rec.g, 3) + ' = ' + pair(rec.raw, 3) +
          (rec.clipped ? '; the ' + (m.key === 'wall' ? 'wall' : 'edge') + ' sets me back to ' + pair(rec.x, 3) : '') + '. Height ' + num(o.here.J, 4) + ' → ' + num(rec.J, 4) + '.';
      }
      if (o.h === 'lb') {
        var mv = [rec.x[0] - rec.from[0], rec.x[1] - rec.from[1]], base = heading(mapDownhill(rec.from, rec.g)), turn = degrees(heading(mv), base), lean = degrees(base, heading([-rec.g[0], -rec.g[1]]));
        var mapNote = land.box ? ' I walk on a stretched map that keeps me inside the box; on it, straight downhill leans ' + lean + '° away from the edges.' : '';
        if (o.phase === 'journal') return '<b>Journal.</b> ' + (rec.restart ? 'My journal pointed uphill, so I tore the pages out and go straight downhill.' : rec.pages ? 'My last ' + rec.pages + ' pages, each a stride and the change of slope over it, tell me how the land curves. They turn me ' + turn + '° from straight downhill.' : 'My journal is empty, so I go straight downhill.') + mapNote;
        if (o.phase === 'trials') {
          var tr = rec.trials || [], parts = tr.slice(0, 3).map(function (q) { return 'stride ' + strideName(q.step) + ': ' + num(q.f, 4) + ' > ' + num(q.need, 4) + ' ✗'; });
          if (tr.length > 3) parts.push('… ' + (tr.length - 3) + ' more ✗');
          parts.push('stride ' + strideName(rec.step) + ': ' + num(rec.felt, 4) + ' ≤ ' + num(rec.need, 4) + ' ✓');
          return '<b>Try strides.</b> A stride must lower the land by enough (Armijo): ' + parts.join(' · ') + '.';
        }
        if (o.phase === 'turn') return '<b>Turn.</b> I face the journal’s direction, bearing ' + bearing(heading(mv)) + '°.';
        return '<b>Stride.</b> I take the stride of ' + strideName(rec.step) + ': ' + pair(rec.from, 3) + ' → ' + pair(rec.x, 3) + '. Height ' + num(o.here.J, 4) + ' → ' + num(rec.J, 4) + '. ' +
          (rec.wrote ? 'I write it in my journal as a new page' + (rec.dropped && rec.dropped.length ? '; the journal was full, so the oldest page, from day ' + rec.dropped[0].day + ', leaves.' : '.') : Math.round(m.p.m) ? 'No new page today: the slope did not grow along this stride.' : '');
      }
      // the Wanderer
      if (o.phase === 'anchor') return '<b>Rope target.</b> The game calls the derived point v my “aim”; it is not another copy. My twin the Warden stands at z = ' + pair(rec.zFrom, 3) + ' and the ledger reads u = ' + pair(rec.uFrom, 3) + ', so the rope target is v = z − u = ' + pair(rec.v, 3) + '.';
      if (o.phase === 'walk') return '<b>Walk.</b> I seek the lowest spot of my height plus the rope’s pull, ρ/2·|x − v|² with ρ = ' + num(p.rho, 2) + '. ' +
        (rec.exact ? 'On this land the formula gives it: ' + pair(rec.x, 3) + '.' : 'I walk down that sum in ' + Math.max(rec.path.length - 1, 0) + ' small steps to ' + pair(rec.x, 3) + '.');
      if (o.phase === 'warden') return '<b>Warden.</b> My twin takes the lawful spot nearest x + u: z = Π<sub>C</sub>' + pair([rec.x[0] + rec.uFrom[0], rec.x[1] + rec.uFrom[1]], 3) + ' = ' + pair(rec.z, 3) + '.';
      return '<b>Ledger.</b> The ledger adds today’s gap x − z = ' + pair([rec.x[0] - rec.z[0], rec.x[1] - rec.z[1]], 3) + ': u = ' + pair(rec.u, 3) + '.';
    }
    function say(html) { toast = { html: html, time: performance.now() }; }
    function dayZero() { api.restart(); say('Every hero is back at the start flag, on day 0.'); }

    // ------------------------------------------------------------ who is near, talking
    function who() {
      var m = api.model(), t = clock(), out = [], shown = api.shown();
      ['pg', 'lb', 'tw'].forEach(function (h) { if (shown[h]) out.push({ who: h, at: pose(h, t.k, fOf(h, t)).pos }); });
      if (shown.tw) out.push({ who: 'wd', at: pose('tw', t.k, fOf('tw', t)).z });
      out.push({ who: 'king', at: kingAt() });
      void m;
      return out;
    }
    function nearest() {
      var here = ride ? null : [player.x, player.y]; if (!here) return null;
      var best = null;
      who().forEach(function (n) { var d = dist(here, n.at); if (!best || d < best.d) best = { who: n.who, d: d }; });
      return best;
    }
    // Everyone within earshot, the one you face first.
    function listeners() {
      if (ride) return [];
      var here = [player.x, player.y], out = [];
      who().forEach(function (n) {
        var d = dist(here, n.at); if (d > 0.14 * span()) return;
        out.push({ who: n.who, d: d, a: d < 1e-9 ? 0 : Math.abs(wrapAngle(heading([n.at[0] - here[0], n.at[1] - here[1]]) - player.heading)) });
      });
      out.sort(function (p, q) { return p.a - q.a || p.d - q.d; });
      return out;
    }
    function talk(target) {
      if (ride) { openDialogue(ride); return; }
      if (target) { openDialogue(target); return; }
      var c = listeners();
      if (!c.length) { var far = nearest(); say(far ? 'No one is near enough to hear you. ' + TITLES[far.who] + ' is ' + num(far.d, 2) + ' away.' : 'No one is near.'); return; }
      var want = trial.on && trial.state === 'run' ? (STEPS[trial.i].target || {}).npc : null, hit = c.filter(function (q) { return q.who === want; })[0];
      if (hit) { openDialogue(hit.who); return; }
      // Someone clearly in front: speak to them.  Several side by side: ask whom.
      var close = c.filter(function (q) { return q.a < c[0].a + 0.3; });
      if (close.length === 1) { openDialogue(c[0].who); return; }
      showNode({ npc: 'you', text: 'Several people stand before you. Whom do you speak to?',
                 choices: close.map(function (q) { return { label: TITLES[q.who] + '.', go: function () { openDialogue(q.who); return null; } }; })
                   .concat([{ label: 'No one.', go: function () { return null; } }]) });
    }
    function scripts(npc) {
      var m = api.model(), p = m.p, land = m.land, t = clock(), w, rec, here, when = 'Today', lower = 'today';
      var restart = function (text) { return function () { api.restart(); return node(npc, text + ' We all begin again from the flag.'); }; };
      if (npc === 'pg' || npc === 'lb' || npc === 'tw') {
        w = m.walks[npc]; here = w[Math.min(t.k, w.length - 1)];
        if (t.k + 1 < w.length) rec = w[t.k + 1];
        else if (w.length > 1) { rec = w[w.length - 1]; when = 'On day ' + (w.length - 1); lower = 'on day ' + (w.length - 1); }
        else rec = null;
      }
      var noStep = 'I have not taken a single step: on day 1 no stride lowered the land by enough' + (land.sigma > 0 ? ', because in the haze my taps contradict each other.' : '.');
      if (npc === 'pg') return {
        text: 'Day ' + t.k + '. I carry no map and no memory, only a staff. I stand at height ' + num(here.J, 4) + '.',
        choices: [
          { label: 'How do you find the way down?', go: function () {
            if (!rec) return node('pg', noStep);
            var taps = rec.taps, h = land.h;
            return node('pg', when + ' I tapped the ground a staff’s length away, h = ' + num(h, 3) + ': east ' + num(taps[0].J, 4) + ', west ' + num(taps[1].J, 4) + ', north ' + num(taps[2].J, 4) + ', south ' + num(taps[3].J, 4) + '. ' +
              'East minus west over 2h is how fast the land rises eastward, ' + num(rec.gFelt[0], 3) + '; north minus south gives ' + num(rec.gFelt[1], 3) + '. That pair is the gradient. It points uphill, so I walk the other way, α = ' + num(p.alpha, 3) + ' times its length.' +
              (land.sigma > 0 ? ' In this haze every tap is off by about ' + num(land.sigma, 4) + ', so my slope is off by about σ/(√2 h) = ' + num(land.sigma / Math.SQRT2 / h, 3) + '.' : ' In clear air my taps agree with the land’s formula, ' + pair(rec.gTrue, 3) + '.') +
              (land.box ? ' If a stride would cross the ' + (m.key === 'wall' ? 'wall' : 'edge') + ', I step back to the nearest spot inside.' : ''));
          } },
          { label: 'Take longer strides (α = ' + num(api.limit('alpha', p.alpha * 2), 3) + ').', go: function () { var v = api.limit('alpha', p.alpha * 2); if (v === p.alpha) return node('pg', 'My strides cannot be any longer.'); api.setParam('alpha', v); return restart('My stride is now α = ' + num(v, 3) + '.')(); } },
          { label: 'Take shorter strides (α = ' + num(api.limit('alpha', p.alpha / 2), 3) + ').', go: function () { var v = api.limit('alpha', p.alpha / 2); if (v === p.alpha) return node('pg', 'My strides cannot be any shorter.'); api.setParam('alpha', v); return restart('My stride is now α = ' + num(v, 3) + '.')(); } },
          { label: 'Let me follow you for a while.', go: function () { startRide('pg'); return null; } },
          { label: 'Farewell.', go: function () { return null; } }
        ] };
      if (npc === 'lb') return {
        text: 'Day ' + t.k + '. My journal holds my last ' + Math.round(p.m) + ' strides, each with how the slope changed over it. I stand at height ' + num(here.J, 4) + '.',
        choices: [
          { label: 'How does your journal help?', go: function () {
            if (!rec) return node('lb', noStep);
            var mv = [rec.x[0] - rec.from[0], rec.x[1] - rec.from[1]], base = heading(mapDownhill(rec.from, rec.g)), turn = degrees(heading(mv), base);
            var tr = (rec.trials || []).map(function (q) { return strideName(q.step); });
            return node('lb', 'A stride and the change of slope it brought tell me how the land curves along that stride. ' +
              (rec.pages ? 'From my last ' + rec.pages + ' pages I bend my straight-downhill direction, ' + lower + ' by ' + turn + '°. ' : when + ' my journal was empty, so I went straight downhill. ') +
              (land.box ? 'I walk on a stretched map that keeps me inside the box; on it, straight downhill leans ' + degrees(base, heading([-rec.g[0], -rec.g[1]])) + '° away from the edges. ' : '') +
              'Then I try a full stride; if the land is not lower by enough, I halve it. ' +
              (tr.length ? when + ' I tried ' + tr.join(', ') + ' and took ' + strideName(rec.step) + '.' : when + ' the full stride was low enough.') +
              (land.sigma > 0 ? ' In haze my taps can lie, and a lucky low tap can make every stride look too high; then I stop.' : ''));
          } },
          { label: 'Show me your journal.', go: function () {
            if (w.length < 2) return node('lb', 'My journal has no pages: ' + noStep.charAt(0).toLowerCase() + noStep.slice(1));
            var kk = Math.max(0, Math.min(t.k, w.length - 2));
            if (kk !== t.k) api.setDay(kk);
            startRide('lb'); api.jumpTo(PHASES.lb.ends[0] + 0.02); return null;
          } },
          { label: 'Keep more pages (m = ' + Math.min(20, Math.round(p.m) + 5) + ').', go: function () { api.setParam('m', Math.min(20, Math.round(p.m) + 5)); return restart('My journal is longer now.')(); } },
          { label: 'Keep fewer pages (m = ' + Math.max(0, Math.round(p.m) - 5) + ').', go: function () { var v = Math.max(0, Math.round(p.m) - 5); api.setParam('m', v); return restart(v ? 'My journal is shorter now.' : 'With no pages I am a Pilgrim who chooses each stride.')(); } },
          { label: 'Let me follow you for a while.', go: function () { startRide('lb'); return null; } },
          { label: 'Farewell.', go: function () { return null; } }
        ] };
      if (npc === 'tw') return {
        text: 'Day ' + t.k + '. I go where the land is low, but a rope ties me to my twin, the Warden, and our ledger keeps count of where we disagree.',
        choices: [
          { label: 'How do you choose where to go?', go: function () {
            if (!rec) return node('tw', 'We have not moved yet.');
            return node('tw', 'My twin stands at z = ' + pair(here.z, 3) + ' and the ledger reads u = ' + pair(here.u, 3) + ', so I aim for v = z − u = ' + pair(rec.v, 3) + '. ' +
              'I go to the spot where my height plus the rope’s pull, ρ/2·|x − v|², is lowest. With ρ = ' + num(p.rho, 2) + ' the rope lets me range about ' + num(rec.reach, 2) + ' from v. ' +
              (rec.exact ? 'On this land a formula gives that spot exactly.' : 'On this land no formula gives it, so I approximately solve the Wanderer’s update with small downhill steps.'));
          } },
          { label: 'Tighten the rope (ρ = ' + num(api.limit('rho', p.rho * 2), 2) + ').', go: function () { var v = api.limit('rho', p.rho * 2); if (v === p.rho) return node('tw', 'The rope cannot be any tighter.'); api.setParam('rho', v); return restart('The rope’s tension is now ρ = ' + num(v, 2) + '.')(); } },
          { label: 'Loosen the rope (ρ = ' + num(api.limit('rho', p.rho / 2), 2) + ').', go: function () { var v = api.limit('rho', p.rho / 2); if (v === p.rho) return node('tw', 'The rope cannot be any looser.'); api.setParam('rho', v); return restart('The rope’s tension is now ρ = ' + num(v, 2) + '.')(); } },
          { label: 'Let me follow you for a while.', go: function () { startRide('tw'); return null; } },
          { label: 'Farewell.', go: function () { return null; } }
        ] };
      if (npc === 'wd') {
        var tw = m.walks.tw, hz = tw[Math.min(t.k, tw.length - 1)], lawText = land.kind === 'tower' ? 'on the blue road between the two lawful corners' : land.box ? (m.key === 'wall' ? 'inside the kingdom wall' : 'inside the edge of the realm') : 'anywhere: this land has no law';
        return {
          text: 'I am the Warden. I stand only where the law allows: ' + lawText + '.',
          choices: [
            { label: 'Where do you stand?', go: function () { return node('wd', 'Each day I take the lawful spot nearest my twin plus the ledger, z = Πᴄ(x + u). Today that is ' + pair(hz.z, 3) + '.' + (land.box || land.kind === 'tower' ? '' : ' With no law I simply stand where my twin stands.')); } },
            { label: 'What is in the ledger?', go: function () {
              var kk = Math.min(t.k, tw.length - 1), oldz = tw[Math.max(0, kk - 1)].z, primal = dist(hz.x, hz.z), dual = p.rho * dist(hz.z, oldz), extra = '';
              if (m.key === 'wall') { var xs = land.treasure, gs = land.grad(xs); extra = ' At a settled solution, ρu balances the slope: ρu = −∇J(x*) = ' + pair([-gs[0], -gs[1]], 3) + '.'; }
              return node('wd', 'The ledger u is the scaled dual variable. It adds each day’s signed gap x − z and now reads ' + pair(hz.u, 3) + '. We stop only when both tests are small: the primal residual |x − z| = ' + num(primal, 4) + ', and the dual residual ρ|new z − old z| = ' + num(dual, 4) + '. Agreement alone is not enough.' + extra);
            } },
            { label: 'Farewell.', go: function () { return null; } }
          ] };
      }
      // the King
      return {
        text: 'Welcome, apprentice. This is ' + api.landName(m.key) + '. My heroes seek ' + (land.kind === 'tower' ? 'my true order, ' + flags(land.treasure) : land.box ? 'the treasure, the lowest spot inside ' + (m.key === 'wall' ? 'my wall' : 'the realm') : 'the treasure, the lowest spot of the land') + '. Walk where you like.',
        choices: [
          { label: 'Show me another land…', go: function () {
            return { text: 'Which land?', choices: ['canyon', 'wall', 'fort', 'ridge', 'misty'].map(function (k) { return { label: api.landName(k), go: function () { api.setLand(k); api.restart(); return node('king', 'Here is ' + api.landName(k) + '. My heroes stand at the start flag, on day 0.'); } }; }).concat([{ label: 'Back.', go: function () { return scripts('king'); } }]) };
          } },
          { label: 'Change the weather…', go: function () {
            var q = api.model().p;
            return { text: 'The ripples are ' + Math.round(100 * q.ripA) + '% of the land’s height, the haze is ' + num(100 * q.haze, 1) + '%, and ' + (Math.round(q.holes || 0) ? Math.round(q.holes) + ' black holes lie in the fog' : 'no black holes are open') + '. What shall it be?', choices: [
              { label: 'Make the land wavier.', go: function () { api.setParams({ ripA: Math.min(0.3, (q.ripA || 0) + 0.03) }); return restart('The land ripples more.')(); } },
              { label: 'Calm the land.', go: function () { api.setParams({ ripA: 0 }); return restart('The land is smooth again.')(); } },
              { label: 'Thicken the haze.', go: function () { api.setParams({ haze: q.haze > 0 ? Math.min(0.03, q.haze * 2) : 0.002 }); return restart('Every tap of the ground is less certain now.')(); } },
              { label: 'Clear the air.', go: function () { api.setParams({ haze: 0 }); return restart('The air is clear: every tap tells the truth.')(); } },
              { label: 'Open two more black holes.', go: function () { api.setParams({ holes: Math.min(8, Math.round(q.holes || 0) + 2) }); return restart('Two more black holes open somewhere in the fog.')(); } },
              { label: 'Close the black holes.', go: function () { api.setParams({ holes: 0 }); return restart('The black holes are closed.')(); } },
              { label: 'New weather.', go: function () { api.setParams({ seed: 1 + Math.floor(Math.random() * 999), ripA: q.ripA || 0.05 }); return restart('New ripples cross the land, and any black holes move.')(); } },
              { label: 'Back.', go: function () { return scripts('king'); } }
            ] };
          } },
          { label: fogDist < 1.2 ? 'Lift the fog.' : 'Bring the fog back.', go: function () { fogDist = fogDist < 1.2 ? 1.6 : 0.6; $('fog-fog').value = fogDist; return node('king', fogDist > 1 ? 'The fog lifts. See how far the heroes have to go.' : 'The fog returns. No hero sees farther than this.'); } },
          { label: 'Where is the treasure?', go: function () { reveal = true; var T = land.treasure, d = dist([player.x, player.y], T); return node('king', 'It lies at ' + pair(T, 2) + ', ' + num(d, 2) + ' from you to the ' + compass(heading([T[0] - player.x, T[1] - player.y])) + '. I have set a beacon on it.'); } },
          { label: 'Farewell.', go: function () { return null; } }
        ] };
    }
    function node(npc, text) { var s = scripts(npc); return { npc: npc, text: text, choices: s.choices }; }
    function openDialogue(npc) {
      var s = scripts(npc); s.npc = npc;
      if (race.on) {
        s.choices = s.choices.filter(function (c) { return !/^(Take|Keep|Tighten|Loosen|Let me see|Show me|Change the|Lift the fog|Bring the fog|Where is the treasure)/.test(c.label); });
        if (npc === 'king') {
          s.text = 'Turn ' + race.turn + ' of my race. I will not tell you where the treasure lies.';
          s.choices.unshift({ label: 'How goes the race?', go: function () { var names = { you: 'you', pg: 'the Pilgrim', lb: 'the Cartographer', tw: 'the Twins' }; return { npc: 'king', text: 'Lowest first: ' + standings().map(function (q) { return names[q.who] + ' at ' + num(q.J, 3); }).join(', ') + '.', choices: [{ label: 'Farewell.', go: function () { return null; } }] }; } });
        }
      }
      showNode(s);
    }
    function showNode(n) {
      if (!n) { closeDialogue(); return; }
      dialog = n; var npc = n.npc || dialog.npc;
      var box = $('fog-dialogue'); box.hidden = false;
      $('dlg-name').textContent = TITLES[npc] || '';
      $('dlg-name').setAttribute('data-who', npc);
      $('dlg-text').textContent = n.text;
      var list = $('dlg-choices'); list.innerHTML = '';
      n.choices.forEach(function (c, i) {
        var b = document.createElement('button'); b.type = 'button'; b.innerHTML = '<kbd>' + (i + 1) + '</kbd> ' + c.label;
        b.addEventListener('click', function () { choose(i); });
        list.appendChild(b);
      });
      n.npc = npc;
      if (!wrap.contains(document.activeElement) || document.activeElement === document.body) wrap.focus({ preventScroll: true });
      kick();
    }
    function choose(i) {
      if (!dialog || !dialog.choices[i]) return;
      var npc = dialog.npc, c = dialog.choices[i];
      if (!dialog.narration) trial.notes.choice = { npc: npc, label: c.label, at: tnow() };
      var next = c.go();
      if (next) { next.npc = next.npc || npc; showNode(next); } else if (dialog && dialog.choices.indexOf(c) >= 0) closeDialogue();
      kick();
    }
    function closeDialogue() { dialog = null; $('fog-dialogue').hidden = true; wrap.focus({ preventScroll: true }); kick(); }
    function startRide(h) { if (race.on) { say('No following a hero during the race: walk your own way.'); return; } ride = h; look.yaw = 0; look.pitch = 0; mapSince = tnow(); closeDialogue(); say('You follow ' + NAMES[h] + '. Press <kbd>N</kbd> for the next day, <kbd>P</kbd> to keep walking, <kbd>Esc</kbd> to step off.'); api.moved(); api.rideChanged(); kick(); }
    function leaveRide() {
      if (!ride) return;
      var t = clock(), o = pose(ride, t.k, fOf(ride, t));
      player.x = o.pos[0] - Math.cos(o.heading) * 0.04 * span(); player.y = o.pos[1] - Math.sin(o.heading) * 0.04 * span(); player.heading = o.heading;
      clampPlayer(); ride = null; look.yaw = 0; look.pitch = 0; api.moved(); api.rideChanged(); kick();
    }
    function feelHere() {
      if (ride) return;
      if (race.on && !spend(1, 'feel the slope')) return;
      if (race.on) explore(player.x, player.y, 0.12 * span());
      var m = api.model(), land = m.land, at = [player.x, player.y], r = E.stream(1 + Math.floor(Math.random() * 1e9));
      var res = E.feel(land, at, land.J, r), g = res.g, gT = land.grad(at), dn = heading([-g[0], -g[1]]);
      felt = { at: at, taps: res.taps, g: g, time: tnow() }; stats.feels++;
      felt.html = '<b>Your staff.</b> East ' + num(res.taps[0].J, 4) + ', west ' + num(res.taps[1].J, 4) + ', north ' + num(res.taps[2].J, 4) + ', south ' + num(res.taps[3].J, 4) +
        ' → ∇J ≈ ' + pair(g, 3) + '. Downhill is ' + compass(dn) + ' (bearing ' + bearing(dn) + '°).' + (land.sigma > 0 ? ' The haze hides the true slope, ' + pair(gT, 3) + '.' : '');
    }

    // ------------------------------------------------------------ the Apprentice's Trial: a guided tutorial in the game
    // The King gives nine lessons, one step at a time.  Each step has a goal in the quest panel, a target that is
    // highlighted (a button, a status cell, a part of the view, a dialogue answer, or someone in the world with a gold
    // beacon), and a test that ticks it off by itself.
    var TRIAL_KEY = 'kings-land-trial-v2', resumeAt = 0, trialClock = 0;
    // The trial keeps its own clock, moved on by the frames it draws, so its pauses last the same however fast frames come.
    function tnow() { return trialClock; }
    var trial = { on: false, i: 0, state: 'off', base: null, at: 0, banner: null, notes: {}, done: false, targetShown: -1, quizFeedback: '' };
    var stats = { turned: 0, walked: 0, feels: 0, started: 0, boards: 0, boardCompletions: 0 };
    var regions = {}, rimMarks = [], hlEls = [];
    var LESSONS = ['Find your feet', 'Feel the slope', 'The King’s counsel', 'The Pilgrim', 'The Cartographer', 'Change the rules', 'The Twins and the wall', 'The Old Fort and CAJODE', 'The misty hills'];
    var LESSON_WHY = [
      'Your height J is the cost: every hero wants it as low as it goes.',
      'Four taps give the slope ∇J; walking against it is gradient descent.',
      'The King knows where the lowest spot is, so you can judge the heroes.',
      'Gradient descent: each day one step, x ← x − α∇J.',
      'L-BFGS: a memory of past strides bends the course, and each stride is tested before it is taken.',
      'Too long a stride (α too big) makes gradient descent overshoot and fly off.',
      'ADMM: two copies divide the cost and the law, then the rope and ledger restore agreement.',
      'The fort shows one parity check; CAJODE scales the pattern to shared bits, many checks and an updated channel.',
      'Bumps, noise and narrow pits: what each method does when the land is hard.'
    ];
    function roman(n) { return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][n - 1] || String(n); }
    function heightHere() { return api.model().land.J([player.x, player.y]); }
    function chose(npc, text) { var c = trial.notes.choice; return !!c && c.npc === npc && c.label.indexOf(text) === 0 && c.at >= trial.base.at; }
    function talking(npc) { return !!dialog && dialog.npc === npc && !dialog.narration; }
    function today() { return api.time().day; }
    function goLand(k) { if (api.model().key !== k) api.setLand(k); }
    function downhillOf(g) { return heading([-g[0], -g[1]]); }
    var STEPS = [
      { lesson: 0, king: 'Welcome, apprentice. Fog lies on my land, and nobody sees far in it. My three heroes must still find its lowest places. Before you meet them, learn to move.',
        setup: function () { goLand('canyon'); api.restart(); ride = null; look.yaw = 0; look.pitch = 0; placePlayer(); fogDist = 0.6; reveal = false; },
        goal: 'Look around: drag across the view, or hold ← or →.', target: { dom: '#fog-stage', spot: 'centre', text: 'Drag here to look around' },
        done: function (b) { return stats.turned - b.turned > 1.2; } },
      { lesson: 0, goal: 'Walk: hold W (or ▲ on a touch screen). S walks back; A and D step sideways.', target: { dom: '#fog-stage', spot: 'centre', text: 'Hold W to walk' },
        done: function (b) { return stats.walked - b.walked > 0.05 * span(); } },
      { lesson: 0, info: true, goal: 'Your height J, and how steep the ground is under you, |∇J|. Every hero wants J as low as it goes.', target: { dom: ['#hud-height', '#hud-slope'], text: 'Your height and steepness' } },
      { lesson: 0, info: true, goal: 'The ground at your feet, as a small 3D plot that never turns: east is to the right and north away from you, marked N, E, S and W on its floor. The gold arrow on the floor is the way you face. On the floor’s edge, P is the Pilgrim, C the Cartographer, Wa the Wanderer and K the King, in the direction they stand from you.', target: { canvas: 'disc', text: 'The ground at your feet' } },
      { lesson: 1, king: 'In the fog nobody sees which way is down. You must feel it. Tap the ground with your staff.',
        goal: 'Press F, or Feel in the bar under the view.', target: { dom: '#fog-feel', text: 'Feel the slope' },
        done: function (b) { return stats.feels > b.feels; } },
      { lesson: 1, info: true, keepFelt: true, goal: 'The plot now shows your four taps on the ground around you: orange dots are higher ground, blue ones lower. The orange arrow is the gradient ∇J: it climbs the slope, uphill. The white arrow runs downhill. Their dashed shadows on the floor show which way they point. Press B to see, step by step, how the taps give ∇J.', target: { canvas: 'disc', text: 'The ground at your feet' } },
      { lesson: 1, keepFelt: true, goal: 'Face downhill: turn until the gold arrow on the plot’s floor (the way you face) points the same way as the white arrow’s shadow.', target: { canvas: 'disc', text: 'Turn the gold arrow onto the white one' },
        done: function () { return !!felt && Math.abs(wrapAngle(player.heading - downhillOf(felt.g))) < 0.3; } },
      { lesson: 1, keepFelt: true, goal: 'Walk downhill until your height falls by {drop}. Feel again (F) whenever you like.', target: { dom: '#hud-height', text: 'Watch your height fall' },
        base: function (b) { var m = api.model(); b.drop = Math.max(0.02 * m.land.heightRange, 0.25 * Math.max(b.J - m.Jlow, 0)); },
        done: function (b) { return heightHere() <= b.J - b.drop; },
        praise: 'That is gradient descent: feel the slope, face downhill, step. Each hero does it differently.' },
      { lesson: 2, king: 'Good. Now come to me, apprentice. Ask me anything about my land.',
        goal: 'Walk to the King (K on the edge of the plot’s floor, and under the gold light) and press E.', target: { npc: 'king', text: 'Talk' },
        done: function () { return talking('king'); } },
      { lesson: 2, goal: 'Ask him: “Where is the treasure?”', target: { choice: 'Where is the treasure?' }, done: function () { return reveal; } },
      { lesson: 2, goal: 'Say farewell: choose “Farewell.” or press Esc. The treasure now has a beacon and a ★ on your compass.', target: { choice: 'Farewell.' }, done: function () { return !dialog; } },
      { lesson: 3, king: 'My heroes are back at the start flag. The Pilgrim carries a staff like yours, and no memory at all. Follow the Pilgrim for a few days.',
        setup: function () { api.restart(); },
        goal: 'Click Pilgrim, under View in the bar under the game.', target: { dom: '[data-ride="pg"]', text: 'Follow the Pilgrim' }, done: function () { return ride === 'pg'; } },
      { lesson: 3, info: true, goal: 'When you follow a hero, the view rises into a map of the land seen from above, north up. Colour is height, dark low and warm high, and each ring joins spots of the same height. P is the Pilgrim, K the King, Y you; the others are marked too. Each day you see the Pilgrim’s four taps, the orange arrow ∇J pointing uphill across the rings, and its stride going downhill to the next spot. C switches to the 3D views.', target: { dom: '#fog-stage', spot: 'centre', text: 'The Pilgrim' } },
      { lesson: 3, goal: 'See how the Pilgrim works out its first day, step by step: press B, or ▶ Step by step on the card. Go through it with Next ▶ (or Play), and close the board when you are done.', target: { dom: ['.rk-board'], text: 'Step by step' },
        done: function (b) { return stats.boards > b.boards; } },
      { lesson: 3, goal: 'Press N to live one day. Watch the Pilgrim feel, reckon, turn and stride.', target: { dom: '#fog-next', text: 'Next day' },
        done: function (b) { return today() >= b.day + 1 && !api.playing(); } },
      { lesson: 3, goal: 'Live two more days with N. The strip at the bottom lights what the Pilgrim is doing, and the chip under the plot gives each day’s numbers. B shows them worked out, step by step.', target: { dom: ['#fog-next', '#reckon'], text: 'Next day' },
        done: function (b) { return today() >= b.day + 2 && !api.playing(); } },
      { lesson: 3, goal: 'Step off: press Esc, or Step off.', target: { dom: '#fog-leave', text: 'Step off' }, done: function () { return !ride; } },
      { lesson: 4, king: 'The Cartographer keeps a journal: its last strides, and how the slope changed over each. It reads them to bend its course, then tests each stride before it takes it. Today it keeps only its last 3 pages, so you can watch the oldest page leave.',
        setup: function () { lessonPages(3); api.restart(); },
        goal: 'Click Cartog., under View, to follow the Cartographer.', target: { dom: '[data-ride="lb"]', text: 'Follow the Cartographer' }, done: function () { return ride === 'lb'; } },
      { lesson: 4, setup: function () { lessonPages(3); }, goal: 'Live four days with N. The journal on the left is a FIFO queue: each day the Cartographer reads every page, then writes a new one at the bottom. On day 4 the journal is full, so the oldest page leaves at the top.', target: { dom: ['#fog-next', '#journal'], text: 'Next day' },
        done: function (b) { return today() >= b.day + 4 && !api.playing(); } },
      { lesson: 4, goal: 'Step off.', target: { dom: '#fog-leave', text: 'Step off' }, done: function () { return !ride; }, after: function () { lessonPages(null); },
        praise: 'In this canyon the Cartographer is within 0.01 of the spring in 4 days; the Pilgrim needs 21.' },
      { lesson: 5, king: 'You may ask a hero to walk differently. Ask the Pilgrim for longer strides, and see what my canyon does to it.',
        setup: function () { api.restart(); },
        goal: 'Walk to the Pilgrim (P on your compass), press E and ask for longer strides.', target: { npc: 'pg', choice: 'Take longer strides', text: 'Talk' },
        done: function () { return chose('pg', 'Take longer strides'); } },
      { lesson: 5, goal: 'Close the dialogue, then press P to let the days run, and watch the Pilgrim (and its status window under the map).', target: { dom: '#fog-walk', text: 'Walk on' },
        done: function (b) { var w = api.model().walks.pg; return !dialog && ((w.lost != null && today() >= w.length) || today() >= b.day + 12); },
        praise: 'Its stride was longer than this canyon allows (α above 2/λₘₐₓ), so each overshoot grew until it left the map. I have given it back its old stride.',
        after: function () { var k = api.model().key; api.setParam('alpha', E.PRESETS[k].alpha); api.restart(); } },
      { lesson: 6, king: 'One answer must do two jobs: make the land low and obey the wall. ADMM temporarily gives those jobs to two copies. The game calls the cost copy x the Wanderer and the lawful copy z the Warden. They are not two final answers: they must come back to x = z. Come, ask me for my kingdom wall; we will meet each role before adding the ledger and rope.',
        goal: 'Talk to the King, choose “Show me another land…”, then “the kingdom wall”.', target: { npc: 'king', choice: ['Show me another land', 'the kingdom wall'], text: 'Talk' },
        done: function () { return api.model().key === 'wall'; } },
      { lesson: 6, goal: 'Close the dialogue and click Wanderer, under View, to follow the Wanderer.', target: { dom: '[data-ride="tw"]', text: 'Follow the Wanderer' }, done: function () { return ride === 'tw'; } },
      { lesson: 6, boardIds: ['twins', 'wanderer-role', 'warden-role'], boardTitle: 'ADMM: one answer, two temporary copies',
        goal: 'Open ▶ Step by step (or press B). Meet the Wanderer and Warden on all three pages, then press Done.', target: { dom: ['.rk-board'], text: 'Meet the two ADMM copies' },
        done: function (b) { return stats.boardCompletions > b.boardCompletions; } },
      { lesson: 6, goal: 'Why does ADMM temporarily make two copies of one decision?',
        quiz: { options: [
          'So one copy can lower the cost while the other obeys the law, then agreement links them.',
          'So both copies can independently search for different final answers.',
          'So the method can remove noisy measurements from the land.'
        ], correct: 0, retry: 'Not quite. The split gives one final decision two different temporary jobs.' } },
      { lesson: 6, goal: 'Live four days with N. Watch the rope, the Warden and the ledger. B now opens the full derivation. On day 4 the Wanderer steps outside the wall and the Warden remains lawful.', target: { dom: ['#fog-next', '#reckon'], text: 'Next day' },
        done: function (b) { return today() >= b.day + 4 && !api.playing(); } },
      { lesson: 6, boardIds: ['rope', 'without-ledger', 'ledger-role', 'aim', 'wander', 'warden', 'ledger', 'again'], boardTitle: 'ADMM: the rope, the book, and one circuit',
        goal: 'Now open ▶ Step by step again. Follow all eight pages from the first signed gap through the next aim and complete circuit.', target: { dom: ['.rk-board'], text: 'See the ledger change the aim' },
        done: function (b) { return stats.boardCompletions > b.boardCompletions; } },
      { lesson: 6, goal: 'Step off, walk to the Warden (the blue figure) and ask what is in the ledger.', target: { npc: 'wd', choice: 'What is in the ledger?', text: 'Talk' },
        done: function () { return chose('wd', 'What is in the ledger?'); },
        praise: 'The scaled dual variable records signed disagreement. The Twins stop only when they agree and the Warden’s copy has nearly stopped moving.' },
      { lesson: 7, setup: function () { goLand('fort'); api.restart(); ride = null; placePlayer(); },
        king: 'The wall taught the ADMM pattern. Now look at the Old Fort, the smallest coding example in this tale: two coded bits, one parity check and a known channel. It is a bridge to CAJODE, not a simulation of the full receiver.',
        info: true, goal: 'At the fort, the two cards are undecided bits and the blue lawful line is one parity polytope. The lantern readings stay fixed because this toy assumes the channel is known.', target: { dom: '#fog-stage', spot: 'centre', text: 'Two bits and one check' } },
      { lesson: 7, info: true, goal: 'A real LDPC code has many overlapping checks. CAJODE keeps one shared variable bᵢ ∈ [0, 1] for each coded bit. Every check keeps replica variables zₐ inside its parity polytope. Each bit occurrence in a check has a scaled dual variable uₐ,ᵢ—a ledger entry for signed disagreement.' },
      { lesson: 7, info: true, goal: 'One full CAJODE circuit computes one weight for each received sample, updates all shared variables bᵢ, recomputes those weights, updates all channel coefficients, projects each check’s replicas onto its parity polytope, and then updates every scaled dual variable. The channel update is what the fort, where the channel is known, does not show.' },
      { lesson: 7, goal: 'Which statement correctly separates accepting a decoded word from continuous convergence?',
        quiz: { options: [
          'A word may pass every parity check and the CRC even while continuous residuals remain nonzero.',
          'A small primal residual by itself proves that CAJODE has converged to a stationary point.',
          'The Old Fort includes CAJODE’s channel-coefficient update, so the two are equivalent.'
        ], correct: 0, retry: 'Try again. Parity checks plus CRC test a binary word; they do not prove continuous convergence or stationarity.' } },
      { lesson: 8, setup: function () { goLand('misty'); api.restart(); ride = null; placePlayer(); },
        king: 'Now my hardest land: ripples make extra hollows, haze makes every tap a little wrong, and black holes are narrow pits that reveal themselves only when someone samples them.',
        info: true, goal: 'The three difficulties are different: ripples change the land, haze changes the measured slope, and a narrow pit may leave no local clue from far away.', target: { dom: '#fog-stage', spot: 'centre', text: 'The misty hills' } },
      { lesson: 8, goal: 'Press F three times without moving. The ground stays fixed, but the haze changes the measured slope each time.', target: { dom: '#fog-feel', text: 'Feel, three times' },
        done: function (b) { return stats.feels >= b.feels + 3 && stats.walked - b.walked < 0.01 * span(); } },
      { lesson: 8, info: true, goal: 'In this preset, the Pilgrim and Twins settle in a broad valley hollow. The Cartographer enters another pit and stalls. None finds the deepest pit: the heroes choose local moves differently, but no local method can infer a narrow, unvisited pit. The treasure hunt remains open in free exploration.' },
      { lesson: 8, goal: 'Which diagnosis keeps the three difficulties separate?',
        quiz: { options: [
          'Ripples create extra hollows; haze changes measurements; a narrow pit gives no clue until it is sampled.',
          'Haze creates the extra hollows, while ripples merely change repeated measurements.',
          'A sufficiently clever local step can identify the deepest pit without ever sampling near it.'
        ], correct: 0, retry: 'Try again: distinguish the shape of the land, measurement noise, and missing local information.' } }
    ];
    function save() { try { localStorage.setItem(TRIAL_KEY, JSON.stringify({ seen: true, done: trial.done, step: trial.on ? trial.i : null })); } catch (e) { /* storage unavailable: the trial simply starts afresh */ } }
    function load() { try { return JSON.parse(localStorage.getItem(TRIAL_KEY) || 'null'); } catch (e) { return null; } }
    // A saved step is only a bookmark, not a snapshot of the whole game world.  Resume at the beginning of that
    // lesson so its setup, land, day and followed-hero instructions are coherent again.
    function lessonStart(i) {
      i = clamp(Math.floor(Number(i) || 0), 0, STEPS.length - 1);
      var lesson = STEPS[i].lesson;
      while (i > 0 && STEPS[i - 1].lesson === lesson) i--;
      return i;
    }
    function resumeTrial(i) {
      var start = lessonStart(i), lesson = STEPS[start].lesson;
      // A bookmark restarts the lesson rather than pretending to restore an incomplete world snapshot.
      // The two final lessons begin directly on their teaching lands; earlier lessons rebuild from the canyon.
      goLand(lesson === 7 ? 'fort' : lesson === 8 ? 'misty' : 'canyon');
      api.restart(); ride = null; felt = null; reveal = false; found = false;
      look.yaw = 0; look.pitch = 0; placePlayer();
      startTrial(start);
    }
    function snapshot() { return { at: tnow(), turned: stats.turned, walked: stats.walked, feels: stats.feels, boards: stats.boards, boardCompletions: stats.boardCompletions, day: today(), J: heightHere() }; }
    function rebase(st) { trial.base = snapshot(); if (st.base) st.base(trial.base); }
    function startTrial(i) {
      if (race.on) stopRace();
      lessonPages(null); trial.on = true; trial.done = false; trial.notes = {}; stats.started = tnow();
      $('title-card').hidden = true; if (dialog) closeDialogue(); ride = null; look.yaw = 0; look.pitch = 0;
      wrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); wrap.focus({ preventScroll: true });
      enterStep(i || 0); kick();
    }
    function enterStep(i) {
      if (i >= STEPS.length) { finishTrial(); return; }
      var st = STEPS[i], prev = STEPS[i - 1];
      trial.i = i; trial.at = tnow();
      trial.targetShown = -1; trial.quizFeedback = '';
      if (!prev || prev.lesson !== st.lesson) trial.banner = { text: 'Lesson ' + roman(st.lesson + 1) + ' · ' + LESSONS[st.lesson], at: tnow() };
      if (st.lesson !== 4) lessonPages(null);
      if (st.setup) st.setup();
      rebase(st);
      if (st.king) {
        trial.state = 'narration';
        showNode({ npc: 'king', narration: true, text: st.king, choices: [{ label: 'Continue.', go: function () { trial.state = 'run'; rebase(st); renderQuest(); return null; } }] });
      } else trial.state = 'run';
      renderQuest(); save();
    }
    function completeStep() { var st = STEPS[trial.i]; trial.state = 'complete'; trial.at = tnow(); clearHL(); if (st.after) st.after(); renderQuest(); }
    function finishTrial() {
      lessonPages(null);
      trial.on = false; trial.done = true; trial.state = 'off'; clearHL(); renderQuest(); save();
      var secs = Math.round((tnow() - stats.started) / 1000);
      trial.banner = { text: 'Trial complete', at: tnow() };
      showNode({ npc: 'king', narration: true, text: 'Your trial is complete, apprentice. You felt the slope as the Pilgrim does, read the Cartographer’s journal, followed one full ADMM circuit, and carried the Old Fort’s lesson with one parity check into CAJODE. You also separated three hazards: ripples make extra hollows, haze changes measurements, and an unvisited narrow pit gives no local clue. In ' + Math.floor(secs / 60) + ' min ' + (secs % 60) + ' s you tapped the ground ' + stats.feels + ' times and walked ' + num(stats.walked, 1) + '. The hidden treasure is still yours to seek in free exploration.',
                 choices: [{ label: 'Explore freely.', go: function () { return null; } }] });
    }
    // A lesson may lend the Cartographer a shorter journal; leaving the lesson, or the trial, gives the old one back.
    function lessonPages(v) {
      if (v != null) { if (trial.notes.mWas == null) trial.notes.mWas = api.model().p.m; if (api.model().p.m !== v) api.setParam('m', v); }
      else if (trial.notes.mWas != null) { api.setParam('m', trial.notes.mWas); trial.notes.mWas = null; api.restart(); }
    }
    function stopTrial() { lessonPages(null); trial.on = false; trial.state = 'off'; clearHL(); renderQuest(); if (dialog && dialog.narration) closeDialogue(); save(); }
    function renderQuest() {
      var q = $('quest');
      if (!trial.on) { q.hidden = true; return; }
      var st = STEPS[trial.i], goal = st.goal.replace('{drop}', trial.base && trial.base.drop != null ? num(trial.base.drop, 2) : '');
      q.hidden = false;
      q.classList.toggle('done', trial.state === 'complete'); q.classList.toggle('listen', trial.state === 'narration');
      $('quest-lesson').textContent = 'Lesson ' + roman(st.lesson + 1) + ' · ' + LESSONS[st.lesson];
      $('quest-count').textContent = (trial.i + 1) + ' / ' + STEPS.length;
      $('quest-why').textContent = LESSON_WHY[st.lesson] || '';
      $('quest-goal').textContent = trial.state === 'narration' ? 'Listen to the King, then Continue.' : trial.state === 'complete' ? '✓ ' + (st.praise || 'Done.') : goal;
      var hint = trial.state === 'run' ? (trial.quizFeedback || st.hint || '') : '';
      $('quest-hint').textContent = hint; $('quest-hint').hidden = !hint;
      var answers = $('quest-answers'); answers.innerHTML = ''; answers.hidden = !(trial.state === 'run' && st.quiz);
      if (trial.state === 'run' && st.quiz) st.quiz.options.forEach(function (label, j) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = label;
        b.addEventListener('click', function () {
          if (j === st.quiz.correct) completeStep();
          else { trial.quizFeedback = st.quiz.retry || 'Try again.'; renderQuest(); }
          kick();
        });
        answers.appendChild(b);
      });
      var ok = $('quest-ok');
      ok.hidden = !((trial.state === 'run' && st.info && !st.quiz) || (trial.state === 'complete' && st.praise));
      ok.textContent = trial.state === 'complete' ? 'Next' : 'Got it';
      $('quest-fill').style.width = Math.round(100 * (trial.i + (trial.state === 'complete' ? 1 : 0)) / STEPS.length) + '%';
    }
    function trialTick() {
      if (!trial.on) return;
      var st = STEPS[trial.i]; if (!st) return;
      if (trial.state === 'narration' && !dialog) { trial.state = 'run'; rebase(st); renderQuest(); }
      if (trial.state === 'run' && !st.info && st.done && st.done(trial.base)) completeStep();
      else if (trial.state === 'complete' && tnow() - trial.at > (st.praise ? 8000 : 1300)) enterStep(trial.i + 1);
      if (st.keepFelt && felt) felt.time = Math.max(felt.time, tnow() - 6000);
      placeHighlights(st);
    }
    function clearHL() { hlEls.forEach(function (el) { el.classList.remove('tut-hl'); }); hlEls = []; $('callout').hidden = true; }
    function placeHighlights(st) {
      if (trial.state !== 'run') { clearHL(); return; }
      var t = st.target || {}, els = [];
      [].concat(t.dom || []).forEach(function (sel) { var el = document.querySelector(sel); if (el && !el.hidden && el.getClientRects().length) els.push(el.closest('.cell') || el); });
      if (t.choice && dialog) [].concat(t.choice).forEach(function (txt) {
        Array.prototype.forEach.call(document.querySelectorAll('#dlg-choices button'), function (b) { if (b.textContent.replace(/^\s*\d\s*/, '').indexOf(txt) === 0) els.push(b); });
      });
      var npcNear = !!t.npc && !dialog && !ride && listeners().some(function (q) { return q.who === t.npc; });
      if (npcNear) els.push($('fog-talk'));
      hlEls.forEach(function (el) { if (els.indexOf(el) < 0) el.classList.remove('tut-hl'); });
      els.forEach(function (el) { el.classList.add('tut-hl'); });
      hlEls = els;
      // On a short screen the action bar sits below the game view.  Bring a newly available target into view once,
      // rather than leaving a highlighted button and its callout beyond the bottom edge of the viewport.
      if (trial.targetShown !== trial.i && els.length) {
        var targetEl = els.filter(function (el) { return el.getBoundingClientRect().height < window.innerHeight * 0.55; })[0] || els[0];
        var targetRect = targetEl.getBoundingClientRect();
        if (targetRect.top < 12 || targetRect.bottom > window.innerHeight - 12) {
          targetEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          targetRect = targetEl.getBoundingClientRect();
          if (targetRect.bottom > window.innerHeight - 12) window.scrollBy(0, targetRect.bottom - window.innerHeight + 12);
          else if (targetRect.top < 12) window.scrollBy(0, targetRect.top - 12);
        }
        trial.targetShown = trial.i;
      }
      var rect = null, text = t.text || '';
      if (npcNear) { rect = $('fog-talk').getBoundingClientRect(); text = 'Press E to talk'; }
      else if (t.choice && dialog) { if (els.length) { rect = els[0].getBoundingClientRect(); text = 'Choose this'; } }
      else if (t.canvas && regions[t.canvas]) { var r = regions[t.canvas], o = over.getBoundingClientRect(); rect = { left: o.left + r[0], top: o.top + r[1], width: r[2], height: r[3] }; }
      else if (t.spot === 'centre') { var s = $('fog-stage').getBoundingClientRect(); rect = { left: s.left + s.width / 2 - 1, top: s.top + s.height * 0.55, width: 2, height: 2 }; }
      else if (els.length && !t.npc) rect = els[0].getBoundingClientRect();
      callout(rect, text);
    }
    function callout(rect, text) {
      var c = $('callout');
      if (!rect || !text || !rect.width || rect.bottom < 0 || rect.top > window.innerHeight) { c.hidden = true; return; }
      c.hidden = false; $('callout-text').textContent = text;
      var cw = c.offsetWidth, ch = c.offsetHeight, vw = document.documentElement.clientWidth, above = rect.top > ch + 16;
      var left = clamp(rect.left + rect.width / 2 - cw / 2, 8, vw - cw - 8), top = above ? rect.top - ch - 12 : rect.top + rect.height + 12;
      c.style.left = Math.round(left) + 'px'; c.style.top = Math.round(top) + 'px';
      c.classList.toggle('below', !above);
      c.style.setProperty('--arrow-x', Math.round(clamp(rect.left + rect.width / 2 - left, 14, cw - 14)) + 'px');
    }
    function npcAt(n) { if (n === 'king') return kingAt(); var t = clock(); if (n === 'wd') return pose('tw', t.k, fOf('tw', t)).z; return pose(n, t.k, fOf(n, t)).pos; }
    // A gold light over whoever the step is about, and an "!" above them.
    function trialWorld() {
      if (!trial.on || trial.state !== 'run') return;
      var t = STEPS[trial.i].target || {}; if (!t.npc || dialog) return;
      var at = npcAt(t.npc); if (!at) return;
      R.post(at[0], at[1], 0.22, [255, 210, 122], 2, 0.55 + 0.4 * Math.sin(tnow() / 260));
      var top = R.project(at[0], at[1], world.height(at[0], at[1]) + 0.075 * world.span);
      if (top) labels.push({ p: top, text: '!', colour: 'gold', size: 22, bold: true });
    }
    // The lesson banner, the highlight on the compass or the disc, and an arrow at the edge toward someone out of sight.
    function trialOverlay(cam, Wc, Hc, font) {
      var now = tnow();
      if (trial.banner && now - trial.banner.at < 2600) {
        var a = clamp(Math.min((now - trial.banner.at) / 400, (2600 - (now - trial.banner.at)) / 500), 0, 1);
        octx.globalAlpha = a; octx.font = '700 ' + Math.round(clamp(Wc / 26, 16, 30)) + 'px Cinzel, Georgia, serif'; octx.textAlign = 'center'; octx.textBaseline = 'middle';
        octx.lineWidth = 6; octx.strokeStyle = 'rgba(8,12,18,0.85)'; octx.strokeText(trial.banner.text, Wc / 2, Hc * 0.3);
        octx.fillStyle = '#ffd27a'; octx.fillText(trial.banner.text, Wc / 2, Hc * 0.3); octx.globalAlpha = 1;
      }
      if (!trial.on || trial.state !== 'run') return;
      var t = STEPS[trial.i].target || {}, pulse = 0.5 + 0.5 * Math.sin(now / 220);
      if (t.canvas && regions[t.canvas]) {
        var r = regions[t.canvas];
        octx.strokeStyle = 'rgba(255,210,122,' + (0.55 + 0.45 * pulse) + ')'; octx.lineWidth = 3;
        octx.beginPath(); if (octx.roundRect) octx.roundRect(r[0] - 4, r[1] - 4, r[2] + 8, r[3] + 8, 10); else octx.rect(r[0] - 4, r[1] - 4, r[2] + 8, r[3] + 8); octx.stroke();
      }
      if (t.npc && !dialog) {
        var at = npcAt(t.npc), b = heading([at[0] - cam.x, at[1] - cam.y]), d = wrapAngle(b - cam.heading);
        octx.fillStyle = '#ffd27a'; octx.strokeStyle = '#ffd27a'; octx.lineWidth = 2;
        rimMarks.forEach(function (mk) { if (mk.who === t.npc) { octx.beginPath(); octx.arc(mk.at[0], mk.at[1], 11 + 2 * pulse, 0, TAU); octx.stroke(); } });
        if (Math.abs(d) > 0.62) {
          var left = d > 0, ex = left ? 18 : Wc - 18, ey = Hc * 0.5;
          octx.beginPath(); octx.moveTo(ex + (left ? -8 : 8), ey); octx.lineTo(ex + (left ? 10 : -10), ey - 12); octx.lineTo(ex + (left ? 10 : -10), ey + 12); octx.closePath(); octx.fill();
          octx.font = '700 12px ' + font; octx.textAlign = left ? 'left' : 'right'; octx.textBaseline = 'middle';
          octx.lineWidth = 3; octx.strokeStyle = 'rgba(8,12,18,0.8)';
          var label = TITLES[t.npc] + ' ' + num(dist([cam.x, cam.y], at), 2);
          octx.strokeText(label, ex + (left ? 16 : -16), ey); octx.fillText(label, ex + (left ? 16 : -16), ey);
        }
      }
    }
    function initTrial() {
      var s = load();
      if (!s || !s.seen) { $('title-card').hidden = false; $('trial-resume').hidden = true; }
      else if (s.step != null && !s.done) { resumeAt = lessonStart(s.step); $('title-card').hidden = false; $('trial-resume').hidden = false; $('trial-resume').textContent = 'Restart lesson ' + roman(STEPS[resumeAt].lesson + 1) + ' where you left off'; }
      else $('title-card').hidden = true;
      $('trial-begin').addEventListener('click', function () { startTrial(0); });
      $('trial-resume').addEventListener('click', function () { resumeTrial(resumeAt); });
      $('trial-free').addEventListener('click', function () { $('title-card').hidden = true; trial.done = trial.done || false; save(); wrap.focus({ preventScroll: true }); kick(); });
      $('trial-start').addEventListener('click', function () { startTrial(0); });
      $('quest-ok').addEventListener('click', function () { if (trial.state === 'run') completeStep(); else if (trial.state === 'complete') enterStep(trial.i + 1); wrap.focus({ preventScroll: true }); kick(); });
      $('quest-skip').addEventListener('click', function () { var st = STEPS[trial.i]; if (trial.state !== 'complete' && st.after) st.after(); if (dialog && dialog.narration) closeDialogue(); enterStep(trial.i + 1); wrap.focus({ preventScroll: true }); kick(); });
      $('quest-quit').addEventListener('click', function () { stopTrial(); wrap.focus({ preventScroll: true }); kick(); });
      window.addEventListener('scroll', function () { if (trial.on) kick(); }, { passive: true });
    }

    // ------------------------------------------------------------ the King's Race: a turn-based mode
    // You and the three heroes take turns.  On your turn you have action points: walking spends them by distance,
    // feeling the slope costs 1 and scouting 2.  Then each hero lives one day.  The map shows only what you have
    // explored.  The first to stand on the treasure wins; after the last turn, the lowest wins.
    var race = { on: false, turn: 0, maxTurns: 25, ap: 0, apMax: 4, phase: 'off', explored: [], winner: null, scoutUntil: 0 };
    function stepLen() { return 0.07 * span(); }
    function reachOf() { var m = api.model(); return m.L.kind === 'tower' ? 0.12 : 0.03 * span(); }
    function explore(x, y, r) { var e = race.explored, last = e[e.length - 1]; if (last && Math.hypot(last[0] - x, last[1] - y) < 0.25 * r && last[2] >= r) return; e.push([x, y, r]); if (e.length > 1500) e.splice(0, 300); api.moved(); }
    function standings() {
      var m = api.model(), land = m.land, t = clock(), out = [{ who: 'you', name: 'You', J: land.J([player.x, player.y]), at: [player.x, player.y] }];
      [['pg', 'The Pilgrim'], ['lb', 'The Cartographer'], ['tw', 'The Twins']].forEach(function (h) {
        var w = m.walks[h[0]], at = w[Math.min(t.k, w.length - 1)].x; out.push({ who: h[0], name: h[1], J: land.J(at), at: at });
      });
      out.sort(function (a, b) { return a.J - b.J; });
      return out;
    }
    function startRace() {
      if (Board.isOpen()) Board.close();
      if (trial.on) stopTrial();
      if (dialog) closeDialogue();
      ride = null; look.yaw = 0; look.pitch = 0; reveal = false; found = false;
      api.restart();
      var m = api.model(), s = m.x0;
      player.x = s[0]; player.y = s[1]; clampPlayer(); inRealm();
      var v = m.L.view; player.heading = heading([(v[0] + v[1]) / 2 - player.x, (v[2] + v[3]) / 2 - player.y]);
      race.on = true; race.turn = 1; race.ap = race.apMax; race.phase = 'player'; race.explored = []; race.winner = null; race.scoutUntil = 0;
      explore(player.x, player.y, 0.1 * span());
      document.body.classList.add('racing'); $('title-card').hidden = true;
      trial.banner = { text: 'The King’s Race', at: tnow() };
      showNode({ npc: 'king', narration: true, text: 'A race, then! You, my Pilgrim, my Cartographer and my Twins all start at the flag. On your turn you have ' + race.apMax + ' action points: walking spends them by distance, feeling the slope costs 1 and scouting costs 2. Then each hero lives one day. The first to stand on the treasure wins; after ' + race.maxTurns + ' turns, whoever stands lowest. You will see only the land you explore.',
                 choices: [{ label: 'Let the race begin.', go: function () { return null; } }] });
      renderRace(); kick();
    }
    function stopRace(msg) {
      race.on = false; race.phase = 'off'; document.body.classList.remove('racing'); renderRace(); api.moved();
      if (msg) say(msg);
      kick();
    }
    function spend(n, what) {
      if (!race.on) return true;
      if (race.phase !== 'player') { say('Wait: the heroes are taking their turn.'); return false; }
      if (race.ap < n - 1e-9) { say('Not enough action points to ' + what + '. Press <kbd>T</kbd> to end your turn.'); return false; }
      race.ap -= n; renderRace(); return true;
    }
    function scout() {
      if (!race.on || !spend(2, 'scout')) return;
      explore(player.x, player.y, 0.22 * span());
      race.scoutUntil = tnow() + 4000;
      say('You climb a little and look around: the land within ' + num(0.22 * span(), 2) + ' of you is on your map now.');
      kick();
    }
    function endTurn() {
      if (!race.on || race.phase !== 'player') return;
      if (dialog) closeDialogue();
      race.phase = 'heroes'; renderRace();
      api.stepDay();
      kick();
    }
    function raceTick() {
      if (!race.on) return;
      var m = api.model();
      explore(player.x, player.y, 0.09 * span());
      if (race.phase === 'player' && !race.winner && dist([player.x, player.y], m.land.treasure) < reachOf()) { finishRace('you'); return; }
      if (race.phase === 'heroes' && !api.playing()) {
        var st = standings(), hit = st.filter(function (q) { return q.who !== 'you' && dist(q.at, m.land.treasure) < reachOf(); });
        if (hit.length) { finishRace(hit[0].who); return; }
        if (race.turn >= race.maxTurns) { finishRace(st[0].who, true); return; }
        race.turn++; race.ap = race.apMax; race.phase = 'player';
        trial.banner = { text: 'Turn ' + race.turn, at: tnow() };
        toast = null; say('Turn ' + race.turn + ': your move. You have ' + race.apMax + ' action points.');
        renderRace();
      }
    }
    function finishRace(who, byHeight) {
      race.winner = who; race.phase = 'over'; renderRace();
      var names = { you: 'You', pg: 'The Pilgrim', lb: 'The Cartographer', tw: 'The Twins' }, st = standings();
      var board = st.map(function (q, i) { return (i + 1) + '. ' + names[q.who] + ' (' + num(q.J, 3) + ')'; }).join(', ');
      var text = who === 'you'
        ? (byHeight ? 'The turns are over, and you stand lowest of all. You win my race, apprentice!' : 'You stand on the treasure! You win my race, apprentice, in ' + race.turn + ' turns.')
        : (byHeight ? 'The turns are over. ' + names[who] + ' stands lowest and wins my race.' : names[who] + ' reached the treasure first, on turn ' + race.turn + '.');
      trial.banner = { text: who === 'you' ? 'Victory!' : names[who] + ' wins', at: tnow() };
      reveal = true;
      showNode({ npc: 'king', narration: true, text: text + ' Final standings: ' + board + '. The treasure lay at ' + pair(api.model().land.treasure, 2) + '.',
                 choices: [{ label: 'Race again.', go: function () { startRace(); return null; } }, { label: 'Leave the race.', go: function () { stopRace(); return null; } }] });
    }
    function renderRace() {
      var box = $('race');
      $('map-hint').textContent = race.on ? 'The tactical map shows only what you have explored. Click it to walk there.' : 'Click or drag on the map to move the start flag';
      if (!race.on) { box.hidden = true; $('hud-day-k').textContent = 'DAY'; return; }
      box.hidden = false;
      $('hud-day-k').textContent = 'TURN';
      $('race-turn').textContent = 'Turn ' + race.turn + ' / ' + race.maxTurns;
      var pips = '';
      for (var i = 0; i < race.apMax; i++) { var f = clamp(race.ap - i, 0, 1); pips += '<span class="pip"><span style="width:' + Math.round(100 * f) + '%"></span></span>'; }
      $('race-ap').innerHTML = pips + ' <b>' + num(race.ap, 1) + '</b>';
      $('race-phase').textContent = race.phase === 'player' ? 'Your turn' : race.phase === 'heroes' ? 'The heroes are walking…' : race.phase === 'over' ? 'The race is over' : '';
      var names = { you: 'You', pg: 'The Pilgrim', lb: 'The Cartographer', tw: 'The Twins' };
      $('race-board').innerHTML = standings().map(function (q) { return '<li data-who="' + q.who + '"><span>' + names[q.who] + '</span><b>' + num(q.J, 3) + '</b></li>'; }).join('');
      $('race-scout').disabled = race.phase !== 'player' || race.ap < 2;
      $('race-end').disabled = race.phase !== 'player';
    }
    function initRace() {
      $('race-start').addEventListener('click', function () { startRace(); });
      $('trial-race').addEventListener('click', function () { $('title-card').hidden = true; save(); startRace(); });
      $('race-scout').addEventListener('click', function () { scout(); wrap.focus({ preventScroll: true }); });
      $('race-end').addEventListener('click', function () { endTurn(); wrap.focus({ preventScroll: true }); });
      $('race-quit').addEventListener('click', function () { stopRace('You left the race.'); wrap.focus({ preventScroll: true }); });
    }

    // ------------------------------------------------------------ the numbers chip: the day's key numbers in one line
    // The whole working is on the step-by-step board (B), a scene of its own; the view keeps only what was just found.
    var reckonOn = true, reckonNow = '', reckonAt = -1e9, reckonKey = '';
    function chipFor(cam) {
      var m = api.model(), land = m.land, here = cam.pose ? cam.pose.pos : [cam.x, cam.y], bits = [];
      if (!ride) {
        bits.push('J = ' + num(land.J(here), 3));
        bits.push(felt && dist(felt.at, here) < 0.05 * span() ? 'your taps: ∇J ≈ ' + pair(felt.g, 2) : 'press <kbd>F</kbd> to feel the slope');
      } else {
        var o = cam.pose, rec = o && o.rec, k = clock().k;
        bits.push('day ' + k + ' → ' + (k + 1));
        if (!rec) bits.push('stopped: see the caption');
        else if (ride === 'tw') bits.push('x ' + pair(rec.from, 2), 'z ' + pair(rec.zFrom, 2), 'u ' + pair(rec.uFrom, 2));
        else {
          bits.push('J = ' + num(land.J(rec.from), 3), '∇J ≈ ' + pair(rec.g, 2));
          bits.push(ride === 'pg' ? 'stride −α∇J' : rec.pages + (rec.pages === 1 ? ' page' : ' pages') + ', stride ' + strideName(rec.step));
        }
      }
      return '<span class="rk-nums">' + bits.join(' · ') + '</span>' + BOARD_BTN;
    }
    function reckonUpdate(cam) {
      var el = $('reckon');
      if (!reckonOn || dialog || race.on || !$('fog-menu').hidden || Board.isOpen()) { el.hidden = true; return; }
      el.hidden = false;
      if (regions.disc && window.innerWidth > 560) el.style.top = Math.round(regions.disc[1] + regions.disc[3] + 6) + 'px';
      var key = (ride || 'you') + '|' + (cam.pose ? cam.pose.phase : '') + '|' + clock().k + '|' + stats.feels + '|' + api.model().key + '|' + (ride ? '' : Math.round(cam.x * 1e4) + ',' + Math.round(cam.y * 1e4));
      if (key === reckonKey && tnow() - reckonAt < 150) return;
      reckonKey = key; reckonAt = tnow();
      var html = chipFor(cam);
      if (html !== reckonNow) { reckonNow = html; el.innerHTML = html; }
    }
    // ------------------------------------------------------------ the Cartographer's journal: a FIFO queue of its last m pages
    // The oldest page is at the top and the newest at the bottom.  Each day the Cartographer reads every page, newest to
    // oldest and back again (the two-loop recursion of L-BFGS); after its stride it writes a new page at the bottom, and
    // when the journal then holds more than m pages the oldest leaves at the top.
    var journalNow = '';
    function readingAt(n, u) { if (n < 1) return -1; var v = clamp(u, 0, 0.999) * 2 * n; return v < n ? n - 1 - Math.floor(v) : Math.floor(v - n); }
    function pageRow(pg, n, cls, mark) {
      var s = pg.s, y = pg.y, ss = s[0] * s[0] + s[1] * s[1], c = ss > 0 ? (s[0] * y[0] + s[1] * y[1]) / ss : 0;
      return '<tr class="' + cls + '"><td>' + n + '</td><td>day ' + pg.day + '</td><td>' + pair(s, 3) + '</td><td>' + pair(y, 3) + '</td><td>' + (Math.abs(c) < 1e4 ? num(c, 2) : c.toExponential(1).replace('e+', '·10^')) + '</td><td class="jq-mark">' + (mark || '') + '</td></tr>';
    }
    function journalFor(cam) {
      var m = api.model(), mm = Math.round(m.p.m), o = cam.pose, rec = o && o.rec, w = m.walks.lb, ph = o ? o.phase : 'rest';
      var head = '<h4>Journal · a FIFO queue of m = ' + mm + ' pages</h4>';
      if (mm === 0) return head + '<div class="why">With m = 0 it keeps no pages: it goes straight downhill and only tests its strides.</div>';
      var rows = [], why, pages;
      if (!rec) { var last = w[w.length - 1]; pages = last.after || []; why = 'Its walk is over. These are the pages it kept.'; }
      else if (o.phase === 'stride') { pages = rec.after; (rec.dropped || []).forEach(function (pg) { rows.push(pageRow(pg, '−', 'out', '← out')); }); }
      else pages = rec.queue;
      var n = pages.length, at = rec && ph === 'journal' && !rec.restart ? readingAt(n, o.u) : -1;
      if (rec && ph === 'journal' && rec.restart) rec.torn.forEach(function (pg, i) { rows.push(pageRow(pg, i + 1, 'out', '← torn')); });
      var skip = Math.max(0, pages.length - 6);
      if (skip) rows.push('<tr class="empty"><td></td><td colspan="5">… ' + skip + (skip === 1 ? ' older page' : ' older pages') + ' above</td></tr>');
      pages.forEach(function (pg, i) {
        if (i < skip) return;
        var fresh = rec && ph === 'stride' && rec.wrote && pg.day === rec.wrote.day;
        rows.push(pageRow(pg, i + 1, (i === at ? 'read' : '') + (fresh ? ' new' : ''), fresh ? '← new' : i === at ? '← read' : ''));
      });
      if (n < mm) rows.push('<tr class="empty"><td></td><td colspan="5">' + (mm - n) + ' empty ' + (mm - n === 1 ? 'place' : 'places') + '</td></tr>');
      if (rec) {
        var mv = [rec.x[0] - rec.from[0], rec.x[1] - rec.from[1]], turn = degrees(heading(mv), heading(mapDownhill(rec.from, rec.g)));
        if (ph === 'journal') why = rec.restart ? 'Its pages pointed it uphill, so it tears all ' + rec.torn.length + ' out and goes straight downhill.' : n ? 'It reads every page, newest to oldest and back again, to learn how the land curves. Today they turn it ' + turn + '° from straight downhill.' : 'No pages yet, so it goes straight downhill.';
        else if (ph === 'stride') why = rec.wrote ? 'After the stride it writes a new page at the bottom' + (rec.dropped.length ? '. The journal held m = ' + mm + ' pages, so the oldest left at the top.' : '.') : 'No page today: the slope did not grow along this stride (yᵀs ≤ 0), and such a page would mislead it.';
        else why = !n ? 'The journal is empty.' : n < mm ? n + ' of ' + mm + ' pages written. Pages leave only once the journal is full.' : 'The journal is full: each new page pushes out the oldest.';
      }
      return head + '<table class="jq"><tr><th>#</th><th>written</th><th>stride s</th><th>slope change y</th><th>curve</th><th></th></tr>' +
        '<tr class="end"><td colspan="6">↑ out: the oldest page leaves first</td></tr>' + rows.join('') +
        '<tr class="end"><td colspan="6">↓ in: each new page enters here</td></tr></table><div class="why">' + why + '</div>';
    }
    function journalUpdate(cam) {
      var el = $('journal');
      if (ride !== 'lb' || !reckonOn || race.on || dialog || !$('fog-menu').hidden || Board.isOpen()) { el.hidden = true; return; }
      el.hidden = false;
      if (window.innerWidth > 560) {
        var q = $('quest'), top = q && !q.hidden ? q.offsetTop + q.offsetHeight + 8 : 40;
        el.style.top = top + 'px'; el.style.maxHeight = Math.max(120, panelBottom(el) - top) + 'px';
      }
      var html = journalFor(cam);
      if (html !== journalNow) { journalNow = html; el.innerHTML = html; var r = el.querySelector('tr.read, tr.new'); if (r && el.scrollHeight > el.clientHeight) el.scrollTop = Math.max(0, r.offsetTop - 60); }
    }
    // ------------------------------------------------------------ the day's steps, while you follow a hero
    var STEP_NAMES = { pg: ['Feel', 'Reckon ∇J', 'Turn', 'Stride −α∇J'], lb: ['Feel', 'Journal', 'Test strides', 'Turn', 'Stride'], tw: ['Aim v = z − u', 'Walk: x', 'Warden: z', 'Ledger: u'] }, daylineNow = '';
    function daylineUpdate(cam) {
      var el = $('daysteps');
      if (!ride || race.on || dialog || !$('fog-menu').hidden || Board.isOpen()) { el.hidden = true; return; }
      var o = cam.pose, k = clock().k, names = STEP_NAMES[ride], at = o && o.rec ? PHASES[ride].names.indexOf(o.phase) : -1, still = api.time().f == null, html;
      if (!o || !o.rec) html = '<span class="dl-day">Day ' + k + '</span><span class="dl-hint">' + NAMES[ride] + ' has stopped: see the caption.</span>';
      else html = '<span class="dl-day">Day ' + k + ' → ' + (k + 1) + '</span>' + names.map(function (nm, i) {
        return (i ? '<span class="dl-sep">›</span>' : '') + '<span class="dl-step' + (still ? '' : i === at ? ' on' : i < at ? ' done' : '') + '">' + (i + 1) + ' ' + nm + '</span>';
      }).join('') + (still ? '<span class="dl-hint"><kbd>N</kbd> lives this day</span>' : '');
      el.hidden = false;
      if (html !== daylineNow) { daylineNow = html; el.innerHTML = html; }
      if (window.innerWidth > 560) { var cap = $('fog-caption'); el.style.bottom = (cap && !cap.hidden ? cap.offsetHeight + 18 : 10) + 'px'; }
    }
    // How far down a side panel may reach: above the strip and the caption.
    function panelBottom(el) {
      var b = el.parentNode.clientHeight - 10, cap = $('fog-caption'), dl = $('daysteps');
      if (cap && !cap.hidden) b = Math.min(b, cap.offsetTop - 8);
      if (dl && !dl.hidden) b = Math.min(b, dl.offsetTop - 8);
      return b;
    }
    // ------------------------------------------------------------ the contour map: a followed hero's day, seen from above
    // Colour is height (dark low, warm high) and each ring joins spots of equal height, north up.  Everyone is on it;
    // the hero you follow shows its day: its taps, ∇J across the rings, downhill, its stride and its trail.  The view
    // glides from day to day; a character outside it waits at the edge, pointing the way.
    var mapCv = $('fog-map'), mapKit = null, mapView = null, mapBlend = 0, mapSince = -1e9, mapT = 0, mapShade = null;
    function mapWanted() { return !!ride && followMode === 'map' && !race.on && !Board.isOpen(); }
    function mapGlide(a, b, t) {
      var ca = [(a[0] + a[1]) / 2, (a[2] + a[3]) / 2], cb = [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2], wa = a[1] - a[0], wb = b[1] - b[0];
      var c = lerp(ca, cb, t), wd = wa * Math.pow(wb / wa, t); return [c[0] - wd / 2, c[0] + wd / 2, c[1] - wd / 2, c[1] + wd / 2];
    }
    function mapFrame(cam) {
      var now = tnow(), dt = clamp((now - mapT) / 1000, 0, 0.25); mapT = now;
      mapBlend = mapWanted() ? clamp((now - mapSince - 900) / 900, 0, 1) : Math.max(0, mapBlend - dt / 0.4);
      mapCv.style.opacity = String(mapBlend);
      if (mapBlend <= 0 || !ride) { mapCv.hidden = true; if (!ride) mapView = null; return; }
      mapCv.hidden = false;
      if (!mapKit) mapKit = new Board.Kit(mapCv);
      var g = mapKit, B = Board.H, C = B.C, m = api.model(), land = m.land, t = clock(), o = pose(ride, t.k, fOf(ride, t)), rec = o.rec, w = m.walks[ride], k = o.k, sp = span();
      if (!mapShade || mapShade.model !== m) {
        var v0 = m.L.view, lo = Infinity, hi = -Infinity, sm = land.smooth || land.J;
        for (var i = 0; i <= 40; i++) for (var j = 0; j <= 40; j++) { var zz = sm([v0[0] + (v0[1] - v0[0]) * i / 40, v0[2] + (v0[3] - v0[2]) * j / 40]); lo = Math.min(lo, zz); hi = Math.max(hi, zz); }
        mapShade = { model: m, lo: lo, hi: hi };
      }
      g.fit(); g.clear(); g.layout('map');
      var pts = [o.here.x, o.pos];
      if (rec) { pts.push(rec.x); if (rec.raw) pts.push(rec.raw); if (ride === 'tw') pts.push(rec.v, rec.zFrom, rec.z); if (rec.trials) rec.trials.forEach(function (q) { pts.push(q.x); }); }
      for (var d = Math.max(0, k - 3); d <= k; d++) pts.push(w[Math.min(d, w.length - 1)].x);
      var target = B.around(pts, 0.9, 0.42 * sp);
      mapView = !mapView || mapView.ride !== ride || mapView.model !== m ? target.slice() : mapGlide(mapView, target, 1 - Math.exp(-3 * dt));
      mapView.ride = ride; mapView.model = m;
      g.view(mapView);
      g.land(land.J, { id: 'J', lo: mapShade.lo, hi: mapShade.hi, rings: 14, pits: !!land.holes, cell: 6 });
      g.axes();
      if (land.box && land.kind === 'quad') g.path([[land.box[0], land.box[0]], [land.box[1], land.box[0]], [land.box[1], land.box[1]], [land.box[0], land.box[1]], [land.box[0], land.box[0]]], C.blue, 2, 1);
      if (land.kind === 'tower') g.line(land.lawSegment[0], land.lawSegment[1], C.blue, 2, 1, [6, 4]);
      var ctx = g.ctx, R = g.mapR;
      // a character: a round token with its letter, or at the edge, pointing the way, when it is out of view
      function token(q, col, letter, name, strong) {
        var a = g.P(q), inside = a[0] > R[0] + 12 && a[0] < R[0] + R[2] - 12 && a[1] > R[1] + 12 && a[1] < R[1] + R[3] - 12;
        if (!inside) {
          var cxm = R[0] + R[2] / 2, cym = R[1] + R[3] / 2, dx = a[0] - cxm, dy = a[1] - cym, sc = Math.min((R[2] / 2 - 16) / Math.abs(dx || 1e-9), (R[3] / 2 - 16) / Math.abs(dy || 1e-9));
          a = [cxm + dx * sc, cym + dy * sc]; var an = Math.atan2(dy, dx);
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a[0] + 14 * Math.cos(an), a[1] + 14 * Math.sin(an)); ctx.lineTo(a[0] + 8 * Math.cos(an + 0.5), a[1] + 8 * Math.sin(an + 0.5)); ctx.lineTo(a[0] + 8 * Math.cos(an - 0.5), a[1] + 8 * Math.sin(an - 0.5)); ctx.closePath(); ctx.fill();
        }
        var r = strong ? 10 : 8;
        ctx.beginPath(); ctx.arc(a[0], a[1], r + 2.5, 0, TAU); ctx.fillStyle = 'rgba(8,12,18,0.85)'; ctx.fill();
        ctx.beginPath(); ctx.arc(a[0], a[1], r, 0, TAU); ctx.fillStyle = col; ctx.fill();
        ctx.fillStyle = '#1b1406'; ctx.font = '700 ' + (letter.length > 1 ? 9.5 : 11) + 'px ' + g.sans; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(letter, a[0], a[1] + 0.5);
        if (name) g.labelPx(a[0] + r + 6, a[1] - r - 2, name, col, { size: strong ? 13 : 11.5 });
      }
      function arrowFrom(q, dir, px, col, wd, text) {
        var A = g.P(q), l = Math.hypot(dir[0], dir[1]); if (l < 1e-12) return; var u = [dir[0] / l, -dir[1] / l], Bp = [A[0] + u[0] * px, A[1] + u[1] * px];
        g.arrowPx(A, Bp, col, wd); if (text) g.labelPx(Bp[0] + u[0] * 10, Bp[1] + u[1] * 10, text, col, { size: 12, align: u[0] > 0.3 ? 'left' : u[0] < -0.3 ? 'right' : 'center' });
      }
      // everyone else
      var show = api.shownAll();
      g.flag(m.x0, 1); g.label(m.x0, 'start', C.ink, { dx: 16, dy: -20, size: 11 });
      if (reveal) { g.halo(land.treasure, 12, C.gold, 1, 2.5); g.label(land.treasure, '★ treasure', C.gold, { dx: 14, dy: 12, size: 12 }); }
      ['pg', 'lb', 'tw'].forEach(function (h) {
        if (h === ride || !show[h]) return;
        var ow = m.walks[h], op = pose(h, t.k, fOf(h, t));
        g.path(ow.slice(0, Math.min(t.k, ow.length - 1) + 1).map(function (q) { return q.x; }).concat([op.pos]), h === 'pg' ? 'rgba(255,176,113,0.45)' : h === 'lb' ? 'rgba(169,205,246,0.45)' : 'rgba(230,233,238,0.4)', 1.5, 1);
        token(op.pos, h === 'pg' ? C.orange : h === 'lb' ? C.blue : '#e6e9ee', h === 'pg' ? 'P' : h === 'lb' ? 'C' : 'Wa', NAMES[h]);
      });
      if (show.tw && ride !== 'tw') token(pose('tw', t.k, fOf('tw', t)).z, '#6aa2e3', 'Z', 'the Warden');
      token(kingAt(), C.gold, 'K', 'the King');
      token([player.x, player.y], '#f2f5f8', 'Y', 'you');
      // the hero you follow: its trail, then its day
      var col = ride === 'pg' ? C.orange : ride === 'lb' ? C.blue : '#e6e9ee', trail = w.slice(0, Math.min(k, w.length - 1) + 1).map(function (q) { return q.x; });
      g.path(trail.concat([o.pos]), col, 3, 1);
      trail.forEach(function (q, i) { g.dot(q, 3.5, col, 1); if (i === trail.length - 1 || i % 5 === 0) g.label(q, 'day ' + i, C.dim, { dx: 7, dy: 12, size: 10.5 }); });
      if (rec) {
        var ph = o.phase, here = o.here.x, h0 = land.h, pxh = Math.max(h0 * g.s, 12);
        if (ride !== 'tw') {
          var showTaps = ph === 'feel' ? Math.min(4, Math.floor(o.u * 4) + 1) : 4, A0 = g.P(here), dirs = [[1, 0], [-1, 0], [0, -1], [0, 1]], mid = rec.taps.reduce(function (a, b) { return a + b.J; }, 0) / 4;
          for (var q = 0; q < showTaps; q++) { ctx.beginPath(); ctx.arc(A0[0] + dirs[q][0] * pxh, A0[1] + dirs[q][1] * pxh, 4, 0, TAU); ctx.fillStyle = rec.taps[q].J > mid ? C.orange : C.blue; ctx.fill(); }
          if (ph !== 'feel') arrowFrom(here, rec.g, 70, C.orange, 3, '∇J, uphill');
          if (ph === 'turn' || ph === 'stride' || (ride === 'lb' && ph !== 'reckon')) arrowFrom(here, [-rec.g[0], -rec.g[1]], 55, 'rgba(242,245,248,0.75)', 2, ph === 'turn' ? 'downhill' : '');
        }
        if (ride === 'pg' && (ph === 'turn' || ph === 'stride')) { g.arrow(here, rec.raw, C.ink, 3, 1, ph === 'turn' ? [7, 5] : null); g.label(lerp(here, rec.raw, 0.55), '−α∇J', C.ink, { dx: 8, dy: -14, size: 12 }); if (rec.clipped) { g.dot(rec.raw, 4, C.red, 1); g.line(rec.raw, rec.x, C.blue, 2, 1, [4, 3]); } }
        if (ride === 'lb') {
          if (ph === 'journal' && rec.queue) rec.queue.forEach(function (pg, i) { var a = w[Math.max(0, pg.day - 1)].x, b = w[Math.min(pg.day, w.length - 1)].x; g.arrow(a, b, C.gold, 3, 1); g.label(lerp(a, b, 0.5), 'page ' + (i + 1), C.gold, { dx: 6, dy: -12, size: 11 }); });
          if (ph === 'trials' || ph === 'turn' || ph === 'stride') {
            var tr = (rec.trials || []).concat([{ x: rec.x, ok: true, step: rec.step }]), shownTr = ph === 'trials' ? Math.floor(o.u * tr.length) + 1 : tr.length;
            tr.slice(0, shownTr).forEach(function (qq, i) { g.dot(qq.x, 5, qq.ok ? C.green : C.red, 1); if (i < 5 || qq.ok) g.label(qq.x, (qq.ok ? '✓ ' : '✗ ') + (i === tr.length - 1 ? 'passes' : 'too high'), qq.ok ? C.green : C.red, { dx: 8, dy: -10, size: 11 }); });
            g.line(here, rec.x, C.blue, 2, 1, [6, 4]);
          }
        }
        if (ride === 'tw') {
          var zc = o.z, led = o.led;
          token(zc, '#6aa2e3', 'Z', 'the Warden');
          if (Math.hypot(led[0], led[1]) > 1e-9) { g.arrow(zc, [zc[0] + led[0], zc[1] + led[1]], C.orange, 2.5, 1); g.label([zc[0] + led[0], zc[1] + led[1]], 'ledger u', C.orange, { dx: 8, dy: -12, size: 11 }); }
          g.dot(rec.v, 5, C.violet, 1); g.label(rec.v, 'v, the aim', C.violet, { dx: 8, dy: 12, size: 11 });
          if (ph === 'walk') { g.path(rec.path && rec.path.length > 1 ? rec.path : [here, rec.x], 'rgba(242,245,248,0.5)', 1.5, 1, [4, 3]); g.line(o.pos, rec.v, C.orange, 1.8, 1, [5, 4]); }
          if (ph === 'warden' || ph === 'ledger') { var xu = [rec.x[0] + rec.uFrom[0], rec.x[1] + rec.uFrom[1]]; g.dot(xu, 4, C.ink, 1); g.label(xu, 'x + u', C.ink, { dx: 8, dy: -10, size: 11 }); g.line(xu, rec.z, '#6aa2e3', 2, 1, [5, 4]); }
        }
        g.label(here, 'day ' + k + ' · J ' + num(land.J(here), 3), C.ink, { dx: 14, dy: 18, size: 12 });
        if (ph === 'stride' || ph === 'turn' || ph === 'ledger' || ph === 'warden') { g.halo(rec.x, 9, C.gold, 1, 2, [4, 3]); g.label(rec.x, 'day ' + (k + 1) + ' · J ' + num(land.J(rec.x), 3), C.gold, { dx: 14, dy: -14, size: 12 }); }
      }
      token(o.pos, col, ride === 'pg' ? 'P' : ride === 'lb' ? 'C' : 'Wa', NAMES[ride], true);
    }
    // ------------------------------------------------------------ the step-by-step board (board.js): today's reckoning, animated
    var BOARD_BTN = '<button type="button" class="rk-board" data-board>▶ Step by step <kbd>B</kbd></button>';
    function boardContext() {
      var m = api.model(), t = clock(), hero = ride || 'you';
      var c = { hero: hero, name: hero === 'you' ? 'you' : NAMES[hero], key: m.key, L: m.L, land: m.land, p: m.p, x0: m.x0, day: t.k };
      if (hero === 'you') { c.felt = felt && dist(felt.at, [player.x, player.y]) < 0.05 * span() ? felt : null; c.at = c.felt ? c.felt.at.slice() : [player.x, player.y]; }
      else c.walk = m.walks[hero];
      return c;
    }
    function switchCam() { followMode = { map: 'afar', afar: 'behind', behind: 'map' }[followMode]; camS = null; mapSince = tnow() - 900; kick(); }
    function openBoard() {
      if (race.on) { say('No step-by-step board during the race.'); kick(); return; }
      if (dialog) closeDialogue();
      if (!$('fog-menu').hidden) closeMenu();
      if (!ride && !(felt && dist(felt.at, [player.x, player.y]) < 0.05 * span())) feelHere();
      if (api.playing()) api.togglePlay();
      var st = trial.on && trial.state === 'run' ? STEPS[trial.i] : null;
      var options = st && st.boardIds ? { ids: st.boardIds, title: st.boardTitle || 'Step by step' } : null;
      if (Board.open(boardContext(), options)) {
        var next = $('board-next'), r = next.getBoundingClientRect(), pad = 12;
        next.focus({ preventScroll: true });
        // scrollIntoView may stop at the board's own clipped side panel.  Move the page explicitly so the primary
        // control is on screen as soon as the board opens on a short laptop.
        if (r.bottom > window.innerHeight - pad) window.scrollBy(0, r.bottom - window.innerHeight + pad);
        else if (r.top < pad) window.scrollBy(0, r.top - pad);
      }
      kick();
    }
    Board.onClose(function (status) { stats.boards++; if (status && status.completed) stats.boardCompletions++; wrap.focus({ preventScroll: true }); kick(); });
    // ------------------------------------------------------------ the menu: settings and modes, inside the game
    function selectTab(t) {
      Array.prototype.forEach.call(document.querySelectorAll('.menu-tabs [data-tab]'), function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === t)); });
      Array.prototype.forEach.call(document.querySelectorAll('.menu-body section[data-tab]'), function (sec) { sec.hidden = sec.getAttribute('data-tab') !== t; });
    }
    function openMenu(t) { $('fog-menu').hidden = false; if (t) selectTab(t); kick(); }
    function closeMenu() { $('fog-menu').hidden = true; wrap.focus({ preventScroll: true }); kick(); }
    function initMenu() {
      $('fog-cam').addEventListener('click', function () { switchCam(); wrap.focus({ preventScroll: true }); });
      $('reckon').addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-board]')) openBoard(); });
      $('fog-menu-btn').addEventListener('click', function () { if ($('fog-menu').hidden) openMenu(); else closeMenu(); });
      $('menu-close').addEventListener('click', closeMenu);
      $('trial-how').addEventListener('click', function () { openMenu('how'); });
      Array.prototype.forEach.call(document.querySelectorAll('.menu-tabs [data-tab]'), function (b) { b.addEventListener('click', function () { selectTab(b.getAttribute('data-tab')); }); });
      $('trial-start').addEventListener('click', function () { closeMenu(); });
      $('race-start').addEventListener('click', function () { closeMenu(); });
      $('fog-reckon').addEventListener('click', function () { reckonOn = !reckonOn; $('fog-reckon').setAttribute('aria-pressed', String(reckonOn)); reckonNow = ''; kick(); });
    }

    // ------------------------------------------------------------ input
    wrap.tabIndex = 0;
    // Movement keys by their place on the keyboard (so Shift or a layout cannot leave one held); browser shortcuts pass by.
    var MOVE = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright' };
    wrap.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.key !== 'Escape') return;
      if (Board.isOpen()) { if (!(e.target && e.target.closest && e.target.closest('#board button') && (e.key === 'Enter' || e.key === ' '))) Board.key(e); return; }
      if (!$('fog-menu').hidden) { if (e.key === 'Escape' || /^[mh]$/i.test(e.key)) { closeMenu(); e.preventDefault(); } return; }
      var k = e.key.toLowerCase(), mv = MOVE[e.code];
      keys.shift = e.shiftKey;
      if (dialog) {
        if (e.repeat) { e.preventDefault(); return; }
        if (/^[1-9]$/.test(k)) { choose(+k - 1); e.preventDefault(); }
        else if (k === 'enter' && dialog.choices.length === 1) { choose(0); e.preventDefault(); }
        else if (k === 'escape') { closeDialogue(); e.preventDefault(); }
        return;
      }
      if (mv) { keys[mv] = true; e.preventDefault(); kick(); return; }
      if (k === 'm' && !e.repeat) { openMenu(); e.preventDefault(); return; }
      if (k === 'b' && !e.repeat) { openBoard(); e.preventDefault(); return; }
      if (k === 'c' && !e.repeat && ride) { switchCam(); e.preventDefault(); return; }
      if (k === 'h' && !e.repeat) { openMenu('how'); e.preventDefault(); return; }
      if (k === 'j' && !e.repeat && !race.on) { $('fog-reckon').click(); e.preventDefault(); return; }
      if (['e', 'f', 'n', 'p', 'r', ' ', 'escape', 't', 'q'].indexOf(k) < 0) return;
      e.preventDefault();
      if (e.repeat) return;
      if (race.on) {
        if (k === 't') endTurn(); else if (k === 'q') scout(); else if (k === 'e') talk(); else if (k === 'f') feelHere();
        else if (k !== 'escape') say('In the race the days pass only when you end your turn (<kbd>T</kbd>).');
        kick(); return;
      }
      if (k === 'e') talk(); else if (k === 'f') feelHere(); else if (k === 'n') api.stepDay(); else if (k === 'p' || k === ' ') api.togglePlay(); else if (k === 'r') dayZero(); else if (k === 'escape') leaveRide();
      kick();
    });
    wrap.addEventListener('keyup', function (e) { var mv = MOVE[e.code]; if (mv) keys[mv] = false; keys.shift = e.shiftKey; if (e.key === 'Meta' || e.key === 'OS') keys = {}; });
    window.addEventListener('blur', function () { keys = {}; });
    wrap.addEventListener('blur', function () { keys = {}; });
    var dragging = null;
    screen.parentNode.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('button, .dialogue, .pad, .quest, .title-card')) return;
      wrap.focus({ preventScroll: true }); dragging = { x: e.clientX, y: e.clientY }; try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    screen.parentNode.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - dragging.x, dy = e.clientY - dragging.y; dragging = { x: e.clientX, y: e.clientY };
      if (ride) look.yaw -= dx * 0.006; else { player.heading -= dx * 0.006; stats.turned += Math.abs(dx * 0.006); api.moved(); }
      look.pitch = clamp(look.pitch - dy * 0.002, -0.35, 0.3); kick();
    });
    ['pointerup', 'pointercancel'].forEach(function (n) { screen.parentNode.addEventListener(n, function () { dragging = null; }); });
    Array.prototype.forEach.call(document.querySelectorAll('.pad [data-key]'), function (b) {
      var k = b.getAttribute('data-key');
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); keys[k] = true; kick(); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { b.addEventListener(n, function () { keys[k] = false; }); });
    });
    $('fog-feel').addEventListener('click', function () { feelHere(); kick(); });
    $('fog-talk').addEventListener('click', function () { talk(); kick(); });
    $('fog-next').addEventListener('click', function () { api.stepDay(); kick(); });
    $('fog-walk').addEventListener('click', function () { api.togglePlay(); kick(); });
    $('fog-day0').addEventListener('click', function () { dayZero(); kick(); });
    $('fog-leave').addEventListener('click', function () { leaveRide(); kick(); });
    $('fog-captions').addEventListener('change', function () { showCaptions = $('fog-captions').checked; kick(); });
    $('fog-quality').value = quality;
    $('fog-quality').addEventListener('change', function () { quality = $('fog-quality').value; try { localStorage.setItem('kings-land-quality', quality); } catch (e) { /* storage unavailable */ } kick(); });
    if (window.ResizeObserver) new ResizeObserver(function () { kick(); }).observe(screen);
    $('fog-fog').addEventListener('input', function () { fogDist = +$('fog-fog').value; kick(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-ride]'), function (b) {
      b.addEventListener('click', function () { var h = b.getAttribute('data-ride'); if (h === 'you') leaveRide(); else startRide(h); kick(); });
    });

    // ------------------------------------------------------------ the loop: runs while the view is on screen
    function move(dt) {
      if (ride || dialog) { if (keys.arrowleft) look.yaw += 1.6 * dt; if (keys.arrowright) look.yaw -= 1.6 * dt; return; }
      var sp = 0.2 * span() * (keys.shift ? 2.5 : 1) * dt, tr = 1.8 * dt;
      if (race.on && race.target && race.phase === 'player') {
        var dx = race.target[0] - player.x, dy = race.target[1] - player.y, dd = Math.hypot(dx, dy);
        if (dd < 1e-6) race.target = null;
        else { player.heading = Math.atan2(dy, dx); var stepTo = Math.min(dd, 0.5 * span() * dt); return walkBy(dx / dd * stepTo, dy / dd * stepTo); }
      }
      if (keys.arrowleft) player.heading += tr;
      if (keys.arrowright) player.heading -= tr;
      if (keys.arrowleft || keys.arrowright) api.moved();
      var fwd = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0), side = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
      if (fwd || side) {
        var fx = Math.cos(player.heading), fy = Math.sin(player.heading);
        walkBy((fx * fwd + fy * side) * sp, (fy * fwd - fx * side) * sp);
      }
    }
    // A step of the apprentice; in the race it spends action points by distance and stops when they run out.
    function walkBy(dx, dy) {
      var d = Math.hypot(dx, dy);
      if (race.on) {
        if (race.phase !== 'player') return;
        var can = race.ap * stepLen();
        if (can <= 1e-9) { race.target = null; if (!toast || tnow() - (toast.t || 0) > 3000) { say('Your action points are spent. Press <kbd>T</kbd> to end your turn.'); toast.t = tnow(); } return; }
        if (d > can) { dx *= can / d; dy *= can / d; d = can; }
        race.ap = Math.max(0, race.ap - d / stepLen()); renderRace();
      }
      player.x += dx; player.y += dy; clampPlayer(); if (race.on) inRealm();
      api.moved();
    }
    // Draw only while something changes: keys held, a drag, days passing, a message on screen.
    function busy() {
      var now = performance.now();
      for (var k in keys) if (keys[k] && k !== 'shift') return true;
      return !!dragging || trial.on || !!(race.on && race.target) || api.playing() || (felt && tnow() - felt.time < 12000) || (toast && now - toast.time < 5000) || (trial.banner && tnow() - trial.banner.at < 2700);
    }
    function loop(now) {
      if (!running) return;
      var dt = Math.min(0.05, (now - (lastFrame || now)) / 1000); lastFrame = now;
      var h0 = player.heading, x0 = player.x, y0 = player.y;
      trialClock += dt * 1000;
      move(dt);
      if (!ride) { stats.turned += Math.abs(wrapAngle(player.heading - h0)); stats.walked += Math.hypot(player.x - x0, player.y - y0); }
      try { frame(); } catch (err) { (window.kingsLandErrors = window.kingsLandErrors || []).push(String(err && err.stack || err)); if (window.kingsLandErrors.length < 3 && window.console) console.error(err); }
      if (busy()) rafId = requestAnimationFrame(loop); else running = false;
    }
    var rafId = 0;
    function kick() { if (!running && visible) { running = true; lastFrame = 0; rafId = requestAnimationFrame(loop); } }
    function stop() { running = false; cancelAnimationFrame(rafId); }
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); else stop(); }).observe(wrap);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else kick(); });
    initTrial();
    initRace();
    initMenu();
    kick();

    return {
      view: function () { var c = camera(), at = c.pose ? c.pose.pos : [c.x, c.y]; return { x: at[0], y: at[1], heading: c.heading, reach: fogDist * span(), riding: ride }; },
      kick: kick,
      ride: startRide, leave: leaveRide, talk: talk, feel: feelHere, frame: function () { if (world || api.model()) frame(); },
      debug: function (o) { if (o.player) { player.x = o.player[0]; player.y = o.player[1]; } if (o.heading != null) player.heading = o.heading; if (o.ride !== undefined) { ride = o.ride; } if (o.fog) fogDist = o.fog; if (o.talk) openDialogue(o.talk); if (o.choose != null) choose(o.choose); if (o.feel) feelHere(); if (o.yaw != null) look.yaw = o.yaw; if (o.pitch != null) look.pitch = o.pitch; if (o.advance) { for (var q = 0, n = Math.round(o.advance * 30); q < n; q++) { api.advance(1 / 30); trialClock += 1000 / 30; var hh = player.heading, xx = player.x, yy = player.y; move(1 / 30); if (!ride) { stats.turned += Math.abs(wrapAngle(player.heading - hh)); stats.walked += Math.hypot(player.x - xx, player.y - yy); } frame(); } } if (o.card === false) $('title-card').hidden = true; if (o.face && felt) player.heading = downhillOf(felt.g); if (o.faceDownhillWalk) { var gg = api.model().land.grad([player.x, player.y]); player.heading = downhillOf(gg); } if (o.near) { var at = npcAt(o.near); player.x = at[0] - 0.05 * span(); player.y = at[1]; player.heading = 0; } if (o.trial != null) startTrial(o.trial); if (o.trialDone) completeStep(); frame(); },
      trialState: function () { return { on: trial.on, i: trial.i, state: trial.state, n: STEPS.length }; },
      race: function () { return race.on ? { explored: race.explored, turn: race.turn, phase: race.phase } : null; },
      raceState: function () { return { on: race.on, turn: race.turn, ap: race.ap, phase: race.phase, winner: race.winner }; },
      walkTo: function (x) { if (!race.on || race.phase !== 'player') return false; race.target = x.slice(); kick(); return true; },
      startRace: startRace, endTurn: endTurn, scout: scout
    };
  }
  return { create: create };
})();
