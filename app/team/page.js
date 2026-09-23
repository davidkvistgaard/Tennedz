"use client";

import { useMemo, useState } from "react";
import TeamShell from "../components/TeamShell";
import Loading from "../components/Loading";
import SmallButton from "../components/SmallButton";
import RiderCard from "../components/RiderCard";
import { SectionHeader, Pill } from "../components/ui";

import { useAuth } from "../components/AuthProvider";
import { teamRating } from "../../lib/race/rating.mjs";

const SKILLS = [
  { key: "rating", label: "Rating (points)" },
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
  const [status, setStatus] = useState("Klar ✅");
  const [busy, setBusy] = useState(false);
  const { session, refresh, logout } = useAuth();
  const authChecked = true;
  const isLoggedIn = !!session;
  const team = session?.team;
  const riders = session?.riders || [];
  const loginName = session?.user?.display_name || "";

  const [genderFilter, setGenderFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState("rating");
  const [sortDir, setSortDir] = useState("DESC");

  async function load() {
    setStatus("Loader…");
    await refresh();
    setStatus("Klar ✅");
  }

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

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
    } catch (e) {
      setStatus("Fejl ved log ud: " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <TeamShell title="Mit hold">
      <p className="small">Status: {status}</p>

      {!authChecked ? (
        <Loading text="Tjekker login…" />
      ) : !isLoggedIn ? (
        <div className="card" style={{ padding: 16 }}>
          <SectionHeader
            title="Du er ikke logget ind"
            subtitle="Gå til login for at se dit hold."
          />

          <div className="hr" />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/login">
              <SmallButton>Gå til login</SmallButton>
            </a>
            <SmallButton onClick={load}>Prøv igen</SmallButton>
          </div>
        </div>
      ) : !team ? (
        <Loading text="Loader hold…" />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div className="card" style={{ padding: 14 }}>
            <SectionHeader
              title={team.name || "My Team"}
              subtitle={`Logget ind som ${loginName || "ukendt bruger"}`}
              right={
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <SmallButton onClick={load} disabled={busy}>Reload</SmallButton>
                  <SmallButton onClick={handleLogout} disabled={busy}>Log ud</SmallButton>
                </div>
              }
            />

            <div className="hr" />

            <div className="kpi">
              <div className="k">
                <div className="small">Budget</div>
                <b>{(team.budget ?? 0).toLocaleString("da-DK")}</b>
                <div className="small">Coins: {Number(team.coins ?? 0).toLocaleString("da-DK")}</div>
              </div>
              <div className="k">
                <div className="small">Ryttere</div>
                <b>{riders.length}</b>
              </div>

              <div className="k">
                <div className="small">Holdrating · resultatpoint</div>
                <b>Mænd: {teamRating(riders,"M").toLocaleString("da-DK")}</b>
                <div><b>Kvinder: {teamRating(riders,"F").toLocaleString("da-DK")}</b></div>
                <div className="small" style={{ opacity: 0.75, marginTop: 2 }}>
                  De 16 bedst ratede ryttere pr. køn
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill tone="info">Form/Fatigue påvirker performance (ikke rating)</Pill>
              <Pill tone="accent">Rating starter på 0</Pill>
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <SectionHeader
              title={`Ryttere (${filteredSorted.length}/${riders.length})`}
              subtitle="Filtrér og sortér (inkl. rating points)."
              right={<Pill tone="info">Tip: sortér på Rating for top-performere</Pill>}
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
