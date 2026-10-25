# King's Land Descent

An interactive browser game with a 66-step introductory tutorial for gradient descent, L-BFGS, and ADMM, followed by a 28-step OFDM-first tutorial for the SAPPHIRE receiver. The Jade Keep remains as a secondary memory aid after the receiver problem is clear. A 34-step tutorial compares the BP protocol with SAPPHIRE's constraint circuit on one connected six-bit tree and its one-edge loop closure. Three applied case studies then use the same visual player for a training plan, constrained localization, and joint torn-net inspection. A 25-step results tutorial, *Six receivers on the Red recordings*, teaches how to read the Red-channel receiver bit error rate (BER) table in `results/red_hydrophone_ber/`, distinguish six receiver routes from BP as one receiver component, and keep incomplete PEARL coverage explicit.

SAPPHIRE expands to **S**ymbol detection **A**ided by code through **P**arity constraints and **P**olytope projections, with **H**alf-quadratic weighting under **I**CI in a joint OFDM **R**eceiver with **E**rror-correction decoding. Stable filenames, URL fragments, source-repository names, and evidence identifiers containing `cajode` or `CAJODE` are retained for compatibility and provenance; reader-facing lessons use SAPPHIRE.

The eight pages are joined by concept roads. Thirty-three lesson-relevant roads appear where they answer the question the reader has just reached, thirteen optional comparisons stay folded under **More connections**, and eight exploratory links live only on the map. Each road says what remains the same and what changes, estimates its length, and ends with a terminology key; a prediction prompt asks the reader to make one mapping before that key appears. End-of-course pages instead offer a short, ordered choice of useful next lessons. A completed page pair uses a shorter return road without replaying the map, while **Replay full road** restores the complete bridge. Direct links, nested return tickets, visible progress states, and the permanent eight-page map let a reader explore without losing their place.

- [Play King's Land Descent](https://gabrielarl.github.io/kings-land-descent/)
- [Open the guided tutorial](https://gabrielarl.github.io/kings-land-descent/tutorial.html)
- [Learn how SAPPHIRE combines detection and decoding in an OFDM receiver](https://gabrielarl.github.io/kings-land-descent/jade_keep_tutorial.html)
- [Compare the BP protocol with the SAPPHIRE constraint circuit](https://gabrielarl.github.io/kings-land-descent/bp_and_cajode.html)
- [Plan a training session with the Coach and the Physio](https://gabrielarl.github.io/kings-land-descent/the_coach_and_the_physio.html)
- [Localize an inspection dive](https://gabrielarl.github.io/kings-land-descent/localization_is_decoding.html)
- [Find the tear in a fish-farm net](https://gabrielarl.github.io/kings-land-descent/finding_the_tear.html)
- [Read the six-receiver Red BER table](https://gabrielarl.github.io/kings-land-descent/five_receivers_on_red.html)

No installation or server is required. The game runs as a static web page. It stores terrain settings, display quality, and lesson progress in the browser's local storage; it does not transmit those saved values. Google Fonts are optional, and system font fallbacks keep the pages usable when those fonts are unavailable.

## Build and verify

Python builds the eight pages by inlining the JavaScript source into their HTML templates:

```bash
python3 -B source/simulator/build_page.py
python3 -B source/soldiers/build_soldiers.py
python3 -B source/training_plan/build_plan.py
python3 -B source/localization_decoding/build_dive.py
python3 -B source/torn_net/build_net.py
python3 -B source/red_ber/build_ber.py
```

Run the numerical engine checks and the checks of the lesson sequence with Node.js:

```bash
node source/simulator/test_engine.js
node source/simulator/test_learning_flow.js
node source/simulator/test_keep.js
node source/simulator/test_realm.js
node source/soldiers/test_soldiers.js
node source/training_plan/test_plan.js
node source/localization_decoding/test_dive.js
node source/torn_net/test_net.js
node source/red_ber/test_ber.js
sha256sum -c SHA256SUMS
```

To see, outside the browser, that the Twins' Wanderer solves a different cost function each day, run the standalone script below. It needs NumPy and Matplotlib, prints both runs day by day and writes two figures; `--animate` also writes a GIF in which the land changes from one day to the next.

```bash
python3 source/examples/twins_day_by_day.py --out figures
```

The first suite checks the terrain and optimization engine. The second protects the 66-step introductory teaching sequence, including the Cartographer's day-2 L-BFGS derivation, the expanded ADMM walkthrough, and the self-checking light-board bridge. The board grows one check that requires even parity into a 3 × 3 product code, distinguishes observed glow from its channel LLR, and shows why overlapping checks require separate replica vectors. It then animates the Euclidean projection of q = (1, 1, 1) to z = (⅔, ⅔, ⅔), an equal blend of three passing hard rows, before running a computed degree-three ADMM trace in which the syndrome clears before both continuous residuals. The wall walkthrough first separates the Wanderer's unconstrained minimization from the Warden's projection. It solves the projection of the valley's floor \(\hat x\) as a problem of its own, by a growing circle and then one coordinate at a time, and shows that this nearest lawful point is not the lowest one. It then shows why a rope penalty alone can leave a fixed disagreement. It next introduces the scaled dual variable or ledger \(u\), derives the rope target or aim \(v=z-u\), and follows a complete update circuit. The rope-only run is explicitly marked as a counterfactual, not ADMM. The third suite checks the SAPPHIRE tutorial's OFDM teaching order, known-channel trace, joint bit-and-channel toy, acceptance and convergence milestones, claim boundaries, and drawings. The roads suite checks the curated prominence levels and prerequisite-safe landings, verifies every interlude and terminology key, exercises first visits, abbreviated repeats, full replays, direct openings and nested return tickets, and confirms that every page remains reachable. The soldier suite checks a connected, acyclic Tanner graph, one LLR convention, the three-iteration BP evidence wave, the three-circuit known-channel SAPPHIRE trace, replica variables and scaled dual variables, parity acceptance before continuous consensus, the related loop fixture, the optional projected-gradient detour with one penalty function, the exact JADE soft-feedback hand-off, and every drawing at desktop and phone sizes. The next three suites check the numerical solvers, generated pages, teaching order, drawings, and claim boundaries of the training-plan, localization, and torn-net case studies. The Red suite checks the 5,760-row source grid, pilot-specific missing cells, all computed statements, the six-route mechanism map, the fixed four-case plot scope, accessible chart alternatives, desktop and phone drawings, and standalone-page freshness. Across all eight pages, the shared Contents list uses native buttons and marks the current step with `aria-current`.

On “Nearest is not lowest,” the same two lawful points are now ranked by both questions. The Warden chooses Π<sub>C</sub>(x̂) because 0.450 < 0.504 in distance from x̂; the King chooses x* because 0.131 < 0.329 in height J. A probe moves down their shared wall before a circle and an equal-height ellipse show why the two questions have different answers.

The `light-replicas` step now begins with the overlap that requires replicas: the shared bit b₅ belongs to both R2 and C2, so each check needs a separate local vector while equality constraints reconnect those vectors to the shared decision. Its animation follows b₅ into both replicas, forms q = b + u, and projects q = (1, 1, 1) to the fractional point (⅔, ⅔, ⅔), shown as an equal blend of three passing rows.

## Repository contents

- `index.html`: complete playable game published by GitHub Pages
- `tutorial.html`: introductory guided tutorial
- `jade_keep_tutorial.html`: OFDM-first SAPPHIRE and ADMM tutorial, with the Jade Keep as a secondary analogy
- `bp_and_cajode.html`: the BP protocol beside SAPPHIRE's constraint circuit on a connected tree and its loop closure; the stable legacy filename is retained
- `the_coach_and_the_physio.html`: a slam-dunk ADMM story in which the Coach scores a complete day-and-load plan, the Physio projects a duplicate plan onto the allowed set, a tether coordinates them, and a planning log remembers repeated disagreement
- `localization_is_decoding.html`: constrained-localization case study
- `finding_the_tear.html`: joint geometry-and-twine-state case study
- `source/simulator/`: HTML templates, JavaScript source, build script, and tests; `realm.js` holds the roads, the map and the interludes shared by all eight pages
- `source/soldiers/`: soldier tutorial template, walks, drawings, story, build script, and tests
- `source/training_plan/`: training-plan template, engine, drawings, story, build script, and tests
- `source/localization_decoding/`: localization template, engine, drawings, story, build script, and tests
- `source/torn_net/`: torn-net template, engine, drawings, story, build script, and tests
- `five_receivers_on_red.html`: six-receiver results tutorial on the Red-channel receiver BER table; the stable filename is retained
- `source/red_ber/`: results-tutorial template, data file made from the BER table, drawings, story, build script, and tests
- `source/examples/twins_day_by_day.py`: standalone Python script that draws each day's cost function for the Twins, with the rope alone and with the book
- `source/examples/out/methods_numbers.tex`: numerical fixture used by the engine checks

The associated slide deck and research paper files are intentionally outside this repository.

## Reserved optional application

Haplotype phasing is reserved for a later optional page; it is not part of the linear introductory course. Any such page must treat `HH | hh` and `Hh | hH` as same-phase and opposite-phase arrangements across two ordered heterozygous sites, not as four ordinary genotypes; `H` and `h` are neutral allele labels, not dominant and recessive traits. It must also show that sequencing reads provide noisy, incomplete pairwise evidence, that the two reconstructed haplotypes have a global label-swap ambiguity unless anchored, and that these relations are not the higher-degree parity checks of an LDPC code. The analogy must not imply that ADMM is a standard haplotype-phasing method.

## Credits and license

The associated teaching deck, *Three heroes downhill*, credits Gabriel Chua Yu Han and Mandar Chitre. See [PROVENANCE.md](PROVENANCE.md) for the publication record.

The game and source are released under the [MIT License](LICENSE).
