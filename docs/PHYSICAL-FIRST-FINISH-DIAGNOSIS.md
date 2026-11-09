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

## Versioned bunch leader experiment, 9 November

`physical-first-leader-plan-4` keeps the committed front-work order and
single payable leader. Among an unnamed team's payable helpers, it first
minimizes predicted start drops for both selective and all-team chase, then
chooses the faster perceived helper. Named workers and emergency orders
still take precedence. This changes pace by choosing an actual eligible
rider; no rider is assigned to a V94 group and no gap is copied.

The full 72-scenario, 120 km, 15-team same-seed audit completed all races.
Calibrated finishes increased from 12 to 24; mismatched finishes fell from
60 to 48. Official results remain unavailable in all 72. The smoke matrix
improved from 6/20 to 12/20. A separate 160-rider mountain attack fixture
improved from 67 finish mismatches to one, with all 19,200 rider-kilometres
still paid and replayed. These numbers support retaining the policy as an
experimental increment; they do not approve guided races or publication.

The complete rerun on 9 November isolates the remaining discrepancy: all
24 no-attack scenarios calibrate, while all 24 selective-attack and all 24
repeated-attack scenarios have at least one same-seed finish difference.
The candidate races still complete and replay; the difference is between
historical V94 gap claims and paid attack-road clocks. For example, in the
120 km men's flat all-chase selective-attack race, the first attack at km 20
has one paid attacker (`you-7`) with 79.85532 seconds for that kilometre
against the paid bunch's 82.91796 seconds. Its measured lead is 3.06264
seconds; V94 claims 15.04 seconds at the same checkpoint. No paid bunch
drop occurs there. The discrepancy persists to an 18.36576-second relative
finish difference. The source claim cannot be used as a physical position.
The audit now reports calibration by attack order, so future policy changes
must improve the affected classes without regressing the no-attack cases.
