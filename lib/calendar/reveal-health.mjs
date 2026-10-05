import { AuthError } from "../auth/policy.mjs";

/** Keep missed reveals visible after the tactics deadline, when the due-reveal
 * RPC intentionally stops selecting them. Only the service cron calls this. */
export async function overdueDivisionReveals(db, now = new Date().toISOString()) {
  const { data: events, error: eventError } = await db.rpc(
    "recovery_overdue_division_reveals", { p_now: now });
  if (eventError) throw new AuthError("REVEAL_HEALTH_UNAVAILABLE",
    "Could not inspect overdue division reveals.", 503);
  if (!events?.length) return [];
  // Do not report a healthy run if the scan was truncated.
  if (events.length > 100) throw new AuthError("REVEAL_HEALTH_TRUNCATED",
    "Overdue division scan exceeded its limit.", 503);
  return events.map(event => event.event_id);
}
