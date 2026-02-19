"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Loading from "../../../components/Loading";
import SmallButton from "../../../components/SmallButton";

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

export default function ViewStage({ params }) {
  const event_stage_id = params?.event_stage_id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [feed, setFeed] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [play, setPlay] = useState(false);
  const timerRef = useRef(null);

  async function load() {
    setError("");
    setLoading(true);
    setFeed([]);
    setSnapshots([]);
    setCursor(0);
    setPlay(false);

    const r = await fetch("/api/view-stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_stage_id })
    });

    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = null; }
    if (!r.ok) throw new Error(json?.error ?? text ?? "Ukendt fejl");

    setFeed(json.feed ?? []);
    setSnapshots(json.snapshots ?? []);
  }

  useEffect(() => {
    load()
      .catch((e) => setError(e?.message ?? String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event_stage_id]);

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

    return () => timerRef.current && clearInterval(timerRef.current);
  }, [play, snapshots.length]);

  useEffect(() => {
    if (snapshots.length && cursor >= snapshots.length - 1) setPlay(false);
  }, [cursor, snapshots.length]);

  const currentSnap = snapshots[cursor]?.state || null;
  const currentKm = currentSnap?.km ?? 0;

  const visibleFeed = useMemo(() => {
    return (feed ?? []).filter((e) => Number(e.km) <= Number(currentKm));
  }, [feed, currentKm]);

  return (
    <main>
      <h2 style={{ marginTop: 0 }}>Se løb</h2>
      <div style={{ opacity: 0.75, marginBottom: 10 }}>event_stage_id: {event_stage_id}</div>

      {loading ? <Loading text="Loader viewer…" /> : null}
      {error ? <div style={{ color: "crimson" }}>Fejl: {error}</div> : null}

      {!loading && !error && (
        <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <b>KM:</b> {currentKm}{" "}
              <span style={{ opacity: 0.7 }}>(snapshot {cursor + 1}/{snapshots.length})</span>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <SmallButton onClick={() => setPlay((p) => !p)} disabled={!snapshots.length}>
                {play ? "Pause" : "Play"}
              </SmallButton>
              <SmallButton onClick={() => { setCursor(0); setPlay(false); }} disabled={!snapshots.length}>
                Reset
              </SmallButton>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <input
              type="range"
              min={0}
              max={Math.max(0, snapshots.length - 1)}
              value={cursor}
              onChange={(e) => setCursor(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <b>Grupper</b>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginTop: 8 }}>
              {(currentSnap?.groups ?? []).map((g) => (
                <div key={g.id} style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 10 }}>
                  <div style={{ fontWeight: 800 }}>{g.type}</div>
                  <div style={{ opacity: 0.85 }}>Ryttere: {g.riders}</div>
                  <div style={{ opacity: 0.85 }}>Gap: {formatGap(g.gap_sec)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <b>Live feed</b>
            <div style={{ marginTop: 8, maxHeight: 320, overflow: "auto", border: "1px solid #f3f3f3", borderRadius: 12, padding: 10 }}>
              {visibleFeed.length === 0 ? (
                <div style={{ opacity: 0.7 }}>Ingen events endnu (tryk Play).</div>
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
    </main>
  );
}
