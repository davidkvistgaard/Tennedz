# Portrætbacklog — art direction V1

Status: optaget 24. september 2026. Ingen produktion eller betalt massegenerering startet. Ejerens fulde specifikation er bevaret i PORTRAIT-ART-DIRECTION-V1.md og har forrang. Reference: [portrætstudie 04](../public/images/portrait-study-04.png). Stilreference 02 er historisk; 04 er godkendt til videre test, ikke produktion.

## Arbejdsrækkefølge

1. Kortlæg den eksisterende identitetsgenerator, lagring og portrætvisning. Bevar stabile rytter-ID'er og ansigter; adskil faktisk implementering fra tidligere designforslag.
2. Definér versionsmærket variationsspecifikation og seed med lige stor variationsrigdom for mænd og kvinder. Nationalitet må ikke bestemme udseende, og udseende må ikke bestemme sportslige evner. Smykker og hårfarvning får separate sandsynligheder; sjældne kombinationer må ikke blive almindelige gennem uafhængige træk.
3. Planlæg en kontrolleret visuel test af 50–100 ryttere, cirka halvdelen af hvert køn. Flertallet skal ligne almindelige professionelle atleter; et særskilt lille udvalg af sjældne træk testes bevidst. Markér målrettede testcases, så et kontaktark ikke forveksles med populationsfordelingen. Afklar omkostninger før eventuelle betalte kørsler.
4. Vis alle testresultater, inklusive fejl og gentagelser. Undersøg ansigtsstruktur, bryn, øjne, næser, munde, frisurer, kønsvariation, stereotyper, stil, lys, udsnit og læsbarhed på små kort. Et seed eller unikt parameterfingeraftryk garanterer ikke visuel unikhed.
5. Undersøg leverandører og mål identitetsbevarelse, billedkvalitet, transparens/maskering og pris. Anbefal først leverandør/model efter dokumenteret test; opgør aktuelle priser med kilder og antagelser, inklusive genforsøg, for 1.000/10.000/100.000 ryttere samt lagring og trafik.
6. Foreslå produktionsarkitektur: permanent identitet pr. rytter, versionsmærkede aktiver, lagring/CDN, leverandøruafhængigt interface, kø, idempotens, begrænsede genforsøg, fejlstatus, validering/moderation, dubletkontrol og eksplicitte regler for regenerering. Normal sidevisning må aldrig udløse billedgenerering.
7. Afprøv separat trøje/kropslag og maskeret redigering mod kvalitetskravet. Ansigtet skal bestå ved transfer. Gratis ensfarvet trøje og senere supporterdesign skal anvende samme identitet. Undersøg Young/Prime/Veteran-varianter uden årlig automatisk regenerering. Produktionsmigrationer og betalt massegenerering kræver godkendelse.

## Sjældne træk — foreløbigt designforslag, ikke aktiverede vægte

- Diskrete smykker: cirka 5 % af rytterne; hovedsageligt lille ørestik eller ring. Smykker må ikke skjule øjnene.
- Synligt farvet hår: cirka 2 %; typisk en diskret stribe eller spidser, sjældnere hele håret.
- Markante kombinationer, fx lilla hanekam: højst omtrent 0,2 % (én ud af 500) som foreløbigt mål. Håndteres med en samlet kombinationsregel, ikke ved at tvinge samme frisure på alle med farvet hår.
- Disse tal er justerbare produktvalg, ikke demografiske fakta. Almindelige hårfarver, skaldethed, frisure og alder skal modelleres særskilt. Et testark med 12 portrætter dokumenterer ikke frekvenserne.

## Leverance efter undersøgelsen

Kontaktark, repræsentative fejl, vurdering af variation/gentagelser, anbefalet model, arkitektur, trøje- og aldringsløsning, prisoverslag og konkret næste implementering. Ingen tilbagevenden til modulære ansigter som endelig løsning uden dokumentation for den godkendte kvalitet. Eksisterende reserveportrætter er ikke den godkendte slutkvalitet.
