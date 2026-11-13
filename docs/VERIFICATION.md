# Kontrol af recovery-branchen – 23. september 2026

**Nyeste resultat:** 12 HTTP-kontroller mod rigtig Supabase samt browserkontrol af login, reload, navigation, to faner, logout og kontoskift er bestået i et isoleret testprojekt. Se [REAL-AUTH-VERIFICATION.md](REAL-AUTH-VERIFICATION.md). GitHub- og Vercel-adgang er genoprettet; recovery-koden er i kladde-PR #1 og er ikke deployet. Nedenstående er den tidligere kontrolhistorik.

Efterfølgende live-kontrol: den godkendte rettighedsmigration er anvendt og verificeret. Alle 28 tabellers rækkeantal er uændrede, klientadgang afvises, og service_role-adgang virker. Se CONTAINMENT-APPLIED.md. Dette erstatter ikke en rigtig end-to-end login-test.

| Kontrol | Resultat |
|---|---|
| Produktionsbuild, Next.js 15.5.26 | Bestået |
| ESLint, grundlæggende JavaScript-regler | Bestået |
| Fire unit-tests af ejerskab, loginformat, origin og administratoradgang | Bestået |
| Otte browsertests, Edge og produktionsbuild | Bestået mod lokal Supabase-protokoltesttjeneste |
| `pnpm audit --prod` efter PostCSS-rettelse | Ingen kendte sårbarheder |
| Visuel kontrol af holdsiden med syntetiske testdata | Indhold, navigation, filtre og logout vises uden fejlskærm |
| Rigtig Supabase Auth, database og RLS | Efterfølgende genaktiveret: skema/RLS/ejerskab undersøgt read-only; kritiske adgangsproblemer fundet. Rigtigt login er ikke testet. Se LIVE-REVIEW.md |
| Vercel-produktionsmiljø | Ikke verificeret: connector returnerede ingen teams |

Browsertestene omfatter login, forkert kodeord, reload, navigation til løb og historik, to faner, logout, kontoskift, sessionsfornyelse, tilbagekaldt session, manglende/dobbelt holdtilknytning, forfalsket hold-id, cross-origin-login og lukkede skrive-endpoints. Der blev ikke kontaktet nogen ekstern database eller brugt rigtige konti.

Det er en test af applikationens integration med Supabase SDK gennem en kontrolleret HTTP-testtjeneste, ikke dokumentation for at det eksisterende produktionsskema eller de rigtige konti virker. Login-milepælen er derfor **ikke afsluttet**. Se RECOVERY.md for godkendelsespunktet og de resterende kontroller.

Build har én kendt værktøjsadvarsel: Next-specifik ESLint-plugin er ikke installeret. Den eksisterende lint-konfiguration kontrollerer grundlæggende JavaScript, ikke alle Next-/React-mønstre.
