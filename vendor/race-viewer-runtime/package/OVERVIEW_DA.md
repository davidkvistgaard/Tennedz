# Pelotonia Viewer — samlet overblik, version 0.64

Vieweren er en selvstændig React/Three.js-prototype til at vise et allerede beregnet cykelløb. Den indeholder ingen ekstra løbsmotor. Tennedz, produktionsspillet, databasen, motoren og atlasset er ikke ændret eller tilsluttet.

## De foregående ti versioner, 0.46–0.55

| Version | Ændring | Betydning for spillet |
|---|---|---|
| 0.46 | Separat `/data`-modul | Serveren kan validere og tilpasse eksporten uden browser, React-rendering eller Three.js. |
| 0.47 | Eksportrelative asset-URL'er | Trøjer, vejteksturer, terræn og modeller kan ligge ved løbets eksport, uafhængigt af spillets side-URL. |
| 0.48 | HTTP-indlæser med validering | Spillet angiver endpoint og adgangsindstillinger; data og ur kontrolleres samlet. JSON-størrelsen begrænses. |
| 0.49 | Timeout og afbrydelse | Indlæsning kan afbrydes, og ventetiden er begrænset, også ved en brugerdefineret fetch, der ignorerer abort. |
| 0.50 | Forbindelsesstatus | Spillet kan vise connected/reconnecting/offline uden at ændre den beregnede løbstid. |
| 0.51 | Eksplicit genforsøg | Den fejlede indlæsning kan prøves igen, mens det sidst gyldige løb bliver stående. |
| 0.52 | Isolerede abonnementsfejl | En fejl i én tilskuers callback stopper ikke de øvrige tilskuere eller sessionens tilstandsskift. |
| 0.53 | Eksportkontrol før visning | Rapport over schema, ryttere, frames, manglende samples og deklarerede filer uden netværkskald. |
| 0.54 | React-komponent til eksportkontrol | Rapporten kan bruges i spillets import-/administrationsside og findes i demoens Data & Integration. |
| 0.55 | Prøve af den installerede pakke | To tilskuere, HTTP-eksport, relativ GLB, ur-revisioner, rewind, uafhængigt kamera, fejl, genforsøg og luk/genåbn testes samlet. |

## Hvad den samlede viewer kan

| Område | Funktioner |
|---|---|
| Ryttere | 30 og 150 ryttere; animerede pedaler og led; kildebestemt kadence, også friløb. |
| Identitet | Holdtrøjer, importerede teksturer, ledertrøjer og rankinghjelme fra data. Ingen automatisk uddeling af klassifikationer. |
| Handlinger | Angreb, føring, beskyttelse, hjulfølge, bridging, at blive sat/hentet, sprint, restitution, cykelkast og jubel med én eller begge arme. Ordrer og faktiske handlinger er adskilte data. |
| Finale | Flere sprinttog og solosprintere i syntetiske eksempler; målstreg, målportal, åbne barrierer og plads efter stregen. Portalen kan erstattes med en GLB eller udelades ved eksisterende bygninger. |
| Resultater | Motorens placeringer, millisekunder, DNF/DNS/DSQ og delvise resultater. Offentliggørelsestidspunktet styrer, hvornår resultaterne vises; tilbagespoling skjuler dem igen. |
| Kamera | Valg af rytter eller gruppe, glidende følgning, fast forhøjet perspektiv, orbit/zoom, overblik og stationært målkamera. Tilskuere vælger uafhængigt. Ingen røntgenvisning af skjulte ryttere. |
| Miljø | Leveret rute, højde, terræn, vand og statiske landmarks/modeller. Målområdet følger rutens geometri og kan placeres på hævet eller skrånende vej. |
| Afspilning | Lokal demo med play/pause og tidslinje; fælles ur fra serveren ved rigtig broadcast. Tilskuerens kameravalg ændrer ikke det fælles ur. |
| Integration | Installerbar React-pakke, serveregnet data-modul, versionsbestemt adapter, feed-validering, asset-status, snapshots, session, indlæser og Next.js-eksempler. |
| Fejl | Ugyldige erstatningsdata bevarer det gyldige løb; gamle svar og ur-revisioner afvises; manglende assets rapporteres; pending indlæsninger kan afbrydes. |

## Afprøvning og grænser

170 automatiske tests og produktionsbuildet består. Den installerede pakke er kompileret med strict TypeScript i et separat Next.js-projekt. En serverside prerender validerer en eksport med 150 ryttere gennem `/data` uden browser-rendereren. Browserprøven med to 150-ryttertilskuere består for indlæsning, relativ målportal, fælles ur, rewind, lokalt kamera, fejlet løbsskift, genforsøg samt lukning/genåbning. Tidligere browserprøver dækker også de tre finaleeksempler med jubel, cykelkast og officielle resultater.

Browserprøverne er kørt i CPU Compatibility-visning. Det er ikke en godkendelse af WebGL-ydelse, GPU-hukommelse eller den endelige grafiske kvalitet på spillernes hardware. Grafikken er fortsat en prototype og har ikke endelig visuel godkendelse mod referencevisionen.

Atlassets globale earth-to-city-visning er ikke bygget her. En aktiv vulkan, hængebro eller katedral skal leveres som miljødata/modeller; vieweren opfinder ikke den geografi. De viste løb og situationer er faste syntetiske eksporter.

## Næste integration i spillet

1. Lad spillets eksportør levere kontraktens rute, miljø, ryttere, trøjer, positionsframes, handlinger og resultater; valider med `/data` før levering.
2. Tilslut spillets egen godkendte eksport-URL og broadcast-kanal. Spillet ejer adgang, server-epoch, offset-estimat, race-ID og stigende ur-revisioner. Vieweren leverer ikke en netværkstjeneste.
3. Afprøv rigtige eksporter og assets samt WebGL med 150 ryttere på målmaskiner. Godkend derefter grafik, ydelse og integration samlet.

Pakken er forberedt til denne integration, men er ikke produktionsgodkendt. Se LOADING.md, SESSION.md, RESULTS.md og HANDOFF.md for de konkrete indgange.

## Visuel runde 0.56

Forbedret cykelrig, pedal-/benproportioner, verdensprojicerede CPU-skygger, tættere kamera og valgfrie tilskuere, afstandsskilte og vejtekst. Demoen leverer 60 varierede tilskuere som eksplicitte data. Se VISUAL_ROUND_DA.md for før/efter-billeder og afprøvning.

## 0.57 — fælles ryttermodel

173 automatiske tests består. Trøjen har nu fælles kropsform og UV-kort i begge renderere, CPU-dele sorteres efter dybde, og trøjebelysningen følger verdenssolen. Rygnummre, handsker og sokker er rettet eller tilføjet. Detaljer og den faktiske renderede scene: RIDER_ROUND_DA.md. Spillets dataformat er uændret. GPU-hardwareafprøvning er stadig åben.

## 0.58 — terrænmaterialer

179 automatiske tests består. Nyt detaljelag i verdenskoordinater til standardterræn, begrænset CPU-materialecache, fælles græsgeometri og mere varieret rabatmateriale. Importeret terrænbillede slår standarddetaljen fra. Rute, vejens asfaltbredde, højdefelt og løbsdata ændres ikke. Se TERRAIN_ROUND_DA.md.

## 0.64 — første ydelses-/GPU-runde

185 tests består. Pause uden gentagne tunge tegninger er målt; kamera, lys og afspilning vækker scenen. Terrænflader opbygges efter synlighedskontrol, og geometri-/centercaches er begrænset. Ny diagnosticerings-API og rapporterbar 30/150/150-enhedstest. Den faktiske cloud-test er Compatibility, cirka 1 FPS under aktiv afspilning; GPU-porten står stadig åben. Se PERFORMANCE_ROUND_DA.md.

## Sammenhængende handlingsskift · 0.61

Rytternes kropspositurer fortsætter nu gennem tilstødende faktiske handlinger. En afsluttet føring skifter til restitution på kildens tidspunkt; en spurt glider ind i den leverede jubel uden at nulstille torsoen. Pauser i data forbliver pauser. Inputkontrakten er uændret. 193 tests og installeret Next.js-browserkontrol passerer. Se ACTION_TRANSITIONS_DA.md.

## Rutedækning ved mål · 0.62

Ryttere uden for den leverede rutes geometri klemmes ikke længere fast ved endepunktet. Deres kildedata, faktiske handlinger og officielle resultater bevares. Integrationen kan læse den nye rutedækningsdiagnose og tilføre korrekt udløbsgeometri. 198 tests og browserkontrol med 150 ryttere passerer. Se ROUTE_COVERAGE_DA.md.

## Kamera på smalle skærme · 0.64

Gruppens faktiske placering, skærmens proportioner og kameraets synsfelt bestemmer nu indramningen. Det forbedrer visningen af udstrakte grupper på smalle flader. Manuel zoom og lokal kameravinkel bevares, mens den fælles løbstid er uændret. Se CAMERA_FRAMING_DA.md.
