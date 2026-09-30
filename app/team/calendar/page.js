"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import TeamShell from "../../components/TeamShell";
import {api} from "../../../lib/api";
import {PLACING_PERCENT,STAGE_POINTS,TIER_WINNER_POINTS} from "../../../lib/calendar/points.mjs";
import "./calendar.css";

const FILTERS=["All","Men","Women","UCI","Pelotonia","Stage races","My races"];
const displayDate=value=>new Date(value).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",timeZone:"UTC"});
const category=gender=>gender==="F"?"Women":"Men";
function matches(event,filter){
  if(filter==="Men")return event.gender==="M";
  if(filter==="Women")return event.gender==="F";
  if(filter==="UCI")return event.calendar_source==="UCI";
  if(filter==="Pelotonia")return event.calendar_source==="PELOTONIA";
  if(filter==="Stage races")return event.kind==="stage_race";
  if(filter==="My races")return event.team_count>0;
  return true;
}

function EventCard({event,filter}){
  const raceDate=event.scheduled_at??event.deadline;
  const source=event.calendar_source??"Unclassified";
  const tier=event.race_tier?`T${event.race_tier}`:"Unranked";
  const status=event.readiness?.replaceAll("_"," ").toLowerCase();
  const setup=event.kind==="one_day"&&event.status==="OPEN";
  return <article className="agenda-card">
    <div className="agenda-card-top"><span>{category(event.gender)} · {source} · {tier}</span>
      <strong>{event.kind==="stage_race"?"Stage race":"One-day"}</strong></div>
    <h3>{event.name}</h3>
    <p className="agenda-muted">{event.scheduled_at?"Race day":"Entry deadline"} · {displayDate(raceDate)}</p>
    <div className="agenda-readiness"><span>Team <strong>{event.team_count}/{event.team_size}</strong></span>
      <span>Orders <strong>{event.orders_ready?"Ready":"Missing"}</strong></span>
      <span className="agenda-state">{status}</span></div>
    <div className="agenda-card-bottom"><span>{event.winner_points===null?"Ranking points not set":`Winner · ${event.winner_points.toLocaleString("en-GB")} pts`}</span>
      {setup?<Link className="btn primary" href={`/team/run?event_id=${encodeURIComponent(event.id)}&gender=${event.gender}&return_filter=${encodeURIComponent(filter)}`}>Set up →</Link>:
        <span className="agenda-muted">{event.kind==="stage_race"?"Stage setup is in development":event.status==="FINISHED"?"Finished":"Locked"}</span>}</div>
    {event.race_tier&&<details className="agenda-points"><summary>Points table</summary>
      <p>Tier {event.race_tier} · points by placing</p>
      {event.kind==="one_day"?<PointsList values={PLACING_PERCENT.map(percent=>
        Math.round(TIER_WINNER_POINTS[event.race_tier]*percent/100))}/>:
        <div className="agenda-points-stage">
          <section><h4>Final GC</h4><PointsList values={PLACING_PERCENT.map(percent=>
            Math.round(TIER_WINNER_POINTS[event.race_tier]*percent/100))}/></section>
          <section><h4>Each stage</h4><PointsList values={STAGE_POINTS[event.race_tier].stage}/></section>
          <section><h4>Points classification</h4><PointsList values={STAGE_POINTS[event.race_tier].classification}/></section>
          <section><h4>Mountains classification</h4><PointsList values={STAGE_POINTS[event.race_tier].classification}/></section>
        </div>}
    </details>}
  </article>;
}

function PointsList({values}){
  return <ol>{values.map((points,index)=><li key={index}>{index+1}. {points} pts</li>)}</ol>;
}

export default function CalendarPage(){
  const [data,setData]=useState(null),[error,setError]=useState(""),[filter,setFilter]=useState("All");
  useEffect(()=>{const requested=new URLSearchParams(window.location.search).get("filter");
    if(FILTERS.includes(requested))setFilter(requested);},[]);
  useEffect(()=>{let active=true;api("/api/events?limit=100").then(result=>{if(active)setData(result);})
    .catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  const visible=useMemo(()=>{
    const now=Date.parse(data?.server_time??new Date().toISOString());
    const end=now+42*86400000;
    return (data?.events??[]).filter(event=>matches(event,filter)&&
      (event.scheduled_at?Date.parse(event.scheduled_at)>=now-7*86400000&&
        Date.parse(event.scheduled_at)<=end:event.status==="OPEN"))
      .sort((a,b)=>Date.parse(a.scheduled_at??a.deadline)-Date.parse(b.scheduled_at??b.deadline));
  },[data,filter]);
  const groups=useMemo(()=>{
    const result=new Map();
    for(const event of visible){const key=(event.scheduled_at??event.deadline).slice(0,10);
      if(!result.has(key))result.set(key,[]);result.get(key).push(event);}
    return [...result];
  },[visible]);
  return <TeamShell title="Race calendar"><div className="agenda-page">
    <header className="agenda-hero"><p className="identity-eyebrow">THE SEASON AHEAD</p>
      <h1>Every race begins here.</h1><p>Wednesday and Sunday are one-day race days. Stage races follow their own consecutive calendar.</p>
      <Link className="btn" href="/team/defaults">Set your four default teams →</Link></header>
    <nav className="agenda-filters" aria-label="Calendar filters">{FILTERS.map(name=><button key={name}
      aria-pressed={filter===name} onClick={()=>setFilter(name)}>{name}</button>)}</nav>
    {error&&<p role="alert">Could not load the race calendar: {error}</p>}
    {!error&&!data&&<p role="status">Loading the race calendar…</p>}
    {data&&!groups.length&&<section className="card agenda-empty"><h2>No races match this view yet</h2>
      <p>Choose another filter or return when the next events are published.</p></section>}
    {groups.map(([day,events])=><section className="agenda-day" key={day}>
      <h2>{displayDate(day)}</h2><div className="agenda-grid">{events.map(event=><EventCard key={event.id} event={event} filter={filter}/>)}</div>
    </section>)}
  </div></TeamShell>;
}
