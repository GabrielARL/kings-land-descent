// The worked example of "Three symbols, two checks" (three_symbols_two_checks.html): three shared symbol estimates b,
// the signal's preferred values c = (0.1, 0.6, 0.9), the cost f(b) = ½‖b − c‖², and two even-parity checks of degree
// two, A on symbols 1 and 2 and B on symbols 2 and 3.  Each check keeps a replica z_a of its own symbols and a scaled
// dual variable (the ledger) u_a.  One round of ADMM is the shared update of b, the projection of every replica onto
// its parity polytope, and the ledger update, in that order, with ρ = 1.  The run starts as the handover fixes it:
// b⁰ = c, z_a⁰ = S_a c, u_a⁰ = 0.  The same rounds without the ledger (u held at zero) are the counterfactual.
// Plain JavaScript (ES5); window.Three in a page, module.exports in node.
(function (root) {
  'use strict';
  var C0 = [0.1, 0.6, 0.9];
  var CHECKS = [{ name: 'A', of: [0, 1] }, { name: 'B', of: [1, 2] }];
  var H = [[1, 1, 0], [0, 1, 1]];
  // the four check–symbol edges, in the order A–1, A–2, B–2, B–3: [check index, symbol index, slot in the check]
  var EDGES = [[0, 0, 0], [0, 1, 1], [1, 1, 0], [1, 2, 1]];

  function clip(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function copy(v) { return v.slice(); }
  function norm(v) { var s = 0; for (var i = 0; i < v.length; i++) s += v[i] * v[i]; return Math.sqrt(s); }
  // S_a: the rows of the identity at check a's symbols; S_a b keeps them as a vector
  function selection(a, n) { return CHECKS[a].of.map(function (i) { var row = []; for (var j = 0; j < (n || 3); j++) row.push(j === i ? 1 : 0); return row; }); }
  function select(a, b) { return CHECKS[a].of.map(function (i) { return b[i]; }); }
  function degree(i) { return CHECKS.filter(function (ch) { return ch.of.indexOf(i) >= 0; }).length; }
  // the parity polytope of an even-parity check of degree two is the segment {(t, t) : 0 ≤ t ≤ 1}; the nearest point
  // to q replaces both entries by their average, clipped to [0, 1]
  function project(q) { var t = clip((q[0] + q[1]) / 2); return [t, t]; }
  function hard(b) { return b.map(function (v) { return v >= 0.5 ? 1 : 0; }); }
  function syndrome(w) { return H.map(function (row) { var s = 0; for (var j = 0; j < row.length; j++) s += row[j] * w[j]; return s % 2; }); }
  function passes(w) { return syndrome(w).every(function (s) { return s === 0; }); }
  // the shared update: b_i = Π[0,1]((c_i + ρ Σ_{a∋i} (z_{a,i} − u_{a,i})) / (1 + ρ d_i)), from the targets t_a = z_a − u_a
  function sharedStep(c, z, u, rho) {
    var targets = z.map(function (za, a) { return [za[0] - u[a][0], za[1] - u[a][1]]; });
    var num = copy(c), den = c.map(function () { return 1; });
    EDGES.forEach(function (e) { num[e[1]] += rho * targets[e[0]][e[2]]; den[e[1]] += rho; });
    return { b: num.map(function (v, i) { return clip(v / den[i]); }), raw: num.map(function (v, i) { return v / den[i]; }), targets: targets, num: num, den: den };
  }
  // the temporary objective of a round, Φ(b) = f(b) + (ρ/2) Σ_a ‖S_a b − z_a + u_a‖², with z and u frozen
  function phi(c, z, u, rho) {
    return function (b) {
      var f = 0, i; for (i = 0; i < 3; i++) f += 0.5 * (b[i] - c[i]) * (b[i] - c[i]);
      CHECKS.forEach(function (ch, a) { var sb = select(a, b); for (var j = 0; j < 2; j++) { var d = sb[j] - z[a][j] + u[a][j]; f += rho / 2 * d * d; } });
      return f;
    };
  }
  function state(k, b, z, u, extra) {
    var sb = CHECKS.map(function (ch, a) { return select(a, b); }), r = sb.map(function (q, a) { return [q[0] - z[a][0], q[1] - z[a][1]]; });
    var w = hard(b), o = { k: k, b: copy(b), z: z.map(copy), u: u.map(copy), sb: sb, r: r, gap: norm([].concat(r[0], r[1])), word: w, syndrome: syndrome(w), pass: passes(w) };
    if (extra) Object.keys(extra).forEach(function (key) { o[key] = extra[key]; });
    return o;
  }
  // o: { c, rho, rounds, ledger (false: u stays zero, the counterfactual) }
  function run(o) {
    o = o || {}; var c = o.c || C0, rho = o.rho == null ? 1 : o.rho, n = o.rounds || 40, ledger = o.ledger !== false;
    var b = copy(c), z = CHECKS.map(function (ch, a) { return select(a, c); }), u = CHECKS.map(function () { return [0, 0]; });
    var rounds = [state(0, b, z, u)];
    for (var k = 1; k <= n; k++) {
      var zPrev = z.map(copy), uPrev = u.map(copy), step = sharedStep(c, z, u, rho);
      b = step.b;
      var sb = CHECKS.map(function (ch, a) { return select(a, b); });
      var q = sb.map(function (s, a) { return [s[0] + u[a][0], s[1] + u[a][1]]; });
      z = q.map(project);
      if (ledger) u = u.map(function (ua, a) { return [ua[0] + sb[a][0] - z[a][0], ua[1] + sb[a][1] - z[a][1]]; });
      var dz = [].concat(z[0][0] - zPrev[0][0], z[0][1] - zPrev[0][1], z[1][0] - zPrev[1][0], z[1][1] - zPrev[1][1]);
      rounds.push(state(k, b, z, u, { targets: step.targets, num: step.num, den: step.den, raw: step.raw, q: q, zPrev: zPrev, uPrev: uPrev, move: rho * norm(dz) }));
    }
    var first = null; for (var j = 1; j < rounds.length; j++) if (rounds[j].pass) { first = j; break; }
    return { rho: rho, ledger: ledger, rounds: rounds, firstPass: first, final: rounds[rounds.length - 1] };
  }
  function build(o) {
    o = o || {}; var c = o.c || C0, rho = o.rho == null ? 1 : o.rho;
    var mean = (c[0] + c[1] + c[2]) / 3;
    return { c: c, rho: rho, H: H, checks: CHECKS, edges: EDGES, mean: mean, S: [selection(0), selection(1)],
             admm: run({ c: c, rho: rho, rounds: o.rounds || 40 }), alone: run({ c: c, rho: rho, rounds: o.rounds || 40, ledger: false }) };
  }
  var api = { C0: C0, CHECKS: CHECKS, H: H, EDGES: EDGES, clip: clip, norm: norm, selection: selection, select: select, degree: degree, project: project,
              hard: hard, syndrome: syndrome, passes: passes, sharedStep: sharedStep, phi: phi, run: run, build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Three = api;
})(this);
