# Ruteprofil — 0.86

Race details har nu fanen ROUTE med en højdeprofil. Det tidligere kort over vejens vandrette forløb er fjernet. X-aksen viser distance i kilometer, Y-aksen kildehøjder i meter. Pelotonias creme-, skovgrønne og gyldne farver samler profilen med vieweren. Start, mål, højdekurve, bjerg-/sprintmarkører og løbets aktuelle placering vises i grafikken. Expand åbner en større, tastaturbetjent visning med navne og højder. Markørvalg og udvidelse flytter ikke løbstiden eller kameramålet.

## Spillets data

`feed.route.profile` er valgfrit og versioneret:

```js
route: {
  // Eksisterende lokal 3D-geometri og eventuelle distanceStations …
  profile: {
    schemaVersion: 'pelotonia.route-profile.v1',
    startName: 'Startnavn fra spillet',
    finishName: 'Målnavn fra spillet',
    // [distance fra etapestart, højde] — begge i meter
    samples: [[0, 130], [10000, 760], [20000, 200]],
    // Etapedistance = lokal registreret rytterdistance + positionOffset
    positionOffset: 15000,
    markers: [
      {id:'summit-1',name:'Navn fra spillet',distance:10000,type:'climb',category:'2'},
      {id:'sprint-1',name:'Sprintnavn fra spillet',distance:18000,type:'sprint'}
    ]
  }
}
```

Profilen må dække hele etapen, mens 3D-geometrien kun dækker eksempelvis de sidste 500 m. `positionOffset` forbinder kildepositionerne med etapeprofilen uden at ændre dem. Sampleafstande skal stige, og højder skal være endelige tal. Der understøttes 1–20.000 samples og højst 32 markører. Markørtyper er `climb`, `sprint`, `place`; bjergkategori er valgfri og leveres eksplicit som `HC`, `1`, `2`, `3` eller `4`. Vieweren udleder hverken bjergkategorier eller stednavne.

Uden en særskilt profil samples den samme leverede vejkurve, højder og distanceStations som i 3D-scenen. Profilen stopper ved den leverede mållinje, så ekstra vej efter mål ikke forlænger etapen. Uden navne vises Start/Finish; uden markører opfindes der ingen. Den syntetiske demo har en særskilt, håndskrevet testprofil på 68,4 km, som slutter på den viste lokale vejstrækning. Den er ikke kanonisk Pelotonia-geografi.

## Indlejring

```tsx
import {RouteProfile} from '@pelotonia/race-viewer';
import '@pelotonia/race-viewer/profile.css';

<RouteProfile feed={feed} time={sharedRaceTimeSeconds} />
```

Komponenten kan anvendes ved siden af den indlejrede RaceViewer. Feedets almindelige validering kontrollerer også profilens data, før en levende scene udskiftes. Den server-sikre dataindgang har ingen browserafhængigheder.

## Afprøvning

`/route-profile-test.html` tester kildeprofil, bjerg-/sprintmarkører, udvidelse, ugyldig import og uændret fælles afspilning. `/session-integration/profile-check.html` viser profilen gennem den faktisk installerede Next.js-pakke. Profilekspansion bruger et native dialogvindue med fokusindfangning og Escape-lukning.

259 automatiserede tests er bestået. Browserprøven af kildeprofil, markører, fælles afspilning og importbevaring er bestået. Den installerede Next.js-pakke er bygget og visuelt kontrolleret med profilens eget stylesheet. Escape og fokusretur er afprøvet i den almindelige viewer.
