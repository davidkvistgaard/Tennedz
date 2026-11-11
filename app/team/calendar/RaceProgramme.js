"use client";

import { useState } from "react";
import { PELOTONIA_SEASONS } from "../../../lib/calendar/season-plan.mjs";
import races from "../../../data/calendar/2027-routes.json";
import RouteProfiles from "./RouteProfiles";

const date = new Intl.DateTimeFormat("en-GB", {day:"numeric",month:"short",timeZone:"UTC"});
const month = new Intl.DateTimeFormat("en-GB", {month:"long",timeZone:"UTC"});
const regions = new Intl.DisplayNames(["en"], {type:"region"});
const countryCodes = {AUS:"AU",BEL:"BE",CAN:"CA",CHN:"CN",CRO:"HR",CZE:"CZ",DEN:"DK",ESP:"ES",FRA:"FR",GBR:"GB",GER:"DE",HUN:"HU",ITA:"IT",JPN:"JP",KSA:"SA",LUX:"LU",MAS:"MY",NED:"NL",NOR:"NO",POL:"PL",SLO:"SI",SUI:"CH",TUR:"TR",UAE:"AE"};
const country = code => countryCodes[code] ? regions.of(countryCodes[code]) : code;
const bySeason = PELOTONIA_SEASONS.map(season => ({
  ...season,
  races: races.filter(race => race.year === season.number),
}));

function RaceRow({ race, expanded, onToggle }) {
  const dates = date.format(new Date(race.start)) +
    (race.end && race.end !== race.start ? ` – ${date.format(new Date(race.end))}` : "");
  const count = race.available.length;
  return <li className="programme-race">
    <div className="programme-race-row">
      <span className="programme-date">{dates}</span>
      <div><strong>{race.name}</strong>
        <small>{country(race.country)} · {race.gender} · {race.format === "stage" ? "Stage race" : "One-day race"}</small></div>
      <span className="programme-tier">{race.tier}</span>
      {count ? <button type="button" aria-expanded={expanded} aria-controls={`programme-route-${race.index}`}
        aria-label={`${race.name}, ${race.gender}, ${count} route profiles`} onClick={onToggle}>
        {count} {count === 1 ? "profile" : "profiles"}{!race.complete && " · partial"}
      </button> : <span className="programme-pending">Profile pending</span>}
    </div>
    <div id={`programme-route-${race.index}`} hidden={!expanded}>
      {expanded && <RouteProfiles race={race}/>}
    </div>
  </li>;
}

export default function RaceProgramme() {
  const [seasonIndex, setSeasonIndex] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [field, setField] = useState("");
  const [format, setFormat] = useState("");
  const [coverage, setCoverage] = useState("");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(null);
  const season = bySeason[seasonIndex];
  const months = Array.from({length:4}, (_, index) => `2027-${String(seasonIndex*4+index+1).padStart(2,"0")}`);
  const term = query.trim().toLocaleLowerCase("en-GB");
  const monthRaces = season.races.filter(race => race.start.startsWith(selectedMonth));
  const visible = monthRaces.filter(race =>
    (!field || race.gender === field) && (!format || race.format === format) &&
    (!coverage || (coverage === "complete" ? race.complete : coverage === "available" ? race.available.length > 0 : race.available.length === 0)) &&
    (!term || `${race.name} ${country(race.country)}`.toLocaleLowerCase("en-GB").includes(term)));
  const profileCount = season.races.reduce((total, race) => total + race.available.length, 0);

  return <section className="programme" aria-labelledby="programme-title">
    <div className="programme-intro">
      <div><h2 id="programme-title">2027 race programme</h2><p>Browse the three Pelotonia years and open a race to explore its route.</p></div>
      <p>Available profiles use 2026 routes as provisional references.</p>
    </div>
    <nav className="programme-seasons" aria-label="Pelotonia year">
      {bySeason.map((item, index) => <button type="button" key={item.number} aria-pressed={seasonIndex === index}
        onClick={() => {setSeasonIndex(index); setSelectedMonth(""); setExpanded(null);}}>
        <strong>{item.label}</strong><span>{item.months}</span><small>{item.races.length} races</small>
      </button>)}
    </nav>
    <h3 className="programme-season-title">{season.label} <span>{season.months} · {profileCount} profiles</span></h3>
    <nav className="programme-months" aria-label="Month">
      <button type="button" aria-pressed={!selectedMonth} onClick={() => setSelectedMonth("")}>All months</button>
      {months.map(key => <button type="button" key={key} aria-pressed={selectedMonth === key}
        onClick={() => setSelectedMonth(key)}>{month.format(new Date(`${key}-01`))}</button>)}
    </nav>
    <div className="programme-filters">
      <label>Search races or countries<input type="search" value={query} onChange={event => setQuery(event.target.value)}/></label>
      <label>Field<select value={field} onChange={event => setField(event.target.value)}>
        <option value="">All fields</option><option>Men</option><option>Women</option></select></label>
      <label>Format<select value={format} onChange={event => setFormat(event.target.value)}>
        <option value="">All formats</option><option value="one_day">One-day race</option><option value="stage">Stage race</option></select></label>
      <label>Coverage<select value={coverage} onChange={event => setCoverage(event.target.value)}>
        <option value="">All races</option><option value="available">With profiles</option>
        <option value="complete">Complete profiles</option><option value="pending">Awaiting profiles</option></select></label>
    </div>
    <p className="programme-count" role="status">{visible.length} of {monthRaces.length} races</p>
    {visible.length ? <ul className="programme-list">{visible.map(race =>
      <RaceRow key={race.index} race={race} expanded={expanded === race.index}
        onToggle={() => setExpanded(expanded === race.index ? null : race.index)}/>)}</ul>
      : <p>{monthRaces.length ? "No races match these filters." : "No races are scheduled to start this month."}</p>}
  </section>;
}
