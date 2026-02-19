"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { getOrCreateTeam } from "../../../lib/team";
import Loading from "../../components/Loading";
import SmallButton from "../../components/SmallButton";
import StageProfile from "../../components/StageProfile";

function parseProfile(profile) {
  if (!profile) return null;
  if (typeof profile === "string") {
    try { return JSON.parse(profile); } catch { return null; }
  }
  return profile;
}

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
    riders: {}
  };
}

export default function RunPage() {
  const [status, setStatus] = useState("Loader…");
  const [pageError, setPageError] = useState("");

  const [team, setTeam] = useState(null);
  const [riders, setRiders] = useState([]);

  const [stages, setStages] = useState([]);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [stageObj, setStageObj] = useState(null);

  const [orders, setOrders] = useState(defaultOrders(null));

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [result, setResult] = useState(null);

  const [eventResult, setEventResult] = useState(null);
  const [selectedEventStageId, setSelectedEventStageId] = useState("");

  async function init() {
    setPageError("");
    setStatus("Tjekker session…");

    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error("Session-fejl: " + error.message);
    if (!data?.session) {
      setStatus("Du skal logge ind på 'Mit hold' først.");
      return;
    }

    setStatus("Loader hold…");
    const res = await getOrCreateTeam();
    setTeam(res.team);

    setStatus("Loader ryttere…");
    const { data: tr, error: trErr } = await supabase
      .from("team_riders")
      .select("rider:riders(*)")
      .eq("team_id", res.team.id);

    if (trErr) throw new Error("Kunne ikke hente ryttere: " + trErr.message);
    setRiders((tr ?? []).map((x) => x.rider).filter(Boolean));

    setStatus("Loader etaper…");
    const { data: stageList, error: sErr } = await supabase
      .from("stages")
      .select("id,name,distance_km,profile")
      .order("created_at", { ascending: false });

    if (sErr) throw new Error("Kunne ikke hente etaper: " + sErr.message);

    setStages(stageList ?? []);
    if ((stageList ?? []).length && !selectedStageId) setSelectedStageId(stageList[0].id);

    setStatus("Klar ✅");
  }

  useEffect(() => {
    init().catch((e) => {
      setPageError(e?.message ?? String(e));
      setStatus("Fejl");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const s = stages.find((x) => x.id === selectedStageId);
    if (!s) return;
    setStageObj({ ...s, profile: parseProfile(s.profile) });
  }, [selectedStageId, stages]);

  const riderOptions = useMemo(() => {
    return riders.map((r) => ({ id: r.id, label: `${r.name}${r.nationality ? " (" + r.nationality + ")" : ""}` }));
  }, [riders]);

  function setRole(role, riderId) {
    setOrders((o) => ({ ...o, roles: { ...(o.roles || {}), [role]: riderId || null } }));
  }
  function setPlanField(key, value) {
    setOrders((o) => ({ ...o, team_plan: { ...(o.team_plan || {}), [key]: value } }));
  }

  async function runOneDay() {
    setActionError("");
    setResult(null);
    setEventResult(null);
    setSelectedEventStageId("");

    if (!team?.id) return setActionError("Ingen team.");
    if (!selectedStageId) return setActionError("Vælg en etape.");

    setBusy(true);
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
      try { json = JSON.parse(text); } catch { json = null; }
      if (!res.ok) throw new Error(json?.error ?? text ?? "Ukendt fejl");

      const ids = (json.top10 ?? []).map((x) => x.rider_id).filter(Boolean);
      let nameMap = {};
      if (ids.length) {
        const { data: rData, error: rErr } = await supabase.from("riders").select("id,name").in("id", ids);
        if (rErr) throw new Error("Kunne ikke hente rytter-navne: " + rErr.message);
        if (rData?.length) for (const rr of rData) nameMap[rr.id] = rr.name;
      }

      const top10 = (json.top10 ?? []).map((x) => ({ ...x, rider_name: nameMap[x.rider_id] ?? x.rider_id }));
      setResult({ ...json, top10 });

      setSelectedEventStageId(json.event_stage?.id || "");
    } catch (e) {
      setActionError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runMiniStageRace() {
    setActionError("");
    setResult(null);
    setEventResult(null);
    setSelectedEventStageId("");

    setBusy(true);
    try {
      const res = await fetch("/api/run-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!res.ok) throw new Error(json?.error ?? text ?? "Ukendt fejl");

      const ids = (json.gc_top10 ?? []).map((x) => x.rider_id).filter(Boolean);
      let nameMap = {};
      if (ids.length) {
        const { data: rData, error: rErr } = await supabase.from("riders").select("id,name").in("id", ids);
        if (rErr) throw new Error("Kunne ikke hente rytter-navne: " + rErr.message);
        if (rData?.length) for (const rr of rData) nameMap[rr.id] = rr.name;
      }

      const leaderTime = json.gc_top10?.length ? Number(json.gc_top10[0].total_time_sec) : null;
      const gcPretty = (json.gc_top10 ?? []).map((x, idx) => {
        const t = Number(x.total_time_sec);
        const gap = leaderTime == null ? 0 : t - leaderTime;
        return {
          ...x,
          position: idx + 1,
          rider_name: nameMap[x.rider_id] ?? x.rider_id,
          display: idx === 0 ? formatHMS(t) : formatGap(gap)
        };
      });

      setEventResult({ ...json, gc_top10_pretty: gcPretty });

      const last = (json.event_stages ?? []).slice().sort((a, b) => a.stage_no - b.stage_no).at(-1);
      if (last?.event_stage_id) setSelectedEventStageId(last.event_stage_id);
    } catch (e) {
      setActionError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  if (pageError) {
    return (
      <main>
        <h2 style={{ marginTop: 0 }}>Kør løb</h2>
        <div style={{ color: "crimson" }}>Fejl: {pageError}</div>
        <div style={{ marginTop: 8, opacity: 0.75 }}>
          Tip: hvis fejlen nævner “JWT/session”, så prøv at logge ud og ind igen på “Mit hold”.
        </div>
      </main>
    );
  }

  return (
    <main>
      <h2 style={{ marginTop: 0 }}>Kør løb</h2>
      <p style={{ opacity: 0.85 }}>{status}</p>

      {!team ? <Loading text="Loader…" /> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Vælg etape</div>
            <select
              value={selectedStageId}
              onChange={(e) => setSelectedStageId(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: "100%" }}
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.distance_km} km)
                </option>
              ))}
            </select>

            <div style={{ marginTop: 12 }}>
              {stageObj ? <StageProfile stage={stageObj} /> : <Loading text="Loader etapeprofil…" />}
            </div>
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Taktik (MVP)</div>

            {riders.length === 0 ? (
              <div style={{ opacity: 0.75 }}>Du har ingen ryttere endnu. Gå til “Mit hold” og giv starter-pack.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <span>Focus</span>
                  <select value={orders.team_plan?.focus || "balanced"} onChange={(e) => setPlanField("focus", e.target.value)} style={{ padding: 8 }}>
                    <option value="balanced">balanced</option>
                    <option value="sprint">sprint</option>
                    <option value="break">break</option>
                    <option value="gc_safe">gc_safe</option>
                    <option value="chaos">chaos</option>
                  </select>
                </label>

                <label style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <span>Risk</span>
                  <select value={orders.team_plan?.risk || "medium"} onChange={(e) => setPlanField("risk", e.target.value)} style={{ padding: 8 }}>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </label>

                <label style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <span>Captain</span>
                  <select value={orders.roles?.captain || ""} onChange={(e) => setRole("captain", e.target.value)} style={{ padding: 8 }}>
                    <option value="">(none)</option>
                    {riderOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>

                <label style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <span>Sprinter</span>
                  <select value={orders.roles?.sprinter || ""} onChange={(e) => setRole("sprinter", e.target.value)} style={{ padding: 8 }}>
                    <option value="">(none)</option>
                    {riderOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <SmallButton disabled={busy || !selectedStageId || riders.length === 0} onClick={runOneDay}>
                {busy ? "Kører…" : "Kør endagsløb"}
              </SmallButton>

              <SmallButton disabled={busy || riders.length === 0} onClick={runMiniStageRace}>
                {busy ? "Kører…" : "Kør mini etapeløb (2 etaper)"}
              </SmallButton>
            </div>

            {actionError ? <div style={{ marginTop: 10, color: "crimson" }}>Fejl: {actionError}</div> : null}

            {result ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 800 }}>Resultat (Top 10)</div>
                <ol style={{ marginTop: 8 }}>
                  {(() => {
                    const top = result.top10 ?? [];
                    const leader = top.length ? Number(top[0].time_sec) : null;
                    return top.map((x, idx) => {
                      const t = Number(x.time_sec);
                      const gap = leader == null ? 0 : (t - leader);
                      const label = idx === 0 ? formatHMS(t) : formatGap(gap);
                      return <li key={x.rider_id}>{x.rider_name} — {label}</li>;
                    });
                  })()}
                </ol>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a href={`/team/results/${selectedEventStageId}`} style={{ textDecoration: "none" }}>
                    <SmallButton disabled={!selectedEventStageId}>Se resultat</SmallButton>
                  </a>
                  <a href={`/team/view/${selectedEventStageId}`} style={{ textDecoration: "none" }}>
                    <SmallButton disabled={!selectedEventStageId}>Se løb</SmallButton>
                  </a>
                </div>
              </div>
            ) : null}

            {eventResult ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 800 }}>Etapeløb: GC Top 10</div>

                <div style={{ marginTop: 10 }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span><b>Viewer etape:</b></span>
                    <select
                      value={selectedEventStageId}
                      onChange={(e) => setSelectedEventStageId(e.target.value)}
                      style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
                    >
                      {(eventResult.event_stages ?? []).map((s) => (
                        <option key={s.event_stage_id} value={s.event_stage_id}>
                          Etape {s.stage_no}: {s.stage_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <ol style={{ marginTop: 8 }}>
                  {(eventResult.gc_top10_pretty ?? []).map((x) => (
                    <li key={x.rider_id}>
                      {x.rider_name} — {x.display}
                    </li>
                  ))}
                </ol>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a href={`/team/results/${selectedEventStageId}`} style={{ textDecoration: "none" }}>
                    <SmallButton disabled={!selectedEventStageId}>Se resultat</SmallButton>
                  </a>
                  <a href={`/team/view/${selectedEventStageId}`} style={{ textDecoration: "none" }}>
                    <SmallButton disabled={!selectedEventStageId}>Se løb</SmallButton>
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
