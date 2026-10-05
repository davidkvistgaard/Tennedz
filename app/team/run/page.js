"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import TeamShell from "../../components/TeamShell";
import StageProfile from "../../components/StageProfile";
import RiderAvatar from "../../components/RiderAvatar";
import DivisionReveal from "../../components/DivisionReveal";
import LineupPresets from "../../components/LineupPresets";
import { useAuth } from "../../components/AuthProvider";
import { api } from "../../../lib/api";
import { normalizeRoute, routeAdvice } from "../../../lib/race/route.mjs";

import RaceOrders from "../../components/RaceOrders";
import { draftOrders } from "../../../lib/race/orders.mjs";

const skills = {
  sprint: "Sprint",
  flat: "Flat roads",
  hills: "Hills",
  mountain: "Mountains",
  cobbles: "Cobbles",
  timetrial: "Time trial",
  endurance: "Endurance",
  strength: "Strength",
  wind: "Wind",
  form: "Form",
  fatigue: "Fatigue",
};
const date = (ts) =>
  new Date(ts).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
function countdown(deadline, now) {
  const sec = Math.max(0, Math.floor((new Date(deadline) - now) / 1000));
  if (sec >= 86400)
    return `${Math.floor(sec / 86400)} ${sec < 172800 ? "day" : "days"} · ${Math.floor((sec % 86400) / 3600)} hours`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m ${sec % 60}s`;
}
const sameLineup = (a, b) =>
  !!a &&
  a.captain_id === b.captain_id &&
  a.selected_riders.length === b.selected_riders.length &&
  a.selected_riders.every((id) => b.selected_riders.includes(id)) &&
  JSON.stringify(draftOrders(a.orders,b.selected_riders,b.captain_id)) === JSON.stringify(b.orders);

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
  const [returnFilter,setReturnFilter]=useState("");
  const [stage, setStage] = useState(null),
    [gameDate, setGameDate] = useState(null),
    [entryLoading, setEntryLoading] = useState(false),
    [entryError, setEntryError] = useState("");
  const [selected, setSelected] = useState([]),
    [captain, setCaptain] = useState(""),
    [saved, setSaved] = useState(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [orderDraft,setOrderDraft]=useState(null);
  const [reveal,setReveal]=useState(null),
    [revealLoading,setRevealLoading]=useState(false),
    [revealError,setRevealError]=useState("");
  const orders=draftOrders(orderDraft,selected,captain);
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
        api("/api/events?limit=100"),
        api("/api/game-date"),
      ]);
      const oneDay=data.events.filter((e) => e.kind === "one_day");
      setEvents(oneDay);
      const requestedId=new URLSearchParams(window.location.search).get("event_id");
      const requested=oneDay.find(e=>e.id===requestedId);
      if(requested){
        setGender(requested.gender);
        setBucket(requested.status!=="OPEN"?"finished":
          Date.parse(requested.deadline)<=Date.parse(data.server_time)?"pending":"upcoming");
        setEventId(requested.id);
      }else if(requestedId)setError("This race is not available in the current calendar.");
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
    const requestedFilter = new URLSearchParams(window.location.search).get("return_filter");
    if(["All","Men","Women","UCI","Pelotonia","Stage races","My races"].includes(requestedFilter))
      setReturnFilter(requestedFilter);
    if (requestedGender === "M" || requestedGender === "F") setGender(requestedGender);
    load();
  }, []);
  const event = events.find((e) => e.id === eventId),
    twoPhase = Boolean(event?.registration_deadline && event?.tactics_deadline),
    canRegister = Boolean(event?.status === "OPEN" && Date.parse(event.deadline) > now),
    canPrepare = Boolean(twoPhase && event?.status === "OPEN" && saved?.event_id === eventId
      && reveal?.phase === "preparation" && Date.parse(event.tactics_deadline) > now),
    canWatchTwoPhase = Boolean(twoPhase && saved?.event_id === eventId
      && reveal?.phase === "race_due" && Date.parse(event.scheduled_at) <= now),
    locked = !event || !(canRegister || canPrepare);
  useEffect(() => {
    const abort = new AbortController();
    setSelected([]);
    setOrderDraft(null);
    setCaptain("");
    setSaved(null);
    setReveal(null);
    setRevealError("");
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
        setSaved(entry.entry ? { ...entry.entry, event_id: eventId } : null);
        setOrderDraft(entry.entry?.orders || null);
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
  useEffect(() => {
    const abort = new AbortController();
    setReveal(null);
    setRevealError("");
    if (!twoPhase || saved?.event_id !== eventId) {
      setRevealLoading(false);
      return;
    }
    setRevealLoading(true);
    const refresh = () => api(`/api/event/reveal?event_id=${eventId}`, { signal: abort.signal })
      .then(async (initial) => {
        if (initial.phase !== "reveal_pending") return initial;
        try {
          await api("/api/event/reveal/prepare", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event_id: eventId }),
            signal: abort.signal,
          });
        } catch (error) {
          if (error.status !== 409) throw error;
          return initial;
        }
        return api(`/api/event/reveal?event_id=${eventId}`, { signal: abort.signal });
      })
      .then((data) => {
        if (!abort.signal.aborted) { setReveal(data); setRevealError(""); }
      })
      .catch((error) => { if (!abort.signal.aborted) setRevealError(error.message); })
      .finally(() => { if (!abort.signal.aborted) setRevealLoading(false); });
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => { abort.abort(); clearInterval(timer); };
  }, [eventId, twoPhase, saved]);
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
    orders,
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
      await api(canPrepare ? "/api/event/tactics" : "/api/event/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          team_id: team.id,
          selected_riders: selected,
          captain_id: captain,
    orders,
        }),
      });
      setSaved({ event_id: eventId, selected_riders: [...selected], captain_id: captain, orders });
      setNotice(
        canPrepare
          ? "Your updated lineup and orders are saved until tactics close."
          : twoPhase
            ? "Your team is registered. Divisions will be revealed after registration closes."
            : "Your team is entered. You can change your lineup and orders until the deadline.",
      );
    } catch (e) {
      setNotice(e.message);
      if (e.status === 409) setNow(Date.now() + offset);
    } finally {
      setBusy(false);
    }
  }
  return (
    <TeamShell compact>
      <div className="race-calendar">
      <Link className="text-button" href={returnFilter?`/team/calendar?filter=${encodeURIComponent(returnFilter)}`:"/team/calendar"}>← Back to race calendar</Link>
      <header className="calendar-hero">
        <Image src="/images/race-countryside-v1.png" alt="" fill sizes="(max-width: 760px) 100vw, 1200px" priority />
        <div><p className="eyebrow">THE NEXT CHAPTER</p><h1>Race day starts<br/><em>with you.</em></h1><p>Read the road. Pick your eight. Give your captain a chance to shine.</p></div>
        <span className="calendar-hero-note">PLAN BEFORE THE DEADLINE · WATCH IT UNFOLD</span>
      </header>
      <ol className="race-steps" aria-label="Your race plan">
        <li aria-current={!event ? "step" : undefined}><span>01</span><div><strong>Find your race</strong><small>A route to suit your squad.</small></div></li>
        <li aria-current={event && !saved ? "step" : undefined}><span>02</span><div><strong>Choose your eight</strong><small>One captain. A shared ambition.</small></div></li>
        <li aria-current={saved ? "step" : undefined}><span>03</span><div><strong>Watch it unfold</strong><small>{twoPhase ? "Meet your division, then set final tactics." : "All decisions lock at the deadline."}</small></div></li>
      </ol>
      <div className="calendar-toolbar">
        <div className="segmented" aria-label="Category">
          {[
            ["M", "Men"],
            ["F", "Women"],
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
            ["upcoming", "Open entries"],
            ["pending", "Awaiting race"],
            ["finished", "Finished"],
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
          Refresh
        </button>
      </div>
      {error && (
        <p role="alert" className="form-message error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading the race calendar…</p>
      ) : !list.length ? (
        <div className="card empty-state">
          <h2>
            {bucket === "upcoming"
              ? "Your next race day is on its way"
              : "No races here yet"}
          </h2>
          <p>
            {bucket === "upcoming"
              ? "There are no open races in this category yet. Browse past races or get to know your riders."
              : "Choose another category to see races."}
          </p>
          <Link className="btn" href="/team/portraits">
            Meet your riders →
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
                {e.gender === "F" ? "Women" : "Men"} · One-day race
              </span>
              <h2>{e.name}</h2>
              <span className="event-date">{date(e.deadline)}</span>
              <span className="event-meta">
                <span>
                  {e.status === "FINISHED"
                    ? "Ready to watch"
                    : Date.parse(e.deadline) <= now
                      ? e.tactics_deadline && Date.parse(e.tactics_deadline) > now
                        ? "Registration closed · tactics window"
                        : "Entries closed"
                      : `Deadline in ${countdown(e.deadline, now)}`}
                </span>
                <strong>
                  {Number(e.entry_fee) > 0 ? `${e.entry_fee} coins` : "Free"}
                </strong>
              </span>
              <span className="event-action">
                {e.status === "FINISHED"
                  ? "Open race day"
                  : "View route and select lineup"}{" "}
                →
              </span>
            </button>
          ))}
        </div>
      )}
      {event && (
        <section id="race-preparation" className="race-preparation" aria-label="Race preparation">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {event.gender === "F" ? "Women’s" : "Men’s"} race day
              </p>
              <h2>{event.name}</h2>
            </div>
            <span className="deadline-badge">
              {canPrepare
                ? `Tactics close in ${countdown(event.tactics_deadline, now)}`
                : locked
                  ? "Entries closed"
                  : `Deadline in ${countdown(event.deadline, now)}`}
            </span>
          </div>
          {entryLoading ? (
            <p role="status">Loading the route and your saved lineup…</p>
          ) : entryError ? (
            <p role="alert" className="form-message error">
              {entryError}
            </p>
          ) : (
            <>
              {stage && <StageProfile stage={stage} />}
              {twoPhase && saved && <DivisionReveal view={reveal} error={revealError}
                loading={revealLoading} myTeamId={team?.id} />}
              {!locked && <a className="lineup-jump" href="#race-lineup">Build your lineup <span aria-hidden="true">↓</span></a>}
              {event.status === "FINISHED" ? (
                <div className="card race-ready">
                  <h2>The race is ready</h2>
                  <p>
                    Follow your division in the viewer, or go straight to
                    the results.
                  </p>
                  <Link className="btn primary" href={`/team/view/${event.id}`}>
                    Watch the race →
                  </Link>
                  <Link
                    className="text-button"
                    href={`/team/results/${event.id}`}
                  >
                    Results
                  </Link>
                </div>
              ) : (
                <>
                  {locked && saved && (!twoPhase || canWatchTwoPhase) && (
                    <section className="card race-ready">
                      <h2>{twoPhase ? "Race day is here" : "Your lineup is locked"}</h2>
                      <p>
                        Open race day to watch the race. The full race is calculated and
                        saved before playback begins.
                      </p>
                      <Link
                        className="btn primary"
                        href={`/team/view/${event.id}`}
                      >
                        Watch the race →
                      </Link>
                    </section>
                  )}
                  <section id="race-lineup" className="card lineup-summary">
                    <div className="panel-heading">
                      <div>
                        <h2>Your lineup</h2>
                        <p className="small">
                          Eight riders and one captain. Your captain’s time determines
                          your team’s placing.
                        </p>
                      </div>
                      <span
                        className={`save-badge ${unchanged ? "saved" : ""}`}
                      >
                        {saved
                          ? unchanged
                            ? "Saved ✓"
                            : "Unsaved changes"
                          : "Not entered"}
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
                                    ? "★ Captain"
                                    : "Choose captain"}
                                </button>
                                <button
                                  className="remove-rider"
                                  aria-label={`Remove ${rider.name}`}
                                  disabled={locked || busy}
                                  onClick={() => toggle(rider.id)}
                                >
                                  ×
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="empty-slot">{i + 1}</span>
                                <span>Available place</span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <RaceOrders orders={orders} riders={selected.map(id=>riders.find(r=>r.id===id)).filter(Boolean)} onChange={setOrderDraft} disabled={locked || busy || entryLoading}
                      lockMessage={twoPhase ? "Saved with your lineup and locked when tactics close." : undefined} />
                    <div className="lineup-save">
                      <span>
                        {selected.length}/8 riders ·{" "}
                        {captain ? "Captain selected" : "Choose captain"}
                        {!saved && Number(event.entry_fee) > 0
                          ? ` · Cost ${event.entry_fee} coins`
                          : ""}
                      </span>
                      <button
                        className="btn primary"
                        disabled={locked || !valid || busy || unchanged}
                        onClick={save}
                      >
                        {busy
                          ? "Saving…"
                          : locked
                            ? twoPhase ? "Tactics unavailable" : "Deadline passed"
                            : saved
                              ? "Save changes"
                              : "Enter team"}
                      </button>
                    </div>
                    <p className="small">
                      {twoPhase
                        ? canPrepare
                          ? "Your division is set. You can change this lineup and these orders until tactics close, at no extra cost."
                          : canRegister
                            ? "The entry fee is paid only once. Registration closes before divisions are revealed."
                            : "Changes are closed until your division is revealed, or after the tactics deadline."
                        : locked
                          ? "Your saved lineup is locked. The race can run once at least two teams have entered."
                          : "The entry fee is paid only once. Changes before the deadline cost nothing extra."}
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
                          <h2>Choose your riders</h2>
                          <p className="small">
                            Injured riders cannot be selected. Low fatigue and high
                            form are an advantage.
                          </p>
                        </div>
                        <label>
                          Sort by{" "}
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
                          Select the first eight
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
                                    ? `Injured until ${r.injury_until}`
                                    : `${skills[sortKey]} ${r[sortKey] ?? 0} · Form ${r.form} · Fatigue ${r.fatigue}`}
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
                        <summary>Saved lineups in this browser</summary>
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
      </div>
    </TeamShell>
  );
}
