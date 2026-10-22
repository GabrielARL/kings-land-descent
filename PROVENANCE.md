# Provenance

This repository is the first public Git history for the standalone game and guided tutorial. The public package was prepared on 21 October 2026 from the authors' working copies.

The associated teaching deck, *Three heroes downhill: L-BFGS, ADMM and projected gradient, told without the math*, credits Gabriel Chua Yu Han and Mandar Chitre. The deck, its TeX source, and its research paper assets are not included here.

The deployed pages are reproducible from the files under `source/simulator/`:

- `source/simulator/page.html` and its JavaScript dependencies build `index.html`.
- `source/simulator/tutorial.html` and its JavaScript dependencies build `tutorial.html`.
- `source/simulator/advanced.html`, `keep.js`, `advanced_parts.js`, and `advanced_course.js` build `jade_keep_tutorial.html`.
- `source/examples/out/methods_numbers.tex` is retained only as a numerical test fixture.

The initial imported deployable pages had these SHA-256 digests:

```text
63c9b97dbc604a3171a12d99b8e1b323bc68c0dc106b2570bc790d2654c02290  index.html
9572a2e1cac0344d7eba9a92939c080546290623495ec0d3e79cff57112052b1  tutorial.html
```

The current 50-step teaching revision expands two mechanisms. The Cartographer's day-2 journal explanation now has separate pages for the accepted step length, the stride, the two endpoint gradients, their change, and the rise-over-run quotient. The Twins sequence now introduces the Wanderer \(x\), Warden \(z\), scaled dual variable or ledger \(u\), and derived rope target or aim \(v=z-u\) before following a complete ADMM update circuit. It also includes a clearly marked no-ledger counterfactual to show why repeatedly projecting the Warden without accumulating \(u\) is not ADMM. Running `python3 -B source/simulator/build_page.py` reproduces the pages whose current digests are recorded in `SHA256SUMS`.

The initial publication passed all 41 numerical engine checks and all 21 checks of the lesson sequence. The current revision passes all 41 engine checks and all 44 lesson-sequence checks. Those checks include numerical contracts for the day-2 L-BFGS page, the stretched-map journal stride, the first nonzero ADMM ledger entry, the next aim \(v=z-u\), the no-ledger counterfactual, and every worked identity in the scaled form of ADMM.

The Jade Keep was added as a third, 28-step advanced tutorial from the same working source. Its current revision is an OFDM receiver lesson first and a parable second. It starts from the received OFDM frame, establishes the cyclic-prefix conditions for one-tap equalization, and separates residual-Doppler intercarrier interference from short-prefix intersymbol interference. Partial FFT is presented only as a supplied-deck front-end contrast, not as an input to the documented CAJODE engine. The tutorial then contrasts separate and joint receiver flows, shows the distinct roles of pilots and code constraints, introduces CAJODE's shared bit variables in the continuous relaxation and local ADMM copies, and follows the documented bit, channel, projection, scaled-dual, and candidate-test updates. The numerical engine is unchanged: the exact known-channel trace and the documented-equation joint toy still distinguish candidate acceptance, replica consensus, and complete-state settling. The current 86-check suite also verifies the teaching order, technical boundaries, accessibility hooks, and 140 sampled drawing states. The tutorial states that its demonstrated objective covers carrier coupling within the current OFDM symbol rather than a validated adjacent-symbol receiver, and that acceptance is not a global-optimality certificate. The original `index.html` and `tutorial.html` remain byte-for-byte unchanged by this revision.

The teaching order was informed by the authors' working decks `joint_demodulation_decoding_merged.pdf`, `joint_demodulation_decoding_comic.pdf`, and `ici_and_isi_slides.pdf`. Those decks are not redistributed in this repository.

Two applied case studies were added on 22 October 2026 from the JadeJcade working copies. `localization_is_decoding.html` is built from `source/localization_decoding/`; its 24-step course separates physical admissibility, ADMM residual convergence, simulator-only accuracy, and the limits of the decoder analogy. Its 51 checks cover the synthetic sensors, projections, consensus residuals, stopping tests, teaching sequence, drawings, and standalone-page freshness. `finding_the_tear.html` is built from `source/torn_net/`; its 30-step course introduces image evidence and binary decisions before the position-copy consensus variables, and distinguishes targeted follow-up inspection from a CRC or convergence certificate. Its 41 checks cover the synthetic net, likelihood normalization, geometry projections, residual assembly, stopping claims, teaching sequence, drawings, and standalone-page freshness.

Both case studies reuse the byte-identical player in `source/simulator/board.js`. Their public build scripts point to that shared file rather than the private working-tree layout. The generated-page digests are recorded in `SHA256SUMS`.
