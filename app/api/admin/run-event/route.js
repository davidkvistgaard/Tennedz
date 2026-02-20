// app/api/admin/run-event/route.js
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const expected = process.env.ADMIN_SECRET;
    if (!expected) return NextResponse.json({ ok: false, error: "Missing ADMIN_SECRET on server" }, { status: 500 });

    if (body?.secret !== expected) return NextResponse.json({ ok: false, error: "Invalid admin secret" }, { status: 401 });

    const event_id = body?.event_id;
    if (!event_id) return NextResponse.json({ ok: false, error: "Missing event_id" }, { status: 400 });

    const res = await fetch(new URL("/api/run-event", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id })
    });

    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: json?.error ?? text ?? "Run failed" }, { status: res.status });
    }

    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
