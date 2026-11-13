# Import og reproducerbar integration · 0.65

Fejlformede poster i eksterne datasamlinger afvises nu med en konkret importfejl frem for en intern property-access-fejl. Det gælder blandt andet hold, ryttere, frames, positioner, scenemodeller, events og barrierer. Ukendte eksplicitte holdmønstre og forkert sponsortype afvises. Gyldige feedobjekter og kildepositioner bevares.

Hvis browserens dekodning af inline trøjegrafik kaster en fejl, bliver holdets basepalette bevaret, fejlen knyttes til det pågældende kit, og de 150 ryttere kan fortsat gengives. Dette er ikke en komplet SVG-syntakskontrol: browsere kan selv vælge at ignorere visse ugyldige paths. Fejl rapporteres gennem asset-readiness.

Ugyldige kontrollerede kameramål i React rapporteres gennem onError uden at rive den levende scene ned. Gyldige, men utilgængelige mål forbliver utilgængelige; en anden rytter erstatter dem ikke.

210 tests består. Browserkontrollen afviser fire fejlbehæftede importer og bevarer samme canvas, løbstid og rytterposition; et gyldigt vektorkit vises efterfølgende med 150 ryttere. Den installerede pakke består strict Next.js-build og browserkontrol med to tilskuere, ugyldigt kameramål, layoutfjernelse, ugyldigt layout, fælles ur og lokale kameraer.

Integrationsprojektets skabelon og genopbygningsscript ligger nu i kilden. `npm run verify:next` installerer den aktuelle pakke i et isoleret genereret projekt, sammenligner runtimefilerne, typekontrollerer alle eksempler og bygger en statisk preview. `npm run release:checked` udfører den samlede kæde.

Ingen produktionsmotor, database eller atlas er tilsluttet. GPU og den samlede grafiske kvalitet er ikke godkendt.
