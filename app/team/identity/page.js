"use client";
import { useState } from "react";
import Link from "next/link";
import TeamShell from "../../components/TeamShell";
import { useAuth } from "../../components/AuthProvider";
import { CLUB_PALETTES, Jersey, useClubStyle } from "../../components/ClubStyle";
import { KIT_PATTERNS } from "../../../lib/riders/club-kit.mjs";
import SupporterKitStudio from "../../components/SupporterKitStudio";
function Editor({ team }) {
  const { kit, choices, save } = useClubStyle();
  const [draft, setDraft] = useState(null), [status, setStatus] = useState("");
  const current = draft || kit;
  return <div className="studio-kit-layout"><section className="studio-kit-display"><p className="identity-eyebrow">THE COLOURS WE RIDE FOR</p><h2>{team.name}</h2><Jersey kit={current}/><p>{CLUB_PALETTES[current.palette].name}</p></section><section className="studio-panel"><h2>Make it yours.</h2><p>Your standard team receives four palettes and three patterns, drawn from 50 palettes and 25 patterns. Your selection stays the same when you reload.</p><fieldset><legend>Colour palette</legend><div className="studio-palette-options">{choices.palettes.map(id => { const colors=CLUB_PALETTES[id]; return <button key={id} aria-pressed={current.palette === id} onClick={() => { setDraft({ ...current, palette: id }); setStatus(""); }}><span style={{ background: colors.primary }}/><span style={{ background: colors.accent }}/>{colors.name}</button>; })}</div></fieldset><label className="studio-field">Jersey pattern<select value={current.pattern} onChange={e => { setDraft({ ...current, pattern: e.target.value }); setStatus(""); }}>{choices.patterns.map(id=><option key={id} value={id}>{KIT_PATTERNS[id].name}</option>)}</select></label><button className="btn primary" onClick={() => setStatus(save(current) ? "Preview saved in this browser for this team." : "Could not save. Browser storage may be unavailable.")}>Save local preview</button><button className="btn" onClick={() => { setDraft(null); setStatus("Showing your last saved preview."); }}>Discard changes</button><p role="status">{status}</p><aside className="studio-note">Design preview only. Saved on this browser, not your account or other devices. Colours appear on illustrated squad portraits; painted portraits keep their original jersey. No purchase or sporting effect.</aside><SupporterKitStudio teamId={team.id}/><Link href="/team">Back to my team →</Link></section></div>;
}
export default function TeamIdentity() {
  const { session } = useAuth();
  return <TeamShell title="Club identity">{session?.team && <Editor key={session.team.id} team={session.team}/>}</TeamShell>;
}
