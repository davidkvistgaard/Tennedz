# Atlasprototype: arkitektur og rumlige valg

## Beslutning

Atlas bruger SVG i Next.js og de eksisterende `lib/world`-objekter. Ingen ny korttjeneste, nøgle eller afhængighed. Et kontinuerligt kamera i lokale kilometer bestemmer synlige repræsentationer. UI'et bruger typer, ID'er, relationer og datafelter, ikke navne som logik. `atlas-data.mjs` udvider World 1.0 til et eksplicit prototype-datasæt 1.1 gennem samme schema og validator. Originale World 1.0-data bevares som kilde og regressionstest.

L1 er landet; ved kamerabredde højst 70 km vises L2, højst 25 km L3 og højst 2 km L4. Kameraet har en fast intern 4:3 visningsflade med bevaret aspect ratio. Pan, zoomknapper, hjul, pinch og tastatur bruger samme kamera. Labels forbliver samme skærmstørrelse og prioriteres med kollisionskontrol. Alle 192 makroceller kan vælges fra en indeksvælger; der tegnes ikke flisegrænser over landskabet.

## Sandhed og prototype

Kun det eksisterende klimagrid havde konkrete koordinater. Nye kystlinjer, flodforløb, byaftryk, distrikter og bygninger er designforslag, ikke en præcis aflæsning af referenceillustrationen. Objekternes `geometryStatus: prototype` og datasættets issue beskriver dette. Regionernes klimaklassifikationer og stabile ID'er bevares. Et klimafelt er ikke en opmålt kystlinje; kysten kan krydse felter. Det tegnede landareal bruges ikke til at omberegne den kanoniske befolkning eller de cirka 115.000 km².

Aurelia placeres i I10/J10 omkring (270, 286) km ved et estuarie, som åbner mod syd. Den sydlige kyst får en dyb bugt, så byen ikke flyttes til referencebilledets modstridende gridposition. 14 distrikter placeres på hver side af floden og langs kysten; Old Aurelia ligger vest for floden med højere land nord/vest. Distriktsaftryk er skematiske planlægningsområder, ikke matrikelgrænser. Great Cathedral forbindes nu til Old Aurelia med parentId. AUR-LMK-012 forbliver reserveret.

Katedralens dimensioner bruges som lokale kilometer: bygning 0,188 × 0,092 km, plads 0,250 × 0,180 km, precinct 0,7 × 0,5 km (35 ha). Nye underobjekter til bygning, plads, haver og kulturbygninger er konceptgeometri uden opdigtet historie. Relativ højde på cirka 45 m over floden registreres som egenskab. Young/Prime/Veteran og portrætgenerering berøres ikke.

Jordkonteksten er en tydeligt skematisk illustration af South Pacific; der vælges ikke falske WGS84-koordinater. `earthAnchor` forbliver null. Et fysisk ankervalgs klimatiske og geografiske konsekvenser kræver særskilt undersøgelse, når rigtig jordkort-integration bliver nødvendig.

## Begrænsninger

Dette er et navigerbart vertikalt prototypeudsnit, ikke et færdigtegnet land. Uden for Aurelia er indhold hovedsageligt L1/L2. Ingen vejrsimulation, cykelruter, nye befolkningsfordelinger, databaseændringer eller betalte tjenester. Transport og bygninger har konceptstatus. SVG er valgt til den lille datamængde; landsdækkende gade-/bygningsdata vil senere kræve streaming og sandsynligvis vektorfliser/WebGL. Samme ID'er og repræsentationsmetadata kan beholdes.
