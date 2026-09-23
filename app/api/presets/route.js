import { NextResponse } from "next/server";
import { protectedRoute, authFailure } from "../../../lib/auth/server";
import { AuthError } from "../../../lib/auth/policy.mjs";

export const GET = protectedRoute(async (req, context, { user, db }) => {
  const { data, error } = await db.from("tactic_presets").select("id,name,created_at,payload").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) throw new AuthError("PRESETS_UNAVAILABLE", "Dine presets kunne ikke hentes.", 503);
  return NextResponse.json({ ok: true, presets: data || [] });
});
export const POST = protectedRoute(async () => authFailure(new AuthError("GAME_READ_ONLY", "Nye presets kan gemmes, når spillets skrivefunktioner genåbnes.", 503)));
