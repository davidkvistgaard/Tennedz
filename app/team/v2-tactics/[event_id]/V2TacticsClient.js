'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import TeamShell from '../../../components/TeamShell';
import {useAuth} from '../../../components/AuthProvider';
import {normalizeOrders,orderMarkers} from '../../../../lib/engine/v2/orders.mjs';

const PRESETS=[['balanced','Balanced'],['protect','Protect the captain'],
  ['aggressive','Attack and chase']];
const EFFORT=[['','Use preset'],['conserve','Conserve'],['steady','Steady'],['hard','Hard']];
const CHASE=[['','Use preset'],['ignore','Ignore'],['selective','Selective'],['all','Chase all']];
const ATTACK=[['','Use preset'],['none','None'],['selective','Selective'],
  ['repeated','Repeated']];
const BREAK_WORK=[['','Use preset'],['cooperate','Share pulls'],
  ['sit_on','Save energy'],['drive','Drive the break']];
const BREAK_FINALE=[['','Use preset'],['hold_group','Hold the group'],
  ['attack_if_outsprinted','Attack if outsprinted']];
const HELPER_ATTACK=[['','Use preset'],['open','Allow helpers to attack'],
  ['hold_for_captain','Hold helpers for captain'],
  ['release_if_dropped','Release if captain is dropped']];
const CAPTAIN_SUPPORT=[['','Use preset'],['hold_position','Hold position'],
  ['drop_back_if_dropped','Wait for dropped captain']];
const utc=value=>new Date(value).toLocaleString('en-GB',{
  day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'UTC',
  timeZoneName:'short'});

function Select({label,value,options,onChange,disabled}){
  return <label className="v2-field"><span>{label}</span><select value={value??''}
    onChange={event=>onChange(event.target.value)} disabled={disabled}>
    {options.map(([id,name])=><option key={id} value={id}>{name}</option>)}
  </select></label>;
}

function phaseInput(phase,key,value){
  const changed={...phase};
  if(value==='')delete changed[key];
  else if(key==='attackRiderId'&&value==='__automatic')changed[key]=null;
  else changed[key]=key==='atKm'?Number(value):value;
  return changed;
}

export default function V2TacticsClient({eventId}){
  const {session}=useAuth();
  const [context,setContext]=useState(null),[plan,setPlan]=useState(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [now,setNow]=useState(Date.now()),[serverOffset,setServerOffset]=useState(0);
  useEffect(()=>{
    const timer=setInterval(()=>setNow(Date.now()+serverOffset),5000);
    return()=>clearInterval(timer);
  },[serverOffset]);
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const response=await fetch(`/api/event/v2-tactics?event_id=${encodeURIComponent(eventId)}`,
        {cache:'no-store'});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Could not load your v2 tactics.');
      const offset=Date.parse(result.server_time)-Date.now();
      setServerOffset(Number.isFinite(offset)?offset:0);
      setNow(Number.isFinite(offset)?Date.now()+offset:Date.now());
      setContext(result);
      setPlan(result.orders??{captainId:result.entry.captain_id,
        roadCaptainId:result.entry.captain_id,preset:'balanced',phases:[]});
    }catch(cause){setError(cause.message);setContext(null);}
    finally{setLoading(false);}
  },[eventId]);
  useEffect(()=>{load();},[load]);
  const lineup=context?.entry.selected_riders??[];
  const names=useMemo(()=>new Map((session?.riders??[]).map(rider=>[rider.id,rider.name])),
    [session?.riders]);
  const riderOptions=useMemo(()=>lineup.map(id=>[id,names.get(id)??id]),[lineup,names]);
  const roadCaptain=plan?.roadCaptainId??context?.entry.captain_id;
  const helpers=plan?.helperIds??lineup.filter(id=>
    id!==context?.entry.captain_id&&id!==roadCaptain);
  const markers=useMemo(()=>{
    const distance=Number(context?.stage.distance_km);
    return orderMarkers({distanceKm:distance,keypoints:context?.stage.keypoints??[]});
  },[context]);
  const editable=Boolean(context?.editable&&
    Date.parse(context.event.tactics_deadline)>now);
  const update=(key,value)=>setPlan(current=>({...current,[key]:value}));
  const updateBaseline=(key,value)=>setPlan(current=>{
    const baseline={...current.baseline};
    if(value==='')delete baseline[key];else baseline[key]=value;
    return {...current,baseline};
  });
  const updatePhase=(index,key,value)=>setPlan(current=>({...current,
    phases:current.phases.map((phase,i)=>i===index?phaseInput(phase,key,value):phase)}));
  function addPhase(){
    const available=markers.find(km=>!plan.phases.some(phase=>phase.atKm===km));
    if(available!==undefined)setPlan(current=>({...current,
      phases:[...current.phases,{atKm:available,effort:'hard'}]}));
  }
  async function save(event){
    event.preventDefault();
    setError('');setNotice('');
    let orders;
    try{
      orders=normalizeOrders(plan,{riderIds:lineup,
        distanceKm:Number(context.stage.distance_km),keypoints:context.stage.keypoints??[]});
    }catch(cause){setError(cause.message);return;}
    setBusy(true);
    try{
      const response=await fetch('/api/event/v2-tactics',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({event_id:eventId,team_id:context.team_id,orders}),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Could not save your v2 plan.');
      setContext(current=>({...current,orders:result.orders,
        saved_at:result.saved_at,draft_stale:false}));
      setPlan(result.orders);setNotice('Private v2 plan saved. You can revise it before the deadline.');
    }catch(cause){setError(cause.message);}
    finally{setBusy(false);}
  }
  return <TeamShell title="Private v2 tactics" compact><main className="v2-tactics">
    <nav className="v2-tactics-nav"><Link href="/team/calendar">Back to calendar</Link>
      <span>Isolated v2 preview · existing race tactics stay separate</span></nav>
    {loading?<section className="card" role="status">Loading your race plan…</section>:
      !context?<section className="card"><h1>Plan unavailable</h1>
        <p role="alert">{error}</p><button className="btn" onClick={load}>Try again</button></section>:
      <form onSubmit={save} className="v2-tactics-form">
        <header className="card v2-tactics-hero"><p className="identity-eyebrow">PRIVATE V2 PLAN</p>
          <h1>{context.event.name||'Scheduled race'}</h1>
          <p>Division {context.division_index} · {context.stage.distance_km} km · {context.event.gender==='F'?'Women':'Men'}</p>
          <p>Final tactics deadline: <strong>{utc(context.event.tactics_deadline)}</strong></p>
          {context.saved_at?<p role="status">Saved {utc(context.saved_at)}</p>:
            <p role="status">No private v2 plan saved yet.</p>}
          {context.draft_stale&&<p role="alert">Your earlier draft no longer matches the entered lineup. Save a new plan.</p>}
          {!editable&&<p role="status">Editing is closed. Your saved plan is read-only.</p>}
        </header>
        <section className="card"><h2>Team roles</h2>
          <p>Entered captain: <strong>{names.get(context.entry.captain_id)??context.entry.captain_id}</strong></p>
          <div className="v2-tactics-fields">
            <Select label="Race approach" value={plan.preset} options={PRESETS}
              onChange={value=>setPlan(current=>({...current,preset:value,baseline:{}}))}
              disabled={!editable}/>
            <Select label="Road captain" value={roadCaptain} options={riderOptions}
              onChange={value=>setPlan(current=>({...current,roadCaptainId:value,
                helperIds:helpers.filter(id=>id!==value)}))} disabled={!editable}/>
            <Select label="Backup leader" value={plan.backupId??''}
              options={[["","None"],...riderOptions.filter(([id])=>id!==context.entry.captain_id)]}
              onChange={value=>update('backupId',value||null)} disabled={!editable}/>
            <Select label="If captain is exhausted" value={plan.contingency??'hold_plan'}
              options={[["hold_plan","Hold plan"],["backup_if_captain_exhausted","Use backup leader"]]}
              onChange={value=>update('contingency',value)} disabled={!editable}/>
            <Select label="If a rival break threatens" value={plan.breakResponse??'hold_plan'}
              options={[["hold_plan","Hold plan"],["chase_if_threatened","Chase the threat"]]}
              onChange={value=>update('breakResponse',value)} disabled={!editable}/>
            <Select label="If our forward rider fades" value={plan.forwardResponse??'protect_forward'}
              options={[["protect_forward","Protect the forward rider"],
                ["chase_if_fading","Chase if fading"]]}
              onChange={value=>update('forwardResponse',value)} disabled={!editable}/>
          </div>
          <fieldset className="v2-helpers" disabled={!editable}><legend>Helpers</legend>
            {riderOptions.filter(([id])=>id!==context.entry.captain_id&&id!==roadCaptain)
              .map(([id,name])=><label key={id}><input type="checkbox" checked={helpers.includes(id)}
                onChange={event=>update('helperIds',event.target.checked?
                  [...helpers,id]:helpers.filter(value=>value!==id))}/>{name}</label>)}
          </fieldset>
        </section>
        <section className="card"><h2>Opening orders</h2>
          <p>The preset sets the starting plan. Overrides below change how the team rides from the start.</p>
          <div className="v2-tactics-fields">
            <Select label="Effort" value={plan.baseline?.effort??''} options={EFFORT}
              onChange={value=>updateBaseline('effort',value)} disabled={!editable}/>
            <Select label="Chase" value={plan.baseline?.chase??''} options={CHASE}
              onChange={value=>updateBaseline('chase',value)} disabled={!editable}/>
            <Select label="Attack" value={plan.baseline?.attack??''} options={ATTACK}
              onChange={value=>updateBaseline('attack',value)} disabled={!editable}/>
            <Select label="Planned attacker" value={plan.baseline?.attackRiderId??''}
              options={[["","Automatic"],...riderOptions]}
              onChange={value=>updateBaseline('attackRiderId',value)} disabled={!editable}/>
            <Select label="Work in a break" value={plan.baseline?.breakWork??''}
              options={BREAK_WORK}
              onChange={value=>updateBaseline('breakWork',value)} disabled={!editable}/>
            <Select label="Breakaway finale" value={plan.baseline?.breakFinale??''}
              options={BREAK_FINALE}
              onChange={value=>updateBaseline('breakFinale',value)} disabled={!editable}/>
            <Select label="Helper attacks" value={plan.baseline?.helperAttackPolicy??''}
              options={HELPER_ATTACK}
              onChange={value=>updateBaseline('helperAttackPolicy',value)} disabled={!editable}/>
            <Select label="Captain support" value={plan.baseline?.captainSupport??''}
              options={CAPTAIN_SUPPORT}
              onChange={value=>updateBaseline('captainSupport',value)} disabled={!editable}/>
          </div>
        </section>
        <section className="card"><h2>Route markers</h2>
          <p>Commit a change at a 10 km, route or 5 km-to-go marker. The new orders apply from the following kilometre; attack rules keep their selected cadence.</p>
          {(plan.phases??[]).map((phase,index)=><div className="v2-phase" key={index}>
            <div className="v2-tactics-fields">
              <Select label={`Change ${index+1} · at km`} value={phase.atKm}
                options={markers.map(km=>[km,km===Number(context.stage.distance_km)-5?
                  `${km} km · 5 km to go`:`${km} km`])}
                onChange={value=>updatePhase(index,'atKm',value)} disabled={!editable}/>
              <Select label="Effort" value={phase.effort??''}
                options={[["","Keep previous"],...EFFORT.slice(1)]}
                onChange={value=>updatePhase(index,'effort',value)} disabled={!editable}/>
              <Select label="Chase" value={phase.chase??''}
                options={[["","Keep previous"],...CHASE.slice(1)]}
                onChange={value=>updatePhase(index,'chase',value)} disabled={!editable}/>
              <Select label="Attack" value={phase.attack??''}
                options={[["","Keep previous"],...ATTACK.slice(1)]}
                onChange={value=>updatePhase(index,'attack',value)} disabled={!editable}/>
              <Select label="Attack rider" value={phase.attackRiderId===null?
                '__automatic':phase.attackRiderId??''}
                options={[["","Keep previous"],["__automatic","Automatic"],
                  ...riderOptions]}
                onChange={value=>updatePhase(index,'attackRiderId',value)} disabled={!editable}/>
              <Select label={`Change ${index+1} · break move`} value={phase.breakAttackRiderId??''}
                options={[["","No one-off break move"],...riderOptions]}
                onChange={value=>updatePhase(index,'breakAttackRiderId',value)}
                disabled={!editable}/>
              <Select label={`Change ${index+1} · break work`} value={phase.breakWork??''}
                options={[["","Keep previous"],...BREAK_WORK.slice(1)]}
                onChange={value=>updatePhase(index,'breakWork',value)} disabled={!editable}/>
              <Select label={`Change ${index+1} · finale`} value={phase.breakFinale??''}
                options={[["","Keep previous"],...BREAK_FINALE.slice(1)]}
                onChange={value=>updatePhase(index,'breakFinale',value)} disabled={!editable}/>
              <Select label={`Change ${index+1} · helper attacks`}
                value={phase.helperAttackPolicy??''}
                options={[["","Keep previous"],...HELPER_ATTACK.slice(1)]}
                onChange={value=>updatePhase(index,'helperAttackPolicy',value)}
                disabled={!editable}/>
              <Select label={`Change ${index+1} · captain support`}
                value={phase.captainSupport??''}
                options={[["","Keep previous"],...CAPTAIN_SUPPORT.slice(1)]}
                onChange={value=>updatePhase(index,'captainSupport',value)}
                disabled={!editable}/>
            </div>
            {editable&&<button type="button" className="btn" onClick={()=>
              update('phases',plan.phases.filter((_,i)=>i!==index))}>Remove marker</button>}
          </div>)}
          {editable&&markers.some(km=>!plan.phases.some(phase=>phase.atKm===km))&&
            plan.phases.length<40&&<button type="button" className="btn" onClick={addPhase}>
              Add route marker</button>}
        </section>
        {error&&<p role="alert" className="v2-error">{error}</p>}
        {notice&&<p role="status" className="v2-notice">{notice}</p>}
        {editable&&<button type="submit" className="btn primary" disabled={busy}>
          {busy?'Saving…':'Save private v2 plan'}</button>}
        <p className="v2-tactics-footnote">This is a separate v2 candidate. It does not finish the race or award ranking points.</p>
      </form>}
  </main></TeamShell>;
}
