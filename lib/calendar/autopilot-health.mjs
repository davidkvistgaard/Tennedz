import { AuthError } from "../auth/policy.mjs";

export function describeTwoPhaseHealth(events, jobs, reveals, now) {
  const jobByEvent = new Map(jobs.map(job => [job.event_id, job]));
  const revealed = new Set(reveals.map(reveal => reveal.event_id));
  const instant = Date.parse(now);
  return events.map(event => {
    const job = jobByEvent.get(event.id);
    const registrationClosed = Date.parse(event.registration_deadline) <= instant;
    const tacticsClosed = Date.parse(event.tactics_deadline) <= instant;
    let state;
    if (revealed.has(event.id)) state = "REVEALED";
    else if (tacticsClosed) state = "OVERDUE";
    else if (registrationClosed && job?.status !== "COMPLETE") state = "BLOCKED";
    else if (registrationClosed) state = "AWAITING_REVEAL";
    else state = job?.status === "COMPLETE" ? "SCAN_COMPLETE" : "SCANNING";
    return {
      event_id: event.id, name: event.name,
      registration_deadline: event.registration_deadline,
      tactics_deadline: event.tactics_deadline,
      state, processed: job?.processed_count ?? 0,
      entered: job?.entered_count ?? 0,
      scan_updated_at: job?.updated_at ?? null,
    };
  });
}

/** Read-only administrator view. Reject a truncated queue instead of claiming it is healthy. */
export async function twoPhaseRaceHealth(db, now = new Date().toISOString()) {
  const horizon = new Date(Date.parse(now) + 48 * 60 * 60 * 1000).toISOString();
  const { data: events, error: eventError } = await db.from("events")
    .select("id,name,registration_deadline,tactics_deadline")
    .eq("kind", "one_day").eq("status", "OPEN")
    .in("calendar_source", ["UCI", "PELOTONIA"])
    .not("registration_deadline", "is", null)
    .lte("registration_deadline", horizon)
    .order("registration_deadline").limit(101);
  if (eventError) throw new AuthError("RACE_HEALTH_UNAVAILABLE", "Could not inspect two-phase races.", 503);
  if ((events?.length ?? 0) > 100) throw new AuthError("RACE_HEALTH_TRUNCATED", "Race health scan exceeded its limit.", 503);
  if (!events?.length) return [];
  const ids = events.map(event => event.id);
  const [jobResult, revealResult] = await Promise.all([
    db.from("recovery_autopilot_jobs").select("event_id,status,processed_count,entered_count,updated_at").in("event_id", ids),
    db.from("recovery_division_reveals").select("event_id").in("event_id", ids),
  ]);
  if (jobResult.error || revealResult.error) throw new AuthError("RACE_HEALTH_UNAVAILABLE", "Could not inspect entry scans and division reveals.", 503);
  return describeTwoPhaseHealth(events, jobResult.data ?? [], revealResult.data ?? [], now);
}
