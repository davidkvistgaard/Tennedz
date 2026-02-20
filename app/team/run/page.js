"use client";

import { useEffect, useMemo, useState } from "react";
import TeamShell from "../../components/TeamShell";
import Loading from "../../components/Loading";
import SmallButton from "../../components/SmallButton";
import { SectionHeader, Pill } from "../../components/ui";
import RiderCard from "../../components/RiderCard";
import StageProfile from "../../components/StageProfile";
import { supabase } from "../../../lib/supabaseClient";
import { getOrCreateTeam } from "../../../lib/team";

function isUuid(x) {
  return typeof x === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
}

function fmtTime(ts) {
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

export default function RunPage() {
  const [status, setStatus] = useState("Loader…");
  const [busy, setBusy] = useState(false);

  const [team, setTeam] = useState(null);
  const [riders, setRiders] = useState([]);
  const [events, setEvents] = useState([]);

  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedRiderIds, setSelectedRiderIds] = useState([]);
  const [captainId, setCaptainId] = useState("");

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

  // Stage snapshot for UI (MVP)
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

  return (
    <TeamShell title="Kør løb">
      <p className="small">Status: {status}</p>

      {!team ? <Loading text="Loader…" /> : (
        <div style={{ display: "grid", gap: 14 }}>
          <div className="card" style={{ padding: 14 }}>
            <SectionHeader
              title="Vælg event"
              subtitle="Vælg et løb, sæt udtagelse og kaptajn. Ordrer låses ved deadline."
              right={<SmallButton onClick={load} disabled={busy}>Reload</SmallButton>}
            />

            <div className="hr" />

            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                setSelectedRiderIds([]);
                setCaptainId("");
              }}
              style={{ maxWidth: 700 }}
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
                <Pill>Fee: {selectedEvent.entry_fee ?? 0} coins</Pill>
                <Pill>Kind: {selectedEvent.kind}</Pill>
                <a href={`/team/results/${selectedEvent.id}`} style={{ textDecoration: "none" }}>
                  <span className="pillBtn">Se resultat</span>
                </a>
                <a href={`/team/view/${selectedEvent.id}`} style={{ textDecoration: "none" }}>
                  <span className="pillBtn">Se løb</span>
                </a>
              </div>
            ) : null}
          </div>

          {stageUi ? <StageProfile stage={stageUi} /> : null}

          <div className="card" style={{ padding: 14 }}>
            <SectionHeader
              title="Udtagelse"
              subtitle="Vælg præcis 8 ryttere. (MVP) Taktik presets/orders kommer næste."
              right={<Pill tone="accent">Valgt: {selectedRiderIds.length}/8</Pill>}
            />

            <div className="hr" />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
              {riders.map(r => {
                const selected = selectedRiderIds.includes(r.id);
                const disabled = !selected && selectedRiderIds.length >= 8;
                return (
                  <RiderCard
                    key={r.id}
                    r={r}
                    selected={selected}
                    disabled={disabled || locked}
                    onClick={() => toggleRider(r.id)}
                  />
                );
              })}
            </div>

            <div className="hr" />

            <SectionHeader
              title="Kaptajn"
              subtitle="Kaptajnen er dit primære mål i løbet (beskyttelse/positionering)."
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
              <select
                value={captainId}
                onChange={(e) => setCaptainId(e.target.value)}
                disabled={selectedRiderIds.length !== 8 || locked}
                style={{ maxWidth: 520 }}
              >
                <option value="">Vælg kaptajn…</option>
                {riders.filter(r => selectedRiderIds.includes(r.id)).map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.gender}) – End {r.endurance} · Str {r.strength} · Spr {r.sprint}
                  </option>
                ))}
              </select>

              <SmallButton className="primary" disabled={busy || !selectedEventId || locked} onClick={join}>
                {busy ? "Arbejder…" : locked ? "Deadline passeret" : "Gem tilmelding"}
              </SmallButton>
            </div>

            {locked ? (
              <div className="small" style={{ marginTop: 10, color: "rgba(255,77,77,0.85)" }}>
                Event er låst. Du kan stadig se resultat/viewer når eventet er kørt.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </TeamShell>
  );
}
