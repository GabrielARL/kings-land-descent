# King's Land Descent

An interactive browser game with a 56-step introductory tutorial for gradient descent, L-BFGS, and ADMM, followed by a 28-step OFDM-first tutorial for the CAJODE receiver. The Jade Keep remains as a secondary memory aid after the receiver problem is clear. Three applied case studies then use the same visual player for a training plan, constrained localization, and joint torn-net inspection.

The six pages are joined by concept roads. Twenty-five lesson-relevant roads appear where they answer the question the reader has just reached, ten optional comparisons stay folded under **More connections**, and eight exploratory links live only on the map. Each road says what remains the same and what changes, estimates its length, and ends with a terminology key; a prediction prompt asks the reader to make one mapping before that key appears. End-of-course pages instead offer a short, ordered choice of useful next lessons. A completed page pair uses a shorter return road without replaying the map, while **Replay full road** restores the complete bridge. Direct links, nested return tickets, visible progress states, and the permanent six-page map let a reader explore without losing their place.

- [Play King's Land Descent](https://gabrielarl.github.io/kings-land-descent/)
- [Open the guided tutorial](https://gabrielarl.github.io/kings-land-descent/tutorial.html)
- [Learn CAJODE joint OFDM demodulation and decoding](https://gabrielarl.github.io/kings-land-descent/jade_keep_tutorial.html)
- [Plan a training session with the Coach and the Physio](https://gabrielarl.github.io/kings-land-descent/the_coach_and_the_physio.html)
- [Localize an inspection dive](https://gabrielarl.github.io/kings-land-descent/localization_is_decoding.html)
- [Find the tear in a fish-farm net](https://gabrielarl.github.io/kings-land-descent/finding_the_tear.html)

No installation or server is required. The game runs as a static web page. It stores terrain settings, display quality, and lesson progress in the browser's local storage; it does not transmit those saved values. Google Fonts are optional, and system font fallbacks keep the pages usable when those fonts are unavailable.

## Build and verify

Python builds the six pages by inlining the JavaScript source into their HTML templates:

```bash
python3 -B source/simulator/build_page.py
python3 -B source/training_plan/build_plan.py
python3 -B source/localization_decoding/build_dive.py
python3 -B source/torn_net/build_net.py
```

Run the numerical engine checks and the checks of the lesson sequence with Node.js:

```bash
node source/simulator/test_engine.js
node source/simulator/test_learning_flow.js
node source/simulator/test_keep.js
node source/simulator/test_realm.js
node source/training_plan/test_plan.js
node source/localization_decoding/test_dive.js
node source/torn_net/test_net.js
sha256sum -c SHA256SUMS
```

The first suite checks the terrain and optimization engine. The second protects the 56-step introductory teaching sequence, including the Cartographer's day-2 L-BFGS derivation, the expanded ADMM walkthrough, and the self-checking light-board bridge. The board grows one even-parity check into a 3 × 3 product code, distinguishes observed glow from its channel LLR, introduces per-check replica vectors and per-edge scaled dual variables, and runs a computed degree-three ADMM trace in which the syndrome clears before both continuous residuals. The wall walkthrough first separates the Wanderer's unconstrained minimization from the Warden's projection, then shows why a rope penalty alone can leave a fixed disagreement. It next introduces the scaled dual variable or ledger \(u\), derives the rope target or aim \(v=z-u\), and follows a complete update circuit. The rope-only run is explicitly marked as a counterfactual, not ADMM. The third suite checks the CAJODE tutorial's OFDM teaching order, known-channel trace, joint bit-and-channel toy, acceptance and convergence milestones, claim boundaries, and drawings. The roads suite checks the curated prominence levels and prerequisite-safe landings, verifies every interlude and terminology key, exercises first visits, abbreviated repeats, full replays, direct openings and nested return tickets, and confirms that every page remains reachable. The final three suites check the numerical solvers, generated pages, teaching order, drawings, and claim boundaries of the training-plan, localization, and torn-net case studies.

## Repository contents

- `index.html`: complete playable game published by GitHub Pages
- `tutorial.html`: introductory guided tutorial
- `jade_keep_tutorial.html`: OFDM-first CAJODE and ADMM tutorial, with the Jade Keep as a secondary analogy
- `the_coach_and_the_physio.html`: training-plan case study with a Coach objective and Physio safety constraints
- `localization_is_decoding.html`: constrained-localization case study
- `finding_the_tear.html`: joint geometry-and-twine-state case study
- `source/simulator/`: HTML templates, JavaScript source, build script, and tests; `realm.js` holds the roads, the map and the interludes shared by all six pages
- `source/training_plan/`: training-plan template, engine, drawings, story, build script, and tests
- `source/localization_decoding/`: localization template, engine, drawings, story, build script, and tests
- `source/torn_net/`: torn-net template, engine, drawings, story, build script, and tests
- `source/examples/out/methods_numbers.tex`: numerical fixture used by the engine checks

The associated slide deck and research paper files are intentionally outside this repository.

## Reserved optional application

Haplotype phasing is reserved for a later optional page; it is not part of the linear introductory course. Any such page must treat `HH | hh` and `Hh | hH` as same-phase and opposite-phase arrangements across two ordered heterozygous sites, not as four ordinary genotypes; `H` and `h` are neutral allele labels, not dominant and recessive traits. It must also show that sequencing reads provide noisy, incomplete pairwise evidence, that the two reconstructed haplotypes have a global label-swap ambiguity unless anchored, and that these relations are not the higher-degree parity checks of an LDPC code. The analogy must not imply that ADMM is a standard haplotype-phasing method.

## Credits and license

The associated teaching deck, *Three heroes downhill*, credits Gabriel Chua Yu Han and Mandar Chitre. See [PROVENANCE.md](PROVENANCE.md) for the publication record.

The game and source are released under the [MIT License](LICENSE).
