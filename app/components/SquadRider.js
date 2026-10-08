import RiderAvatar from "./RiderAvatar";
import { countryLabel } from "../../lib/riders/identity.mjs";
export const RIDER_SKILLS = [["sprint", "Sprint"], ["flat", "Flat roads"], ["hills", "Hills"], ["mountain", "Mountains"], ["cobbles", "Cobbles"], ["timetrial", "Time trial"], ["endurance", "Endurance"], ["strength", "Strength"], ["wind", "Wind"], ["form", "Form"], ["fatigue", "Fatigue"]];
const specialties = [["sprint", "Sprinter"], ["mountain", "Climber"], ["hills", "Puncheur"], ["cobbles", "Classics rider"], ["timetrial", "Time triallist"]];
const number = value => value == null || !Number.isFinite(Number(value)) ? "—" : Number(value).toLocaleString("en-GB");
export default function SquadRider({ rider, onProfile, onCompare, selected = false, compareFull = false }) {
  const strengths = RIDER_SKILLS.slice(0, 9).filter(([key]) => rider[key] != null).sort(([a], [b]) => Number(rider[b]) - Number(rider[a])).slice(0, 3);
  const specialty = specialties.filter(([key]) => rider[key] != null).sort(([a], [b]) => Number(rider[b]) - Number(rider[a]))[0]?.[1] || "Rider";
  return <article className="club-rider">
    <div className="club-rider-art"><span className="club-rider-specialty" title="Based on current riding skills">{specialty}</span><RiderAvatar rider={rider} size={240} /><span className="club-rider-country">{countryLabel(rider.country_code || rider.nationality)}</span></div>
    <div className="club-rider-body"><div className="club-rider-meta">{rider.age ? `${rider.age} years` : "Age unknown"} <span>· {rider.gender === "F" ? "Women’s squad" : "Men’s squad"}</span></div><h3>{rider.display_name || rider.name || "Unnamed rider"}</h3>
      <div className="club-rider-strengths" aria-label="Strongest attributes">{strengths.map(([key, label]) => <div key={key}><span>{label}</span><strong>{number(rider[key])}</strong></div>)}</div>
      <div className="club-rider-condition"><span>Form <strong>{number(rider.form)}</strong></span><span>Fatigue <strong>{number(rider.fatigue)}</strong></span></div>
      <div className="club-rider-points"><strong>{number(rider.rating)}</strong><span>race points</span></div>
      {onProfile && <div className="studio-rider-actions"><button className="btn" onClick={()=>onProfile(rider)} aria-label={`View profile of ${rider.display_name || rider.name}`}>Rider profile ↗</button><button className="btn" aria-label={`Compare ${rider.display_name || rider.name}`} aria-pressed={selected} disabled={!selected && compareFull} onClick={()=>onCompare(rider.id)}>{selected?'Selected ✓':'Compare +'}</button></div>}
      <details><summary>View attributes</summary><dl>{RIDER_SKILLS.map(([key, label]) => <div className="club-skill" key={key}><dt>{label}</dt><dd>{number(rider[key])}</dd></div>)}</dl></details>
    </div>
  </article>;
}
