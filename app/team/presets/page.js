"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import Loading from "../../components/Loading";
import SmallButton from "../../components/SmallButton";

export default function PresetsPage() {
  const [status, setStatus] = useState("Loading…");
  const [error, setError] = useState("");
  const [presets, setPresets] = useState([]);

  async function load() {
    setError("");
    setStatus("Checking your session…");
    const { presets } = await api("/api/presets");
    setPresets(presets);
    setStatus("Ready ✅");
  }

  useEffect(() => {
    load().catch((e) => {
      setError(e?.message ?? String(e));
      setStatus("Error");
    });
  }, []);

  async function createPreset() {
    const name = prompt("Preset name?");
    if (!name) return;

    // MVP: tom preset
    const payload = {
      name,
      team_plan: { risk: "medium", style: "balanced", focus: "balanced", energy_policy: "normal" },
      roles: { captain: null, sprinter: null, rouleur: null },
      riders: {}
    };

    try {
      await api("/api/presets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, payload }) });
    } catch (e) { setError(e.message); return; }

    await load();
  }

  return (
    <main>
      <h2 style={{ marginTop: 0 }}>Tactics presets</h2>
      <p style={{ opacity: 0.85 }}>{status}</p>

      {error ? <div style={{ color: "crimson" }}>Error: {error}</div> : null}

      {status.includes("Loading") && presets.length === 0 ? <Loading /> : null}

      <div style={{ marginTop: 10 }}>
        <SmallButton onClick={createPreset}>Create preset</SmallButton>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {presets.map((p) => (
          <div key={p.id} style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
            <div style={{ fontWeight: 800 }}>{p.name}</div>
            <div style={{ opacity: 0.75, fontSize: 13 }}>
              {p.created_at ? new Date(p.created_at).toLocaleString("en-GB") : ""}
            </div>
            <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
              (Tactics presets are a work in progress and are not yet applied to races.)
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
