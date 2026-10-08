# Visuel opdatering og atlas — 24. september 2026

## Leverance

- Nyt referenceark 05 er genereret med indbygget imagegen, gemt lokalt under `docs/design/portrait-study-05.png` og vist i samtalen. Bevar art direction 04 som godkendt testreference. Ark 05 viser én diskret hårfarvning og få smykker; det er ikke et statistisk populationsudtræk. Flere ansigter ligner tidligere ark, og dette er et kendt kritikpunkt til den større portrættest.
- Forsiden bruger godkendt reference 04 som tydeligt markeret stilillustration og det eksisterende landskab. Nyt layout, lokale skrifter, creme/skovgrønne farver og rytterfokus. Ingen betalt portrætaftale eller erstatning af eksisterende ryttere.
- Mit hold har to separate trupper, søgning, alle eksisterende sorteringsfelter, udfoldelige egenskaber, budget/rating og kønsspecifik næste-løbsvisning. Kalenderfejl adskilles fra tom kalender. Link til kalenderen bevarer køn. Deadline vurderes ud fra serverens tid.
- De tre forældede browsertests er ajourført. Manglende hold leder til onboarding; dubletkobling afvises. Begge cases kontrollerer også afvisning på private API'er. Login/session/reload/navigation/flere faner/logout og ejerskabskontrol er bevaret.
- Atlasprototype: lokale km, pan/zoom, 192 makroområder, progressive lag og navigation til Aurelia → Old Aurelia → katedral/precinct/plads/haver/underbygninger. Se ATLAS-PROTOTYPE.md. Ingen nye produktionsdata eller migrationer.

## Bevidste begrænsninger

Rytterkort viser stadig de eksisterende deterministiske reserveportrætter; de er ikke den godkendte malede slutkvalitet. Atlas er et skematisk, navigerbart udviklingsudsnit. Konturer, byaftryk og placeringer er prototypevalg. Der mangler professionelt bearbejdet topografisk art, tættere lokalgeografi uden for Aurelia og fysisk jordplacering. Typografisk og billedmæssig kvalitet skal fortsat vurderes af ejeren. Ingen af disse begrænsninger skjules som færdige produktfunktioner.

## Test

Slutkontrol: 35 enhedstests, 14 browsertests, lint og produktionsbuild (42 routes) består. Browsertests dækker login, kalenderfejl, frister, kønsvalg, søgning/sortering, atlasnavigation, detaljeskift og visninger på 390/1440 px. Touch-pinch er verificeret i en emuleret mobilbrowser; fysisk telefon er ikke testet. Skærmbilleder af forside, hold, land, by og katedral er gennemgået på 390/1440 px. Ingen databaseintegrationstests gentages, da der ikke er ændret database/API-logik. OneDrive gav EINVAL i den genererede .next-cache ved gentaget build; fjernelse af den kontrollerede build-cache løste fejlen. Eksisterende advarsler om Next ESLint-plugin og Node-modultype består.

## Referenceark 05 — prompt og provenance

Indbygget imagegen med `portrait-study-04-approved-for-testing.png` som stilreference. Prompt: Create a new Pelotonia portrait reference sheet 05 with exactly 12 NEW fictional professional cyclists, six adult men and six adult women, three columns/four rows, numbered 01–12. PELOTONIA / PORTRÆTSTUDIE 05. Preserve premium mature semi-realistic illustrated cartoon painterly rendering, visible expressive eyes, warm cream background and forest green jerseys, upper-chest framing, gentle consistent light, near-frontal 5–15 degree turns. No glasses, helmets or cropped heads. Ordinary believable athletes ages 19–39 with global human diversity and independent male/female variation; vary brows, eyes, noses, skulls, jaws, ears, lips, hairlines and hair textures. Only one discreet silver ear-stud wearer and one different person with a narrow muted blue hair streak; others natural hair/no jewelry, no mohawks. One thinning-haired man and one modest short beard. No feature encodes sporting skill. Do not copy reference identities. This is a deliberately sampled reference sheet, not a population distribution.

## Verificeret preview

Vercel-preview `dpl_H6mboWCTdFSpWKt8tSgE2XsNjtTC` er READY på commit `89720c90d48dcc7672da7074662dbd76b36c8e26`:
https://tennedz-4nrfx0lh1-david-kvistgaards-projects.vercel.app

Automatiske kontroller af previewet bestod: ny forside, login med eksisterende isoleret testkonto, korrekt team-ID, hold/kvindetrup, kalender, atlasnavigation til katedralen, mobil-layout og logout. Ingen ufangede JavaScript-fejl i den kontrollerede browser. Previewets skrivefunktioner er fortsat deaktiverede (503 verificeret). Produktionsdomænet tennedz.eu og dets database er ikke ændret i denne leverance. Preview kræver Vercel-adgang og bruger testkonti, ikke produktionskontoen.
