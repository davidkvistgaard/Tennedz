# Player experience preview — 24 September 2026

This increment continues the English-language recovery branch. It creates a shared visual identity for sign-in, signup, onboarding, the team/rider cards, the race calendar, and lineup selection, using existing approved artwork. No paid image API or new dependency is introduced.

## What changed

- Shared warm-paper welcome layout with the approved portrait study as decorative art, painted landscape, forest-green controls, clear field labels, keyboard focus, and accessible sign-in status/errors. Existing Supabase sign-in/session/account routing stays in place.
- One reusable rider dossier for My team and Riders: larger persistent avatar, English nationality, current specialty, three strongest attributes, form/fatigue, race points, and expandable attributes. Specialty is a display label derived from current skills, not a new sporting trait or fixed assignment.
- Fallback SVG presentation has closer framing, a softer paper/landscape background and jersey shading. Saved face parameters, nationalities, names, rare jewelry/dye, and individually approved portrait paths are preserved. These SVGs are still fallback artwork, not the final painted portraits.
- Illustrated race-calendar header and three-step guidance: choose a race, choose eight riders and a captain, then watch. Route-to-lineup link, clearer selected events, improved mobile lineup slots and touch controls. Deadlines, fees, server-side validation, and replay calculation are unchanged.
- Two remaining English copy fixes: the zero time-gap label and anonymous display-name fallback.

## Verification

37 unit tests and 16 browser tests, ESLint, and the production build pass. Desktop (1440px) and mobile (390px) screenshots reviewed for signup/onboarding, team cards, calendar, lineup, replay and results. Existing warnings about Next's ESLint plugin and legacy Node module typing remain. OneDrive required a clean generated `.next` cache for the repeated build.

The new journey tests explicitly mock browser API responses for signup/onboarding, calendar and persistence. They exercise rendered UI, eight-rider/captain gating, failed-save feedback, retry, reload, finished-race entry lock, spoiler gate, play/pause/seek and results. The real deterministic race engine generates their replay/results in Node. These tests do not claim to revalidate Supabase database transactions; prior isolated integration checks remain documented separately. Existing auth browser tests still use the isolated protocol fixture and exercise the real app authentication routes.

Production services, database schema/data, environment variables, spending and main are unchanged. The online delivery is an isolated recovery preview; its existing game-write gate remains disabled.

## Online preview evidence

Commit `2994361f0689d4a45e0f4fb6a2643f1d7249c4f4` is READY as Vercel preview `dpl_4KjjEWPDLHbzzBydeFdk7S986iUp`:
https://tennedz-l01wbrv5w-david-kvistgaards-projects.vercel.app

The stable branch alias is https://tennedz-git-codex-recovery-su-ffab0f-david-kvistgaards-projects.vercel.app (use this origin for interactive sign-in).

Remote API checks passed for the English landing, isolated Supabase test-account login, correct team association, team/calendar/atlas/event endpoints, disabled preview game writes (503), and logout (subsequent /me returns 401). Remote browser checks passed for landing hydration, squad and gender control, atlas navigation through Aurelia to the cathedral, 390px overflow check and absence of uncaught page errors. Temporary test-access links and test credentials are excluded from version control. Production remains on `dda04b1` and was not redeployed.
