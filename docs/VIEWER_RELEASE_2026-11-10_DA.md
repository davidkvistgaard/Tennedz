# Viewer på tennedz.eu, 10. november 2026

## Udgivelse og kilde

- Udgivet kode: `485d60cc232d4d883531498ea856efd5018dac1f` på
  `codex/viewer-atlas-integration`.
- Vercel-produktion: `dpl_FkRU2sf1QtCroYzDKpc3nYvLgmvL`, bygget som
  produktionsdeployment uden domæne og derefter promoveret uden genbygning.
  Både `tennedz.eu` og `www.tennedz.eu` pegede på dette deployment efter
  promovering. Den tidligere `dpl_CEUquKHrX4mpB98B3tKZxg24hSaj` var
  fortsat `READY` som rollback.
- Deploymentets kildefiler for `ViewerPreviewScene.js` og den fokuserede
  Motor Lab-browsertest havde samme SHA-1 som de tilsvarende filer i den rene
  lokale commit. Produktionssidens JavaScript-URL havde det nye deployment-id.
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

Den staged produktionsbuild viste `/viewer` med WebGL, 32 ryttere og
JavaScript fra det præcise deployment. Direkte login på stagingdomænet var
ikke muligt i den aktuelle browsersession; den beskyttede viewer og dens
afsluttede replay blev derfor browserkontrolleret på `tennedz.eu` straks
efter promovering. Vercels runtime-logoversigt viste ingen indlæg i
kontrolvinduet.

## Testport

- `pnpm lint`, `git diff --check` og isoleret Next.js-produktionsbuild bestod.
- To autentificerede Motor Lab-browsertests bestod med WebGL2, fuld
  checkpointdækning, to tilskuere på samme tid, afvisning af ugyldig session,
  fremtidsskjult resultat, 32 placeringer ved mål, fangst af valgt gruppe,
  telefonlayout og asset-fallback.
- Seks yderligere browsertests bestod for guidede herre- og kvindefelter
  med 160 ryttere og visuelle felter på 30 og 150 ryttere i begge kategorier.
  Tre tests bestod for gemte løb gennem den beskyttede `/api/event-run`,
  herunder kilderesultatet ved fælles mål.
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
