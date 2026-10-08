import { simulateLab } from "./simulate.mjs";
import { flatScenario, STRATEGIES } from "./scenario.mjs";
import { configure, VERSION } from "./config.mjs";
export function batchInput({
  version = VERSION,
  count = 100,
  seed = "pelotonia",
  config = {},
} = {}) {
  if (version !== VERSION) throw Error("Engine version mismatch.");
  if (!Number.isInteger(count) || count < 2 || count > 500)
    throw Error("Choose 2–500 paired seeds.");
  if (typeof seed !== "string" || !seed || seed.length > 120)
    throw Error("Choose a seed of 1–120 characters.");
  return { count, seed, config: configure(config) };
}
export function trial(input, i) {
  return Object.keys(STRATEGIES).map((strategy) => {
    const race = simulateLab({
      scenario: flatScenario(strategy),
      seed: `${input.seed}:${i}`,
      config: input.config,
      trace: false,
    });
    const own = race.teamResults.find((t) => t.teamId === "team-0");
    return {
      strategy,
      captainPosition: own.captainPosition,
      energy: own.averageEnergy,
      riderWin: race.results[0].teamId === "team-0",
      breakSurvived: race.breakSurvived,
    };
  });
}
function wilson(wins, n) {
  const z = 1.96,
    p = wins / n,
    d = 1 + (z * z) / n,
    c = (p + (z * z) / (2 * n)) / d,
    h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
export function summarize(input, trials) {
  if (trials.length !== input.count) throw Error("Incomplete batch.");
  const baseline = trials.map((rows) =>
    rows.find((r) => r.strategy === "sprint"),
  );
  return {
    version: VERSION,
    ...input,
    opponents: ["sprint", "break", "balanced"],
    rows: Object.keys(STRATEGIES).map((strategy) => {
      const values = trials.map((t) => t.find((r) => r.strategy === strategy));
      const wins = values.filter((r) => r.captainPosition === 1).length;
      const deltas = values.map(
        (r, i) => r.captainPosition - baseline[i].captainPosition,
      );
      const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
      return {
        strategy,
        captainWins: wins,
        captainWinRate: wins / input.count,
        winInterval95: wilson(wins, input.count),
        riderWinRate: mean(values.map((r) => Number(r.riderWin))),
        averageCaptainPosition: mean(values.map((r) => r.captainPosition)),
        averageEnergy: mean(values.map((r) => r.energy)),
        breakSurvivalRate: mean(values.map((r) => Number(r.breakSurvived))),
        pairedPositionDelta: mean(deltas),
      };
    }),
  };
}
export function comparePlans(options) {
  const input = batchInput(options);
  return summarize(
    input,
    Array.from({ length: input.count }, (_, i) => trial(input, i)),
  );
}
