"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import StageProfile from "./StageProfile";
import {TIER_WINNER_POINTS} from "../../lib/calendar/points.mjs";

const tierNames={1:"Open",2:"Challenger",3:"Pro",4:"World",5:"Major",6:"Pinnacle"};

export default function RaceCalendarAdmin({ enabled, onCreated }) {
  const [templates, setTemplates] = useState([]),
    [template, setTemplate] = useState("coast"),
    [name, setName] = useState(""),
    [gender, setGender] = useState("BOTH"),
    [deadline, setDeadline] = useState(""),
    [scheduledAt, setScheduledAt] = useState(""),
    [tier, setTier] = useState("1"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const request = useRef(null);
  useEffect(() => {
    let active = true;
    api("/api/admin/race-calendar")
      .then((data) => {
        if (active) setTemplates(data.templates);
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    const day = new Date();
    day.setDate(day.getDate() + 1);
    day.setHours(18, 0, 0, 0);
    setDeadline(
      new Date(day.getTime() - day.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16),
    );
    const race=new Date();
    race.setDate(race.getDate()+7);
    while(![0,3].includes(race.getDay()))race.setDate(race.getDate()+1);
    race.setHours(18,0,0,0);
    setScheduledAt(new Date(race.getTime()-race.getTimezoneOffset()*60000)
      .toISOString().slice(0,16));
    return () => {
      active = false;
    };
  }, []);
  const stage = templates.find((t) => t.id === template);
  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const input = {
        name,
        gender,
        template_id: template,
        deadline: new Date(deadline).toISOString(),
        scheduled_at: new Date(scheduledAt).toISOString(),
        calendar_source: "PELOTONIA",
        race_tier: Number(tier),
      };
      const signature = JSON.stringify(input);
      if (request.current?.signature !== signature)
        request.current = { signature, id: crypto.randomUUID() };
      const result = await api("/api/admin/race-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, request_id: request.current.id }),
      });
      setMessage(
        `${result.event_ids.length} ${result.event_ids.length === 1 ? "race is" : "separate races are"} ${result.already_created ? "already created" : "created"}. Entries are open in the calendar.`,
      );
      await onCreated();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-calendar">
      <h2>Create a race day</h2>
      <p>
        New races are free to enter. Selecting both categories creates two separate races on the same
        route. Routes are fictional, and existing races stay unchanged.
      </p>
      <form onSubmit={create}>
        <fieldset disabled={!enabled || busy} className="calendar-form">
          <label>
            Race name
            <input
              required
              minLength={3}
              maxLength={90}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pelotonia Opening Race"
            />
          </label>
          <label>
            Route
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.distance_km} km
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="BOTH">Men and women · separate races</option>
              <option value="M">Men</option>
              <option value="F">Women</option>
            </select>
          </label>
          <label>
            Entry deadline · your local time
            <input
              required
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
          <label>
            Race day · Wednesday or Sunday · your local time
            <input required type="datetime-local" value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)} />
          </label>
          <label>
            Race tier
            <select value={tier} onChange={(e) => setTier(e.target.value)}>
              {Object.entries(TIER_WINNER_POINTS).map(([number,points])=><option key={number} value={number}>
                T{number} · {tierNames[number]} · {points.toLocaleString("en-GB")} winner points
              </option>)}
            </select>
          </label>
          <button
            className="btn primary"
            disabled={!templates.length}
            type="submit"
          >
            {busy ? "Creating…" : "Create free race day"}
          </button>
        </fieldset>
      </form>
      {message && (
        <p role="status" className="form-message">
          {message}
        </p>
      )}
      {stage && <StageProfile key={stage.id} stage={stage} />}
    </section>
  );
}
