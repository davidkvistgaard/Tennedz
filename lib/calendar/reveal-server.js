import "server-only";
import { AuthError } from "../auth/policy.mjs";
import { rpc } from "../race/server";

// The daily autopilot scan may have completed before registration closes.
// Revisit due races on each enabled cron run; the database reveal is atomic
// and idempotent even if a manager asks for the same reveal concurrently.
export async function revealDueDivisions(db, now = new Date().toISOString()) {
  const due = async () => {
    const { data, error } = await db.rpc(
      "recovery_due_division_reveals", { p_now: now });
    if (error) throw new AuthError("REVEAL_UNAVAILABLE", "Could not check due divisions.", 503);
    return data ?? [];
  };
  const events = await due();
  if (!events.length) return { revealed: [], pending: [] };

  const result = { revealed: [], pending: [] };
  for (const event of events) {
    // The same cron invocation may already have spent 35 seconds scanning
    // automatic entries. Leave room inside its 60-second function limit.
    if (result.revealed.length >= 8) break;
    if (!event.autopilot_complete) {
      result.pending.push({ event_id: event.event_id, reason: "AUTOPILOT_PENDING" });
      continue;
    }
    try {
      const saved = await rpc(db, "recovery_commit_division_reveal", { p_event: event.event_id });
      result.revealed.push({ event_id: event.event_id, already_revealed: !!saved.alreadyRevealed });
    } catch (error) {
      if (!(error instanceof AuthError) || error.status !== 409) throw error;
      result.pending.push({ event_id: event.event_id, reason: "REVEAL_PENDING" });
    }
  }
  // The selector returns up to twenty races, but this request commits at most
  // eight. A second read catches the ninth (and races beyond the first twenty)
  // so the scheduler cannot report success with a due reveal still waiting.
  if (result.revealed.length >= 8) {
    const remaining = await due();
    if (remaining.length) result.pending.push({
      event_id: remaining[0].event_id, reason: "BATCH_REMAINING",
    });
  }
  return result;
}
