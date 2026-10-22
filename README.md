# King's Land Descent

An interactive browser game with a 50-step introductory tutorial for gradient descent, L-BFGS, and ADMM, followed by a 28-step OFDM-first tutorial for the CAJODE receiver. The Jade Keep remains as a secondary memory aid after the receiver problem is clear. Two applied case studies then use the same visual player to teach constrained localization and joint torn-net inspection.

- [Play King's Land Descent](https://gabrielarl.github.io/kings-land-descent/)
- [Open the guided tutorial](https://gabrielarl.github.io/kings-land-descent/tutorial.html)
- [Learn CAJODE joint OFDM demodulation and decoding](https://gabrielarl.github.io/kings-land-descent/jade_keep_tutorial.html)
- [Localize an inspection dive](https://gabrielarl.github.io/kings-land-descent/localization_is_decoding.html)
- [Find the tear in a fish-farm net](https://gabrielarl.github.io/kings-land-descent/finding_the_tear.html)

No installation or server is required. The game runs as a static web page. It stores terrain settings, display quality, and lesson progress in the browser's local storage; it does not transmit those saved values. Google Fonts are optional, and system font fallbacks keep the pages usable when those fonts are unavailable.

## Build and verify

Python builds the five pages by inlining the JavaScript source into their HTML templates:

```bash
python3 -B source/simulator/build_page.py
python3 -B source/localization_decoding/build_dive.py
python3 -B source/torn_net/build_net.py
```

Run the numerical engine checks and the checks of the lesson sequence with Node.js:

```bash
node source/simulator/test_engine.js
node source/simulator/test_learning_flow.js
node source/simulator/test_keep.js
node source/localization_decoding/test_dive.js
node source/torn_net/test_net.js
sha256sum -c SHA256SUMS
```

The first suite checks the terrain and optimization engine. The second protects the 50-step introductory teaching sequence, including the Cartographer's day-2 L-BFGS derivation and the expanded ADMM walkthrough. That walkthrough first separates the Wanderer's unconstrained minimization from the Warden's projection, then shows why a rope penalty alone can leave a fixed disagreement. It next introduces the scaled dual variable or ledger \(u\), derives the rope target or aim \(v=z-u\), and follows a complete update circuit. The rope-only run is explicitly marked as a counterfactual, not ADMM. The third suite checks the CAJODE tutorial's OFDM teaching order, known-channel trace, joint bit-and-channel toy, acceptance and convergence milestones, claim boundaries, and drawings. The final two suites check the numerical solvers, generated pages, teaching order, drawings, and claim boundaries of the localization and torn-net case studies.

## Repository contents

- `index.html`: complete playable game published by GitHub Pages
- `tutorial.html`: introductory guided tutorial
- `jade_keep_tutorial.html`: OFDM-first CAJODE and ADMM tutorial, with the Jade Keep as a secondary analogy
- `localization_is_decoding.html`: constrained-localization case study
- `finding_the_tear.html`: joint geometry-and-twine-state case study
- `source/simulator/`: HTML templates, JavaScript source, build script, and tests
- `source/localization_decoding/`: localization template, engine, drawings, story, build script, and tests
- `source/torn_net/`: torn-net template, engine, drawings, story, build script, and tests
- `source/examples/out/methods_numbers.tex`: numerical fixture used by the engine checks

The associated slide deck and research paper files are intentionally outside this repository.

## Credits and license

The associated teaching deck, *Three heroes downhill*, credits Gabriel Chua Yu Han and Mandar Chitre. See [PROVENANCE.md](PROVENANCE.md) for the publication record.

The game and source are released under the [MIT License](LICENSE).
