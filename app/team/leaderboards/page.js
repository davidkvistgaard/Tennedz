"use client";
import { useEffect, useState } from "react";
import TeamShell from "../../components/TeamShell";
import { api } from "../../../lib/api";
import "./rankings.css";

const options = {
  entity: [["rider", "Riders"], ["team", "Teams"]],
  gender: [["M", "Men"], ["F", "Women"], ["combined", "Combined"]],
  source: [["all", "Overall"], ["UCI", "UCI"], ["PELOTONIA", "Pelotonia"]],
  format: [["all", "All formats"], ["ONE_DAY", "One-day"], ["STAGE_RACE", "Stage races"]],
};
function Filter({ label, value, values, onChange }) {
  return <label>{label}<select value={value} onChange={event => onChange(event.target.value)}>
    {values.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
  </select></label>;
}
export default function LeaderboardsPage() {
  const [view, setView] = useState("sporting");
  const [filters, setFilters] = useState({ entity: "rider", gender: "M", source: "all", format: "all", season: "current" });
  const [data, setData] = useState(null), [error, setError] = useState("");
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value,
    ...(key === "entity" && value === "rider" && current.gender === "combined" ? { gender: "M" } : {}) }));
  useEffect(() => {
    let active = true;
    setData(null);
    const query = new URLSearchParams(view === "ability" ? { view, gender: filters.gender } : { ...filters, view });
    api(`/api/leaderboards?${query}`).then(result => { if (active) { setData(result); setError(""); } })
      .catch(failure => { if (active) { setData(null); setError(failure.message); } });
    return () => { active = false; };
  }, [filters, view]);
  return <TeamShell title="Rankings"><div className="rankings-page">
    <header><p className="identity-eyebrow">THE SPORTING TABLE</p><h1>{view === "sporting" ? "Earned on the road." : "Rider ability."}</h1>
      <p>{view === "sporting" ? "Every sporting point comes from a race result. Change a filter to see another view of the same points ledger." : "Ability ratings describe rider strength and remain separate from earned sporting points."}</p></header>
    <div className="rankings-views" role="group" aria-label="View type">
      <button type="button" aria-pressed={view === "sporting"} onClick={() => setView("sporting")}>Sporting points</button>
      <button type="button" aria-pressed={view === "ability"} onClick={() => { if (filters.gender === "combined") set("gender", "M"); setView("ability"); }}>Ability ratings</button>
    </div>
    <div className="rankings-filters">
      {view === "sporting" && <Filter label="Ranking" value={filters.entity} values={options.entity} onChange={value => set("entity", value)}/>}
      <Filter label="Category" value={filters.gender} values={options.gender.filter(([key]) => key !== "combined" || view === "sporting" && filters.entity === "team")} onChange={value => set("gender", value)}/>
      {view === "sporting" && <Filter label="Calendar" value={filters.source} values={options.source} onChange={value => set("source", value)}/>}
      {view === "sporting" && <Filter label="Race format" value={filters.format} values={options.format} onChange={value => set("format", value)}/>}
      {view === "sporting" && <label>Season<select value={filters.season} onChange={event => set("season", event.target.value)}>
        <option value="current">Current season</option><option value="all">All-time</option>
        {(data?.seasons ?? []).filter(year => year !== data.current_season).map(year => <option key={year} value={year}>{year}</option>)}
      </select></label>}
    </div>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">Loading rankings…</p>}
    {data && view === "ability" && [["Teams", data.teams], ["Riders", data.riders]].map(([title, rows]) => <section className="card rankings-list" key={title}>
      <h2>{title}</h2><ol>{(rows ?? []).map(row => <li key={row.id}><span>{row.name}</span><strong>{row.rating} rating</strong></li>)}</ol>
    </section>)}
    {data && view === "sporting" && <section className="card rankings-list"><div className="rankings-list-head"><h2>
      {filters.gender === "combined" ? "Combined teams" : filters.gender === "F" ? "Women" : "Men"} · {filters.source === "all" ? "Overall" : filters.source === "UCI" ? "UCI" : "Pelotonia"}
    </h2><span>{data.season === "all" ? "All-time" : data.season === "current" ? `${data.current_season} season` : `${data.season} season`}</span></div>
      {data.rows.length ? <ol>{data.rows.map(row => <li key={row.id}>
        <strong className="rankings-place">{row.rank}</strong><span>{row.name}</span><strong>{row.points.toLocaleString("en-GB")} pts</strong>
      </li>)}</ol> : <p>No sporting points have been awarded for this view yet.</p>}
    </section>}
  </div></TeamShell>;
}
