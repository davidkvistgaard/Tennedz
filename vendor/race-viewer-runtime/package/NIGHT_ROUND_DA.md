# Pelotonia — udviklingsrunde 0.65–0.84

20 nye kildeversioner efter 0.64. Versionerne er afgrænsede tekniske checkpoints; de er ikke 20 separate udgivelser på preview-adressen. Genoprettelsen af 0.64 tæller ikke med. Der er ikke arbejdet i spillets repository, motor, database eller atlas.

| Version | Konkret ændring |
| --- | --- |
| 0.65 | Afviser defekte import-records før sceneskift; beskytter trøje-artwork; reproducerbar, separat Next.js-forbruger. |
| 0.66 | Billeder får en logisk indlæsningsfrist; sene og dobbelte callbacks kan ikke overskrive afsluttet status. |
| 0.67 | Modeller får en indlæsningsfrist og oprydning af sene eller afviste glTF-data. |
| 0.68 | Vegetation håndterer indlæsningsfrist og synkrone loaders uden initialiseringsfejl. |
| 0.69 | Pauseret visning opdateres ved hvert enkelt asset-resultat, også mens andre assets stadig afventer. |
| 0.70 | Defekte billeddimensioner beholder fallback; delte URL-fejl identificerer alle berørte assets. |
| 0.71 | Fejl i værtens selection- og error-callbacks må ikke bryde input eller React-effekter. |
| 0.72 | Rytterklik følger lokalt som standard; et eksplicit kameramål forbliver styret af værten. |
| 0.73 | Importerede modellers positioner, transformationer og trekantindekser kontrolleres før rendering. |
| 0.74 | Vegetation kræver faktisk dekodede billeder med gyldige intrinsiske dimensioner. |
| 0.75 | Separat kompatibilitetscanvas overtager ved fejl under første WebGL-initialisering. |
| 0.76 | Resize opdaterer pixeltæthed og HUD-reserveret kameraprojektion; vindueslisteners fjernes ved lukning. |
| 0.77 | Offentlig runtime-version og diagnostik afslører, hvilken pakke der faktisk kører. |
| 0.78 | Eksportindlæsning annullerer og frigiver svarstrømme ved afbrydelse, frist eller størrelsesfejl. |
| 0.79 | Defekte normaler, UV’er, farver og tangenter afvises før shader- eller CPU-projektion. |
| 0.80 | Ubrugte materialer og teksturer fra skjulte modeldele frigives; delte teksturer bevares korrekt. |
| 0.81 | Skelet- og instansressourcer fra ikke-understøttede modeller frigives ved afvisning. |
| 0.82 | Tab af pointer-capture efter kameratræk må ikke udløse et utilsigtet ryttervalg. |
| 0.83 | Gentagen lukning er sikker; sene resize-, selection- og stats-callbacks ignoreres. |
| 0.84 | Installeret Next.js-pakke får en egentlig canvas-klikprøve af kontrolleret og lokalt kameravalg. |

## Integration

Installer den medfølgende `pelotonia-race-viewer-0.84.0.tgz`. Brug klientkomponenten `RaceViewer` og den separate server-sikre indgang `@pelotonia/race-viewer/data`. Eksemplerne i `examples/next` viser session, HTTP-indlæsning, fælles klokke, fejlbevaring og genforsøg. `npm run release:checked` bygger pakken, installerer den i en separat Next.js-app, kontrollerer TypeScript og sammenligner den installerede runtime med pakkens bytes.

Spillet leverer feed, fælles klokke, positioner, ordrer, handlinger og officielle resultater. Vieweren beregner præsentation mellem kildeframes. Den afgør ikke angreb, sprinttog eller vindere. Udelad `target` for lokalt klik-til-følg, eller lever `target` og håndter `onSelect` i spillet. `cameraSafeArea` reserverer plads til spillets eget HUD uden at ændre geografien.

Billed-, vegetation- og modelfrister er logiske frister: en bagvedliggende loader behøver ikke fysisk stoppe netværket. HTTP-eksportindlæsningen annullerer sin svarstrøm, når transporten understøtter det. Animerede glTF-landmarks og indlejret instancing kræver fortsat en eksplicit adapter.

## Afgrænsning

Der findes endnu ikke et produktionsfeed fra spillet. Det faktiske producentformat, autenticering og serverens broadcast-kanal skal forbindes og afprøves sammen med spillet senere. Browserprøverne i denne runde bruger syntetiske data og kompatibilitetsrendereren. De godkender ikke WebGL-ydelse, GPU-kontekstgendannelse på rigtige enheder eller det endelige grafiske ambitionsniveau. Atlasset er ikke udviklet eller ændret.

## Verifikation

243 automatiserede tests bestået. Separat Next.js-build og TypeScript-kontrol bestået med byte-identisk installeret runtime. Fire browserprøver bestået i kompatibilitetsrendereren: to samtidige 150-ryttervisninger med fælles klokke og selvstændigt kamera; faktisk canvas-picking med kontrolleret og lokalt valg; HUD/panel-framing med 150 ryttere; samt afvisning af fire defekte importer uden at miste den viste scene. Kameraet forblev hævet 33,9°.

Klikprøvens oprindelige punkt lå tæt ved silhuetkanten og missede i den ene visning; prøven bruger nu et punkt inde på trøjen. Kørbare prøver: `/session-integration/index.html`, `/session-integration/selection-check.html`, `/import-retention-test.html` og `/hud-safe-test.html`.
