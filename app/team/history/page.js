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
    <TeamShell title="Dine løbsdage">
      <p className="page-intro">
        Gense højdepunkterne og følg holdets resultater. Placeringer skjules,
        indtil du har set løbet eller selv vælger at vise dem.
      </p>
      {error ? (
        <p role="alert">{error}</p>
      ) : !rows ? (
        <p role="status">Henter dine løb…</p>
      ) : !rows.length ? (
        <section className="card empty-state">
          <h2>Dit første løb venter</h2>
          <p>Udtag otte ryttere og en kaptajn til et åbent løb i kalenderen.</p>
          <Link className="btn primary" href="/team/run">
            Find et løb →
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
            Vis alle placeringer og point
          </label>
          <div className="history-list">
            {rows.map((r) => (
              <article className="card history-race" key={r.event_id}>
                <div>
                  <p className="eyebrow">
                    Division {r.division_index} ·{" "}
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString("da-DK")
                      : ""}
                  </p>
                  <h2>{r.event_name}</h2>
                  <p>
                    {reveal || seen[r.event_id]
                      ? `Nr. ${r.position} · ${r.points} holdpoint`
                      : "Løbet er klar — resultatet er skjult"}
                  </p>
                </div>
                <div className="control-row">
                  <Link
                    className="btn primary"
                    href={`/team/view/${r.event_id}?division=${r.division_index}`}
                  >
                    {seen[r.event_id] ? "Se igen" : "Se løbet"} →
                  </Link>
                  <Link
                    className="text-button"
                    href={`/team/results/${r.event_id}?division=${r.division_index}`}
                  >
                    Resultat
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
