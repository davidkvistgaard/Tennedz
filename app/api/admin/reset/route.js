import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const expected = process.env.ADMIN_SECRET;
    if (!expected) return NextResponse.json({ error: "Missing ADMIN_SECRET on server" }, { status: 500 });
    if (!body?.secret || body.secret !== expected) return NextResponse.json({ error: "Invalid admin secret" }, { status: 401 });

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }

    const supabase = createClient(url, serviceKey);

    // Delete in safe order (child -> parent)
    const tables = [
      "race_feed",
      "race_snapshots",
      "stage_results",
      "race_results",
      "stage_orders",
      "event_stages",
      "events",
      "team_riders",
      "riders",
      "tactic_presets",
      "teams"
    ];

    for (const t of tables) {
      const { error } = await supabase.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw new Error(`Failed clearing ${t}: ${error.message}`);
    }

    return NextResponse.json({ ok: true, message: "All game tables cleared." });
  } catch (e) {
    return NextResponse.json({ error: "Unhandled error: " + (e?.message ?? String(e)) }, { status: 500 });
  }
}
