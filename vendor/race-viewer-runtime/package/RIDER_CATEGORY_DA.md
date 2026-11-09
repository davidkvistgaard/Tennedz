# Kvinde- og herrefelter samt broadcast — 0.85

Spillets eksport angiver `riderCategory: "women"` eller `riderCategory: "men"` på hele viewer-feedet. Ét feed viser ét felt i én kategori. Kategorien udledes aldrig af navn, hold eller resultat. Ældre feeds uden feltet beholder herremodellen for bagudkompatibilitet. Den fysiske adapter modtager feltet på payload eller scene; den eksplicitte spilmapper returnerer det fra `race(source)`.

Kvindeprofilen har egen atletisk torso med samme trøje-UV’er, smallere skulderparti, justeret hofte-, arm- og benprofil samt hovedprofil. Cyklernes hjul, krank og kontaktpunkter er fælles. Begge bruger samme animationsrig: kildepositioner, angreb, føringer, sat/kørt ind, sprinttog, sprint og vinderreaktion. Kategori påvirker ingen simulation, ordrer, resultater, klokke eller kameravalg. Begge renderingsveje vælger samme profil. Sprite-cachen adskiller kategorier, så dataskift ikke genbruger forkert grafik.

Valgfri `riders[].hairStyle` (`none`, `short`, `tied`) og `hairColor` (sekscifret hex) virker i begge kategorier. Standard er kort opsat hår for kvindeprofilen og intet synligt hår under hjelmen for den gamle herreprofil; eksporten kan tilsidesætte det for hver rytter. Frisuren bestemmer aldrig feltets kategori.

Topbjælken anvender udelukkende `leaders`, `chase group 1`, `chase group 2`, `peloton`, `dropped group 1` osv. Numrene følger rækkefølgen på vejen og tælles særskilt for jagtgrupper og satte grupper. Producenten kan levere `frames[].groupRoles` med nøgler svarende til gruppers uændrede ID’er og værdierne `leaders`, `chase`, `peloton`, `dropped`. Roller følger kildeframes og tilbagespoling. Uden metadata bruges eksisterende peloton-ID eller største ukategoriserede gruppe som felt, forreste gruppe som leaders og øvrige grupper efter placering i forhold til feltet. Der dannes eller sammenlægges ingen grupper.

Distance til mål bruger kildens mållinje. Hvis ingen mållinje er leveret, anvendes slutningen af den leverede rute. Fra og med præcis 1.000 m vises km med én decimal; under 1.000 m vises meter. En afstand på 999,9 m bliver 999 m, så afrunding ikke fejlagtigt viser 1.000 m. Efter stregen vises 0 m. Uden positionsdata vises en streg.

De rene datafunktioner `raceGroups`, `labelRaceGroups`, `finishRemaining` og `formatFinishDistance` er også eksporteret fra `@pelotonia/race-viewer/data`, så spillets eget HUD kan anvende samme visning. I demoens Race details kan 30/150 ryttere og Men/Women vælges; importerede løb styres udelukkende af deres data.

Kørbare browserprøver: `/rider-category-test.html` for kategorier, handlinger og præcis afstandsgrænse, samt `/session-integration/index.html` for den installerede Next.js-pakke. WebGL på rigtige enheder skal stadig afprøves separat.
