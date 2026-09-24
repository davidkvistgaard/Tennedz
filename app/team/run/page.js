"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TeamShell from "../../components/TeamShell";
import StageProfile from "../../components/StageProfile";
import RiderAvatar from "../../components/RiderAvatar";
import LineupPresets from "../../components/LineupPresets";
import { useAuth } from "../../components/AuthProvider";
import { api } from "../../../lib/api";
import { normalizeRoute, routeAdvice } from "../../../lib/race/route.mjs";

const skills = {
  sprint: "Sprint",
  flat: "Flad vej",
  hills: "Bakker",
  mountain: "Bjerge",
  cobbles: "Brosten",
  timetrial: "Enkeltstart",
  endurance: "Udholdenhed",
  strength: "Styrke",
  wind: "Vind",
  form: "Form",
  fatigue: "Træthed",
};
const date = (ts) =>
  new Date(ts).toLocaleString("da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
function countdown(deadline, now) {
  const sec = Math.max(0, Math.floor((new Date(deadline) - now) / 1000));
  if (sec >= 86400)
    return `${Math.floor(sec / 86400)} ${sec < 172800 ? "dag" : "dage"} · ${Math.floor((sec % 86400) / 3600)} timer`;
  return `${Math.floor(sec / 3600)}t ${Math.floor((sec % 3600) / 60)}m ${sec % 60}s`;
}
const sameLineup = (a, b) =>
  !!a &&
  a.captain_id === b.captain_id &&
  a.selected_riders.length === b.selected_riders.length &&
  a.selected_riders.every((id) => b.selected_riders.includes(id));

export default function RunPage() {
  const { session } = useAuth(),
    team = session?.team,
    riders = session?.riders || [];
  const [events, setEvents] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [gender, setGender] = useState("M"),
    [bucket, setBucket] = useState("upcoming"),
    [eventId, setEventId] = useState("");
  const [stage, setStage] = useState(null),
    [gameDate, setGameDate] = useState(null),
    [entryLoading, setEntryLoading] = useState(false),
    [entryError, setEntryError] = useState("");
  const [selected, setSelected] = useState([]),
    [captain, setCaptain] = useState(""),
    [saved, setSaved] = useState(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [sortKey, setSortKey] = useState("form"),
    [now, setNow] = useState(Date.now()),
    [offset, setOffset] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(timer);
  }, [offset]);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [data, day] = await Promise.all([
        api("/api/events?limit=50"),
        api("/api/game-date"),
      ]);
      setEvents(data.events.filter((e) => e.kind === "one_day"));
      setGameDate(day.game_date);
      if (data.server_time) {
        const diff = Date.parse(data.server_time) - Date.now();
        setOffset(diff);
        setNow(Date.now() + diff);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const requestedGender = new URLSearchParams(window.location.search).get("gender");
    if (requestedGender === "M" || requestedGender === "F") setGender(requestedGender);
    load();
  }, []);
  const event = events.find((e) => e.id === eventId),
    locked =
      !event || event.status !== "OPEN" || Date.parse(event.deadline) <= now;
  useEffect(() => {
    const abort = new AbortController();
    setSelected([]);
    setCaptain("");
    setSaved(null);
    setStage(null);
    setEntryError("");
    setNotice("");
    if (!eventId) {
      setEntryLoading(false);
      return;
    }
    setEntryLoading(true);
    Promise.all([
      api(`/api/stage-profile?event_id=${eventId}`, { signal: abort.signal }),
      api(`/api/event/join?event_id=${eventId}`, { signal: abort.signal }),
    ])
      .then(([profile, entry]) => {
        if (abort.signal.aborted) return;
        setStage(profile.stage);
        setSaved(entry.entry);
        setSelected(entry.entry?.selected_riders || []);
        setCaptain(entry.entry?.captain_id || "");
        try {
          setSortKey(routeAdvice(normalizeRoute(profile.stage)).primary);
        } catch {
          setSortKey("form");
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setEntryError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setEntryLoading(false);
      });
    return () => abort.abort();
  }, [eventId]);
  const list = events.filter(
    (e) =>
      e.gender === gender &&
      (bucket === "upcoming"
        ? e.status === "OPEN" && Date.parse(e.deadline) > now
        : bucket === "pending"
          ? e.status === "OPEN" && Date.parse(e.deadline) <= now
          : e.status !== "OPEN"),
  );
  const eligible = (r) =>
    !r.injury_until || (!!gameDate && r.injury_until <= gameDate);
  const available = useMemo(
    () =>
      riders
        .filter((r) => r.gender === event?.gender)
        .slice()
        .sort((a, b) =>
          sortKey === "fatigue"
            ? Number(a[sortKey]) - Number(b[sortKey])
            : Number(b[sortKey]) - Number(a[sortKey]),
        ),
    [riders, event?.gender, sortKey],
  );
  const valid =
    selected.length === 8 &&
    selected.includes(captain) &&
    selected.every((id) => available.some((r) => r.id === id && eligible(r)));
  const unchanged = sameLineup(saved, {
    selected_riders: selected,
    captain_id: captain,
  });
  function choose(ids) {
    if (locked || entryLoading || busy) return;
    setSelected(ids);
    if (!ids.includes(captain)) setCaptain("");
    setNotice("");
  }
  function toggle(id) {
    if (selected.includes(id)) choose(selected.filter((x) => x !== id));
    else if (selected.length < 8) choose([...selected, id]);
  }
  async function save() {
    if (!valid || locked || busy) return;
    setBusy(true);
    setNotice("");
    try {
      await api("/api/event/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          team_id: team.id,
          selected_riders: selected,
          captain_id: captain,
        }),
      });
      setSaved({ selected_riders: [...selected], captain_id: captain });
      setNotice(
        "Dit hold er tilmeldt. Du kan ændre udtagelsen indtil deadline.",
      );
    } catch (e) {
      setNotice(e.message);
      if (e.status === 409) setNow(Date.now() + offset);
    } finally {
      setBusy(false);
    }
  }
  return (
    <TeamShell title="Kalender & løb">
      <p className="page-intro">
        Udtag dit hold før deadline. Se derefter løbet folde sig ud — alle
        beslutninger er truffet på forhånd.
      </p>
      <div className="calendar-toolbar">
        <div className="segmented" aria-label="Køn">
          {[
            ["M", "Mænd"],
            ["F", "Kvinder"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={gender === value}
              onClick={() => {
                setGender(value);
                setEventId("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="calendar-tabs">
          {[
            ["upcoming", "Åben tilmelding"],
            ["pending", "Afventer løb"],
            ["finished", "Afsluttede"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={bucket === value}
              onClick={() => {
                setBucket(value);
                setEventId("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="text-button" onClick={load} disabled={loading}>
          Opdatér
        </button>
      </div>
      {error && (
        <p role="alert" className="form-message error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Henter løbskalenderen…</p>
      ) : !list.length ? (
        <div className="card empty-state">
          <h2>
            {bucket === "upcoming"
              ? "Næste løbsdag er på vej"
              : "Ingen løb her endnu"}
          </h2>
          <p>
            {bucket === "upcoming"
              ? "Der er endnu ingen åbne løb for dette køn. Du kan se tidligere løb eller lære dine ryttere at kende."
              : "Vælg en anden kategori for at se løb."}
          </p>
          <Link className="btn" href="/team/portraits">
            Mød dine ryttere →
          </Link>
        </div>
      ) : (
        <div className="event-grid">
          {list.map((e) => (
            <button
              className={`event-card ${eventId === e.id ? "selected" : ""}`}
              key={e.id}
              onClick={() => setEventId(e.id)}
              aria-pressed={eventId === e.id}
            >
              <span className="eyebrow">
                {e.gender === "F" ? "Kvinder" : "Mænd"} · Endagsløb
              </span>
              <h2>{e.name}</h2>
              <span className="event-date">{date(e.deadline)}</span>
              <span className="event-meta">
                <span>
                  {e.status === "FINISHED"
                    ? "Klar til afspilning"
                    : Date.parse(e.deadline) <= now
                      ? "Tilmelding lukket"
                      : `Deadline om ${countdown(e.deadline, now)}`}
                </span>
                <strong>
                  {Number(e.entry_fee) > 0 ? `${e.entry_fee} coins` : "Gratis"}
                </strong>
              </span>
              <span className="event-action">
                {e.status === "FINISHED"
                  ? "Åbn løbsdag"
                  : "Se rute og udtag hold"}{" "}
                →
              </span>
            </button>
          ))}
        </div>
      )}
      {event && (
        <section className="race-preparation" aria-label="Løbsforberedelse">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {event.gender === "F" ? "Kvindernes" : "Mændenes"} løbsdag
              </p>
              <h2>{event.name}</h2>
            </div>
            <span className="deadline-badge">
              {locked
                ? "Tilmelding lukket"
                : `Deadline om ${countdown(event.deadline, now)}`}
            </span>
          </div>
          {entryLoading ? (
            <p role="status">Henter rute og din gemte udtagelse…</p>
          ) : entryError ? (
            <p role="alert" className="form-message error">
              {entryError}
            </p>
          ) : (
            <>
              {stage && <StageProfile stage={stage} />}
              {event.status === "FINISHED" ? (
                <div className="card race-ready">
                  <h2>Løbet er klar</h2>
                  <p>
                    Følg din division i vieweren, eller gå direkte til
                    resultaterne.
                  </p>
                  <Link className="btn primary" href={`/team/view/${event.id}`}>
                    Se løbet →
                  </Link>
                  <Link
                    className="text-button"
                    href={`/team/results/${event.id}`}
                  >
                    Resultater
                  </Link>
                </div>
              ) : (
                <>
                  {locked && saved && (
                    <section className="card race-ready">
                      <h2>Din udtagelse er låst</h2>
                      <p>
                        Åbn løbsdagen for at se løbet. Hele forløbet beregnes og
                        gemmes, før afspilningen begynder.
                      </p>
                      <Link
                        className="btn primary"
                        href={`/team/view/${event.id}`}
                      >
                        Se løbet →
                      </Link>
                    </section>
                  )}
                  <section className="card lineup-summary">
                    <div className="panel-heading">
                      <div>
                        <h2>Din udtagelse</h2>
                        <p className="small">
                          Otte ryttere og én kaptajn. Kaptajnens tid bestemmer
                          holdets placering.
                        </p>
                      </div>
                      <span
                        className={`save-badge ${unchanged ? "saved" : ""}`}
                      >
                        {saved
                          ? unchanged
                            ? "Gemt ✓"
                            : "Ændringer ikke gemt"
                          : "Ikke tilmeldt"}
                      </span>
                    </div>
                    <div className="lineup-slots">
                      {Array.from({ length: 8 }, (_, i) => {
                        const rider = riders.find((r) => r.id === selected[i]);
                        return (
                          <div
                            className={`lineup-slot ${rider?.id === captain ? "captain" : ""}`}
                            key={i}
                          >
                            {rider ? (
                              <>
                                <RiderAvatar rider={rider} size={56} />
                                <strong>
                                  {rider.first_name || rider.name}
                                </strong>
                                <button
                                  className="text-button"
                                  disabled={locked || busy}
                                  aria-pressed={captain === rider.id}
                                  onClick={() => {
                                    setCaptain(rider.id);
                                    setNotice("");
                                  }}
                                >
                                  {captain === rider.id
                                    ? "★ Kaptajn"
                                    : "Vælg kaptajn"}
                                </button>
                                <button
                                  className="remove-rider"
                                  aria-label={`Fjern ${rider.name}`}
                                  disabled={locked || busy}
                                  onClick={() => toggle(rider.id)}
                                >
                                  ×
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="empty-slot">{i + 1}</span>
                                <span>Ledig plads</span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="lineup-save">
                      <span>
                        {selected.length}/8 ryttere ·{" "}
                        {captain ? "Kaptajn valgt" : "Vælg kaptajn"}
                        {!saved && Number(event.entry_fee) > 0
                          ? ` · Pris ${event.entry_fee} coins`
                          : ""}
                      </span>
                      <button
                        className="btn primary"
                        disabled={locked || !valid || busy || unchanged}
                        onClick={save}
                      >
                        {busy
                          ? "Gemmer…"
                          : locked
                            ? "Deadline er passeret"
                            : saved
                              ? "Gem ændringer"
                              : "Tilmeld hold"}
                      </button>
                    </div>
                    <p className="small">
                      {locked
                        ? "Din gemte udtagelse er låst. Løbet kan afvikles, når mindst to hold er tilmeldt."
                        : "Tilmeldingsprisen betales kun én gang. Ændringer før deadline koster ikke ekstra."}
                    </p>
                    {notice && (
                      <p role="status" className="form-message">
                        {notice}
                      </p>
                    )}
                  </section>
                  {!locked && (
                    <>
                      <div className="rider-selection-toolbar">
                        <div>
                          <h2>Vælg dine ryttere</h2>
                          <p className="small">
                            Skadede ryttere kan ikke udtages. Lav træthed og høj
                            form er en fordel.
                          </p>
                        </div>
                        <label>
                          Sortér efter{" "}
                          <select
                            value={sortKey}
                            onChange={(e) => setSortKey(e.target.value)}
                          >
                            {Object.entries(skills).map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() =>
                            choose(
                              available
                                .filter(eligible)
                                .slice(0, 8)
                                .map((r) => r.id),
                            )
                          }
                        >
                          Vælg de første otte
                        </button>
                      </div>
                      <div className="lineup-riders">
                        {available.map((r) => {
                          const picked = selected.includes(r.id),
                            injured = !eligible(r);
                          return (
                            <button
                              key={r.id}
                              className={`lineup-rider ${picked ? "selected" : ""}`}
                              aria-pressed={picked}
                              disabled={
                                busy ||
                                injured ||
                                (!picked && selected.length === 8)
                              }
                              onClick={() => toggle(r.id)}
                            >
                              <RiderAvatar rider={r} size={64} />
                              <div>
                                <strong>{r.name}</strong>
                                <span>
                                  {injured
                                    ? `Skadet til ${r.injury_until}`
                                    : `${skills[sortKey]} ${r[sortKey] ?? 0} · Form ${r.form} · Træthed ${r.fatigue}`}
                                </span>
                              </div>
                              <span className="selection-mark">
                                {picked ? "✓" : "+"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <details className="lineup-presets">
                        <summary>Gemte udtagelser i denne browser</summary>
                        <LineupPresets
                          teamId={team?.id}
                          riders={available.filter(eligible)}
                          selectedIds={selected}
                          setSelectedIds={choose}
                          captainId={captain}
                          setCaptainId={setCaptain}
                        />
                      </details>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </section>
      )}
    </TeamShell>
  );
}
