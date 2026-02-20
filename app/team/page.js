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

// Same rating logic as run-event (top16, form/fatigue adjusted)
function riderPower(r) {
  const sprint = getVal(r, "sprint");
  const flat = getVal(r, "flat");
  const hills = getVal(r, "hills");
  const mountain = getVal(r, "mountain");
  const cobbles = getVal(r, "cobbles");
  const timetrial = getVal(r, "timetrial");
  const endurance = getVal(r, "endurance");
  const strength = getVal(r, "strength");
  const wind = getVal(r, "wind");

  const form = Number.isFinite(Number(r?.form)) ? Number(r.form) : 50;
  const fatigue = Number.isFinite(Number(r?.fatigue)) ? Number(r.fatigue) : 0;

  const base =
    (sprint + flat + hills + mountain + cobbles + timetrial + endurance + strength + wind) / 9;

  const formMult = 0.85 + (form / 100) * 0.30;          // 0.85..1.15
  const fatigueMult = 1.0 - (fatigue / 100) * 0.20;     // 1..0.80

  return base * formMult * fatigueMult;
}

function computeTeamRatingTop16(riders) {
  const powers = (riders || [])
    .map(r => riderPower(r))
    .filter(v => Number.isFinite(v))
    .sort((a, b) => b - a);

  const top16 = powers.slice(0, 16);
  const rating = top16.reduce((s, v) => s + v, 0);

  return rating;
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

  const teamRating = useMemo(() => computeTeamRatingTop16(riders), [riders]);
  const teamRatingRounded = useMemo(() => Math.round(teamRating), [teamRating]);

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

                  {/* Keep the starter pack button, but do NOT show starter status in KPI */}
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

              {/* REPLACED: Starter pack -> Rating */}
              <div className="k">
                <div className="small">Rating (Top 16)</div>
                <b>{teamRatingRounded.toLocaleString("da-DK")}</b>
                <div className="small" style={{ opacity: 0.75, marginTop: 2 }}>
                  Form/Fatigue justeret
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill tone="info">Bruges til divisions-seeding i løb</Pill>
              <Pill tone="accent">Top 16 ryttere</Pill>
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
