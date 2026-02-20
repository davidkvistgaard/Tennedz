// app/api/event/results/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const event_id = url.searchParams.get("event_id");
    const division_index = Number(url.searchParams.get("division_index") || "1");

    if (!event_id) return NextResponse.json({ ok: false, error: "Missing event_id" }, { status: 400 });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: ev, error: evErr } = await supabase
      .from("events")
      .select("id,name,status")
      .eq("id", event_id)
      .single();
    if (evErr) throw new Error(evErr.message);

    const { data: teams, error: tErr } = await supabase
      .from("event_team_results")
      .select("team_id,division_index,total_divisions,position,time_sec,points,multiplier,teams(name)")
      .eq("event_id", event_id)
      .eq("division_index", division_index)
      .order("position", { ascending: true });
    if (tErr) throw new Error(tErr.message);

    const { data: riders, error: rErr } = await supabase
      .from("event_rider_results")
      .select("rider_id,team_id,position,time_sec,points,multiplier,riders(name),teams(name)")
      .eq("event_id", event_id)
      .eq("division_index", division_index)
      .order("position", { ascending: true })
      .limit(50);
    if (rErr) throw new Error(rErr.message);

    const total_divisions = teams?.[0]?.total_divisions ?? 1;

    return NextResponse.json({
      ok: true,
      event: ev,
      division_index,
      total_divisions,
      teams: teams || [],
      riders: riders || []
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
