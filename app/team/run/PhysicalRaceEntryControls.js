"use client";
import {useEffect,useState} from "react";
import {api} from "../../../lib/api";

const empty=()=>({roadCaptainId:"",helperIds:[],effort:"",
  chase:"",attack:"",attackRiderId:"",frontWork:"",
  frontWorkRiderId:"",sportingGoal:"",sportingCaptainId:""});

export default function PhysicalRaceEntryControls({eventId,teamId,
  selected,captain,riders,locked,valid,savedEntry,onSaved}){
  const [form,setForm]=useState(empty);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  useEffect(()=>{
    const order=savedEntry?.orders;
    setForm(order?{
      roadCaptainId:order.roadCaptainId??"",
      helperIds:order.helperIds??[],
      effort:order.baseline?.effort??"",
      chase:order.baseline?.chase??"",
      attack:order.baseline?.attack??"",
      attackRiderId:order.baseline?.attackRiderId??"",
      frontWork:order.baseline?.frontWork??"",
      frontWorkRiderId:order.baseline?.frontWorkRiderId??"",
      sportingGoal:savedEntry.stake?.sportingGoal??"",
      sportingCaptainId:savedEntry.stake?.sportingCaptainId??""}:empty());
  },[eventId,savedEntry]);
  useEffect(()=>setMessage(""),[eventId]);
  const lineup=riders.filter(rider=>selected.includes(rider.id));
  const helpers=lineup.filter(rider=>form.helperIds.includes(rider.id));
  const ready=valid&&form.roadCaptainId&&
    selected.includes(form.roadCaptainId)&&
    form.helperIds.length>0&&
    form.helperIds.every(id=>selected.includes(id)&&
      id!==captain&&id!==form.roadCaptainId)&&
    form.effort&&form.chase&&form.attack&&form.frontWork&&
    form.sportingGoal&&selected.includes(form.sportingCaptainId)&&
    (form.attack==='none'||selected.includes(form.attackRiderId))&&
    (form.frontWork==='sit_in'||
      !form.frontWorkRiderId||
      form.helperIds.includes(form.frontWorkRiderId));
  function set(key,value){setForm(previous=>({...previous,[key]:value}));
    setMessage("");}
  function toggleHelper(id){
    setForm(previous=>({...previous,
      helperIds:previous.helperIds.includes(id)?
        previous.helperIds.filter(value=>value!==id):
        [...previous.helperIds,id]}));
    setMessage("");
  }
  async function save(event){
    event.preventDefault();
    if(!ready||locked||busy)return;
    setBusy(true);setMessage("");
    try{
      const orders={...(savedEntry?.orders??{}),
        version:2,captainId:captain,
        roadCaptainId:form.roadCaptainId,
        helperIds:form.helperIds,
        baseline:{...(savedEntry?.orders?.baseline??{}),
          effort:form.effort,chase:form.chase,
          attack:form.attack,
          attackRiderId:form.attack==='none'?null:
            form.attackRiderId,
          frontWork:form.frontWork,
          frontWorkRiderId:form.frontWork==='rotate'?
            form.frontWorkRiderId||null:null}};
      await api('/api/event/join-physical',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({version:'physical-entry-request-v1',
          event_id:eventId,team_id:teamId,
          selected_riders:selected,captain_id:captain,orders,
          stake:{sportingGoal:form.sportingGoal,
            sportingCaptainId:form.sportingCaptainId}})});
      onSaved({selected_riders:[...selected],captain_id:captain,
        orders,stake:{sportingGoal:form.sportingGoal,
          sportingCaptainId:form.sportingCaptainId}});
      setMessage('Your lineup and physical race orders are saved.');
    }catch(error){setMessage(error.message);}
    finally{setBusy(false);}
  }
  return <form className="card physical-entry" onSubmit={save}
    aria-label="Physical race tactics">
    <h2>Race tactics</h2>
    <p className="small">These orders are saved with your eight riders for
      the experimental physical race. They are instructions, not guaranteed
      race events or official results.</p>
    <div className="physical-entry-grid">
      <label>Road captain<select required value={form.roadCaptainId}
        disabled={locked||busy} onChange={event=>set('roadCaptainId',
          event.target.value)}><option value="">Choose a rider</option>
        {lineup.map(rider=><option key={rider.id} value={rider.id}>
          {rider.name}</option>)}</select></label>
      <label>Effort<select required value={form.effort}
        disabled={locked||busy} onChange={event=>set('effort',
          event.target.value)}><option value="">Choose effort</option>
        <option value="conserve">Conserve</option>
        <option value="steady">Steady</option>
        <option value="hard">Hard</option></select></label>
      <label>Chase<select required value={form.chase}
        disabled={locked||busy} onChange={event=>set('chase',
          event.target.value)}><option value="">Choose chase rule</option>
        <option value="ignore">Ignore</option>
        <option value="selective">Selective</option>
        <option value="all">All eligible helpers</option></select></label>
      <label>Attack<select required value={form.attack}
        disabled={locked||busy} onChange={event=>set('attack',
          event.target.value)}><option value="">Choose attack rule</option>
        <option value="none">None</option>
        <option value="selective">Selective</option>
        <option value="repeated">Repeated</option></select></label>
      {form.attack&&form.attack!=='none'?<label>Planned attacker
        <select required value={form.attackRiderId}
          disabled={locked||busy} onChange={event=>set(
            'attackRiderId',event.target.value)}>
          <option value="">Choose a rider</option>
          {lineup.map(rider=><option key={rider.id} value={rider.id}>
            {rider.name}</option>)}
        </select></label>:null}
      <label>Front work<select required value={form.frontWork}
        disabled={locked||busy} onChange={event=>set('frontWork',
          event.target.value)}><option value="">Choose front work</option>
        <option value="sit_in">Sit in</option>
        <option value="rotate">Rotate</option></select></label>
      {form.frontWork==='rotate'?<label>Preferred front worker (optional)
        <select value={form.frontWorkRiderId}
          disabled={locked||busy} onChange={event=>set(
            'frontWorkRiderId',event.target.value)}>
          <option value="">Rotate available helpers</option>
          {helpers.map(rider=><option key={rider.id} value={rider.id}>
            {rider.name}</option>)}
        </select></label>:null}
      <label>Sporting goal<select required value={form.sportingGoal}
        disabled={locked||busy} onChange={event=>set('sportingGoal',
          event.target.value)}><option value="">Choose a goal</option>
        <option value="sprint_finish">Sprint finish</option>
        <option value="summit_attack">Summit attack</option>
        <option value="break_stage">Breakaway stage</option>
        <option value="none">No specific goal</option></select></label>
      <label>Rider for sporting goal<select required
        value={form.sportingCaptainId} disabled={locked||busy}
        onChange={event=>set('sportingCaptainId',event.target.value)}>
        <option value="">Choose a rider</option>
        {lineup.map(rider=><option key={rider.id} value={rider.id}>
          {rider.name}</option>)}
      </select></label>
    </div>
    <fieldset disabled={locked||busy}>
      <legend>Helpers available for team orders</legend>
      {lineup.filter(rider=>rider.id!==captain&&
        rider.id!==form.roadCaptainId).map(rider=><label key={rider.id}>
        <input type="checkbox" checked={form.helperIds.includes(rider.id)}
          onChange={()=>toggleHelper(rider.id)}/>{rider.name}
      </label>)}
    </fieldset>
    <button className="btn primary" type="submit"
      disabled={locked||busy||!ready}>
      {busy?'Saving…':locked?'Deadline passed':
        'Save lineup and race tactics'}</button>
    {message?<p role="status" className="form-message">{message}</p>:null}
  </form>;
}
