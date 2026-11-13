# Runde 1 — ydelse, fejl og GPU-afprøvning · 0.59

Ydelses- og fejldelen er gennemført i cloud-browserens CPU Compatibility-visning. GPU-delen er stadig åben: browseren opretter ikke en WebGL2-viewer her. Det er ikke en GPU-godkendelse, og det gør ikke hele vieweren færdig.

## Ændringer

- En pauset scene genberegner ikke længere samtlige ryttere og tegner landskabet igen, når kameraet er faldet til ro. Kamera, mål, zoom, lys, viewport, nye assets, nyt feed og ændret fælles tid kan vække renderingen. Det fælles ur ændres ikke af optimeringen.
- CPU-terrænet kontrollerer nu, om en celle er synlig, før de klippede flader bygges. Geometrien bruger de samme kildehøjder og den eksisterende vandklipning.
- Terrænets geometri- og centercaches har grænser på henholdsvis 16.384 og 16.384 poster. Cachedata ryddes ved feed-/terræn-/vandskift og nedlukning.
- getDiagnostics() er tilføjet React-ref-API'et og browserbroen. Det giver render-/skip-tællere, kamera-/fejlstatus, GPU-ressourcetællere når WebGL findes, CPU-cachetal og CPU frame-tid fordelt på sampling, rig og scene/tegneindsendelse. Målevinduet er begrænset til 240 frames og otte fejl.
- Fejl i værtsapplikationens stats-/fejlcallbacks isoleres fra renderløkken og løbets ur.
- Shaderfejl, context loss og runtime-renderfejl rapporteres gennem onError. Den tunge rendering i en fejlet løkke stoppes i stedet for at gentage den samme fejl på hvert frame. Et nyt feed kan genoprette en sådan løkke; WebGL context restoration vækker også renderingen. Context loss/restoration er implementeret, men ikke GPU-afprøvet her.
- Enhedstesten kører nu 30, 150 og 150 ryttere, seek og reverse seek, pause uden ekstra tegning, kamera-/lys-vækning, afspilning og nedlukning. Med WebGL udfører den også Three.js shaderkompilering og registrerer GPU-ressourcer. Rapporten godkender aldrig automatisk hardware eller grafik.

## Faktiske browserresultater

Alle tre forløb bestod med uændret kildefeed, bevaret lokalt kameravalg og korrekt fælles tid. Hvert pauset målevindue havde **0 nye scenetegninger**, mens løkken fortsat registrerede idle-ticks. Alle rapporterede CPU-cachetal var nul efter dispose; ingen canvas blev efterladt.

| Ryttere | Renderer | Ekstra tegninger i pause | CPU frame-median | Aktiv afspilning i denne prøve |
|---|---|---:|---:|---:|
| 30 | Compatibility | 0 | 327,6 ms | ca. 1,0 FPS |
| 150 | Compatibility | 0 | 432,6 ms | ca. 1,0 FPS |
| 150, gentaget | Compatibility | 0 | 402,8 ms | ca. 1,0 FPS |

Slutprøven bruger også det brede oversigtskamera. Tallene omfatter de afprøvede kameraskift og kolde/varme caches. De er små stikprøver fra cloud-browseren, ikke en sammenlignelig målmaskine-benchmark eller GPU-tider. Aktiv afspilning er fortsat langsom i denne CPU-visning. Der påstås ingen generel FPS-forbedring. Den konkrete pauseoptimering og cachegrænserne er verificeret.

Den fulde slutrapport er docs/validation/device-059-report.json. Den første profilering før terrænculling er bevaret som device-059-before-culling.json. GPU-ressourcefelter er null i disse CPU-forløb og skal ikke læses som nul GPU-forbrug.

## Kontroller og næste GPU-port

185 automatiske tests består, inklusive invalidation, pauseret bypass, bounded diagnostics, synlighedscentre uden fladeopbygning, cachegrænser og identisk genopbygning af udsmidte celler. Browserens finale består også. Den installerede 0.59-pakke består separat strict TypeScript/Next.js-build, servervalidering og browserprøven med to 150-rytterviewere og den nye diagnostik-API. Detaljer er i VALIDATION.md.

Åbn device-acceptance.html på en WebGL2-kompatibel målmaskine, behold fanen synlig, kør testen og download JSON-rapporten. Gennemgå derefter lys, skygger, trøjer, dæk/vejkontakt, bevægelser, resource counters og den ønskede frame-rate. En sådan hardwareafprøvning mangler fortsat.

Viewer contract v1 er uændret. Motor, database og atlas er ikke ændret eller tilsluttet.
