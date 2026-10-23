#!/usr/bin/env python3
"""Build finding_the_tear.html, the tutorial "Finding the tear": a torn-net inspection posed as optimization with
constraints in the manner of CAJODE, told with the player of the King's Land tutorials.

    python3 -B source/torn_net/build_net.py          (from the repository)
    node source/torn_net/test_net.js

net.html holds the markup and the styles (those of tutorial.html); board.js, the kit and the step player, comes
from the simulator folder of deck lbgfs_admm_diff_no_math; net.js holds the case and the solver, net_parts.js the
drawings and net_course.js the story.  With --fragment PATH the page is also written without its html, head
and body tags, the form in which it is published as a claude.ai artifact.
"""
import argparse
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SIMULATOR = HERE.parent / "simulator"
SCRIPTS = {"board.js": SIMULATOR / "board.js", "net.js": HERE / "net.js", "net_parts.js": HERE / "net_parts.js", "net_course.js": HERE / "net_course.js", "realm.js": SIMULATOR / "realm.js"}


def render():
    page = (HERE / "net.html").read_text()
    for name, path in SCRIPTS.items():
        tag = f'<script src="{name}"></script>'
        assert page.count(tag) == 1, name
        code = path.read_text()
        assert "</script" not in code.lower(), name
        page = page.replace(tag, "<script>\n" + code + "</script>")
    head, marker, body = page.partition("<!-- body -->\n")
    assert marker, "net.html has no body marker"
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + head + "</head>\n<body>\n" + body + "</body>\n</html>\n"), page


def build(fragment=None, check=False):
    rendered, page = render()
    out = ROOT / "finding_the_tear.html"
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
    parser = argparse.ArgumentParser(description="Build finding_the_tear.html from net.html and its scripts.")
    parser.add_argument("--fragment", type=Path, help="also write the page without its html, head and body tags")
    parser.add_argument("--check", action="store_true", help="fail without writing if the standalone page is stale")
    args = parser.parse_args()
    if args.check and args.fragment:
        parser.error("--check and --fragment cannot be used together")
    build(args.fragment, args.check)


if __name__ == "__main__":
    main()
