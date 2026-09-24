import { NextResponse } from "next/server";
// Custom-auth tables remain untouched. No new custom accounts can be created.
export async function POST() {
  return NextResponse.json({ ok: false, error: "This sign-in method is retired. Accounts are managed in Supabase Auth." }, { status: 410 });
}
