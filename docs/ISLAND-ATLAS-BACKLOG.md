# Pelotonia Island Atlas — featurepakke

Status: **planlagt; datagrundlag eksisterer, interaktivt atlas er ikke implementeret**. Optaget 24. september 2026 på ejerens anmodning. Den [fulde specifikation](ISLAND-ATLAS-SPECIFICATION.md) er bevaret som kilde; denne fil omsætter den til leverancer. Overordnet prioritering: [PRODUCT-ROADMAP.md](PRODUCT-ROADMAP.md).

## Formål og afgrænsning

Pelotonia er et fiktivt suverænt øland på Jorden i det sydlige Stillehav. Spillet beholder virkelige lande, nationaliteter og virkelighedsinspirerede cykelløb. Atlas bygger landet som geografi, bosættelser, natur og infrastruktur. Ingen cykelruter, etaper, kategoriserede stigninger, cykelseværdigheder eller cykelspecifik kortlogik i denne pakke.

Udvid eksisterende versionerede `lib/world`-data. Stabile ID'er er identitet, navne er redigerbare. Strukturerede data er kanon; det illustrerede kort er visuel reference. Ingen konkurrerende datamodel eller verdensfakta indlejret i UI-komponenter. Ukendt geografi/lore forbliver ukendt eller tydeligt konceptmarkeret. AUR-LMK-012 forbliver reserveret.

## Placering ved siden af recovery

- **P0 — forrang og releasekrav:** autentifikation, sikkerhed, dataintegritet og kerneforløbet for endagsløb. Bevar eksisterende hold, ryttere, historik og race engine. Ingen destruktive produktionsændringer.
- **Nærmeste vedligeholdelse:** afklar og opdater de tre eksisterende browsertests, som forventer gammel kalendertekst og gamle onboarding-redirects. Seneste kontrol var 31 grønne unit tests, lint/build grønne, browser 5 grønne/3 fejlede. Dette er en separat stabilitetsopgave, ikke en atlasregression.
- **Sideløbende atlasarbejde:** ATLAS-01 kan begynde nu på recovery-grenen, uden at vente på alle øvrige produktfunktioner. Isolér prototypen fra løbsberegning, auth-ændringer og produktionsdata. Stabilitetsblokeringer har forrang.
- **Visuel koordinering:** redesign af forside/hovedside og den portrætbaserede identitet bevares. Atlas skal understøtte samme samlede produkt, med lys hvid/grå/grøn ramme og et stemningsfuldt topografisk indhold.
- Ingen kalenderdato eller automatisk baggrundsopgave er oprettet. Rækkefølgen nedenfor er udviklingsprioritet, ikke et løfte om fast leveringstid.

## Eksisterende grundlag

Gennemgået: Next.js App Router, eksisterende TeamShell, `lib/world/{data-v1,grid,validate,index}.mjs`, world-tests og [verdensdokumentationen](PELOTONIA-WORLD.md).

- 192 A1–P12-celler, 13 fysiske regioner og 266 samlede objekter.
- Northern Plateau / `REG-NORTHERN-PLATEAU` er **færdig**, herunder de 11 P-celler, klima/terræn, validering, dokumentation og tests. Commit `404990dd47256c763933b4a951d0b78cbc2bed61`.
- Ni storbyer, Aurelias 14 distrikter, 12 landmark-pladser, naturformationer og infrastrukturkoncepter findes allerede.
- Stabile referencer, semantiske L0–L4-synlighedsniveauer og lokale km-geometrier findes. Kun gridceller har konkret geometri; nuværende synlighedshelper er ikke en kortmotor eller et færdigt system til visning af detaljer.
- Den eksisterende nationale befolkning er cirka 12,1 mio.; Northern Plateaus numeriske befolkning er ukendt. Der må ikke opfindes en ny fordeling for at få kortet til at se fyldt ud.

## Delopgaver og leverancer

| ID | Prioritet / afhængighed | Leverance og acceptkrav |
| --- | --- | --- |
| ATLAS-00 | Færdig | Northern Plateau er etableret under det krævede ID. Genbrug resultatet. |
| ATLAS-01 | Først; kan starte sideløbende | Kort arkitekturbeslutning efter gennemgang af data og app: rendering, kamerakoordinater, lag, input, dataindlæsning og performance. Vælg og begrund eventuelle open-source-afhængigheder; ingen betalte korttjenester eller unødvendig platform. Fastlæg eksplicit sammenhæng mellem kamerazoom og semantisk detaljeniveau. |
| ATLAS-02 | Efter 01 | Udvid kanon med dokumenteret, sammenhængende prototypegeometri og generiske visningsrepræsentationer. Bevar point/line/polygon/multi-geometri og tværgående cellereferencer. Afklar jordplacering, hvis implementeringen kræver den; vælg og dokumentér en fysisk rimelig placering i det sydlige Stillehav, og adskil lokale koordinater fra ægte WGS84 via eksplicit transformation. |
| ATLAS-03 | Efter 01–02 | Interaktiv L0/L1/L2-ramme: jordkontekst, hele ølandet, pan/zoom, valg af alle 192 makroområder, nationale naturtræk/byer/infrastruktur, infopanel, tilbage/breadcrumb og mobil. Nye detaljer vises ved zoom; labels må ikke blot vokse. Grid må ikke blive synlige Civilization-fliser. |
| ATLAS-04 | Efter 02; udvikles sammen med 03 | Aurelia som sammenhængende L2/L3-demonstration: byaftryk, flod/estuarie, bugt, havn, lufthavn, bakker og transportforbindelser; 14 eksisterende distrikts-ID'er og eksisterende landmarks. Naturlig geografi styrer distrikter, ikke 14 vilkårlige polygoner. |
| ATLAS-05 | Efter 04 | Old Aurelia (`AUR-01`) → Great Cathedral (`AUR-LMK-001`): ikon på byniveau, aftryk/precinct på lokalt niveau, individuelle bygninger, plads og haver på siteniveau. Dokumentér ny containment og nye underobjekt-ID'er; ingen omfattende historisk lore. |
| ATLAS-06 | Løbende fra 03; før milepæl | Visuel kvalitet, terræn, havdybde, skov/is/tørt land, vandløb, afdæmpede labels og signaturforklaring. Sammenhæng med spillets lyse identitet; attraktivt spilatlas, ikke GIS-administration. Mobil/touch og læsbarhed verificeres i browser. |
| ATLAS-07 | Før milepæl/release | Automatiske datatests, navigationstest, lint og produktionsbuild. Demonstrér en ekstra prøvefeature via data uden særskilt featurekode. Rapportér arkitektur, filer, afhængigheder, databeslutninger, tests, fungerende dele, placeholders og screenshots. Ingen produktionsrelease før recoverykrav er opfyldt. |

ATLAS-02/04 må træffe nødvendige tekniske og rumlige prototypevalg, men skal dokumentere dem som sådanne. Der opfindes ikke hundredvis af bynavne, gadenavne, institutioner, politikere eller historiske fortællinger.

## Datadrevet zoom og fremtidig udvidelse

| Niveau | Indhold og adfærd |
| --- | --- |
| L0 | Jorden og Pelotonias kontekst i South Pacific. Geografisk placering må ikke være fiktive billedpixels mærket WGS84. |
| L1 | Hele hovedøen, øgrupper, 13 regioner, Great Range, Aurelia Icefield, store toppe/floder/søer, Great Caldera, Great Escarpment, Red Canyon, hovedbyer og nationalt betydningsfuld infrastruktur. Læsbarhed styrer labelmængde. |
| L2 | Vilkårligt makroområde A1–P12: flere naturdetaljer, mindre bosættelser, skove, strande, vådområder, sekundære floder, veje/bane, broer/tunneler og byaftryk, hvor data er designet. |
| L3 | Bydele, kvarterer, betydningsfulde gader, parker, stationer, havne, broer, bygninger, landsbyer og lokalgeografi. Aurelia er første fulde eksempel. |
| L4 | Individuelle sites: katedral, stadion, station, dæmning, bro, observatorium, museum, citadel, park eller naturformation. Underobjekter skal kunne tilføjes senere. |

Naturlige klik på synlige features skal føre til relevant næste udsnit/detalje. Spilleren skal ikke vælge L1/L2/L3/L4 manuelt. Kontinuerligt kamera og semantisk informationsniveau er forskellige begreber. Undersøg datarepræsentationer pr. skala, generiske type-styles og labelprioritet/kollisionshåndtering; renderer må ikke bygge på navne eller specialkode for hver landmark.

Pelotonia Link (`INF-001`, stadig koncept) er udvidelsesprøven: mulig 35–45 km forbindelse med samlet L1-visning, bro/tunnelsektioner på L2, knudepunkter/kunstige øer/service på L3 og enkelte konstruktioner på L4. Samme mekanisme skal kunne anvendes til reservoirer, kanaler, tunneler, nye byer, havne/lufthavne, observatorier, nationalparker, geologi og store bygninger. Eksemplet godkender ikke automatisk anlægget som fast kanon.

## Aurelia og katedralens første vertikale udsnit

Aurelia (`CITY-001`) bevarer cirka 2,45 mio. metropolindbyggere, primært I10/J10 og placering ved sydcentralkysten. Design et stort flodmundingsområde, naturlig bugt, bakker nord/vest, hovedhavn, international lufthavn og nationale transportforbindelser. Forlig tekst, grid og prototypegeometri eksplicit; ret ikke lydløst modstridende referencekort.

Bevar AUR-01 til AUR-14 og samtlige eksisterende arbejdsnavne. AUR-LMK-002 til AUR-LMK-011 bevares; AUR-LMK-012 forbliver tom/reserveret. Old Aurelia og katedralen er første detaljerede udsnit, ikke et krav om landsdækkende L4-indhold.

Katedralens arbejdsdimensioner: cirka 188 × 92 m; centralspir 171 m; vesttårne 143 m; indvendig skibshøjde 48 m; plads 250 × 180 m; kapacitet over 15.000; precinct cirka 35 ha. Den nye specifikation tilføjer cirka 45 m over floden, haver, plads og tilknyttede kultur-/religionsbygninger. Dette tilføjes som versionerede data under implementation, ikke som UI-konstanter eller opdigtet historie.

## Klima, bosættelse og visuel retning

Bevar stormfuldt nordvest, ekstremt våd Emerald Coast, regnskov, tempererede Central Plains, alpine/glacierede Great Range, Aurelia Icefield, vulkanisme/geotermi, Northern Plateau, Eastern Steppe, varme/tørre Redlands, sydlige maritime lavlande, fjorde og sydøstlige øer. Northern Plateau har brede dale og rygge, ikke alpint terræn.

Nye arbejdsrammer i pakken: vestlige bjergområder kan få cirka 5.000–7.000 mm nedbør årligt; højeste bjerge kan komme under −20 °C om vinteren; Redlands kan overstige 43 °C og undtagelsesvis nå 45–48 °C. Dokumentér sammenhæng med beliggenhed og højder. Dette er verdensdata, ikke implementering af vejrsimulation.

Bevar de ni eksisterende hovedbyer og befolkningstal. Cirka 20 regionale byer og mange mindre bosættelser er fremtidigt indhold; generér dem ikke alle nu. Bosættelse følger geografi og egnethed. Tomme områder er tilsigtede.

## Accept af første meningsfulde leverance

1. Åbn atlas og se hele landet med nationalt betydningsfulde steder.
2. Panorér og zoom naturligt, også på mobil.
3. Vælg et vilkårligt makroområde og få lokal information; uudviklede områder må tydeligt stoppe ved L1/L2.
4. Gå ind i Aurelia og se geografisk sammenhængende distrikter og væsentlige landmarks.
5. Gå ind i Old Aurelia og vælg Great Cathedral.
6. Se katedral, precinct, plads, haver og relevante underbygninger med reelle nye detaljer ved zoom.
7. Navigér tilbage ud gennem hierarkiet med bevaret orientering og et relevant informationspanel.
8. Tilføj en fremtidig feature primært gennem data og generiske lag, uden at omskrive atlas-UI.
9. Vis dokumenteret visuel kvalitet; en enkelt opskaleret illustration opfylder ikke kravet.

Tests skal dække brudte parentreferencer, forældreløse distrikter/landmarks, dublet-ID'er, ugyldig geometri, zoomintervaller, gridreferencer og region/celle-konsistens. Udvid den eksisterende validator, ikke en parallel. Test navigation, label-/detaljeskift, input på mobil og at navneændringer ikke bryder links. Kør samlet relevant testsuite, lint og produktionsbuild; beskriv begrænsninger ærligt.

## Afslutningsrapport ved implementation

Rapportér valgt arkitektur, nye filer/komponenter, begrundede afhængigheder, ændringer til verdensdata, test-/buildresultater, fuldt fungerende funktioner, placeholders, screenshots hvor muligt og alle selvvalgte verdensdesignbeslutninger. Forklar enhver nødvendig ændring af et eksisterende koncept; omdøb eller genfortolk ikke tavst.
