# Produktionsrelease: endagsløb

23. september 2026. Ejeren godkendte med »Go« de to nye tabeller, tre databasefunktioner, administratoradgang til sin eksisterende konto samt åbning af tilmelding og endagsløb. Ingen merge til main.

## Release

- Kode: `fdb72837929822481ceb304e4eb0053ab6115c00` på `codex/recovery-supabase-auth`.
- Vercel-production: `dpl_Cdk9GuBAcgy3YRXREfQ4P3duyWo6`, READY, ca. 34 sekunders build.
- Adresse: https://tennedz.eu/login.
- Immutable deployment: `tennedz-pl254eimd-david-kvistgaards-projects.vercel.app`.
- Den nye Preview-build `dpl_9yyPKUrTvziazkdAP7GJqkpF9T7P` blev bygget først (41 sekunder). Vercels produktionsdialog genbyggede derefter samme commit med Production-miljøet. Testdatabasens nøgler blev ikke promoveret til produktion.
- Domæner blev automatisk knyttet til releasen. Ingen DNS-ændringer. Recovery-branch-alias peger igen på produktion og må ikke bruges som isoleret testmiljø.

## Database og konfiguration

Følgende testede migrationer er anvendt på produktionsprojektet `thacsxtnycmnnpjobgiv`:

- `20260923173040_atomic_one_day_cycle.sql`
- `20260923174940_qualify_race_summary.sql`

De opretter to kvitteringstabeller og tre funktioner. RLS er aktivt på begge nye tabeller; i alt 30 public-tabeller har RLS. Execute-adgang til alle tre funktioner er verificeret afvist for både anon og authenticated, tilladt for service_role. Ingen gamle tabeller eller data er fjernet.

Vercel Production: `RECOVERY_ALLOW_GAME_WRITES=true`; `ADMIN_USER_IDS` indeholder kun den eksisterende ejer af My Team, `72b988b2-8b3e-4b32-993b-be2a4dc5868a`. Variablen er gemt som Secret. Supabase-nøgler, APP_ORIGIN og Preview-variabler er uændrede. Tid/nulstilling, gamle løbssystemer og database-presets forbliver lukkede.

## Datakontrol

Før migrationerne blev relevante spildata eksporteret lokalt til den ignorerede `.recovery-local/production-race-preflight-snapshot.json`: teams, riders, team_riders, events, event_teams, stage_profiles og game_state. Dette er en målrettet spildataeksport, ikke en komplet Supabase-backup med Auth og alle tabeller. Ingen passwords, tokens eller API-nøgler indgår.

En efterfølgende fuld sammenligning af de eksporterede rækker viste identiske værdier før/efter. Rækkeantal efter migrationerne: 1 hold, 112 ryttere, 112 holdkoblinger, 3 events, 1 gammel tilmelding, 0 holdresultater og 0 rækker i begge nye kvitteringstabeller. Spilledato er stadig 2026-02-19. Holdet har stadig 100.000 coins og rating 0. Ingen løb er kørt i produktion som test.

## Releasekontroller

Alle ti HTTP-kontroller i `tests/support/production-smoke.mjs` består mod tennedz.eu. Loginformularen svarer 200. Beskyttede data-, rangliste-, tilmeldings- og administrator-API'er afviser anonyme anmodninger med 401; tom loginanmodning giver 400, fremmed Origin giver 403, og private API-svar har no-store.

Vercels runtime-logkontrol for denne deployment fandt ingen error/fatal-poster ved kontrol umiddelbart efter releasen. Det er en kort releasekontrol, ikke løbende overvågning. Ejeren loggede selv ind og bekræftede holdvisningen. Browserkontrollen viste My Team, brugernavn tennedz, 112 ryttere, 100.000 coins og rating 0. Admin-siden viste »Administratoradgang bekræftet«, korrekt antal hold/ryttere og åbnet endagsløbsafvikling. Eksisterende kodeord er hverken læst eller nulstillet. Ingen afviklingsknap blev trykket under kontrollen.

Supabases rådgiver viser fortsat de otte gamle funktioners [mutable search_path-advarsler](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) og Auth-advarslen om [lækkede kodeord](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). De nye funktioner har fast search_path og indgår ikke i disse otte fund. Klientadgangen til gamle funktioner blev lukket i den tidligere godkendte sikkerhedsændring. INFO-fund om RLS uden politikker er forventelige ved serveradgang uden direkte klientrettigheder.

## Hvad der stadig forhindrer et nyt spilbart løb

Browserens efterkontrol bestod også genindlæsning af admin-siden, navigation til historik (korrekt tom), ranglister (My Team med 0 point) og tilbage til holdet. Ingen konsolfejl blev observeret. Ejeren er efterladt logget ind; logout blev ikke gentaget i denne releasekontrol.

Produktionens tre gamle events har alle deadline 20. februar 2026 og er derfor låst. Der er kun ét hold, mens den nye afvikler kræver mindst to. Desuden peger alle tre gamle events på den samme flade 150 km-rute, selv om to af navnene angiver noget andet. Disse gamle data er bevaret; datoer, rutekoblinger og modstandere er ikke stiltiende ændret.

Næste produktbeslutning er et nyt korrekt konfigureret løb med fremtidig deadline og en aftalt modstanderstrategi. Testkonti/-hold kopieres ikke ind i produktion. Den tekniske release er gennemført, men en komplet produktionsafvikling med to rigtige hold er ikke erklæret testet.

## Nødstop og Git

Slå skriveflaget fra og genbyg, eller brug den tidligere sikre login-release `dpl_EScx3PAu87jdTRT9Rhpap3nm8iQP` efter kontrol af miljøet. Gamle usikre main-builds må ikke genudrulles. Slet ikke kvitteringer og kør ikke gamle afviklere for at fortryde et løb; det kan skabe dobbelte point. Pause Project er et alternativ ved alvorlig fejl.

PR #1 er fortsat kladde. Main er uændret, og recovery-grenens automatiske Vercel-deployment er fortsat slået fra. En merge skal senere ske kontrolleret, så main også bliver et sikkert udgangspunkt.
