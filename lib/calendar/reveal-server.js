import "server-only";
import { AuthError } from "../auth/policy.mjs";
import { rpc } from "../race/server";

// The daily autopilot scan may have completed before registration closes.
// Revisit due races on each enabled cron run; the database reveal is atomic
// and idempotent even if a manager asks for the same reveal concurrently.
export async function revealDueDivisions(db, now = new Date().toISOString()) {
  const { data: events, error: eventError } = await db.rpc(
    "recovery_due_division_reveals", { p_now: now });
  if (eventError) throw new AuthError("REVEAL_UNAVAILABLE", "Could not check due divisions.", 503);
  if (!events?.length) return { revealed: [], pending: [] };

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
  return result;
}
