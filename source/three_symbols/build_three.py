#!/usr/bin/env python3
"""Build three_symbols_two_checks.html, the tutorial "Three symbols, two checks": the replicas, projections and ledgers
of SAPPHIRE's ADMM worked by hand on three symbol estimates and two parity checks, told with the player of the King’s
Land tutorials.

    python3 -B source/three_symbols/build_three.py          (from the repository)
    node source/three_symbols/test_three.js

three.html holds the markup and the styles (those of tutorial.html); board.js, the kit and the step player, and
realm.js, the roads between the pages, come from the shared source/simulator folder; three.js holds the example and
its two runs, three_parts.js the drawings and three_course.js the pages.  With --fragment PATH the page is also written without its html, head
and body tags, the form in which it is published as a claude.ai artifact.
"""
import argparse
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SIMULATOR = HERE.parent / "simulator"
SCRIPTS = {"board.js": SIMULATOR / "board.js", "three.js": HERE / "three.js", "three_parts.js": HERE / "three_parts.js", "three_course.js": HERE / "three_course.js", "realm.js": SIMULATOR / "realm.js"}


def render():
    page = (HERE / "three.html").read_text()
    for name, path in SCRIPTS.items():
        tag = f'<script src="{name}"></script>'
        assert page.count(tag) == 1, name
        code = path.read_text()
        assert "</script" not in code.lower(), name
        page = page.replace(tag, "<script>\n" + code + "</script>")
    head, marker, body = page.partition("<!-- body -->\n")
    assert marker, "three.html has no body marker"
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + head + "</head>\n<body>\n" + body + "</body>\n</html>\n"), page


def build(fragment=None, check=False):
    rendered, page = render()
    out = ROOT / "three_symbols_two_checks.html"
    if check:
        if not out.exists() or out.read_text() != rendered:
            raise SystemExit(f"stale generated page: run {Path(__file__).name}")
        print(f"ok {out.name} is current ({out.stat().st_size} bytes)")
        return
    out.write_text(rendered)
    print(f"wrote {out.name} ({out.stat().st_size} bytes)")
    if fragment:
        fragment.write_text(page)
        print(f"wrote {fragment}")


def main():
    parser = argparse.ArgumentParser(description="Build three_symbols_two_checks.html from three.html and its scripts.")
    parser.add_argument("--fragment", type=Path, help="also write the page without its html, head and body tags")
    parser.add_argument("--check", action="store_true", help="fail without writing if the standalone page is stale")
    args = parser.parse_args()
    if args.check and args.fragment:
        parser.error("--check and --fragment cannot be used together")
    build(args.fragment, args.check)


if __name__ == "__main__":
    main()
