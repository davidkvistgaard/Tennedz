import seedrandom from "seedrandom";

export function simulateStage({ stage, teamsWithRiders, seed }) {
  const rng = seedrandom(seed || "default");
  const ENGINE_VERSION = "2.0";

  const results = [];
  const feed = [];

  const allRiders = [];

  teamsWithRiders.forEach((t) => {
    t.riders.forEach((r) => {
      allRiders.push({
        ...r,
        team_id: t.id,
        team_name: t.name
      });
    });
  });

  // === Breakaway chance depends on terrain
  const terrainFactor =
    stage.profile_type === "FLAT" ? 0.1 :
    stage.profile_type === "HILLS" ? 0.3 :
    stage.profile_type === "MOUNTAIN" ? 0.6 : 0.2;

  const breakSize = Math.floor(rng() * 4) + 2;

  const breakaway = [];

  if (rng() < terrainFactor) {
    for (let i = 0; i < breakSize; i++) {
      breakaway.push(allRiders[Math.floor(rng() * allRiders.length)]);
    }

    feed.push({
      km: 20,
      text: `Udbrud dannes med ${breakaway.map(r => r.name).join(", ")}`
    });
  }

  // === Base time
  const baseTime = stage.distance_km * 240;

  allRiders.forEach((r) => {
    let skillScore =
      r.flat * 0.3 +
      r.hills * 0.2 +
      r.mountain * 0.2 +
      r.sprint * 0.2 +
      r.endurance * 0.1;

    const fatiguePenalty = r.fatigue * 1.2;
    const formBonus = r.form * 0.8;

    const randomFactor = rng() * 50;

    let time = baseTime - skillScore * 2 + fatiguePenalty - formBonus + randomFactor;

    if (breakaway.includes(r)) {
      time -= 120; // break bonus
    }

    results.push({
      ...r,
      time_sec: time
    });
  });

  results.sort((a, b) => a.time_sec - b.time_sec);

  const winnerTime = results[0].time_sec;

  results.forEach((r, i) => {
    r.position = i + 1;
    r.gap_sec = Math.max(0, r.time_sec - winnerTime);
    r.gap_text = r.gap_sec === 0 ? "0s" : `+${Math.round(r.gap_sec)}s`;
  });

  return {
    results,
    feed,
    engine_version: ENGINE_VERSION,
    seed
  };
}
