# Homepage artwork release — 24 September 2026

Live at https://tennedz.eu. Production deployment `dpl_EtEkJnGbQmFdc1ufbc71QbaMeeRK` is READY, built in approximately 58 seconds from GitHub commit `b08168f3c50b806d50d4b336b0d151860e594943` on `codex/release-home-art`. Immutable URL: https://tennedz-g594dmt31-david-kvistgaards-projects.vercel.app.

## Scope

The release is based directly on previous production commit `2994361f0689d4a45e0f4fb6a2643f1d7249c4f4`. Only four files change: app/page.js, app/identity.css and two owner-supplied race/podium PNGs. Homepage styling and FAQ are included; no pending orders, Race Lab, club kit/dossier or atlas-directory features are published. No database, environment, package or authentication changes; main remains untouched.

The isolated local release worktree is ../homepage-release, local commit d4eba48. Its tree matches GitHub exactly: f15e2c67229938f3e6c302caf483785091f2f208. Recovery development continues separately and includes the same illustrations.

## Verification

37 unit tests, all 16 browser tests and production build pass for the release tree. Mobile/desktop screenshots reviewed. Vercel automatic preview succeeded; production was rebuilt from that exact source with Production selected and cache disabled, preserving existing production settings.

Live home/login/signup passed English-content, hydration, 390px/1440px layout and uncaught-error checks. Both homepage images decoded successfully at both widths; live artwork inspected in the in-app browser. No production writes or fresh account creation were tested. Vercel reported no runtime error clusters for the last 15 minutes at release time; this is not continuous monitoring.

An initial unspecified deployment tool call was rejected by automatic safety review before any deployment. The subsequent explicitly scoped production rebuild was accepted. Git CLI could fetch but could not authenticate writes; the GitHub connector uploaded the verified tree instead.

## Rollback

Previous production: dpl_7MK9XTp9pMgt7DgnhNTTgkJGE4aE, source 2994361. Use this version if rollback is necessary, not main or the unreleased recovery head. Future releases must preserve this homepage while separately validating pending features and database prerequisites.
