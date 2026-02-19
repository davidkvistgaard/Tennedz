// app/api/admin/stats/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const [teams, riders, race_results] = await Promise.all([
      supabase.from("teams").select("id", { count: "exact", head: true }),
      supabase.from("riders").select("id", { count: "exact", head: true }),
      supabase.from("race_results").select("race_id", { count: "exact", head: true })
    ]);

    return NextResponse.json({
      ok: true,
      teams: teams.count ?? 0,
      riders: riders.count ?? 0,
      race_results: race_results.count ?? 0
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
