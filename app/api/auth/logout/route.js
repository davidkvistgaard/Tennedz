import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionClient, requireSameOrigin, authFailure, privateHeaders } from "../../../../lib/auth/server";
import { AuthError } from "../../../../lib/auth/policy.mjs";
export async function POST(req) {
  try {
    requireSameOrigin(req);
    const client = await sessionClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw new AuthError("LOGOUT_FAILED", "Could not sign out. Please try again.", 503);
    const jar = await cookies();
    jar.set("pelotonia_session", "", { path: "/", maxAge: 0, httpOnly: true });
    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  } catch (error) { return authFailure(error); }
}
