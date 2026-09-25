# Clubhouse and rider profile preview

A visual-only continuation on the recovery branch. The My Team clubhouse displays the account-saved jersey, palette and kit-room link. Loading/storage errors are identified instead of claiming a fallback is the saved kit. Rider search now includes country names and has a clear-filters action. Single-rider dossiers feature a larger portrait layout and the three strongest recorded riding attributes, excluding form/fatigue from the strengths ranking. Comparisons retain the existing table and best-value rules. All player text remains English.

No engine, auth, database or production configuration changes. Existing faces and painted assets remain intact; no portrait purchases.

Auth investigation: read-only Supabase logs for 24 September 2026 21:05:30–21:06:45 UTC contained an auth /user success at 21:06:43 and no auth error in that window. This does not establish a root cause for the three Vercel 503 responses. Do not claim the issue is fixed or weaken session validation. Future recurrence needs sanitized server-side diagnostics distinguishing network/timeout from upstream auth failures.

Validation: 50 unit tests, all 22 browser journeys, ESLint and production build pass. Desktop/mobile dossier and squad screenshots reviewed at 1440/390 pixels. No horizontal overflow or uncaught browser errors in the studio journeys. Local fixture preview only; not published to tennedz.eu.
