# Pelotonia: produktgrundlag og rækkefølge

Ejerens 50 punkter er bevaret i PRODUCT-VISION.md. Senere præciseringer har forrang:

- Herre- og kvindekonkurrencer er separate. Holdrating og seeding bruger summen af de op til 16 bedst ratede ryttere af løbets køn. Kun resultatpoint tæller, ikke skills/form/fatigue. Skadede ryttere forbliver en del af holdets rating.
- Almindelige ændringer, test og releases inden for visionen må gennemføres autonomt. Bevar produktionsdata. Destruktive ændringer, nye omkostninger og væsentlige regelændringer afklares.
- Målet omfatter etaper på samme dato og rute som virkelige løb, eksempelvis Tour de France 2027, med etaperesultater og samlet klassement. Rutedata må først importeres efter kontrol mod offentliggjorte kilder; der er endnu ikke importeret nogen TdF 2027-rute.
- Produktet skal være indbydende, smukt, hurtigt og sjovt at administrere. Den lyse hvid/grå/grønne retning, karakterfulde ryttere og meningsfuld taktik er gennemgående krav.

## Leverancer i rækkefølge

1. Ret resultatbaseret rating/seeding og kønsopdelte ranglister. Bevar historiske point og allerede afviklede løb.
2. Konto- og holdoprettelse via Supabase Auth: 8 mænd og 8 kvinder, kønsspecifikke navne, korrekte startværdier, sikker once-only oprettelse og ingen adgang til skjulte caps/potentiale.
3. Gentageligt endagsløbsforløb: events, deadline, aftalt modstanderstrategi, automatisering og restitution. Bevar de gamle produktionsløb som historiske data.
4. Fælles ruteformat til profilvisning, segmentbaseret simulation, vejrlås og taktiske instruktioner. Ruteimport knytter kilde, dato, version og kvalitet til hver rute.
5. Etapeløb: separat event/etape, vedvarende startliste, etaperesultat og akkumuleret tid, håndtering af udgåede ryttere samt samlet klassement. Etape-genforsøg må ikke ændre point eller samlet tid to gange. Bonussekunder, tidsgrænser og øvrige klassementer skal have eksplicitte regler før åbning.
6. Træning, alder og karriere kobles til et dokumenteret ur: faktisk kalenderdato til events og accelereret rytteralder på 90 dage pr. år. Skade- og restitutionsperioders tidsenhed skal være entydig.
7. Portrætter og trøjer med vedvarende ansigtsidentitet, onboarding og samlet visuel polering; derefter Supporter uden direkte køb af sportslig styrke.

## Nyt sideløbende spor: Pelotonia Island Atlas

Featurepakken er optaget i backloggen den 24. september 2026. Se [prioriterede delopgaver og acceptkrav](ISLAND-ATLAS-BACKLOG.md) og [ejerens fulde specifikation](ISLAND-ATLAS-SPECIFICATION.md).

Atlas udvider det eksisterende Pelotonia World 1.0; det skal ikke have en separat verdensmodel. Pelotonia bygges som et suverænt øland på Jorden, før cykling senere anvender verdenen. Denne pakke omfatter ikke cykelruter, etaper eller sportslig kortlogik.

Den eksisterende rækkefølge ovenfor bevares. Login, sikkerhed, dataintegritet og et fungerende endagsløbsforløb har forrang og er forudsætninger for produktionsrelease. Atlas må dog udvikles selvstændigt på recovery-grenen allerede under det fortsatte stabilitetsarbejde; det skal ikke vente på etapeløb, karriere eller Supporter. Akutte stabilitetsfejl afbryder atlasarbejde. Den aftalte forbedring af forside/hovedside bevares som selvstændig designprioritet, og atlas skal bruge en kompatibel visuel identitet.

Næste atlasarbejde er arkitekturvalg og en afgrænset prototype med hele øen → makroområde → Aurelia → Old Aurelia → Great Cathedral, inklusive navigation tilbage. Resten af landet må begynde på L1/L2. Den eksisterende Northern Plateau-rettelse er færdig og skal ikke udføres igen. Backlogoptagelsen indebærer ikke, at kortvisningen er implementeret eller udgivet.

## Ratingændringens teknik og test (tidligere leverance)

Første holdoprettelse og starttrup er implementeret; se ONBOARDING.md for test, startværdier og begrænsninger i e-mailverifikationen. Næste sportslige leverance er nye fremtidige endagsløb og en gentagelig kalender.

`teamRating()` beregner top 16 pr. køn for holdvisning og løbsseeding. `recovery_rankings(text)` anvender samme regel i databasen, så globale holdranglister ikke afhænger af at hente en afkortet liste af ryttere. Rytterranglister filtreres på køn. Funktionen er kun tilgængelig for serverrollen og ændrer ingen rækker.

`teams.rating` bevares som den historiske opsummering af holdets løbspræmier; den er ikke længere holdets viste konkurrencerating eller grundlag for seeding. `event_team_results.points` bevarer pointene fra hvert enkelt løb. Ingen gamle point omskrives. Motorkoden er versionsmærket `recovery-one-day-2`; allerede afsluttede løb returnerer fortsat deres gemte resultat.

Verifikation: 11 enhedstests, lint og build består. Transaktionstest i isoleret Supabase opretter midlertidigt 20 mænd med rating 1–20 og otte kvinder med rating 100: forventet holdrating er 200/800. Ændring af form/fatigue påvirker ikke rating. Klientroller har ikke direkte execute-adgang. Alle syntetiske rækker rulles tilbage efter testen.
