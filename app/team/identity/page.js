"use client";
import { useState } from "react";
import Link from "next/link";
import TeamShell from "../../components/TeamShell";
import { useAuth } from "../../components/AuthProvider";
import { CLUB_PALETTES, Jersey, useClubStyle } from "../../components/ClubStyle";
function Editor({ team }) {
  const { kit, save } = useClubStyle();
  const [draft, setDraft] = useState(null), [status, setStatus] = useState("");
  const current = draft || kit;
  return <div className="studio-kit-layout"><section className="studio-kit-display"><p className="identity-eyebrow">THE COLOURS WE RIDE FOR</p><h2>{team.name}</h2><Jersey kit={current}/><p>{CLUB_PALETTES[current.palette].name}</p></section><section className="studio-panel"><h2>Make it yours.</h2><p>Explore your club colours and a jersey for both squads.</p><fieldset><legend>Colour palette</legend><div className="studio-palette-options">{Object.entries(CLUB_PALETTES).map(([id, colors]) => <button key={id} aria-pressed={current.palette === id} onClick={() => { setDraft({ ...current, palette: id }); setStatus(""); }}><span style={{ background: colors.primary }}/><span style={{ background: colors.accent }}/>{colors.name}</button>)}</div></fieldset><label className="studio-field">Jersey pattern<select value={current.pattern} onChange={e => { setDraft({ ...current, pattern: e.target.value }); setStatus(""); }}><option value="band">Chest band</option><option value="diagonal">Diagonal sash</option><option value="plain">Classic plain</option></select></label><button className="btn primary" onClick={() => setStatus(save(current) ? "Preview saved in this browser for this team." : "Could not save. Browser storage may be unavailable.")}>Save local preview</button><button className="btn" onClick={() => { setDraft(null); setStatus("Showing your last saved preview."); }}>Discard changes</button><p role="status">{status}</p><aside className="studio-note">Design preview only. Saved on this browser, not your account or other devices. Colours appear on illustrated squad portraits; painted portraits keep their original jersey. No purchase or sporting effect.</aside><Link href="/team">Back to my team →</Link></section></div>;
}
export default function TeamIdentity() {
  const { session } = useAuth();
  return <TeamShell title="Club identity">{session?.team && <Editor key={session.team.id} team={session.team}/>}</TeamShell>;
}
