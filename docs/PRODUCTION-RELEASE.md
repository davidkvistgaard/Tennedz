# Produktionsrelease: Supabase-login

Denne login-release er efterfølgende afløst af den godkendte endagsløbsrelease. Se [ONE-DAY-PRODUCTION.md](ONE-DAY-PRODUCTION.md) for den aktuelle deployment og konfiguration. Resten af dokumentet er historik for login-milepælen.

23. september 2026. Ejeren godkendte produktionsudrulning med »go« efter rapporten om bestået Preview-test. Recovery blev genbygget med Production-miljø, ikke blot promoveret med testdatabasens konfiguration. Ingen merge til main.

## Release og kontrol

- Kodecommit: `8595a5d2fb0a0992c086ac8f7890b0bacc5f9765`, samme applikationskode som det beståede Preview.
- Deployment: `dpl_EScx3PAu87jdTRT9Rhpap3nm8iQP`, READY, target `production`.
- Vercel-adresse: `tennedz-h3h10yfcw-david-kvistgaards-projects.vercel.app`.
- Loginadresse: https://tennedz.eu/login.
- Produktionsdomænerne er knyttet til den nye deployment; DNS-records er ikke redigeret.
- Vercel flyttede også recovery-branchens faste alias til denne produktionsdeployment. Det alias må derfor ikke længere betragtes som et isoleret testmiljø. Det oprindelige testbuild og testdatabasen er bevaret.

Buildet bestod. Seks netværkskontroller i `tests/support/production-smoke.mjs` bestod mod tennedz.eu: login-side HTTP 200; auth/me, events og my-history uden session HTTP 401; ugyldig tom loginanmodning HTTP 400; login fra fremmed Origin HTTP 403. Private API-svar havde no-store. Browseren viste den nye loginformular.

**Ejerens login og browserkontrol bestået:** ejeren indtastede selv sit eksisterende password i browseren og bekræftede login. Browseren viste »My Team«, brugernavnet »tennedz«, 112 ryttere og spildato 2026-02-19. Genindlæsning bevarede session og hold. Navigation til løbsoversigten viste de tre eksisterende events og egne ryttere. En ekstra fane indlæste historik uden nyt login. Logout lukkede adgangen i begge faner; første fane endte på loginformularen og anden viste »Du skal logge ind«. Ingen console errors blev observeret i de to faner under kontrollen. Brugeren er logget ud efter testen.

Ingen passwords er læst eller nulstillet, og ingen hold er flyttet eller oprettet. Tvungen sessionsfornyelse og modstand mod forfalskede hold-id'er er tidligere testet i det isolerede miljø; de gentages ikke ved at manipulere ejerens produktionssession.

## Produktionskonfiguration

Tilføjet kun i Production: `APP_ORIGIN=https://tennedz.eu`, `RECOVERY_ALLOW_GAME_WRITES=false`, `ENABLE_EXPERIMENTAL_COREPACK=1`.

Eksisterende `SUPABASE_SERVICE_ROLE_KEY` blev verificeret som produktionsprojektets service_role-nøgle, bevaret uden rotation, ændret fra Config til Secret og begrænset fra All Environments til Production. Recovery-Previewets særskilte testnøgle er bevaret. Den eksisterende NEXT_PUBLIC_SUPABASE_ANON_KEY blev verificeret som samme produktionsprojekts anon-nøgle. Auth bruger sin dokumenterede fallback til denne nøgle; ingen særskilt SUPABASE_ANON_KEY er tilføjet i Production.

SUPABASE_URL var allerede verificeret som `https://thacsxtnycmnnpjobgiv.supabase.co`. De øvrige oprindelige All Environments-værdier er uændrede. Ingen nøgle er gemt i dette dokument eller committet. ADMIN_USER_IDS er ikke sat i Production, så administratoradgang er lukket, indtil en bestemt konto godkendes. Den gamle ADMIN_SECRET giver ingen adgang i recovery-koden.

## Data, begrænsninger og nødstop

Ingen SQL-migration, spildataskrivning, ændring af kontoejerskab eller sletning blev foretaget under releasen. Login/logout opdaterer naturligt Auth-sessioner. Kontrol efter udrulning viste fortsat 1 hold, 112 ryttere, 112 hold-rytter-koblinger, 2 Auth-konti og RLS på alle 28 public-tabeller. Holdets ejer-ID blev kun læst og ikke ændret.

Løbscyklus, tidsændringer og øvrige spilskrivninger forbliver lukkede. Brug tennedz.eu til login; ekstra Vercel-aliaser har ikke særskilt login-origin og kan afvise login-POST. www-domænets eksisterende redirect er bevaret. En senere ændring kan samle disse aliaser på hoveddomænet.

Ved en alvorlig fejl: stop produktion via Vercel Project Settings → General → Pause Project (knappen er verificeret tilgængelig), ret fremad og genbyg. Gendan ikke den tidligere usikre applikation. Projektpause påvirker tilgængelighed, ikke databasedata. Pause blev ikke aktiveret, da adgangskontrollerne bestod.

main indeholder stadig den gamle kode; kladde-PR #1 er ikke merget. En fremtidig deployment fra main kan genindføre den gamle kode og må ikke ske før kontrolleret merge/release. Automatisk deployment fra recovery-branchen er fortsat slået fra.
