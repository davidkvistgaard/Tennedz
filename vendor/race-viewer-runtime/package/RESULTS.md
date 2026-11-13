# Official finish results · viewer 0.44

The producer supplies results separately from animation actions. The viewer never promotes a rider to winner because they lead, celebrate or cross a painted line. A `celebrating` action animates the selected rider at its supplied time, including an intentionally early solo salute. A `throwing` action shows a bicycle throw with hands on the bars, without changing the source trajectory.

```js
feed.results = {
  publishedAt: 239.2,
  entries: [
    {riderId:'r1', status:'finished', rank:1, elapsed:238.312},
    {riderId:'r3', status:'finished', rank:2, gap:0.008},
    {riderId:'r2', status:'finished', rank:3, gap:0.040}
  ]
};
feed.actions.push({
  id:'winner-salute', riderId:'r1', start:238.5, end:240,
  state:'celebrating', celebrationStyle:'right-arm', transitionOut:1, effort:0
});
```

Action intervals for each rider must not overlap. Shorten their sprint action before adding a celebration. `celebrationStyle` defaults to `both-arms`, also accepts `left-arm` and `right-arm`. `transitionOut` optionally blends back to riding over 0–5 seconds within the interval; omitted/0 holds the reaction until the interval ends. Cadence remains source data: supply zero cadence to coast. Results may contain only a confirmed podium; DNF, DNS and DSQ entries have status but no rank. All names/team identities come from the ordinary roster.

`createSampler(feed)(time).results`, `resultsAt(feed,time)`, `ref.getResults()` and `onStats` return null before `publishedAt`. Reverse seeking hides the result again. `getSnapshot()` returns race ID, sampled time, a copied camera target, availability, camera state and results from that same sample. Each result read has independent entry objects. Presentation sorts only the explicitly supplied ranks; it computes no standings or time gaps.

`ref.focusFinish()` returns false when there is no finish metadata. Otherwise it selects a local stationary camera anchored to the supplied finish and road heading. It preserves the elevated perspective and broadcast time. Selecting a rider resumes following. The shell uses the existing header slot for the winner ribbon and the collapsed details drawer for the results list; neither opens automatically.

The example shell's Data & Integration dialog offers bunch sprint, solo salute and photo-finish exports with 150 riders. `public/finale-scenarios.html` is a browser acceptance page. These fixtures contain no race simulation and are excluded from the installable renderer.
