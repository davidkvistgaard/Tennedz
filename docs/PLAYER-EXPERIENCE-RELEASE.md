# English visual experience — production release, 24 September 2026

## Release

- Live: https://tennedz.eu
- Source: recovery branch commit `2994361f0689d4a45e0f4fb6a2643f1d7249c4f4` (same application code as the tested preview).
- Vercel deployment: `dpl_7MK9XTp9pMgt7DgnhNTTgkJGE4aE`, READY, production target; build approximately 50 seconds.
- Immutable URL: https://tennedz-ft4mo4flo-david-kvistgaards-projects.vercel.app
- Rollback target: previous production `dpl_8LuPDwTtyasweuzwwwQTsVfwfXJj`, source `dda04b1`. Do not roll back to old main.

The owner explicitly authorized production release. Deployment used Redeploy with Environment = Production and existing build cache unchecked. This rebuilt the tested source with current production settings. Direct Promote to Production was rejected by automatic approval review because the preview used the isolated test database; that action was not executed. The subsequent explicit production rebuild was accepted. Production domains were verified assigned to the READY deployment.

## Scope and compatibility

English interface, cream/forest visual identity, landing/login/signup/onboarding, shared rider cards, calendar/lineup presentation, versioned island data and clearly marked atlas prototype are now live. Saved rider traits and game rules are preserved. Paid portraits remain disabled; rider SVGs remain fallback art.

The diff from the previous production source has no package/lockfile, deployment-configuration or Supabase migration changes. No database migration, environment edit, game-data write, new account creation, or main merge was performed during this release.

## Verification

- Release candidate previously passed 37 unit tests, 16 browser tests, lint and production build; full isolated UI journey includes lineup save/retry/reload and replay/results.
- Fresh Vercel production build passed and tennedz.eu resolves to this deployment.
- All 15 existing non-mutating production HTTP smoke checks passed, including private-API authentication and foreign-origin rejection. Invalid signup is rejected by input validation (400), rather than the preview write gate (503).
- Automated public browser checks passed for home, login and signup at 1440px and 390px: English HTML/headings, hydration, no horizontal overflow and no uncaught page errors. A temporary test initially expected the wrong signup heading; corrected to the existing "Welcome to the peloton" copy and reran successfully. No application change was needed.
- Existing owner browser session survived reload; My Team shows the same budget/coins and 112 riders, split into 56 men and 56 women. Gender switch, women-calendar navigation and atlas page were verified against real production data. There are no currently open races in the checked category; existing schedule was not modified.
- No fresh owner-password login or owner logout was performed: the active owner session was preserved. Complete sign-in/logout was already verified in the isolated preview. No race writes were exercised in production.
- Vercel returned no runtime error clusters in the checked 15-minute window. This is a point-in-time check, not continuous monitoring.

See PLAYER-EXPERIENCE-PREVIEW.md and VISUAL-ATLAS-RELEASE.md for feature details and prototype limitations. The branch alias may move with production rebuilds; use the immutable preview URL for isolated preview checks.
