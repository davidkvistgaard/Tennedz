"use client";
import {useState} from "react";
import {PELOTONIA_SEASONS} from "../../../lib/calendar/season-plan.mjs";

const monthLabel=key=>new Date(`${key}-01T12:00:00Z`).toLocaleDateString("en-GB",{month:"long",timeZone:"UTC"});
const total=(months,key)=>months.reduce((sum,month)=>sum+month[key],0);
const seasonFocus={
  1:"The opening months bring spring racing and the first stage-race campaigns.",
  2:"The middle season centres on summer stage racing and long-distance challenges.",
  3:"Autumn racing leads into space for original Pelotonia events at the end of the year.",
};

function oneDayDates(monthKey){
  const [year,month]=monthKey.split("-").map(Number);
  const last=new Date(Date.UTC(year,month,0)).getUTCDate();
  const dates=[];
  for(let day=1;day<=last;day++){
    const weekday=new Date(Date.UTC(year,month-1,day)).getUTCDay();
    if(weekday===0||weekday===3)dates.push({day,weekday:weekday===3?"Wed":"Sun"});
  }
  return dates;
}

export default function PlanCalendar({outline}){
  const [seasonNumber,setSeasonNumber]=useState(1);
  const [selectedMonth,setSelectedMonth]=useState("2027-01");
  const season=PELOTONIA_SEASONS.find(item=>item.number===seasonNumber);
  const seasonData=outline.seasons.find(item=>item.number===seasonNumber);
  const month=seasonData.months.find(item=>item.key===selectedMonth);
  return <div className="plan-calendar">
    <header className="plan-intro"><div><p className="identity-eyebrow">2027 CALENDAR · EARLY LOOK</p>
      <h1>Three years. One road.</h1>
      <p>Pelotonia will have three seasons each calendar year. Real-world racing guides the programme; original Pelotonia events will add variety between its highlights.</p></div>
      <div className="plan-draft-note"><strong>Work in progress</strong><span>This is the season structure, not a published race schedule. Dates, race names and rankings are still being prepared.</span></div>
    </header>
    <nav className="plan-seasons" aria-label="Pelotonia year">{PELOTONIA_SEASONS.map(item=>{
      const count=total(outline.seasons.find(row=>row.number===item.number).months,"candidates");
      return <button type="button" key={item.number} aria-pressed={seasonNumber===item.number}
        onClick={()=>{setSeasonNumber(item.number);setSelectedMonth(item.start.slice(0,7));}}>
        <span>YEAR {item.number}</span><strong>{item.months}</strong><small>{count} races under review</small>
      </button>;
    })}</nav>
    <section className="plan-overview" aria-labelledby="plan-season-title"><div className="plan-overview-main">
      <p className="identity-eyebrow">SEASON {season.number} / 3</p><h2 id="plan-season-title">{season.label}</h2>
      <p>{season.months} 2027 · a separate Pelotonia season with its own future highlights, results and rankings.</p>
      <div className="plan-metrics"><span><strong>{total(seasonData.months,"candidates")}</strong> races under review</span>
        <span><strong>{total(seasonData.months,"stage_races")}</strong> stage-race candidates</span>
        <span><strong>{total(seasonData.months,"open_one_day_slots")}</strong> open one-day slots</span></div>
      <p className="plan-footnote">Open slots are planned Wednesday and Sunday opportunities for men and women. They are not registered events yet.</p>
    </div><div className="plan-highlights"><h3>Season direction</h3><p>{seasonFocus[season.number]}</p>
      <p>Named highlights and their dates will appear when the calendar is reviewed.</p>
    </div></section>
    <div className="plan-list-head"><div><p className="identity-eyebrow">THE SEASON RHYTHM</p><h2>Explore the months</h2></div></div>
    <nav className="plan-month-picker" aria-label="Month">{seasonData.months.map(item=><button type="button"
      key={item.key} aria-pressed={selectedMonth===item.key} onClick={()=>setSelectedMonth(item.key)}>
      {monthLabel(item.key)}<span>{item.candidates}</span></button>)}</nav>
    <section className="plan-month" aria-labelledby="plan-month-title"><h3 id="plan-month-title">{monthLabel(month.key)} <span>Planning outline</span></h3>
      <div className="plan-month-overview"><div className="plan-month-summary">
        <p>{month.candidates?`${month.candidates} race candidates are being reviewed for this month.`:"This month is reserved for original Pelotonia races still to be designed."}</p>
        <div className="plan-metrics"><span><strong>{month.one_day}</strong> one-day candidates</span>
          <span><strong>{month.stage_races}</strong> stage-race candidates</span>
          <span><strong>{month.open_one_day_slots}</strong> open one-day slots</span></div>
      </div><div className="plan-rhythm"><h4>One-day race rhythm</h4><p>Wednesday and Sunday · separate opportunities for men and women</p>
        <div>{oneDayDates(month.key).map(date=><span key={date.day}><strong>{date.weekday}</strong> {date.day}</span>)}</div>
      </div></div>
    </section>
    <p className="plan-source">Planning counts come from the supplied 2027 workbook. The selected UCI races, names, dates, classes and original Pelotonia events still need review. No entry or ranking points are available from this outline.</p>
  </div>;
}
