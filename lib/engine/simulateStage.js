// BUILD: MOTOR-V1.4-BATCH

import { makeFeedSpeaker } from "./feedTemplates";

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function hashToSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round1(x) {
  return Math.round(x * 10) / 10;
}

function parsePlan(plan) {
  const p = plan || {};
  return {
    risk: p.risk || "medium",
    style: p.style || "balanced",
    focus: p.focus || "balanced",
    energy_policy: p.energy_policy || "normal"
  };
}

function terrainKey(terrain) {
  const t = String(terrain || "").toLowerCase();
  if (t.includes("cobbl")) return "cobbles";
  if (t.includes("gravel")) return "gravel";
  if (t.includes("mount") || t.includes("climb")) return "mountain";
  if (t.includes("hill")) return "hills";
  return "flat";
}

function getSegmentAtKm(segments, km) {
  let cum = 0;
  for (const s of segments || []) {
    const len = Number(s.km || 0);
    if (len <= 0) continue;
    const start = cum;
    const end = cum + len;
    if (km >= start && km < end) return { seg: s, start, end };
    cum = end;
  }
  return { seg: { terrain: "flat", wind_exposure: 0.5 }, start: 0, end: km + 1 };
}

function shouldTickAtKm(profile, km, distance) {
  const step = Number(profile?.decision_every_km || 5);
  if (distance != null && km >= Math.max(0, Math.floor(distance) - 5)) return true;
  if (km === 0) return true;
  if (km % step === 0) return true;
  const kp = profile?.key_points || [];
  return kp.some((p) => Number(p.km) === Number(km));
}

function s(skills, name, fallback = 50) {
  return Number(skills?.[name] ?? fallback);
}

function defaultOrders() {
  return {
    name: "Default",
    team_plan: { risk: "medium", style: "balanced", focus: "balanced", energy_policy: "normal" },
    roles: { captain: null, sprinter: null, rouleur: null },
    riders: {}
  };
}

function normalizeOrders(o) {
  const base = defaultOrders();
  const out = { ...base, ...(o || {}) };
  out.team_plan = parsePlan(out.team_plan || {});
  out.roles = out.roles || { captain: null, sprinter: null, rouleur: null };
  out.riders = out.riders || {};
  return out;
}

function modeForRider(orders, rider_id) {
  const m = orders?.riders?.[rider_id]?.mode;
  if (m === "pull" || m === "protect_captain" || m === "leadout" || m === "opportunist") return m;
  return "normal";
}

function effortForRider(orders, rider_id) {
  const n = Number(orders?.riders?.[rider_id]?.effort);
  if (Number.isFinite(n)) return clamp(n, 0.3, 1.0);
  return 0.6;
}

// Stage Stress Index (0..1)
// Low on flat/no wind, high on wind/cobbles/mountain/rain/long distance
function computeSSI({ terrain, wind_ms, exposure, rain, distance_km }) {
  const terr = terrainKey(terrain);
  const wind = clamp(Number(wind_ms || 0) / 15, 0, 1);
  const exp = clamp(Number(exposure ?? 0.5), 0, 1);

  let terrStress = 0.12; // baseline
  if (terr === "flat") terrStress = 0.10;
  if (terr === "hills") terrStress = 0.28;
  if (terr === "mountain") terrStress = 0.55;
  if (terr === "cobbles") terrStress = 0.48;
  if (terr === "gravel") terrStress = 0.42;

  const windStress = wind * exp * 0.55;
  const rainStress = rain ? 0.12 : 0;

  const dist = clamp((Number(distance_km || 150) - 120) / 180, 0, 1); // longer -> more stress
  const distStress = 0.10 * dist;

  const ssi = clamp(terrStress + windStress + rainStress + distStress, 0, 1);
  return ssi;
}

function riderPower(skills, terrain, contextMult) {
  const terr = terrainKey(terrain);

  const Sprint = s(skills, "Sprint");
  const Flat = s(skills, "Flat");
  const Hills = s(skills, "Hills");
  const Mountain = s(skills, "Mountain");
  const Cobbles = s(skills, "Cobbles");
  const Endurance = s(skills, "Endurance");
  const Strength = s(skills, "Strength");
  const Wind = s(skills, "Wind");
  const Timetrial = s(skills, "Timetrial");
  const Moral = s(skills, "Moral");
  const Luck = s(skills, "Luck");
  const Form = s(skills, "Form");

  let base = 0;
  if (terr === "flat") base = 0.50 * Flat + 0.20 * Endurance + 0.10 * Timetrial + 0.10 * Wind + 0.10 * Strength;
  if (terr === "hills") base = 0.55 * Hills + 0.30 * Endurance + 0.15 * Moral;
  if (terr === "mountain") base = 0.60 * Mountain + 0.30 * Endurance + 0.10 * Moral;
  if (terr === "cobbles") base = 0.52 * Cobbles + 0.22 * Endurance + 0.10 * Wind + 0.08 * Luck + 0.08 * Strength;
  if (terr === "gravel") base = 0.46 * Flat + 0.18 * Strength + 0.18 * Endurance + 0.10 * Luck + 0.08 * Wind;

  const formMult = 0.95 + 0.10 * clamp(Form, 0, 100) / 100;
  const moralMult = 0.97 + 0.06 * clamp(Moral, 0, 100) / 100;
  const luckMult = 0.98 + 0.06 * ((clamp(Luck, 0, 100) - 50) / 50);

  return base * formMult * moralMult * luckMult * (contextMult || 1);
}

function countTeamInBreak(breakaway, riderById, team_id) {
  if (!breakaway) return 0;
  let c = 0;
  for (const id of breakaway.rider_ids) {
    const r = riderById.get(id);
    if (r && r.team_id === team_id) c++;
  }
  return c;
}

export function simulateStage({
  stageDistanceKm,
  profile,
  segments,
  teams,
  weather,
  seedString,
  ordersByTeam
}) {
  const rng = mulberry32(hashToSeed(seedString));
  const distance = Number(stageDistanceKm || profile?.distance_km || 150);

  // Names
  const teamNameById = new Map((teams || []).map((t) => [t.team_id, t.team_name || t.team_id]));
  const riderNameById = new Map();
  for (const t of teams || []) {
    for (const r of t.riders || []) {
      if (r?.rider_id) riderNameById.set(r.rider_id, r.rider_name || r.rider_id);
    }
  }
  const speaker = makeFeedSpeaker({ rng, teamNameById, riderNameById });

  // Baseline speed (simple)
  let baseSpeed = 44.0;
  baseSpeed -= 2.0 * clamp(Number(weather?.wind_speed_ms || 0) / 15, 0, 1) * 0.7;
  if (weather?.rain) baseSpeed -= 0.8;
  baseSpeed = clamp(baseSpeed, 37.5, 48.0);

  const leaderBaseTime = (distance / baseSpeed) * 3600;

  // Riders state
  const riders = [];
  for (const t of teams) {
    for (const r of t.riders) {
      riders.push({
        team_id: t.team_id,
        rider_id: r.rider_id,
        skills: r.skills,
        energy: 100,
        status: "ok"
      });
    }
  }
  const riderById = new Map(riders.map((x) => [x.rider_id, x]));

  // Groups (gap_sec relative, more negative = ahead)
  const peloton = { id: "G0", type: "peloton", gap_sec: 0, rider_ids: riders.map((x) => x.rider_id) };
  let breakaway = null;
  let chase = null;

  const feed = [];
  const snapshots = [];

  function getTeamOrders(team_id) {
    return normalizeOrders(ordersByTeam?.[team_id] || defaultOrders());
  }
  function rolesForTeam(team_id) {
    const o = getTeamOrders(team_id);
    return {
      captain: o.roles?.captain || null,
      sprinter: o.roles?.sprinter || null,
      rouleur: o.roles?.rouleur || null
    };
  }
  function riderMode(team_id, rider_id) {
    const o = getTeamOrders(team_id);
    return modeForRider(o, rider_id);
  }
  function riderEffort(team_id, rider_id) {
    const o = getTeamOrders(team_id);
    return effortForRider(o, rider_id);
  }

  function addFeed(km, type, message, payload) {
    feed.push({ km, type, message, payload: payload || null });
  }

  function snapshot(km) {
    const groups = [breakaway, peloton, chase].filter(Boolean);
    groups.sort((a, b) => Number(a.gap_sec) - Number(b.gap_sec));
    const leaderGap = groups.length ? Number(groups[0].gap_sec) : 0;

    snapshots.push({
      km,
      state: {
        km,
        groups: groups.map((g) => ({
          id: g.id,
          type: g.type,
          gap_sec: round1(Number(g.gap_sec) - leaderGap),
          riders: g.rider_ids.length
        }))
      }
    });
  }

  function drainEnergy(groupType, rider, terrain, ssi, effort) {
    const terr = terrainKey(terrain);

    // base per km (low on flat low-SSI)
    let base = 0.70 + 1.00 * ssi;
    if (terr === "mountain") base += 0.40;
    if (terr === "cobbles" || terr === "gravel") base += 0.28;

    // effort drives cost (tradeoff)
    base *= (0.75 + 0.75 * effort);

    // group stress: break/chase costs more
    if (groupType === "break") base *= 1.22;
    if (groupType === "chase") base *= 1.15;

    // endurance reduces cost
    const Endurance = clamp(s(rider.skills, "Endurance"), 0, 100);
    base *= (1.08 - 0.22 * (Endurance / 100));

    // sprinter saves in peloton
    const roles = rolesForTeam(rider.team_id);
    if (groupType === "peloton" && roles.sprinter && rider.rider_id === roles.sprinter) base *= 0.82;

    // leadout burns a bit in last 3 km (handled by terrain=flat, but add tiny)
    const mode = riderMode(rider.team_id, rider.rider_id);
    if (mode === "leadout") base *= 1.06;

    rider.energy = clamp(rider.energy - base, 0, 100);
  }

  // Crosswind split only when SSI is meaningful
  function maybeCrosswindSplit(km, seg, ssi) {
    const wind = Number(weather?.wind_speed_ms || 0);
    const exposure = clamp(Number(seg?.wind_exposure ?? 0.5), 0, 1);

    if (wind < 6) return; // no real split in no-wind days
    if (ssi < 0.25) return;

    const terr = terrainKey(seg?.terrain);
    if (terr !== "flat" && terr !== "cobbles" && terr !== "gravel") return;

    const p = clamp((wind / 15) * exposure * 0.22 * (0.5 + 0.9 * ssi), 0, 0.18);
    if (rng() > p) return;

    const pelIds = [...peloton.rider_ids];
    if (pelIds.length < 12) return;

    // strongest + wind-resistant stay in front
    pelIds.sort((a, b) => {
      const ra = riderById.get(a);
      const rb = riderById.get(b);
      const pa = riderPower(ra.skills, seg.terrain, 1) + 0.30 * s(ra.skills, "Wind") + 0.10 * ra.energy;
      const pb = riderPower(rb.skills, seg.terrain, 1) + 0.30 * s(rb.skills, "Wind") + 0.10 * rb.energy;
      return pb - pa;
    });

    const frontN = Math.max(8, Math.floor(pelIds.length * (0.55 + rng() * 0.10)));
    peloton.rider_ids = pelIds.slice(0, frontN);
    const back = pelIds.slice(frontN);

    chase = { id: "G2", type: "chase", gap_sec: peloton.gap_sec + (10 + rng() * 25) * (0.6 + 0.9 * ssi), rider_ids: back };

    const gap = Math.round(chase.gap_sec - peloton.gap_sec);
    addFeed(km, "crosswind_split", speaker.say("crosswind_split", { km, gap }), { gap_sec: gap });
  }

  function pickFrontPullers(team_id, terrain, maxN = 2) {
    // Pick best strength+endurance from that team in peloton
    const list = peloton.rider_ids
      .map((id) => riderById.get(id))
      .filter((r) => r && r.team_id === team_id && r.energy > 10);

    list.sort((a, b) => {
      const pa = 0.60 * s(a.skills, "Strength") + 0.40 * s(a.skills, "Endurance") + 0.10 * a.energy;
      const pb = 0.60 * s(b.skills, "Strength") + 0.40 * s(b.skills, "Endurance") + 0.10 * b.energy;
      return pb - pa;
    });

    const picked = list.slice(0, maxN).map((r) => speaker.riderName(r.rider_id));
    return picked.join(" & ");
  }

  function chooseChaseLeaderTeam(terrain, kmLeft, ssi) {
    // Determine which team is most motivated to chase (not having riders in break)
    const candidates = [];
    for (const t of teams) {
      const team_id = t.team_id;
      const o = getTeamOrders(team_id);
      const plan = parsePlan(o.team_plan);

      const inBreak = countTeamInBreak(breakaway, riderById, team_id);
      if (inBreak > 0) continue; // do not chase own break (auto)

      let score = 1.0;
      const focus = plan.focus;

      // base: sprint and gc_safe chase more; break chase less
      if (focus === "sprint") score += 0.35;
      if (focus === "gc_safe") score += 0.22;
      if (focus === "break") score -= 0.15;

      // closer to finish -> more chase
      if (kmLeft < 40) score += 0.20;
      if (kmLeft < 20) score += 0.20;

      // stress: in high SSI, fewer teams can commit
      score *= (0.95 + 0.35 * (1 - ssi));

      // rouleur helps on flat/cobbles
      const roles = rolesForTeam(team_id);
      if (roles.rouleur && peloton.rider_ids.includes(roles.rouleur)) score += 0.10;

      score += rng() * 0.05;
      candidates.push({ team_id, score });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.team_id || null;
  }

  function pelotonPullIndex(terrain, ssi) {
    // collective pull from riders who are willing: pull-mode, rouleurs, plus motivated teams
    const ids = peloton.rider_ids;
    if (!ids.length) return 1.0;

    const terr = terrainKey(terrain);
    const sample = ids.slice(0, Math.min(36, ids.length));

    let sum = 0;
    for (const id of sample) {
      const r = riderById.get(id);
      if (!r) continue;

      const Strength = clamp(s(r.skills, "Strength"), 0, 100);
      const Endurance = clamp(s(r.skills, "Endurance"), 0, 100);
      const energyMult = 0.55 + 0.45 * (clamp(r.energy, 0, 100) / 100);

      let pull = (0.60 * Strength + 0.40 * Endurance) / 100;
      pull *= energyMult;

      const o = getTeamOrders(r.team_id);
      const plan = parsePlan(o.team_plan);

      // don't chase own break
      const inBreak = countTeamInBreak(breakaway, riderById, r.team_id);
      if (inBreak > 0) {
        // passive contribution, but still "sits in"
        pull *= 0.35;
      } else {
        // motivated focus
        if (plan.focus === "sprint") pull *= 1.10;
        if (plan.focus === "gc_safe") pull *= 1.06;
        if (plan.focus === "break") pull *= 0.95;
      }

      // mode
      const mode = modeForRider(o, r.rider_id);
      if (mode === "pull") pull *= 1.18;
      if (mode === "protect_captain") pull *= 1.08;

      // rouleur role (flat/cobbles)
      const roles = rolesForTeam(r.team_id);
      if (roles.rouleur && r.rider_id === roles.rouleur && terr !== "mountain") pull *= 1.20;

      // in high stress, pulling is harder
      pull *= (0.95 + 0.10 * (1 - ssi));

      sum += pull;
    }

    const avg = sum / Math.max(1, sample.length);
    const sizeMult = Math.sqrt(clamp(ids.length / 60, 0.5, 1.6));
    return clamp(0.75 + 0.95 * avg, 0.6, 1.75) * sizeMult;
  }

  function maybeAttack(km, seg, kmLeft, ssi) {
    if (kmLeft < 8) return; // no "random attacks" in last 8 km; finale script takes over

    const terr = seg?.terrain || "flat";
    const terrK = terrainKey(terr);

    let p = 0.06;
    if (terrK === "flat") p = 0.06;
    if (terrK === "hills") p = 0.09;
    if (terrK === "mountain") p = 0.12;
    if (terrK === "cobbles" || terrK === "gravel") p = 0.10;

    // if break already exists, fewer new attacks
    if (breakaway) p *= 0.55;

    // stress can increase chaos a bit, but not on calm flat day
    p *= (0.65 + 0.9 * ssi);

    if (rng() > clamp(p, 0.02, 0.18)) return;

    // pick 1-4 attackers
    const n = breakaway ? 1 : (2 + Math.floor(rng() * 3));
    const candidates = peloton.rider_ids
      .map((id) => riderById.get(id))
      .filter((r) => r && r.status === "ok" && r.energy > 22);

    candidates.sort((a, b) => {
      const oa = riderMode(a.team_id, a.rider_id) === "opportunist" ? 1.08 : 1.0;
      const ob = riderMode(b.team_id, b.rider_id) === "opportunist" ? 1.08 : 1.0;
      const pa = riderPower(a.skills, terr, oa) + 0.12 * a.energy;
      const pb = riderPower(b.skills, terr, ob) + 0.12 * b.energy;
      return pb - pa;
    });

    const top = candidates.slice(0, Math.min(26, candidates.length));
    const attackers = [];
    while (attackers.length < n && top.length) {
      attackers.push(top.splice(Math.floor(rng() * top.length), 1)[0]);
    }
    if (!attackers.length) return;

    const hero = attackers[0];
    addFeed(km, "attack_started", speaker.say("attack_started", { km, rider: speaker.riderName(hero.rider_id) }), {
      rider_id: hero.rider_id
    });

    if (!breakaway) {
      breakaway = { id: "G1", type: "break", gap_sec: peloton.gap_sec - (12 + rng() * 22), rider_ids: [] };
      const gap = Math.round(peloton.gap_sec - breakaway.gap_sec);
      // move attackers
      for (const r of attackers) {
        peloton.rider_ids = peloton.rider_ids.filter((x) => x !== r.rider_id);
        breakaway.rider_ids.push(r.rider_id);
      }
      addFeed(km, "break_formed", speaker.say("break_formed", { km, gap, riders: breakaway.rider_ids.length }), {
        gap_sec: gap,
        riders: breakaway.rider_ids.length
      });
    } else {
      for (const r of attackers) {
        peloton.rider_ids = peloton.rider_ids.filter((x) => x !== r.rider_id);
        breakaway.rider_ids.push(r.rider_id);
      }
    }

    // sometimes: climb pressure text on hills/mountain
    if ((terrK === "hills" || terrK === "mountain") && rng() < 0.35) {
      const names = attackers.slice(0, 2).map((x) => speaker.riderName(x.rider_id)).join(" og ");
      addFeed(km, "climb_pressure", speaker.say("climb_pressure", { km, names }), { names });
    }
  }

  function maybeChase(km, seg, kmLeft, ssi) {
    if (!breakaway) return;

    const terr = seg?.terrain || "flat";
    const pullIndex = pelotonPullIndex(terr, ssi);

    // break strength
    let breakStrength = 0;
    for (const id of breakaway.rider_ids) {
      const r = riderById.get(id);
      breakStrength += riderPower(r.skills, terr, 1) * (0.60 + 0.40 * (r.energy / 100));
    }
    breakStrength /= Math.max(1, breakaway.rider_ids.length);

    // peloton strength
    let pelStrength = 0;
    for (const id of peloton.rider_ids) {
      const r = riderById.get(id);
      pelStrength += riderPower(r.skills, terr, 1) * (0.65 + 0.35 * (r.energy / 100));
    }
    pelStrength /= Math.max(1, peloton.rider_ids.length);

    // gap evolves: if pullIndex high -> gap shrinks
    const randomDrift = (rng() - 0.5) * (6 + 8 * ssi);
    const strengthDiff = (breakStrength - pelStrength) * 0.05;
    const collectivePull = (pullIndex - 1.0) * (6.2 + 6.0 * (1 - ssi)); // on calm day, pulling works better

    // delta positive = break increases, negative = peloton gains
    let delta = randomDrift + strengthDiff - collectivePull;
    if (kmLeft < 30) delta -= 2.2;
    if (kmLeft < 15) delta -= 1.4;

    delta = clamp(delta, -26, 26);
    breakaway.gap_sec = breakaway.gap_sec + (-delta);

    // feed about chase leadership / passive teams
    if (rng() < 0.16) {
      const leadTeamId = chooseChaseLeaderTeam(terr, kmLeft, ssi);

      if (leadTeamId) {
        const team = speaker.teamName(leadTeamId);
        const names = pickFrontPullers(leadTeamId, terr, 2) || "et par ryttere";
        const gap = Math.round(peloton.gap_sec - breakaway.gap_sec);
        addFeed(km, "peloton_chasing", speaker.say("peloton_chasing", { km, team, names, gap }), {
          lead_team_id: leadTeamId,
          gap_sec: gap
        });
      } else {
        // if many teams have riders in the break, peloton is more passive
        const candidatesPassive = teams
          .map((t) => t.team_id)
          .filter((tid) => countTeamInBreak(breakaway, riderById, tid) > 0);

        const tid = candidatesPassive.length ? candidatesPassive[Math.floor(rng() * candidatesPassive.length)] : null;
        if (tid) {
          const inBreak = countTeamInBreak(breakaway, riderById, tid);
          addFeed(km, "peloton_passive", speaker.say("peloton_passive", { km, team: speaker.teamName(tid), inBreak }), { team_id: tid, in_break: inBreak });
        }
      }
    }

    // caught?
    const gapNow = peloton.gap_sec - breakaway.gap_sec;
    if (gapNow <= 4) {
      peloton.rider_ids.push(...breakaway.rider_ids);
      breakaway = null;
      addFeed(km, "break_caught", speaker.say("break_caught", { km, kmLeft }), { km_left: kmLeft });
    }
  }

  function maybeProtectCaptain(km, seg, kmLeft, ssi) {
    // only meaningful in stress or late race; otherwise captain won't "drop" on calm flat
    if (!chase) return;
    if (ssi < 0.28 && kmLeft > 20) return;

    // If a team's captain is in chase, send 2 helpers back (text + small effect)
    for (const t of teams) {
      const team_id = t.team_id;
      const roles = rolesForTeam(team_id);
      const cap = roles.captain;
      if (!cap) continue;
      if (!chase.rider_ids.includes(cap)) continue;

      // pick helpers from peloton
      const helpers = peloton.rider_ids
        .map((id) => riderById.get(id))
        .filter((r) => r && r.team_id === team_id && r.rider_id !== cap)
        .filter((r) => r.energy > 12)
        .sort((a, b) => {
          const pa = 0.60 * s(a.skills, "Strength") + 0.40 * s(a.skills, "Endurance") + 0.10 * a.energy;
          const pb = 0.60 * s(b.skills, "Strength") + 0.40 * s(b.skills, "Endurance") + 0.10 * b.energy;
          return pb - pa;
        })
        .slice(0, 2);

      if (!helpers.length) continue;

      // Move helpers into chase group (they "drop back")
      for (const h of helpers) {
        peloton.rider_ids = peloton.rider_ids.filter((x) => x !== h.rider_id);
        chase.rider_ids.push(h.rider_id);
      }

      const helperNames = helpers.map((x) => speaker.riderName(x.rider_id)).join(" og ");
      addFeed(
        km,
        "helpers_drop_back",
        speaker.say("helpers_drop_back", { km, team: speaker.teamName(team_id), captain: speaker.riderName(cap), helpers: helperNames }),
        { team_id, captain_id: cap, helpers: helpers.map((x) => x.rider_id) }
      );

      // Small gap reduction effect
      chase.gap_sec = Math.max(peloton.gap_sec + 6, chase.gap_sec - (3.0 + rng() * 5.0) * (0.7 + 0.8 * ssi));
    }
  }

  function handleDrops(terrain, ssi, kmLeft) {
    // Important realism:
    // On flat calm day (low SSI), riders should almost never be "dropped" into chase.
    // We only allow real drops when SSI is high OR late race with some stress.
    const allowDrop = (ssi > 0.35) || (kmLeft < 20 && ssi > 0.25);

    if (!allowDrop) return;

    // riders with very low energy can fall into chase
    for (const id of [...peloton.rider_ids]) {
      const r = riderById.get(id);
      if (!r) continue;
      if (r.energy > 7) continue;

      if (!chase) chase = { id: "G2", type: "chase", gap_sec: peloton.gap_sec + (8 + rng() * 12) * (0.6 + 0.9 * ssi), rider_ids: [] };
      peloton.rider_ids = peloton.rider_ids.filter((x) => x !== id);
      chase.rider_ids.push(id);
    }
  }

  const finaleFlags = { k5: false, k4: false, k3: false, k2: false, k1: false, k0: false };

  function scenarioText(kmLeft) {
    if (breakaway) return "Udbruddet kæmper stadig foran.";
    if (chase) return "Frontgruppen er lille, og jagten prøver at komme tilbage.";
    return "Alt peger mod en massespurt.";
  }

  // MAIN LOOP
  for (let km = 0; km <= Math.floor(distance); km++) {
    if (!shouldTickAtKm(profile, km, distance)) continue;

    const kmLeft = Math.max(0, Math.floor(distance) - km);
    const { seg } = getSegmentAtKm(segments, km);

    const ssi = computeSSI({
      terrain: seg?.terrain || "flat",
      wind_ms: weather?.wind_speed_ms || 0,
      exposure: seg?.wind_exposure ?? 0.5,
      rain: !!weather?.rain,
      distance_km: distance
    });

    // Crosswind splits only with wind + stress
    maybeCrosswindSplit(km, seg, ssi);

    // Attacks / chase (not in last 8 km)
    maybeAttack(km, seg, kmLeft, ssi);
    maybeChase(km, seg, kmLeft, ssi);

    // Captain protection (only matters in stress/late)
    maybeProtectCaptain(km, seg, kmLeft, ssi);

    // Finale timeline (each km last 5)
    if (kmLeft === 5 && !finaleFlags.k5) {
      finaleFlags.k5 = true;
      addFeed(km, "finale_5", speaker.say("finale_5", { km, scenario: scenarioText(kmLeft) }), { km_left: 5 });
    }
    if (kmLeft === 4 && !finaleFlags.k4) {
      finaleFlags.k4 = true;
      addFeed(km, "finale_4", speaker.say("finale_4", { km, scenario: scenarioText(kmLeft) }), { km_left: 4 });
    }
    if (kmLeft === 3 && !finaleFlags.k3) {
      finaleFlags.k3 = true;
      addFeed(km, "finale_3", speaker.say("finale_3", { km, scenario: scenarioText(kmLeft) }), { km_left: 3 });
    }
    if (kmLeft === 2 && !finaleFlags.k2) {
      finaleFlags.k2 = true;
      addFeed(km, "finale_2", speaker.say("finale_2", { km, scenario: scenarioText(kmLeft) }), { km_left: 2 });
    }
    if (kmLeft === 1 && !finaleFlags.k1) {
      finaleFlags.k1 = true;
      addFeed(km, "finale_1", speaker.say("finale_1", { km, scenario: scenarioText(kmLeft) }), { km_left: 1 });
    }
    if (kmLeft === 0 && !finaleFlags.k0) {
      finaleFlags.k0 = true;
      addFeed(km, "finish_line", speaker.say("finish_line", { km }), { km_left: 0 });
    }

    // Energy drain
    const groups = [
      breakaway ? { g: breakaway, type: "break" } : null,
      { g: peloton, type: "peloton" },
      chase ? { g: chase, type: "chase" } : null
    ].filter(Boolean);

    for (const wrap of groups) {
      for (const id of wrap.g.rider_ids) {
        const r = riderById.get(id);
        if (!r || r.status !== "ok") continue;

        const o = getTeamOrders(r.team_id);
        const eff = effortForRider(o, r.rider_id);

        // extra penalty for high effort in high stress = tradeoff (drop-risk)
        const effortPenalty = (eff - 0.6) * clamp(ssi * 1.2, 0, 1);
        drainEnergy(wrap.type, r, seg?.terrain || "flat", ssi, eff + effortPenalty);
      }
    }

    // Drops only when it makes sense (SSI-gated)
    handleDrops(seg?.terrain || "flat", ssi, kmLeft);

    // snapshot
    snapshot(km);
  }

  // FINISH: compute group times + sprint within group
  const groupsAtFinish = [breakaway, peloton, chase].filter(Boolean);
  groupsAtFinish.sort((a, b) => Number(a.gap_sec) - Number(b.gap_sec));
  const leaderGap = groupsAtFinish.length ? Number(groupsAtFinish[0].gap_sec) : 0;

  // Leadout/sprinter context in peloton sprint
  function sprintContextMultiplier(team_id, rider_id) {
    const o = getTeamOrders(team_id);
    const roles = rolesForTeam(team_id);
    let mult = 1.0;

    // sprinter bonus
    if (roles.sprinter && rider_id === roles.sprinter) mult *= 1.06;

    // count leadout riders still in peloton
    const teamPel = (peloton?.rider_ids || [])
      .map((id) => riderById.get(id))
      .filter((r) => r && r.team_id === team_id);

    const leadoutCount = teamPel.filter((r) => modeForRider(o, r.rider_id) === "leadout").length;
    mult *= 1.0 + clamp(leadoutCount, 0, 3) * 0.018;

    return clamp(mult, 1.0, 1.07);
  }

  const riderTimes = [];
  for (const g of groupsAtFinish) {
    const groupGap = Number(g.gap_sec) - leaderGap;
    const ids = [...g.rider_ids];

    ids.sort((a, b) => {
      const ra = riderById.get(a);
      const rb = riderById.get(b);

      const ma = sprintContextMultiplier(ra.team_id, ra.rider_id);
      const mb = sprintContextMultiplier(rb.team_id, rb.rider_id);

      const pa = riderPower(ra.skills, "flat", ma) + 0.18 * ra.energy + 0.25 * s(ra.skills, "Sprint");
      const pb = riderPower(rb.skills, "flat", mb) + 0.18 * rb.energy + 0.25 * s(rb.skills, "Sprint");
      return pb - pa;
    });

    for (let i = 0; i < ids.length; i++) {
      const r = riderById.get(ids[i]);
      const intra = i === 0 ? 0 : clamp(i * (0.20 + rng() * 0.35), 0.2, 6.0);
      const time = leaderBaseTime + groupGap + intra;
      riderTimes.push({ team_id: r.team_id, rider_id: r.rider_id, time_sec: time });
    }
  }

  riderTimes.sort((a, b) => a.time_sec - b.time_sec);
  riderTimes.forEach((x, idx) => (x.position = idx + 1));

  // Add top-3 named finish line text
  if (riderTimes.length >= 3) {
    const winner = speaker.riderName(riderTimes[0].rider_id);
    const second = speaker.riderName(riderTimes[1].rider_id);
    const third = speaker.riderName(riderTimes[2].rider_id);
    feed.push({
      km: Math.floor(distance),
      type: "sprint_top3",
      message: speaker.say("sprint_top3", { winner, second, third }),
      payload: { top3: riderTimes.slice(0, 3).map((x) => x.rider_id) }
    });
  }

  return { results: riderTimes, feed, snapshots };
}
