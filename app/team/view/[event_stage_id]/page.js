"use client";
import { commentaryText } from "../../../../lib/race/commentary.mjs";
import { use, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TeamShell from "../../../components/TeamShell";
import { adaptGuidedReplayV1 } from "../../../../lib/viewer/guided-replay-adapter-v1.mjs";
import { guidedReplayClockV1 } from "../../../../lib/viewer/guided-replay-clock-v1.mjs";
import { illustrativeGroupLayoutFeedV1 } from
  "../../../../lib/viewer/illustrative-group-layout-v1.mjs";
import { guidedSceneryV1 } from
  "../../../../lib/viewer/guided-scenery-v1.mjs";
import "@pelotonia/race-viewer/commentary.css";
import "@pelotonia/race-viewer/profile.css";
import "../../motor-lab/viewer-preview/viewer-preview.css";

const ViewerScene = dynamic(() => import(
  "../../motor-lab/viewer-preview/ViewerPreviewScene"), { ssr: false,
  loading: () => <p role="status">Loading the race renderer…</p> });

export default function ViewPage({ params }) {
  const eventId = use(params).event_stage_id;
  const division = useSearchParams().get("division");
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [showReport, setShowReport] = useState(false),
    [now, setNow] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => clearInterval(timer);
  }, []);
  const adapted = useMemo(() => {
    if (!data?.run?.replay) return null;
    try {
      return adaptGuidedReplayV1(data.run.replay,
        { raceId: `${data.run.event_id}:division-${data.run.division_index}` });
    } catch { return null; }
  }, [data]);
  const clock = useMemo(() => {
    if (!adapted || !data?.viewer_clock || !now) return null;
    try {
      return guidedReplayClockV1(adapted.feed.duration,
        data.run.created_at, now + data.serverOffsetMs).clock;
    } catch { return null; }
  }, [adapted, data, now]);
  const displayFeed = useMemo(() => adapted &&
    guidedSceneryV1(illustrativeGroupLayoutFeedV1(adapted.feed)), [adapted]);
  const canShowReport = !adapted || !clock || clock.paused;
  useEffect(() => {
    if (!clock?.paused) return;
    try { localStorage.setItem(`pelotonia-watched:${eventId}`, "true"); }
    catch { /* Storage may be disabled; the result remains visible here. */ }
  }, [clock?.paused, eventId]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setData(null);
    setError("");
    setShowReport(false);
    const runUrl = `/api/event-run?event_id=${encodeURIComponent(eventId)}${division ? `&division_index=${encodeURIComponent(division)}` : ""}`;
    (async () => {
      let sent = Date.now();
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
        sent = Date.now();
        r = await fetch(runUrl, {
          signal: controller.signal,
          cache: "no-store",
        });
      }
      const j = await r.json();
      const received = Date.now();
      if (!r.ok || !j.ok)
        throw new Error(j.error || "Could not load the race.");
      if (active) setData({ ...j, serverOffsetMs: j.viewer_clock?.serverNowMs
        ? j.viewer_clock.serverNowMs - (sent + received) / 2 : 0 });
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
      ) : (
        <section className="card">
          <p className="eyebrow">Recorded race</p>
          <h1>{data.run.stage_snapshot?.name || "Race report"}</h1>
          <p>
            {adapted && clock ?
              "The saved race drives this schematic viewer. Each rider is shown at the recorded checkpoint kilometre. Group gaps are recorded seconds; exact lanes and simultaneous metres are unavailable." :
              "This recording cannot be displayed in the 3D viewer. Its saved report is available below."}
          </p>
          {displayFeed && clock ? <ViewerScene feed={displayFeed}
            coverage={adapted.coverage} version={adapted.version}
            mode="guided" clock={clock}
            serverOffsetMs={data.serverOffsetMs} /> : null}
          <button
            className="btn primary"
            disabled={!canShowReport}
            onClick={() => setShowReport(!showReport)}
          >
            {showReport
              ? "Hide report"
              : canShowReport ? "Show the full report" :
                "Full report available at the finish"}
          </button>
          {showReport && canShowReport && (
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
          {clock?.paused ? <Link className="btn primary"
            href={`/team/results/${eventId}${division ?
              `?division=${division}` : ""}`}>
            View results and points →
          </Link> : null}
        </section>
      )}
    </TeamShell>
  );
}
