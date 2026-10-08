"use client";
import { useState } from 'react';
import TeamShell from '../../components/TeamShell';
import SquadRider from '../../components/SquadRider';
import { useAuth } from '../../components/AuthProvider';
import '../../identity.css';
export default function PortraitsPage() {
  const { session } = useAuth(), [gender, setGender] = useState('M');
  const riders = (session?.riders || []).filter(r => r.gender === gender);
  return <TeamShell title="Meet your team">
    <p className="page-intro">The faces behind the results. Get to know their strengths, their form, and the riders you can build a race around.</p>
    <div className="club-toolbar"><div className="club-genders" role="group" aria-label="Rider category">{[['M', 'Men'], ['F', 'Women']].map(([value, label]) => <button key={value} aria-pressed={gender === value} onClick={() => setGender(value)}>{label}</button>)}</div></div>
    <div className="club-roster">{riders.map(rider => <SquadRider key={rider.id} rider={rider} />)}</div>
    {!riders.length && <p className="club-empty">Your team has no riders in this category yet.</p>}
    <p className="identity-note">Appearance is personal. It gives no advantage on the road. Rider specialties reflect their current skills.</p>
  </TeamShell>;
}
