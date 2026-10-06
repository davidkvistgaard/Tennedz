import { protectedRoute } from "../../../lib/auth/server";
import { NextResponse } from "next/server";
import { entryReadiness } from "../../../lib/calendar/rhythm.mjs";
import { teamSizeFor } from "../../../lib/calendar/config.mjs";
import { pointsForResult } from "../../../lib/calendar/points.mjs";

// Upcoming entries must not disappear behind an ever-growing race archive.
// Read each bucket independently, returning only public event metadata.
const fields =
  "id,name,kind,gender,country_code,stage_profile_id,entry_fee,status,deadline,registration_deadline,tactics_deadline,calendar_source,race_tier,race_team_size,scheduled_at,source_date,calendar_pair_id";
async function handler(req, context, auth) {
  const url = new URL(req.url);
  const requested = Number(url.searchParams.get("limit") ?? 50);
  if (!Number.isInteger(requested) || requested < 1 || requested > 100)
    return NextResponse.json(
      { ok: false, error: "The race count must be a whole number between 1 and 100." },
      { status: 400 },
    );
  const now = new Date().toISOString();
  const [upcoming, pending, finished] = await Promise.all([
    auth.db
      .from("events")
      .select(fields)
      .eq("status", "OPEN")
      .gt("deadline", now)
      .order("deadline")
      .limit(requested),
    auth.db
      .from("events")
      .select(fields)
      .eq("status", "OPEN")
      .lte("deadline", now)
      .order("deadline", { ascending: false })
      .limit(requested),
    auth.db
      .from("events")
      .select(fields)
      .neq("status", "OPEN")
      .order("deadline", { ascending: false })
      .limit(requested),
  ]);
  if (upcoming.error || pending.error || finished.error)
    throw new Error("Event query failed");
  const all=[...upcoming.data,...pending.data,...finished.data];
  const ids=all.map(event=>event.id);
  const {data:entries,error:entryError}=ids.length?await auth.db.from("event_teams")
    .select("event_id,selected_riders,captain_id,orders")
    .eq("team_id",auth.team.id).in("event_id",ids):{data:[],error:null};
  if(entryError)throw new Error("Entry query failed");
  const entryByEvent=new Map(entries.map(entry=>[entry.event_id,entry]));
  const v2TacticsEnabled=process.env.RACE_LAB_ENABLED==="true"&&
    process.env.PELOTONIA_V2_TACTICS_SAVE_ENABLED==="true";
  const v2RecordingEnabled=process.env.RACE_LAB_ENABLED==="true"&&
    process.env.PELOTONIA_V2_RECORDING_ENABLED==="true";
  const [revealed,locked]=await Promise.all([
    v2TacticsEnabled&&ids.length?auth.db.from("recovery_division_reveal_entries")
      .select("event_id").eq("team_id",auth.team.id).in("event_id",ids):
      {data:[],error:null},
    v2RecordingEnabled&&ids.length?auth.db.from("recovery_v2_tactics_commits")
      .select("event_id").in("event_id",ids):{data:[],error:null},
  ]);
  if(revealed.error||locked.error)throw new Error("Private v2 race status is unavailable");
  const revealedIds=new Set(revealed.data.map(row=>row.event_id));
  const lockedIds=new Set(locked.data.map(row=>row.event_id));
  const events=all.map(event=>{
    const teamSize=teamSizeFor(event),entry=entryByEvent.get(event.id);
    const tier=event.race_tier;
    return {...event,team_size:teamSize,
      readiness:entryReadiness({...event,teamSize},entry,new Date(now)),
      team_count:entry?.selected_riders?.length??0,
      orders_ready:!!entry?.orders,
      v2_division_revealed:revealedIds.has(event.id),
      v2_tactics_locked:lockedIds.has(event.id),
      winner_points:tier?pointsForResult({tier,resultType:event.kind==="one_day"?"ONE_DAY":"GC",placing:1}):null};
  });
  return NextResponse.json({
    ok: true,
    events,
    v2_tactics_enabled:v2TacticsEnabled,
    v2_recording_enabled:v2RecordingEnabled,
    server_time: now,
  });
}
export const GET = protectedRoute(handler);
