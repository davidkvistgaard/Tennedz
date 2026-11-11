"use client";
import { useEffect,useState } from "react";
import { api } from "../../../lib/api";
import TeamShell from "../../components/TeamShell";
export default function LeaderboardsPage(){
  const [data,setData]=useState(null),[error,setError]=useState("");
  const [gender,setGender]=useState("M");
  useEffect(()=>{let active=true;setData(null);setError("");api(`/api/leaderboards?gender=${gender}`).then(x=>{if(active)setData(x);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[gender]);
  return <TeamShell title="Rankings"><h1>Earned race points</h1>
    <label>Race category <select value={gender} onChange={e=>setGender(e.target.value)}><option value="M">Men</option><option value="F">Women</option></select></label>
    <p>Team points are added up from completed races in the selected category. In winter races, only riders who finish in the top 30 of their division score points for their team.</p>
    <p role="status">{error || (!data?"Loading rankings…":"")}</p>
    {data && [ ["Team",data.teams],["Riders",data.riders] ].map(([title,rows])=><section className="card" style={{padding:20,marginBottom:16}} key={title}>
      <h2>{title}</h2><ol>{rows.map(r=><li key={r.id}>{r.name} — {r.rating} points</li>)}</ol></section>)}
  </TeamShell>;
}
