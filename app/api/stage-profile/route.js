// app/api/stage-profile/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const event_id = url.searchParams.get("event_id");
    if (!event_id) return NextResponse.json({ ok: false, error: "Missing event_id" }, { status: 400 });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: ev, error: evErr } = await supabase
      .from("events")
      .select("id, stage_profile_id, name, country_code")
      .eq("id", event_id)
      .single();
    if (evErr) throw new Error(evErr.message);
    if (!ev?.stage_profile_id) {
      return NextResponse.json({ ok: false, error: "Event has no stage_profile_id" }, { status: 404 });
    }

    const { data: sp, error: spErr } = await supabase
      .from("stage_profiles")
      .select("*")
      .eq("id", ev.stage_profile_id)
      .single();
    if (spErr) throw new Error(spErr.message);

    return NextResponse.json({ ok: true, stage: sp });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
