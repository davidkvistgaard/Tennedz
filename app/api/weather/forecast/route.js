// app/api/weather/forecast/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateForecast } from "../../../../lib/weather/weatherModel";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const event_id = url.searchParams.get("event_id");
    if (!event_id) return NextResponse.json({ ok: false, error: "Missing event_id" }, { status: 400 });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: gs, error: gsErr } = await supabase
      .from("game_state")
      .select("game_date")
      .eq("id", 1)
      .single();
    if (gsErr) throw new Error(gsErr.message);

    const { data: ev, error: evErr } = await supabase
      .from("events")
      .select("id,deadline,status,country_code,weather_locked,weather_source")
      .eq("id", event_id)
      .single();
    if (evErr) throw new Error(evErr.message);

    // If locked exists, return locked
    if (ev.weather_locked) {
      return NextResponse.json({
        ok: true,
        locked: true,
        weather: ev.weather_locked,
        source: ev.weather_source || "LOCKED_SIM",
        deadline: ev.deadline
      });
    }

    // Otherwise return forecast (changes hourly until locked)
    const forecast = generateForecast({
      event_id,
      country_code: ev.country_code || "FR",
      game_date_iso: gs.game_date
    });

    return NextResponse.json({
      ok: true,
      locked: false,
      weather: forecast,
      source: forecast.source,
      deadline: ev.deadline
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
