"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getOrCreateTeam } from "../../lib/team";
import Loading from "../components/Loading";
import SmallButton from "../components/SmallButton";

function normalizeUsername(u) {
  return String(u || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

// Hidden internal email mapping
function usernameToEmail(username) {
  const u = normalizeUsername(username);
  return `${u}@tennedz.local`;
}

async function maybeExchangeCodeForSession() {
  // keep compatibility if old email OTP links still exist
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      const res = await getOrCreateTeam();
      setTeam(res.team || null);
      if (res.team?.id) await loadRiders(res.team.id);
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

  async function signUp(e) {
    e.preventDefault();
    const u = normalizeUsername(username);
    if (!u) return setStatus("Skriv et brugernavn.");
    if (!password || password.length < 6) return setStatus("Kodeord skal være mindst 6 tegn.");

    setBusy(true);
    setStatus("Opretter konto…");
    try {
      const email = usernameToEmail(u);

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username: u }
        }
      });

      if (error) throw error;

      setStatus("Konto oprettet ✅ Du kan nu logge ind.");
    } catch (e2) {
      setStatus("Fejl: " + (e2?.message ?? String(e2)));
    } finally {
      setBusy(false);
    }
  }

  async function signIn(e) {
    e.preventDefault();
    const u = normalizeUsername(username);
    if (!u) return setStatus("Skriv et brugernavn.");
    if (!password) return setStatus("Skriv et kodeord.");

    setBusy(true);
    setStatus("Logger ind…");
    try {
      const email = usernameToEmail(u);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      setStatus("Logget ind ✅");
    } catch (e2) {
      setStatus("Fejl: " + (e2?.message ?? String(e2)));
    } finally {
      setBusy(false);
    }
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
        <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Login</div>

          <form onSubmit={signIn} style={{ display: "grid", gap: 10, maxWidth: 360 }}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Brugernavn"
              autoCapitalize="none"
              autoCorrect="off"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Kodeord"
              type="password"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <SmallButton disabled={busy} type="submit">
                Log ind
              </SmallButton>

              <SmallButton disabled={busy} onClick={signUp}>
                Opret konto
              </SmallButton>
            </div>

            <div style={{ fontSize: 12, opacity: 0.75 }}>
              (MVP) Brugernavne normaliseres til små bogstaver uden mellemrum. Kodeord min. 6 tegn.
            </div>
          </form>
        </div>
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
