# Beskyttet Vercel Preview: bestået

Efterfølgende ændring: ved den godkendte produktionsrelease flyttede Vercel også branchens faste alias til produktionsbuildet. Brug ikke længere den faste testadresse nedenfor som isoleret testmiljø. Se PRODUCTION-RELEASE.md. Denne rapport beskriver den tidligere beståede Preview-test.

Kontrolleret 23. september 2026 efter ejerens konkrete godkendelse. Kun recovery-branchens Preview-konfiguration og manuelle Preview-deployments er ændret. Ingen merge, produktionsdeployment, produktionsvariabel, DNS eller produktionsdata er ændret i dette trin.

## Verificeret deployment

- Branch: `codex/recovery-supabase-auth`.
- Release-kode: `8595a5d2fb0a0992c086ac8f7890b0bacc5f9765`.
- Deployment: `dpl_7DzFQ6CRM1Gh9rhUdb3Wz1zrq4vJ`, READY, Preview.
- Fast testadresse: https://tennedz-git-codex-recovery-su-ffab0f-david-kvistgaards-projects.vercel.app
- Supabase: kun det gratis testprojekt `nxhvaoonnvmvohqaxfdx` og de fire syntetiske testkonti.
- Vercel Authentication / Standard Protection er bevaret. Ingen bypass-token eller offentligt delingslink oprettet.

De ti variabler i DEPLOYMENT-PLAN.md er oprettet med scope Preview + netop recovery-branchen. De oprindelige All Environments-værdier er bevaret. Serverværdier er Secret; de to NEXT_PUBLIC-værdier er Config. APP_ORIGIN matcher den faste testadresse præcist. Første build brugte bevidst en ugyldig origin; det efterfølgende verificerede build bruger den korrekte adresse.

Buildloggen bekræftede pnpm 11.25.0 og Next.js 15.5.26, vellykket kompilering og generering af alle 33 sider. Projektet er konfigureret til Node 24.x. Den kendte advarsel om manglende Next.js ESLint-plugin består; den stoppede ikke buildet.

## Browserkontrol over HTTPS

- Uden login vises afvisning på holdsiden.
- ALICE logger ind og får kun ALICE Cycling og ALICE Test Rytter.
- Genindlæsning bevarer login. Navigation til løb viser egen rytter; historik indlæser korrekt tomt resultat.
- En ny fane genbruger sessionen korrekt.
- Logout fra anden fane lukker også første fanes beskyttede historik.
- BOB kan derefter logge ind; begge holdsider viser kun BOB Cycling og BOB Test Rytter.
- Konto uden hold afvises med forklaring om manglende tilknytning.
- Konto med to hold afvises med forklaring om, at administratoren skal kontrollere tilknytningen.
- Ingen console errors blev observeret under den almindelige BOB-session. Testkontiene logges ud efter kontrollen.

De tidligere 12 direkte HTTP-kontroller mod rigtig Supabase er dokumenteret i REAL-AUTH-VERIFICATION.md. De blev kørt lokalt; browserkontrollen ovenfor er den særskilte Vercel-test. Cookie-attributter og tvungen sessionsfornyelse er ikke selvstændigt genmålt på Vercel. Ingen beskyttelse blev slået fra for at muliggøre automatiske HTTP-tests.

## Milepæl og resterende arbejde

Login-milepælen er bestået i det isolerede testmiljø både lokalt og på Vercel. Produktionskontiernes passwords og login er ikke testet eller ændret. Produktionsrelease kræver stadig konkret godkendelse af produktionskonfiguration, eksisterende kontoadgang og nyt produktionsbuild; testdeploymenten må ikke promoveres med testdatabasens nøgler. Løbscyklussen og øvrige spilskrivninger forbliver lukkede. Det gratis Supabase-testprojekt bevares efter ejerens ønske.
