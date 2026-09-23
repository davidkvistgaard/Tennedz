import { NextResponse } from "next/server";
import { sessionClient, privateHeaders } from "../../../lib/auth/server";
export async function GET(req) {
  const origin = process.env.APP_ORIGIN || new URL(req.url).origin;
  const code = new URL(req.url).searchParams.get("code");
  try {
    if (code && code.length < 2048) {
      const client = await sessionClient();
      const {error} = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL("/onboarding",origin),{headers:privateHeaders});
    }
  } catch { /* Recover with ordinary password login; never expose provider tokens. */ }
  return NextResponse.redirect(new URL("/login?confirmation=failed",origin),{headers:privateHeaders});
}
