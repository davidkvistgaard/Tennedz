"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TeamShell from "../components/TeamShell";
import ClubBadge from "../components/ClubBadge";
import { CLUB_PALETTES, useClubStyle } from "../components/ClubStyle";
import { useAuth } from "../components/AuthProvider";
import { api } from "../../lib/api";
import "../identity.css";
import "./clubs/clubs.css";

const categories = [["M", "Men"], ["F", "Women"]];

function ClubOverview({ teamId }) {
  const [press, setPress] = useState(null);
  const [rankings, setRankings] = useState({});
  const clubUrl = "/team/clubs/" + encodeURIComponent(teamId);

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    api("/api/clubs/" + encodeURIComponent(teamId), options)
      .then(data => setPress(data.pressAvailable ? { release: data.press[0] } : { error: true }))
      .catch(() => { if (!controller.signal.aborted) setPress({ error: true }); });

    for (const [gender] of categories) {
      api("/api/leaderboards?gender=" + gender, options)
        .then(data => {
          const index = data.teams.findIndex(team => team.id === teamId);
          setRankings(current => ({ ...current, [gender]: index < 0 ? "Unranked" : "#" + (index + 1) }));
        })
        .catch(error => {
          if (!controller.signal.aborted) {
            const label = error.code === "RANKING_PENDING" ? "Pending race finish" : "Unavailable";
            setRankings(current => ({ ...current, [gender]: label }));
          }
        });
    }
    return () => controller.abort();
  }, [teamId]);

  return <div className="club-front-columns">
    <section className="club-front-panel">
      <h2>Latest press release</h2>
      {press?.release ? <article className="club-front-release">
        <time dateTime={press.release.published_at}>{new Date(press.release.published_at).toLocaleDateString("en-GB")}</time>
        <h3>{press.release.title}</h3>
        <p>{press.release.body}</p>
      </article> : <p>{!press ? "Loading press release…" : press.error ? "Press releases are unavailable." : "No press releases yet."}</p>}
      <Link href={clubUrl}>View club page</Link>
    </section>
    <section className="club-front-panel">
      <h2>Rankings</h2>
      <dl>{categories.map(([gender, label]) => <div key={gender}>
        <dt>{label}</dt><dd>{rankings[gender] ?? "Loading…"}</dd>
      </div>)}</dl>
      <Link href="/team/leaderboards">View rankings</Link>
    </section>
  </div>;
}

export default function TeamPage() {
  const { session, logout } = useAuth();
  const { kit } = useClubStyle();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const team = session?.team;
  if (!team) return null;
  const colors = CLUB_PALETTES[kit.palette];

  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      await logout();
    } catch {
      setError("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return <TeamShell compact>
    <main className="club-front">
      <header className="club-front-header" style={{ "--club-primary": colors.primary, "--club-accent": colors.accent }}>
        <ClubBadge name={team.name} decorative />
        <h1>{team.name}</h1>
        <div className="club-actions" style={{ gridColumn: "2 / -1", justifyContent: "flex-start" }}>
          <Link className="btn" href="/team/settings#team-name">Change team name</Link>
          <button className="btn" disabled={signingOut} onClick={signOut}>Sign out</button>
        </div>
      </header>
      {error && <p role="alert">{error}</p>}
      <nav className="club-front-panel" aria-label="Team shortcuts">
        <ul style={{ display: "flex", flexWrap: "wrap", gap: ".75rem", listStyle: "none", margin: 0, padding: 0 }}>
          {[
            ["/team/portraits", "Riders"],
            ["/team/economy", "Economy"],
            ["/team/calendar", "Calendar & races"],
            ["/team/clubs/" + encodeURIComponent(team.id), "My Club"],
            ["/team/marketplace", "Marketplace"],
            ["/team/leaderboards", "Rankings"],
          ].map(([href, label]) => <li key={href}><Link className="btn" href={href}>{label}</Link></li>)}
        </ul>
      </nav>
      <ClubOverview key={team.id} teamId={team.id} />
    </main>
  </TeamShell>;
}
