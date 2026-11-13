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

function useClubOverview(teamId) {
  const [club, setClub] = useState(null);
  const [rankings, setRankings] = useState({});

  useEffect(() => {
    if (!teamId) return;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    api("/api/clubs/" + encodeURIComponent(teamId), options)
      .then(data => { if (!controller.signal.aborted) setClub(data); })
      .catch(() => { if (!controller.signal.aborted) setClub({ error: true }); });

    for (const [gender] of categories) {
      api("/api/leaderboards?gender=" + gender, options)
        .then(data => {
          if (controller.signal.aborted) return;
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

  return { club, rankings };
}

function TrophyCabinet({ club, clubUrl }) {
  const trophies = club?.trophies?.slice(0, 3) ?? [];
  return <section className="my-team-cabinet" aria-labelledby="my-team-trophies">
    <h2 id="my-team-trophies">Trophy cabinet</h2>
    {trophies.length ? <ul>{trophies.map(trophy => <li key={trophy.eventId + ":" + trophy.division}>
      <span aria-hidden="true">🏆</span>
      <Link href={`/team/results/${trophy.eventId}?division=${trophy.division}`}>{trophy.name}</Link>
    </li>)}</ul> : <p>{!club ? "Loading trophies…" : club.error ? "Trophies are unavailable." : "No trophies yet."}</p>}
    <Link href={clubUrl}>View club honours <span aria-hidden="true">→</span></Link>
  </section>;
}

function ClubOverview({ club, rankings, clubUrl }) {
  const release = club?.press?.[0];
  return <div className="club-front-columns">
    <section className="club-front-panel">
      <h2>Latest press release</h2>
      {release ? <article className="club-front-release">
        <time dateTime={release.published_at}>{new Date(release.published_at).toLocaleDateString("en-GB")}</time>
        <h3>{release.title}</h3>
        <p>{release.body}</p>
      </article> : <p>{!club ? "Loading press release…" : !club.pressAvailable ? "Press releases are unavailable." : "No press releases yet."}</p>}
      <Link href={clubUrl}>View club page</Link>
    </section>
    <section className="club-front-panel">
      <h2>Rankings</h2>
      <dl className="my-team-rankings">{categories.map(([gender, label]) => <div key={gender}>
        <dt>{label}</dt><dd className={rankings[gender]?.startsWith("#") ? "my-team-rank-place" : undefined}>{rankings[gender] ?? "Loading…"}</dd>
      </div>)}</dl>
      <Link href="/team/leaderboards">View rankings</Link>
    </section>
  </div>;
}

export default function TeamPage() {
  const { session, logout } = useAuth();
  const { kit } = useClubStyle();
  const team = session?.team;
  return team ? <TeamHome key={team.id} team={team} kit={kit} logout={logout} /> : null;
}

function TeamHome({ team, kit, logout }) {
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const { club, rankings } = useClubOverview(team.id);
  const clubUrl = "/team/clubs/" + encodeURIComponent(team.id);
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
      <header className="club-front-header my-team-banner" style={{ "--club-primary": colors.primary, "--club-accent": colors.accent }}>
        <div className="my-team-identity">
          <ClubBadge name={team.name} decorative />
          <h1>{team.name}</h1>
          <div className="club-actions">
            <Link className="btn" href="/team/settings#team-name">Change team name</Link>
            <button className="btn" disabled={signingOut} onClick={signOut}>Sign out</button>
          </div>
        </div>
        <TrophyCabinet club={club} clubUrl={clubUrl} />
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
      <ClubOverview club={club} rankings={rankings} clubUrl={clubUrl} />
    </main>
  </TeamShell>;
}
