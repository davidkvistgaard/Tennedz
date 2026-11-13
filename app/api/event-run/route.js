import { NextResponse } from "next/server";
import { protectedRoute } from "../../../lib/auth/server";
import { AuthError } from "../../../lib/auth/policy.mjs";
import { uuid } from "../../../lib/race/server";
import {positionRaceTargetV1} from
  '../../../lib/race/position-race-target-v1.mjs';
import { guidedReplayClockV1 } from "../../../lib/viewer/guided-replay-clock-v1.mjs";
export const GET = protectedRoute(async (req, context, auth) => {
  const url = new URL(req.url),
    id = uuid(url.searchParams.get("event_id"));
  if(positionRaceTargetV1(id,process.env))
    throw new AuthError('POSITION_RACE_VIEWER',
      'This race uses the position viewer.',404);
  const raceVersion=await auth.db.from('events')
    .select('engine_version').eq('id',id).maybeSingle();
  if(raceVersion.error)
    throw new AuthError('RUN_UNAVAILABLE',
      'Could not check the race version.',503);
  if(raceVersion.data?.engine_version===
      'physical-first-position-general-race-8')
    throw new AuthError('POSITION_RACE_VIEWER',
      'This race uses the position viewer.',404);
  const mine = await auth.db
    .from("event_divisions")
    .select("division_index")
    .eq("event_id", id)
    .eq("team_id", auth.team.id)
    .maybeSingle();
  if (mine.error)
    throw new AuthError(
      "RUN_UNAVAILABLE",
      "Could not load the division.",
      503,
    );
  if (!mine.data)
    throw new AuthError(
      "RUN_FORBIDDEN",
      "This team is not in the requested race.",
      403,
    );
  const index = Number(
    url.searchParams.get("division_index") || mine.data.division_index,
  );
  if (!Number.isInteger(index) || index < 1)
    throw new AuthError("INVALID_DIVISION", "Invalid division.", 400);
  if (index !== mine.data.division_index)
    throw new AuthError(
      "RUN_FORBIDDEN",
      "This team is not in the requested division.",
      403,
    );
  const { data, error } = await auth.db
    .from("event_division_runs")
    .select(
      "event_id,division_index,engine_version,stage_snapshot,feed,replay,created_at",
    )
    .eq("event_id", id)
    .eq("division_index", index)
    .maybeSingle();
  if (error)
    throw new AuthError(
      "RUN_UNAVAILABLE",
      "Could not load the race report.",
      503,
    );
  if (!data)
    throw new AuthError(
      "RUN_PENDING",
      "This division has not raced yet.",
      404,
    );
  let clock = null;
  if (data.replay?.version === 1 && data.replay.frames?.length >= 2) {
    try {
      clock = guidedReplayClockV1(data.replay.frames.at(-1).elapsed_sec,
        data.created_at, Date.now());
    } catch { /* Historic or incomplete recordings still expose their report. */ }
  }
  return NextResponse.json({ ok: true, run: data, team_id: auth.team.id,
    viewer_clock: clock },
  { headers: { "Cache-Control": "private, no-store" } });
});
