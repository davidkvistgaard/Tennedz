# Ti grafikversioner · 0.88–0.97

Afgrænset grafikrunde før arbejdet med racedata. Alle forbedringer respekterer producentens koordinater, højder, holdidentitet, placeringer, ordrer og ur. Kun vieweren ændres.

| Version | Implementeret forbedring |
|---|---|
| 0.88 | Samlet vejrbestemt atmosfære, himmel, lys og dis i CPU/GPU. |
| 0.89 | Skalerede pavésten, tydeligere grus/jord, mørkere asfalt og slidt kantmaling. |
| 0.90 | Krumme enggræsser, frøstande og små blomster i allerede leverede græsplaceringer. |
| 0.91 | Mindre ensfarvet terræn, kalkfarvede klipper, sprækker og overgang mellem eng og blotlagt sten. |
| 0.92 | Tilskuere med varierede bukser/shorts, hår, kasketter, solbriller, rygsække og tøjdetaljer. |
| 0.93 | Ekstra flaske og holder, cykelcomputer, kabler og hjelmremme i begge renderere; neutral tekstilstruktur på GPU-trøjer. |
| 0.94 | Små våde vejreflekser og hjulsprøjt styret af kildens vejr, fart og tid; samme pause/rewind. |
| 0.95 | Målportal med synligt gitterværk, timinglys og fotofinishhoveder; reflekskapper på barrierer og billige kontaktskygger til tilskuere. |
| 0.96 | Vindbevægelse i trækroner med faste rødder og uændret højde/geografi; absolut tid i CPU og GPU. |
| 0.97 | Afstandsbestemt filtrering af vejteksturer, så især pavéer og grus flimrer mindre i CPU-visningen; niveauopdelt CPU-tegning af trækroner; samlet kontrol og integrationspakke. |

## Slutkontrol

- Den samlede slutversion er **0.97.0**. De ti trin er ti separate kildekodeversioner, ikke ti kopier af samme build.
- **277 automatiske test består**. Samme kildeframes, ordrer, rytterkategorier, målresultater og serverur bruges som før grafikarbejdet.
- En separat Next.js-produktionsbuild med den installerbare pakke og strenge TypeScript-kontroller består. De installerede renderer-/databundles er identiske med pakkens bundles.
- Browserkontrol: 30 og 150 mænd/kvinder; seks vejr-/underlags-/styrtscenarier for begge kategorier med 150 ryttere; tre 150-rytterfinaler. Pause, tilbagespoling, vinderreaktioner, kildeuafhængigt kamera og uændrede inddata består. Rapporter og faktiske screenshots findes i `docs/proof97`.
- Browsermiljøet bruger **CPU Compatibility**. Det er funktionel/visuel kontrol, ikke GPU-godkendelse. CPU-visningen er stadig langsom i de tætte scener; rapportens få tidsmålinger inkluderer indlæsning, opvarmning og kamerabevægelse og er ikke et stabilt benchmark. WebGL-lys, shaderkompilering og GPU-ydelse skal kontrolleres på spillets målenheder.
- Ingen produktionsmotor, database eller atlas er ændret. Ingen racedata er tilføjet fra spillet. Næste trin er en første konkret raceeksport gennem den eksisterende versionerede adapter.

## Kodeversioner

- `c4bfa54` — v0.88.0: Shared weather-aware atmosphere and lighting
- `67d9766` — v0.89.0: World-scaled road materials and worn edge paint
- `986f2e9` — v0.90.0: Layered meadow blades seed heads and clover at supplied landmarks
- `7141299` — v0.91.0: Slope-aware meadow and mineral transitions with rock fractures
- `f592c73` — v0.92.0: Recognizable varied spectator clothing and accessories
- `4437bc1` — v0.93.0: Shared bicycle equipment helmet straps and fabric relief
- `f3f9bf3` — v0.94.0: Absolute-time wet road glints and wheel spray
- `f04d31d` — v0.95.0: Detailed event gantry timing lights and spectator contact shadows
- `ddec61e` — v0.96.0: Wind-driven canopy motion with fixed roots in CPU and GPU
- `00157d8` — v0.97.0: Distance-filtered road materials and final graphics acceptance
