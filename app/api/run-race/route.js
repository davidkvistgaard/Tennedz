import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { simulateStage } from "../../../lib/engine/simulateStage";

export async function POST(req) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const supabaseAdmin = createClient(url, serviceKey);

  const body = await req.json().catch(() => ({}));
  const stage_id = body.stage_id;

  if (!stage_id) {
    return NextResponse.json({ error: "Missing stage_id" }, { status: 400 });
  }

  // 1) Load stage
  const { data: stage, error: stageErr } = await supabaseAdmin
    .from("stages")
    .select("id,name,distance_km,profile")
    .eq("id", stage_id)
    .single();

  if (stageErr) return NextResponse.json({ error: stageErr.message }, { status: 500 });

  const segments = stage.profile?.segments ?? [];

  // 2) Create race row (dev klik)
  const { data: race, error: raceErr } = await supabaseAdmin
    .from("races")
    .insert({
      name: `Test run: ${stage.name}`,
      stage_id: stage.id,
      wind_speed_ms: 10,
      rain: false
    })
    .select("*")
    .single();

  if (raceErr) return NextResponse.json({ error: raceErr.message }, { status: 500 });

  // 3) Load all teams + their riders
  const { data: teams, error: teamsErr } = await supabaseAdmin.from("teams").select("id");
  if (teamsErr) return NextResponse.json({ error: teamsErr.message }, { status: 500 });

  const bundles = [];

  for (const t of teams) {
    const { data: tr, error: trErr } = await supabaseAdmin
      .from("team_riders")
      .select("rider:riders(*)")
      .eq("team_id", t.id);

    if (trErr) return NextResponse.json({ error: trErr.message }, { status: 500 });

    const riders = (tr ?? []).map((x) => {
      const rr = x.rider;
      return {
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
      };
    });

    if (riders.length > 0) bundles.push({ team_id: t.id, riders });
  }

  // 4) Run engine
  const sim = simulateStage({
    stageDistanceKm: stage.distance_km,
    segments,
    teams: bundles,
    weather: { wind_speed_ms: Number(race.wind_speed_ms), rain: !!race.rain },
    seedString: `race:${race.id}:${race.seed}`
  });

  // 5) Save results
  const rows = sim.map((r) => ({
    race_id: race.id,
    team_id: r.team_id,
    rider_id: r.rider_id,
    time_sec: r.time_sec,
    position: r.position
  }));

  const { error: insErr } = await supabaseAdmin.from("race_results").insert(rows);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    race_id: race.id,
    stage: { id: stage.id, name: stage.name },
    top10: rows.slice(0, 10)
  });
}
