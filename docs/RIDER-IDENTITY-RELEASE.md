# Rytteridentitet v1

## Funktionalitet

- Nye starterhold: 8 mænd og 8 kvinder med individuelt gemte navne og udseendeprofiler.
- 75 % store cykelnationer, 20 % øvrige etablerede, 5 % resten. Hvert af 243 lande/territorier har positiv sandsynlighed. Ubeboede/administrative territorier er udeladt. Vægtene er spilvalg, ikke en aktuel UCI-rangliste.
- Regionale navnepuljer, nationalt tilpassede navneformer, nogle gange mellemnavn. Flere navnetraditioner i bl.a. Belgien, Schweiz og Canada. Dette er en kurateret første udgave; regionale fallback-puljer dækker ikke alle lokale kulturer perfekt.
- Udseende v1: ansigtsproportioner, øjne, bryn, næse, mund, hud/hår/øjne, hårstil, skæg, små asymmetrier og detaljer. 3,5 % chance for farvning hos ryttere med hår, 10 % for diskrete smykker. Bryn følger naturlig hårfarve.
- Landet vægter farvepaletten. 18 % åben international blanding gør alle paletter mulige overalt. Vægtene er kunstneriske valg, ikke målte befolkningsprocenter. Ansigtsgeometri er ikke låst til nationalitet.
- Identiske gemte profilkombinationer afvises i databasen, også med forskelligt seed. Det er ikke en garanti mod visuelt lignende ansigter.
- Offentligt kosmetisk seed og hemmeligt sportsligt seed er uafhængige. En spiller kan ikke udlede skjulte potentialeloft fra portrætdata.
- Eksisterende ryttere beholder alle navne, nationaliteter, sportslige værdier og relationer. Deres reserveportræt afledes deterministisk fra eksisterende id med versionslåst v1-algoritme; der er ikke kørt en omskrivning af eksisterende rækker.
- Ny side `/team/portraits`, mærket **Ryttere**, viser holdet med separate kønskategorier. Holdkort viser også landets navn.

## Billedstil og omkostninger

Brugeren har valgt **ingen ekstra udgift endnu**. Den aktive gratis visning er en forbedret proceduralt tegnet SVG-reserve, ikke de godkendte AI-malerier fra prøveark 02. Ingen ekstern billedtjeneste, API-nøgle, abonnement eller automatisk betaling er tilføjet.

`portrait_path` kan pege på en gennemgået lokal PNG/WebP under `/portraits/`; en manglende fil falder tilbage til reservevisningen. `portraitPrompt()` beskriver en rytter ud fra den gemte profil og forbereder senere individuelle billeder. Der er endnu ingen baggrundskø, masseproduktion eller uploadflade til AI-billeder. Nogle fine træk i profilen er primært beregnet til den senere billedgenerator og gengives kun forenklet i SVG. Hårtekstur og paletter kan fortsat kunstnerisk forfines.

## Data og kompatibilitet

Migration `20260923195323_rider_identity.sql` tilføjer nullable felter, en profilkontrol og et unikt indeks, og udvider den eksisterende atomiske oprettelsesfunktion. Den gamle kode kan stadig oprette ryttere uden de nye felter. Ingen tabeller, relationer, brugere eller eksisterende data slettes. Ingen nye klientrettigheder; funktionen er kun kaldbar med service_role bag verificeret login.

Landekoder er vendoret fra [i18n-iso-countries v7.14.0](https://github.com/michaelwittig/node-i18n-iso-countries/tree/v7.14.0), med MIT-licens i `lib/riders/COUNTRY-DATA-LICENSE.txt`. Kosova normaliseres til projektets XK/XKX. Historiske cykelkoder DEN/NED/GER/SUI/SLO m.fl. kan stadig læses; nye rækker bruger ISO3.

## Kontrol

- 19 unit-tests: alle lande og begge køn, 200.000 nationalitetstræk, 10.000 forskellige profiler, sjældne detaljer, gamle ryttere og adskillelse fra skjult potentiale.
- 6 nye integrationstests på det tilladte testprojekt: atomisk oprettelse, lagring/API, reload, duplikatafvisning med fuld rollback, ufuldstændig profil og uautoriseret ændring.
- 13 eksisterende onboarding- og 12 auth/ejerskabsintegrationstests består.
- Lokal produktionsbuild og lint. En OneDrive-fejl i build-cachen krævede rydning af `.next` og genbygning; ingen kildekode/data fjernet.
- Browser: 8 mandlige og 8 kvindelige portrætter, nationale navne, kategoriskift, mobilbredde 390 px uden vandret overløb, ingen observerede konsolfejl.

## Produktion

Før release: 1 hold, 112 ryttere, 112 medlemskaber. Fingeraftryk af de eksisterende kolonner skal bevares ved den additive migration. Main må ikke bruges som rollback: tidligere sikre produktion er Vercel `dpl_Dh9sarpGxVVGBuVvjiBtJEPf2jMM`.
