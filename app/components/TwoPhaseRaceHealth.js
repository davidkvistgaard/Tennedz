"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const labels = {
  REVEALED: "Divisions revealed",
  OVERDUE: "Division reveal overdue — administrator review required",
  BLOCKED: "Registration closed; entry scan incomplete — administrator review required",
  AWAITING_REVEAL: "Entry scan complete; awaiting division reveal",
  SCAN_COMPLETE: "Entry scan complete; registration open",
  SCANNING: "Registration open; entry scan pending",
};

function dateLabel(value) {
  return new Date(value).toLocaleString("en-GB", { timeZone: "UTC", timeZoneName: "short" });
}

export default function TwoPhaseRaceHealth({ onCancelled }) {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiding, setVoiding] = useState(null);
  const [notice, setNotice] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setHealth(await api("/api/admin/autopilot/health"));
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }

  async function cancelRace(race) {
    if (!window.confirm(`Cancel ${race.name} as no contest? Existing entries remain recorded, but this race will have no results or points. Create a replacement race separately.`)) return;
    setVoiding(race.event_id);
    setError("");
    try {
      await api("/api/admin/autopilot/void", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: race.event_id }),
      });
      setNotice(`${race.name} was cancelled as no contest. Create a replacement race with new deadlines if needed.`);
      await refresh();
      await onCancelled?.();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setVoiding(null);
    }
  }

  useEffect(() => { refresh(); }, []);
  if (health && !health.enabled) return null;
  return (
    <section aria-label="Two-phase race health" style={{ marginTop: 30 }}>
      <h2>Two-phase race health</h2>
      <p>Review registration, the entry scan and division reveal. A missed scan can be cancelled as no contest; any replacement is a separate race with new deadlines.</p>
      <button type="button" onClick={refresh} disabled={loading}>
        {loading ? "Checking…" : "Refresh race health"}
      </button>
      {error && <p role="alert">Race health unavailable: {error}</p>}
      {notice && <p role="status">{notice}</p>}
      {health?.enabled && health.races.length === 0 && <p>No two-phase races are approaching registration close or awaiting reveal.</p>}
      {health?.races.map(race => (
        <div key={race.event_id} style={{ marginTop: 16 }}>
          <strong>{race.name}</strong> · {labels[race.state] ?? "Status unavailable"}
          <div>Registration closes {dateLabel(race.registration_deadline)} · Tactics close {dateLabel(race.tactics_deadline)}</div>
          <div>Entry scan: {race.processed} teams checked, {race.entered} entered
            {race.scan_updated_at ? ` · Last updated ${dateLabel(race.scan_updated_at)}` : " · Not started"}
          </div>
          {["BLOCKED", "OVERDUE"].includes(race.state) && <button type="button"
            disabled={voiding !== null} onClick={() => cancelRace(race)}>
            {voiding === race.event_id ? "Cancelling…" : "Cancel as no contest"}
          </button>}
        </div>
      ))}
    </section>
  );
}
