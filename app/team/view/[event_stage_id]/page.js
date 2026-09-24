"use client";
import { commentaryText } from "../../../../lib/race/commentary.mjs";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TeamShell from "../../../components/TeamShell";
import RaceViewer from "../../../components/RaceViewer";

export default function ViewPage({ params }) {
  const eventId = use(params).event_stage_id;
  const division = useSearchParams().get("division");
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [showReport, setShowReport] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setData(null);
    setError("");
    setShowReport(false);
    const runUrl = `/api/event-run?event_id=${encodeURIComponent(eventId)}${division ? `&division_index=${encodeURIComponent(division)}` : ""}`;
    (async () => {
      let r = await fetch(runUrl, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (r.status === 404) {
        const prepared = await fetch("/api/event/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: eventId }),
          signal: controller.signal,
        });
        const result = await prepared.json();
        if (!prepared.ok || !result.ok)
          throw new Error(result.error || "Could not prepare the race.");
        r = await fetch(runUrl, {
          signal: controller.signal,
          cache: "no-store",
        });
      }
      const j = await r.json();
      if (!r.ok || !j.ok)
        throw new Error(j.error || "Could not load the race.");
      if (active) setData(j);
    })().catch((e) => {
      if (active && e.name !== "AbortError") setError(e.message);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [eventId, division, attempt]);
  return (
    <TeamShell title="Race day" compact>
      {error ? (
        <section className="card empty-state" role="status">
          <p className="eyebrow">The race is not ready</p>
          <h1>Race replay unavailable</h1>
          <p>{error}</p>
          <button
            className="btn primary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </button>
          <Link className="btn" href="/team/run">
            To the race calendar
          </Link>
        </section>
      ) : !data ? (
        <section className="card empty-state" role="status">
          <div className="loading-wheel" />
          <h2>Preparing race day…</h2>
          <p>Loading the recorded race.</p>
        </section>
      ) : data.run.replay?.version === 1 ? (
        <RaceViewer
          key={`${eventId}:${data.run.division_index}`}
          run={data.run}
          teamId={data.team_id}
        />
      ) : (
        <section className="card empty-state">
          <p className="eyebrow">Historic race</p>
          <h1>{data.run.stage_snapshot?.name || "Race report"}</h1>
          <p>
            This race took place before the new viewer. The original report is
            preserved; no recorded group replay is available.
          </p>
          <button
            className="btn primary"
            onClick={() => setShowReport(!showReport)}
          >
            {showReport
              ? "Hide report"
              : "Show the full report (reveals the result)"}
          </button>
          {showReport && (
            <ol className="race-feed">
              {(data.run.feed || []).map((x, i) => (
                <li key={i}>
                  <span className="feed-km">
                    {x.km ?? "—"}
                    <small>km</small>
                  </span>
                  <p>{commentaryText(x.text || x.message || String(x))}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </TeamShell>
  );
}
