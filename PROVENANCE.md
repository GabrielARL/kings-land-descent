# Provenance

This repository is the first public Git history for the standalone game and guided tutorial. The public package was prepared on 21 October 2026 from the authors' working copies.

The associated teaching deck, *Three heroes downhill: L-BFGS, ADMM and projected gradient, told without the math*, credits Gabriel Chua Yu Han and Mandar Chitre. The deck, its TeX source, and its research paper assets are not included here.

The deployed pages are reproducible from the files under `source/simulator/`:

- `source/simulator/page.html` and its JavaScript dependencies build `index.html`.
- `source/simulator/tutorial.html` and its JavaScript dependencies build `tutorial.html`.
- `source/examples/out/methods_numbers.tex` is retained only as a numerical test fixture.

The imported deployable pages had these SHA-256 digests:

```text
63c9b97dbc604a3171a12d99b8e1b323bc68c0dc106b2570bc790d2654c02290  index.html
9572a2e1cac0344d7eba9a92939c080546290623495ec0d3e79cff57112052b1  tutorial.html
```

Running `python3 -B source/simulator/build_page.py` reproduces those pages byte for byte. The initial publication passed all 41 numerical engine checks and all 21 checks of the lesson sequence.
