# Account-saved club identity (pending production approval)

A new club_identities table stores one palette/pattern pair per team. API GET/PUT /api/team/identity uses verified Supabase Auth, the existing unique user/team lookup, same-origin mutation checks, no-store responses and an explicit team-id match. Only allocated choices pass server validation; custom colours and supporter-only designs are rejected. No sporting fields are accepted or modified.

The table has RLS enabled and no anon/authenticated grants. Only the server's existing service-role client can select/insert/update; no browser receives this credential. No team/rider/race data migration or backfill. The additive migration is supabase/migrations/20260924204503_club_identity.sql, created with the Supabase CLI.

The provider uses server data, refreshes on focus/visibility, polls while visible every 30 seconds and signals other tabs after saves. Separate accounts remount the provider. In-flight reads cannot overwrite a completed save. Save errors retain the old kit and expose retry. Concurrent saves use last-successful-write-wins; explicit unsaved editor choices stay local until saved. Earlier browser-only previews are retained in localStorage but not automatically uploaded. Standard palette/pattern assignment remains deterministic (catalogue ordering and seed v1 must remain stable).

The supporter designer remains an explicitly labelled preview and cannot apply or persist custom designs. No payment integration.

Migration applied ONLY to nxhvaoonnvmvohqaxfdx (pelotonia-recovery-auth-test), not thacsxtnycmnnpjobgiv (Tennedz production). Supabase project listing confirmed isolation after initial automatic approval review misclassified the test project; retry with verified identity succeeded. SQL tests checked RLS/grants and two upserts in a rolled-back transaction. No production DB changes made.

Recovery build, lint and 50 unit tests pass. Existing 20 browser journeys pass; two new persistence journeys pass after scoping alert assertions away from Next's route-announcer element. Tests cover separate browser contexts, saved choices/reload/focus, failed save with no mutation, storage-unavailable retry, anonymous access, foreign-team GET/PUT, external origins and forged palette rejection. Browser protocol fixtures and actual isolated SQL complement each other; a full real-auth-to-real-database browser journey is not claimed.

A separate release candidate based on the live visual package includes persistence without race-order migrations or Race Lab. Before production: obtain owner approval for this additive migration and release, apply only this migration, rebuild with production settings, then verify. Roll back the application if necessary while retaining the additive table and saved choices.

References checked: https://supabase.com/changelog.md, https://supabase.com/docs/reference/javascript/upsert, https://supabase.com/docs/guides/database/postgres/row-level-security.
