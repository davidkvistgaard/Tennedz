import { NextResponse } from "next/server";
import { protectedRoute } from "../../../../lib/auth/server";
import { AuthError, assertTeamId } from "../../../../lib/auth/policy.mjs";
import { defaultKit, teamKitOptions, validKitSelection } from "../../../../lib/riders/club-kit.mjs";
export const dynamic = "force-dynamic";
export const GET = protectedRoute(async (req, context, { team, db }) => {
  assertTeamId(new URL(req.url).searchParams.get("team_id"), team.id);
  const { data, error } = await db.from("club_identities").select("palette,pattern").eq("team_id", team.id).maybeSingle();
  if (error) throw new AuthError("KIT_UNAVAILABLE", "Could not load your club design. Please try again.", 503);
  if (data && !validKitSelection(data, team.id)) throw new AuthError("KIT_INVALID", "Your saved club design needs to be checked. Please contact support.", 409);
  return NextResponse.json({ ok: true, team_id: team.id, kit: data || defaultKit(team.id), saved: !!data, choices: teamKitOptions(team.id) });
});
export const PUT = protectedRoute(async (req, context, { team, db }) => {
  let body;
  try { body = await req.json(); } catch { throw new AuthError("INVALID_KIT", "Choose a palette and jersey pattern.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 2 || !body.team_id || !validKitSelection(body.kit, team.id))
    throw new AuthError("INVALID_KIT", "Choose one of your team's palettes and patterns.", 400);
  assertTeamId(body.team_id, team.id);
  const { data, error } = await db.from("club_identities").upsert({ team_id: team.id, ...body.kit, updated_at: new Date().toISOString() }, { onConflict: "team_id" }).select("palette,pattern").single();
  if (error) throw new AuthError("KIT_SAVE_FAILED", "Your design could not be saved. Please try again.", 503);
  return NextResponse.json({ ok: true, team_id: team.id, kit: data });
});
