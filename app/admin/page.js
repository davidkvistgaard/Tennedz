"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { RequireTeam } from "../components/AuthProvider";
import TeamShell from "../components/TeamShell";
import RaceCalendarAdmin from "../components/RaceCalendarAdmin";

function AdminStatus() {
  const [status, setStatus] = useState("Kontrollerer administratoradgang…");
  const [counts, setCounts] = useState(null);
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  async function loadEvents() {
    const result = await api("/api/events?limit=50");
    setEvents(result.events);
  }
  async function runEvent(id) {
    setBusy(true);
    setStatus("Afvikler løbet…");
    try {
      const result = await api("/api/admin/run-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(65000),
        body: JSON.stringify({ event_id: id }),
      });
      setStatus(
        result.already_finished
          ? "Løbet var allerede afsluttet. Ingen ekstra point tildelt."
          : "Løbet er afsluttet. Resultater og point er gemt.",
      );
      await loadEvents();
    } catch (e) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    api("/api/admin/stats")
      .then((data) => {
        if (active) {
          setCounts(data);
          setStatus("Administratoradgang bekræftet.");
          loadEvents().catch((e) => setStatus(e.message));
        }
      })
      .catch((error) => {
        if (active) setStatus(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <TeamShell title="Administration">
      <section className="card" style={{ padding: 24 }}>
        <p role="status">{status}</p>
        {counts && (
          <p>
            Hold: {counts.teams} · Ryttere: {counts.riders} · Løbsresultater:{" "}
            {counts.race_results}
          </p>
        )}
        <p>
          {counts?.game_writes_enabled
            ? "Endagsløb kan afvikles efter deadline. Resultater gemmes kun én gang."
            : "Løbsafvikling er lukket i dette miljø."}{" "}
          Spilledato og nulstilling er fortsat lukket.
        </p>
        {counts && (
          <RaceCalendarAdmin
            enabled={counts.game_writes_enabled}
            onCreated={loadEvents}
          />
        )}
        <h2 style={{ marginTop: 30 }}>Afvikling af løb</h2>
        {counts &&
          events
            .filter((e) => e.kind === "one_day")
            .map((e) => (
              <div key={e.id} style={{ marginBottom: 16 }}>
                <strong>{e.name}</strong> · {e.status} ·{" "}
                {new Date(e.deadline).toLocaleString("da-DK")}{" "}
                <button
                  disabled={
                    busy ||
                    !counts.game_writes_enabled ||
                    new Date(e.deadline) > new Date()
                  }
                  onClick={() => runEvent(e.id)}
                >
                  {e.status === "FINISHED"
                    ? "Kontroller afsluttet løb"
                    : "Afvikl løb"}
                </button>{" "}
                <a href={`/team/results/${e.id}`}>Resultat</a>
              </div>
            ))}
        <a href="/team">Tilbage til mit hold</a>
      </section>
    </TeamShell>
  );
}
export default function AdminPage() {
  return (
    <RequireTeam>
      <AdminStatus />
    </RequireTeam>
  );
}
