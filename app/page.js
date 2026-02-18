// BUILD: MOTOR-V1.3-BATCH
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

function defaultOrders(teamId) {
  return {
    name: "My tactic",
    team_plan: { risk: "medium", style: "balanced", focus: "balanced", energy_policy: "normal" },
    roles: { captain: null, sprinter: null, rouleur: null },
    riders: {}, // rider_id -> { mode, effort }
    triggers: { protect_captain: true, sprint_chase: true }
  };
}

async function withTimeout(promise, ms, label = "timeout") {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(label)), ms);
  });
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

export default function Home() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("Tjekker login…");
  const [team, setTeam] = useState(null);

  const [riders, setRiders] = useState([]);
  const [busy, setBusy] = useState(false);

  const [stages, setStages] = useState([]);
  const [selectedStageId, setSelectedStageId] = useState("");

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
  const [cursor, setCursor] = useState(0);
  const timerRef = useRef(null);

  // Tactics + presets
  const [orders, setOrders] = useState(defaultOrders(null));
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetStatus, setPresetStatus] = useState("");

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

  async function loadPresets() {
    setPresetStatus("");
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData?.user?.id;
    if (!uid) return;

    const { data, error } = await supabase
      .from("tactic_presets")
      .select("id,name,payload,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      setPresetStatus("Kunne ikke hente presets: " + error.message);
      return;
    }
    setPresets(data ?? []);
  }

  function ensureRiderOrdersScaffold(teamId, ridersList) {
    setOrders((o) => {
      const base = { ...defaultOrders(teamId), ...o };
      const ro = { ...(base.riders || {}) };

      for (const r of ridersList || []) {
        if (!ro[r.id]) ro[r.id] = { mode: "normal", effort: 0.6 };
        if (!ro[r.id].mode) ro[r.id].mode = "normal";
        if (ro[r.id].effort == null) ro[r.id].effort = 0.6;
      }

      base.riders = ro;
      base.triggers = base.triggers || { protect_captain: true, sprint_chase: true };
      return base;
    });
  }

  async function refresh() {
    setStatus("Tjekker login…");

    const ex = await maybeExchangeCodeForSession();
    if (ex?.error) {
      setStatus("Login-fejl: " + ex.error.message);
      setTeam(null);
      setRiders([]);
      return;
    }

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
      setPresets([]);
      setSelectedPresetId("");
      return;
    }

    try {
      const res = await withTimeout(getOrCreateTeam(), 10000, "getOrCreateTeam timeout");
      setTeam(res.team);

      if (res.team?.id) {
        await withTimeout(loadRiders(res.team.id), 10000, "loadRiders timeout");
      } else {
        setRiders([]);
      }

      await withTimeout(loadPresets(), 10000, "loadPresets timeout");
      setStatus("Logget ind ✅");
    } catch (e) {
      setStatus("Fejl ved init: " + (e?.message ?? String(e)));
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!alive) return;
      await refresh();
      await loadStages();
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When riders load, scaffold rider orders
  useEffect(() => {
    if (!team?.id) return;
    if (!riders?.length) return;
    ensureRiderOrdersScaffold(team.id, riders);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id, riders.length]);

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
    setPresets([]);
    setSelectedPresetId("");
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

  // Preset actions
  async function savePreset() {
    setPresetStatus("");
    const name = prompt("Navn på preset?");
    if (!name) return;

    const { data: authData } = await supabase.auth.getUser();
    const uid = authData?.user?.id;
    if (!uid) {
      setPresetStatus("Du er ikke logget ind.");
      return;
    }

    const payload = { ...orders, name };

    const { error } = await supabase.from("tactic_presets").insert({ user_id: uid, name, payload });

    if (error) {
      setPresetStatus("Kunne ikke gemme preset: " + error.message);
      return;
    }

    setPresetStatus("Preset gemt ✅");
    await loadPresets();
  }

  function applyPreset(presetId) {
    const p = presets.find((x) => x.id === presetId);
    if (!p) return;
    setOrders(p.payload);
    setPresetStatus(`Preset loaded: ${p.name}`);
  }

  // Run stage with orders
  async function runStageWithPoints() {
    setStageError("");
    setStageResult(null);

    if (!selectedStageId) {
      setStageError("Vælg en stage først.");
      return;
    }
    if (!team?.id) {
      setStageError("Ingen team fundet.");
      return;
    }

    setStageBusy(true);

    try {
      const res = await fetch("/api/run-stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage_template_id: selectedStageId,
          event_kind: "one_day",
          team_id: team.id,
          orders
        })
      });

      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (!res.ok) throw new Error(json?.error ?? text ?? "Ukendt fejl");

      const top10Pretty = await enrichNamesForTop(json.top10 ?? []);

      setStageResult({
        event: json.event,
        event_stage: json.event_stage,
        stage_template: json.stage_template,
        top10: top10Pretty
      });

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

  // Viewer load
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
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

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

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!play) return;

    timerRef.current = setInterval(() => {
      setCursor((c) => {
        const max = Math.max(0, snapshots.length - 1);
        if (c >= max) return c;
        return c + 1;
      });
    }, 650);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [play, snapshots.length]);

  useEffect(() => {
    if (snapshots.length && cursor >= snapshots.length - 1) setPlay(false);
  }, [cursor, snapshots.length]);

  const currentSnap = snapshots[cursor]?.state || null;
  const currentKm = currentSnap?.km ?? 0;

  const visibleFeed = useMemo(() => {
    return (feed ?? []).filter((e) => Number(e.km) <= Number(currentKm));
  }, [feed, currentKm]);

  const riderOptions = useMemo(() => {
    return riders.map((r) => ({ id: r.id, label: `${r.name}${r.nationality ? " (" + r.nationality + ")" : ""}` }));
  }, [riders]);

  function setPlanField(key, value) {
    setOrders((o) => ({
      ...o,
      team_plan: { ...(o.team_plan || {}), [key]: value }
    }));
  }

  function setRole(role, riderId) {
    setOrders((o) => ({
      ...o,
      roles: { ...(o.roles || {}), [role]: riderId || null }
    }));
  }

  function setTrigger(key, value) {
    setOrders((o) => ({
      ...o,
      triggers: { ...(o.triggers || {}), [key]: !!value }
    }));
  }

  function setRiderMode(riderId, mode) {
    setOrders((o) => ({
      ...o,
      riders: {
        ...(o.riders || {}),
        [riderId]: { ...(o.riders?.[riderId] || {}), mode }
      }
    }));
  }

  function setRiderEffort(riderId, effort) {
    const n = Number(effort);
    setOrders((o) => ({
      ...o,
      riders: {
        ...(o.riders || {}),
        [riderId]: { ...(o.riders?.[riderId] || {}), effort: n }
      }
    }));
  }

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
        <div style={{ marginTop: 18, padding: 12, border: "1px solid #ddd", borderRadius: 8, maxWidth: 1200 }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 12 }}>
                {riders.map((r) => (
                  <div key={r.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontWeight: 700 }}>
                      {r.name}{" "}
                      {r.nationality ? <span style={{ fontWeight: 400, opacity: 0.7 }}>({r.nationality})</span> : null}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.88, marginTop: 6 }}>
                      Sprint: {r.sprint} · Flat: {r.flat} · Hills: {r.hills} · Mountain: {r.mountain}
                      <br />
                      TT: {r.timetrial} · Endurance: {r.endurance} · <b>Strength:</b> {r.strength ?? 0} · Wind: {r.wind}
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
            <h3>Taktik (V1.3) + Presets</h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Team plan</div>

                <label style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <span>Focus</span>
                  <select value={orders.team_plan?.focus || "balanced"} onChange={(e) => setPlanField("focus", e.target.value)} style={{ padding: 8 }}>
                    <option value="balanced">balanced</option>
                    <option value="sprint">sprint</option>
                    <option value="break">break</option>
                    <option value="gc_safe">gc_safe</option>
                    <option value="chaos">chaos</option>
                  </select>
                </label>

                <label style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <span>Style</span>
                  <select value={orders.team_plan?.style || "balanced"} onChange={(e) => setPlanField("style", e.target.value)} style={{ padding: 8 }}>
                    <option value="defensive">defensive</option>
                    <option value="balanced">balanced</option>
                    <option value="aggressive">aggressive</option>
                  </select>
                </label>

                <label style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <span>Risk</span>
                  <select value={orders.team_plan?.risk || "medium"} onChange={(e) => setPlanField("risk", e.target.value)} style={{ padding: 8 }}>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </label>

                <label style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>Energy</span>
                  <select value={orders.team_plan?.energy_policy || "normal"} onChange={(e) => setPlanField("energy_policy", e.target.value)} style={{ padding: 8 }}>
                    <option value="conserve">conserve</option>
                    <option value="normal">normal</option>
                    <option value="burn">burn</option>
                  </select>
                </label>

                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #f0f0f0" }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Triggers (auto)</div>

                  <label style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                    <span>Protect captain if dropped</span>
                    <input
                      type="checkbox"
                      checked={!!orders.triggers?.protect_captain}
                      onChange={(e) => setTrigger("protect_captain", e.target.checked)}
                    />
                  </label>

                  <label style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span>Sprint chase if break exists</span>
                    <input
                      type="checkbox"
                      checked={!!orders.triggers?.sprint_chase}
                      onChange={(e) => setTrigger("sprint_chase", e.target.checked)}
                    />
                  </label>

                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
                    (MVP: 2 triggers. Vi kan udvide til et rigtigt rule-system senere.)
                  </div>
                </div>
              </div>

              <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Roles</div>

                <label style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <span>Captain</span>
                  <select value={orders.roles?.captain || ""} onChange={(e) => setRole("captain", e.target.value)} style={{ padding: 8, width: 180 }}>
                    <option value="">(none)</option>
                    {riderOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>

                <label style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <span>Sprinter</span>
                  <select value={orders.roles?.sprinter || ""} onChange={(e) => setRole("sprinter", e.target.value)} style={{ padding: 8, width: 180 }}>
                    <option value="">(none)</option>
                    {riderOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>

                <label style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>Rouleur</span>
                  <select value={orders.roles?.rouleur || ""} onChange={(e) => setRole("rouleur", e.target.value)} style={{ padding: 8, width: 180 }}>
                    <option value="">(none)</option>
                    {riderOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>

                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.7 }}>
                  Rollen påvirker nu motoren direkte (jagt/energi/finale).
                </div>
              </div>

              <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Presets</div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={savePreset} style={{ padding: "10px 12px" }}>
                    Gem preset
                  </button>

                  <select value={selectedPresetId} onChange={(e) => setSelectedPresetId(e.target.value)} style={{ padding: 8, minWidth: 220 }}>
                    <option value="">(vælg preset)</option>
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>

                  <button type="button" onClick={() => applyPreset(selectedPresetId)} disabled={!selectedPresetId} style={{ padding: "10px 12px" }}>
                    Load preset
                  </button>
                </div>

                {presetStatus ? <div style={{ marginTop: 8, opacity: 0.85 }}>{presetStatus}</div> : null}

                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.7 }}>
                  Presets gemmer nu også rider orders + triggers.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Rider orders (MVP)</div>
              <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>
                Modes: normal / pull / protect_captain / leadout / opportunist — Effort påvirker energi og bidrag.
              </div>

              {riders.length === 0 ? (
                <div style={{ opacity: 0.7 }}>Du har ingen ryttere endnu.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 10 }}>
                  {riders.map((r) => {
                    const ro = orders.riders?.[r.id] || { mode: "normal", effort: 0.6 };
                    const mode = ro.mode || "normal";
                    const effort = Number(ro.effort ?? 0.6);

                    return (
                      <div key={r.id} style={{ border: "1px solid #f0f0f0", borderRadius: 10, padding: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 700 }}>
                            {r.name}{" "}
                            {r.nationality ? <span style={{ fontWeight: 400, opacity: 0.7 }}>({r.nationality})</span> : null}
                          </div>

                          <select value={mode} onChange={(e) => setRiderMode(r.id, e.target.value)} style={{ padding: 8 }}>
                            <option value="normal">normal</option>
                            <option value="pull">pull</option>
                            <option value="protect_captain">protect_captain</option>
                            <option value="leadout">leadout</option>
                            <option value="opportunist">opportunist</option>
                          </select>
                        </div>

                        <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <div style={{ fontSize: 13, opacity: 0.8 }}>
                            Effort: <b>{effort.toFixed(2)}</b>
                          </div>
                          <input
                            type="range"
                            min={0.3}
                            max={1.0}
                            step={0.05}
                            value={effort}
                            onChange={(e) => setRiderEffort(r.id, e.target.value)}
                            style={{ width: 220 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <hr style={{ margin: "18px 0" }} />

          <div>
            <h3>Stage + points</h3>

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
                {stageBusy ? "Kører…" : "Kør stage + points (V1.3)"}
              </button>
            </div>

            {stageError && <p style={{ marginTop: 10, color: "crimson" }}>Fejl: {stageError}</p>}

            {stageResult && (
              <div style={{ marginTop: 12 }}>
                <div style={{ opacity: 0.85 }}>
                  <b>Event:</b> {stageResult.event?.name} · <b>Stage:</b> {stageResult.stage_template?.name}
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
                    <b>KM:</b> {currentKm}{" "}
                    <span style={{ opacity: 0.7 }}>(snapshot {cursor + 1}/{snapshots.length})</span>
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

            <div style={{ marginTop: 10, opacity: 0.7 }}>Build marker: MOTOR-V1.3-BATCH</div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
