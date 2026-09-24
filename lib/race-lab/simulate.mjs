import seedrandom from "seedrandom";
import { VERSION, configure, clamp, MODEL_RULES as R } from "./config.mjs";
import { STRATEGIES } from "./scenario.mjs";
import { spendEnergy, groupSpeed } from "./energy.mjs";
import { chooseWork } from "./tactics.mjs";
function prepare(scenario) {
  if (
    !scenario ||
    !Array.isArray(scenario.teams) ||
    scenario.teams.length < 2 ||
    scenario.teams.length > 20
  )
    throw Error("Choose 2–20 fixture teams.");
  const ids = new Set(),
    teamIds = new Set();
  const teams = structuredClone(scenario.teams).sort((a, b) =>
    String(a.id).localeCompare(String(b.id)),
  );
  for (const t of teams) {
    if (
      typeof t.id !== "string" ||
      !t.id ||
      teamIds.has(t.id) ||
      !Object.hasOwn(STRATEGIES, t.strategy) ||
      !Array.isArray(t.riders) ||
      t.riders.length !== 8
    )
      throw Error("Invalid team or strategy.");
    teamIds.add(t.id);
    t.riders.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    for (const r of t.riders) {
      if (
        typeof r.id !== "string" ||
        !r.id ||
        ids.has(r.id) ||
        ["sprint", "flat", "endurance", "energy"].some(
          (k) =>
            typeof r[k] !== "number" ||
            !Number.isFinite(r[k]) ||
            r[k] < 0 ||
            r[k] > 100,
        )
      )
        throw Error("Invalid rider or duplicate ID.");
      ids.add(r.id);
    }
    if (!t.riders.some((r) => r.id === t.captainId))
      throw Error("Captain must belong to the team.");
  }
  return teams;
}
export function simulateLab({
  version = VERSION,
  scenario,
  seed = "pelotonia-1",
  config: overrides = {},
  trace = true,
}) {
  if (version !== VERSION)
    throw Error("Engine version mismatch. Use the recorded engine version.");
  if (typeof seed !== "string" || !seed.length || seed.length > 160)
    throw Error("Seed must be 1–160 characters.");
  const config = configure(overrides),
    teams = prepare(scenario);
  const random = (tag) => seedrandom(`${seed}:${tag}`)();
  const riders = teams.flatMap((t) =>
    t.riders.map((r) => ({
      ...r,
      teamId: t.id,
      teamName: t.name,
      captain: r.id === t.captainId,
    })),
  );
  let breakIds = new Set(),
    gap = 0,
    attacked = false,
    caught = false;
  const frames = [],
    events = [];
  const initial = riders.map((r) => ({ ...r }));
  const record = (km, actions = []) => {
    if (trace)
      frames.push({
        km,
        gapSeconds: gap,
        breakIds: [...breakIds],
        actions,
        riders: riders.map((r) => ({ id: r.id, energy: r.energy })),
      });
  };
  record(0);
  for (let km = 0; km < config.distanceKm; ) {
    const next = Math.min(
        config.distanceKm,
        km + config.stepKm,
        !attacked && km < config.attackKm ? config.attackKm : Infinity,
      ),
      distance = next - km;
    if (!attacked && km >= config.attackKm) {
      attacked = true;
      for (const t of teams) {
        const id =
          t.strategy === "break"
            ? t.captainId
            : t.strategy === "balanced"
              ? t.riders[1].id
              : null;
        if (
          id &&
          random(`attack:${id}`) <
            (t.strategy === "break" ? R.attackSuccess : R.balancedAttackSuccess)
        )
          breakIds.add(id);
      }
      if (breakIds.size) {
        gap = R.initialGap + random("attack-gap") * R.initialGapSpread;
        events.push({
          km,
          kind: "attack",
          text: `${breakIds.size} riders escape while the bunch hesitates.`,
          riderIds: [...breakIds],
        });
      } else
        events.push({
          km,
          kind: "attack-failed",
          text: "The planned attacks do not establish a break.",
        });
    }
    const actions = teams.map((t) => ({
      teamId: t.id,
      ...chooseWork(t, riders, breakIds, gap, km, config),
    }));
    const workers = new Set(actions.flatMap((a) => a.workers));
    const breakRiders = riders.filter((r) => breakIds.has(r.id));
    const pack = riders.filter((r) => !breakIds.has(r.id));
    const cooperating = breakRiders.filter(
      (r) => random(`cooperate:${km}:${r.id}`) < config.cooperation,
    );
    const cooperation = breakRiders.length
      ? cooperating.length / breakRiders.length
      : 0;
    const workPower = riders
      .filter((r) => workers.has(r.id))
      .reduce(
        (sum, r) =>
          sum +
          (r.flat / R.flatBaseline) *
            (R.workEnergyFloor + ((1 - R.workEnergyFloor) * r.energy) / 100),
        0,
      );
    const packSpeed =
      groupSpeed(pack, config.packSpeed, config) +
      config.chaseStrength * Math.sqrt(workPower);
    const breakSpeed =
      groupSpeed(breakRiders, config.breakSpeed, config) +
      (cooperation - R.cooperationCentre) * R.cooperationSpeedWeight;
    if (breakIds.size) {
      gap = Math.max(
        0,
        gap + 3600 * distance * (1 / packSpeed - 1 / breakSpeed),
      );
      if (gap === 0) {
        caught = true;
        events.push({
          km: next,
          kind: "catch",
          text: "The chase closes the gap. The attackers return to the bunch.",
          riderIds: [...breakIds],
        });
      }
    }
    for (const r of riders) {
      const inBreak = breakIds.has(r.id);
      const work = inBreak
        ? config.breakCost *
          (cooperating.some((x) => x.id === r.id)
            ? R.breakWorkingFactor
            : R.breakShelteredFactor)
        : workers.has(r.id)
          ? config.workCost
          : 0;
      const conserving =
        teams.find((t) => t.id === r.teamId).strategy === "conserve";
      spendEnergy(
        r,
        distance,
        work,
        conserving
          ? {
              ...config,
              energyCost: config.energyCost * R.conserveEnergyFactor,
            }
          : config,
      );
    }
    if (caught) breakIds = new Set();
    km = next;
    record(
      km,
      actions.map((a) => ({
        ...a,
        packSpeed,
        breakSpeed,
        cooperating: cooperating.map((r) => r.id),
      })),
    );
  }
  const finishGroup = (group) => {
    const ordered = group
      .map((r) => {
        const team = teams.find((t) => t.id === r.teamId);
        const escorts = riders.filter(
          (x) =>
            x.teamId === r.teamId &&
            x.id !== r.id &&
            !breakIds.has(x.id) &&
            x.energy > config.helperFloor,
        ).length;
        const protection =
          r.captain && team.strategy === "sprint" && !breakIds.has(r.id)
            ? Math.min(R.protectionCap, escorts * R.protectionPerHelper)
            : 0;
        const positionLoss =
          random(`position:${r.id}`) *
          (1 - protection) *
          config.positionPenalty;
        const finishPower =
          r.sprint *
            (R.finishEnergyFloor +
              ((1 - R.finishEnergyFloor) * r.energy) / 100) +
          (random(`finish:${r.id}`) - 0.5) * R.finishNoise;
        return {
          ...r,
          positionLoss,
          finishPower,
          score:
            finishPower -
            positionLoss -
            (team.strategy === "conserve" ? R.conserveFinishPenalty : 0),
        };
      })
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return ordered.map((r) => ({
      ...r,
      groupGap: clamp(
        (ordered[0].score - r.score) / R.scorePerSecond,
        0,
        config.sprintSpread,
      ),
    }));
  };
  const front = finishGroup(riders.filter((r) => breakIds.has(r.id))),
    bunch = finishGroup(riders.filter((r) => !breakIds.has(r.id)));
  const results = [
    ...front.map((r) => ({ ...r, gapSeconds: r.groupGap })),
    ...bunch.map((r) => ({
      ...r,
      gapSeconds: (front.length ? gap : 0) + r.groupGap,
    })),
  ]
    .sort((a, b) => a.gapSeconds - b.gapSeconds || a.id.localeCompare(b.id))
    .map((r, i) => ({ ...r, position: i + 1 }));
  const winner = results[0];
  events.push({
    km: config.distanceKm,
    kind: "finish",
    text: `${winner.name} wins with ${winner.energy.toFixed(1)} energy remaining.`,
    riderIds: [winner.id],
  });
  return {
    version: VERSION,
    seed,
    config,
    scenario: { ...structuredClone(scenario), teams },
    initial,
    frames,
    events,
    results,
    breakSurvived: breakIds.size > 0,
    caught,
    teamResults: teams.map((t) => ({
      teamId: t.id,
      strategy: t.strategy,
      captainPosition: results.find((r) => r.id === t.captainId).position,
      averageEnergy:
        results
          .filter((r) => r.teamId === t.id)
          .reduce((s, r) => s + r.energy, 0) / 8,
    })),
  };
}
