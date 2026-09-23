# Livekontrol efter genaktivering – 23. september 2026

**Opdatering:** Det nedenfor beskrevne indgreb er efterfølgende godkendt og gennemført. Se CONTAINMENT-APPLIED.md for udførelse og verificerede resultater. Resten af dette dokument beskriver den oprindelige undersøgelse og beslutningsgrundlaget.

Supabase-projektet Tennedz blev genaktiveret efter brugerens udtrykkelige godkendelse. Status er ACTIVE_HEALTHY, og read-only SQL virker. Der er ikke ændret rækker, skema, konti eller rettigheder.

## Bekræftede oplysninger

- 28 public-tabeller, heraf 22 uden RLS.
- 2 Supabase Auth-brugere, begge e-mailbekræftede.
- 1 hold med gyldig kobling til en Supabase Auth-bruger, ingen forældreløse hold eller dublerede ejere.
- 1 bruger har intet hold. Intet nyt hold er oprettet.
- 112 ryttere.
- 1 custom-login-konto, knyttet til det eksisterende hold; 0 custom-sessioner.
- Ingen registrerede Supabase-migrationer. Det betyder ikke, at databasen aldrig er ændret; ændringerne er ikke registreret som migrationer.
- teams.user_id har en foreign key til auth.users, men ingen unik constraint. Dubletkontrollen i recovery-koden er derfor nødvendig.
- anon og authenticated har brede tabelrettigheder. En read-only transaktion med SET LOCAL ROLE anon kunne tælle den ene custom-konto og alle 112 ryttere. Passwordhashes og tokens blev ikke læst.
- Alle 8 public-funktioner er SECURITY INVOKER og kan kaldes af anon/authenticated. Service_role har også adgang.

## Foreslået sikkerhedsindgreb – ikke udført

For alle 28 eksisterende public-tabeller: fjern direkte tabelrettigheder fra PUBLIC, anon og authenticated. Slå RLS til på de 22 ubeskyttede tabeller. Fjern direkte kald til de 8 public-funktioner for de samme klientroller. Behold service_role-adgang og alle eksisterende data og politikker.

Dette lukker den direkte databasevej for browserklienter. Den nye recovery-kode bruger serverens kontrollerede adgang. Dele af den gamle produktionsside med direkte Supabase-browserkald vil blive utilgængelige, indtil recovery-koden er udrullet. Supabase Auths egne auth-tabeller ændres ikke.

Indgrebet løser ikke i sig selv de gamle usikre Vercel-API'er, der bruger service_role. De skal lukkes gennem den gennemgåede kodeudrulning eller en særskilt vedligeholdelsestilstand. Brug derfor ikke dette som bevis for, at hele produktionen er sikker.

Read-only kontrollen fandt ingen public-views, særskilte kolonnegrants eller nedarvede roller for anon/authenticated/service_role. Default privileges giver nye public-tabeller brede klientrettigheder, så fremtidige migrationsfiler skal eksplicit sikre nye objekter. Det foreslåede indgreb er afgrænset til de nuværende 28 tabeller og 8 funktioner.

Før udførelse: kontrollér at schema/ACL stadig matcher det gemte snapshot, generér migrationsfil via Supabase CLI, og indhent brugerens godkendelse til det konkrete indgreb. Snapshot er metadata, ikke en fuld databackup. SQL-forslaget er ikke afprøvet gennem ændringer i produktion; ingen DDL, heller ikke med rollback, er kørt uden godkendelse.

Efter udførelse: bekræft afvisning for anon og authenticated, bevaret service_role-adgang, uændrede rækkeantal og RLS på alle tabeller; kør Supabases sikkerhedsrådgiver igen. Ingen test med ændring eller sletning af rigtige data.

```sql
-- REVIEW ONLY: not applied. Convert to a versioned Supabase migration after approval.
-- No row changes. Existing RLS policies remain. Service-role privileges remain.
BEGIN;
SET LOCAL lock_timeout = '5s';
REVOKE ALL PRIVILEGES ON TABLE public."auth_sessions" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."countries" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."event_division_runs" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."event_divisions" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."event_rider_results" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."event_runs" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."event_stages" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."event_team_results" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."event_teams" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."events" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."first_names" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."game_state" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."last_names" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."login_accounts" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."race_feed" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."race_results" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."race_snapshots" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."races" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."riders" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."stage_orders" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."stage_points" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."stage_profiles" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."stage_results" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."stages" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."tactic_presets" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."team_riders" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."team_stage_points" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."teams" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."tactic_presets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."stages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."races" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."stage_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."race_feed" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."countries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."first_names" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."race_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."last_names" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."login_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."auth_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."stage_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_team_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_divisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_division_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_rider_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."game_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."riders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_stages" ENABLE ROW LEVEL SECURITY;
REVOKE EXECUTE ON FUNCTION public."grant_starter_pack"(p_count integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public."_pick_random_text_from_any"(candidate_tables text[], candidate_cols text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public."pick_first_name"() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public."pick_last_name"() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public."pick_nationality"() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public."pick_weighted_country"() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public."pick_weighted_name"(p_table text, p_country text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public."generate_riders"(p_count integer) FROM PUBLIC, anon, authenticated;
COMMIT;
```

ACL og tidligere RLS-status er gemt i supabase-schema-snapshot.json som grundlag for en præcis tilbagerulning. En tilbagerulning vil genåbne de eksisterende sikkerhedshuller og skal kræve særskilt godkendelse.

## Vercel

Det verificerede projekt er https://vercel.com/david-kvistgaards-projects/tennedz.
Team-id returneret af Vercel: team_qLQG1LY3YuAbUzoxOh9tzqB4.
Connectoren returnerer 403: kontoen er ikke autoriseret til dette team og skal genautoriseres til scopet david-kvistgaards-projects. get_project har desuden en parameterfejl i connectoren. Browseren er åbnet som alternativ, men kræver brugerlogin. Ingen deployment eller miljøvariabel er ændret.

## Supabases egne fund

- [Manglende RLS](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public): 22 tabeller.
- [Funktionernes search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable): 8 funktioner.
- [Password-beskyttelse](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection): kontrol mod kendte lækkede kodeord er slået fra.

Login-milepælen er fortsat ikke godkendt som færdig: rigtig auth-test i isoleret miljø, RLS-indgreb, adgang til Vercel og kontrolleret deployment mangler.
