import { NextResponse } from "next/server";
import { protectedRoute } from "../../../lib/auth/server";
import { AuthError } from "../../../lib/auth/policy.mjs";
import { validateTeamKit } from "../../../lib/riders/club-kit.mjs";

const pageSize = 24;
const unavailable = () => new AuthError("CLUBS_UNAVAILABLE", "Could not load clubs. Please try again.", 503);

export const GET = protectedRoute(async (req, _context, { db, team }) => {
  const params = new URL(req.url).searchParams;
  const query = (params.get("q") || "").trim();
  const page = Number(params.get("page") || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || query.length > 100) {
    throw new AuthError("INVALID_SEARCH", "Invalid club search.", 400);
  }
  const start = (page - 1) * pageSize;
  const result = query
    ? await db.rpc("search_clubs", { p_query: query, p_offset: start, p_limit: pageSize + 1 })
    : await db.from("club_favorites").select("club:teams!favorite_team_id!inner(id,name)")
      .eq("owner_team_id", team.id).order("favorite_team_id").range(start, start + pageSize);
  if (result.error) throw unavailable();
  const clubs = result.data.slice(0, pageSize).map(row => query ? row : row.club);
  if (!clubs.length) return NextResponse.json({ ok: true, clubs: [], hasNext: false });
  const ids = clubs.map(club => club.id);
  const [kits, favorites] = await Promise.all([
    db.from("club_identities").select("team_id,palette,pattern").in("team_id", ids),
    query ? db.from("club_favorites").select("favorite_team_id").eq("owner_team_id", team.id)
      .in("favorite_team_id", ids) : Promise.resolve({ data: ids.map(id => ({ favorite_team_id: id })) }),
  ]);
  if (kits.error || favorites.error) throw unavailable();
  const kitById = new Map(kits.data.map(kit => [kit.team_id, kit]));
  const favoriteIds = new Set(favorites.data.map(row => row.favorite_team_id));
  return NextResponse.json({
    ok: true, hasNext: result.data.length > pageSize,
    clubs: clubs.map(club => ({ ...club, kit: validateTeamKit(kitById.get(club.id), club.id), favorite: favoriteIds.has(club.id) })),
  });
});

export const PUT = protectedRoute(async (req, _context, { db, team }) => {
  const input = await req.json().catch(() => null);
  if (typeof input?.id !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.id) || typeof input.favorite !== "boolean") {
    throw new AuthError("INVALID_FAVORITE", "Invalid club favorite.", 400);
  }
  const id = input.id.toLowerCase();
  const result = input.favorite
    ? await db.from("club_favorites").upsert({ owner_team_id: team.id, favorite_team_id: id },
      { onConflict: "owner_team_id,favorite_team_id", ignoreDuplicates: true })
    : await db.from("club_favorites").delete().eq("owner_team_id", team.id).eq("favorite_team_id", id);
  if (result.error?.code === "23503") throw new AuthError("CLUB_NOT_FOUND", "Club not found.", 404);
  if (result.error) throw new AuthError("FAVORITE_UNAVAILABLE", "Could not save your favorite. Please try again.", 503);
  return NextResponse.json({ ok: true });
});
