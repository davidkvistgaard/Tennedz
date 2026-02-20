// app/api/run-event/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import seedrandom from "seedrandom";
import { simulateStage } from "../../../lib/engine/simulateStage";
import { generateLockedWeather } from "../../../lib/weather/weatherModel";

function isUuid(x) {
  return typeof x === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
}
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

const BASE_POINTS = {
  1: 100, 2: 85, 3: 75, 4: 68, 5: 62,
  6: 57, 7: 53, 8: 49, 9: 45, 10: 41,
  11: 38, 12: 35, 13: 32, 14: 29, 15: 26,
  16: 23, 17: 20, 18: 17, 19: 14, 20: 11
};

function minMult(N) {
  const x = (Math.max(1, N) - 1) / 6;
  const v = 0.62 + 0.25 * (1 - Math.exp(-x));
  return clamp(v, 0.62, 0.90);
}
function divisionMultiplier(d, N, gamma = 1.35) {
  if (N <= 1) return 1.0;
  const p = (d - 1) / (N - 1); // 0..1
  const mm = minMult(N);
  const mult = 1 - (1 - mm) * Math.pow(p, gamma);
  return clamp(mult, mm, 1.0);
}

// Seed Power for heat split (NOT rating)
function riderSeedPower(r) {
  const sprint = Number(r.sprint ?? 0);
  const flat = Number(r.flat ?? 0);
  const hills = Number(r.hills ?? 0);
  const mountain = Number(r.mountain ?? 0);
  const cobbles = Number(r.cobbles ?? 0);
  const timetrial = Number(r.timetrial ?? 0);
  const endurance = Number(r.endurance ?? 0);
  const strength = Number(r.strength ?? 0);
  const wind = Number(r.wind ?? 0);

  const form = Number.isFinite(Number(r?.form)) ? Number(r.form) : 50;
  const fatigue = Number.isFinite(Number(r?.fatigue)) ? Number(r.fatigue) : 0;

  const base =
    (sprint + flat + hills + mountain + cobbles + timetrial + endurance + strength + wind) / 9;

  const formMult = 0.85 + (form / 100) * 0.30;          // 0.85..1.15
  const fatigueMult = 1.0 - (fatigue / 100) * 0.20;     // 1..0.80

  return base * formMult * fatigueMult;
}

function hashSeed(str) {
  const rng = seedrandom(String(str || "seed"));
  return String(Math.floor(rng() * 1e15));
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const event_id = body?.event_id;

    if (!isUuid(event_id)) {
      return NextResponse.json({ ok: false, error: "Missing/invalid event_id" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const now = new Date();

    // Load game_date
    const { data: gs, error: gsErr } = await supabase
      .from("game_state")
      .select("game_date")
      .eq("id", 1)
      .single();
    if (gsErr) throw new Error(gsErr.message);

    // Load event
    const { data: event, error: eErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", event_id)
      .single();
    if (eErr) throw new Error(eErr.message);
    if (!event) throw new Error("Event not found");

    if (new Date(event.deadline) > now) {
      throw new Error("Deadline not reached yet (event still open).");
    }

    // Lock weather if missing
    let weatherLocked = event.weather_locked;
    if (!weatherLocked) {
      const locked = generateLockedWeather({
        event_id,
        country_code: event.country_code || "FR",
        game_date_iso: gs.game_date,
        deadline_iso: event.deadline
      });

      const { error: wErr } = await supabase
        .from("events")
        .update({
          weather_locked: locked,
          weather_locked_at: new Date().toISOString(),
          weather_source: locked.source
        })
        .eq("id", event_id);
      if (wErr) throw new Error(wErr.message);

      weatherLocked = locked;
    }

    // Participants
    const { data: etRows, error: etErr } = await supabase
      .from("event_teams")
      .select("team_id,captain_id,selected_riders")
      .eq("event_id", event_id);
    if (etErr) throw new Error(etErr.message);
    if (!etRows?.length) throw new Error("No teams joined this event.");

    // Compute SEED POWER (top16) for heat split
    const seedPowers = [];
    for (const et of etRows) {
      const team_id = et.team_id;

      const { data: tr, error: trErr } = await supabase
        .from("team_riders")
        .select("rider:riders(*)")
        .eq("team_id", team_id);
      if (trErr) throw new Error(trErr.message);

      const ridersAll = (tr || []).map(x => x.rider).filter(Boolean);
      const powers = ridersAll.map(r => riderSeedPower(r)).sort((a, b) => b - a);

      const top16 = powers.slice(0, 16);
      const seed_power = top16.reduce((s, v) => s + v, 0);

      seedPowers.push({ team_id, seed_power });
    }

    seedPowers.sort((a, b) => b.seed_power - a.seed_power);

    const totalTeams = seedPowers.length;
    const totalDivisions = Math.ceil(totalTeams / 20);

    const divisions = [];
    for (let i = 0; i < totalDivisions; i++) {
      divisions.push({
        division_index: i + 1,
        teams: seedPowers.slice(i * 20, i * 20 + 20)
      });
    }

    // Persist division assignment (stores seed_power in team_rating column for now)
    await supabase.from("event_divisions").delete().eq("event_id", event_id);

    const divRows = [];
    for (const div of divisions) {
      for (const t of div.teams) {
        divRows.push({
          event_id,
          team_id: t.team_id,
          division_index: div.division_index,
          total_divisions: totalDivisions,
          team_rating: t.seed_power // NOTE: this is seed_power, not points-rating
        });
      }
    }
    const { error: divInsErr } = await supabase.from("event_divisions").insert(divRows);
    if (divInsErr) throw new Error(divInsErr.message);

    // Clear old results/runs
    await supabase.from("event_division_runs").delete().eq("event_id", event_id);
    await supabase.from("event_team_results").delete().eq("event_id", event_id);
    await supabase.from("event_rider_results").delete().eq("event_id", event_id);

    // Stage snapshot MVP
    const stage_snapshot = {
      id: "mvp-stage",
      name: event.name || "MVP Stage",
      distance_km: 150,
      profile_type: "FLAT",
      profile: { segments: [{ km: 150, terrain: "flat" }] },
      country_code: (event.country_code || "FR").toUpperCase()
    };

    const ENGINE_VERSION = event.engine_version || "3.1-points-rating";
    const baseSeed = event.seed || `${event_id}:${hashSeed(event_id)}:${ENGINE_VERSION}`;

    // We’ll accumulate rating increments to apply at the end
    const teamRatingAdd = new Map();   // team_id -> points
    const riderRatingAdd = new Map();  // rider_id -> points

    for (const div of divisions) {
      const d = div.division_index;
      const mult = divisionMultiplier(d, totalDivisions);
      const divSeed = `${baseSeed}:div${d}`;

      const teamsWithRiders = [];

      for (const t of div.teams) {
        const et = etRows.find(x => x.team_id === t.team_id);
        if (!et) continue;

        const riderIds = Array.isArray(et.selected_riders) ? et.selected_riders : [];
        if (riderIds.length !== 8) continue;

        const { data: team, error: tErr } = await supabase
          .from("teams")
          .select("id,name")
          .eq("id", et.team_id)
          .single();
        if (tErr) throw new Error(tErr.message);

        const { data: riders8, error: rErr } = await supabase
          .from("riders")
          .select("*")
          .in("id", riderIds);
        if (rErr) throw new Error(rErr.message);

        teamsWithRiders.push({
          id: team.id,
          name: team.name,
          riders: (riders8 || []).map(r => ({ ...r, is_captain: r.id === et.captain_id }))
        });
      }

      if (teamsWithRiders.length < 2) continue;

      const sim = simulateStage({
        stage: stage_snapshot,
        teamsWithRiders,
        seed: divSeed,
        weather: weatherLocked
      });

      const results = sim.results || [];

      // Store run
      const { error: runErr } = await supabase
        .from("event_division_runs")
        .upsert({
          event_id,
          division_index: d,
          seed: divSeed,
          engine_version: ENGINE_VERSION,
          stage_snapshot: { ...stage_snapshot, weather_locked: weatherLocked, total_divisions: totalDivisions, division_index: d },
          feed: sim.feed || [],
          results
        });
      if (runErr) throw new Error(runErr.message);

      // Team standings based on captain (fallback best rider)
      const captainByTeam = new Map();
      for (const twr of teamsWithRiders) {
        const cap = twr.riders.find(r => r.is_captain);
        captainByTeam.set(twr.id, cap?.id || null);
      }

      const posByRider = new Map();
      for (const r of results) posByRider.set(r.rider_id, r);

      const teamRows = [];
      for (const twr of teamsWithRiders) {
        const capId = captainByTeam.get(twr.id);
        let ref = capId ? posByRider.get(capId) : null;
        if (!ref) ref = results.find(x => x.team_id === twr.id) || null;
        if (!ref) continue;

        teamRows.push({
          event_id,
          team_id: twr.id,
          division_index: d,
          total_divisions: totalDivisions,
          captain_id: capId,
          position: 9999,
          time_sec: Number(ref.time_sec ?? 0),
          multiplier: mult
        });
      }

      teamRows.sort((a, b) => a.time_sec - b.time_sec);
      teamRows.forEach((tr, idx) => {
        tr.position = idx + 1;
        const base = BASE_POINTS[tr.position] || 0;
        tr.points = Math.round(base * mult);

        // accumulate TEAM rating points
        teamRatingAdd.set(tr.team_id, (teamRatingAdd.get(tr.team_id) || 0) + tr.points);
      });

      const { error: teamResErr } = await supabase.from("event_team_results").insert(teamRows);
      if (teamResErr) throw new Error(teamResErr.message);

      // Rider points (top 20 only)
      const riderRows = results.slice(0, 300).map(rr => {
        const pos = Number(rr.position ?? 9999);
        const base = BASE_POINTS[pos] || 0;
        const pts = pos <= 20 ? Math.round(base * mult) : 0;

        if (pts > 0) {
          riderRatingAdd.set(rr.rider_id, (riderRatingAdd.get(rr.rider_id) || 0) + pts);
        }

        return {
          event_id,
          rider_id: rr.rider_id,
          team_id: rr.team_id,
          division_index: d,
          total_divisions: totalDivisions,
          position: pos,
          time_sec: Number(rr.time_sec ?? 0),
          points: pts,
          multiplier: mult
        };
      });

      const { error: riderResErr } = await supabase.from("event_rider_results").insert(riderRows);
      if (riderResErr) throw new Error(riderResErr.message);
    }

    // Apply rating increments (points) to teams + riders
    // Teams
    for (const [team_id, add] of teamRatingAdd.entries()) {
      const { data: cur, error } = await supabase
        .from("teams")
        .select("rating")
        .eq("id", team_id)
        .single();
      if (!error) {
        const next = (cur?.rating ?? 0) + add;
        await supabase.from("teams").update({ rating: next }).eq("id", team_id);
      }
    }

    // Riders
    for (const [rider_id, add] of riderRatingAdd.entries()) {
      const { data: cur, error } = await supabase
        .from("riders")
        .select("rating")
        .eq("id", rider_id)
        .single();
      if (!error) {
        const next = (cur?.rating ?? 0) + add;
        await supabase.from("riders").update({ rating: next }).eq("id", rider_id);
      }
    }

    // Mark event finished
    const { error: updEventErr } = await supabase
      .from("events")
      .update({ status: "FINISHED", seed: baseSeed, engine_version: ENGINE_VERSION })
      .eq("id", event_id);
    if (updEventErr) throw new Error(updEventErr.message);

    return NextResponse.json({
      ok: true,
      event_id,
      engine_version: ENGINE_VERSION,
      seed: baseSeed,
      total_divisions: totalDivisions,
      applied_team_rating_updates: teamRatingAdd.size,
      applied_rider_rating_updates: riderRatingAdd.size
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}
