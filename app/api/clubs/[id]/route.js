import { NextResponse } from "next/server";
import { protectedRoute } from "../../../../lib/auth/server";
import { AuthError } from "../../../../lib/auth/policy.mjs";
import { validateTeamKit } from "../../../../lib/riders/club-kit.mjs";

const pressFields = "id,title,body,published_at";
const riderFields = "id,name,display_name,gender,nationality,appearance,portrait_path";
const clubError = () => new AuthError("CLUB_UNAVAILABLE", "Could not load the club. Please try again.", 503);

async function clubId(context) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
    throw new AuthError("CLUB_NOT_FOUND", "Club not found.", 404);
  }
  return id.toLowerCase();
}

async function ownedClub(context, team) {
  const id = await clubId(context);
  if (team.id !== id) throw new AuthError("CLUB_FORBIDDEN", "Only your own club can publish press releases.", 403);
  return id;
}

export const GET = protectedRoute(async (_req, context, { team, db }) => {
  const id = await clubId(context);
  const club = await db.from("teams").select("id,name").eq("id", id).maybeSingle();
  if (club.error) throw clubError();
  if (!club.data) throw new AuthError("CLUB_NOT_FOUND", "Club not found.", 404);
  const [identity, roster, results, press] = await Promise.all([
    db.from("club_identities").select("palette,pattern").eq("team_id", id).maybeSingle(),
    db.from("team_riders").select(`rider:riders(${riderFields})`).eq("team_id", id),
    db.from("event_team_results")
      .select("event_id,division_index,events!inner(name,gender)")
      .eq("team_id", id).eq("position", 1).eq("events.status", "FINISHED")
      .order("created_at", { ascending: false }).order("event_id").limit(30),
    db.from("club_press_releases").select(pressFields).eq("team_id", id)
      .order("published_at", { ascending: false }).order("id").limit(20),
  ]);
  if (identity.error || roster.error || results.error || (press.error && press.error.code !== "PGRST205")) throw clubError();
  const riders = [...new Map(roster.data.filter(row => row.rider).map(({ rider }) => [rider.id, rider])).values()]
    .sort((a, b) => (a.display_name || a.name || "").localeCompare(b.display_name || b.name || "", "en"));
  const trophies = results.data.map(row => ({
    eventId: row.event_id,
    division: row.division_index,
    name: row.events.name,
    gender: row.events.gender,
  }));
  return NextResponse.json({
    ok: true, club: club.data, kit: validateTeamKit(identity.data, id), riders, trophies,
    press: press.data || [], pressAvailable: !press.error, isOwner: team.id === id,
  });
});

export const POST = protectedRoute(async (req, context, { team, db }) => {
  const id = await ownedClub(context, team);
  const input = await req.json().catch(() => null);
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const body = typeof input?.body === "string" ? input.body.trim() : "";
  if (!title || title.length > 100 || !body || body.length > 2000) {
    throw new AuthError("INVALID_PRESS_RELEASE", "Enter a title of up to 100 characters and a release of up to 2,000 characters.", 400);
  }
  const result = await db.from("club_press_releases").insert({ team_id: id, title, body }).select(pressFields).single();
  if (result.error) throw new AuthError("PRESS_UNAVAILABLE", "Could not publish the press release.", 503);
  return NextResponse.json({ ok: true, release: result.data }, { status: 201 });
});

export const DELETE = protectedRoute(async (req, context, { team, db }) => {
  const id = await ownedClub(context, team);
  const releaseId = new URL(req.url).searchParams.get("release");
  if (!releaseId || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(releaseId)) {
    throw new AuthError("INVALID_PRESS_RELEASE", "Invalid press release.", 400);
  }
  const result = await db.from("club_press_releases").delete().eq("team_id", id).eq("id", releaseId);
  if (result.error) throw new AuthError("PRESS_UNAVAILABLE", "Could not remove the press release.", 503);
  return NextResponse.json({ ok: true });
});
