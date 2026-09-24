"use client";
import { useEffect, useRef } from "react";
import RiderAvatar from "./RiderAvatar";
import { RIDER_SKILLS } from "./SquadRider";
import { countryLabel } from "../../lib/riders/identity.mjs";

const descriptions = {
  sprint: "Explosive finishing ability.", flat: "Ability on flat roads.", hills: "Ability on short climbs and rolling roads.",
  mountain: "Climbing ability on mountain roads.", cobbles: "Ability on cobbled roads.", timetrial: "Time-trial ability.",
  endurance: "Capacity for sustained effort.", strength: "Physical strength.", wind: "Ability in windy conditions.",
  form: "Current racing condition. Higher is better.", fatigue: "Accumulated fatigue. Lower is better.",
};
const display = value => value == null || !Number.isFinite(Number(value)) ? "—" : Number(value).toLocaleString("en-GB");
export default function RiderDossier({ riders, onClose }) {
  const ref = useRef(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => { const dialog = ref.current, opener = document.activeElement; dialog.showModal(); return () => { dialog.close(); if (opener?.isConnected) opener.focus(); }; }, []);
  const comparing = riders.length > 1;
  return <dialog ref={ref} className="studio-dialog" aria-labelledby="dossier-title" onCancel={e => { e.preventDefault(); close.current(); }}>
    <header className="studio-dialog-heading"><div><p className="identity-eyebrow">THE PEOPLE BEHIND THE TEAM</p><h2 id="dossier-title">{comparing ? "Compare riders" : "Rider profile"}</h2></div><button className="btn" onClick={onClose}>Close</button></header>
    <div className="studio-dossier-cast" style={{ "--rider-count": riders.length }}>{riders.map(r => <article key={r.id}>
      <RiderAvatar rider={r} size={220}/><h3>{r.display_name || r.name}</h3><p>{countryLabel(r.country_code || r.nationality)} · {r.age ? `${r.age} years` : "Age unknown"}</p><p>{r.gender === "F" ? "Women’s squad" : "Men’s squad"} · {display(r.rating)} race points</p>
    </article>)}</div>
    <p className="studio-caption">Current attributes · 0–100 scale · Higher is better, except fatigue. Missing values are shown as —.</p>
    <div className="studio-table-wrap" tabIndex={0} role="region" aria-label="Rider attribute comparison"><table className="studio-table"><thead><tr><th>Attribute</th>{riders.map(r => <th key={r.id}>{r.display_name || r.name}</th>)}</tr></thead><tbody>{RIDER_SKILLS.map(([key, label]) => <tr key={key}><th>{label}<small>{descriptions[key]}</small></th>{riders.map(r => <td key={r.id}><strong>{display(r[key])}</strong>{r[key] != null && <meter aria-label={`${r.display_name || r.name}: ${label}`} min="0" max="100" value={Number(r[key]) || 0}/>}</td>)}</tr>)}</tbody></table></div>
    <p className="studio-caption">These are the current rider records, not predictions of a race result. No hidden potential is shown.</p>
  </dialog>;
}
