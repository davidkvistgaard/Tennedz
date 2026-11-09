# Route-attached finish kit · viewer 0.33+

A finish is optional in `pelotonia.viewer.v1`. Feeds without it keep their supplied scene unchanged. The event kit uses source route geometry; it does not query terrain to place its feet or flatten a mountain/bridge road.

```js
feed.finish = {
  routeFraction: 0.92,
  label: 'FINISH',
  barrierBefore: 60,
  barrierAfter: 20,
  portalHeight: 4.5,
  color: '#25463e',
  accent: '#dec475'
};
```

`routeFraction` is 0–1 along the supplied route's distance axis, including `distanceStations` when supplied. The host can calculate it as `finishDistanceFromStart / totalDisplayRouteDistance`. Include sufficient geometry beyond the finish for the desired run-out. Barrier lengths use metres on that same route distance axis.

The painted checker follows the road grade. The standard portal stands vertically on the route, with supports outside the asphalt. The 0.9m open barriers have narrow rails and low branding strips; road width and rider positions are unchanged. Geometry is not hidden to expose riders. Four GPU draw calls cover the standard kit, excluding its shadow pass; this is a geometry count, not a measured frame-rate claim.

## Imported portal

Declare a normal `gltf` asset, then set `finish.portalAssetId` and optional `finish.portalScale`. The model's origin must be at ground level in the centre of the road, with X across the road, Y up and Z along it. Author its clearance for the supplied road width. Standard checker paint and barriers still render. Set `portal: false` to use an existing venue structure, and set both barrier lengths to zero when the atlas model already supplies its own fencing. The imported model replaces the standard portal and supplies its own text/branding; `portalHeight` and `label` describe the standard portal only.

The imported asset participates in `whenAssetsReady()` and `getAssetStatus()` with its own asset ID. Failed imports are reported and leave the supplied rider scene, painted line and barriers available. New feed replacement/disposal also disposes the finish kit.

## Geography and race ownership

Use atlas route/elevation coordinates and scene assets in the normal feed. The finish kit can anchor on a hillside, on an elevated bridge road, or in front of a supplied landmark. Terrain, bridges, cathedrals and eventual ambient effects remain separate scene inputs; this kit does not generate canonical geography or volcanic animation.

Rider distance samples currently anchor the bicycle midpoint between its wheel centres; a game exporter must map its physical reference consistently. Crossing the line triggers no tactical decision, placing or result calculation. Viewer 0.34 can render a producer-authored `celebrating` action for the confirmed winner; see ACTIVITY.md. The engine supplies positions, actions and result events. Remaining distance is display arithmetic from the observed race front. Each spectator still chooses their own camera while the broadcast clock remains shared.

The demo's two trains, borrowed-wheel action and three sprint launches are fixed synthetic exports, excluded from the installable renderer code. `following` is an added actual-action state in viewer 0.33; use that package version or newer for feeds containing it.

Browser checks: `/finale-test.html` and `/finish-import-test.html`. Hardware WebGL acceptance remains separate from Compatibility rendering. The independent 0.33 Next.js browser acceptance now passes after assets-first static-export syncing. Hardware WebGL quality and final visual sign-off remain open.

## Visual venue dressing · 0.56+

`finish.roadText` optionally paints up to 24 characters on the supplied road 11–13 metres before the line, only when that section is in the displayed route. `finish.markers` contains up to six `{distanceBefore, label?}` entries. Markers are vertical roadside boards on both sides, anchored to source route geometry. Markers outside the displayed route are omitted. The four-draw-call figure above describes the undecorated standard kit; optional boards and road paint add their own meshes.

`feed.spectators` optionally contains up to 300 static event spectators: `{position:[x,y,z], rotation?, scale?, color?, skinColor?, pose?}`. Positions are exact world-space foot anchors; the producer must place them on valid terrain or venue surfaces outside the road. The renderer does not query or reshape atlas geography for them. Uniform scale is 0.5–1.3; poses are `standing`, `clapping` and `cheering`. These are static display poses, not a crowd simulation. The synthetic exporter supplies 60 varied spectators at the finish. Other feeds without these fields allocate none. GPU crowd geometry is merged into one mesh; CPU silhouettes use a separate 16 MiB pixel-budgeted cache with world-aligned lighting and normal terrain occlusion.

## Display coverage · 0.62

Route sampling helpers continue to clamp for environment construction, but rider rendering no longer uses a clamped endpoint for out-of-range source distances. Such riders are omitted from the displayed geometry and picking, while their original state and official result remain queryable. No extra road is generated. `getSnapshot().routeCoverage` reports current sampled coverage, and `getDiagnostics().routeCoverage` reports the last rendered coverage. `targetAvailable` is false for a selected rider outside display geometry; a group remains available if it has any covered member. Follow cameras retain their prior focus while a previously available target is outside geometry. Supply sufficient approach and run-out geometry rather than relying on endpoint overlap.
