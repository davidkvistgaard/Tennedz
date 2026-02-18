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

function pick(rng, arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(rng() * arr.length)];
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

function riskFactor(risk) {
  if (risk === "low") return 0.85;
  if (risk === "high") return 1.2;
  return 1.0;
}

function styleFactor(style) {
  if (style === "defensive") return { attack: 0.75, chase: 1.10, burn: 0.92 };
  if (style === "aggressive") return { attack: 1.25, chase: 0.95, burn: 1.10 };
  return { attack: 1.0, chase: 1.0, burn: 1.0 };
}

function focusBias(focus) {
  if (focus === "sprint") return { chase: 1.18, attack: 0.88 };
  if (focus === "break") return { chase: 0.90, attack: 1.28 };
  if (focus === "gc_safe") return { chase: 1.08, attack: 0.85 };
  if (focus === "kom") return { chase: 0.95, attack: 1.10 };
  if (focus === "chaos") return { chase: 0.92, attack: 1.12 };
  return { chase: 1.0, attack: 1.0 };
}

function terrainKey(terrain) {
  const t = String(terrain || "").toLowerCase();
  if (t.includes("cobbl")) return "cobbles";
  if (t.includes("mount") || t.includes("climb")) return "mountain";
  if (t.includes("hill")) return "hills";
  if (t.includes("final")) return "finale";
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
  if (segments && segments.length) {
    const s = segments[segments.length - 1];
    return { seg: s, start: Math.max(0, km - 1), end: km + 1 };
  }
  return { seg: { terrain: "flat", wind_exposure: 0.5 }, start: 0, end: km + 1 };
}

function isKeyPointAtKm(profile, km) {
  const kp = profile?.key_points || [];
  for (const p of kp) {
    if (Number(p.km) === Number(km)) return p;
  }
  return null;
}

function shouldTickAtKm(profile, km, distance) {
  const step = Number(profile?.decision_every_km || 5);
  if (distance != null && km >= Math.max(0, Math.floor(distance) - 5)) return true; // sidste 5 km: hver km
  if (km === 0) return true;
  if (km % step === 0) return true;
  return !!isKeyPointAtKm(profile, km);
}

function s(skills, name, fallback = 50) {
  return Number(skills?.[name] ?? fallback);
}

/**
 * Rider "power" pr terrain. Strength gives extra pull on flat/cobbles.
 */
function riderPower(skills, terrain, contextMult) {
  const k = terrainKey(terrain);

  const Sprint = s(skills, "Sprint");
  const Flat = s(skills, "Flat");
  const Hills = s(skills, "Hills");
  const Mountain = s(skills, "Mountain");
  const Cobbles = s(skills, "Cobbles");
  const Endurance = s(skills, "Endurance");
  const Strength = s(skills, "Strength"); // NEW
  const Wind = s(skills, "Wind");
  const Timetrial = s(skills, "Timetrial");
  const Moral = s(skills, "Moral");
  const Luck = s(skills, "Luck");
  const Form = s(skills, "Form");

  let base = 0;

  if (k === "flat") {
    base =
      0.50 * Flat +
      0.20 * Endurance +
      0.10 * Timetrial +
      0.10 * Wind +
      0.10 * Strength; // strength matters for raw pulling on flat
  } else if (k === "cobbles") {
    base =
      0.52 * Cobbles +
      0.22 * Endurance +
      0.10 * Wind +
      0.08 * Luck +
      0.08 * Strength; // strength helps survive and drive on cobbles
  } else if (k === "hills") {
    base = 0.55 * Hills + 0.30 * Endurance + 0.15 * Moral;
  } else if (k === "mountain") {
    base = 0.60 * Mountain + 0.30 * Endurance + 0.10 * Moral;
  } else if (k === "finale") {
    base = 0.55 * Sprint + 0.25 * Flat + 0.20 * Endurance;
  } else {
    base = 0.50 * Flat + 0.30 * Endurance + 0.20 * Wind;
  }

  const formMult = 0.95 + 0.10 * clamp(Form, 0, 100) / 100;
  const moralMult = 0.97 + 0.06 * clamp(Moral, 0, 100) / 100;
  const luckMult = 0.98 + 0.06 * ((clamp(Luck, 0, 100) - 50) / 50);

  const mult = formMult * moralMult * luckMult * (contextMult || 1);
  return base * mult;
}

function defaultOrders(team_id) {
  return {
    name: "Default balanced",
    team_plan: { risk: "medium", style: "balanced", focus: "balanced", energy_policy: "normal" },
    roles: { captain: null, sprinter: null, rouleur: null },
    riders: {}
  };
}

function makeMessage(type, ctx) {
  const { km, rng, gap, kmLeft } = ctx;

  const variants = {
    attack_started: [
      `${km} km: Et ryk i feltet – der bliver angrebet!`,
      `${km} km: En rytter prøver lykken med et angreb.`,
      `${km} km: Tempoet stiger, og et angreb bliver sat ind.`
    ],
    break_formed: [
      `${km} km: Udbruddet er etableret. Forspring: ${gap} sek.`,
      `${km} km: En gruppe slipper væk – ${gap} sek forspring.`,
      `${km} km: Udbruddet får lov at køre. ${gap} sek.`
    ],
    peloton_chasing: [
      `${km} km: Jagten strammes op bagfra.`,
      `${km} km: Feltet organiserer jagten.`,
      `${km} km: Der bliver kørt hårdt for at lukke hullet.`
    ],
    break_caught: [
      `${km} km: Udbruddet bliver hentet med ${kmLeft} km igen.`,
      `${km} km: Det er slut for udbruddet – hullet lukkes.`,
      `${km} km: Feltet er samlet igen.`
    ],
    crosswind_split: [
      `${km} km: Sidevind! Der bliver revet over, og huller opstår.`,
      `${km} km: Sidevinden splitter grupperne.`,
      `${km} km: Vinden gør ondt – det er kamp for position.`
    ],
    finish_line: [
      `${km} km: Stregen! Vi afventer målfoto og tider…`,
      `${km} km: Mål! Dommerne kigger på det…`,
      `${km} km: De kaster cyklerne på stregen!`
    ],
    sprint_result: [
      `Mål: Vinderen krydser stregen først!`,
      `Mål: Sikke en afslutning – der er en klar vinder!`,
      `Mål: Sprinten er afgjort!`
    ],

    // Finale state-aware
    finale_pos_sprint: [
      `${km} km: Positionskampen starter – alle vil sidde rigtigt til med 5 km igen.`,
      `${km} km: 5 km igen. Feltet komprimerer. Positionskamp!`
    ],
    finale_pos_break: [
      `${km} km: 5 km igen – udbruddet kæmper for at holde, mens jagten nærmer sig.`,
      `${km} km: Der er stadig et udbrud foran med 5 km igen. Jagten strammes op.`
    ],
    finale_pos_split: [
      `${km} km: 5 km igen – frontgruppen kigger hinanden an, mens bagved kæmpes der for at komme tilbage.`,
      `${km} km: Grupperne er splittet med 5 km igen. Det handler om at minimere tab.`
    ],
    finale_train_sprint: [
      `${km} km: 3 km igen. Leadout-togene tager over – tempoet eksploderer!`,
      `${km} km: 3 km igen. Tog og leadouts samler op.`
    ],
    finale_train_break: [
      `${km} km: 3 km igen – udbruddet giver alt mod stregen!`,
      `${km} km: 3 km igen. Udbruddet hænger stadig fast – det bliver tæt.`
    ],
    finale_train_split: [
      `${km} km: 3 km igen – i frontgruppen handler det om timing og position.`,
      `${km} km: 3 km igen. Frontgruppen gør klar – bagved jagter de desperat.`
    ],
    finale_launch_sprint: [
      `${km} km: 1 km igen. Sprinterne gør sig klar til at åbne!`,
      `${km} km: 1 km igen. Nu åbner sprinterne!`
    ],
    finale_launch_break: [
      `${km} km: 1 km igen – udbruddet spurter om sejren!`,
      `${km} km: 1 km igen. Det bliver en duel i udbruddet.`
    ],
    finale_launch_split: [
      `${km} km: 1 km igen – det bliver en lille gruppe-spurt i front!`,
      `${km} km: 1 km igen. Frontgruppen går i gang – det afgøres nu.`
    ]
  };

  const arr = variants[type] || [`${km} km: Noget sker…`];
  return pick(rng, arr);
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

  // Baseline speed
  let baseSpeed = 44.0;
  baseSpeed -= 2.0 * clamp(Number(weather?.wind_speed_ms || 0) / 15, 0, 1) * 0.6;
  if (weather?.rain) baseSpeed -= 0.8;
  baseSpeed = clamp(baseSpeed, 38.0, 48.0);
  const leaderBaseTime = (distance / baseSpeed) * 3600;

  // Riders
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

  const peloton = { id: "G0", type: "peloton", gap_sec: 0, rider_ids: riders.map((x) => x.rider_id) };
  let breakaway = null;
  let chase = null;

  const feed = [];
  const snapshots = [];

  const activePlanByTeam = new Map();

  function getTeamOrders(team_id) {
    return ordersByTeam?.[team_id] || defaultOrders(team_id);
  }

  function ensureTeamState(team_id) {
    if (!activePlanByTeam.has(team_id)) {
      const o = getTeamOrders(team_id);
      activePlanByTeam.set(team_id, parsePlan(o.team_plan));
    }
  }

  function effortForRider(team_id, rider_id) {
    const o = getTeamOrders(team_id);
    const rt = (o.riders && o.riders[rider_id]) || {};
    return clamp(Number(rt.effort ?? 0.6), 0.3, 1.0);
  }

  function applySchedule(team_id, km, keyPoint) {
    const o = getTeamOrders(team_id);
    const plan = activePlanByTeam.get(team_id);

    const sched = Array.isArray(o.schedule) ? o.schedule : (Array.isArray(o?.payload?.schedule) ? o.payload.schedule : []);
    for (const item of sched) {
      if (Number(item?.at_km) === Number(km) && item.apply?.team_plan) {
        activePlanByTeam.set(team_id, parsePlan({ ...plan, ...item.apply.team_plan }));
      }
    }

    const kpOverrides = o.keypoint_overrides || o?.payload?.keypoint_overrides;
    if (keyPoint && kpOverrides && kpOverrides[keyPoint.type]?.team_plan) {
      activePlanByTeam.set(team_id, parsePlan({ ...plan, ...kpOverrides[keyPoint.type].team_plan }));
    }
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

  function pickAttackersFromPeloton(terrain, count) {
    const candidates = peloton.rider_ids
      .map((id) => riderById.get(id))
      .filter((r) => r && r.status === "ok" && r.energy > 25);

    candidates.sort((a, b) => riderPower(b.skills, terrain, 1) - riderPower(a.skills, terrain, 1));

    const topChunk = candidates.slice(0, Math.min(25, candidates.length));
    const selected = [];
    while (selected.length < count && topChunk.length) {
      const idx = Math.floor(rng() * topChunk.length);
      selected.push(topChunk.splice(idx, 1)[0]);
    }
    return selected;
  }

  function teamChaseIntensity(team_id, terrain, kmLeft) {
    ensureTeamState(team_id);
    const plan = activePlanByTeam.get(team_id);
    const st = styleFactor(plan.style);
    const fb = focusBias(plan.focus);

    let distMult = kmLeft < 30 ? 1.05 : kmLeft < 70 ? 1.0 : 0.9;
    if (plan.focus === "sprint") distMult += kmLeft < 60 ? 0.12 : 0.06;
    if (plan.focus === "gc_safe") distMult += kmLeft < 60 ? 0.06 : 0.03;

    const terr = terrainKey(terrain);
    if (terr === "mountain") distMult *= 0.9;

    return 1.0 * st.chase * fb.chase * distMult;
  }

  function teamAttackIntensity(team_id, terrain, kmLeft) {
    ensureTeamState(team_id);
    const plan = activePlanByTeam.get(team_id);
    const st = styleFactor(plan.style);
    const fb = focusBias(plan.focus);

    let distMult = kmLeft < 40 ? 0.9 : kmLeft < 90 ? 1.0 : 1.05;
    if (plan.focus === "break") distMult *= 1.12;

    const terr = terrainKey(terrain);
    if (terr === "finale") distMult *= 0.80;

    return 1.0 * st.attack * fb.attack * distMult;
  }

  function drainEnergy(groupType, rider, terrain, effort, plan) {
    const terr = terrainKey(terrain);
    const st = styleFactor(plan.style);
    const rf = riskFactor(plan.risk);

    let base = 0.9;
    if (terr === "mountain") base = 1.6;
    if (terr === "cobbles") base = 1.3;
    if (terr === "finale") base = 1.1;

    if (groupType === "break") base *= 1.25;
    if (groupType === "chase") base *= 1.15;

    if (plan.energy_policy === "conserve") base *= 0.90;
    if (plan.energy_policy === "burn") base *= 1.10;

    base *= (0.75 + 0.6 * effort);
    base *= st.burn;
    base *= (0.95 + 0.12 * (rf - 1.0));

    const Endurance = clamp(s(rider.skills, "Endurance"), 0, 100);
    base *= (1.08 - 0.18 * (Endurance / 100));

    rider.energy = clamp(rider.energy - base, 0, 100);
  }

  // NEW: how strong the peloton can pull (strength+endurance+energy) => faster catch if many contribute
  function pelotonPullIndex(terrain) {
    const ids = peloton.rider_ids;
    if (!ids.length) return 1.0;

    // sample up to 30 riders for speed (still stable)
    const sample = ids.slice(0, Math.min(30, ids.length));
    let sum = 0;

    for (const id of sample) {
      const r = riderById.get(id);
      if (!r) continue;

      const Strength = clamp(s(r.skills, "Strength"), 0, 100);
      const Endurance = clamp(s(r.skills, "Endurance"), 0, 100);
      const energy = clamp(r.energy, 0, 100);

      // pulling ability (flat/cobbles benefit more from strength)
      const terr = terrainKey(terrain);
      const strWeight = terr === "flat" || terr === "cobbles" ? 0.65 : 0.35;
      const endWeight = 1.0 - strWeight;

      const pull = (strWeight * Strength + endWeight * Endurance) / 100;
      const energyMult = 0.55 + 0.45 * (energy / 100);

      sum += pull * energyMult;
    }

    const avg = sum / Math.max(1, sample.length);

    // scale up with "how many can contribute" (bigger peloton -> more collective effect)
    // sqrt keeps it sane
    const sizeMult = Math.sqrt(clamp(ids.length / 60, 0.5, 1.6));

    // final index around 0.6..1.6
    return clamp(0.75 + 0.95 * avg, 0.6, 1.6) * sizeMult;
  }

  function maybeCrosswindSplit(km, seg) {
    const wind = Number(weather?.wind_speed_ms || 0);
    const exposure = clamp(Number(seg?.wind_exposure ?? 0.5), 0, 1);
    const terr = terrainKey(seg?.terrain);
    if (terr !== "flat" && terr !== "cobbles") return;

    const p = clamp((wind / 15) * exposure * 0.25, 0, 0.18);
    if (rng() > p) return;

    const pelIds = [...peloton.rider_ids];
    if (pelIds.length < 12) return;

    const frontShare = 0.55 + rng() * 0.15;
    const frontN = Math.max(8, Math.floor(pelIds.length * frontShare));

    pelIds.sort((a, b) => {
      const ra = riderById.get(a);
      const rb = riderById.get(b);
      const pa = riderPower(ra.skills, seg.terrain, 1) + 0.25 * s(ra.skills, "Wind");
      const pb = riderPower(rb.skills, seg.terrain, 1) + 0.25 * s(rb.skills, "Wind");
      return pb - pa;
    });

    peloton.rider_ids = pelIds.slice(0, frontN);
    const back = pelIds.slice(frontN);
    chase = { id: "G2", type: "chase", gap_sec: peloton.gap_sec + (12 + rng() * 25), rider_ids: back };

    addFeed(km, "crosswind_split", makeMessage("crosswind_split", { km, rng }), {
      gap_sec: round1(chase.gap_sec - peloton.gap_sec)
    });
  }

  function maybeAttackAndBreak(km, seg, kmLeft) {
    const terr = seg?.terrain || "flat";
    const breakSize = breakaway ? breakaway.rider_ids.length : 0;

    let desire = 0;
    for (const t of teams) desire += teamAttackIntensity(t.team_id, terr, kmLeft);
    desire /= Math.max(1, teams.length);

    let phase = kmLeft > 80 ? 1.0 : kmLeft > 40 ? 0.8 : 0.6;
    if (terrainKey(terr) === "finale") phase *= 0.5;

    let p = clamp(0.06 * desire * phase, 0.02, 0.18);
    if (breakSize > 0) p *= 0.65;
    if (breakSize >= 6) p *= 0.45;

    if (rng() > p) return;

    const attackersN = breakSize === 0 ? (2 + Math.floor(rng() * 4)) : 1;
    const attackers = pickAttackersFromPeloton(terr, attackersN);
    if (!attackers.length) return;

    addFeed(km, "attack_started", makeMessage("attack_started", { km, rng }), { count: attackers.length });

    if (!breakaway) {
      breakaway = { id: "G1", type: "break", gap_sec: peloton.gap_sec - (10 + rng() * 20), rider_ids: [] };
    }

    for (const r of attackers) {
      peloton.rider_ids = peloton.rider_ids.filter((x) => x !== r.rider_id);
      breakaway.rider_ids.push(r.rider_id);
    }

    if (breakSize === 0) {
      const gap = 20 + Math.floor(rng() * 35);
      breakaway.gap_sec = peloton.gap_sec - gap;
      addFeed(km, "break_formed", makeMessage("break_formed", { km, gap, rng }), { gap_sec: gap, riders: breakaway.rider_ids.length });
    }
  }

  function maybeChaseOrCatch(km, seg, kmLeft) {
    if (!breakaway) return;

    const terr = seg?.terrain || "flat";

    // tactics chase intensity
    let chaseStrength = 0;
    for (const t of teams) chaseStrength += teamChaseIntensity(t.team_id, terr, kmLeft);
    chaseStrength /= Math.max(1, teams.length);

    // group strengths
    let breakStrength = 0;
    for (const id of breakaway.rider_ids) {
      const r = riders.find((x) => x.rider_id === id);
      breakStrength += riderPower(r.skills, terr, 1) * (0.6 + 0.4 * (r.energy / 100));
    }
    breakStrength /= Math.max(1, breakaway.rider_ids.length);

    let pelStrength = 0;
    for (const id of peloton.rider_ids) {
      const r = riders.find((x) => x.rider_id === id);
      pelStrength += riderPower(r.skills, terr, 1) * (0.65 + 0.35 * (r.energy / 100));
    }
    pelStrength /= Math.max(1, peloton.rider_ids.length);

    // NEW: pull index from strength+endurance & number contributing
    const pullIndex = pelotonPullIndex(terr);

    const randomDrift = (rng() - 0.5) * 6;
    const strengthDiff = (breakStrength - pelStrength) * 0.05;

    // NEW: chase pull uses both tactic and collective pullIndex
    const tacticPull = (chaseStrength - 1.0) * 4.2;
    const collectivePull = (pullIndex - 1.0) * 6.0;

    let delta = randomDrift + strengthDiff - tacticPull - collectivePull;

    if (kmLeft < 30) delta -= 2.0;
    delta = clamp(delta, -22, 22);

    // update break position relative peloton
    breakaway.gap_sec = breakaway.gap_sec + (-delta);

    if (rng() < 0.10) {
      addFeed(km, "peloton_chasing", makeMessage("peloton_chasing", { km, rng }), {
        chase_strength: round1(chaseStrength),
        pull_index: round1(pullIndex)
      });
    }

    const newGap = peloton.gap_sec - breakaway.gap_sec;
    if (newGap <= 4) {
      peloton.rider_ids.push(...breakaway.rider_ids);
      breakaway = null;
      addFeed(km, "break_caught", makeMessage("break_caught", { km, kmLeft, rng }), { km_left: kmLeft });
    }
  }

  function drainAll(terrain) {
    const groups = [
      breakaway ? { g: breakaway, type: "break" } : null,
      { g: peloton, type: "peloton" },
      chase ? { g: chase, type: "chase" } : null
    ].filter(Boolean);

    for (const wrap of groups) {
      for (const id of wrap.g.rider_ids) {
        const r = riderById.get(id);
        if (!r || r.status !== "ok") continue;

        ensureTeamState(r.team_id);
        const plan = activePlanByTeam.get(r.team_id);
        const eff = effortForRider(r.team_id, r.rider_id);

        drainEnergy(wrap.type, r, terrain, eff, plan);

        if (r.energy < 8 && wrap.type === "peloton") {
          if (!chase) chase = { id: "G2", type: "chase", gap_sec: peloton.gap_sec + (8 + rng() * 12), rider_ids: [] };
          peloton.rider_ids = peloton.rider_ids.filter((x) => x !== r.rider_id);
          chase.rider_ids.push(r.rider_id);
        }
      }
    }
  }

  const finaleFlags = { pos: false, train: false, launch: false, finish: false };

  for (let km = 0; km <= Math.floor(distance); km++) {
    if (!shouldTickAtKm(profile, km, distance)) continue;

    const kmLeft = Math.max(0, Math.floor(distance) - km);
    const { seg } = getSegmentAtKm(segments, km);
    const keyPoint = isKeyPointAtKm(profile, km);

    for (const t of teams) {
      ensureTeamState(t.team_id);
      applySchedule(t.team_id, km, keyPoint);
    }

    maybeCrosswindSplit(km, seg);

    if (kmLeft > 5) {
      maybeAttackAndBreak(km, seg, kmLeft);
      maybeChaseOrCatch(km, seg, kmLeft);
    } else {
      if (breakaway) maybeChaseOrCatch(km, seg, kmLeft);
    }

    const hasBreak = !!breakaway;
    const hasSplit = !!chase;

    if (kmLeft === 5 && !finaleFlags.pos) {
      finaleFlags.pos = true;
      const type = hasBreak ? "finale_pos_break" : hasSplit ? "finale_pos_split" : "finale_pos_sprint";
      addFeed(km, type, makeMessage(type, { km, rng }), { km_left: 5 });
    }
    if (kmLeft === 3 && !finaleFlags.train) {
      finaleFlags.train = true;
      const type = hasBreak ? "finale_train_break" : hasSplit ? "finale_train_split" : "finale_train_sprint";
      addFeed(km, type, makeMessage(type, { km, rng }), { km_left: 3 });
    }
    if (kmLeft === 1 && !finaleFlags.launch) {
      finaleFlags.launch = true;
      const type = hasBreak ? "finale_launch_break" : hasSplit ? "finale_launch_split" : "finale_launch_sprint";
      addFeed(km, type, makeMessage(type, { km, rng }), { km_left: 1 });
    }
    if (kmLeft === 0 && !finaleFlags.finish) {
      finaleFlags.finish = true;
      addFeed(km, "finish_line", makeMessage("finish_line", { km, rng }), { km_left: 0 });
    }

    drainAll(seg?.terrain || "flat");
    snapshot(km);
  }

  const groupsAtFinish = [breakaway, peloton, chase].filter(Boolean);
  groupsAtFinish.sort((a, b) => Number(a.gap_sec) - Number(b.gap_sec));
  const leaderGap = groupsAtFinish.length ? Number(groupsAtFinish[0].gap_sec) : 0;

  const riderTimes = [];
  for (const g of groupsAtFinish) {
    const groupGap = Number(g.gap_sec) - leaderGap;
    const ids = [...g.rider_ids];

    ids.sort((a, b) => {
      const ra = riderById.get(a);
      const rb = riderById.get(b);
      const pa = riderPower(ra.skills, "finale", 1) + 0.15 * ra.energy;
      const pb = riderPower(rb.skills, "finale", 1) + 0.15 * rb.energy;
      return pb - pa;
    });

    for (let i = 0; i < ids.length; i++) {
      const r = riderById.get(ids[i]);
      const intra = i === 0 ? 0 : clamp(i * (0.2 + rng() * 0.35), 0.2, 6.0);
      const time = leaderBaseTime + groupGap + intra;

      riderTimes.push({ team_id: r.team_id, rider_id: r.rider_id, time_sec: time });
    }
  }

  riderTimes.sort((a, b) => a.time_sec - b.time_sec);
  riderTimes.forEach((x, idx) => (x.position = idx + 1));

  if (riderTimes.length) {
    const winner = riderTimes[0];
    feed.push({
      km: Math.floor(distance),
      type: "sprint_result",
      message: makeMessage("sprint_result", { km: Math.floor(distance), rng }),
      payload: { rider_id: winner.rider_id, team_id: winner.team_id }
    });
  }

  return { results: riderTimes, feed, snapshots };
}
