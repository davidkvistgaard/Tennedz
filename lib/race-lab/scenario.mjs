export const STRATEGIES = {
  sprint: "Protect the sprinter",
  break: "Send the captain in the break",
  balanced: "Balanced racing",
  conserve: "Save energy",
};
export function flatScenario(strategy = "sprint") {
  if (!Object.hasOwn(STRATEGIES, strategy)) throw Error("Unknown strategy.");
  return {
    name: "Coast Road laboratory",
    teams: ["Amber", "Birch", "Cedar", "Dune"].map((name, t) => ({
      id: `team-${t}`,
      name,
      strategy: t === 0 ? strategy : ["sprint", "break", "balanced"][t - 1],
      captainId: `r-${t}-0`,
      riders: Array.from({ length: 8 }, (_, i) => ({
        id: `r-${t}-${i}`,
        name: `${name} ${i === 0 ? "Captain" : `Rider ${i + 1}`}`,
        sprint: i === 0 ? 88 : 48 + i * 2,
        flat: 68 + i,
        endurance: 76 - i,
        energy: 100,
      })),
    })),
  };
}
