# Rigtig Supabase-login: testresultat

Kontrolleret 23. september 2026 på recovery-branchen. Appens produktionsbuild blev kørt lokalt mod det særskilte, gratis Supabase-projekt `pelotonia-recovery-auth-test` (`nxhvaoonnvmvohqaxfdx`). Produktion og Vercel blev ikke ændret under testen.

## Testgrundlag

Testprojektet fik 28 tomme public-tabeller med kolonner, defaults og constraints fra produktionsdatabasens metadata. Ingen produktionsrækker eller konti blev kopieret. RLS var slået til på alle tabeller, direkte klientadgang fjernet og service_role bevaret. Funktioner, triggers og produktionspolicies blev ikke kopieret: dette er en login- og læseadgangstest, ikke en fuld databasekopi eller test af spilmotoren.

Fire syntetiske konti blev oprettet gennem Supabase Auth Admin API: to med hvert sit hold og sin rytter, én uden hold og én med to hold. Tilfældige passwords og projektets eksisterende nøgler blev kun gemt i Git-ignorerede lokale filer.

## Beståede kontroller

Alle 12 HTTP-kontroller i `tests/support/real-api-check.mjs` bestod:

- Beskyttede API'er afviser adgang uden login.
- Login og hentning af eget hold og egen rytter virker; login returnerer ikke tokens i JSON.
- Cookies er HttpOnly, Secure og SameSite=Lax; private svar bruger no-store. Løbsliste, dato og tom historik svarer korrekt.
- Forkert kodeord, fremmed Origin og forfalsket hold-id afvises.
- Manglende og dobbelt holdkobling afvises med HTTP 409.
- Den anden konto får kun sit eget hold og sin rytter.
- Direkte læsning af teams via Supabase Data API afvises både anonymt og med en indlogget bruger.
- En lokalt udløbet session fornyes mod rigtig Supabase, og refresh-token ændres.
- Logout rydder cookies og lukker adgangen. Genbrug af en gemt cookie efter logout afvises også i den testede instans.

Browserkontrollen bestod: login, genindlæsning, navigation til løb og historik, to faner, logout i begge faner og kontoskift fra ALICE til BOB. Den anden fane viste BOB uden ALICEs hold. Ingen console errors i app-fanerne. Holdsiden blev visuelt kontrolleret.

## Afgrænsning og næste skridt

Login-milepælens funktioner er verificeret i testmiljøet. Dette er **ikke en produktionsgodkendelse**: recovery-build er ikke deployet på Vercel, produktionsvariabler er ikke afprøvet, og eksisterende kontiers faktiske login er ikke testet eller ændret. Sessionsfornyelsen blev udløst ved at ændre lokal udløbstid, ikke ved at vente en hel JWT-levetid. Ingen belastningstest eller langvarig driftstest.

Den lokale server er stoppet. Testprojektets sletning afventer afsluttende browserbekræftelse. Næste trin er en konkret plan for produktionsvariabler, eksisterende kontoadgang og deployment med ejerens godkendelse. Løbscyklussen er fortsat lukket og er ikke genopbygget.

## Reproduktion for udvikleren

Hjælperne afviser andre projektadresser end det navngivne testprojekt. Ved et nyt testprojekt ændres allowlisten bevidst. `tests/support/real-schema.sql` er kun en testfixture til et tomt projekt, **ikke en produktionsmigration**. Den kopierer ingen data.

En ignoreret `.recovery-local/real-test-config.json` indeholder `url`, `anonKey` og `serviceKey`. Udskriv eller commit aldrig værdierne. Kør `node tests/support/real-seed.mjs`, start et eksisterende produktionsbuild med `node tests/support/real-server.mjs`, og kør `node tests/support/real-api-check.mjs` i en anden terminal. Resultater gemmes lokalt uden nøgler. Browserkontrollen udføres derudover. Seed stopper, hvis fixturefilen allerede findes, så fejl ikke lydløst opretter flere konti.
