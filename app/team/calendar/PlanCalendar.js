"use client";
import {useMemo,useState} from "react";
import {PELOTONIA_SEASONS,openOneDaySlots} from "../../../lib/calendar/season-plan.mjs";

const dateLabel=date=>new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"});
const monthLabel=date=>new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB",{month:"long",timeZone:"UTC"});
const kindLabel=kind=>kind==="stage_race"?"Stage race":"One-day race";

export default function PlanCalendar({plan}){
  const [seasonNumber,setSeasonNumber]=useState(1);
  const [selectedMonth,setSelectedMonth]=useState("2027-01");
  const [gender,setGender]=useState("all"),[format,setFormat]=useState("all");
  const season=PELOTONIA_SEASONS.find(item=>item.number===seasonNumber);
  const monthOptions=Array.from({length:4},(_,index)=>{
    const month=String(Number(season.start.slice(5,7))+index).padStart(2,"0");
    return `2027-${month}`;
  });
  const seasonRaces=useMemo(()=>plan.races.filter(race=>race.season===seasonNumber),[plan,seasonNumber]);
  const visible=useMemo(()=>seasonRaces.filter(race=>
    race.planned_date.startsWith(selectedMonth)&&
    (gender==="all"||race.gender===gender)&&(format==="all"||race.format===format))
    .sort((a,b)=>a.planned_date.localeCompare(b.planned_date)||a.name.localeCompare(b.name)),
  [seasonRaces,selectedMonth,gender,format]);
  const months=useMemo(()=>{
    const grouped=new Map();
    for(const race of visible){const month=race.planned_date.slice(0,7);
      if(!grouped.has(month))grouped.set(month,[]);grouped.get(month).push(race);}
    return [...grouped];
  },[visible]);
  const highlights=seasonRaces.filter(race=>race.class==="LEGEND")
    .sort((a,b)=>a.planned_date.localeCompare(b.planned_date));
  const openSlots=openOneDaySlots(plan.races,season);
  return <div className="plan-calendar">
    <header className="plan-intro"><div><p className="identity-eyebrow">2027 CALENDAR · WORKING PLAN</p>
      <h1>Three years. One road.</h1>
      <p>Follow the real cycling calendar through three Pelotonia seasons. Original Pelotonia races will fill the open slots and bring more variety to the road.</p></div>
      <div className="plan-draft-note"><strong>Planning preview</strong><span>Dates, names and classes are provisional. These races are not open for registration.</span></div>
    </header>
    <nav className="plan-seasons" aria-label="Pelotonia year">{PELOTONIA_SEASONS.map(item=>
      <button type="button" key={item.number} aria-pressed={seasonNumber===item.number}
        onClick={()=>{setSeasonNumber(item.number);setSelectedMonth(item.start.slice(0,7));}}>
        <span>YEAR {item.number}</span><strong>{item.months}</strong>
        <small>{plan.races.filter(race=>race.season===item.number).length} selected races</small>
      </button>)}</nav>
    <section className="plan-overview" aria-labelledby="plan-season-title"><div className="plan-overview-main">
      <p className="identity-eyebrow">SEASON {season.number} / 3</p><h2 id="plan-season-title">{season.label}</h2>
      <p>{season.months} 2027 · a distinct season with its own future rankings and results.</p>
      <div className="plan-metrics"><span><strong>{seasonRaces.length}</strong> selected races</span>
        <span><strong>{seasonRaces.filter(race=>race.format==="stage_race").length}</strong> stage races</span>
        <span><strong>{openSlots}</strong> open one-day slots</span></div>
      <p className="plan-footnote">Open slots are Wednesday and Sunday opportunities for men and women awaiting original Pelotonia races.</p>
    </div><div className="plan-highlights"><h3>Season highlights</h3>
      {highlights.length?<ul>{highlights.map((race,index)=><li key={`${race.name}-${index}`}>
        <span>{dateLabel(race.planned_date)} · {race.gender==="F"?"Women":"Men"}</span>
        <strong>{race.name}</strong></li>)}</ul>:<p>Highlights will be chosen as the season is completed.</p>}
    </div></section>
    <div className="plan-list-head"><div><p className="identity-eyebrow">THE RACE SCHEDULE</p>
      <h2>Explore the season</h2></div><div className="plan-selects">
      <label>Category <select value={gender} onChange={event=>setGender(event.target.value)}>
        <option value="all">Men & women</option><option value="M">Men</option><option value="F">Women</option>
      </select></label><label>Format <select value={format} onChange={event=>setFormat(event.target.value)}>
        <option value="all">All races</option><option value="one_day">One-day</option><option value="stage_race">Stage races</option>
      </select></label></div></div>
    <nav className="plan-month-picker" aria-label="Month">{monthOptions.map(month=><button type="button"
      key={month} aria-pressed={selectedMonth===month} onClick={()=>setSelectedMonth(month)}>
      {monthLabel(`${month}-01`)}<span>{seasonRaces.filter(race=>race.planned_date.startsWith(month)).length}</span>
    </button>)}</nav>
    <p className="plan-result-count" role="status">{visible.length} selected races in this view</p>
    {months.length?months.map(([month,races])=><section className="plan-month" key={month}>
      <h3>{monthLabel(`${month}-01`)} <span>{races.length} races</span></h3>
      <div className="plan-race-list">{races.map((race,index)=><article className="plan-race" key={`${race.name}-${race.gender}-${index}`}>
        <div className="plan-race-date"><strong>{dateLabel(race.planned_date)}</strong>
          {race.format==="stage_race"&&race.source_end!==race.source_start&&<span>to {dateLabel(race.source_end)}</span>}</div>
        <div className="plan-race-name"><h4>{race.name}</h4><span>{race.country} · {kindLabel(race.format)}</span></div>
        <div className="plan-race-tags"><span>{race.gender==="F"?"Women":"Men"}</span><strong>{race.class}</strong></div>
      </article>)}</div>
    </section>):<p className="card agenda-empty">No selected races match these filters.</p>}
    <p className="plan-source">Working selection from the supplied 2027 workbook. Real-world dates and naming rights must be reviewed before publication. Race classes shown here do not yet map to live points.</p>
  </div>;
}
