import { NextResponse } from "next/server";
import { protectedRoute } from "../../../../lib/auth/server";
import { AuthError } from "../../../../lib/auth/policy.mjs";

const pageSize = 24;

async function directoryKind(context) {
  const { kind } = await context.params;
  if (kind !== "manager" && kind !== "rider") throw new AuthError("NOT_FOUND", "Directory not found.", 404);
  return kind;
}

export const GET = protectedRoute(async (req, context, { db, team }) => {
  const kind = await directoryKind(context);
  const params = new URL(req.url).searchParams;
  const query = (params.get("q") || "").trim();
  const page = Number(params.get("page") || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || query.length > 100) {
    throw new AuthError("INVALID_SEARCH", "Invalid directory search.", 400);
  }
  const { data, error } = await db.rpc("find_directory_" + kind + "s", {
    p_owner: team.id, p_query: query, p_offset: (page - 1) * pageSize, p_limit: pageSize + 1,
  });
  if (error) throw new AuthError("DIRECTORY_UNAVAILABLE", "Could not load the directory. Please try again.", 503);
  return NextResponse.json({ ok: true, entries: data.slice(0, pageSize), hasNext: data.length > pageSize });
});

export const PUT = protectedRoute(async (req, context, { db, team }) => {
  const kind = await directoryKind(context);
  const input = await req.json().catch(() => null);
  if (typeof input?.id !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.id) || typeof input.favorite !== "boolean") {
    throw new AuthError("INVALID_FAVORITE", "Invalid favorite.", 400);
  }
  const table = db.from("directory_" + kind + "_favorites");
  const result = input.favorite
    ? await table.upsert({ owner_team_id: team.id, target_id: input.id }, { onConflict: "owner_team_id,target_id", ignoreDuplicates: true })
    : await table.delete().eq("owner_team_id", team.id).eq("target_id", input.id);
  if (result.error?.code === "23503") throw new AuthError("NOT_FOUND", "This entry is no longer available.", 404);
  if (result.error) throw new AuthError("FAVORITE_UNAVAILABLE", "Could not save your favorite. Please try again.", 503);
  return NextResponse.json({ ok: true });
});
