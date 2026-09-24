# Pre-race orders v1

A first tactical edition for one-day races, on the recovery branch only. Production is unchanged.

## Player experience

Choose Balanced racing, Ride for the captain, Chase a breakaway, or Save energy. Plans initialize suggested roles, then each of the selected eight riders can be adjusted. The chosen captain has a fixed captain role; others can be free riders, helpers or attackers. Individual effort is Careful, Balanced or Aggressive. The form explains costs and is disabled after the deadline. Selection and orders share one save; saved state includes orders and is restored after reload. Existing lineup presets still concern rider selection, not a separate library of tactical presets.

## Calculation

Engine version recovery-one-day-4-orders. Existing saved races are never recalculated. Missing legacy orders default to neutral balanced racing. Orders cannot alter seed ratings or points rules. Helpers contribute a capped support bonus from endurance/strength; they sacrifice their own performance and add fatigue. Attack roles increase weighted early-break selection probability and add fatigue; selection is not guaranteed. Aggressive effort gives a modest speed benefit with extra fatigue, careful effort trades speed for less fatigue, and conservation reduces speed and fatigue. Commentary records the team plan and role counts before playback. No live manager commands exist.

This remains the existing strategic-phase engine. Support is a race-level approximation, not continuous positioning/energy simulation. Terrain-specific attack windows, protected-sprinter lead-outs, custom conditional orders, detailed tactical outcome analysis and large-sample balance calibration remain subsequent work. All coefficients are provisional. No new production calendar has been generated.

## Persistence and deployment

Migration 20260924182155_race_orders.sql was created by the official Supabase CLI and applied only to isolated project nxhvaoonnvmvohqaxfdx. It adds nullable event_teams.orders and a service-only SECURITY INVOKER RPC. Existing entry validation, locking, fee receipts and ownership rules are reused inside the same transaction. Legacy saves clear stale orders, defaulting to neutral tactics. Snapshot already serializes the full entry, so finalization compares orders too. No existing rows are rewritten by the migration.

The new API requires this migration before deployment. Production migration and deployment require the owner's explicit approval. Roll back code before considering any schema rollback; the nullable additive column can safely remain.

## Verification

Unit checks cover invalid plans/roles/versions/foreign riders, captain reconciliation, helper tradeoffs, deterministic output, fatigue and unchanged seeding. Browser journey covers plan/role/effort save, failed save/retry and reload at 390/1440 pixels, then actual-engine-generated replay/results through mocked API transport. The isolated SQL transaction verifies real persistence, single entry fee across repeated saves, invalid order rejection, snapshot capture and deadline enforcement; fixture changes roll back. RPC execution permissions checked: anon/authenticated denied, service_role allowed.

41 unit tests, all 16 browser tests, ESLint and the 42-route production build passed. The two extended journey tests were rerun on the final build, including disabled orders after deadline. Mobile and desktop screenshots were reviewed. Initial browser attempts used an older production build; rebuilding resolved the missing-form assertions. Existing Next ESLint-plugin and Node module-type warnings remain. No race was executed or modified on production.
