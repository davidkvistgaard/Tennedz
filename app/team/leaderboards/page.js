"use client";
import { useEffect,useState } from "react";
import { api } from "../../../lib/api";
import TeamShell from "../../components/TeamShell";
export default function LeaderboardsPage(){
  const [data,setData]=useState(null),[error,setError]=useState("");
  useEffect(()=>{let active=true;api("/api/leaderboards").then(x=>{if(active)setData(x);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  return <TeamShell title="Ranglister"><h1>Optjente løbspoint</h1><p role="status">{error || (!data?"Henter ranglister…":"")}</p>
    {data && [ ["Hold",data.teams],["Ryttere",data.riders] ].map(([title,rows])=><section className="card" style={{padding:20,marginBottom:16}} key={title}>
      <h2>{title}</h2><ol>{rows.map(r=><li key={r.id}>{r.name} — {r.rating} point</li>)}</ol></section>)}
  </TeamShell>;
}
