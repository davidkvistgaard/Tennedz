import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { AuthError, assertAdmin, assertSameOrigin, selectOwnedTeam } from "./policy.mjs";

export const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
export async function sessionClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new AuthError("AUTH_CONFIGURATION", "Login er endnu ikke konfigureret i dette miljø.", 503);
  const jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: values => values.forEach(({ name, value, options }) => jar.set(name, value, options)),
    },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) }) },
  });
}
export function databaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new AuthError("DATA_CONFIGURATION", "Holddata er endnu ikke konfigureret i dette miljø.", 503);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) }) },
  });
}
export async function requireUser() {
  const client = await sessionClient();
  const { data, error } = await client.auth.getUser();
  if (error && (!error.status || error.status >= 500)) throw new AuthError("AUTH_UNAVAILABLE", "Login-tjenesten svarer ikke. Prøv igen.", 503);
  if (error || !data?.user) throw new AuthError("UNAUTHENTICATED", "Du skal logge ind.");
  return { user: data.user, client };
}
export async function requireTeam() {
  const { user } = await requireUser();
  const db = databaseClient();
  const { data, error } = await db.from("teams").select("*").eq("user_id", user.id).limit(2);
  if (error) throw new AuthError("TEAM_UNAVAILABLE", "Dit hold kunne ikke hentes. Prøv igen.", 503);
  return { user, team: selectOwnedTeam(data, user.id), db };
}
export function requireSameOrigin(req) { assertSameOrigin(req, process.env.APP_ORIGIN); }
export async function requireAdministrator(req) {
  if (req.method !== "GET") requireSameOrigin(req);
  const { user } = await requireUser();
  assertAdmin(user.id, process.env.ADMIN_USER_IDS);
  return user;
}
export function requireGameWrites() {
  if (process.env.RECOVERY_ALLOW_GAME_WRITES !== "true") throw new AuthError("GAME_READ_ONLY", "Spillet er midlertidigt skrivebeskyttet under genopretningen.", 503);
}
// Phase 4 must add atomic execution and point accounting before these routes reopen.
export async function suspendRaceWrite(req) {
  try {
    await requireAdministrator(req);
    throw new AuthError("RACE_RECOVERY_PENDING", "Løbsafvikling og tidsændringer åbnes efter kontrol af spilforløbet.", 503);
  } catch (error) { return authFailure(error); }
}
export function authFailure(error) {
  const known = error instanceof AuthError;
  return NextResponse.json({ ok: false, code: known ? error.code : "SERVICE_UNAVAILABLE", error: known ? error.message : "Tjenesten kunne ikke svare. Prøv igen." }, {
    status: known ? error.status : 503, headers: privateHeaders,
  });
}
export function protectedRoute(handler, { admin = false } = {}) {
  return async function route(req, context) {
    try {
      if (req.method !== "GET") requireSameOrigin(req);
      const auth = admin ? { user: await requireAdministrator(req) } : await requireTeam();
      const response = await handler(req, context, auth);
      for (const [key, value] of Object.entries(privateHeaders)) response.headers.set(key, value);
      return response;
    } catch (error) { return authFailure(error); }
  };
}
