# Viewer på tennedz.eu, 10. november 2026

## Udgivelse og kilde

- Aktuelt udgivet kode: `e2525da55dbca9f4f599deb6ffe9378da4d263f7`
  på `codex/viewer-atlas-integration`.
  Linket fra standardvieweren åbner nu direkte filteret for afsluttede
  spilløb i den valgte kønskategori, hvorfra en gemt optagelse kan åbnes.
  Hele managerforløbet fra
  holdoprettelse over tilmelding og viewer til resultat bestod ved både
  390 og 1440 pixels i den isolerede browserfixture.
  `8f3d3e1db9449d197c7148c5deb66093e0f29580` indførte linket til
  afsluttede løb; `e2525da5` fører den valgte kategori med.
  Den forrige kodecommit `8c6937278e553c9a89cc75d0c208f77c752e07a3`
  rettede checkpointforklaringen.
  Dækningsforklaringen for gemte guidede løb siger nu korrekt, at alle ryttere
  er til stede ved hvert gemt checkpoint, mens ikke hver kilometer er optaget.
  `f7daf6752f55eec2d0c336405f10c2cb071e6719` tilføjede den synlige
  adgang til gemte spilløb.
  Standardvieweren linker nu direkte til løbskalenderens gemte spilløb og
  beholder indgangen til et Motor Lab-testløb. Den tidligere kodecommit
  `61bbaf65886d8dc0530430898afd01932078a46d` indeholder den
  versionerede guided-adapter v1-3, som sorterer officielle målrækker efter
  kildens placering og bruger kildens vinder-tid som reference for de viste
  tidsforskelle. Kildens placeringer og måltider ændres ikke. `cf2db20c`
  begrænser en gemt optagelse til managerens egen division. `c1a03eed`
  udelukker lokale
  testbuilds og fixtures fra Vercels upload. `8e9beb73` gjorde handlingen
  "Generate and watch a test race" tydelig på standardvieweren, og
  `485d60cc` rettede kameraet efter fangster.
- Aktuelt Vercel-produktionsdeployment: `dpl_6ZPr7dAzt4wmv1GpkSrBot7pw8Du`.
  Den forrige produktion `dpl_xY1MyeY9xM3myVqXKrDHR7NshPR9`, dennes
  forgænger `dpl_mR9UwaMvFAf5h4L2EiMSqEThHqUB`, dennes
  forgænger `dpl_88zYwQMbHGX2sCyiSEPiNDuY7cFW`, dennes
  forgænger `dpl_HT3Rj7XDk4ywBXJ2bRNSLKPw3VGC`, dennes
  forgænger `dpl_39nxYcLYSHqFbaZx4rzUixNfcvBq` og dennes
  forgænger `dpl_BSEMYg5mqyu9mM4W3HFez7qCPshq`, kameraudgaven
  `dpl_FkRU2sf1QtCroYzDKpc3nYvLgmvL` og den ældre
  `dpl_CEUquKHrX4mpB98B3tKZxg24hSaj` var `READY` ved kontrol. De nye
  udgivelser blev først bygget til produktionsmiljø uden domæne og derefter
  promoveret uden genbygning. `tennedz.eu` og `www.tennedz.eu` pegede på
  det aktuelle deployment efter sidste promovering.
- På de tidligere deployments havde `ViewerPreviewClient.js`,
  `viewer-preview.css`, den fokuserede Motor Lab-browsertest og
  `ViewerPreviewScene.js` samme SHA-1 som i de rene lokale commits. I den
  seneste staged build matchede `lib/viewer/guided-replay-adapter-v1.mjs`
  lokal SHA-1 `ade5c8534b16efb29586a1ec2dd5fa9486bd8dea`.
  Den forrige staged builds `app/api/event-run/route.js` matchede lokal SHA-1
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
`dpl_xY1MyeY9xM3myVqXKrDHR7NshPR9` samt det nye link "Watch your saved
game race" til `/team/run`. Et klik på testløbslinket førte den loggede manager til
den beskyttede formular med plan, rute, scenarienummer og holdordrer uden at
starte et løb automatisk. `www.tennedz.eu/viewer` viderestillede til
`tennedz.eu/viewer` og viste samme deployment uden konsolfejl. Den staged
build blev kontrolleret med 32 WebGL2-ryttere, korrekt JavaScript-id og nul
konsolfejl, og derefter på hoveddomænet. En logget ind manager fik
`RUN_FORBIDDEN` ved direkte adgang til en optagelse uden eget
divisionsmedlemskab.

For den nye navigation bestod lint og en frisk isoleret Next.js-build.
Staging og derefter hoveddomænet viste begge links, 32 renderede ryttere,
WebGL-scenen og JavaScript-URL med `dpl_xY1MyeY9xM3myVqXKrDHR7NshPR9`.
Browseren rapporterede ingen konsoladvarsler eller fejl. Begge domænealiaser
pegede på samme `READY` deployment; den tidligere produktion var `READY`
som rollback. Vercels runtime-logoversigt havde ingen indlæg i
kontrolvinduet.
Den seneste rettelse bestod fire autentificerede browserforløb for gemte
herre- og kvindeløb, inklusive resultat ved fælles mål og divisionsværn.
Den isolerede produktionsbuild, lint og diffkontrol bestod. Uploadmanifestet
indeholdt ingen lokale build- eller testfiler; staged kildefilen havde SHA-1
`35fa37bc7a2f8331331996f6d3cbaa406110eea2`.

For det seneste link viste uploadmanifestet nul build- og testfiler, og de
to ændrede kildefiler havde SHA-1 `dd4d92d4f98e4bfbbd57b8dc14a2c26e3b9b6ec3`
og `fa344f9d8d94bbb6019ad9412c2163b3dfd3cd81`. Det staged deployment
var `READY`, viste 32 WebGL-ryttere og indgangen til
`/team/run?bucket=finished` uden konsolfejl. På hoveddomænet bekræftede en
autentificeret managersession, at linket landede med "Finished" valgt.
Kontoen havde ingen afsluttede spilløb i hverken herre- eller kvindefeltet,
så den kunne ikke afspille et gemt produktionsløb. Begge domænealiaser pegede
på det aktuelle `READY` deployment; den forrige udgave var også `READY` som
rollback, og runtime-logoversigten var tom i kontrolvinduet.

En efterfølgende testcommit `e8824b81d93a8f4e116989ee425fb4a5f106175e`
ændrer kun testkoden og er ikke en ny produktion. Den verificerede to
autentificerede tilskuere til samme gemte løb: API-svarene havde samme
serverforankrede løbsstart, begge WebGL-scener viste alle 32 ryttere, og
rotation af det ene kamera ændrede ikke det andet. Testen og lint bestod.

Den seneste kategoriændring bestod lint, en frisk isoleret Next.js-build,
en fokuseret test af linkets kategori og managerforløbet ved 390 og 1440
pixels. En samlet Playwright-kørsel mistede en worker; begge managerforløb
bestod ved særskilt gentagelse. Staged deployment `dpl_6ZPr7dAzt4wmv1GpkSrBot7pw8Du`
var `READY`. Dets `ViewerPreviewClient.js` matchede lokal SHA-1
`82395dd5379c2b7662208939c54814f796f5e3c3`, og uploadmanifestet
indeholdt ingen lokale build- eller testfiler. Den offentlige kvindevisning
viste 32 WebGL-ryttere, korrekt link til
`/team/run?bucket=finished&gender=F`, deploymentets JavaScript og ingen
konsoladvarsler eller fejl. Efter promovering viste `tennedz.eu` samme link;
et klik i den autentificerede managersession åbnede kalenderen med både
"Women" og "Finished" valgt. Kontoen havde stadig intet afsluttet
kvindeløb. Begge domænealiaser pegede på dette `READY` deployment, den
forrige produktion var `READY` som rollback, og runtime-logoversigten var
tom i kontrolvinduet. Den aktuelle fane viste 11 fps med mange samtidige
browserfaner åbne; det er ikke en stabil ydelsesmåling og giver ikke
grundlag for en generel 60 fps-påstand.

## Testport

- `pnpm lint`, `git diff --check` og isoleret Next.js-produktionsbuild bestod.
- Ti guided-adapter-unittests bestod, herunder en optagelse med ombyttede
  officielle målrækker. Den gemte kilde blev ikke ændret.
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
- En senere samlet gentagelse på samme Intel UHD-maskine under anden lokal
  belastning bestod også alle fire WebGL2-felter, men målte 35 fps
  (30 mænd), 22 fps (150 mænd), 31 fps (30 kvinder) og 21 fps
  (150 kvinder). Median-CPU-tiden var cirka 3 ms for 30 og 8 ms for 150
  ryttere. Den lavere måling viser, at 150-ryttervisningen har begrænset
  ydelsesmargin på denne enhed; tidligere højere fps kan ikke bruges som
  generelt ydelsesløfte. Baggrundsfaners rapporterede fps er ikke en
  pålidelig GPU-måling.

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
