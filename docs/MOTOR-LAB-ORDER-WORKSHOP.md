# Motor Lab — advanced order workshop

This is the next visible increment after [Motor Lab milestone 1](MOTOR-LAB-MILESTONE-1.md). A manager can still run a single fictional preset, or commit three additional choices before calculation: whether the road captain reacts to a threatening break, whether Amber cooperates, sits on or drives when it reaches a break, and whether effort changes at the 120 km marker. The recorded race shows the marker activation and any road-captain chase decision. A second run of the same scenario number displays the previous and current captain finish, chase kilometres and winner together.

The choices use the existing v2 `normalizeOrders` and `orderAt` path through the laboratory adapter. Inputs are allowlisted by the read-only API; malformed orders return 400. The server validates the full recorded race before returning a compact replay. The comparison holds two recordings only in browser memory and disappears for a different scenario number. It is a diagnostic aid, not a sporting balance claim.

This increment has no Supabase migration, roster access, points, official race orders or persistent replay. The old production race flow is unchanged. A real order deadline, lineup, route-specific markers, stored replay and player-versus-player test race remain in the [master plan](MASTER-TODO-2026-09-30.md).

Verification: 241 unit tests, ESLint, production build, and authenticated 390/1440 px Motor Lab browser journeys. Browser checks include malformed-order rejection, all three advanced controls, replay navigation, and a same-scenario comparison.

## Recorded timeline increment

The existing in-memory recording now has a playable kilometre timeline. A green line shows the leading group's recorded advantage at each kilometre; gold tracks show distinct groups between the leader and peloton without joining unrelated moves into one line. The selected road cards give the gap to the next group or peloton. The manager can play, pause, scrub or jump to the previous and next key moment. Playback reads the completed recording; it does not rerun the simulation or change orders mid-race. The chart includes a text summary of the selected and largest gaps and was checked at 390 and 1440 px. It remains a laboratory viewer with a fictional route and riders, not a persistent or official race replay.

## Conditional attack from the break

The manager can now commit Amber Captain to try an attack from a break after 40, 80 or 120 km. The existing v2 marker order fires on the following kilometre only if the captain is in a suitable road group. The recording explains a split or a blocked attempt; the UI does not pretend the order succeeded when its condition failed. In the fixed laboratory scenario, the 40 km choice can show two simultaneous road groups, making the multi-group viewer testable. This is still one pre-race conditional order, not a live instruction or a balancing claim.

## Road captain laboratory profile

Amber's fictional road captain can use either the original 45 leadership or an experienced 85 leadership profile. The rider's other sporting skills and the scenario seed stay fixed. When a threatening-break response is committed, the higher leadership may detect and call a chase earlier or more often; it does not guarantee a better result. The choice is a controlled preview variable, not a staff upgrade, roster edit or persistent rider attribute. Scenario 1 with the conserve plan and threatening-break response records its first Amber chase call at km 23 with the standard profile and km 22 with the experienced profile.

The chase moment now includes the leader's gap *before* that kilometre was calculated. A later road-captain moment says whether the chase ended because the break had been caught or Amber had a teammate ahead. This explains the recorded decision without using the eventual finish result as information available to the rider.

## Second route fixture

Motor Lab now offers the original exposed 160 km Coast Road and a 160 km Ridge Road with two sustained climbs, descents and a final rise. Both use fixed, fictional geometry and locked starting weather; neither is a canonical Pelotonia atlas route. The same scenario number is repeatable on either route, but the comparison card appears only when the route and scenario number are both unchanged. This begins route-sensitive testing without claiming that the generic synthetic riders provide realistic climbing balance.

The replay now includes an elevation profile derived from the same committed kilometre route used by the simulation. Its cursor follows the selected frame and a text summary gives that kilometre's altitude and gradient. There is no separately drawn route profile to drift away from the engine input.

## Chase-contribution order

Amber can now commit how much its helpers contribute to the peloton chase: follow the preset, hold helpers back, or commit them to chase. This maps to the existing v2 chase order; a separately committed road-captain threat response can still override a held chase when its condition fires. The choice is recorded and included in same-seed comparisons. In Coast Road scenario 1 with the sprint preset and no threat override, holding helpers yields zero Amber chase kilometres; the default contributes work. Other teams keep their own plans, so withholding Amber's helpers does not guarantee an escape or a better placing.

The paired comparison now includes kilometres with Amber Captain in a break and the largest leading-group gap, alongside Amber's chase work, the captain's placing and winner. These are derived from the two completed recordings. They make the tactical consequences visible even when the finishing order does not change.

## Captain support on the ridge

The fixed Ridge Road sprint exercise gives Amber a sprinter captain with a weaker climbing profile than the team's helpers. Other plans retain their original rider profiles. A precommitted support order can send a reachable helper back when that captain loses the peloton. The existing v2 support mechanism checks distance and energy; the replay names the helper and records the seconds recovered. The comparison includes kilometres that Amber Captain spent behind the peloton. In seeded ridge scenario 1 with the sprint plan, support changes that count from seven to two kilometres, while the captain finishes fifth in both runs. This is useful evidence of an order's road effect without suggesting every tactical action changes the final placing. Coast Road's rider fixture remains unchanged.

Verification for this increment: 247 unit tests, repository ESLint, production build and authenticated browser journeys at 390 and 1440 px. The preview still uses fictional riders and routes and has no live roster or official results.

## Why the peloton is waiting

The peloton card now distinguishes teams actively chasing, teams deliberately waiting while a small gap remains manageable, and teams represented in a road group ahead. These are recorded kilometre states from the same simulation, not hindsight inferred from the finish. This makes the common situation where a break remains useful and the bunch declines to close it visible in the replay. A waiting label disappears when the break has been caught.

Verification: 248 unit tests, repository ESLint, production build, and authenticated 390/1440 px browser journeys. Each viewport uses a separate fixture manager so the browser check stays within the preview API's per-user run limit.

## Break episodes in the recording

The replay groups contiguous kilometres with riders ahead into break episodes. Each episode reports its start and last kilometre, peak gap, kilometres with a chase, and whether the group was caught or remained ahead at the finish. A manager can jump to its start and inspect the kilometre-by-kilometre road state. The summary is calculated from the recorded frames and does not merge a later fresh break across a kilometre when the road ahead was empty. This exposes repeated short moves in the current synthetic balance instead of hiding them behind a single breakaway label.

Verification: 249 unit tests, repository ESLint, clean production build, and authenticated 390/1440 px browser journeys including episode selection and its active-state marker.
