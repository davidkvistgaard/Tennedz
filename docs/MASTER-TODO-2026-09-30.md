# Pelotonia — samlet to-do og tidsestimat

**Opdateret 5. oktober 2026 efter den isolerede P03-prøve og den tofasede 45-holds resultatprøve.** Dette er den aktuelle hovedliste for kendte produktønsker. [Produktvisionen](PRODUCT-VISION.md), [kalenderpakken](CALENDAR_AUTOPILOT_RANKINGS_V0_1.md), [motorprototypen](../../engine-current/docs/design/ENGINE-V2-FOUNDATION.md), [verdensbaselinen](PELOTONIA-WORLD-BASELINE-1.6.2.md) og de enkelte designnoter er baggrund; gamle statusangivelser i dem er ikke en ny leveringsplan. Listen skelner mellem kode i produktion, kode i isolerede udviklingsspor og ubyggede funktioner.

## Sådan læses estimaterne

- Alle tal er **aktive udvikler-/agenttimer for implementering, relevante tests og lokal gennemgang**, som et interval. De er ikke kalenderdage eller et løfte om levering. Ventetid på feedback, godkendelser, licenser, billedproduktion hos en ekstern leverandør og eventuelle tjenester/abonnementer er ikke medregnet.
- Estimaterne forudsætter, at den eksisterende Next.js/Supabase-arkitektur genbruges, og at én person arbejder sekventielt. Store sportslige og visuelle opgaver har størst usikkerhed; estimaterne bør revideres efter første rigtige spillertest og atlas-artprototype. Summér ikke timerne som en fast deadline.
- **P0** er grundlaget for sikker integration og første reelle test; **P1** er kerneoplevelsen; **P2** er progression og indhold; **P3** er senere spilformer. Numrene er stabile opgavehenvisninger, ikke sprintdatoer. `Afhænger af` peger på andre numre i listen.
- Et punkt tæller først som færdigt, når det virker i sin angivne sammenhæng og er verificeret. En lokal prototype, en UI-preview og en udgivet funktion er forskellige statusser.

## Status ved denne opdatering

| Område | Bekræftet status |
| --- | --- |
| Live grundspil | Login, konto/holdoprettelse med 8 mænd + 8 kvinder, passwordindstillinger, hold-/ryttervisning, holdidentitet, eksisterende endagsløb, resultatvisning og en kalenderforside findes. De gamle produktionsløb er historiske/udløbne; et løb med reelle modstandere i den nye cyklus er endnu ikke dokumenteret som fuldført. |
| Kalender V0.1 | Kalender-UI og navigation er udgivet. Fire standardtrupper, beskyttet autopilot/cron, pointledger og yderligere kalenderarbejde er samlet med Motor Lab på `codex/p01-calendar-engine-integration`. Kalender-/autopilotmigration og cron er verificeret i isoleret database og Vercel-preview; de er ikke aktiveret eller verificeret i produktion, og pointtildeling er heller ikke produktionsverificeret. Et gemt standardhold er **ikke** i sig selv en aktiv automatisk tilmelding. |
| Ny motor | Isoleret `v2-prototype-74` med kilometermodel, op til 40 vejgrupper, taktik, forsøgsvis etapeløbslogik og verificerbar in-memory replay. Ingen live ordreflow, persistent replay eller produktionsafvikling. Balancefund viser stadig stærke strategier og uafklaret realisme. |
| Verden/atlas | Strukturerede verdensdata V1.0–V1.6 er udbygget. Alle fem godkendte kildekonflikter er løst lokalt som Baseline 1.6.2 på `codex/world-conflict-resolution-20260930`; denne commit er endnu ikke integreret i `engine-current` eller udgivet. Atlassets eksisterende geometri/illustration er en prototype, ikke det ønskede malede kort. |
| Portrætter og stab | 16 særskilt malede starterportrætter findes, men den generelle reservevisning og variationen er ikke godkendt som slutniveau. `/team/staff` er en lokal designpreview uden personaleøkonomi eller sportslig effekt. |

**Første synlige delmål påbegyndt:** Et serverberegnet, syntetisk [Motor Lab](MOTOR-LAB-MILESTONE-1.md) er bygget og testet lokalt. Det er et udsnit af punkt 04–09, ikke en færdig motor, ordreflade eller officiel løbsviewer. Listen over resterende arbejde og estimater nedenfor ændres først efter spiltest og en konkret ny vurdering.

**Efterfølgende lokalt delmål:** [Ordre-værkstedet](MOTOR-LAB-ORDER-WORKSHOP.md) lader spilleren afprøve tre forudbestemte taktiske valg og sammenligne to kørsler af samme fiktive scenarie. Det er fortsat ikke et gemt ordreflow til officielle løb. [Logo v0.1](PELOTONIA-BRAND-LOGO-V0.1.md) er også implementeret lokalt og skal med ved næste offentliggørelse.

**Replay-deltrin:** Motor Lab har nu en afspillelig kilometertidslinje og en kurve over det registrerede forspring. Afspilningen bruger den eksisterende optagelse i browserhukommelsen. Vedvarende replay, rigtige hold, rigtige ruter og officielle resultater er fortsat åbne under punkt 07–09.

**Taktisk deltrin:** En betinget ordre kan nu forsøge et angreb fra udbruddet efter et valgt kilometermærke. Optagelsen viser både et vellykket split og grunden til et blokeret forsøg. Det gør flere samtidige grupper synlige i en fiktiv test, men er ikke en fuld ekspertordreflade eller verificeret løbsbalance.

**Rute-deltrin:** Motor Lab kan sammenligne en flad, vindeksponeret og en kuperet, fiktiv 160 km-rute med samme scenarienummer. Sammenligningskortet kræver samme rute; de officielle rutedata og rytterspecialisering mangler stadig under punkt 06–07.

## Hurtigt overblik over resterende arbejde

| Spor | Punkter | Estimat |
| --- | ---: | ---: |
| Integration og testgrundlag | 01–03 isoleret verificeret | 0 t i dette spor |
| Ny motor og spilbart løb | 04–12, 41 | 256–512 t |
| Kalender, autopilot og ranglister | 13–20 | 156–312 t |
| Atlas og stedoplevelse | 21–26 | 200–400 t |
| Klubprogression, økonomi og fans | 27–34 | 240–480 t |
| Portrætter, intro, nye løbsformer og ruter | 35–40 | 200–400 t |
| **Alle kendte resterende punkter** | **04–41** | **1.052–2.104 t** |

Den første tekniske **endagsløbs-testsløjfe** er nu gennemført isoleret i punkt 03 med 45 browserstyrede hold. En sportsligt realistisk spiltest kræver stadig arbejde med motor, ordrer og viewer i punkt 04–09 samt den tofasede kalender- og pointfordeling i punkt 16–17. Detaljerede timeintervaller står ved hvert punkt; P03-prøven gør ikke de senere punkter færdige.

## P0 — sammenhæng og testgrundlag

**Punkt 01, lokalt verificeret 4. oktober:** Kalender-, autopilot- og ranglistekoden er samlet med Motor Lab i et separat udviklingsspor. Konflikter er løst, den eksisterende løbsafvikler er bevaret, og unit tests, lint, build og browserregression passerer. Se [integrationsnotatet](INTEGRATION-P01-2026-10-04.md). Punkt 02's databasestatus står nedenfor; dette er ikke en produktionsrelease.

**Punkt 02, isoleret verificeret 4. oktober:** Alle 18 repo-migrationer er afprøvet i en frisk testdatabase oven på det dokumenterede grundskema; repoet indeholder endnu ikke den oprindelige grundskema-migration. Den isolerede database har bestået tests af kalenderoprettelse, ordrer, adgangsrettigheder, manuel prioritet, tidszoner, lease/retry, idempotent optælling og køjobs. To SQL-/regnskabsfejl og to manglende fremmednøgleindekser blev rettet. Lokal HTTP-test dækkede 400 og 1.000 syntetiske hold, herunder genoptagelse efter tidsbudgettet. En beskyttet Vercel-preview med branch-specifikke nøgler til kun testdatabasen afviste forkert cron-autorisation og gennemførte et 207-holds løb over to kald: 200 hold på 35,64 sekunder, de sidste syv på 3,61 sekunder. Der blev oprettet præcis to tilmeldinger og to kvitteringer; gentagelse gav ingen dubletter. Alle midlertidige konti, hold, løb og køposter er fjernet. Se [databasenotatet](INTEGRATION-P02-2026-10-04.md) for målinger og manuel genkørsel. **Punkt 02's isolerede verifikation er færdig, men autopilot er fortsat slået fra:** Målingen viser, at én daglig cron-kørsel ikke garanterer færdiggørelse før tilmeldingsfristen. Automatisk fortsættelse, overvågning og produktionsgrænser skal løses før aktivering i punkt 16.

**Divisions- og fasekrav til den spilbare løbssløjfe:** Først kommer tilmelding. Ved tilmeldingsfristen fryses deltagerne og deres pointgrundlag, hvorefter holdene fordeles og modstanderne vises. En særskilt, senere taktikfrist giver manageren tid til at justere ryttere, kaptajn og ordrer på baggrund af feltet; modstandernes private taktik vises ikke. Først derefter afvikles løbet. 45 tilmeldte hold skal give tre selvstændige divisioner med højst 20 hold og egne replays/resultater. Den eksisterende spillervej bruger fortsat én fælles frist og styrkebaseret fordeling. I det isolerede udviklingsspor er særskilte frister, frossen pointbaseret fordeling, begrænset modstandervisning og endelig taktiklås nu implementeret og prøvet mod testdatabasen. Regler for nye hold, pålidelig automatisk afsløring ved tilmeldingsfristen og en fuld prøve med uafhængige managers er fortsat åbne. Se [kalendergrænsen](CALENDAR_AUTOPILOT_RANKINGS_V0_1.md) og [resultatprøven](INTEGRATION-TWO-PHASE-REAL-OUTPUT-2026-10-05.md).

**Punkt 03, isoleret verificeret 5. oktober:** 45 særskilt ejede hold med 360 midlertidige ryttere gennemførte hver især kalender, udtagelse, kaptajn og ordrer i browseren. Den lokale produktionsbuild afviklede løbet i tre divisioner på 15 hold med hvert holds eget optagede replay, resultat og historik. Tre samtidige spillerkald gav præcis én commit; gentaget afvikling gav hverken ekstra resultater eller point. Den isolerede pointmigration gav 60 sportslige pointposter, og holdranglisten svarede til ledgeren. En sen ordreændring blev afvist. Alle midlertidige data blev fjernet. [Testnotatet](INTEGRATION-P03-2026-10-04.md) beskriver prøven og dens grænser: Den var sekventiel i browseren, ikke en samtidig 45-bruger belastningstest. Tofaset tilmelding, lagret pointbaseret divisionsfordeling og en sportsligt realistisk ny motor hører fortsat til senere punkter; etapeløbspoint og produktionsverifikation er også åbne.

| ID | Opgave / konkret resultat | Timer | Afhænger af |
| --- | --- | ---: | --- |
| 01 | Saml de adskilte kalender- og motorspor i ét integreret udviklingsspor; løs konflikter, bevar gamle løb og kør fuld regression. Verdensdata integreres særskilt i punkt 21. | 12–24 | — |
| 02 | Kør den nye kalender-/autopilot-/ledger-migration og scheduler i en isoleret database; test rettigheder, samtidighed, retry, tidszoner og kapacitet uden live data. | 12–24 | 01 |
| 03 | Etabler en reproducerbar ende-til-ende test med flere rigtige testhold: oprettelse → kalender → udtagelse → ordre → afvikling → replay → resultat/point. Medtag 45 tilmeldte hold, tre separate afviklinger, egne replays/resultater og idempotent genkørsel i den nuværende model; dokumentér målinger og fejl før større tuning. Den endelige tofasede, pointbaserede spillerrejse testes efter punkt 16–17. | 8–16 | 01–02 |

## P1 — første virkelig spilbare løbsoplevelse

| ID | Opgave / konkret resultat | Timer | Afhænger af |
| --- | --- | ---: | --- |
| 04 | Forbedr individuel fart, position, læ, samarbejde, gruppeopdeling/sammenløb og finale i v2. Scenarier skal vise realistiske brud, genangreb og begrænset jagtkapacitet. | 24–48 | 03 |
| 05 | Gør holdmål, kaptajn/hjælper, vejkaptajn/leadership, egen chance og GC-top-10-beslutninger sammenhængende på tværs af grupper. | 24–48 | 04 |
| 06 | Afklar de synlige ryttereegenskabers primære virkning og defaults/migration for nye skills; ingen offentliggørelse af skjulte procentvægte. Test virkningen på forskellige ryttertyper. | 16–32 | 04 |
| 07 | Gør kilometerrute, hældning, terræn, underlag og vejrlås datadrevet og sammenhængende; profil, ordreflade og viewer skal bruge samme versionerede rute. | 20–40 | 04 |
| 08 | Byg enkelt preset + ekspertordrer ved 10-km-markører/nøglepunkter, kontingenser og let holdudtagelse i det rigtige spillerflow. Gem og lås ordrer før deadline. | 24–48 | 05–07 |
| 09 | Gem versionsmærket input, seed, vejr, beslutninger, resultater og replay sikkert; idempotent race-run, adgangskontrol, replay-viewer og journalistisk race feed. | 24–48 | 04–08 |
| 10 | Færdiggør etapeløbsafvikling: vedvarende startliste, klassificeret tid, GC, etape-/point-/bjergklassement, udgåede ryttere og energi mellem etaper. Undgå dobbelt resultatskrivning. | 32–64 | 09 |
| 11 | Balance- og spiltest i større, parrede scenarier for begge køn, forskellige ruter og taktikvalg. Justér centralt, og test med mennesker før accept. | 48–96 | 04–10 |
| 12 | Isoleret preview af det sammenhængende løb, performance-/sikkerhedstest, migration/rollback og kontrolleret produktionsindføring efter godkendelse. Den gamle motor forbliver fallback indtil da. | 20–40 | 02–11 |
| 41 | Afprøv en valgfri Three.js-scene til **rute- og løbsreplay** på én versioneret rute. Vis terræn, rute og kameraføring ud fra atlas-/rutedata og afspil de faktisk optagne gruppepositioner; behold kort, tidsforskelle, ordrer og hændelser som læsbar 2D-visning. Mål mobil ydelse, indlæsning og reduced-motion, og stop 3D-sporet hvis rutegeometri eller replay ikke kan bære en sandfærdig visning. | 24–48 | 07, 09, 25 |

## P1 — kalender, automatisk deltagelse og ranglister

| ID | Opgave / konkret resultat | Timer | Afhænger af |
| --- | --- | ---: | --- |
| 13 | Gør de fire standardtrupper robuste i spillerflowet, inklusive onboarding/redigering, kaptajn og gyldig erstatning ved fravær. | 16–32 | 02, 08 |
| 14 | Opbyg en kildekontrolleret UCI/Pelotonia-sæson med onsdag/søndag som endagsløbsdage, særskilte kønsløb og sammenhængende etapeløbsdage. Afklar navne-/ruterettigheder. | 24–48 | 07 |
| 15 | Beslut konfigurerbar prioritet for samtidige løb og rytternes tilgængelighed under overlappende etapeløb. Bevar manuel tilmelding som øverste prioritet. | 16–32 | 10, 13 |
| 16 | Verificér autopilot-queue efter målt kapacitet. Del løbsforløbet i tilmeldingsfrist → frossen pointbaseret divisionsfordeling og modstandervisning → senere taktikfrist → afvikling. Manuelle og automatiske tilmeldinger deler pulje; regler for nye hold, afbalancerede grupper, ufærdig autopilotkø, sen ordreændring og fallback skal testes, før kalenderløb afvikles live. Vis hvorfor et hold blev tilmeldt, sprunget over eller fik erstatningsryttere. | 32–64 | 02, 13, 15, 17 |
| 17 | Tilknyt endelige resultater til den ene idempotente pointledger med reversering, sæson, køn, format og tier; bevar eksisterende evnerating som særskilt begreb. | 20–40 | 02, 09–10 |
| 18 | Færdiggør rangliste-UI og holdhjem: individuelle/hold, UCI/Pelotonia, endags-/etape, sæson/all-time, kombineret hold og ægte bevægelse først når snapshots findes. | 20–40 | 17 |
| 19 | Gør kalenderkort for etapeløb operationelle: etapetrin, GC-status, udtagelse, ordrestatus og gennemsigtig pointtabel. | 32–64 | 10, 14, 17 |
| 20 | Gennemgå live release af kalenderpakken, opret først derefter gennemgåede fremtidige løb, og verificér tilmelding/afvikling med rigtige modstandere. | 12–24 | 12, 14, 16–19 |

**Status for punkt 16–17, 5. oktober:** Det isolerede udviklingsspor har særskilt tilmeldings- og taktikfrist, gemt pointbaseret divisionsafsløring, begrænset modstandervisning og låst taktik. Et testløb med 45 midlertidige hold og 360 ryttere skrev simulatorens faktiske output atomisk til testdatabasen: tre replays, 45 holdresultater, 360 rytterresultater, 60 pointposter og én commit. Gentagelse gav ikke en ny commit; alle testdata blev fjernet. En kørettelse hindrer, at allerede afslørede løb skjuler senere løb. Kalenderen viser de tre frister. Dette er fortsat ikke en spilbar prøve med 45 uafhængige managers eller en sportslig balancetest. Den daglige cron kan fortsat komme for sent til tilmeldingsfristen; regler for nye hold, fejlgenopretning, pointreversering og produktionskontrol er åbne.

## P1 - atlas og verdenskvalitet

| ID | Opgave / konkret resultat | Timer | Afhænger af |
| --- | --- | ---: | --- |
| 21 | Integrér Baseline 1.6.2 i aktivt udviklingsspor og kontrollér hele objektgrafen, placering, navne og krydsende hydrologi/veje/bane/færger. Fastlæg hvor prototypegeometri skal redesignes. | 20–40 | 01 |
| 22 | Skab én konsistent, redigerbar geografisk grundtegning fra atlasdata: kyst, højder, biomer, vand og hovedinfrastruktur. Kortbilledet må ikke blive en konkurrerende sandhedskilde. | 60–120 | 21 |
| 23 | Tegn L0–L4 som sammenhængende, gradvis zoom med læsbare labels, gode overgangsniveauer og høj visuel kvalitet på mobil/desktop. Data udenfor Aurelia skal også være meningsfulde. | 40–80 | 22 |
| 24 | Katedralen og et repræsentativt udvalg af steder får individuelt bearbejdede lokale udsnit; hver detalje skal stemme med kanoniske ID'er og nabogeografi. | 24–48 | 23 |
| 25 | Byg først en **afgrænset Three.js-prøve omkring katedralen**: terræn/bygning og en flyvning fra øoversigt til stedet på cirka 4–5 sekunder, genereret fra atlasdata. Sammenlign den med det almindelige 2D-kort på mobil og desktop; test indlæsning, billedhastighed, reduced-motion, geografisk sammenhæng og kunstnerisk kvalitet. Beslut derefter om en valgfri 3D-visning og korte rute-/stedintroer fortjener videre arbejde. Atlasdata forbliver sandheden, og det brugbare 2D-kort bevares. | 40–80 | 23–24 |
| 26 | Visuel/data-QA: gentagne renderinger skal vise samme geografi; test continuity, zoom, klik, performance, mobil og kunstnerisk gennemgang. Udgiv først efter godkendt kvalitet. | 16–32 | 22–25 |

## P2 — vedvarende klub og progression

| ID | Opgave / konkret resultat | Timer | Afhænger af |
| --- | --- | ---: | --- |
| 27 | Træning, form, fatigue, skader, alder og 90-dages spilår med én dokumenteret game-tick og forståelige valg uden overdreven mikrostyring. | 32–64 | 10–12 |
| 28 | Almindelig spiløkonomi: indtægter, løn, træningsomkostninger og budgetværn. Sportslig styrke må ikke købes med premium-valuta. | 40–80 | 27 |
| 29 | Transfersystem med kontrakter, holdhistorik, marked og transaktionssikkerhed; bevar historiske resultater og tidligere klubber. | 48–96 | 28 |
| 30 | Personale: konkrete roller, løn/kontrakter og målbare, balancerede effekter på udvikling, form og mentalitet. Samme sportslige muligheder for gratis og betalende hold. | 24–48 | 27–28 |
| 31 | Supporter: rettigheder, abonnement, kosmetisk trøje/logo, ekstra analyse/skabeloner og UI; kontroller at premium ikke giver direkte sportslig styrke. | 32–64 | 28, 30 |
| 32 | Inaktive/dormante hold: konfigurerbare faser, fortsat autopilot, arkiv uden sletning og senere rytterfrigivelse gennem transfersystemet. | 16–32 | 16, 29 |
| 33 | Fans/supporterskare som sportslig klubverden: tilslutning, aktivitet, omdømme og almindelige indtægter. Adskil dette fra det betalte Supporter-abonnement. | 32–64 | 28 |
| 34 | Sportslige fører-, point-, bjerg-, ungdoms-, verdens- og nationale mestertrøjer som systemstyrede lag oven på holdtrøjen, når de tilhørende resultater findes. | 16–32 | 10, 17 |

## P2/P3 — identitet og nye spilformer

| ID | Opgave / konkret resultat | Timer | Afhænger af |
| --- | --- | ---: | --- |
| 35 | Genoptag portrætretningen, når ejeren ønsker det: test 50–100 almindeligt udseende, tydeligt forskellige ryttere; vurder fejl/ligheder, pris, vedvarende ansigt og trøjelag. | 24–48 | — |
| 36 | Når stilen er godkendt: byg versionsmærket portrætpipeline med lagring, kø, idempotens, dubletkontrol, sikker regenerering og gradvis erstatning af reservevisning. | 40–80 | 35 |
| 37 | Obligatorisk introløb mod bots, som lærer spilleren udtagelse, simple/avancerede ordrer og gemte presets; introducér derefter standardtrupper. | 24–48 | 08–09, 13 |
| 38 | 30-minutters draft-lobby: pakke med otte midlertidige randomiserede ryttere, lobbyfrister, fair match, låsning, rute og replay. Hold det adskilt fra den permanente trups økonomi. | 48–96 | 09, 12 |
| 39 | Virkelighedsinspirerede ruter og vejrkilder med kildedato, licens-/navneafklaring, versionering og kvalitetssikret import. Brug samme route-/weather-kontrakt som motoren. | 24–48 | 07, 14 |
| 40 | Senere spilleroprettede eventlobbyer med eventuel entry fee/præmiepulje, anti-misbrug, betaling/regnskab og klare regler uden køb af sportslig styrke. | 40–80 | 28, 31, 38 |

**Samlet, groft restestimat: cirka 1.050–2.100 aktive timer** for de resterende punkter ovenfor, med P01–P03's isolerede verifikation afsluttet og den udvidede fase-/divisionsopgave indregnet. Det er en størrelsesorden, ikke en deadline; omarbejde efter spiltest, udgifter til illustrationer/tjenester og ejerens svartid kan øge forløbet. Den næste realistiske testsløjfe kræver motorens og kalenderens nødvendige P1-punkter, ikke hele denne liste. Punkter 21–26 kan udvikles sideløbende med sportsarbejdet, men konkurrerer om samme kapacitet, hvis én person udfører det.

## Beslutninger som bevidst forbliver åbne

- Præcis prioritet mellem samtidige events, etapeløbsbonusser/tidsgrænser og endelige pointværdier skal prøves og vælges; V0.1-tal er konfiguration.
- Betalt Supporter, eventvaluta, entry fees/præmiepuljer og sportslige særtrøjers præcise tildelingsregler kræver særskilt produkt-/regelbeslutning før release. Implementeringsarbejdet er særskilt estimeret i punkt 31, 34 og 40.
- En faktisk licenseret UCI-kalender, navne, rutegeometri og live vejr har eksterne kilde-/rettighedsafhængigheder. Listen antager ikke, at de allerede er tilgængelige.
- Atlasets kunstneriske slutniveau og portrætkvalitet afgøres først ved synlige prøver. Et teknisk grønt build er ikke en visuel godkendelse.

Ved hver større leverance opdateres status og restestimat her. Detaljerede historiske dokumenter slettes ikke, men denne fil er den samlede aktuelle plan.
