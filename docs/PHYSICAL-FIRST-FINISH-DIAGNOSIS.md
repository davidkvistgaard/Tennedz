# Same-seed finish diagnosis

Run `node scripts/diagnose-physical-first-finish.mjs` with explicit
`--category`, `--terrain`, `--chase`, `--attack` and `--seed` options. It
recreates the 120 km, 15-team test input used by the viewer release audit and
compares V94 checkpoint gap claims with paid physical road clocks. The output
contains the first mismatch, selected checkpoints and the largest finish
differences. Source gaps are comparison data only. The tool does not write a
race result or alter either engine.

On `preview-recorded-road-1`, men, flat, all-team chase, no attack, the source
has 120 peloton riders at kilometre 1 while the physical engine pays 100 in
the peloton and 20 on rear roads. The same 20 disagree at every checkpoint;
the largest difference grows from 3.6888 seconds at kilometre 1 to 421.47936
seconds at kilometre 120. The women, rolling, all-team chase case with holdout
seed `viewer-release-holdout-2` likewise starts with 120 source peloton riders
versus 100 paid peloton riders and 20 mismatches at kilometre 1.
The first paid front worker is `you-5`; the detached riders' perceived
sheltered ability is 1.13–5.37 points below that worker's pace. The current
full-chase leader plan explicitly selects the fastest payable ordered helper,
so this is a model-choice difference, not an adapter timing or missing-rider
error. Changing that choice requires a new, versioned motor policy and
whole-race balance evidence; historic recordings must retain their version.

On the first seed, women, mountain, selective chase and selective attack, the
sole discrepancy starts at kilometre 20: V94 claims 15 seconds for `you-7`,
while the paid road clock gives 4.58064 seconds. The finish difference is
62.13208 seconds. On the holdout seed, men, mountain, selective chase and
repeated attack, one discrepancy starts at kilometre 5 and reaches 82.90744
seconds at the finish.

These are distinct source-versus-physical differences. A valid fix must
explain the changed contact and paid effort with complete rider-kilometre
evidence. It must not move physical riders into a V94 group, copy V94 gaps,
or suppress a paid drop just to make the comparison green. Until the
calibration and official finish contract are resolved, the recorded viewer
remains a Motor Lab preview with unofficial measured crossings.
