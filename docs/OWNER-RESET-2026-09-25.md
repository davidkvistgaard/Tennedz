# Owner starter-team reset — 2026-09-25

The owner explicitly requested replacing the existing production teams with one normal starter team, and approved 16 painted portraits generated through the built-in image tool (no paid runtime image service).

## Completed

- Read-only audit found exactly one team, with 112 riders, all owned by that team.
- Backed up the old team, riders, links, event entry, club identity, legacy login record and existing tactic preset to ignored local storage. Never publish these private backups.
- Tested the complete guarded reset transaction with ROLLBACK and independently verified the original 112 riders remained.
- Published only 16 WebP assets on top of the existing production commit. No application code, schema, secrets or environment settings changed.
- Executed the guarded reset transaction after verifying all 16 production asset URLs returned HTTP 200 and image/webp.
- Created one new My Team through the existing starter RPC: 8 men, 8 women, standard starter skills/balances, distinct saved appearance matrices and painted portrait paths.
- Preserved the Supabase Auth user and session. Removed the old team and 112 riders; its one event entry, old club identity and unused custom-login row were removed. The existing empty rider-selection tactic preset was retained.
- Global calendar/routes and test-project data were untouched.

## Release

- Branch: codex/release-owner-portraits
- GitHub commit: d2b10a6a7df639120fd1c1291127cf7edf2a2eb1
- Verified release tree: c4177fa19cd7af1ae32639e0ca7c13268797ec8a
- Production: dpl_8pN3SEWwur2csL1nZVCfG1y6h7vK
- Previous application release: dpl_12JWxdV331xXKFEX4WjiG1LYrqTe
- Keep the new portrait assets in future releases: rolling back to the previous application release removes these paths and causes fallback artwork.

## Validation

Production-baseline build passed; 40 unit tests passed. All 16 files decoded locally and had distinct SHA-256 hashes. Database postchecks confirmed exactly one team, 16 riders, 8 per gender, 16 distinct portrait paths and the correct unchanged Auth owner. Existing authenticated browser session loaded the replacement team after reload. Both squad views displayed all eight painted images with successful natural dimensions; no browser console errors were captured.

## Art limitations

Portraits use portrait-study-04 as a painterly style reference and each rider's stored cosmetic matrix. These are reviewed individual assets, not a completed automatic portrait-generation service. Facial proportions are artistic interpretations rather than pixel-exact numeric parameters. Green jerseys are baked into the artwork and do not change with club identity. This random starter draw contains one nose stud and no dyed hair; rarity settings were not altered.

Private reset SQL, original backup manifest, roster, portrait specifications and post-reset verification are retained under ignored .recovery-local/.
