import { NextResponse } from "next/server";
import { protectedRoute, requireGameWrites } from "../../../../lib/auth/server";
import { AuthError } from "../../../../lib/auth/policy.mjs";
import { teamName } from "../../../../lib/onboarding/starter.mjs";

export const PUT = protectedRoute(async (request, context, { user, team, db }) => {
  requireGameWrites();
  const body = await request.json().catch(() => null);
  const name = teamName(body?.name);
  const { data, error } = await db.from("teams").update({ name })
    .eq("id", team.id).eq("user_id", user.id).select("name").single();

  if (error || !data) {
    throw new AuthError("TEAM_NAME_SAVE_FAILED", "Could not save your team name. Please try again.", 503);
  }
  return NextResponse.json({ ok: true, name: data.name });
});
