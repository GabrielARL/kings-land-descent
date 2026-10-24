#!/usr/bin/env python3
"""Build five_receivers_on_red.html, the tutorial "Five receivers on the Red recordings": how to read the Red-channel
receiver BER table in results/red_hydrophone_ber, told with the player of the King's Land tutorials.

    python3 -B source/red_ber/build_ber.py            (from the repository)
    node source/red_ber/test_ber.js

The build first turns the table into ber_data.js: it checks the 4,800-row grid, the 47 frames and the integer bit
counts of every available row, the blank fields of every missing row, and records the CSV's SHA-256.  When the CSV is
absent (for example in a checkout without the results folder) the committed ber_data.js is used as it is.
five_receivers.html holds the markup and the styles (those of the soldier tutorial); board.js and realm.js come from
source/simulator; ber.js pools the counts, ber_parts.js draws and ber_course.js tells the story.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SIMULATOR = HERE.parent / "simulator"
CSV = ROOT / "results" / "red_hydrophone_ber" / "red_hydrophone_ber.csv"
DATA = HERE / "ber_data.js"
OUT = ROOT / "five_receivers_on_red.html"
SCRIPTS = {"board.js": SIMULATOR / "board.js", "ber_data.js": DATA, "ber.js": HERE / "ber.js", "ber_parts.js": HERE / "ber_parts.js",
           "ber_course.js": HERE / "ber_course.js", "realm.js": SIMULATOR / "realm.js"}
RECEIVERS = ["ofdm+fec", "pfft+fec", "jade", "coral", "cajode"]


def data_from_csv(path):
    """The table as compact arrays, after checking every row it relies on."""
    raw = path.read_bytes()
    rows = list(csv.DictReader(raw.decode("utf-8").splitlines()))
    assert len(rows) == 4800, len(rows)
    reds = sorted({int(r["red"]) for r in rows})
    hyds = sorted({int(r["hydrophone"]) for r in rows})
    snrs = sorted({int(float(r["snr_db"])) for r in rows})
    pilots = sorted({(r["pilot_id"], float(r["pilot_ratio_percent"])) for r in rows}, key=lambda q: q[1])
    assert reds == [1, 2, 3, 4] and hyds == [1, 2, 3] and snrs == list(range(0, 31, 2)) and len(pilots) == 5
    assert sorted({r["receiver"] for r in rows}) == sorted(RECEIVERS)
    keys = {(r["red"], r["hydrophone"], r["pilot_id"], r["snr_db"], r["receiver"]) for r in rows}
    assert len(keys) == 4800, "duplicate grid keys"
    snapshot = {r["snapshot_utc"] for r in rows}
    assert len(snapshot) == 1
    assert {(r["fft_length"], r["code_rate"], r["frames_expected"]) for r in rows} == {("1024", "1/4", "47")}
    payload = {}
    names, cohorts, sources = {}, {}, {}
    errors = {k: [[None] * len(hyds) for _ in reds] for k in RECEIVERS}
    missing = {}
    for r in rows:
        k, ri, hi = r["receiver"], int(r["red"]) - 1, int(r["hydrophone"]) - 1
        pi = [p[0] for p in pilots].index(r["pilot_id"])
        si = snrs.index(int(float(r["snr_db"])))
        names[k] = r["receiver_name"]
        if r["status"] == "missing":
            assert all(r[f] == "" for f in ("information_ber", "total_bit_errors", "total_payload_bits", "frames_observed", "zero_observed_errors", "plot_ber")), "missing row with values"
            assert r["missing_reason"], "missing row without a reason"
            reason = missing.setdefault((k, ri, hi), r["missing_reason"])
            assert reason == r["missing_reason"], "one channel with two missing reasons"
            continue
        assert r["status"] == "available" and r["missing_reason"] == ""
        assert int(r["frames_observed"]) == 47
        per = int(r["payload_bits_per_frame"])
        assert payload.setdefault(pi, per) == per, "payload bits differ within one pilot ratio"
        bits, errs = int(r["total_payload_bits"]), int(r["total_bit_errors"])
        assert bits == 47 * per and 0 <= errs <= bits
        assert abs(float(r["information_ber"]) - errs / bits) <= 1e-15
        assert (r["zero_observed_errors"] == "true") == (errs == 0)
        assert abs(float(r["plot_ber"]) - (0.5 / bits if errs == 0 else errs / bits)) <= 1e-15
        cohorts.setdefault(k, set()).add(r["source_cohort"])
        sources.setdefault(k, set()).add(r["source_receiver_id"])
        cell = errors[k][ri][hi]
        if cell is None:
            cell = errors[k][ri][hi] = [[None] * len(snrs) for _ in pilots]
        cell[pi][si] = errs
    for k in RECEIVERS:
        for ri in range(len(reds)):
            for hi in range(len(hyds)):
                cell = errors[k][ri][hi]
                assert (cell is None) == ((k, ri, hi) in missing), "a channel is partly missing"
                assert cell is None or all(v is not None for row in cell for v in row)
    return {
        "snapshot": snapshot.pop(), "csvSha256": hashlib.sha256(raw).hexdigest(), "rows": len(rows),
        "fftLength": 1024, "codeRate": "1/4", "frames": 47, "recordings": reds, "hydrophones": hyds, "snrs": snrs,
        "pilots": [{"id": p[0], "ratio": p[1], "payload": payload[i]} for i, p in enumerate(pilots)],
        "receivers": [{"id": k, "name": names[k], "cohort": sorted(cohorts.get(k, {""}))[0], "sourceId": sorted(sources.get(k, {""}))[0]} for k in RECEIVERS],
        "errors": errors,
        "missing": [{"receiver": k, "red": ri + 1, "hydrophone": hi + 1, "reason": reason} for (k, ri, hi), reason in sorted(missing.items(), key=lambda q: (RECEIVERS.index(q[0][0]), q[0][1], q[0][2]))],
    }


def data_js(data):
    body = json.dumps(data, separators=(",", ":"), sort_keys=True)
    return ("// Generated by build_ber.py from results/red_hydrophone_ber/red_hydrophone_ber.csv; do not edit by hand.\n"
            "// errors[receiver][recording − 1][hydrophone − 1][pilot][snr] = bit errors in 47 frames, or null when the channel is missing.\n"
            "(function (root) {\n  var D = " + body + ";\n"
            "  if (typeof module !== 'undefined' && module.exports) module.exports = D; else root.BerData = D;\n"
            "})(this);\n")


def render():
    page = (HERE / "five_receivers.html").read_text()
    for name, path in SCRIPTS.items():
        tag = f'<script src="{name}"></script>'
        assert page.count(tag) == 1, name
        code = path.read_text()
        assert "</script" not in code.lower(), name
        page = page.replace(tag, "<script>\n" + code + "</script>")
    head, marker, body = page.partition("<!-- body -->\n")
    assert marker, "five_receivers.html has no body marker"
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + head + "</head>\n<body>\n" + body + "</body>\n</html>\n")


def build(check=False):
    if CSV.exists():
        fresh = data_js(data_from_csv(CSV))
        if check:
            if not DATA.exists() or DATA.read_text() != fresh:
                raise SystemExit("stale ber_data.js: run build_ber.py")
        elif not DATA.exists() or DATA.read_text() != fresh:
            DATA.write_text(fresh)
            print(f"wrote {DATA.name} from {CSV.name}")
    elif not DATA.exists():
        raise SystemExit(f"neither {CSV} nor {DATA.name} exists")
    rendered = render()
    if check:
        if not OUT.exists() or OUT.read_text() != rendered:
            raise SystemExit(f"stale generated page: run {Path(__file__).name}")
        print(f"ok {OUT.name} is current ({OUT.stat().st_size} bytes)")
        return
    OUT.write_text(rendered)
    print(f"wrote {OUT.name} ({OUT.stat().st_size} bytes)")


def main():
    parser = argparse.ArgumentParser(description="Build five_receivers_on_red.html from the BER table and its scripts.")
    parser.add_argument("--check", action="store_true", help="fail without writing if the data file or the page is stale")
    build(parser.parse_args().check)


if __name__ == "__main__":
    main()
