import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const event_stage_id = body.event_stage_id;

    if (!event_stage_id) {
      return NextResponse.json({ error: "Missing event_stage_id" }, { status: 400 });
    }

    const { data: feed, error: feedErr } = await supabaseAdmin
      .from("race_feed")
      .select("km,type,message,payload,created_at")
      .eq("event_stage_id", event_stage_id)
      .order("km", { ascending: true });

    if (feedErr) return NextResponse.json({ error: "Feed load failed: " + feedErr.message }, { status: 500 });

    const { data: snaps, error: snapErr } = await supabaseAdmin
      .from("race_snapshots")
      .select("km,state")
      .eq("event_stage_id", event_stage_id)
      .order("km", { ascending: true });

    if (snapErr) return NextResponse.json({ error: "Snapshots load failed: " + snapErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, feed: feed ?? [], snapshots: snaps ?? [] });
  } catch (e) {
    return NextResponse.json({ error: "Unhandled error: " + (e?.message ?? String(e)) }, { status: 500 });
  }
}
