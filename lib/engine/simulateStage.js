// lib/engine/simulateStage.js
// Stage simulation with effective skills:
// effective = base * (1 + form*0.003) * (1 - fatigue*0.005)
// plus a simple finale model (5km->3km positioning, 3->1 train, 1->0 sprint)

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(str) {
  const s = String(str || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function effectiveSkill(rider, skill) {
  const base = Number(rider?.[skill] ?? 0);
  const form = clamp(Number(rider?.form ?? 50), 0, 100);
  const fatigue = clamp(Number(rider?.fatigue ?? 0), 0, 100);

  const formMod = 1 + form * 0.003;       // 0..+30%
  const fatigueMod = 1 - fatigue * 0.005; // 0..-50%
  return base * formMod * fatigueMod;
}

function terrainFromStage(stage) {
  const profile = stage?.profile || {};
  const segments = Array.isArray(profile?.segments) ? profile.segments : [];
  if (!segments.length) return [{ km: Number(stage?.distance_km ?? 150), terrain: "flat" }];

  return segments
    .map((s) => ({
      km: Number(s.km ?? 0) || 0,
      terrain: String(s.terrain || "flat").toLowerCase(),
    }))
    .filter((s) => s.km > 0);
}

function terrainWeight(terrain) {
  const t = String(terrain || "").toLowerCase();
  if (t.includes("mount")) return { flat: 0.1, hills: 0.3, mountain: 0.6, cobbles: 0.0 };
  if (t.includes("hill")) return { flat: 0.2, hills: 0.6, mountain: 0.2, cobbles: 0.0 };
  if (t.includes("cobbl")) return { flat: 0.3, hills: 0.2, mountain: 0.0, cobbles: 0.5 };
  return { flat: 0.85, hills: 0.10, mountain: 0.0, cobbles: 0.05 };
}

function riderStagePower(rider, stage) {
  const segs = terrainFromStage(stage);
  let score = 0;

  for (const seg of segs) {
    const w = terrainWeight(seg.terrain);

    const flat = effectiveSkill(rider, "flat");
    const hills = effectiveSkill(rider, "hills");
    const mountain = effectiveSkill(rider, "mountain");
    const cobbles = effectiveSkill(rider, "cobbles");

    const endurance = effectiveSkill(rider, "endurance");
    const strength = effectiveSkill(rider, "strength");

    const terrainScore =
      flat * w.flat +
      hills * w.hills +
      mountain * w.mountain +
      cobbles * w.cobbles;

    // Endurance & strength matter for long steady output and chasing
    const support = 0.35 * endurance + 0.25 * strength;

    score += (terrainScore + support) * seg.km;
  }

  const dist = Math.max(1, Number(stage?.distance_km ?? 150));
  return score / dist;
}

function formatGapSeconds(sec) {
  if (sec <= 0.5) return "+0s";
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `+${s}s`;
  return `+${m}:${String(r).padStart(2, "0")}`;
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

export function simulateStage({ stage, teamsWithRiders, seed = "stage" }) {
  const rng = mulberry32(hashStringToSeed(seed));
  const distanceKm = Number(stage?.distance_km ?? 150);

  const feed = [];

  // Flatten riders
  const all = [];
  for (const t of teamsWithRiders) {
    for (const r of t.riders) {
      all.push({ team: t, rider: r });
    }
  }

  // Early: mild break chance
  const hasBreak = rng() < 0.55;
  let breakGroup = [];
  if (hasBreak && all.length) {
    const n = 3 + Math.floor(rng() * 3); // 3-5
    const sortedBySprint = [...all].sort(
      (a, b) => effectiveSkill(a.rider, "sprint") - effectiveSkill(b.rider, "sprint")
    );
    breakGroup = sortedBySprint.slice(0, Math.min(n, sortedBySprint.length)).map((x) => x.rider);

    feed.push(
      pick(
        [
          `Et tidligt udbrud får hul: ${breakGroup.length} ryttere går afsted.`,
          `Der bliver kørt fra start – et udbrud på ${breakGroup.length} mand etableres.`,
          `Udbruddet formes hurtigt: ${breakGroup.length} ryttere får frihed.`,
        ],
        rng
      )
    );
  } else {
    feed.push(
      pick(
        [
          `Feltet holder det samlet fra start. Ingen får rigtigt lov at køre.`,
          `Ingen udbrud får snor – feltet kontrollerer etapen.`,
          `Rolig start: feltet vil tydeligvis til massespurt.`,
        ],
        rng
      )
    );
  }

  // Baseline time
  const baseSpeedKmh = 42.5;
  const pelotonTimeSec = (distanceKm / baseSpeedKmh) * 3600;

  // Compute times
  const riderTimes = all.map(({ team, rider }) => {
    const power = riderStagePower(rider, stage);
    const bonus = (power - 50) * 6; // mild
    const random = (rng() - 0.5) * 40;
    let time = pelotonTimeSec - bonus + random;

    if (breakGroup.find((x) => x.id === rider.id)) {
      time -= 35 + rng() * 40;
    }

    const injured = rider?.injury_until ? true : false;
    if (injured) time += 120 + rng() * 120;

    return { team, rider, timeSec: time };
  });

  // Finale: catch or not
  if (breakGroup.length) {
    const chasePool = all
      .filter((x) => !breakGroup.find((b) => b.id === x.rider.id))
      .map((x) => (effectiveSkill(x.rider, "strength") + effectiveSkill(x.rider, "endurance")) / 2);

    const chasePower = chasePool.length
      ? chasePool.reduce((a, b) => a + b, 0) / chasePool.length
      : 40;

    const breakPower = breakGroup
      .map((r) => (effectiveSkill(r, "endurance") + effectiveSkill(r, "strength")) / 2)
      .reduce((a, b) => a + b, 0) / breakGroup.length;

    const flatness = 0.8;
    const catchChance = clamp(0.55 + (chasePower - breakPower) * 0.006 + flatness * 0.12, 0.15, 0.88);

    const caught = rng() < catchChance;
    if (caught) {
      feed.push(
        pick(
          [
            `Med 5 km igen øges tempoet – udbruddet bliver hentet!`,
            `Feltet strammer grebet: udbruddet er opslugt inden finalen.`,
            `Jagtarbejdet betaler sig – udbruddet er fanget før spurten.`,
          ],
          rng
        )
      );

      for (const rt of riderTimes) {
        if (breakGroup.find((b) => b.id === rt.rider.id)) {
          rt.timeSec += 45 + rng() * 25;
        }
      }
      breakGroup = [];
    } else {
      feed.push(
        pick(
          [
            `Udbruddet nægter at dø – de holder et lille forspring ind i finalen.`,
            `De forreste kæmper heroisk, og feltet får ikke helt lukket hullet.`,
            `Frontgruppen holder stand – det ligner et shootout mellem udbrudsfolkene!`,
          ],
          rng
        )
      );
    }
  }

  // Finale events: 5/3/1 km
  feed.push(
    pick(
      [
        `5 km igen: positioneringskampen er i gang.`,
        `Finalen starter: holdene kæmper om de bedste hjul med 5 km til mål.`,
        `5 km: tempoet stiger, og feltet organiserer sig til afslutningen.`,
      ],
      rng
    )
  );

  feed.push(
    pick(
      [
        `3 km: togene begynder at forme sig – hjælperyttere lægger pres på.`,
        `3 km: flere hold prøver at samle et leadout-tog.`,
        `3 km: der bliver virkelig kørt om pladserne nu.`,
      ],
      rng
    )
  );

  feed.push(
    pick(
      [
        `1 km: sprinterne sidder klar…`,
        `1 km igen: nu handler det om timing og nerve.`,
        `1 km: sidste mand i toget kigger tilbage – hvem åbner først?`,
      ],
      rng
    )
  );

  // Sprint resolves bunch
  riderTimes.sort((a, b) => a.timeSec - b.timeSec);
  const leaderTime = riderTimes[0]?.timeSec ?? pelotonTimeSec;
  const bunch = riderTimes.filter((x) => x.timeSec - leaderTime <= 12);

  if (bunch.length >= 6 && breakGroup.length === 0) {
    const sprinted = bunch
      .map((x) => ({
        ...x,
        sprintPower:
          effectiveSkill(x.rider, "sprint") * 1.0 +
          effectiveSkill(x.rider, "flat") * 0.25 +
          effectiveSkill(x.rider, "leadership") * 0.08 +
          (rng() - 0.5) * 8,
      }))
      .sort((a, b) => b.sprintPower - a.sprintPower);

    const bunchIds = new Set(bunch.map((x) => x.rider.id));
    const rest = riderTimes.filter((x) => !bunchIds.has(x.rider.id));
    riderTimes.length = 0;
    riderTimes.push(...sprinted, ...rest);

    const top3 = sprinted.slice(0, 3).map((x) => x.rider.name).join(", ");
    feed.push(
      pick(
        [
          `SPRINT! De åbner… og det er vildt tæt! Top 3: ${top3}.`,
          `De sidste 200 meter: ren power! Top 3 på stregen: ${top3}.`,
          `Massespurt! Top 3: ${top3}.`,
        ],
        rng
      )
    );
  } else if (breakGroup.length > 0) {
    feed.push(
      pick(
        [
          `Udbruddet afgør det – de forreste kæmper om sejren på stregen.`,
          `Frontgruppen holder hele vejen hjem!`,
          `Udbruddet holder stand og afgør etapen.`,
        ],
        rng
      )
    );
  } else {
    feed.push(
      pick(
        [
          `Stregen passeres – resultatlisten falder på plads.`,
          `Mål: feltet ruller ind, og tiderne fastlåses.`,
          `Etapen er slut – resultaterne er klar.`,
        ],
        rng
      )
    );
  }

  // Build ranking with gaps
  const ranked = riderTimes.map((x, idx) => ({
    position: idx + 1,
    team_id: x.team.id,
    team_name: x.team.name,
    rider_id: x.rider.id,
    rider_name: x.rider.name,
    time_sec: x.timeSec,
  }));

  const withGaps = ranked.map((r) => ({
    ...r,
    gap_sec: r.time_sec - ranked[0].time_sec,
    gap_text: formatGapSeconds(r.time_sec - ranked[0].time_sec),
  }));

  return { results: withGaps, feed };
}
