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

function gauss(rng) {
  let u = 0,
    v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// skills keys: Sprint, Flat, Hills, Mountain, Cobbles, Leadership, Endurance, Moral, Luck, Wind, Form, Timetrial
function segmentScore(skills, seg, weather, rng) {
  const weights = seg.weights || {};
  const windIntensity = clamp(weather.wind_speed_ms / 15, 0, 1.2);
  const windExposure = clamp(seg.wind_exposure ?? 0.5, 0, 1);
  const windMult = 1 + 0.25 * windExposure * windIntensity;

  const rainVar = weather.rain ? 1.15 : 1.0;

  let base = 0;
  for (const [k, w] of Object.entries(weights)) {
    base += Number(skills[k] ?? 50) * Number(w);
  }

  const moral = clamp(Number(skills.Moral ?? 50), 0, 100);
  const form = clamp(Number(skills.Form ?? 50), 0, 100);
  const moraleMult = 0.97 + (moral / 100) * 0.06;
  const formMult = 0.95 + (form / 100) * 0.10;

  const luck = clamp(Number(skills.Luck ?? 50), 0, 100);
  const noise = gauss(rng) * (1.2 * rainVar) + (luck - 50) * 0.01;

  return (base + noise) * moraleMult * formMult * windMult;
}

export function simulateStage({ stageDistanceKm, segments, teams, weather, seedString }) {
  const rng = mulberry32(hashToSeed(seedString));

  const distance = Number(stageDistanceKm || 150);

  // baseline speed (ikke fysik, men “fornuftige tider”)
  let baseSpeed = 44.0;
  baseSpeed -= 2.0 * clamp(weather.wind_speed_ms / 15, 0, 1) * 0.6;
  if (weather.rain) baseSpeed -= 0.8;
  baseSpeed = clamp(baseSpeed, 38.0, 48.0);

  const results = [];

  for (const team of teams) {
    for (const r of team.riders) {
      let total = 0;
      let kmSum = 0;

      for (const seg of segments || []) {
        const km = Number(seg.km || 0);
        if (km <= 0) continue;

        const score = segmentScore(r.skills, seg, weather, rng);
        const speedBonus = clamp((score - 65) / 65, -0.12, 0.18);

        const segBase = (km / baseSpeed) * 3600;
        const segTime = segBase * (1.0 - 0.20 * speedBonus);

        total += segTime;
        kmSum += km;
      }

      // hvis segments ikke summer til distance, normaliserer vi
      const timeSec =
        kmSum > 0 ? total * (distance / kmSum) : (distance / baseSpeed) * 3600;

      results.push({
        team_id: team.team_id,
        rider_id: r.rider_id,
        time_sec: timeSec
      });
    }
  }

  results.sort((a, b) => a.time_sec - b.time_sec);
  results.forEach((x, idx) => (x.position = idx + 1));
  return results;
}
