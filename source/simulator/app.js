// The page's drawing, controls, status windows, equations and charts; engine.js computes the walks.
(function () {
  'use strict';
  var E = window.Engine;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function fmt(v, d) {
    if (v == null || !isFinite(v)) return '—';
    var s = v.toFixed(d == null ? 3 : d);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    return s.replace('-', '\u2212');
  }
  function pt(x, d) { return '(' + fmt(x[0], d) + ', ' + fmt(x[1], d) + ')'; }
  function small(v) { return Math.abs(v) >= 0.001 || v === 0 ? fmt(v, 4) : v.toExponential(1).replace('-', '\u2212'); }
  function signWord(x) { return '(' + (x[0] >= 0 ? '+' : '\u2212') + ', ' + (x[1] >= 0 ? '+' : '\u2212') + ')'; }

  // ------------------------------------------------------------------ the lands
  var LANDS = {
    canyon: {
      title: 'the canyon', kind: 'quad', wall: false, reach: 0.01, view: E.KINDS.canyon.view, cam: { az: -28, el: 40 }, treasureName: 'treasure (the spring)',
      preset: E.PRESETS.canyon,
      note: '<strong>The canyon.</strong> No law, one long valley, ten times steeper across than along. ' +
        'The Pilgrim zigzags from side to side; the Cartographer\u2019s journal learns the canyon\u2019s shape and straightens the path. ' +
        'With nothing to obey, the Warden just copies the Wanderer and the ledger stays empty, so the Twins become a careful walker on a rope.'
    },
    wall: {
      title: 'the kingdom wall', kind: 'quad', wall: true, reach: 0.001, view: E.KINDS.wall.view, cam: { az: -28, el: 44 }, treasureName: 'treasure (lowest spot inside)',
      preset: E.PRESETS.wall,
      note: '<strong>The kingdom wall.</strong> The spring lies outside the wall, so the treasure is the lowest spot on the wall itself. ' +
        'Each time a Pilgrim stride crosses the wall, the Pilgrim is set back inside. The Cartographer walks on a stretched map where the wall is infinitely far away. ' +
        'The Wanderer may step outside while the Warden stays in, and the ledger ends up holding the wall\u2019s push.'
    },
    fort: {
      title: 'the old fort', kind: 'tower', view: E.KINDS.fort.view, cam: { az: 35, el: 34 }, treasureName: 'the true order',
      preset: E.PRESETS.fort,
      note: '<strong>The old fort.</strong> Two sentries under one tower, whose law says their flags must agree. The lanterns read (+, \u2212), a broken order. ' +
        'The walkers carry the law as a hill on the land (\u03bc<sub>p</sub>). The Twins carry it as the Warden, who stands only on lawful mixtures. ' +
        'All three reach the true order (+, +); compare how many days each takes.'
    },
    ridge: {
      title: 'the ridge', kind: 'tower', view: E.KINDS.ridge.view, cam: { az: 35, el: 34 }, treasureName: 'the true order',
      preset: E.PRESETS.ridge,
      note: '<strong>Behind a ridge.</strong> The same tower, but a lower law hill and a high ridge between a flag up and a flag down. ' +
        'The deepest hollow is the true order (+, +), yet both walkers stop in a shallower hollow where the law is broken. ' +
        'Each day the Wanderer jumps to the best spot the rope allows, so the ledger can pull it over the ridge. Set y\u2082 to \u22120.30 and the Cartographer\u2019s first stride carries over too.'
    },
    misty: {
      title: 'the misty hills', kind: 'quad', wall: false, reach: 0.03, view: E.KINDS.misty.view, cam: { az: -35, el: 42 }, treasureName: 'treasure (lowest spot)',
      preset: E.PRESETS.misty,
      note: '<strong>The misty hills.</strong> A round valley under six random waves, three black holes, and haze on every tap of the ground. The heroes know the land only through their staffs: four taps make a slope, and in the haze every tap is a little wrong. A black hole is a steep, narrow pit: nobody feels it until they step onto its rim. ' +
        'The Cartographer\u2019s long strides drop it into one of the holes, where its line search stalls. The Pilgrim and the Twins settle in the valley\u2019s lowest hollow and never meet a hole. The treasure lies at the bottom of the deepest hole, and no hero finds it. ' +
        'Ask the King in the view below for other weather, or change it under Weather.'
    }
  };
  var C_RANGE = { canyon: [-0.1, 1.1, -0.1, 1.1], wall: [-0.2, 1.7, -0.45, 1.45], misty: [-1.4, 1.4, -1.4, 1.4] };
  var QUAD_SPECS = function (key) {
    var cr = C_RANGE[key];
    return [
      { key: 'l1', sym: '\u03bb<sub>1</sub>', name: 'Curvature along the valley', min: 0.1, max: 30, log: true, d: 2 },
      { key: 'l2', sym: '\u03bb<sub>2</sub>', name: 'Curvature across the valley', min: 0.1, max: 30, log: true, d: 2 },
      { key: 'theta', sym: '\u03b8', name: 'Heading of the valley, in degrees', min: 0, max: 180, step: 1, d: 0 },
      { key: 'c1', sym: 'c<sub>1</sub>', name: 'The spring, first coordinate', min: cr[0], max: cr[1], step: 0.01, d: 2 },
      { key: 'c2', sym: 'c<sub>2</sub>', name: 'The spring, second coordinate', min: cr[2], max: cr[3], step: 0.01, d: 2 }
    ];
  };
  var TOWER_SPECS = [
    { key: 'y1', sym: 'y<sub>1</sub>', name: 'Lantern reading for sentry 1', min: -1.5, max: 1.5, step: 0.01, d: 2 },
    { key: 'y2', sym: 'y<sub>2</sub>', name: 'Lantern reading for sentry 2', min: -1.5, max: 1.5, step: 0.01, d: 2 },
    { key: 's2', sym: '\u03c3<sup>2</sup>', name: 'Haze over the lanterns', min: 0.05, max: 2, log: true, d: 3 },
    { key: 'muP', sym: '\u03bc<sub>p</sub>', name: 'Height of the law hill (walkers only)', min: 0, max: 20, step: 0.05, d: 2 },
    { key: 'muB', sym: '\u03bc<sub>b</sub>', name: 'Height of the flags\u2019 ridge', min: 0, max: 4, step: 0.05, d: 2 }
  ];
  var WEATHER_SPECS = [
    { key: 'ripA', sym: 'A', name: 'Ripple height, as a share of the land\u2019s height', min: 0, max: 0.3, step: 0.005, d: 3 },
    { key: 'ripL', sym: 'L', name: 'Ripple length, as a share of the map\u2019s width', min: 0.04, max: 0.6, log: true, d: 3 },
    { key: 'haze', sym: '\u03c3', name: 'Haze on each tap, as a share of the land\u2019s height', min: 0, max: 0.03, step: 0.0005, d: 4 },
    { key: 'staff', sym: 'h', name: 'Staff length, as a share of the map\u2019s width', min: 0.002, max: 0.06, log: true, d: 3 },
    { key: 'holes', sym: '\u25cf', name: 'Black holes', min: 0, max: 8, step: 1, d: 0 },
    { key: 'holeDepth', sym: 'D', name: 'Depth of the black holes, as a share of the land\u2019s height', min: 0.1, max: 2, log: true, d: 2 },
    { key: 'holeWidth', sym: 'w', name: 'Width of the black holes, as a share of the map\u2019s width', min: 0.01, max: 0.08, log: true, d: 3 },
    { key: 'seed', sym: '#', name: 'Weather seed (ripples and hole places)', min: 1, max: 999, step: 1, d: 0 }
  ];
  var HERO_SPECS = [
    { key: 'alpha', sym: '\u03b1', name: 'The Pilgrim\u2019s stride', min: 0.001, max: 1, log: true, d: 3 },
    { key: 'm', sym: 'm', name: 'Pages in the Cartographer\u2019s journal', min: 0, max: 20, step: 1, d: 0 },
    { key: 'rho', sym: '\u03c1', name: 'Tension of the Twins\u2019 rope', min: 0.1, max: 50, log: true, d: 2 },
    { key: 'days', sym: 'K', name: 'Days to walk', min: 10, max: 400, step: 10, d: 0 }
  ];
  var HEROES = ['pg', 'lb', 'tw'];

  // ------------------------------------------------------------------ state
  var STORE = 'kings-land-v1';
  var state = { land: 'canyon', params: {}, day: 0, t: 0, frac: null, playing: false, speed: 1, cam: {}, show: { pg: true, lb: true, tw: true }, sqrt: false, twinsLand: false, logHeight: {}, night: false };
  Object.keys(LANDS).forEach(function (k) { state.params[k] = Object.assign({}, LANDS[k].preset); state.cam[k] = Object.assign({}, LANDS[k].cam); state.logHeight[k] = LANDS[k].kind === 'quad'; });
  try {
    var saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved && saved.params) Object.keys(saved.params).forEach(function (k) { if (state.params[k]) Object.assign(state.params[k], saved.params[k]); });
    Object.keys(state.params).forEach(function (k) { var pr = LANDS[k].preset; Object.keys(pr).forEach(function (q) { if (state.params[k][q] === undefined) state.params[k][q] = pr[q]; }); });
    if (saved && LANDS[saved.land]) state.land = saved.land;
  } catch (e) { /* storage unavailable: start from the tale's settings */ }
  var hash = (location.hash || '').slice(1);
  if (LANDS[hash]) state.land = hash;
  function persist() { try { localStorage.setItem(STORE, JSON.stringify({ land: state.land, params: state.params })); } catch (e) { /* ignore */ } }

  var model = null;

  function startOf(key, p) {
    var L = LANDS[key];
    if (L.kind === 'tower') {
      if (p.sx == null) return E.lanternStart(p);
      return [p.sx, p.sy];
    }
    var box = E.KINDS[key].box;
    if (box) return [clamp(p.sx, box[0], box[1]), clamp(p.sy, box[0], box[1])];
    return [p.sx, p.sy];
  }
  function shown() { var r = game && game.view ? game.view().riding : null; return r ? { pg: r === 'pg', lb: r === 'lb', tw: r === 'tw' } : state.show; }
  function lawDistance(land, x) {
    if (land.kind === 'quad') return land.box ? dist(x, E.clipBox(x, land.box)) : 0;
    return dist(x, land.project(x));
  }
  function at(walk, k) { return walk[Math.min(k, walk.length - 1)]; }

  function compute() {
    var key = state.land, L = LANDS[key], p = state.params[key];
    var land = E.buildLand(key, p), x0 = startOf(key, p), K = Math.round(p.days);
    var walks = { pg: E.pilgrim(land, x0, p.alpha, K), lb: E.cartographer(land, x0, Math.round(p.m), K), tw: E.twins(land, x0, p.rho, K) };
    var span = L.view[1] - L.view[0], tol = 1e-3 * span;
    var info = {};
    HEROES.forEach(function (h) {
      var w = walks[h], lost = w.lost != null;
      var settle = lost ? null : E.settled(w, 'x', tol);
      var moving = !lost && w.rest == null && settle > K - 3;
      info[h] = { lost: lost, lostDay: w.lost, settle: settle, moving: moving };
    });
    // The lowest point of the walkers' land, for the height chart.
    var Jlow;
    if (L.kind === 'quad') Jlow = land.J(land.treasure);
    else {
      var best = null, bz = Infinity, n = 97;
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
        var q = [-1 + 2 * i / (n - 1), -1 + 2 * j / (n - 1)], z = land.J(q);
        if (z < bz) { bz = z; best = q; }
      }
      var polish = E.pilgrim(land, best, 0.004, 2500);
      Jlow = Math.min(bz, polish[polish.length - 1].J);
    }
    HEROES.forEach(function (h) { walks[h].forEach(function (d) { if (h !== 'tw' && isFinite(d.J)) Jlow = Math.min(Jlow, d.J); }); });
    var last = 0;
    HEROES.forEach(function (h) { var f = info[h]; last = Math.max(last, f.lost ? walks[h].length : f.settle); });
    model = { key: key, L: L, p: p, land: land, x0: x0, K: K, walks: walks, info: info, Jlow: Jlow, tol: tol, span: span,
              lastDay: Math.min(K, last + 3) };
    $('day').max = K;
    if (state.day > K) state.day = K;
  }

  // ------------------------------------------------------------------ colours from the theme
  var C = {}, RGB = {};
  function hexRGB(s) {
    s = s.trim();
    if (s[0] === '#') { var h = s.slice(1); if (h.length === 3) h = h.replace(/./g, '$&$&'); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
    var m = s.match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
  }
  function readColours() {
    var cs = getComputedStyle(document.documentElement);
    ['paper', 'sheet', 'ink', 'ink-2', 'blue', 'orange', 'rule', 'contour', 'facet', 'halo', 'twin'].forEach(function (k) { C[k] = cs.getPropertyValue('--' + k).trim(); });
    C.low = hexRGB(cs.getPropertyValue('--low')); C.mid = hexRGB(cs.getPropertyValue('--mid')); C.high = hexRGB(cs.getPropertyValue('--high'));
    C.rlow = hexRGB(cs.getPropertyValue('--relief-low')); C.rmid = hexRGB(cs.getPropertyValue('--relief-mid')); C.rhigh = hexRGB(cs.getPropertyValue('--relief-high'));
    C.hero = { pg: C.orange, lb: C.blue, tw: C.twin };
    RGB = {};
    ['paper', 'ink', 'blue', 'orange', 'twin', 'fog', 'sky', 'nightfog', 'nightsky'].forEach(function (k) { RGB[k] = hexRGB(cs.getPropertyValue('--' + k)); });
    RGB.rlow = C.rlow; RGB.rmid = C.rmid; RGB.rhigh = C.rhigh;
  }
  function ramp(t, a, b, c) {
    t = clamp(t, 0, 1);
    var u = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5, p = t < 0.5 ? a : b, q = t < 0.5 ? b : c;
    return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u];
  }

  function fitCanvas(cv) {
    var dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    var W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
  function field() { return state.twinsLand && model.land.kind === 'tower' ? model.land.f : model.land.J; }

  // ------------------------------------------------------------------ the map
  var bg = document.createElement('canvas'), bgKey = '', fogMask = null;
  function mapGeom(cv) {
    var W = cv.clientWidth, H = cv.clientHeight, padL = 40, padB = 32, padT = 12, padR = 14;
    var size = Math.max(10, Math.min(W - padL - padR, H - padT - padB));
    var ox = padL + (W - padL - padR - size) / 2, oy = padT + (H - padT - padB - size) / 2, v = model.L.view;
    return {
      W: W, H: H, ox: ox, oy: oy, size: size, v: v,
      X: function (x) { return ox + (x - v[0]) / (v[1] - v[0]) * size; },
      Y: function (y) { return oy + size - (y - v[2]) / (v[3] - v[2]) * size; },
      inv: function (px, py) { return [v[0] + (px - ox) / size * (v[1] - v[0]), v[2] + (oy + size - py) / size * (v[3] - v[2])]; }
    };
  }

  function marching(Z, nx, ny, level, emit) {
    for (var j = 0; j < ny - 1; j++) for (var i = 0; i < nx - 1; i++) {
      var a = Z[j * nx + i], b = Z[j * nx + i + 1], c = Z[(j + 1) * nx + i + 1], d = Z[(j + 1) * nx + i];
      var idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      var t = function (p, q) { return (level - p) / (q - p); };
      var top = [i + t(a, b), j], right = [i + 1, j + t(b, c)], bottom = [i + t(d, c), j + 1], left = [i, j + t(a, d)];
      switch (idx) {
        case 1: case 14: emit(left, bottom); break;
        case 2: case 13: emit(bottom, right); break;
        case 3: case 12: emit(left, right); break;
        case 4: case 11: emit(top, right); break;
        case 5: emit(left, top); emit(bottom, right); break;
        case 6: case 9: emit(top, bottom); break;
        case 7: case 8: emit(left, top); break;
        case 10: emit(top, right); emit(left, bottom); break;
      }
    }
  }

  function renderBackground(cv, g) {
    var dpr = window.devicePixelRatio || 1;
    bg.width = cv.width; bg.height = cv.height;
    var ctx = bg.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, g.W, g.H);
    var F = field(), v = g.v, res = Math.max(80, Math.min(260, Math.round(g.size / 2)));
    var Z = new Float64Array(res * res), zmin = Infinity, zmax = -Infinity;
    for (var j = 0; j < res; j++) for (var i = 0; i < res; i++) {
      var x = v[0] + (i + 0.5) / res * (v[1] - v[0]), y = v[3] - (j + 0.5) / res * (v[3] - v[2]);
      var z = F([x, y]); Z[j * res + i] = z; if (z < zmin) zmin = z; if (z > zmax) zmax = z;
    }
    var img = document.createElement('canvas'); img.width = res; img.height = res;
    var ictx = img.getContext('2d'), data = ictx.createImageData(res, res), holes = model.land.holes;
    if (holes) zmin = Math.max(zmin, model.land.floor);
    for (var k = 0; k < res * res; k++) {
      var c = ramp(Math.sqrt(Math.max(0, Z[k] - zmin) / (zmax - zmin || 1)), C.low, C.mid, C.high);
      data.data[4 * k] = c[0]; data.data[4 * k + 1] = c[1]; data.data[4 * k + 2] = c[2]; data.data[4 * k + 3] = 255;
    }
    ictx.putImageData(data, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, g.ox, g.oy, g.size, g.size);
    // contours, evenly spaced in the square root of height
    ctx.save(); ctx.beginPath(); ctx.rect(g.ox, g.oy, g.size, g.size); ctx.clip();
    ctx.strokeStyle = C.contour; ctx.lineWidth = 1;
    var cell = g.size / res;
    for (var lv = 1; lv < 16; lv++) {
      var level = zmin + (zmax - zmin) * Math.pow(lv / 16, 2);
      ctx.beginPath();
      marching(Z, res, res, level, function (p, q) {
        ctx.moveTo(g.ox + (p[0] + 0.5) * cell, g.oy + (p[1] + 0.5) * cell);
        ctx.lineTo(g.ox + (q[0] + 0.5) * cell, g.oy + (q[1] + 0.5) * cell);
      });
      ctx.stroke();
    }
    if (holes) holes.at.forEach(function (q) {
      var px = g.X(q[0]), py = g.Y(q[1]), r = holes.w / (v[1] - v[0]) * g.size;
      var grd = ctx.createRadialGradient(px, py, 0, px, py, 2.2 * r);
      grd.addColorStop(0, 'rgba(4,3,6,0.97)'); grd.addColorStop(0.45, 'rgba(4,3,6,0.85)'); grd.addColorStop(0.62, 'rgba(236,124,20,0.55)'); grd.addColorStop(1, 'rgba(236,124,20,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(px, py, 2.2 * r, 0, 2 * Math.PI); ctx.fill();
    });
    ctx.restore();
    // frame and ticks
    ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.strokeRect(g.ox + 0.5, g.oy + 0.5, g.size - 1, g.size - 1);
    ctx.fillStyle = C.ink; ctx.font = '12px ' + getComputedStyle(document.body).fontFamily;
    var step = model.L.kind === 'tower' ? 0.5 : 0.5;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var tx = Math.ceil(v[0] / step) * step; tx <= v[1] + 1e-9; tx += step) {
      var px = g.X(tx); ctx.fillRect(px, g.oy + g.size, 1, 4); ctx.fillText(fmt(tx, tx % 1 ? 1 : 0), px, g.oy + g.size + 6);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var ty = Math.ceil(v[2] / step) * step; ty <= v[3] + 1e-9; ty += step) {
      var py = g.Y(ty); ctx.fillRect(g.ox - 4, py, 4, 1); ctx.fillText(fmt(ty, ty % 1 ? 1 : 0), g.ox - 7, py);
    }
    ctx.font = 'italic 13px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('x\u2081', g.ox + g.size, g.oy + g.size + 18);
    ctx.save(); ctx.translate(g.ox - 30, g.oy + 8); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('x\u2082', 0, 0); ctx.restore();
    drawLawShapes(ctx, g);
  }

  function star(ctx, x, y, r, fill, stroke) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
    }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function label(ctx, text, x, y, align, colour, base) {
    ctx.font = '600 12.5px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = align || 'left'; ctx.textBaseline = base || 'middle';
    ctx.lineWidth = 3.5; ctx.strokeStyle = C.halo; ctx.lineJoin = 'round'; ctx.strokeText(text, x, y);
    ctx.fillStyle = colour || C.ink; ctx.fillText(text, x, y);
  }

  function drawLawShapes(ctx, g) {
    var land = model.land, L = model.L;
    ctx.save(); ctx.beginPath(); ctx.rect(g.ox, g.oy, g.size, g.size); ctx.clip();
    if (L.kind === 'quad' && land.box) {
      var bx = land.box, bw = bx[1] - bx[0], x0 = g.X(bx[0]), x1 = g.X(bx[1]), y0 = g.Y(bx[0]), y1 = g.Y(bx[1]);
      ctx.fillStyle = C.blue; ctx.globalAlpha = 0.06; ctx.fillRect(x0, y1, x1 - x0, y0 - y1); ctx.globalAlpha = 1;
      ctx.strokeStyle = C.blue; ctx.lineWidth = 2.2; ctx.strokeRect(x0, y1, x1 - x0, y0 - y1);
      ctx.fillStyle = C.blue;
      var mw = Math.max(3, (x1 - x0) * 0.026);
      for (var t = bx[0] + 0.05 * bw; t < bx[1] - 0.04 * bw; t += 0.1 * bw) {
        ctx.fillRect(g.X(bx[1]), g.Y(t) - mw * 0.75, mw, mw * 1.5);
        ctx.fillRect(g.X(t) - mw * 0.75, g.Y(bx[1]) - mw, mw * 1.5, mw);
        ctx.fillRect(g.X(bx[0]) - mw, g.Y(t) - mw * 0.75, mw, mw * 1.5);
        ctx.fillRect(g.X(t) - mw * 0.75, g.Y(bx[0]), mw * 1.5, mw);
      }
      if (L.wall) {
        var c = land.c;
        ctx.beginPath(); ctx.arc(g.X(c[0]), g.Y(c[1]), 5, 0, 2 * Math.PI); ctx.lineWidth = 2; ctx.strokeStyle = C.blue; ctx.stroke();
      }
    }
    if (L.kind === 'tower') {
      var s = land.lawSegment;
      ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.strokeRect(g.X(-1), g.Y(1), g.X(1) - g.X(-1), g.Y(-1) - g.Y(1)); ctx.setLineDash([]);
      ctx.strokeStyle = C.blue; ctx.lineWidth = 4; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(g.X(s[0][0]), g.Y(s[0][1])); ctx.lineTo(g.X(s[1][0]), g.Y(s[1][1])); ctx.stroke(); ctx.globalAlpha = 1;
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (q) {
        var px = g.X(q[0]), py = g.Y(q[1]);
        ctx.beginPath(); ctx.arc(px, py, 6, 0, 2 * Math.PI);
        if (q[0] * q[1] === land.lawSign) { ctx.fillStyle = C.blue; ctx.fill(); } else { ctx.fillStyle = C.paper; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.orange; ctx.stroke(); }
      });
      var ly = lanternSpot(g), lx = ly[0], lyy = ly[1];
      ctx.beginPath(); ctx.moveTo(lx, lyy - 7); ctx.lineTo(lx + 6, lyy); ctx.lineTo(lx, lyy + 7); ctx.lineTo(lx - 6, lyy); ctx.closePath();
      ctx.fillStyle = C.orange; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
    }
    var T = land.treasure;
    star(ctx, g.X(T[0]), g.Y(T[1]), 10, C.orange, C.halo);
    ctx.restore();
  }
  function lanternSpot(g) { var y = model.land.y; return [g.X(clamp(y[0], -1.17, 1.17)), g.Y(clamp(y[1], -1.17, 1.17))]; }
  // Labels go above the paths, so no path ever covers their text.
  function drawLawLabels(ctx, g) {
    var land = model.land, L = model.L;
    ctx.save(); ctx.beginPath(); ctx.rect(g.ox, g.oy, g.size, g.size); ctx.clip();
    if (L.kind === 'quad' && land.box) {
      label(ctx, L.wall ? 'the kingdom' : 'the realm\u2019s edge', g.X(land.box[0]) + 8, g.Y(land.box[1]) + 14, 'left', C.blue);
      if (L.wall) label(ctx, 'spring', g.X(land.c[0]) + 9, g.Y(land.c[1]), 'left', C.blue);
    }
    if (L.kind === 'tower') {
      var s = land.lawSegment;
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (q) {
        var ok = q[0] * q[1] === land.lawSign, word = (q[0] > 0 ? '+' : '−') + (q[1] > 0 ? '+' : '−');
        label(ctx, word + (ok ? ' lawful' : ' broken'), g.X(q[0]) + (q[0] > 0 ? -10 : 10), g.Y(q[1]) + (q[1] > 0 ? -14 : 14), q[0] > 0 ? 'right' : 'left', ok ? C.blue : C.orange);
      });
      var mid = [(s[0][0] + s[1][0]) / 2 + 0.06, (s[0][1] + s[1][1]) / 2 - 0.12];
      label(ctx, 'the law', g.X(mid[0]) + 6, g.Y(mid[1]), 'left', C.blue);
      var ls = lanternSpot(g);
      label(ctx, 'lanterns', ls[0], ls[1] - 12, 'center', C.orange, 'bottom');
    }
    ctx.restore();
  }

  function drawPath(ctx, g, pts, colour, width, dash) {
    if (pts.length < 2) return;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(g.X(p[0]), g.Y(p[1])); else ctx.moveTo(g.X(p[0]), g.Y(p[1])); });
    ctx.setLineDash([]); ctx.strokeStyle = C.halo; ctx.lineWidth = width + 3; ctx.stroke();
    ctx.setLineDash(dash || []); ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke(); ctx.setLineDash([]);
  }
  function drawDots(ctx, g, pts, colour, r) {
    ctx.fillStyle = colour;
    pts.forEach(function (p) { ctx.beginPath(); ctx.arc(g.X(p[0]), g.Y(p[1]), r, 0, 2 * Math.PI); ctx.fill(); });
  }
  function marker(ctx, kind, x, y, colour) {
    ctx.lineWidth = 2.5; ctx.strokeStyle = C.halo; ctx.fillStyle = colour; ctx.beginPath();
    if (kind === 'pg') ctx.arc(x, y, 7, 0, 2 * Math.PI);
    else if (kind === 'lb') ctx.rect(x - 6.5, y - 6.5, 13, 13);
    else { ctx.moveTo(x, y - 8.5); ctx.lineTo(x + 8, y + 6); ctx.lineTo(x - 8, y + 6); ctx.closePath(); }
    ctx.stroke(); ctx.fill();
  }
  function arrow(ctx, x0, y0, x1, y1, colour) {
    var a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0);
    if (L < 2) return;
    ctx.strokeStyle = C.halo; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    var h = Math.min(9, L * 0.6);
    ctx.fillStyle = colour; ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - h * Math.cos(a - 0.45), y1 - h * Math.sin(a - 0.45)); ctx.lineTo(x1 - h * Math.cos(a + 0.45), y1 - h * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
  }

  function drawMap() {
    var cv = $('map'), ctx = fitCanvas(cv), g = mapGeom(cv);
    var key = [model.key, JSON.stringify(model.p), cv.width, cv.height, state.twinsLand, C.paper].join('|');
    if (key !== bgKey) { renderBackground(cv, g); bgKey = key; }
    ctx.clearRect(0, 0, g.W, g.H);
    ctx.drawImage(bg, 0, 0, g.W, g.H);
    var racing = game && game.race();
    if (racing) {
      // fog of war: the land shows only where you have walked, felt or scouted
      if (!fogMask) fogMask = document.createElement('canvas');
      fogMask.width = cv.width; fogMask.height = cv.height;
      var fm = fogMask.getContext('2d'), dprm = window.devicePixelRatio || 1;
      fm.setTransform(dprm, 0, 0, dprm, 0, 0);
      fm.fillStyle = C.sheet; fm.fillRect(g.ox, g.oy, g.size, g.size);
      fm.strokeStyle = C.rule; fm.lineWidth = 1;
      for (var hz = 0; hz < g.size; hz += 14) { fm.beginPath(); fm.moveTo(g.ox + hz, g.oy); fm.lineTo(g.ox, g.oy + hz); fm.stroke(); fm.beginPath(); fm.moveTo(g.ox + g.size, g.oy + hz); fm.lineTo(g.ox + hz, g.oy + g.size); fm.stroke(); }
      fm.globalCompositeOperation = 'destination-out';
      racing.explored.forEach(function (e) { var r = e[2] / (g.v[1] - g.v[0]) * g.size, gr = fm.createRadialGradient(g.X(e[0]), g.Y(e[1]), r * 0.6, g.X(e[0]), g.Y(e[1]), r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); fm.fillStyle = gr; fm.beginPath(); fm.arc(g.X(e[0]), g.Y(e[1]), r, 0, 2 * Math.PI); fm.fill(); });
      fm.globalCompositeOperation = 'source-over';
      ctx.drawImage(fogMask, 0, 0, g.W, g.H);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(g.ox, g.oy, g.size, g.size); ctx.clip();
    var k = state.day, W = model.walks, marks = [], lastOf = function (w) { return Math.min(k, w.length - 1); };
    if (shown().tw) {
      var tw = W.tw, kt = lastOf(tw), xs = [], zs = [];
      for (var i = 0; i <= kt; i++) { xs.push(tw[i].x); zs.push(tw[i].z); }
      ctx.strokeStyle = C.blue; ctx.lineWidth = 1.3; ctx.setLineDash([2.5, 2]);
      zs.forEach(function (z, i) { if (!i) return; ctx.beginPath(); ctx.arc(g.X(z[0]), g.Y(z[1]), 4, 0, 2 * Math.PI); ctx.stroke(); });
      ctx.setLineDash([]);
      drawPath(ctx, g, xs, C.twin, 1.8);
      drawDots(ctx, g, xs.slice(1), C.twin, 2.3);
      var cur = tw[kt];
      ctx.strokeStyle = C.orange; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(g.X(cur.x[0]), g.Y(cur.x[1])); ctx.lineTo(g.X(cur.z[0]), g.Y(cur.z[1])); ctx.stroke(); ctx.setLineDash([]);
      if (Math.hypot(cur.u[0], cur.u[1]) > 1e-6) arrow(ctx, g.X(cur.z[0]), g.Y(cur.z[1]), g.X(cur.z[0] + cur.u[0]), g.Y(cur.z[1] + cur.u[1]), C.orange);
      marks.push(function () {
        ctx.strokeStyle = C.halo; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(g.X(cur.z[0]), g.Y(cur.z[1]), 8.5, 0, 2 * Math.PI); ctx.stroke();
        ctx.strokeStyle = C.blue; ctx.lineWidth = 2; ctx.setLineDash([3, 2.5]); ctx.beginPath(); ctx.arc(g.X(cur.z[0]), g.Y(cur.z[1]), 8.5, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
        marker(ctx, 'tw', g.X(cur.x[0]), g.Y(cur.x[1]), C.twin);
      });
    }
    if (shown().lb) {
      var lb = W.lb, kl = lastOf(lb), ls = [];
      for (var a = 0; a <= kl; a++) ls.push(lb[a].x);
      if (kl >= 1 && lb[kl].trials && lb[kl].trials.length) {
        var from = lb[kl - 1].x, tr = lb[kl].trials;
        ctx.strokeStyle = C.blue; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.moveTo(g.X(from[0]), g.Y(from[1])); ctx.lineTo(g.X(tr[0].x[0]), g.Y(tr[0].x[1])); ctx.stroke(); ctx.setLineDash([]);
        tr.forEach(function (q) { ctx.beginPath(); ctx.arc(g.X(q.x[0]), g.Y(q.x[1]), 3.5, 0, 2 * Math.PI); ctx.lineWidth = 1.4; ctx.stroke(); });
        ctx.globalAlpha = 1;
      }
      drawPath(ctx, g, ls, C.blue, 2);
      drawDots(ctx, g, ls.slice(1), C.blue, 2.4);
      var lbAt = lb[kl].x; marks.push(function () { marker(ctx, 'lb', g.X(lbAt[0]), g.Y(lbAt[1]), C.blue); });
    }
    if (shown().pg) {
      var pg = W.pg, kp = lastOf(pg), ps = [];
      for (var b = 0; b <= kp; b++) ps.push(pg[b].x);
      var today = pg[kp];
      if (kp >= 1 && today.clipped) {
        var prev = pg[kp - 1].x;
        ctx.strokeStyle = C.orange; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(g.X(prev[0]), g.Y(prev[1])); ctx.lineTo(g.X(today.raw[0]), g.Y(today.raw[1])); ctx.lineTo(g.X(today.x[0]), g.Y(today.x[1])); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(g.X(today.raw[0]), g.Y(today.raw[1]), 4.5, 0, 2 * Math.PI); ctx.lineWidth = 1.6; ctx.stroke();
      }
      drawPath(ctx, g, ps, C.orange, 2);
      drawDots(ctx, g, ps.slice(1), C.orange, 2.4);
      marks.push(function () { marker(ctx, 'pg', g.X(today.x[0]), g.Y(today.x[1]), C.orange); });
    }
    drawLawLabels(ctx, g);
    marks.forEach(function (f) { f(); });
    if (game) {
      var gv = game.view(), px0 = g.X(gv.x), py0 = g.Y(gv.y), rr = gv.reach / (g.v[1] - g.v[0]) * g.size;
      ctx.beginPath(); ctx.moveTo(px0, py0); ctx.arc(px0, py0, rr, -gv.heading - 0.675, -gv.heading + 0.675); ctx.closePath();
      ctx.fillStyle = C.ink; ctx.globalAlpha = 0.07; ctx.fill(); ctx.globalAlpha = 0.45; ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
      if (!gv.riding) {     // when you follow a hero, its own marker shows where the view is
        ctx.beginPath(); ctx.arc(px0, py0, 5.5, 0, 2 * Math.PI); ctx.fillStyle = C.paper; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px0 + 11 * Math.cos(gv.heading), py0 - 11 * Math.sin(gv.heading)); ctx.stroke();
        label(ctx, 'you', px0 + 9, py0 + 12, 'left', C.ink);
      }
    }
    // the start flag
    var s = model.x0, fx = g.X(s[0]), fy = g.Y(s[1]);
    ctx.strokeStyle = C.halo; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 22); ctx.stroke();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx, fy - 22); ctx.lineTo(fx + 13, fy - 17.5); ctx.lineTo(fx, fy - 13); ctx.closePath();
    ctx.fillStyle = C.paper; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ the relief
  var reliefKey = '', relief = null;
  function reliefGrid() {
    var key = [model.key, JSON.stringify(model.p), state.twinsLand, state.sqrt].join('|');
    if (key === reliefKey) return relief;
    var F = field(), v = model.L.view, holes = model.land.holes, n = holes ? 72 : 38, Z = [], zmin = Infinity, zmax = -Infinity;
    for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) {
      var z = F([v[0] + i / (n - 1) * (v[1] - v[0]), v[2] + j / (n - 1) * (v[3] - v[2])]);
      Z.push(z); if (z < zmin) zmin = z; if (z > zmax) zmax = z;
    }
    var sq = state.sqrt;
    if (holes) zmin = Math.max(zmin, model.land.floor);
    var norm = function (z) { var t = clamp((z - zmin) / (zmax - zmin || 1), holes ? -0.7 : 0, 1); return sq ? (t < 0 ? -Math.sqrt(-t) : Math.sqrt(t)) : t; };
    var dark = [];
    for (var j2 = 0; j2 < n - 1; j2++) for (var i2 = 0; i2 < n - 1; i2++) dark.push(holes ? holes.depth([v[0] + (i2 + 0.5) / (n - 1) * (v[1] - v[0]), v[2] + (j2 + 0.5) / (n - 1) * (v[3] - v[2])]) : 0);
    relief = { n: n, W: Z.map(norm), norm: norm, F: F, dark: dark };
    reliefKey = key;
    return relief;
  }
  function drawRelief() {
    var cv = $('relief'), ctx = fitCanvas(cv), Wd = cv.clientWidth, Ht = cv.clientHeight;
    ctx.clearRect(0, 0, Wd, Ht);
    var R = reliefGrid(), v = model.L.view, n = R.n, cam = state.cam[model.key];
    var az = cam.az * Math.PI / 180, el = cam.el * Math.PI / 180, ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el), HZ = 0.8;
    var U = function (x) { return 2 * (x - v[0]) / (v[1] - v[0]) - 1; }, V = function (y) { return 2 * (y - v[2]) / (v[3] - v[2]) - 1; };
    function P(u, w, h) { var a = u * ca - w * sa, b = u * sa + w * ca, hh = h * HZ; return [a, -(hh * ce + b * se), b * ce - hh * se]; }
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    [-1, 1].forEach(function (u) { [-1, 1].forEach(function (w) { [0, 1].forEach(function (h) { var p = P(u, w, h); minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }); }); });
    var S = Math.min((Wd - 40) / (maxX - minX), (Ht - 40) / (maxY - minY)), offX = Wd / 2 - S * (minX + maxX) / 2, offY = Ht / 2 - S * (minY + maxY) / 2;
    function Q(u, w, h) { var p = P(u, w, h); return [offX + S * p[0], offY + S * p[1], p[2]]; }
    var items = [];
    // the floor
    var fl = [Q(-1, -1, 0), Q(1, -1, 0), Q(1, 1, 0), Q(-1, 1, 0)];
    ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.beginPath(); fl.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.stroke();
    // the surface
    var light = [-0.45, -0.55, 0.7], ll = Math.hypot(light[0], light[1], light[2]);
    light = light.map(function (c) { return c / ll; });
    for (var j = 0; j < n - 1; j++) for (var i = 0; i < n - 1; i++) {
      var u0 = -1 + 2 * i / (n - 1), u1 = -1 + 2 * (i + 1) / (n - 1), w0 = -1 + 2 * j / (n - 1), w1 = -1 + 2 * (j + 1) / (n - 1);
      var h00 = R.W[j * n + i], h10 = R.W[j * n + i + 1], h11 = R.W[(j + 1) * n + i + 1], h01 = R.W[(j + 1) * n + i];
      var pts = [Q(u0, w0, h00), Q(u1, w0, h10), Q(u1, w1, h11), Q(u0, w1, h01)];
      var du = [u1 - u0, 0, (h10 - h00 + h11 - h01) / 2 * HZ], dw = [0, w1 - w0, (h01 - h00 + h11 - h10) / 2 * HZ];
      var nx = du[1] * dw[2] - du[2] * dw[1], ny = du[2] * dw[0] - du[0] * dw[2], nz = du[0] * dw[1] - du[1] * dw[0], nl = Math.hypot(nx, ny, nz);
      var shade = 0.78 + 0.3 * Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / nl);
      var col = ramp(Math.max(0, (h00 + h10 + h11 + h01) / 4), C.rlow, C.rmid, C.rhigh), dk = R.dark[j * (n - 1) + i];
      if (dk > 0.3) { var bk = Math.min(1, (dk - 0.3) / 0.4) * 0.95; col = [col[0] * (1 - bk) + 6 * bk, col[1] * (1 - bk) + 4 * bk, col[2] * (1 - bk) + 8 * bk]; }
      items.push({ d: (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4, t: 0, p: pts,
        c: 'rgb(' + Math.min(255, col[0] * shade | 0) + ',' + Math.min(255, col[1] * shade | 0) + ',' + Math.min(255, col[2] * shade | 0) + ')' });
    }
    var lift = 0.012;
    function hAt(x) { return R.norm(R.F(x)) + lift; }
    function inView(x) { return x[0] >= v[0] && x[0] <= v[1] && x[1] >= v[2] && x[1] <= v[3]; }
    function line3(pts, colour, width, dash, bias) {
      for (var k = 1; k < pts.length; k++) {
        var a = pts[k - 1], b = pts[k];
        if (!inView(a) || !inView(b)) continue;
        var pieces = Math.max(1, Math.ceil(dist(a, b) / ((v[1] - v[0]) / 30)));
        var prev = Q(U(a[0]), V(a[1]), hAt(a));
        for (var s = 1; s <= pieces; s++) {
          var q = [a[0] + (b[0] - a[0]) * s / pieces, a[1] + (b[1] - a[1]) * s / pieces], cur = Q(U(q[0]), V(q[1]), hAt(q));
          items.push({ d: (prev[2] + cur[2]) / 2 - (bias || 0.03), t: 1, a: prev, b: cur, c: colour, w: width, dash: dash });
          prev = cur;
        }
      }
    }
    function dot3(x, kind, colour, r) { if (!inView(x)) return; var p = Q(U(x[0]), V(x[1]), hAt(x)); items.push({ d: p[2] - 0.06, t: 2, p: p, k: kind, c: colour, r: r }); }
    var land = model.land, L = model.L;
    if (L.kind === 'quad' && land.box) {
      var b0 = land.box[0], b1 = land.box[1], bl = function (t) { return b0 + (b1 - b0) * t; };
      var edge = []; for (var e = 0; e <= 40; e++) edge.push([bl(e / 40), b0]);
      var e2 = []; for (e = 0; e <= 40; e++) e2.push([b1, bl(e / 40)]);
      var e3 = []; for (e = 0; e <= 40; e++) e3.push([bl(1 - e / 40), b1]);
      var e4 = []; for (e = 0; e <= 40; e++) e4.push([b0, bl(1 - e / 40)]);
      [edge, e2, e3, e4].forEach(function (pp) { line3(pp, C.blue, 3, null, 0.02); });
    }
    if (L.kind === 'tower') {
      line3([land.lawSegment[0], land.lawSegment[1]], C.blue, 3.5, null, 0.02);
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (q) {
        var ok = (q[0] * q[1] > 0) === (land.lawSegment[0][0] * land.lawSegment[0][1] > 0);
        dot3(q, ok ? 'lawful' : 'broken', ok ? C.blue : C.orange, 5);
      });
    }
    dot3(land.treasure, 'star', C.orange, 9);
    var k = state.day, Wk = model.walks;
    function upto(w, key) { var out = []; for (var i = 0; i <= Math.min(k, w.length - 1); i++) out.push(w[i][key]); return out; }
    if (shown().tw) { var tz = upto(Wk.tw, 'z'); line3(upto(Wk.tw, 'x'), C.twin, 2); dot3(tz[tz.length - 1], 'warden', C.blue, 8); var tx = upto(Wk.tw, 'x'); dot3(tx[tx.length - 1], 'tw', C.twin, 7); }
    if (shown().lb) { var lx = upto(Wk.lb, 'x'); line3(lx, C.blue, 2.2); dot3(lx[lx.length - 1], 'lb', C.blue, 6.5); }
    if (shown().pg) { var px = upto(Wk.pg, 'x'); line3(px, C.orange, 2.2); dot3(px[px.length - 1], 'pg', C.orange, 7); }
    dot3(model.x0, 'flag', C.ink, 6);
    items.sort(function (a, b) { return b.d - a.d; });
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    items.forEach(function (it) {
      if (it.t === 0) {
        ctx.beginPath(); ctx.moveTo(it.p[0][0], it.p[0][1]); ctx.lineTo(it.p[1][0], it.p[1][1]); ctx.lineTo(it.p[2][0], it.p[2][1]); ctx.lineTo(it.p[3][0], it.p[3][1]); ctx.closePath();
        ctx.fillStyle = it.c; ctx.fill(); ctx.strokeStyle = it.c; ctx.lineWidth = 0.6; ctx.stroke();
        ctx.strokeStyle = C.facet; ctx.lineWidth = 0.6; ctx.stroke();
      } else if (it.t === 1) {
        ctx.setLineDash(it.dash || []); ctx.strokeStyle = it.c; ctx.lineWidth = it.w;
        ctx.beginPath(); ctx.moveTo(it.a[0], it.a[1]); ctx.lineTo(it.b[0], it.b[1]); ctx.stroke(); ctx.setLineDash([]);
      } else {
        var p = it.p;
        if (it.k === 'star') { star(ctx, p[0], p[1] - 2, it.r, it.c, C.halo); return; }
        if (it.k === 'flag') {
          ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - 20); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p[0], p[1] - 20); ctx.lineTo(p[0] + 11, p[1] - 16); ctx.lineTo(p[0], p[1] - 12); ctx.closePath(); ctx.fillStyle = C.paper; ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke(); return;
        }
        if (it.k === 'warden') { ctx.strokeStyle = it.c; ctx.lineWidth = 2; ctx.setLineDash([3, 2.5]); ctx.beginPath(); ctx.arc(p[0], p[1], it.r, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]); return; }
        if (it.k === 'lawful') { ctx.fillStyle = it.c; ctx.beginPath(); ctx.arc(p[0], p[1], it.r, 0, 2 * Math.PI); ctx.fill(); return; }
        if (it.k === 'broken') { ctx.fillStyle = C.paper; ctx.strokeStyle = it.c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], it.r, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); return; }
        marker(ctx, it.k, p[0], p[1], it.c);
      }
    });
    // axis names on the floor
    var f1 = Q(0, -1.16, 0), f2 = Q(-1.16, 0, 0);
    label(ctx, 'x\u2081', f1[0], f1[1], 'center', C.ink);
    label(ctx, 'x\u2082', f2[0], f2[1], 'center', C.ink);
  }

  // ------------------------------------------------------------------ status windows
  function strideList(trials, taken) {
    var names = function (s) { var j = Math.round(-Math.log2(s)); return j === 0 ? '1' : j === 1 ? '\u00bd' : j === 2 ? '\u00bc' : j === 3 ? '\u215b' : '1/' + Math.pow(2, j); };
    var all = []; for (var i = 0; i < trials.length; i++) all.push(names(trials[i].step != null ? trials[i].step : Math.pow(2, -i)));
    all.push(names(taken));
    return all;
  }
  function verdictHTML(h) {
    var f = model.info[h], w = model.walks[h], L = model.L, land = model.land, K = model.K, end = w[w.length - 1].x;
    if (f.lost) {
      var lmax = Math.max(model.p.l1 || 0, model.p.l2 || 0);
      return '<span class="bad">Lost on day ' + f.lostDay + ':</span> each stride overshoots more than the last.' + (lmax ? ' Keep \u03b1 below 2/\u03bb<sub>max</sub> = ' + fmt(2 / lmax, 3) + '.' : '');
    }
    var when = f.moving ? 'Still walking after ' + K + ' days' : 'Settles on day ' + f.settle;
    if (L.kind === 'quad') {
      var T = land.treasure, r = L.reach;
      var near = function (q) { return h === 'tw' ? Math.max(dist(q.z, T), dist(q.x, q.z)) < r : dist(q.x, T) < r; };
      var first = -1; for (var i = 0; i < w.length; i++) if (near(w[i])) { first = i; break; }
      var d = dist(end, T);
      if (first >= 0 && near(w[w.length - 1])) return '<span class="good">Within ' + r + ' of the treasure from day ' + first + '.</span> ' + when + '.';
      return '<span class="bad">' + when + ', ' + fmt(d, 3) + ' from the treasure.</span>';
    }
    var lawful = end[0] * end[1] * land.lawSign > 0, truth = Math.sign(end[0]) === Math.sign(land.treasure[0]) && Math.sign(end[1]) === Math.sign(land.treasure[1]);
    var word = signWord(end);
    if (truth) return '<span class="good">' + when + ' at ' + word + ', the true order.</span>';
    if (!lawful) return '<span class="bad">' + when + ' at ' + word + ': the law is broken.</span>';
    return '<span class="bad">' + when + ' at ' + word + ': lawful, but not the King\u2019s order.</span>';
  }
  function row(dt, dd) { return '<div style="display:contents"><dt>' + dt + '</dt><dd>' + dd + '</dd></div>'; }
  function updateStatus() {
    var on = shown();
    Array.prototype.forEach.call(document.querySelectorAll('.hero[data-hero]'), function (el) { el.hidden = !on[el.getAttribute('data-hero')]; });
    var k = state.day, land = model.land, W = model.walks, tower = land.kind === 'tower', edge = model.L.wall ? 'the wall' : 'the edge of the realm';
    // Pilgrim
    var pg = W.pg, kp = Math.min(k, pg.length - 1), dp = pg[kp], gp = land.grad(dp.x);
    var pgRows = row('Day', String(Math.min(k, model.K))) + row('Stands at', pt(dp.x)) + row('Height J', small(dp.J)) + row('Slope |\u2207J|', small(Math.hypot(gp[0], gp[1])));
    if (tower) pgRows += row('Flags', signWord(dp.x));
    $('pg-stats').innerHTML = pgRows;
    var pgToday;
    if (model.info.pg.lost && k >= pg.length - 1) pgToday = 'The strides grew without end; the Pilgrim has left the map.';
    else if (k === 0) pgToday = 'Waits at the start flag.';
    else if (k > pg.length - 1) pgToday = pg[pg.length - 1].clipped ? 'Held: the slope pushes the Pilgrim outward and ' + (model.L.wall ? 'the wall' : 'the edge of the realm') + ' sets it back to the same spot each day.' : 'Rests: the ground is flat where the Pilgrim stands.';
    else {
      var used = dp.g || land.grad(pg[kp - 1].x);
      pgToday = 'Strode \u03b1|\u2207J| = ' + fmt(model.p.alpha * Math.hypot(used[0], used[1]), 3) + (land.sigma > 0 ? ' down the slope its taps reported.' : ' straight down the slope.');
      if (dp.clipped) pgToday += ' ' + (model.L.wall ? 'The wall' : 'The edge of the realm') + ' set the Pilgrim back ' + fmt(dist(dp.raw, dp.x), 3) + '.';
    }
    $('pg-today').innerHTML = pgToday;
    $('pg-verdict').innerHTML = verdictHTML('pg');
    // Cartographer
    var lb = W.lb, kl = Math.min(k, lb.length - 1), dl = lb[kl], gl = land.grad(dl.x);
    var lbRows = row('Day', String(Math.min(k, model.K))) + row('Stands at', pt(dl.x)) + row('Height J', small(dl.J)) + row('Slope |\u2207J|', small(Math.hypot(gl[0], gl[1])));
    lbRows += row('Journal', (kl >= 1 ? dl.pages : 0) + ' of ' + Math.round(model.p.m) + ' pages');
    if (tower) lbRows += row('Flags', signWord(dl.x));
    $('lb-stats').innerHTML = lbRows;
    var lbToday;
    if (k === 0) lbToday = 'Opens an empty journal at the start flag.';
    else if (k > lb.length - 1) lbToday = lb.why === 'line search' ? 'Stopped: no stride, however short, lowered the land by enough' + (land.sigma > 0 ? '; in the haze the taps contradict each other.' : '; along its course this is as low as it can measure.') : 'Rests: the slope has vanished' + (model.land.box ? ' on the stretched map' : '') + '.';
    else {
      var names = strideList(dl.trials || [], dl.step);
      lbToday = (dl.restart ? 'The journal pointed uphill, so its pages were torn out. ' : '') +
        (names.length > 1 ? 'Tried strides ' + names.slice(0, -1).join(', ') + ' (too far); took ' + names[names.length - 1] + '.' : 'Took the full stride of 1 along the journal\u2019s direction.');
    }
    $('lb-today').innerHTML = lbToday;
    $('lb-verdict').innerHTML = verdictHTML('lb');
    // Twins
    var tw = W.tw, kt = Math.min(k, tw.length - 1), dt = tw[kt];
    var twRows = row('Day', String(Math.min(k, model.K))) + row('Wanderer x', pt(dt.x)) + row('Warden z', pt(dt.z)) + row('Ledger u', pt(dt.u)) + row('Gap |x \u2212 z|', small(dist(dt.x, dt.z)));
    if (tower) twRows += row('Flags', signWord(dt.x));
    $('tw-stats').innerHTML = twRows;
    var twToday;
    if (k === 0) twToday = 'The Warden stands on the nearest lawful spot; the ledger is empty.';
    else if (k > tw.length - 1) twToday = 'At rest: the Wanderer and the Warden stand together and the ledger has stopped changing.';
    else {
      var pt0 = tw[kt - 1];
      twToday = 'The Wanderer moved ' + fmt(dist(dt.x, pt0.x), 3) + ', the Warden ' + fmt(dist(dt.z, pt0.z), 3) + '; the ledger added the gap ' + fmt(dist(dt.x, dt.z), 3) + '.';
    }
    $('tw-today').innerHTML = twToday;
    $('tw-verdict').innerHTML = verdictHTML('tw');
  }

  // ------------------------------------------------------------------ the equations
  function n3(v, d) { var s = (Math.abs(v) < 5e-4 && d == null ? 0 : v).toFixed(d == null ? 3 : d); return s === '-0.000' || s === '-0.00' ? s.slice(1) : s; }
  function shift(sym, c) { return c >= 0 ? '(' + sym + ' - ' + n3(c, 2) + ')' : '(' + sym + ' + ' + n3(-c, 2) + ')'; }
  function lin(terms) {
    var s = '';
    terms.filter(function (t) { return Math.abs(t[0]) >= 5e-4; }).forEach(function (t, i) {
      var c = t[0], mag = n3(Math.abs(c));
      s += (i === 0 ? (c < 0 ? '-' : '') : (c < 0 ? ' - ' : ' + ')) + mag + '\\,' + t[1];
    });
    if (!s) s = '0';
    return s;
  }
  function mathHTML() {
    var p = model.p, land = model.land, L = model.L, out = [];
    var eq = function (tex, cls) { out.push('<div class="eq' + (cls ? ' ' + cls : '') + '">\\[' + tex + '\\]</div>'); };
    var para = function (html) { out.push('<p>' + html + '</p>'); };
    var head = function (t) { out.push('<h3>' + t + '</h3>'); };
    if (L.kind === 'quad') {
      var A = land.A, c = land.c, X1 = shift('x_1', c[0]), X2 = shift('x_2', c[1]);
      head('Cost: the height of the land');
      eq('J(\\mathbf{x}) = \\tfrac12\\,(\\mathbf{x}-\\mathbf{c})^{\\top}A\\,(\\mathbf{x}-\\mathbf{c}),\\qquad A = R_\\theta\\begin{pmatrix}\\lambda_1 & 0\\\\ 0 & \\lambda_2\\end{pmatrix}R_\\theta^{\\top}');
      para('With your settings, \\(A = \\begin{pmatrix}' + n3(A[0][0]) + ' & ' + n3(A[0][1]) + '\\\\ ' + n3(A[1][0]) + ' & ' + n3(A[1][1]) + '\\end{pmatrix}\\) and \\(\\mathbf c = (' + n3(c[0], 2) + ',\\ ' + n3(c[1], 2) + ')\\), so');
      eq('J(\\mathbf{x}) = ' + lin([[A[0][0] / 2, X1 + '^2'], [A[0][1], X1 + X2], [A[1][1] / 2, X2 + '^2']]), 'live');
      head('Gradient: the slope underfoot');
      eq('\\nabla J(\\mathbf{x}) = A\\,(\\mathbf{x}-\\mathbf{c})');
      eq('\\frac{\\partial J}{\\partial x_1} = ' + lin([[A[0][0], X1], [A[0][1], X2]]) + ',\\qquad \\frac{\\partial J}{\\partial x_2} = ' + lin([[A[1][0], X1], [A[1][1], X2]]), 'live');
      var lmax = Math.max(p.l1, p.l2), lmin = Math.min(p.l1, p.l2);
      var bend = 0;
      if (land.ripples) bend += land.ripples.amp * land.ripples.waves.reduce(function (a, wv) { return a + wv.w[0] * wv.w[0] + wv.w[1] * wv.w[1]; }, 0);
      if (land.holes) bend = Math.max(bend, land.holes.D / (land.holes.w * land.holes.w));
      if (bend > 0) {
        var kap = lmax + bend;
        para('On the bowl alone a fixed stride is stable while \\(\\alpha < 2/\\lambda_{\\max} = ' + n3(2 / lmax) + '\\). ' + (land.ripples && land.holes ? 'The ripples and the black holes' : land.ripples ? 'The ripples' : 'The black holes') + ' bend this land far more sharply, up to a curvature of about \\(\\kappa = ' + n3(kap, 1) + '\\), so here a stride is safe everywhere only below \\(2/\\kappa = ' + n3(2 / kap, 4) + '\\). ' +
          (p.alpha > 2 / kap ? 'With \\(\\alpha = ' + n3(p.alpha) + '\\) the Pilgrim can overshoot on the sharpest ripples and is flung out of a hole it steps into; on gentler ground it still settles.' : 'With \\(\\alpha = ' + n3(p.alpha) + '\\) every stride is safe.'));
      } else
      para('A fixed stride is stable while \\(\\alpha < 2/\\lambda_{\\max} = ' + n3(2 / lmax) + '\\). With \\(\\alpha = ' + n3(p.alpha) + '\\), each stride multiplies the Pilgrim\u2019s distance from the spring by \\(|1-\\alpha\\lambda_{\\min}| = ' + n3(Math.abs(1 - p.alpha * lmin), 2) + '\\) along the gentle direction and by \\(|1-\\alpha\\lambda_{\\max}| = ' + n3(Math.abs(1 - p.alpha * lmax), 2) + '\\) along the steep one' + (L.wall ? ', while inside the wall' : '') + '.');
      head('The law');
      if (land.box) {
        var lb0 = n3(land.box[0], 1), lb1 = n3(land.box[1], 1);
        eq('C = [' + lb0 + ',' + lb1 + ']^2,\\qquad \\Pi_C(\\mathbf{w}) = \\big(\\operatorname{clip}(w_1,' + lb0 + ',' + lb1 + '),\\ \\operatorname{clip}(w_2,' + lb0 + ',' + lb1 + ')\\big)');
      }
      if (land.box && !L.wall) para('Here the law is only the edge of the realm, so the Warden matters only if the Wanderer steps outside it.');
      if (L.wall) {
        var xs = land.treasure, gs = land.grad(xs), tw = model.walks.tw, ue = tw[tw.length - 1].u;
        para('The treasure is \\(\\mathbf{x}^\\star = (' + n3(xs[0]) + ',\\ ' + n3(xs[1]) + ')\\), where the slope is \\(\\nabla J(\\mathbf x^\\star) = (' + n3(gs[0]) + ',\\ ' + n3(gs[1]) + ')\\). When the Twins settle, the ledger holds the wall\u2019s push: \\(\\mathbf u \\to -\\nabla J(\\mathbf x^\\star)/\\rho = (' + n3(-gs[0] / p.rho) + ',\\ ' + n3(-gs[1] / p.rho) + ')\\). On day ' + model.K + ' it reads \\((' + n3(ue[0]) + ',\\ ' + n3(ue[1]) + ')\\).');
      } else if (!land.box) {
        para('There is no law in the canyon: \\(C = \\mathbb{R}^2\\) and \\(\\Pi_C\\) leaves every point where it is.');
      }
    } else {
      var y = land.y, s = p.law, h = 1 / (2 * p.s2);
      head('Cost: the height of the land');
      eq('J(\\mathbf{x}) = \\underbrace{\\sum_{i=1}^{2}\\frac{(x_i-y_i)^2}{2\\sigma^2}}_{\\text{lanterns}} + \\underbrace{\\mu_b\\sum_{i=1}^{2}\\big(1-x_i^2\\big)^2}_{\\text{flags fully up or down}} + \\underbrace{\\mu_p\\big(1-s\\,x_1x_2\\big)^2}_{\\text{the law, as a hill}},\\quad -1\\le x_i\\le 1');
      para('Here \\(x_i\\) is sentry \\(i\\)\u2019s card (+1 flag up, \u22121 flag down) and \\(s = ' + (s > 0 ? '+1' : '-1') + '\\): the tower\u2019s law is that the flags ' + (s > 0 ? 'agree' : 'differ') + '. With your settings:');
      eq('J(\\mathbf{x}) = ' + n3(h) + '\\big[' + shift('x_1', y[0]) + '^2 + ' + shift('x_2', y[1]) + '^2\\big] + ' + n3(p.muB, 2) + '\\big[(1-x_1^2)^2 + (1-x_2^2)^2\\big] + ' + n3(p.muP, 2) + '\\,(1 ' + (s > 0 ? '-' : '+') + ' x_1x_2)^2', 'live');
      head('Gradient: the slope underfoot');
      eq('\\frac{\\partial J}{\\partial x_1} = \\frac{x_1-y_1}{\\sigma^2} - 4\\mu_b\\,x_1\\big(1-x_1^2\\big) - 2\\mu_p\\,s\\,x_2\\big(1-s\\,x_1x_2\\big)');
      eq('\\frac{\\partial J}{\\partial x_2} = \\frac{x_2-y_2}{\\sigma^2} - 4\\mu_b\\,x_2\\big(1-x_2^2\\big) - 2\\mu_p\\,s\\,x_1\\big(1-s\\,x_1x_2\\big)');
      eq('\\frac{\\partial J}{\\partial x_1} = ' + n3(1 / p.s2) + shift('x_1', y[0]) + ' - ' + n3(4 * p.muB) + '\\,x_1(1-x_1^2) ' + (s > 0 ? '-' : '+') + ' ' + n3(2 * p.muP) + '\\,x_2(1 ' + (s > 0 ? '-' : '+') + ' x_1x_2)', 'live');
      para('The slope along \\(x_2\\) is the same with sentries 1 and 2 swapped.');
      head('The law');
      eq(s > 0 ? 'C = \\operatorname{conv}\\{(1,1),(-1,-1)\\} = \\{(t,t): -1\\le t\\le 1\\},\\qquad \\Pi_C(\\mathbf w) = (t,t),\\ t = \\operatorname{clip}\\!\\big(\\tfrac{w_1+w_2}{2},-1,1\\big)'
               : 'C = \\operatorname{conv}\\{(1,-1),(-1,1)\\} = \\{(t,-t): -1\\le t\\le 1\\},\\qquad \\Pi_C(\\mathbf w) = (t,-t),\\ t = \\operatorname{clip}\\!\\big(\\tfrac{w_1-w_2}{2},-1,1\\big)');
      para('\\(C\\) is the tower\u2019s two lawful patterns and every mixture of them: its parity polytope, drawn as the blue line. The true order is the lawful corner nearest the lanterns, ' + signWord(land.treasure) + '.');
    }
    if (land.ripples) {
      var rw = land.weather;
      head('Ripples');
      eq('J(\\mathbf x)\\ \\mathrel{+}=\\ R(\\mathbf x) = \\frac{A}{\\sqrt6}\\sum_{k=1}^{6}\\sin(\\omega_k\\cdot\\mathbf x + \\varphi_k),\\qquad \\nabla R(\\mathbf x) = \\frac{A}{\\sqrt6}\\sum_{k=1}^{6}\\cos(\\omega_k\\cdot\\mathbf x + \\varphi_k)\\,\\omega_k');
      para('Six waves with random headings, lengths within 25% of \\(L = ' + n3(rw.L) + '\\) and random phases, of height \\(A = ' + n3(rw.A) + '\\) (seed ' + rw.seed + '). They add to the cost and the gradient above' + (L.kind === 'tower' ? ', and to the Twins\u2019 land.' : '.') + (L.kind === 'quad' ? ' The treasure moves with them: it is now the lowest spot of the rippled land.' : ' The true order does not move: it is still the lawful corner nearest the lanterns.'));
    }
    if (land.holes) {
      var hl = land.holes;
      head('Black holes');
      eq('J(\\mathbf x)\\ \\mathrel{+}=\\ B(\\mathbf x) = -\\sum_{j=1}^{' + hl.n + '} D\\,e^{-\\lVert\\mathbf x-\\mathbf p_j\\rVert^2/(2w^2)},\\qquad \\nabla B(\\mathbf x) = \\sum_{j=1}^{' + hl.n + '} \\frac{D}{w^2}\\,e^{-\\lVert\\mathbf x-\\mathbf p_j\\rVert^2/(2w^2)}\\,(\\mathbf x-\\mathbf p_j)');
      para('Steep, narrow pits of depth \\(D = ' + n3(hl.D) + '\\) and width \\(w = ' + n3(hl.w) + '\\), at ' + hl.at.map(function (q) { return '\\((' + n3(q[0], 2) + ',\\ ' + n3(q[1], 2) + ')\\)'; }).join(', ') + '. Inside one, the slope reaches \\(D/w \\cdot e^{-1/2} = ' + n3(hl.D / hl.w * Math.exp(-0.5), 1) + '\\) and the curvature \\(D/w^2 = ' + n3(hl.D / hl.w / hl.w, 0) + '\\): a fixed stride longer than \\(2w^2/D = ' + n3(2 * hl.w * hl.w / hl.D, 4) + '\\) is flung out of the pit, and a hero who only feels the ground underfoot finds a pit only by stepping into its rim.');
    }
    if (land.sigma > 0) {
      head('Haze: the slope from four taps');
      eq('\\tilde J(\\mathbf q) = J(\\mathbf q) + \\varepsilon,\\ \\ \\varepsilon\\sim\\mathcal N(0,\\sigma^2),\\qquad \\hat g_i = \\frac{\\tilde J(\\mathbf x + h\\mathbf e_i) - \\tilde J(\\mathbf x - h\\mathbf e_i)}{2h}');
      para('With \\(\\sigma = ' + n3(land.sigma, 4) + '\\) and a staff of \\(h = ' + n3(land.h, 3) + '\\), each slope the heroes feel is off by about \\(\\sigma/(\\sqrt2\\,h) = ' + n3(land.sigma / Math.SQRT2 / land.h) + '\\): a longer staff steadies it, but blurs ripples shorter than the staff. The walkers use \\(\\hat g\\) in place of \\(\\nabla J\\), the Cartographer\u2019s stride test compares tapped heights, and the Wanderer\u2019s small steps use taps too.');
    }
    head('One day for each hero');
    var P = land.box ? 'P = \\Pi_{[' + n3(land.box[0], 1) + ',' + n3(land.box[1], 1) + ']^2}' : 'P = \\text{identity}';
    out.push('<div class="rules">');
    out.push('<div class="rulebox pg"><b>The Pilgrim</b> takes a fixed stride down the slope and is set back inside the box.<div class="eq">\\[\\mathbf{x}_{k+1} = P\\big(\\mathbf{x}_k - \\alpha\\,\\nabla J(\\mathbf{x}_k)\\big),\\quad \\alpha = ' + n3(p.alpha) + ',\\quad ' + P + '\\]</div></div>');
    var tmap = !land.box ? '' : land.box[0] === -land.box[1] ? '\\mathbf x = ' + (land.box[1] === 1 ? '' : n3(land.box[1], 1)) + '\\tanh\\mathbf t' : land.box[0] === 0 && land.box[1] === 1 ? '\\mathbf x = \\tfrac12(1+\\tanh\\mathbf t)' : '\\mathbf x = ' + n3(land.box[0], 1) + ' + ' + n3(land.box[1] - land.box[0], 1) + '\\cdot\\tfrac12(1+\\tanh\\mathbf t)';
    out.push('<div class="rulebox lb"><b>The Cartographer</b> turns the slope by the last ' + Math.round(p.m) + ' journal pages, each a stride \\(\\mathbf s_i\\) and the change of slope \\(\\Delta\\mathbf g_i\\) it brought.' +
      (tmap ? ' On this land the Cartographer walks on \\(\\mathbf t\\) with \\(' + tmap + '\\), so the box is never crossed and the slope is \\(\\nabla_{\\mathbf t}J = \\nabla J\\odot\\partial\\mathbf x/\\partial\\mathbf t\\).' : '') +
      '<div class="eq">\\[\\mathbf{d}_k = -H_k\\,\\nabla J_k,\\qquad \\mathbf{x}_{k+1} = \\mathbf{x}_k + \\eta_k\\,\\mathbf{d}_k\\]</div>' +
      '<p>The stride \\(\\eta_k\\) is the first of \\(1, \\tfrac12, \\tfrac14, \\dots\\) that lowers the land enough:</p>' +
      '<div class="eq">\\[J(\\mathbf x_k+\\eta_k\\mathbf d_k) \\le J(\\mathbf x_k) + 10^{-4}\\,\\eta_k\\,\\nabla J_k^{\\top}\\mathbf d_k\\]</div>' +
      '<details><summary>How the journal turns the slope (two-loop recursion)</summary><div class="eq">\\[\\begin{aligned}&\\mathbf q \\leftarrow \\nabla J_k;\\quad \\text{for } i = k-1,\\dots,k-m:\\ \\ a_i = \\frac{\\mathbf s_i^{\\top}\\mathbf q}{\\Delta\\mathbf g_i^{\\top}\\mathbf s_i},\\ \\ \\mathbf q \\leftarrow \\mathbf q - a_i\\,\\Delta\\mathbf g_i\\\\ &\\mathbf q \\leftarrow \\gamma\\,\\mathbf q,\\quad \\gamma = \\frac{\\mathbf s_{k-1}^{\\top}\\Delta\\mathbf g_{k-1}}{\\Delta\\mathbf g_{k-1}^{\\top}\\Delta\\mathbf g_{k-1}}\\\\ &\\text{for } i = k-m,\\dots,k-1:\\ \\ b = \\frac{\\Delta\\mathbf g_i^{\\top}\\mathbf q}{\\Delta\\mathbf g_i^{\\top}\\mathbf s_i},\\ \\ \\mathbf q \\leftarrow \\mathbf q + (a_i - b)\\,\\mathbf s_i;\\qquad \\mathbf d_k = -\\mathbf q\\end{aligned}\\]</div><p>With an empty journal (\\(m = 0\\)) the direction is just \\(-\\nabla J_k\\): the Cartographer becomes a Pilgrim who chooses the stride each day. A direction that points uphill tears the pages out.</p></details></div>');
    var fdef = L.kind === 'quad' ? 'f = J' : 'f = J \\text{ without the law hill}';
    var wander = !land.exactStep
      ? '\\mathbf x_{k+1} = \\text{small steps from } \\mathbf x_k \\text{ down } f(\\mathbf x) + \\tfrac{\\rho}{2}\\lVert\\mathbf x-\\mathbf v\\rVert^2,\\quad \\mathbf v = \\mathbf z_k-\\mathbf u_k'
      : L.kind === 'quad'
      ? '\\mathbf x_{k+1} = (A+\\rho I)^{-1}\\big(A\\mathbf c + \\rho(\\mathbf z_k-\\mathbf u_k)\\big)'
      : 'x_{i} \\leftarrow \\arg\\min_{-1\\le x\\le 1}\\ \\frac{(x-y_i)^2}{2\\sigma^2} + \\mu_b(1-x^2)^2 + \\frac{\\rho}{2}(x-v_i)^2,\\quad \\mathbf v = \\mathbf z_k-\\mathbf u_k';
    out.push('<div class="rulebox tw"><b>The Twins</b> split the work: the Wanderer walks to the best spot the rope allows, the Warden takes the nearest lawful spot, and the ledger adds today\u2019s gap between them. Rope tension \\(\\rho = ' + n3(p.rho, 2) + '\\), and \\(' + fdef + '\\).' +
      '<div class="eq">\\[\\begin{aligned}\\mathbf x_{k+1} &= \\arg\\min_{\\mathbf x}\\ f(\\mathbf x) + \\tfrac{\\rho}{2}\\lVert\\mathbf x - \\mathbf z_k + \\mathbf u_k\\rVert^2 &&\\text{Wanderer}\\\\ \\mathbf z_{k+1} &= \\Pi_C(\\mathbf x_{k+1} + \\mathbf u_k) &&\\text{Warden}\\\\ \\mathbf u_{k+1} &= \\mathbf u_k + \\mathbf x_{k+1} - \\mathbf z_{k+1} &&\\text{ledger}\\end{aligned}\\]</div>' +
      '<p>On this land the Wanderer\u2019s step is</p><div class="eq">\\[' + wander + '\\]</div>' +
      (!land.exactStep ? '<p>With ripples or haze no formula gives this spot, so the Wanderer walks to it from where it stands, as an ADMM solver would: steps down the sum while they lower it (with tapped heights in haze).</p>' : '') +
      (L.kind === 'tower' && land.exactStep ? '<p>Its slope is the cubic \\(4\\mu_b x^3 + (1/\\sigma^2 - 4\\mu_b + \\rho)\\,x - (y_i/\\sigma^2 + \\rho v_i)\\). The Wanderer checks its real roots and both ends and takes the lowest. The step is a global one, not a stride down the local slope, which is how the Wanderer can cross the flags\u2019 ridge.</p>' : '') +
      '</div>');
    out.push('</div>');
    return out.join('');
  }
  var mathTimer = null, mathReady = false;
  function renderMath() {
    if (!$('math')) return;
    clearTimeout(mathTimer);
    mathTimer = setTimeout(function () {
      var el = $('math');
      if (mathReady && window.MathJax && MathJax.typesetClear) MathJax.typesetClear([el]);
      el.innerHTML = mathHTML();
      if (mathReady && window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([el]).catch(function () { /* the TeX source stays readable */ });
      }
    }, 140);
  }
  window.kingsLandMathReady = function () { mathReady = true; renderMath(); };
  if (window.MathJax && MathJax.typesetPromise) mathReady = true;

  // ------------------------------------------------------------------ charts
  function drawChart(id, series, opts) {
    var cv = $(id), ctx = fitCanvas(cv), W = cv.clientWidth, H = cv.clientHeight;
    ctx.clearRect(0, 0, W, H);
    var padL = 46, padR = 12, padT = 10, padB = 26, K = model.K;
    var lo = Infinity, hi = -Infinity;
    series.forEach(function (s) { s.v.forEach(function (y) { if (isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); } }); });
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (opts.ref != null && isFinite(opts.ref)) { lo = Math.min(lo, opts.ref); hi = Math.max(hi, opts.ref); }
    if (hi - lo < 1e-12) { hi = lo + 1; }
    if (!opts.log && lo > 0 && lo < 0.3 * hi) lo = 0;
    var pad = (hi - lo) * 0.06; lo -= opts.log ? 0 : pad; hi += pad;
    var X = function (d) { return padL + d / K * (W - padL - padR); }, Y = function (y) { return padT + (hi - y) / (hi - lo) * (H - padT - padB); };
    var font = getComputedStyle(document.body).fontFamily;
    ctx.font = '11.5px ' + font; ctx.fillStyle = C.ink; ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
    // grid and ticks
    var ticks = [];
    if (opts.log) { for (var e = Math.ceil(lo); e <= Math.floor(hi); e++) ticks.push(e); if (ticks.length > 6) ticks = ticks.filter(function (t, i) { return i % Math.ceil(ticks.length / 5) === 0; }); }
    else { var st = Math.pow(10, Math.floor(Math.log10((hi - lo) / 4))); var m = (hi - lo) / st > 20 ? 5 : (hi - lo) / st > 8 ? 2 : 1; st *= m; for (var t = Math.ceil(lo / st) * st; t <= hi; t += st) ticks.push(t); }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ticks.forEach(function (t) {
      var y = Y(t); ctx.beginPath(); ctx.moveTo(padL, y + 0.5); ctx.lineTo(W - padR, y + 0.5); ctx.stroke();
      ctx.fillText(opts.log ? '1e' + t : (Math.abs(t) < 1e-9 ? '0' : +t.toPrecision(3) + ''), padL - 6, y);
    });
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var dstep = K <= 60 ? 10 : K <= 150 ? 20 : K <= 300 ? 50 : 100;
    for (var d = 0; d <= K; d += dstep) if (X(d) < W - padR - 34) ctx.fillText(String(d), X(d), H - padB + 6);
    ctx.textAlign = 'right'; ctx.fillText('day', W - padR, H - padB + 6);
    if (opts.ref != null && isFinite(opts.ref)) { ctx.setLineDash([5, 4]); ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.moveTo(padL, Y(opts.ref)); ctx.lineTo(W - padR, Y(opts.ref)); ctx.stroke(); ctx.setLineDash([]); }
    ctx.save(); ctx.beginPath(); ctx.rect(padL, padT - 2, W - padL - padR, H - padT - padB + 4); ctx.clip();
    series.forEach(function (s) {
      if (!s.show) return;
      [0, 1].forEach(function (pass) {
        ctx.beginPath(); var started = false;
        for (var d = 0; d < s.v.length; d++) {
          if (pass === 1 && d > state.day) break;
          var y = s.v[d]; if (!isFinite(y)) { started = false; continue; }
          y = clamp(y, lo - (hi - lo), hi + (hi - lo));
          if (started) ctx.lineTo(X(d), Y(y)); else { ctx.moveTo(X(d), Y(y)); started = true; }
        }
        ctx.strokeStyle = s.c; ctx.globalAlpha = pass ? 1 : 0.22; ctx.lineWidth = pass ? 2.2 : 1.6; ctx.setLineDash(s.dash || []); ctx.stroke(); ctx.setLineDash([]);
      });
      ctx.globalAlpha = 1;
    });
    ctx.restore();
    ctx.strokeStyle = C.ink; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(X(state.day) + 0.5, padT); ctx.lineTo(X(state.day) + 0.5, H - padB); ctx.stroke(); ctx.globalAlpha = 1;
  }
  function seriesOf(walk, fn) { var out = []; for (var d = 0; d <= model.K; d++) { if (walk.lost != null && d >= walk.length) { out.push(NaN); continue; } out.push(fn(walk[Math.min(d, walk.length - 1)])); } return out; }
  function drawCharts() {
    if (!$('chart-height')) return;
    var land = model.land, W = model.walks, log = state.logHeight[model.key], Jl = model.Jlow;
    var tr = function (J) { return log ? Math.log10(Math.max(J - Jl, 1e-14)) : J; };
    drawChart('chart-height', [
      { c: C.twin, show: state.show.tw, v: seriesOf(W.tw, function (d) { return tr(land.J(d.z)); }), dash: [5, 3] },
      { c: C.blue, show: state.show.lb, v: seriesOf(W.lb, function (d) { return tr(d.J); }) },
      { c: C.orange, show: state.show.pg, v: seriesOf(W.pg, function (d) { return tr(d.J); }) }
    ], { log: log, ref: log ? null : Jl });
    $('height-caption').innerHTML = (log ? 'J minus the lowest height ' + fmt(Jl, 4) + ', on a log scale. ' : 'Dashed line: the lowest point of the walkers\u2019 land, J = ' + fmt(Jl, 4) + '. ') +
      'The Twins are measured where the Warden stands (dashed curve)' + (land.kind === 'tower' ? ', on the walkers\u2019 land, though the Twins themselves never feel its law hill.' : '.');
    if (model.L.kind === 'quad' && !model.land.box) {
      drawChart('chart-law', [], { log: false });
      $('law-caption').textContent = 'The canyon has no law, so everyone is always lawful.';
    } else {
      drawChart('chart-law', [
        { c: C.twin, show: state.show.tw, v: seriesOf(W.tw, function (d) { return lawDistance(land, d.x); }) },
        { c: C.blue, show: state.show.lb, v: seriesOf(W.lb, function (d) { return lawDistance(land, d.x); }) },
        { c: C.orange, show: state.show.pg, v: seriesOf(W.pg, function (d) { return lawDistance(land, d.x); }) }
      ], { log: false });
      $('law-caption').textContent = model.L.kind === 'quad'
        ? 'How far outside ' + (model.L.wall ? 'the wall' : 'the realm\u2019s edge') + ' each hero stands. The walkers never leave; the Wanderer may, and is pulled back by the ledger. The Warden is always inside.'
        : 'How far each hero stands from the law\u2019s line (Wanderer for the Twins). The walkers only feel the law as a hill; the Warden is always on the line.';
    }
  }

  // ------------------------------------------------------------------ controls
  function toSlider(spec, v) { return spec.log ? Math.round(1000 * Math.log(v / spec.min) / Math.log(spec.max / spec.min)) : v; }
  function fromSlider(spec, s) { return spec.log ? spec.min * Math.pow(spec.max / spec.min, s / 1000) : +s; }
  function paramRow(spec, holder) {
    var id = 'p-' + spec.key, value = holder[spec.key];
    var div = document.createElement('div'); div.className = 'param';
    div.innerHTML = '<label for="' + id + '"><span class="sym">' + spec.sym + '</span>' + spec.name + '</label>' +
      '<input type="range" id="' + id + '" ' + (spec.log ? 'min="0" max="1000" step="1"' : 'min="' + spec.min + '" max="' + spec.max + '" step="' + spec.step + '"') + ' value="' + toSlider(spec, value) + '">' +
      '<input type="number" id="' + id + '-n" aria-label="' + spec.name + '" min="' + spec.min + '" max="' + spec.max + '" step="' + (spec.log ? 'any' : spec.step) + '" value="' + value.toFixed(spec.d) + '">';
    var range = div.querySelector('input[type=range]'), num = div.querySelector('input[type=number]');
    range.addEventListener('input', function () {
      var v = fromSlider(spec, +range.value); if (!spec.log) v = +v.toFixed(spec.d);
      holder[spec.key] = v; num.value = v.toFixed(spec.d); changed();
    });
    num.addEventListener('change', function () {
      var v = parseFloat(num.value); if (!isFinite(v)) { num.value = holder[spec.key].toFixed(spec.d); return; }
      v = clamp(v, spec.min, spec.max); holder[spec.key] = v; num.value = v.toFixed(spec.d); range.value = toSlider(spec, v); changed();
    });
    return div;
  }
  function buildControls() {
    var key = state.land, L = LANDS[key], p = state.params[key];
    var lf = $('land-params'), hf = $('hero-params');
    lf.innerHTML = '<legend>Shape the land</legend>'; hf.innerHTML = '<legend>Tune the heroes</legend>';
    (L.kind === 'quad' ? QUAD_SPECS(key) : TOWER_SPECS).forEach(function (s) { lf.appendChild(paramRow(s, p)); });
    var wf = $('weather-params');
    wf.innerHTML = '<legend>Weather</legend>';
    WEATHER_SPECS.forEach(function (s) { wf.appendChild(paramRow(s, p)); });
    var wl = document.createElement('div'); wl.className = 'startline';
    wl.innerHTML = '<span class="hint">With ripples, haze or black holes, the tale\u2019s numbers no longer apply.</span><button class="btn" type="button" id="new-weather">New weather</button>';
    wf.appendChild(wl);
    wl.querySelector('#new-weather').addEventListener('click', function () { p.seed = 1 + Math.floor(Math.random() * 999); if (!p.ripA) p.ripA = 0.05; buildControls(); changed(); });
    if (L.kind === 'tower') {
      var seg = document.createElement('div'); seg.className = 'startline';
      seg.innerHTML = '<span>The tower\u2019s law (s)</span><span class="seg" role="group" aria-label="The tower\u2019s law">' +
        '<button type="button" id="law-agree" aria-pressed="' + (p.law > 0) + '">flags agree</button><button type="button" id="law-differ" aria-pressed="' + (p.law < 0) + '">flags differ</button></span>';
      lf.appendChild(seg);
      seg.querySelector('#law-agree').addEventListener('click', function () { p.law = 1; buildControls(); changed(); });
      seg.querySelector('#law-differ').addEventListener('click', function () { p.law = -1; buildControls(); changed(); });
    }
    var st = document.createElement('div'); st.className = 'startline';
    st.innerHTML = '<span>Start flag <output id="start-read"></output></span><button class="btn" type="button" id="start-reset">' + (L.kind === 'tower' ? 'Start from the lanterns' : 'Start where the tale starts') + '</button>';
    lf.appendChild(st);
    st.querySelector('#start-reset').addEventListener('click', function () {
      if (L.kind === 'tower') { p.sx = null; p.sy = null; } else { p.sx = L.preset.sx; p.sy = L.preset.sy; }
      changed();
    });
    HERO_SPECS.forEach(function (s) { hf.appendChild(paramRow(s, p)); });
  }

  // A setting kept within its slider's range.
  function limit(k, v) {
    var L = LANDS[state.land], all = (L.kind === 'quad' ? QUAD_SPECS(state.land) : TOWER_SPECS).concat(WEATHER_SPECS, HERO_SPECS);
    for (var i = 0; i < all.length; i++) if (all[i].key === k) return clamp(v, all[i].min, all[i].max);
    return v;
  }
  // ------------------------------------------------------------------ the loop
  var frame = null;
  function renderAll() {
    drawMap(); drawRelief(); updateStatus(); drawCharts();
    var k = state.day;
    $('day').value = k;
    $('day-read').textContent = 'Day ' + k + ' of ' + model.K;
    var moving = HEROES.filter(function (h) { return model.info[h].moving; }).length, lost = HEROES.filter(function (h) { return model.info[h].lost; });
    var heroName = { pg: 'the Pilgrim', lb: 'the Cartographer', tw: 'the Twins' };
    $('day-note').textContent = lost.length ? heroName[lost[0]] + ' is lost on day ' + model.info[lost[0]].lostDay : moving ? 'someone is still walking on day ' + model.K : 'everyone has settled by day ' + (model.lastDay - 3 < 0 ? 0 : Math.max(0, model.lastDay - 3));
    var sr = $('start-read'); if (sr) sr.textContent = pt(model.x0, 2);
    if (game) game.kick();
  }
  function scheduleRender() { if (frame) return; frame = requestAnimationFrame(function () { frame = null; renderAll(); }); }
  function changed() { compute(); persist(); scheduleRender(); renderMath(); }

  function setLand(key) {
    stop();
    state.land = key;
    Object.keys(LANDS).forEach(function (k) { $('tab-' + k).setAttribute('aria-selected', String(k === key)); $('tab-' + k).tabIndex = k === key ? 0 : -1; });
    $('land-note').innerHTML = LANDS[key].note;
    $('treasure-name').textContent = LANDS[key].treasureName;
    $('landof-wrap').hidden = LANDS[key].kind !== 'tower';
    if ($('log-height')) $('log-height').checked = state.logHeight[key];
    try { history.replaceState(null, '', '#' + key); } catch (e) { /* ignore */ }
    buildControls();
    compute();
    state.day = model.lastDay;
    persist(); renderAll(); renderMath();
  }

  var last = 0, target = null;
  // Time moves in fractions of a day; a single step (Next day) runs at most half a day per second, so each phase shows.
  function advanceClock(dt) {
    if (!state.playing) return;
    var end = target != null ? target : model.lastDay;
    state.t += dt * (target != null ? Math.min(state.speed, 0.5) : state.speed);
    if (state.t >= end) {
      state.t = end; var dEnd = Math.floor(end);
      if (dEnd !== state.day) { state.day = dEnd; renderAll(); }
      stop(); return;
    }
    var d = Math.floor(state.t);
    if (d !== state.day) { state.day = d; renderAll(); }
  }
  function tick(now) {
    if (!state.playing) return;
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    advanceClock(dt);
    if (state.playing) requestAnimationFrame(tick);
  }
  function labelPlay(on) {
    $('play-label').textContent = on ? 'Pause' : 'Walk';
    $('play-icon').innerHTML = on ? '<path d="M3 2h4v12H3zM9 2h4v12H9z"/>' : '<path d="M4 2v12l10-6z"/>';
  }
  function play() {
    if (state.day >= model.lastDay) { state.day = 0; renderAll(); }
    state.t = state.day + (state.frac || 0); state.frac = null; target = null;
    state.playing = true; last = 0; labelPlay(true);
    requestAnimationFrame(tick);
    if (game) game.kick();
  }
  function stepDay() {
    if (state.day >= model.K) return;
    if (state.playing && target != null) { target = Math.min(model.K, target + 1); return; }
    if (state.playing) { stop(); }
    state.t = state.day + (state.frac || 0); state.frac = null; target = state.day + 1;
    state.playing = true; last = 0; labelPlay(true);
    requestAnimationFrame(tick);
    if (game) game.kick();
  }
  function stop() {
    state.playing = false; target = null; state.frac = null; state.t = state.day;
    labelPlay(false);
    if (game) game.kick();
  }
  // Pause: time stands still where it is, mid-day included; Walk carries on from there.
  function pause() {
    var f = state.t - state.day;
    state.playing = false; target = null; state.frac = f > 1e-6 ? Math.min(f, 0.999) : null; state.t = state.day;
    labelPlay(false);
    if (game) game.kick();
  }

  // ------------------------------------------------------------------ wiring
  Object.keys(LANDS).forEach(function (k) { $('tab-' + k).addEventListener('click', function () { setLand(k); }); });
  document.querySelector('.tabs').addEventListener('keydown', function (ev) {
    var keys = Object.keys(LANDS), i = keys.indexOf(state.land);
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
      ev.preventDefault(); var j = (i + (ev.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length; setLand(keys[j]); $('tab-' + keys[j]).focus();
    }
  });
  $('reset-land').addEventListener('click', function () {
    state.params[state.land] = Object.assign({}, LANDS[state.land].preset);
    state.cam[state.land] = Object.assign({}, LANDS[state.land].cam);
    setLand(state.land);
  });
  $('play').addEventListener('click', function () { if (state.playing) pause(); else play(); });
  $('to-start').addEventListener('click', function () { stop(); state.day = 0; renderAll(); });
  $('back').addEventListener('click', function () { stop(); state.day = Math.max(0, state.day - 1); renderAll(); });
  $('next').addEventListener('click', function () { stop(); state.day = Math.min(model.K, state.day + 1); renderAll(); });
  $('day').addEventListener('input', function () { stop(); state.day = +$('day').value; scheduleRender(); });
  $('speed').addEventListener('change', function () { state.speed = +$('speed').value; });
  HEROES.forEach(function (h) { $('show-' + h).addEventListener('change', function () { state.show[h] = $('show-' + h).checked; scheduleRender(); }); });
  $('sqrt-heights').addEventListener('change', function () { state.sqrt = $('sqrt-heights').checked; scheduleRender(); });
  $('twins-land').addEventListener('change', function () { state.twinsLand = $('twins-land').checked; scheduleRender(); });
  if ($('log-height')) $('log-height').addEventListener('change', function () { state.logHeight[state.land] = $('log-height').checked; scheduleRender(); });

  // dragging the start flag
  var dragging = false;
  function placeStart(ev) {
    var cv = $('map'), r = cv.getBoundingClientRect(), g = mapGeom(cv), x = g.inv(ev.clientX - r.left, ev.clientY - r.top);
    var L = LANDS[state.land], p = state.params[state.land];
    if (L.kind === 'tower') { x = [clamp(x[0], -0.995, 0.995), clamp(x[1], -0.995, 0.995)]; }
    else if (E.KINDS[state.land].box) { var bb = E.KINDS[state.land].box; x = [clamp(x[0], bb[0], bb[1]), clamp(x[1], bb[0], bb[1])]; }
    else { x = [clamp(x[0], L.view[0], L.view[1]), clamp(x[1], L.view[2], L.view[3])]; }
    p.sx = +x[0].toFixed(3); p.sy = +x[1].toFixed(3);
    compute(); state.day = model.lastDay; scheduleRender();
  }
  $('map').addEventListener('pointerdown', function (ev) {
    if (game && game.race()) { var cv = $('map'), r = cv.getBoundingClientRect(), g = mapGeom(cv); game.walkTo(g.inv(ev.clientX - r.left, ev.clientY - r.top)); return; }
    stop(); dragging = true; $('map').setPointerCapture(ev.pointerId); placeStart(ev);
  });
  $('map').addEventListener('pointermove', function (ev) { if (dragging) placeStart(ev); });
  ['pointerup', 'pointercancel'].forEach(function (t) { $('map').addEventListener(t, function () { if (dragging) { dragging = false; persist(); renderMath(); } }); });

  // turning the relief
  var turning = null;
  $('relief').addEventListener('pointerdown', function (ev) { turning = { x: ev.clientX, y: ev.clientY }; $('relief').setPointerCapture(ev.pointerId); $('relief').classList.add('dragging'); });
  $('relief').addEventListener('pointermove', function (ev) {
    if (!turning) return;
    var cam = state.cam[state.land];
    cam.az = (cam.az - (ev.clientX - turning.x) * 0.5) % 360; cam.el = clamp(cam.el + (ev.clientY - turning.y) * 0.4, 8, 88);
    turning = { x: ev.clientX, y: ev.clientY }; scheduleRender();
  });
  ['pointerup', 'pointercancel'].forEach(function (t) { $('relief').addEventListener(t, function () { turning = null; $('relief').classList.remove('dragging'); }); });

  // theme and size
  function themeChanged() { readColours(); bgKey = ''; scheduleRender(); }
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeChanged); } catch (e) { /* old browsers */ }
  new MutationObserver(themeChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  if (window.ResizeObserver) new ResizeObserver(function () { scheduleRender(); }).observe($('map'));
  else window.addEventListener('resize', scheduleRender);

  readColours();
  var game = null, mapTimer = null;
  setLand(state.land);
  var api = {
    model: function () { return model; },
    time: function () { return { day: state.day, f: state.playing ? clamp(state.t - state.day, 0, 0.999) : state.frac }; },
    stepDay: stepDay,
    togglePlay: function () { if (state.playing) pause(); else play(); },
    setParam: function (k, v) { state.params[state.land][k] = limit(k, v); buildControls(); changed(); },
    setParams: function (o) { Object.keys(o).forEach(function (k) { state.params[state.land][k] = limit(k, o[k]); }); buildControls(); changed(); },
    limit: function (k, v) { return limit(k, v); },
    restart: function () { stop(); state.day = 0; state.t = 0; renderAll(); },
    jumpTo: function (f) { stop(); state.frac = f; if (game) game.kick(); },
    setLand: function (k) { setLand(k); },
    landName: function (k) { return LANDS[k].title; },
    rgb: function (k) { return RGB[k]; },
    themeKey: function () { return C.paper + '|' + C.blue + '|' + C.rlow; },
    night: function () { return state.night; },
    shown: shown,
    shownAll: function () { return state.show; },
    playing: function () { return state.playing; },
    rideChanged: function () { relief = null; reliefKey = ''; scheduleRender(); },
    advance: function (dt) { advanceClock(dt); },
    setDay: function (k) { stop(); state.day = clamp(Math.round(k), 0, model.K); state.t = state.day; renderAll(); },
    moved: function () { if (mapTimer) return; mapTimer = setTimeout(function () { mapTimer = null; drawMap(); }, 120); }
  };
  window.addEventListener('hashchange', function () { var h = (location.hash || '').slice(1); if (LANDS[h] && h !== state.land) setLand(h); });
  if (window.Game && window.Fog && $('fog-wrap')) {
    game = Game.create(api);
    $('fog-night').addEventListener('change', function () { state.night = $('fog-night').checked; game.kick(); });
  }
  window.kingsLand = { api: api, game: game };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { bgKey = ''; scheduleRender(); });
})();
