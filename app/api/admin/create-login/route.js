import { NextResponse } from "next/server";
// Custom-auth tables remain untouched. No new custom accounts can be created.
export async function POST() {
  return NextResponse.json({ ok: false, error: "Denne loginmetode er lukket. Konti administreres i Supabase Auth." }, { status: 410 });
}
