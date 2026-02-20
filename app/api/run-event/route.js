// app/api/run-event/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import seedrandom from "seedrandom";
import { simulateStage } from "../../../lib/engine/simulateStage";

function isUuid(x) {
  return typeof x === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
}

function hashSeed(str) {
  // deterministic seed helper
  const rng = seedrandom(String(str || "seed"));
  return String(Math.floor(rng() * 1e15));
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const event_id = body?.event_id;

    if (!isUuid(event_id)) {
      return NextResponse.json({ ok: false, error: "Missing/invalid event_id" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Load event
    const { data: event, error: eErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (eErr) throw new Error(eErr.message);
    if (!event) throw new Error("Event not found");

    const now = new Date();

    // lock rules
    if (event.status === "FINISHED") {
      // return existing run if exists
      const { data: run } = await supabase.from("event_runs").select("*").eq("event_id", event_id).single();
      return NextResponse.json({ ok: true, already_finished: true, run });
    }

    if (new Date(event.deadline) > now) {
      throw new Error("Deadline not reached yet (event still open).");
    }

    // Load participants
    const { data: etRows, error: etErr } = await supabase
      .from("event_teams")
      .select("team_id,captain_id,selected_riders")
      .eq("event_id", event_id);

    if (etErr) throw new Error(etErr.message);
    if (!etRows?.length) throw new Error("No teams joined this event.");

    // Build teamsWithRiders for engine
    const teamsWithRiders = [];
    for (const et of etRows) {
      const riderIds = Array.isArray(et.selected_riders) ? et.selected_riders : [];
      if (riderIds.length !== 8) continue;

      const { data: team, error: tErr } = await supabase
        .from("teams")
        .select("id,name")
        .eq("id", et.team_id)
        .single();

      if (tErr) throw new Error(tErr.message);

      const { data: riders, error: rErr } = await supabase
        .from("riders")
        .select("*")
        .in("id", riderIds);

      if (rErr) throw new Error(rErr.message);

      teamsWithRiders.push({
        id: team.id,
        name: team.name,
        riders: (riders || []).map(r => ({ ...r, is_captain: r.id === et.captain_id }))
      });
    }

    if (!teamsWithRiders.length) throw new Error("No valid teams (need exactly 8 selected riders each).");

    // Stage snapshot (MVP)
    // Later: connect events to real stages/stage_races; for now we simulate a flat 150
    const stage_snapshot = {
      id: "mvp-flat-150",
      name: "MVP Flat 150",
      distance_km: 150,
      profile_type: "FLAT",
      profile: {
        segments: [{ km: 150, terrain: "flat" }]
      }
    };

    const ENGINE_VERSION = event.engine_version || "2.1";
    const seed = event.seed || `${event_id}:${hashSeed(event_id)}:${ENGINE_VERSION}`;

    // Simulate
    const sim = simulateStage({
      stage: stage_snapshot,
      teamsWithRiders,
      seed
    });

    // Persist run
    const { error: upRunErr } = await supabase
      .from("event_runs")
      .upsert({
        event_id,
        seed,
        engine_version: ENGINE_VERSION,
        stage_snapshot,
        feed: sim.feed || [],
        results: sim.results || []
      });

    if (upRunErr) throw new Error(upRunErr.message);

    // Mark event finished + set seed if missing
    const { error: updEventErr } = await supabase
      .from("events")
      .update({ status: "FINISHED", seed })
      .eq("id", event_id);

    if (updEventErr) throw new Error(updEventErr.message);

    return NextResponse.json({
      ok: true,
      event_id,
      engine_version: ENGINE_VERSION,
      seed,
      top10: (sim.results || []).slice(0, 10)
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}
