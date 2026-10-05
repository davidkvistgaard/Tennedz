export default function DivisionReveal({ view, error, loading, myTeamId }) {
  if (error) return <p role="alert" className="form-message error">{error}</p>;
  if (loading) return <p role="status">Loading your division.</p>;
  if (!view) return null;

  const heading = {
    registration: "Registration is open",
    reveal_pending: "Divisions are being assigned",
    reveal_overdue: "Race preparation is delayed",
    preparation: "Your division is ready",
    tactics_lock_pending: "Tactics are being locked",
    tactics_locked: "Tactics are locked",
    race_due: "Waiting for the recorded race",
  }[view.phase] || "Race preparation";
  return <section className="card race-ready" aria-label="Your division">
    <h2>{heading}</h2>
    {view.phase === "reveal_pending" &&
      <p>Registration has closed. Your opponents will appear when the division reveal is saved.</p>}
    {view.phase === "reveal_overdue" &&
      <p>The division reveal was not saved before tactics closed. An administrator needs to review the automatic entry scan before this race can continue.</p>}
    {view.phase === "preparation" &&
      <p>You can adjust your lineup and orders until the tactics deadline.</p>}
    {view.phase === "tactics_lock_pending" &&
      <p>Changes are closed. The final race input is being saved.</p>}
    {(view.phase === "tactics_locked" || view.phase === "race_due") &&
      <p>Your decisions are saved. The recorded race will appear when processing is complete.</p>}
    {view.division && <>
      <p>Division {view.division.index} of {view.division.total} · {view.division.teams.length} teams</p>
      <ol aria-label="Division opponents">
        {view.division.teams.map((team) => <li key={team.team_id}>
          <strong>{team.name}{team.team_id === myTeamId ? " (your team)" : ""}</strong>
          {" · "}{team.earned_points_at_lock} ranking points at registration close
        </li>)}
      </ol>
    </>}
  </section>;
}
