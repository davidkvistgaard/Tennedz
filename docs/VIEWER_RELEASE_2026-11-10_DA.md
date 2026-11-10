# Viewer på tennedz.eu, 10. november 2026

## Udgivelse og kilde

- Aktuelt udgivet kode: `c1a03eed89e45f93be485b8b0bf597422e83da64`
  på `codex/viewer-atlas-integration`. `cf2db20c` begrænser en gemt
  optagelse til managerens egen division. `c1a03eed` udelukker lokale
  testbuilds og fixtures fra Vercels upload. `8e9beb73` gjorde handlingen
  "Generate and watch a test race" tydelig på standardvieweren, og
  `485d60cc` rettede kameraet efter fangster.
- Aktuelt Vercel-produktionsdeployment: `dpl_39nxYcLYSHqFbaZx4rzUixNfcvBq`.
  Den forrige produktion `dpl_BSEMYg5mqyu9mM4W3HFez7qCPshq`, kameraudgaven
  `dpl_FkRU2sf1QtCroYzDKpc3nYvLgmvL` og den ældre
  `dpl_CEUquKHrX4mpB98B3tKZxg24hSaj` var `READY` ved kontrol. De nye
  udgivelser blev først bygget til produktionsmiljø uden domæne og derefter
  promoveret uden genbygning. `tennedz.eu` og `www.tennedz.eu` pegede på
  det aktuelle deployment efter sidste promovering.
- På de tidligere deployments havde `ViewerPreviewClient.js`,
  `viewer-preview.css`, den fokuserede Motor Lab-browsertest og
  `ViewerPreviewScene.js` samme SHA-1 som i de rene lokale commits. I den
  seneste staged build matchede
  `app/api/event-run/route.js` lokal SHA-1
  `9df546e7f63dc337a26237c657c190a5d1612118`. Dry-run havde nul lokale
  build- eller testfiler. Produktionssidens JavaScript-URL havde det aktuelle
  deployment-id.
- Den parallelle Atlas-gren stod på `d55d2ef42b2b7dffa2a32c51d171740d4528a5db`
  ved udgivelsen; denne commit er forfader til viewer-grenen. Motor-grenen
  blev ikke ændret.

## Faktisk produktionskontrol

En logget ind manager genererede på `tennedz.eu/team/motor-lab/live` et
eksperimentelt løb med 32 fiktive mænd på 160 km. Den beskyttede API leverede
5.120 registrerede ryttercheckpoints. Den fælles præsentation gik fra start
til mål på 21:20, og den foreløbige klassifikation med alle 32 placeringer
kom først frem efter mål. Browserens WebGL2 brugte Intel UHD Graphics via
ANGLE og havde ingen konsolfejl eller advarsler. Den viste typisk 120 fps i
denne 32-ryttervisning; det er én maskine og ikke et løfte til andre enheder.

Den første udgivelseskandidat havde en reel kamerafejl: Når en valgt
førergruppe forsvandt ved en registreret fangst, holdt kameraet fokus på den
gamle position og viste tom vej. Kandidaten blev rullet tilbage til et
`READY` deployment. I den rettede udgave vælger kameraet automatisk feltet
eller en anden eksisterende gruppe, når det valgte gruppe-id ikke længere
findes i det aktuelle checkpoint. Dette er kun et lokalt kameravalg. Et nyt
produktionsløb på den rettede commit bekræftede ved en fangst efter km 15,
at kameraet flyttede til feltet, alle 32 ryttere blev ved med at være synlige,
kamerafokus fulgte det registrerede checkpoint, og konsollen forblev fejlfri.
Rytterne vises tættere på både desktop og telefon, og den fælles tid er
uændret.

Dette andet produktionsløb blev derefter fulgt helt til 160 km på den
rettede viewer. Den fælles afspilning sluttede ved 21:20, alle 32 foreløbige
resultatrækker blev vist, og det valgte kamera pegede fortsat på en
eksisterende gruppe ved det registrerede 160.000-meter-checkpoint. WebGL2
viste 32 ryttere ved mål og browseren rapporterede ingen konsolfejl. Den
observerede visning nåede omkring 149.000 renderede frames under hele løbet;
det dokumenterer kun denne browser og maskine.

Den staged produktionsbuild viste `/viewer` med WebGL, 32 ryttere og
JavaScript fra det præcise deployment. Direkte login på stagingdomænet var
ikke muligt i den aktuelle browsersession; den beskyttede viewer og dens
afsluttede replay blev derfor browserkontrolleret på `tennedz.eu` straks
efter promovering. Vercels runtime-logoversigt viste ingen indlæg i
kontrolvinduet.

På den sidste udgivelse viste den offentlige standardviewer knappen
"Generate and watch a test race", WebGL-rendering og JavaScript fra
`dpl_39nxYcLYSHqFbaZx4rzUixNfcvBq`. Et klik førte den loggede manager til
den beskyttede formular med plan, rute, scenarienummer og holdordrer uden at
starte et løb automatisk. `www.tennedz.eu/viewer` viderestillede til
`tennedz.eu/viewer` og viste samme deployment uden konsolfejl. Den staged
build blev kontrolleret med 32 WebGL2-ryttere, korrekt JavaScript-id og nul
konsolfejl, og derefter på hoveddomænet. En logget ind manager fik
`RUN_FORBIDDEN` ved direkte adgang til en optagelse uden eget
divisionsmedlemskab.

## Testport

- `pnpm lint`, `git diff --check` og isoleret Next.js-produktionsbuild bestod.
- To autentificerede Motor Lab-browsertests bestod med WebGL2, fuld
  checkpointdækning, to tilskuere på samme tid, afvisning af ugyldig session,
  fremtidsskjult resultat, 32 placeringer ved mål, fangst af valgt gruppe,
  telefonlayout og asset-fallback.
- Seks yderligere browsertests bestod for guidede herre- og kvindefelter
  med 160 ryttere og visuelle felter på 30 og 150 ryttere i begge kategorier.
  Tre tests bestod for gemte løb gennem den beskyttede `/api/event-run`,
  herunder kilderesultatet ved fælles mål. En fjerde autentificeret test
  bekræftede, at en manager kan se sin egen division, men får 403 ved et
  andet divisionsnummer eller som udenforstående.
- På den lokale Intel UHD/WebGL2-maskine målte de visuelle felter 87 fps
  (30 mænd), 61 fps (150 mænd), 81 fps (30 kvinder) og 60 fps
  (150 kvinder). Et guidet 160-rytter kvindeløb målte 42 fps. Den genererede
  32-ryttervisning målte 120 fps efter at en konkurrerende WebGL-fane blev
  lukket. GPU-ydelse på andre enheder er ikke verificeret.

## Datagrænser

Motor Lab-løbet er en fiktiv, eksperimentel øvelse, ikke et gemt spil-løb
eller et officielt resultat. Kilometrene er registreret for hver rytter;
otte visningssekunder per kilometer er en præsentationskadence, fordi den
ældre motor ikke optog en faktisk løbstid. Gruppens tidsforskel omregnes
ikke til opdigtede samtidige metre. Rytternes indbyrdes afstande, vejbaner,
hjul og scenens landskab er illustrative. Betalt kontakt, kanonisk Atlas-rute,
spiltrøjer og officielle resultater mangler i dette Motor Lab-kildeløb.

Gemte guidede løb bruger den separate versionerede adapter og kan vise
spillets optagne identiteter, trøjer og officielle resultater. Den autentificerede
produktionskonto havde endnu intet gemt løb, så dette forløb er testet med
faktiske motoroptagelser og en lokal beskyttet API-fixture, ikke med et gemt
produktionsløb. Den guidede API udleverer stadig hele optagelsen til en
autoriseret divisionsdeltager før den visuelle målstreg; brugerfladen skjuler
fremtidige hændelser og resultater, men netværkssvaret gør dem teknisk
tilgængelige. Streng netværksmæssig hemmeligholdelse kræver en separat
serverstyret, tidsopdelt leverance.
