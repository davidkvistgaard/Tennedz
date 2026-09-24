# Visual studio preview

This increment follows the owner's priority order: shared visual foundations,
squad/profiles, club identity, public entry pages, then atlas presentation.
The new engine remains paused. No simulation, race orders, training, economy,
calendar automation or database schema changes are included.

## Design language

Portrait study 04 remains the art direction reference. Warm paper, forest ink,
honey accents and clay highlights sit alongside Bricolage headings and DM Sans
body text. Existing locally hosted fonts and artwork are reused. No generated
portrait purchases or replacement of existing rider identities.

`app/studio.css` owns the shared studio tokens and scoped treatments. Existing
functional styles remain in place; the visual layer covers navigation, squad
cards, the public homepage, welcome forms, dialogs, kit editor and atlas framing.
All product copy is English. Reduced-motion preferences are respected.

## Squad and profiles

- Existing name search, sorting and separate squads remain.
- Specialty filter uses the same highest-specialty rule as rider cards.
- Native modal rider dossier shows portrait, country, age, category, race points
  and the existing nine skills plus form/fatigue. Missing values are explicit.
- Select up to three riders within the squad for side-by-side comparison. Squad
  switching clears the selection. Escape/Close dismisses the modal and native
  dialog focus restoration returns to the initiating control.
- Profiles use only already-public rider fields; no potential or hidden formulas.

## Club identity — local prototype

`/team/identity` draws four palettes from a catalogue of 50 and three patterns
from 25 distinct layouts. The v1 seeded allocation uses the team's stable ID,
not its name, browser storage or login time. Reloading/clearing local storage
cannot reroll the options. Do not reorder the v1 catalogue without a migration
strategy. Different teams may share individual options; uniqueness across teams
is not guaranteed or required. Both jersey and procedural rider previews use the
same pattern artwork. Saving stores only palette/pattern in localStorage,
keyed by team ID. Read values are allowlisted; account changes do not reuse the
previous team's preview. A storage event updates other tabs. Failed storage is
reported instead of claiming success. No server persistence or new API exists.

Old local previews outside the newly allocated choices fall back to the team's
first palette/pattern. No production records are changed. The client-side check
is preview validation, not a secure supporter entitlement boundary. Production
will require server-persisted allocations and server-authorized custom designs.

The expandable Supporter studio lets users try arbitrary main/accent colours and
all 25 layouts. It is explicitly a future-feature preview, cannot apply a custom
kit to the standard team and resets on leaving. No checkout, subscription,
supporter entitlement or custom design persistence is implemented.

The saved preview changes procedural portrait jersey colours/patterns while
leaving faces unchanged. Existing painted assets retain their original jersey.
The editor explicitly explains browser-only storage, scope and no sporting cost.
Account-synchronised club identity is a later increment requiring persistence.

## Atlas

A field-guide entry panel offers existing island/capital/cathedral destinations.
The atlas uses the same warm framing and controls. Existing geometry, IDs,
navigation, pan, zoom, touch behaviour and provisional-data disclosure remain.
This is presentation work, not final cartographic artwork or new cycling routes.

## Deferred owner backlog

- New complex engine: contextual per-kilometre route/weather, energy and explosive
  capacity, costly repeated chasing, layered orders and hidden server coefficients.
  Paused until the owner explicitly resumes it.
- Mandatory introductory bot race teaching orders and presets, followed by opt-in
  standing lineups/automatic official calendar participation: after the new engine.
- Transfers, economy and supporters: future interconnected design work, not started.

## Delivery boundary

Recovery branch and local fixture preview only. No production release, Supabase
write, environment change or payment. The local server uses synthetic accounts
and riders. Persistent global club designs and final atlas art are not claimed.

## Verification — 2026-09-24

47 unit tests, ESLint and the production build pass. All 18 existing browser
tests pass. The two new 390/1440px studio journeys pass after correcting focus
restoration and a test locator: open/close/Escape, focus return, three-rider limit,
comparison, category reset, specialty filtering, jersey save/reload and account
isolation. Screenshots reviewed for squad, profile, comparison, homepage and kit;
the local in-app browser displays the fixture squad. Mobile checks are emulated.
The generated OneDrive `.next` cache was cleared before rebuilds; existing Next
ESLint-plugin and Node module-type warnings remain.

Kit catalogue extension: 49 unit tests pass, including exact catalogue counts,
distinct artwork/colour pairs, stable allocations and coverage over 1,000 teams.
All 18 existing browser journeys pass; the two updated studio journeys also pass
at 390/1440px, iterating all 25 supporter layouts, changing a custom colour and
verifying the saved standard kit remains unchanged. A test-file encoding error
was corrected before the successful rerun. ESLint/build pass. Supporter preview
and standard kit screenshots reviewed; no production services changed.
