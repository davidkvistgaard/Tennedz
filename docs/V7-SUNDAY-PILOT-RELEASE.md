# Sunday V7 pilot release

This is an opt-in test of the versioned `physical-first-position-general-race-8`
recorder for the single 2026-11-15 Milano-Sanremo event
`109a9235-44e6-d390-1fa9-aec19b65cf3b`. Other races and historical
recordings continue through their existing paths. The public label V7 refers
to this pilot; the stored engine version is V8.

## Verified candidate

- Current application source: `codex/v7-sunday-integration`, commit
  `36b2931024214bd32063d72d21e82d9e494b9a6a`, based on
  `release/pelotonia` commit `2acb18e681c21d2df6896daecbeeb30da138be55`.
- Preview: deployment `dpl_GZeghAd7uD3eh2LkvQGtqH1NmfxB` is READY at that
  source SHA. Its `/viewer` and viewer JavaScript respond successfully; the
  public sample and participant path were checked on the prior Preview and
  against the disposable auth-test database locally, not against production.
- Auth-test: an immutable 16-rider race completed, replayed in WebGL2, and
  finalized with zero official awards; repeated finalization was idempotent.
- Two disposable managers saved physical tactics through the actual browser
  and API. A subsequent unseeded race used the shared release seed, completed
  through the participant `prepare` endpoint, and finalized idempotently with
  zero awards. This exposed and fixed the standalone/release fallback mismatch.
- A disposable two-team entry reproduced the legacy-order clearing bug. The
  final migration retained the previous order when lineup and captain stayed
  identical and cleared it when the lineup changed. Both physical entries
  remained saved; the function is still executable only by `service_role`.
- The 298 km, 80-rider synthetic capacity run produced 23,840 paid rider-km
  decisions and 80 line crossings against a read-only snapshot of the current
  production profile. It did not assign official placings or points. This is
  performance evidence, not a prediction of Sunday's tactics.
- A second 298 km, 80-rider probe used the read-only Sunday event seed and
  game-date weather fallback with synthetic riders and explicit `conserve`
  test orders. It completed all 23,840 paid decisions and 80 crossings. The
  observed event seed is held only in an ignored local input file, not in the
  repository or this release note. See `docs/V7-298KM-CAPACITY.md`.
- The isolated Next production build and four authenticated local WebGL2
  browser checks passed with a protocol fixture: 16 men at the published
  finish, 16 women before publication, and published 120-rider men's and
  women's races. The fixture never contacts the live database. It proves the
  viewer path and shared publication clock, not hosted race execution.
- The bounded unit suite passed 1,037/1,037 tests on 2026-11-12. It excluded
  only `engine-v2-v93-heterogeneous-field.test.mjs`, a historical V93 stress
  file that stayed CPU-active without completion for over twenty minutes in
  the unbounded full run. That excluded file is not a passed gate.

## Production prerequisites

1. Review PR #4 and the exact SHA. Refresh the candidate against any later
   changes to `release/pelotonia`, then rerun the isolated build, lint,
   focused tests and Preview checks.
2. Apply these migrations in order to the production Supabase project:
   `20261109131922_committed_physical_entry_inputs.sql`,
   `20261109135901_physical_viewer_recording_v1.sql`,
   `20261109140727_physical_viewer_broadcast_source_v1.sql`,
   `20261111033000_experimental_position_race_recording_v1.sql`,
   `20261112012000_finalize_position_race_v1.sql`,
   `20261112023000_position_race_release_seed_fallback_v1.sql`, and
   `20261112030000_preserve_legacy_orders_on_physical_entry_v1.sql`.
   Confirm the recorded and finalizer functions are executable only by
   `service_role`, and review
   security advisories. Production currently has none of these migrations.
3. Set production `PELOTONIA_PHYSICAL_ENTRY_ENABLED=true`,
   `PELOTONIA_V7_RACE_ENABLED=true`, and
   `PELOTONIA_PHYSICAL_ENTRY_EVENT_ID=109a9235-44e6-d390-1fa9-aec19b65cf3b`.
   Deploy after those exact settings are in place. If physical entry is on
   but V7 dispatch is off, the target race refuses to run.
4. Verify the user and all nine agent-managers have saved explicit physical
   lineup and tactics before the deadline, 2026-11-15 18:00 UTC. The current
   repository contains the manager UI and API but no agent-manager scheduler;
   the external agents must call this API or use the UI. The nine agent
   submissions must be checked in the database; old `event_teams.orders` do
   not count. Do not fill missing entries with guessed neutral tactics.
   A read-only check on 2026-11-12 found ten entered teams with ten distinct
   manager auth accounts, but nine of those accounts had no password hash,
   confirmed email or prior login. Their existing route to authenticate and
   submit their own choices must be established before this prerequisite can
   pass. No agent orders have been inferred or submitted on their behalf.
   The following read-only check must return `10 / 10 / 10` before the
   deadline:

   ```sql
   select count(*) as entered_teams,
     count(i.team_id) as committed_physical_orders,
     count(*) filter (where i.selected_riders=et.selected_riders
       and i.captain_id=et.captain_id) as matching_lineups
   from public.event_teams et
   left join public.recovery_physical_entry_inputs i
     on i.event_id=et.event_id and i.team_id=et.team_id
   where et.event_id=
     '109a9235-44e6-d390-1fa9-aec19b65cf3b'::uuid;
   ```
5. Verify the exact production SHA, READY deployment, `tennedz.eu` alias,
   page, JavaScript, runtime, V7 entry, saved archive and shared viewer clock.
   Keep the prior READY deployment ID as the rollback candidate. At the time
   this runbook was written it was
   `dpl_54PzHmstJQLs5Q8nj5VRGqkQfPww` at SHA
   `2acb18e681c21d2df6896daecbeeb30da138be55`; recheck immediately
   before release because the atlas branch is active in parallel.

## Pilot limits

The recording is authoritative for rider distance, energy, contact, group
events and line crossings. Scenery is synthetic and labelled. The finalizer
sets the event to FINISHED but creates no official results, points or awards.
Unresolved same-lane finish ties remain visible as crossings. Viewer access
is restricted to entered teams after finalization. The shared clock releases
commentary and finish events only when their recorded time arrives.
On the observed 298 km profile, an all-`steady` synthetic field refuses
unpayable movement at km 252, while one `conserve` and nine `steady` teams
complete on the same seed. With the read-only Sunday event seed and game-date
weather fallback, the same synthetic all-`steady` order refuses at km 250,
while all-`conserve` and one-`conserve`/nine-`steady` complete. Other rider
profiles and agent orders may
still refuse. Do not bypass the paid-movement guard or treat this probe as a
guarantee for Sunday's actual choices.
Nine `conserve` and one `hard` synthetic team also refused at km 252 on the
observed event inputs. The agents must choose their own tactics, with this
known refusal risk visible to the release operator.
If a manager changes their lineup or captain while saving physical tactics,
the old engine's order is cleared rather than carried over to the wrong
riders. A rollback for that team requires a fresh explicit legacy order before
the old engine can race; restoring the prior READY deployment alone does not
restore that tactical input.
