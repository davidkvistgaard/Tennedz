"use client";

import { useState } from "react";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

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
    } catch (e) {
      setStatus("❌ " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 18, fontFamily: "system-ui, sans-serif", maxWidth: 820 }}>
      <h1 style={{ marginTop: 0 }}>Admin</h1>

      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <div style={{ fontWeight: 800 }}>Admin-kode</div>
        <input
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="ADMIN_SECRET"
          type="password"
          style={{ marginTop: 8, padding: 10, borderRadius: 10, border: "1px solid #ddd", width: "100%", maxWidth: 420 }}
        />

        <div style={{ marginTop: 14, fontWeight: 800 }}>Reset ALT game data</div>
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
              background: "#111",
              color: "white",
              cursor: busy ? "not-allowed" : "pointer"
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
