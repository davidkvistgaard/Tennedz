# Pelotonia viewer — integration handoff candidate 0.65

This is a development candidate for isolated game-side integration trials; the viewer is not finished. It is not a production graphics sign-off. No Tennedz repository, race engine, database or atlas is connected or modified.

## Install and mount

Install `pelotonia-race-viewer-0.65.0.tgz` and `three@0.187.0` in the game's development branch. React 19 is a peer dependency; keep one React and Three installation in the application.

Copy both files from `examples/next/` into the same client component directory:

- `PelotoniaRaceClient.tsx` supplies the Next.js client-only loading boundary.
- `PelotoniaRaceScene.tsx` owns the spectator's target and exposes renderer/error status outside the scene.

Render `PelotoniaRaceClient` with `feed`, `clock` and optional `serverOffsetMs`. The feed is a complete immutable race display export. Keep its object reference stable while updating the clock; replacing the feed rebuilds the scene. Do not mutate frame arrays in place. The caller owns transport, reconnects and server-offset estimation.

Do not hard-code a `peloton` group ID. Omitting the initial target selects a supplied group at the current broadcast time when joining; later rider/group selection belongs to that spectator. The example deliberately stores it locally.

## Boundary and ownership

| Input | Producer responsibility | Viewer behavior |
| --- | --- | --- |
| Route and terrain | Local metre coordinates, route width/elevation, terrain heightfield | Renders supplied geometry; does not create geography |
| Positions and groups | Calculated rider distance, lateral position and group IDs per frame | Samples and interpolates display positions |
| Team/leader appearance | Team designs, texture URLs, awarded jersey and helmet IDs | Applies the supplied appearance |
| Orders and actions | Instructions and actual action intervals separately | Displays state and posture; never calculates tactical outcomes |
| Gaps and events | Calculated seconds and reached-event times | Samples producer data; the host draws the broadcast HUD |
| Clock | Position/duration in seconds, epoch in milliseconds, rate and paused state | All spectators sample the shared timeline; local camera stays independent |
| Assets | Reachable, CORS-enabled URLs with supported formats | Reports readiness/failures and retains documented fallbacks |

Coordinates use `[x,y,z]` with Y up, horizontal X/Z and metres. Rider `distance` and `lateral` are metres; positive lateral is right of the route tangent. Terrain heights are row-major (`row * columns + column`) with origin/step in X/Z. The roster supports 1–150 riders; 30 and 150 are the tested demonstration sizes.

Clock position/duration are seconds. `serverEpochMs` is the server epoch at which that position applies; `serverOffsetMs` is server time minus client time, in milliseconds. Clock duration must exactly match feed duration.

The schema is `pelotonia.viewer.v1`; `contract.d.ts` and `index.d.ts` ship in the tarball. `validateFeed` and `validateClock` reject malformed input. React `onError` receives invalid feed/clock/offset updates while the last valid state remains visible. GPU allocation and arbitrary runtime exceptions are outside this validation recovery contract.

The library contains the scene component and adapters, not the standalone lab's HUD, room relay or synthetic landscape assets. The game supplies its surrounding UI. No stylesheet is required by the library.

## Adoption checks

The accompanying `IntegrationHarness.tsx` is an acceptance tool, not a game screen. Mount it behind a client-only Next.js boundary. It fetches `/demo-feed-v1.json`, freezes that synthetic feed and clock, and checks two simultaneous viewers: shared time, independent targets/cameras, locked local seeking, individual unmount, complete unmount and remount.

The package has been compiled in a separate Next.js 16.4.5 / React 19.3.1 / Three 0.187.0 consumer. Strict TypeScript 7.0.2 compilation and the two-viewer browser acceptance passed, including paused/running time, camera independence and unmount/remount. Detailed evidence is in the included `VALIDATION.md`; repeat with the game’s own exact versions.

## Remaining gates

- Real game data/exporter wiring cannot be signed off before that export exists. The included native helpers are optional adapters for inspected development formats, not a canonical engine schema.
- Primary WebGL2 graphics, GPU frame rate/resource behavior and target-device/mobile budgets still need hardware verification. The cloud browser checks use the labelled CPU compatibility renderer.
- Reference-image art quality is not a passed acceptance criterion. CPU sprite drawing, visibility and picking are deliberate approximations.
- Production clock transport, reconnection and deployment belong to the game. The viewer accepts the authoritative clock but does not supply that service.

Atlas generation, globe-to-city navigation and geography streaming are explicitly outside this handoff scope.

## Device verification

Open `/device-acceptance.html` in the standalone lab on each target device. It loads frozen 30- and 150-rider exports, checks seeks, camera ownership, source immutability and canvas cleanup, then records five-second renderer measurements per roster size. Download the JSON report. GPU counters are reported only when WebGL is available; they are diagnostic counters, not browser/driver memory measurements. A compatibility run cannot approve GPU performance. Visual review and agreed device performance thresholds are still required.

`displaySpeed` is sampler output in metres/second, derived from adjacent supplied frame positions. It drives a bounded visual corner pose only; no positions or race outcomes are integrated from it. It is not an extra producer input requirement.

## Current Next.js verification

Historical baseline: the independent strict Next.js production build and browser acceptance passed with the 0.33.0 package. Two frozen 150-rider viewers share paused/running time, receive the supplied sprint state, clear it on rewind, preserve independent cameras and pass unmount/remount checks. Static preview exports are copied assets-first and publish entry HTML last, retaining already-served hashed chunks. Target-device WebGL and final visual sign-off remain open.

The finale keyframes are synthetic exporter data only (`src/demoFinale.js` in the standalone source); they are excluded from the renderer tarball. No engine, atlas or production data is connected.

## Optional finish and actual following actions · 0.33

See FINISH.md for the route-attached finish contract, imported portal model origin/clearance, and run-out geometry. `ViewerStats.finishRemaining` reports the observed race-front distance to the finish independently of the spectator's camera. Crossing it creates no race outcome.

`following` describes an actual borrowed-wheel action; `targetRiderId` can refer to an opponent. The engine still supplies every position, group change and actual action. The lab's two rival trains, solo sprinter and fixed close finish are synthetic exporter data, absent from the installable renderer code.

Winner reactions: producer-authored `celebrating` actual-action intervals in viewer 0.34. See ACTIVITY.md; timing, cadence and race results remain engine-owned.

Version 0.44 adds official results, one-arm celebrations, bike throws and local stationary finish camera. See RESULTS.md for the producer contract and publication/rewind rules. No production game service or atlas is connected. Managed preview is unavailable in the current environment; browser acceptance for these changes is not claimed.

Version 0.45 adds an optional host-side createRaceSession store and RaceSessionScene example. See SESSION.md for abort, feed/clock pairing, revision and lifetime ownership.

Build 45 browser update: managed preview recovered. Three 150-rider finale scenarios pass in Compatibility mode. The installed Next.js session consumer renders two spectators, switches to race B and rejects an invalid replacement while retaining race B. This is synthetic client integration, not real game transport or hardware WebGL validation.

Version 0.55 adds the server-safe /data entry, asset URL resolution, bounded HTTP loader, deadlines/cancellation, connection status, explicit retry, isolated observers and preflight UI. See LOADING.md and OVERVIEW_DA.md.

Version 0.56 is a visual development round: source-positioned finish crowd, road markings, approach boards, physically improved bicycle rig, world-space CPU cyclist shadows and closer elevated cameras. See VISUAL_ROUND_DA.md. No real game data or target-hardware WebGL sign-off is claimed.

## 0.59 diagnostics and hardware gate

`ref.current.getDiagnostics()` returns a copy of renderer state, bounded CPU pipeline timing distributions, error history, cache counters and WebGL resources where available. These are not GPU execution timings. Listen to `onError` for shader/context/render failures. A paused, settled view skips expensive redraws; the authoritative broadcast clock and local camera ownership are preserved. Run `device-acceptance.html` visibly on target hardware before approving WebGL quality/performance. This cloud release has passed Compatibility, not GPU hardware acceptance.

## 0.60 trajectory display

The sampler adds output-only `displayVelocity` from a deterministic ±0.25-second source window. It orients the model along supplied longitudinal/lateral motion without changing positions. Model origin, asphalt offset and tyre support now share a local road frame across renderers. See MOTION_ROUND_DA.md for tested scope and local-plane limits.

## 0.61 contiguous actions

Sampled `actionTransition` identifies exactly adjacent previous/next actual actions. This output-only metadata keeps pose transitions continuous while `action` still changes at the exact half-open source boundary. Gaps do not carry an action forward. Orders alone never create a pose. Input contract v1 is unchanged. See ACTION_TRANSITIONS_DA.md.

## 0.62 display-route coverage

Source samples outside `[0, route.length]` remain available through `getRiderState` but allocate no visible rider pose or pick target. The viewer does not extrapolate geography or clamp these riders to endpoints. `getSnapshot().routeCoverage` describes the sampled authoritative time; `getDiagnostics().routeCoverage` describes the last rendered sample (null before the first replacement-feed render). Both expose route length, available-rider count and IDs before/after geometry. `onStats` includes the same rendered coverage. Returned diagnostic arrays are copied.

`targetAvailable` now requires a source target within the display geometry; it does not guarantee line of sight or screen visibility. For an already-followed rider leaving the route, the camera holds its last available focus. A subsequent in-range sample restores following. Results and actual actions still belong to the producer, including an off-route winner. Supply sufficient route before/after the finish and use explicit distanceStations for the producer's distance axis. See ROUTE_COVERAGE_DA.md.

## 0.63 perspective group framing

At default zoom, follow cameras fit conservative cyclist envelopes using the actual vertical FOV, viewport aspect, source target positions and local orbit angle. The former capped radius heuristic is removed. Elevated polar damping and independent spectator yaw/zoom are retained. Manual zoom remains a multiplier and can deliberately crop the group. Fit is a projection property after settling, not a promise of line of sight.

`getCameraState()` additionally exposes copied `position`/`focus` vectors, `aspect`, `verticalFovDegrees` and `fittedScale` after scene construction. These describe the actual camera for integration diagnostics and host annotations. Camera far distance and WebGL fog range expand for large framed targets; no terrain or roads are generated. The Compatibility renderer still has a bounded local terrain window, so this is not an atlas-wide streaming renderer. See CAMERA_FRAMING_DA.md.

## 0.64 recovered HUD framing

Pass cameraSafeArea={{top:headerPixels/viewerHeight,right:panelPixels/viewerWidth,bottom:controlsPixels/viewerHeight}} to RaceViewer or the Next.js wrappers. Missing edges are zero; each edge and each opposite-edge sum must be within 0–0.8. Updates replace all edges, {} clears them, removing the React prop clears them, and resetCamera retains them. Invalid React props report onError while retaining valid state; imperative invalid settings throw. Values are local camera configuration, never race-feed data.

The lab measures its own header, broadcast bar, controls and details panel. Off-axis projection preserves physical elevation and source positions. Manual zoom can still crop a group; extreme crowded layouts cannot guarantee a useful display.

Run npm run release to regenerate installable/source archives and the static build. New generated release archives are ignored by Git; historical tracked archives are preserved. This prevents binary download bundles from inflating each source push.

## 0.65 input and package verification

Malformed JSON records are rejected before scene allocation. Invalid controlled React targets report onError and retain the scene. Inline artwork decoder exceptions report an asset error and retain team palette. Run npm run release:checked to rebuild tests, package, strict isolated Next.js consumer and static assets. See IMPORT_BOUNDARY_DA.md.

## v0.87 · Roadside and race conditions

See [RACE_SCENE_DA.md](RACE_SCENE_DA.md) for optional source-driven crowds, road surfaces, weather and crash participants. No collision propagation or race calculation is performed by the viewer.

## v0.88–0.97 · Ten graphics revisions

See `GRAPHICS_TEN_VERSIONS_DA.md` for the ten source-versioned graphical improvements. Source positions, elevations, team artwork, race decisions and broadcast clock remain producer-owned. Browser GPU acceptance is still separate.
