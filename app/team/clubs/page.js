"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TeamShell from "../../components/TeamShell";
import ClubBadge from "../../components/ClubBadge";
import { api } from "../../../lib/api";
import "./clubs.css";

function DirectoryColumn({ kind }) {
  const plural = kind + "s";
  const endpoint = kind === "club" ? "/api/clubs" : "/api/directory/" + kind;
  const [input, setInput] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(null);
  const [saveError, setSaveError] = useState("");
  const query = input.trim();
  const key = JSON.stringify([query, page, version]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query, page });
      api(endpoint + "?" + params, { signal: controller.signal })
        .then(data => {
          if (controller.signal.aborted) return;
          const entries = data.entries ?? data.clubs;
          if (!entries.length && page > 1) setPage(page - 1);
          else setResult({ key, data: { entries, hasNext: data.hasNext } });
        })
        .catch(error => { if (!controller.signal.aborted) setResult({ key, error: error.message }); });
    }, query ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [endpoint, key, query, page]);

  async function toggleFavorite(club) {
    setSaving(club.id);
    setSaveError("");
    try {
      await api(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: club.id, favorite: !club.favorite }),
      });
      setVersion(current => current + 1);
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setSaving(null);
    }
  }

  const { data, error } = result?.key === key ? result : {};
  return <section className="club-front-panel club-bookmarks">
      <label className="club-search">Find a {kind}
        <input type="search" value={input} maxLength={100} placeholder={"Search by " + kind + " name"}
          onChange={event => { setInput(event.target.value); setPage(1); }} />
      </label>
      <h2>{query ? "Search results" : "Favorite " + plural}</h2>
      {!data && <p role="status">{error || (query ? "Searching…" : "Loading favorites…")}</p>}
      {saveError && <p role="alert">{saveError}</p>}
      {data?.entries.length === 0 && <p>{query ? "No " + plural + " match your search." : "Search for a " + kind + " and select the star to add it here."}</p>}
      {data?.entries.length > 0 && <ul className="club-bookmark-grid">{data.entries.map(club => <li key={club.id}>
        <DirectoryEntry entry={club} kind={kind} />
        <button className="club-favorite-toggle" type="button" aria-label={"Favorite " + club.name}
          aria-pressed={club.favorite} disabled={saving !== null} onClick={() => toggleFavorite(club)}>
          <span aria-hidden="true">{club.favorite ? "★" : "☆"}</span>
        </button>
      </li>)}</ul>}
      {page > 1 && <button className="btn" onClick={() => setPage(page - 1)}>Previous</button>}{" "}
      {data?.hasNext && <button className="btn" onClick={() => setPage(page + 1)}>Next</button>}
  </section>;
}

function DirectoryEntry({ entry, kind }) {
  const clubId = kind === "club" ? entry.id : entry.club_id;
  const content = <>
    {kind === "club" && <ClubBadge name={entry.name || "Pelotonia"} clubKit={entry.kit} decorative />}
    <span><strong>{entry.name}</strong>{entry.club_name && <small>{entry.club_name}</small>}</span>
  </>;
  if (!clubId) return <div className="club-directory-entry">{content}</div>;
  const anchor = kind === "rider" ? "#rider-" + entry.id : "";
  return <Link href={"/team/clubs/" + clubId + anchor}>{content}</Link>;
}

export default function ClubsPage() {
  return <TeamShell title="Search">
    <div className="club-directory-columns">
      <DirectoryColumn kind="club" />
      <DirectoryColumn kind="manager" />
      <DirectoryColumn kind="rider" />
    </div>
  </TeamShell>;
}
