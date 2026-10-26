#!/usr/bin/env python3
"""Build the rectangular Red-channel information-BER table.

The output has one row for every requested
(Red, hydrophone, pilot ratio, SNR, receiver) combination.  A row is marked
available only when its source contains all 47 one-second frames.
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


HERE = Path(__file__).resolve().parent
REPOSITORY = HERE.parents[1]
GITHUB_ROOT = REPOSITORY.parent
if not (GITHUB_ROOT / "JadeJcade").is_dir():
    GITHUB_ROOT = REPOSITORY.parents[1]
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
    "pearl": "PEARL",
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
    / "CAJODE_simulations-worktrees/r3-cajode-red4h3-ber-002-20261024/results/cajode-red4-h3-ber-002",
}

# Snapshot state for known runs that have not yet produced authenticated aggregates.
# A completed run is promoted to available by load_modern_run, which clears this reason.
MODERN_MISSING_REASONS = {}

PEARL_RECEIVER = "joint_persistent_normalized_min_sum"
PEARL_COHORT = "persistent_r2_v1"
PEARL_SOURCE_COMMIT = "1c577f5a611b8e8e545707dc9bf0e28af8fd3091"
PEARL_PAPER_SOURCE_COMMIT = "590347bb8fb09af2e8b4f8bd5d7322a411853a1e"
PEARL_RUNNER = "experiments/jade_red12/run_paper_graph.jl"
PEARL_RUNNER_SHA256 = (
    "ffc89ecd0817e015ee86105987501b80210ef932bb0f31d30e2c99c23e18c58c"
)
PEARL_GRAPH_SHA256 = (
    "fd8a50fb12c3206cbed2df604168bc2aa7d338b5a4317efdc4974a7c913bf9e7"
)
PEARL_PROFILE = {
    "belief_damping": 1.0,
    "channel_extrinsic_scale": 0.5,
    "channel_llr_scale": 1.0,
    "channel_mode": "gradient",
    "channel_step_size": 0.1,
    "channel_update_interval": 2,
    "check_rule": "normalized_min_sum",
    "early_exit": True,
    "factor_counting_weight": 1.0,
    "include_variance": True,
    "iterations": 80,
    "max_backtracks": 16,
    "message_damping": 1.0,
    "message_retention": 0.9,
    "minimum_iterations": 1,
    "normalized_minsum_alpha": 0.8,
    "temperature": 1.0,
    "variance_weight": 1.0,
}

PEARL_P075_DISTRIBUTED = (
    GITHUB_ROOT
    / "JadeJcade-runs/persistent-p075-distributed-20261011/thinkpad-attempt-001"
)
PEARL_P075_TAKEOVER = (
    GITHUB_ROOT
    / "JadeJcade-runs/persistent-p075-local-takeover-20261011/attempt-001"
)
PEARL_P12_P15 = (
    GITHUB_ROOT
    / "JadeJcade-runs/persistent-p12-p15-distributed-001/thinkpad/attempt-002/jobs"
)
PEARL_P025_P05 = (
    GITHUB_ROOT / "JadeJcade-runs/pearl-p025-p05-fill-001/attempt-003"
)
PEARL_REMAINING37 = (
    GITHUB_ROOT / "JadeJcade-runs/pearl-remaining37-fill-001/attempt-001"
)
PEARL_REMAINING37_KEYS = tuple(
    (red, hydrophone, pilot)
    for red, hydrophone in (
        (2, 2),
        (2, 3),
        (3, 1),
        (3, 2),
        (3, 3),
        (4, 1),
        (4, 2),
        (4, 3),
    )
    for pilot in PILOTS
    if not (pilot == "p075" and (red, hydrophone) in ((2, 2), (2, 3), (3, 1)))
)
# Every listed root is authenticated by the pinned SHA-256 registry below and
# must also satisfy the embedded completion, manifest, frame, aggregate, and
# trace-audit contracts before it is admitted.
PEARL_RUNS = {
    (1, 1, "p075"): PEARL_P075_DISTRIBUTED / "red1-h1",
    (1, 2, "p075"): PEARL_P075_DISTRIBUTED / "red1-h2",
    (1, 3, "p075"): PEARL_P075_DISTRIBUTED / "red1-h3",
    (2, 1, "p075"): PEARL_P075_TAKEOVER / "red2-h1",
    (2, 2, "p075"): PEARL_P075_TAKEOVER / "red2-h2",
    (2, 3, "p075"): PEARL_P075_TAKEOVER / "red2-h3",
    (3, 1, "p075"): PEARL_P075_TAKEOVER / "red3-h1",
    **{
        (red, hydrophone, pilot): PEARL_REMAINING37
        / f"n1024-{pilot}-red{red}-h{hydrophone}"
        for red, hydrophone, pilot in PEARL_REMAINING37_KEYS
    },
    **{
        (red, hydrophone, pilot): PEARL_P025_P05
        / f"n1024-{pilot}-red{red}-h{hydrophone}"
        for red, hydrophone in ((1, 1), (1, 2), (1, 3), (2, 1))
        for pilot in ("p025", "p05")
    },
    **{
        (red, hydrophone, pilot): PEARL_P12_P15
        / f"n1024-{pilot}-red{red}-h{hydrophone}"
        for red, hydrophone in ((1, 1), (1, 2), (1, 3), (2, 1))
        for pilot in ("p12", "p15")
    },
}
PEARL_PAIRED_ARTIFACT_KEYS = frozenset(
    (red, hydrophone, pilot)
    for red, hydrophone in ((1, 1), (1, 2), (1, 3), (2, 1))
    for pilot in ("p12", "p15")
)
PEARL_ARTIFACT_SHA256 = {
    (1, 1, "p025"): (
        "4776aed05c56cf4f2e3f09f48e54202a7712c40af8125128c71eea68df569010",
        "edd2c934cf726af8a49367a50aa56219890e5bb45da8e5800d71bd5eee3a1a0b",
        "ce4041fad3e4214e332527d49bc72b6945a16108c86def2dc2b545cea27021f4",
        "1ebb646d496f6b2348c6128f75d8e077ce2041fef2f231a546477770a50ce600",
    ),
    (1, 2, "p025"): (
        "d699fcadfe4df59f4461a449974e80ebacdbb9300569ca246f09f841ac5cbdb3",
        "61978bafa9157a6e9dfc7d737d055927340a3347eb5dceb023c64672fb9d87e6",
        "aba6087638dbb48ee1089a3da1aefe6b8b515b456e4853d323a9968079e9f336",
        "50c47e6bf8ce270ed8de7d054c22bfb578385ddf9115eac087a3956ed38c42f2",
    ),
    (1, 3, "p025"): (
        "c4cf78af9fa1b79ab718f91912988af157798c44fad182c700775247ddec580f",
        "4dcac38a59620e38f0ca9365ece443a9343864e7aeb76f50411a808cd1b5988a",
        "e85f0c7105eda096e0473b80fb3ec00a250b85c072dc8678b78ea8574c6dcf73",
        "efdd2c4f60cf99ede576329525d2ced25db7cfe510e1fd5205e873153b56d18b",
    ),
    (2, 1, "p025"): (
        "9a8e70a1648b1d909df9e1f7a28e932dea494e6f2be53c045a48a2196cf88f02",
        "9a6d12c4a6629cad4895269c9e3fd41cc282ed9891d81c12a4c7714e4836675f",
        "bde4f2e926de2ca34ca749e0adbb398c22165e26b8eacf22fce3fa9b84fb474b",
        "ef6ef795b1f288aafca923a7ecded367f76f7083373468aebe1afe256fb2f31c",
    ),
    (2, 2, "p025"): (
        "5982709d161414e6b57cdf186041a376188c91ce3b701e4b6f810c1e3230050d",
        "b6597142247bbbf478f2c80598250f570cf31a5cc9b676a86b3569f89eb7483c",
        "bc7c803b30b385c12c70946c30ede612029ac87a8febf4e2d5f4752e3e63345b",
        "37ce86b7f28bb11a30b1257593005e2a8b3a1148788ac2b1dad3e2a690413b9e",
    ),
    (2, 3, "p025"): (
        "8fb2e903939008cda1c3b839857fea9119e22636986b610ae36dc5478ff48820",
        "198bdc18b8fdf14a1fad33a5742fa067fb14b2feff532112e3726d26e00b714b",
        "58171801fda1d92b614ed8de9c98a1b25298353722bc91fa57e5918347ff820c",
        "96f7f34a0b4e561db748ca48d9bcc1c771d540ceea0a99248067e530cfeabe70",
    ),
    (3, 1, "p025"): (
        "315e41e4cf0544eb4092a47398f239c5ef7822a6716b4446b187a3c2d502a523",
        "d96415e2e29ddb1cca10dc1f94c460ccb0ae2968f430d1ea5f8ff3c83b276835",
        "4049c91062b6abfc39e58129af1f5d709185f9d5280fca686158cce61b08344c",
        "25dc5d77110f58df9a90306ab14d4303810ee8ae2381a2fa2978c8a674c1b166",
    ),
    (1, 1, "p05"): (
        "1c4020a05989b67e9d8a3e2a68da80d94fe0c98aedf1a0756bd27fcbeda83208",
        "e7c02e45e8bc1ce706f67db7129d2b4080bdf3aebe5eb47e90531b65fd36edc3",
        "d8af16d05812a1f951ba14c9cd5cbe0294d96b6abaf66d9e498ce55be04b9b05",
        "bf95540b2273cdc9d8b128e0f03d7f2f82488ffa7f20a2aa19e1b12a174ff8aa",
    ),
    (1, 2, "p05"): (
        "45c0322dac47941d68332c336dcf3b1ee1da51c5a966e847783bfee2a4b10a4b",
        "d458b4e94491d4018bacadcff361f38f8624140791e055106610844b38d03c17",
        "c9da5e45eb3f001bc088c7a1a109395c5b7ceb61a03ade5660c3ab2a10bd0e7e",
        "a3e3c2de2ef6d6fdc871d9f1951a1b5cc760340703c7e1c68513dff5900cc371",
    ),
    (1, 3, "p05"): (
        "b22bf6c16d97c1718e623df38d01d2699d29c889f672538075be1eddfca0b0c1",
        "0997cbd853c4fac654a498ca929f782383a7b9b5fdf9db81d21ea10f930c1682",
        "eade648f1c061d7c96e6ff383a0c5f7b881b83577955ec9e1799e5018622a86d",
        "93cb7954bc97acba311559cdacaedf0cc97400255fcf7a3b615726978471ce0e",
    ),
    (2, 1, "p05"): (
        "1c36fccaa2ebf97ef2e7f59cc97ba52930ad5af7a042e3273316122b1f7ee3b6",
        "1b32414f8ace0ae99e6a7efe966b5bd4cead4e3de462aa5c33d44e27f51c83a4",
        "b978ddcfc6e0e969582fb15cce20ba275527a7a17ff26f9b0037bcb030aa44a2",
        "5a1e9d5898ae516c7a28f01850507fc393cfa98210348595a0f9c03f0ca865dd",
    ),
    (2, 2, "p05"): (
        "e6fb7efae5d4c6259a84b92b2c6cae14e93764a8c65de43d7e7774c5500d520c",
        "cdddc845bc299a29ff447de25598e479c1a8d3d202177e7a2189c2cc3c7ff79b",
        "c2bca0309701229e389a89ec2205d2bd9df88db0b8de5d885ae06af3cfe85beb",
        "bf7f8e0a3fa7c7e712afd0c7ff5489bf06700cbd850d8e221527eaf2f8df70f1",
    ),
    (2, 3, "p05"): (
        "e17afa984efcb8a10695824a46021aca2ce308aa2acd2fd0718e0e11c160f6b4",
        "9ee3dcde81cf5f3cd616976fcc5c0459c1ce47a58310d99ccf2b1477a361c496",
        "be11798ef87e9429df7e5c9147b6e1bf99a5280295b34590dcf3937f6b95bde1",
        "f2299292c099ba81201d2a2a15664e25e130002a00f5bd364fc4f3b0fc390840",
    ),
    (3, 1, "p05"): (
        "b67d1b24d269be011f5df402b81f2354fa6101ab0a452681c0f7e2e9304ba7f6",
        "f85ac8c94427b00dd6fa401496f811079612e5af1d78f7c3e5882ad0043d3ae9",
        "67a84f7d07fd9646fa036e3e30f345d8959bbce7b542b4806e78e77080447dd2",
        "3b59b97ba2f9de71c658dddf816d08a882a1b22eb5d3a7f5fa8a6739732d9a6b",
    ),
    (1, 1, "p075"): (
        "75c02857840fd8525e5d71a9a4ee054f39865d8e46816f3c253678b3da518436",
        "6bbeeb3e0bb9a2322e324d7348f291ed17ef0b434ec4bdd824eeebfe208f6e2a",
        "75b5a22ddeeb577af4e66d89c09bf30860cc5a91991ee7c3db1563d089dab96a",
        "bc3539e8b251c987e9f922d2ac679c4beaab29ffd8e5f98231a3532f399f9ce3",
    ),
    (1, 2, "p075"): (
        "2581a53813ff30a76684e0b41614d245ab0484392bae71f36211418cf1a90683",
        "1b6138e516564a352536c5823b3f5b697b312feb096fc1a314831cb02b48a371",
        "f012288016ad0b1490e8493d17456ad94de78600f76be2dace5860c3acb5f7dc",
        "debc9df1236547b806e6e25916563fad8be54ac59e80750a8714325e3b21c7af",
    ),
    (1, 3, "p075"): (
        "d21a17ed65264233089b295c6e61e3ff3fd16145569341b4804de20e1cf888f7",
        "76871678fd18bbb142a3589ddb31d568c3d943b4181431664c8f3d7eb7b4c4e6",
        "3cbc7dcb731249ecbc0fef085e399fbc50a5224785bb0543a17c0ca447048f69",
        "8bbb2683144b2219e887e185c795df394c6db01873028f078fbeedd7592c06ae",
    ),
    (2, 1, "p075"): (
        "582b089d335083e9bd8fa3b327ea1f7213136f1a25e381b54226182fe3387c67",
        "b28606fc265138e877b1e581aca33cfd19a0c0fee0fd97abdedd4de4cb9b7cd5",
        "8b2762715b7683719de0843a8a07c104450df388548ca685ad0b7b3bb720d81c",
        "f3f34de0f82315668dce2948f544dbae61ea1176fdc471b9f061ed07a404255f",
    ),
    (2, 2, "p075"): (
        "0599fe2a8186eca11e8519b224e685f174eaacc558cbd28a84b4e0e84198c7e0",
        "d45f347249b66cdaa7b007ef04f5598e11373996665c89cd6fbcfc00874e6c31",
        "9a411518e97b6a6d93fc6a8f006ad747b753ccfdc77382848f295efb4258e581",
        "ae77731cb0ce3e786e9b44c35301538d364a9f9d01e07fd32a3a6b72d42b54f3",
    ),
    (2, 3, "p075"): (
        "9d9f57b5e485192a43187e285568d6606055b36f61a5f1dacf5c4104992f8942",
        "09ca89d0f781baf5245c368ad2c70e3837e752d00e1d620a27062a4de20e6d42",
        "2715b67230f628544565fd4c803ea968d305479bad96a2ca7025858ce29ed0e9",
        "0a298c936dbdb945614ba1fe86062fb5a13ef00819458fd59fcca8aab96e9a1c",
    ),
    (3, 1, "p075"): (
        "a0bc957ec357c2db2b51aa09d76f5633ff721b3e072c0d903cf4c026a94205d5",
        "5926cdccb113a3bf51d873c44665b66fde758f66ad8fb7213ddfcc43d32f8d94",
        "46861842d11c1963df0ee702ec97deac77eb3ba707ad237d227741e4d44c04bd",
        "bc5400961915cd1383039f7e7850e12f3c1222eea56b8892c8c78be60cff1d6d",
    ),
    (1, 1, "p12"): (
        "6c990b91384cbc485e94a0cc140aa54c3fbf8c655708022099f57dd639bae284",
        "0e357ddaaedb279fbd983c00a280d0f568461dd3ed4019ed14462641735f1cd8",
        "3e979792b8a68ab3c06c321a0659725aed847f79f6cb9f92eac57e00600c347f",
        "6a24e7cbd8980e12a31e361783d4c85a5d3cff12f90a7986dd16db078fc5d460",
    ),
    (1, 2, "p12"): (
        "2bac29a839eea9a3be3832ffd220e7b431985b4677ebd501388ca66aa28b7abf",
        "4a196fd132e0a38fcc810c51ac51f8557f347b4659292e17d262a9057c10756b",
        "492f83748c940ec1cdfdbae92d0f1e2933958ef9c902d58a5591f467abf2ae85",
        "5daea1f2ea32e72337db9fdae6db61227992d12db91d67c26e931b20e175e814",
    ),
    (1, 3, "p12"): (
        "05b3c4ca9049563bbfe05c503312cabfd3da187f0fb1385bc96a73e87b67202c",
        "7b2a164b8f46c50541dd51430d02efdd6dbf4e3081adb41799992d2383457d4d",
        "fce2f47ce12ebcab7b684b301825f89d67fb5a7c823e428379a31aab9beb909b",
        "e8f9717acf11554530184963d1d6df296883aa23341b6948b929315c3961dcab",
    ),
    (2, 1, "p12"): (
        "e1e83fa8d7bfba3fdd922c4af25f4ec20fa61d42d87d53c69423a1352b499112",
        "ce58a0441111d4509cda531e6a2de5491882c6cf440df80a4129e86ceaf1cd95",
        "99e29f228f8bd02d84aa8ca8a4547abccb49ce8131403f2d49b7070e0843fbf0",
        "75b0c1ae92a819bf42301f2d5e0bd1c11a246b3eec1f1417539067c4c5f4ad27",
    ),
    (2, 2, "p12"): (
        "46aa2106549f242c78132803aabe064520e94debf16ee661ad59ab1d7ee61c67",
        "cfc0b416443e70e6f00c9d8aaf1062621c7e4a7392082de46461ec3305362f78",
        "cf5df3efe91cf07daf61e5b633acbcf16bd21356d5616dbaef180d81b72489c9",
        "60e05bc9f8f9872686d63deaf5851f0889fde56d934c15540b7aac64db004f3e",
    ),
    (2, 3, "p12"): (
        "0f9d65e04eb2c16d373461d3ebd01fdd07e0400fc3e3ae469ab43c5611804924",
        "dd4305ebbd73a31bdf0b9fc2012ed227aba4eedc3d34d48177c1260fbc1809aa",
        "b60c7f77f04b22614594ac483bcc7769414435f94f93f7dde7b5751743cd604d",
        "8e30895bb3dec3f927e0e414627b6849d4e370615c3b3a22f162b032b3f32cfe",
    ),
    (1, 1, "p15"): (
        "4de838f0096f04546cf8100870ce1e34472591633f079578133eb63564e9dff6",
        "dfb75cc15b6de9bf1dd9c7d1f33043ccc1577c5377a5cbc0b9c3731a64741e93",
        "46d00662bc13ba62b5d52529e845bfd8086996770d85b25e3138138060ea21c2",
        "2fc066c5c09a076aeaebe4eeaa26c47565aba6cd6deff6198747198e446db595",
    ),
    (1, 2, "p15"): (
        "1571105005f481c8f8f227f3439c3e857c3133808cbee93c3f502d11db69889b",
        "eb8b9958a46473efd53949fdef6bf64fe6ddaced83ed91bafab880ab93ce107a",
        "dc9c511617937ebceb23c85d73f953fa4c2a3d95ab5edf24e03e17299d4674c8",
        "beb09661784651d927326cc47f8127da1c44fab1442b857a9513fe416b486c58",
    ),
    (1, 3, "p15"): (
        "c7ac294cc0d4a93dccb82ad4296c5572bc3e5e36a898199811c1ad4a21647873",
        "965a11a5f6d4fa83ff9651d4407796cde8aeb358632263899c34bc7b3ab7f56c",
        "4809ef47c605e72d0c0fd9f721b767fe0ac567f14ce20eadb538f2f95338d84b",
        "9daf22acd2c3c9d4e132ae5e89c75366658cd7a020f3b8e8851bcc57593ab5de",
    ),
    (2, 1, "p15"): (
        "c0999053d0b88a71088299d2b2f800889d44c3fb4fa081bcd319655f4e23469e",
        "190ff614bafea899937b11883813e4b43696cb27faed6559557894f5728d0819",
        "88eb0d3c24ea595142b07286328a7248d8600ad8bbb23cb9033fbb2fe6d568e8",
        "2926065d405c5c136264b1f782dba801981c4a29981d09060678d76512049cff",
    ),
    (2, 2, "p15"): (
        "75db7f2b52d57d83fe22527be178334888276ea82920909be28d5790371ff197",
        "3eef4f0fdf9d95e4fec97ebb5aeaf57def0598f9b7a366ab1b9b891308376036",
        "b06f883fb274d944574fcb01e62019bcede4b72bd6e79ce423ef0c1b688b305e",
        "633fb76dcc1df31fd8122588f80c450d14e3e073fedc0a0504a47de60ff5f034",
    ),
    (2, 3, "p15"): (
        "b5ac9a18757072c08016dd31399cd384706e7933c5a2680e6e7d07fe69d6aebc",
        "2b154f71dc751567c81ca4b84164796bc6c876f98ee376cb6584a2d7636db063",
        "b068862d48f334045cfb1957f16492c62ccc61828542a3c738addfa789c98898",
        "e843ea31ba340bd0891135c6c1b90d846bce444b60606f2ec423e5aa48a8055a",
    ),
    (3, 1, "p12"): (
        "53535a3e522a4842dd50ae8a02d8ba378b5eeedd205654990b643618f89c9701",
        "7a2fbe6856380970d98e550fa6ec727df2f9176bfcbf182d1fe9b9ece0733f9f",
        "7bee1fa63bcef8d85cd318622e9795a252280c5402dcd25e5c6736e5ec352138",
        "f73df47d700c2d972b6ddf39aac6a85e816637674bd28bf6ae7db442c9c1699e",
    ),
    (3, 1, "p15"): (
        "362db2bc4ae3f396f1a2563179b0f09c699aaf2d55022bc1d676f317c2df1507",
        "f8be437522e1dadb45a786ff1971d72173eb5f003f630a86358c10ac67ad0288",
        "65264946455af69d528dc55a1c06cb62104930945ebe309554aee99e99b60ba5",
        "99d5477d504a3aecde15d5d1966a11dfeb02b42281a77cf729990751918985b8",
    ),
    (3, 2, "p025"): (
        "3f2d9e4f372c059c2186fa69ff9505c97c4de11298f26367a816858b0885d9db",
        "1e33d8778086b5e6c943e09388ae2f4d5011caf754750bdb9b736674b7443125",
        "668f8d04d11d5e4dda5fc34dcbb79cd5992d40d6f1f2174f1e2ba9c13ea02e58",
        "51f26c6318fc1621fcc87be1122a3869e7d2195ec2d5b44c28ac03ccb953c7e7",
    ),
    (3, 2, "p05"): (
        "ac08292cb7b749893b6604a6d0445931be567a02e1f65b4365f938b663081d27",
        "cff43c0e3fdff91e825ad07e563426a4af5183f67a9cb933362c673996d0f65f",
        "af690606bbc224325c65893384ec69782e23facadaefee37bec70325d0a90620",
        "8b5e0d8df5f96ae8dde36ebb650075d1f6f63a36e6499eb367f23bcf5cbe6db8",
    ),
    (3, 2, "p075"): (
        "5f7ac94f5bd9fee6edef81b3dd183d58638eb3f9b3f446f99668eb36d88fce53",
        "48f479cb6b73ed63201c135a955b1b3e67ee9b3aaa61fa3c1b7dc5388b94135b",
        "013ce097ad66aa03ba17c233a696efa13ffd632a540d85ea20736532631e9adc",
        "296cbaee69f0af3eb178602f49dccdbe75529b178cc11cfe7f354e5774677653",
    ),
    (3, 2, "p12"): (
        "6fafbb7ab65b36bc4d3af57b1d55c32772138b87b9fe202f2290d546b7c42461",
        "b34204a82b35766a1885a78e579d96f468445266c30b0ef6430b41669ea300b3",
        "cca8eec3515f203f38c368bb92f583542b7c37fc7472f32e696a16647dfc9ba5",
        "25e4c9ff3d824ee49329e7d26ca48e3502f2ea9447ad98442691e32b63fbf9f5",
    ),
    (3, 2, "p15"): (
        "b339f126396a3b442fc68b9c2557cb1b8dcf398e02f8667b126a04fcb53df36e",
        "59a4b37a4b6a14217cc4a8e55c7f5fea9093d5fb202e5ef6ce672aeddc19b725",
        "a530b7d4099c6186d18a6f4cf98d58ead47cc8a3ca99a04e05a80912d66af12d",
        "8c5d768808ab9ea6bad52c9f23709be6c2e705f6d8728a0a3ec32403fb3fb214",
    ),
    (3, 3, "p025"): (
        "49342897540b8c932af0a1044eedc21ead8baf3429bbf5d4d402a60d58be7b6b",
        "5860ded5bb23d636fe20dd0d0e7eee31597b12c06775fd7895a4994594f03698",
        "d6ac0847d5b97d5f53b2e2cfb0c3b919c02a7471cdeb0f6e89ca7075e7b03f73",
        "db781da484d660e2f753080ebaa91f5354d5a0cb264dcd4f1a0af8eb282efca6",
    ),
    (3, 3, "p05"): (
        "bf6d88e3f91f825c01ff4ec7e8312327fb5fb2502207a4cb8bb1409075295f82",
        "780671d98a8a7b995f7787bb8fc4687ce316dde2ef94d3ff126312c24318413c",
        "a93b2fec5c99910d00a476524b3df564fe0ee5645db085a216d0bb8b27881405",
        "bafefae07b3a85fba538a30125b46ffe1fe67c7e979006faf0d6d1c0678a1418",
    ),
    (3, 3, "p075"): (
        "64bd5da53f10d0d53dfe5ad725c34c5346b878cd01a11cb49b921673811e8a83",
        "29b16318cdc2344aa001fec6b6e5513a512f340410590b8cf345eed84f893bb5",
        "6c4fb6cb30016ac77ea4fcb9e0ec1e56b7c989810b592b5c574f47ae611391dd",
        "abca237c9c9c850c46b538d431b49a4cc0ee8e96e3339288089e00ca2e124b02",
    ),
    (3, 3, "p12"): (
        "f9ce6d90def31a14f99d6fa9048b899287316c791f7f1eefc76f8436b6c3a88a",
        "ac9df3e7b43233fb6583437fd905522ccb3113b138fcaa2e0d1cb821f3718aa4",
        "7a545f59b238524013b47d945ae20cb72f8ed4efa3c9e16fea3fe475cd42867b",
        "2c0697fc7b82cdc7c3b6cd82b5dc5c1331750e51ecc8433365eef9fd6250edd9",
    ),
    (3, 3, "p15"): (
        "6b96b2d3e19ba146f4e40aee1dff593fcb26a31cd7330bcad4ca605a178e9c09",
        "a50cdf2ac4341a12dc9c8976c467a23aa5c187d45747eb703c77bfdf09992f78",
        "4adebb404f248da49ee498ed1fef3fe2f90fe210b1c84077e8291ac9810c93c8",
        "fd306bbc38c7b55f132ab7821a2933a5e411c05d22d9b082687d324e30a9c770",
    ),
    (4, 1, "p025"): (
        "920d99120b362bdd662895e2d529a6b1e217abda9dc2b0164ce1cfc9b032023b",
        "1b742de65904e23815fdffc1556fe0e4bef952a030e82b5806d09360ae38cec8",
        "8b99e5331c0da400c3ab70647d821f4686dbec2bc6e34d4eae417b646418b7f2",
        "7476079b15dc9b7757967657183b65b370d6f45ced376056c6892b2940c3b93f",
    ),
    (4, 1, "p05"): (
        "25a217d54ec2cda97d8677f9b3967bf75147a5bfd4b3b382b5aafbb932243ae5",
        "473fd3589deef10c2e8d9ac0c36cdb96d8a89c1b0e753eb1292cc724c738822e",
        "58cec51fa97e5c6816be1a0dc7d951aad297e25d64a034c89d3538af27c30d27",
        "bc1f6e3611ecaf4def301c91fbb67bf6e7258bcb03ef0322151e8e3dbe6a67b2",
    ),
    (4, 1, "p075"): (
        "8f78428810ef559217bc5c19d49d78f68c1284c116f2880d0c0ebdd934b5a590",
        "13b4ec22f25f8abf4c3557381fc664639eb3c62b42334b858041e13534e18fb3",
        "b5c04c0420c83217da10eb093c21f36250ed191e6a30573ffdd8c0326ca6775d",
        "78dfb0c7f2f56fb5b78f5a8fe4302b037173bfd6da132a262b3406ee49ece435",
    ),
    (4, 1, "p12"): (
        "ede0a3b049e88746e8f372dc2518929f894c060428f76231ee7fc485200b36f3",
        "b4773b2004a929eb0666ea2fa3e7a187071cc16dcd58b73d20cefb81e0771082",
        "87a7dbdd3a6e3a4fb642197da2fc7259dd44fac6a3c68d8a5eacb6cd55adc438",
        "eb17fbdf8ed861d545cec498ce4e212ed963f73b54f14bf09f6d682ef1d2733f",
    ),
    (4, 1, "p15"): (
        "34d01bbeb5203f4193e075a63c70635c97e12027726be09458e996a76e78a607",
        "8f29aa1c10d98b364ee3c23fbb0b7360a54b58cbc0cb5f72db88aaecec2a5c1b",
        "2570fd669b64485cd98b79475de9c581ca3eb7daecd331c13a66984dd976c298",
        "15cdc34de630db9415bb3cacd28be5d9972a8b50d2a6dbc90206e5a92113612c",
    ),
    (4, 2, "p025"): (
        "2fd92533618cc4da9411f7ccf99965f5503d8d9b5c94f2d2c35cd9ce71110cc4",
        "7bc252a5eab1d95c34378bb6e9ea8ae28e69b027760a1ab4b58f465ec3cfb937",
        "11f2a95612cf87edc54a89c10ddd4e8a5ee059b7b13027001d99c0b08801d525",
        "86aefc9a5e456efd07a75f877168cbc17f6cd03a49ab5eea5766f6116323ae1c",
    ),
    (4, 2, "p05"): (
        "b57d257997e2be7d74e46531dc355c8f6e1f7a51e1b9c26b7969698d44eeac89",
        "57680a2082e262847091b677577f53e69826520ab63b3e2ba23b65aed373de1b",
        "0e615b29622fb8559033a3dd91440a38e1360f6a454c5c1f40df354bd0ed9935",
        "985472367fde9aa282950d8de31c16ae8ccbba91c25cf9f887c126ae8c0e101f",
    ),
    (4, 2, "p075"): (
        "e32bc98ad8268ecadb5749226804c8fddae6da3bd38a47555fb8084fe1f2d32b",
        "0095bd8f918281dbb015c4f327b8a5cce428ac962b42501fcac5a083752f7664",
        "5f9b0ece2583f4fec1252c43f90a46aafc6648508a5894ffb5041425ad456581",
        "b88a09385486b7f88617366ca715b2c621bd4183b785ee0bab00798b5ee6e7b7",
    ),
    (4, 2, "p12"): (
        "8bfa4444c01e895008088165ae5e1f4404c0346b769a35265242954a39b1fc4a",
        "3ed836da62d4fbb45f269d93b51010d9a9cab2fe5e438c4db6d3f7ab5284333a",
        "09f3f179e1733cd50c7cd7869818646d047eb10ce6866d8944e1382ff9ab7b4f",
        "57088720539782e15ff7b50fa1010fd271c00dd36da1efb4ef608d02781a8440",
    ),
    (4, 2, "p15"): (
        "d3c016d62eaba7c2813debb67c31b8878c6ef2934db9c78c78129151a176ad4e",
        "9b015bb73f0aa7a7f224a15420b490fd2d4f9444407449d0fe23d9389eb72871",
        "fdec4ecaa7ac295022d0b43a661b5cb08650b1f1d582cca3e9436a79ee515b57",
        "7c0e829c08125a1c35c6b97fec79f8147b7191d45b037bad9d5c6df323b83fef",
    ),
    (4, 3, "p025"): (
        "140e9565e94ca1dae94846b887d81995a1c1409f1012464caeea16b74aaeb98a",
        "b1462b434b7fdefbf39fbbca2db0b44693502015243655b33208fd185dc964f2",
        "fcc8804bfe75347821dc828138c6e67ec42c6c23eee1a0aff99d68404736a644",
        "ff92c7e5d3cf8d824804bc6ff52e00d540af00ead3258163150a22491cd1c35f",
    ),
    (4, 3, "p05"): (
        "b238386709c6db53f20080960fd9efa525abbd08750fea4e08c508fd7fe6b5d7",
        "00864f46634d26d9a3b3b9e7881a493298ea19911a899348dfe3abc2f708ecf6",
        "d83c2b496fcf8e59185d3acc15ea416de037483a4cb20b2bf604a6728e6c2f31",
        "c8f713193f77d702bc7f4442eb147eeae5e5947156a98791dc8c726f8ca36e5c",
    ),
    (4, 3, "p075"): (
        "bd4a8f440ebbd268eb17cb10d44c37e0e99d8407dff61fb26a8859ed1052e930",
        "5dfbfaa1da37b536727c289f6beba9e7feab707bc030c50f2f8f288225b0ee0b",
        "7f77ed2018f77ff7552bc9fa18ff01fd6daa55ad161fea6a658c562fb43c0c2c",
        "9d7a77d4c64ef5a24217aa682c582ba62e3d36e7f86beba6f6edfb967157cc96",
    ),
    (4, 3, "p12"): (
        "d71dc44e1217167f9dcd77500fc64c177ada5bd641a2b82e512ab40b45ea0196",
        "504eea6d3da806dbd88c3954e5f08643f83b7287d06976de1b37d991af5033a4",
        "64a833aa54cdd968b562b2c57d3661ebab05a52b4a0f5e30362bd69b0d54cac6",
        "2f4887553c42437fdc843f39e4e7b5be9dcd23969f3cfa8cc9392a53414afccb",
    ),
    (4, 3, "p15"): (
        "8be6618142e7b566169c4c44ffa368f2429b7a94058b71146076205922bd4911",
        "c6dd74c2f3908926066a9341dafb9552ffac806ae1459b4d1bc3fae88a66107b",
        "dacbe0daebda24fbbf663b23efd13ad2b09349ce9593090c9b80030c26d91af2",
        "680417c9a9a0e0cf680659ebd45bd9c14408da7037a097d0be6d60a5bf3dfc06",
    ),
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
    elif receiver == "pearl":
        reason = "source_result_missing"
        cohort = PEARL_COHORT
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


def require_equal(actual: object, expected: object, label: str) -> None:
    if actual != expected:
        raise ValueError(f"{label}: {actual!r} != {expected!r}")


def read_json(path: Path) -> dict[str, object]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"cannot read JSON artifact {path}: {error}") from error
    if not isinstance(value, dict):
        raise ValueError(f"JSON artifact is not an object: {path}")
    return value


def safe_result_file(root: Path, relative_name: str, label: str) -> Path:
    relative = Path(relative_name)
    if relative.is_absolute():
        raise ValueError(f"{label} uses an absolute path: {relative_name}")
    candidate = root / relative
    try:
        candidate.resolve().relative_to(root.resolve())
    except ValueError as error:
        raise ValueError(f"{label} escapes its result root: {relative_name}") from error
    if candidate.is_symlink() or not candidate.is_file():
        raise ValueError(f"{label} is not a regular file: {candidate}")
    return candidate


def parse_csv_bool(value: str, label: str) -> bool:
    lowered = value.lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False
    raise ValueError(f"{label} is not a CSV boolean: {value!r}")


def load_pearl_run(
    rows: dict[tuple, dict[str, object]],
    red: int,
    hydrophone: int,
    pilot: str,
    root: Path,
) -> bool:
    """Load one authenticated PEARL artifact, failing closed if it is malformed."""
    completion_path = root / "completion.json"
    if not completion_path.is_file():
        return False
    required = {
        name: root / name
        for name in ("aggregate.csv", "completion.json", "config.toml", "frames.csv", "manifest.json")
    }
    for name, path in required.items():
        if path.is_symlink() or not path.is_file():
            raise ValueError(f"PEARL {name} is not a regular file: {path}")

    artifact_key = red, hydrophone, pilot
    pinned_hashes = PEARL_ARTIFACT_SHA256.get(artifact_key)
    if pinned_hashes is None:
        raise ValueError(f"PEARL artifact lacks a pinned hash registry entry: {artifact_key}")
    completion_sha = sha256(required["completion.json"])
    frames_sha = sha256(required["frames.csv"])
    aggregate_sha = sha256(required["aggregate.csv"])
    manifest_sha = sha256(required["manifest.json"])
    require_equal(
        (completion_sha, frames_sha, aggregate_sha, manifest_sha),
        pinned_hashes,
        f"{root} pinned artifact hashes",
    )

    completion = read_json(completion_path)
    manifest = read_json(required["manifest.json"])
    payload_bits = PILOTS[pilot][1]
    paired = artifact_key in PEARL_PAIRED_ARTIFACT_KEYS
    artifact_receivers = (
        ["jade_bp", PEARL_RECEIVER] if paired else [PEARL_RECEIVER]
    )
    total_frame_rows = len(artifact_receivers) * FRAMES_EXPECTED * len(SNRS)
    total_aggregate_rows = len(artifact_receivers) * len(SNRS)
    expected_frames = list(range(1, FRAMES_EXPECTED + 1))
    expected_snrs_float = [float(snr) for snr in SNRS]

    require_equal(manifest.get("schema_version"), 3, f"{root} manifest schema")
    require_equal(
        manifest.get("base_configuration"),
        f"n1024-{pilot}.toml",
        f"{root} base configuration",
    )
    require_equal(
        manifest.get("base_configuration_sha256"),
        sha256(required["config.toml"]),
        f"{root} configuration hash",
    )
    require_equal(
        manifest.get("paper_source_commit"),
        PEARL_PAPER_SOURCE_COMMIT,
        f"{root} paper source commit",
    )
    source = manifest.get("source")
    if not isinstance(source, dict):
        raise ValueError(f"{root} manifest source record is missing")
    require_equal(source.get("head"), PEARL_SOURCE_COMMIT, f"{root} source commit")
    require_equal(source.get("dirty"), False, f"{root} dirty source flag")
    require_equal(source.get("status"), "", f"{root} source status")
    runner_records = [
        item
        for item in source.get("files", [])
        if isinstance(item, dict) and item.get("relative_path") == PEARL_RUNNER
    ]
    require_equal(len(runner_records), 1, f"{root} archived runner count")
    runner_record = runner_records[0]
    require_equal(
        runner_record.get("sha256"), PEARL_RUNNER_SHA256, f"{root} runner declaration"
    )
    runner_archive = safe_result_file(
        root, str(runner_record.get("archive", "")), f"{root} runner archive"
    )
    require_equal(sha256(runner_archive), PEARL_RUNNER_SHA256, f"{root} runner hash")

    matrix = manifest.get("matrix")
    if not isinstance(matrix, dict):
        raise ValueError(f"{root} manifest matrix is missing")
    matrix_contract = {
        "capture": red,
        "hydrophone": hydrophone,
        "frames": expected_frames,
        "population_frames": expected_frames,
        "snr_db": expected_snrs_float,
        "receivers": artifact_receivers,
        "payload_bits": payload_bits,
        "expected_rows": total_frame_rows,
        "ldpc_method": "frame_sparse",
        "ldpc_npc": 14,
    }
    for name, expected in matrix_contract.items():
        require_equal(matrix.get(name), expected, f"{root} manifest matrix {name}")

    input_record = manifest.get("input")
    if not isinstance(input_record, dict):
        raise ValueError(f"{root} manifest input is missing")
    require_equal(input_record.get("capture"), red, f"{root} input capture")

    graph = manifest.get("graph")
    if not isinstance(graph, dict):
        raise ValueError(f"{root} graph record is missing")
    require_equal(
        graph.get("parity_sha256"), PEARL_GRAPH_SHA256, f"{root} parity graph hash"
    )

    declared = manifest.get("declared_override")
    if not isinstance(declared, dict):
        raise ValueError(f"{root} declared receiver profile is missing")
    require_equal(
        declared.get("persistent_decoding_route"),
        "persistent_edges",
        f"{root} PEARL decoding route",
    )
    require_equal(
        declared.get("persistent_profile"), "r2_v1", f"{root} PEARL profile"
    )
    require_equal(
        declared.get("persistent_profile_parameters"),
        PEARL_PROFILE,
        f"{root} PEARL profile parameters",
    )

    trace_contract = manifest.get("trace_audit")
    if not isinstance(trace_contract, dict):
        raise ValueError(f"{root} trace contract is missing")
    trace_expectations = {
        "decoding_route": "persistent_edges",
        "expected_check_rule": "normalized_min_sum",
        "expected_fallback_used": False,
        "expected_external_bp_calls": 0,
        "expected_terminal_bp_calls": 0,
        "expected_decoder_vjp_calls": 0,
        "expected_polynomial_bit_gradient_calls": 0,
        "expected_message_state_initializations": 1,
        "expected_message_state_resets": 0,
        "expected_terminal_message_sweeps": 0,
        "expected_output_source": "persistent_belief_posterior",
        "expected_schedule": (
            "one_message_sweep_per_iteration_channel_gradient_every_2_iterations"
        ),
        "profile": "r2_v1",
        "profile_parameters": PEARL_PROFILE,
    }
    for name, expected in trace_expectations.items():
        require_equal(trace_contract.get(name), expected, f"{root} trace contract {name}")

    completion_contract = {
        "status": "complete",
        "manifest_sha256": manifest_sha,
        "frames_sha256": frames_sha,
        "aggregate_sha256": aggregate_sha,
        "graph_sha256": PEARL_GRAPH_SHA256,
        "rows": total_frame_rows,
        "aggregate_rows": total_aggregate_rows,
        "frames": expected_frames,
        "snr_db": expected_snrs_float,
        "ldpc_method": "frame_sparse",
        "ldpc_npc": 14,
    }
    for name, expected in completion_contract.items():
        require_equal(completion.get(name), expected, f"{root} completion {name}")
    completion_source = completion.get("source")
    if not isinstance(completion_source, dict):
        raise ValueError(f"{root} completion source record is missing")
    require_equal(
        completion_source.get("head"), PEARL_SOURCE_COMMIT, f"{root} completion source"
    )
    require_equal(
        completion_source.get("dirty"), False, f"{root} completion dirty flag"
    )
    require_equal(
        completion_source.get("status"), "", f"{root} completion source status"
    )
    trace_audit = completion.get("trace_audit")
    if not isinstance(trace_audit, dict):
        raise ValueError(f"{root} completion trace audit is missing")
    require_equal(trace_audit.get("passed"), True, f"{root} trace audit result")
    require_equal(
        trace_audit.get("receiver"), PEARL_RECEIVER, f"{root} trace audit receiver"
    )
    require_equal(
        trace_audit.get("audited_rows"),
        FRAMES_EXPECTED * len(SNRS),
        f"{root} trace audit row count",
    )
    require_equal(trace_audit.get("warmup_invocations"), 1, f"{root} trace warmup")
    require_equal(
        trace_audit.get("contract"), trace_contract, f"{root} trace audit contract"
    )

    with required["frames.csv"].open(newline="") as handle:
        all_frame_rows = list(csv.DictReader(handle))
    require_equal(len(all_frame_rows), total_frame_rows, f"{root} frame row count")
    require_equal(
        Counter(item["receiver"] for item in all_frame_rows),
        Counter({receiver: FRAMES_EXPECTED * len(SNRS) for receiver in artifact_receivers}),
        f"{root} frame receiver counts",
    )
    pearl_frame_rows = [
        item for item in all_frame_rows if item["receiver"] == PEARL_RECEIVER
    ]
    expected_coordinates = {
        (frame, snr) for snr in SNRS for frame in range(1, FRAMES_EXPECTED + 1)
    }
    seen_coordinates: set[tuple[int, int]] = set()
    totals: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    trace_paths: set[str] = set()
    for index, item in enumerate(pearl_frame_rows, start=2):
        label = f"{root} PEARL frame row {index}"
        frame = int(item["frame"])
        snr_float = float(item["snr_db"])
        if not snr_float.is_integer():
            raise ValueError(f"{label} has a non-integral SNR")
        snr = int(snr_float)
        coordinate = frame, snr
        if coordinate not in expected_coordinates or coordinate in seen_coordinates:
            raise ValueError(f"{label} has an invalid or duplicate coordinate {coordinate}")
        seen_coordinates.add(coordinate)
        require_equal(item["configuration"], f"n1024-{pilot}", f"{label} configuration")
        require_equal(int(item["capture"]), red, f"{label} capture")
        require_equal(int(item["hydrophone"]), hydrophone, f"{label} hydrophone")
        require_equal(int(item["payload_bits"]), payload_bits, f"{label} payload bits")
        require_equal(int(item["decoded_bits"]), payload_bits, f"{label} decoded bits")
        require_equal(item["status"], "decoded", f"{label} status")
        require_equal(item["error"], "", f"{label} error")
        require_equal(parse_csv_bool(item["acquired"], label), True, f"{label} acquired")
        require_equal(
            parse_csv_bool(item["data_pilots_used"], label), True, f"{label} pilots"
        )
        bit_errors = int(item["bit_errors"])
        if not 0 <= bit_errors <= payload_bits:
            raise ValueError(f"{label} has invalid bit errors: {bit_errors}")
        for hash_field in (
            "payload_sha256",
            "transmitted_sha256",
            "replayed_sha256",
            "noise_sha256",
            "received_sha256",
            "corrected_sha256",
            "decoder_trace_sha256",
            "lfm_trace_sha256",
        ):
            digest = item[hash_field]
            if len(digest) != 64 or any(character not in "0123456789abcdef" for character in digest):
                raise ValueError(f"{label} has an invalid {hash_field}")
        for path_field, hash_field in (
            ("decoder_trace", "decoder_trace_sha256"),
            ("lfm_trace", "lfm_trace_sha256"),
        ):
            safe_result_file(root, item[path_field], f"{label} {path_field}")
            trace_paths.add(item[path_field])
        totals[snr]["frames"] += 1
        totals[snr]["bit_errors"] += bit_errors
        totals[snr]["decoded_bits"] += payload_bits
        totals[snr]["exact_frames"] += int(bit_errors == 0)
        totals[snr]["crc_valid_frames"] += int(parse_csv_bool(item["crc_valid"], label))
        totals[snr]["syndrome_valid_frames"] += int(
            parse_csv_bool(item["syndrome_valid"], label)
        )
        totals[snr]["strict_accepted_frames"] += int(
            parse_csv_bool(item["strict_accepted"], label)
        )
    require_equal(seen_coordinates, expected_coordinates, f"{root} frame/SNR coverage")
    require_equal(len(trace_paths), 2 * FRAMES_EXPECTED * len(SNRS), f"{root} PEARL traces")
    trace_files = list((root / "traces").glob("*.json"))
    if any(path.is_symlink() or not path.is_file() for path in trace_files):
        raise ValueError(f"{root} contains a non-regular trace")
    require_equal(
        len(trace_files),
        (len(artifact_receivers) + 1) * FRAMES_EXPECTED * len(SNRS),
        f"{root} total trace file count",
    )

    with required["aggregate.csv"].open(newline="") as handle:
        all_aggregate_rows = list(csv.DictReader(handle))
    require_equal(
        len(all_aggregate_rows), total_aggregate_rows, f"{root} aggregate row count"
    )
    require_equal(
        Counter(item["receiver"] for item in all_aggregate_rows),
        Counter({receiver: len(SNRS) for receiver in artifact_receivers}),
        f"{root} aggregate receiver counts",
    )
    pearl_aggregate_rows = [
        item for item in all_aggregate_rows if item["receiver"] == PEARL_RECEIVER
    ]
    aggregate_snrs: set[int] = set()
    for index, item in enumerate(pearl_aggregate_rows, start=2):
        label = f"{root} PEARL aggregate row {index}"
        snr_float = float(item["snr_db"])
        if not snr_float.is_integer():
            raise ValueError(f"{label} has a non-integral SNR")
        snr = int(snr_float)
        if snr not in SNRS or snr in aggregate_snrs:
            raise ValueError(f"{label} has an invalid or duplicate SNR: {snr}")
        aggregate_snrs.add(snr)
        total = totals[snr]
        for field in (
            "frames",
            "bit_errors",
            "decoded_bits",
            "exact_frames",
            "crc_valid_frames",
            "syndrome_valid_frames",
            "strict_accepted_frames",
        ):
            require_equal(int(item[field]), total[field], f"{label} {field}")
        if not math.isclose(
            float(item["payload_ber"]),
            total["bit_errors"] / total["decoded_bits"],
            rel_tol=1e-12,
            abs_tol=1e-15,
        ):
            raise ValueError(f"{label} BER does not match integer counts")
        set_available(
            rows[key(red, hydrophone, pilot, snr, "pearl")],
            frames=total["frames"],
            payload_bits=payload_bits,
            total_bits=total["decoded_bits"],
            errors=total["bit_errors"],
            source_receiver=PEARL_RECEIVER,
            cohort=PEARL_COHORT,
            data_path=source_path(required["frames.csv"]),
            data_sha256=frames_sha,
            evidence_path=source_path(completion_path),
            evidence_sha256=completion_sha,
        )
    require_equal(aggregate_snrs, set(SNRS), f"{root} aggregate SNR coverage")
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
    require_equal(
        set(PEARL_ARTIFACT_SHA256), set(PEARL_RUNS), "PEARL run/hash registry keys"
    )
    require_equal(
        PEARL_PAIRED_ARTIFACT_KEYS,
        frozenset(
            key for key, root in PEARL_RUNS.items() if root.parent == PEARL_P12_P15
        ),
        "legacy paired PEARL artifact keys",
    )
    require_equal(
        set(PEARL_REMAINING37_KEYS),
        {
            key
            for key, root in PEARL_RUNS.items()
            if root.parent == PEARL_REMAINING37
        },
        "remaining-37 PEARL artifact keys",
    )
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
    completed_pearl = []
    for (red, hydrophone, pilot), root in PEARL_RUNS.items():
        if load_pearl_run(rows, red, hydrophone, pilot, root):
            completed_pearl.append(f"red{red}/h{hydrophone}/{pilot}/pearl")
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
    print("complete PEARL roots: " + ", ".join(completed_pearl))


if __name__ == "__main__":
    main()
