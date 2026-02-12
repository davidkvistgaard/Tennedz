import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { simulateStage } from "../../../lib/engine/simulateStage";

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
    const stage_id = body.stage_id;

    if (!stage_id) {
      return NextResponse.json({ error: "Missing stage_id" }, { status: 400 });
    }

    // 1️⃣ Load stage
    const { data: stage, error: stageErr } = await supabaseAdmin
      .from("stages")
      .select("id,name,distance_km,profile")
      .eq("id", stage_id)
      .single();

    if (stageErr) {
      return NextResponse.json(
        { error: "Stage load failed: " + stageErr.message },
        { status: 500 }
      );
    }

    if (!stage) {
      return NextResponse.json(
        { error: "Stage not found" },
        { status: 404 }
      );
    }

    // 🔧 Robust parsing (profile kan være JSONB eller string)
    let profile = stage.profile;

    if (typeof profile === "string") {
      try {
        profile = JSON.parse(profile);
      } catch (e) {
        return NextResponse.json(
          { error: "Stage profile is invalid JSON" },
          { status: 500 }
        );
      }
    }

    const segments = profile?.segments ?? [];

    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { error: "Stage has no segments defined" },
        { status: 400 }
      );
    }

    // 2️⃣ Create race
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

    if (raceErr) {
      return NextResponse.json(
        { error: "Race create failed: " + raceErr.message },
        { status: 500 }
      );
    }

    // 3️⃣ Load teams + riders
    const { data: teams, error: teamsErr } = await supabaseAdmin
      .from("teams")
      .select("id");

    if (teamsErr) {
      return NextResponse.json(
        { error: "Teams load failed: " + teamsErr.message },
        { status: 500 }
      );
    }

    const bundles = [];

    for (const t of teams ?? []) {
      const { data: tr, error: trErr } = await supabaseAdmin
        .from("team_riders")
        .select("rider:riders(*)")
        .eq("team_id", t.id);

      if (trErr) {
        return NextResponse.json(
          { error: "Team riders load failed: " + trErr.message },
          { status: 500 }
        );
      }

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

      if (riders.length > 0) {
        bundles.push({ team_id: t.id, riders });
      }
    }

    if (bundles.length === 0) {
      return NextResponse.json(
        { error: "No teams with riders found. Give yourself a starter-pack first." },
        { status: 400 }
      );
    }

    // 4️⃣ Run simulation
    const sim = simulateStage({
      stageDistanceKm: stage.distance_km,
      segments,
      teams: bundles,
      weather: { wind_speed_ms: Number(race.wind_speed_ms), rain: !!race.rain },
      seedString: `race:${race.id}:${race.seed}`
    });

    if (!Array.isArray(sim) || sim.length === 0) {
      return NextResponse.json(
        { error: "Simulation returned no results" },
        { status: 500 }
      );
    }

    // 5️⃣ Save results
    const rows = sim.map((r) => ({
      race_id: race.id,
      team_id: r.team_id,
      rider_id: r.rider_id,
      time_sec: r.time_sec,
      position: r.position
    }));

    const { error: insErr } = await supabaseAdmin
      .from("race_results")
      .insert(rows);

    if (insErr) {
      return NextResponse.json(
        { error: "Insert results failed: " + insErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      race_id: race.id,
      stage: { id: stage.id, name: stage.name },
      top10: rows.slice(0, 10)
    });

  } catch (e) {
    return NextResponse.json(
      { error: "Unhandled error: " + (e?.message ?? String(e)) },
      { status: 500 }
    );
  }
}
