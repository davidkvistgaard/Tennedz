"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getOrCreateTeam } from "../../lib/team";
import Loading from "../components/Loading";
import SmallButton from "../components/SmallButton";

async function withTimeout(promise, ms, label = "timeout") {
  let t;
  const timeout = new Promise((_, rej) => (t = setTimeout(() => rej(new Error(label)), ms)));
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(t);
  }
}

async function maybeExchangeCodeForSession() {
  if (typeof window === "undefined") return { didExchange: false };
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (!code) return { didExchange: false };

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return { didExchange: true, error };

  url.searchParams.delete("code");
  window.history.replaceState({}, document.title, url.toString());
  return { didExchange: true, error: null };
}

export default function TeamHome() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("Tjekker login…");
  const [session, setSession] = useState(null);

  const [team, setTeam] = useState(null);
  const [riders, setRiders] = useState([]);
  const [busy, setBusy] = useState(false);

  async function loadRiders(teamId) {
    const { data, error } = await supabase
      .from("team_riders")
      .select("rider:riders(*)")
      .eq("team_id", teamId);
    if (error) throw error;
    setRiders((data ?? []).map((x) => x.rider).filter(Boolean));
  }

  async function refresh() {
    setStatus("Tjekker login…");
    const ex = await maybeExchangeCodeForSession();
    if (ex?.error) {
      setStatus("Login-fejl: " + ex.error.message);
      setSession(null);
      return;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setStatus("Fejl: " + error.message);
      setSession(null);
      return;
    }

    const s = data?.session || null;
    setSession(s);
    setStatus(s ? "Logget ind ✅" : "Ikke logget ind");

    if (!s) {
      setTeam(null);
      setRiders([]);
      return;
    }

    try {
      const res = await withTimeout(getOrCreateTeam(), 10000, "getOrCreateTeam timeout");
      setTeam(res.team || null);
      if (res.team?.id) await withTimeout(loadRiders(res.team.id), 10000, "loadRiders timeout");
    } catch (e) {
      setStatus("Fejl ved init: " + (e?.message ?? String(e)));
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
      options: { emailRedirectTo: "https://tennedz.eu/team" }
    });
    if (error) setStatus("Fejl: " + error.message);
    else setStatus("Tjek din email for login-link ✉️");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setTeam(null);
    setRiders([]);
    setStatus("Ikke logget ind");
  }

  async function grantStarterPack() {
    if (!team?.id) return;
    setBusy(true);
    setStatus("Tildeler starter-ryttere…");
    try {
      const { error } = await supabase.rpc("grant_starter_pack", { p_count: 10 });
      if (error) throw error;
      await loadRiders(team.id);
      setStatus("Starter-pack tildelt ✅");
    } catch (e) {
      setStatus("Fejl: " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h2 style={{ marginTop: 0 }}>Mit hold</h2>
      <p>Status: {status}</p>

      {!session ? (
        <form onSubmit={signInWithEmail} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="din@email.dk"
            style={{ padding: 10, width: 280, borderRadius: 10, border: "1px solid #ddd" }}
          />
          <SmallButton type="submit">Login</SmallButton>
        </form>
      ) : (
        <div style={{ marginTop: 12 }}>
          <SmallButton onClick={signOut}>Log ud</SmallButton>
        </div>
      )}

      {!session ? null : !team ? (
        <div style={{ marginTop: 14 }}>
          <Loading text="Loader dit hold…" />
        </div>
      ) : (
        <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800 }}>{team.name}</div>
              <div style={{ opacity: 0.8 }}>Budget: {Number(team.budget ?? 0).toLocaleString("da-DK")}</div>
            </div>
            {riders.length === 0 ? (
              <SmallButton disabled={busy} onClick={grantStarterPack}>
                {busy ? "Arbejder…" : "Giv mig 10 starter-ryttere"}
              </SmallButton>
            ) : null}
          </div>

          <div style={{ marginTop: 12 }}>
            <h3 style={{ marginBottom: 8 }}>Ryttere ({riders.length})</h3>
            {riders.length === 0 ? (
              <div style={{ opacity: 0.7 }}>Ingen ryttere endnu.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
                {riders.map((r) => (
                  <div key={r.id} style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 10 }}>
                    <div style={{ fontWeight: 800 }}>
                      {r.name}{" "}
                      {r.nationality ? <span style={{ fontWeight: 400, opacity: 0.7 }}>({r.nationality})</span> : null}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
                      Sprint {r.sprint} · Flat {r.flat} · Hills {r.hills} · Mountain {r.mountain}
                      <br />
                      Endurance {r.endurance} · Strength {r.strength} · Wind {r.wind} · TT {r.timetrial}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
