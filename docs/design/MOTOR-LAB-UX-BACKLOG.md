# Motor Lab usability checkpoint

The guided Motor Lab is playable, but its result is still too hard to interpret without knowing the engine. The next user-facing work should follow the race from the chosen orders through the recorded road to the conditional finish, rather than expose more motor diagnostics by default.

## Addressed in this preview increment

- Finale selectors and a rider guide now show the exact synthetic sprint, terrain and endurance abilities used to build the race. They distinguish starting skill from remaining energy.
- A short race story names recorded own-team attack attempts, joins and catches, then the team's and nominated finisher's position and energy at 1 km to go. It does not infer a catch or an official place from a time gap.
- The finish explains its clock origin and remaining energy; detailed engine status is folded away.

## Open design and motor work

1. **Five-kilometre effort:** The current selector is an optional experiment. A same-seed 120 km / four-team / fatigue-15 audit across flat, rolling and mountain routes gave the nominated rider conditional place 3 under conserve, steady and hard on all three routes. Hard spent more reserve and crossed roughly 0.004–0.008 seconds later than conserve in those samples. This does not establish a universal ranking, but it does show that the control currently lacks a useful explanation or clear tactical trade-off. Evaluate more varied race situations and rebalance or redesign the order before presenting it as a central decision.
2. **Race narrative:** Show the major road-group changes and the fate of each chosen attack in one scannable timeline, including whether a break survived to the finish or was caught. Keep every statement tied to recorded events; do not infer unrecorded contact.
3. **Result hierarchy:** Lead with the team's race story, conditional finish and rider energy. Keep road boundaries, contact audit, version information and per-frame replay available in a clearly labelled technical section. Explain policy points separately from saved official awards.
4. **Other managers:** Give rival teams stable human-facing names and show their strengths/orders together. Preserve internal IDs and existing contracts.

No official place, points or award may be derived from a conditional wheel order. Old versioned recordings must continue to replay.
