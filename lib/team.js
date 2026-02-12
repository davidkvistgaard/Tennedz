import { supabase } from "./supabaseClient";

export async function getOrCreateTeam() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const user = sessionData?.session?.user;
  if (!user) return { team: null, created: false };

  // 1) Try to load existing team
  const { data: team, error: loadError } = await supabase
    .from("teams")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadError) throw loadError;
  if (team) return { team, created: false };

  // 2) Create a new team
  const defaultName = "Mit hold";

  const { data: createdTeam, error: createError } = await supabase
    .from("teams")
    .insert({ user_id: user.id, name: defaultName })
    .select("*")
    .single();

  if (createError) throw createError;

  return { team: createdTeam, created: true };
}
