# Kønsopdelt rating og ranglister

23. september 2026. Implementeret under ejerens tilladelse til almindelige ændringer og releases inden for produktvisionen. Main er uændret.

Holdvisning, divisionsseeding og ranglister bruger nu summen af resultatpoint fra op til de 16 bedst ratede ryttere af det relevante køn. Mænd og kvinder har separate ranglister. Skills, form, fatigue og skader påvirker ikke denne rating. Eksisterende point og færdige løbsresultater er bevaret. Motorversion: recovery-one-day-2.

Migration `20260923182902_gender_result_rankings.sql` er testet isoleret og anvendt i produktion. Den tilføjer kun en læsende databasefunktion; ingen eksisterende rækker ændres. Execute er verificeret afvist for anon/authenticated og tilladt for serverrollen. Produktionens eneste hold har fortsat 0 i begge kategorier.

## Validering før release

- 11 enhedstests, lint og produktionsbuild består.
- 12 HTTP-kontroller mod rigtig Supabase Auth i testmiljø består.
- SQL-transaktionstest med 20 mænd og 8 kvinder bekræfter top-16-rating 200/800 og uafhængighed af form/fatigue. Testdata rulles tilbage.
- Lokal browserkontrol bekræfter kønsskift og forskellige ranglister uden konsolfejl.

## Release

- GitHub-kode: `501d92a68e21092ca85aee4c74d7b572f95177e8` på recovery-grenen.
- Preview: `dpl_8NjRKiHYzE8eq9qXSf9bCs5MoYwq`, READY, 34 sekunder.
- Produktion: `dpl_6MQnEgLmDT4vj2W4Wenrd1NHYWA9`, READY, ca. 39 sekunder, samme commit. Genbygget særskilt med Production-miljøet; testmiljøets nøgler er ikke promoveret.
- https://tennedz.eu er verificeret knyttet til releasen. Immutable adresse: `tennedz-110b3u8yu-david-kvistgaards-projects.vercel.app`.
- Alle ti produktions-HTTP-kontroller består. Genindlæsning bevarer ejerens login og viser My Team, 112 ryttere, 100.000 coins samt separat rating 0/0.
- Browserkontrol af mænd og kvinder viser særskilte rytterlister og My Team med 0 point i begge. Ingen konsolfejl. Historiske navne matcher ikke altid køn; denne release ændrer ikke navnene.
- Vercels afgrænsede error/fatal-logkontrol umiddelbart efter release fandt ingen poster; det er ikke vedvarende overvågning.
- Sikker foregående release er `dpl_Cdk9GuBAcgy3YRXREfQ4P3duyWo6`. Main indeholder stadig gammel kode og må ikke genudrulles.

Produktretning og næste leverancer er beskrevet i PRODUCT-ROADMAP.md. Denne release implementerer ikke etapeløb, nye produktionsløb eller nye spilleres holdoprettelse. De tre gamle events er fortsat udløbet, og produktionen har kun ét hold.
