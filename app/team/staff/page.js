"use client";
import { useState } from "react";
import TeamShell from "../../components/TeamShell";

const roles = [
  ["01", "Head coach", "The big picture", "Coordinates training priorities and the work of your specialists."],
  ["02", "Specialist coach", "Find an edge", "Focuses on sprinting, climbing, time trials or riding technique."],
  ["03", "Conditioning coach", "Build the foundation", "Works on strength, endurance and preparation for a peak in form."],
  ["04", "Physiotherapist", "Make recovery count", "Helps manage training load, fatigue and recovery."],
  ["05", "Sports psychologist", "The person behind the rider", "Supports confidence, motivation and handling pressure."],
  ["06", "Youth coach", "Think beyond this season", "Guides the long-term development of younger riders."],
];
const directions = ["Balanced development", "Develop young riders", "Prepare for the classics", "Build a climbing squad", "Prepare a sprint squad", "Recovery focus"];
const initialPlans = () => ({ M: directions[0], F: directions[0] });
export default function StaffPage() {
  const [gender, setGender] = useState("M");
  const [plans, setPlans] = useState(initialPlans);
  const [message, setMessage] = useState("");
  return <TeamShell title="Staff & development">
    <section className="staff-intro"><div><p className="identity-eyebrow">GOOD TEAMS GROW TOGETHER</p><h2>The people behind your people.</h2><p>Build a staff that fits your ambition. Develop riders, prepare their form and give recovery its own place in the plan.</p></div><aside className="studio-note"><strong>Design preview</strong><p>These are planned roles, not hired employees. Try separate squad directions below. Drafts last only while this page stays open; nothing is saved or applied to riders, wages or races.</p></aside></section>
    <section aria-labelledby="staff-roles"><div className="club-roster-title"><h2 id="staff-roles">A complete foundation. Free to play.</h2><p>Every sporting staff role belongs in the base game. Hiring, salaries and staff capacity will arrive with the economy and training systems.</p></div><div className="staff-grid">{roles.map(([number, name, tagline, description]) => <article className="staff-card" key={number}><span className="staff-number" aria-hidden="true">{number}</span><p className="identity-eyebrow">BASE GAME · PLANNED</p><h3>{name}</h3><p className="staff-tagline">{tagline}</p><p>{description}</p><span className="staff-label">Role concept · no staff assigned</span></article>)}</div></section>
    <section className="staff-planner studio-panel" aria-labelledby="staff-plan"><p className="identity-eyebrow">TWO SQUADS. THEIR OWN DIRECTION.</p><h2 id="staff-plan">Try a training direction</h2><p>A simple starting point, with individual training and groups planned for later. Shared staff capacity will need to be allocated between the squads.</p><div className="club-genders" role="group" aria-label="Training squad">{[["M","Men"],["F","Women"]].map(([id,label]) => <button key={id} aria-pressed={gender===id} onClick={()=>{setGender(id);setMessage("");}}>{label}</button>)}</div><label className="studio-field">{gender==="M"?"Men’s":"Women’s"} squad direction<select value={plans[gender]} onChange={event=>{setPlans(current=>({...current,[gender]:event.target.value}));setMessage("Preview updated. No training has been scheduled.");}}>{directions.map(direction=><option key={direction}>{direction}</option>)}</select></label><dl className="staff-plan-summary"><div><dt>Men’s draft</dt><dd>{plans.M}</dd></div><div><dt>Women’s draft</dt><dd>{plans.F}</dd></div></dl><button className="btn" onClick={()=>{setPlans(initialPlans());setMessage("Both preview directions reset.");}}>Reset preview</button><p role="status">{message}</p></section>
    <section className="staff-membership" aria-labelledby="staff-supporter"><div><p className="identity-eyebrow">SUPPORT THE GAME. MAKE IT YOURS.</p><h2 id="staff-supporter">More character. More convenience.</h2><p>Supporter is planned to add personalisation and organisation. It will not buy stronger training, faster recovery or extra sporting staff capacity.</p></div><div className="staff-membership-columns"><article><h3>Included in the free game</h3><ul><li>All sporting staff roles</li><li>Separate plans for both squads</li><li>Individual training focus</li><li>Staff abilities, wages and contracts</li><li>Essential feedback on training effects</li></ul></article><article><span className="staff-label">Supporter · planned</span><h3>A club with your signature</h3><ul><li>Staff portrait and appearance customisation</li><li>Extended history and development charts</li><li>Extra saved plan templates</li><li>Bulk editing and group organisation</li><li>Season stories and club milestones</li></ul><p>No subscription or purchase is available in this preview.</p></article></div></section>
  </TeamShell>;
}
