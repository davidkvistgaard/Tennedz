// app/api/auth/logout/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession, getSessionCookieName } from "../../../../lib/serverAuth";

export const runtime = "nodejs";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const name = getSessionCookieName();
    const sessionId = cookieStore.get(name)?.value;

    if (sessionId) {
      await destroySession(sessionId);
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(name, "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    });

    return res;
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
