# V7 default entry policy

Policy version: `default-physical-entry-v1`.

This policy applies to an entered one-day position race with eight riders. It
does not enter a team or charge an entry fee. A manager can explicitly choose
**Enter with default team and tactics** before the deadline; the existing join
transaction still checks ownership, eligibility, deadline and entry fee.

At race preparation after the deadline, the game fills physical inputs only
for teams already in `event_teams` that have no saved physical input. A saved
race input is never rewritten. The fill and source audit are one transaction.

Lineup precedence:

1. An eligible, complete eight-rider lineup already entered for this event.
2. The manager's saved default lineup for this category and one-day format,
   if all eight riders remain owned and eligible.
3. A deterministic game selection from eligible owned riders, scored against
   the recorded route profile and broken by rider ID. The highest ranked rider
   is captain.

Tactic precedence:

1. A saved event-specific physical input, which prevents the fallback entirely.
2. The manager's saved default tactic for this category and one-day format.
3. The game's versioned neutral tactic: conserve effort, selective chase, no
   attack, rotate front work, and no declared sporting goal.

The policy chooses a road captain from the selected helpers by recorded
leadership, endurance and flat ratings. It supplies no scripted event, result,
position, gap, GC stake or award. The motor still decides the race. A complete
manager-entered lineup that later becomes ineligible stops with an explicit
error instead of being silently changed. An entered team with fewer than eight
eligible riders also stops; the game does not fabricate a rider.

The default lineup and tactic are reusable account settings, separated by
category. Changes made after an event deadline do not retroactively change
that event. `recovery_default_physical_entry_audit_v1` records the policy and
the source of both selections. An audit row documents the original generated
submission; subsequent manager changes to a race input remain possible before
the deadline and take precedence in the actual recording.

The current V7 position-race feature target is set by
`PELOTONIA_V7_RACE_ENABLED` and `PELOTONIA_PHYSICAL_ENTRY_EVENT_ID`.
Enabling a different event requires the normal race qualification and release
checks; this policy by itself does not enable a new motor or format.
