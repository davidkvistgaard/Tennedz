// app/api/event/divisions/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const event_id = url.searchParams.get("event_id");
    const team_id = url.searchParams.get("team_id"); // optional

    if (!event_id) return NextResponse.json({ ok: false, error: "Missing event_id" }, { status: 400 });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: rows, error } = await supabase
      .from("event_divisions")
      .select("division_index,total_divisions,team_id")
      .eq("event_id", event_id);

    if (error) throw new Error(error.message);

    const divisions = {};
    let total_divisions = 1;
    for (const r of rows || []) {
      total_divisions = Number(r.total_divisions ?? total_divisions);
      const d = Number(r.division_index);
      divisions[d] = (divisions[d] || 0) + 1;
    }

    const list = Object.keys(divisions)
      .map(k => ({ division_index: Number(k), team_count: divisions[k] }))
      .sort((a, b) => a.division_index - b.division_index);

    let my_division = null;
    if (team_id) {
      const mine = (rows || []).find(r => r.team_id === team_id);
      my_division = mine ? Number(mine.division_index) : null;
    }

    return NextResponse.json({ ok: true, total_divisions, divisions: list, my_division });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
