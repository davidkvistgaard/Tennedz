"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getOrCreateTeam } from "../lib/team";

export default function Home() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("Loader…");
  const [team, setTeam] = useState(null);
  const [riders, setRiders] = useState([]);
  const [busy, setBusy] = useState(false);

  async function loadRiders(teamId) {
    const { data, error } = await supabase
      .from("team_riders")
      .select("rider:riders(*)")
      .eq("team_id", teamId);

    if (error) throw error;

    const list = (data ?? [])
      .map((x) => x.rider)
      .filter(Boolean);

    setRiders(list);
  }

  async function refresh() {
    const { data } = await supabase.auth.getSession();
    const loggedIn = !!data?.session;
    setStatus(loggedIn ? "Logget ind ✅" : "Ikke logget ind");

    if (!loggedIn) {
      setTeam(null);
      setRiders([]);
      return;
    }

    try {
      const res = await getOrCreateTeam();
      setTeam(res.team);

      if (res.team?.id) {
        await loadRiders(res.team.id);
      }
    } catch (e) {
      setTeam(null);
      setRiders([]);
      setStatus("Fejl: " + (e?.message ?? String(e)));
    }
  }

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh());
    return () => sub?.subscription?.unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signInWithEmail(e) {
    e.preventDefault();
    setStatus("Sender login-link…");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: "https://tennedz.eu" },
    });

    if (error) setStatus("Fejl: " + error.message);
    else setStatus("Tjek din email for login-link ✉️");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setTeam(null);
    setRiders([]);
    setStatus("Ikke logget ind");
  }

  async function grantStarterPack() {
    if (!team?.id) return;
    setBusy(true);
    setStatus("Tildeler starter-ryttere…");

    const { error } = await supabase.rpc("grant_starter_pack", { p_count: 10 });

    if (error) {
      setBusy(false);
      setStatus("Fejl: " + error.message);
      return;
    }

    await loadRiders(team.id);
    setBusy(false);
    setStatus("Starter-pack tildelt ✅");
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
        <button type="submit" style={{ padding: "8px 12px" }}>
          Login
        </button>
        <button type="button" onClick={signOut} style={{ padding: "8px 12px" }}>
          Log ud
        </button>
      </form>

      {team ? (
        <div
          style={{
            marginTop: 18,
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 8,
            maxWidth: 900,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Dit hold</h2>
          <div>
            <b>Navn:</b> {team.name}
          </div>
          <div>
            <b>Budget:</b> {Number(team.budget).toLocaleString("da-DK")}
          </div>

          <div style={{ marginTop: 16 }}>
            <h3>Dine ryttere ({riders.length})</h3>

            {riders.length === 0 ? (
              <button disabled={busy} onClick={grantStarterPack} style={{ padding: "10px 12px" }}>
                {busy ? "Arbejder…" : "Giv mig 10 starter-ryttere"}
              </button>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 12,
                }}
              >
                {riders.map((r) => (
                  <div key={r.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontWeight: 700 }}>{r.name}</div>
                    <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
                      Sprint: {r.sprint} · Flat: {r.flat} · Hills: {r.hills} · Mountain: {r.mountain}
                      <br />
                      TT: {r.timetrial} · Endurance: {r.endurance} · Wind: {r.wind}
                      <br />
                      Moral: {r.moral} · Form: {r.form} · Luck: {r.luck} · Leadership: {r.leadership}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 10, opacity: 0.7 }}>Build marker: RIDERS-V1</div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
