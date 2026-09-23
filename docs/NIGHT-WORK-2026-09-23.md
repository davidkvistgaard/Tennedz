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
