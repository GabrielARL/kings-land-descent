#!/usr/bin/env python3
"""Build the three public pages for King's Land Descent.

    python3 -B source/simulator/build_page.py
    node source/simulator/test_engine.js
    node source/simulator/test_learning_flow.js
    node source/simulator/test_keep.js

page.html holds the markup and the styles; engine.js the lands, the weather and the walks (projected gradient,
L-BFGS, ADMM); fog.js the view of the land; board.js and board_parts.js the step-by-step board; game.js
walking, talking, following a hero, the trial and the race; app.js the map, relief and status windows.  The script
inlines the scripts and writes ../../index.html, ../../tutorial.html and ../../jade_keep_tutorial.html. All three
complete pages open directly in a browser; the optional web fonts load from their CDN. With --fragment PATH it
also writes the game page without its html, head and body tags.
"""
import argparse
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
# (template, output at the repository root, scripts it inlines)
PAGES = {
    "game": ("page.html", "index.html", ("engine.js", "fog.js", "board.js", "board_parts.js", "game.js", "app.js", "realm.js")),
    "tutorial": ("tutorial.html", "tutorial.html", ("engine.js", "board.js", "board_parts.js", "course.js", "realm.js")),
    "advanced": ("advanced.html", "jade_keep_tutorial.html", ("engine.js", "board.js", "keep.js", "advanced_parts.js", "advanced_course.js", "realm.js")),
}


def inline(page, scripts):
    for name in scripts:
        tag = f'<script src="{name}"></script>'
        assert page.count(tag) == 1, name
        code = (HERE / name).read_text()
        assert "</script" not in code.lower(), name
        page = page.replace(tag, "<script>\n" + code + "</script>")
    return page


def build(which, fragment=None):
    template, out, scripts = PAGES[which]
    page = inline((HERE / template).read_text(), scripts)
    head, marker, body = page.partition("<!-- body -->\n")
    assert marker, template + " has no body marker"
    path = ROOT / out
    path.write_text('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
                    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                    + head + "</head>\n<body>\n" + body + "</body>\n</html>\n")
    print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")
    if fragment:
        fragment.write_text(page)
        print(f"wrote {fragment}")


def main():
    parser = argparse.ArgumentParser(description="Build index.html, tutorial.html and jade_keep_tutorial.html from their templates and scripts.")
    parser.add_argument("--fragment", type=Path, help="also write the game page without its html, head and body tags")
    parser.add_argument("--tutorial-fragment", type=Path, help="also write the tutorial page without its html, head and body tags")
    parser.add_argument("--advanced-fragment", type=Path, help="also write the Jade Keep page without its html, head and body tags")
    args = parser.parse_args()
    build("game", args.fragment)
    build("tutorial", args.tutorial_fragment)
    build("advanced", args.advanced_fragment)


if __name__ == "__main__":
    main()
