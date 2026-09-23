"use client";
import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import TeamShell from "../../../components/TeamShell";
import { useAuth } from "../../../components/AuthProvider";
import { api } from "../../../../lib/api";
import { formatGap } from "../../../../lib/race/replay.mjs";

export default function ResultsPage({ params }) {
  const eventId = use(params).event_stage_id,
    query = useSearchParams(),
    requested = Number(query.get("division"));
  const { session } = useAuth(),
    teamId = session?.team?.id;
  const [divisions, setDivisions] = useState(null),
    [division, setDivision] = useState(null),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [revealed, setRevealed] = useState(false);
  useEffect(() => {
    setRevealed(false);
    try {
      setRevealed(
        localStorage.getItem(`pelotonia-watched:${eventId}`) === "true",
      );
    } catch {}
  }, [eventId]);
  useEffect(() => {
    const abort = new AbortController();
    setDivisions(null);
    setDivision(null);
    setData(null);
    setError("");
    api(`/api/event/divisions?event_id=${eventId}`, { signal: abort.signal })
      .then((j) => {
        if (abort.signal.aborted) return;
        setDivisions(j);
        setDivision(
          j.divisions.some((d) => d.division_index === requested)
            ? requested
            : j.my_division || j.divisions[0]?.division_index || 1,
        );
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [eventId, requested]);
  useEffect(() => {
    if (!division || !revealed) return;
    const abort = new AbortController();
    setData(null);
    setError("");
    api(`/api/event/results?event_id=${eventId}&division_index=${division}`, {
      signal: abort.signal,
    })
      .then((j) => {
        if (!abort.signal.aborted) setData(j);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [eventId, division, revealed]);
  const mine = data?.teams.find((t) => t.team_id === teamId);
  return (
    <TeamShell title="Resultat & point">
      {!revealed ? (
        <section className="card empty-state">
          <p className="eyebrow">Bevar spændingen</p>
          <h2>Vil du se løbet først?</h2>
          <p>
            Resultatlisten afslører vinderen, placeringerne og de optjente
            point.
          </p>
          <div className="control-row">
            <Link
              className="btn primary"
              href={`/team/view/${eventId}${division ? `?division=${division}` : ""}`}
            >
              Se løbet →
            </Link>
            <button className="btn" onClick={() => setRevealed(true)}>
              Vis resultatet nu
            </button>
          </div>
        </section>
      ) : (
        <>
          {error ? (
            <p role="alert" className="form-message error">
              {error}
            </p>
          ) : !data ? (
            <p role="status">Henter resultatet…</p>
          ) : (
            <>
              <section className="card result-overview">
                <div>
                  <p className="eyebrow">
                    {data.event.status === "FINISHED"
                      ? "I mål"
                      : "Resultat afventer"}
                  </p>
                  <h2>{data.event.name}</h2>
                  <p className="small">
                    Holdets placering følger kaptajnens tid. Point justeres
                    efter division.
                  </p>
                </div>
                <label>
                  Division{" "}
                  <select
                    aria-label="Resultatdivision"
                    value={division}
                    onChange={(e) => setDivision(Number(e.target.value))}
                  >
                    {(divisions?.divisions || []).map((d) => (
                      <option key={d.division_index} value={d.division_index}>
                        {d.division_index} · {d.team_count} hold
                        {d.division_index === divisions.my_division
                          ? " · dit hold"
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <Link
                  className="text-button"
                  href={`/team/view/${eventId}?division=${division}`}
                >
                  Se løbet igen →
                </Link>
              </section>
              {mine && (
                <div className="result-summary">
                  <div>
                    <span>Holdets placering</span>
                    <strong>#{mine.position}</strong>
                  </div>
                  <div>
                    <span>Holdpoint fra løbet</span>
                    <strong>+{mine.points}</strong>
                  </div>
                  <div>
                    <span>Division</span>
                    <strong>
                      {division}/{data.total_divisions}
                    </strong>
                  </div>
                </div>
              )}
              {!data.teams.length ? (
                <section className="card empty-state">
                  <h2>Intet resultat endnu</h2>
                  <p>
                    Løbet skal være afviklet, før placeringer og point kan
                    vises.
                  </p>
                  <Link className="btn" href="/team/run">
                    Til kalenderen
                  </Link>
                </section>
              ) : (
                <>
                  <section className="card results-table">
                    <h2>Holdenes resultat</h2>
                    <div className="table-scroll">
                      <table className="table">
                        <thead>
                          <tr>
                            <th scope="col">Nr.</th>
                            <th scope="col">Hold</th>
                            <th scope="col">Afstand</th>
                            <th scope="col">Point</th>
                            <th scope="col">Divisionsfaktor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.teams.map((t) => (
                            <tr
                              className={
                                t.team_id === teamId ? "own-result" : ""
                              }
                              key={t.team_id}
                            >
                              <td>{t.position}</td>
                              <td>
                                <strong>{t.teams?.name || "Hold"}</strong>
                                {t.team_id === teamId && (
                                  <span className="own-chip">Dit hold</span>
                                )}
                              </td>
                              <td>
                                {formatGap(t.time_sec - data.teams[0].time_sec)}
                              </td>
                              <td>
                                <strong>{t.points}</strong>
                              </td>
                              <td>
                                {Number(t.multiplier).toLocaleString("da-DK", {
                                  maximumFractionDigits: 3,
                                })}
                                ×
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <section className="card results-table">
                    <h2>Rytternes resultat</h2>
                    <p className="small">
                      De første 20 ryttere optjener rytterpoint. Disse point
                      indgår i holdets rating for løbets køn.
                    </p>
                    <div className="table-scroll">
                      <table className="table">
                        <thead>
                          <tr>
                            <th scope="col">Nr.</th>
                            <th scope="col">Rytter</th>
                            <th scope="col">Hold</th>
                            <th scope="col">Afstand</th>
                            <th scope="col">Point</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.riders.map((r) => (
                            <tr
                              key={r.rider_id}
                              className={
                                r.team_id === teamId ? "own-result" : ""
                              }
                            >
                              <td>{r.position}</td>
                              <td>
                                <strong>{r.riders?.name || "Rytter"}</strong>
                              </td>
                              <td>{r.teams?.name || "Hold"}</td>
                              <td>
                                {formatGap(
                                  r.time_sec - data.riders[0].time_sec,
                                )}
                              </td>
                              <td>{r.points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </>
      )}
    </TeamShell>
  );
}
