// BUILD: MOTOR-V1.4-BATCH
// Runs a small stage race (default: 2 stages) and returns GC in the response.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { simulateStage } from "../../../lib/engine/simulateStage";

function toInt(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function parseProfile(profile) {
  if (!profile) return null;
  if (typeof profile === "string") {
    try { return JSON.parse(profile); } catch { return null; }
  }
  return profile;
}
function defaultOrders() {
  return {
    name: "Default",
    team_plan: { risk: "medium", style: "balanced", focus: "balanced", energy_policy: "normal" },
    roles: { captain: null, sprinter: null, rouleur: null },
    riders: {}
  };
}

async function loadBundles(supabaseAdmin) {
  const { data: teams, error: teamsErr } = await supabaseAdmin.from("teams").select("id,name,user_id");
  if (teamsErr) throw new Error("Teams load failed: " + teamsErr.message);

  const bundles = [];
  for (const t of teams ?? []) {
    const { data: tr, error: trErr } = await supabaseAdmin
      .from("team_riders")
      .select("rider:riders(*)")
      .eq("team_id", t.id);

    if (trErr) throw new Error("Team riders load failed: " + trErr.message);

    const riders = (tr ?? [])
      .map((x) => x.rider)
      .filter(Boolean)
      .map((rr) => ({
        rider_id: rr.id,
        rider_name: rr.name,
        skills: {
          Sprint: rr.sprint,
          Flat: rr.flat,
          Hills: rr.hills,
          Mountain: rr.mountain,
          Cobbles: rr.cobbles,
          Leadership: rr.leadership,
          Endurance: rr.endurance,
          Strength: rr.strength,
          Moral: rr.moral,
          Luck: rr.luck,
          Wind: rr.wind,
          Form: rr.form,
          Timetrial: rr.timetrial
        }
      }));

    if (riders.length > 0) bundles.push({ team_id: t.id, team_name: t.name, riders });
  }

  if (!bundles.length) throw new Error("No teams with riders found.");
  return bundles;
}

export async function POST(req) {
  try {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }

    const supabaseAdmin = createClient(url, serviceKey);
    const body = await req.json().catch(() => ({}));

    // Optional stage_template_ids; if absent pick newest 2 stages
    let stageIds = Array.isArray(body.stage_template_ids) ? body.stage_template_ids.filter(Boolean) : null;

    if (!stageIds || stageIds.length < 2) {
      const { data: stageList, error } = await supabaseAdmin
        .from("stages")
        .select("id,created_at")
        .order("created_at", { ascending: false })
        .limit(2);

      if (error) throw new Error("Could not auto-pick stages: " + error.message);
      stageIds = (stageList ?? []).map((x) => x.id);
      if (stageIds.length < 2) throw new Error("Need at least 2 stages in database for stage race.");
    }

    const { data: stages, error: stagesErr } = await supabaseAdmin
      .from("stages")
      .select("id,name,distance_km,profile")
      .in("id", stageIds);

    if (stagesErr) throw new Error("Stage load failed: " + stagesErr.message);

    // keep stage order as stageIds
    const stageById = new Map((stages ?? []).map((s) => [s.id, s]));
    const orderedStages = stageIds.map((id) => stageById.get(id)).filter(Boolean);
    if (orderedStages.length < 2) throw new Error("Could not load all requested stages.");

    const bundles = await loadBundles(supabaseAdmin);

    const { data: event, error: eventErr } = await supabaseAdmin
      .from("events")
      .insert({ name: `Mini stage race (${orderedStages.length} stages)`, kind: "stage_race" })
      .select("*")
      .single();
    if (eventErr) throw new Error("Event create failed: " + eventErr.message);

    // Load any existing orders per team for each created event_stage after we insert it.
    // For MVP: we’ll apply the same latest saved orders per team (if exists from a prior stage run),
    // otherwise default.
    // (Later: per-stage orders and deadlines.)
    const ordersByTeamBase = {};
    for (const b of bundles) ordersByTeamBase[b.team_id] = defaultOrders();

    // GC accumulator
    const gc = new Map(); // rider_id -> total_time_sec
    const stageWinners = [];

    for (let i = 0; i < orderedStages.length; i++) {
      const st = orderedStages[i];
      const profile = parseProfile(st.profile);
      const segments = profile?.segments ?? [];
      if (!segments.length) throw new Error("Stage has no segments defined: " + st.name);

      // simple conditions per stage: slightly different wind
      const wind = 6 + (i * 3);
      const rain = false;

      const { data: eventStage, error: esErr } = await supabaseAdmin
        .from("event_stages")
        .insert({
          event_id: event.id,
          stage_no: i + 1,
          stage_template_id: st.id,
          wind_speed_ms: wind,
          rain
        })
        .select("*")
        .single();
      if (esErr) throw new Error("Event stage create failed: " + esErr.message);

      // load saved orders for this stage if present (rare in MVP) else use base
      const { data: ordersRows } = await supabaseAdmin
        .from("stage_orders")
        .select("team_id,payload")
        .eq("event_stage_id", eventStage.id);

      const ordersByTeam = { ...ordersByTeamBase };
      if (ordersRows?.length) {
        for (const row of ordersRows) ordersByTeam[row.team_id] = row.payload || defaultOrders();
      }

      const sim = simulateStage({
        stageDistanceKm: st.distance_km,
        profile,
        segments,
        teams: bundles,
        weather: { wind_speed_ms: wind, rain },
        seedString: `event_stage:${eventStage.id}:${eventStage.seed}`,
        ordersByTeam
      });

      const results = sim?.results ?? [];
      const feed = sim?.feed ?? [];
      const snapshots = sim?.snapshots ?? [];
      if (!results.length) throw new Error("Simulation returned no results on stage: " + st.name);

      const stageRows = results.map((r) => ({
        event_stage_id: eventStage.id,
        team_id: r.team_id,
        rider_id: r.rider_id,
        time_sec: r.time_sec,
        position: r.position
      }));

      const { error: resErr } = await supabaseAdmin.from("stage_results").insert(stageRows);
      if (resErr) throw new Error("Insert stage_results failed: " + resErr.message);

      if (feed.length) {
        const feedRows = feed.map((e) => ({
          event_stage_id: eventStage.id,
          km: toInt(e.km),
          type: String(e.type || "event"),
          message: String(e.message || ""),
          payload: e.payload || null
        }));
        const { error: fErr } = await supabaseAdmin.from("race_feed").insert(feedRows);
        if (fErr) throw new Error("Insert race_feed failed: " + fErr.message);
      }

      if (snapshots.length) {
        const snapRows = snapshots.map((s) => ({
          event_stage_id: eventStage.id,
          km: toInt(s.km),
          state: s.state
        }));
        const { error: sErr } = await supabaseAdmin.from("race_snapshots").insert(snapRows);
        if (sErr) throw new Error("Insert race_snapshots failed: " + sErr.message);
      }

      // GC accumulate
      for (const r of results) {
        gc.set(r.rider_id, (gc.get(r.rider_id) || 0) + Number(r.time_sec));
      }

      // stage winner
      const winner = results.slice().sort((a, b) => a.time_sec - b.time_sec)[0];
      stageWinners.push({ stage_no: i + 1, stage_name: st.name, rider_id: winner.rider_id, time_sec: winner.time_sec });

      // return viewer id for last stage
    }

    // Prepare GC top10
    const gcRows = [...gc.entries()].map(([rider_id, total_time_sec]) => ({ rider_id, total_time_sec }));
    gcRows.sort((a, b) => a.total_time_sec - b.total_time_sec);

    const top10 = gcRows.slice(0, 10);

    return NextResponse.json({
      ok: true,
      event: { id: event.id, name: event.name, kind: event.kind },
      stages: orderedStages.map((s, idx) => ({ stage_no: idx + 1, id: s.id, name: s.name, distance_km: s.distance_km })),
      stage_winners: stageWinners,
      gc_top10: top10
    });
  } catch (e) {
    return NextResponse.json({ error: "Unhandled error: " + (e?.message ?? String(e)) }, { status: 500 });
  }
}
