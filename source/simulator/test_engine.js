// Checks of engine.js, run with Node 12 or later from the deck's folder:
//     node lbgfs_admm_diff_no_math_assets/simulator/test_engine.js
// 1. With their first settings the canyon and the wall give deck lbfgs_admm_pg's numbers, as the deck's numbers
//    script printed them in examples/out/methods_numbers.tex, and the page's footer quotes the same numbers.
// 2. What the page says about the fort, the ridge and the misty hills holds.
// 3. The parts: the Wanderer's cubic, the law's projection, the ripples' gradient, the haze's slope noise and the
//    Wanderer's small steps.
var E = require('./engine.js'), fs = require('fs'), path = require('path');
var macros = {}, failures = 0;
fs.readFileSync(path.join(__dirname, '..', 'examples', 'out', 'methods_numbers.tex'), 'utf8').split('\n').forEach(function (line) {
  var m = line.match(/^\\newcommand\{\\(\w+)\}\{(.*)\}$/);
  if (m) macros[m[1]] = m[2];
});
function check(what, ok, detail) { console.log((ok ? 'ok    ' : 'FAIL  ') + what + (detail !== undefined ? '  [' + detail + ']' : '')); if (!ok) failures++; }
function d(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function first(walk, test) { for (var k = 0; k < walk.length; k++) if (test(walk[k], k)) return k; return -1; }
function word(x) { return (x[0] >= 0 ? '+' : '-') + (x[1] >= 0 ? '+' : '-'); }
function nums(s) { return (s.match(/-?\d+(\.\d+)?/g) || []).map(Number); }
function copy(o, extra) { var r = {}, k; for (k in o) r[k] = o[k]; for (k in (extra || {})) r[k] = extra[k]; return r; }
function start(key, p) { return E.KINDS[key].kind === 'tower' && p.sx == null ? E.lanternStart(p) : [p.sx, p.sy]; }
function walks(key, extra) {
  var p = copy(E.PRESETS[key], extra), land = E.buildLand(key, p), x0 = start(key, p);
  return { p: p, land: land, x0: x0, pg: E.pilgrim(land, x0, p.alpha, p.days), lb: E.cartographer(land, x0, p.m, p.days), tw: E.twins(land, x0, p.rho, p.days) };
}

// ---------------------------------------------------------------- 1. the deck's numbers
var c = walks('canyon'), T = c.land.treasure;
check('canyon: the Pilgrim within 0.01 of the spring after mxValleyPGSteps strides', first(c.pg, function (q) { return d(q.x, T) < 0.01; }) === +macros.mxValleyPGSteps, macros.mxValleyPGSteps);
check('canyon: the Cartographer within 0.01 on day mxValleyLBIts', first(c.lb, function (q) { return d(q.x, T) < 0.01; }) === +macros.mxValleyLBIts, macros.mxValleyLBIts);
check('canyon: the first stride is mxValleyStepOne after the trials mxValleyTrialList', c.lb[1].step === +macros.mxValleyStepOne && c.lb[1].trials.length === nums(macros.mxValleyTrialList).length - 1, macros.mxValleyTrialList);
check('canyon: the slope falls below 1e-9 on day mxValleyLBDone', first(c.lb, function (q) { var g = c.land.grad(q.x); return Math.max(Math.abs(g[0]), Math.abs(g[1])) < 1e-9; }) === +macros.mxValleyLBDone, macros.mxValleyLBDone);
check('canyon: with no law the ledger stays empty', c.tw.every(function (q) { return q.u[0] === 0 && q.u[1] === 0; }));
var w = walks('wall'), X = w.land.treasure, star = nums(macros.mxWallStarPoint);
check('wall: the treasure is mxWallStarPoint', d(X, star) < 5e-5, macros.mxWallStarPoint);
var pgDay = first(w.pg, function (q) { return d(q.x, X) < 1e-3; });
check('wall: the Pilgrim within 0.001 after mxWallPGSteps strides', pgDay === +macros.mxWallPGSteps, macros.mxWallPGSteps);
check('wall: mxWallPGClipped of those strides are set back', w.pg.slice(1, pgDay + 1).filter(function (q) { return q.clipped; }).length === +macros.mxWallPGClipped, macros.mxWallPGClipped);
var twDay = first(w.tw, function (q, k) { return k > 0 && d(q.z, X) < 1e-3 && d(q.x, q.z) < 1e-3; });
check('wall: the Twins done on day mxWallADMMIts', twDay === +macros.mxWallADMMIts, macros.mxWallADMMIts);
check('wall: the Wanderer first outside on day mxWallADMMOut', first(w.tw, function (q) { return q.x[0] > 1 || q.x[1] > 1; }) === +macros.mxWallADMMOut, macros.mxWallADMMOut);
check('wall: the ledger then holds the wall\'s push mxWallUStar', d(w.tw[twDay].u, nums(macros.mxWallUStar)) < 5e-3, macros.mxWallUStar);
check('wall: the Cartographer within 0.001 on day mxWallLBIts', first(w.lb, function (q) { return d(q.x, X) < 1e-3; }) === +macros.mxWallLBIts, macros.mxWallLBIts);
check('wall: the Cartographer at the wall from day mxWallLBWall', first(w.lb, function (q) { return q.x[0] > 0.999; }) === +macros.mxWallLBWall, macros.mxWallLBWall);
var page = fs.readFileSync(path.join(__dirname, 'page.html'), 'utf8');
check('the footer quotes the canyon\'s numbers', page.indexOf('after ' + macros.mxValleyPGSteps + ' strides and the Cartographer after ' + macros.mxValleyLBIts) >= 0);
check('the footer quotes the wall\'s numbers', page.indexOf('after ' + macros.mxWallPGSteps + ' strides, the Twins after ' + macros.mxWallADMMIts + ' days and the Cartographer after ' + macros.mxWallLBIts) >= 0);

// ---------------------------------------------------------------- 2. the page's claims
var f = walks('fort'), truth = word(f.land.treasure);
['pg', 'lb', 'tw'].forEach(function (h) { var e = f[h][f[h].length - 1].x; check('fort: ' + h + ' reaches the true order', word(e) === truth, word(e)); });
var r = walks('ridge'), rt = word(r.land.treasure), lawful = function (x) { return x[0] * x[1] * r.land.lawSign > 0; };
['pg', 'lb'].forEach(function (h) { var e = r[h][r[h].length - 1].x; check('ridge: ' + h + ' stops where the law is broken', !lawful(e), word(e)); });
var deep = null, n = 201;
for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) { var q = [-1 + 2 * i / (n - 1), -1 + 2 * j / (n - 1)], z = r.land.J(q); if (!deep || z < deep[1]) deep = [q, z]; }
check('ridge: the deepest hollow is the true order', word(deep[0]) === rt && lawful(deep[0]), word(deep[0]));
var rtw = r.tw[r.tw.length - 1].x;
check('ridge: the Twins reach the true order', word(rtw) === rt, word(rtw));
var r3 = walks('ridge', { y2: -0.3 });
check('ridge with y2 = -0.30: the Cartographer\'s first stride carries over', r3.lb[1].x[1] > 0 && word(r3.lb[r3.lb.length - 1].x) === word(r3.land.treasure), r3.lb[1].x.map(function (v) { return v.toFixed(3); }).join(', '));
check('ridge with y2 = -0.30: the Pilgrim still stops behind it', !lawful(r3.pg[r3.pg.length - 1].x));
var m = walks('misty'), MT = m.land.treasure, H = m.land.holes;
var valley = E.buildLand('misty', copy(E.PRESETS.misty, { holes: 0 })).treasure;
var deepest = function (w) { return Math.max.apply(null, w.map(function (q) { return H.depth(q.x); })); };
check('misty: the treasure lies at the bottom of a black hole', H.depth(MT) > 0.9 && m.land.J(MT) < m.land.floor, 'J ' + m.land.J(MT).toFixed(3) + ' vs floor ' + m.land.floor.toFixed(3));
var lbEnd = m.lb[m.lb.length - 1].x;
check('misty: the Cartographer\'s long strides drop it into another black hole', H.depth(lbEnd) > 0.9 && d(lbEnd, MT) > 0.3, 'depth ' + H.depth(lbEnd).toFixed(3) + ', ' + d(lbEnd, MT).toFixed(2) + ' from the treasure');
check('misty: there its line search stalls', m.lb.why === 'line search', m.lb.why + ' on day ' + (m.lb.length - 1));
['pg', 'tw'].forEach(function (h) {
  var e = m[h][m[h].length - 1].x;
  check('misty: ' + h + ' settles in the valley\'s lowest hollow and never meets a hole', d(e, valley) < 0.03 && deepest(m[h]) < 0.05, d(e, valley).toFixed(3) + ' from it, hole contact ' + deepest(m[h]).toFixed(3));
});
check('misty: no hero finds the treasure', ['pg', 'lb', 'tw'].every(function (h) { var e = m[h][m[h].length - 1].x; return d(e, MT) > 0.1; }));

// ---------------------------------------------------------------- 3. the parts
var seedStream = E.stream(12345), worst = 0;
for (var t = 0; t < 400; t++) {
  var s2 = 0.05 + seedStream.u(), muB = 3 * seedStream.u(), yv = 3 * seedStream.u() - 1.5, vv = 3 * seedStream.u() - 1.5, rho = 0.1 + 10 * seedStream.u();
  var tl = E.towerLand({ y1: yv, y2: 0, s2: s2, muP: 1, muB: muB, law: 1 });
  var phi = function (x) { return (yv - x) * (yv - x) / (2 * s2) + muB * Math.pow(1 - x * x, 2) + rho / 2 * (x - vv) * (x - vv); };
  var best = tl.bestCard(yv, vv, rho), brute = Infinity;
  for (var g = 0; g <= 20000; g++) brute = Math.min(brute, phi(-1 + g / 10000));
  worst = Math.max(worst, phi(best) - brute);
}
check('the Wanderer\'s cubic step is the lowest spot on [-1, 1]', worst < 1e-7, worst.toExponential(1));
var tl2 = E.towerLand({ y1: 0.3, y2: -0.2, s2: 0.3, muP: 1, muB: 1, law: -1 }), pw = 0;
for (t = 0; t < 200; t++) {
  var wq = [4 * seedStream.u() - 2, 4 * seedStream.u() - 2], pr = tl2.project(wq), bd = Infinity;
  for (g = 0; g <= 4000; g++) { var sp = [1 - 2 * g / 4000, -1 + 2 * g / 4000]; bd = Math.min(bd, d(wq, sp)); }
  pw = Math.max(pw, d(wq, pr) - bd);
}
check('the Warden\'s projection is the nearest lawful spot', pw < 1e-6, pw.toExponential(1));
var rip = E.ripples(0.3, 0.4, 9), ge = 0;
for (t = 0; t < 200; t++) {
  var x = [3 * seedStream.u() - 1.5, 3 * seedStream.u() - 1.5], an = rip.grad(x), hh = 1e-6;
  var fd = [(rip.R([x[0] + hh, x[1]]) - rip.R([x[0] - hh, x[1]])) / (2 * hh), (rip.R([x[0], x[1] + hh]) - rip.R([x[0], x[1] - hh])) / (2 * hh)];
  ge = Math.max(ge, d(an, fd) / (1e-9 + Math.hypot(an[0], an[1])));
}
check('the ripples\' gradient matches their differences', ge < 1e-5, ge.toExponential(1));
var hz = E.buildLand('canyon', copy(E.PRESETS.canyon, { haze: 0.01, staff: 0.02 })), at = [0.3, 0.6], exact = hz.base.grad(at), sum = 0, sum2 = 0, N = 6000, hs = E.stream(7);
for (t = 0; t < N; t++) { var gf = E.feel(hz, at, hz.J, hs).g[0] - exact[0]; sum += gf; sum2 += gf * gf; }
var sd = Math.sqrt(sum2 / N - (sum / N) * (sum / N)), want = hz.sigma / Math.SQRT2 / hz.h;
check('haze: a felt slope is off by sigma/(sqrt 2 h)', Math.abs(sd / want - 1) < 0.05 && Math.abs(sum / N) < 4 * want / Math.sqrt(N), sd.toFixed(4) + ' vs ' + want.toFixed(4));
var clear = walks('misty', { haze: 0 }), climb = 0;
clear.tw.slice(1).forEach(function (q) {
  var v = q.v, rho = clear.p.rho, ph = function (p) { return clear.land.f(p) + rho / 2 * ((p[0] - v[0]) * (p[0] - v[0]) + (p[1] - v[1]) * (p[1] - v[1])); };
  for (var k = 1; k < q.path.length; k++) climb = Math.max(climb, ph(q.path[k]) - ph(q.path[k - 1]));
});
check('the Wanderer\'s small steps only go down its sum, in clear air', climb <= 0, climb.toExponential(1));

// ---------------------------------------------------------------- 4. edge cases the review found
var tq = E.towerLand({ y1: 0, y2: 0, s2: 0.25, muP: 1, muB: 2, law: 1 });
check('the Wanderer\'s cubic keeps the root 0 when P = Q = 0', Math.abs(tq.bestCard(0, 0, 4)) < 1e-12, tq.bestCard(0, 0, 4));
var corner = E.cartographer(E.buildLand('wall', E.PRESETS.wall), [0, 0], 10, 120), X2 = E.buildLand('wall', E.PRESETS.wall).treasure;
check('the Cartographer starting on the wall\'s corner still reaches the treasure', d(corner[corner.length - 1].x, X2) < 1e-3, corner[corner.length - 1].x.map(function (v) { return v.toFixed(4); }).join(', '));
var hazy = E.buildLand('misty', copy(E.PRESETS.misty, { haze: 0.02 })), th = E.twins(hazy, [E.PRESETS.misty.sx, E.PRESETS.misty.sy], 1, 120);
check('in haze the Twins never call one still day a rest', th.rest === undefined && th.length === 121, th.length - 1 + ' days');
[3, 11, 25].forEach(function (seed) {
  var sl = E.buildLand('misty', copy(E.PRESETS.misty, { seed: seed, ripA: 0.1, ripL: 0.05, haze: 0 })), b = sl.box, n = 901, lo = Infinity;
  for (var i2 = 0; i2 < n; i2++) for (var j2 = 0; j2 < n; j2++) lo = Math.min(lo, sl.J([b[0] + (b[1] - b[0]) * i2 / (n - 1), b[0] + (b[1] - b[0]) * j2 / (n - 1)]));
  check('short ripples, seed ' + seed + ': the treasure is the lowest spot', sl.J(sl.treasure) <= lo + 1e-6, sl.J(sl.treasure).toFixed(5) + ' vs grid ' + lo.toFixed(5));
});

console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
process.exit(failures ? 1 : 0);
