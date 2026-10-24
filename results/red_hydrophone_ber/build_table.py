#!/usr/bin/env python3
"""Build the rectangular Red-channel information-BER table.

The output has one row for every requested
(Red, hydrophone, pilot ratio, SNR, receiver) combination.  A row is marked
available only when its source contains all 47 one-second frames.
"""

from __future__ import annotations

import csv
import hashlib
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


HERE = Path(__file__).resolve().parent
REPOSITORY = HERE.parents[1]
GITHUB_ROOT = REPOSITORY.parent
OUTPUT = HERE / "red_hydrophone_ber.csv"

PILOTS = {
    "p025": (2.5, 2284),
    "p05": (5.0, 2024),
    "p075": (7.5, 1774),
    "p12": (12.0, 1314),
    "p15": (15.0, 1004),
}
PILOT_BY_PERCENT = {percent: pilot for pilot, (percent, _) in PILOTS.items()}
SNRS = tuple(range(0, 31, 2))
RECEIVERS = {
    "ofdm+fec": "OFDM + FEC",
    "pfft+fec": "Partial FFT + FEC",
    "jade": "JADE",
    "coral": "CORAL",
    "cajode": "CAJODE",
}
RECEIVER_ORDER = {receiver: index for index, receiver in enumerate(RECEIVERS)}
FRAMES_EXPECTED = 47

FOUR_RECEIVER_CELLS = (
    GITHUB_ROOT
    / "JadeJcade/paper/four_receivers_slides/four_receivers_slides_assets/data/cells.csv"
)
FOUR_RECEIVER_CELLS_SHA256 = (
    "289fb42cf3963ef22b08cd2d601c14dfe9ef43a5bd513a7e27363cc9f98ec5b5"
)

R3_AGGREGATES = {
    (1, 1): GITHUB_ROOT
    / "JadeJcade/paper/p1/p1_assets/data/results_story/red1_h1_four_receiver_ber.csv",
    (1, 2): GITHUB_ROOT
    / "CAJODE/soldier_v2_assets/data/results_story/red1_h2_four_receiver_ber.csv",
    (1, 3): GITHUB_ROOT
    / "CAJODE/soldier_v2_assets/data/results_story/red1_h3_four_receiver_ber.csv",
    (2, 1): GITHUB_ROOT
    / "CAJODE/soldier_v2_assets/data/results_story/red2_h1_four_receiver_ber.csv",
    (2, 2): GITHUB_ROOT
    / "CAJODE/soldier_v2_assets/data/results_story/red2_h2_four_receiver_ber.csv",
    (2, 3): GITHUB_ROOT
    / "CAJODE/soldier_v2_assets/data/results_story/red2_h3_four_receiver_ber.csv",
}
R3_AGGREGATE_SHA256 = {
    (1, 1): "1b580a889e1b4643e7fbcff67ae64157e1ed0b5df1d2f8f6afe46c21b7b4b933",
    (1, 2): "8894cd384b3879874c6397948e5ff448751174fc2f876e6836a135ff0f6f623e",
    (1, 3): "fc6563d18dc412c8d4b2bb785956d30a752c7961fa9e766dc27cbee3d47a0cef",
    (2, 1): "b585d971e120964be354b848436ebf059821c6e97b1de841419233ae594447b7",
    (2, 2): "d407ea79640d9534ea3e81fd0e907070e14547099abb9249589a4a18218c2000",
    (2, 3): "97be4afabb1de9d89dc2d6c85d4e8c44255119d168990b19c34d044813452f17",
}

# Complete sources plus known run locations that can become complete later.
MODERN_RUNS = {
    (3, 1, "jade"): GITHUB_ROOT / "JadeJcade-runs/r3-jade-red3h1-ber-001",
    (3, 2, "jade"): GITHUB_ROOT / "JadeJcade-runs/r3-jade-red3h2-ber-001",
    (3, 3, "jade"): GITHUB_ROOT / "JadeJcade-runs/r3-jade-red3h3-ber-001",
    (3, 1, "cajode"): GITHUB_ROOT
    / "CAJODE_simulations-worktrees/r3-cajode-red3h1-ber-001-20261022/results/cajode-red3-h1-ber-001",
    (3, 2, "cajode"): GITHUB_ROOT
    / "CAJODE_simulations-worktrees/r3-cajode-red3h2-ber-001-20261022/results/cajode-red3-h2-ber-001",
    (3, 3, "cajode"): GITHUB_ROOT
    / "CAJODE_simulations-worktrees/r3-cajode-red3h3-ber-001-20261022/results/cajode-red3-h3-ber-001",
    (4, 1, "jade"): GITHUB_ROOT / "JadeJcade-runs/r3-jade-red4h1-ber-001",
    (4, 2, "jade"): GITHUB_ROOT / "JadeJcade-runs/r3-jade-red4h2-ber-001",
    (4, 3, "jade"): GITHUB_ROOT / "JadeJcade-runs/r3-jade-red4h3-ber-001",
    (4, 1, "cajode"): GITHUB_ROOT
    / "CAJODE_simulations-worktrees/r3-cajode-red4h1-ber-002-20261024/results/cajode-red4-h1-ber-002",
    (4, 2, "cajode"): GITHUB_ROOT
    / "CAJODE_simulations-worktrees/r3-cajode-red4h2-ber-001-20261024/results/cajode-red4-h2-ber-001",
    (4, 3, "cajode"): GITHUB_ROOT
    / "CAJODE_simulations-worktrees/r3-cajode-red4h3-ber-001-20261024/results/cajode-red4-h3-ber-001",
}

# Snapshot state for known runs that have not yet produced authenticated aggregates.
# A completed run is promoted to available by load_modern_run, which clears this reason.
MODERN_MISSING_REASONS = {
    (4, 1, "jade"): "run_not_started",
    (4, 2, "jade"): "run_not_started",
    (4, 3, "jade"): "run_not_started",
    (4, 1, "cajode"): "run_in_progress_no_complete_aggregate",
    (4, 2, "cajode"): "run_not_started",
    (4, 3, "cajode"): "run_not_started",
}

FIELDS = (
    "red",
    "hydrophone",
    "pilot_id",
    "pilot_ratio_percent",
    "snr_db",
    "receiver",
    "receiver_name",
    "status",
    "missing_reason",
    "fft_length",
    "code_rate",
    "frames_expected",
    "frames_observed",
    "payload_bits_per_frame",
    "total_payload_bits",
    "total_bit_errors",
    "information_ber",
    "zero_observed_errors",
    "plot_ber",
    "source_receiver_id",
    "source_cohort",
    "source_path",
    "source_sha256",
    "evidence_path",
    "evidence_sha256",
    "attempt_id",
    "execution_identity_sha256",
    "snapshot_utc",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def require_hash(path: Path, expected: str) -> str:
    if not path.is_file():
        raise FileNotFoundError(path)
    actual = sha256(path)
    if actual != expected:
        raise ValueError(f"SHA-256 mismatch for {path}: {actual} != {expected}")
    return actual


def read_top_level_toml(path: Path) -> dict[str, object]:
    """Read the simple top-level scalar fields used by completion receipts."""
    result: dict[str, object] = {}
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("["):
            break
        name, separator, raw_value = line.partition("=")
        if not separator:
            continue
        value = raw_value.strip()
        if value.startswith('"') and value.endswith('"'):
            parsed: object = value[1:-1]
        elif value in ("true", "false"):
            parsed = value == "true"
        else:
            try:
                parsed = int(value)
            except ValueError:
                parsed = value
        result[name.strip()] = parsed
    return result


def source_path(path: Path | str) -> str:
    """Represent a local source relative to the shared GitHub directory."""
    text = str(path)
    prefix = "~/Documents/GitHub/"
    if text.startswith(prefix):
        return text[len(prefix) :]
    resolved = Path(text).expanduser().resolve()
    try:
        return str(resolved.relative_to(GITHUB_ROOT))
    except ValueError:
        return str(resolved)


def key(red: int, hydrophone: int, pilot: str, snr: int, receiver: str) -> tuple:
    return red, hydrophone, pilot, snr, receiver


def blank_row(
    red: int,
    hydrophone: int,
    pilot: str,
    snr: int,
    receiver: str,
    snapshot: str,
) -> dict[str, object]:
    pilot_percent, payload_bits = PILOTS[pilot]
    if receiver in ("jade", "cajode"):
        reason = MODERN_MISSING_REASONS.get(
            (red, hydrophone, receiver), "source_result_missing"
        )
        cohort = "modern_r3_ber"
    else:
        reason = "source_result_missing"
        cohort = "four_receivers_red_replay"
    return {
        "red": red,
        "hydrophone": hydrophone,
        "pilot_id": pilot,
        "pilot_ratio_percent": format_number(pilot_percent),
        "snr_db": snr,
        "receiver": receiver,
        "receiver_name": RECEIVERS[receiver],
        "status": "missing",
        "missing_reason": reason,
        "fft_length": 1024,
        "code_rate": "1/4",
        "frames_expected": FRAMES_EXPECTED,
        "frames_observed": "",
        "payload_bits_per_frame": payload_bits,
        "total_payload_bits": "",
        "total_bit_errors": "",
        "information_ber": "",
        "zero_observed_errors": "",
        "plot_ber": "",
        "source_receiver_id": "",
        "source_cohort": cohort,
        "source_path": "",
        "source_sha256": "",
        "evidence_path": "",
        "evidence_sha256": "",
        "attempt_id": "",
        "execution_identity_sha256": "",
        "snapshot_utc": snapshot,
    }


def format_number(value: float) -> str:
    return format(value, ".17g")


def set_available(
    row: dict[str, object],
    *,
    frames: int,
    payload_bits: int,
    total_bits: int,
    errors: int,
    source_receiver: str,
    cohort: str,
    data_path: str,
    data_sha256: str,
    evidence_path: str,
    evidence_sha256: str,
    attempt_id: str = "",
    execution_identity: str = "",
) -> None:
    if frames != FRAMES_EXPECTED:
        raise ValueError(f"incomplete cell: expected 47 frames, found {frames}")
    if total_bits != frames * payload_bits:
        raise ValueError(f"payload total mismatch: {total_bits} != {frames} * {payload_bits}")
    if errors < 0 or errors > total_bits:
        raise ValueError(f"invalid bit-error count: {errors}/{total_bits}")
    ber = errors / total_bits
    row.update(
        {
            "status": "available",
            "missing_reason": "",
            "frames_observed": frames,
            "payload_bits_per_frame": payload_bits,
            "total_payload_bits": total_bits,
            "total_bit_errors": errors,
            "information_ber": format_number(ber),
            "zero_observed_errors": str(errors == 0).lower(),
            "plot_ber": format_number(0.5 / total_bits if errors == 0 else ber),
            "source_receiver_id": source_receiver,
            "source_cohort": cohort,
            "source_path": data_path,
            "source_sha256": data_sha256,
            "evidence_path": evidence_path,
            "evidence_sha256": evidence_sha256,
            "attempt_id": attempt_id,
            "execution_identity_sha256": execution_identity,
        }
    )


def load_baselines_and_coral(rows: dict[tuple, dict[str, object]]) -> None:
    cells_sha = require_hash(FOUR_RECEIVER_CELLS, FOUR_RECEIVER_CELLS_SHA256)
    receiver_map = {
        "standard": "ofdm+fec",
        "partial_fft": "pfft+fec",
        "jcade_regularized_power": "coral",
    }
    seen = set()
    with FOUR_RECEIVER_CELLS.open(newline="") as handle:
        for item in csv.DictReader(handle):
            source_receiver = item["receiver"]
            if source_receiver not in receiver_map:
                continue
            percent = float(item["pilot_percent"])
            if percent not in PILOT_BY_PERCENT:
                continue
            receiver = receiver_map[source_receiver]
            red = int(item["capture"])
            hydrophone = int(item["hydrophone"])
            pilot = PILOT_BY_PERCENT[percent]
            snr = int(float(item["snr_db"]))
            cell_key = key(red, hydrophone, pilot, snr, receiver)
            if cell_key in seen:
                raise ValueError(f"duplicate source cell: {cell_key}")
            seen.add(cell_key)
            frames = int(item["frames"])
            total_bits = int(item["decoded_bits"])
            payload_bits = total_bits // frames
            if payload_bits != PILOTS[pilot][1]:
                raise ValueError(f"unexpected payload size for {cell_key}: {payload_bits}")
            set_available(
                rows[cell_key],
                frames=frames,
                payload_bits=payload_bits,
                total_bits=total_bits,
                errors=int(item["bit_errors"]),
                source_receiver=source_receiver,
                cohort="four_receivers_red_replay",
                data_path=source_path(item["source"]),
                data_sha256=item["source_sha256"],
                evidence_path=source_path(FOUR_RECEIVER_CELLS),
                evidence_sha256=cells_sha,
            )
    expected = 3 * 4 * 3 * len(PILOTS) * len(SNRS)
    if len(seen) != expected:
        raise ValueError(f"baseline/CORAL coverage is {len(seen)}, expected {expected}")


def load_r3_aggregates(rows: dict[tuple, dict[str, object]]) -> None:
    for channel, path in R3_AGGREGATES.items():
        aggregate_sha = require_hash(path, R3_AGGREGATE_SHA256[channel])
        evidence = path.with_suffix(".json")
        evidence_sha = sha256(evidence)
        seen = set()
        with path.open(newline="") as handle:
            for item in csv.DictReader(handle):
                receiver = item["receiver"]
                if receiver not in ("jade", "cajode"):
                    continue
                red, hydrophone = channel
                if (int(item["capture"]), int(item["hydrophone"])) != channel:
                    raise ValueError(f"channel mismatch in {path}")
                pilot = item["pilot_id"]
                snr = int(float(item["snr_db"]))
                cell_key = key(red, hydrophone, pilot, snr, receiver)
                if cell_key in seen:
                    raise ValueError(f"duplicate R3 aggregate cell: {cell_key}")
                seen.add(cell_key)
                frames = int(item["frames"])
                payload_bits = int(item["payload_bits_per_frame"])
                total_bits = int(item["total_bits"])
                errors = int(item["total_bit_errors"])
                if abs(float(item["ber"]) - errors / total_bits) > 1e-15:
                    raise ValueError(f"BER mismatch in {path}: {cell_key}")
                set_available(
                    rows[cell_key],
                    frames=frames,
                    payload_bits=payload_bits,
                    total_bits=total_bits,
                    errors=errors,
                    source_receiver=receiver,
                    cohort="modern_r3_ber",
                    data_path=source_path(path),
                    data_sha256=aggregate_sha,
                    evidence_path=source_path(evidence),
                    evidence_sha256=evidence_sha,
                )
        expected = 2 * len(PILOTS) * len(SNRS)
        if len(seen) != expected:
            raise ValueError(f"R3 aggregate coverage in {path} is {len(seen)}, expected {expected}")


def completion_metadata(root: Path, receiver: str) -> tuple[dict, Path] | None:
    completion = root / "completion.toml"
    frames = root / "frames.csv"
    if not completion.is_file() or not frames.is_file():
        return None
    meta = read_top_level_toml(completion)
    if meta.get("status") != "complete":
        return None
    expected_cases = int(meta.get("expected_cases", meta.get("case_count", -1)))
    completed_cases = int(meta.get("completed_cases", meta.get("case_count", -2)))
    if expected_cases != 3760 or completed_cases != 3760:
        return None
    hash_key = "frames_sha256" if receiver == "cajode" else "frames_csv_sha256"
    require_hash(frames, meta[hash_key])
    return meta, completion


def load_modern_run(
    rows: dict[tuple, dict[str, object]],
    red: int,
    hydrophone: int,
    receiver: str,
    root: Path,
) -> bool:
    completion = completion_metadata(root, receiver)
    if completion is None:
        return False
    meta, completion_path = completion
    frames_path = root / "frames.csv"
    grouped: dict[tuple[str, int], list[dict[str, str]]] = defaultdict(list)
    with frames_path.open(newline="") as handle:
        for item in csv.DictReader(handle):
            if item["receiver"] != receiver:
                raise ValueError(f"unexpected receiver in {frames_path}: {item['receiver']}")
            if (int(item["capture"]), int(item["hydrophone"])) != (red, hydrophone):
                raise ValueError(f"channel mismatch in {frames_path}")
            if receiver == "cajode" and item["scored"].lower() != "true":
                raise ValueError(f"unscored CAJODE row in {frames_path}")
            if receiver == "jade" and item["status"] != "decoded":
                raise ValueError(f"undecoded JADE row in {frames_path}")
            grouped[(item["pilot_id"], int(float(item["snr_db"])))].append(item)
    expected_cells = {(pilot, snr) for pilot in PILOTS for snr in SNRS}
    if set(grouped) != expected_cells:
        raise ValueError(f"cell coverage mismatch in {frames_path}")
    data_sha = sha256(frames_path)
    evidence_sha = sha256(completion_path)
    for (pilot, snr), group in grouped.items():
        frames = {int(item["frame"]) for item in group}
        if frames != set(range(1, FRAMES_EXPECTED + 1)):
            raise ValueError(f"frame coverage mismatch in {frames_path}: {pilot}/{snr}")
        payload_sizes = {int(item["payload_bits"]) for item in group}
        if len(payload_sizes) != 1:
            raise ValueError(f"payload-size mismatch in {frames_path}: {pilot}/{snr}")
        payload_bits = payload_sizes.pop()
        error_field = "payload_errors" if receiver == "cajode" else "bit_errors"
        errors = sum(int(item[error_field]) for item in group)
        total_bits = sum(int(item["payload_bits"]) for item in group)
        attempts = {item["attempt_id"] for item in group}
        if len(attempts) != 1:
            raise ValueError(f"attempt mismatch in {frames_path}: {pilot}/{snr}")
        set_available(
            rows[key(red, hydrophone, pilot, snr, receiver)],
            frames=len(group),
            payload_bits=payload_bits,
            total_bits=total_bits,
            errors=errors,
            source_receiver=receiver,
            cohort="modern_r3_ber",
            data_path=source_path(frames_path),
            data_sha256=data_sha,
            evidence_path=source_path(completion_path),
            evidence_sha256=evidence_sha,
            attempt_id=attempts.pop(),
            execution_identity=str(meta.get("execution_identity_sha256", "")),
        )
    return True


def validate(rows: dict[tuple, dict[str, object]]) -> None:
    expected_count = 4 * 3 * len(PILOTS) * len(SNRS) * len(RECEIVERS)
    if len(rows) != expected_count:
        raise ValueError(f"table has {len(rows)} keys, expected {expected_count}")
    for cell_key, row in rows.items():
        if row["status"] == "available":
            if row["missing_reason"]:
                raise ValueError(f"available row has a missing reason: {cell_key}")
            if int(row["frames_observed"]) != FRAMES_EXPECTED:
                raise ValueError(f"available row is incomplete: {cell_key}")
            total = int(row["total_payload_bits"])
            errors = int(row["total_bit_errors"])
            if abs(float(row["information_ber"]) - errors / total) > 1e-15:
                raise ValueError(f"BER mismatch: {cell_key}")
        elif row["status"] == "missing":
            if not row["missing_reason"]:
                raise ValueError(f"missing row lacks a reason: {cell_key}")
            for field in (
                "frames_observed",
                "total_payload_bits",
                "total_bit_errors",
                "information_ber",
                "zero_observed_errors",
                "plot_ber",
            ):
                if row[field] != "":
                    raise ValueError(f"missing row has a value in {field}: {cell_key}")
        else:
            raise ValueError(f"unknown status in {cell_key}: {row['status']}")


def main() -> None:
    snapshot = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    rows = {
        key(red, hydrophone, pilot, snr, receiver): blank_row(
            red, hydrophone, pilot, snr, receiver, snapshot
        )
        for red in range(1, 5)
        for hydrophone in range(1, 4)
        for pilot in PILOTS
        for snr in SNRS
        for receiver in RECEIVERS
    }
    load_baselines_and_coral(rows)
    load_r3_aggregates(rows)
    completed_dynamic = []
    for (red, hydrophone, receiver), root in MODERN_RUNS.items():
        if load_modern_run(rows, red, hydrophone, receiver, root):
            completed_dynamic.append(f"red{red}/h{hydrophone}/{receiver}")
    validate(rows)
    ordered = sorted(
        rows.values(),
        key=lambda row: (
            int(row["red"]),
            int(row["hydrophone"]),
            tuple(PILOTS).index(str(row["pilot_id"])),
            int(row["snr_db"]),
            RECEIVER_ORDER[str(row["receiver"])],
        ),
    )
    with OUTPUT.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(ordered)
    available = sum(row["status"] == "available" for row in ordered)
    print(f"wrote {len(ordered)} rows to {OUTPUT}")
    print(f"available={available} missing={len(ordered) - available}")
    print("complete modern roots: " + ", ".join(completed_dynamic))


if __name__ == "__main__":
    main()
