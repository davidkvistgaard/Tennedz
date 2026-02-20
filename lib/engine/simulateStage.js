// lib/engine/simulateStage.js
import seedrandom from "seedrandom";

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function fmtGap(sec) {
  if (sec <= 0.4) return "0s";
  if (sec < 60) return `+${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec - m * 60);
  return `+${m}:${String(s).padStart(2, "0")}`;
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function riderScoreFlat(r, weather) {
  const flat = Number(r.flat ?? 0);
  const end = Number(r.endurance ?? 0);
  const str = Number(r.strength ?? 0);
  const spr = Number(r.sprint ?? 0);
  const wind = Number(r.wind ?? 0);

  const form = Number(r.form ?? 50);
  const fatigue = Number(r.fatigue ?? 0);

  // weather impacts
  const windKph = Number(weather?.wind_kph ?? 0);
  const rain = Number(weather?.precipitation_mm ?? 0);
  const temp = Number(weather?.temp_c ?? 15);

  const windFactor = clamp(windKph / 60, 0, 1);      // 0..1
  const rainFactor = clamp(rain / 18, 0, 1);         // 0..1
  const coldFactor = temp < 6 ? clamp((6 - temp) / 10, 0, 1) : 0;
  const heatFactor = temp > 28 ? clamp((temp - 28) / 12, 0, 1) : 0;

  // Base ability
  let score =
    flat * 1.05 +
    end * 0.9 +
    str * 0.8 +
    spr * 0.25 +
    wind * (0.25 + 0.65 * windFactor);

  // Form/fatigue modifiers
  score *= (0.82 + (form / 100) * 0.35);       // form helps
  score *= (1.00 - (fatigue / 100) * 0.25);    // fatigue hurts

  // rain/cold/heat add stress -> reward strength/endurance
  score += (end + str) * (0.10 * rainFactor + 0.08 * coldFactor + 0.06 * heatFactor);

  return score;
}

function sprintScore(r, weather) {
  const spr = Number(r.sprint ?? 0);
  const flat = Number(r.flat ?? 0);
  const end = Number(r.endurance ?? 0);
  const str = Number(r.strength ?? 0);
  const wind = Number(r.wind ?? 0);

  const form = Number(r.form ?? 50);
  const fatigue = Number(r.fatigue ?? 0);

  const windKph = Number(weather?.wind_kph ?? 0);
  const rain = Number(weather?.precipitation_mm ?? 0);

  const windFactor = clamp(windKph / 60, 0, 1);
  const rainFactor = clamp(rain / 18, 0, 1);

  let score = spr * 1.35 + flat * 0.65 + end * 0.25 + str * 0.25 + wind * (0.15 + 0.45 * windFactor);

  score *= (0.85 + (form / 100) * 0.30);
  score *= (1.00 - (fatigue / 100) * 0.22);

  // rain increases chaos: slightly reduces pure sprint reliability
  score *= (1.00 - 0.10 * rainFactor);

  return score;
}

function gaussian(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function simulateStage({ stage, teamsWithRiders, seed, weather }) {
  const rng = seedrandom(String(seed || "seed"));
  const dist = Number(stage?.distance_km ?? 150);

  const w = weather || { temp_c: 15, wind_kph: 10, precipitation_mm: 0, condition: "Clear", wind_dir: "W" };

  const feed = [];
  feed.push({
    km: 0,
    text: `Vejr: ${w.condition} · ${w.temp_c}°C · vind ${w.wind_kph} km/t (${w.wind_dir}) · nedbør ${w.precipitation_mm} mm.`
  });

  // Flatten riders
  const riders = [];
  for (const t of teamsWithRiders) {
    for (const r of (t.riders || [])) {
      riders.push({
        team_id: t.id,
        team_name: t.name,
        rider_id: r.id,
        rider_name: r.name,
        gender: r.gender,
        is_captain: !!r.is_captain,
        raw: r
      });
    }
  }

  // Determine if weather creates “splits”
  const splitRisk =
    clamp(Number(w.wind_kph) / 70, 0, 1) * 0.55 +
    clamp(Number(w.precipitation_mm) / 25, 0, 1) * 0.35;

  const hasSplits = rng() < splitRisk;

  // Early break chance (reduced if very calm)
  const calm = Number(w.wind_kph) < 12 && Number(w.precipitation_mm) === 0;
  const breakChance = calm ? 0.35 : 0.55;

  // Pick break group
  const breakSize = rng() < 0.55 ? 3 : 4;
  const breakGroup = [];
  if (rng() < breakChance) {
    const shuffled = riders.slice().sort(() => rng() - 0.5);
    for (const rr of shuffled) {
      if (breakGroup.length >= breakSize) break;
      // avoid stacking too many from same team in break
      const sameTeam = breakGroup.filter(x => x.team_id === rr.team_id).length;
      if (sameTeam >= 2) continue;
      breakGroup.push(rr);
    }
  }

  if (breakGroup.length) {
    feed.push({ km: 8, text: `${breakGroup.map(x => x.rider_name).join(", ")} går i udbrud!` });
  } else {
    feed.push({ km: 10, text: "Ingen kommer rigtigt afsted — feltet holder det samlet." });
  }

  if (hasSplits) {
    feed.push({ km: 60, text: "Sidevind! Feltet splittes i vifter, og flere ryttere kæmper for at sidde med." });
  } else if (!calm) {
    feed.push({ km: 70, text: "Tempoet stiger gradvist, men feltet ser kontrolleret ud." });
  } else {
    feed.push({ km: 75, text: "En rolig dag — alle virker til at spare kræfter til finalen." });
  }

  // Final 5 km: add more granular events
  const finalTexts = [
    "5 km igen — holdene begynder at positionere sig.",
    "4 km — tempoet er højt, og det gælder om at ramme de rigtige hjul.",
    "3 km — sprintertog tager form.",
    "2 km — nervøst, og der bliver kæmpet om pladsen.",
    "1 km — nu er det sprinten der afgør det!"
  ];
  for (let i = 5; i >= 1; i--) {
    feed.push({ km: dist - i, text: finalTexts[5 - i] });
  }

  // Build time model
  // base seconds: 40 km/h baseline -> 150 km = 3h45 = 13500 sec
  const baseSpeedKph = 40;
  const baseTimeSec = (dist / baseSpeedKph) * 3600;

  // Weather slows a bit (rain/cold/strong wind)
  const windSlow = clamp(Number(w.wind_kph) / 90, 0, 1) * 0.05;
  const rainSlow = clamp(Number(w.precipitation_mm) / 30, 0, 1) * 0.06;
  const tempSlow = (Number(w.temp_c) < 4 ? 0.03 : Number(w.temp_c) > 32 ? 0.02 : 0);

  const weatherSlow = 1 + windSlow + rainSlow + tempSlow;

  // Compute “pack” performance and sprint performance
  const perf = riders.map(rr => {
    const flatScore = riderScoreFlat(rr.raw, w);
    const sprScore = sprintScore(rr.raw, w);
    return { ...rr, flatScore, sprScore };
  });

  // Sort by flat performance first
  perf.sort((a, b) => b.flatScore - a.flatScore);

  // Determine groups: if splits, create gap between front group and chasers
  const results = [];

  // Winner logic: if break exists, chance it survives depends on weather & strength/endurance contribution
  let breakSurvives = false;
  if (breakGroup.length) {
    const breakStr = breakGroup.reduce((s, rr) => s + Number(rr.raw.strength ?? 0) + Number(rr.raw.endurance ?? 0), 0) / breakGroup.length;
    const chaseStr = perf.slice(0, 16).reduce((s, rr) => s + Number(rr.raw.strength ?? 0) + Number(rr.raw.endurance ?? 0), 0) / 16;

    const weatherHard = clamp((Number(w.wind_kph) / 70) + (Number(w.precipitation_mm) / 22), 0, 1);
    const survivalP = clamp(0.25 + (breakStr - chaseStr) / 140 + weatherHard * 0.15, 0.12, 0.55);
    breakSurvives = rng() < survivalP;

    feed.push({
      km: dist - 12,
      text: breakSurvives
        ? "Udbruddet holder overraskende stand ind i finalen!"
        : "Feltet organiserer jagten — udbruddet bliver hentet."
    });
  }

  // Sprint outcome among front contenders
  const contenders = breakSurvives
    ? perf.filter(p => breakGroup.some(b => b.rider_id === p.rider_id))
    : perf.slice(0, 40);

  contenders.sort((a, b) => b.sprScore - a.sprScore);

  // Randomness increases in rain/wind
  const chaos = 0.55 * clamp(Number(w.precipitation_mm) / 18, 0, 1) + 0.35 * clamp(Number(w.wind_kph) / 70, 0, 1);
  const sigma = 0.6 + 1.8 * chaos; // seconds of variance in sprint ordering

  const sprintOrder = contenders
    .map(c => ({ c, noise: gaussian(rng) * sigma }))
    .sort((x, y) => (y.c.sprScore + y.noise) - (x.c.sprScore + x.noise))
    .map(x => x.c);

  const winner = sprintOrder[0];

  feed.push({
    km: dist,
    text: `Mål! ${winner.rider_name} (${winner.team_name}) tager sejren i spurten.`
  });

  // Create final times
  // Winner time is baseTime adjusted by weather + performance
  const winnerPerf = clamp(winner.flatScore / 120, 0.75, 1.35);
  const winTime = baseTimeSec * weatherSlow * (1.05 - (winnerPerf - 1) * 0.10);

  // Assign times: those close in sprint within seconds, others with gaps
  const used = new Set();

  function addResult(rr, timeSec) {
    results.push({
      position: results.length + 1,
      rider_id: rr.rider_id,
      rider_name: rr.rider_name,
      team_id: rr.team_id,
      team_name: rr.team_name,
      time_sec: timeSec
    });
    used.add(rr.rider_id);
  }

  // Top 10 from sprintOrder
  for (let i = 0; i < Math.min(10, sprintOrder.length); i++) {
    const rr = sprintOrder[i];
    const gap = clamp(Math.abs(gaussian(rng)) * (1.2 + chaos * 3.2), 0, 12); // seconds
    addResult(rr, winTime + (i === 0 ? 0 : gap + i * (0.2 + chaos * 0.6)));
  }

  // Rest of peloton
  const rest = perf.filter(p => !used.has(p.rider_id));
  // If splits: put some riders into second group
  const splitGap = hasSplits ? (25 + rng() * 55) * (0.4 + chaos) : 0;

  for (const rr of rest) {
    const rrPerf = clamp(rr.flatScore / 120, 0.75, 1.35);
    let t = baseTimeSec * weatherSlow * (1.08 - (rrPerf - 1) * 0.08);

    // behind winner
    t = Math.max(t, winTime + 4);

    // random group gaps
    t += clamp(Math.abs(gaussian(rng)) * (10 + chaos * 22), 0, 110);

    // split penalty sometimes
    if (hasSplits && rng() < 0.35) t += splitGap;

    addResult(rr, t);
  }

  // Sort by time
  results.sort((a, b) => a.time_sec - b.time_sec);
  results.forEach((r, idx) => { r.position = idx + 1; });

  // Add gap_text relative to winner
  const t0 = results[0]?.time_sec ?? winTime;
  results.forEach(r => {
    r.gap_text = fmtGap(r.time_sec - t0);
  });

  return { feed, results };
}

export default simulateStage;
