"use client";

import { useEffect, useMemo, useState } from "react";
import TeamShell from "../../components/TeamShell";
import Loading from "../../components/Loading";
import SmallButton from "../../components/SmallButton";
import { supabase } from "../../../lib/supabaseClient";
import { getOrCreateTeam } from "../../../lib/team";

function isUuid(x) {
  return typeof x === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
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
        .select("rider:riders(id,name,gender,nationality,sprint,flat,hills,mountain,cobbles,timetrial,endurance,strength,form,fatigue,injury_until)")
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedEvent = useMemo(
    () => events.find(e => e.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  const locked = selectedEvent ? (new Date(selectedEvent.deadline) <= new Date()) : false;

  function toggleRider(id) {
    setSelectedRiderIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 8) return prev; // cap at 8
      return [...prev, id];
    });
  }

  useEffect(() => {
    // if captain not in selection, clear captain
    if (captainId && !selectedRiderIds.includes(captainId)) setCaptainId("");
  }, [selectedRiderIds, captainId]);

  async function join() {
    if (!team?.id) return;
    if (!isUuid(selectedEventId)) return setStatus("Vælg et event.");
    if (selectedRiderIds.length !== 8) return setStatus("Vælg præcis 8 ryttere.");
    if (!captainId) return setStatus("Vælg en kaptajn.");
    if (locked) return setStatus("Deadline er passeret (event locked).");

    setBusy(true);
    setStatus("Tilmeldes…");
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
      setStatus("Tilmeldt ✅ (holdudtagelse gemt)");
    } catch (e) {
      setStatus("Fejl: " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <TeamShell title="Kør løb">
      <p>Status: {status}</p>

      {!team ? <Loading text="Loader…" /> : (
        <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>1) Vælg løb</div>

          <select
            value={selectedEventId}
            onChange={(e) => {
              setSelectedEventId(e.target.value);
              setSelectedRiderIds([]);
              setCaptainId("");
            }}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: "100%", maxWidth: 520 }}
          >
            <option value="">Vælg event…</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.name} · {ev.type} · {ev.gender} · deadline: {new Date(ev.deadline).toLocaleString()}
              </option>
            ))}
          </select>

          {selectedEvent ? (
            <div style={{ marginTop: 10, opacity: 0.85 }}>
              <b>Status:</b> {selectedEvent.status} · <b>Entry fee:</b> {selectedEvent.entry_fee} coins ·{" "}
              <b>Prize pool:</b> {selectedEvent.prize_pool} ·{" "}
              <b>Deadline:</b> {new Date(selectedEvent.deadline).toLocaleString()}{" "}
              {locked ? <span style={{ color: "#a11", fontWeight: 900 }}> (LOCKED)</span> : null}
            </div>
          ) : null}

          <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "14px 0" }} />

          <div style={{ fontWeight: 900, marginBottom: 10 }}>2) Vælg 8 ryttere</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
            (MVP) Kun simple udtagelse. Taktik-orders kommer senere.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
            {riders.map(r => {
              const selected = selectedRiderIds.includes(r.id);
              const injured = r.injury_until && new Date(r.injury_until) > new Date();

              return (
                <button
                  key={r.id}
                  onClick={() => toggleRider(r.id)}
                  disabled={!selected && selectedRiderIds.length >= 8}
                  style={{
                    textAlign: "left",
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid #eee",
                    background: selected ? "#111" : "white",
                    color: selected ? "white" : "#111",
                    opacity: injured ? 0.6 : 1,
                    cursor: "pointer"
                  }}
                >
                  <div style={{ fontWeight: 900 }}>
                    {r.name}{" "}
                    <span style={{ fontWeight: 600, opacity: 0.75 }}>
                      {r.gender === "F" ? "♀" : "♂"} {r.nationality ? `(${r.nationality})` : ""}
                      {injured ? " · SKADET" : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                    Sprint {r.sprint} · Flat {r.flat} · Hills {r.hills} · Mountain {r.mountain}
                    <br />
                    Endurance {r.endurance} · Strength {r.strength} · Form {r.form} · Fatigue {r.fatigue}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 10, fontWeight: 800 }}>
            Valgt: {selectedRiderIds.length}/8
          </div>

          <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "14px 0" }} />

          <div style={{ fontWeight: 900, marginBottom: 10 }}>3) Vælg kaptajn</div>

          <select
            value={captainId}
            onChange={(e) => setCaptainId(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: "100%", maxWidth: 420 }}
            disabled={selectedRiderIds.length !== 8}
          >
            <option value="">Vælg kaptajn…</option>
            {riders.filter(r => selectedRiderIds.includes(r.id)).map(r => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.gender}) – Sprint {r.sprint}, Mountain {r.mountain}, Endurance {r.endurance}
              </option>
            ))}
          </select>

          <div style={{ marginTop: 12 }}>
            <SmallButton disabled={busy || !selectedEventId || locked} onClick={join}>
              {busy ? "Arbejder…" : locked ? "Deadline passeret" : "Tilmeld + gem udtagelse"}
            </SmallButton>
          </div>
        </div>
      )}
    </TeamShell>
  );
}
