import "server-only";
import { AuthError } from "../auth/policy.mjs";
import { rpc } from "../race/server";

// The daily autopilot scan may have completed before registration closes.
// Revisit due races on each enabled cron run; the database reveal is atomic
// and idempotent even if a manager asks for the same reveal concurrently.
export async function revealDueDivisions(db, now = new Date().toISOString()) {
  const { data: events, error: eventError } = await db.from("events")
    .select("id")
    .eq("kind", "one_day")
    .eq("status", "OPEN")
    .lte("registration_deadline", now)
    .gt("tactics_deadline", now)
    .order("registration_deadline")
    .limit(20);
  if (eventError) throw new AuthError("REVEAL_UNAVAILABLE", "Could not check due divisions.", 503);
  if (!events?.length) return { revealed: [], pending: [] };

  const ids = events.map((event) => event.id);
  const [{ data: jobs, error: jobError }, { data: committed, error: revealError }] =
    await Promise.all([
      db.from("recovery_autopilot_jobs")
        .select("event_id").in("event_id", ids).eq("status", "COMPLETE")
        .is("lease_token", null).is("lease_until", null),
      db.from("recovery_division_reveals").select("event_id").in("event_id", ids),
    ]);
  if (jobError || revealError) {
    throw new AuthError("REVEAL_UNAVAILABLE", "Could not check due divisions.", 503);
  }
  const completed = new Set((jobs || []).map((job) => job.event_id));
  const revealed = new Set((committed || []).map((row) => row.event_id));
  const result = { revealed: [], pending: [] };
  for (const event of events) {
    // The same cron invocation may already have spent 35 seconds scanning
    // automatic entries. Leave room inside its 60-second function limit.
    if (result.revealed.length >= 8) break;
    if (revealed.has(event.id)) continue;
    if (!completed.has(event.id)) {
      result.pending.push({ event_id: event.id, reason: "AUTOPILOT_PENDING" });
      continue;
    }
    try {
      const saved = await rpc(db, "recovery_commit_division_reveal", { p_event: event.id });
      result.revealed.push({ event_id: event.id, already_revealed: !!saved.alreadyRevealed });
    } catch (error) {
      if (!(error instanceof AuthError) || error.status !== 409) throw error;
      result.pending.push({ event_id: event.id, reason: "REVEAL_PENDING" });
    }
  }
  return result;
}
