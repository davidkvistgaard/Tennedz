// app/api/auth/login/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSession, getSessionCookieName, verifyPassword } from "../../../../lib/serverAuth";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    const loginName = String(body?.login_name || "").trim();
    const password = String(body?.password || "");

    if (!loginName || !password) {
      return NextResponse.json(
        { ok: false, error: "Login-navn og kodeord mangler." },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: account, error } = await supabase
      .from("login_accounts")
      .select("id, login_name, password_hash, team_id")
      .ilike("login_name", loginName)
      .single();

    if (error || !account) {
      return NextResponse.json(
        { ok: false, error: "Forkert login-navn eller kodeord." },
        { status: 401 }
      );
    }

    const valid = verifyPassword(password, account.password_hash);
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "Forkert login-navn eller kodeord." },
        { status: 401 }
      );
    }

    const session = await createSession(account.id);

    const res = NextResponse.json({
      ok: true,
      login_name: account.login_name,
      team_id: account.team_id,
    });

    res.cookies.set(getSessionCookieName(), session.id, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      expires: new Date(session.expires_at),
    });

    return res;
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
