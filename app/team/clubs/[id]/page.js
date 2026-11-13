"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import TeamShell from "../../../components/TeamShell";
import ClubBadge from "../../../components/ClubBadge";
import RiderAvatar from "../../../components/RiderAvatar";
import { CLUB_PALETTES, Jersey } from "../../../components/ClubStyle";
import { api } from "../../../../lib/api";
import "../clubs.css";

function PressRoom({ data, endpoint, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function publish(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const { release } = await api(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: fields.get("title"), body: fields.get("body") }),
      });
      onChange([release, ...data.press].slice(0, 20));
      form.reset();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Remove this press release?")) return;
    setBusy(true);
    setError("");
    try {
      await api(endpoint + "?release=" + encodeURIComponent(id), { method: "DELETE" });
      const refreshed = await api(endpoint);
      onChange(refreshed.press);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="club-front-panel">
    <h2>Press releases</h2>
    {!data.pressAvailable && <p>Press releases are temporarily unavailable.</p>}
    {data.pressAvailable && !data.press.length && <p>No press releases yet.</p>}
    {data.press.map(release => <article className="club-front-release" key={release.id}>
      <time dateTime={release.published_at}>{new Date(release.published_at).toLocaleDateString("en-GB")}</time>
      <h3>{release.title}</h3><p>{release.body}</p>
      {data.isOwner && <button type="button" className="btn" disabled={busy} onClick={() => remove(release.id)}>Remove</button>}
    </article>)}
    {data.isOwner && data.pressAvailable && <form className="club-front-form" onSubmit={publish}>
      <label>Title<input name="title" required maxLength={100} /></label>
      <label>Press release<textarea name="body" required maxLength={2000} rows={5} /></label>
      <button className="btn primary" disabled={busy}>Publish release</button>
    </form>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

export default function ClubPage({ params }) {
  const { id } = use(params);
  const endpoint = "/api/clubs/" + encodeURIComponent(id);
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    api(endpoint, { signal: controller.signal })
      .then(data => setResult({ id, data }))
      .catch(error => { if (!controller.signal.aborted) setResult({ id, error: error.message }); });
    return () => controller.abort();
  }, [id, endpoint]);
  const { data, error } = result?.id === id ? result : {};
  if (!data) return <TeamShell title="Club"><p role="status">{error || "Loading club…"}</p><Link href="/team/clubs">All clubs</Link></TeamShell>;
  const { club, kit, riders, trophies } = data;
  const colors = CLUB_PALETTES[kit.palette];
  return <TeamShell compact>
    <main className="club-front">
      <Link href="/team/clubs">← All clubs</Link>
      <header className="club-front-header" style={{ "--club-primary": colors.primary, "--club-accent": colors.accent }}>
        <ClubBadge name={club.name} clubKit={kit} decorative />
        <div><h1>{club.name}</h1><p>{colors.name}</p></div>
        <Jersey kit={kit} name={club.name + " jersey"} />
      </header>
      <div className="club-front-columns">
        <div>
          <PressRoom key={id} data={data} endpoint={endpoint} onChange={press => setResult(current => ({ ...current, data: { ...current.data, press } }))} />
          <section className="club-front-panel">
            <h2>Riders</h2>
            {[["M", "Men’s squad"], ["F", "Women’s squad"]].map(([gender, title]) => {
              const squad = riders.filter(rider => rider.gender === gender);
              return <div key={gender}><h3>{title}</h3>{squad.length ? <ul className="club-front-roster">{squad.map(rider => <li key={rider.id}>
                <RiderAvatar rider={rider} size={100} clubKit={kit} />
                <strong>{rider.display_name || rider.name}</strong>
              </li>)}</ul> : <p>No riders yet.</p>}</div>;
            })}
          </section>
        </div>
        <section className="club-front-panel club-front-trophies">
          <h2>Trophy cabinet</h2>
          {trophies.length ? <ul>{trophies.map(trophy => <li key={trophy.eventId + ":" + trophy.division}>
            <Link href={"/team/results/" + trophy.eventId + "?division=" + trophy.division}>{trophy.name}</Link>
            <small>{trophy.gender === "F" ? "Women" : "Men"} · Division {trophy.division} winner</small>
          </li>)}</ul> : <p>No team wins yet.</p>}
        </section>
      </div>
    </main>
  </TeamShell>;
}
