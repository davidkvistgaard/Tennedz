# Calendar, autopilot and rankings V0.1 — implementation boundary

This package extends the existing `events`, `event_teams`, rider and team records. The new race engine remains isolated. Nothing here deploys a race schedule or changes live data.

## Implemented in this branch

- The Wednesday/Sunday placement utility maps source one-day dates into the same calendar week, retaining source dates as metadata. Stage races remain exempt from the two weekly one-day slots. A shared pair ID can relate distinct men's and women's events without combining their fields.
- The race calendar shows separate event cards, filters, entry and order readiness, tier points and a direct link into the existing one-day team/order page. An event with no scheduled date is explicitly shown by its existing entry deadline.
- Managers can save four gender/format default squads with a captain. The server validates ownership, full team size, distinct riders and current roster membership. A deterministic resolver replaces unavailable defaults from eligible teammates and refuses to invent riders.
- One signed points ledger carries the rider, credited team, event, season, gender, source, format, tier, result type, place and policy version. Filtered rider and team rankings aggregate that ledger, including combined team points. Reversal rows preserve the audit trail.
- Race tier and placing values live in `lib/calendar/points.mjs`, separate from the engine. Inactivity thresholds and default team sizes live in `lib/calendar/config.mjs`.
- The additive migration creates the required private tables and read RPCs; no existing events or results are rewritten.

## Still required before the package is operational

- Verify and apply the migration on an isolated Supabase test database, then populate a reviewed UCI/Pelotonia event schedule with real source dates and profiles. No calendar import or event creation job exists yet.
- Connect automatic entries to the existing transactional join/order flow. Saving defaults does **not** currently submit an event entry. Resolve simultaneous-event priority and rider availability across overlapping races before enabling unattended participation.
- Connect finalized one-day and stage-race results to idempotent ledger awards. Until then the new earned-points rankings correctly show no points. Existing rider ability ratings remain in the database and are not converted into sporting points.
- Integrate stage-race setup, per-stage status and the GC/stage/classification point preview into the calendar. The current direct setup covers one-day events.
- Make four default squads part of onboarding only after the automatic-entry path and migration are verified. Introduce inactivity transitions, archival and rider release only with the transfer system; do not delete historic competitors.
- Feed next race and ranking position into the team home screen after real schedule and awards are available. Movement indicators require prior snapshots and are not fabricated.

No live Supabase or Vercel operations are part of this branch. The migration needs an isolated database execution check; the local environment has no PostgreSQL or Docker command available.
