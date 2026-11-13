export const WINTER_POINTS_ENGINE = "recovery-one-day-4-orders-winter-points";
export const WINTER_TEAM_POINTS_LIMIT = 30;

export function usesWinterPoints(stage) {
  return stage?.tags?.includes("WINTER_2026") ?? false;
}
