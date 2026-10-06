# V2 finale: sporting and recording contract

Status: proposed implementation boundary for point 04, not a verified engine rule. The current `v2-prototype-79` resolves the road in kilometre steps and applies one finishing burst after the last step. This cannot express the order of moves, catches and position changes in the final few hundred metres. The existing race path and saved recordings stay unchanged until a new version passes scenario and replay validation.

## Distance phases

| Distance remaining | Sporting decision | Recording requirement |
| --- | --- | --- |
| More than 5 km | Existing road-group simulation, with fatigue and earlier tactical position carried forward. | Kilometre frames remain the source of truth. |
| 5 km to 1 km | Finale state: remaining helpers, group placement, lead-out work, selective attacks and chase, and the cost of improving position. A break can still win if its real lead and relative speed suffice. | Explicit transitions, workers, group membership, energy, gaps and the cause of every catch/split. |
| Last 1 km | Shorter distance steps resolve timing and position before the finishing effort. Initial target is 250 m steps, subject to route-data and performance tests. | Ordered sub-kilometre frames using distance remaining in metres and elapsed race time. |
| Last 500 m | Sprint or final acceleration uses still-finite energy and the actual road situation. Initial target is 100 m steps; a final tie-break is allowed only within a documented timing resolution. | Recorded launches, passing, catches, separations and line crossing must agree with the result. |

The 5 km boundary changes *which decisions matter*; it is not a universal speed multiplier or a forced bunch sprint. The final 500–1000 m is a sprint phase for a flat, grouped finish, but an uphill, cobbled, narrow-road or solo finish needs different skill emphasis and outcomes. Use the route's recorded finish characteristics, never infer precise turns, width or grade from a generic race label. Until the route contract provides sub-kilometre geometry, the model may use a clearly identified last-kilometre profile fallback for physics, but the viewer must not draw invented bends, lanes or overtakes.

Skills must have traceable effects: sprint and acceleration on a flat launch, positioning and actual lead-out help before and through it, climbing on an uphill finish, surface handling where a surface segment is specified, and fatigue/remaining energy across every finish type. A helper's lead-out costs that helper energy and can benefit the protected rider only while they share a plausible road group. Position should be earned or lost through recorded work and constraints; no rider gets a free passing bonus solely from a high sprint stat. Precommitted orders determine the attempt and timing; managers make no live decisions during replay.

## One outcome, one replay

Version the route, locked orders, tuning, seed and recording schema together. Each final-phase frame needs a monotonic distance/time, rider and road-group identities, relative position or ordering at the resolution the model actually supports, gaps, energy and the decision/event that changed the situation. Result times and rankings are calculated from those same frames. The validator must reject impossible reverse order, unrecorded catches or passes, non-monotonic timestamps, and a final frame that disagrees with the classified finish. Private playback may omit rivals' locked orders or hidden energy while preserving public racing events.

A later viewer can slow the final 5 km, then focus on the last kilometre and final metres, with simultaneous commentary, groups, gaps and position. It may interpolate *between* saved states for smooth motion, but cannot create a sporting event between frames. A solo finish, small-group sprint and full-bunch sprint should have different pacing and commentary, sourced from the recorded outcome. Viewer production follows the motor and recording contract, not the other way around.

## Acceptance before replacing the current finish

1. Fix the known residual-gap and final-kilometre-attack interactions together; a tiny artificial gap must neither preserve an otherwise caught move nor allow an unearned launch to gain many seconds.
2. Paired seeds show a catchable late move caught by coordinated sprint teams, a strong break surviving insufficient chase, and a well-timed solo attack succeeding sometimes without dominating every finish.
3. Flat, uphill and specified-surface finishes reward different rider strengths; conserving energy and arriving well placed matter, especially after 240–300 km, without making one generic order optimal.
4. Check two-team and larger fields, both men's and women's races, seeded determinism, finite helper work, separated groups, photo finishes, and exact agreement of recording, result and point inputs.
5. Measure the added frame count, storage size and execution time in the isolated 45-team, three-division flow before enabling the new recording version in any preview player path.
