import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser, databaseClient, requireSameOrigin, requireGameWrites, authFailure, privateHeaders } from "../../../lib/auth/server";
import { AuthError, selectOwnedTeam } from "../../../lib/auth/policy.mjs";
import { starterPack, teamName } from "../../../lib/onboarding/starter.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { user } = await requireUser();
    const { data, error } = await databaseClient().from("teams").select("id,user_id").eq("user_id",user.id).limit(2);
    if (error) throw new Error("Team lookup failed");
    if (data.length) selectOwnedTeam(data,user.id);
    return NextResponse.json({ ok:true, has_team:data.length === 1 },{headers:privateHeaders});
  } catch(error) { return authFailure(error); }
}
export async function POST(req) {
  try {
    requireSameOrigin(req);
    const { user } = await requireUser();
    requireGameWrites();
    const raw = await req.text();
    if (raw.length > 1024) throw new AuthError("INVALID_REQUEST","Anmodningen er for stor.",400);
    let body;
    try { body = JSON.parse(raw); } catch { throw new AuthError("INVALID_REQUEST","Ugyldig anmodning.",400); }
    // Never accept user IDs, rider stats, coins or ownership claims from the client.
    const name = teamName(body?.name);
    const { data, error } = await databaseClient().rpc("recovery_create_starter_team", {
      p_user:user.id, p_name:name, p_riders:starterPack(() => randomInt(0,2**32)/2**32),
    });
    if (error) {
      if (error.code === "P0001") throw new AuthError("TEAM_LINK_CONFLICT","Din holdtilknytning skal kontrolleres af administratoren. Ingen data er ændret.",409);
      throw new Error("Team creation failed");
    }
    return NextResponse.json({ok:true,team_id:data.team_id,created:data.created},{headers:privateHeaders});
  } catch(error) { return authFailure(error); }
}
