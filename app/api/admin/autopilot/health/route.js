import { NextResponse } from "next/server";
import { databaseClient, protectedRoute } from "../../../../../lib/auth/server";
import { twoPhaseRaceHealth } from "../../../../../lib/calendar/autopilot-health.mjs";

export const dynamic = "force-dynamic";

export const GET = protectedRoute(async () => {
  const enabled = process.env.PELOTONIA_AUTOPILOT_ENABLED === "true";
  return NextResponse.json({ ok: true, enabled,
    races: enabled ? await twoPhaseRaceHealth(databaseClient()) : [] });
}, { admin: true });
