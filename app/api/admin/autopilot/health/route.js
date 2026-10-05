import { NextResponse } from "next/server";
import { databaseClient, protectedRoute } from "../../../../../lib/auth/server";
import { recentNoContestDecisions, twoPhaseRaceHealth } from "../../../../../lib/calendar/autopilot-health.mjs";

export const dynamic = "force-dynamic";

export const GET = protectedRoute(async () => {
  const enabled = process.env.PELOTONIA_AUTOPILOT_ENABLED === "true";
  const db = enabled ? databaseClient() : null;
  const [races, decisions] = db ? await Promise.all([
    twoPhaseRaceHealth(db), recentNoContestDecisions(db),
  ]) : [[], []];
  return NextResponse.json({ ok: true, enabled,
    races, decisions });
}, { admin: true });
