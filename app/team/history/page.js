"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import Loading from "../../components/Loading";
import SmallButton from "../../components/SmallButton";
import TeamShell from "../../components/TeamShell";

export default function HistoryPage() {
  const [status, setStatus] = useState("Loader…");
  const [team, setTeam] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    setStatus("Tjekker session…");

const res = await api("/api/auth/me");
    setTeam(res.team);

    setStatus("Loader løb…");
    const r = await fetch("/api/my-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: res.team.id, limit: 25 })
    });

    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = null; }
    if (!r.ok) throw new Error(json?.error ?? text ?? "Ukendt fejl");

    setRows(json.rows ?? []);
    setStatus("Klar ✅");
  }

  useEffect(() => {
    load().catch((e) => {
      setError(e?.message ?? String(e));
      setStatus("Fejl");
    });
  }, []);

  return (
    <TeamShell title="Historik">
      <h2 style={{ marginTop: 0 }}>Tidligere løb</h2>
      <p style={{ opacity: 0.85 }}>{status}</p>

      {error ? <div style={{ color: "crimson" }}>Fejl: {error}</div> : null}

      {!team ? <Loading text="Loader…" /> : (
        <div style={{ marginTop: 12 }}>
          {rows.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Ingen løb fundet endnu. Kør et løb under “Kør løb”.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {rows.map((x) => (
                <div key={x.event_id} style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>
                        {x.event_name} · Division {x.division_index} · Nr. {x.position} · {x.points} point
                      </div>
                      <div style={{ opacity: 0.8, fontSize: 13 }}>
                        Kørt: {x.created_at ? new Date(x.created_at).toLocaleString("da-DK") : ""}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <a href={`/team/results/${x.event_id}`} style={{ textDecoration: "none" }}>
                        <SmallButton>Se resultat</SmallButton>
                      </a>
                      <a href={`/team/view/${x.event_id}`} style={{ textDecoration: "none" }}>
                        <SmallButton>Se løb</SmallButton>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </TeamShell>
  );
}
