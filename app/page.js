"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getOrCreateTeam } from "../lib/team";

function formatHMS(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatGap(gapSeconds) {
  const s = Math.max(0, Math.round(Number(gapSeconds) || 0));
  if (s === 0) return "s.t.";
  return `+${formatHMS(s)}`;
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("Loader…");
  const [team, setTeam] = useState(null);

  const [riders, setRiders] = useState([]);
  const [busy, setBusy] = useState(false);

  const [stages, setStages] = useState([]);
  const [selectedStageId, setSelectedStageId] = useState("");

  // Stage+points result
  const [stageBusy, setStageBusy] = useState(false);
  const [stageError, setStageError] = useState("");
  const [stageResult, setStageResult] = useState(null);

  // Viewer
  const [viewerStageId, setViewerStageId] = useState("");
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState("");
  const [feed, setFeed] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [play, setPlay] = useState(false);
  const [cursor, setCursor] = useState(0); // index into snapshots

  const timerRef = useRef(null);

  async function loadRiders(teamId) {
    const { data, error } = await supabase
      .from("team_riders")
      .select("rider:riders(*)")
      .eq("team_id", teamId);

    if (error) throw error;
    const list = (data ?? []).map((x) => x.rider).filter(Boolean);
    setRiders(list);
  }

  async function loadStages() {
    const { data, error } = await supabase
      .from("stages")
      .select("id,name,distance_km")
      .order("created_at", { ascending: false });

    if (error) {
      setStageError("Kunne ikke hente stages: " + error.message);
      return;
    }

    setStages(data ?? []);
    if (!selectedStageId && data?.length) setSelectedStageId(data[0].id);
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
      if (res.team?.id) await loadRiders(res.team.id);
      else setRiders([]);
    } catch (e) {
      setTeam(null);
      setRiders([]);
      setStatus("Fejl: " + (e?.message ?? String(e)));
    }
  }

  useEffect(() => {
    refresh();
    loadStages();
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh());
    return () => sub?.subscription?.unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setRiders([]);
    setStatus("Ikke logget ind");
    setStageResult(null);

    setFeed([]);
    setSnapshots([]);
    setViewerStageId("");
    setCursor(0);
    setPlay(false);
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

  const riderNameById = useMemo(() => {
    const m = new Map();
    for (const r of riders) m.set(r.id, r.name);
    return m;
  }, [riders]);

  async function enrichNamesForTop(list) {
    const ids = (list ?? []).map((x) => x.rider_id).filter(Boolean);
    let riderMap = {};
    if (ids.length > 0) {
      const { data: rData, error: rErr } = await supabase.from("riders").select("id,name").in("id", ids);
      if (!rErr && rData?.length) for (const rr of rData) riderMap[rr.id] = rr.name;
    }
    return (list ?? []).map((x) => ({
      ...x,
      rider_name: riderMap[x.rider_id] ?? riderNameById.get(x.rider_id) ?? x.rider_id
    }));
  }

  async function runStageWithPoints() {
    setStageError("");
    setStageResult(null);

    if (!selectedStageId) {
      setStageError("Vælg en stage først.");
      return;
    }

    setStageBusy(true);

    try {
      const res = await fetch("/api/run-stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_template_id: selectedStageId, event_kind: "one_day" })
      });

      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { json = null; }

      if (!res.ok) throw new Error(json?.error ?? text ?? "Ukendt fejl");

      const top10Pretty = await enrichNamesForTop(json.top10 ?? []);

      setStageResult({
        event: json.event,
        event_stage: json.event_stage,
        stage_template: json.stage_template,
        top10: top10Pretty,
        leaderboards: json.leaderboards
      });

      // auto set viewer id to last run stage
      setViewerStageId(json.event_stage?.id || "");
      setFeed([]);
      setSnapshots([]);
      setCursor(0);
      setPlay(false);
      setViewerError("");
    } catch (e) {
      setStageError(e?.message ?? String(e));
    } finally {
      setStageBusy(false);
    }
  }

  async function loadViewer() {
    setViewerError("");
    setViewerLoading(true);
    setFeed([]);
    setSnapshots([]);
    setCursor(0);
    setPlay(false);

    try {
      if (!viewerStageId) throw new Error("Ingen event_stage_id valgt endnu.");

      const res = await fetch("/api/view-stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_stage_id: viewerStageId })
      });

      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!res.ok) throw new Error(json?.error ?? text ?? "Ukendt fejl");

      setFeed(json.feed ?? []);
      setSnapshots(json.snapshots ?? []);
      setCursor(0);
    } catch (e) {
      setViewerError(e?.message ?? String(e));
    } finally {
      setViewerLoading(false);
    }
  }

  // play/pause ticker
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!play) return;

    timerRef.current = setInterval(() => {
      setCursor((c) => {
        const max = Math.max(0, snapshots.length - 1);
        if (c >= max) return c;
        return c + 1;
      });
    }, 650); // “fake live” hastighed

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [play, snapshots.length]);

  useEffect(() => {
    // stop autoplay at end
    if (snapshots.length && cursor >= snapshots.length - 1) setPlay(false);
  }, [cursor, snapshots.length]);

  const currentSnap = snapshots[cursor]?.state || null;
  const currentKm = currentSnap?.km ?? 0;

  const visibleFeed = useMemo(() => {
    // show feed events up to currentKm
    return (feed ?? []).filter((e) => Number(e.km) <= Number(currentKm));
  }, [feed, currentKm]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Tennedz</h1>
      <p>Status: {status}</p>

      <form onSubmit={signInWithEmail} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="din@email.dk" style={{ padding: 8, width: 260 }} />
        <button type="submit" style={{ padding: "8px 12px" }}>Login</button>
        <button type="button" onClick={signOut} style={{ padding: "8px 12px" }}>Log ud</button>
      </form>

      {team ? (
        <div style={{ marginTop: 18, padding: 12, border: "1px solid #ddd", borderRadius: 8, maxWidth: 1150 }}>
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
                    <div style={{ fontWeight: 700 }}>
                      {r.name}{" "}
                      {r.nationality ? <span style={{ fontWeight: 400, opacity: 0.7 }}>({r.nationality})</span> : null}
                    </div>
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
            <h3>Stage + points (V1)</h3>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span>Stage:</span>
                <select value={selectedStageId} onChange={(e) => setSelectedStageId(e.target.value)} style={{ padding: 8, minWidth: 260 }}>
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

              <button type="button" onClick={runStageWithPoints} disabled={stageBusy || riders.length === 0 || !selectedStageId} style={{ padding: "10px 12px" }}>
                {stageBusy ? "Kører…" : "Kør stage + points"}
              </button>
            </div>

            {stageError && <p style={{ marginTop: 10, color: "crimson" }}>Fejl: {stageError}</p>}

            {stageResult && (
              <div style={{ marginTop: 12 }}>
                <div style={{ opacity: 0.85 }}>
                  <b>Event:</b> {stageResult.event?.name} · <b>Stage:</b> {stageResult.stage_template?.name}
                  {stageResult.stage_template?.is_mountain ? " · KOM aktiv" : ""}
                </div>

                <h4 style={{ marginBottom: 8 }}>Top 10</h4>
                {(() => {
                  const top = stageResult.top10 ?? [];
                  const leaderTime = top.length ? Number(top[0].time_sec) : null;

                  return (
                    <ol style={{ marginTop: 0 }}>
                      {top.map((x, idx) => {
                        const t = Number(x.time_sec);
                        const gap = leaderTime == null ? null : t - leaderTime;
                        const timeLabel = idx === 0 ? formatHMS(t) : formatGap(gap);
                        return (
                          <li key={x.rider_id}>
                            {x.rider_name} — {timeLabel}
                          </li>
                        );
                      })}
                    </ol>
                  );
                })()}

                <h4 style={{ marginBottom: 8 }}>Team leaderboard (points)</h4>
                {stageResult.leaderboards?.team_points?.length ? (
                  <ol style={{ marginTop: 0 }}>
                    {stageResult.leaderboards.team_points.map((x) => (
                      <li key={x.team_id}>
                        Team {x.team_id.slice(0, 8)}… — {x.points} pts
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div style={{ opacity: 0.8 }}>Ingen point tildelt endnu.</div>
                )}

                <h4 style={{ marginBottom: 8 }}>Team leaderboard (KOM)</h4>
                {stageResult.leaderboards?.team_kom?.length ? (
                  <ol style={{ marginTop: 0 }}>
                    {stageResult.leaderboards.team_kom.map((x) => (
                      <li key={x.team_id}>
                        Team {x.team_id.slice(0, 8)}… — {x.points} pts
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div style={{ opacity: 0.8 }}>Ingen KOM point (eller ikke en bjergetape).</div>
                )}
              </div>
            )}
          </div>

          <hr style={{ margin: "18px 0" }} />

          <div>
            <h3>Viewer (match report)</h3>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span>event_stage_id:</span>
                <input
                  value={viewerStageId}
                  onChange={(e) => setViewerStageId(e.target.value)}
                  placeholder="(auto-udfyldes efter run)"
                  style={{ padding: 8, width: 420 }}
                />
              </label>

              <button type="button" onClick={loadViewer} disabled={viewerLoading || !viewerStageId} style={{ padding: "10px 12px" }}>
                {viewerLoading ? "Loader…" : "Load viewer data"}
              </button>

              <button type="button" onClick={() => setPlay((p) => !p)} disabled={!snapshots.length} style={{ padding: "10px 12px" }}>
                {play ? "Pause" : "Play"}
              </button>
            </div>

            {viewerError && <p style={{ marginTop: 10, color: "crimson" }}>Fejl: {viewerError}</p>}

            {snapshots.length > 0 && (
              <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <b>KM:</b> {currentKm}
                    {"  "}
                    <span style={{ opacity: 0.7 }}>
                      (snapshot {cursor + 1}/{snapshots.length})
                    </span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, snapshots.length - 1)}
                    value={cursor}
                    onChange={(e) => setCursor(Number(e.target.value))}
                    style={{ width: 380 }}
                  />
                </div>

                <div style={{ marginTop: 10 }}>
                  <b>Grupper</b>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginTop: 8 }}>
                    {(currentSnap?.groups ?? []).map((g) => (
                      <div key={g.id} style={{ border: "1px solid #f0f0f0", borderRadius: 10, padding: 10 }}>
                        <div style={{ fontWeight: 700 }}>{g.type}</div>
                        <div style={{ opacity: 0.85 }}>Ryttere: {g.riders}</div>
                        <div style={{ opacity: 0.85 }}>Gap: {formatGap(g.gap_sec)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <b>Live feed</b>
                  <div style={{ marginTop: 8, maxHeight: 260, overflow: "auto", border: "1px solid #f3f3f3", borderRadius: 10, padding: 10 }}>
                    {visibleFeed.length === 0 ? (
                      <div style={{ opacity: 0.7 }}>Ingen events endnu (prøv play).</div>
                    ) : (
                      visibleFeed.map((e, idx) => (
                        <div key={`${e.km}-${idx}`} style={{ padding: "6px 0", borderBottom: "1px solid #f2f2f2" }}>
                          <div style={{ fontSize: 13, opacity: 0.65 }}>{e.type} · {e.km} km</div>
                          <div>{e.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 10, opacity: 0.7 }}>Build marker: VIEWER-V1</div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
