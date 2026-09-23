import { NextResponse } from "next/server";
import { requireTeam, authFailure, privateHeaders } from "../../../../lib/auth/server";
import { AuthError } from "../../../../lib/auth/policy.mjs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { user, team, db } = await requireTeam();
    const { data, error } = await db.from("team_riders").select("rider:riders(*)").eq("team_id", team.id);
    if (error) throw new AuthError("RIDERS_UNAVAILABLE", "Holdet blev fundet, men rytterne kunne ikke hentes. Prøv igen.", 503);
    return NextResponse.json({ ok: true, logged_in: true,
      user: { id: user.id, display_name: user.user_metadata?.username || user.email || "Spiller" },
      team, riders: (data || []).map(row => row.rider).filter(Boolean),
    }, { headers: privateHeaders });
  } catch (error) { return authFailure(error); }
}
