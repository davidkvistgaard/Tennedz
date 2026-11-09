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
The separate old group checkpoint may mark the front at kilometre N while
followers are still behind it in this positional model. It must not be
treated as all riders' individual crossing distance or finish time.

This is an opt-in research contract. It does not produce a line crossing,
official place or award. Before it can drive the viewer or game cycle, the
motor must pay and replay leader rotations and passing, attacks, early
drops and physical contact, sprint motion and every rider's actual passage
through the finish. Full 30/150/160-rider and both-category race coverage,
same-seed calibration and hosted checks remain release requirements.
