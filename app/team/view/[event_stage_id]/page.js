"use client";
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
          throw new Error(result.error || "Løbet kunne ikke gøres klar.");
        r = await fetch(runUrl, {
          signal: controller.signal,
          cache: "no-store",
        });
      }
      const j = await r.json();
      if (!r.ok || !j.ok)
        throw new Error(j.error || "Løbet kunne ikke hentes.");
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
    <TeamShell title="Løbsdagen" compact>
      {error ? (
        <section className="card empty-state" role="status">
          <p className="eyebrow">Løbet er ikke klar</p>
          <h1>Vi mangler løbsforløbet</h1>
          <p>{error}</p>
          <button
            className="btn primary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Prøv igen
          </button>
          <Link className="btn" href="/team/run">
            Til løbskalenderen
          </Link>
        </section>
      ) : !data ? (
        <section className="card empty-state" role="status">
          <div className="loading-wheel" />
          <h2>Gør løbsdagen klar…</h2>
          <p>Henter det gemte løbsforløb.</p>
        </section>
      ) : data.run.replay?.version === 1 ? (
        <RaceViewer
          key={`${eventId}:${data.run.division_index}`}
          run={data.run}
          teamId={data.team_id}
        />
      ) : (
        <section className="card empty-state">
          <p className="eyebrow">Historisk løb</p>
          <h1>{data.run.stage_snapshot?.name || "Løbsreferat"}</h1>
          <p>
            Dette løb blev kørt før den nye viewer. Det originale referat er
            bevaret; der findes ingen optagelse med grupper.
          </p>
          <button
            className="btn primary"
            onClick={() => setShowReport(!showReport)}
          >
            {showReport
              ? "Skjul referat"
              : "Vis hele referatet (afslører resultatet)"}
          </button>
          {showReport && (
            <ol className="race-feed">
              {(data.run.feed || []).map((x, i) => (
                <li key={i}>
                  <span className="feed-km">
                    {x.km ?? "—"}
                    <small>km</small>
                  </span>
                  <p>{x.text || x.message || String(x)}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </TeamShell>
  );
}
