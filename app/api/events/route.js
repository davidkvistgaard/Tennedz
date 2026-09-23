import { protectedRoute } from "../../../lib/auth/server";
import { NextResponse } from "next/server";

// Upcoming entries must not disappear behind an ever-growing race archive.
// Read each bucket independently, returning only public event metadata.
const fields =
  "id,name,kind,gender,country_code,stage_profile_id,entry_fee,status,deadline";
async function handler(req, context, auth) {
  const url = new URL(req.url);
  const requested = Number(url.searchParams.get("limit") ?? 50);
  if (!Number.isInteger(requested) || requested < 1 || requested > 100)
    return NextResponse.json(
      { ok: false, error: "Antal løb skal være et helt tal mellem 1 og 100." },
      { status: 400 },
    );
  const now = new Date().toISOString();
  const [upcoming, pending, finished] = await Promise.all([
    auth.db
      .from("events")
      .select(fields)
      .eq("status", "OPEN")
      .gt("deadline", now)
      .order("deadline")
      .limit(requested),
    auth.db
      .from("events")
      .select(fields)
      .eq("status", "OPEN")
      .lte("deadline", now)
      .order("deadline", { ascending: false })
      .limit(requested),
    auth.db
      .from("events")
      .select(fields)
      .neq("status", "OPEN")
      .order("deadline", { ascending: false })
      .limit(requested),
  ]);
  if (upcoming.error || pending.error || finished.error)
    throw new Error("Event query failed");
  return NextResponse.json({
    ok: true,
    events: [...upcoming.data, ...pending.data, ...finished.data],
    server_time: now,
  });
}
export const GET = protectedRoute(handler);
