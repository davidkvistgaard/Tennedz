# Udrulningsplan efter rigtig login-test

Status 23. september 2026: den nedenfor beskrevne Preview-plan er godkendt og gennemført. Browserkontrollen bestod på kodegrundlag `8595a5d2fb0a0992c086ac8f7890b0bacc5f9765`; se VERCEL-PREVIEW-VERIFICATION.md. Produktionsplanen afventer fortsat konkret godkendelse. De følgende konfigurationsobservationer beskriver udgangspunktet før Preview-ændringerne.

## Faktisk Vercel-konfiguration

Projekt `tennedz`, team `david-kvistgaards-projects`, Hobby-plan. Next.js-preset, Node 24.x, repository-roden som root directory, ingen overrides af build/install/output. Systemvariabler er slået til. Vercel Authentication er aktiv med Standard Protection; den beskyttelse skal bevares.

Fem eksisterende variabler er alle sat til All Environments: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` og den pensionerede `ADMIN_SECRET`. `SUPABASE_URL` peger korrekt på produktionsprojektet `thacsxtnycmnnpjobgiv`. Nøglernes hemmelige værdier er ikke hentet eller udskrevet under denne kontrol. Dashboardet klassificerer servernøglen og ADMIN_SECRET som Config og anbefaler Secret; en kontrolleret ændring af opbevaring/scope bør indgå i produktionsplanen, ikke en uanmeldt rotation.

`APP_ORIGIN`, `SUPABASE_ANON_KEY`, `ADMIN_USER_IDS`, `RECOVERY_ALLOW_GAME_WRITES` og `ENABLE_EXPERIMENTAL_COREPACK` findes ikke i den viste projektliste. Auth kan falde tilbage på den eksisterende NEXT_PUBLIC-anon-nøgle, men nye miljøer skal konfigureres eksplicit.

Hoveddomænet `tennedz.eu` peger på Production. `www.tennedz.eu` omdirigerer med 307 til hoveddomænet. Begge har en DNS Change Recommended-meddelelse; dette er ikke dokumentation for et DNS-nedbrud. `tennedz.vercel.app` har Valid Configuration og peger også på Production. DNS ændres ikke som del af login-recovery.

## Eksisterende konti

Read-only SQL viste to bekræftede Supabase-konti med email-provider og et eksisterende password. Den ene bruger historisk `@tennedz.local`-login og ejer det ene eksisterende hold. Den anden har intet hold. Der er ingen forældreløse hold. Custom-kontoens login-navn matcher Supabase-holdejerens login-navn.

Der kræves derfor ingen ejerskabsflytning, ny konto eller nyt hold. Login skal bruge Supabase-kontoens password; kontrollen fastslår ikke, om det er det samme som passwordet fra custom-login. Password-hashes er ikke læst. Kontoen uden hold skal fortsat få en tydelig afvisning, ikke overtage det eksisterende hold. Eventuel kontogendannelse kræver en konkret aftale med ejeren og må ikke nulstille konti automatisk.

## Godkendt og gennemført: beskyttet Preview

Tilføj variabler KUN i Preview, afgrænset til Git-branchen `codex/recovery-supabase-auth`. Eksisterende All Environments-værdier ændres ikke. Ingen produktionsnøgler må anvendes af det nye preview-build:

| Variabel | Recovery Preview |
|---|---|
| SUPABASE_URL | https://nxhvaoonnvmvohqaxfdx.supabase.co |
| SUPABASE_ANON_KEY | Testprojektets eksisterende anon/publishable-nøgle |
| SUPABASE_SERVICE_ROLE_KEY | Testprojektets eksisterende servernøgle, lagret som Secret |
| NEXT_PUBLIC_SUPABASE_URL | Samme testprojektadresse, så den arvede produktionsværdi ikke medtages |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Testprojektets offentlige nøgle |
| ADMIN_SECRET | Inaktiv testværdi, der erstatter den arvede produktionshemmelighed; recovery bruger den ikke |
| ADMIN_USER_IDS | Kun den syntetiske ALICE-testkontos UUID |
| RECOVERY_ALLOW_GAME_WRITES | false |
| ENABLE_EXPERIMENTAL_COREPACK | 1, så packageManager vælger pnpm 11.25.0 |
| APP_ORIGIN | Den præcise HTTPS-origin for den verificerede Preview-adresse; sættes før login-test og genbuildes om nødvendigt |

Opret derefter en manuel Preview-deployment fra recovery-branchen. Automatisk Git-deployment for branchen er fortsat slået fra. Bekræft miljøet Preview og commit før oprettelsen. Vercel modtager kun testprojektets nøgler; servernøglen giver serveren adgang til de syntetiske testdata. Ingen nye abonnementer, delingslinks eller bypass-hemmeligheder oprettes. Vercel Authentication forbliver aktiv.

Kontroller buildloggens Node/pnpm/Next-versioner, den faktiske Supabase-adresse, HTTPS-cookies, login, reload, navigation, to faner, logout og kontoskift. Bevar fejllukning ved manglende/dobbelt hold. Brug de eksisterende testkonti. Stop ved en produktionsadresse, forkert miljø, uventet betaling eller behov for at svække beskyttelsen.

## Senere produktionsgodkendelse

Efter bestået Vercel-test fremlægges præcise produktionsvariabler og release-commit. `APP_ORIGIN` skal være `https://tennedz.eu`; login på ekstra produktionsaliaser skal enten omdirigeres kontrolleret eller håndteres særskilt, da exact-origin-beskyttelsen ellers afviser POST fra dem. Preview må ikke blot flyttes til et produktionsdomæne med testdatabasens runtime-konfiguration. Lav et nyt produktionsbuild med de kontrollerede produktionsværdier.

Bevar de eksisterende produktionsnøgler, medmindre en særskilt begrundelse kræver rotation. Begræns deres miljøscope kontrolleret, og vælg den eksisterende holdejer som administrator kun efter ejerens bekræftelse. Ingen yderligere SQL-migration er identificeret som nødvendig for login-milepælen. Den allerede anvendte containment-migration genkøres ikke.

Afprøv eksisterende kontoadgang med ejeren uden at bede om passwords i chatten. Hvis ejeren ikke kan logge ind med det oprindelige Supabase-password, stop og aftal gendannelse; ændr ikke holdets ejer. Ingen merge til main, offentlig domæneændring eller produktionsdeployment før konkret godkendelse.

Ved fejl før offentlig release forbliver produktionen på sin nuværende deployment. Den gamle kode har kendte sikkerhedsproblemer og er ikke en sikker rollback-baseline efter offentlig release. En produktionsfrigivelse skal derfor også have en godkendt plan for hurtigt at lukke adgangen eller rette fremad uden at genåbne gamle usikre API'er. Løbsafvikling og øvrige spilskrivninger forbliver lukkede i denne release.

Referencer: [Vercel-miljøvariabler](https://vercel.com/docs/environment-variables), [package manager-valg og Corepack](https://vercel.com/docs/package-managers). Testresultater: [REAL-AUTH-VERIFICATION.md](REAL-AUTH-VERIFICATION.md).
