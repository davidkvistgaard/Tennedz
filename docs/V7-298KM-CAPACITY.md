# V7 298 km capacity probe

This is a synthetic 10-team, 80-rider **men's** fixture made from starter
profiles. It is not the entered Milano-Sanremo field or its saved route,
weather, kit, manager orders, results or official classification. Run it with
`node scripts/diagnose-v7-298km-80-rider.mjs <seed> <effort>`.

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

The synthetic completion demonstrates size and archive capacity only. It
does not validate Sunday's real profile, submitted tactics, finish ranking,
automated race dispatch or publication on tennedz.eu.
