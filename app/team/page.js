"use client";

import { useEffect, useMemo, useState } from "react";
import TeamShell from "../components/TeamShell";
import Loading from "../components/Loading";
import SmallButton from "../components/SmallButton";
import RiderCard from "../components/RiderCard";
import { SectionHeader, Pill } from "../components/ui";
import { supabase } from "../../lib/supabaseClient";
import { getOrCreateTeam } from "../../lib/team";

const SKILLS = [
  { key: "sprint", label: "Sprint" },
  { key: "flat", label: "Flat" },
  { key: "hills", label: "Hills" },
  { key: "mountain", label: "Mountain" },
  { key: "cobbles", label: "Cobbles" },
  { key: "timetrial", label: "Timetrial" },
  { key: "endurance", label: "Endurance" },
  { key: "strength", label: "Strength" },
  { key: "wind", label: "Wind" },
  { key: "form", label: "Form" },
  { key: "fatigue", label: "Fatigue" }
];

function getVal(r, k) {
  const v = Number(r?.[k] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export default function TeamPage() {
  const [status, setStatus] = useState("Loader…");
  const [busy, setBusy] = useState(false);

  const [team, setTeam] = useState(null);
  const [riders, setRiders] = useState([]);

  const [genderFilter, setGenderFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState("form");
  const [sortDir, setSortDir] = useState("DESC");

  async function load() {
    setStatus("Loader…");
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s?.session) {
        setStatus("Du er ikke logget ind.");
        setTeam(null);
        setRiders([]);
        return;
      }

      const res = await getOrCreateTeam();
      setTeam(res.team);

      const { data: tr, error: trErr } = await supabase
        .from("team_riders")
        .select("rider:riders(*)")
        .eq("team_id", res.team.id);

      if (trErr) throw trErr;
      setRiders((tr ?? []).map(x => x.rider).filter(Boolean));

      setStatus("Klar ✅");
    } catch (e) {
      setStatus("Fejl: " + (e?.message ?? String(e)));
    }
  }

  useEffect(() => { load(); }, []);

  const filteredSorted = useMemo(() => {
    const list = riders
      .filter(r => genderFilter === "ALL" ? true : r.gender === genderFilter)
      .slice();

    list.sort((a, b) => {
      const av = getVal(a, sortKey);
      const bv = getVal(b, sortKey);
      return sortDir === "ASC" ? av - bv : bv - av;
    });

    return list;
  }, [riders, genderFilter, sortKey, sortDir]);

  // Starter pack button should be disabled if you already have >=16 riders
  const starterDisabled = riders.length >= 16;

  async function grantStarterPack() {
    setBusy(true);
    setStatus("Giver starter pack…");
    try {
      const j = await fetch("/api/grant-starter-pack", { method: "POST" }).then(r => r.json());
      if (!j?.ok) throw new Error(j?.error || "Grant failed");
      await load();
      setStatus("Starter pack givet ✅");
    } catch (e) {
      setStatus("Fejl: " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <TeamShell title="Mit hold">
      <p className="small">Status: {status}</p>

      {!team ? (
        <Loading text="Loader hold…" />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div className="card" style={{ padding: 14 }}>
            <SectionHeader
              title={team.name || "My Team"}
              subtitle="Overblik over ryttere, budget og hurtig sortering."
              right={
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <SmallButton onClick={load} disabled={busy}>Reload</SmallButton>
                  <SmallButton
                    className={starterDisabled ? "" : "primary"}
                    onClick={grantStarterPack}
                    disabled={busy || starterDisabled}
                    title={starterDisabled ? "Du har allerede 16+ ryttere" : "Giv starter pack (16 ryttere)"}
                  >
                    {starterDisabled ? "Starter pack allerede modtaget" : "Giv starter pack"}
                  </SmallButton>
                </div>
              }
            />

            <div className="hr" />

            <div className="kpi">
              <div className="k">
                <div className="small">Budget</div>
                <b>{(team.budget ?? 0).toLocaleString("da-DK")}</b>
              </div>
              <div className="k">
                <div className="small">Ryttere</div>
                <b>{riders.length}</b>
              </div>
              <div className="k">
                <div className="small">Starter pack</div>
                <b>{riders.length >= 16 ? "OK" : "Mangler"}</b>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <SectionHeader
              title={`Ryttere (${filteredSorted.length}/${riders.length})`}
              subtitle="Filtrér og sortér for hurtigt at finde dine bedste ryttere."
              right={<Pill tone="info">Tip: sortér på Sprint for sprintere</Pill>}
            />

            <div className="hr" />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ minWidth: 200 }}>
                <div className="small" style={{ marginBottom: 6 }}>Køn</div>
                <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
                  <option value="ALL">Alle</option>
                  <option value="M">Mænd</option>
                  <option value="F">Kvinder</option>
                </select>
              </div>

              <div style={{ minWidth: 240 }}>
                <div className="small" style={{ marginBottom: 6 }}>Sortér efter</div>
                <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                  {SKILLS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>

              <div style={{ minWidth: 180 }}>
                <div className="small" style={{ marginBottom: 6 }}>Orden</div>
                <select value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
                  <option value="DESC">Høj → lav</option>
                  <option value="ASC">Lav → høj</option>
                </select>
              </div>
            </div>

            <div className="hr" />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
              {filteredSorted.map(r => (
                <RiderCard key={r.id} r={r} selected={false} onClick={() => {}} disabled />
              ))}
            </div>
          </div>
        </div>
      )}
    </TeamShell>
  );
}
