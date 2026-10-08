# Konto og første hold

Implementeret på recovery-grenen 23. september 2026 under ejerens mandat til almindelige ændringer og releases inden for produktvisionen.

## Spillerforløb

Forside → opret konto med e-mail/kodeord via Supabase Auth → vælg holdnavn → modtag 8 mænd og 8 kvinder. Eksisterende brugernavne virker stadig til login. Login opretter aldrig et hold automatisk. En eksisterende konto uden hold får et eksplicit valg; konti med dobbelte holdkoblinger stoppes til administrativ kontrol.

Forside og nye oprettelsessider bruger Pelotonias grønne/hvide identitet og fungerer på mobil. Admin-linket vises kun for serverens administratorliste; API'ernes eksisterende serverkontrol er fortsat afgørende.

## Starttrup v1

Begge kategorier får to sprintere, to klatrere, to klassikerryttere og to tempospecialister med identiske startprofiler. Fordelingen er et første balanceringsgrundlag, ikke en påstand om endelig spilmæssig balance. Navne trækkes fra landespecifikke mande-/kvindelister for otte nationer. Hvert hold har forskellige navne.

- 16 ryttere, hver med 0 resultatpoint, form 40, fatigue 0 og alder 22–25.
- Individuelle skjulte skill-caps på 15–35 over den aktuelle skill (maks. 90).
- Startøkonomien viderefører databasen: budget 1.000.000, coins 100.000 og gems 0.
- Fødselsdato beregnes ud fra eksisterende game_date med 90 dage pr. spilår. Det eksisterende ur er stadig fastlåst; automatisk aldring og kobling til virkelige datoer er en senere milepæl.
- Portrætter bruger fortsat eksisterende visning. Permanente AI-portrætter er ikke implementeret her.

## Sikkerhed og lagring

`/api/onboarding` verificerer Supabase-brugeren og tager kun holdnavnet fra browseren. Ejerskab, startøkonomi og stats kan ikke vælges via klientpayload. Serverrollen kalder `recovery_create_starter_team(uuid,text,jsonb)` i én transaktion. En advisory transaction lock pr. bruger serialiserer samtidige oprettelser. Eksisterende hold returneres uændret, og delvise oprettelser rulles helt tilbage.

Alle aktive oprettelser skal fortsat gå gennem denne funktion. Der tilføjes ikke en global unik user_id-begrænsning på gamle teams, da historiske dobbelte koblinger skal opdages og bevares til kontrolleret afklaring. Administratorers direkte SQL kan omgå denne applikationsregel.

Funktionen har fast tom search_path, SECURITY INVOKER og kun execute til service_role. Migrationen opretter kun funktionen og dens rettigheder; ingen eksisterende rækker ændres. Holdets starter-pack-flag gemmes i samme transaktion.

`/api/auth/me` bruger nu en eksplicit liste over offentlige rytterfelter. Ingen skill-caps eller potentialefelter returneres. Administratorstatus kommer fra serverkonfiguration, ikke brugerredigerbare metadata. Registrering og holdoprettelse kræver samme Origin og åbent game-write-flag. Supabase Auths egne rate limits suppleres af en lokal ratebegrænsning.

## Verifikation

14 enhedstests, lint og produktionsbuild består. 13 integrationstests mod isoleret Supabase verificerer seks samtidige oprettelser, 8+8, skjulte caps, serverbestemte værdier, idempotens, bevarelse af eksisterende hold, konfliktstop, komplet rollback ved fejl i sidste rytter og blokeret direkte klient-RPC. Alle 12 tidligere Auth/ejerskab/refresh/logout-kontroller består.

Browseren har gennemført login med en ny syntetisk testkonto, holdoprettelse og visning af det nye hold. Konti til den test er oprettet via Supabases officielle Auth Admin API i testprojektet, uden e-mailafsendelse. De tre syntetiske konti og to oprettede testhold bevares kun i testprojektet.

## Registreringsmiljø og kendte grænser

Produktionens eksisterende Supabase-indstillinger er inspiceret: e-mail-login og signups er aktiveret, og e-mailbekræftelse var allerede deaktiveret. Disse indstillinger er ikke ændret. Dermed er en ny konto ikke bevis på ejerskab af e-mailadressen. Spillets ejerskab knyttes altid til Supabase-brugerens id, aldrig en oplyst e-mailadresse eller metadata.

Testprojektet kræver e-mailbekræftelse. Fuld nyregistrering via e-maillevering er ikke testet; ingen e-mails er sendt som test. Formularvalidering, CSRF, allerede-logget-ind-stop og fejl i callback er testet. Koden understøtter Supabases bekræftelsesforløb og et fast PKCE-callback uden valgfri viderestilling. Hvis e-mailbekræftelse senere aktiveres i produktion, skal SMTP, redirect-allowlist og faktisk levering testes først. Der er ikke købt en mailtjeneste eller svækket nogen eksisterende Auth-indstilling.

Løbskalenderen har stadig kun de udløbne historiske events. Et nyt hold betyder derfor ikke, at et nyt fremtidigt løb allerede er åbnet.

## Produktionsmigration

Kode `bf214deba3322ecb1b898e5602d56f14337a7924` er udgivet på https://tennedz.eu. Preview `dpl_7ZWioo6x6aS9aBcBn15Df5ujCKbd` bestod på 31 sekunder. Vercel genbyggede samme commit med Production-miljøet til `dpl_Dh9sarpGxVVGBuVvjiBtJEPf2jMM` (READY, ca. 33 sekunder), immutable adresse `tennedz-2u2xips6h-david-kvistgaards-projects.vercel.app`. Ingen miljøvariabler blev ændret. Foregående sikre release: `dpl_6MQnEgLmDT4vj2W4Wenrd1NHYWA9`.

Alle 15 produktions-HTTP-kontroller består. Browserkontrol viser ny forside og registreringsformular samt ejerens eksisterende My Team med 112 ryttere, 100.000 coins, rating 0/0 og fortsat Admin-link. Ejerens login er bevaret. Produktionsregistrering af en faktisk ny bruger er ikke udført som test.

Ingen browserkonsolfejl blev observeret, og den korte Vercel error/fatal-logkontrol efter release fandt ingen poster. Det er en releasekontrol, ikke løbende overvågning. Main er uændret; kladde-PR #1 og recovery-grenen indeholder arbejdet.

`20260923184920_atomic_starter_team.sql` er anvendt i produktion. Før/efter-fingeraftryk af samtlige teams-, riders- og team_riders-rækker er identiske (1/112/112 rækker). Funktionens execute-rettigheder er kontrolleret: anon=false, authenticated=false, service_role=true. Ingen produktionskonto eller testhold er oprettet under kontrollen. Mobilkontrol ved 390 px viser formularen uden vandret overløb.

Supabase-advisor er kontrolleret efter migrationen og viser ingen nye fund: de dokumenterede otte gamle [search_path-advarsler](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), én eksisterende [advarsel om lækkede kodeord](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) og 24 forventede INFO-fund om RLS uden klientpolitikker består.
