import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { simulateStage } from "../../../lib/engine/simulateStage";

export async function POST(req) {
  try {
    const body = await req.json();
    const { event_id } = body;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: event } = await supabase
      .from("events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (!event) throw new Error("Event not found");
    if (new Date(event.deadline) > new Date())
      throw new Error("Deadline not reached");

    const { data: eventTeams } = await supabase
      .from("event_teams")
      .select("*")
      .eq("event_id", event_id);

    const teamsWithRiders = [];

    for (const et of eventTeams) {
      const { data: riders } = await supabase
        .from("riders")
        .select("*")
        .in("id", et.selected_riders);

      teamsWithRiders.push({
        id: et.team_id,
        name: "Team",
        riders
      });
    }

    const seed = event.seed || crypto.randomUUID();

    const stage = {
      distance_km: 150,
      profile_type: "FLAT"
    };

    const sim = simulateStage({
      stage,
      teamsWithRiders,
      seed
    });

    await supabase.from("events")
      .update({ status: "FINISHED", seed })
      .eq("id", event_id);

    return NextResponse.json({
      ok: true,
      engine_version: sim.engine_version,
      results: sim.results.slice(0, 10)
    });

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
