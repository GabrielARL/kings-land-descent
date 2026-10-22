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

The Jade Keep was added as a third, 28-step advanced tutorial from the same working source. It distinguishes receiver acceptance from continuous consensus and complete state settling, labels its two-tile tower as the degree-two even-parity case, and marks its exact hidden-word Seal as a teaching oracle rather than a real CRC. Its 71 checks reproduce the known-channel CAJODE update trace and check the tutorial's joint tile-and-channel toy, equations, milestones, sequence, and 140 sampled drawing states. The original `index.html` and `tutorial.html` remain byte-for-byte unchanged by this addition.
