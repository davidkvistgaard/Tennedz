"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import Loading from "../../../components/Loading";

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

export default function ResultsPage({ params }) {
  const event_stage_id = params?.event_stage_id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]);
  const [stageInfo, setStageInfo] = useState(null);

  async function load() {
    setError("");
    setLoading(true);

    // stage meta
    const { data: es, error: esErr } = await supabase
      .from("event_stages")
      .select("id,stage_no,stage_template_id,event_id,created_at,stage:stages(id,name,distance_km)")
      .eq("id", event_stage_id)
      .single();

    if (esErr) throw esErr;
    setStageInfo(es);

    // results top 50
    const { data: res, error: rErr } = await supabase
      .from("stage_results")
      .select("position,time_sec,rider_id,team_id")
      .eq("event_stage_id", event_stage_id)
      .order("position", { ascending: true })
      .limit(50);

    if (rErr) throw rErr;

    // rider names
    const ids = (res ?? []).map((x) => x.rider_id).filter(Boolean);
    let nameMap = {};
    if (ids.length) {
      const { data: rData } = await supabase.from("riders").select("id,name").in("id", ids);
      if (rData?.length) for (const rr of rData) nameMap[rr.id] = rr.name;
    }

    const leaderTime = res?.length ? Number(res[0].time_sec) : null;
    const pretty = (res ?? []).map((x) => {
      const t = Number(x.time_sec);
      const gap = leaderTime == null ? 0 : (t - leaderTime);
      return {
        ...x,
        rider_name: nameMap[x.rider_id] ?? x.rider_id,
        display: x.position === 1 ? formatHMS(t) : formatGap(gap)
      };
    });

    setRows(pretty);
  }

  useEffect(() => {
    load()
      .catch((e) => setError(e?.message ?? String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event_stage_id]);

  return (
    <main>
      <h2 style={{ marginTop: 0 }}>Se resultat</h2>
      <div style={{ opacity: 0.75, marginBottom: 10 }}>event_stage_id: {event_stage_id}</div>

      {loading ? <Loading text="Loader resultat…" /> : null}
      {error ? <div style={{ color: "crimson" }}>Fejl: {error}</div> : null}

      {!loading && !error && (
        <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
          <div style={{ fontWeight: 800 }}>
            {stageInfo?.stage?.name ? `${stageInfo.stage.name} (Etape ${stageInfo.stage_no})` : "Resultat"}
          </div>

          <ol style={{ marginTop: 12 }}>
            {rows.map((x) => (
              <li key={x.rider_id}>
                {x.rider_name} — {x.display}
              </li>
            ))}
          </ol>
        </div>
      )}
    </main>
  );
}
