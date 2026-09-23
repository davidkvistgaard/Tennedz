# Vercel-adgang verificeret

Den 23. september 2026 blev forbindelsen genautoriseret af brugeren. list_teams, list_projects, list_deployments og get_deployment lykkes nu.

- Team: david-kvistgaards-projects (`team_qLQG1LY3YuAbUzoxOh9tzqB4`).
- Projekt: tennedz (`prj_hj96h4VGO6ivMq69F6cX85GnX6G2`).
- Seneste produktion: `dpl_8n2K1FkZcG32EfiW1P7SNbzwjLn6`, READY, Next.js.
- Commit: `2fb499f925c2e1a1c545e7c53386a1e1e7daccc5`, branch main.
- Produktionsdomæner omfatter tennedz.eu, www.tennedz.eu og tennedz.vercel.app.
- Ingen ny deployment eller miljøændring er udført.

get_project fejler fortsat i connectorens parameteroversættelse: idOrName modtages som undefined. Det er ikke den tidligere 403-fejl, og genautorisationen er verificeret gennem de øvrige kald. Der er endnu ikke verificeret miljøvariabler eller preview-konfiguration.

Efterfølgende er GitHub-skriveadgang genoprettet, kladde-PR #1 oprettet, og rigtig Supabase-login verificeret i et separat testprojekt. Dashboardets variabelnavne/scopes, buildindstillinger, domæner og deploymentbeskyttelse er nu læst via den autoriserede browser. Se DEPLOYMENT-PLAN.md for konkrete fund og næste godkendelsespunkt. Ingen Vercel-ændringer er udført.
