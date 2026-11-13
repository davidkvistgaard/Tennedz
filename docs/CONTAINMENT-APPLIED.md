# Godkendt databaseindgreb gennemført

Den 23. september 2026 godkendte produktejeren indgrebet med ordene: “Jeg godkender dette indgreb.”

Supabase-migration `20260923152022_restrict_public_client_access` er anvendt på projekt `thacsxtnycmnnpjobgiv`. CLI oprettede først filen lokalt; filnavnets version er efterfølgende tilpasset den version, Supabase faktisk registrerede ved MCP-udførelsen. SQL-indholdet er identisk med det anvendte indgreb.

## Udført

- Fjernet direkte tabelrettigheder fra PUBLIC, anon og authenticated på de 28 eksisterende public-tabeller.
- Slået RLS til på de 22 tabeller, hvor det manglede.
- Fjernet klienternes EXECUTE-adgang til de 8 eksisterende public-funktioner.
- Bevaret service_role-adgang, eksisterende politikker og alle datarækker. Ingen ændring af auth-konti eller passwords.
- Transaktionen indeholdt kontroller, der ville afbryde ændringen ved bevaret klientadgang eller mistet service_role-adgang.

## Kontroller efter udførelse

| Kontrol | Resultat |
|---|---|
| Public-tabeller med RLS | 28 af 28 |
| Tabeller med direkte anon-adgang | 0 |
| Tabeller med direkte authenticated-adgang | 0 |
| Tabeller med service_role SELECT/INSERT/UPDATE/DELETE | 28 af 28 |
| Public-funktioner, som klientroller kan kalde | 0 af 8 |
| Public-funktioner, som service_role kan kalde | 8 af 8 |
| Rækkeantal før/efter i alle 28 public-tabeller | Identiske |
| Faktisk SELECT som anon på login_accounts | Afvist med PostgreSQL 42501 |
| Faktisk SELECT som authenticated på riders | Afvist med PostgreSQL 42501 |
| Faktisk SELECT som service_role på teams/riders | Virker: 1 hold, 112 ryttere |
| Supabase migrationshistorik | Migrationen registreret |

Supabases sikkerhedsrådgiver rapporterer ikke længere ubeskyttede public-tabeller eller tabel-eksponering i GraphQL. Den rapporterer 22 informationer om RLS uden klientpolitik (tilsigtet ved serveradgang alene), 8 advarsler om funktioners search_path og en advarsel om manglende beskyttelse mod lækkede passwords. De sidste advarsler er ikke ændret af dette afgrænsede indgreb.

## Hvad mangler?

Den gamle Vercel-kode har stadig server-API'er med service_role-adgang. Indgrebet lukker direkte databaseadgang fra klientroller, men erstatter ikke deployment af recovery-kodens API-beskyttelse. Vercel-forbindelsen skal have adgang til david-kvistgaards-projects. Der er ikke deployet eller ændret miljøvariabler.

Default privileges for fremtidige public-objekter er uændrede. Nye migrationsfiler skal eksplicit sikre nye objekter. Der er endnu ikke testet rigtigt Supabase-login i et isoleret miljø. Login-milepælen er derfor fortsat åben.

Det oprindelige metadata-snapshot i supabase-schema-snapshot.json bevares som dokumentation for tidligere rettigheder; det er ikke en fuld databackup. Tilbagerulning af rettigheder vil genåbne kendte sikkerhedshuller og må ikke ske automatisk.
