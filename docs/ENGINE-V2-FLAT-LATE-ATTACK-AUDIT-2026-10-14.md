# V91: fladt angreb på sidste kilometer i syntetisk felt

Dette er en skrivefri sportslig diagnose af den versionerede `v91-finale-trial-2`, ikke en ændring af fart, jagt, resultat eller point. Den genbruger 20 fiktive hold med otte ryttere, en flad 40- eller 260-km-rute, én navngiven angrebsordre 1 km før mål og den allerede betalte solo- og kontaktfortsættelse. Alle 19 rivalmanagers har `effort: hard`, `attack: none` og enten `chase: all` eller `chase: ignore`; spillerholdet angriber og jagter ikke. Kun angriberen ændres i de parrede rækker. Ingen lead-out bestilles.

| Distance | Angriber | 19 rivaler jagter alle | 19 rivaler ignorerer |
| --- | --- | --- | --- |
| 40 km | `you-0` | Indhentet før 500 m | Præcis kontakt i sidste 100 m; ingen kendt vinder |
| 40 km | `you-6` | Solo ved mål, 0,181 s foran | Solo ved mål, 1,044 s foran |
| 40 km | `you-7` | Solo ved mål, 0,391 s foran | Solo ved mål, 1,254 s foran |
| 260 km | `you-0` | Indhentet før 500 m | Præcis kontakt i sidste 100 m; ingen kendt vinder |
| 260 km | `you-6` | Solo ved mål, 0,189 s foran | Solo ved mål, 0,898 s foran |
| 260 km | `you-7` | Solo ved mål, 0,380 s foran | Solo ved mål, 1,089 s foran |

Den parrede 40-km-prøve giver samme grene og afstande i både M og F. Fem forskellige seed-strenge for den jagtede `you-7`-prøve giver alle 0,391 s ved 40 km, fordi denne syntetiske opbygning holder rytternes evner og den relevante bevægelse ens. Fem seeds er derfor **ikke** fem uafhængige felter eller et estimat for sejrschance. En særskilt 120-km-rullende og 260-km-flad prøve gav også solo for `you-7` i begge kønskategorier; de er ikke medregnet som ekstra parrede observationer.

Jagtordren ændrer således den betalte vejforskel og kan indhente en svagere angriber. Den nuværende solofortsættelse vælger dog kun den hurtigste mulige jagthjælper i hvert 100-meterstykke (`chasers[0]`), plus en mulig separat frontrotation; 19 jagtordrer betyder altså **ikke** 19 samtidige betalte trækkere. En direkte replay af `you-7` på 40 km viser én navngiven trækker og nul frontrotationsryttere i hvert af de fem sidste 100-meterstykker. Feltets betalte fart ligger cirka 41,385 km/t mod frontens cirka 41,137 km/t; ved `ignore` er feltets passive fart cirka 40,979 km/t. Alligevel overlever to stærkere ryttere den sidste kilometer mod et frisk, fladt, samlet felt. Det strider mod den ønskede yderpol, hvor et sent angreb hen mod en stor flad spurt næsten ikke skal lykkes. Den meget lille restforskel (0,18–0,39 s) gør denne grænse særligt følsom over for endnu uafklaret hjulorden, læ, passing og organiseret sprintfart. Vi bør ikke omsætte den foreløbige linjeberegning til en officiel sejr eller justere en koefficient ud fra disse syntetiske rækker alene.

Før sportslig accept af punkt 04/11 bør en ny parret prøve bruge **forskellige** feltstyrker og hjælpertyper, frisk versus udmattet felt og uafhængig managerjagt. Den skal særskilt dokumentere den fysiske store-felt-spurt og sammenholde den med en lille udbrudsgruppe, hvor angrebsforsøg forventes. En eventuel motorændring skal have en optaget arbejds-, kontakt- og positionsforklaring og genafspilles på ældre versioner; den må ikke blot flytte den syntetiske vinderprocent mod et valgt tal.
