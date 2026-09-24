"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";
import TeamShell from "../../components/TeamShell";
export default function HistoryPage() {
  const [rows, setRows] = useState(null),
    [error, setError] = useState(""),
    [seen, setSeen] = useState({}),
    [reveal, setReveal] = useState(false);
  useEffect(() => {
    let active = true;
    api("/api/my-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 50 }),
    })
      .then((data) => {
        if (!active) return;
        setRows(data.rows || []);
        const watched = {};
        try {
          for (const r of data.rows || [])
            watched[r.event_id] =
              localStorage.getItem(`pelotonia-watched:${r.event_id}`) ===
              "true";
        } catch {}
        setSeen(watched);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <TeamShell title="Your race days">
      <p className="page-intro">
        Relive the highlights and follow your team’s results. Placings stay hidden
        until you watch the race or choose to reveal them.
      </p>
      {error ? (
        <p role="alert">{error}</p>
      ) : !rows ? (
        <p role="status">Loading your races…</p>
      ) : !rows.length ? (
        <section className="card empty-state">
          <h2>Your first race awaits</h2>
          <p>Select eight riders and a captain for an open race in the calendar.</p>
          <Link className="btn primary" href="/team/run">
            Find a race →
          </Link>
        </section>
      ) : (
        <>
          <label className="spoiler-choice">
            <input
              type="checkbox"
              checked={reveal}
              onChange={(e) => setReveal(e.target.checked)}
            />{" "}
            Reveal all placings and points
          </label>
          <div className="history-list">
            {rows.map((r) => (
              <article className="card history-race" key={r.event_id}>
                <div>
                  <p className="eyebrow">
                    Division {r.division_index} ·{" "}
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString("en-GB", { timeZone: "UTC" })
                      : ""}
                  </p>
                  <h2>{r.event_name}</h2>
                  <p>
                    {reveal || seen[r.event_id]
                      ? `Position ${r.position} · ${r.points} team points`
                      : "Race ready — result hidden"}
                  </p>
                </div>
                <div className="control-row">
                  <Link
                    className="btn primary"
                    href={`/team/view/${r.event_id}?division=${r.division_index}`}
                  >
                    {seen[r.event_id] ? "Watch again" : "Watch the race"} →
                  </Link>
                  <Link
                    className="text-button"
                    href={`/team/results/${r.event_id}?division=${r.division_index}`}
                  >
                    Result
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </TeamShell>
  );
}
