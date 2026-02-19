// lib/team.js
import { supabase } from "./supabaseClient";

export async function getOrCreateTeam() {
  // Must have a real authenticated user
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userRes?.user;
  if (!user?.id) {
    return { team: null };
  }

  // Try to fetch existing team(s) safely
  const { data: teams, error: selErr } = await supabase
    .from("teams")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (selErr) throw selErr;

  if (teams && teams.length > 0) {
    // If there are multiple due to earlier bugs, just use the first.
    return { team: teams[0] };
  }

  // Create team (only if none exist)
  const payload = {
    user_id: user.id,
    name: user.user_metadata?.username ? String(user.user_metadata.username) : "My Team",
    budget: 1000000
  };

  const { data: inserted, error: insErr } = await supabase
    .from("teams")
    .insert(payload)
    .select("*")
    .limit(1);

  if (insErr) throw insErr;

  return { team: inserted?.[0] ?? null };
}
