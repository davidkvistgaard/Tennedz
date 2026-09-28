import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireUser, requireSameOrigin, authFailure, privateHeaders } from "../../../../lib/auth/server";
import { AuthError, passwordChangeInput } from "../../../../lib/auth/policy.mjs";
import { allowLogin } from "../../../../lib/auth/rate-limit.mjs";

export const runtime = "nodejs";
export async function POST(req) {
  try {
    requireSameOrigin(req);
    const { user } = await requireUser();
    const raw = await req.text();
    if (raw.length > 4096) throw new AuthError("INVALID_PASSWORD_CHANGE", "The request is too long.", 400);
    let body;
    try { body = JSON.parse(raw); } catch { throw new AuthError("INVALID_PASSWORD_CHANGE", "Invalid request.", 400); }
    const { current, next } = passwordChangeInput(body);
    if (!allowLogin(`password-change:${user.id}`))
      throw new AuthError("RATE_LIMITED", "Too many attempts. Please wait before trying again.", 429);
    if (!user.email) throw new AuthError("PASSWORD_UNAVAILABLE", "This account has no sign-in email. Contact support to change its password.", 409);

    // Verify the current secret independently of the project's optional
    // "require current password" setting. Never use the service-role key.
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const verifier = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) }) },
    });
    const { data: checked, error: checkError } = await verifier.auth.signInWithPassword({ email: user.email, password: current });
    if (checkError?.status === 429) throw new AuthError("RATE_LIMITED", "Too many attempts. Please wait before trying again.", 429);
    if (checkError && (!checkError.status || checkError.status >= 500)) throw new AuthError("AUTH_UNAVAILABLE", "The sign-in service is unavailable. Please try again.", 503);
    if (checkError || checked?.user?.id !== user.id) throw new AuthError("WRONG_PASSWORD", "The current password is incorrect.", 400);

    // The verified session is fresh, so Supabase projects requiring recent
    // authentication can accept the change without an email nonce.
    const { error } = await verifier.auth.updateUser({ password: next, current_password: current });
    if (error?.status === 429) throw new AuthError("RATE_LIMITED", "Too many attempts. Please wait before trying again.", 429);
    if (error && (!error.status || error.status >= 500)) throw new AuthError("AUTH_UNAVAILABLE", "The password service is unavailable. Please try again.", 503);
    if (error) throw new AuthError("PASSWORD_CHANGE_FAILED", error.message || "Could not change your password.", 400);
    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  } catch (error) { return authFailure(error); }
}
