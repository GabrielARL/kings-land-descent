# Red-channel receiver BER table

[`red_hydrophone_ber.csv`](red_hydrophone_ber.csv) is one rectangular table for the requested Red recordings, hydrophones, pilot ratios, SNR values, and receivers. Every planned combination has a row. A result that is not yet available remains in the table with `status=missing`, a reason in `missing_reason`, and blank BER fields.

## Scope

The table contains 5,760 rows:

- Red recordings: 1, 2, 3, and 4
- Hydrophones: 1, 2, and 3
- Pilot ratios: 2.5%, 5%, 7.5%, 12%, and 15%
- SNR: 0 to 30 dB in 2 dB steps
- Receivers: `ofdm+fec`, `pfft+fec`, `jade`, `coral`, `cajode`, and `pearl`

Here, “all pilot ratios” means the five ratios in the current comparison. Older 20% pilot results exist but are outside this table. The common configuration is FFT length 1024, code rate 1/4, and 47 one-second frames per point.

The current CSV snapshot is `2026-10-25T04:15:46Z`. Its coverage is:

| Receiver | Available | Missing | Coverage |
|---|---:|---:|---:|
| OFDM + FEC | 960 | 0 | 100.0% |
| Partial FFT + FEC | 960 | 0 | 100.0% |
| JADE | 960 | 0 | 100.0% |
| CORAL | 960 | 0 | 100.0% |
| SAPPHIRE (`cajode`) | 960 | 0 | 100.0% |
| PEARL | 384 | 576 | 40.0% |
| **Total** | **5,184** | **576** | **90.0%** |

JADE and SAPPHIRE now include all five authenticated curves for each of the 12 recording–hydrophone cases. The refresh admits 160 Red 4/hydrophone 3 rows from fresh CAJODE attempt `R3-CAJODE-RED4-H3-BER-002` and JADE attempt `R3-JADE-RED4H3-BER-001`. Their completion-receipt SHA-256 values are `fdb3b01b40a7e4c8d69b054d04bddfba65c9b5ef3af7eb0588eae763d5f4e529` and `628e113d0895235fb4b057eef09f055a325211cfbe80077b1e801fc80576140d`. Recovery controller `red4h3-after-red4h2-004` completed with receipt SHA-256 `69fc52aec81b833940da1e0fa12cbdb793807f22a6d8899b9cb3ee09e5897b2b`. The terminal partial CAJODE attempt 001 remains immutable and excluded.

PEARL has complete curves at all five pilot ratios for Red 1/hydrophones 1–3 and Red 2/hydrophone 1. It also has complete 7.5% curves for Red 2/hydrophones 2–3 and Red 3/hydrophone 1. The earlier refresh admits 128 rows from the eight attempt-003 runs for the four-case plot scope at 2.5% and 5%. Controller `pearl-p025-p05-fill-after-red4h3-003` completed with receipt SHA-256 `61ad85320d98b263ff30c2245a52fbb49405fc8360dc31c6db8f939e4d559181`; its terminal attempt receipt has SHA-256 `6ebda4b432053f3b13bfe4e7d6ce37608b94196268decc233331dc3756ea6192`.

The current refresh adds the complete 2.5% curve for Red 2/hydrophone 2 from job `n1024-p025-red2-h2` in the active 37-job fill. Its immutable controller job receipt has SHA-256 `b85bbf6f46e4fbd8a431856a6ccac3a8d6085791435edb5d4f86df2a2872e7bd`; the result completion, frame, aggregate, and manifest hashes are pinned in the builder. The active sequential queue covers the remaining 36 unavailable PEARL case–pilot conditions. They remain marked `source_result_missing` until each complete result is authenticated and registered. The partial Red 3/hydrophone 2 artifact, which covers only SNR 0–14 dB, remains deliberately excluded.

## Receiver mapping and source cohorts

The receiver names in the table map to source receiver IDs as follows:

| Table receiver | Source receiver ID | Source cohort |
|---|---|---|
| `ofdm+fec` | `standard` | authenticated four-receiver Red replay |
| `pfft+fec` | `partial_fft` | authenticated four-receiver Red replay |
| `jade` | `jade` | modern R3 BER runs |
| `coral` | `jcade_regularized_power` | authenticated four-receiver Red replay |
| `cajode` (SAPPHIRE) | `cajode` | modern R3 BER runs, with at most 50 ADMM iterations |
| `pearl` | `joint_persistent_normalized_min_sum` | authenticated persistent R2-V1 runs, with at most 80 message-passing iterations |

`jcade_regularized_power` is the source identifier for the receiver named CORAL in the four-receiver deck. The older `jade_bp` rows in that source table are not substituted for missing modern JADE results; doing so would mix receiver generations inside one JADE curve. The paired 12% and 15% PEARL artifacts also contain `jade_bp`, but the builder filters those artifacts to `joint_persistent_normalized_min_sum` and does not replace the table's modern JADE rows.

SAPPHIRE is the current public name of the receiver stored under the stable key `cajode`. The frozen evidence snapshot and source artifacts retain the legacy display label `CAJODE`; the tutorial maps the stable key to SAPPHIRE only at the presentation boundary. No BER count changes as a result of the rename.

Source paths in the CSV are recorded relative to the common parent directory containing the source checkouts. `source_path` identifies the data used for that row. `evidence_path` identifies its aggregate or completion receipt. Both have adjacent SHA-256 columns.

## BER and zero-error points

`information_ber` is computed from the pooled payload-bit counts over the 47 frames:

```text
information_ber = total_bit_errors / total_payload_bits
```

It is not the unweighted mean of 47 frame BER values. An observed zero remains `information_ber=0` and is marked by `zero_observed_errors=true`. `plot_ber` uses `0.5 / total_payload_bits` only to place a zero-error point on a logarithmic plot; it is not a measured BER.

A missing result is never encoded as zero. Its `information_ber`, `total_bit_errors`, `total_payload_bits`, `frames_observed`, `zero_observed_errors`, and `plot_ber` fields are blank.

## Columns

| Column | Meaning |
|---|---|
| `red`, `hydrophone` | Measured Red recording and hydrophone index. |
| `pilot_id`, `pilot_ratio_percent` | Stable pilot identifier and pilot ratio in percent. |
| `snr_db` | Signal-to-noise ratio in dB. |
| `receiver`, `receiver_name` | Stable receiver ID and the display label recorded when the evidence snapshot was built. |
| `status` | `available` or `missing`. |
| `missing_reason` | Why a missing row has no result; blank for available rows. |
| `fft_length`, `code_rate` | Common waveform and code configuration. |
| `frames_expected`, `frames_observed` | Planned and authenticated frame counts for the point. |
| `payload_bits_per_frame` | Information bits scored in each frame. |
| `total_payload_bits`, `total_bit_errors` | Denominator and numerator used for Information BER. |
| `information_ber` | `total_bit_errors / total_payload_bits`. |
| `zero_observed_errors` | Whether all 47 frames produced zero observed information-bit errors. |
| `plot_ber` | Plotting value; equals Information BER except for observed zeros. |
| `source_receiver_id` | Receiver identifier in the source artifact. |
| `source_cohort` | Experiment family used for the row. |
| `source_path`, `source_sha256` | Source artifact and its recorded or checked SHA-256. |
| `evidence_path`, `evidence_sha256` | Aggregate or completion receipt and SHA-256. |
| `attempt_id`, `execution_identity_sha256` | Run identity when supplied by a modern raw result. |
| `snapshot_utc` | UTC time at which this table was rebuilt. |

## Reading and rebuilding

Open the CSV in a spreadsheet or any CSV-aware analysis tool. For example, this prints the Red 3/hydrophone 1 SAPPHIRE rows using their stable `cajode` key with Python’s standard CSV reader:

```bash
python3 -c 'import csv; f=open("results/red_hydrophone_ber/red_hydrophone_ber.csv"); r=csv.DictReader(f); print(*[x for x in r if x["red"]=="3" and x["hydrophone"]=="1" and x["receiver"]=="cajode"], sep="\n")'
```

Rebuild the table from the sibling result repositories with:

```bash
python3 -B results/red_hydrophone_ber/build_table.py
```

[`build_table.py`](build_table.py) checks the 5,760-key grid, rejects duplicate cells, requires all 47 frames before publishing a BER, recomputes BER from integer bit counts, checks the pinned aggregate hashes, and validates modern raw results against their completion receipts. PEARL admission additionally requires pinned artifact hashes, a complete 47-frame by 16-SNR manifest, the R2-V1 profile and 80-update contract, the frozen source commits and runner hash, a passing trace audit, and aggregate counts that match the filtered PEARL frame rows. New PEARL artifacts require an explicit hash-registry update before a rebuild can publish them.

## Evidence boundary

The table combines three explicitly named cohorts because that is how the current comparison is assembled: OFDM + FEC, Partial FFT + FEC, and CORAL come from the authenticated four-receiver Red replay; JADE and SAPPHIRE come from the newer R3 BER campaign; PEARL comes from the authenticated persistent R2-V1 campaign. The cohort, source file, source hash, and evidence file are retained on every available row so downstream plots can preserve that distinction.
