# Rider orders and actual actions

This is an additive extension to `pelotonia.viewer.v1`. Existing feeds without these arrays render normal seated riding. The viewer does not infer success, fatigue, tactics, speed, lane changes or group membership from an order or action.

`orders` records instructions. `actions` records what actually happens. Each is an array of non-overlapping intervals per rider, using viewer seconds and half-open boundaries: `start <= time < end`. Adjacent intervals are allowed. IDs must be unique within each array; rider IDs and optional target rider IDs must exist in the roster. Inputs are validated before rendering.

```js
orders: [
  { id: 'order-1', riderId: 'r8', start: 35, end: 80, type: 'attack' }
],
actions: [
  { id: 'attack-1', riderId: 'r8', start: 40, end: 80,
    state: 'attacking', posture: 'standing', effort: 0.95 },
  { id: 'caught-1', riderId: 'r8', start: 120, end: 130, state: 'caught' }
]
```

Supported orders: `attack`, `pull`, `follow`, `protect`, `bridge`, `sprint`, `recover`, `hold`.

Supported actions: `riding`, `attacking`, `pulling`, `dropped`, `caught`, `protecting`, `following`, `bridging`, `sprinting`, `recovering`.

Optional fields are `label`, `targetRiderId` and `targetGroupId`. Actions additionally accept `effort` from 0 to 1 and `posture` (`seated` or `standing`). Effort controls small body movements only; it is not an energy or fatigue model. Attacking/sprinting default to standing; an explicit seated posture overrides this. Other actions use seated variations. The animation eases in/out within each interval and depends solely on absolute playback time, enabling deterministic reverse seeking and pause.

Positions, cadence and group IDs remain in the supplied position frames. In particular, `caught` does not merge a group and `dropped` does not move a rider backwards: the producer must supply the corresponding geometry and membership changes. Protecting and bridging similarly require producer-calculated positions; no following AI runs here.

An optional `riderId` on a race event links a timeline marker to a rider. The demo app's marker pauses playback one second after the supplied event and selects that rider. Server-clock mode disables these local time jumps while preserving local camera selection.

The sampler attaches the current `order` and `action` to each available rider sample, or `null` when absent. The React component ref and `window.PelotoniaViewer` expose `getRiderState(riderId)` for the current sample. An unavailable rider returns `null`. Selection never exposes or repositions a rider hidden inside the peloton.

`adaptGameExport` accepts optional `mapping.orders(source)` and `mapping.actions(source)` selectors. `adaptPhysicalFinale` accepts explicit optional `orders`, `actions` and `events` using normalized viewer seconds; it does not guess activity from physical replay fields. The game-side exporter owns conversion from its native instruction schema and absolute race time.

The synthetic alpine fixture authors an r8 attack, a r7 pull, an r8 catch/recovery and a rider at the back losing contact despite a hold instruction. These are test stage directions, not engine calculations or canonical race data.

In 0.17, the upper-body sway and standing bob use the same integrated pedal phase as the legs. Zero source cadence holds the cyclic body pose while interval entry/exit easing still applies. Wheel rotation continues to follow source distance. This changes presentation only.

From viewer 0.33, `following` can describe an actual wheel-following action with `targetRiderId`, including another team’s rider. It never generates a path or chooses a wheel. The synthetic finale supplies two competing trains and one solo sprinter as authored frame data.

## Winner reaction (viewer 0.34+)

The producer supplies an actual `celebrating` action for the confirmed winner. Use an explicit `[start,end)` interval, for example `{id:'winner',riderId:'r1',start:238.5,end:240,state:'celebrating',effort:0}`. The viewer blends into an upright, both-arms-raised pose in 0.7 seconds, holding it until the interval ends. It never infers a winner or gates the action on the finish line: a producer may deliberately author an early solo celebration. Cadence, speed and position remain supplied data; use zero cadence samples for coasting. Reverse seeking clears the reaction. CPU and WebGL renderers share the hand targets; CPU cache identity includes the reaction blend.

Viewer 0.44 additionally supports optional celebrationStyle (both-arms, left-arm, right-arm), transitionOut seconds, and the actual-action state throwing for a source-timed finish throw. See RESULTS.md for examples and constraints.

## Continuous adjacent poses · 0.61

The sampler adds output-only `actionTransition: {previous, next} | null`. Only exact interval adjacency is joined; gaps and unrelated riders are never bridged. The current `action` still switches at `start <= t < end`, so a completed pull is reported as recovery at the supplied time while the body eases into recovery. Adjacent standing actions no longer return to seated riding at their shared boundary. Sprint-to-celebration similarly begins from the preceding sprint pose. Entry is bounded to the new interval duration (normally 0.8 seconds; celebration 0.7), allowing short actions to meet their outgoing boundary pose. Explicit celebration releases are respected. An isolated celebration without a release continues to hold until its half-open interval ends, as before.

All poses are functions of source intervals, absolute playback time and source crank phase. No frame-history state, tactical inference or trajectory integration is used. The viewer does not extend interval ends to keep a celebration visible at the final timeline endpoint.
