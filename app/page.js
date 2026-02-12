"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getOrCreateTeam } from "../lib/team";

export default function Home() {
  // auth + team
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("Loader…");
  const [team, setTeam] = useState(null);

  // riders
  const [riders, setRiders] = useState([]);
  const [busy, setBusy] = useState(false);

  // stages + race
  const [stages, setStages] = useState([]);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [raceBusy, setRaceBusy] = useState(false);
  const [raceError, setRaceError] = useState("");
  const [raceResult, setRaceResult] = useState(null); // { race_id, stage, top10[] with names }

  // ---------- data loaders ----------
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

  async function loadStages() {
    // stages har ikke RLS hos dig lige nu, så vi kan bare hente dem
    const { data, error } = await supabase
      .from("stages")
      .select("id,name,distance_km")
      .order("created_at", { ascending: false });

    if (error) {
      // stages er "nice to have" – vi viser bare fejl i race-sektionen
      setRaceError("Kunne ikke hente stages: " + error.message);
      return;
    }

    setStages(data ?? []);
    if (!selectedStageId && data?.length) {
      setSelectedStageId(data[0].id);
    }
  }

  async function refresh() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setStatus("Fejl: " + error.message);
      setTeam(null);
      setRiders([]);
      return;
    }

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
      } else {
        setRiders([]);
      }
    } catch (e) {
      setTeam(null);
      setRiders([]);
      setStatus("Fejl: " + (e?.message ?? String(e)));
    }
  }

  // ---------- effects ----------
  useEffect(() => {
    refresh();
    loadStages();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => sub?.subscription?.unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- auth actions ----------
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
    setRaceResult(null);
  }

  // ---------- rider actions ----------
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

  // ---------- race actions ----------
  const riderNameById = useMemo(() => {
    const m = new Map();
    for (const r of riders) m.set(r.id, r.name);
    return m;
  }, [riders]);

  async function runRace() {
    setRaceError("");
    setRaceResult(null);

    if (!selectedStageId) {
      setRaceError("Vælg en stage først.");
      return;
    }

    setRaceBusy(true);

    try {
      const res = await fetch("/api/run-race", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: selectedStageId }),
      });

      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (!res.ok) {
        const msg = json?.error ?? text ?? "Ukendt fejl";
        throw new Error(msg);
      }

      // json = { ok, race_id, stage, top10 }
      const top10 = json.top10 ?? [];

      // Hent rytter-navne for top10 (så vi kan vise dem pænt)
      const ids = top10.map((x) => x.rider_id).filter(Boolean);

      let riderMap = {};
      if (ids.length > 0) {
        const { data: rData, error: rErr } = await supabase
          .from("riders")
          .select("id,name")
          .in("id", ids);

        if (!rErr && rData?.length) {
          for (const rr of rData) riderMap[rr.id] = rr.name;
        }
      }

      const top10Pretty = top10.map((x) => ({
        ...x,
        rider_name: riderMap[x.rider_id] ?? riderNameById.get(x.rider_id) ?? x.rider_id,
      }));

      setRaceResult({
        race_id: json.race_id,
        stage: json.stage,
        top10: top10Pretty,
      });
    } catch (e) {
      setRaceError(e?.message ?? String(e));
    } finally {
      setRaceBusy(false);
    }
  }

  // ---------- UI ----------
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

      {team ? (
        <div style={{ marginTop: 18, padding: 12, border: "1px solid #ddd", borderRadius: 8, maxWidth: 1000 }}>
          <h2 style={{ marginTop: 0 }}>Dit hold</h2>
          <div><b>Navn:</b> {team.name}</div>
          <div><b>Budget:</b> {Number(team.budget).toLocaleString("da-DK")}</div>

          <div style={{ marginTop: 16 }}>
            <h3>Dine ryttere ({riders.length})</h3>

            {riders.length === 0 ? (
              <button disabled={busy} onClick={grantStarterPack} style={{ padding: "10px 12px" }}>
                {busy ? "Arbejder…" : "Giv mig 10 starter-ryttere"}
              </button>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
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
          </div>

          <hr style={{ margin: "18px 0" }} />

          <div>
            <h3>Test-løb</h3>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span>Stage:</span>
                <select
                  value={selectedStageId}
                  onChange={(e) => setSelectedStageId(e.target.value)}
                  style={{ padding: 8, minWidth: 260 }}
                >
                  {stages.length === 0 ? (
                    <option value="">(ingen stages fundet)</option>
                  ) : (
                    stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.distance_km} km)
                      </option>
                    ))
                  )}
                </select>
              </label>

              <button
                onClick={runRace}
                disabled={raceBusy || riders.length === 0 || !selectedStageId}
                style={{ padding: "10px 12px" }}
              >
                {raceBusy ? "Kører…" : "Kør test-løb"}
              </button>
            </div>

            {riders.length === 0 && (
              <p style={{ marginTop: 8, opacity: 0.8 }}>
                Du skal have ryttere før du kan køre et løb (tryk “starter-ryttere” ovenfor).
              </p>
            )}

            {raceError && (
              <p style={{ marginTop: 10, color: "crimson" }}>
                Fejl: {raceError}
              </p>
            )}

            {raceResult && (
              <div style={{ marginTop: 12 }}>
                <div style={{ opacity: 0.85 }}>
                  <b>Race:</b> {raceResult.race_id}
                  {" · "}
                  <b>Stage:</b> {raceResult.stage?.name ?? "?"}
                </div>

                <h4 style={{ marginBottom: 8 }}>Top 10</h4>
                <ol style={{ marginTop: 0 }}>
                  {raceResult.top10.map((x) => (
                    <li key={x.rider_id}>
                      {x.rider_name} — {Math.round(Number(x.time_sec))} sek
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div style={{ marginTop: 10, opacity: 0.7 }}>Build marker: UI-RACE-V1</div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
