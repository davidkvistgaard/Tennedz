"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TeamShell from "../components/TeamShell";
import SquadRider from "../components/SquadRider";
import { useAuth } from "../components/AuthProvider";
import { teamRating } from "../../lib/race/rating.mjs";
import { api } from "../../lib/api";
import "../identity.css";

const EMPTY = [];
const SKILLS = [["rating","Race points"],["sprint","Sprint"],["flat","Flat roads"],["hills","Hills"],["mountain","Mountains"],["cobbles","Cobbles"],["timetrial","Time trial"],["endurance","Endurance"],["strength","Strength"],["wind","Wind"],["form","Form"],["fatigue","Fatigue"]];
const value = (r,k) => Number.isFinite(Number(r[k])) ? Number(r[k]) : 0;
const format = n => Number(n ?? 0).toLocaleString("en-GB");

function NextRace({ gender }) {
  const [calendar,setCalendar] = useState({loading:true,events:[],error:"",offset:0});
  const [now,setNow] = useState(0);
  useEffect(()=>{
    let active=true;
    api("/api/events?limit=100").then(data=>{
      if(active) {setCalendar({loading:false,events:data.events||[],error:"",offset:Date.parse(data.server_time)-Date.now()});setNow(Date.now());}
    }).catch(()=>{if(active)setCalendar({loading:false,events:[],error:"Could not load the calendar. Please try again from the race calendar.",offset:0});});
    const timer=setInterval(()=>setNow(Date.now()),1000);
    return ()=>{active=false;clearInterval(timer);};
  },[]);
  const next = calendar.events.filter(e=>e.kind==="one_day" && e.status==="OPEN" && e.gender===gender && Date.parse(e.deadline)>now+calendar.offset).sort((a,b)=>Date.parse(a.deadline)-Date.parse(b.deadline))[0];
  return <section className="club-race" aria-label="Next race">
    <p className="identity-eyebrow">NEXT CHAPTER · {gender==="M"?"MEN":"WOMEN"}</p>
    <h2>{calendar.loading?"Loading your next race…":next?.name || (calendar.error?"Calendar unavailable":"The road is waiting")}</h2>
    <p>{calendar.error || (next ? `Select eight riders and a captain before ${new Date(next.deadline).toLocaleString("en-GB",{timeZone:"UTC",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"})} (UTC).` : calendar.loading?"":"There are no open one-day races for this squad yet. Get to know your riders and check the calendar for your next race.")}</p>
    <Link className="btn" href={`/team/run?gender=${gender}`}>{next?"Race details and lineup":"Open race calendar"} ↗</Link>
  </section>;
}
export default function TeamPage() {
  const {session,refresh,logout} = useAuth();
  const [gender,setGender] = useState("M");
  const [query,setQuery] = useState("");
  const [sort,setSort] = useState("rating");
  const [direction,setDirection] = useState("DESC");
  const [busy,setBusy] = useState(false);
  const [status,setStatus] = useState("");
  const riders=session?.riders || EMPTY;
  const team=session?.team;
  const visible=useMemo(()=>riders.filter(r=>r.gender===gender && (r.display_name||r.name||"").toLocaleLowerCase("en").includes(query.trim().toLocaleLowerCase("en"))).sort((a,b)=>(direction==="ASC"?1:-1)*(value(a,sort)-value(b,sort))),[riders,gender,query,sort,direction]);
  async function reload(){setBusy(true);setStatus("Refreshing your team…");try{const result=await refresh();setStatus(result?"Your team is up to date.":"Could not refresh your team.");}catch{setStatus("Could not refresh your team.");}finally{setBusy(false);}}
  async function signOut(){setBusy(true);try{await logout();}catch{setStatus("Could not sign out. Please try again.");setBusy(false);}}
  if(!team) return null;
  return <TeamShell compact>
    <div className="club-heading"><div><p className="identity-eyebrow">TEAM OFFICE · MY TEAM</p><h1>{team.name}</h1></div><div className="club-actions"><button className="btn" disabled={busy} onClick={reload}>Refresh</button><button className="btn" disabled={busy} onClick={signOut}>Sign out</button></div></div>
    <p role="status" className="club-status">{status}</p>
    <div className="club-overview"><NextRace gender={gender}/><section className="club-stats" aria-label="Team overview"><div><span>Team budget</span><strong>{format(team.budget)}</strong><small>Coins: {format(team.coins)}</small></div>{[["M","Men"],["F","Women"]].map(([g,label])=><div key={g}><span>{label} · {riders.filter(r=>r.gender===g).length} riders</span><strong>{format(teamRating(riders,g))}</strong><small>team rating · race points</small></div>)}</section></div>
    <section aria-labelledby="club-roster-title"><div className="club-roster-title"><h2 id="club-roster-title">The people behind the team</h2><p>Two squads. Their own races. One shared ambition.</p></div>
      <div className="club-toolbar"><div className="club-genders" role="group" aria-label="Choose squad"><button aria-pressed={gender==="M"} onClick={()=>setGender("M")}>Men</button><button aria-pressed={gender==="F"} onClick={()=>setGender("F")}>Women</button></div><label>Search riders<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a name…"/></label><label>Sort by<select value={sort} onChange={e=>setSort(e.target.value)}>{SKILLS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Order<select value={direction} onChange={e=>setDirection(e.target.value)}><option value="DESC">High → low</option><option value="ASC">Low → high</option></select></label></div>
      <p className="small" aria-live="polite">{visible.length} riders · {gender==="M"?"Men’s squad":"Women’s squad"}</p>
      <div className="club-roster">{visible.map(r=><SquadRider key={r.id} rider={r}/>)}</div>
      {!visible.length && <p className="club-empty">{query?"No riders match your search.":"There are no riders in this squad yet."}</p>}
      <p className="identity-note">Team rating is the sum of the top 16 rider ratings in each squad. Form and fatigue affect racing, not race points.</p>
    </section>
  </TeamShell>;
}
