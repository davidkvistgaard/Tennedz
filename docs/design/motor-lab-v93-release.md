# Guided Motor Lab v93 release checkpoint

This branch starts from the exact production commit `0ca7cbf` and ports only
the bounded v93 Motor Lab, its engine dependencies, read-only point policy,
local verification fixtures and the guided `/team/motor-lab` entry. It does
not merge the broader preview branch into production.

The page offers a ready 40 km sample and a 120 km two-manager example. Players
can select terrain, distance, field size, gender, starting fatigue, own orders,
default or custom rival orders, a nominated finisher and an optional lead-out.
The recorded road, individual line, provisional points and rider replay share
the same run. Points are an illustration; no award rows or official results are
saved. Complex late bunch exits and front catches still return the validated
road and a clear refusal without inventing a finish.

The new route is selected only when both
`PELOTONIA_V91_PLAYTEST_ENABLED=true` and
`PELOTONIA_V93_COASTED_PLAYTEST_ENABLED=true`. Otherwise the existing Motor
Lab remains available. The API is gated by the same flags and requires an
authenticated user; its per-user rate limit is six runs per minute.

Verification on this production-base branch:

- `pnpm build` and `pnpm lint` passed.
- The isolated local browser suite passed all 36 v93 flows, including the new
  guided mobile journey from login to result and rider replay.
- The old Motor Lab passed both browser flows with the flags absent.
- The playable acceptance suite passed 20 route/field/finale cases; the point
  preview suite passed three cases; the focused v93 contact/bounds suites
  passed 13 cases.
- The full unit suite passed with two-way concurrency after porting the
  updated v2 foundation and Motor Lab contract tests. The unchanged v93
  motor was previously verified on the preview branch with 975 passing unit
  tests. The Vercel preview build for this selective release reached READY;
  a production smoke remains required after activation.
