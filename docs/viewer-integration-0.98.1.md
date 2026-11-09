# Pelotonia Viewer 0.98.1 integration — default Motor Lab screen

The independently packaged `@pelotonia/race-viewer` is installed from
`vendor/pelotonia-race-viewer-0.98.1.tgz` (SHA-256
`7afceef5fd9bd5c0e59ef382aca8e665327509ec0d560db7d369df16a0740212`).
The kit's older native adapters are unused. The new, versioned
`physical-first-to-pelotonia.viewer.v1-1` adapter consumes current committed
physical-first Motor Lab inputs and paid probe output. The motor is unchanged.

The authenticated `/team/motor-lab` route opens the new viewer by default.
`/team/motor-lab/engine` preserves the guided or legacy Motor Lab controls.
`PELOTONIA_VIEWER_V1_ENABLED=false` restores those controls as the default
and disables the new viewer's clock endpoint. The old official race viewer
remains the fallback for actual game runs because they do not supply this
viewer's required rider positions. In development only, setting
`PELOTONIA_VIEWER_V1_PREVIEW_ENABLED=true` enables unauthenticated local
acceptance routes at `/viewer-acceptance`, `/viewer-acceptance/inspection`,
and `/viewer-acceptance/stress`.

## First recorded race

The fixed `preview-recorded-road-1` seed generates a 40 km flat one-day
physical-first race with four fictional teams and 32 riders. Men and women
are separate fields. The motor supplies every kilometre's paid road leader,
clock, rider set, common road distance, and route elevation. Independent
energy/road replay validates all 1,280 rider-kilometres in each field.
The adapter emits 41 boundary frames and releases each paid leader event at
the end of its kilometre, never at the start.
The viewer interpolates visually between boundaries; these interpolated
locations are **not** additional measured motor positions.

The preview clock is anchored to the same UTC cycle for all spectators, runs
at 1×, and holds the finish until the next cycle. The cycle is rounded up
to enough whole hours for the recorded race, so a long race cannot reset
before its last paid finish. The API returns server time
for clock offset estimation and refreshes every five seconds. Camera target
is browser-local. Commentary and route profile use the same viewer time;
events after that time are withheld. No result or winner is supplied.

## Coverage and boundaries

| Datum | Preview source | Limitation |
| --- | --- | --- |
| Rider identities and separate fields | Current Motor Lab test teams | Fictional test identities, not player clubs |
| Team clothing | Game kit catalog allocation | Helmets and official classifications unavailable |
| Position and time | Paid road boundary states | No within-km sample or rider-specific lane; all lanes use centreline |
| Groups | One connected `peloton` | Split roads are rejected; no group gap is treated as a simultaneous position |
| Route and elevation | Recorded kilometre elevation | Straight schematic distance axis; no canonical geography or atlas |
| Actions and commentary | Recorded paid leaders and finish event | No inferred attacks, orders, chase, or future events |
| Results | None | No invented placings, awards, or winner |
| Assets | None | Renderer uses its built-in scene; atlas and game assets remain pending |

This fixture demonstrates end-to-end playback only for a connected field.
It does not establish correctness for breakaways, drops, contacts, changing
groups, guided races, full-sized stages, or official results. The current
guided Motor Lab output has group time gaps but lacks simultaneous
rider-specific positions. The adapter intentionally refuses to convert
those gaps into precise coordinates. It also cannot export a 160-rider field
because the package contract limits a feed to 150 riders.

## Verification gate

Unit tests validate the installed contract, start/mid/finish samples,
commentary chronology, result absence, split-road refusal, shared clock,
and separately labelled synthetic 30/150-rider feeds for both categories.
The synthetic stress feed fabricates riders, lane offsets and spacing only
for renderer testing and must never appear as Motor Lab race data.
Browser WebGL, camera, asset failure, and performance observations should
be recorded separately from contract tests. A WebGL renderer label or CPU
fallback alone is not GPU certification. Actual game races remain on the
legacy viewer until a real full race with splits and official result coverage
passes the same checks and authenticated browser validation.

Local development browser acceptance on 2026-11-06 showed actual 32-rider
men's and women's previews in WebGL, with the recorded 0 km and 40 km
boundaries displaying 40.0 km and 0 m remaining respectively. The start
showed only the start event; the finish showed the recorded finish event and
no invented result. Synthetic stress frames rendered 30 men (~95 fps),
30 women (~87 fps), 150 men (~56 fps), and 150 women (~50 fps) on this
browser/machine. A deliberately missing, referenced glTF produced one asset
error while 150 riders continued rendering. These are local observations,
not a hardware-wide or production performance guarantee. No authenticated
production browser check has yet run.

The Motor Lab and live production branches diverged after their common
production commit. Publishing the Motor Lab branch directly would also
publish its unrelated engine history and replace newer production-only
changes. A separate release integration is required before tennedz.eu can
use this as its default Motor Lab screen.

## Experimental split-road export

`/team/motor-lab/viewer-preview?race=split` selects the separate,
`physical-first-split-to-pelotonia.viewer.v1-1` adapter. It runs a fixed
120 km mountain test with 15 teams and 120 riders, separately for men and
women. The original connected preview remains available. The 120 rider
count is a Motor Lab supported field size within the package's 150 rider
limit; the known 160 rider test cannot be exported intact.

The source is the current V94 experimental physical-first probe, not the
kit's older native adapter. An independent replay checks all 14,400 rider
kilometres before export. The adapter checks every state membership change
against recorded drop, launch, catch, or paid-contact events. Five paid
rear contacts appear in this seed. It refuses an unrecorded transition.
The viewer's one shared timeline uses the motor's per-rider kilometre
crossing times and recorded contact anchors. It interpolates longitudinal
distance between those anchors; those intermediate distances are estimates,
not exact simultaneous motor positions. It does not derive coordinates
from group time gaps. Rider lanes remain at the centreline because the
motor does not record them. The route is a schematic distance axis.

The export intentionally omits official results, winner, classifications,
and helmets. The same-seed finish check still differs from the guided
recording for 50 of 120 riders, with a maximum absolute difference of
421.01688 seconds in this fixed seed. This test shows that the data bridge
works; it does not calibrate V94 or authorize guided race replacement.
The split preview stays on the Motor Lab branch until whole-race calibration,
finish validation, authenticated browser checks, and an isolated release
integration pass.

Local browser acceptance on 2026-11-09 opened both 120-rider fields with
WebGL rendering, the shared clock progressing, the route profile and
commentary updating, and a browser-local rider camera selection. The
observed frame rate was roughly 23–35 fps on this machine. No browser
error or warning was reported. Riders in a connected road overlap heavily
because lateral positions are absent; the scene currently looks sparse
despite all 120 riders being present in the data. The package's CPU timing
readout displayed 0.0 ms and is not a GPU performance measurement. Exact
race-end rendering was checked with the viewer sampler, not by waiting
three hours in the browser.

### Subsequent experimental front-worker calibration

The immutable split recording already transferred to the separate viewer
release remains the version above. A later `physical-first-leader-plan-3`
changes *selective* front work: an unnamed payable helper is chosen to
minimize predicted start drops before using ability as a tie-breaker, for
every sporting goal. A named worker and an explicit full-chase order still
take precedence. This changes the simulated paid road, not the viewer's
geometry or the historical export.

The same 120 km mountain seed now completes with zero unrecorded contacts,
zero start drops and zero same-seed finish differences for both categories
under selective chase and no attack. A separate full-chase variant still
records five paid rear contacts and differs for 50 riders, maximum
421.01688 seconds. Six additional 120 km checks across flat, rolling and
mountain profiles with another seed found zero finish differences without
attacks; selective attack orders left one difference (18.36576, 18.41296
and 62.13208 seconds respectively). Both categories with selective or
repeated attack orders and another seed also left one difference; full
chase left 51 differences. These are test-case observations, not a general
calibration claim. The unchanged full-chase scenario keeps split/contact
coverage visible while the motor still needs general whole-race calibration.

The split preview now accepts validated `terrain` (`flat`, `rolling`,
`mountain`), `chase` (`selective`, `all`), `attack` (`none`, `selective`,
`repeated`), and a 1–64 character alphanumeric/hyphen `seed`. Its GET form
generates a new paid 120 km race and keeps those exact inputs when switching
between the separate men's and women's fields. The server clock resolves
the same variant and checks the resulting race ID and duration in the client.
The versioned query parser rejects unsupported values. The adapter still
omits official results and still uses the fixed 15-team synthetic roster
and sporting stakes; this is not yet arbitrary team orders or the official
game race. A fresh flat-profile seed replayed all 14,400 rider-kilometres,
validated against `pelotonia.viewer.v1`, and produced a distinct race ID.
The development-only `/viewer-acceptance` page accepts the same variant
and was checked in a browser for both fields with the new flat-profile
seed. Both pages rendered 120 riders in WebGL, the route profile and
commentary advanced on the shared server clock, and category switching
preserved every variant input. This checks the data bridge and browser
rendering locally; it is not an authenticated production check or a
measured GPU performance approval.

### Rich viewer on generated Motor Lab races

The experimental Motor Lab preview now uses the same Work-style race
theatre component and CSS as the separate viewer release. A versioned
visual-only scenic layer adds clearly labelled synthetic terrain, trees,
crowd and finish assets; tests verify that it leaves every paid rider frame
and event unchanged. The actual route still has no canonical geography or
individual lanes. The compact setup panel keeps the experiment controls
available while placing the race theatre at the top of the page.

Local browser acceptance opened a freshly generated 120 km flat-profile
race for both men's and women's fields. WebGL rendered all 120 rider entries,
the clock and commentary progressed, category switching retained the seed
and orders, and the local rider camera selected a named rider. The first
run exposed two missing foliage textures; after the release textures were
added, no asset error appeared on reload. The viewer remained visually
sparse because same-group rider positions overlap on the unrecorded lane.
Observed frame rates around 7–12 fps in this local browser session are not
acceptable as a production performance approval. The authenticated Vercel
preview for this branch reached the game's sign-in screen; the new rich
viewer itself has not been verified there or on tennedz.eu.

The protected Motor Lab preview now verifies the signed-in user's team on
the server before constructing a generated race. A missing session goes to
sign-in, and a signed-in user without a linked team goes to onboarding.
Authentication or team-service failures fail closed. The development-only
`/viewer-acceptance` route remains available without a game account when
its development preview switch is enabled. This access guard changes no
race decisions or viewer feed data.
