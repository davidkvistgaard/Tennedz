# Visual package production release — 24 September 2026

Superseded by the additive club identity release documented in CLUB-IDENTITY-RELEASE.md. This record describes the preceding visual release at https://tennedz.eu. Commit 6a1ce9a412c96b03d067b54c5ef5a7be4537eb82 on codex/release-visual-package, deployment dpl_F2UdPdtqfXWxHfdqrPd3TuQjVsPj, READY production, 44 seconds. Immutable URL: https://tennedz-d638asuow-david-kvistgaards-projects.vercel.app.

Built on the homepage-only release b08168f. Includes shared visual styling, rider profiles/comparison, specialty filtering, club badges and atlas directory/place notes. No engine/API/database/environment changes. Club identity editor and supporter studio are excluded until account persistence is separately approved. Recovery-only race orders and Race Lab remain unpublished. New engine remains paused.

Release tree ad1765de4d20597e9d2774bfe2b695e44c7e1dd8 matched local commit 6eb3543. 39 unit tests, 18 browser tests and build passed. Mobile comparison and desktop/mobile UI screenshots reviewed. Vercel rebuilt the same source in Production without cache.

Post-release public home/login/signup checks passed at 390px and 1440px, including both homepage images, English text, no overflow and no uncaught errors. Existing owner session survived reload; budget 1,000,000, coins 100,000 and 56 riders per squad unchanged. A real rider dossier, two-rider comparison and Northern Plateau search/detail were checked without writes. No runtime error clusters in the checked 15-minute window. This is a point-in-time check; no permanent monitor configured.

Rollback: previous homepage release dpl_EtEkJnGbQmFdc1ufbc71QbaMeeRK / b08168f. Do not promote the recovery head, which contains pending engine/order work.
