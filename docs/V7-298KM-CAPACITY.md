# V7 298 km capacity probe

This is a synthetic 10-team, 80-rider **men's** fixture made from starter
profiles. It is not the entered Milano-Sanremo field, weather, kit, manager
orders, results or official classification. Run it with
`node scripts/diagnose-v7-298km-80-rider.mjs <seed> <effort> <routeSource>`.
`routeSource` is `flat` or `observed-sunday-20261111`. The latter uses a
read-only snapshot of the production game's stage profile, kept in
`scripts/observed-sunday-stage-profile-20261111.json` for repeatability.
That profile is game data, not a claim about canonical geography.

On seed `sunday-capacity-1` and an artificial flat 298 km route, all ten
teams explicitly ordered an unnamed helper rotation, no attack, selective
chase and a sprint goal. With `conserve`, V7 recorded all 23,840 rider-km
decisions and all 80 finish crossings. The viewer document had 431 frames
and was 3,484,151 JSON bytes. The V2 archive was 1,993,048 compressed bytes
and 25,515,654 uncompressed bytes. Race and viewer construction took 86.9 s,
archive encoding another 41.2 s, with peak RSS about 399 MB on the test
machine. There were 16 unresolved finish-tie observations and **no official
results**.

On the same inputs with `steady`, the recorder stopped at km 254: synthetic
team 1 rider 4 had only 0.065 reserve left before an exposed, leader-priced
kilometre. This rider was not necessarily the selected bunch leader; exposure
can arise from a paid road separation. The movement loop currently advances
the rider before pricing its complete leg. It must eventually constrain
movement by available energy or explicitly model a paid lower-intensity
continuation and resulting contact. The current failure guard remains active.

With all teams sitting in, the race correctly refuses km 1 because no team
ordered a payable front worker. A fixed named worker can also become unable
to pay later in a long race. The entry UI now permits an unnamed rotation
from the explicitly selected helper pool, while preserving strict refusal of
an unavailable named worker.

On the observed game route, the V7 recorder exposed an unrecorded pass: a
rear rider reached and exceeded the peloton front during paid motion,
without a passing choice. At the next kilometre the front-pass quote refused
the resulting inconsistent order. V8 uses shared-road V16: a rear road can
make paid contact with the peloton front but cannot pass it without an
explicit paid pass. V7 and V15 stay replayable with their old behavior.

On seed `sunday-capacity-1`, `conserve` and that observed profile, V8
completed all 23,840 decisions and 80 finish crossings. The same-seed
independent replay matched. The bounded viewer had 415 frames and was
3,323,591 JSON bytes; the V2 archive was 2,855,696 compressed bytes and
35,673,904 uncompressed bytes. Race plus viewer construction took 88.5 s,
the independent replay 44.1 s and archive encoding 57.7 s, with peak RSS
about 497 MB on the test machine. Eight unresolved finish-tie observations
remain. Server execution does not need to replay before committing, but
the measured race plus archive time of about 146 s leaves little margin
under a 180 s function limit; production duration must be checked.

The observed-route completion demonstrates route-size and archive capacity
for synthetic riders and orders. It does not validate the entered field,
submitted tactics, finish ranking, automated race dispatch or publication
on tennedz.eu. The finish currently records unresolved tie observations and
does not issue official points or awards.
