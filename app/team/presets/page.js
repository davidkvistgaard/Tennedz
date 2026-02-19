"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import Loading from "../../components/Loading";
import SmallButton from "../../components/SmallButton";

export default function PresetsPage() {
  const [status, setStatus] = useState("Loader…");
  const [error, setError] = useState("");
  const [presets, setPresets] = useState([]);

  async function load() {
    setError("");
    setStatus("Tjekker login…");
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) {
      setStatus("Du skal logge ind først.");
      return;
    }

    setStatus("Loader presets…");
    const { data, error } = await supabase
      .from("tactic_presets")
      .select("id,name,created_at,payload")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) throw error;
    setPresets(data ?? []);
    setStatus("Klar ✅");
  }

  useEffect(() => {
    load().catch((e) => {
      setError(e?.message ?? String(e));
      setStatus("Fejl");
    });
  }, []);

  async function createPreset() {
    const name = prompt("Navn på preset?");
    if (!name) return;

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return;

    // MVP: tom preset
    const payload = {
      name,
      team_plan: { risk: "medium", style: "balanced", focus: "balanced", energy_policy: "normal" },
      roles: { captain: null, sprinter: null, rouleur: null },
      riders: {}
    };

    const { error } = await supabase.from("tactic_presets").insert({ user_id: uid, name, payload });
    if (error) return alert("Fejl: " + error.message);

    await load();
  }

  return (
    <main>
      <h2 style={{ marginTop: 0 }}>Taktik-presets</h2>
      <p style={{ opacity: 0.85 }}>{status}</p>

      {error ? <div style={{ color: "crimson" }}>Fejl: {error}</div> : null}

      {status.includes("Loader") && presets.length === 0 ? <Loading /> : null}

      <div style={{ marginTop: 10 }}>
        <SmallButton onClick={createPreset}>Opret preset</SmallButton>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {presets.map((p) => (
          <div key={p.id} style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
            <div style={{ fontWeight: 800 }}>{p.name}</div>
            <div style={{ opacity: 0.75, fontSize: 13 }}>
              {p.created_at ? new Date(p.created_at).toLocaleString("da-DK") : ""}
            </div>
            <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
              (MVP: presets bliver brugt i “Kør løb” senere, når vi binder dem til events/stages med deadlines)
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
