// app/api/game-tick/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function toISODate(d) {
  return d.toISOString().split("T")[0];
}

// GAME YEAR = 90 days
function calcGameAgeYears(birthDateStr, gameDateStr) {
  if (!birthDateStr || !gameDateStr) return null;
  const bd = new Date(birthDateStr);
  const gd = new Date(gameDateStr);
  const diffDays = Math.floor((gd - bd) / (1000 * 60 * 60 * 24));
  if (!Number.isFinite(diffDays)) return null;
  return Math.max(0, Math.floor(diffDays / 90));
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const expected = process.env.ADMIN_SECRET;
    if (!expected) return NextResponse.json({ error: "Missing ADMIN_SECRET on server" }, { status: 500 });

    const secret = body?.secret || req.headers.get("x-admin-secret") || "";
    if (secret !== expected) return NextResponse.json({ error: "Invalid admin secret" }, { status: 401 });

    const weeks = clamp(Number(body?.weeks ?? 1), 1, 12);

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: gs, error: gsErr } = await supabase
      .from("game_state")
      .select("id,game_date")
      .eq("id", 1)
      .single();
    if (gsErr) throw new Error(gsErr.message);

    const oldDate = new Date(gs.game_date);
    const newDate = new Date(oldDate);
    newDate.setDate(newDate.getDate() + weeks * 7);

    const { error: updGsErr } = await supabase
      .from("game_state")
      .update({ game_date: toISODate(newDate) })
      .eq("id", 1);
    if (updGsErr) throw new Error(updGsErr.message);

    const { data: riders, error: rErr } = await supabase
      .from("riders")
      .select(
        "id,birth_date,form,fatigue,injury_until,last_raced_on," +
          "sprint,flat,hills,mountain,cobbles,timetrial,strength,endurance,wind,leadership"
      );

    if (rErr) throw new Error(rErr.message);

    let updated = 0;

    for (const r of riders || []) {
      // age in GAME years (90-day years)
      const age = calcGameAgeYears(r.birth_date, toISODate(newDate)) ?? 25;

      const form0 = clamp(Number(r.form ?? 50), 0, 100);
      const fat0 = clamp(Number(r.fatigue ?? 0), 0, 100);

      const injuredNow = r.injury_until && new Date(r.injury_until) > newDate;

      const lastRaced = r.last_raced_on ? new Date(r.last_raced_on) : null;
      const racedThisTick = lastRaced ? lastRaced > oldDate && lastRaced <= newDate : false;

      const fatigueRecovery = injuredNow ? 30 : 18;
      let fat = clamp(fat0 - fatigueRecovery * weeks, 0, 100);

      let form = form0;
      if (injuredNow) form = clamp(form - 12 * weeks, 0, 100);
      else if (racedThisTick) form = clamp(form + 6 * weeks, 0, 100);
      else form = clamp(form - 4 * weeks, 0, 100);

      // decline after 30 GAME-years
      const over = Math.max(0, age - 30);
      const declinePerWeek = over > 0 ? Math.pow(over, 1.4) * 0.02 : 0;
      const declineTotal = declinePerWeek * weeks;

      function dec(x) {
        return clamp(Number(x ?? 0) - declineTotal, 0, 200);
      }

      const updatePayload = {
        fatigue: fat,
        form: form,
        sprint: dec(r.sprint),
        flat: dec(r.flat),
        hills: dec(r.hills),
        mountain: dec(r.mountain),
        cobbles: dec(r.cobbles),
        timetrial: dec(r.timetrial),
        strength: dec(r.strength),
        endurance: dec(r.endurance),
        wind: dec(r.wind),
        leadership: dec(r.leadership)
      };

      const { error: uErr } = await supabase.from("riders").update(updatePayload).eq("id", r.id);
      if (uErr) throw new Error(uErr.message);

      updated++;
    }

    return NextResponse.json({
      ok: true,
      weeks,
      old_game_date: toISODate(oldDate),
      new_game_date: toISODate(newDate),
      riders_updated: updated,
      note: "Game-år = 90 dage"
    });
  } catch (e) {
    return NextResponse.json({ error: "Unhandled error: " + (e?.message ?? String(e)) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}
