// "The Coach and the Physio": an athlete's next hard session, planned as optimization with constraints and
// negotiated with ADMM.  The Coach (x) scores sessions from the readiness curve and never looks at the rules; the
// Physio (z) keeps the rules and never reads the curve; a tether (rho) ties their plans and the planning log (u)
// remembers their disagreement.  The story reads the resulting readiness curve against a slam-dunk line p.dunk; that
// line is not part of the Coach's one-session objective.  Told on the player of the King's Land tutorials (board.js),
// with the case and the solver from plan.js and the drawings from plan_parts.js.
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
  // one toy load unit is 500 kg of repetition volume.  At the fixed five sets of five used throughout this story,
  // the corresponding mass on the bar is 500w/25 = 20w kg
  var SETS = 5, REPS = 5, UNIT_KG = 500, KG_PER_UNIT = UNIT_KG / (SETS * REPS), WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  function barKg(w) { return Math.round(w * KG_PER_UNIT); }
  function lifted(w) { return Math.round(w * UNIT_KG) + ' kg'; }
  function squats(w) { return WORDS[SETS] + ' sets of ' + WORDS[REPS] + ' squats with ' + barKg(w) + ' kg'; }
  function rule(id) { return rules.filter(function (r) { return r.id === id; })[0]; }
  function rule1(id) { return pr1.rules.filter(function (r) { return r.id === id; })[0]; }
  function plan(q) { return '(' + num(q[0], 2) + ' d, ' + num(q[1], 2) + ')'; }
  function pr2(q) { return pair(q, 2); }
  function shadeOf(prob, id) {
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i <= 40; i++) for (var j = 0; j <= 40; j++) { var val = prob.J([VIEW[0] + (VIEW[1] - VIEW[0]) * i / 40, VIEW[2] + (VIEW[3] - VIEW[2]) * j / 40]); if (val < lo) lo = val; if (val > hi) hi = val; }
    return { lo: lo, hi: Math.max(-lo, 0.5), id: id, rings: 12 };   // centred on zero cost: negative benefit brown, positive benefit blue
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
  // the staircase to the dunk: the season's three sessions, their crests, the first day of the dunk, and two plans
  // that do worse: a second session on day 1 (too soon) and sessions seven days apart (too seldom)
  var hist = d.history, rAll = N.readiness(hist, p), dunkDay = N.reach(rAll, p.dunk, 0, p.race), rGame = rAll(p.race);
  function crestAfter(r, t0, t1) { return N.argmin1(function (t) { return -r(t); }, t0, t1).t; }
  var r1 = pr.r, r12 = N.readiness(hist.slice(0, 2), p), crest2 = crestAfter(r12, hist[1].t, p.race), crest3 = crestAfter(rAll, hist[2].t, p.race);
  var soon = N.readiness([hist[0], { t: 1, w: hist[0].w }], p), rSoon = soon(1 + 1e-6), rBeforeSoon = r1(1);
  var weekly = N.readiness([hist[0], { t: 7, w: p.ramp * hist[0].w }], p), weeklyDunk = N.reach(weekly, p.dunk, 0, p.race);
  var rate0 = last.w / p.wRef * (p.k2 / p.tau2 - p.k1 / p.tau1);   // how fast readiness climbs right after the session
  function climb(t) { return clamp(last.w / p.wRef * (p.k2 / p.tau2 * Math.exp(-t / p.tau2) - p.k1 / p.tau1 * Math.exp(-t / p.tau1)) / rate0, 0, 1); }

  out.push({ id: 'target', chapter: CH.athlete, title: 'The target: reach the dunk line', layout: 'side', dur: 7,
    text: 'An athlete wants to slam dunk at the game on day ' + p.race + '. Call the rested jump 1 and draw the dunk line at ' + num(p.dunk, 1) + '. ' +
      'A hard session first knocks the jump down, then leaves a rebound. Stack the sessions well and the rebounds climb like stairs toward the rim. ' +
      'The planning question is simple: when should the next session happen, and how heavy should it be? ' +
      'The dunk line is the destination, not the Coach’s ruler. The Coach scores one next session at a time; after each choice, we watch whether the growing staircase reaches the line and where it stands on game day. ' +
      'Soon the job will split in two: the Coach knows what scores well, the Physio knows what is allowed, and ADMM helps them agree on one plan.',
    math: 'the story’s destination: rested r = 1  →  dunk line r = ' + num(p.dunk, 1) + ' by game day ' + p.race + at(0.58, '<br>the choice made now: one next session (day t, load w)') + at(0.8, '<br>ADMM’s job: make the Coach’s choice and the Physio’s allowed choice become the same plan'),
    draw: function (g, q) {
      var jq = seg(q, 0.04, 0.34), h = 4 * jq * (1 - jq);   // one rested jump, up and down
      P.courtPanel(g, g.sideR, { h: h, rim: p.dunk, rimP: seg(q, 0.44, 0.58), today: 1, todayP: seg(q, 0.17, 0.22), todayLabelP: seg(q, 0.34, 0.44), gapP: seg(q, 0.62, 0.76), questionP: seg(q, 0.8, 0.95), title: 'the rested jump against the rim' });
    } });

  var SESSION_FRAC = 0.16, DAYS = 12;   // the first part of the thigh page is the session itself; then twelve days run
  function sessionNote(frac, short) {
    var rep = Math.min(SETS * REPS, Math.floor(frac * SETS * REPS + 1e-9)); if (rep <= 0) return short ? 'day 0: the session' : 'day 0: the session begins';
    var set = Math.floor((rep - 1) / REPS) + 1, inSet = (rep - 1) % REPS + 1;
    return short ? 'set ' + set + '/' + SETS + ', rep ' + inSet + '/' + REPS : 'day 0, the session: set ' + set + ' of ' + SETS + ', rep ' + inSet + ' of ' + REPS;
  }
  out.push({ id: 'muscle', chapter: CH.athlete, title: 'Inside the thigh: tear, clean up, rebuild', layout: 'side', dur: 11,
    text: 'Look inside one fibre of the thigh during the last hard session, on day 0: ' + squats(last.w) + ', ' + lifted(last.w) + ' in all, a load of ' + num(last.w, 0) + '. ' +
      'This is the model told as a body story. Every rep opens another red tear. By the last rep, half the fibre is out of order and the jump has dropped to ' + num(rDip, 2) + '. ' +
      'Then two crews arrive. The grey crew clears the tears quickly. The green crew rebuilds more slowly and leaves the fibre thicker for longer. ' +
      'The ledger beside the fibre keeps those two effects separate: the slow green gain is fitness, and the fast red drop is fatigue. ' +
      'The athlete feels only their total: start from 1, add fitness, subtract fatigue. That total is readiness.',
    math: 'during the session: more reps  →  more tears  →  readiness falls from 1 to ' + num(rDip, 2) + at(0.3, '<br>afterward: fatigue fades fast; fitness fades slowly') + at(0.56, '<br>readiness r(t) = 1 + fitness − fatigue') + at(0.78, '<br>two hidden effects  →  one jump the athlete can feel'),
    draw: function (g, q) {
      var R = g.sideR, inSession = q < SESSION_FRAC, frac = clamp(q / SESSION_FRAC, 0, 1), t = inSession ? 0 : DAYS * (q - SESSION_FRAC) / (1 - SESSION_FRAC);
      var fit = inSession ? fitAmp * frac : fitness(t), fat = inSession ? fatAmp * frac : fatigue(t), r = 1 + fit - fat, torn = Math.max(0, 1 - r), extra = Math.max(0, r - 1);
      var crew = inSession ? 0 : clamp(Math.min(t / 0.3, 1) * torn / (1 - rDip), 0, 1), build = inSession ? 0 : climb(t), tall = R[3] >= 380, roomy = tall && R[2] >= 560;
      var captions = [
        { text: 'each rep opens another red tear', col: C.red, above: true, x: 0.3, p: inSession ? seg(frac, 0.15, 0.4) : clamp(1 - t / 0.5, 0, 1) },
        { text: 'the grey crew clears the tears', col: C.ink, above: !tall, x: 0.5, p: inSession ? 0 : clamp(Math.min(t / 0.3, (1.7 - t) / 0.4), 0, 1) },
        { text: 'the green crew rebuilds the fibre thicker', col: C.green, above: true, x: 0.5, p: clamp(Math.min((t - 1.1) / 0.5, (6.5 - t) / 0.8), 0, 1) },
        { text: 'the rebuilt layer thins slowly', col: C.green, above: !tall, x: 0.5, p: seg(t, 6.6, 7.6) }];
      var note = inSession ? sessionNote(frac, !roomy) : 'day ' + num(t, 1), stat = 'out of order ' + Math.round(torn * 100) + '%  ·  readiness ' + num(r, 2);
      var gaugeW = roomy ? Math.min(132, Math.round(R[2] * 0.2)) : 0, topH = Math.round(R[3] * (tall ? 0.56 : 0.6));
      P.fibrePanel(g, [R[0], R[1], R[2] - (gaugeW ? gaugeW + 8 : 0), topH], { torn: torn, extra: extra, crew: crew, build: build, time: t + frac, title: 'one fibre of the thigh', note: note, stat: stat, captions: captions });
      if (gaugeW) P.sumBar(g, [R[0] + R[2] - gaugeW, R[1], gaugeW, topH], { fit: fit, fat: fat, r: r, top: 1.8, target: p.dunk, title: 'the readiness ledger' });
      P.tracesPanel(g, [R[0], R[1] + topH + 8, R[2], R[3] - topH - 8], { fit: fitness, fat: fatigue, fitAmp: fitAmp, fatAmp: fatAmp, t: [0, DAYS], upto: inSession ? 0 : t, title: 'the two effects, written as the days pass' });
    } });

  out.push({ id: 'curve', chapter: CH.athlete, title: 'What one hard session does in the model', layout: 'side', dur: 7,
    text: 'The Coach now turns that body story into a curve. The last hard session was on day 0: ' + squats(last.w) + ', ' + lifted(last.w) + ' in all. ' +
      'It leaves two echoes: a large tiredness that fades fast and a smaller gain that fades slowly. ' +
      'Put them together and readiness first drops to ' + num(rDip, 2) + ', returns to the rested line on day ' + num(tRested, 2) + ', then rebounds to ' + num(rCrest, 2) + ' on day ' + num(crest, 2) + '. ' +
      'After that, the slow gain fades and the curve drifts back toward 1. ' +
      'That curve tells the Coach which days look promising. It also shows why one session is not enough: its highest point, ' + num(rCrest, 2) + ', still misses the dunk line at ' + num(p.dunk, 1) + '.',
    math: 'fitness = ' + num(fitAmp, 1) + '·e^(−t/' + p.tau1 + '),  fatigue = ' + num(fatAmp, 1) + '·e^(−t/' + p.tau2 + '),  t in days' + at(0.5, '<br>readiness r(t) = 1 + fitness − fatigue') + at(0.8, ':  r(0) = ' + num(rDip, 2) + ',  r(' + num(crest, 2) + ') = ' + num(rCrest, 2)),
    draw: function (g, q) {
      var R = g.sideR, half = Math.round((R[3] - 8) / 2), top = [R[0], R[1], R[2], half], bottom = [R[0], R[1] + half + 8, R[2], R[3] - half - 8];
      P.effectsPanel(g, top, { fit: fitness, fat: fatigue, fitAmp: fitAmp, fatAmp: fatAmp, t: [0, 12], p: seg(q, 0, 0.55), title: 'what one hard session leaves behind' });
      P.curvePanel(g, bottom, { r: pr.r, t: [0, 12], v: [0.3, 1.6], target: p.dunk, targetBelow: true, p: seg(q, 0.45, 1), title: 'readiness = 1 + fitness − fatigue', sessions: [{ t: 0, w: last.w, text: 'the session, day 0' }], from: 0.15, to: 0.55, baseAt: 8, baseBelow: true,
        marks: [{ t: 0.02, text: 'tired: ' + num(rDip, 2), at: 0.55, side: 'right' }, { t: tRested, text: 'rested again, day ' + num(tRested, 2), at: 0.65, side: 'right' }, { t: crest, text: 'the crest: ' + num(rCrest, 2) + ' on day ' + num(crest, 2), at: 0.75 }, { t: 10.5, text: 'back toward 1', at: 0.85, side: 'left' }] });
    } });

  // a curve between two days on a plot, drawn as far as progress q
  function curveBetween(g, pl, fn, t0, t1, col, w, q, dash) {
    if (!(q > 0)) return; var c = g.ctx, n = 140, lastI = Math.round(n * clamp(q, 0, 1));
    c.save(); c.beginPath(); c.rect(pl.box[0], pl.box[1] - 6, pl.box[2], pl.box[3] + 6); c.clip(); c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; if (dash) c.setLineDash(dash); c.beginPath();
    for (var i = 0; i <= lastI; i++) { var t = t0 + (t1 - t0) * i / n, y = clamp(pl.Y(fn(t)), pl.box[1] - 40, pl.box[1] + pl.box[3] + 40); if (i) c.lineTo(pl.X(t), y); else c.moveTo(pl.X(t), y); }
    c.stroke(); c.setLineDash([]); c.restore();
  }
  // the staircase: readiness over the block as the sessions are stacked; o: { p, reveal (one session at a time),
  // compact (points without text, for a small panel), title }
  var T_END = p.race + 0.4, V_LO = 0.3, V_HI = 1.9, DIM_GOLD = 'rgba(255,210,122,0.4)';
  function staircasePanel(g, R, o) {
    var pl = g.plot(R, [0, T_END], [V_LO, V_HI], { title: o.title }), short = pl.box[3] < 200 || o.compact, q = o.p == null ? 1 : o.p;
    pl.frame('day', 'readiness');
    pl.seg(0, 1, T_END, 1, 'rgba(242,245,248,0.45)', 1.2, 1, [5, 4]); g.labelPx(pl.X(p.race) - 10, pl.Y(1) + 12, 'rested 1', C.dim, { align: 'right', size: 11, plain: true });
    pl.seg(0, p.dunk, T_END, p.dunk, C.orange, 1.5, seg(q, 0, 0.08), [6, 4]); g.labelPx(pl.X(0) + 6, pl.Y(p.dunk) - 13, 'story dunk line: ' + num(p.dunk, 1), C.orange, { size: 11.5, plain: true, p: seg(q, 0.02, 0.1) });
    pl.seg(p.race, V_LO, p.race, V_HI, C.red, 1.5, seg(q, 0, 0.08)); g.labelPx(pl.X(p.race) - 6, pl.box[1] + pl.box[3] - 32, 'game, day ' + p.race, C.red, { align: 'right', size: 11.5, plain: true, p: seg(q, 0.02, 0.1) });
    var reveal = o.reveal ? [seg(q, 0.04, 0.3), seg(q, 0.3, 0.56), seg(q, 0.56, 0.78)] : [seg(q, 0, 0.5), seg(q, 0, 0.5), seg(q, 0, 0.5)];
    hist.forEach(function (s, i) {   // the sessions as bars, each when it joins the staircase
      var qq = reveal[i]; if (!(qq > 0)) return; var grow = Math.min(1, qq * 3), top = V_LO + 0.16 * s.w / 5 * (V_HI - V_LO) * grow; pl.seg(s.t, V_LO, s.t, top, C.gold, 6, 1);
      if (!short) g.labelPx(pl.X(s.t) + 7, pl.Y(top) - 9, 'day ' + num(s.t, i ? 2 : 0) + ': ' + barKg(s.w) + ' kg', C.gold, { size: 11, plain: true, p: grow });
    });
    [r1, r12, rAll].forEach(function (r, i) {   // one session, then two, then three; the tails of the earlier curves stay dim
      var qq = reveal[i]; if (!(qq > 0)) return; var lastOne = i === 2 || !(reveal[i + 1] > 0); curveBetween(g, pl, r, 0, T_END, lastOne ? C.gold : DIM_GOLD, lastOne ? 2.6 : 1.6, qq);
    });
    function mark(t, v, text, side, below, qq, col, always) {
      if (!(qq > 0)) return; pl.point(t, v, col || C.gold, '', qq);
      if (text && (always || !short)) g.labelPx(pl.X(t) + (side < 0 ? -10 : 10), pl.Y(v) + (below ? 14 : -13), text, col || C.gold, { size: 11.5, align: side < 0 ? 'right' : 'left', p: seg(qq, 0.4, 1) });
    }
    var m1 = o.reveal ? seg(q, 0.24, 0.3) : seg(q, 0.5, 0.6), m2 = o.reveal ? seg(q, 0.5, 0.56) : seg(q, 0.6, 0.7), m3 = o.reveal ? seg(q, 0.72, 0.78) : seg(q, 0.7, 0.8);
    mark(crest, rCrest, 'crest ' + num(rCrest, 2) + ': not enough', -1, false, m1);
    mark(dunkDay, p.dunk, 'first crossing: day ' + num(dunkDay, 2), 1, true, m2, C.orange, true);
    mark(crest2, r12(crest2), 'crest ' + num(r12(crest2), 2), 1, false, m2);
    mark(crest3, rAll(crest3), 'crest ' + num(rAll(crest3), 2), -1, false, m3);
    mark(p.race, rGame, '', 1, false, m3);
    g.labelPx(pl.X(p.race) - 6, pl.box[1] + pl.box[3] - 48, 'r(' + p.race + ') = ' + num(rGame, 2), C.red, { align: 'right', size: 11.5, plain: true, p: m3 });
    return pl;
  }
  // a smaller plan beside the staircase: its curve against the plan's, with one mark; o: { r, t1, col, p, mark: [t, v], text, below, title }
  function miniPlan(g, R, o) {
    var pl = g.plot(R, [0, T_END], [V_LO, V_HI], { title: o.title }); pl.frame('day', '');
    pl.seg(0, p.dunk, T_END, p.dunk, C.orange, 1.2, 1, [6, 4]);
    curveBetween(g, pl, rAll, 0, T_END, 'rgba(255,210,122,0.35)', 1.4, 1); curveBetween(g, pl, o.r, 0, o.t1, o.col, 2.2, o.p);
    if (o.p >= 1 && o.mark) { pl.point(o.mark[0], o.mark[1], o.col, '', 1); g.labelPx(pl.box[0] + 6, pl.box[1] + 10, o.text, o.col, { size: 11.5, plain: true }); }
    return pl;
  }
  out.push({ id: 'stairs', chapter: CH.athlete, title: 'Stacking sessions: the staircase to the dunk', layout: 'side', dur: 12,
    text: 'One rebound is not high enough. But its slow green gain is still there when the next session arrives, so the next rebound starts from a higher floor. ' +
      'The three sessions make a staircase: the crests rise from ' + num(rCrest, 2) + ' to ' + num(r12(crest2), 2) + ' to ' + num(rAll(crest3), 2) + '. The curve first reaches the dunk line on day ' + num(dunkDay, 2) + '. A later hard session makes another dip and rebound, and readiness is ' + num(rGame, 2) + ' on game day. ' +
      'Timing matters. Put the second session on day 1 and the immediate dip reaches ' + num(rSoon, 2) + '; that day is outside the Physio’s allowed set. Wait until day 7 and the curve does not reach the dunk line until day ' + num(weeklyDunk, 2) + '. ' +
      'The picture gives us the destination, but ADMM is not solving “reach the line as fast as possible.” It solves the smaller problem we need next: choose one session that scores well and obeys every rule. File it, rebuild the staircase, and choose again.',
    math: 'three sessions  →  crests ' + num(rCrest, 2) + '  →  ' + num(r12(crest2), 2) + '  →  ' + num(rAll(crest3), 2) + at(0.5, '<br>first dunk-line crossing: day ' + num(dunkDay, 2) + ';  readiness on game day: ' + num(rGame, 2)) +
      at(0.78, '<br>too early: post-session r = ' + num(rSoon, 2) + ';  too late: first crossing on day ' + num(weeklyDunk, 2)) + at(0.92, '<br>ADMM chooses one next session; the staircase is the result of repeating that choice'),
    draw: function (g, q) {
      var R = g.sideR, tall = R[3] >= 380 && R[2] >= 560, mainH = tall ? Math.round(R[3] * 0.64) : R[3];
      staircasePanel(g, [R[0], R[1], R[2], mainH], { p: seg(q, 0, 0.8), reveal: true, title: 'the model run: three recorded sessions' });
      if (!tall) return;   // on a phone the two other plans are told in the text
      var half = Math.round((R[2] - 8) / 2), y2 = R[1] + mainH + 8, h2 = R[3] - mainH - 8;
      miniPlan(g, [R[0], y2, half, h2], { r: soon, t1: 3.5, col: C.red, p: seg(q, 0.8, 0.9), mark: [1, rSoon], text: 'after day-1 session: r = ' + num(rSoon, 2), title: 'earlier: a second session on day 1' });
      miniPlan(g, [R[0] + half + 8, y2, R[2] - half - 8, h2], { r: weekly, t1: T_END, col: C.violet, p: seg(q, 0.88, 1), mark: [weeklyDunk, p.dunk], text: 'first crossing on day ' + num(weeklyDunk, 2), title: 'later: put the next session on day 7' });
    } });

  out.push({ id: 'score', chapter: CH.athlete, title: 'The Coach’s proxy: score one next session', layout: 'side', dur: 7,
    text: 'The Coach chooses two things: the session’s day t on the calendar and its load w. Every session is five sets of five, so one load unit means ' + UNIT_KG + ' kg lifted in all, or ' + KG_PER_UNIT + ' kg on the bar. ' +
      'Now give the Coach a simple ruler. Read readiness before the planned session. Above ' + num(p.r0, 1) + ', the reps help; below ' + num(p.r0, 1) + ', they do harm. So one load unit is worth r(t) − ' + num(p.r0, 1) + ', and w units earn the gain w × (r(t) − ' + num(p.r0, 1) + '). ' +
      'But that alone would always say “more weight.” We need a brake. As the session gets heavier, its later reps land on a thigh already tired by the earlier ones, so the price grows as ' + num(p.a, 2) + '·w². ' +
      'The gain rises like a straight line while the price bends upward. Their gap therefore has one best load. ' +
      'On day ' + num(crest, 2) + ' each unit is worth ' + num(rCrest, 3) + ' − ' + num(p.r0, 1) + ' = ' + num(worth, 3) + ', so load ' + exLoad + ', ' + squats(exLoad) + ', gains ' + num(exGain, 2) + ', pays ' + num(exPrice, 2) + ' and leaves a benefit of ' + num(exGain - exPrice, 2) + '. ' +
      'The benefit is the gap between gain and price; on this day the Coach’s favourite by this proxy is load ' + num(free[1], 2) + ', ' + barKg(free[1]) + ' kg on the bar, where the benefit is ' + num(-pr.freeJ, 2) + '.',
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
      'The best session is then the lowest ground: blue ground is a big modeled benefit, grey a small one, and brown a negative one. ' +
      'Keep the load at ' + num(free[1], 2) + ' and move the day, along the gold line: too soon, the readiness multiplier is smaller and the score can be negative; too late, the crest has passed and the session gains less. ' +
      'Keep the day at ' + num(crest, 2) + ' and change the load, along the violet line: too light gains little, and too heavy strains more than it gains. ' +
      'The lowest point is the Coach’s favourite, x̂: day ' + num(free[0], 2) + ', load ' + num(free[1], 2) + ', ' + barKg(free[1]) + ' kg on the bar, a benefit of ' + num(-pr.freeJ, 2) + '.',
    math: 'cost J(t, w) = − benefit = −w·(r(t) − ' + num(p.r0, 1) + ') + ' + num(p.a, 2) + '·w²' + at(0.75, '<br>lowest at x̂ = ' + pr2(free) + ':  J = ' + num(pr.freeJ, 2) + ', a benefit of ' + num(-pr.freeJ, 2)),
    draw: function (g, q) {
      base(g, { poly: false }); P.costKey(g, seg(q, 0.02, 0.15));
      g.line([VIEW[0], free[1]], [VIEW[1], free[1]], C.gold, 1.5, seg(q, 0.12, 0.3), [6, 4]);
      g.line([crest, VIEW[2]], [crest, VIEW[3]], C.violet, 1.5, seg(q, 0.45, 0.62), [6, 4]);
      [[soonQ, 'too soon: negative score', { dx: -4, dy: 24 }, 0.28], [lateQ, 'too late', { dx: 0, dy: 20, align: 'center' }, 0.36], [lightQ, 'too light', { dx: 12, dy: 0 }, 0.6]].forEach(function (e) {
        var qq = seg(q, e[3], e[3] + 0.1), o = e[2]; g.dot(e[0], 5, C.ink, qq); g.label(e[0], e[1] + ' (' + (benefitAt(e[0]) >= 0 ? '+' : '−') + num(Math.abs(benefitAt(e[0])), 2) + ')', C.ink, { dx: o.dx, dy: o.dy, align: o.align, p: qq, size: 12 });
      });
      g.halo(free, 16, C.gold, seg(q, 0.82, 0.95), 1.5); P.coach(g, free, seg(q, 0.82, 0.95), 'x̂, the lowest point (+' + num(-pr.freeJ, 2) + ')', { dx: 16, dy: -22 });
      var parts = P.split(g.sideR, 0.5);
      var pa = g.plot(parts[0], [0, 12], [-3.4, 4], { title: 'gold line: load ' + num(free[1], 2) + ', the day moves' }), shortA = pa.box[3] < 130;
      pa.frame(shortA ? 'day' : 'day of the session', shortA ? '' : 'cost J'); pa.seg(0, 0, 12, 0, 'rgba(242,245,248,0.4)', 1.2, seg(q, 0.12, 0.2), [4, 4]);
      pa.curve(costAlongDay, C.gold, 2.4, seg(q, 0.15, 0.4));
      pa.point(soonQ[0], costAlongDay(soonQ[0]), C.ink, 'too soon', seg(q, 0.3, 0.38)); pa.point(lateQ[0], costAlongDay(lateQ[0]), C.ink, 'too late', seg(q, 0.36, 0.44), 'left');
      pa.point(crest, pr.freeJ, C.gold, 'lowest: x̂', seg(q, 0.84, 0.95));
      var pb = g.plot(parts[1], [0, 16], [-3.4, 1.4], { title: 'violet line: day ' + num(crest, 2) + ', the load changes' }), shortB = pb.box[3] < 130;
      pb.frame(shortB ? 'load' : 'load of the session', shortB ? '' : 'cost J'); pb.seg(0, 0, 16, 0, 'rgba(242,245,248,0.4)', 1.2, seg(q, 0.45, 0.52), [4, 4]);
      pb.curve(costAlongLoad, C.violet, 2.4, seg(q, 0.48, 0.72));
      pb.point(lightQ[1], costAlongLoad(lightQ[1]), C.ink, 'too light', seg(q, 0.6, 0.68)); pb.point(heavyLoad, costAlongLoad(heavyLoad), C.ink, 'too heavy', seg(q, 0.68, 0.76), 'left');
      pb.point(free[1], pr.freeJ, C.gold, 'lowest: x̂', seg(q, 0.84, 0.95));
    } });

  var ruleRows = [
    { id: 'recovery', label: 'recovery: t ≥ ' + num(rule('recovery').b * -1, 0), at: 0.82, dx: 8, align: 'left' },
    { id: 'ramp', label: 'ramp: w ≤ ' + num(rule('ramp').b, 1), at: 0.68, dy: -14 },
    { id: 'workload', label: 'workload: w ≤ ' + num(p.w0, 0) + ' + ' + num(p.s, 1) + '·t', at: 0.5, dx: -12, dy: -6, align: 'right' },
    { id: 'taper', label: 'taper: t ≤ ' + num(rule('taper').b, 0), at: 0.9, dx: -8, align: 'right' },
    { id: 'load', label: 'load: w ≥ 0', at: 0.3, dy: -13 }];
  out.push({ id: 'rules', chapter: CH.athlete, title: 'The Physio’s rules: the allowed plans', layout: 'map', view: VIEW, dur: 6.4,
    text: 'The Physio reads the same plan against four club rules. Recovery: at least ' + p.recovery + ' days after the last hard session. Ramp: at most ' + Math.round((p.ramp - 1) * 100) + '% more load than last time, so w ≤ ' + num(rule('ramp').b, 1) + ': ' + barKg(rule('ramp').b) + ' kg on the bar instead of ' + barKg(last.w) + '. Workload: the load cap grows with the rest taken, w ≤ ' + num(p.w0, 0) + ' + ' + num(p.s, 1) + '·t. Taper: no hard session in the last ' + p.taper + ' days before the game on day ' + p.race + '. Add the obvious boundary that load cannot be negative. Each rule is a line with a forbidden side. The plans that obey all five boundaries form the allowed set C, the blue polygon. The Coach’s favourite lies outside C: it asks for too much load for the rest taken.',
    math: 't ≥ ' + num(-rule('recovery').b, 0) + ',  w ≤ ' + num(rule('ramp').b, 1) + ',  w ≤ ' + num(p.w0, 0) + ' + ' + num(p.s, 1) + '·t,  t ≤ ' + num(rule('taper').b, 0) + ',  w ≥ 0' + at(0.8, ';  C: all five at once.  x̂ = ' + pr2(free) + ' breaks the ramp and workload rules'),
    draw: function (g, q) {
      base(g, { poly: false });
      ruleRows.forEach(function (rr, i) { P.ruleLine(g, rule(rr.id), seg(q, 0.04 + 0.14 * i, 0.18 + 0.14 * i), { label: rr.label, at: rr.at, dx: rr.dx, dy: rr.dy, align: rr.align }); });
      P.polygon(g, pr.poly.verts, { p: seg(q, 0.74, 0.92) }); g.label([7.2, 2.6], 'C, the allowed plans', PHYSIO, { align: 'center', p: seg(q, 0.84, 1), size: 12.5 });
      P.coach(g, free, 1, 'x̂: outside C', { dx: 16, dy: -14 });
    } });

  var physioHome = [8.4, 3.4];
  out.push({ id: 'one', chapter: CH.athlete, title: 'One athlete, one next session', layout: 'map', view: VIEW, dur: 5.6,
    text: 'Only one session will happen, so the athlete needs one plan that is both high-scoring and allowed: the gold star inside C, day ' + num(best[0], 2) + ' with load ' + num(best[1], 2) + ', ' + squats(best[1]) + '. But those two parts need different skills. The Coach can score plans but ignores the rules. The Physio can enforce the rules but never reads the score. ' +
      'So we make two complete copies of the same plan. The Coach carries x = (day, load), and the Physio carries z = (day, load). The Coach does not own the day while the Physio owns the load; each carries both numbers. We duplicate the plan only to split the two jobs, then require the copies to agree. The athlete gets a session when x and z name the same day and load.',
    math: 'split problem: minimise J(x), subject to z in C and x = z' + at(0.5, '<br>the Coach updates the full copy x;  the Physio updates the full copy z') + at(0.78, '<br>at agreement, both copies name the one plan'),
    draw: function (g, q) {
      base(g); P.star(g, best, seg(q, 0, 0.2), 'the best allowed session ' + plan(best), { dx: -14, dy: 18, align: 'right' });
      P.coach(g, free, seg(q, 0.25, 0.4), 'the Coach scores plans', { dx: 16, dy: -14 }); P.physio(g, physioHome, seg(q, 0.4, 0.55), 'the Physio keeps the rules', { dx: 16, dy: 16 });
      g.line(free, best, AIM, 1.5, seg(q, 0.6, 0.8), [5, 4]); g.line(physioHome, best, AIM, 1.5, seg(q, 0.6, 0.8), [5, 4]);
      g.label([7.0, 6.2], 'both must end on the star', AIM, { align: 'center', p: seg(q, 0.8, 1), size: 12 });
    } });

  // ------------------------------------------------------------ 2. the Coach and the Physio
  var introView = around([free, freeZ, best], 1.2, 5), walk = flow(pr, [7.2, 9.2]);
  out.push({ id: 'coach-role', chapter: CH.pair, title: 'Meet the Coach: x', layout: 'map', view: introView, dur: 5.4,
    text: 'The Coach’s job: find the lowest point of whatever it is asked to minimise. Asked about its own cost alone, it reads the curve, walks downhill to the crest and loads up: x̂ = ' + plan(free) + ', the darkest spot of the map, J = ' + num(pr.freeJ, 2) + '. Read x̂ as “x-hat”: the Coach’s own x, where it stops when nothing pulls on it. It never looks at the rules, and x̂ breaks two of them: no use to the athlete on its own. But add any pull to the map, and the Coach will find the new lowest point just as surely. That is the skill the club hired.',
    math: 'the Coach: x = argmin J(x) + (whatever pulls on it)' + at(0.6, ';  with nothing pulling: x̂ = ' + pr2(free) + ', outside C'),
    draw: function (g, q) {
      base(g); P.star(g, best, 1);
      var s = seg(q, 0.1, 0.7), pos = along(walk, s); g.path(walk, 'rgba(230,233,238,0.55)', 2, s, [4, 4]);
      P.coach(g, pos, 1, s >= 1 ? 'x̂, the lowest point of all' : '', { dx: 16, dy: -14 });
      g.label(free, 'outside C: breaks the ramp and workload rules', C.red, { dx: 16, dy: 16, p: seg(q, 0.75, 0.95), size: 12 });
    } });

  var samples = [[7.6, 4.0], [8.6, 7.3], free].map(function (q0) { return { q: q0, z: N.project(pr.poly, pr.rules, q0) }; });
  out.push({ id: 'physio-role', chapter: CH.pair, title: 'Meet the Physio: z', layout: 'map', view: around([free, freeZ, best, samples[1].q], 0.8, 5), dur: 5.8,
    text: 'The Physio’s job: given any plan, step to the nearest allowed plan. That nearest-point move is called projection; it updates z, the Physio’s copy, not x. An allowed plan stays where it is; a plan outside C moves straight to the nearest rule line, at a right angle, or to a corner where two rules meet. Asked about the Coach’s favourite x̂, the Physio answers Π(x̂) = ' + plan(freeZ) + ': the corner of the ramp and workload lines. Allowed, but not the best allowed session: the star is ' + num(freeZ[0] - best[0], 1) + ' days earlier and a little lighter. The Physio never reads the score, so on its own it cannot find the star either.',
    math: 'the Physio: z = Π<sub>C</sub>(any plan), the nearest allowed plan' + at(0.6, ';  Π<sub>C</sub>(x̂) = ' + pr2(freeZ) + ', not the star ' + pr2(best)),
    draw: function (g, q) {
      base(g); P.star(g, best, 1);
      samples.forEach(function (s, i) {
        var qq = seg(q, 0.05 + 0.24 * i, 0.3 + 0.24 * i), moved = len(sub(s.q, s.z)) > 1e-9;
        g.dot(s.q, 5, i === 2 ? COACH : C.ink, seg(qq, 0, 0.3));
        if (moved) { g.arrow(s.q, s.z, PHYSIO, 2.5, seg(qq, 0.3, 0.8)); P.rightAngle(g, s.z, s.q, seg(qq, 0.8, 1)); } else g.halo(s.q, 10, PHYSIO, seg(qq, 0.3, 0.8), 1.5);
        if (qq > 0.7) { g.dot(s.z, 7, PHYSIO, seg(qq, 0.7, 1)); g.label(s.z, i === 2 ? 'Π(x̂): allowed, not best' : moved ? 'nearest allowed plan' : 'already allowed: stays', PHYSIO, { dx: i === 2 ? 12 : 10, dy: i === 2 ? -16 : 14, p: seg(qq, 0.7, 1), size: 12 }); }
      });
      P.coach(g, free, seg(q, 0.55, 0.65), 'x̂', { dx: 14, dy: -12 });
    } });

  var xr = R[1].x, ropeFree = function (q0) { var dq = sub(q0, freeZ); return pr.J(q0) + rho / 2 * (dq[0] * dq[0] + dq[1] * dq[1]); };
  out.push({ id: 'rope', chapter: CH.pair, title: 'Tie them with a tether', layout: 'map', view: around([free, freeZ, xr, best], 0.6, 4.5), dur: 5.8,
    text: 'Tie the two copies together. If the Coach and the Physio name different plans, the tether charges them for the gap. The Coach now balances its own score against the pull toward the Physio, while the Physio still moves to the nearest allowed plan. Each still does only its easy half, but neither can ignore the other. ' +
      'The stiffness ρ = ' + num(rho, 1) + ' says how strongly a gap is charged. With the tether tied to the Physio at z = ' + plan(freeZ) + ', the Coach moves from x̂ to ' + plan(xr) + '. The tether can pull the copies closer, but by itself it cannot remember which disagreement keeps coming back.',
    math: 'the Coach now minimises J(x) + ρ/2·|x − z|²,  ρ = ' + num(rho, 1) + at(0.6, ';  the Physio takes Π<sub>C</sub>(x)'),
    draw: function (g, q) {
      g.land(ropeFree, { id: 'ropeFree', rings: 10 }); P.axes(g, 'day of the session →', '↑ load'); P.polygon(g, pr.poly.verts); P.star(g, best, 1);
      g.dot(freeZ, 7, PHYSIO, 1); g.label(freeZ, 'the Physio, z', PHYSIO, { dx: 12, dy: 16, size: 12 });
      var s = seg(q, 0.55, 0.9), pos = lerp2(free, xr, s);
      P.spring(g, pos, freeZ, seg(q, 0.05, 0.3)); P.coach(g, pos, 1, s >= 1 ? 'pulled to ' + plan(xr) : s <= 0 ? 'the Coach at x̂' : '', { dx: 16, dy: -14 });
    } });

  var nlN = AR.length - 1, nlX = AR.map(function (r) { return r.x; }), nlZ = AR.map(function (r) { return r.z; }), nlEndX = nlX[nlN], nlEndZ = nlZ[nlN], nlGap = AR[nlN].primal;
  var nlGaps = AR.map(function (r) { return r.primal; }), admmGaps = []; for (var ai = 0; ai <= nlN; ai++) admmGaps.push(R[Math.min(ai, K_END)].primal);
  out.push({ id: 'without-ledger', chapter: CH.pair, title: 'The tether pulls, but does not remember', layout: 'map+side', view: around(nlX.concat(nlZ).concat([best]), 0.5, 4), dur: 6.6,
    text: 'First try only the tether and projection, with no log. Each round carries forward the Physio’s latest plan, but throws away the signed gap between the two copies. The same argument therefore returns: the Coach asks for more than the Physio allows, and the Physio pushes back to the workload line. ' +
      'They settle a fixed distance apart. After ' + nlN + ' rounds the gap is still ' + num(nlGap, 2) + ': the Coach at ' + plan(nlEndX) + ', the Physio at ' + plan(nlEndZ) + ', on the rule line but not at the star. Nothing can be handed to the athlete because they never name the same session. The tether feels today’s gap; it does not remember yesterday’s.',
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
    text: 'Now add the missing memory: the log u. At the end of every round it writes down the signed gap, by how much and in which direction the Coach asked for more than the Physio allowed: u ← u + (x − z). Repeated disagreement in one direction piles up; disagreement the other way cancels some of it. ' +
      'Round 1 ended with the Coach at x₁ = ' + plan(x1) + ' and the Physio at z₁ = ' + plan(z1) + ', so the first entry is ' + pr2(sub(x1, z1)) + ': earlier and heavier than allowed. The log reads u₁ = ' + pr2(u1) + '. In the next round that memory shifts both moves: the Coach aims at z − u, and the Physio projects x + u.',
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
    text: 'The log says: you asked for ' + pr2(u1) + ' more than I allowed. So the Physio tells the Coach to aim not at z₁ but past it by the log, the other way: the aim is v₂ = z₁ − u₁ = ' + plan(v) + ', later and lighter than the Physio’s own plan. Why past, and why subtract? The tether’s cost ρ/2·|x − z + u|² is the same number as ρ/2·|x − (z − u)|²: a tether tied to v. A disagreement that repeats is corrected a little harder each round, until the two moving copies meet.',
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
    text: 'Now the Physio moves, with the new x₂ and the start-of-round log u₁ held fixed. It starts from the Coach’s plan plus the log, x₂ + u₁ = ' + pr2(x) + ' + ' + pr2(u1) + ' = ' + pr2(xu) + ', and steps straight to the nearest allowed plan: z₂ = ' + plan(z) + ', on the workload line. Why add the log? The same tether cost, |x − z + u|² = |z − (x + u)|², is smallest at the allowed z nearest x + u.',
    math: '|x − z + u|² = |z − (x + u)|²' + at(0.42, '<br>z₂ = Π<sub>C</sub>(x₂ + u₁)') + at(0.75, ' = Π<sub>C</sub>' + pr2(xu) + ' = ' + pr2(z)),
    draw: function (g, q) {
      base(g); P.coach(g, x, 1, 'x₂', { dx: 12, dy: 14 });
      g.arrow(x, xu, LOG, 2, seg(q, 0.1, 0.35)); g.dot(xu, 5, C.ink, seg(q, 0.3, 0.4)); g.label(xu, 'x₂ + u₁', C.ink, { dx: -10, dy: -14, align: 'right', p: seg(q, 0.35, 0.5) });
      g.line(xu, z, PHYSIO, 2, seg(q, 0.5, 0.75), [5, 4]); P.rightAngle(g, z, xu, seg(q, 0.7, 0.85));
      P.physio(g, z, seg(q, 0.7, 0.85), 'z₂, the nearest allowed plan', { dx: 14, dy: 16 });
    } });

  out.push({ id: 'ledger', chapter: CH.round, title: 'The log, updated', layout: 'map', view: around([z, add(z, u1), add(z, u), x], 1.2, 3.5), dur: 4.6,
    text: 'The Physio writes this round’s gap into the log: u₂ = u₁ + (x₂ − z₂) = ' + pr2(u1) + ' + ' + pr2(gap) + ' = ' + pr2(u) + '. The Coach asked for earlier and heavier again, so the entry grows. A small gap means the two nearly agree. But agreement alone is not enough to stop: the Physio must also have stopped moving. When all is settled, ρu is the rule’s outward toll; the shifted tether pulls the Coach back in the opposite direction.',
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
    text: 'After round ' + K_END + ' the gap is ' + num(fin.primal, 4) + ' and the Physio’s move times ρ is ' + num(fin.dual, 4) + '. Both gauges are below ' + num(p.tol, 2) + ', so the copies agree to the precision we asked for: z' + subscript(K_END) + ' = ' + plan(fin.z) + '. For this toy problem, that plan is within ' + num(len(sub(fin.z, best)), 3) + ' of the separately precomputed best allowed session. ' +
      'Notice what the log achieved. The gap between x and z is now almost zero, so an ordinary tether between the copies would be almost slack. But u is not zero: it keeps the Coach’s aim shifted to z − u, leaving exactly the pull needed to balance the slope that kept dragging the Coach outside. That lasting correction is what the tether alone was missing. ' +
      'The Coach only scored, the Physio only enforced the rules, and the log carried their unresolved disagreement forward. The agreed plan now goes to the athlete: day ' + num(fin.z[0], 2) + ', load ' + num(fin.z[1], 2) + ', ' + squats(fin.z[1]) + '.',
    math: 'the plan: (t, w) = ' + pr2(fin.z) + ';  the star ' + pr2(best) + at(0.6, '<br>the log settled at u = ' + pr2(fin.u) + ':  ρu = ' + pr2(scale(fin.u, rho)) + ' is the workload rule’s toll'),
    draw: function (g, q) {
      base(g); P.star(g, best, 1, 'the best allowed session', { dx: -14, dy: 18, align: 'right' });
      g.path(R.slice(1).map(function (r) { return r.x; }), 'rgba(230,233,238,0.45)', 1.5, seg(q, 0, 0.3), [3, 3]); g.path(R.slice(1).map(function (r) { return r.z; }), 'rgba(169,205,246,0.5)', 1.5, seg(q, 0, 0.3), [3, 3]);
      P.spring(g, fin.x, fin.z, seg(q, 0.3, 0.4)); P.physio(g, fin.z, seg(q, 0.3, 0.45)); P.coach(g, fin.x, seg(q, 0.35, 0.5), 'x ≈ z: one plan', { dx: 14, dy: -16 });
      var tollTip = add(fin.z, scale(fin.u, 0.4)); g.arrow(fin.z, tollTip, LOG, 2.5, seg(q, 0.55, 0.8)); g.label(lerp2(fin.z, tollTip, 0.5), 'the settled log: the rule’s toll', LOG, { dx: 12, dy: -4, p: seg(q, 0.75, 0.9), size: 12 });
      P.lines(g, g.sideR, lastRows.concat([{ text: 'both below ' + num(p.tol, 2) + ': file the plan', col: C.gold }, { text: 'session: day ' + num(fin.z[0], 2) + ', load ' + num(fin.z[1], 2), col: C.gold }]), q, 'The two gauges');
    } });

  // ------------------------------------------------------------ 4. the season
  var s1 = d.sessions[0], crest1 = pr1.crest, free1 = pr1.free, best1 = pr1.best.q;
  out.push({ id: 'trained', chapter: CH.season, title: 'File the session, and the curve moves', layout: 'map+side', view: VIEW, dur: 6.4,
    text: 'The first plan is filed on day ' + num(s1.t, 2) + '. The simulator appends it to the history and rebuilds the deterministic curve: a new dip, a new recovery, and a crest on day ' + num(crest1, 2) + ' that is higher than the last, ' + num(pr1.r(crest1), 2) + ' against ' + num(rCrest, 2) + ', because the earlier slow trace is still there. The planning problem is also rebuilt from the new last session: recovery now says t ≥ ' + num(-rule1('recovery').b, 2) + ', ramp w ≤ ' + num(rule1('ramp').b, 2) + ', workload w ≤ ' + num(p.w0, 0) + ' + ' + num(p.s, 1) + '·(t − ' + num(s1.t, 2) + '); the taper line stays at day ' + num(rule1('taper').b, 0) + '. The map is new, the allowed set is new, and the Coach’s favourite moved to ' + plan(free1) + '. Updating the history is the outer loop; ADMM negotiation is the inner loop.',
    math: 'history: day 0 (load ' + num(last.w, 1) + '), day ' + num(s1.t, 2) + ' (load ' + num(s1.w, 2) + ')' + at(0.5, '<br>new rules: t ≥ ' + num(-rule1('recovery').b, 2) + ',  w ≤ ' + num(rule1('ramp').b, 2) + ',  w ≤ ' + num(p.w0, 0) + ' + ' + num(p.s, 1) + '·(t − ' + num(s1.t, 2) + '),  t ≤ ' + num(rule1('taper').b, 0)),
    draw: function (g, q) {
      g.land(pr1.J, shade1); P.axes(g, 'day of the session →', '↑ load');
      P.polygon(g, pr.poly.verts, { p: seg(q, 0.05, 0.2), fill: false, dash: [4, 4], col: 'rgba(169,205,246,0.45)' });
      g.dot([s1.t, s1.w], 6, C.gold, seg(q, 0.05, 0.2)); g.label([s1.t, s1.w], 'session 1, done', C.gold, { dx: -12, dy: 18, align: 'right', p: seg(q, 0.1, 0.25), size: 12 });
      P.polygon(g, pr1.poly.verts, { p: seg(q, 0.35, 0.55) }); g.label([8.8, 1.6], 'the new allowed set', PHYSIO, { align: 'center', p: seg(q, 0.5, 0.65), size: 12 });
      P.coach(g, free1, seg(q, 0.65, 0.8), 'the new favourite ' + plan(free1), { dx: -14, dy: 18, align: 'right' }); P.star(g, best1, seg(q, 0.8, 0.95), 'the next best allowed session', { dx: 0, dy: 22, align: 'center' });
      P.curvePanel(g, g.sideR, { r: pr1.r, rOld: pr.r, old: 'before session 1', oldAt: 9.5, t: [0, 12], v: [0.3, 1.8], target: p.dunk, p: q, title: 'readiness, with session 1 done', r0: p.r0, from: 0.3, to: 0.7,
        sessions: [{ t: 0, w: last.w, text: 'day 0' }, { t: s1.t, w: s1.w, text: 'day ' + num(s1.t, 2) }], marks: [{ t: crest1, text: 'new crest ' + num(pr1.r(crest1), 2) + ' on day ' + num(crest1, 2), at: 0.62, side: 'left' }] });
    } });

  var xs1 = R1.map(function (r) { return r.x; }), zs1 = R1.map(function (r) { return r.z; }), n1 = R1.length - 1, fin1 = S1.final, nextRec = third ? third.prob.rules.filter(function (r) { return r.id === 'recovery'; })[0] : null;
  out.push({ id: 'next', chapter: CH.season, title: 'The next negotiation', layout: 'map+side', view: around(xs1.concat(zs1).concat([best1]), 0.6, 3.5), dur: 6.4,
    text: 'The same four moves on the new map, from the Coach’s new favourite. In ' + n1 + ' rounds both gauges are below ' + num(p.tol, 2) + ' and the two put their names to z = ' + plan(fin1.z) + '. That is a hard session on day ' + num(fin1.z[0], 2) + ' with a load of ' + num(fin1.z[1], 2) + ', ' + squats(fin1.z[1]) + ', on the workload line, ' + num(rule1('taper').b - fin1.z[0], 1) + ' days before the taper. Then the rules close the window: the next hard session could not come before day ' + (nextRec ? num(-nextRec.b, 2) : '—') + ', after the taper has begun. The next thing on the calendar is the game.',
    math: 'plan 2: ' + pr2(fin1.z) + ' after ' + n1 + ' rounds' + at(0.6, ';  plan 3: recovery t ≥ ' + (nextRec ? num(-nextRec.b, 2) : '—') + ' and taper t ≤ ' + num(rule1('taper').b, 0) + ' leave no allowed session: the game'),
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

  var calSessions = [{ t: 0, w: last.w, text: 'day 0: ' + barKg(last.w) + ' kg', col: C.dim }].concat(d.sessions.map(function (s, i) { return { t: s.t, w: s.w, text: 'day ' + num(s.t, 2) + ': ' + barKg(s.w) + ' kg' }; }));
  out.push({ id: 'block', chapter: CH.season, title: 'The block, and the line to remember', layout: 'side', dur: 6,
    text: 'The season so far: the last hard session on day 0, the two negotiated sessions on days ' + num(d.sessions[0].t, 2) + ' and ' + num(d.sessions[1].t, 2) + ', the taper, and the game on day ' + p.race + '. The curve first reaches the story’s dunk line on day ' + num(dunkDay, 2) + ' and stands at ' + num(rGame, 2) + ' on game day. Every session was chosen the same way, and the ADMM lesson fits in one line. The curve tempts, the Physio constrains, the tether coordinates, and the planning log makes every unresolved disagreement return.',
    math: 'outer loop: file one session → append it to history → rebuild the curve and rules → negotiate the next session' + at(0.6, '<br>inner loop: aim → the Coach’s step → the Physio’s step → the log, until both gauges are small'),
    draw: function (g, q) { var RR = P.split(g.sideR, 0.5); P.calendar(g, RR[0], { race: p.race, taper: p.taper, sessions: calSessions, p: seg(q, 0, 0.6), title: 'the training block' }); staircasePanel(g, RR[1], { p: seg(q, 0.2, 1), compact: true, title: 'the staircase to the dunk' }); } });

  // ------------------------------------------------------------ 5. the same four moves elsewhere
  out.push({ id: 'bridge', chapter: CH.bridge, title: 'What this shares with a decoder', layout: 'side', dur: 6,
    text: 'The same split appears in a decoder, but it is repeated many times. The decoder keeps one shared set of soft bit values b. Every parity check a also keeps a local replica z<sub>a</sub> of just the bits that touch that check, b<sub>N(a)</sub>. ' +
      'Why make replicas? A shared bit can belong to several checks. Each check needs to move its own local group to the nearest even-parity point without waiting for the other checks. The equalities z<sub>a</sub> = b<sub>N(a)</sub> then pull all those local answers back toward the same shared bits. ' +
      'The local answer may stay fractional during the negotiation: projection chooses the nearest point in the convex parity set, not a hard codeword immediately. One log u<sub>a</sub> per check remembers how its replica disagrees with the shared bits. This is the same reason the Coach and Physio needed two copies and a log, repeated once for every check.',
    math: 'check a forms q<sub>a</sub> = b<sub>N(a)</sub> + u<sub>a</sub>  →  z<sub>a</sub> = Π<sub>P(a)</sub>(q<sub>a</sub>)' + at(0.62, '<br>one replica z<sub>a</sub> and one log u<sub>a</sub> per check;  equality reconnects z<sub>a</sub> to the shared b<sub>N(a)</sub>'),
    draw: function (g, q) { var RR = P.split(g.sideR, 0.5); P.lines(g, RR[0], [{ text: 'shared object: one plan', col: C.gold }, { text: 'two full copies: x and z', col: COACH }, { text: 'local rule: z lies in C', col: PHYSIO }, { text: 'memory: one log u', col: LOG }], q, 'The plan'); P.lines(g, RR[1], [{ text: 'shared object: soft bits b', col: C.gold }, { text: 'one local replica zₐ per check', col: COACH }, { text: 'local rule: even parity', col: PHYSIO }, { text: 'memory: one log uₐ per check', col: LOG }], q, 'The decoder'); } });

  out.push({ id: 'differences', chapter: CH.bridge, title: 'What is different', layout: 'side', dur: 5.6,
    text: 'The plan has only two numbers, so the Coach can scan every day. A decoder has thousands of bits and cannot scan every codeword. The plan has five straight boundaries and one copy with one log; a decoder has many parity checks, each with its own replica and log. ' +
      'The scale and the local work change, but the core idea does not: duplicate the shared unknown, give each copy one easy job, then use a tether and remembered disagreement until the copies agree and stop moving.',
    math: 'same four moves;  different cost, set, size, and test',
    draw: function (g, q) { var RR = P.split(g.sideR, 0.5); P.lines(g, RR[0], [{ text: 'two numbers: scan every day', col: COACH }, { text: 'five boundaries: one projection', col: PHYSIO }, { text: 'one duplicate plan, one log', col: LOG }, { text: 'stop when both gauges are small', col: C.gold }], q, 'The plan'); P.lines(g, RR[1], [{ text: 'thousands of bits: a few taps', col: COACH }, { text: 'many parity rules: one replica each', col: PHYSIO }, { text: 'one log per replica', col: LOG }, { text: 'then test syndrome and CRC', col: C.gold }], q, 'The decoder'); } });

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
