import "server-only";
import { raceErrorMessage } from "./messages.mjs";
import { NextResponse } from "next/server";
import { AuthError } from "../auth/policy.mjs";
import {
  databaseClient,
  requireAdministrator,
  requireGameWrites,
  authFailure,
  privateHeaders,
} from "../auth/server";
import { buildRace } from "./cycle.mjs";
import { withRecordedAppearanceV1 } from "../viewer/recorded-appearance-v1.mjs";
export function uuid(value) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
  )
    throw new AuthError("INVALID_ID", "Invalid race or rider ID.", 400);
  return value;
}
export async function rpc(db, name, args) {
  const { data, error } = await db.rpc(name, args);
  if (error) {
    const status = /^PT(400|403|404|409)$/.test(error.code)
      ? Number(error.code.slice(2))
      : 503;
    throw new AuthError(
      "RACE_UNAVAILABLE",
      status === 503
        ? "The race service could not save your changes. Please try again."
        : raceErrorMessage(error.message),
      status,
    );
  }
  return data;
}
export async function executeRace(db, id) {
  const snapshot = await rpc(db, "recovery_race_snapshot", { p_event: id });
  if (snapshot.finished) return { ...snapshot.summary, already_finished: true };
  let output;
  try {
    output = buildRace(snapshot);
  } catch (e) {
    throw new AuthError("INVALID_RACE", e.message, 409);
  }
  const teamIds = snapshot.teams.map(team => team.id);
  const identities = [];
  for (let start = 0; start < teamIds.length; start += 40) {
    const { data, error } = await db.from("club_identities")
      .select("team_id,palette,pattern")
      .in("team_id", teamIds.slice(start, start + 40));
    if (error) throw new AuthError("RACE_UNAVAILABLE",
      "Could not save the teams' race appearance. Please try again.", 503);
    identities.push(...data);
  }
  output = withRecordedAppearanceV1(output, identities);
  return rpc(db, "recovery_finish_race", {
    p_event: id,
    p_snapshot: snapshot,
    p_output: output,
  });
}
export async function runEvent(req) {
  try {
    await requireAdministrator(req);
    requireGameWrites();
    const body = await req.json().catch(() => ({}));
    const id = uuid(body.event_id);
    const db = databaseClient();
    const result = await executeRace(db, id);
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (e) {
    return authFailure(e);
  }
}
