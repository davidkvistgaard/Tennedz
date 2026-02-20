"use client";

import { useEffect, useState } from "react";
import TeamShell from "../../../components/TeamShell";
import Loading from "../../../components/Loading";

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
        const j = await fetch(`/api/event-run?event_id=${eventId}`).then(r => r.json());
        if (!j?.ok) throw new Error(j?.error || "Could not load event run");
        setRun(j.run);
        setStatus("Klar ✅");
      } catch (e) {
        setStatus("Fejl: " + (e?.message ?? String(e)));
      }
    })();
  }, [eventId]);

  return (
    <TeamShell title="Resultat">
      <p>Status: {status}</p>

      {!run ? <Loading text="Loader…" /> : (
        <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>
            {run?.stage_snapshot?.name || "Event"} · Engine {run.engine_version}
          </div>

          <div style={{ opacity: 0.8, marginBottom: 12 }}>
            Seed: <code>{run.seed}</code>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>#</th>
                <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>Rytter</th>
                <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>Hold</th>
                <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>Gap</th>
              </tr>
            </thead>
            <tbody>
              {(run.results || []).slice(0, 50).map((r) => (
                <tr key={`${r.rider_id}-${r.position}`}>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>{r.position}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>{r.rider_name || r.name}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>{r.team_name}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>{fmtGap(r.gap_text)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TeamShell>
  );
}
