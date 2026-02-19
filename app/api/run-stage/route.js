// app/api/run-stage/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { simulateStage } from "../../../../lib/simulateStage";

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function toISODate(d) {
  return d.toISOString().split("T")[0];
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const stageId = body?.stage_id || null;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Load game_date (real-time calendar baseline)
    let gameDate = new Date();
    try {
      const { data: gs } = await supabase.from("game_state").select("game_date").eq("id", 1).single();
      if (gs?.game_date) gameDate = new Date(gs.game_date);
    } catch {
      // ok: if RLS blocks game_state, we still run
    }

    // Load stage
    let stage = null;
    if (stageId) {
      const { data, error } = await supabase.from("stages").select("*").eq("id", stageId).single();
      if (error) throw new Error(error.message);
      stage = data;
    } else {
      const { data, error } = await supabase.from("stages").select("*").limit(1);
      if (error) throw new Error(error.message);
      stage = data?.[0] || null;
    }
    if (!stage) throw new Error("No stage found in table 'stages'.");

    // Load all teams
    const { data: teams, error: tErr } = await supabase.from("teams").select("id,name");
    if (tErr) throw new Error(tErr.message);

    // Load riders per team
    const teamsWithRiders = [];
    for (const team of teams || []) {
      const { data: tr, error: trErr } = await supabase
        .from("team_riders")
        .select("rider:riders(*)")
        .eq("team_id", team.id);

      if (trErr) throw new Error(trErr.message);

      const riders = (tr || []).map(x => x.rider).filter(Boolean);

      // If you ever allow selecting "active roster", filter here later.
      teamsWithRiders.push({ id: team.id, name: team.name, riders });
    }

    const race_id = crypto.randomUUID();

    // Simulate
    const { results, feed } = simulateStage({
      stage,
      teamsWithRiders,
      seed: `${race_id}:${stage.id}:${toISODate(gameDate)}`
    });

    // Persist results (race_results)
    // We write all riders; you can limit later.
    const rows = results.map(r => ({
      race_id,
      team_id: r.team_id,
      rider_id: r.rider_id,
      time_sec: r.time_sec,
      position: r.position
    }));

    // Clear any old by same race_id (should be none) then insert
    const { error: insErr } = await supabase.from("race_results").insert(rows);
    if (insErr) throw new Error(insErr.message);

    // ---- Phase 4: Update fatigue/form + injuries
    // Fatigue increases by stage difficulty proxy, form increases a bit if not injured.
    // Injury chance low, and severity in weeks.
    const now = new Date(gameDate);

    for (const r of results) {
      const { data: riderRow, error: rrErr } = await supabase
        .from("riders")
        .select("id,fatigue,form,injury_until")
        .eq("id", r.rider_id)
        .single();

      if (rrErr) continue;

      const currentFatigue = clamp(Number(riderRow.fatigue ?? 0), 0, 100);
      const currentForm = clamp(Number(riderRow.form ?? 50), 0, 100);

      // difficulty: longer stage => more fatigue
      const dist = Number(stage.distance_km ?? 150);
      const fatigueGain = clamp(Math.round(10 + dist * 0.08), 12, 28); // 12-28 typical
      const formGain = 3; // small

      let newFatigue = clamp(currentFatigue + fatigueGain, 0, 100);
      let newForm = currentForm;

      // Injured riders: form tends to stay low
      const stillInjured = riderRow.injury_until && new Date(riderRow.injury_until) > now;
      if (!stillInjured) newForm = clamp(currentForm + formGain, 0, 100);

      // Crash chance (very low, tune later per terrain/weather)
      let injury_until = riderRow.injury_until || null;
      const crashChance = 0.015; // 1.5% per stage per rider (MVP)
      if (!stillInjured && Math.random() < crashChance) {
        const weeks = 1 + Math.floor(Math.random() * 6); // 1-6 weeks
        const d = new Date(now);
        d.setDate(d.getDate() + weeks * 7);
        injury_until = toISODate(d);

        // Injury nukes form
        newForm = clamp(newForm - 35, 0, 100);
      }

      await supabase
        .from("riders")
        .update({
          fatigue: newFatigue,
          form: newForm,
          injury_until
        })
        .eq("id", r.rider_id);
    }

    // Return top10 with gaps
    const top10 = results.slice(0, 10).map(r => ({
      position: r.position,
      team_id: r.team_id,
      team_name: r.team_name,
      rider_id: r.rider_id,
      rider_name: r.rider_name,
      gap_text: r.gap_text,
      gap_sec: r.gap_sec
    }));

    return NextResponse.json({
      ok: true,
      race_id,
      stage: { id: stage.id, name: stage.name },
      game_date: toISODate(gameDate),
      top10,
      feed
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Unhandled error: " + (e?.message ?? String(e)) },
      { status: 500 }
    );
  }
}

// Optional: block other methods
export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}
