// The training-plan case study of the tutorial "The Coach and the Physio" (the_coach_and_the_physio.html): an
// athlete's next hard session is one plan q = (t, w), the day it happens and its load.  The Coach wants the session
// with the greatest training benefit, read off the predicted readiness curve; the Physio keeps the session inside a
// set of planning rules.  The two negotiate with ADMM in scaled form: the Coach's copy x, the Physio's copy z, a
// tether of stiffness rho, and the planning log u.  After the agreed session happens, the page shows the changed
// readiness curve and stops, keeping the focus on that one ADMM negotiation.  The slam-dunk line p.dunk is a story
// target used to read the resulting curve; it is not part of the Coach's one-session objective.  Plain JavaScript (Node 12).
var Plan = (function () {
  function copy(o, extra) { var r = {}, k; for (k in o) r[k] = o[k]; for (k in (extra || {})) r[k] = extra[k]; return r; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function scale(a, s) { return [a[0] * s, a[1] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
  function norm(a) { return Math.hypot(a[0], a[1]); }

  // ---------------------------------------------------------------- the body: the readiness curve
  // Every hard session leaves two traces that fade at different speeds: fitness, small and slow (k1, tau1), and
  // fatigue, large and fast (k2, tau2).  Readiness is their sum over the sessions done so far, on top of the rested
  // baseline 1: a dip right after a session, a recovery, a crest (the supercompensation), and a return to baseline.
  function readiness(history, p) {
    return function (t) {
      var r = 1;
      for (var i = 0; i < history.length; i++) {
        var dt = t - history[i].t; if (dt < 0) continue;
        r += history[i].w / p.wRef * (p.k1 * Math.exp(-dt / p.tau1) - p.k2 * Math.exp(-dt / p.tau2));
      }
      return r;
    };
  }
  // the crest of one session's trace, in days after it (where fitness minus fatigue is largest)
  function crestOf(p) { return p.tau1 * p.tau2 / (p.tau1 - p.tau2) * Math.log(p.k2 * p.tau1 / (p.k1 * p.tau2)); }
  // the first day in [t0, t1] on which a curve reaches a level (a fine grid, then bisection), or null if it never does;
  // with level = p.dunk this is the day the athlete can first dunk
  function reach(r, level, t0, t1) {
    if (r(t0) >= level) return t0;
    var n = 2800; for (var i = 1; i <= n; i++) {
      var t = t0 + (t1 - t0) * i / n; if (r(t) < level) continue;
      var a = t0 + (t1 - t0) * (i - 1) / n, b = t; for (var k = 0; k < 50; k++) { var m = (a + b) / 2; if (r(m) >= level) b = m; else a = m; }
      return b;
    }
    return null;
  }

  // ---------------------------------------------------------------- the Coach: the benefit of a session
  // The toy score gives each unit of load the day-dependent worth r - r0, then subtracts the convex price a*w^2.
  // Thus r0 is the score's zero-worth reference, not a biological harm threshold.  The Coach's cost is minus this proxy.
  function benefit(r, p) { return function (q) { return q[1] * (r(q[0]) - p.r0) - p.a * q[1] * q[1]; }; }
  // tMin: a plan cannot come before the last session, so the map is flat there (no cliff at day 0 in the shading)
  function cost(r, p, tMin) { var b = benefit(r, p); return function (q) { return -b(tMin == null ? q : [Math.max(q[0], tMin), q[1]]); }; }
  // the lowest point of a function of one number on [lo, hi]: a fine grid, then golden-section refinement
  function argmin1(f, lo, hi, n) {
    n = n || 1200; var best = lo, bv = Infinity, i;
    for (i = 0; i <= n; i++) { var t = lo + (hi - lo) * i / n, v = f(t); if (v < bv) { bv = v; best = t; } }
    var a = Math.max(lo, best - (hi - lo) / n), b = Math.min(hi, best + (hi - lo) / n), gr = (Math.sqrt(5) - 1) / 2;
    var c = b - gr * (b - a), d = a + gr * (b - a), fc = f(c), fd = f(d);
    for (i = 0; i < 60; i++) { if (fc < fd) { b = d; d = c; fd = fc; c = b - gr * (b - a); fc = f(c); } else { a = c; c = d; fc = fd; d = a + gr * (b - a); fd = f(d); } }
    var m = (a + b) / 2; return { t: m, v: f(m) };
  }
  // The Coach's step: the lowest point of cost + rho/2 |q - v|^2.  For each day t the load is exact,
  // w(t) = (g(t) + rho v_w) / (2a + rho) with g = r - r0; what remains is one number, t, searched on a fine grid.
  // With rho -> 0 this is the Coach's own best session, the crest of the curve with load g / 2a.
  function coachStep(prob, v, rho) {
    var p = prob.p, g = function (t) { return prob.r(t) - p.r0; };
    function wOf(t) { return (g(t) + rho * v[1]) / (2 * p.a + rho); }
    function h(t) { var w = wOf(t), gt = g(t); return -w * gt + p.a * w * w + rho / 2 * ((t - v[0]) * (t - v[0]) + (w - v[1]) * (w - v[1])); }
    var m = argmin1(h, p.tRange[0], p.tRange[1]);
    return { x: [m.t, wOf(m.t)], value: m.v, along: h, loadOf: wOf };
  }

  // ---------------------------------------------------------------- the Physio: the rules, a convex polygon
  // Each rule is a half-plane a.q <= b of the plan q = (t, w): the day comes after the recovery time, the load is
  // at most `ramp` times the last session's, the load allowed grows with the days of rest taken (the workload
  // rule), the example only looks across its short planning window, and a load is not negative.
  function rules(history, p) {
    var last = history[history.length - 1];
    return [
      { id: 'recovery', a: [-1, 0], b: -(last.t + p.recovery), name: 'recovery: at least ' + p.recovery + ' days after the last hard session', short: 't ≥ ' + fmt(last.t + p.recovery) },
      { id: 'ramp', a: [0, 1], b: p.ramp * last.w, name: 'ramp: at most ' + Math.round((p.ramp - 1) * 100) + '% more load than last time', short: 'w ≤ ' + fmt(p.ramp * last.w) },
      { id: 'workload', a: [-p.s, 1], b: p.w0 - p.s * last.t, name: 'workload: the load allowed grows with the rest taken', short: 'w ≤ ' + fmt(p.w0) + ' + ' + fmt(p.s) + '·(t − ' + fmt(last.t) + ')' },
      { id: 'window', a: [1, 0], b: p.windowEnd, name: 'window: choose the next session within the next ' + p.windowEnd + ' days', short: 't ≤ ' + fmt(p.windowEnd) },
      { id: 'load', a: [0, -1], b: 0, name: 'a load is not negative', short: 'w ≥ 0' }
    ];
  }
  function fmt(v) { var s = (Math.round(v * 100) / 100).toString(); return s; }
  function satisfied(rl, q, tol) { tol = tol == null ? 1e-9 : tol; return dot(rl.a, q) <= rl.b + tol; }
  function inside(rs, q, tol) { for (var i = 0; i < rs.length; i++) if (!satisfied(rs[i], q, tol)) return false; return true; }
  // the polygon of all the rules: a big box cut by each half-plane in turn (Sutherland–Hodgman)
  function polygon(rs, p) {
    var box = [[p.tRange[0] - 5, p.wRange[0] - 5], [p.tRange[1] + 5, p.wRange[0] - 5], [p.tRange[1] + 5, p.wRange[1] + 5], [p.tRange[0] - 5, p.wRange[1] + 5]], poly = box;
    rs.forEach(function (rl) {
      var out = [];
      for (var i = 0; i < poly.length; i++) {
        var A = poly[i], B = poly[(i + 1) % poly.length], fa = rl.b - dot(rl.a, A), fb = rl.b - dot(rl.a, B);
        if (fa >= 0) out.push(A);
        if ((fa >= 0) !== (fb >= 0)) { var s = fa / (fa - fb); out.push([A[0] + s * (B[0] - A[0]), A[1] + s * (B[1] - A[1])]); }
      }
      poly = out;
    });
    var area = 0; for (var i = 0; i < poly.length; i++) { var A = poly[i], B = poly[(i + 1) % poly.length]; area += A[0] * B[1] - B[0] * A[1]; }
    return { verts: poly, area: Math.abs(area) / 2, empty: poly.length < 3 || Math.abs(area) < 1e-9 };
  }
  // the Physio's step: the nearest point of the polygon, exact (the point itself if inside, else the nearest point of
  // the nearest edge)
  function project(poly, rs, q) {
    if (inside(rs, q)) return q.slice();
    var best = null, bd = Infinity, V = poly.verts;
    for (var i = 0; i < V.length; i++) {
      var A = V[i], B = V[(i + 1) % V.length], d = sub(B, A), L2 = dot(d, d), s = L2 > 0 ? Math.max(0, Math.min(1, dot(sub(q, A), d) / L2)) : 0, f = add(A, scale(d, s)), dist = norm(sub(q, f));
      if (dist < bd) { bd = dist; best = f; }
    }
    return best;
  }
  // which rules hold with equality at q (the edges q stands on)
  function active(rs, q, tol) { return rs.filter(function (rl) { return Math.abs(dot(rl.a, q) - rl.b) <= (tol == null ? 1e-6 : tol); }); }

  // ---------------------------------------------------------------- one planning problem
  function problem(history, p) {
    history = history.slice();   // the curve must not change when later sessions join the season's history
    var r = readiness(history, p), J = cost(r, p, history[history.length - 1].t), rs = rules(history, p), poly = polygon(rs, p);
    var free = coachStep({ p: p, r: r }, [0, 0], 1e-12).x;
    var prob = { p: p, history: history.slice(), last: history[history.length - 1], r: r, J: J, benefit: benefit(r, p), rules: rs, poly: poly, free: free, freeJ: J(free), empty: poly.empty };
    prob.crest = argmin1(function (t) { return -r(t); }, p.tRange[0], p.tRange[1]).t;
    prob.freeZ = poly.empty ? null : project(poly, rs, free);
    prob.best = poly.empty ? null : bestSafe(prob);
    return prob;
  }
  // the best allowed session by brute force: a coarse grid over the polygon's box, then a fine one around the best cell
  function bestSafe(prob) {
    var V = prob.poly.verts, t0 = Infinity, t1 = -Infinity, w0 = Infinity, w1 = -Infinity;
    V.forEach(function (q) { t0 = Math.min(t0, q[0]); t1 = Math.max(t1, q[0]); w0 = Math.min(w0, q[1]); w1 = Math.max(w1, q[1]); });
    function scan(ta, tb, wa, wb, n) {
      var best = null, bv = Infinity;
      for (var i = 0; i <= n; i++) for (var j = 0; j <= n; j++) {
        var q = [ta + (tb - ta) * i / n, wa + (wb - wa) * j / n]; if (!inside(prob.rules, q)) continue;
        var v = prob.J(q); if (v < bv) { bv = v; best = q; }
      }
      return best;
    }
    var q = scan(t0, t1, w0, w1, 240), h = Math.max(t1 - t0, w1 - w0) / 240;
    for (var k = 0; k < 3; k++) { var q2 = scan(q[0] - 2 * h, q[0] + 2 * h, q[1] - 2 * h, q[1] + 2 * h, 80); if (q2) q = q2; h = 4 * h / 80; }
    // the exact lowest point along the edge the grid found: a golden search along it
    var act = active(prob.rules, q, 3 * h);
    if (act.length === 1) {
      var rl = act[0], dir = [-rl.a[1], rl.a[0]], base = q.slice();
      var m = argmin1(function (s) { var qq = add(base, scale(dir, s)); return inside(prob.rules, qq, 1e-9) ? prob.J(qq) : Infinity; }, -0.5, 0.5, 400);
      q = add(base, scale(dir, m.t));
    }
    return { q: q, J: prob.J(q), active: active(prob.rules, q, 1e-4).map(function (rl) { return rl.id; }) };
  }

  // ---------------------------------------------------------------- the negotiation: ADMM in scaled form
  // Rounds k = 1, 2, ...: the aim v = z - u, the Coach's step x, the Physio's step z = proj(x + u), the log
  // u <- u + x - z.  With o.ropeAlone the log is wiped after every round: the tether without memory.
  function solve(prob, o) {
    o = o || {}; var p = prob.p, rho = o.rho == null ? p.rho : o.rho, maxRounds = o.rounds || p.maxRounds, tol = p.tol;
    var x = (o.start || prob.free).slice(), z = project(prob.poly, prob.rules, x), u = [0, 0];
    var rounds = [{ k: 0, x: x, z: z, u: u, v: null, primal: norm(sub(x, z)), dual: null, zPrev: null, uPrev: null, xPrev: null }], stop = null;
    for (var k = 1; k <= maxRounds; k++) {
      var v = sub(z, u), step = coachStep(prob, v, rho), nx = step.x, nz = project(prob.poly, prob.rules, add(nx, u)), nu = o.ropeAlone ? [0, 0] : add(u, sub(nx, nz));
      var rec = { k: k, v: v, x: nx, z: nz, u: nu, xPrev: x, zPrev: z, uPrev: u, primal: norm(sub(nx, nz)), dual: rho * norm(sub(nz, z)), gap: sub(nx, nz), stepValue: step.value };
      rounds.push(rec); x = nx; z = nz; u = nu;
      if (!o.ropeAlone && rec.primal <= tol && rec.dual <= tol) { stop = k; break; }
    }
    var fin = rounds[rounds.length - 1];
    return { rounds: rounds, final: fin, stop: stop, rho: rho, tol: tol, plan: fin.z, converged: stop != null, ropeAlone: !!o.ropeAlone };
  }

  // ---------------------------------------------------------------- the short block: negotiate the next session, then show its effect
  function season(p) {
    var history = p.history.map(function (h) { return copy(h); }), plans = [];
    for (var n = 0; n < p.maxSessions; n++) {
      var prob = problem(history, p);
      if (prob.empty) { plans.push({ prob: prob, sol: null, empty: true }); break; }
      var sol = solve(prob), alone = solve(prob, { ropeAlone: true, rounds: p.ropeAloneRounds });
      plans.push({ prob: prob, sol: sol, alone: alone, empty: false });
      history.push({ t: sol.plan[0], w: sol.plan[1] });   // append the allowed plan to the model's deterministic history
    }
    return { plans: plans, history: history, sessions: history.slice(p.history.length) };
  }
  function build(over) {
    var p = copy(PRESET, over), s = season(p), first = s.plans[0];
    return { p: p, season: s, first: first, prob: first.prob, sol: first.sol, alone: first.alone, history: s.history, sessions: s.sessions, crest: crestOf(p) };
  }

  // dunk is the story's target line on the readiness plot, not a deadline or part of the one-session objective
  var PRESET = { k1: 1.0, tau1: 5, k2: 1.5, tau2: 1.5, wRef: 5, r0: 0.6, a: 0.05, dunk: 1.5,
                 recovery: 2, ramp: 1.1, w0: 1.0, s: 0.9, windowEnd: 12,
                 rho: 0.1, tol: 0.01, maxRounds: 80, ropeAloneRounds: 10, maxSessions: 1,
                 history: [{ t: 0, w: 5 }], tRange: [0, 16], wRange: [0, 10] };
  return { PRESET: PRESET, build: build, season: season, problem: problem, solve: solve, readiness: readiness, crestOf: crestOf, reach: reach, benefit: benefit, cost: cost,
           coachStep: coachStep, rules: rules, polygon: polygon, project: project, inside: inside, satisfied: satisfied, active: active, bestSafe: bestSafe, argmin1: argmin1,
           sub: sub, add: add, scale: scale, dot: dot, norm: norm, copy: copy };
})();
if (typeof module !== 'undefined') module.exports = Plan;
