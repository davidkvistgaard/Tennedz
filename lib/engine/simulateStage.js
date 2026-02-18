// BUILD: MOTOR-V1.3-BATCH

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
  if (focus === "sprint") return { chase: 1.20, attack: 0.88 };
  if (focus === "break") return { chase: 0.90, attack: 1.30 };
  if (focus === "gc_safe") return { chase: 1.10, attack: 0.85 };
  if (focus === "kom") return { chase: 0.96, attack: 1.10 };
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

function riderPower(skills, terrain, contextMult) {
  const k = terrainKey(terrain);

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

  if (k === "flat") {
    base = 0.50 * Flat + 0.20 * Endurance + 0.10 * Timetrial + 0.10 * Wind + 0.10 * Strength;
  } else if (k === "cobbles") {
    base = 0.52 * Cobbles + 0.22 * Endurance + 0.10 * Wind + 0.08 * Luck + 0.08 * Strength;
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
    riders: {}, // rider_id -> { mode, effort }
    triggers: { protect_captain: true, sprint_chase: true }
  };
}

function normalizeOrders(o) {
  const base = defaultOrders(null);
  const out = { ...base, ...(o || {}) };
  out.team_plan = parsePlan(out.team_plan || {});
  out.roles = out.roles || { captain: null, sprinter: null, rouleur: null };
  out.riders = out.riders || {};
  out.triggers = out.triggers || { protect_captain: true, sprint_chase: true };
  return out;
}

function modeForRider(orders, rider_id) {
  const m = orders?.riders?.[rider_id]?.mode;
  if (m === "pull" || m === "protect_captain" || m === "leadout" || m === "opportunist") return m;
  return "normal";
}

function effortForRider(orders, rider_id) {
  const e = orders?.riders?.[rider_id]?.effort;
  const n = Number(e);
  if (Number.isFinite(n)) return clamp(n, 0.3, 1.0);
  return 0.6;
}

function makeMessage(type, ctx) {
  const { km, rng, gap, kmLeft, teamName, riderName } = ctx;

  const V = {
    attack_started_named: [
      `${km} km: ${riderName} trykker på – der bliver angrebet!`,
      `${km} km: ${riderName} forsøger at slippe væk.`,
      `${km} km: ${riderName} går på offensiven.`
    ],
    attack_started_generic: [
      `${km} km: Et ryk i feltet – der bliver angrebet!`,
      `${km} km: En rytter prøver lykken med et angreb.`,
      `${km} km: Tempoet stiger, og et angreb bliver sat ind.`
    ],
    break_formed: [
      `${km} km: Udbruddet er etableret. Forspring: ${gap} sek.`,
      `${km} km: En gruppe slipper væk – ${gap} sek forspring.`,
      `${km} km: Udbruddet får lov at køre. ${gap} sek.`
    ],
    peloton_chasing_named: [
      `${km} km: ${teamName} tager ansvar og skruer op for jagten.`,
      `${km} km: ${teamName} sætter sig i front – jagten strammes op.`,
      `${km} km: ${teamName} organiserer jagten.`
    ],
    peloton_chasing_generic: [
      `${km} km: Jagten strammes op bagfra.`,
      `${km} km: Feltet organiserer jagten.`,
      `${km} km: Der bliver kørt hårdt for at lukke hullet.`
    ],
    helpers_drop_back_named: [
      `${km} km: ${teamName} sender hjælp tilbage for at redde kaptajnen.`,
      `${km} km: Kaptajnen er i problemer – ${teamName} går i redningsmode.`,
      `${km} km: ${teamName} reorganiserer sig for at minimere tabet.`
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

    finale_5_sprint: [
      `${km} km: 5 km igen. Positionskampen starter – alle vil sidde rigtigt!`,
      `${km} km: 5 km. Feltet komprimerer og kæmper om hjulene.`
    ],
    finale_5_break: [
      `${km} km: 5 km igen – udbruddet kæmper, mens jagten nærmer sig!`,
      `${km} km: 5 km. Udbruddet holder stadig – men hullet falder.`
    ],
    finale_5_split: [
      `${km} km: 5 km igen – frontgruppen er lille, bagved jagtes der hårdt.`,
      `${km} km: 5 km. Grupperne er splittet – det handler om at begrænse tab.`
    ],

    finale_4_sprint: [
      `${km} km: 4 km. Nervøst! Holdene skubber sig frem i vinden.`,
      `${km} km: 4 km igen – tempoet går op, og alle vil sidde foran.`
    ],
    finale_4_break: [
      `${km} km: 4 km – udbruddet tager de sidste dybe pulls.`,
      `${km} km: 4 km igen. Udbruddet kigger bagud – det bliver tæt.`
    ],
    finale_4_split: [
      `${km} km: 4 km – frontgruppen holder farten, men der er stadig jagt bagved.`,
      `${km} km: 4 km igen. Jagten prøver desperat at komme tilbage.`
    ],

    finale_3_sprint: [
      `${km} km: 3 km igen. Leadout-togene tager over – tempoet eksploderer!`,
      `${km} km: 3 km. Tog og leadouts samler op.`
    ],
    finale_3_break: [
      `${km} km: 3 km – udbruddet giver alt mod stregen!`,
      `${km} km: 3 km igen. Udbruddet hænger stadig fast – det bliver tæt.`
    ],
    finale_3_split: [
      `${km} km: 3 km – i frontgruppen handler det om timing og position.`,
      `${km} km: 3 km igen. Frontgruppen gør klar – bagved jagter de desperat.`
    ],

    finale_2_sprint: [
      `${km} km: 2 km – de sidste sving og små huller. Kaos i positionskampen!`,
      `${km} km: 2 km igen. Alle holder vejret – nu kan man ikke komme bagfra.`
    ],
    finale_2_break: [
      `${km} km: 2 km – udbruddet må vælge: samarbejde eller forræderi.`,
      `${km} km: 2 km igen. Nu begynder spillet i udbruddet.`
    ],
    finale_2_split: [
      `${km} km: 2 km – frontgruppen tøver et øjeblik… og det kan koste dyrt.`,
      `${km} km: 2 km igen. Hver enkelt acceleration gør ondt.`
    ],

    finale_1_sprint: [
      `${km} km: 1 km – sprinterne åbner!`,
      `${km} km: 1 km igen. Nu kommer spurten!`
    ],
    finale_1_break: [
      `${km} km: 1 km – udbruddet spurter om sejren!`,
      `${km} km: 1 km igen. Det bliver en duel i udbruddet.`
    ],
    finale_1_split: [
      `${km} km: 1 km – lille gruppe-spurt i front!`,
      `${km} km: 1 km igen. Det afgøres nu.`
    ],

    finish_line: [
      `${km} km: Stregen!`,
      `${km} km: Mål!`,
      `${km} km: De kaster cyklerne på stregen!`
    ],
    sprint_result: [
      `Mål: Vinderen krydser stregen først!`,
      `Mål: Sprinten er afgjort!`,
      `Mål: Sikke en afslutning – der er en klar vinder!`
    ]
  };

  const arr = V[type] || [`${km} km: Noget sker…`];
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

  const teamNameById = new Map((teams || []).map((t) => [t.team_id, t.team_name || t.team_id]));
  const riderNameById = new Map();
  for (const t of teams || []) {
    for (const r of t.riders || []) {
      if (r?.rider_id) riderNameById.set(r.rider_id, r.rider_name || r.rider_id);
    }
  }

  // Baseline speed
  let baseSpeed = 44.0;
  baseSpeed -= 2.0 * clamp(Number(weather?.wind_speed_ms || 0) / 15, 0, 1) * 0.6;
  if (weather?.rain) baseSpeed -= 0.8;
  baseSpeed = clamp(baseSpeed, 38.0, 48.0);
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

  const peloton = { id: "G0", type: "peloton", gap_sec: 0, rider_ids: riders.map((x) => x.rider_id) };
  let breakaway = null;
  let chase = null;

  const feed = [];
  const snapshots = [];

  const activePlanByTeam = new Map();
  const runtimeOrdersByTeam = new Map(); // normalized & trigger-mutated snapshot for current tick

  function getTeamOrders(team_id) {
    const raw = ordersByTeam?.[team_id] || defaultOrders(team_id);
    if (!runtimeOrdersByTeam.has(team_id)) runtimeOrdersByTeam.set(team_id, normalizeOrders(raw));
    return runtimeOrdersByTeam.get(team_id);
  }

  function rolesForTeam(team_id) {
    const o = getTeamOrders(team_id);
    const roles = o?.roles || {};
    return {
      captain: roles.captain || null,
      sprinter: roles.sprinter || null,
      rouleur: roles.rouleur || null
    };
  }

  function ensureTeamState(team_id) {
    if (!activePlanByTeam.has(team_id)) {
      const o = getTeamOrders(team_id);
      activePlanByTeam.set(team_id, parsePlan(o.team_plan));
    }
  }

  function riderEffort(team_id, rider_id) {
    const o = getTeamOrders(team_id);
    return effortForRider(o, rider_id);
  }

  function riderMode(team_id, rider_id) {
    const o = getTeamOrders(team_id);
    return modeForRider(o, rider_id);
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

  // --- TRIGGERS (MVP) ---
  // 1) protect_captain: if captain is in chase -> set 2 helpers to protect mode and reduce chase gap slightly
  // 2) sprint_chase: if focus=sprint and break exists -> set rouleur + 1 helper to pull
  function applyTriggers(km, terrain, kmLeft) {
    for (const t of teams) {
      const team_id = t.team_id;
      ensureTeamState(team_id);

      const o = getTeamOrders(team_id);
      const plan = activePlanByTeam.get(team_id);
      const trig = o.triggers || {};

      const roles = rolesForTeam(team_id);
      const captainId = roles.captain;
      const sprinterId = roles.sprinter;
      const rouleurId = roles.rouleur;

      // protect_captain
      if (trig.protect_captain && chase && captainId && chase.rider_ids.includes(captainId)) {
        const helpers = peloton.rider_ids
          .map((id) => riderById.get(id))
          .filter((r) => r && r.team_id === team_id && r.rider_id !== captainId && r.rider_id !== sprinterId)
          .filter((r) => r.energy > 12);

        helpers.sort((a, b) => {
          const pa =
            0.6 * clamp(s(a.skills, "Strength"), 0, 100) +
            0.4 * clamp(s(a.skills, "Endurance"), 0, 100) +
            0.1 * a.energy;
          const pb =
            0.6 * clamp(s(b.skills, "Strength"), 0, 100) +
            0.4 * clamp(s(b.skills, "Endurance"), 0, 100) +
            0.1 * b.energy;
          return pb - pa;
        });

        const chosen = helpers.slice(0, 2);
        for (const r of chosen) {
          o.riders[r.rider_id] = { ...(o.riders[r.rider_id] || {}), mode: "protect_captain", effort: 0.8 };
        }

        // reduce chase gap slightly (helping effect)
        chase.gap_sec = Math.max(peloton.gap_sec + 6, chase.gap_sec - (2.5 + rng() * 4.5));

        if (rng() < 0.55) {
          const teamName = teamNameById.get(team_id) || "Et hold";
          addFeed(
            km,
            "helpers_drop_back",
            makeMessage("helpers_drop_back_named", { km, rng, teamName }),
            { team_id, team_name: teamName, captain_id: captainId, helpers: chosen.map((x) => x.rider_id) }
          );
        }

        // GC-safe behavior: auto-shift to defensive when captain in trouble
        if (plan.focus === "gc_safe") activePlanByTeam.set(team_id, parsePlan({ ...plan, style: "defensive", risk: "low" }));
      }

      // sprint_chase
      if (trig.sprint_chase && breakaway && plan.focus === "sprint") {
        if (rouleurId && peloton.rider_ids.includes(rouleurId)) {
          o.riders[rouleurId] = { ...(o.riders[rouleurId] || {}), mode: "pull", effort: 0.85 };
        }

        // also pick 1 helper if not set
        const helper = peloton.rider_ids
          .map((id) => riderById.get(id))
          .filter((r) => r && r.team_id === team_id)
          .filter((r) => r.rider_id !== rouleurId && r.rider_id !== sprinterId && r.rider_id !== roles.captain)
          .filter((r) => r.energy > 18)
          .sort((a, b) => {
            const pa = 0.6 * s(a.skills, "Strength") + 0.4 * s(a.skills, "Endurance");
            const pb = 0.6 * s(b.skills, "Strength") + 0.4 * s(b.skills, "Endurance");
            return pb - pa;
          })[0];

        if (helper) {
          o.riders[helper.rider_id] = { ...(o.riders[helper.rider_id] || {}), mode: "pull", effort: 0.75 };
        }
      }

      // opportunist: slightly higher attack tendency
      // (we don't set anything here, but used later when selecting attackers)
      void kmLeft;
      void terrain;
    }
  }

  function pickAttackersFromPeloton(terrain, count) {
    const candidates = peloton.rider_ids
      .map((id) => riderById.get(id))
      .filter((r) => r && r.status === "ok" && r.energy > 25);

    candidates.sort((a, b) => {
      // opportunist bias
      const oa = riderMode(a.team_id, a.rider_id) === "opportunist" ? 1.08 : 1.0;
      const ob = riderMode(b.team_id, b.rider_id) === "opportunist" ? 1.08 : 1.0;

      const pa = riderPower(a.skills, terrain, oa) + 0.04 * a.energy;
      const pb = riderPower(b.skills, terrain, ob) + 0.04 * b.energy;
      return pb - pa;
    });

    const topChunk = candidates.slice(0, Math.min(28, candidates.length));
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
    if (plan.focus === "sprint") distMult += kmLeft < 60 ? 0.14 : 0.08;
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
    if (plan.focus === "break") distMult *= 1.14;

    const terr = terrainKey(terrain);
    if (terr === "finale") distMult *= 0.75;

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

    // Role + Rider modes:
    const roles = rolesForTeam(rider.team_id);
    const mode = riderMode(rider.team_id, rider.rider_id);

    // Sprinter saves in peloton
    if (groupType === "peloton" && roles.sprinter && rider.rider_id === roles.sprinter) base *= 0.82;

    // Pull mode costs more energy in peloton when there is a break
    if (groupType === "peloton" && breakaway && mode === "pull") base *= 1.20;

    // Protect captain: also costs energy (dropping back / pulling)
    if (mode === "protect_captain") base *= 1.10;

    // Leadout: spends in last 3 km
    // (still in peloton typically)
    // We'll treat it more in finale effect, but add small extra burn.
    if (groupType === "peloton" && terr === "finale" && mode === "leadout") base *= 1.08;

    rider.energy = clamp(rider.energy - base, 0, 100);
  }

  // Collective pull index: strength+endurance+energy + pull-mode + rouleur role
  function pelotonPullIndex(terrain) {
    const ids = peloton.rider_ids;
    if (!ids.length) return 1.0;

    // sample up to 32 riders for stability
    const sample = ids.slice(0, Math.min(32, ids.length));
    let sum = 0;

    for (const id of sample) {
      const r = riderById.get(id);
      if (!r) continue;

      const Strength = clamp(s(r.skills, "Strength"), 0, 100);
      const Endurance = clamp(s(r.skills, "Endurance"), 0, 100);
      const energy = clamp(r.energy, 0, 100);

      const terr = terrainKey(terrain);
      const strWeight = terr === "flat" || terr === "cobbles" ? 0.65 : 0.35;
      const endWeight = 1.0 - strWeight;

      let pull = (strWeight * Strength + endWeight * Endurance) / 100;
      const energyMult = 0.55 + 0.45 * (energy / 100);
      pull *= energyMult;

      const roles = rolesForTeam(r.team_id);
      const mode = riderMode(r.team_id, r.rider_id);

      // Rouleur role boosts pull a bit (esp flat/cobbles)
      if (roles.rouleur && r.rider_id === roles.rouleur && terr !== "mountain") pull *= 1.20;

      // Individual pull mode boosts pull
      if (mode === "pull") pull *= 1.18;

      // Protect captain contributes too (slightly)
      if (mode === "protect_captain") pull *= 1.10;

      ensureTeamState(r.team_id);
      const plan = activePlanByTeam.get(r.team_id);

      // team focus influences contribution
      if (plan?.focus === "sprint" || plan?.focus === "gc_safe") pull *= 1.06;
      if (plan?.focus === "break") pull *= 0.97;

      sum += pull;
    }

    const avg = sum / Math.max(1, sample.length);
    const sizeMult = Math.sqrt(clamp(ids.length / 60, 0.5, 1.6));
    return clamp(0.75 + 0.95 * avg, 0.6, 1.7) * sizeMult;
  }

  function pickChaseLeaderTeam(terrain, kmLeft) {
    const candidates = [];

    for (const t of teams) {
      const team_id = t.team_id;
      ensureTeamState(team_id);
      const plan = activePlanByTeam.get(team_id);
      const chaseInt = teamChaseIntensity(team_id, terrain, kmLeft);

      const roles = rolesForTeam(team_id);
      let roleBonus = 0;

      // bonus if rouleur exists in peloton and has good stats
      if (roles.rouleur && peloton.rider_ids.includes(roles.rouleur)) {
        const rr = riderById.get(roles.rouleur);
        if (rr) roleBonus += 0.18 * ((clamp(s(rr.skills, "Strength"), 0, 100) + clamp(s(rr.skills, "Endurance"), 0, 100)) / 200);
      }

      // bonus for pull-mode riders in peloton
      let pullBonus = 0;
      const teamPel = peloton.rider_ids
        .map((id) => riderById.get(id))
        .filter((r) => r && r.team_id === team_id);

      const pullCount = teamPel.filter((r) => riderMode(team_id, r.rider_id) === "pull").length;
      pullBonus += clamp(pullCount, 0, 3) * 0.03;

      // sprint focus tends to chase more
      const focusBonus = plan?.focus === "sprint" ? 0.10 : plan?.focus === "gc_safe" ? 0.06 : 0;

      const score = chaseInt + roleBonus + pullBonus + focusBonus + (rng() * 0.02);
      candidates.push({ team_id, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.team_id || null;
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

    let phase = kmLeft > 80 ? 1.0 : kmLeft > 40 ? 0.85 : 0.65;
    if (terrainKey(terr) === "finale") phase *= 0.45;

    let p = clamp(0.06 * desire * phase, 0.02, 0.20);
    if (breakSize > 0) p *= 0.65;
    if (breakSize >= 6) p *= 0.45;

    // opportunists increase chance a little if many exist in peloton
    const oppCount = peloton.rider_ids
      .map((id) => riderById.get(id))
      .filter((r) => r && riderMode(r.team_id, r.rider_id) === "opportunist").length;
    p *= 1.0 + clamp(oppCount / 18, 0, 0.18);

    if (rng() > p) return;

    const attackersN = breakSize === 0 ? (2 + Math.floor(rng() * 4)) : 1;
    const attackers = pickAttackersFromPeloton(terr, attackersN);
    if (!attackers.length) return;

    // choose one name for flavor
    const hero = attackers[0];
    const heroName = riderNameById.get(hero.rider_id) || hero.rider_id;

    addFeed(
      km,
      "attack_started",
      makeMessage("attack_started_named", { km, rng, riderName: heroName }),
      { count: attackers.length, rider_id: hero.rider_id, rider_name: heroName }
    );

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
      addFeed(km, "break_formed", makeMessage("break_formed", { km, gap, rng }), {
        gap_sec: gap,
        riders: breakaway.rider_ids.length
      });
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

    const pullIndex = pelotonPullIndex(terr);

    const randomDrift = (rng() - 0.5) * 6;
    const strengthDiff = (breakStrength - pelStrength) * 0.05;

    const tacticPull = (chaseStrength - 1.0) * 4.2;
    const collectivePull = (pullIndex - 1.0) * 6.2;

    let delta = randomDrift + strengthDiff - tacticPull - collectivePull;
    if (kmLeft < 30) delta -= 2.0;
    delta = clamp(delta, -24, 24);

    breakaway.gap_sec = breakaway.gap_sec + (-delta);

    if (rng() < 0.12) {
      const leadTeamId = pickChaseLeaderTeam(terr, kmLeft);
      const teamName = leadTeamId ? (teamNameById.get(leadTeamId) || "Et hold") : "Et hold";

      const msgType = leadTeamId ? "peloton_chasing_named" : "peloton_chasing_generic";
      addFeed(km, "peloton_chasing", makeMessage(msgType, { km, rng, teamName }), {
        chase_strength: round1(chaseStrength),
        pull_index: round1(pullIndex),
        lead_team_id: leadTeamId,
        lead_team_name: teamName
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

        const eff = riderEffort(r.team_id, r.rider_id);
        drainEnergy(wrap.type, r, terrain, eff, plan);

        // if rider is destroyed in peloton -> can drop to chase group
        if (r.energy < 8 && wrap.type === "peloton") {
          if (!chase) chase = { id: "G2", type: "chase", gap_sec: peloton.gap_sec + (8 + rng() * 12), rider_ids: [] };
          peloton.rider_ids = peloton.rider_ids.filter((x) => x !== r.rider_id);
          chase.rider_ids.push(r.rider_id);
        }
      }
    }
  }

  // Finale events each km in last 5
  const finaleFlags = { k5: false, k4: false, k3: false, k2: false, k1: false, k0: false, result: false };

  function finaleType(prefix, hasBreak, hasSplit) {
    if (hasBreak) return `${prefix}_break`;
    if (hasSplit) return `${prefix}_split`;
    return `${prefix}_sprint`;
  }

  // MAIN LOOP
  for (let km = 0; km <= Math.floor(distance); km++) {
    if (!shouldTickAtKm(profile, km, distance)) continue;

    const kmLeft = Math.max(0, Math.floor(distance) - km);
    const { seg } = getSegmentAtKm(segments, km);
    const keyPoint = isKeyPointAtKm(profile, km);

    // reset runtimeOrders cache each tick (so triggers don't permanently mutate the original object over time)
    runtimeOrdersByTeam.clear();
    // re-normalize for current tick
    for (const t of teams) getTeamOrders(t.team_id);

    // Apply triggers AFTER normalization
    applyTriggers(km, seg?.terrain || "flat", kmLeft);

    // Crosswind
    maybeCrosswindSplit(km, seg);

    // Attacks + chase
    if (kmLeft > 5) {
      maybeAttackAndBreak(km, seg, kmLeft);
      maybeChaseOrCatch(km, seg, kmLeft);
    } else {
      if (breakaway) maybeChaseOrCatch(km, seg, kmLeft);
    }

    const hasBreak = !!breakaway;
    const hasSplit = !!chase;

    // Finale timeline
    if (kmLeft === 5 && !finaleFlags.k5) {
      finaleFlags.k5 = true;
      const t = finaleType("finale_5", hasBreak, hasSplit);
      addFeed(km, t, makeMessage(t, { km, rng }), { km_left: 5 });
    }
    if (kmLeft === 4 && !finaleFlags.k4) {
      finaleFlags.k4 = true;
      const t = finaleType("finale_4", hasBreak, hasSplit);
      addFeed(km, t, makeMessage(t, { km, rng }), { km_left: 4 });
    }
    if (kmLeft === 3 && !finaleFlags.k3) {
      finaleFlags.k3 = true;
      const t = finaleType("finale_3", hasBreak, hasSplit);
      addFeed(km, t, makeMessage(t, { km, rng }), { km_left: 3 });
    }
    if (kmLeft === 2 && !finaleFlags.k2) {
      finaleFlags.k2 = true;
      const t = finaleType("finale_2", hasBreak, hasSplit);
      addFeed(km, t, makeMessage(t, { km, rng }), { km_left: 2 });
    }
    if (kmLeft === 1 && !finaleFlags.k1) {
      finaleFlags.k1 = true;
      const t = finaleType("finale_1", hasBreak, hasSplit);
      addFeed(km, t, makeMessage(t, { km, rng }), { km_left: 1 });
    }
    if (kmLeft === 0 && !finaleFlags.k0) {
      finaleFlags.k0 = true;
      addFeed(km, "finish_line", makeMessage("finish_line", { km, rng }), { km_left: 0 });
    }

    // Drain + snapshot
    drainAll(seg?.terrain || "flat");
    snapshot(km);

    void keyPoint; // reserved for later
  }

  // FINISH: compute times by group + sprint within group
  const groupsAtFinish = [breakaway, peloton, chase].filter(Boolean);
  groupsAtFinish.sort((a, b) => Number(a.gap_sec) - Number(b.gap_sec));
  const leaderGap = groupsAtFinish.length ? Number(groupsAtFinish[0].gap_sec) : 0;

  // Leadout effect: if team has leadout modes in peloton at 3-1 km, sprinter gets slightly better sprint context
  function leadoutBoostForTeam(team_id) {
    const o = getTeamOrders(team_id);
    const roles = rolesForTeam(team_id);
    const sprinterId = roles.sprinter;
    if (!sprinterId) return 1.0;

    // count leadout riders on team that are in peloton at finish
    const teamPel = peloton?.rider_ids
      ?.map((id) => riderById.get(id))
      .filter((r) => r && r.team_id === team_id) || [];

    const leadoutCount = teamPel.filter((r) => modeForRider(o, r.rider_id) === "leadout").length;

    // diminishing returns
    const boost = 1.0 + clamp(leadoutCount, 0, 3) * 0.018;
    return clamp(boost, 1.0, 1.06);
  }

  const riderTimes = [];
  for (const g of groupsAtFinish) {
    const groupGap = Number(g.gap_sec) - leaderGap;
    const ids = [...g.rider_ids];

    ids.sort((a, b) => {
      const ra = riderById.get(a);
      const rb = riderById.get(b);

      const rolesA = rolesForTeam(ra.team_id);
      const rolesB = rolesForTeam(rb.team_id);

      // Base sprinter edge if conserved energy
      const sprA = rolesA.sprinter && ra.rider_id === rolesA.sprinter ? 1.06 : 1.0;
      const sprB = rolesB.sprinter && rb.rider_id === rolesB.sprinter ? 1.06 : 1.0;

      // Leadout adds small extra
      const loA = leadoutBoostForTeam(ra.team_id);
      const loB = leadoutBoostForTeam(rb.team_id);

      const pa = riderPower(ra.skills, "finale", sprA * loA) + 0.15 * ra.energy;
      const pb = riderPower(rb.skills, "finale", sprB * loB) + 0.15 * rb.energy;
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

  if (riderTimes.length && !finaleFlags.result) {
    finaleFlags.result = true;
    const winner = riderTimes[0];
    feed.push({
      km: Math.floor(distance),
      type: "sprint_result",
      message: makeMessage("sprint_result", { km: Math.floor(distance), rng }),
      payload: {
        rider_id: winner.rider_id,
        rider_name: riderNameById.get(winner.rider_id) || winner.rider_id,
        team_id: winner.team_id,
        team_name: teamNameById.get(winner.team_id) || winner.team_id
      }
    });
  }

  return { results: riderTimes, feed, snapshots };
}
