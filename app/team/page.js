"use client";

import { useEffect, useMemo, useState } from "react";
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
function usernameToEmail(username) {
  const u = normalizeUsername(username);
  return `${u}@tennedz.local`;
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function calcAge(birthDateStr, gameDateStr) {
  if (!birthDateStr) return null;
  const bd = new Date(birthDateStr);
  const gd = gameDateStr ? new Date(gameDateStr) : new Date();
  let age = gd.getFullYear() - bd.getFullYear();
  const m = gd.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && gd.getDate() < bd.getDate())) age--;
  return age;
}

export default function TeamHome() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState("Tjekker login…");
  const [busy, setBusy] = useState(false);

  const [session, setSession] = useState(null);
  const [team, setTeam] = useState(null);
  const [riders, setRiders] = useState([]);

  const [gameDate, setGameDate] = useState(null);

  // filters/sorting
  const [genderFilter, setGenderFilter] = useState("ALL"); // ALL | M | F
  const [sortKey, setSortKey] = useState("sprint");
  const [sortDir, setSortDir] = useState("desc");

  const sortOptions = [
    { key: "name", label: "Navn" },
    { key: "nationality", label: "Nationalitet" },
    { key: "gender", label: "Køn" },
    { key: "age", label: "Alder" },
    { key: "form", label: "Form" },
    { key: "fatigue", label: "Fatigue" },

    { key: "sprint", label: "Sprint" },
    { key: "flat", label: "Flat" },
    { key: "hills", label: "Hills" },
    { key: "mountain", label: "Mountain" },
    { key: "cobbles", label: "Cobbles" },
    { key: "timetrial", label: "Timetrial" },

    { key: "endurance", label: "Endurance" },
    { key: "strength", label: "Strength" },
    { key: "wind", label: "Wind" },

    { key: "leadership", label: "Leadership" },
    { key: "moral", label: "Moral" },
    { key: "luck", label: "Luck" }
  ];

  async function loadGameDate() {
    try {
      const res = await fetch("/api/game-date");
      const j = await res.json();
      if (j?.ok) setGameDate(j.game_date);
    } catch {
      setGameDate(null);
    }
  }

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
      await loadGameDate();

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
        options: { data: { username: u } }
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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
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

  async function grantStarterPack16() {
    if (!team?.id) return;

    // UI-lås: ingen starterpack hvis du allerede har 16+
    if (riders.length >= 16) {
      setStatus("Du har allerede en starter pack (16 ryttere).");
      return;
    }

    setBusy(true);
    setStatus("Tildeler starter-pack (16 ryttere: 8/8)…");
    try {
      const { error } = await supabase.rpc("grant_starter_pack", { p_count: 16 });
      if (error) throw error;
      await loadRiders(team.id);
      setStatus("Starter-pack tildelt ✅");
    } catch (e) {
      setStatus("Fejl: " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  const filteredSortedRiders = useMemo(() => {
    const list = Array.isArray(riders) ? [...riders] : [];
    const gd = gameDate;

    const filtered = list
      .map((r) => ({ ...r, age: calcAge(r.birth_date, gd) }))
      .filter((r) => {
        if (genderFilter === "ALL") return true;
        return String(r.gender || "").toUpperCase() === genderFilter;
      });

    const dir = sortDir === "asc" ? 1 : -1;

    filtered.sort((a, b) => {
      const ka = a?.[sortKey];
      const kb = b?.[sortKey];

      if (sortKey === "name" || sortKey === "nationality" || sortKey === "gender") {
        const sa = String(ka || "");
        const sb = String(kb || "");
        return sa.localeCompare(sb, "da") * dir;
      }

      const na = Number(ka ?? -999999);
      const nb = Number(kb ?? -999999);
      if (na === nb) return String(a?.name || "").localeCompare(String(b?.name || ""), "da");
      return (na - nb) * dir;
    });

    return filtered;
  }, [riders, genderFilter, sortKey, sortDir, gameDate]);

  const starterPackDisabled = busy || !team?.id || riders.length >= 16;

  return (
    <main>
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
              <div style={{ fontWeight: 900, fontSize: 18 }}>{team.name}</div>
              <div style={{ opacity: 0.8 }}>Budget: {Number(team.budget ?? 0).toLocaleString("da-DK")}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Ryttere: {riders.length} (starter pack = 16)</div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <SmallButton disabled={starterPackDisabled} onClick={grantStarterPack16}>
                {riders.length >= 16
                  ? "Starter pack allerede modtaget"
                  : busy
                    ? "Arbejder…"
                    : "Giv mig 16 starter-ryttere (8/8)"}
              </SmallButton>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <h3 style={{ marginBottom: 8 }}>Ryttere ({filteredSortedRiders.length}/{riders.length})</h3>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontWeight: 700 }}>Køn</span>
                <select
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value)}
                  style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
                >
                  <option value="ALL">Alle</option>
                  <option value="M">Mænd</option>
                  <option value="F">Kvinder</option>
                </select>
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontWeight: 700 }}>Sortér</span>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value)}
                  style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
                >
                  {sortOptions.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontWeight: 700 }}>Orden</span>
                <select
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value)}
                  style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
                >
                  <option value="desc">Høj → lav</option>
                  <option value="asc">Lav → høj</option>
                </select>
              </label>
            </div>

            {riders.length === 0 ? (
              <div style={{ opacity: 0.7 }}>Ingen ryttere endnu.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10 }}>
                {filteredSortedRiders.map((r) => {
                  const form = clamp(Number(r.form ?? 50), 0, 100);
                  const fatigue = clamp(Number(r.fatigue ?? 0), 0, 100);
                  const injured = r.injury_until && (!gameDate || new Date(r.injury_until) > new Date(gameDate));

                  return (
                    <div key={r.id} style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 10 }}>
                      <div style={{ fontWeight: 900 }}>
                        {r.name || "(no name)"}{" "}
                        <span style={{ fontWeight: 600, opacity: 0.7 }}>
                          {r.gender === "F" ? "♀" : "♂"} {r.nationality ? `(${r.nationality})` : ""}
                        </span>
                      </div>

                      <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6, lineHeight: 1.35 }}>
                        <b>Alder</b> {r.age ?? "?"} · <b>Form</b> {form} · <b>Fatigue</b> {fatigue} ·{" "}
                        <b>Status</b> {injured ? `Skadet (til ${r.injury_until})` : "Klar"}
                        <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "10px 0" }} />
                        <b>Sprint</b> {r.sprint} · <b>Flat</b> {r.flat} · <b>Hills</b> {r.hills} · <b>Mountain</b>{" "}
                        {r.mountain}
                        <br />
                        <b>Cobbles</b> {r.cobbles} · <b>TT</b> {r.timetrial} · <b>Wind</b> {r.wind}
                        <br />
                        <b>Endurance</b> {r.endurance} · <b>Strength</b> {r.strength}
                        <br />
                        <b>Leadership</b> {r.leadership} · <b>Moral</b> {r.moral} · <b>Luck</b> {r.luck}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
