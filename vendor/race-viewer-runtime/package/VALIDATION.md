# Build 56 validation record

## Automated checks

`npm test`: 170 tests pass.

- Both demonstration counts (30 and 150), unique IDs and finite samples.
- Samples reordered by rider ID, sparse samples and absent riders.
- Time boundaries and group changes.
- Rejected schema versions, duplicate/unknown IDs, malformed terrain, colors and frame times.
- Shared clock determinism, pause, resume, seek, rate, boundaries and duration mismatch.
- Local camera selection while broadcast time controls are locked.
- External east–west geometry, elevation and heightfield bilinear sampling.
- Externally assigned jersey and helmet appearances.
- Actual Three.js instanced-mesh raycasting after large timeline seeks.
- 150 finite rider transforms and fewer than 45 batched rider render objects.

The geometry/raycast tests stub only CanvasTexture drawing. They do not initialize WebGL or validate pixels.

## Additional build 03 checks

- No atlas landmarks means no invented forest, houses or fields, even on a synthetic feed.
- Supplied pine coordinates are preserved exactly.
- Native club identity uses exact producer palette and SVG torso paths.
- Physical finale summaries transfer `positionM` and `elapsedSeconds` without time-gap-to-distance reconstruction.
- Local-km atlas conversion requires a supplied origin and elevations and preserves polyline alignment.
- Generic mapping preserves producer arrays, identities and texture URLs.
- Native browser acceptance harness passed with authored native-format fixtures: loaded race ID, frozen time 8s, selected r1. No engine was run.

## Browser checks

Performed in the rendered application using the cloud browser:

- Switch 150 → 30; roster/group counts update.
- Search for Felix; select ranking-helmet rider.
- Select rider and group, adjust camera zoom and seek to start/end.
- Import the rotated eastbound JSON fixture through the real file chooser; title, roster, route map and scene change.
- Import unsupported v99 feed; readable error; existing scene preserved.
- Two-tab Host/Join: displayed clocks 169.4 and 169.5 seconds, while host followed the peloton and guest followed the breakaway. Local time controls were disabled in shared mode.
- Keyboard-accessible map selection, timeline and modal Escape/focus containment.
- Public bridge acceptance page: awaited external feed import, applied a frozen clock at 77 seconds and selected r8; returned matching race ID, time and target.
- Canvas click on the middle of the 150-rider peloton selected Oscar Hansen #78.
- Pause held 1:36 while other UI controls were exercised.

## Render limitation

This cloud browser returns no WebGL2 context. It also supplies a low animation-frame cadence. The labelled compatibility renderer draws the same spatial data and camera via Canvas2D; it is not the WebGL image. Its measured CPU projection time is shown independently from the frame cadence.

WebGL shader/material output, shadow quality and sustained GPU frame rates for 150 riders are **unverified**. No 60fps claim is made. Verify those in a WebGL-enabled desktop browser and representative mobile devices before merging the viewer into the game. Production server synchronization, reconnects and clock-offset estimation are also not connected or tested here.

## Model and adapter checks

- Static model flattening preserves transforms, vertex colors, UVs and materials; animated props are rejected.
- Calibrated route station lookup is tested independently of geometric length.
- Explicit native JSON envelopes decode; unversioned input is rejected.
- Browser asset harness: supplied GLB and foliage texture loaded (2 loaded, 0 pending, no errors). Missing GLB reported an error with no invented geometry (1 loaded, 0 pending, 1 error).
- The actual JSON file chooser imported a native-format 30-rider, 20-second authored clip and reached its supplied endpoint.
- These checks still use the CPU compatibility renderer; GPU visual quality and GPU performance remain unverified.

## Package and ground-prop checks

- Explicit rock/grass transforms, batching, asset-backed replacement exclusion and resource disposal are tested. Empty data generates no ground props.
- The npm tarball was installed into an independent scratch consumer with React 19.3.1 and Three 0.187.0. Strict TypeScript compilation passed, including ref, feed, sampler and adapter signatures.
- The installed package was bundled by Vite and mounted in the browser: 150 riders, paused at exactly 77 seconds, local camera target r8, two assets ready without errors. The DOM subsequently displayed 77 seconds.
- The primary application rendered the new landscape at 150 riders and paused at 144 seconds. Observed CPU projection timings were approximately 17–22 ms in this view; these are neither GPU measurements nor sustained frame-rate results.
- Next.js application integration and WebGL GPU checks remain unverified.

## Rider order and action checks

- Independent orders and actual states, exact interval boundaries and reverse seek are tested.
- Changing only orders/actions leaves distances, lanes and memberships identical.
- Invalid activity, overlapping intervals, unknown rider references and invalid effort values are rejected.
- Body movement is bounded and deterministic. Standing changes upper-body matrices, hands remain at handlebar coordinates, and reverse seeks reproduce the same pose.
- The extra articulated body/arm batches increase the rider render-object budget from fewer than 35 to fewer than 45 for the current 150-rider fixture; the count stays independent of individual rider mesh count.
- Browser event markers verified attack, caught and dropped states with the instruction displayed separately; camera selection followed the event rider. GPU pixels remain unverified.

- Shared-clock browser acceptance passed at 60s (attack), 121s (caught), 181s (dropped with hold order), then reverse seek to 60s. Event time jumps were disabled; local selection remained independent.

## Asset readiness and missing-data checks

- Texture readiness waits for completion, shares duplicate image URLs, retains previews on failure and ignores callbacks after disposal.
- Old scene readiness resolves as superseded even if old requests remain pending.
- Missing target resolution never chooses a different rider/group. Real feed future events are filtered while synthetic timeline markers remain scrubbable.
- Browser: kit/road/terrain images loaded (4 resources ready, no errors); intentionally unavailable versions reported three owner-specific errors while retaining preview images.
- WebGL materials and GPU performance remain unverified. All browser checks use the labelled CPU compatibility renderer.

- Browser: selecting r8 with all its position samples omitted kept target r8 and returned `targetAvailable:false`, with a visible no-position-data message.
- Real-feed event test at 60 seconds exposed the attack but not the future catch. Clicking the reached attack in the shared Events tab selected Felix #8 while the clock stayed at 60 seconds and time controls stayed disabled.
- The 0.7 npm tarball installed and compiled with strict TypeScript in the separate consumer.

## Camera control checks

- Orbit offsets and damped angle/distance transitions preserve the elevated angle, including transitions across the ±π boundary.
- Invalid camera settings are rejected atomically. Zoom bounds and reset are tested without changing a frozen shared clock or local target.
- Drag suppression, subsequent click selection, wheel/key handling, browser modifier exclusions and listener cleanup are tested.
- Rendered browser test: 150 riders, 135° orbit at zoom 0.7 then reset. Actual elevation remained 33.88053859059464°, time stayed at 77s and target stayed r8.
- Keyboard E rotated the scene to 0.261799 radians while preserving time/target. A native browser drag changed the main view while leaving peloton selection unchanged.
- Strict TypeScript compilation passed for the installed 0.8 package, including the new camera ref methods. GPU rendering/performance remain unverified.

## Cadence and resource lifecycle checks

- Cadence integration is continuous across sample boundaries, reproduces reverse seeks and handles zero cadence without stopping supplied road movement. Invalid cadence is rejected.
- Coasting holds the foot matrices while wheel matrices rotate with source distance; reverse seeking reproduces wheel orientation.
- Every rider instance-transform buffer receives exactly one disposal event. Foliage cards are hidden while pending/failed, resolve readiness on disposal and cannot be revived by late callbacks.
- Terrain bitmap row orientation is verified against a supplied heightfield with a flat minimum-Z side and steep maximum-Z side. Hidden model hierarchies remain hidden; nested source instancing is explicitly rejected.
- Larch output RGBA alpha extrema are 0–254; transparent corner/background pixels were verified. Original pixels and alpha were copied unchanged into the project.
- GPU pixels, VRAM reclamation on hardware and GPU frame rates remain unverified. Resource lifecycle checks observe disposal signals without creating a GPU context.

- Two-bone leg lengths stay fixed through 100 crank phases at seated and standing hip heights. Elbow lengths stay fixed while wrists remain at the handlebars.
- Browser coasting acceptance passed with 150 riders: cadence/angle stayed 0 at 60s and 62s, supplied distance advanced from 164.24m to 166.30m, and reverse seek returned exactly to 164.24m.

- Browser asset acceptance loaded three resources without errors: spruce foliage, larch foliage and the chalet GLB. The visible forest was inspected with 150 riders.

## Build 10 water and landscape checks

- Concave water triangulation preserves source area/elevation without filling a cutout. Absence of water data produces no water objects. Surface animation leaves all source vertices unchanged.
- Non-planar, degenerate and self-intersecting outlines are rejected; an explicit closing vertex is supported.
- Static CPU faces reuse world geometry, preserve single application of material color, respect visibility/opacity/draw ranges and update lighting colors separately. Terrain-cell caches invalidate when the producer terrain changes.
- The compatibility renderer’s initial shoreline/tessellation artifacts were inspected in the browser, then corrected by submerged-terrain clipping and matching edge fills.
- Supplied water/terrain/landmarks loaded in the browser with 150 riders and 3 completed external scene assets. Geometry/material checks do not establish GPU quality or frame rates.

- Browser water removal passed with the same supplied terrain, 150 riders and no water objects. Invalid non-planar water was rejected without replacing the scene.
- The installed 0.10.0 tarball passed strict TypeScript compilation and the independent browser playback/camera acceptance test with 150 riders at 77 seconds.

## Build 11 texture projection checks

- UV-to-screen affine transforms reproduce rotated and sheared triangle vertices; degenerate UVs are rejected.
- Image drawing clips/restores its context and uses the exact supplied image object without pixel readback. Repeated route images retain their absolute UV phase and reuse a context-local pattern.
- Full automated suite: 69 passed, 0 failed. Browser visual checks below use the CPU renderer; GPU rendering remains unverified.

- Rendered import test: 150 riders, five resources ready, no errors; the supplied striped bitmap visibly covered both route and terrain. Missing route/terrain/kit images reported three owning errors while retaining procedural previews.
- Canvas triangle seams observed with the high-contrast import pattern were reduced using subpixel clip overlap; this remains an approximate raster backend.

- The final 0.11.0 tarball was installed in the separate consumer, passed strict TypeScript compilation and browser playback/camera acceptance with 150 riders, time 77s and target r8. CPU texture projection adds rendering work; no improved frame-rate claim is made.

- Nearly edge-on procedural cliff facets retain slope shading instead of affine bitmap projection, which produced visible seams. Explicit producer terrain artwork is still projected at every slope.

## Build 12 appearance and shadow checks

- Display-sun projection is verified against flat and analytically sloping heightfields, including evening length, source immutability and rejection outside terrain.
- Silhouette meshes retain source placements/UV direction and cache independently of the camera; terrain replacement and light changes invalidate the appropriate entries.
- The CPU vegetation accessor returns only the ready scene-owned image and returns no image after failure/disposal.
- Rider poses share the exact GPU jersey image. Replacing it changes the display image without changing calculated rider positions.
- Automated suite: 75 passed, 0 failed. Shadows and Canvas image projection remain display approximations; WebGL pixels and GPU performance are unverified.

- Flat source terrain simplifies to one silhouette quad; a curved heightfield retains additional facets and every vertex stays at the supplied terrain surface.
- Browser: supplied kit artwork loaded with 150 riders (4 resources, no errors), missing spruce reported exactly one owner-specific error (2 resources ready), and restoring source appearance returned 3 ready resources with no errors.
- Orbit and evening-light controls were exercised while the imported broadcast stayed paused at 77s with target r8 and disabled race-time controls. All browser output is the CPU compatibility renderer.

- Final 0.12.0 npm tarball installed into the independent consumer; strict TypeScript passed. Browser acceptance mounted 150 riders and applied paused time 77s, rider r8, camera controls and asset readiness successfully.

## Build 13 broadcast HUD

- HUD-only change; no race engine, adapter schema or rendering geometry changed. The same v1 data supplies group names, counts, gaps, orders and events.
- Landscape and camera-follow cards removed; live race groups remain visible in a horizontal strip. Other controls reside in a closed-by-default details drawer.

- Browser checks passed with 150 riders: group selection from the top strip; rider search and selection; orders/actions inside the drawer; team and event tabs; replay navigation; expandable route map; panel close and Escape focus return.
- The 390px iframe viewport retained horizontally scrollable groups and a usable details toggle/drawer; its open and closed states were inspected visually. Removed landscape/follow/activity cards are absent from the default scene.
- Existing automated suite remains 75 passed, 0 failed. This is a HUD change; GPU pixels/performance remain unverified.

## Build 14 broadcast navigation

- Three new grouping tests cover source-array immutability, stable ordering independent of roster order, exact counts/IDs, equal-position tie handling, empty input and replaying a split/catch without stale membership.
- Automated suite: 78 passed, 0 failed. UI grouping orders supplied distances only and never reconstructs producer gaps.

- Browser: with 150 riders, a Felix rider query remained intact after keyboard switching to Teams (all six teams visible), a separate Mistral team query did not overwrite it, and End selected Orders. Escape returned focus to the closed drawer toggle.
- At a 390px viewport, the selected chase group was fully inside the strip bounds after horizontal scroll (observed scrollLeft 205px). No new floating cards were introduced.
- The installed 0.14.0 tarball passed strict TypeScript compilation and the browser acceptance flow with 150 riders, paused time 77s, rider r8, camera controls and ready assets. GPU pixels and performance remain unverified.

## Build 15 reached-event header

- Clock sampling tests cover exact event boundaries, no future event leakage, reverse seeking before the first event, simultaneous producer ordering, source immutability and independent samplers.
- Automated suite: 80 tests. The header uses sampled producer events and never generates tactical outcomes.

- Browser acceptance passed with 150 riders on a frozen shared clock: event at 10s shown at playback 15s, catch at 20s shown at 25s, and no event chip after reverse seek to 5s. Future drop at 90s stayed hidden.
- Clicking the header event opened Events while preserving time 15s, rider r8 and camera yaw/zoom. Header layout was also inspected at a 390px viewport.
- Recovered source was rebuilt after workspace maintenance; the 0.15.0 tarball was installed in a separate consumer and its 150-rider playback/camera/asset acceptance passed. GPU output remains unverified.

## Build 16 material checks

- Preview palette tests verify deterministic finite RGB, heightfield immutability, continuous material noise across signed coordinate boundaries, grassy flat terrain and neutral steep slopes.
- Bitmap tests retain minimum-Z orientation and opaque alpha, separate neutral GPU albedo from cached day/evening CPU images, and verify that producer image objects replace preview albedo unchanged.
- Browser inspection isolated the old periodic material bands from projection seams. The revised scene was inspected with 150 riders; CPU underlays and lighting were revised after visible seams appeared.
- Full automated suite: 87 tests pass. WebGL shader output, GPU frame rates and hardware resource reclamation remain unverified.

- Producer-composite cache tests cover source preservation, bounded resolution, reuse, replacement invalidation and bypassing pending/unlit images. CPU light masks use source-atop compositing to retain source alpha without bitmap readback.

- Final browser import acceptance: all five texture channels loaded with no errors. Missing-image checks retained fallback previews and reported failures. A real Canvas2D composite preserved alpha 128 and source red 199 while the derived evening preview darkened red to 185.
- Final 0.16.0 tarball installed in a separate React consumer, built and passed browser acceptance: 150 riders, frozen playback at 77s, camera following r8 and scene assets ready.
- Main browser inspected with 150 riders at paused 144s, drawer closed, day/evening switching without clock changes. These pixel checks use the CPU compatibility renderer.

## Build 17 cadence-linked posture

- 89 automated tests pass. New checks verify opposite pedal phases reverse body sway, coasting holds the standing body pose, and reverse seeks restore it. The instanced rider rig is also checked against source zero cadence.
- Shared pedal-phase calculation is used by GPU limbs and both CPU rider paths. No positions, orders, results or cadence values are generated by this change.

- Browser action acceptance passed with 150 riders at attack 60s, caught 121s, dropped 181s and reverse seek to 60s. Shared clock remained locked and local rider selection worked. The freshly installed 0.17.0 tarball also passed its 150-rider, paused-77s, r8-camera and ready-assets browser acceptance. Browser pixels use CPU compatibility; GPU remains unverified.

## Build 18 initial camera integration

- 90 automated tests pass. Initial selection tests cover arbitrary producer group IDs, largest-group counts, stable ties, empty positions and source immutability.
- React target remains optional. Omitting it retains the controller-selected source group; supplying it preserves the caller’s explicit target.

- Browser acceptance passed with 150 riders and all group IDs renamed to `engine:*`: initial group available, explicit missing group preserved, r8 retained across 60→121→60s group changes and reverse seek.
- The 0.18.0 tarball installed and built in a separate consumer. Its React test omitted the target prop, verified the source group default, then passed paused-77s, rider-r8 and asset readiness checks. GPU pixels/performance remain unverified.

## Build 19 roadbed regression

- Reported GPU screenshot showed terrain occluding the uphill wheels. At 37s the old fixture terrain exceeded rider road height by up to 0.357m. The authored terrain shelf now stays below the road.
- Regression checks cover the full road width at 1m distance intervals, both wheel positions, 30/150 riders and seven playback times including 37s. Imported terrain and rider positions are not modified by this fix.

- All 91 automated tests pass. Browser inspected at paused 37s with 30 riders: asphalt stays visible across the roadbed and the uphill wheels are not masked by grass in CPU compatibility. Actual GPU pixels cannot be verified in this cloud browser.

## Build 20 road edge checks

- 92 automated tests pass. New geometry checks verify source station elevations, exact shoulder extents, paint inset/width, finite normals and immutable route samples.
- GPU decorative ribbons use the existing environment ownership and cleanup. Core wheel/roadbed, rider batching, camera and appearance tests pass. GPU pixel output remains unverified in this browser.

- Installed 0.20.0 tarball built in an independent consumer and passed browser acceptance: 150 riders, omitted-target source default, frozen 77s playback, r8 selection and ready assets. Main viewer checked at paused 144s with 150 riders and drawer closed. These browser checks use CPU compatibility, so the new GPU edge ribbons still need a hardware pixel check.

## Build 21 terrain crack checks

- Isolated browser terrain inspection reproduced the bright grass triangles without riders, vegetation or road. Texture padding and triangulation alone did not resolve them; replacing mixed-resolution tile edges with a uniform 4m grid removed the large inland cracks in the same view.
- New tests cover bounded texture padding on edge-on triangles, zero padding, nonplanar terrain triangulation before shoreline clipping, cache reuse and source immutability. GPU output remains unverified.

- All 94 automated tests pass. Full race view inspected with 150 riders at paused 144s: the large inland bright triangles are absent. Installed 0.21.0 tarball built in a separate consumer and passed source-group default, frozen 77s playback, r8 camera and asset readiness acceptance. Fine shoreline edges and GPU performance remain separate limitations.

## Build 22 shoreline geometry

- Tests cover exact exposed area outside the water footprint, submerged interior removal, concave cutouts, repeated overlapping masks, sloping bank intersections and source immutability.
- Isolated browser terrain inspection shows the broad light shoreline wedges removed in the same camera view; tiny raster edge seams remain possible. GPU pixel output remains unverified.

- All 97 automated tests pass. Browser main view inspected at paused 144s with 150 riders. Installed 0.22.0 tarball built in a separate React consumer and passed default group, frozen-77s playback, r8 camera and asset-readiness acceptance. Checks use CPU compatibility.

## Build 23 feed validation boundary

- Controller test verifies malformed initial data fails before canvas allocation. React feed updates validate before disposal and expose optional typed onError callback.

- All 107 automated tests pass. Browser acceptance used an independently installed 0.23.0 package: malformed replacement triggered onError while retaining the exact live canvas, frozen time and target; a later valid replacement recovered with one canvas and 150 riders. GPU resource failure recovery is not claimed.

## Build 24 shared clock validation

- Controller tests cover invalid clock schema, duration mismatch and non-finite offset, preserving clock identity and camera selection. Valid recovery is accepted; local seeking stays locked in broadcast mode.

- All 99 tests pass. Installed 0.24.0 tarball passed browser acceptance with 150 riders: mismatched clock duration and NaN offset reported through onError, same canvas and previous time retained, valid update recovered, r7 camera remained local, shared seeking stayed locked, and clock=null restored paused local playback. CPU compatibility pixels only.

## Build 25 static-model visibility

- 101 automated tests pass. Depth tests cover hidden/foreground/uncovered points, perspective-correct depth interpolation, closest occluder selection, resize/reset and source immutability.
- Numerical inspection found no rock geometry inside the demo asphalt/shoulder footprint; the reported visual overlap was caused by CPU painter ordering. The correction does not relocate imported props.

- Installed 0.25.0 tarball passed the 150-rider playback/clock/camera acceptance. At paused 101s following r7, comparison with Build 24 shows rocks formerly painted over the asphalt now hidden by the terrain/road depth surface. This is an approximate CPU face-center visibility aid; GPU pixels/performance are not claimed.

## Build 26 cycling detail checks

- 102 automated tests pass, including 150-rider batching, finite transforms, picking, appearance replacement, zero-cadence pedaling and disposal. New LRU tests cover pixel-budget eviction, recent use, replacement accounting, oversized-image bypass and clear.
- Shared drop-bar and ventilation paths remain part of the existing batched meshes. GPU pixel output is unverified; CPU inspection is recorded separately.

- Main browser inspected with 150 riders paused at 144s at two closer zoom levels: wheel/frame edges and kit colors remain readable. The installed 0.26.0 tarball passed playback, clock error recovery and independent camera acceptance. Higher-resolution sprite inspection uses CPU compatibility; GPU detail pixels and GPU performance remain unverified.

## Build 27 CPU rider picking

- Unit coverage includes overlapping painted order, empty hits, outside clicks, capsule endpoints, terrain occlusion and immutable inputs.
- The development acceptance page dispatches canvas click events against overlapping riders from an actual 150-rider scene while checking shared time and reverse seeking.

- All 104 tests pass. Browser canvas-handler acceptance selected r2 (last painted member of the overlapping pair) at 77→101→77s, ignored empty sky, and preserved shared time. At 101s all 150 riders had painted hit regions; at 77s the close camera framed 116. Installed 0.27.0 tarball also passed 150-rider playback, source default, r8 camera and asset readiness acceptance. GPU picking is unchanged.

## Build 28 sprite cache determinism

- Unit tests cover full-rotation/negative-angle key reuse and identical upper-body transforms within the same pose bucket, independent of arrival order.
- A browser acceptance page compares generated PNG pixels after clearing/rebuilding the cache from two different source poses in one bucket, then checks full-rotation reuse and source/clock preservation.

- All 106 tests pass. Browser PNG comparison passed with a 150-rider feed: rebuilding from two different source poses within one cache bucket produced identical pixels; adding a full rotation reused one entry and preserved the source pose and paused shared time. Installed 0.28.0 package also passed playback, camera and asset readiness acceptance. No frame-rate gain or GPU pixel verification is claimed.

## Build 29 Next.js consumer acceptance

- Separate consumer uses Next.js 16.4.5, React 19.3.1, Three 0.187.0 and TypeScript 7.0.2. The module is loaded behind a client-only dynamic boundary; the host game is not modified.

- All 107 automated tests pass. The final 0.29.0 tarball compiled successfully under Next.js 16.4.5 with strict TypeScript 7.0.2 and static export. React/ReactDOM 19.3.1 and Three 0.187.0 were deduplicated in the independent consumer.

- Final Next.js browser acceptance passed with two concurrent view instances and a deep-frozen synthetic 150-rider feed: paused and running clocks synchronized (25ms comparison tolerance on the same host), targets/cameras independent, local seeking locked, A unmount leaves B delivering frames, full unmount removes both canvases, and remount restores both on the current clock. This is component/clock integration, not a real network-service test.
- Focused Q-key input was exercised on spectator A after the test while spectator B remained separate. Browser error inspection showed extension metadata errors only, not an application/hydration error.
- Remaining sign-off gates: target-device WebGL2 quality/performance/resource tests, real game exporter and clock transport, and host HUD integration. Atlas work remains excluded.

- The final Next.js run additionally required both viewers’ whenAssetsReady results to complete with no errors or superseded scene. The full paused/running, camera and unmount/remount acceptance passed again with that gate enabled.

- Joining the broadcast at 77s now chooses the largest supplied group at 77s rather than the opening frame. The final browser run used a deliberately different opening group and passed, including explicit-target preservation. A clean Next.js rebuild was required after replacing the same-version local tarball; incremental dependency caching had retained the earlier module.

## Build 30 road-attached rider presentation

- 111 automated tests pass, including source-frame speed/sparse holds, bounded symmetric corner lean, grade/roll cache separation, crank-to-pedal attachment for 150 riders, reverse seeks and instance disposal.
- Compatibility sprites preserve road pitch and roll. Their tighter reference frustum uses more of the same 192×224 backing store; drawing anchors and world scale come from the actual projection. Cache budget remains 64 MiB (excluding browser overhead).
- Added `/pose-acceptance.html` for rendered-pixel and full-scene QA. This is a graphics iteration, not completion of the integration-ready goal. Hardware WebGL2 quality/performance/resource checks remain open.

- Device acceptance completed both 30- and 150-rider runs in the cloud browser: frozen source unchanged, reverse seek reproduced the rig, rider target preserved, and zero canvases after disposal. Both runs correctly reported Compatibility and left hardware sign-off false. GPU counters were unavailable; CPU results are not GPU performance evidence.
- A clean independent Next.js production build with strict TypeScript compiled the 0.30.0 package. The client examples remain unchanged.

- Final 0.30.0 installed-package browser acceptance passed again in Next.js: immutable 150-rider feed, current-broadcast default group, independent local cameras, paused/running shared clocks, locked local seeking, and unmount/remount behavior.
- Final rendered-pixel acceptance passed: flat/climbing/left/right poses differ, cache rebuild and reverse seek reproduce the result, full 150-rider live scene loads with no asset errors, and the shared clock stays at 60s. The screenshot documents Compatibility mode, not GPU lighting.

## Build 31 terrain visibility and selection

- Adds tests for partially and fully terrain-hidden riders, reset/foreground surfaces, perspective depth, the clicked pixel at ridge boundaries, transparent pixels and clipped overlap selection. Compatibility uses a coarse three-pixel surface buffer and projected rig depths; it is not a replacement for hardware depth testing.
- The runtime change is confined to compatibility drawing/picking. No source trajectory, group, order, action or broadcast-clock behavior is changed.

- All 116 automated tests pass. The independent 0.31.0 package compiled successfully in the separate Next.js 16.4.5 consumer with strict TypeScript 7.0.2.
- Browser activity acceptance passed all seven rendered checkpoints with 150 riders: attacking, bridging, pulling, caught, recovering, dropped and reverse-seek attacking. Producer orders remained separate from actual actions, source JSON stayed unchanged, local rider following worked and shared scrubbing stayed locked.

- Final browser pixel acceptance passed with distinct flat/grade/corner images, full and partial terrain masking, clickable visible pixels, no fully hidden rider hit regions, deterministic reverse seeks/cache rebuilds, and unchanged 150-rider source data. The live scene completed asset readiness and held its shared clock at 60s.
- Final installed 0.31.0 Next.js browser acceptance passed the two-viewer paused/running clock, independent camera, locked seeking and unmount/remount checks again. These are compatibility-renderer checks; WebGL2 hardware acceptance remains open.

- Rig depth includes the tyre/body capsule radius, so a road surface just in front of a wheel centre does not cut away the wheel itself. A nearer ridge still hides that same capsule. This is covered by the additional volume-depth test.

## Build 32 authored finale and sprint posture

- 121 automated tests pass. The new checks cover same-team helpers, ordered lead-out spacing, later captain separation, road/route bounds for 30 and 150 riders, order/action timing, recovery, interval end cleanup, reverse seeks and event visibility.
- Replacing the finale's orders/actions changes no sampled position, cadence or group. The demo exporter alone imports the static finale keyframes.
- The instanced 150-rider rig keeps sprinting hands attached and the recovering helper seated. Sprint head/torso moves forward and lower than a climbing attack, with bounded sway and explicit seated posture respected.
- Initial browser finale acceptance passed eight rendered checkpoints with 150 riders, frozen shared time, local camera selection and unchanged source data. This remains Compatibility-mode evidence; target-device GPU sign-off is still open.

- Final standalone browser finale acceptance passed all eight rendered checkpoints after the sprint-pose change, then returned the camera to the standing captain at 225s. Source JSON, shared clock and local target checks passed.
- The 0.32.0 tarball compiled in the independent Next.js 16.4.5 / strict TypeScript 7.0.2 consumer. The generated module matched the installed module byte for byte, and the demo keyframe module/text was absent from the renderer bundle.
- **Open verification issue:** the newly exported Next.js QA page stayed at its loading message in this cloud preview. Browser logs reported JavaScript parse errors with `<` in static chunks. Restarting preview did not resolve it. Direct asset inspection was blocked by browser policy; no bypass was attempted. Therefore no 0.32.0 Next.js browser acceptance is claimed, including the newly added sprint/rewind assertions. The prior 0.31 runtime acceptance remains historical evidence only. The standalone 150-rider finale browser run is verified.

- The finale QA page now invalidates its earlier result if its iframe reloads, preventing a stale PASS from being shown beside a reset/default viewer during Vite hot reload. Run final browser acceptance after the last fixture/build write.

## Build 33 route-attached finish and mass sprint

- Adds tests for optional finish allocation, flat/steep/elevated road placement with distance-station mapping, source immutability, malformed metadata, asset IDs, resource disposal and full road-width clearance between barriers.
- Added two rival trains and a solo sprinter's explicit following action to the authored export. Tests cover team ownership, separate lanes/groups, three simultaneous sprint states, order/action timing and sufficient source route run-out beyond the finish.
- Broadcast remaining distance uses the observed race front and clamps at zero after crossing. It does not depend on the selected camera target or calculate a result.
- Initial rendered finish inspection shows the standard portal, checker paint and open barriers with the three sprinters. Full final acceptance and imported-portal checks are recorded below after completion.

- The source GLB fixture decodes in Three.js and retains the expected origin, height, width and vertex colours. Browser import acceptance passed with 150 riders: finish readiness/status includes exactly one additional loaded model, source stays unchanged and shared time/target are preserved.
- Missing-portal browser acceptance passed: readiness settles with one error owned by `imported-finish`; the rider scene, checker paint and barriers remain available. The test replaces data objects instead of mutating an already mounted feed, in accordance with the integration contract.
- The Next.js static QA export is now copied assets-first, with the entry HTML renamed into place last and existing hashed chunks retained. This avoids deleting live preview dependencies during an export update. It does not by itself count as a successful browser acceptance.

- The final 0.33.0 tarball compiled under strict TypeScript in the separate Next.js consumer. Browser acceptance passed after assets-first export syncing, including the supplied sprint/rewind checks, independent cameras, shared seeking lock, asset readiness and full/partial unmount/remount. The previous 0.32 loading failure is historical, not a current failing gate.
- Full 150-rider finale browser acceptance passed with both team trains, following another team's wheel, recovery, three sprint launches, source immutability, reverse seeking, shared time and a locally selected finish group. The finish camera was also checked from both sides; a front-facing finish view keeps the cyclists clear of the gantry.
- 132 automated tests pass, including finish-free existing venues, source GLB decoding and the standard kit's resource disposal. Imported-portal and missing-portal browser cases pass. WebGL quality/performance/resource sign-off on target hardware remains separate.

## Build 34 winner reaction

132 automated tests pass. The new test checks winner-only reaction, both raised hands, source cadence reaching zero, exact reverse seek, immutable source and distinct CPU sprite-cache identity. Both renderers use the same arm target helper. Browser finale acceptance is recorded after rendering below. Hardware WebGL remains unverified in this cloud browser.

Build 34 browser finale acceptance passes with 150 riders, supplied winner celebration at 239.5s, competitor sprint states and rewind to the earlier train. The rendered upright raised-arm pose was visually inspected in Compatibility mode; proof: docs/validation/winner-v034.jpg. The 0.34 package also passes the independent strict Next.js consumer production build. The full Next.js runtime browser test remains recorded for 0.33; it was not repeated for 0.34.

## Builds 35–44

Ten tested source checkpoints add celebration variants/release, bike throw, validated official results, shared-clock result API, unobtrusive winner ribbon, result drawer, local stationary finish camera, three authored finale scenarios and atomic host snapshots/control validation. All 146 automated tests pass and the final Vite production build passes.

Current managed preview cannot start: `preview relay unavailable: No such file or directory`. No infrastructure bypass was attempted. New 0.35–0.44 browser acceptance and target-hardware WebGL quality/performance remain unverified. Previous 0.34 Compatibility browser evidence and 0.33 Next runtime evidence above are historical only.

Final rig review added a reach test over both arms throughout all celebration styles. One-arm salutes use less torso extension so the supporting hand remains within the 0.57m arm reach. Both-arm jubilation retains the fully upright pose. All 146 tests and the final production build pass. The expanded Next.js consumer harness compiles with strict TypeScript; browser execution remains unverified for 0.44.

## Build 45 session lifecycle

150 automated tests and the production build pass. New tests cover ignored abort signals/out-of-order race responses, mismatched feed/clock retention and retry, duplicate/old/wrong-race clock updates, authoritative rewind, feed-reference stability, malformed-clock rejection, close, dispose and unsubscribe. The loader is supplied by the host; no real game service is connected. Browser/hardware gates from Build 44 remain open.

Final 0.45 installed package compiles under strict TypeScript in a separate Next.js 16.4.5 consumer; installed viewer.js matches the packaged module byte-for-byte. After preview recovery, the three-scenario browser suite passes, covering one-arm and both-arm jubilation, bike throws, official results, rewind, finish camera and source immutability. The Next session browser test renders two spectators, successfully switches from session-demo to session-B, and retains session-B at 239.5 after a mismatched-duration replacement. These are Compatibility-renderer checks. Hardware WebGL and real network/game-feed acceptance remain open. Rendered evidence: docs/validation/finale-v045.png and session-v045.png.

## Builds 46–55

All 163 automated tests pass. Strict Next.js production build passes for the installed 0.55 package, including a server-rendered /data-check that validates a 150-rider export through the /data entry. Installed runtime JS and declarations match the packaged files. The first installed-package browser run passed two spectators, HTTP exports, relative GLB, revision ordering, rewind, independent cameras, failed replacement retention, explicit retry and close/reopen. Final harness readiness has been strengthened to require both controllers to report the current race ID before checking assets; the final repeat is recorded below. WebGL hardware, real game feeds/transport and final visual sign-off remain open.

Final repeat of the strengthened installed-package harness passes: both controllers report the active race ID before asset checks. The browser also expanded the preflight report and verified 150 riders, 6 teams, 27 frames, 114 route points, 4 unique declared assets, zero unresolved relative references and zero absent rider/frame samples. The rendered two-viewer evidence is docs/validation/integration-v055.png. These are Compatibility-renderer checks; no target-hardware WebGL performance claim is made.

## Build 56 visual development round

170 automated tests and the production build pass. The source rig, venue placement/disposal, world-space shadow projection and CPU cache lighting are checked. Original 0.55 and current athlete/route/terrain/identity/result data compare identically; decoration metadata is the only fixture addition. A first 150-rider browser pass passed all source action, result, camera, seek and immutability cases. It exposed additional CPU cost for full spectator geometry; a bounded sprite cache reduced the observed cost. Final post-optimization browser and installed-package results are recorded below. WebGL target hardware remains unverified.

Final 150-rider browser acceptance passes after all venue changes: team trains, borrowed wheel, recovering helpers, concurrent sprinters, winner celebration, finish, reverse seek, shared clock and local camera; source unchanged. The installed 0.56 package passes a separate strict Next.js production build and server-only /data validation. Its browser harness passes two 150-rider spectators, HTTP loading, relative GLB, clock ordering/rewind, independent cameras, failed replacement retention, retry and close/reopen. Evidence: docs/validation/visual-056-installed.png.

CPU timing observations are individual cloud samples, not a benchmark: initial crowd geometry 260ms versus 195ms baseline; cached crowd 204ms versus a contemporaneous 182ms baseline; final more varied 60-person crowd 268ms. No final FPS improvement or hardware performance claim is made. All browser evidence uses Compatibility rendering. Target GPU testing and reference-level visual sign-off remain open.

## Build 57 shared rider surface

173 automated tests and production build pass. New checks cover the shared jersey UV shell, outward faces, smooth seam normals, bib orientation/clearance and gloves/socks attached to the animated hands/feet during attack, sprint, jubilation and reverse seek. The final 150-rider browser finale suite passes all supplied action/result/camera/clock/seek cases with immutable source. The actual close view is docs/validation/rider-057-close.png. These are Compatibility-renderer observations; target hardware WebGL quality/performance is still unverified. The installed-package result is recorded below after execution.

The installed 0.57 package passes strict TypeScript and a separate Next.js 16.4.5 production build, including server-prerendered /data-check. Installed viewer.js and data.js match package-dist byte-for-byte. Browser acceptance passes two 150-rider viewers, HTTP exports, relative GLB, ordered shared clock, rewind, independent cameras, failed replacement retention, explicit retry, close and reopen. Evidence: docs/validation/rider-057-installed.png. No real game service or target GPU is connected.

The first 0.57 hosting attempt was rejected before publication because accumulated historical ZIP downloads exceeded the 256 MiB expanded limit. Production packaging now retains only the current release's source/package download pair; historical source remains in Git. The normal UI also loaded Bunch sprint · 150 and the finish camera successfully; evidence: docs/validation/rider-057-main.png. This packaging change does not modify runtime viewer modules.

## Build 58 terrain materials

179 automated tests pass. New checks cover deterministic micro albedo, world-coordinate shader injection and import bypass, negative-world tile anchors, cell aprons, day/evening cache separation, bounded cache memory, imported-image bypass, shared GPU/CPU grass geometry and verges outside full asphalt width. The first browser material pattern was visibly too regular; it was replaced with short irregular detail and reduced contrast. Final 150-rider finale and material preview/import/restore suites pass with immutable source and independent camera/shared time. Evidence: docs/validation/terrain-058-finale.png and terrain-058-material.png. These are Compatibility-renderer checks. GPU shader hardware execution, performance and reference-quality sign-off remain open. Installed-package evidence follows below.

The installed 0.58 package passes a fresh separate strict TypeScript/Next.js 16.4.5 production build, including a server-rendered /data-check validating the 150-rider export through the DOM-free /data entry. Installed viewer.js and data.js match package-dist byte-for-byte. Browser acceptance passes two simultaneous 150-rider viewers, HTTP exports, relative GLB, ordered shared clock, rewind, local cameras, failed replacement retention, explicit retry, close and reopen. Evidence: docs/validation/terrain-058-installed.png. No target GPU performance or real game integration claim is made.

## Build 59 performance and GPU gate

185 automated tests and production build pass. Complete 30/150/150 device runs pass in Compatibility, including source immutability, seeks, exact reverse rig, no redundant paused draws, camera/light wake, playback, cache budgets and canvas disposal. The final run reports zero idle scene draws in all three windows; every reported CPU cache is zero after dispose. Visible terrain cells are now culled before surface construction and both geometry/centre caches are bounded. Source-backed finale acceptance also passes with 150 riders, rival trains, winner reaction, shared time and independent camera. Evidence: docs/validation/device-059-report.json, device-059.png and finale-059.png.

The cloud browser does not create a WebGL2 viewer. Browser-internal GPU diagnostics were blocked by its URL policy; no flags, alternate browser process, raw CDP or policy bypass was used. WebGL shader execution, context loss/restoration behavior, target-GPU resource stability and actual hardware frame-rate approval remain unverified. The implemented shader/context/render error reporting is not a claim that these GPU paths have passed hardware tests. CPU medians/p95 include cold/warm cache and camera work in a small sample; the final playback windows were about 1 FPS in this cloud Compatibility environment. No generic active-playback speedup is claimed. Measurements cover the controller's CPU pipeline, not React commits or GPU execution.

The final installed 0.59 package passes a separate strict TypeScript/Next.js 16.4.5 production build, including the DOM-free server-side /data entry. Installed viewer.js/data.js match the packaged runtime byte-for-byte. Browser acceptance passes both 150-rider spectators and explicitly checks getDiagnostics() for rendered frames and no runtime errors, followed by HTTP loads, relative GLB, ordered shared clock, rewind, independent cameras, failed replacement retention, retry and close/reopen. Evidence: docs/validation/integration-059.png. The final device repeat also exercises the wide overview camera; both terrain caches are capped at 16,384 entries to accommodate the complete candidate window. No GPU hardware sign-off is claimed.

## 0.60 · supplied trajectories and local road contact

189 tests pass. The rendered 150-rider track acceptance and played helper transition pass in Compatibility mode. See [MOTION_ROUND_DA.md](MOTION_ROUND_DA.md) for changes, screenshots and limits. GPU hardware remains unverified.

0.60 installed-package browser acceptance and strict Next.js production build pass. Runtime viewer.js/data.js byte comparisons match. Road-pose raster, reverse-seek, cache rebuild and partial/full occlusion picking acceptance pass.

## 0.61 · contiguous source actions

193 automated tests pass. New assertions cover adjacent standing efforts, recovery, bike throw, celebration, short intervals, explicit release, gaps, orders without actions, immutable source and reverse seeks. The actual 150-rider rig preserves its upper-body matrix at the sprint-to-celebration boundary. Browser action acceptance passes rendered boundary-pixel equality, distinct transition pixels, helper recovery and repeatable pixels after reverse seek. The live 150-rider winner scene renders at all tested seeks.

Strict Next.js production build and installed-package browser acceptance pass, including typed source-action neighbor metadata, two 150-rider spectators, shared clock, independent cameras, failure retention/retry and reopen. viewer.js/data.js match installed bytes. All visual browser evidence remains Compatibility-only; target hardware GPU quality/performance and overall graphical sign-off remain open. See ACTION_TRANSITIONS_DA.md.

## 0.62 · source display-route coverage

198 tests pass. Rider samples before/after supplied route geometry remain source data but produce no clamped rider instances, limbs, wheels, bibs or pick targets. Exact endpoints remain renderable. Reverse seek restores all 150 model transforms. Camera regression verifies last-focus retention while unavailable and resumed following after rewind; a failed draw does not replace the last successful coverage diagnosis. Snapshot target availability respects geometry coverage while source state and official results remain accessible.

Browser coverage acceptance passes a deliberately shortened source route, three beyond-end riders, unchanged source winner/action/distance, diagnostic copy isolation, rewind and full-route restoration. Evidence: ROUTE_COVERAGE_DA.md. Hardware GPU and overall graphics approval remain open.

0.62 final runtime: strict Next.js production build and installed-package browser acceptance pass with typed route-coverage inspection, two 150-rider spectators, common clock, independent cameras, rewind, retained state on failed race replacement, retry, close and reopen. Installed viewer.js/data.js are byte-identical to the final package build.

## 0.63 · perspective camera framing

201 tests pass. Actual Three.js projection tests contain all 150 conservative cyclist envelopes on wide, square and portrait viewports at five orbit angles. Source coordinates remain immutable; elevation, close single-rider baseline, manual-zoom relationship and copied camera geometry are checked. Existing source-action and route-coverage/camera regressions remain passing.

Browser camera acceptance passes landscape/portrait resize, orbit, later supplied group frame, manual zoom and reverse seek with 150 source riders. Selected group envelopes fit within the 0.88 NDC boundary after settling at default zoom; elevation remains 33.9 degrees. Unchanged static requests reuse existing frames; changed camera/viewport/time requests must render anew. Evidence: CAMERA_FRAMING_DA.md. This does not verify occlusion-free visibility, terrain coverage at arbitrary atlas scale, hardware GPU rendering or the full visual-quality milestone.

0.63 installed-package acceptance passes in the independent strict Next.js consumer, including typed finite camera position/focus/FOV/aspect/fitted scale, two 150-rider spectators, HTTP loading, shared-clock order/rewind, independent cameras, failure retention/retry and reopen. The library runtime files match installed bytes.

## 0.65 recovered integration validation

210 tests pass. Malformed JSON records and nested positions/barriers produce structured errors without altering source; decoder exceptions retain palette/rig and report kit ownership. Browser import retention passes with 150 riders, four rejected updates and valid vector artwork. The reproducibly generated strict Next.js consumer and installed-package browser acceptance pass controlled invalid target/layout rejection, retained canvas/time, two spectators, shared clock, rewind, retry and reopen. GPU and full art-quality gates remain open.

## 0.84 integration robustness round

243 Node tests passed. Independent strict Next.js consumer build passed, with byte-identical installed viewer/data bundles and all example types checked. Browser compatibility acceptance passed: two 150-rider spectators; HTTP export + relative GLB; shared clock/rewind/independent camera; failed switch retention/retry/close/reopen; throwing host error subscribers; actual controlled/uncontrolled canvas picking; HUD safe-area/panel framing; malformed import retention and valid SVG kit. Browser GPU/WebGL and production game integration remain unverified. See NIGHT_ROUND_DA.md for 20 source checkpoints, boundaries and reproduction.

## 0.85 field category and broadcast

251 automated tests passed. Both 150-rider profiles were checked at 13 source timeline positions through attack/pull/caught/drop, lead-out, sprint and celebration, with identical source positions, root transforms, actions and results, finite limb matrices, unchanged wheel geometry and profile-specific torso geometry. CPU jersey triangles match the selected WebGL geometry and UVs. Versioned physical imports preserve category and source group roles.

Actual browser acceptance passed for distinct rendered women/men fields, 150 source riders in each, attacks/sprint/winner reaction, unchanged source playback, the four allowed headings, independent chase/dropped numbering, and rendered distances 46.1 km, exactly 1.0 km, 999 m and 0 m. A first camera-wait attempt timed out; a rerun with mount waiting and diagnostic reporting passed. The installed Next.js package passed strict build/type checks and browser men → women → men switching, two 150-rider spectators, shared-clock rewind, independent camera, failed replacement retention and retry. Actual browser rendering used Compatibility; target-hardware WebGL verification remains separate.

## 0.86 route elevation profile

259 automated tests passed. New coverage checks elevation versus recorded distance independently of plan-view bends, actual curve/distance-station alignment, finish/run-out trimming, full-stage offset mapping, source immutability, invalid imports, flat/negative/zero-distance profiles, dense 20,000-sample peaks and nonnegative-stage zero baselines.

Browser acceptance passed for the full 68.4 km source profile, climb/sprint markers, expansion and close, invalid-profile import retention, and unchanged shared time, source rider distance and camera target. Actual Race details ROUTE rendering and expanded graphic were inspected visually. Escape closes the native dialog, restores focus to Expand and leaves Race details open. The installed Next.js package passed strict build/types and byte-identical runtime checks; its profile page renders the scoped package CSS, full data and 1080-pixel native dialog. The profile is SVG and does not require WebGL. The underlying 3D browser scene was Compatibility, not a new target-device GPU sign-off. Demo profile data is explicitly synthetic.

## v0.87 · source-driven roadside, conditions and incidents

- 271 automated tests pass, including 30/150 men and women, exact supplied crash victims, fall/recovery/rewind, invalid source data, road material boundaries, last-kilometre/cobbles barriers, seeded multi-row crowds outside the road, absolute weather particles, finite complete 150-rider GPU matrices, resource disposal and bounded warmed CPU crowd sprites at unchanged world scale.
- Strict independent Next.js production build passes with byte-identical installed current viewer/data bundles and the source types.
- Browser acceptance passes all 12 scenarios (six conditions × men/women), 150 riders per feed and approximately 1800 locally generated spectators, source unchanged. Source crash victims: one in single-crash and twelve in mass-crash; recovery and backward seeks pass. See `docs/proof87/browser-report.txt` and `mass-crash-150-women.png`.
- Browser renderer: Compatibility. GPU matrices and draw-group batching are unit-tested; no claim of GPU visual/performance acceptance on target devices. The real game export remains unavailable.
- New data contract and six authored demonstrations are documented in `RACE_SCENE_DA.md`. The producer owns affected riders, trajectories, weather, results and clock. No race, collision, wind-force or traction engine is introduced.

## v0.88–0.97 · ten source-versioned graphics revisions

277 automatic tests pass. The strict independent Next.js production consumer also passes with byte-identical installed renderer/data bundles. Browser functional acceptance passes 30/150 men/women (4 cases), six condition scenarios for 150 men/women (12 cases), and bunch/photo/solo finales (3 cases). Source data, order playback, results, rewind and independent camera selection remain unchanged. Screenshots and reports: `docs/proof97`. The last CPU canopy LOD adjustment was followed by repeated field acceptance and finale acceptance; conditions/source replay acceptance also passed in this graphics round.

CPU Compatibility is still slow in the dense scenes. Timings in the small acceptance samples include warmup/camera work and are not a steady-state benchmark. Browser GPU lighting, canopy shader compilation, hardware performance and an actual game export remain outstanding acceptance work. See `GRAPHICS_TEN_VERSIONS_DA.md` for the ten changes and source revision IDs.
