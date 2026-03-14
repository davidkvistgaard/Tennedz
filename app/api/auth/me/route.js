// app/api/auth/me/route.js
import { NextResponse } from "next/server";
import { getCurrentAuth } from "../../../../lib/serverAuth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await getCurrentAuth();

    return NextResponse.json({
      ok: true,
      logged_in: !!auth?.team,
      login: auth.login
        ? {
            id: auth.login.id,
            login_name: auth.login.login_name,
            team_id: auth.login.team_id,
          }
        : null,
      team: auth.team || null,
      riders: auth.riders || [],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
