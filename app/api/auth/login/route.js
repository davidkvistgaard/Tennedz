import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { sessionClient, requireSameOrigin, authFailure, privateHeaders } from "../../../../lib/auth/server";
import { AuthError, loginEmail } from "../../../../lib/auth/policy.mjs";
import { allowLogin } from "../../../../lib/auth/rate-limit.mjs";

export const runtime = "nodejs";
export async function POST(req) {
  try {
    requireSameOrigin(req);
    const raw = await req.text();
    if (raw.length > 4096) throw new AuthError("INVALID_LOGIN", "Loginoplysningerne er for lange.", 400);
    let body;
    try { body = JSON.parse(raw); } catch { throw new AuthError("INVALID_LOGIN", "Ugyldig anmodning.", 400); }
    const email = loginEmail(body?.login_name);
    const password = body?.password;
    if (typeof password !== "string" || !password || password.length > 1024) throw new AuthError("INVALID_LOGIN", "Skriv dit kodeord.", 400);
    const key = createHash("sha256").update(email).digest("hex");
    if (!allowLogin(key)) throw new AuthError("RATE_LIMITED", "For mange loginforsøg. Vent lidt og prøv igen.", 429);
    const client = await sessionClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.status === 429) throw new AuthError("RATE_LIMITED", "For mange loginforsøg. Vent lidt og prøv igen.", 429);
      if (!error.status || error.status >= 500) throw new AuthError("AUTH_UNAVAILABLE", "Login-tjenesten svarer ikke. Prøv igen.", 503);
      throw new AuthError("INVALID_CREDENTIALS", "Forkert e-mail/brugernavn eller kodeord.");
    }
    const response = NextResponse.json({ ok: true }, { headers: privateHeaders });
    response.cookies.set("pelotonia_session", "", { path: "/", maxAge: 0, httpOnly: true });
    return response;
  } catch (error) { return authFailure(error); }
}
