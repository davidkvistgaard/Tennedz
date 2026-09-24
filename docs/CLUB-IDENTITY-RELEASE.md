# Club identity production release - 24 September 2026

Owner explicitly approved the club_identity migration and release ed0feae3dc6d0f4a570940fb4d46bf2abc2d1276. The additive table was applied to Tennedz (thacsxtnycmnnpjobgiv); RLS enabled, anon SELECT and authenticated UPDATE denied, service-role INSERT granted. Existing team/rider/race data was not migrated or deleted.

Vercel rebuilt codex/release-club-identity with Production selected and cache disabled. Deployment dpl_12JWxdV331xXKFEX4WjiG1LYrqTe is READY production and assigned to tennedz.eu. Immutable URL: https://tennedz-osebb1ud3-david-kvistgaards-projects.vercel.app. Source tree bc46d8881e20c47b331adf4c70eb310240f64925 matches the tested isolated release worktree.

Validation before release: 40 unit tests, all 20 browser tests and production build passed. Isolated SQL tested RLS/grants and transactional upserts. Browser fixtures cover account separation, independent browser contexts, failures/retries and invalid/foreign-team writes.

Live verification: public home/login/signup passed English, hydration and layout checks at 390 and 1440 pixels, with no uncaught page errors. Existing owner session opened Club identity showing four palettes and three patterns. Saved the already displayed Cobalt & ice / Triple bands design without changing its appearance; the UI reported success and production SQL confirmed cobalt / triple-bands. After reload the same design loaded from the account.

A transient authentication failure occurred during verification: /api/auth/me returned three 503s at 21:05:43, 21:06:11 and 21:06:13 UTC, then 200 at 21:06:43, 21:07:13 and 21:07:26. The UI recovered automatically and a subsequent explicit reload succeeded. Root cause is not established; the earlier empty runtime-error-cluster result did not capture these handled failures. No credentials or environment settings were changed. No permanent monitor is configured.

Supporter studio remains a labelled design preview, not a paid entitlement or custom-design persistence feature. Race Lab, pending race orders and the new engine are excluded. Main remains untouched.

Rollback application target: dpl_F2UdPdtqfXWxHfdqrPd3TuQjVsPj / 6a1ce9a412c96b03d067b54c5ef5a7be4537eb82. Retain the additive table and saved choices if rolling back the app; do not delete production data.
