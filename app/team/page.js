"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TeamShell from "../components/TeamShell";
import RiderAvatar from "../components/RiderAvatar";
import { useAuth } from "../components/AuthProvider";
import { teamRating } from "../../lib/race/rating.mjs";
import { api } from "../../lib/api";
import "../identity.css";

const EMPTY = [];
const SKILLS = [["rating","Resultatpoint"],["sprint","Sprint"],["flat","Flad vej"],["hills","Bakker"],["mountain","Bjerge"],["cobbles","Brosten"],["timetrial","Enkeltstart"],["endurance","Udholdenhed"],["strength","Styrke"],["wind","Vind"],["form","Form"],["fatigue","Træthed"]];
const value = (r,k) => Number.isFinite(Number(r[k])) ? Number(r[k]) : 0;
const format = n => Number(n ?? 0).toLocaleString("da-DK");

function NextRace({ gender }) {
  const [calendar,setCalendar] = useState({loading:true,events:[],error:"",offset:0});
  const [now,setNow] = useState(0);
  useEffect(()=>{
    let active=true;
    api("/api/events?limit=100").then(data=>{
      if(active) {setCalendar({loading:false,events:data.events||[],error:"",offset:Date.parse(data.server_time)-Date.now()});setNow(Date.now());}
    }).catch(()=>{if(active)setCalendar({loading:false,events:[],error:"Kalenderen kunne ikke hentes. Prøv igen fra løbskalenderen.",offset:0});});
    const timer=setInterval(()=>setNow(Date.now()),1000);
    return ()=>{active=false;clearInterval(timer);};
  },[]);
  const next = calendar.events.filter(e=>e.kind==="one_day" && e.status==="OPEN" && e.gender===gender && Date.parse(e.deadline)>now+calendar.offset).sort((a,b)=>Date.parse(a.deadline)-Date.parse(b.deadline))[0];
  return <section className="club-race" aria-label="Næste løb">
    <p className="identity-eyebrow">NÆSTE KAPITEL · {gender==="M"?"HERRER":"KVINDER"}</p>
    <h2>{calendar.loading?"Henter næste løbsdag…":next?.name || (calendar.error?"Kalenderen er ikke tilgængelig":"Landevejen venter på jer")}</h2>
    <p>{calendar.error || (next ? `Udtag otte ryttere og en kaptajn inden ${new Date(next.deadline).toLocaleString("da-DK",{timeZone:"Europe/Copenhagen",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"})} (dansk tid).` : calendar.loading?"":"Der er endnu ingen åbne endagsløb for denne trup. Lær rytterne at kende, og følg kalenderen for næste løbsdag.")}</p>
    <Link className="btn" href={`/team/run?gender=${gender}`}>{next?"Til løb og holdudtagelse":"Åbn løbskalenderen"} ↗</Link>
  </section>;
}
function SquadRider({ rider }) {
  return <article className="club-rider">
    <div className="club-rider-art"><RiderAvatar rider={rider} size={160}/></div>
    <div className="club-rider-body"><div className="club-rider-meta">{rider.country_code || "Land ikke angivet"} · {rider.age?`${rider.age} år`:"Alder ukendt"}</div><h3>{rider.display_name || rider.name || "Unavngiven rytter"}</h3>
      <div className="club-rider-points"><strong>{format(rider.rating)}</strong> resultatpoint</div>
      <details><summary>Se egenskaber</summary><dl>{SKILLS.slice(1).map(([key,label])=><div className="club-skill" key={key}><dt>{label}</dt><dd>{rider[key] == null ? "—" : format(rider[key])}</dd></div>)}</dl></details>
    </div>
  </article>;
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
  const visible=useMemo(()=>riders.filter(r=>r.gender===gender && (r.display_name||r.name||"").toLocaleLowerCase("da").includes(query.trim().toLocaleLowerCase("da"))).sort((a,b)=>(direction==="ASC"?1:-1)*(value(a,sort)-value(b,sort))),[riders,gender,query,sort,direction]);
  async function reload(){setBusy(true);setStatus("Opdaterer holdet…");try{const result=await refresh();setStatus(result?"Holdet er opdateret.":"Holdet kunne ikke opdateres.");}catch{setStatus("Holdet kunne ikke opdateres.");}finally{setBusy(false);}}
  async function signOut(){setBusy(true);try{await logout();}catch{setStatus("Kunne ikke logge ud. Prøv igen.");setBusy(false);}}
  if(!team) return null;
  return <TeamShell compact>
    <div className="club-heading"><div><p className="identity-eyebrow">HOLDKONTORET · MIT HOLD</p><h1>{team.name}</h1></div><div className="club-actions"><button className="btn" disabled={busy} onClick={reload}>Opdatér</button><button className="btn" disabled={busy} onClick={signOut}>Log ud</button></div></div>
    <p role="status" className="club-status">{status}</p>
    <div className="club-overview"><NextRace gender={gender}/><section className="club-stats" aria-label="Holdets overblik"><div><span>Holdbudget</span><strong>{format(team.budget)}</strong><small>Coins: {format(team.coins)}</small></div>{[["M","Herrer"],["F","Kvinder"]].map(([g,label])=><div key={g}><span>{label} · {riders.filter(r=>r.gender===g).length} ryttere</span><strong>{format(teamRating(riders,g))}</strong><small>holdrating · resultatpoint</small></div>)}</section></div>
    <section aria-labelledby="club-roster-title"><div className="club-roster-title"><h2 id="club-roster-title">Menneskene bag holdet</h2><p>To trupper. Hver deres løb. Én fælles ambition.</p></div>
      <div className="club-toolbar"><div className="club-genders" role="group" aria-label="Vælg trup"><button aria-pressed={gender==="M"} onClick={()=>setGender("M")}>Herrer</button><button aria-pressed={gender==="F"} onClick={()=>setGender("F")}>Kvinder</button></div><label>Søg rytter<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find et navn…"/></label><label>Sortér efter<select value={sort} onChange={e=>setSort(e.target.value)}>{SKILLS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Rækkefølge<select value={direction} onChange={e=>setDirection(e.target.value)}><option value="DESC">Høj → lav</option><option value="ASC">Lav → høj</option></select></label></div>
      <p className="small" aria-live="polite">{visible.length} ryttere · {gender==="M"?"Herretruppen":"Kvindetruppen"}</p>
      <div className="club-roster">{visible.map(r=><SquadRider key={r.id} rider={r}/>)}</div>
      {!visible.length && <p className="club-empty">{query?"Ingen ryttere matcher din søgning.":"Der er ingen ryttere i denne trup endnu."}</p>}
      <p className="identity-note">Holdrating er summen af de 16 bedst ratede ryttere i hver trup. Form og træthed påvirker løbet, ikke resultatpoint.</p>
    </section>
  </TeamShell>;
}
