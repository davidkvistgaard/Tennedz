import { NextResponse } from "next/server";
import { protectedRoute } from "../../../lib/auth/server";
import { AuthError } from "../../../lib/auth/policy.mjs";

const pageSize = 50;

export const GET = protectedRoute(async (req, _context, { db }) => {
  const page = Number(new URL(req.url).searchParams.get("page") || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) {
    throw new AuthError("INVALID_PAGE", "Invalid club directory page.", 400);
  }
  const start = (page - 1) * pageSize;
  const { data, error } = await db.from("teams").select("id,name")
    .order("name").order("id").range(start, start + pageSize);
  if (error) throw new AuthError("CLUBS_UNAVAILABLE", "Could not load clubs. Please try again.", 503);
  return NextResponse.json({ ok: true, clubs: data.slice(0, pageSize), hasNext: data.length > pageSize });
});
