# Løbskommentering · 0.98.0

Den separate demo viser en dansk kommentarbjælke i afspilningsområdet og et udvideligt referat. Rytternavne følger kameraet uden at flytte løbstiden. Kommentarer dannes deterministisk fra `feed.events`; tidslinjen filtrerer kommende hændelser bort ved både afspilning og tilbagespoling. Officiel vindertekst kræver offentliggjorte `feed.results`.

Ingen simulering, modelkald eller tilfældig tekst ved afspilning. Kendte hændelser har faste tekstvarianter, ukendte bevarer producentens tekst. Ordre-hændelser omfortolkes ikke til gennemførte handlinger. Teksten bruger navne uden at antage køn. Demoens kendte sektortekster er oversat; importerede fritekster bevares.

Komponent: `src/viewer/Commentary.jsx`. Databehandling: `src/commentary.js`. Integrationsstatus: demo-hændelser; endnu ikke testet med Motor Lab-output. Tennedz og motoren er ikke ændret.

Validering: 281 automatiske tests bestået, produktionsbuild bestået; browserkontrol af referat, tilbagespoling og klik på rytternavn. Browserens renderer bruger CPU-kompatibilitet.
