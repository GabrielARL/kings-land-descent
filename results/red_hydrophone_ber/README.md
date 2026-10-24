# Red-channel receiver BER table

[`red_hydrophone_ber.csv`](red_hydrophone_ber.csv) is one rectangular table for the requested Red recordings, hydrophones, pilot ratios, SNR values, and receivers. Every planned combination has a row. A result that is not yet available remains in the table with `status=missing`, a reason in `missing_reason`, and blank BER fields.

## Scope

The table contains 4,800 rows:

- Red recordings: 1, 2, 3, and 4
- Hydrophones: 1, 2, and 3
- Pilot ratios: 2.5%, 5%, 7.5%, 12%, and 15%
- SNR: 0 to 30 dB in 2 dB steps
- Receivers: `ofdm+fec`, `pfft+fec`, `jade`, `coral`, and `cajode`

Here, “all pilot ratios” means the five ratios in the current comparison. Older 20% pilot results exist but are outside this table. The common configuration is FFT length 1024, code rate 1/4, and 47 one-second frames per point.

The current CSV snapshot is `2026-10-24T01:02:51Z`. Its coverage is:

| Receiver | Available | Missing | Coverage |
|---|---:|---:|---:|
| OFDM + FEC | 960 | 0 | 100.0% |
| Partial FFT + FEC | 960 | 0 | 100.0% |
| JADE | 720 | 240 | 75.0% |
| CORAL | 960 | 0 | 100.0% |
| CAJODE | 720 | 240 | 75.0% |
| **Total** | **4,320** | **480** | **90.0%** |

JADE is missing all three Red 4 channels because those receiver runs have not started. CAJODE is missing Red 4/hydrophone 1 because the run is in progress without a complete authenticated aggregate, and Red 4/hydrophones 2 and 3 because those runs have not started. The completed cells for a run in progress are not reported as a curve before the run produces its authenticated aggregate.

## Receiver mapping and source cohorts

The receiver names in the table map to source receiver IDs as follows:

| Table receiver | Source receiver ID | Source cohort |
|---|---|---|
| `ofdm+fec` | `standard` | authenticated four-receiver Red replay |
| `pfft+fec` | `partial_fft` | authenticated four-receiver Red replay |
| `jade` | `jade` | modern R3 BER runs |
| `coral` | `jcade_regularized_power` | authenticated four-receiver Red replay |
| `cajode` | `cajode` | modern R3 BER runs, with at most 50 CAJODE updates |

`jcade_regularized_power` is the source identifier for the receiver named CORAL in the four-receiver deck. The older `jade_bp` rows in that source table are not substituted for missing modern JADE results; doing so would mix receiver generations inside one JADE curve.

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
| `receiver`, `receiver_name` | Stable receiver ID and display label. |
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

Open the CSV in a spreadsheet or any CSV-aware analysis tool. For example, this prints the Red 3/hydrophone 1 CAJODE rows with Python’s standard CSV reader:

```bash
python3 -c 'import csv; f=open("results/red_hydrophone_ber/red_hydrophone_ber.csv"); r=csv.DictReader(f); print(*[x for x in r if x["red"]=="3" and x["hydrophone"]=="1" and x["receiver"]=="cajode"], sep="\n")'
```

Rebuild the table from the sibling result repositories with:

```bash
python3 -B results/red_hydrophone_ber/build_table.py
```

[`build_table.py`](build_table.py) checks the 4,800-key grid, rejects duplicate cells, requires all 47 frames before publishing a BER, recomputes BER from integer bit counts, checks the pinned aggregate hashes, and validates modern raw results against their completion receipts. If a known future run gains a complete receipt and aggregate, rebuilding can replace its missing rows with authenticated results.

## Evidence boundary

The table combines two explicitly named cohorts because that is how the current comparison is assembled: OFDM + FEC, Partial FFT + FEC, and CORAL come from the authenticated four-receiver Red replay; JADE and CAJODE come from the newer R3 BER campaign. The cohort, source file, source hash, and evidence file are retained on every available row so downstream plots can preserve that distinction.
