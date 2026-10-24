// "The Coach and the Physio": an athlete's next hard session, planned as optimization with constraints and
// negotiated with ADMM.  The Coach (x) scores sessions from the readiness curve and never looks at the rules; the
// Physio (z) keeps the rules and never reads the curve; a tether (rho) ties their plans and the planning log (u)
// remembers their disagreement.  Told on the player of the King's Land tutorials (board.js), with the case and
// the solver from plan.js and the drawings from plan_parts.js.
(function () {
  'use strict';
  var B = window.Board, N = window.Plan, P = window.PlanParts; if (!B || !N || !P) return;
  var H = B.H, C = H.C, seg = H.seg, num = H.num, pair = H.pair, at = H.at, add = H.add, sub = H.sub, scale = H.scale, len = H.len, lerp2 = H.lerp2, around = H.around, ease = H.ease, clamp = H.clamp;
  var COACH = P.COACH, PHYSIO = P.PHYSIO, LOG = P.LOG, AIM = P.AIM, subscript = P.subscript;

  // ------------------------------------------------------------ the case and its negotiations
  var d = N.build(), p = d.p, pr = d.prob, S = d.sol, R = S.rounds, A = d.alone, AR = A.rounds, rho = p.rho;
  var free = pr.free, freeZ = pr.freeZ, best = pr.best.q, crest = pr.crest, rules = pr.rules, last = pr.last;
  var K = 2, rec = R[K], v = rec.v, x = rec.x, z = rec.z, u = rec.u, x1 = rec.xPrev, z1 = rec.zPrev, u1 = rec.uPrev, gap = rec.gap, xu = add(x, u1);
  var K_END = R.length - 1, fin = S.final, second = d.season.plans[1], third = d.season.plans[2], pr1 = second.prob, S1 = second.sol, R1 = S1.rounds;
  var VIEW = [-0.4, 12.4, -0.4, 10.6];
  function rule(id) { return rules.filter(function (r) { return r.id === id; })[0]; }
  function rule1(id) { return pr1.rules.filter(function (r) { return r.id === id; })[0]; }
  function plan(q) { return '(' + num(q[0], 2) + ' d, ' + num(q[1], 2) + ')'; }
  function pr2(q) { return pair(q, 2); }
  function shadeOf(prob, id) {
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i <= 40; i++) for (var j = 0; j <= 40; j++) { var val = prob.J([VIEW[0] + (VIEW[1] - VIEW[0]) * i / 40, VIEW[2] + (VIEW[3] - VIEW[2]) * j / 40]); if (val < lo) lo = val; if (val > hi) hi = val; }
    return { lo: lo, hi: Math.max(-lo, 0.5), id: id, rings: 12 };   // centred on zero cost: harm brown, benefit blue
  }
  var shade0 = shadeOf(pr, 'J0'), shade1 = shadeOf(pr1, 'J1');
  function base(g, o) {
    o = o || {}; var prob = o.prob || pr;
    g.land(o.fn || prob.J, o.shade || (prob === pr ? shade0 : shade1)); P.axes(g, 'day of the session →', '↑ load');
    if (o.poly !== false) P.polygon(g, prob.poly.verts, { p: o.polyP == null ? 1 : o.polyP });
  }
  // the Coach's walk downhill on its own map from a start to its favourite: a flow along the slope, for the eye
  function flow(prob, from) {
    var q = from.slice(), path = [q.slice()], h = 1e-4, step = 0.05;
    for (var i = 0; i < 600; i++) {
      var gt = (prob.J([q[0] + h, q[1]]) - prob.J([q[0] - h, q[1]])) / (2 * h), gw = (prob.J([q[0], q[1] + h]) - prob.J([q[0], q[1] - h])) / (2 * h), n = Math.hypot(gt, gw);
      if (n < 1e-6 || len(sub(q, prob.free)) < 0.06) break;
      q = [q[0] - step * gt / n, q[1] - step * gw / n]; path.push(q.slice());
    }
    path.push(prob.free.slice()); return path;
  }
  function along(path, q) {
    var L = 0, segL = [], i; for (i = 1; i < path.length; i++) { segL.push(len(sub(path[i], path[i - 1]))); L += segL[i - 1]; }
    var goal = L * clamp(q, 0, 1), pos = path[0];
    for (i = 1; i < path.length; i++) { if (goal <= segL[i - 1]) { pos = lerp2(path[i - 1], path[i], segL[i - 1] ? goal / segL[i - 1] : 1); break; } goal -= segL[i - 1]; pos = path[i]; }
    return pos;
  }
  var out = [], CH = { athlete: 'The athlete', pair: 'The Coach and the Physio', round: 'One planning round', season: 'The season', bridge: 'The same four moves elsewhere' };

  // ------------------------------------------------------------ 1. the athlete
  // One hard session leaves fitness (small, slow to fade) and fatigue (large, quick to fade); readiness is the rested
  // level 1 plus fitness minus fatigue.  The Coach scores a session by its benefit, w (r(t) − r0) − a w², and writes the
  // cost J = −benefit so that the best session is the lowest point, as on the King's land.
  var rDip = pr.r(0), rCrest = pr.r(crest), fitAmp = last.w / p.wRef * p.k1, fatAmp = last.w / p.wRef * p.k2;
  var tRested = Math.log(fatAmp / fitAmp) / (1 / p.tau2 - 1 / p.tau1);
  function fitness(t) { return fitAmp * Math.exp(-t / p.tau1); }
  function fatigue(t) { return fatAmp * Math.exp(-t / p.tau2); }
  function benefitAt(q) { return -pr.J(q); }
  var worth = rCrest - p.r0, exLoad = 5, exGain = exLoad * worth, exPrice = p.a * exLoad * exLoad, wZero = worth / p.a;
  out.push({ id: 'curve', chapter: CH.athlete, title: 'What one hard session does to the body', layout: 'side', dur: 7,
    text: 'Before choosing the next hard session, the Coach needs to know how ready the athlete will be on each coming day. ' +
      'The last hard session was on day 0, with a load of ' + num(last.w, 0) + '; load measures how hard a session is, in training-load units. ' +
      'A hard session leaves two effects: fatigue, which is large but fades within a few days, and fitness, which is smaller but lasts several times longer. ' +
      'Readiness adds them to the rested level: readiness = 1 + fitness − fatigue, where 1 means fully rested. ' +
      'So readiness dips right after the session, to ' + num(rDip, 2) + ' on day 0, half the rested level. ' +
      'Fatigue fades first, so readiness is back to 1 by day ' + num(tRested, 2) + ' and keeps rising to ' + num(rCrest, 2) + ' on day ' + num(crest, 2) + ': fitter than rested. ' +
      'Sports scientists call this crest supercompensation; after it, fitness fades too and readiness drifts back toward 1.',
    math: 'fitness = ' + num(fitAmp, 1) + '·e^(−t/' + p.tau1 + '),  fatigue = ' + num(fatAmp, 1) + '·e^(−t/' + p.tau2 + '),  t in days' + at(0.5, '<br>readiness r(t) = 1 + fitness − fatigue') + at(0.8, ':  r(0) = ' + num(rDip, 2) + ',  r(' + num(crest, 2) + ') = ' + num(rCrest, 2)),
    draw: function (g, q) {
      var R = g.sideR, half = Math.round((R[3] - 8) / 2), top = [R[0], R[1], R[2], half], bottom = [R[0], R[1] + half + 8, R[2], R[3] - half - 8];
      P.effectsPanel(g, top, { fit: fitness, fat: fatigue, fitAmp: fitAmp, fatAmp: fatAmp, t: [0, 12], p: seg(q, 0, 0.55), title: 'what one hard session leaves behind' });
      P.curvePanel(g, bottom, { r: pr.r, t: [0, 12], v: [0.3, 1.6], p: seg(q, 0.45, 1), title: 'readiness = 1 + fitness − fatigue', sessions: [{ t: 0, w: last.w, text: 'the session, day 0' }], from: 0.15, to: 0.55, baseAt: 8, baseBelow: true,
        marks: [{ t: 0.02, text: 'tired: ' + num(rDip, 2), at: 0.55, side: 'right' }, { t: tRested, text: 'rested again, day ' + num(tRested, 2), at: 0.65, side: 'right' }, { t: crest, text: 'the crest: ' + num(rCrest, 2) + ' on day ' + num(crest, 2), at: 0.75 }, { t: 10.5, text: 'back toward 1', at: 0.85, side: 'left' }] });
    } });

  out.push({ id: 'score', chapter: CH.athlete, title: 'The Coach’s aim: the most benefit from one session', layout: 'side', dur: 7,
    text: 'The Coach’s aim is to choose the next hard session that will make the athlete fittest. ' +
      'It can choose two things: the day of the session, t, counted from the last one, and its load, w. ' +
      'Nothing has happened yet, so the Coach predicts each session’s training benefit from the readiness curve, with a simple rule. ' +
      'The day sets what each unit of load is worth: readiness minus ' + num(p.r0, 1) + ', because below ' + num(p.r0, 1) + ' the body is too tired and hard training does harm. ' +
      'The gain is the load times that worth: w × (r(t) − ' + num(p.r0, 1) + '). ' +
      'Too much load at once also strains the body, and that price grows with the square of the load: ' + num(p.a, 2) + '·w². ' +
      'On day ' + num(crest, 2) + ' each unit is worth ' + num(rCrest, 3) + ' − ' + num(p.r0, 1) + ' = ' + num(worth, 3) + ', so load ' + exLoad + ' gains ' + num(exGain, 2) + ', pays ' + num(exPrice, 2) + ' and leaves a benefit of ' + num(exGain - exPrice, 2) + '. ' +
      'The benefit is the gap between gain and price; on this day it is largest at load ' + num(free[1], 2) + ', where it is ' + num(-pr.freeJ, 2) + '.',
    math: 'benefit B(t, w) = w·(r(t) − ' + num(p.r0, 1) + ') − ' + num(p.a, 2) + '·w²' + at(0.5, '<br>day ' + num(crest, 2) + ', load ' + exLoad + ':  ' + exLoad + ' × ' + num(worth, 3) + ' − ' + num(p.a, 2) + ' × ' + exLoad + '² = ' + num(exGain, 2) + ' − ' + num(exPrice, 2) + ' = ' + num(exGain - exPrice, 2)) +
      at(0.82, '<br>best load on day t: (r(t) − ' + num(p.r0, 1) + ')/(2 × ' + num(p.a, 2) + ');  day ' + num(crest, 2) + ': ' + num(free[1], 2) + ', benefit ' + num(-pr.freeJ, 2)),
    draw: function (g, q) {
      var parts = P.split(g.sideR, 0.5);
      var pl = P.curvePanel(g, parts[0], { r: pr.r, t: [0, 12], v: [0.3, 1.6], p: seg(q, 0, 0.45), title: 'what a unit of load is worth, by day', r0: p.r0, from: 0.05, to: 0.4, baseAt: 12, baseBelow: true,
        marks: [{ t: crest, text: 'day ' + num(crest, 2) + ': ' + num(rCrest, 2), at: 0.42 }] });
      pl.seg(crest, 0.3, crest, rCrest, C.gold, 1.2, seg(q, 0.3, 0.45), [4, 4]);
      var qb = seg(q, 0.42, 0.55); if (qb > 0) { var cx2 = g.ctx, bx = pl.X(crest) + 10; cx2.globalAlpha = qb; cx2.strokeStyle = C.gold; cx2.lineWidth = 2.4; cx2.beginPath(); cx2.moveTo(bx - 5, pl.Y(p.r0)); cx2.lineTo(bx, pl.Y(p.r0)); cx2.lineTo(bx, pl.Y(rCrest)); cx2.lineTo(bx - 5, pl.Y(rCrest)); cx2.stroke(); cx2.globalAlpha = 1;
        g.labelPx(bx + 6, pl.Y(0.8), 'worth ' + num(worth, 3) + ' per unit of load', C.gold, { size: 12, plain: true, p: qb }); }
      P.gainPricePanel(g, parts[1], { worth: worth, a: p.a, wMax: 16, example: exLoad, best: free[1], p: seg(q, 0.45, 1), title: 'on day ' + num(crest, 2) + ': gain and price as the load grows' });
    } });

  var soonQ = [0.5, free[1]], lateQ = [10, free[1]], lightQ = [crest, 2], heavyLoad = 13;
  function costAlongDay(t) { return pr.J([t, free[1]]); }
  function costAlongLoad(w) { return pr.J([crest, w]); }
  out.push({ id: 'benefit', chapter: CH.athlete, title: 'The Coach’s map: every session scored at once', layout: 'map+side', view: VIEW, dur: 7.2,
    text: 'Each point of this map is one possible session: its day across, its load up. ' +
      'The Coach scores every point with the rule of the last page. ' +
      'Every method in this course searches for a lowest point, like the treasure on the King’s land, so the Coach turns the score upside down into a cost, J = − benefit. ' +
      'The best session is then the lowest ground: blue ground is a big benefit, grey a small one, and brown is harm. ' +
      'Keep the load at ' + num(free[1], 2) + ' and move the day, along the gold line: too soon, the athlete is still tired and this load does more harm than good; too late, the crest has passed and the session gains less. ' +
      'Keep the day at ' + num(crest, 2) + ' and change the load, along the violet line: too light gains little, and too heavy strains more than it gains. ' +
      'The lowest point is the Coach’s favourite, c: day ' + num(free[0], 2) + ', load ' + num(free[1], 2) + ', a benefit of ' + num(-pr.freeJ, 2) + '.',
    math: 'cost J(t, w) = − benefit = −w·(r(t) − ' + num(p.r0, 1) + ') + ' + num(p.a, 2) + '·w²' + at(0.75, '<br>lowest at c = ' + pr2(free) + ':  J = ' + num(pr.freeJ, 2) + ', a benefit of ' + num(-pr.freeJ, 2)),
    draw: function (g, q) {
      base(g, { poly: false }); P.costKey(g, seg(q, 0.02, 0.15));
      g.line([VIEW[0], free[1]], [VIEW[1], free[1]], C.gold, 1.5, seg(q, 0.12, 0.3), [6, 4]);
      g.line([crest, VIEW[2]], [crest, VIEW[3]], C.violet, 1.5, seg(q, 0.45, 0.62), [6, 4]);
      [[soonQ, 'too soon: harm', { dx: -4, dy: 24 }, 0.28], [lateQ, 'too late', { dx: 0, dy: 20, align: 'center' }, 0.36], [lightQ, 'too light', { dx: 12, dy: 0 }, 0.6]].forEach(function (e) {
        var qq = seg(q, e[3], e[3] + 0.1), o = e[2]; g.dot(e[0], 5, C.ink, qq); g.label(e[0], e[1] + ' (' + (benefitAt(e[0]) >= 0 ? '+' : '−') + num(Math.abs(benefitAt(e[0])), 2) + ')', C.ink, { dx: o.dx, dy: o.dy, align: o.align, p: qq, size: 12 });
      });
      g.halo(free, 16, C.gold, seg(q, 0.82, 0.95), 1.5); P.coach(g, free, seg(q, 0.82, 0.95), 'c, the lowest point (+' + num(-pr.freeJ, 2) + ')', { dx: 16, dy: -22 });
      var parts = P.split(g.sideR, 0.5);
      var pa = g.plot(parts[0], [0, 12], [-3.4, 4], { title: 'gold line: load ' + num(free[1], 2) + ', the day moves' }), shortA = pa.box[3] < 130;
      pa.frame(shortA ? 'day' : 'day of the session', shortA ? '' : 'cost J'); pa.seg(0, 0, 12, 0, 'rgba(242,245,248,0.4)', 1.2, seg(q, 0.12, 0.2), [4, 4]);
      pa.curve(costAlongDay, C.gold, 2.4, seg(q, 0.15, 0.4));
      pa.point(soonQ[0], costAlongDay(soonQ[0]), C.ink, 'too soon', seg(q, 0.3, 0.38)); pa.point(lateQ[0], costAlongDay(lateQ[0]), C.ink, 'too late', seg(q, 0.36, 0.44), 'left');
      pa.point(crest, pr.freeJ, C.gold, 'lowest: c', seg(q, 0.84, 0.95));
      var pb = g.plot(parts[1], [0, 16], [-3.4, 1.4], { title: 'violet line: day ' + num(crest, 2) + ', the load changes' }), shortB = pb.box[3] < 130;
      pb.frame(shortB ? 'load' : 'load of the session', shortB ? '' : 'cost J'); pb.seg(0, 0, 16, 0, 'rgba(242,245,248,0.4)', 1.2, seg(q, 0.45, 0.52), [4, 4]);
      pb.curve(costAlongLoad, C.violet, 2.4, seg(q, 0.48, 0.72));
      pb.point(lightQ[1], costAlongLoad(lightQ[1]), C.ink, 'too light', seg(q, 0.6, 0.68)); pb.point(heavyLoad, costAlongLoad(heavyLoad), C.ink, 'too heavy', seg(q, 0.68, 0.76), 'left');
      pb.point(free[1], pr.freeJ, C.gold, 'lowest: c', seg(q, 0.84, 0.95));
    } });

  var ruleRows = [
    { id: 'recovery', label: 'recovery: t ≥ ' + num(rule('recovery').b * -1, 0), at: 0.82, dx: 8, align: 'left' },
    { id: 'ramp', label: 'ramp: w ≤ ' + num(rule('ramp').b, 1), at: 0.68, dy: -14 },
    { id: 'workload', label: 'workload: w ≤ ' + num(p.w0, 0) + ' + ' + num(p.s, 1) + '·t', at: 0.5, dx: -12, dy: -6, align: 'right' },
    { id: 'taper', label: 'taper: t ≤ ' + num(rule('taper').b, 0), at: 0.9, dx: -8, align: 'right' }];
  out.push({ id: 'rules', chapter: CH.athlete, title: 'The Physio’s rules: the safe plans', layout: 'map', view: VIEW, dur: 6.4,
    text: 'The Physio reads the same plan against four rules. Recovery: at least ' + p.recovery + ' days after the last hard session. Ramp: at most ' + Math.round((p.ramp - 1) * 100) + '% more load than last time, so w ≤ ' + num(rule('ramp').b, 1) + '. Workload: the load allowed grows with the rest taken, w ≤ ' + num(p.w0, 0) + ' + ' + num(p.s, 1) + '·t, the acute-to-chronic workload ratio written for one session. Taper: no hard session in the last ' + p.taper + ' days before the race on day ' + p.race + '. Each rule is a line with a forbidden side; the plans that keep all four form the safe set C, a polygon. The Coach’s favourite lies outside it: too much load for the rest taken.',
    math: 't ≥ ' + num(-rule('recovery').b, 0) + ',  w ≤ ' + num(rule('ramp').b, 1) + ',  w ≤ ' + num(p.w0, 0) + ' + ' + num(p.s, 1) + '·t,  t ≤ ' + num(rule('taper').b, 0) + at(0.8, ';  C: all four at once.  c = ' + pr2(free) + ' breaks the ramp and workload rules'),
    draw: function (g, q) {
      base(g, { poly: false });
      ruleRows.forEach(function (rr, i) { P.ruleLine(g, rule(rr.id), seg(q, 0.05 + 0.18 * i, 0.22 + 0.18 * i), { label: rr.label, at: rr.at, dx: rr.dx, dy: rr.dy, align: rr.align }); });
      P.polygon(g, pr.poly.verts, { p: seg(q, 0.78, 0.95) }); g.label([7.2, 2.6], 'C, the safe plans', PHYSIO, { align: 'center', p: seg(q, 0.85, 1), size: 12.5 });
      P.coach(g, free, 1, 'c: outside C', { dx: 16, dy: -14 });
    } });

  var physioHome = [8.4, 3.4];
  out.push({ id: 'one', chapter: CH.athlete, title: 'One athlete, one next session', layout: 'map', view: VIEW, dur: 5.6,
    text: 'Only one session will happen, so the plan handed to the athlete must be one plan, and it must be both good and safe: the best plan inside C, the gold star, a session on day ' + num(best[0], 2) + ' with a load of ' + num(best[1], 2) + '. But the two halves of that job want different skills. Scoring plans is easy for someone who reads the curve and ignores the rules. Keeping the rules is easy for someone who checks the lines and never reads the curve. Doing both at once is the hard part. So the club has two specialists, the Coach and the Physio, and the athlete gets a plan only on the day both put their names to the same one.',
    math: 'one plan: the lowest J with (t, w) in C' + at(0.5, '<br>two copies: x, the Coach’s, hunts the lowest J;  z, the Physio’s, keeps the rules;  at the end x = z'),
    draw: function (g, q) {
      base(g); P.star(g, best, seg(q, 0, 0.2), 'the best safe session ' + plan(best), { dx: -14, dy: 18, align: 'right' });
      P.coach(g, free, seg(q, 0.25, 0.4), 'the Coach scores plans', { dx: 16, dy: -14 }); P.physio(g, physioHome, seg(q, 0.4, 0.55), 'the Physio keeps the rules', { dx: 16, dy: 16 });
      g.line(free, best, AIM, 1.5, seg(q, 0.6, 0.8), [5, 4]); g.line(physioHome, best, AIM, 1.5, seg(q, 0.6, 0.8), [5, 4]);
      g.label([7.0, 6.2], 'both must end on the star', AIM, { align: 'center', p: seg(q, 0.8, 1), size: 12 });
    } });

  // ------------------------------------------------------------ 2. the Coach and the Physio
  var introView = around([free, freeZ, best], 1.2, 5), walk = flow(pr, [7.2, 9.2]);
  out.push({ id: 'coach-role', chapter: CH.pair, title: 'Meet the Coach: x', layout: 'map', view: introView, dur: 5.4,
    text: 'The Coach’s job: find the lowest point of whatever it is asked to minimise. Asked about its own cost alone, it reads the curve, walks downhill to the crest and loads up: c = ' + plan(free) + ', the darkest spot of the map, J = ' + num(pr.freeJ, 2) + '. It never looks at the rules, and c breaks two of them: no use to the athlete on its own. But add any pull to the map, and the Coach will find the new lowest point just as surely. That is the skill the club hired.',
    math: 'the Coach: x = argmin J(x) + (whatever pulls on it)' + at(0.6, ';  with nothing pulling: c = ' + pr2(free) + ', outside C'),
    draw: function (g, q) {
      base(g); P.star(g, best, 1);
      var s = seg(q, 0.1, 0.7), pos = along(walk, s); g.path(walk, 'rgba(230,233,238,0.55)', 2, s, [4, 4]);
      P.coach(g, pos, 1, s >= 1 ? 'c, the lowest point of all' : '', { dx: 16, dy: -14 });
      g.label(free, 'outside C: breaks the ramp and workload rules', C.red, { dx: 16, dy: 16, p: seg(q, 0.75, 0.95), size: 12 });
    } });

  var samples = [[7.6, 4.0], [8.6, 7.3], free].map(function (q0) { return { q: q0, z: N.project(pr.poly, pr.rules, q0) }; });
  out.push({ id: 'physio-role', chapter: CH.pair, title: 'Meet the Physio: z', layout: 'map', view: around([free, freeZ, best, samples[1].q], 0.8, 5), dur: 5.8,
    text: 'The Physio’s job: given any plan, step to the nearest safe plan. A safe plan stays where it is; a plan outside C is pulled straight to the nearest rule line, at a right angle, or to a corner where two rules meet. Asked about the Coach’s favourite c, the Physio answers Π(c) = ' + plan(freeZ) + ': the corner of the ramp and workload lines. Safe, but not the best safe session: the star is ' + num(freeZ[0] - best[0], 1) + ' days earlier and a little lighter. The Physio never reads the curve, so on its own it cannot find the best safe session either.',
    math: 'the Physio: z = Π<sub>C</sub>(any plan), the nearest safe plan' + at(0.6, ';  Π<sub>C</sub>(c) = ' + pr2(freeZ) + ', not the star ' + pr2(best)),
    draw: function (g, q) {
      base(g); P.star(g, best, 1);
      samples.forEach(function (s, i) {
        var qq = seg(q, 0.05 + 0.24 * i, 0.3 + 0.24 * i), moved = len(sub(s.q, s.z)) > 1e-9;
        g.dot(s.q, 5, i === 2 ? COACH : C.ink, seg(qq, 0, 0.3));
        if (moved) { g.arrow(s.q, s.z, PHYSIO, 2.5, seg(qq, 0.3, 0.8)); P.rightAngle(g, s.z, s.q, seg(qq, 0.8, 1)); } else g.halo(s.q, 10, PHYSIO, seg(qq, 0.3, 0.8), 1.5);
        if (qq > 0.7) { g.dot(s.z, 7, PHYSIO, seg(qq, 0.7, 1)); g.label(s.z, i === 2 ? 'Π(c): safe, not best' : moved ? 'nearest safe plan' : 'already safe: stays', PHYSIO, { dx: i === 2 ? 12 : 10, dy: i === 2 ? -16 : 14, p: seg(qq, 0.7, 1), size: 12 }); }
      });
      P.coach(g, free, seg(q, 0.55, 0.65), 'c', { dx: 14, dy: -12 });
    } });

  var xr = R[1].x, reach = Math.sqrt(2 * Math.max(pr.J(freeZ) - pr.freeJ, 0) / rho), ropeFree = function (q0) { var dq = sub(q0, freeZ); return pr.J(q0) + rho / 2 * (dq[0] * dq[0] + dq[1] * dq[1]); };
  out.push({ id: 'rope', chapter: CH.pair, title: 'Tie them with a tether', layout: 'map', view: around([free, freeZ, xr, best], 0.6, 4.5), dur: 5.8,
    text: 'Tie the two with a tether of stiffness ρ = ' + num(rho, 1) + '. Now the Coach minimises its cost plus the tether’s pull toward the Physio’s plan, and the Physio steps to the nearest safe plan to the Coach’s. Each still does only what it is good at; the tether makes them care about each other. The shading is the map as the Coach now feels it, the tether tied to the Physio at z = ' + plan(freeZ) + ': the cost ρ/2·|x − z|² is added. Pulled by the tether, the Coach moves from c to ' + plan(xr) + '. No plan farther than ' + num(reach, 2) + ' from the Physio can beat the Physio’s own: the dashed ring. A weaker tether lets them disagree more; a stiffer one keeps them closer and slows the Coach down.',
    math: 'the Coach now minimises J(x) + ρ/2·|x − z|²,  ρ = ' + num(rho, 1) + at(0.6, ';  the Physio takes Π<sub>C</sub>(x)'),
    draw: function (g, q) {
      g.land(ropeFree, { id: 'ropeFree', rings: 10 }); P.axes(g, 'day of the session →', '↑ load'); P.polygon(g, pr.poly.verts); P.star(g, best, 1);
      g.dot(freeZ, 7, PHYSIO, 1); g.label(freeZ, 'the Physio, z', PHYSIO, { dx: 12, dy: 16, size: 12 });
      var s = seg(q, 0.55, 0.9), pos = lerp2(free, xr, s);
      P.spring(g, pos, freeZ, seg(q, 0.05, 0.3)); P.coach(g, pos, 1, s >= 1 ? 'pulled to ' + plan(xr) : s <= 0 ? 'the Coach at c' : '', { dx: 16, dy: -14 });
      if (reach > 0) g.halo(freeZ, reach * g.s, C.ink, seg(q, 0.7, 0.9), 1.2, [5, 4]);
    } });

  var nlN = AR.length - 1, nlX = AR.map(function (r) { return r.x; }), nlZ = AR.map(function (r) { return r.z; }), nlEndX = nlX[nlN], nlEndZ = nlZ[nlN], nlGap = AR[nlN].primal;
  var nlGaps = AR.map(function (r) { return r.primal; }), admmGaps = []; for (var ai = 0; ai <= nlN; ai++) admmGaps.push(R[Math.min(ai, K_END)].primal);
  out.push({ id: 'without-ledger', chapter: CH.pair, title: 'The tether pulls, but does not remember', layout: 'map+side', view: around(nlX.concat(nlZ).concat([best]), 0.5, 4), dur: 6.6,
    text: 'Let them go with the tether alone, each round forgetting the last: the Coach to the lowest point of cost plus tether, the Physio to the nearest safe plan, and again. The Coach always stops uphill of the rules, asking for more than the Physio allows, the tether stretched by the slope of its map; the Physio stands on the workload line. They settle a fixed gap apart. After ' + nlN + ' rounds the gap is still ' + num(nlGap, 2) + ': the Coach at ' + plan(nlEndX) + ', the Physio at ' + plan(nlEndZ) + ', on the rule line but not at the star. Nothing can be handed to the athlete, because the two never name the same session. The tether pulls; it does not remember.',
    math: 'tether alone: x ← argmin J + ρ/2·|x − z|²,  z ← Π<sub>C</sub>(x)' + at(0.55, '<br>after ' + nlN + ' rounds: gap ' + num(nlGap, 2) + ', z = ' + pr2(nlEndZ) + ';  the star ' + pr2(best)),
    draw: function (g, q) {
      base(g); P.star(g, best, 1);
      var s = seg(q, 0, 0.8) * nlN, kk = Math.floor(s), fr = s - kk;
      for (var i = 1; i <= Math.min(kk, nlN); i++) { g.dot(nlX[i], 3, 'rgba(230,233,238,0.7)', 1); g.dot(nlZ[i], 3, C.red, 1); }
      var hx = kk >= nlN ? nlX[nlN] : lerp2(nlX[kk], nlX[kk + 1], ease(Math.min(1, fr * 2)));
      var hz = kk >= nlN ? nlZ[nlN] : fr < 0.5 ? nlZ[kk] : lerp2(nlZ[kk], nlZ[kk + 1], ease((fr - 0.5) * 2));
      P.spring(g, hx, hz, 1, C.red); P.coach(g, hx, 1); P.physio(g, hz, 1);
      g.labelPx(g.mapR[0] + 12, g.mapR[1] + 30, 'round ' + Math.min(kk, nlN) + ', tether alone', C.red, { size: 13 });
      if (q > 0.85) { g.label(nlEndZ, 'a fixed gap of ' + num(nlGap, 2), C.red, { dx: -14, dy: 18, align: 'right', size: 12 }); g.label(nlEndZ, 'z = ' + pr2(nlEndZ) + ', not the star', C.red, { dx: -14, dy: 38, align: 'right', size: 12 }); }
      var RR = g.sideR, hi = Math.max.apply(null, nlGaps.concat(admmGaps)) * 1.15 || 1, pl = g.plot(RR, [0, nlN], [0, hi], { title: 'the gap between the two, round by round' }); pl.frame('round', 'gap |x − z|');
      pl.curve(function (t) { var i = Math.floor(t), fq = t - i; return nlGaps[Math.min(i, nlN)] * (1 - fq) + nlGaps[Math.min(i + 1, nlN)] * fq; }, C.red, 2.2, clamp(s / nlN, 0, 1));
      pl.curve(function (t) { var i = Math.floor(t), fq = t - i; return admmGaps[Math.min(i, nlN)] * (1 - fq) + admmGaps[Math.min(i + 1, nlN)] * fq; }, PHYSIO, 2.2, seg(q, 0.85, 1));
      g.labelPx(pl.X(nlN) - 4, pl.Y(nlGaps[nlN]) - 12, 'tether alone: the gap stays', C.red, { align: 'right', size: 11.5, plain: true, p: seg(q, 0.8, 0.9) });
      g.labelPx(pl.X(nlN) - 4, pl.Y(hi * 0.22), 'with the log (next): the gap closes', PHYSIO, { align: 'right', size: 11.5, plain: true, p: seg(q, 0.9, 1) });
    } });

  var entries = []; for (var ej = 1; ej < K; ej++) entries.push({ k: ej, gap: sub(R[ej].x, R[ej].z) });
  out.push({ id: 'ledger-role', chapter: CH.pair, title: 'The planning log: u', layout: 'map+side', view: around([z1, x1, add(z1, u1)], 2.2, 4), dur: 5.8,
    text: 'So the Physio keeps a log. At the end of every round it writes down the gap, by how much and in which direction the Coach asked for more than it allowed: u ← u + (x − z). The log is not fatigue, fitness or training done; it records only how the two copies have disagreed. Repeated disagreement in one direction piles up; disagreement the other way cancels some of it. Round 1 ended with the Coach at x₁ = ' + plan(x1) + ' and the Physio at z₁ = ' + plan(z1) + ', so the first entry is the gap ' + pr2(sub(x1, z1)) + ': earlier and heavier than allowed. The log reads u₁ = ' + pr2(u1) + '. Next round the Physio will use it.',
    math: 'u<sub>k</sub> = u<sub>k−1</sub> + (x<sub>k</sub> − z<sub>k</sub>)' + at(0.5, ';  u₁ = (0, 0) + ' + pr2(sub(x1, z1)) + ' = ' + pr2(u1)),
    draw: function (g, q) {
      base(g);
      entries.forEach(function (e, i) { var qq = seg(q, 0.05 + 0.5 * i / entries.length, 0.2 + 0.5 * i / entries.length); g.arrow(R[e.k].z, R[e.k].x, AIM, 2.5, qq); });
      g.dot(z1, 7, PHYSIO, 1); g.label(z1, 'z₁', PHYSIO, { dx: 10, dy: 16, size: 12 }); P.coach(g, x1, 1, 'x₁', { dx: 12, dy: -14 });
      g.label(lerp2(z1, x1, 0.5), 'the gap x₁ − z₁', AIM, { dx: 12, dy: 0, p: seg(q, 0.2, 0.4), size: 12 });
      g.arrow(z1, add(z1, u1), LOG, 3, seg(q, 0.6, 0.85)); g.label(add(z1, u1), 'u₁ = ' + pr2(u1), LOG, { dx: -14, dy: 14, align: 'right', p: seg(q, 0.8, 1), size: 12 });
      var RR = g.sideR; g.panel(RR, 'The planning log');
      var rows = entries.map(function (e) { return { text: 'round ' + e.k + ':  ' + pr2(e.gap), col: AIM }; });
      rows.push({ text: 'total u' + subscript(K - 1) + ' = ' + pr2(u1), col: LOG }); rows.push({ text: 'disagreement, not fatigue or fitness', col: C.dim });
      rows.forEach(function (r, i) { var qq = seg(q, 0.1 + 0.6 * i / rows.length, 0.25 + 0.6 * i / rows.length); g.labelPx(RR[0] + 16, RR[1] + 56 + 30 * i, r.text, r.col, { plain: true, mono: true, p: qq }); });
    } });

  // ------------------------------------------------------------ 3. one planning round
  out.push({ id: 'aim', chapter: CH.round, title: 'Aim past the Physio: v = z − u', layout: 'map+side', view: around([z1, v, x1, add(z1, u1)], 1.2, Math.max(3, 1.4 * len(u1))), dur: 5,
    text: 'The log says: you asked for ' + pr2(u1) + ' more than I allowed. So the Physio tells the Coach to aim not at z₁ but past it by the log, the other way: the aim is v₂ = z₁ − u₁ = ' + plan(v) + ', later and lighter than the Physio’s own plan. Why past, and why subtract? The tether’s cost ρ/2·|x − z + u|² is the same number as ρ/2·|x − (z − u)|²: a tether tied to v. A disagreement that repeats is corrected a little harder each round, until the Coach lands on the Physio.',
    math: '|x − z + u|² = |x − (z − u)|²,  so its centre is v = z − u' + at(0.55, '<br>v₂ = ' + pr2(z1) + ' − ' + pr2(u1) + ' = ' + pr2(v)),
    draw: function (g, q) {
      base(g); g.dot(z1, 7, PHYSIO, 1); g.label(z1, 'start at z₁', PHYSIO, { dx: -8, dy: -16, align: 'right', size: 12 }); P.coach(g, x1, 1, 'x₁', { dx: 12, dy: -14 });
      g.arrow(z1, v, AIM, 3, seg(q, 0.25, 0.58)); g.label(lerp2(z1, v, 0.5), 'past it by the log, −u₁', AIM, { dx: -10, dy: -10, align: 'right', p: seg(q, 0.45, 0.68), size: 12 });
      g.dot(v, 6, AIM, seg(q, 0.55, 0.7)); g.halo(v, 12, AIM, seg(q, 0.6, 0.75), 1.5);
      g.label(v, 'the aim v₂ = ' + pr2(v), AIM, { dx: -10, dy: 20, align: 'right', p: seg(q, 0.68, 0.86), size: 12 });
      var RR = g.sideR; g.panel(RR, 'Build the aim');
      g.labelPx(RR[0] + 16, RR[1] + 55, '1. the Physio   z₁ = ' + pr2(z1), PHYSIO, { plain: true, mono: true, p: seg(q, 0.08, 0.3) });
      g.labelPx(RR[0] + 16, RR[1] + 91, '2. the log      u₁ = ' + pr2(u1), LOG, { plain: true, mono: true, p: seg(q, 0.28, 0.5) });
      g.labelPx(RR[0] + 16, RR[1] + 127, '3. past it by  −u₁ = ' + pr2(scale(u1, -1)), AIM, { plain: true, mono: true, p: seg(q, 0.48, 0.7) });
      g.labelPx(RR[0] + 16, RR[1] + 163, '4. the aim      v₂ = ' + pr2(v), C.gold, { plain: true, mono: true, p: seg(q, 0.68, 0.9) });
    } });

  var step2 = N.coachStep(pr, v, rho), ropeV = function (q0) { var dq = sub(q0, v); return pr.J(q0) + rho / 2 * (dq[0] * dq[0] + dq[1] * dq[1]); };
  out.push({ id: 'coach', chapter: CH.round, title: 'The Coach’s step: scan the days, then the load', layout: 'map+side', view: around([x1, v, x], 0.6, 3.5), dur: 5.8,
    text: 'The Coach is told: find the lowest point of the cost plus a tether to v₂ = ' + plan(v) + '. For each day t the best load is a formula, w = (r(t) − ' + num(p.r0, 1) + ' + ρ·v<sub>w</sub>)/(2·' + num(p.a, 2) + ' + ρ); what remains is one number, the day, which the Coach finds by scanning the days and keeping the lowest. The panel shows that scan. Lowest on day ' + num(x[0], 2) + ', then w = ' + num(x[1], 2) + ': x₂ = ' + plan(x) + '. The shading is the map plus the tether, as the Coach feels it this round.',
    math: 'w(t) = (r(t) − r₀ + ρ·v<sub>w</sub>)/(2a + ρ)' + at(0.45, ';  scan t: lowest on day ' + num(x[0], 2)) + at(0.8, ';  x₂ = ' + pr2(x)),
    draw: function (g, q) {
      g.land(ropeV, { id: 'ropeV', rings: 10 }); P.axes(g, 'day of the session →', '↑ load'); P.polygon(g, pr.poly.verts);
      g.dot(v, 6, AIM, 1); g.label(v, 'the aim v₂', AIM, { dx: 10, dy: 16, size: 12 });
      var s = seg(q, 0.62, 0.95), pos = lerp2(x1, x, s); g.path([x1, x], C.ink, 2, s, [4, 3]);
      P.spring(g, pos, v, 1); P.coach(g, pos, 1, s >= 1 ? 'x₂ = ' + pr2(x) : s <= 0 ? 'x₁' : '', { dx: 12, dy: -14 });
      P.scanPanel(g, g.sideR, { along: step2.along, t: [0, 12], title: 'the Coach’s scan: cost + tether, per day', scan: seg(q, 0.08, 0.58), best: [x[0], step2.value], bestP: seg(q, 0.58, 0.7), label: 'lowest: day ' + num(x[0], 2) });
    } });

  out.push({ id: 'physio', chapter: CH.round, title: 'The Physio’s step', layout: 'map', view: around([x, xu, z, v], 0.6, 3), dur: 4.6,
    text: 'Now the Physio moves, with the new x₂ and the start-of-round log u₁ held fixed. It starts from the Coach’s plan plus the log, x₂ + u₁ = ' + pr2(x) + ' + ' + pr2(u1) + ' = ' + pr2(xu) + ', and steps straight to the nearest safe plan: z₂ = ' + plan(z) + ', on the workload line. Why add the log? The same tether cost, |x − z + u|² = |z − (x + u)|², is smallest at the safe z nearest x + u.',
    math: '|x − z + u|² = |z − (x + u)|²' + at(0.42, '<br>z₂ = Π<sub>C</sub>(x₂ + u₁)') + at(0.75, ' = Π<sub>C</sub>' + pr2(xu) + ' = ' + pr2(z)),
    draw: function (g, q) {
      base(g); P.coach(g, x, 1, 'x₂', { dx: 12, dy: 14 });
      g.arrow(x, xu, LOG, 2, seg(q, 0.1, 0.35)); g.dot(xu, 5, C.ink, seg(q, 0.3, 0.4)); g.label(xu, 'x₂ + u₁', C.ink, { dx: -10, dy: -14, align: 'right', p: seg(q, 0.35, 0.5) });
      g.line(xu, z, PHYSIO, 2, seg(q, 0.5, 0.75), [5, 4]); P.rightAngle(g, z, xu, seg(q, 0.7, 0.85));
      P.physio(g, z, seg(q, 0.7, 0.85), 'z₂, the nearest safe plan', { dx: 14, dy: 16 });
    } });

  out.push({ id: 'ledger', chapter: CH.round, title: 'The log, updated', layout: 'map', view: around([z, add(z, u1), add(z, u), x], 1.2, 3.5), dur: 4.6,
    text: 'The Physio writes this round’s gap into the log: u₂ = u₁ + (x₂ − z₂) = ' + pr2(u1) + ' + ' + pr2(gap) + ' = ' + pr2(u) + '. The Coach asked for earlier and heavier again, so the entry grows. A small gap means the two nearly agree. But agreement alone is not enough to stop: the Physio must also have stopped moving. When all is settled the log holds the rule’s toll: ρu is the force with which the workload rule holds the Coach back.',
    math: 'u₂ = u₁ + x₂ − z₂' + at(0.45, '<br>= ' + pr2(u1) + ' + ' + pr2(gap)) + at(0.85, ' = ' + pr2(u)),
    draw: function (g, q) {
      base(g); g.dot(z, 7, PHYSIO, 1); g.label(z, 'z₂', PHYSIO, { dx: 10, dy: 18, size: 12 }); P.coach(g, x, 1, 'x₂', { dx: 12, dy: -14 });
      var tipOld = add(z, u1);
      g.arrow(z, tipOld, 'rgba(255,176,113,0.55)', 2.5, seg(q, 0.05, 0.3)); g.label(lerp2(z, tipOld, 0.25), 'old log u₁', 'rgba(255,176,113,0.9)', { dx: 12, dy: 10, p: seg(q, 0.2, 0.4), size: 12 });
      g.arrow(tipOld, add(tipOld, gap), AIM, 2.5, seg(q, 0.35, 0.6)); g.label(lerp2(tipOld, add(tipOld, gap), 0.5), '+ this round’s gap', AIM, { dx: 12, dy: -6, p: seg(q, 0.5, 0.65), size: 12 });
      g.arrow(z, add(z, u), LOG, 3.5, seg(q, 0.65, 0.9)); g.tipLabel(add(z, u), u, 'new log u₂ = ' + pr2(u), LOG, seg(q, 0.85, 1));
    } });

  var ahead = R.slice(K), xs = ahead.map(function (r) { return r.x; }), zs = ahead.map(function (r) { return r.z; }), nA = ahead.length - 1;
  out.push({ id: 'again', chapter: CH.round, title: 'Round after round, until they agree', layout: 'map+side', view: around(xs.concat(zs), 0.6, 2.5), dur: 6,
    text: 'Each round repeats the four moves: the aim, the Coach’s step, the Physio’s step, the log. Here are the rounds from the second on. The two stop only when both gauges are small: the gap between them, |x − z|, the primal residual, and the Physio’s move since the last round times ρ, the dual residual. Agreement alone is not enough: a Physio still on the move has not settled on the plan. Stability alone is not enough: a settled Physio the Coach still disagrees with has no plan to file. Both gauges are below ' + num(p.tol, 2) + ' after round ' + K_END + ': ' + num(fin.primal, 4) + ' and ' + num(fin.dual, 4) + '.',
    math: 'stop when |x − z| and ρ·|z<sub>new</sub> − z<sub>old</sub>| are both small' + at(0.6, ';  round ' + K_END + ': ' + num(fin.primal, 4) + ' and ' + num(fin.dual, 4)),
    draw: function (g, q) {
      base(g); P.star(g, best, 1); var s = seg(q, 0.05, 0.85) * nA, kk = Math.floor(s), f2 = s - kk;
      g.path(xs.slice(0, kk + 1).concat(kk < nA ? [lerp2(xs[kk], xs[kk + 1], ease(f2))] : []), 'rgba(230,233,238,0.8)', 2, 1);
      g.path(zs.slice(0, kk + 1).concat(kk < nA ? [lerp2(zs[kk], zs[kk + 1], ease(f2))] : []), PHYSIO, 2, 1);
      for (var m = 1; m <= Math.min(kk, nA); m++) { g.dot(xs[m], 3, COACH, 1); g.dot(zs[m], 3, PHYSIO, 1); }
      var hx = kk < nA ? lerp2(xs[kk], xs[kk + 1], ease(f2)) : xs[nA], hz = kk < nA ? lerp2(zs[kk], zs[kk + 1], ease(f2)) : zs[nA];
      P.spring(g, hx, hz, 1); P.physio(g, hz, 1); g.halo(hz, 15, PHYSIO, 1, 2); P.coach(g, hx, 1); g.labelPx(g.mapR[0] + 12, g.mapR[1] + 30, 'round ' + (K + Math.min(kk, nA)), C.gold, { size: 13 });
      P.gaugePanel(g, g.sideR, R, q, { upto: (K + s) / K_END, tol: p.tol });
    } });

  var lastRows = R.slice(Math.max(1, K_END - 2)).map(function (r) { return { text: 'round ' + r.k + ':  gap ' + num(r.primal, 4) + ',  ρ × move ' + num(r.dual, 4) + (r.primal <= p.tol && r.dual <= p.tol ? '  ✓' : ''), col: r.k === K_END ? C.gold : C.ink, mono: true }; });
  out.push({ id: 'ready', chapter: CH.round, title: 'When is the plan ready?', layout: 'map+side', view: around([best, z1, x1], 1.0, 2.5), dur: 5,
    text: 'After round ' + K_END + ' the gap is ' + num(fin.primal, 4) + ' and the Physio’s move times ρ is ' + num(fin.dual, 4) + ': both gauges are below ' + num(p.tol, 2) + ', so the Coach and the Physio put their names to one plan, z' + subscript(K_END) + ' = ' + plan(fin.z) + '. It is the star, the best safe session, found without anyone ever scoring the whole safe set: the Coach only ever scored, the Physio only ever kept the rules, and the log carried their disagreement across the rounds. The plan goes to the athlete: a hard session on day ' + num(fin.z[0], 2) + ' with a load of ' + num(fin.z[1], 2) + ', inside every rule.',
    math: 'the plan: (t, w) = ' + pr2(fin.z) + ';  the star ' + pr2(best) + at(0.6, '<br>the log settled at u = ' + pr2(fin.u) + ':  ρu = ' + pr2(scale(fin.u, rho)) + ' is the workload rule’s toll'),
    draw: function (g, q) {
      base(g); P.star(g, best, 1, 'the best safe session', { dx: -14, dy: 18, align: 'right' });
      g.path(R.slice(1).map(function (r) { return r.x; }), 'rgba(230,233,238,0.45)', 1.5, seg(q, 0, 0.3), [3, 3]); g.path(R.slice(1).map(function (r) { return r.z; }), 'rgba(169,205,246,0.5)', 1.5, seg(q, 0, 0.3), [3, 3]);
      P.spring(g, fin.x, fin.z, seg(q, 0.3, 0.4)); P.physio(g, fin.z, seg(q, 0.3, 0.45)); P.coach(g, fin.x, seg(q, 0.35, 0.5), 'x = z: one plan', { dx: 14, dy: -16 });
      var tollTip = add(fin.z, scale(fin.u, 0.4)); g.arrow(fin.z, tollTip, LOG, 2.5, seg(q, 0.55, 0.8)); g.label(lerp2(fin.z, tollTip, 0.5), 'the settled log: the rule’s toll', LOG, { dx: 12, dy: -4, p: seg(q, 0.75, 0.9), size: 12 });
      P.lines(g, g.sideR, lastRows.concat([{ text: 'both below ' + num(p.tol, 2) + ': file the plan', col: C.gold }, { text: 'session: day ' + num(fin.z[0], 2) + ', load ' + num(fin.z[1], 2), col: C.gold }]), q, 'The two gauges');
    } });

  // ------------------------------------------------------------ 4. the season
  var s1 = d.sessions[0], crest1 = pr1.crest, free1 = pr1.free, best1 = pr1.best.q;
  out.push({ id: 'trained', chapter: CH.season, title: 'The athlete trains, and the curve moves', layout: 'map+side', view: VIEW, dur: 6.4,
    text: 'The athlete does the session on day ' + num(s1.t, 2) + '. The body answers again: a new dip, a new recovery, and a crest on day ' + num(crest1, 2) + ' that is higher than the last, ' + num(pr1.r(crest1), 2) + ' against ' + num(rCrest, 2) + ', because the fitness of the earlier session is still there. The planning problem is rebuilt from the new curve and the new last session: recovery now says t ≥ ' + num(-rule1('recovery').b, 2) + ', ramp w ≤ ' + num(rule1('ramp').b, 2) + ', workload w ≤ ' + num(p.w0, 0) + ' + ' + num(p.s, 1) + '·(t − ' + num(s1.t, 2) + '); the taper line stays at day ' + num(rule1('taper').b, 0) + '. The map is new, the safe set is new, and the Coach’s favourite moved to ' + plan(free1) + '. The recovery cycle is the outer loop; the negotiation is the inner one.',
    math: 'history: day 0 (load ' + num(last.w, 1) + '), day ' + num(s1.t, 2) + ' (load ' + num(s1.w, 2) + ')' + at(0.5, '<br>new rules: t ≥ ' + num(-rule1('recovery').b, 2) + ',  w ≤ ' + num(rule1('ramp').b, 2) + ',  w ≤ ' + num(p.w0, 0) + ' + ' + num(p.s, 1) + '·(t − ' + num(s1.t, 2) + '),  t ≤ ' + num(rule1('taper').b, 0)),
    draw: function (g, q) {
      g.land(pr1.J, shade1); P.axes(g, 'day of the session →', '↑ load');
      P.polygon(g, pr.poly.verts, { p: seg(q, 0.05, 0.2), fill: false, dash: [4, 4], col: 'rgba(169,205,246,0.45)' });
      g.dot([s1.t, s1.w], 6, C.gold, seg(q, 0.05, 0.2)); g.label([s1.t, s1.w], 'session 1, done', C.gold, { dx: -12, dy: 18, align: 'right', p: seg(q, 0.1, 0.25), size: 12 });
      P.polygon(g, pr1.poly.verts, { p: seg(q, 0.35, 0.55) }); g.label([8.8, 1.6], 'the new safe set', PHYSIO, { align: 'center', p: seg(q, 0.5, 0.65), size: 12 });
      P.coach(g, free1, seg(q, 0.65, 0.8), 'the new favourite ' + plan(free1), { dx: -14, dy: 18, align: 'right' }); P.star(g, best1, seg(q, 0.8, 0.95), 'the next best safe session', { dx: 0, dy: 22, align: 'center' });
      P.curvePanel(g, g.sideR, { r: pr1.r, rOld: pr.r, old: 'before session 1', oldAt: 9.5, t: [0, 12], v: [0.3, 1.8], p: q, title: 'readiness, with session 1 done', r0: p.r0, from: 0.3, to: 0.7,
        sessions: [{ t: 0, w: last.w, text: 'day 0' }, { t: s1.t, w: s1.w, text: 'day ' + num(s1.t, 2) }], marks: [{ t: crest1, text: 'new crest ' + num(pr1.r(crest1), 2) + ' on day ' + num(crest1, 2), at: 0.62, side: 'left' }] });
    } });

  var xs1 = R1.map(function (r) { return r.x; }), zs1 = R1.map(function (r) { return r.z; }), n1 = R1.length - 1, fin1 = S1.final, nextRec = third ? third.prob.rules.filter(function (r) { return r.id === 'recovery'; })[0] : null;
  out.push({ id: 'next', chapter: CH.season, title: 'The next negotiation', layout: 'map+side', view: around(xs1.concat(zs1).concat([best1]), 0.6, 3.5), dur: 6.4,
    text: 'The same four moves on the new map, from the Coach’s new favourite. In ' + n1 + ' rounds both gauges are below ' + num(p.tol, 2) + ' and the two put their names to z = ' + plan(fin1.z) + ': a hard session on day ' + num(fin1.z[0], 2) + ' with a load of ' + num(fin1.z[1], 2) + ', on the workload line, ' + num(rule1('taper').b - fin1.z[0], 1) + ' days before the taper. Then the rules close the window: the next hard session could not come before day ' + (nextRec ? num(-nextRec.b, 2) : '—') + ', after the taper has begun. The next thing on the calendar is the race.',
    math: 'plan 2: ' + pr2(fin1.z) + ' after ' + n1 + ' rounds' + at(0.6, ';  plan 3: recovery t ≥ ' + (nextRec ? num(-nextRec.b, 2) : '—') + ' and taper t ≤ ' + num(rule1('taper').b, 0) + ' leave no safe session: the race'),
    draw: function (g, q) {
      g.land(pr1.J, shade1); P.axes(g, 'day of the session →', '↑ load'); P.polygon(g, pr1.poly.verts); P.star(g, best1, 1);
      var s = seg(q, 0.05, 0.85) * n1, kk = Math.floor(s), f2 = s - kk;
      g.path(xs1.slice(0, kk + 1).concat(kk < n1 ? [lerp2(xs1[kk], xs1[kk + 1], ease(f2))] : []), 'rgba(230,233,238,0.8)', 2, 1);
      g.path(zs1.slice(0, kk + 1).concat(kk < n1 ? [lerp2(zs1[kk], zs1[kk + 1], ease(f2))] : []), PHYSIO, 2, 1);
      for (var m = 1; m <= Math.min(kk, n1); m++) { g.dot(xs1[m], 3, COACH, 1); g.dot(zs1[m], 3, PHYSIO, 1); }
      var hx = kk < n1 ? lerp2(xs1[kk], xs1[kk + 1], ease(f2)) : xs1[n1], hz = kk < n1 ? lerp2(zs1[kk], zs1[kk + 1], ease(f2)) : zs1[n1];
      P.spring(g, hx, hz, 1); P.physio(g, hz, 1); P.coach(g, hx, 1, kk >= n1 ? 'plan 2: ' + plan(fin1.z) : '', { dx: 14, dy: -16 }); g.labelPx(g.mapR[0] + 12, g.mapR[1] + 30, 'round ' + Math.min(kk, n1), C.gold, { size: 13 });
      P.gaugePanel(g, g.sideR, R1, q, { upto: s / n1, tol: p.tol });
    } });

  var calSessions = [{ t: 0, w: last.w, text: 'day 0: ' + num(last.w, 1), col: C.dim }].concat(d.sessions.map(function (s, i) { return { t: s.t, w: s.w, text: 'day ' + num(s.t, 2) + ': ' + num(s.w, 2) }; }));
  out.push({ id: 'block', chapter: CH.season, title: 'The block, and the line to remember', layout: 'side', dur: 6,
    text: 'The season so far: the last hard session on day 0, the two negotiated sessions on days ' + num(d.sessions[0].t, 2) + ' and ' + num(d.sessions[1].t, 2) + ', the taper, and the race on day ' + p.race + '. Every session was chosen the same way, and the way fits in one line. The curve tempts, the Physio constrains, the tether coordinates, and the planning log makes every unresolved disagreement return.',
    math: 'outer loop: train → measure → rebuild the curve and the rules → negotiate → train' + at(0.6, '<br>inner loop: aim → the Coach’s step → the Physio’s step → the log, until both gauges are small'),
    draw: function (g, q) { P.calendar(g, g.sideR, { race: p.race, taper: p.taper, sessions: calSessions, p: q, title: 'the training block' }); } });

  // ------------------------------------------------------------ 5. the same four moves elsewhere
  out.push({ id: 'bridge', chapter: CH.bridge, title: 'What this shares with a decoder', layout: 'side', dur: 6,
    text: 'The pattern is the one of the Twins in the King’s Land and of SAPPHIRE’s receiver. One shared unknown has two copies: one that minimises a cost and never looks at the constraints, one that is projected onto the constraint set and never looks at the cost. A tether of stiffness ρ ties the copies, and a log of signed disagreement shifts the aim. Here the copies are a training plan, the cost is minus the training benefit, and the set is a polygon of safety rules. In a decoder the copies are the bits of a codeword, the cost is the misfit to what was received, and the set is the parity rules. The four moves are the same; only the cost and the set change.',
    math: 'aim v = z − u  →  x = argmin J + ρ/2·|x − v|²  →  z = Π<sub>C</sub>(x + u)  →  u ← u + x − z',
    draw: function (g, q) { var RR = P.split(g.sideR, 0.5); P.lines(g, RR[0], [{ text: 'the unknown: a plan (t, w)', col: C.gold }, { text: 'the cost: minus the training benefit', col: COACH }, { text: 'the set: four safety rules, a polygon', col: PHYSIO }, { text: 'the projection: the nearest safe plan', col: PHYSIO }], q, 'Here'); P.lines(g, RR[1], [{ text: 'the unknown: the bits of a codeword', col: C.gold }, { text: 'the cost: the misfit to what was received', col: COACH }, { text: 'the set: the parity rules', col: PHYSIO }, { text: 'the projection: onto each parity rule', col: PHYSIO }], q, 'In a decoder'); } });

  out.push({ id: 'differences', chapter: CH.bridge, title: 'What is different', layout: 'side', dur: 5.6,
    text: 'Two unknowns here against thousands in a decoder, so the Coach can scan every day; a decoder cannot scan every codeword and takes a few taps of the staff instead. The rules here are four lines, so the Physio’s step is exact and cheap; parity rules are many, each with its own copy and its own log. And there is no cyclic redundancy check for a training plan: the test comes later, when the athlete trains and the next measurement says whether the curve was right.',
    math: 'same four moves;  different cost, set, size, and test',
    draw: function (g, q) { var RR = P.split(g.sideR, 0.5); P.lines(g, RR[0], [{ text: 'two unknowns: scan every day', col: COACH }, { text: 'four rules: one exact projection', col: PHYSIO }, { text: 'one log for the one plan', col: LOG }, { text: 'the test: the next measurement', col: C.gold }], q, 'The plan'); P.lines(g, RR[1], [{ text: 'thousands of bits: a few taps', col: COACH }, { text: 'many parity rules: one copy each', col: PHYSIO }, { text: 'one log per copy', col: LOG }, { text: 'the test: syndrome and CRC', col: C.gold }], q, 'The decoder'); } });

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
  window.course = { steps: out, chapters: chapters, plan: d };
  var hash = (window.location && window.location.hash) || '', ms = /step=([^&]+)/.exec(hash), mp = /p=([0-9.]+)/.exec(hash);
  if (ms) { var st = decodeURIComponent(ms[1]); B.debug({ step: /^\d+$/.test(st) ? +st : st, p: mp ? +mp[1] : 1 }); }
})();
