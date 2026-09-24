# English game language — 24 September 2026

English is the product language, regardless of the language used in conversations with the owner. This applies to future screens and artwork copy as well as the current UI.

Translated the landing page, authentication and onboarding screens, navigation, squads, rider attributes, nationalities, calendar, lineups, profiles, viewer, results, rankings, history, atlas, and administration. The HTML language is `en`; numbers and dates use `en-GB`. Race deadlines display UTC explicitly; the administrator's datetime-local field remains clearly labelled as local input. Game dates render in UTC to avoid shifting a day for distant time zones.

Authentication and sporting rules are unchanged. Database race errors are translated at the application boundary, including all messages in existing migrations. Unknown RPC failures get a safe English fallback. New race commentary is English; known recorded recovery-engine commentary is translated for display without rewriting stored races or translating rider/team names. Arbitrary historical reports and user-created event names retain their original content. Unused legacy source files are not player-facing and remain archived.

Validation: 37 unit tests, all 14 existing browser tests, ESLint, and the production build (42 routes) pass. Browser tests cover login/reload/tabs/logout, ownership, English selectors, mobile/desktop navigation, team search/filtering, and atlas interaction. English-specific unit tests verify database message coverage and immutable translation of recorded commentary with accented names. Mobile and desktop screenshots were checked. Existing Node module-type and Next ESLint-plugin warnings remain.

No production database, data, environment variable, or service configuration was changed.
