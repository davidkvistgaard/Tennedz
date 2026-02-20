"use client";

import { useEffect, useMemo, useState } from "react";
import TeamShell from "../../components/TeamShell";
import Loading from "../../components/Loading";
import SmallButton from "../../components/SmallButton";
import { SectionHeader, Pill } from "../../components/ui";
import RiderCard from "../../components/RiderCard";
import StageProfile from "../../components/StageProfile";
import LineupPresets from "../../components/LineupPresets";
import { supabase } from "../../../lib/supabaseClient";
import { getOrCreateTeam } from "../../../lib/team";

function isUuid(x) {
  return typeof x === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
}
function fmtTime(ts) {
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}
function getVal(r, k) {
  const v = Number(r?.[k] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

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

export default function RunPage() {
  const [status, setStatus] = useState("Loader…");
  const [busy, setBusy] = useState(false);

  const [team, setTeam] = useState(null);
  const [riders, setRiders] = useState([]);
  const [events, setEvents] = useState([]);

  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedRiderIds, setSelectedRiderIds] = useState([]);
  const [captainId, setCaptainId] = useState("");

  // UI controls
  const [genderFilter, setGenderFilter] = useState("ALL"); // ALL/M/F
  const [sortKey, setSortKey] = useState("form");
  const [sortDir, setSortDir] = useState("DESC"); // DESC/ASC

  // Weather
  const [weatherBox, setWeatherBox] = useState(null);

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

      const ev = await fetch("/api/events?limit=25").then(r => r.json());
      if (!ev?.ok) throw new Error(ev?.error || "Could not load events");
      setEvents(ev.events ?? []);

      setStatus("Klar ✅");
    } catch (e) {
      setStatus("Fejl: " + (e?.message ?? String(e)));
    }
  }

  useEffect(() => { load(); }, []);

  const selectedEvent = useMemo(
    () => events.find(e => e.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  const locked = selectedEvent ? (new Date(selectedEvent.deadline) <= new Date()) : false;

  // Load forecast whenever event changes
  useEffect(() => {
    (async () => {
      setWeatherBox(null);
      if (!selectedEventId) return;
      try {
        const j = await fetch(`/api/weather/forecast?event_id=${selectedEventId}`).then(r => r.json());
        if (!j?.ok) return;
        setWeatherBox(j);
      } catch {
        // ignore
      }
    })();
  }, [selectedEventId]);

  // stage snapshot for UI (MVP)
  const stageUi = useMemo(() => {
    if (!selectedEvent) return null;
    const dist = 150;
    return {
      name: selectedEvent.name,
      distance_km: dist,
      profile_type: "FLAT",
      keypoints: [
        { km: dist - 5, label: "Positionering" },
        { km: dist - 3, label: "Tog" },
        { km: dist - 1, label: "Sprint" }
      ]
    };
  }, [selectedEvent]);

  const filteredSortedRiders = useMemo(() => {
    const list = riders
      .filter(r => {
        if (genderFilter === "ALL") return true;
        return r.gender === genderFilter;
      })
      .slice();

    list.sort((a, b) => {
      const av = getVal(a, sortKey);
      const bv = getVal(b, sortKey);
      return sortDir === "ASC" ? av - bv : bv - av;
    });

    return list;
  }, [riders, genderFilter, sortKey, sortDir]);

  function toggleRider(id) {
    setSelectedRiderIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 8) return prev;
      return [...prev, id];
    });
  }

  useEffect(() => {
    if (captainId && !selectedRiderIds.includes(captainId)) setCaptainId("");
  }, [selectedRiderIds, captainId]);

  function clearSelection() {
    setSelectedRiderIds([]);
    setCaptainId("");
  }

  function pickTop8BySkill(skillKey) {
    const pool = filteredSortedRiders.slice().sort((a, b) => getVal(b, skillKey) - getVal(a, skillKey));
    const pick = pool.slice(0, 8).map(r => r.id);
    if (pick.length === 8) {
      setSelectedRiderIds(pick);
      setCaptainId(pick[0] || "");
      setSortKey(skillKey);
      setSortDir("DESC");
    }
  }

  function pickSplit(skillA, skillB) {
    const pool = filteredSortedRiders.slice();
    const a = pool.slice().sort((x, y) => getVal(y, skillA) - getVal(x, skillA)).slice(0, 10);
    const b = pool.slice().sort((x, y) => getVal(y, skillB) - getVal(x, skillB)).slice(0, 10);

    const pick = [];
    for (const r of a) if (pick.length < 4 && !pick.includes(r.id)) pick.push(r.id);
    for (const r of b) if (pick.length < 8 && !pick.includes(r.id)) pick.push(r.id);

    if (pick.length === 8) {
      setSelectedRiderIds(pick);
      setCaptainId(pick[0] || "");
    }
  }

  async function join() {
    if (!team?.id) return;
    if (!isUuid(selectedEventId)) return setStatus("Vælg et event.");
    if (selectedRiderIds.length !== 8) return setStatus("Vælg præcis 8 ryttere.");
    if (!captainId) return setStatus("Vælg en kaptajn.");
    if (locked) return setStatus("Deadline er passeret (event locked).");

    setBusy(true);
    setStatus("Gemmer tilmelding…");
    try {
      const res = await fetch("/api/event/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: selectedEventId,
          team_id: team.id,
          selected_riders: selectedRiderIds,
          captain_id: captainId
        })
      }).then(r => r.json());

      if (!res?.ok) throw new Error(res?.error || "Join failed");
      setStatus("Tilmeldt ✅ (udtagelse gemt)");
    } catch (e) {
      setStatus("Fejl: " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  const selectedCount = selectedRiderIds.length;

  return (
    <TeamShell title="Kør løb">
      <p className="small">Status: {status}</p>

      {!team ? <Loading text="Loader…" /> : (
        <div style={{ display: "grid", gap: 14 }}>

          {/* Event */}
          <div className="card" style={{ padding: 14 }}>
            <SectionHeader
              title="Vælg event"
              subtitle="Forecast vises før deadline. Vejret låses automatisk ved deadline/run."
              right={<SmallButton onClick={load} disabled={busy}>Reload</SmallButton>}
            />
            <div className="hr" />

            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                clearSelection();
              }}
              style={{ maxWidth: 760 }}
            >
              <option value="">Vælg event…</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} · {ev.gender} · deadline: {fmtTime(ev.deadline)} · {ev.status}
                </option>
              ))}
            </select>

            {selectedEvent ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <Pill tone={locked ? "danger" : "accent"}>{locked ? "LOCKED" : "OPEN"}</Pill>
                <Pill tone="info">Deadline: {fmtTime(selectedEvent.deadline)}</Pill>
                <Pill>Land: {(selectedEvent.country_code || "FR").toUpperCase()}</Pill>
                <a href={`/team/results/${selectedEvent.id}`} style={{ textDecoration: "none" }}>
                  <span className="pillBtn">Se resultat</span>
                </a>
                <a href={`/team/view/${selectedEvent.id}`} style={{ textDecoration: "none" }}>
                  <span className="pillBtn">Se løb</span>
                </a>
              </div>
            ) : null}

            {/* Weather box */}
            {weatherBox?.weather ? (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 16, border: "1px solid var(--border)", background: "rgba(0,0,0,0.25)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontWeight: 1000 }}>
                    Vejr ({weatherBox.locked ? "låst" : "forecast"})
                    <span className="small" style={{ marginLeft: 10, opacity: 0.75 }}>
                      {weatherBox.source}
                    </span>
                  </div>
                  <Pill tone={weatherBox.locked ? "danger" : "info"}>
                    {weatherBox.locked ? "LOCKED" : "FORECAST"}
                  </Pill>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <Pill tone="accent">{weatherBox.weather.condition}</Pill>
                  <Pill>{weatherBox.weather.temp_c}°C</Pill>
                  <Pill>Vind {weatherBox.weather.wind_kph} km/t ({weatherBox.weather.wind_dir})</Pill>
                  <Pill>Nedbør {weatherBox.weather.precipitation_mm} mm</Pill>
                </div>

                {!weatherBox.locked ? (
                  <div className="small" style={{ marginTop: 8 }}>
                    Forecast kan ændre sig frem til deadline. Når eventet låses/køres, fastlåses vejret til et “locked” objekt.
                  </div>
                ) : (
                  <div className="small" style={{ marginTop: 8 }}>
                    Vejret er låst og vil være identisk for alle, når løbet simuleres.
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {stageUi ? <StageProfile stage={stageUi} /> : null}

          {/* Presets */}
          <LineupPresets
            teamId={team.id}
            riders={riders}
            selectedIds={selectedRiderIds}
            setSelectedIds={setSelectedRiderIds}
            captainId={captainId}
            setCaptainId={setCaptainId}
          />

          {/* Selection Controls */}
          <div className="card" style={{ padding: 14 }}>
            <SectionHeader
              title="Udtagelse"
              subtitle="Sortér, filtrér og brug quick-picks."
              right={<Pill tone="accent">Valgt: {selectedCount}/8</Pill>}
            />

            <div className="hr" />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ minWidth: 200 }}>
                <div className="small" style={{ marginBottom: 6 }}>Køn</div>
                <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} disabled={locked}>
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

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                <SmallButton onClick={() => pickTop8BySkill(sortKey)} disabled={locked}>
                  Top 8 ({SKILLS.find(x => x.key === sortKey)?.label || sortKey})
                </SmallButton>
                <SmallButton onClick={() => pickSplit("mountain", "endurance")} disabled={locked}>
                  Mountain team (4+4)
                </SmallButton>
                <SmallButton onClick={() => pickSplit("wind", "strength")} disabled={locked}>
                  Wind team (4+4)
                </SmallButton>
                <SmallButton className="danger" onClick={() => { setSelectedRiderIds([]); setCaptainId(""); }} disabled={locked}>
                  Ryd
                </SmallButton>
              </div>
            </div>

            <div className="hr" />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
              {filteredSortedRiders.map(r => {
                const selected = selectedRiderIds.includes(r.id);
                const disabled = (!selected && selectedRiderIds.length >= 8) || locked;
                return (
                  <RiderCard
                    key={r.id}
                    r={r}
                    selected={selected}
                    disabled={disabled}
                    onClick={() => toggleRider(r.id)}
                  />
                );
              })}
            </div>

            <div className="hr" />

            <SectionHeader
              title="Kaptajn"
              subtitle="Vælg den rytter du vil beskytte/spille for (MVP)."
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
              <select
                value={captainId}
                onChange={(e) => setCaptainId(e.target.value)}
                disabled={selectedRiderIds.length !== 8 || locked}
                style={{ maxWidth: 520 }}
              >
                <option value="">Vælg kaptajn…</option>
                {riders
                  .filter(r => selectedRiderIds.includes(r.id))
                  .sort((a, b) => (getVal(b, "leadership") + getVal(b, "endurance")) - (getVal(a, "leadership") + getVal(a, "endurance")))
                  .map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.gender}) – Lead {r.leadership ?? 0} · End {r.endurance ?? 0}
                    </option>
                  ))}
              </select>

              <SmallButton className="primary" disabled={busy || !selectedEventId || locked} onClick={join}>
                {busy ? "Arbejder…" : locked ? "Deadline passeret" : "Gem tilmelding"}
              </SmallButton>
            </div>

            {locked ? (
              <div className="small" style={{ marginTop: 10, color: "rgba(255,77,77,0.85)" }}>
                Event er låst. Vejret er/kan blive låst. Du kan stadig se resultat/viewer når eventet er kørt.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </TeamShell>
  );
}
