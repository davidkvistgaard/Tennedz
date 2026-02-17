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
  // hvordan holdet prioriterer reaktion
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
  // fallback = sidste segment
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

function shouldTickAtKm(profile, km) {
  const step = Number(profile?.decision_every_km || 5);
  if (km === 0) return true;
  if (km % step === 0) return true;
  return !!isKeyPointAtKm(profile, km);
}

function riderPower(skills, terrain, contextMult) {
  const k = terrainKey(terrain);
  const s = (name) => Number(skills?.[name] ?? 50);

  // basis pr terrain
  let base = 0;
  if (k === "flat") base = 0.55 * s("Flat") + 0.25 * s("Endurance") + 0.10 * s("Timetrial") + 0.10 * s("Wind");
  else if (k === "cobbles") base = 0.55 * s("Cobbles") + 0.25 * s("Endurance") + 0.10 * s("Wind") + 0.10 * s("Luck");
  else if (k === "hills") base = 0.55 * s("Hills") + 0.30 * s("Endurance") + 0.15 * s("Moral");
  else if (k === "mountain") base = 0.60 * s("Mountain") + 0.30 * s("Endurance") + 0.10 * s("Moral");
  else if (k === "finale") base = 0.55 * s("Sprint") + 0.25 * s("Flat") + 0.20 * s("Endurance");
  else base = 0.50 * s("Flat") + 0.30 * s("Endurance") + 0.20 * s("Wind");

  // form+moral+luck som små multipliers
  const form = clamp(s("Form"), 0, 100);
  const moral = clamp(s("Moral"), 0, 100);
  const luck = clamp(s("Luck"), 0, 100);

  const mult = (0.95 + 0.10 * (form / 100)) * (0.97 + 0.06 * (moral / 100)) * (0.98 + 0.06 * ((luck - 50) / 50));
  return base * mult * (contextMult || 1);
}

function defaultOrders(team) {
  // V1 default: balanceret, ingen fancy schedule
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
  // lille tekstbank V1 – vi kan gøre den meget større senere
  const { km, keypointName, teamTag, gap, groups, riderTag, kmLeft } = ctx;
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
    sprint_fight: [
      `${km} km: Toget går i gang – positionskamp mod spurten!`,
      `${km} km: De store hold samler op. Finalen spidser til.`,
      `${km} km: Feltet flyver. Alle vil sidde forrest mod målet.`
    ]
  };

  const arr = variants[type] || [`${km} km: Noget sker…`];
  return pick(ctx.rng, arr);
}

/**
 * Motor V1:
 * - ticks hver decision_every_km (default 5) + keypoints
 * - grupper: peloton + (0-1) break + (0-1) chase/back
 * - events + snapshots til viewer
 *
 * Input:
 *  { stageDistanceKm, profile, segments, teams, weather, seedString, ordersByTeam }
 *
 * Output:
 *  { results: [{team_id,rider_id,time_sec,position}], feed:[], snapshots:[] }
 */
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

  const { riderToTeam } = buildNameMaps(teams);

  // baseline speed => leader time “føles” realistisk
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
        status: "ok" // ok/dropped/dnf
      });
    }
  }

  // groups: each group has riders array of rider_id
  const peloton = {
    id: "G0",
    type: "peloton",
    gap_sec: 0,
    rider_ids: riders.map((x) => x.rider_id)
  };

  let breakaway = null; // {id,type:'break',gap_sec,rider_ids}
  let chase = null; // {id,type:'chase',gap_sec,rider_ids}

  const feed = [];
  const snapshots = [];

  // helper access
  const riderById = new Map(riders.map((x) => [x.rider_id, x]));

  // active plan per team (mutates by triggers/schedule)
  const activePlanByTeam = new Map();
  const activeRiderTactics = new Map(); // key rider_id -> {mode,effort,risk}

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
    const effort = clamp(Number(rt.effort ?? 0.6), 0.3, 1.0);
    return effort;
  }

  function riderMode(team_id, rider_id) {
    const o = getTeamOrders(team_id);
    const rt = (o.riders && o.riders[rider_id]) || {};
    return rt.mode || "normal"; // normal/protect_captain/leadout/opportunist
  }

  function applySchedule(team_id, km, keyPoint) {
    const o = getTeamOrders(team_id);
    const plan = activePlanByTeam.get(team_id);

    // schedule at exact km
    const sched = Array.isArray(o.schedule) ? o.schedule : (Array.isArray(o?.payload?.schedule) ? o.payload.schedule : []);
    for (const item of sched) {
      if (Number(item?.at_km) === Number(km) && item.apply?.team_plan) {
        const next = parsePlan({ ...plan, ...item.apply.team_plan });
        activePlanByTeam.set(team_id, next);
      }
    }

    // keypoint overrides
    const kpOverrides = o.keypoint_overrides || o?.payload?.keypoint_overrides;
    if (keyPoint && kpOverrides && kpOverrides[keyPoint.type]?.team_plan) {
      const next = parsePlan({ ...plan, ...kpOverrides[keyPoint.type].team_plan });
      activePlanByTeam.set(team_id, next);
    }
  }

  function snapshot(km) {
    const groupSummary = [];
    const groups = [breakaway, peloton, chase].filter(Boolean);
    // sort by gap (leader first)
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
      state: {
        km,
        groups: groupSummary
      }
    });
  }

  function addFeed(km, type, message, payload) {
    feed.push({
      km,
      type,
      message,
      payload: payload || null
    });
  }

  function pickAttackersFromPeloton(terrain, count) {
    const candidates = peloton.rider_ids
      .map((id) => riderById.get(id))
      .filter((r) => r && r.status === "ok" && r.energy > 25);

    // bias: opportunist + aggressive teams + terrain power
    candidates.sort((a, b) => {
      const pa = riderPower(a.skills, terrain, 1) + (riderMode(a.team_id, a.rider_id) === "opportunist" ? 6 : 0);
      const pb = riderPower(b.skills, terrain, 1) + (riderMode(b.team_id, b.rider_id) === "opportunist" ? 6 : 0);
      return pb - pa;
    });

    // take from top chunk but randomize
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

    // hvis langt til mål, mindre jagt (med mindre sprint-fokus)
    let distMult = kmLeft < 30 ? 1.05 : kmLeft < 70 ? 1.0 : 0.9;
    if (plan.focus === "sprint") distMult += kmLeft < 60 ? 0.10 : 0.05;

    // terræn: på bjerge jagter færre i V1
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

    let base = 0.9; // per tick
    if (terr === "mountain") base = 1.6;
    if (terr === "cobbles") base = 1.3;
    if (terr === "finale") base = 1.1;

    // grupper: udbrud/jagt koster mere
    if (groupType === "break") base *= 1.25;
    if (groupType === "chase") base *= 1.15;

    // energy policy
    if (plan.energy_policy === "conserve") base *= 0.90;
    if (plan.energy_policy === "burn") base *= 1.10;

    // effort påvirker
    base *= (0.75 + 0.6 * effort);

    // aggressive style brænder mere
    base *= st.burn;

    // risiko giver mere “spild”
    base *= (0.95 + 0.12 * (rf - 1.0));

    // høj endurance reducerer drain lidt
    const endu = clamp(Number(rider.skills?.Endurance ?? 50), 0, 100);
    base *= (1.08 - 0.18 * (endu / 100));

    rider.energy = clamp(rider.energy - base, 0, 100);
  }

  function maybeCrosswindSplit(km, seg) {
    const wind = Number(weather?.wind_speed_ms || 0);
    const exposure = clamp(Number(seg?.wind_exposure ?? 0.5), 0, 1);
    const terr = terrainKey(seg?.terrain);
    if (terr !== "flat" && terr !== "cobbles") return;

    // chance grows with wind + exposure
    const p = clamp((wind / 15) * exposure * 0.25, 0, 0.18);
    if (rng() > p) return;

    // split peloton into front/back
    const pelIds = [...peloton.rider_ids];
    if (pelIds.length < 12) return;

    // front keeps ~55-70%
    const frontShare = 0.55 + rng() * 0.15;
    const frontN = Math.max(8, Math.floor(pelIds.length * frontShare));

    // sort by wind power a bit
    pelIds.sort((a, b) => {
      const ra = riderById.get(a);
      const rb = riderById.get(b);
      const pa = riderPower(ra.skills, seg.terrain, 1) + 0.25 * Number(ra.skills?.Wind ?? 50);
      const pb = riderPower(rb.skills, seg.terrain, 1) + 0.25 * Number(rb.skills?.Wind ?? 50);
      return pb - pa;
    });

    const front = pelIds.slice(0, frontN);
    const back = pelIds.slice(frontN);

    // peloton becomes front group (still peloton)
    peloton.rider_ids = front;

    // create chase/back group
    chase = {
      id: "G2",
      type: "chase",
      gap_sec: peloton.gap_sec + (12 + rng() * 25), // 12-37 sec
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

    // show flavor on key cobbles points
    if (keyPoint?.type === "cobbles_sector") {
      addFeed(km, "cobbles_chaos", makeMessage("cobbles_chaos", { km, keypointName: keyPoint.name, rng }), { name: keyPoint.name });
    }

    // random drops / punctures: a few riders lose contact and go to chase
    const sev = clamp(Number(keyPoint?.severity ?? 0.6), 0.2, 1.0);
    const pDrop = clamp(0.03 + sev * 0.06 + (weather?.rain ? 0.03 : 0), 0, 0.12);
    if (rng() > pDrop) return;

    // ensure chase exists
    if (!chase) {
      chase = { id: "G2", type: "chase", gap_sec: peloton.gap_sec + (6 + rng() * 10), rider_ids: [] };
    }

    // pick 1-3 riders from peloton to drop (bias low cobbles/low luck)
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
      // small immediate energy hit
      r.energy = clamp(r.energy - (4 + rng() * 6), 0, 100);
    }
  }

  function maybeAttackAndBreak(km, seg, kmLeft) {
    const terr = seg?.terrain || "flat";
    // if already break and it's big, fewer attacks
    const breakSize = breakaway ? breakaway.rider_ids.length : 0;

    // compute global attack desire: average of teams’ attack intensity
    let desire = 0;
    for (const t of teams) desire += teamAttackIntensity(t.team_id, terr, kmLeft);
    desire /= Math.max(1, teams.length);

    // early stage more likely to form break
    let phase = kmLeft > 80 ? 1.0 : kmLeft > 40 ? 0.8 : 0.6;
    if (terrainKey(terr) === "finale") phase *= 0.5;

    // probability
    let p = clamp(0.06 * desire * phase, 0.02, 0.18);
    if (breakSize > 0) p *= 0.65;
    if (breakSize >= 6) p *= 0.45;

    if (rng() > p) return;

    const attackersN = breakSize === 0 ? (2 + Math.floor(rng() * 4)) : 1; // 2-5 if none, else 1 joins
    const attackers = pickAttackersFromPeloton(terr, attackersN);
    if (!attackers.length) return;

    addFeed(km, "attack_started", makeMessage("attack_started", { km, riderTag: "En rytter", rng }), {
      count: attackers.length
    });

    if (!breakaway) {
      breakaway = { id: "G1", type: "break", gap_sec: peloton.gap_sec - (10 + rng() * 20), rider_ids: [] }; // leader group has smallest gap; break is ahead => smaller gap (negative)
    }

    for (const r of attackers) {
      peloton.rider_ids = peloton.rider_ids.filter((x) => x !== r.rider_id);
      breakaway.rider_ids.push(r.rider_id);
    }

    // establish initial gap if just created
    if (breakSize === 0) {
      const gap = 20 + Math.floor(rng() * 35); // 20-54 sec
      // break is ahead => set break gap relative peloton
      breakaway.gap_sec = peloton.gap_sec - gap;
      addFeed(km, "break_formed", makeMessage("break_formed", { km, gap, rng }), { gap_sec: gap, riders: breakaway.rider_ids.length });
    }
  }

  function maybeChaseOrCatch(km, seg, kmLeft) {
    if (!breakaway) return;

    // compute chase strength from teams based on focus and whether their key rider is in break
    const terr = seg?.terrain || "flat";

    let chaseStrength = 0;
    for (const t of teams) {
      const intensity = teamChaseIntensity(t.team_id, terr, kmLeft);
      chaseStrength += intensity;
    }
    chaseStrength /= Math.max(1, teams.length);

    // break strength from riders in break
    let breakStrength = 0;
    for (const id of breakaway.rider_ids) {
      const r = riderById.get(id);
      breakStrength += riderPower(r.skills, terr, 1) * (0.6 + 0.4 * (r.energy / 100));
    }
    breakStrength /= Math.max(1, breakaway.rider_ids.length);

    // peloton strength also matters
    let pelStrength = 0;
    for (const id of peloton.rider_ids) {
      const r = riderById.get(id);
      pelStrength += riderPower(r.skills, terr, 1) * (0.65 + 0.35 * (r.energy / 100));
    }
    pelStrength /= Math.max(1, peloton.rider_ids.length);

    // gap is (peloton.gap - break.gap) (positive means break ahead)
    const gap = peloton.gap_sec - breakaway.gap_sec;

    // delta gap per tick
    const randomDrift = (rng() - 0.5) * 6; // -3..+3 sec
    const strengthDiff = (breakStrength - pelStrength) * 0.05; // small
    const chasePull = (chaseStrength - 1.0) * 4.0; // -? .. +?
    let delta = randomDrift + strengthDiff - chasePull;

    // late stage: catch more likely if sprint focus
    if (kmLeft < 30) delta -= 2.0;

    // clamp per tick change
    delta = clamp(delta, -18, 18);

    // update break position relative peloton:
    // if delta negative => gap shrinks => breakaway gap moves towards peloton gap
    // since breakaway gap is smaller number, to shrink gap we increase breakaway.gap_sec (towards peloton.gap_sec)
    breakaway.gap_sec = breakaway.gap_sec + (-delta);

    // occasional "peloton chasing" feed
    if (rng() < 0.08) {
      addFeed(km, "peloton_chasing", makeMessage("peloton_chasing", { km, teamTag: "Et hold", rng }), { chase_strength: round1(chaseStrength) });
    }

    // caught?
    const newGap = peloton.gap_sec - breakaway.gap_sec;
    if (newGap <= 4) {
      // merge break into peloton
      peloton.rider_ids.push(...breakaway.rider_ids);
      breakaway = null;
      addFeed(km, "break_caught", makeMessage("break_caught", { km, kmLeft, rng }), { km_left: kmLeft });
    }
  }

  function applyCaptainDropTrigger(km) {
    // V1 trigger: hvis en kaptajn findes og ligger i chase/back group => skift hold plan til defensive/gc_safe
    // (vi ved ikke præcis hvem kaptajn er uden orders, men hvis orders har captain, bruger vi det)
    for (const t of teams) {
      const o = getTeamOrders(t.team_id);
      const captain = o?.roles?.captain;
      if (!captain) continue;

      const inChase = chase?.rider_ids?.includes(captain);
      if (inChase) {
        ensureTeamState(t.team_id);
        const plan = activePlanByTeam.get(t.team_id);
        // hvis ikke allerede defensive/gc_safe, skift
        if (plan.style !== "defensive" || plan.focus !== "gc_safe") {
          activePlanByTeam.set(t.team_id, parsePlan({ ...plan, style: "defensive", focus: "gc_safe", risk: "low" }));
          addFeed(km, "captain_dropped", makeMessage("captain_dropped", { km, rng }), { team_id: t.team_id, captain });
        }
      }
    }
  }

  function drainAll(terrain) {
    // drain per group
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

        // if energy too low, rider drifts to chase
        if (r.energy < 8 && wrap.type === "peloton") {
          if (!chase) chase = { id: "G2", type: "chase", gap_sec: peloton.gap_sec + (8 + rng() * 12), rider_ids: [] };
          peloton.rider_ids = peloton.rider_ids.filter((x) => x !== r.rider_id);
          chase.rider_ids.push(r.rider_id);
        }
      }
    }
  }

  // MAIN LOOP
  for (let km = 0; km <= distance; km++) {
    if (!shouldTickAtKm(profile, km)) continue;

    const kmLeft = Math.max(0, distance - km);
    const { seg } = getSegmentAtKm(segments, km);
    const keyPoint = isKeyPointAtKm(profile, km);

    // apply schedule/keypoint overrides
    for (const t of teams) {
      ensureTeamState(t.team_id);
      applySchedule(t.team_id, km, keyPoint);
    }

    // keypoint flavor + cobbles chaos
    if (keyPoint?.type === "cobbles_sector") {
      addFeed(km, "cobbles_chaos", makeMessage("cobbles_chaos", { km, keypointName: keyPoint.name, rng }), { name: keyPoint.name });
    }
    maybeCobblesChaos(km, keyPoint, seg);

    // crosswind split chance
    maybeCrosswindSplit(km, seg);

    // attacks & break formation
    maybeAttackAndBreak(km, seg, kmLeft);

    // chase & catch
    maybeChaseOrCatch(km, seg, kmLeft);

    // triggers (captain dropped)
    applyCaptainDropTrigger(km);

    // finale flavor
    if (kmLeft <= 15 && rng() < 0.12) {
      addFeed(km, "sprint_fight", makeMessage("sprint_fight", { km, rng }), { km_left: kmLeft });
    }

    // energy drain per tick
    drainAll(seg?.terrain || "flat");

    // snapshot for viewer
    snapshot(km);
  }

  // FINISH: compute finish times by group + sprint within group
  const groupsAtFinish = [breakaway, peloton, chase].filter(Boolean);
  // leader group = min gap_sec
  groupsAtFinish.sort((a, b) => Number(a.gap_sec) - Number(b.gap_sec));
  const leaderGap = groupsAtFinish.length ? Number(groupsAtFinish[0].gap_sec) : 0;

  const riderTimes = [];
  for (const g of groupsAtFinish) {
    const groupGap = Number(g.gap_sec) - leaderGap; // seconds behind leader group (>=0)
    const ids = [...g.rider_ids];

    // sprint ordering within group:
    const terrFinal = "finale";
    ids.sort((a, b) => {
      const ra = riderById.get(a);
      const rb = riderById.get(b);
      const pa = riderPower(ra.skills, terrFinal, 1) + 0.15 * ra.energy;
      const pb = riderPower(rb.skills, terrFinal, 1) + 0.15 * rb.energy;
      return pb - pa;
    });

    // assign small gaps within group (seconds)
    for (let i = 0; i < ids.length; i++) {
      const r = riderById.get(ids[i]);
      const intra = i === 0 ? 0 : clamp(i * (0.2 + rng() * 0.35), 0.2, 6.0); // tiny spread
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

  return {
    results: riderTimes,
    feed,
    snapshots
  };
}
