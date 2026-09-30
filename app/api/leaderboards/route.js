import { NextResponse } from "next/server";
import { protectedRoute } from "../../../lib/auth/server";
import { AuthError } from "../../../lib/auth/policy.mjs";

const choices = {
  entity: ["rider", "team"], gender: ["M", "F", "combined"],
  source: ["all", "UCI", "PELOTONIA"], format: ["all", "ONE_DAY", "STAGE_RACE"],
};
function choice(params, key, fallback) {
  const value = params.get(key) ?? fallback;
  if (!choices[key].includes(value))
    throw new AuthError("INVALID_RANKING_FILTER", `Choose a valid ${key} filter.`, 400);
  return value;
}

export const GET = protectedRoute(async (req, context, { db }) => {
  const params = new URL(req.url).searchParams;
  const entity = choice(params, "entity", "rider");
  const gender = choice(params, "gender", "M");
  const source = choice(params, "source", "all");
  const format = choice(params, "format", "all");
  if (entity === "rider" && gender === "combined")
    throw new AuthError("INVALID_RANKING_FILTER", "Choose men or women for rider rankings.", 400);
  const season = params.get("season") ?? "current";
  if (season !== "current" && season !== "all" && !/^\d{4}$/.test(season))
    throw new AuthError("INVALID_RANKING_FILTER", "Choose a valid season.", 400);

  const [game, available] = await Promise.all([
    db.from("game_state").select("game_date").eq("id", 1).single(),
    db.rpc("recovery_ranking_seasons"),
  ]);
  if (game.error || available.error || !game.data?.game_date)
    throw new AuthError("RANKING_UNAVAILABLE", "Could not load the ranking seasons.", 503);
  const currentSeason = Number(game.data.game_date.slice(0, 4));
  const seasonYear = season === "all" ? null : season === "current" ? currentSeason : Number(season);
  const { data, error } = await db.rpc("recovery_points_rankings", {
    p_entity: entity, p_gender: gender === "combined" ? null : gender,
    p_source: source === "all" ? null : source,
    p_format: format === "all" ? null : format, p_season_year: seasonYear,
  });
  if (error) throw new AuthError("RANKING_UNAVAILABLE", "Could not load the rankings.", 503);
  const ids = (data ?? []).map(row => row.entity_id);
  const table = entity === "rider" ? "riders" : "teams";
  const named = ids.length ? await db.from(table).select("id,name").in("id", ids) : { data: [], error: null };
  if (named.error) throw new AuthError("RANKING_UNAVAILABLE", "Could not load ranking names.", 503);
  const names = new Map((named.data ?? []).map(row => [row.id, row.name]));
  return NextResponse.json({
    ok: true, entity, gender, source, format, season, current_season: currentSeason,
    seasons: [...new Set([currentSeason, ...(available.data ?? []).map(row => row.season_year)])].sort((a, b) => b - a),
    rows: (data ?? []).map((row, index) => ({
      rank: index + 1, id: row.entity_id, name: names.get(row.entity_id) ?? "Archived competitor",
      points: Number(row.points),
    })),
  });
});
