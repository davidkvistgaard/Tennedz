"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { RequireTeam } from "../components/AuthProvider";

function AdminStatus() {
  const [status, setStatus] = useState("Kontrollerer administratoradgang…");
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    let active = true;
    api("/api/admin/stats").then(data => {
      if (active) { setCounts(data); setStatus("Administratoradgang bekræftet."); }
    }).catch(error => { if (active) setStatus(error.message); });
    return () => { active = false; };
  }, []);
  return <section className="card" style={{ padding: 24 }}>
    <h1>Administration</h1>
    <p role="status">{status}</p>
    {counts && <p>Hold: {counts.teams} · Ryttere: {counts.riders} · Løbsresultater: {counts.race_results}</p>}
    <p>Løbsafvikling, ændring af spilledato og nulstilling er lukket under genopretningen.</p>
    <a href="/team">Tilbage til mit hold</a>
  </section>;
}
export default function AdminPage() { return <RequireTeam><AdminStatus /></RequireTeam>; }
