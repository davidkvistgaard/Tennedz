import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { sessionClient, requireSameOrigin, requireGameWrites, authFailure, privateHeaders } from "../../../../lib/auth/server";
import { AuthError } from "../../../../lib/auth/policy.mjs";
import { allowLogin } from "../../../../lib/auth/rate-limit.mjs";
import { signupInput } from "../../../../lib/onboarding/starter.mjs";
export const runtime = "nodejs";
export async function POST(req) {
  try {
    requireSameOrigin(req); requireGameWrites();
    const raw = await req.text();
    if (raw.length > 4096) throw new AuthError("INVALID_SIGNUP","The request is too large.",400);
    let body;
    try { body = JSON.parse(raw); } catch { throw new AuthError("INVALID_SIGNUP","Invalid request.",400); }
    const {email,password} = signupInput(body);
    if (!allowLogin("signup:"+createHash("sha256").update(email).digest("hex"))) throw new AuthError("RATE_LIMITED","Too many attempts. Please wait a moment and try again.",429);
    const client = await sessionClient();
    const existing = await client.auth.getUser();
    if (existing.data?.user) throw new AuthError("ALREADY_SIGNED_IN","You are already signed in. Go to your team or sign out first.",409);
    // Supabase remains the only credential store; no custom account table or admin bypass.
    const {data,error} = await client.auth.signUp({email,password,options:{emailRedirectTo:new URL("/auth/callback",process.env.APP_ORIGIN || req.url).href}});
    if (error) {
      if (error.status === 429) throw new AuthError("RATE_LIMITED","Too many attempts. Please wait a moment and try again.",429);
      if (error.code === "user_already_exists") throw new AuthError("SIGNUP_FAILED","Could not create the account. Try signing in if you already have one.",400);
      throw new AuthError("SIGNUP_FAILED","Could not create the account right now. Try again later or sign in with an existing account.",503);
    }
    return NextResponse.json({ok:true,needs_confirmation:!data.session},{headers:privateHeaders});
  } catch(error) { return authFailure(error); }
}
