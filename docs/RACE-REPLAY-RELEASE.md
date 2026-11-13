# Race calendar and replay release — 24 September 2026

The previously tested night-work version is now deployed to **https://tennedz.eu**.

- Code: `dda04b1b4459f7c445a605f857f172881f9541b7`, recovery branch; main was not merged or modified.
- Preview: `dpl_Fh6fXnWCfXjD31tZpMQrdW4zgN6R`, READY, isolated test database.
- Production: `dpl_8LuPDwTtyasweuzwwwQTsVfwfXJj`, READY, production rebuild completed at approximately 13:25 UTC; confirmed canonical domain alias.
- Previous safe production rollback: `dpl_7m2uhh2oz3KkAU8p1DhtXAsqG2Fg` (identity release). Never use old main as a rollback target.

## Database

The owner explicitly approved both production migrations in this task after automatic approval review required a concrete confirmation:

- `recorded_race_replay`: nullable replay column and replacement atomic race-save function.
- `managed_race_calendar`: new service-only request table and race-day creation function.

Both applied successfully to Tennedz (`thacsxtnycmnnpjobgiv`). No data deletion, race execution or test-account creation in production. RLS on the new table confirmed enabled. Both functions remain security-invoker; execute is denied for anon/authenticated and granted to service_role.

Before/after row counts and complete-row fingerprints were identical:

| Relation | Rows | MD5 of ordered JSON rows |
| --- | ---: | --- |
| teams | 1 | 868135b7298df01cebba3adabf96e742 |
| riders | 112 | 13d465bcae31734013058ad6afd2caf6 |
| team_riders | 112 | aa1e16cd43a6b31761abf5fff4b6d5ad |
| events | 3 | ed753436d3c7febe4968e74a83500fe1 |

## Verification

- Preview HTTP checks: unauthenticated API rejected; existing Alice test login resolves to her team; calendar, admin templates and saved replay return successfully; team/calendar/viewer page routes load; logout invalidates session.
- Preview automation used an owner-approved temporary Vercel share link, stored only in ignored local files and not published. It expires within 23 hours. Requests use the configured preview branch origin; immutable preview URLs have a different origin and are not the canonical login URL. Production promotion moves the branch alias to production, as previously documented.
- Production: 15 non-mutating smoke checks passed (including expected validation/authorization failures); actual game data was not written by these tests.
- Production browser: existing owner session resolves to My Team with 112 riders; new calendar navigation loads. Owner login session is preserved.
- Vercel reported no runtime error clusters in the 15-minute window checked after deployment. This is a point-in-time check, not ongoing monitoring.
- Existing complete race, replay, concurrency/rollback and calendar-write integration tests were run on the isolated test project before release; no equivalent race-write tests were run against production.

## Boundaries

The new world data is a separate subsequent recovery-branch commit; it is not imported into the live app or database. No map UI is included. This release publishes the night-work implementation, not the subsequently proposed full visual redesign.

Replay remains a stored representation of the existing engine's strategic phases, not continuous individual physics. Calculation starts at the first registered participant's opening after deadline, or an administrator request, and finishes before playback. There is no precise cron-driven broadcast schedule. At least two teams are required. Existing expired races and the game date remain unchanged. Result/history/viewer spoilers are guarded; current rankings can indirectly reveal points. Individual paid portrait generation remains disabled.
