"use client";
import {useState} from "react";
import {PELOTONIA_SEASONS} from "../../../lib/calendar/season-plan.mjs";

const monthFormatter=new Intl.DateTimeFormat("en-GB",{month:"long",timeZone:"UTC"});
const dateFormatter=new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",timeZone:"UTC"});
const monthLabel=key=>monthFormatter.format(new Date(`${key}-01T12:00:00Z`));
const dateLabel=date=>dateFormatter.format(new Date(`${date}T12:00:00Z`));
const tiers=["LEGEND","GOLD","SILVER","BRONZE"];

function RaceRow({race}){
  const dates=dateLabel(race.start)+(race.start===race.end?"":` – ${dateLabel(race.end)}`);
  return <li className="plan-race-row">
    <span className="plan-race-date">{dates}</span>
    <div><strong>{race.name}</strong><small>{race.country} · {race.gender} · {race.format==="stage"?"Stage race":"One-day race"}</small></div>
    <span className="plan-tier" data-tier={race.tier}>{race.tier}</span>
  </li>;
}

export default function PlanCalendar({races}){
  const [seasonNumber,setSeasonNumber]=useState(1);
  const [selectedMonth,setSelectedMonth]=useState("2027-01");
  const [gender,setGender]=useState("");
  const [format,setFormat]=useState("");
  const [tier,setTier]=useState("");
  const season=PELOTONIA_SEASONS.find(item=>item.number===seasonNumber);
  const seasonRaces=races.filter(race=>race.year===seasonNumber);
  const months=Array.from({length:4},(_,i)=>`2027-${String((seasonNumber-1)*4+i+1).padStart(2,"0")}`);
  const monthRaces=seasonRaces.filter(race=>race.start.startsWith(selectedMonth));
  const visible=monthRaces.filter(race=>(!gender||race.gender===gender)&&(!format||race.format===format)&&(!tier||race.tier===tier));
  const stageCount=seasonRaces.filter(race=>race.format==="stage").length;
  return <div className="plan-calendar">
    <header className="plan-intro"><div><p className="identity-eyebrow">2027 RACE CALENDAR</p>
      <h1>Three years. One road.</h1>
      <p>Browse the {races.length} scheduled races across Pelotonia’s three seasons.</p></div>
      <div className="plan-draft-note"><strong>Season programme</strong><span>Dates follow the Pelotonia calendar. Entry opens separately in Calendar &amp; races.</span></div>
    </header>
    <nav className="plan-seasons" aria-label="Pelotonia year">{PELOTONIA_SEASONS.map(item=>{
      const count=races.filter(race=>race.year===item.number).length;
      return <button type="button" key={item.number} aria-pressed={seasonNumber===item.number}
        onClick={()=>{setSeasonNumber(item.number);setSelectedMonth(item.start.slice(0,7));}}>
        <span>YEAR {item.number}</span><strong>{item.months}</strong><small>{count} races</small>
      </button>;
    })}</nav>
    <section className="plan-overview" aria-labelledby="plan-season-title"><div className="plan-overview-main">
      <p className="identity-eyebrow">SEASON {season.number} / 3</p><h2 id="plan-season-title">{season.label}</h2>
      <p>{season.months} 2027</p>
      <div className="plan-metrics"><span><strong>{seasonRaces.length}</strong> races</span>
        <span><strong>{seasonRaces.length-stageCount}</strong> one-day races</span>
        <span><strong>{stageCount}</strong> stage races</span></div>
    </div><div className="plan-highlights"><h3>Race dates</h3>
      <p>One-day races are scheduled for Wednesday or Sunday. Stage races retain their start and finish dates.</p>
    </div></section>
    <div className="plan-list-head"><div><p className="identity-eyebrow">THE SEASON RHYTHM</p><h2>Explore the months</h2></div></div>
    <nav className="plan-month-picker" aria-label="Month">{months.map(month=><button type="button"
      key={month} aria-pressed={selectedMonth===month} onClick={()=>setSelectedMonth(month)}>
      {monthLabel(month)}<span>{seasonRaces.filter(race=>race.start.startsWith(month)).length}</span></button>)}</nav>
    <section className="plan-month" aria-labelledby="plan-month-title"><h3 id="plan-month-title">{monthLabel(selectedMonth)} <span>2027</span></h3>
      <div className="plan-race-filters">
        <label>Field<select value={gender} onChange={event=>setGender(event.target.value)}>
          <option value="">All fields</option><option>Men</option><option>Women</option></select></label>
        <label>Format<select value={format} onChange={event=>setFormat(event.target.value)}>
          <option value="">All formats</option><option value="one_day">One-day race</option><option value="stage">Stage race</option></select></label>
        <label>Class<select value={tier} onChange={event=>setTier(event.target.value)}>
          <option value="">All classes</option>{tiers.map(value=><option key={value}>{value}</option>)}</select></label>
      </div>
      <p className="plan-race-count" role="status">{visible.length} of {monthRaces.length} races</p>
      {visible.length>0 ? <ul className="plan-race-list">{visible.map(race=>
        <RaceRow key={`${race.start}:${race.gender}:${race.name}`} race={race}/>)}</ul>:
        <p>{monthRaces.length?"No races match these filters.":"No races are scheduled to start this month."}</p>}
    </section>
    <p className="plan-source">Each race is listed by its scheduled start date. Source: Pelotonia’s 2027 race calendar.</p>
  </div>;
}
