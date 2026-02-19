import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }

    const supabaseAdmin = createClient(url, serviceKey);

    const body = await req.json().catch(() => ({}));
    const team_id = body.team_id;
    const limit = Math.min(100, Math.max(1, Number(body.limit || 25)));

    if (!team_id) return NextResponse.json({ error: "Missing team_id" }, { status: 400 });

    // Find recent stage_results for this team, then join to event_stages + stages + events
    const { data: stageRes, error: srErr } = await supabaseAdmin
      .from("stage_results")
      .select("event_stage_id,created_at")
      .eq("team_id", team_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (srErr) return NextResponse.json({ error: srErr.message }, { status: 500 });

    const ids = [...new Set((stageRes ?? []).map((x) => x.event_stage_id).filter(Boolean))];
    if (ids.length === 0) return NextResponse.json({ ok: true, rows: [] });

    const { data: stages, error: esErr } = await supabaseAdmin
      .from("event_stages")
      .select("id,stage_no,created_at,event:events(id,name),stage:stages(id,name)")
      .in("id", ids);

    if (esErr) return NextResponse.json({ error: esErr.message }, { status: 500 });

    const rows = (stages ?? [])
      .map((x) => ({
        event_stage_id: x.id,
        stage_no: x.stage_no,
        created_at: x.created_at,
        event_name: x.event?.name ?? "Event",
        stage_name: x.stage?.name ?? "Stage"
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    return NextResponse.json({ error: "Unhandled error: " + (e?.message ?? String(e)) }, { status: 500 });
  }
}
