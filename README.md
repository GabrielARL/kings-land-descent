# King's Land Descent

An interactive browser game with a 50-step guided tutorial for learning gradient descent, L-BFGS, and ADMM.

- [Play King's Land Descent](https://gabrielarl.github.io/kings-land-descent/)
- [Open the guided tutorial](https://gabrielarl.github.io/kings-land-descent/tutorial.html)

No installation or server is required. The game runs as a static web page. It stores terrain settings, display quality, and lesson progress in the browser's local storage; it does not transmit those saved values. Google Fonts are optional, and system font fallbacks keep the pages usable when those fonts are unavailable.

## Build and verify

Python builds the two pages by inlining the JavaScript source into their HTML templates:

```bash
python3 -B source/simulator/build_page.py
```

Run the numerical engine checks and the checks of the lesson sequence with Node.js:

```bash
node source/simulator/test_engine.js
node source/simulator/test_learning_flow.js
sha256sum -c SHA256SUMS
```

The first suite checks the terrain and optimization engine. The second protects the 50-step teaching sequence, including the Cartographer's day-2 L-BFGS derivation and the expanded ADMM walkthrough. That walkthrough introduces the Wanderer \(x\), Warden \(z\), scaled dual variable or ledger \(u\), and derived rope target or aim \(v=z-u\) before showing a complete update circuit. Its no-ledger comparison is explicitly marked as a counterfactual, not ADMM.

## Repository contents

- `index.html`: complete playable game published by GitHub Pages
- `tutorial.html`: complete guided tutorial
- `source/simulator/`: HTML templates, JavaScript source, build script, and tests
- `source/examples/out/methods_numbers.tex`: numerical fixture used by the engine checks

The associated slide deck and research paper files are intentionally outside this repository.

## Credits and license

The associated teaching deck, *Three heroes downhill*, credits Gabriel Chua Yu Han and Mandar Chitre. See [PROVENANCE.md](PROVENANCE.md) for the publication record.

The game and source are released under the [MIT License](LICENSE).
