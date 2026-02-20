"use client";

import { useEffect, useState } from "react";
import TeamShell from "../../../components/TeamShell";
import Loading from "../../../components/Loading";
import { SectionHeader, Pill } from "../../../components/ui";

function fmtGap(g) {
  if (!g || g === "+0s" || g === "0s") return "0s";
  return g;
}

export default function ResultsPage({ params }) {
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

  const top = run?.results?.slice?.(0, 3) ?? [];

  return (
    <TeamShell title="Resultat">
      <p className="small">Status: {status}</p>

      {!run ? (
        <Loading text="Loader…" />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div className="card" style={{ padding: 14 }}>
            <SectionHeader
              title={run?.stage_snapshot?.name || "Event"}
              subtitle={`Engine ${run.engine_version} · Seed ${run.seed}`}
              right={<a className="pillBtn" href={`/team/view/${eventId}`} style={{ textDecoration: "none" }}>Se løb</a>}
            />

            <div className="hr" />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {top.map((r, idx) => (
                <div key={idx} className="card" style={{ padding: 12, minWidth: 240, background: "rgba(0,0,0,0.25)" }}>
                  <div className="badge" style={{ marginBottom: 8 }}>
                    <span style={{ color: "var(--accent)", fontWeight: 1000 }}>#{r.position}</span>
                    <span>{r.team_name}</span>
                  </div>
                  <div style={{ fontWeight: 1000, fontSize: 16 }}>{r.rider_name || r.name}</div>
                  <div className="small" style={{ marginTop: 6 }}>Gap: <b style={{ color: "var(--text)" }}>{fmtGap(r.gap_text)}</b></div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <SectionHeader title="Top 50" subtitle="Gaps vises relativt til vinderen." />

            <div className="hr" />

            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Rytter</th>
                  <th>Hold</th>
                  <th>Gap</th>
                </tr>
              </thead>
              <tbody>
                {(run.results || []).slice(0, 50).map((r) => (
                  <tr key={`${r.rider_id}-${r.position}`}>
                    <td>{r.position}</td>
                    <td style={{ fontWeight: 900 }}>{r.rider_name || r.name}</td>
                    <td>{r.team_name}</td>
                    <td>{fmtGap(r.gap_text)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!run.results?.length ? <div className="small">Ingen resultater endnu. (Event skal køres i admin.)</div> : null}
          </div>
        </div>
      )}
    </TeamShell>
  );
}
