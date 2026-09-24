"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { RequireTeam } from "../components/AuthProvider";
import TeamShell from "../components/TeamShell";
import RaceCalendarAdmin from "../components/RaceCalendarAdmin";

function AdminStatus() {
  const [status, setStatus] = useState("Checking administrator access…");
  const [counts, setCounts] = useState(null);
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  async function loadEvents() {
    const result = await api("/api/events?limit=50");
    setEvents(result.events);
  }
  async function runEvent(id) {
    setBusy(true);
    setStatus("Running the race…");
    try {
      const result = await api("/api/admin/run-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(65000),
        body: JSON.stringify({ event_id: id }),
      });
      setStatus(
        result.already_finished
          ? "This race was already finished. No extra points were awarded."
          : "The race is finished. Results and points have been saved.",
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
          setStatus("Administrator access confirmed.");
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
            Team: {counts.teams} · Riders: {counts.riders} · Race results:{" "}
            {counts.race_results}
          </p>
        )}
        <p>
          {counts?.game_writes_enabled
            ? "One-day races can run after the deadline. Results are saved only once."
            : "Race processing is disabled in this environment."}{" "}
          Game date changes and resets remain disabled.
        </p>
        {counts && (
          <RaceCalendarAdmin
            enabled={counts.game_writes_enabled}
            onCreated={loadEvents}
          />
        )}
        <h2 style={{ marginTop: 30 }}>Race processing</h2>
        {counts &&
          events
            .filter((e) => e.kind === "one_day")
            .map((e) => (
              <div key={e.id} style={{ marginBottom: 16 }}>
                <strong>{e.name}</strong> · {e.status} ·{" "}
                {new Date(e.deadline).toLocaleString("en-GB", { timeZone: "UTC", timeZoneName: "short" })}{" "}
                <button
                  disabled={
                    busy ||
                    !counts.game_writes_enabled ||
                    new Date(e.deadline) > new Date()
                  }
                  onClick={() => runEvent(e.id)}
                >
                  {e.status === "FINISHED"
                    ? "Check finished race"
                    : "Run race"}
                </button>{" "}
                <a href={`/team/results/${e.id}`}>Result</a>
              </div>
            ))}
        <a href="/team">Back to my team</a>
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
