"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import TeamShell from "../../components/TeamShell";
import {useAuth} from "../../components/AuthProvider";
import {api} from "../../../lib/api";
import "./defaults.css";

const SLOTS=[['M','ONE_DAY','Men · One-day'],['M','STAGE_RACE','Men · Stage race'],
  ['F','ONE_DAY','Women · One-day'],['F','STAGE_RACE','Women · Stage race']];
const key=(gender,format)=>`${gender}:${format}`;
export default function DefaultTeamsPage(){
  const {session}=useAuth(),riders=session?.riders??[];
  const [state,setState]=useState(null),[drafts,setDrafts]=useState({});
  const [error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState("");
  useEffect(()=>{let active=true;api("/api/team/defaults").then(data=>{
    if(!active)return;setState(data);
    setDrafts(Object.fromEntries(data.defaults.map(item=>[key(item.gender,item.event_format),
      {selected:[...item.selected_riders],captain:item.captain_id}])));
  }).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  function update(slot,change){setDrafts(current=>({...current,[slot]:{...current[slot],...change}}));}
  async function save(gender,format){
    const slot=key(gender,format),draft=drafts[slot],size=state.team_sizes[format];
    if(draft?.selected?.length!==size||!draft.selected.includes(draft.captain)){
      setError(`Choose ${size} riders and one captain.`);return;}
    setBusy(slot);setError("");setMessage("");
    try{const result=await api("/api/team/defaults",{method:"PUT",body:JSON.stringify({
      team_id:session.team.id,gender,event_format:format,
      selected_riders:draft.selected,captain_id:draft.captain})});
      setState(current=>({...current,defaults:[...current.defaults.filter(item=>
        key(item.gender,item.event_format)!==slot),result.default]}));
      const saved=`${gender==='M'?'Men':'Women'} ${format==='ONE_DAY'?'one-day':'stage-race'} default saved.`;
      const auto=result.autopilot;
      setMessage(auto?.state==='attempted'&&auto.entered>0
        ?`${saved} Entered ${auto.entered} upcoming race${auto.entered===1?'':'s'}. ${auto.entered<auto.attempted||auto.more_eligible?'Other entries are not confirmed. ':''}Check the calendar for each entry.`
        :auto&&((auto.state!=='attempted')||auto.attempted>0||auto.more_eligible)
          ?`${saved} Automatic entry is not confirmed for every upcoming race. Check the calendar before each deadline.`
          :saved);
    }catch(e){setError(e.message);}finally{setBusy("");}
  }
  return <TeamShell title="Default teams"><div className="defaults-page">
    <header><p className="identity-eyebrow">YOUR TEAM · DEFAULTS</p><h1>Four default squads, one place.</h1>
      <p>Choose your usual riders and captain for each race format. These saved choices are the foundation for future automatic entries and eligible rider replacements.</p>
      <Link href="/team/calendar">← Race calendar</Link></header>
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    {!state&&!error&&<p role="status">Loading your default teams…</p>}
    <div className="defaults-grid">{state&&SLOTS.map(([gender,format,label])=>{
      const slot=key(gender,format),size=state.team_sizes[format];
      const squad=riders.filter(rider=>rider.gender===gender);
      const draft=drafts[slot]??{selected:[],captain:""};
      const saved=state.defaults.some(item=>key(item.gender,item.event_format)===slot);
      return <section className="card defaults-card" key={slot}><div className="defaults-title"><h2>{label}</h2><span>{saved?"Saved":"Needed"}</span></div>
        <p>{draft.selected.length}/{size} riders selected</p>
        <div className="defaults-riders">{squad.map(rider=>{
          const checked=draft.selected.includes(rider.id);
          return <label key={rider.id}><input type="checkbox" checked={checked}
            onChange={()=>{const selected=checked?draft.selected.filter(id=>id!==rider.id):
              draft.selected.length<size?[...draft.selected,rider.id]:draft.selected;
              update(slot,{selected,captain:selected.includes(draft.captain)?draft.captain:""});}}/>
            {rider.display_name??rider.name}<small>{rider.country_code??""}</small></label>;
        })}</div>
        <label>Captain<select value={draft.captain} onChange={e=>update(slot,{captain:e.target.value})}>
          <option value="">Choose captain</option>{draft.selected.map(id=>{
            const rider=squad.find(item=>item.id===id);
            return <option key={id} value={id}>{rider?.display_name??rider?.name??id}</option>;
          })}</select></label>
        <button className="btn primary" disabled={busy===slot||draft.selected.length!==size||!draft.captain}
          onClick={()=>save(gender,format)}>{busy===slot?"Saving…":"Save default team"}</button>
      </section>;
    })}</div>
    <p className="defaults-note">A saved default is not a confirmed race entry. Check the calendar before each deadline to see whether your team is entered.</p>
  </div></TeamShell>;
}
