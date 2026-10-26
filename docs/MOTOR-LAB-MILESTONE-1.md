# Motor Lab — first visible engine milestone

This slice adds `/team/motor-lab` for signed-in managers and a read-only `POST /api/motor-lab`. It is a fictional, isolated demonstration, not the official race viewer or an alternate live race runner. The current race engine, results, Supabase schema/data, scheduled jobs and points are unchanged.

The manager chooses one of four simple Amber plans and a bounded scenario number. The server builds the same four synthetic eight-rider squads and 160 km route, runs `v2-prototype-74`, validates the complete in-memory recording and returns only a compact presentation of each kilometre: road groups, chase, conditions, energy and notable movements. The browser can scrub or jump between recorded moments; changing a plan requires a new calculation. The experimental provisional result is labelled as such. No engine tuning table or hidden coefficient is bundled into the browser.

The API uses existing authenticated team ownership and same-origin checks, a bounded input and supplemental per-process rate limit. It never reads the manager's riders or writes any database row. The fixture is intentionally simple: flat/coastal terrain, four fictional teams and shared male synthetic profiles. It cannot establish realistic balance, category parity, stage racing or suitability for official events. The richer order workshop, full viewer and real test-race persistence remain later milestones.

Verification: copied v2 engine scenario/unit coverage plus focused guided-preview tests; full unit suite, ESLint, production build and authenticated 390/1440 px browser journeys. Browser checks include anonymous rejection, foreign-Origin rejection, plan selection, server-calculated replay, scrubbing, moment navigation and a same-seed rerun. World Baseline 1.6.2 remains in the same release candidate. Production publication requires a separate deployment check; no migration is needed for this slice.

## Guided 5 km effort markers (versioned input)

The guided v93 Motor Lab can commit one team-wide effort change per manager at
any 5 km marker from 5 km through 5 km before the finish. The new
'managerTacticalOrdersV2' input is separate from the older
'managerFinaleOrders' request. A chosen change applies to the following
kilometre, and the recorded route, actions and rider energy show what happened
after it. The 5 km-to-go request retains its existing field and behavior.

This is a pre-race order for a synthetic test field, not a live mid-race
command or a named stage-feature trigger. It does not supply the short-climb
stage overlay currently being developed on the preview branch. Unsupported
final wheel contact still refuses or withholds official places and awards.

## Recorded stage profile in guided replay

The guided race viewer draws the elevation profile from the route saved with this run, then marks the precommitted 5 km effort point and the selected checkpoint. The elevation trace is sampled once per kilometre; short ramps visible on a detailed stage map can be hidden. The profile is a read-only navigation aid, not a new motor input or evidence that the chosen order caused a gap change. The separate stage trace adds recorded start/end elevations without changing the stored race, road groups, conditional finish or awards policy.

## Two precommitted 5 km effort changes

The guided Motor Lab can now choose a second 5 km effort marker for a team, including an earlier marker when the first remains at 5 km to go. A separate 'managerTacticalOrdersV3' input carries both changes into the existing kilometre motor; it rejects duplicate team/marker entries, off-grid markers and combinations with the older V2 or finale fields. The core order normalizer applies the phases chronologically from the following kilometre. Recordings created with the older input remain versioned as before.

Before running, the plan lists both selected efforts. The recorded viewer marks both points on its one-kilometre elevation profile, can jump to the first affected kilometre after each, and shows the active order and energy at that checkpoint. Rival inspection lists all of that manager's precommitted effort changes. The old single-effort comparison is suppressed for multi-marker runs because its 5 km-to-go attribution would be misleading.

This adds tactical timing to the guided synthetic race, not named landmarks or precise sub-kilometre terrain. It does not resolve occupied-wheel contact or award official places or points. The preview v3 short-feature engine diagnostics remain separate and internal.


### Guided stage inputs before tactics

The guided Motor Lab can load a read-only simulated stage plan before the race. This
uses the same seeded kilometre route builder as the subsequent recording, so its
five-kilometre cards summarize the actual five one-kilometre samples for terrain,
surface, exposure, elevation and simulated wind, temperature and rain. A card's
end marker can be selected as the first timed-effort marker; selecting it alone
does not issue a team order. Changing route settings makes the loaded plan stale
until reloaded. The plan does not run a race, award points or change saved
recordings. It is versioned as `v93-guided-stage-plan-1`; its 1 km data cannot
represent the short climbs or named landmarks in the supplied LBL example.


The pre-race stage cards now select either the first or second distinct 5 km
effort marker, and dashed lines show both selected locations on the profile.
These are location choices only; team effort remains explicitly chosen under
Timed effort. Changing the first marker to the second marker's location clears
the second selection instead of creating duplicate orders.
