# Motor Lab — advanced order workshop

This is the next visible increment after [Motor Lab milestone 1](MOTOR-LAB-MILESTONE-1.md). A manager can still run a single fictional preset, or commit three additional choices before calculation: whether the road captain reacts to a threatening break, whether Amber cooperates, sits on or drives when it reaches a break, and whether effort changes at the 120 km marker. The recorded race shows the marker activation and any road-captain chase decision. A second run of the same scenario number displays the previous and current captain finish, chase kilometres and winner together.

The choices use the existing v2 `normalizeOrders` and `orderAt` path through the laboratory adapter. Inputs are allowlisted by the read-only API; malformed orders return 400. The server validates the full recorded race before returning a compact replay. The comparison holds two recordings only in browser memory and disappears for a different scenario number. It is a diagnostic aid, not a sporting balance claim.

This increment has no Supabase migration, roster access, points, official race orders or persistent replay. The old production race flow is unchanged. A real order deadline, lineup, route-specific markers, stored replay and player-versus-player test race remain in the [master plan](MASTER-TODO-2026-09-30.md).

Verification: 241 unit tests, ESLint, production build, and authenticated 390/1440 px Motor Lab browser journeys. Browser checks include malformed-order rejection, all three advanced controls, replay navigation, and a same-scenario comparison.

## Recorded timeline increment

The existing in-memory recording now has a playable kilometre timeline. A line shows the leading group's recorded advantage at each kilometre, while marks identify kilometres with multiple road groups. The manager can play, pause, scrub or jump to the previous and next key moment. Playback reads the completed recording; it does not rerun the simulation or change orders mid-race. The chart includes a text summary of the selected and largest gaps and was checked at 390 and 1440 px. It remains a laboratory viewer with a fictional route and riders, not a persistent or official race replay.

## Conditional attack from the break

The manager can now commit Amber Captain to try an attack from a break after 40, 80 or 120 km. The existing v2 marker order fires on the following kilometre only if the captain is in a suitable road group. The recording explains a split or a blocked attempt; the UI does not pretend the order succeeded when its condition failed. In the fixed laboratory scenario, the 40 km choice can show two simultaneous road groups, making the multi-group viewer testable. This is still one pre-race conditional order, not a live instruction or a balancing claim.

## Road captain laboratory profile

Amber's fictional road captain can use either the original 45 leadership or an experienced 85 leadership profile. The rider's other sporting skills and the scenario seed stay fixed. When a threatening-break response is committed, the higher leadership may detect and call a chase earlier or more often; it does not guarantee a better result. The choice is a controlled preview variable, not a staff upgrade, roster edit or persistent rider attribute. Scenario 1 with the conserve plan and threatening-break response records its first Amber chase call at km 23 with the standard profile and km 22 with the experienced profile.

## Second route fixture

Motor Lab now offers the original exposed 160 km Coast Road and a 160 km Ridge Road with two sustained climbs, descents and a final rise. Both use fixed, fictional geometry and locked starting weather; neither is a canonical Pelotonia atlas route. The same scenario number is repeatable on either route, but the comparison card appears only when the route and scenario number are both unchanged. This begins route-sensitive testing without claiming that the generic synthetic riders provide realistic climbing balance.
