# Rute, tilskuere, vejr og styrt · v0.87

Dette er et præsentationslag oven på `pelotonia.viewer.v1`. Alle felter er valgfrie, så eksisterende eksporter fortsat virker. Ingen produktionsmotor, database eller atlas er ændret.

## Producentens data

```js
feed.route.surfaces = [
  {from: 0, to: 1400, type: 'asphalt'},
  {from: 1400, to: 2200, type: 'cobbles', barriers: true},
  {from: 2200, to: 3000, type: 'gravel', textureUrl: './gravel.jpg'},
  {from: 3000, to: 3500, type: 'dirt'},
];
feed.crowd = {
  enabled: true, seed: 17, backgroundSpacing: 28,
  zones: [{id:'town-square', from:1400, to:2200, kind:'iconic',
    rows:4, spacing:1, side:'both', barriers:true, rowRise:0}],
};
feed.weather = [
  {time:0, condition:'sun', wind:[1,0]},
  {time:120, condition:'rain', intensity:0.8, wind:[4,-2]},
  {time:240, condition:'sleet', intensity:0.6, wind:[7,1]},
];
feed.incidents = [{
  id:'source-crash-1', type:'mass', start:150, end:180,
  riders:[
    {riderId:'r8', fallAt:150, side:1, fallDuration:0.65,
      downUntil:165, recoveredAt:170},
    {riderId:'r9', fallAt:150.2, side:-1, causedByRiderId:'r8',
      downUntil:166, recoveredAt:172},
  ],
}];
```

Afstandene bruger samme rutestationer i meter som rytternes `distance`, også når ruten har `distanceStations`. Overfladeintervaller er sorterede, ikke overlappende og gælder `from <= distance < to`. Huller er asfalt. Billeder følger eksisterende aktivindlæsning, relative URL'er, fejlrapportering og disponering.

Vejr er absolutte, sorterede kildeøjeblikke fra tid 0; seneste gældende værdi holdes. Vind er verdens X/Z-komponenter i m/s, nedbørens intensitet 0–1. Sol, overskyet, regn og slud understøttes. Vind bevæger flag og partikler; nedbør giver skrå regn/slud, mørkere/vådere vejmateriale og ændret lys. Ingen vindkraft, vejgreb eller effekt på resultater beregnes her.

Crowd-zoner følger ruten, dens højde og leveret terræn. Almindelige strækninger får spredte tilskuere; byer, stigninger og ikoniske zoner kan få 1–5 rækker. Automatisk tætte zoner ved leverede pavésegmenter og mål kræver `crowd.enabled`. Eksisterende eksplicitte `spectators` er stadig understøttet. Tilskuere og eventbarrierer står uden for kørebanen. Åbne rækværker og lave sponsorstriber bevarer udsynet. `rowRise` er et eksplicit præsentationsvalg til eksempelvis tribuner; det ændrer ikke terrænet. En fast seed giver samme placering ved tilbagespoling. Figurer og GPU-instanser genbruges; højst 2400 genererede tilskuere i kameraets lokale område.

Målbarrierer dækker som standard de sidste 1000 meter til den leverede `finish.routeFraction`, klippet til tilgængelig geometri. `finish.barrierBefore:0` fravælger indløbet; `barrierAfter:0` fravælger udløbet. Pavéer får eventbarrierer, medmindre segmentet har `barriers:false`. Valgfrie crowd-zoner kan tilføje barrierer til andre steder. Overlappende strækninger sammenflettes. Vieweren opfinder ingen ikoniske eller kanoniske stednavne.

Styrtlisten angiver **alle** ramte ryttere, faldtid, side og eventuel genoptagelse. `causedByRiderId` skal henvise til en deltager i samme hændelse, som falder samtidig eller tidligere. Det skaber aldrig nye ofre. Fald, liggende stilling og genoptagelse bruger den fælles mand/kvinde-rig. Kilden skal selv levere afstand, sideposition, kadence, eventuel glidning, efterfølgende tab og status. Der er ingen kollisionsmotor, fysiksimulering eller løbsberegning. Uden `recoveredAt` holdes faldstillingen til hændelsens slutning; for en rytter, der udgår, skal hændelsen vare til afspilningens slutning og kilden levere status/resultat. Faldvarighed er 0.2–2 sekunder (standard 0.65). `downUntil` og `recoveredAt` definerer en tidsstyret visuel genoptagelse. Pause, fælles serverur og tilbagespoling sampler samme kildeøjeblik.

## Afprøvning

Åbn **Data & integration**, og vælg en af seks syntetiske 150-rytterdemonstrationer: Rain/cobbles, Wind/gravel, Sleet, Dirt, Single crash eller Mass crash. Vælg Men/Women først for den ønskede kategori. De oprindelige målscenarier er bevaret. Deres førudregnede demonstrationsspor er ikke inkluderet i rendererens installationspakke.

`scene-conditions-test.html` afprøver alle seks scenarier med 150 mænd og 150 kvinder, samt genoptagelse, tilbagespoling og uændrede kildedata. Automatiske test kontrollerer også 30 ryttere, valideringsfejl, crowd-grænser, barrierer, absolutte vejrpartikler, begge faldsider og alle GPU-instansers endelige matricer.

Browserkontrollen i dette miljø bruger CPU Compatibility. Den er ikke en godkendelse af GPU-lys, skygger eller ydelse på spillets målenheder. GPU-matricer og ressourcelevetid testes automatisk; en WebGL-browser og et rigtigt eksporteksempel skal stadig indgå i integrationens accepttest.
