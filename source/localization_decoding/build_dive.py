#!/usr/bin/env python3
"""Build localization_is_decoding.html, the tutorial "Localization through a decoder's lens": a monopile
inspection dive that teaches allowed sets and the consensus-ADMM pattern used by decoders.

    python3 -B source/localization_decoding/build_dive.py          (from the repository)
    python3 -B source/localization_decoding/build_dive.py --check  (verify the generated page is current)
    node source/localization_decoding/test_dive.js

dive.html holds the markup and the styles (those of tutorial.html); board.js, the kit and the step player, comes
from the simulator folder of deck lbgfs_admm_diff_no_math; inspect.js holds the dive and the solver, dive_parts.js
the drawings and dive_course.js the story.  With --fragment PATH the page is also written without its html, head
and body tags, the form in which it is published as a claude.ai artifact.
"""
import argparse
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SIMULATOR = HERE.parent / "simulator"
SCRIPTS = {"board.js": SIMULATOR / "board.js", "inspect.js": HERE / "inspect.js", "dive_parts.js": HERE / "dive_parts.js", "dive_course.js": HERE / "dive_course.js"}


def render():
    page = (HERE / "dive.html").read_text()
    for name, path in SCRIPTS.items():
        tag = f'<script src="{name}"></script>'
        assert page.count(tag) == 1, name
        code = path.read_text()
        assert "</script" not in code.lower(), name
        page = page.replace(tag, "<script>\n" + code + "</script>")
    head, marker, body = page.partition("<!-- body -->\n")
    assert marker, "dive.html has no body marker"
    document = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
                '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                + head + "</head>\n<body>\n" + body + "</body>\n</html>\n")
    return document, page


def build(fragment=None, check=False):
    document, page = render()
    out = ROOT / "localization_is_decoding.html"
    if check:
        if not out.exists() or out.read_text() != document:
            raise SystemExit(f"{out.name} is stale; run build_dive.py")
        if fragment and (not fragment.exists() or fragment.read_text() != page):
            raise SystemExit(f"{fragment} is stale; run build_dive.py --fragment {fragment}")
        print(f"verified {out.name} ({out.stat().st_size} bytes)")
        return
    out.write_text(document)
    print(f"wrote {out.name} ({out.stat().st_size} bytes)")
    if fragment:
        fragment.write_text(page)
        print(f"wrote {fragment}")


def main():
    parser = argparse.ArgumentParser(description="Build localization_is_decoding.html from dive.html and its scripts.")
    parser.add_argument("--fragment", type=Path, help="also write the page without its html, head and body tags")
    parser.add_argument("--check", action="store_true", help="fail without writing if generated output is stale")
    args = parser.parse_args()
    build(args.fragment, args.check)


if __name__ == "__main__":
    main()
