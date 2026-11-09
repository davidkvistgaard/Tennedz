# Motor-owned position model, first contract

The player authorized a new versioned position simulation from the start
of future races. Existing group-clock recordings remain unchanged. Their
shared kilometre checkpoint does not establish individual wheels or a
finish order, and the viewer must not backfill one.

`physical-first-position-start-1` requires its version marker to have been
committed with the race; historic inputs without it are refused. It accepts
a committed race input and an
explicit abstract grid (`laneCount`, `wheelSpacingM`, `laneStaggerM`). It
uses the existing first-kilometre paid leader plan, recorded positioning
skill and race seed to create one unique start slot per rider. The selected
first front worker occupies the first slot. The complete input, including
the grid and seed, is hashed in canonical key order; replay rejects changed
positions. These lanes are motor model coordinates, not atlas geography.

`physical-first-position-road-1` presently advances only one connected
road with the same named leader, no attack, drop or contact. Each rider
travels exactly 1,000 metres at the road's paid speed, retains their
relative slot and carries the energy and quiet-kilometre state from that
rider's paid decision. Replay rejects a changed position, energy or leader.
It records each rider's passage of a kilometre line only when that rider's
start and end positions straddle the line during a paid road interval. The
crossing clock is interpolated from the recorded road speed. On a 2 km
steady road the front worker crosses kilometre 1 in the first interval;
the riders behind cross it later, during the second interval. These
checkpoint passages are model data, not official race results.
The separate old group checkpoint may mark the front at kilometre N while
followers are still behind it in this positional model. It must not be
treated as all riders' individual crossing distance or finish time.

This is an opt-in research contract. It does not produce complete finish
crossings, official places or awards. Before it can drive the viewer or game cycle, the
motor must pay and replay leader rotations and passing, attacks, early
drops and physical contact, sprint motion and every rider's actual passage
through the finish. Full 30/150/160-rider and both-category race coverage,
same-seed calibration and hosted checks remain release requirements.

`physical-first-position-trace-1` first replays the complete existing paid
race from committed input. It then advances the separate positional
contract for each supported kilometre, records every supported checkpoint
passage, and reports the first unsupported kilometre. Only a known missing
movement contract can produce an unsupported report; unexpected energy or
position disagreement throws. Its `raceValidatedKm` and
`completedThroughKm` are deliberately separate. A fully paid race may have
only one kilometre of physically supported positions. Likewise,
`finishCrossingCoverage` counts actual individual crossings at the final
distance: a 3 km connected-road example has 1/16, since the other riders
are still behind the line when the front road clock ends. No official
classification may be inferred from that partial finish.

`physical-first-position-finish-tail-1` can settle that partial line only
after every kilometre has a supported, unchanged connected road. The
field continues at its last paid road speed for the remaining distance
between the last wheel and the finish. Every rider pays the additional
terrain-priced distance, including the front worker riding beyond the
line to keep the field sheltered until the last wheel crosses. Individual
crossing clocks are calculated from each recorded pre-tail position.
Replay rejects altered times or charges. In isolated 16- and 160-rider
tests all wheels reach the line, but the contract deliberately preserves
their previous order: no paid sprint or overtaking has happened, so these
are neither official placements nor a validated stage result. A leader
change, drop, attack or contact still prevents this settlement until its
position movement is implemented and replayed.

A focused 120 km, 160-rider flat fixture with one ordered front worker
now completes all 19,200 rider-kilometres in both the paid race replay
and the separate positional trace. Every rider passes kilometre 119 and
the paid finish tail covers 160/160 crossings. This fixture proves
whole-route continuity only for its connected-road conditions. It does
not replace the 72-case, both-category release calibration, nor does it
establish sprint results or performance in the viewer.
