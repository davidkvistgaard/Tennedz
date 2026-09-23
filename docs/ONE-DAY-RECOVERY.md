# Endagsløb: genoprettet kerneforløb

23. september 2026. Arbejdsgren: `codex/recovery-supabase-auth`. Dette dokument beskriver implementeringen og testgrundlaget. Ejeren godkendte derefter produktionsudrulningen med »Go«. Se ONE-DAY-PRODUCTION.md for den efterfølgende release og kontrol.

## Spillerens forløb

1. Vælg et eksisterende endagsløb og se dets rute, deadline og startgebyr.
2. Udtag otte forskellige, skadesfri ryttere fra eget hold, med løbets køn. Vælg en kaptajn blandt dem.
3. Gem tilmeldingen. Serveren kontrollerer ejerskab og deadline. Startgebyret i coins trækkes kun én gang; udtagelsen kan ændres indtil deadline. Gemte ryttere og kaptajn hentes igen efter genindlæsning.
4. En godkendt administrator afvikler løbet efter deadline. Der skal være mindst to tilmeldte hold. Maksimalt 20 hold pr. division; et sidste enmandshold flyttes sammen med et andet hold.
5. Holdplaceringen følger kaptajnens tid. Den eksisterende pointskala og divisionsfaktor bruges. Resultater, referat, historik og ranglister læser nu samme generation af løbstabeller.

Spilmotoren er bevaret og tilpasset til den valgte rutes faktiske distance og kategori. Form, træthed, vejr og rytteregenskaber indgår. Form, træthed, eventuel skade og point gemmes sammen med resultatet. Skader og løbstilfældigheder er reproducerbare for samme input.

## Beskyttelse af data

- Databasefunktionerne kontrollerer og gemmer ændringer samlet i én transaktion. En fejl undervejs ruller hele gemningen tilbage.
- Et løb får én kvittering. Samtidig afvikling eller gentagelse returnerer det allerede gemte resultat uden ekstra point eller træthed.
- Serveren tager et øjebliksbillede af løb, rute, spilledato og deltagernes ryttere. Hvis grundlaget ændres før gemning, afvises forsøget.
- Funktionen til tilmelding finder holdet via den verificerede Supabase-bruger. Klienten kan ikke vælge en anden ejer.
- Nye tabeller har RLS og ingen direkte klientrettigheder. Kun serverrollen må kalde de tre nye funktioner. Kontrolleret for både `anon` og `authenticated`.
- Eksisterende løbsresultater fra andre løbssystemer overskrives ikke. Tidligere tilmeldinger med uklart, positivt gebyr kræver afklaring.
- Ingen eksisterende tabel, konto eller produktionsrække slettes eller nulstilles.

## Migrationer

Begge filer er anvendt i testprojektet og skal gennemgås samlet før en eventuel produktionsrelease:

- `20260923173040_atomic_one_day_cycle.sql`: to nye tabeller og tre serverfunktioner.
- `20260923174940_qualify_race_summary.sql`: retter en tvetydig SQL-kolonnereference fundet ved integrationstesten. Ingen ændring af data eller rettigheder.

Kør ikke alle repository-migrationer blindt mod produktion. Den tidligere adgangssikring er allerede anvendt dér. De nye filer er additive og afhænger af det eksisterende Pelotonia-skema; de er ikke et komplet skema til en tom database.

## Verifikation

- Produktionsegnet Next-build og lint består. Build har fortsat den kendte advarsel om Nexts ESLint-plugin; Node giver en ufarlig advarsel om modulformat ved motortests.
- Ni enhedstests består: auth-regler og fem løbstests, herunder reproducerbar afvikling, forkert ejerskab/køn/skade, ruteeffekt og komplet simulation med 41 hold fordelt 20/19/2. Delingsalgoritmen er også afprøvet med 400 hold; 400 hold er **ikke** belastningstestet mod databasen eller Vercel.
- Integration mod rigtig Supabase: falsk ejerskab, dubletter, ikke-administrator og for tidlig afvikling afvises; tre samtidige tilmeldinger trækker ét gebyr pr. hold; sen tilmelding afvises; bevidst fejl ved sidste rytter ruller tidligere skrivninger tilbage; ændret input afvises; to samtidige afviklinger og et genforsøg giver point/træthed præcis én gang. Resultater, historik, referat, ranglister og afvist anonym RPC-adgang kontrolleres.
- Alle 12 eksisterende HTTP-tests af rigtig Supabase Auth består fortsat, inklusive refresh, ejeradskillelse, HttpOnly-cookies og afvisning af genbrug efter logout.
- Browser: syntetisk ALICE-konto, otte ryttere og kaptajn, gemning, genindlæsning, lås efter deadline, administratorafvikling og visning af to hold/16 ryttere er afprøvet gennem den lokale produktionsbuild.
- Historik og løbsreferat er kontrolleret i browseren, inklusive korrekt distance på 130 km og ingen registrerede konsolfejl.
- Supabases sikkerhedsrådgiver efter migrationerne: ingen databaseadvarsler på WARN/ERROR-niveau. De 30 INFO-fund om [RLS uden politikker](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) er forventelige med den valgte serveradgang og lukkede klientrettigheder. Den eksisterende Auth-advarsel om [kontrol mod lækkede kodeord](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) er fortsat til stede i testprojektet; denne kontoindstilling er ikke ændret.

Testværktøjer: `tests/support/race-seed.mjs`, `race-check.mjs`, `race-browser-ready.mjs`, `real-server.mjs --race`. De læser ignorerede lokale testkonfigurationer og afviser ethvert andet Supabase-projekt. Ingen hemmeligheder er versioneret. Integrationstest opretter et særskilt løb pr. kørsel og bevarer resultatet; delte testhold kan efter gentagne løb få skader eller utilstrækkelige coins. Brug særskilte friske testfixtures ved gentagne testkampagner frem for at nulstille produktion.

## Afgrænsning

- Etapeløb, automatisk kalender/spilledato, hvile/træning, løbsoprettelse og botmodstandere er ikke åbnet. Endagsløb afvikles manuelt af administrator fra eksisterende events.
- Rutekategori påvirker simulationen; hver bakke og hvert taktikpunkt er endnu ikke en separat fysisk simulation. Spilbalance er ikke produktgodkendt gennem en længere sæson.
- Historikken viser nu `event_team_results`. Eventuelle ældre `stage_results` bevares, men er ikke konverteret til denne visning.
- Senest verificerede produktion har kun ét hold. Et rigtigt løb kræver et andet legitimt hold; testhold flyttes ikke automatisk til produktion.
- Global database-lås serialiserer de nye skrivninger. Det er bevidst enkelt til genopretningen; stor belastning og samtidige fremtidige transfer-/træningsfunktioner kræver særskilt afprøvning.

## Næste produktionsbeslutning

Den følgende plan blev efterfølgende godkendt: anvend de to migrationer og byg denne version til produktion. Angiv administratorens Supabase-id i `ADMIN_USER_IDS`, og ændr `RECOVERY_ALLOW_GAME_WRITES` til `true`. Det åbner tilmelding og de kontrollerede endagsløb; tid/nulstilling og gamle afviklere forbliver lukkede. Database-presets forbliver også lukkede; browserens lokale udtagelses-presets er fortsat tilgængelige.

Kontrollér først aktuelle produktionsmetadata, aktive events, gebyrer, gamedate og rækkeantal; tag et passende backup-/eksportgrundlag før åben drift. Deploy ikke en gammel main-build: main er endnu ikke opdateret med recovery-sikkerheden. Recovery-grenens automatiske Vercel-deploy er fortsat slået fra. Den tidligere recovery-branch-alias peger nu på produktion og må ikke forveksles med testmiljøet.

Nødstop: sæt skriveflaget tilbage til `false` eller brug den dokumenterede sikre login-release. Slet ikke resultatkvitteringer og kør ikke gamle afviklere som rollback; det kan give dobbelte point.
