"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getOrCreateTeam } from "../lib/team";

export default function Home() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("Loader…");
  const [team, setTeam] = useState(null);

  async function refresh() {
    const { data } = await supabase.auth.getSession();
    const loggedIn = !!data?.session;
    setStatus(loggedIn ? "Logget ind ✅" : "Ikke logget ind");

    if (loggedIn) {
      try {
        const res = await getOrCreateTeam();
        setTeam(res.team);
      } catch (e) {
        setTeam(null);
        setStatus("Fejl: " + (e?.message ?? String(e)));
      }
    } else {
      setTeam(null);
    }
  }

  useEffect(() => {
    refresh();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  async function signInWithEmail(e) {
    e.preventDefault();
    setStatus("Sender login-link…");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: "https://tennedz.eu" }
    });

    if (error) setStatus("Fejl: " + error.message);
    else setStatus("Tjek din email for login-link ✉️");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setTeam(null);
    setStatus("Ikke logget ind");
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Tennedz</h1>
      <p>Status: {status}</p>

      <form onSubmit={signInWithEmail} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="din@email.dk"
          style={{ padding: 8, width: 260 }}
        />
        <button type="submit" style={{ padding: "8px 12px" }}>Login</button>
        <button type="button" onClick={signOut} style={{ padding: "8px 12px" }}>Log ud</button>
      </form>

      {team && (
        <div style={{ marginTop: 18, padding: 12, border: "1px solid #ddd", borderRadius: 8, maxWidth: 520 }}>
          <h2 style={{ marginTop: 0 }}>Dit hold</h2>
          <div><b>Navn:</b> {team.name}</div>
          <div><b>Budget:</b> {team.budget.toLocaleString("da-DK")} </div>
          <div style={{ marginTop: 8, opacity: 0.7 }}>Build marker: TEAM-V1</div>
        </div>
      )}
    </main>
  );
}
