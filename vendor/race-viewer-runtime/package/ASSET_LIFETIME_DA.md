# Eksterne assets · levetid og fejl

## 0.66 · trøje- og overfladebilleder

Billedforespørgsler har nu en logisk deadline på 30 sekunder. Readiness afsluttes med en assetfejl, og fallback-billedet bevares. En sen eller duplikeret callback kan ikke ændre en afsluttet forespørgsel. Disposal afslutter ventende readiness og rydder timere. Deadline afbryder ikke nødvendigvis browserens underliggende netværksforespørgsel. Tests benytter kontrollerede loadere og korte deadlines; dette er ikke en måling af CDN-ydeevne. Modeller og vegetation har på dette checkpoint endnu deres tidligere indlæsningsadfærd.

## 0.67 · statiske glTF-modeller

Modelindlæsning har også en 30-sekunders logisk deadline. Disposal afslutter ventende readiness med det samme. Sene modeller kommer ikke ind i en ny scene, og deres egne ressourcer ryddes. Samme sceneleverance håndteres kun én gang. Synkrone loaderfejl bliver til assetfejl frem for ubehandlede promise-afvisninger. Fejl under statisk konvertering rydder allerede klonede geometrier og efterlader ingen delvist tilføjede instanser. Kildeplaceringer og skalaer bevares.

## 0.68 · vegetationsbilleder

Vegetationskort har nu samme logiske 30-sekunders grænse. Fejl eller timeout afslutter readiness og holder kortet skjult, så et fejlet billede ikke bliver et opakt rektangel. Geometri og materiale er initialiseret, før loaderen kaldes, så synkrone callbacks kan håndteres. Fejl under loaderstart afvises som assetfejl uden at vælte scenen. Disposal afslutter ventende jobs og frigiver instansressourcer.

## 0.69 · løbende opdatering af pauserede billeder

Hver asset-ejer har nu en lokal revisionsværdi. Kameraets billige render-nøgle læser disse værdier, så et enkelt færdigt billede, en model eller et vegetationskort vækker en pauseret visning, selv når andre assets stadig venter. Dette ændrer ikke løbstid eller kildepositioner og kræver ingen serialisering af frame-arrays i render-løkken.

### 0.70 — dekodning og delte URL’er

Billeder uden positive, endelige intrinsiske dimensioner beholder fallback. Fejl på en delt URL rapporteres for alle berørte asset-id’er, mens netværksanmodningen stadig deduplikeres.
