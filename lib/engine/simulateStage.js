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
    risk: p.risk || "medium", // low/medium/high
    style: p.style || "balanced", // defensive/balanced/aggressive
    focus: p.focus || "balanced", // sprint/break/gc_safe/kom/balanced/chaos
    energy_policy: p.energy_policy || "normal" // conserve/normal/burn
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
  if (focus === "sprint") return { chase: 1.15, attack: 0.90 };
  if (focus === "break") return { chase: 0.90, attack: 1.25 };
  if (focus === "gc_safe") return { chase: 1.10, attack: 0.85 };
  if (focus === "kom") return { chase: 0.95, attack: 1.10 };
  if (focus === "chaos") return { chase: 0.90, attack: 1.10 };
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
  return { seg: { terrain: "flat", wind_exposure: 0.5, weights: {} }, start: 0, end: km + 1 };
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

  // sidste 5 km: tick hver km
  if (distance != null && km >= Math.max(0, Math.floor(distance) - 5)) return true;

  if (km === 0) return true;
  if (km % step === 0) return true;
  return !!isKeyPointAtKm(profile, km);
}

function riderPower(skills, terrain, contextMult) {
  const k = terrainKey(terrain);
  const s = (name) => Number(skills?.[name] ?? 50);

  let base = 0;
  if (k === "flat") base = 0.55 * s("Flat") + 0.25 * s("Endurance") + 0.10 * s("Timetrial") + 0.10 * s("Wind");
  else if (k === "cobbles") base = 0.55 * s("Cobbles") + 0.25 * s("Endurance") + 0.10 * s("Wind") + 0.10 * s("Luck");
  else if (k === "hills") base = 0.55 * s("Hills") + 0.30 * s("Endurance") + 0.15 * s("Moral");
  else if (k === "mountain") base = 0.60 * s("Mountain") + 0.30 * s("Endurance") + 0.10 * s("Moral");
  else if (k === "finale") base = 0.55 * s("Sprint") + 0.25 * s("Flat") + 0.20 * s("Endurance");
  else base = 0.50 * s("Flat") + 0.30 * s("Endurance") + 0.20 * s("Wind");

  const form = clamp(s("Form"), 0, 100);
  const moral = clamp(s("Moral"), 0, 100);
  const luck = clamp(s("Luck"), 0, 100);

  const mult =
    (0.95 + 0.10 * (form / 100)) *
    (0.97 + 0.06 * (moral / 100)) *
    (0.98 + 0.06 * ((luck - 50) / 50));

  return base * mult * (contextMult || 1);
}

function defaultOrders(team_id) {
  return {
    name: "Default balanced",
    team_plan: { risk: "medium", style: "balanced", focus: "balanced", energy_policy: "normal" },
    roles: { captain: null, sprinter: null, climber: null },
    riders: {}
  };
}

function buildNameMaps(teams) {
  const riderToTeam = new Map();
  for (const t of teams) {
    for (const r of t.riders) riderToTeam.set(r.rider_id, t.team_id);
  }
  return { riderToTeam };
}

function makeMessage(type, ctx) {
  const { km, keypointName, teamTag, gap, groups, riderTag, kmLeft, rng } = ctx;
  const variants = {
    attack_started: [
      `${km} km: ${riderTag} prøver lykken med et angreb!`,
      `${km} km: Et ryk i feltet – ${riderTag} går!`,
      `${km} km: Tempoet stiger, og ${riderTag} sætter sig i front.`
    ],
    break_formed: [
      `${km} km: Udbruddet er etableret. De får hurtigt hul på ${gap} sek.`,
      `${km} km: En gruppe slipper væk – ${gap} sek forspring.`,
      `${km} km: Udbruddet får lov at køre. Forspring: ${gap} sek.`
    ],
    peloton_chasing: [
      `${km} km: ${teamTag} tager ansvar og jagter.`,
      `${km} km: Feltet organiserer jagten – ${teamTag} sætter sig frem.`,
      `${km} km: Jagten strammes op. ${teamTag} viser muskler.`
    ],
    break_caught: [
      `${km} km: Udbruddet bliver hentet med ${kmLeft} km igen.`,
      `${km} km: Det er slut for udbruddet – feltet lukker hullet.`,
      `${km} km: Jagten lykkes. Feltet er samlet igen.`
    ],
    crosswind_split: [
      `${km} km: Sidevind! Feltet splittes i ${groups} grupper.`,
      `${km} km: En brutal sidevindssituation – der bliver revet over!`,
      `${km} km: Vinden gør ondt. Der opstår store huller i feltet.`
    ],
    cobbles_chaos: [
      `${km} km: ${keypointName}! Paveerne skaber kaos og positionering bliver altafgørende.`,
      `${km} km: Ind på ${keypointName} – rytterne kæmper om hjul.`,
      `${km} km: Pave-sektor: ${keypointName}. Feltet sprænger i stykker.`
    ],
    captain_dropped: [
      `${km} km: Kaptajnen er i problemer – hjælperne må i aktion!`,
      `${km} km: Der er et hul til kaptajnen. Holdet må stabilisere.`,
      `${km} km: Kaptajnen taber tid. Det bliver defensivt nu.`
    ],
    finale_positioning: [
      `${km} km: Positionskampen starter – alle vil sidde rigtigt til med 5 km igen.`,
      `${km} km: 5 km igen. Det bliver hektisk, og alle kæmper om hjul.`,
      `${km} km: Feltet komprimerer. Positionskamp mod finalen!`
    ],
    leadout_train: [
      `${km} km: Leadout-togene samler op – tempoet eksploderer med 3 km igen.`,
      `${km} km: 3 km igen. De store hold tager over og det går stærkt!`,
      `${km} km: Toget går i gang. Nu handler det om timing.`
    ],
    sprint_launch: [
      `${km} km: Nu åbner sprinterne! Det bliver skulder mod skulder mod stregen.`,
      `${km} km: 1 km igen. Sprinterne gør sig klar til at åbne!`,
      `${km} km: Sprinterne går i gang – ren rå kraft mod målstregen!`
    ],
    finish_line: [
      `${km} km: Stregen! Vi afventer målfoto og tider…`,
      `${km} km: Mål! Dommerne kigger på det…`,
      `${km} km: De kaster cyklerne på stregen!`
    ],
    sprint_result: [
      `Mål: Vinderen krydser stregen først!`,
      `Mål: Sikke en spurt – der er en klar vinder!`,
      `Mål: Sprinten er afgjort!`
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

  buildNameMaps(teams); // reserved for future use

  // baseline speed -> leader time
  let baseSpeed = 44.0;
  baseSpeed -= 2.0 * clamp(Number(weather?.wind_speed_ms || 0) / 15, 0, 1) * 0.6;
  if (weather?.rain) baseSpeed -= 0.8;
  baseSpeed = clamp(baseSpeed, 38.0, 48.0);

  const leaderBaseTime = (distance / baseSpeed) * 3600;

  // riders state
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

  const peloton = {
    id: "G0",
    type: "peloton",
    gap_sec: 0,
    rider_ids: riders.map((x) => x.rider_id)
  };

  let breakaway = null;
  let chase = null;

  const feed = [];
  const snapshots = [];

  const riderById = new Map(riders.map((x) => [x.rider_id, x]));

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
        const next = parsePlan({ ...plan, ...item.apply.team_plan });
        activePlanByTeam.set(team_id, next);
      }
    }

    const kpOverrides = o.keypoint_overrides || o?.payload?.keypoint_overrides;
    if (keyPoint && kpOverrides && kpOverrides[keyPoint.type]?.team_plan) {
      const next = parsePlan({ ...plan, ...kpOverrides[keyPoint.type].team_plan });
      activePlanByTeam.set(team_id, next);
    }
  }

  function snapshot(km) {
    const groupSummary = [];
    const groups = [breakaway, peloton, chase].filter(Boolean);
    groups.sort((a, b) => Number(a.gap_sec) - Number(b.gap_sec));
    const leaderGap = groups.length ? Number(groups[0].gap_sec) : 0;

    for (const g of groups) {
      groupSummary.push({
        id: g.id,
        type: g.type,
        gap_sec: round1(Number(g.gap_sec) - leaderGap),
        riders: g.rider_ids.length
      });
    }

    snapshots.push({
      km,
      state: { km, groups: groupSummary }
    });
  }

  function addFeed(km, type, message, payload) {
    feed.push({ km, type, message, payload: payload || null });
  }

  function pickAttackersFromPeloton(terrain, count) {
    const candidates = peloton.rider_ids
      .map((id) => riderById.get(id))
      .filter((r) => r && r.status === "ok" && r.energy > 25);

    candidates.sort((a, b) => {
      const pa = riderPower(a.skills, terrain, 1) + 6 * (rng() * 0.2);
      const pb = riderPower(b.skills, terrain, 1) + 6 * (rng() * 0.2);
      return pb - pa;
    });

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
    if (plan.focus === "sprint") distMult += kmLeft < 60 ? 0.10 : 0.05;

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
    if (terr === "finale") distMult *= 0.85;

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

    const endu = clamp(Number(rider.skills?.Endurance ?? 50), 0, 100);
    base *= (1.08 - 0.18 * (endu / 100));

    rider.energy = clamp(rider.energy - base, 0, 100);
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
      const pa = riderPower(ra.skills, seg.terrain, 1) + 0.25 * Number(ra.skills?.Wind ?? 50);
      const pb = riderPower(rb.skills, seg.terrain, 1) + 0.25 * Number(rb.skills?.Wind ?? 50);
      return pb - pa;
    });

    const front = pelIds.slice(0, frontN);
    const back = pelIds.slice(frontN);

    peloton.rider_ids = front;
    chase = {
      id: "G2",
      type: "chase",
      gap_sec: peloton.gap_sec + (12 + rng() * 25),
      rider_ids: back
    };

    addFeed(
      km,
      "crosswind_split",
      makeMessage("crosswind_split", { km, groups: 2, rng }),
      { groups: 2, gap_sec: round1(chase.gap_sec - peloton.gap_sec) }
    );
  }

  function maybeCobblesChaos(km, keyPoint, seg) {
    const terr = terrainKey(seg?.terrain);
    if (terr !== "cobbles") return;

    const sev = clamp(Number(keyPoint?.severity ?? 0.6), 0.2, 1.0);
    const pDrop = clamp(0.03 + sev * 0.06 + (weather?.rain ? 0.03 : 0), 0, 0.12);
    if (rng() > pDrop) return;

    if (!chase) {
      chase = { id: "G2", type: "chase", gap_sec: peloton.gap_sec + (6 + rng() * 10), rider_ids: [] };
    }

    const pelRiders = peloton.rider_ids
      .map((id) => riderById.get(id))
      .filter((r) => r && r.status === "ok");

    pelRiders.sort((a, b) => {
      const sa = (Number(a.skills?.Cobbles ?? 50) + Number(a.skills?.Luck ?? 50)) / 2;
      const sb = (Number(b.skills?.Cobbles ?? 50) + Number(b.skills?.Luck ?? 50)) / 2;
      return sa - sb;
    });

    const dropN = Math.min(3, Math.max(1, Math.floor(rng() * 3) + 1));
    const toDrop = pelRiders.slice(0, dropN);

    for (const r of toDrop) {
      peloton.rider_ids = peloton.rider_ids.filter((x) => x !== r.rider_id);
      chase.rider_ids.push(r.rider_id);
      r.energy = clamp(r.energy - (4 + rng() * 6), 0, 100);
    }
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

    addFeed(km, "attack_started", makeMessage("attack_started", { km, riderTag: "En rytter", rng }), {
      count: attackers.length
    });

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

    let chaseStrength = 0;
    for (const t of teams) chaseStrength += teamChaseIntensity(t.team_id, terr, kmLeft);
    chaseStrength /= Math.max(1, teams.length);

    let breakStrength = 0;
    for (const id of breakaway.rider_ids) {
      const r = riderById.get(id);
      breakStrength += riderPower(r.skills, terr, 1) * (0.6 + 0.4 * (r.energy / 100));
    }
    breakStrength /= Math.max(1, breakaway.rider_ids.length);

    let pelStrength = 0;
    for (const id of peloton.rider_ids) {
      const r = riderById.get(id);
      pelStrength += riderPower(r.skills, terr, 1) * (0.65 + 0.35 * (r.energy / 100));
    }
    pelStrength /= Math.max(1, peloton.rider_ids.length);

    const randomDrift = (rng() - 0.5) * 6;
    const strengthDiff = (breakStrength - pelStrength) * 0.05;
    const chasePull = (chaseStrength - 1.0) * 4.0;

    let delta = randomDrift + strengthDiff - chasePull;
    if (kmLeft < 30) delta -= 2.0;
    delta = clamp(delta, -18, 18);

    breakaway.gap_sec = breakaway.gap_sec + (-delta);

    if (rng() < 0.08) {
      addFeed(km, "peloton_chasing", makeMessage("peloton_chasing", { km, teamTag: "Et hold", rng }), { chase_strength: round1(chaseStrength) });
    }

    const newGap = peloton.gap_sec - breakaway.gap_sec;
    if (newGap <= 4) {
      peloton.rider_ids.push(...breakaway.rider_ids);
      breakaway = null;
      addFeed(km, "break_caught", makeMessage("break_caught", { km, kmLeft, rng }), { km_left: kmLeft });
    }
  }

  function applyCaptainDropTrigger(km) {
    for (const t of teams) {
      const o = getTeamOrders(t.team_id);
      const captain = o?.roles?.captain;
      if (!captain) continue;

      const inChase = chase?.rider_ids?.includes(captain);
      if (inChase) {
        ensureTeamState(t.team_id);
        const plan = activePlanByTeam.get(t.team_id);
        if (plan.style !== "defensive" || plan.focus !== "gc_safe") {
          activePlanByTeam.set(t.team_id, parsePlan({ ...plan, style: "defensive", focus: "gc_safe", risk: "low" }));
          addFeed(km, "captain_dropped", makeMessage("captain_dropped", { km, rng }), { team_id: t.team_id, captain });
        }
      }
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

  // Finale flags (så events kun kommer én gang)
  const finaleFlags = { pos: false, train: false, launch: false, finish: false };

  // MAIN LOOP
  for (let km = 0; km <= Math.floor(distance); km++) {
    if (!shouldTickAtKm(profile, km, distance)) continue;

    const kmLeft = Math.max(0, Math.floor(distance) - km);
    const { seg } = getSegmentAtKm(segments, km);
    const keyPoint = isKeyPointAtKm(profile, km);

    // apply schedule/keypoint overrides
    for (const t of teams) {
      ensureTeamState(t.team_id);
      applySchedule(t.team_id, km, keyPoint);
    }

    // keypoint cobbles flavor
    if (keyPoint?.type === "cobbles_sector") {
      addFeed(
        km,
        "cobbles_chaos",
        makeMessage("cobbles_chaos", { km, keypointName: keyPoint.name, rng }),
        { name: keyPoint.name }
      );
    }

    // Finale script (5,3,1,0 km left)
    if (kmLeft === 5 && !finaleFlags.pos) {
      finaleFlags.pos = true;
      addFeed(km, "finale_positioning", makeMessage("finale_positioning", { km, rng }), { km_left: kmLeft });
    }
    if (kmLeft === 3 && !finaleFlags.train) {
      finaleFlags.train = true;
      addFeed(km, "leadout_train", makeMessage("leadout_train", { km, rng }), { km_left: kmLeft });
    }
    if (kmLeft === 1 && !finaleFlags.launch) {
      finaleFlags.launch = true;
      addFeed(km, "sprint_launch", makeMessage("sprint_launch", { km, rng }), { km_left: kmLeft });
    }
    if (kmLeft === 0 && !finaleFlags.finish) {
      finaleFlags.finish = true;
      addFeed(km, "finish_line", makeMessage("finish_line", { km, rng }), { km_left: 0 });
    }

    // cobbles chaos drops
    maybeCobblesChaos(km, keyPoint, seg);

    // crosswind split
    maybeCrosswindSplit(km, seg);

    // attacks & breaks (undgå for meget kaos i sidste 5 km)
    if (kmLeft > 5) {
      maybeAttackAndBreak(km, seg, kmLeft);
      maybeChaseOrCatch(km, seg, kmLeft);
    } else if (breakaway) {
      // i finalen: break bliver oftest hentet lidt oftere
      maybeChaseOrCatch(km, seg, kmLeft);
    }

    // triggers
    applyCaptainDropTrigger(km);

    // energy drain per tick
    drainAll(seg?.terrain || "flat");

    // snapshot
    snapshot(km);
  }

  // FINISH: compute finish times by group + sprint within group
  const groupsAtFinish = [breakaway, peloton, chase].filter(Boolean);
  groupsAtFinish.sort((a, b) => Number(a.gap_sec) - Number(b.gap_sec));
  const leaderGap = groupsAtFinish.length ? Number(groupsAtFinish[0].gap_sec) : 0;

  const riderTimes = [];
  for (const g of groupsAtFinish) {
    const groupGap = Number(g.gap_sec) - leaderGap;
    const ids = [...g.rider_ids];

    const terrFinal = "finale";
    ids.sort((a, b) => {
      const ra = riderById.get(a);
      const rb = riderById.get(b);
      const pa = riderPower(ra.skills, terrFinal, 1) + 0.15 * ra.energy;
      const pb = riderPower(rb.skills, terrFinal, 1) + 0.15 * rb.energy;
      return pb - pa;
    });

    for (let i = 0; i < ids.length; i++) {
      const r = riderById.get(ids[i]);
      const intra = i === 0 ? 0 : clamp(i * (0.2 + rng() * 0.35), 0.2, 6.0);
      const time = leaderBaseTime + groupGap + intra;

      riderTimes.push({
        team_id: r.team_id,
        rider_id: r.rider_id,
        time_sec: time
      });
    }
  }

  riderTimes.sort((a, b) => a.time_sec - b.time_sec);
  riderTimes.forEach((x, idx) => (x.position = idx + 1));

  // Add sprint result event after outcome known
  if (riderTimes.length) {
    const winner = riderTimes[0];
    feed.push({
      km: Math.floor(distance),
      type: "sprint_result",
      message: makeMessage("sprint_result", { km: Math.floor(distance), rng }),
      payload: { rider_id: winner.rider_id, team_id: winner.team_id }
    });
  }

  return {
    results: riderTimes,
    feed,
    snapshots
  };
}
