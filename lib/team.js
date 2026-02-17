import { supabase } from "./supabaseClient";

/**
 * getOrCreateTeam()
 * - Når en bruger kan have flere teams (fx bot teams), må vi ikke bruge .single().
 * - Vi vælger "det menneskelige team" som et team der IKKE starter med "Bot Team ".
 * - Hvis ingen findes: opret et nyt.
 */
export async function getOrCreateTeam() {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;

  const user = authData?.user;
  if (!user?.id) throw new Error("Not logged in");

  // Hent alle teams for denne bruger (ikke single!)
  const { data: teams, error: tErr } = await supabase
    .from("teams")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (tErr) throw tErr;

  // Vælg "dit rigtige team": ikke bot-navn
  const humanTeams = (teams ?? []).filter((t) => !(t?.name || "").startsWith("Bot Team "));
  if (humanTeams.length > 0) {
    // vælg det ældste (først oprettede)
    return { team: humanTeams[0], created: false };
  }

  // Hvis du har teams men alle er bots, så opret et nyt menneske-team
  const defaultName = "My Team";

  const { data: created, error: cErr } = await supabase
    .from("teams")
    .insert({ user_id: user.id, name: defaultName, budget: 1000000 })
    .select("*")
    .single();

  if (cErr) throw cErr;

  return { team: created, created: true };
}
