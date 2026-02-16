import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { simulateStage } from "../../../lib/engine/simulateStage";

// V1 points tables (nemt at tweake senere)
const FINISH_POINTS = [25, 20, 16, 13, 11, 10, 9, 8, 7, 6]; // top 10
const KOM_POINTS = [10, 8, 6, 5, 4, 3, 2, 1]; // top 8 (kun på bjergetaper v1)

function toInt(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function parseProfile(profile) {
  if (!profile) return null;
  if (typeof profile === "string") {
    try {
      return JSON.parse(profile);
    } catch {
      return null;
    }
  }
  return profile;
}

function isMountainStage(profile) {
  const segs = profile?.segments ?? [];
  // V1: hvis nogen segmenter har terrain der indikerer bjerg
  return segs.some((s) => {
    const t = String(s.terrain ?? "").toLowerCase();
    return t.includes("mount") || t.includes("climb");
  });
}

export async function POST(req) {
  try {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(url, serviceKey);

    const body = await req.json().catch(() => ({}));
    const stage_template_id = body.stage_template_id;
    const event_kind = body.event_kind || "one_day"; // "one_day" eller "stage_race" (forberedelse)

    if (!stage_template_id) {
      return NextResponse.json({ error: "Missing stage_template_id" }, { status: 400 });
    }

    // 1) Load stage template
    const { data: stage, error: stageErr } = await supabaseAdmin
      .from("stages")
      .select("id,name,distance_km,profile")
      .eq("id", stage_template_id)
      .single();

    if (stageErr) {
      return NextResponse.json({ error: "Stage load failed: " + stageErr.message }, { status: 500 });
    }

    const profile = parseProfile(stage.profile);
    const segments = profile?.segments ?? [];
    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ error: "Stage has no segments defined" }, { status: 400 });
    }

    // 2) Create event + event_stage (dev klik: ny event hver gang)
    const { data: event, error: eventErr } = await supabaseAdmin
      .from("events")
      .insert({
        name: event_kind === "stage_race" ? `Test stage race: ${stage.name}` : `Test one-day: ${stage.name}`,
        kind: event_kind
      })
      .select("*")
      .single();

    if (eventErr) {
      return NextResponse.json({ error: "Event create failed: " + eventErr.message }, { status: 500 });
    }

    const { data: eventStage, error: eventStageErr } = await supabaseAdmin
      .from("event_stages")
      .insert({
        event_id: event.id,
        stage_no: 1,
        stage_template_id: stage.id,
        wind_speed_ms: 10,
        rain: false
      })
      .select("*")
      .single();

    if (eventStageErr) {
      return NextResponse.json({ error: "Event stage create failed: " + eventStageErr.message }, { status: 500 });
    }

    // 3) Load teams + riders
    const { data: teams, error: teamsErr } = await supabaseAdmin.from("teams").select("id");
    if (teamsErr) return NextResponse.json({ error: "Teams load failed: " + teamsErr.message }, { status: 500 });

    const bundles = [];

    for (const t of teams ?? []) {
      const { data: tr, error: trErr } = await supabaseAdmin
        .from("team_riders")
        .select("rider:riders(*)")
        .eq("team_id", t.id);

      if (trErr) return NextResponse.json({ error: "Team riders load failed: " + trErr.message }, { status: 500 });

      const riders = (tr ?? [])
        .map((x) => x.rider)
        .filter(Boolean)
        .map((rr) => ({
          rider_id: rr.id,
          skills: {
            Sprint: rr.sprint,
            Flat: rr.flat,
            Hills: rr.hills,
            Mountain: rr.mountain,
            Cobbles: rr.cobbles,
            Leadership: rr.leadership,
            Endurance: rr.endurance,
            Moral: rr.moral,
            Luck: rr.luck,
            Wind: rr.wind,
            Form: rr.form,
            Timetrial: rr.timetrial
          }
        }));

      if (riders.length > 0) bundles.push({ team_id: t.id, riders });
    }

    if (bundles.length === 0) {
      return NextResponse.json(
        { error: "No teams with riders found. Give yourself a starter-pack first." },
        { status: 400 }
      );
    }

    // 4) Run simulation
    const sim = simulateStage({
      stageDistanceKm: stage.distance_km,
      segments,
      teams: bundles,
      weather: { wind_speed_ms: Number(eventStage.wind_speed_ms), rain: !!eventStage.rain },
      seedString: `event_stage:${eventStage.id}:${eventStage.seed}`
    });

    if (!Array.isArray(sim) || sim.length === 0) {
      return NextResponse.json({ error: "Simulation returned no results" }, { status: 500 });
    }

    // 5) Save stage_results
    const stageRows = sim.map((r) => ({
      event_stage_id: eventStage.id,
      team_id: r.team_id,
      rider_id: r.rider_id,
      time_sec: r.time_sec,
      position: r.position
    }));

    const { error: resErr } = await supabaseAdmin.from("stage_results").insert(stageRows);
    if (resErr) {
      return NextResponse.json({ error: "Insert stage_results failed: " + resErr.message }, { status: 500 });
    }

    // 6) Compute & save points
    const pointsRows = [];
    const teamPoints = new Map(); // key `${team_id}|points` -> sum
    const teamKom = new Map(); // key `${team_id}|kom` -> sum

    // Finish points (points jersey)
    for (let i = 0; i < stageRows.length; i++) {
      const row = stageRows[i];
      const pos = toInt(row.position);
      const idx = pos - 1;
      if (idx >= 0 && idx < FINISH_POINTS.length) {
        const pts = FINISH_POINTS[idx];
        pointsRows.push({
          event_stage_id: eventStage.id,
          rider_id: row.rider_id,
          classification: "points",
          points: pts
        });

        const key = `${row.team_id}|points`;
        teamPoints.set(key, (teamPoints.get(key) || 0) + pts);
      }
    }

    // KOM points (kun på “mountain” stage v1)
    const doKom = isMountainStage(profile);
    if (doKom) {
      // KOM gives to top KOM_POINTS riders by stage position (V1 proxy)
      const sortedByPos = [...stageRows].sort((a, b) => toInt(a.position) - toInt(b.position));
      for (let i = 0; i < sortedByPos.length && i < KOM_POINTS.length; i++) {
        const row = sortedByPos[i];
        const pts = KOM_POINTS[i];
        pointsRows.push({
          event_stage_id: eventStage.id,
          rider_id: row.rider_id,
          classification: "kom",
          points: pts
        });

        const key = `${row.team_id}|kom`;
        teamKom.set(key, (teamKom.get(key) || 0) + pts);
      }
    }

    if (pointsRows.length > 0) {
      const { error: spErr } = await supabaseAdmin.from("stage_points").insert(pointsRows);
      if (spErr) {
        return NextResponse.json({ error: "Insert stage_points failed: " + spErr.message }, { status: 500 });
      }
    }

    // 7) Save team_stage_points (points + kom)
    const teamStageRows = [];
    for (const [key, pts] of teamPoints.entries()) {
      const [team_id] = key.split("|");
      teamStageRows.push({
        event_stage_id: eventStage.id,
        team_id,
        classification: "points",
        points: pts
      });
    }
    for (const [key, pts] of teamKom.entries()) {
      const [team_id] = key.split("|");
      teamStageRows.push({
        event_stage_id: eventStage.id,
        team_id,
        classification: "kom",
        points: pts
      });
    }

    if (teamStageRows.length > 0) {
      const { error: tspErr } = await supabaseAdmin.from("team_stage_points").insert(teamStageRows);
      if (tspErr) {
        return NextResponse.json({ error: "Insert team_stage_points failed: " + tspErr.message }, { status: 500 });
      }
    }

    // 8) Prepare response: top10 + team leaderboard
    const top10 = [...stageRows]
      .sort((a, b) => toInt(a.position) - toInt(b.position))
      .slice(0, 10);

    const teamPointsBoard = teamStageRows
      .filter((x) => x.classification === "points")
      .sort((a, b) => toInt(b.points) - toInt(a.points));

    const teamKomBoard = teamStageRows
      .filter((x) => x.classification === "kom")
      .sort((a, b) => toInt(b.points) - toInt(a.points));

    return NextResponse.json({
      ok: true,
      event: { id: event.id, name: event.name, kind: event.kind },
      event_stage: { id: eventStage.id, stage_no: eventStage.stage_no },
      stage_template: { id: stage.id, name: stage.name, distance_km: stage.distance_km, is_mountain: doKom },
      top10,
      leaderboards: {
        team_points: teamPointsBoard,
        team_kom: teamKomBoard
      }
    });
  } catch (e) {
    return NextResponse.json({ error: "Unhandled error: " + (e?.message ?? String(e)) }, { status: 500 });
  }
}
