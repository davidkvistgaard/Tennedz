# Optaget løb i den nye viewer

## Datavejen

`buildRace` og den eksisterende guided motor bestemmer stadig alle sportslige
udfald. `recovery_finish_race` gemmer motorens replay v1 uændret bortset fra et
separat `appearance` v1-snapshot med spillets valgte holddragter. Snapshotten
kommer fra `club_identities`; uden et valgt design bruges spillets egen
deterministiske standarddragt. Gamle optagelser får ikke efterkonstruerede
trøjer og vises neutralt.

`guided-replay-to-pelotonia.viewer.v1-1` konverterer den gemte optagelse til
`pelotonia.viewer.v1`. Den kopierer hele rytterlisten, alle checkpoints,
grupper, gruppetidsgab i sekunder, engelske registrerede hændelser,
ruteprofil og officielle måltider/placeringer. Den accepterer 1–160 ryttere i
én kønskategori og afviser ufuldstændige optagelser. Viewerens resultater
publiceres ved den gemte måltid. En fælles serverforankret visningscyklus
spiller løbet ved 60×, holder målet i 15 sekunder og starter så forfra.
Kameravalg er lokalt.

## Kendte datagrænser

Replay v1 har et fælles `km` for hvert checkpoint og gruppetidsgab, men ikke
præcise samtidige meter mellem grupper eller indbyrdes hjulplacering, bane og
rækkefølge i gruppen. Alle ryttere forankres ved det registrerede kilometer;
den nuværende guided motors replay danner desuden sine gruppetidsgab ud fra
simulerede faser og de endelige resultater. Det er motorens gemte model, ikke
en måling af fysisk betalt kontakt ved hvert kilometer. Den eksperimentelle
V94-motor er fortsat separat.
`illustrative-group-layout-1` spreder kun cyklerne visuelt inden for gruppen
og er mærket illustrativt i brugerfladen. Gruppens sekunder bliver aldrig
omregnet til opdigtede meter. Ruten er en skematisk distanceakse. Træer,
terræn og tilskuere er `guided-illustrative-scenery-1`, ikke kanonisk geografi.
Vieweren beregner ikke angreb, kontakt, gruppering eller resultat.

API'et udleverer i øjeblikket den komplette replay til en autoriseret
divisionsdeltager, også før visningens måltid. Brugerfladen skjuler fremtidig
kommentering, rapport og resultat indtil mål, men en teknisk bruger kan læse
den fremtidige optagelse i netværkssvaret. Serverstyret, tidsopdelt levering
kræves, hvis udfaldet også skal være hemmeligt i browserens netværksdata.

## Kontrolleret lokalt

- Aktuelle motorgenererede optagelser: 32, 144 og 160 mænd og kvinder;
  fuld frame- og resultatdækning uden ændring af source replay.
- Edge/WebGL2 med 160 mænd og 160 kvinder: alle ryttere synlige, lokal
  rytterfølgning, fælles tidslinje og 160 officielle resultatlinjer ved mål.
  Intel UHD Graphics via ANGLE målte 30–31 fps i en kort lokal kørsel,
  cirka 2,4 mio. trekanter og 88 draw calls. Det er ikke godkendelse af
  andre GPU'er eller mobilhardware.
- Fuldt managerforløb på 390 og 1440 px fra oprettelse og taktik til replay
  og resultater. Ét afbrudt træ-asset gav en synlig fejlbesked, mens canvas
  og løbet fortsatte.

Produktionsfrigivelse kræver stadig preview og autentificeret kontrol af den
præcise commit, API, side, JavaScript og runtime samt en testet rollback.
