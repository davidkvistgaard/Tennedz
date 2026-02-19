// app/api/admin/tick/route.js
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const expected = process.env.ADMIN_SECRET;
    if (!expected) return NextResponse.json({ error: "Missing ADMIN_SECRET on server" }, { status: 500 });

    if (!body?.secret || body.secret !== expected) {
      return NextResponse.json({ error: "Invalid admin secret" }, { status: 401 });
    }

    const weeks = Number(body?.weeks ?? 1);

    // Call internal endpoint (same host)
    const res = await fetch(new URL("/api/game-tick", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": body.secret },
      body: JSON.stringify({ weeks })
    });

    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}

    if (!res.ok) {
      return NextResponse.json({ error: json?.error ?? text ?? "Tick failed" }, { status: res.status });
    }

    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: "Unhandled error: " + (e?.message ?? String(e)) }, { status: 500 });
  }
}
