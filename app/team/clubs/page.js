"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TeamShell from "../../components/TeamShell";
import ClubBadge from "../../components/ClubBadge";
import { api } from "../../../lib/api";
import "./clubs.css";

export default function ClubsPage() {
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
      api("/api/clubs?" + params, { signal: controller.signal })
        .then(data => {
          if (controller.signal.aborted) return;
          if (!data.clubs.length && page > 1) setPage(page - 1);
          else setResult({ key, data });
        })
        .catch(error => { if (!controller.signal.aborted) setResult({ key, error: error.message }); });
    }, query ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, query, page]);

  async function toggleFavorite(club) {
    setSaving(club.id);
    setSaveError("");
    try {
      await api("/api/clubs", {
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
  return <TeamShell title="Clubs">
    <section className="club-front-panel club-bookmarks">
      <label className="club-search">Find a club
        <input type="search" value={input} maxLength={100} placeholder="Search by club name"
          onChange={event => { setInput(event.target.value); setPage(1); }} />
      </label>
      <h2>{query ? "Search results" : "Favorite clubs"}</h2>
      {!data && <p role="status">{error || (query ? "Searching…" : "Loading favorites…")}</p>}
      {saveError && <p role="alert">{saveError}</p>}
      {data?.clubs.length === 0 && <p>{query ? "No clubs match your search." : "Search for a club and select the star to add it here."}</p>}
      {data?.clubs.length > 0 && <ul className="club-bookmark-grid">{data.clubs.map(club => <li key={club.id}>
        <Link href={"/team/clubs/" + club.id}>
          <ClubBadge name={club.name || "Pelotonia"} clubKit={club.kit} decorative />
          <strong>{club.name}</strong>
        </Link>
        <button className="club-favorite-toggle" type="button" aria-label={"Favorite " + club.name}
          aria-pressed={club.favorite} disabled={saving !== null} onClick={() => toggleFavorite(club)}>
          <span aria-hidden="true">{club.favorite ? "★" : "☆"}</span>
        </button>
      </li>)}</ul>}
      {page > 1 && <button className="btn" onClick={() => setPage(page - 1)}>Previous</button>}{" "}
      {data?.hasNext && <button className="btn" onClick={() => setPage(page + 1)}>Next</button>}
    </section>
  </TeamShell>;
}
