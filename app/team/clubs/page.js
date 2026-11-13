"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TeamShell from "../../components/TeamShell";
import { api } from "../../../lib/api";
import "./clubs.css";

export default function ClubsPage() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    api("/api/clubs?page=" + page, { signal: controller.signal })
      .then(data => setResult({ page, data }))
      .catch(error => { if (!controller.signal.aborted) setResult({ page, error: error.message }); });
    return () => controller.abort();
  }, [page]);
  const { data, error } = result?.page === page ? result : {};
  return <TeamShell title="Clubs">
    <section className="club-front-panel">
      {!data && <p role="status">{error || "Loading clubs…"}</p>}
      {data && <ul className="club-directory-list">{data.clubs.map(club => <li key={club.id}>
        <Link href={"/team/clubs/" + club.id}>{club.name}<span aria-hidden="true">→</span></Link>
      </li>)}</ul>}
      {page > 1 && <button className="btn" onClick={() => setPage(page - 1)}>Previous clubs</button>}{" "}
      {data?.hasNext && <button className="btn" onClick={() => setPage(page + 1)}>More clubs</button>}
    </section>
  </TeamShell>;
}
