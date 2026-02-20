"use client";

import { useEffect, useState } from "react";
import TeamShell from "../../../components/TeamShell";
import Loading from "../../../components/Loading";

export default function ViewPage({ params }) {
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
    <TeamShell title="Se løb">
      <p>Status: {status}</p>

      {!run ? <Loading text="Loader…" /> : (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
            <div style={{ fontWeight: 900 }}>
              {run?.stage_snapshot?.name || "Event"} · {run?.stage_snapshot?.distance_km} km
            </div>
            <div style={{ opacity: 0.8, marginTop: 6 }}>
              Engine {run.engine_version} · Seed <code>{run.seed}</code>
            </div>
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Live feed (MVP)</div>
            <div style={{ display: "grid", gap: 8 }}>
              {(run.feed || []).map((line, idx) => (
                <div key={idx} style={{ padding: 10, borderRadius: 12, border: "1px solid #f0f0f0" }}>
                  {typeof line === "string" ? line : (line?.text ?? JSON.stringify(line))}
                </div>
              ))}
              {!run.feed?.length ? <div style={{ opacity: 0.7 }}>Ingen feed-data.</div> : null}
            </div>
          </div>
        </div>
      )}
    </TeamShell>
  );
}
