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
    <TeamShell title="Results & points">
      {!revealed ? (
        <section className="card empty-state">
          <p className="eyebrow">Keep the suspense</p>
          <h2>Watch the race first?</h2>
          <p>
            The results reveal the winner, the placings, and the points
            earned.
          </p>
          <div className="control-row">
            <Link
              className="btn primary"
              href={`/team/view/${eventId}${division ? `?division=${division}` : ""}`}
            >
              Watch the race →
            </Link>
            <button className="btn" onClick={() => setRevealed(true)}>
              Reveal the result now
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
            <p role="status">Loading the result…</p>
          ) : (
            <>
              <section className="card result-overview">
                <div>
                  <p className="eyebrow">
                    {data.event.status === "FINISHED"
                      ? "Finished"
                      : "Result pending"}
                  </p>
                  <h2>{data.event.name}</h2>
                  <p className="small">
                    Your team’s placing follows your captain’s time. Points are adjusted
                    by division.
                  </p>
                </div>
                <label>
                  Division{" "}
                  <select
                    aria-label="Results division"
                    value={division}
                    onChange={(e) => setDivision(Number(e.target.value))}
                  >
                    {(divisions?.divisions || []).map((d) => (
                      <option key={d.division_index} value={d.division_index}>
                        {d.division_index} · {d.team_count} teams
                        {d.division_index === divisions.my_division
                          ? " · your team"
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <Link
                  className="text-button"
                  href={`/team/view/${eventId}?division=${division}`}
                >
                  Watch the race again →
                </Link>
              </section>
              {mine && (
                <div className="result-summary">
                  <div>
                    <span>Team placing</span>
                    <strong>#{mine.position}</strong>
                  </div>
                  <div>
                    <span>Team points from this race</span>
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
                  <h2>No result yet</h2>
                  <p>
                    The race must be completed before placings and points can
                    be shown.
                  </p>
                  <Link className="btn" href="/team/run">
                    To the calendar
                  </Link>
                </section>
              ) : (
                <>
                  <section className="card results-table">
                    <h2>Team results</h2>
                    <div className="table-scroll">
                      <table className="table">
                        <thead>
                          <tr>
                            <th scope="col">Pos.</th>
                            <th scope="col">Team</th>
                            <th scope="col">Gap</th>
                            <th scope="col">Points</th>
                            <th scope="col">Division multiplier</th>
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
                                <strong>{t.teams?.name || "Team"}</strong>
                                {t.team_id === teamId && (
                                  <span className="own-chip">Your team</span>
                                )}
                              </td>
                              <td>
                                {formatGap(t.time_sec - data.teams[0].time_sec)}
                              </td>
                              <td>
                                <strong>{t.points}</strong>
                              </td>
                              <td>
                                {Number(t.multiplier).toLocaleString("en-GB", {
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
                    <h2>Rider results</h2>
                    <p className="small">
                      The first 20 riders earn rider points. These points
                      contribute to your team’s rating in this race category.
                    </p>
                    <div className="table-scroll">
                      <table className="table">
                        <thead>
                          <tr>
                            <th scope="col">Pos.</th>
                            <th scope="col">Rider</th>
                            <th scope="col">Team</th>
                            <th scope="col">Gap</th>
                            <th scope="col">Points</th>
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
                                <strong>{r.riders?.name || "Rider"}</strong>
                              </td>
                              <td>{r.teams?.name || "Team"}</td>
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
