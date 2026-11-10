# Motor Lab checkpoint viewer, version 1

The generated viewer at `/team/motor-lab/live` is an **experimental, fictional Motor Lab exercise**. It is separate from saved guided game races, the physical-first V94 branch, and the immutable viewer samples. The motor still owns the simulation. This integration does not alter its tactics, groups, gaps, or finish calculation.

## Data path

1. The protected `/api/motor-lab/viewer-run` accepts a plan, route, seed and existing Motor Lab team orders, then runs the existing `runKilometreLab` through `createMotorLabPreviewSource`. The original `createMotorLabPreview` summary keeps its previous output. The form exposes chase contribution, attack posture, break response, break work, a scheduled captain break attack, captain support and late effort; it does not create new motor tactics.
2. `motor-lab-checkpoint-adapter-v1.mjs` validates the full raw recording and emits `pelotonia.viewer.v1`. Its `raceId` includes the plan, route, seed and normalized orders. Every one of the 32 riders appears exactly once at each **recorded** kilometre 1–160. The adapter adds a neutral start frame at kilometre 0 from the known starting roster; it is not a measured motor checkpoint.
3. Each rider's longitudinal coordinate is the **recorded checkpoint kilometre**. A group gap remains a number of seconds. The adapter does not turn it into simultaneous metres, a wheel order or a lane.
4. `scenicPresentationV1` adds trees, spectators and other synthetic scenery for the WebGL canvas. It does not change a sporting field. The canvas can space riders who share a recorded coordinate; the sporting overlay continues to use the unspaced feed.
5. `checkpoint-broadcast-session-v2.mjs` signs the normalized input, exact motor/tuning versions and server start time. A newly generated race starts at its own server time, and the shareable URL carries the signed session. Another signed-in spectator reruns the same deterministic source and joins the same clock. The token cannot move the start time or change the orders without invalidating its signature. Sessions expire after 30 days; because this experimental feed is recomputed rather than stored, an engine version change invalidates an older session instead of silently rewriting its race. A dedicated `PELOTONIA_VIEWER_SESSION_KEY` is preferred; the existing server-only service key is a fallback. Neither key is sent to the client.
6. `/api/motor-lab/checkpoint-clock` reports the same signed session start time to all spectators. The adapter assigns eight display seconds per recorded kilometre because this legacy motor has no measured elapsed checkpoint clock. The viewer labels this as **checkpoint playback**, never actual race time. Camera selection remains local.
7. `/api/motor-lab/checkpoint-result` withholds the engine's provisional model classification until that session reaches the finish. The initial feed and signed URL contain no result or winner. The viewer labels the list as provisional; it is not an official game result.

## What the recording can and cannot support

| Field | Source and coverage | Viewer treatment |
| --- | --- | --- |
| Rider identity and category | 32 fictional named men in four exercise teams | Copied; no women's field is fabricated from this source |
| Distance and route profile | 160 one-kilometre route samples | Copied as checkpoint distance and elevation; road geometry is schematic |
| Rider group | One recorded state per rider and kilometre | Road groups and peloton copied; chase and dropped headings numbered after sorting by recorded gap; each dropped rider stays solo because contact between dropped riders is not recorded |
| Time gap | Recorded road-group and rider deficits in seconds | Displayed as seconds; never used to derive simultaneous rider metres |
| Recorded event | Successful break joins, catches, drops, selected and blocked break attacks, and recorded chase-group formation | Emitted at the relevant checkpoint; a committed order that could not start is never described as a successful attack; commentary filters by shared playback time |
| Tactics and energy | In raw engine recording | Do not manufacture visual actions or energy from a team order; full tactic and energy inspection stays in Motor Lab |
| Elapsed race clock | Absent | Explicit presentation cadence, not a claimed race time |
| Rider lanes, wheels, contact proof | Absent | Canvas spacing illustrative; no rear-group contact inferred |
| Finish | Provisional model ranking in raw engine output | Separate endpoint reveals it after finish, marked provisional; no official result or awards |
| Geography, team kits, helmets | Absent from this fictional exercise | Synthetic scene and palette clearly identified; not canonical Atlas or user's real team |

The saved game race viewer at `/team/view/[event_stage_id]` still uses its versioned guided replay adapter. The experimental physical-first motor branch is untouched. Future engine recordings with paid crossings, authenticated game identities and official finishes can use another versioned adapter; the viewer contract does not require the engine to imitate a demo.

## Verification

The adapter tests run 96 full races across two routes, four plans, three seeds and four order sets: 491,520 recorded rider-kilometres. They assert 161 complete frames, preserve raw gaps, keep early climb drops solo, and check catches. Signed session tests cover the same start time for spectators, tampering, expiry and finish release. Browser acceptance uses the actual protected API and a full 160 km source race, verifies WebGL2 and 32 rendered riders, camera and commentary, then opens an actual finished replay with a test-only signed session and verifies all 32 provisional results without a mocked result endpoint. A phone-width browser test covers asset fallback. The browser fixture is not a claim that a saved game race was verified in production.
