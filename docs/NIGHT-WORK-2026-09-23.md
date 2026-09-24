# Arbejdsstatus: endagsløb og viewer

Arbejdsramme: 23/9 2026 20:26 UTC til 24/9 04:26 UTC (06:26 dansk tid). Aktivt goal og midlertidig heartbeat `pelotonia-otte-timers-udvikling` hvert 30. minut. Slet heartbeat ved afslutning; ingen nyt arbejde efter fristen.

## Fastlagt af ejeren

- Alle managerinputs gives inden deadline. Derefter beregnes hele løbet i baggrunden før visning. Vieweren afspiller gemte hændelser; pause, tempo og kamera påvirker ikke resultatet.
- Endagsløb først, otte ryttere og kaptajn, separate køn, eksisterende resultatrating og divisioner bevares.
- Varm creme, skovgrøn/salvie, afdæmpede jordfarver, karakterfuld læsbar typografi, illustreret voksen charme som de godkendte betalte portrætter. Ingen betalt billedgenerering endnu.
- Selvstændigt arbejde på recovery-grenen. Ingen sletning af produktion, ingen nye udgifter. Større åbne spilregler parkeres.

## Udgangspunkt

Live appcommit `7c00d2277613e065bcade02087a175b4ae12eaff`, prod `dpl_7m2uhh2oz3KkAU8p1DhtXAsqG2Fg`. Remote head `7888aa36622612ec659c0d220e90abca6d3eef3d`, lokal `e4b701a`; historik forskellig, indhold tilsvarende. Ingen blind git push/rebase. Draft PR #1. Main urørt.

Kun docs/design er lokalt untracked og bevares. GitHub text-export udelader denne mappe, da den indeholder PNG. Testprojekt nxhvaoonnvmvohqaxfdx, produktion thacsxtnycmnnpjobgiv. Hemmelige testfixtures i ignoreret .recovery-local.

## Arbejdsrækkefølge

1. Fælles ruteformat og gemt replay med grupper, tidsafstande, roster og faktiske motorhændelser; kompatibilitet med gamle løb.
2. Viewer: illustreret scene, etapeprofil, eget hold, tydelig status, pause/hastighed/nøgleøjeblikke, spoilerkontrol.
3. Kalender og holdudtagelse: kønsopdeling, rutekrav, nedtælling, otte pladser/kaptajn, tydelig gemt/ikke gemt og serverdeadline.
4. Kontrolleret oprettelse og afvikling af nye fiktive gratis løb, uden at omskrive historiske events eller vilkårligt flytte spildatoen. Automatik inden for gratis driftsmuligheder; uløste timingregler dokumenteres.
5. Resultat/point-opfølgning, fælles design, mobil, tilgængelighed, fuld test og verificeret release.

## Fund / aktuel status

Startet. Motoren gemmer kun feed og slutresultat. Vieweren er et tekstligt referat. Gemte replay-snapshots skal komme fra simulationen, ikke opfindes i browseren. Den nuværende kalender-API sorterer gamle events først og kan dermed skjule kommende løb. Deadlines håndhæves allerede transaktionelt ved tilmelding, og point er idempotente.

## Parkerede designbeslutninger

Ingen nye taktiske inputtyper, økonomiregler, aldringsfrekvens, ægte TdF-profiler eller betalte tjenester indføres uden tilstrækkeligt grundlag. UI må vise eksisterende regler, ikke love endnu uimplementerede effekter.

## Checkpoint 20:57 UTC

Replay v1 implementeret i servermotoren, migration 20260923203111 anvendt KUN på testprojektet. Optager strategiske faser med interpolerede mellempositioner, ikke kontinuerlig fysik; slutgaps matcher præcist. Eksisterende sportsformler bevares. 22 unit tests, lint og build bestået. Integration race-check bestået inkl. parallel afvikling, rollback, point én gang og identisk replay efter reload. Testevent 37e244d8-b1a9-4bc7-9047-6437caf3c7c6 kan vises lokalt som Alice. Ingen produktionsændring denne nat endnu.

Ny varm TeamShell, lokale gratis DM Sans/Bricolage-fonte (TTF skal via GitHub binary blob), StageProfile og illustreret RaceViewer implementeret. Browser viser korrekt start, næste øjeblik og mål, med egen kaptajn og resultat. Scene-labelafstand justeret efter test; endnu ikke genbygget.

Kalender-API ændret til separate upcoming/pending/archive queries og public allowlist (ingen seed). Ny kalender/udtagelse skrevet, endnu ikke lint/build/browser-testet. Bruger serverur-offset, separate køn, otte pladser, kaptajn, skadefilter (injury_until <= game_date), gemt/ikke-gemt og bevarede presets. Resultatsidens division-query/spoilerværn mangler stadig. Kalender ændringer skal testes med frisk syntetisk event; automatisk race-check-event nu afsluttet.

Lokal server session 73881 skal stoppes før næste build. CUA nightViewerTab id10 har Alice local login og færdigt testreplay. Produktionsejer-login er bevaret. Alle ændringer stadig uncommitted; remote head og prod uændret fra udgangspunkt. Fontlicenser ligger public/fonts. Fortsæt efter arbejdsrækkefølgen, sluttid uændret 04:26 UTC.

## Checkpoint 21:07 UTC

Kalender/udtagelse og resultat/historik med spoilerkontrol nu lint/build-verificeret. Browser: Alice valgte otte ryttere, valgte kaptajn og tilmeldte gratis syntetisk event beaea473-5cc0-421c-8bcb-af4d24e15dab; Gemt ✓ bekræftet. Mobil 390px kontrolleret; en CSS-regel strakte portrætbeholderen, rettet (skal genbygges). Replaygruppe-labels nu holdt adskilt ved mål. Viewer/resultatlinks respekterer division-query. 22 unit tests fortsat grønne efter kommentarrettelse (kun reelle splittelser med antal/rider_ids; ingen påstand om simulerede sprintertog).

Nyeste lokale server session 25163. CUA tab10 Alice testkonto, mobilviewport aktiv (nightViewport.reset() ved afslutning), replayvisning genstarter uden spoiler og tilbyder genoptagelse. Git stadig ikke committed. Kildekoden formateret via ephemeral Prettier 3.6.2 uden dependencyændring. Exportscript understøtter nu binære base64_content-felter; konverter disse til GitHub blob-sha før create_tree.

Adminoprettelse/automatisk afvikling endnu ikke implementeret. Aktuelle Vercel-docs kontrolleret: Hobby 100 cronjobs, hvert job højst dagligt og tidspunkt op til 59 min forsinket (https://vercel.com/docs/cron-jobs/usage-and-pricing). Skillens gamle 2-jobgrænse er forældet. Ingen cron oprettet og ingen miljøvariabler ændret. Undgå at love præcis løbsstart på gratis Vercel-cron. Først kontrolleret oprettelse af nye gratis fiktive M/F-løb med private tilfældige seeds, ingen omskrivning af gamle events/spildag. Derefter afvikling og release.

## Git-checkpoint 21:11 UTC

Recovery-arbejdsversion gemt remote som 1bf9c97238828679cabf8df62b257a8f8be328be, derefter kun normalisering af gammel release-notes CRLF i d336259455187278b52d0fc2648e1bb5d982fc93. Lokal commit cb51e76da7d9591e6dbfcc2a0d68407c5469bd64. Begge nu præcis tree 60b405fd2794a47d088eecd265318d0231483b6c. Main/produktion uændret. Brug remote d336259... som parent og tree60b... som base fremover. PR #1 tilknyttet; PR-beskrivelsen skal opdateres før release. Sidste små rettelser (portrætbredde, ental dag, ærlig splitkommentar) er unit-testet men kræver sidste genbygning før preview. Aktuel .next er forrige frontendbuild.

## Checkpoint 21:20 UTC

Ny kalenderadministration implementeret (endnu uncommitted): lib/race/templates.mjs, RaceCalendarAdmin, /api/admin/race-calendar, admin-side. Fire originale fiktive ruter, gratis separate M/F-løb, 15 min–90 dages deadline. Servervalideret template, private UUID-seeds pr. løb, idempotent request-id. Migration 20260923211009_managed_race_calendar.sql oprettet med CLI 2.117.0 og anvendt KUN test. Ny RLS-tabel race_calendar_requests og service-only security-invoker RPC. Rettighedskontrol: anon=false/authenticated=false/service=true/RLS=true.

23 unit tests, lint og fuld build bestået. calendar-check.mjs består fire integrationgrupper: admin/validering, parallel identisk oprettelse, offentlig kalender uden seeds, sen FK-fejl med fuld rollback og anonblok. .recovery-local/calendar-fixtures.json indeholder de nye syntetiske event-id'er. Lokal server nu session67157. CUA tab10 på /admin, browserbredde nulstillet. Ny administration mangler browserkontrol. Remote stadig d336259455187278b52d0fc2648e1bb5d982fc93, lokal cb51e76..., tree60b...; nye kalenderændringer skal eksporteres, committes og testes i preview før samlet produktion. Ingen cron eller produktion ændret.

## Checkpoint 21:28 UTC

Deltagerafvikling bygget og integrationstestet: /api/event/prepare (POST, same-origin, kræver verificeret ejer og egen tilmelding, writegate, deadline i eksisterende atomiske snapshot), fælles executeRace i server.js. Viewer kalder prepare ved manglende gemt løb og henter derefter replay; viser først noget efter hele løbet er gemt. Kalender giver Se løbet til låst egen udtagelse. Kræver ingen cron, nye credentials eller betaling. Dette er beregning ved første deltageråbning, IKKE en præcis automatisk udsendelsesplan. Administrator kan stadig afvikle før nogen åbner. race-check bestået med samtidige admin/deltagerkald og kun én pointtildeling. Nye friske test-ryttere pr. kørsel gør gentagelse uafhængig af tidligere testskader. Seneste testreplay e061f882-4ce9-472a-b03d-a27061618efa. Server session54646 kører denne build.

Browseradmin bestået: to syntetiske bjergløb oprettet via UI (148deaa0-d5e7-46fb-8db6-204acf342d5f M / b3250f34-a275-4a2b-ae20-1cd13fb8a316 F). Ingen produktionsløb.

Indbygget imagegen brugt til nyt landskab med godkendt portrætark02 som stilreference. Original C:/Users/david/.codex/generated_images/01a0ce8d-476f-7a33-b46c-e2c0cca27abb/exec-511c8ff7-b04f-4c65-80fd-bcf29be1793b.png, kopieret public/images/race-countryside-v1.png (2172x724, 2.2MB). Ingen ekstern betalt tjeneste. RaceScene ændret til Next Image-baggrund + eksisterende SVG-racergrupper og vej; denne sidste visuelle ændring mangler lint/build/browser. Next Image laver normal weboptimering. Asset skal som binary GitHub blob; exporterens base64-output bliver for stort samlet, læs billedet i små chunks ind i functions.store uden at udskrive data. Prompt skal gemmes i designdoc før slutrapport ifølge imagegen-skill.

## Afslutning af arbejdsperioden, 24/9 05:05 UTC

Arbejdsfristen 04:26 UTC er passeret. Ingen nye funktioner påbegyndes. Midlertidig heartbeat pelotonia-otte-timers-udvikling er slettet. Sidste samlet build og lint bestået (41 routes); 23 unit tests samt kalender- og løbsintegrationerne bestået. Deltager- og administratorafvikling samtidigt giver stadig præcis én tildeling. Browserkontrol: kalender, otte ryttere/kaptajn/gemt, adminoprettelse med to separate køn, 390px mobil samt replay med færdigt landskab. Grafisk aktiv leveres gennem Next Image. Billedets Git blob 8c9c7dd85cf2d9fe0da3db7ca974c0a5ea4cd090 matcher lokal hash. Imagegen-prompt og aktiv er dokumenteret i docs/LANDSCAPE-ART.md.

Resultat: en lokal testet arbejdsversion klar til næste preview/releasekontrol. Den er endnu IKKE udgivet på tennedz.eu. Produktion og main er uændret; de to nye migrationer findes kun på testprojektet. Ingen nye abonnementer, eksterne betalte API'er eller destruktive dataændringer. Testdata beholdes som aftalt.

Begrænsninger/efterfølgende arbejde: race-vieweren optager/interpolerer eksisterende motors strategiske faser, ikke individuel fysik hvert sekund. Lokal rutehældning visualiseres; global rutespecialitet påvirker sportsmodellen. Afvikling sker ved første deltageråbning efter deadline eller administratortryk, ikke via tidsstyret cron. Kræver mindst to hold. Spildato/træning/hvile/fuldt sæsonkredsløb er ikke ændret. Spoilerkontrol gælder viewer/resultat/historik; ranglister og almindelige rytterratings er fortsat aktuelle og kan indirekte afsløre point. SVG-rytterportrætter er stadig den gratis reserve, ikke den senere individuelle betalte billedgenerering. Næste konkrete trin er preview-deploy, samlet releasekontrol og dernæst evt. additiv produktionsmigration/deploy inden for ejerens mandat. Luk ikke gamle sikre rollback-deployments og brug ikke main til rollback.
