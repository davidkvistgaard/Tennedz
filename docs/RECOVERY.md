# Pelotonia: sikker genopretning

Status: recovery-kode lokalt testet, ikke godkendt til produktion. Se LIVE-REVIEW.md for den efterfølgende kontrol af den genaktiverede database.

Efterfølgende godkendt databaseindgreb: direkte klientadgang er lukket, og RLS er slået til på alle public-tabeller. Se CONTAINMENT-APPLIED.md. Spildata og konti er bevaret; Vercel-deployment mangler stadig.

## Fast udgangspunkt

- Repository: davidkvistgaard/Tennedz.
- Produktionsgren er urørt: main, udgangspunkt `2fb499f925c2e1a1c545e7c53386a1e1e7daccc5`.
- Arbejdsgren: `codex/recovery-supabase-auth`.
- `vercel.json` slår automatisk deployment fra for netop denne gren. Ingen live Vercel-indstillinger er ændret.
- Ingen produktionsdata, miljøvariabler eller Supabase-konti er ændret. Databaserettigheder og RLS er efter særskilt godkendelse ændret som beskrevet i CONTAINMENT-APPLIED.md.
- Supabase-projekt `thacsxtnycmnnpjobgiv` (Tennedz) var INACTIVE, men blev derefter genaktiveret efter brugerens godkendelse og er ACTIVE_HEALTHY. Skema, rettigheder og holdkoblinger er nu kontrolleret med read-only SQL. Se LIVE-REVIEW.md.
- Vercel-adgang er genoprettet, og projekt og eksisterende deployment er identificeret. Se VERCEL-ACCESS.md. Recovery er ikke deployet.
- GitHub-skriveadgang er genoprettet. Recovery-grenen og kladde-PR #1 er oprettet: https://github.com/davidkvistgaard/Tennedz/pull/1.

## Hvad er ændret?

Supabase Auth er eneste aktive login. Browseren kalder serverens API; serveren bruger Supabase SDK og HttpOnly-cookies. Tokens og service-nøglen sendes ikke til browserens JavaScript. Hver beskyttet API-anmodning verificerer brugeren med Supabase `getUser()`. Private svar må ikke caches.

Hold vælges kun gennem `teams.user_id = bekræftet bruger-id`. Manglende og dobbelte koblinger stopper med en tydelig fejl. Login opretter aldrig et nyt hold og forsøger aldrig at gætte ejerskab. Brugernavne kan stadig pege på historiske Supabase-konti med adressen `<brugernavn>@tennedz.local`; custom-login-kodeord kan ikke bruges uden særskilt, kontrolleret kontogendannelse.

Faner får besked om login/logout gennem en lokal ændringsmarkør uden legitimationsoplysninger. Fokus og periodisk kontrol opdaterer sessionen. Kontoskift nulstiller sidernes gamle holdtilstand. Sessionens udløb håndteres af Supabase SDK på serveren.

Browserens gamle Supabase-klient og custom-auth-hjælper er pensioneret. `login_accounts` og `auth_sessions` er IKKE slettet eller ændret. Det gamle oprettelses-endpoint svarer 410.

Alle eksisterende data-API'er kræver login; administrator-API kræver desuden et bruger-id i serverens `ADMIN_USER_IDS`. Den tidligere delte ADMIN_SECRET bruges ikke længere af aktive endpoints. Løbsafvikling, tilmelding, spilledato, nulstilling og nye database-presets er lukket. Deres eksisterende kode er bevaret under `lib/legacy`, uden nogen aktiv import. Spilmotoren og visningskomponenterne er bevaret.

## Lokal installation og test

Node 24 og pnpm 11.25.0. Afhængigheder er fastlåst i package.json og pnpm-lock.yaml. `pnpm-workspace.yaml` indeholder versionsspecifikke undtagelser for nyligt udgivne pakker; ingen generel ophævelse af alderskontrollen.

Next.js er opdateret inden for 15.5-serien til 15.5.26. En afgrænset override af Nexts PostCSS til 8.5.23 fjerner fire fundne indirekte sårbarheder. `pnpm audit --prod` returnerede derefter ingen kendte sårbarheder. Det er et registertjek, ikke en garanti mod alle sikkerhedsfejl. Build giver fortsat en advarsel om manglende Next-specifik ESLint-plugin; den nuværende lint-kontrol er en grundlæggende JavaScript-kontrol.

```text
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build
pnpm run lint
pnpm test
pnpm run test:e2e
```

Browsertest bruger Edge på Windows og Chromium på andre systemer. På andre systemer skal Playwright Chromium være installeret. Testserveren bruger kun lokale, syntetiske konti og en HTTP-testudgave af Supabase-protokollen. Der behøves ingen .env-fil og ingen rigtig database. Testportene er 3100 og 54329. Kør ikke en anden server på disse porte.

Den lokale protokoltest dokumenterer frontend → Next API → Supabase SDK → testtjeneste. Efterfølgende er rigtig Supabase Auth, refresh, ejerskab, klientrettigheder og browserforløb verificeret i et isoleret projekt. Se REAL-AUTH-VERIFICATION.md; produktionskonti og Vercel-release er stadig ikke afprøvet.

## Næste godkendelsespunkt

1. Genaktivering er godkendt og gennemført. Ingen spil-/kontodata er oprettet, slettet eller flyttet.
2. Read-only skema- og ejerskabskontrol samt godkendt adgangssikring er gennemført. Metadata-snapshot erstatter ikke en fuld databackup.
3. Isoleret rigtig Supabase-test er bestået: 12 HTTP-kontroller plus browserforløb med to faner. Se REAL-AUTH-VERIFICATION.md.
4. Afslut oprydning af det disponible testprojekt. Ingen produktionskonti skal slettes, sammenlægges eller nulstilles automatisk.
5. Fremlæg konkret produktionskonfiguration, kontoadgang og deploymentplan til godkendelse. Funktionel login-milepæl er verificeret i testmiljøet; offentlig drift er ikke godkendt. Løbscyklussen genopbygges først efter rapportering til ejeren.

## Begrænsninger og senere arbejde

- In-process loginbegrænsning supplerer kun Supabase Auths egne grænser. Den er ikke en global rate limiter på tværs af Vercel-instanser; providerindstillinger og eventuel CAPTCHA skal verificeres inden offentlig release.
- Service-role-adgang er kun på serveren, men omgår RLS. Hver personlige forespørgsel begrænses eksplicit til ejeren. Produktionsrettigheder er sikret og verificeret; direkte klientadgang er desuden afprøvet i testprojektet.
- Rettighedsmigrationen er baseret på faktisk databasestruktur og allerede anvendt efter godkendelse. Se CONTAINMENT-APPLIED.md; anvend den ikke igen som en ny migration.
- Løbsdata bruger flere generationer af tabeller, og visning/historik er endnu ikke harmoniseret. Ranglisten er stadig en eksisterende pladsholder. Ingen af delene er erklæret repareret.
- Næste løbsfase skal gøre afvikling og pointtildeling atomisk og forhindre dobbeltkørsel, før de bevarede handlers åbnes igen.

Tilbagerulning før produktion: behold main uændret og undlad at deploye recovery-grenen. En tidligere produktionsversion har kendte sikkerhedsmangler og bør ikke genudrulles som en påstået sikker løsning.
