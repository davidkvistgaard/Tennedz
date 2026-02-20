"use client";

import { useEffect, useState } from "react";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const [gameDate, setGameDate] = useState(null);
  const [counts, setCounts] = useState(null);
  const [events, setEvents] = useState([]);

  async function loadStatus() {
    try {
      const gd = await fetch("/api/game-date").then(r => r.json());
      if (gd?.ok) setGameDate(gd.game_date);

      const st = await fetch("/api/admin/stats").then(r => r.json());
      if (st?.ok) setCounts(st);

      const ev = await fetch("/api/events?limit=25").then(r => r.json());
      if (ev?.ok) setEvents(ev.events ?? []);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function resetAll() {
    setStatus("");
    if (!secret) return setStatus("Skriv ADMIN-koden først.");
    if (confirmText !== "RESET") return setStatus('Skriv "RESET" i bekræftelsefeltet.');

    setBusy(true);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret })
      });

      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}

      if (!res.ok) throw new Error(json?.error ?? text ?? "Ukendt fejl");

      setStatus("✅ " + (json.message || "Reset done"));
      await loadStatus();
    } catch (e) {
      setStatus("❌ " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function tick(weeks) {
    setStatus("");
    if (!secret) return setStatus("Skriv ADMIN-koden først.");

    setBusy(true);
    try {
      const res = await fetch("/api/admin/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, weeks })
      });

      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}

      if (!res.ok) throw new Error(json?.error ?? text ?? "Tick failed");

      setStatus(`✅ Tick ok: ${json.old_game_date} → ${json.new_game_date} (${json.weeks} uge/uger)`);
      await loadStatus();
    } catch (e) {
      setStatus("❌ " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function runEvent(event_id) {
    setStatus("");
    if (!secret) return setStatus("Skriv ADMIN-koden først.");

    setBusy(true);
    try {
      const res = await fetch("/api/admin/run-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, event_id })
      }).then(r => r.json());

      if (!res?.ok) throw new Error(res?.error || "Run failed");

      setStatus(`✅ Event kørt: ${event_id}`);
      await loadStatus();
    } catch (e) {
      setStatus("❌ " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 18, fontFamily: "system-ui, sans-serif", maxWidth: 1000 }}>
      <h1 style={{ marginTop: 0 }}>Admin</h1>

      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 900 }}>Game date</div>
            <div style={{ opacity: 0.85 }}>{gameDate ? gameDate : "…"}</div>
          </div>

          <div>
            <div style={{ fontWeight: 900 }}>Counts</div>
            <div style={{ opacity: 0.85 }}>
              {counts ? `Teams: ${counts.teams} · Riders: ${counts.riders} · Results: ${counts.race_results}` : "…"}
            </div>
          </div>
        </div>

        <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "12px 0" }} />

        <div style={{ fontWeight: 800 }}>Admin-kode</div>
        <input
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="ADMIN_SECRET"
          type="password"
          style={{ marginTop: 8, padding: 10, borderRadius: 10, border: "1px solid #ddd", width: "100%", maxWidth: 420 }}
        />

        <div style={{ marginTop: 16, fontWeight: 900 }}>Weekly tick</div>
        <div style={{ marginTop: 6, opacity: 0.8 }}>
          Avancerer game date og opdaterer riders (form/fatigue/skader/alder-decline). (Game-år = 90 dage)
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => tick(1)}
            disabled={busy}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#111", color: "white" }}
          >
            {busy ? "Arbejder…" : "+1 uge"}
          </button>
          <button
            onClick={() => tick(4)}
            disabled={busy}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#111", color: "white" }}
          >
            {busy ? "Arbejder…" : "+4 uger"}
          </button>
        </div>

        <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "14px 0" }} />

        <div style={{ fontWeight: 900, marginBottom: 8 }}>Events</div>
        <div style={{ opacity: 0.8, marginBottom: 10 }}>Kør event efter deadline (server-side).</div>

        <div style={{ display: "grid", gap: 10 }}>
          {(events || []).map(ev => {
            const locked = new Date(ev.deadline) <= new Date();
            return (
              <div key={ev.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
                <div style={{ fontWeight: 900 }}>
                  {ev.name}{" "}
                  <span style={{ fontWeight: 600, opacity: 0.7 }}>
                    · {ev.type} · {ev.gender} · {ev.status}
                  </span>
                </div>
                <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
                  Deadline: {new Date(ev.deadline).toLocaleString()} {locked ? "(OK at run)" : "(not yet)"} · Fee: {ev.entry_fee}
                </div>

                <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={() => runEvent(ev.id)}
                    disabled={busy || !locked || ev.status === "FINISHED"}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      background: locked ? "#111" : "#777",
                      color: "white"
                    }}
                  >
                    {ev.status === "FINISHED" ? "Finished" : busy ? "Arbejder…" : "Run event"}
                  </button>

                  <a href={`/team/results/${ev.id}`} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", textDecoration: "none" }}>
                    Se resultat
                  </a>
                  <a href={`/team/view/${ev.id}`} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", textDecoration: "none" }}>
                    Se løb
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "14px 0" }} />

        <div style={{ fontWeight: 900 }}>Reset ALT game data</div>
        <div style={{ marginTop: 6, opacity: 0.8 }}>
          Sletter teams, ryttere, events, resultater, feed og snapshots.
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder='Skriv "RESET"'
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: 220 }}
          />
          <button
            onClick={resetAll}
            disabled={busy}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#7a1111",
              color: "white"
            }}
          >
            {busy ? "Arbejder…" : "Reset database"}
          </button>
        </div>

        {status ? (
          <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
            {status}
          </div>
        ) : null}
      </div>
    </main>
  );
}
