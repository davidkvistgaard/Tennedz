# Pelotonia viewer package

This is a standalone React client module, with no app shell, synthetic scenery or race engine. React 19 and Three.js 0.187.0 are peer dependencies. It requires a browser; import through a client-only Next.js boundary. The canvas needs no stylesheet. For optional commentary, import `@pelotonia/race-viewer/commentary.css` in the host root layout. Asset URLs are supplied by the feed, not bundled with this module.

```sh
npm install ./pelotonia-race-viewer-0.98.1.tgz three@0.187.0
```

The tarball includes `HANDOFF.md` and complete Next.js client examples in `examples/next/`. Copy `PelotoniaRaceClient.tsx` and `PelotoniaRaceScene.tsx` together, then pass the game's `feed`, authoritative `clock` and optional `serverOffsetMs`. The example owns local target state, reports invalid updates through `onError`, and does not assume a `peloton` group ID.

The supplied boundary uses `next/dynamic` with `ssr:false` from a client component. Keep feed and clock references stable between updates to avoid rebuilding the scene. All spectators receive the same authoritative clock; targets remain per-user state.

The exported TypeScript display contract is versioned as `pelotonia.viewer.v1`. Native adapters are optional helpers for the inspected development formats. Consumers own data fetching, clock-offset estimation, reconnection and asset hosting. A component ref supports pause, seek, speed, follow, light, snapshot and asset readiness/status. Shared-clock mode rejects local time changes.

Run `npm run package:viewer` in the source project to reproduce the tarball. A WebGL2 context enables the primary renderer. If unavailable, the visibly labelled CPU compatibility renderer is used. GPU quality and performance still need verification on target devices; the CPU preview is not a GPU benchmark.

Optional feed `orders` and `actions` independently describe instructions and actual activity on the playback timeline. Types `RiderOrder` and `RiderAction` are exported. `ref.current.getRiderState(id)` returns the current sampled position, group, order and action. All movement remains supplied position data.

Asset readiness includes supplied material image requests. Errors retain a clearly reported preview. `getSnapshot().targetAvailable` distinguishes missing position data from an available but visually occluded rider. Replaced feeds resolve old readiness promises as superseded.

The ref also exposes local camera methods: `setCamera({yaw,zoom,mode})`, `orbit(radians)`, `setZoom(multiplier)`, `resetCamera()` and `getCameraState()`. Yaw is radians; zoom is clamped to 0.55–2.5. Mode is `follow` or `overview`. Reset keeps the selected target. `onStats.camera` includes the actual elevated angle and rendered orbit state. The canvas accepts drag, wheel and focused Q/E, +/−, Home controls without changing race playback.

Position samples may supply cadence in rpm (0–220). The sampler returns a continuous `pedalAngle` for deterministic animation and supports zero-cadence coasting. Neither cadence nor crank/wheel animation changes any source position or race outcome. Foliage requests and instance buffers follow scene lifetime; failed cards remain hidden. Static glTF visibility is preserved, while nested source GPU instancing requires a separate adapter.

The optional `waterBodies` feed layer accepts simple coplanar world-space outlines and optional colors/labels. It renders only supplied boundaries and levels; the producer must also supply the corresponding terrain. Decorative ripples do not model water flow or alter geometry.

Optional `onError(error)` reports invalid React feed props. Invalid replacements leave the live scene, playback and target intact. Invalid initial data waits for a later valid feed without creating a scene. This validation recovery does not cover GPU allocation or other runtime failures.

The same onError callback reports invalid shared-clock or serverOffsetMs props. The last valid shared clock remains active until replaced by a valid update or explicitly disconnected with clock=null.

Version 0.55 adds the server-safe /data entry, asset URL resolution, bounded HTTP loader, deadlines/cancellation, connection status, explicit retry, isolated observers and preflight UI. See LOADING.md and OVERVIEW_DA.md.

Version 0.56 is a visual development round: source-positioned finish crowd, road markings, approach boards, physically improved bicycle rig, world-space CPU cyclist shadows and closer elevated cameras. See VISUAL_ROUND_DA.md. No real game data or target-hardware WebGL sign-off is claimed.

### Route elevation profile

Use `<RouteProfile feed={feed} time={broadcastTimeSeconds}/>` beside the race canvas and import `@pelotonia/race-viewer/profile.css` once in your host layout. Optional versioned `feed.route.profile` can describe the full stage even when the 3D route covers only a local section. Source names, climb categories and sprint locations are never guessed. See ROUTE_PROFILE_DA.md for the data shape and distance-offset mapping.

## v0.87 · Roadside and race conditions

See [RACE_SCENE_DA.md](RACE_SCENE_DA.md) for optional source-driven crowds, road surfaces, weather and crash participants. No collision propagation or race calculation is performed by the viewer.

## v0.88–0.97 · Ten graphics revisions

See `GRAPHICS_TEN_VERSIONS_DA.md` for the ten source-versioned graphical improvements. Source positions, elevations, team artwork, race decisions and broadcast clock remain producer-owned. Browser GPU acceptance is still separate.

## 0.98.1 integration handoff
Exports `Commentary`, `buildCommentary` and `commentaryAt`, with packaged commentary styles and strict TypeScript declarations. `PelotoniaRaceScene.tsx` includes synchronized commentary; import commentary.css once in the host layout. This packaging revision does not change race calculations or claim Motor Lab compatibility.
