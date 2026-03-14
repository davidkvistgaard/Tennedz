// lib/serverAuth.js
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SESSION_COOKIE = "pelotonia_session";

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string") return false;
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const [, salt, hash] = parts;
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(derived, "hex")
    );
  } catch {
    return false;
  }
}

export async function createSession(loginAccountId) {
  const supabase = getSupabaseAdmin();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  const { data, error } = await supabase
    .from("auth_sessions")
    .insert({
      login_account_id: loginAccountId,
      expires_at: expiresAt,
    })
    .select("id, expires_at")
    .single();

  if (error) throw error;
  return data;
}

export async function destroySession(sessionId) {
  const supabase = getSupabaseAdmin();
  if (!sessionId) return;
  await supabase.from("auth_sessions").delete().eq("id", sessionId);
}

export async function getCurrentAuth() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    return { session: null, login: null, team: null, riders: [] };
  }

  const supabase = getSupabaseAdmin();

  const { data: sessionRow, error: sessionErr } = await supabase
    .from("auth_sessions")
    .select("id, login_account_id, expires_at")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !sessionRow) {
    return { session: null, login: null, team: null, riders: [] };
  }

  if (new Date(sessionRow.expires_at) < new Date()) {
    await destroySession(sessionId);
    return { session: null, login: null, team: null, riders: [] };
  }

  const { data: loginRow, error: loginErr } = await supabase
    .from("login_accounts")
    .select("id, login_name, team_id")
    .eq("id", sessionRow.login_account_id)
    .single();

  if (loginErr || !loginRow) {
    return { session: null, login: null, team: null, riders: [] };
  }

  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .select("*")
    .eq("id", loginRow.team_id)
    .single();

  if (teamErr || !team) {
    return { session: null, login: loginRow, team: null, riders: [] };
  }

  const { data: tr, error: trErr } = await supabase
    .from("team_riders")
    .select("rider:riders(*)")
    .eq("team_id", team.id);

  const riders = trErr ? [] : (tr ?? []).map(x => x.rider).filter(Boolean);

  return {
    session: sessionRow,
    login: loginRow,
    team,
    riders,
  };
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}
