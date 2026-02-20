"use client";

import { useEffect, useMemo, useState } from "react";
import TeamShell from "../../../components/TeamShell";
import Loading from "../../../components/Loading";
import SmallButton from "../../../components/SmallButton";
import { Pill, SectionHeader } from "../../../components/ui";
import { supabase } from "../../../../lib/supabaseClient";
import { getOrCreateTeam } from "../../../../lib/team";

function fmtGapToWinner(timeSec, winnerSec) {
  const diff = Number(timeSec) - Number(winnerSec);
  if (diff <= 0.4) return "0s";
  if (diff < 60) return `+${Math.round(diff)}s`;
  const m = Math.floor(diff / 60);
  const s = Math.round(diff - m * 60);
  return `+${m}:${String(s).padStart(2, "0")}`;
}

export default function ResultsPage({ params }) {
  const eventId = params.event_stage_id;

  const [status, setStatus] = useState("Loader…");
  const [team, setTeam] = useState(null);

  const [divInfo, setDivInfo] = useState(null);
  const [divisionIndex, setDivisionIndex] = useState(1);

  const [data, setData] = useState(null);

  async function loadBase() {
    setStatus("Loader…");
    const { data: s } = await supabase.auth.getSession();
    if (!s?.session) {
      setStatus("Du er ikke logget ind.");
      setTeam(null);
      return;
    }
    const res = await getOrCreateTeam();
    setTeam(res.team);
    setStatus("Klar ✅");
  }

  async function loadDivisions(teamId) {
    const j = await fetch(`/api/event/divisions?event_id=${eventId}&team_id=${teamId}`).then(r => r.json());
    if (j?.ok) {
      setDivInfo(j);
      if (j.my_division) setDivisionIndex(j.my_division);
    }
  }

  async function loadResults(divIndex) {
    setData(null);
    const j = await fetch(`/api/event/results?event_id=${eventId}&division_index=${divIndex}`).then(r => r.json());
    if (!j?.ok) throw new Error(j?.error || "Could not load results");
    setData(j);
  }

  useEffect(() => {
    (async () => {
      try {
        await loadBase();
      } catch (e) {
        setStatus("Fejl: " + (e?.message ?? String(e)));
      }
    })();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!team?.id) return;
    (async () => {
      try {
        await loadDivisions(team.id);
      } catch (e) {
        // ignore
      }
    })();
  }, [team?.id]);

  useEffect(() => {
    (async () => {
      try {
        await loadResults(divisionIndex);
      } catch (e) {
        setStatus("Fejl: " + (e?.message ?? String(e)));
      }
    })();
  }, [divisionIndex]);

  const winnerTime = useMemo(() => {
    const t0 = data?.teams?.[0]?.time_sec;
    return t0 != null ? Number(t0) : null;
  }, [data]);

  return (
    <TeamShell title="Resultat">
      <p className="small">Status: {status}</p>

      {!team ? <Loading text="Loader…" /> : (
        <div style={{ display: "grid", gap: 14 }}>
          <div className="card" style={{ padding: 14 }}>
            <SectionHeader
              title={data?.event?.name || "Event"}
              subtitle="Resultater og points pr. division (max 20 hold)."
              right={<SmallButton onClick={() => loadResults(divisionIndex)}>Reload</SmallButton>}
            />

            <div className="hr" />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div className="small" style={{ marginBottom: 6 }}>Division</div>
                <select
                  value={divisionIndex}
                  onChange={(e) => setDivisionIndex(Number(e.target.value))}
                  style={{ minWidth: 220 }}
                >
                  {(divInfo?.divisions || [{ division_index: 1, team_count: 0 }]).map(d => (
                    <option key={d.division_index} value={d.division_index}>
                      Division {d.division_index}/{divInfo?.total_divisions || data?.total_divisions || 1} ({d.team_count} hold)
                      {divInfo?.my_division === d.division_index ? " · DIN" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <Pill tone="info">
                Total divisions: {divInfo?.total_divisions || data?.total_divisions || 1}
              </Pill>
              {divInfo?.my_division ? <Pill tone="accent">Din division: {divInfo.my_division}</Pill> : null}
            </div>
          </div>

          {!data ? <Loading text="Loader resultater…" /> : (
            <>
              {/* Team standings */}
              <div className="card" style={{ padding: 14 }}>
                <SectionHeader
                  title="Hold (division)"
                  subtitle="Placering beregnes ud fra kaptajnens (eller bedste rytters) tid. Points = matrix × dynamic multiplier."
                />
                <div className="hr" />

                <div style={{ overflowX: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Hold</th>
                        <th>Gap</th>
                        <th>Points</th>
                        <th>Multiplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.teams.map((t) => (
                        <tr key={t.team_id} style={{ opacity: t.team_id === team.id ? 1 : 0.95 }}>
                          <td><b>{t.position}</b></td>
                          <td>{t.teams?.name || "Team"}</td>
                          <td>{winnerTime == null ? "-" : fmtGapToWinner(t.time_sec, winnerTime)}</td>
                          <td><b>{t.points}</b></td>
                          <td>{Number(t.multiplier).toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rider standings */}
              <div className="card" style={{ padding: 14 }}>
                <SectionHeader
                  title="Top 50 ryttere (division)"
                  subtitle="Rytterpoints gives til top 20 ryttere i divisionen (samme matrix × multiplier)."
                />
                <div className="hr" />

                <div style={{ overflowX: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Rytter</th>
                        <th>Hold</th>
                        <th>Gap</th>
                        <th>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.riders.map((r) => (
                        <tr key={r.rider_id}>
                          <td><b>{r.position}</b></td>
                          <td>{r.riders?.name || "Rider"}</td>
                          <td>{r.teams?.name || "Team"}</td>
                          <td>{winnerTime == null ? "-" : fmtGapToWinner(r.time_sec, winnerTime)}</td>
                          <td><b>{r.points}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </TeamShell>
  );
}
