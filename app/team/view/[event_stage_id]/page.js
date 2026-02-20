"use client";

import { useEffect, useMemo, useState } from "react";
import TeamShell from "../../../components/TeamShell";
import Loading from "../../../components/Loading";
import { SectionHeader, Pill } from "../../../components/ui";

function toLines(feed) {
  if (!Array.isArray(feed)) return [];
  return feed.map((x) => {
    if (typeof x === "string") return { km: null, text: x };
    return { km: x?.km ?? null, text: x?.text ?? JSON.stringify(x) };
  });
}

export default function ViewPage({ params }) {
  const eventId = params?.event_stage_id;
  const [status, setStatus] = useState("Loader…");
  const [run, setRun] = useState(null);

  useEffect(() => {
    (async () => {
      setStatus("Loader…");
      try {
        const j = await fetch(`/api/event-run?event_id=${eventId}`).then((r) => r.json());
        if (!j?.ok) throw new Error(j?.error || "Could not load event run");
        setRun(j.run);
        setStatus("Klar ✅");
      } catch (e) {
        setStatus("Fejl: " + (e?.message ?? String(e)));
      }
    })();
  }, [eventId]);

  const lines = useMemo(() => toLines(run?.feed), [run]);

  // Build a very simple km “timeline”
  const distance = Number(run?.stage_snapshot?.distance_km ?? 150);
  const markers = useMemo(() => {
    const ms = [
      { km: Math.max(0, distance - 5), label: "5 km" },
      { km: Math.max(0, distance - 3), label: "3 km" },
      { km: Math.max(0, distance - 1), label: "1 km" },
      { km: distance, label: "Mål" }
    ];
    return ms;
  }, [distance]);

  return (
    <TeamShell title="Se løb">
      <p className="small">Status: {status}</p>

      {!run ? (
        <Loading text="Loader…" />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div className="card" style={{ padding: 14 }}>
            <SectionHeader
              title={run?.stage_snapshot?.name || "Event"}
              subtitle={`${distance} km · Engine ${run.engine_version}`}
              right={<Pill tone="info">Seed: {run.seed}</Pill>}
            />

            <div className="hr" />

            <div style={{ position: "relative", height: 16, borderRadius: 999, border: "1px solid var(--border)", background: "rgba(0,0,0,0.35)" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: "linear-gradient(90deg, rgba(124,255,107,0.14), rgba(77,214,255,0.12))" }} />
              {markers.map((m, idx) => {
                const left = distance > 0 ? Math.max(0, Math.min(100, (m.km / distance) * 100)) : 0;
                return (
                  <div key={idx} title={`${m.label} · ${m.km} km`}
                    style={{
                      position: "absolute",
                      left: `calc(${left}% - 6px)`,
                      top: -7,
                      width: 12,
                      height: 30,
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.22)",
                      background: "rgba(0,0,0,0.45)"
                    }}
                  />
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
              <span className="small">0 km</span>
              <span className="small">{distance} km</span>
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <SectionHeader title="Live feed" subtitle="MVP feed (næste: bedre segmentering + flere events i finalen)" />

            <div className="hr" />

            <div style={{ display: "grid", gap: 10 }}>
              {lines.length ? lines.map((l, idx) => (
                <div key={idx} style={{ padding: 12, borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.25)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontWeight: 900 }}>{l.text}</div>
                    {l.km != null ? <span className="badge">km {l.km}</span> : null}
                  </div>
                </div>
              )) : (
                <div className="small">Ingen feed-data endnu. (Event skal køres i admin.)</div>
              )}
            </div>
          </div>
        </div>
      )}
    </TeamShell>
  );
}
