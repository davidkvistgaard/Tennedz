"use client";
import {useEffect,useMemo,useState} from 'react';
import TeamShell from '../../components/TeamShell';
import {api} from '../../../lib/api';
import './motor-lab.css';

const PLANS=[
 {id:'sprint',title:'Protect the sprinter',description:'Keep helpers around your leader and manage the break.'},
 {id:'break',title:'Send the captain ahead',description:'Spend energy to get into a move before the finish.'},
 {id:'balanced',title:'Race for opportunities',description:'Mix selective pursuit with attacks.'},
 {id:'conserve',title:'Save energy',description:'Take fewer risks early and keep strength for later.'},
];
const seconds=value=>`${value.toFixed(1)} s`;
const captainPlace=recording=>`#${recording.results.find(result=>result.name==='Amber Captain')?.position??'—'}`;
const chaseKilometres=recording=>recording.frames.filter(frame=>frame.chasingTeams.includes('Amber')).length;
const orderSummary=recording=>`${recording.orders.breakResponse==='chase_if_threatened'?'Threat chase':'Plan chase'} · ${recording.orders.breakWork.replace('_',' ')} · ${recording.orders.lateEffort==='follow_plan'?'Plan finish':recording.orders.lateEffort+' finish'} · ${recording.orders.breakAttackMarker==='none'?'No planned break attack':'Attack after '+recording.orders.breakAttackMarker+' km'} · ${recording.orders.roadCaptain==='experienced'?'Experienced':'Standard'} road captain`;

export default function MotorLabPage(){
 const [plan,setPlan]=useState('sprint');
 const [routeId,setRouteId]=useState('coast');
 const [orders,setOrders]=useState({breakResponse:'hold_plan',breakWork:'cooperate',lateEffort:'follow_plan',breakAttackMarker:'none',roadCaptain:'standard'});
 const [seed,setSeed]=useState(1);
 const [recording,setRecording]=useState(null);
 const [previousRecording,setPreviousRecording]=useState(null);
 const [frameIndex,setFrameIndex]=useState(0);
 const [playing,setPlaying]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const highlights=useMemo(()=>recording?.frames
  .map((frame,index)=>({...frame,index})).filter(frame=>frame.moments.length)??[],[recording]);
 const timeline=useMemo(()=>{
  if(!recording)return null;
  const frames=recording.frames;
  const gaps=frames.map(frame=>frame.groups[0]?.gapSeconds??0);
  const peakGap=Math.max(...gaps),scale=Math.max(1,peakGap);
  const point=(gap,index)=>`${20+index/(frames.length-1)*960},${130-gap/scale*100}`;
  return {peakGap,trace:gaps.map(point).join(' '),
   multi:frames.flatMap((frame,index)=>frame.groups.length>1?[20+index/(frames.length-1)*960]:[])};
 },[recording]);
 const frame=recording?.frames[frameIndex];
 const comparison=previousRecording?.seed===recording?.seed&&
  previousRecording?.routeId===recording?.routeId?previousRecording:null;
 const amberCaptain=recording?.results.find(result=>result.name==='Amber Captain');
 useEffect(()=>{
  if(!playing||!recording)return;
  const timer=setInterval(()=>setFrameIndex(index=>Math.min(index+2,recording.frames.length-1)),140);
  return ()=>clearInterval(timer);
 },[playing,recording]);
 useEffect(()=>{
  if(playing&&recording&&frameIndex===recording.frames.length-1)setPlaying(false);
 },[playing,recording,frameIndex]);
 async function run(nextSeed=seed){
  if(busy)return;
  setBusy(true);setError('');
  try{
   const response=await api('/api/motor-lab',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({plan,routeId,seed:nextSeed,orders})});
   setPlaying(false);setPreviousRecording(recording);setRecording(response.recording);setFrameIndex(0);setSeed(nextSeed);
  }catch(cause){setError(cause.message||'The preview could not run. Please try again.');}
  finally{setBusy(false);}
 }
 const previous=highlights.filter(moment=>moment.index<frameIndex).at(-1);
 const next=highlights.find(moment=>moment.index>frameIndex);
 return <TeamShell title="Motor Lab">
  <main className="motor-lab">
   <section className="motor-hero">
    <div><p className="motor-kicker">FIRST PLAYABLE ENGINE PREVIEW</p>
     <h2>Make a plan. Watch the road answer.</h2>
     <p>Choose a simple order for Amber, then inspect every recorded kilometre of a fictional four-team race. Run the same scenario again with another plan to see what changes.</p>
    </div><span className="motor-tag">Experimental · no live results</span>
   </section>
   <p className="motor-boundary">This laboratory uses fictional riders and two fixed 160 km routes. It reads no team roster, makes no database changes and awards no points. The current live race engine is unchanged.</p>
   <section className="motor-panel" aria-labelledby="motor-orders-title">
    <div className="motor-section-heading"><span>01 / COMMIT A PLAN</span><h2 id="motor-orders-title">How should Amber race?</h2></div>
    <div className="motor-plans" role="radiogroup" aria-label="Amber race plan">
     {PLANS.map(option=><label key={option.id} className="motor-plan" data-selected={plan===option.id}>
      <input type="radio" name="motor-plan" value={option.id} checked={plan===option.id}
       onChange={()=>setPlan(option.id)} disabled={busy}/>
      <span><strong>{option.title}</strong><small>{option.description}</small></span>
     </label>)}
    </div>
    <fieldset className="motor-advanced" disabled={busy}>
     <legend>Advanced orders</legend>
     <p>These choices are committed before the race. They cannot be changed during playback.</p>
     <div className="motor-order-grid">
      <label>React to a dangerous break
       <select value={orders.breakResponse} onChange={event=>setOrders({...orders,breakResponse:event.target.value})}>
        <option value="hold_plan">Keep the plan</option>
        <option value="chase_if_threatened">Ask the road captain to organise a chase</option>
       </select>
      </label>
      <label>If Amber reaches a break
       <select value={orders.breakWork} onChange={event=>setOrders({...orders,breakWork:event.target.value})}>
        <option value="cooperate">Share the work</option>
        <option value="sit_on">Sit on the wheels</option>
        <option value="drive">Drive the break</option>
       </select>
      </label>
      <label>From the 120 km marker
       <select value={orders.lateEffort} onChange={event=>setOrders({...orders,lateEffort:event.target.value})}>
        <option value="follow_plan">Keep the plan's effort</option>
        <option value="conserve">Conserve</option>
        <option value="steady">Ride steadily</option>
        <option value="hard">Ride hard</option>
       </select>
      </label>
      <label>If Amber Captain is in a break
       <select value={orders.breakAttackMarker} onChange={event=>setOrders({...orders,breakAttackMarker:event.target.value})}>
        <option value="none">Stay with the group</option>
        <option value="40">Attack after 40 km</option>
        <option value="80">Attack after 80 km</option>
        <option value="120">Attack after 120 km</option>
       </select>
      </label>
      <label>Road captain's leadership
       <select value={orders.roadCaptain} onChange={event=>setOrders({...orders,roadCaptain:event.target.value})}>
        <option value="standard">Standard (45)</option>
        <option value="experienced">Experienced (85)</option>
       </select>
      </label>
     </div>
    </fieldset>
    <div className="motor-run-row"><label>Laboratory route
     <select value={routeId} onChange={event=>setRouteId(event.target.value)} disabled={busy}>
      <option value="coast">Exposed coast</option>
      <option value="ridge">Rolling ridge</option>
     </select>
    </label><label>Scenario number
     <input type="number" min="0" max="9999" step="1" value={seed}
      onChange={event=>setSeed(event.target.value===''?'':Number(event.target.value))} disabled={busy}/>
    </label><button type="button" className="motor-primary" onClick={()=>run()} disabled={busy||!Number.isInteger(seed)||seed<0||seed>9999}>
     {busy?'Calculating…':'Run the race'}
    </button><button type="button" onClick={()=>run(Number(seed)+1)} disabled={busy||!Number.isInteger(seed)||seed<0||seed>=9999}>Try another scenario</button></div>
    <p className="motor-hint">Keep the route and scenario number when comparing plans. All four teams and the weather then start from the same conditions.</p>
    {error&&<p role="alert" className="motor-error">{error}</p>}
   </section>
   {recording&&frame&&<>
    <section className="motor-panel" aria-labelledby="motor-record-title">
     <div className="motor-section-heading"><span>02 / RECORDED RACE</span><h2 id="motor-record-title">{recording.scenarioName}</h2></div>
     <p>Amber rode <strong>{recording.planLabel}</strong> in scenario {recording.seed}. Birch protected its sprinter, Cedar attacked and Dune raced balanced. The entire result was calculated before this replay opened.</p>
     <p className="motor-committed">Committed orders: {recording.orders.breakResponse==='chase_if_threatened'?'chase a threatening break':'keep the original chase plan'} · {recording.orders.breakWork.replace('_',' ')} in a break · {recording.orders.lateEffort==='follow_plan'?'keep the original effort':'ride '+recording.orders.lateEffort} after 120 km · {recording.orders.breakAttackMarker==='none'?'stay in the break':'attempt an attack from the break after '+recording.orders.breakAttackMarker+' km'} · {recording.orders.roadCaptain==='experienced'?'experienced':'standard'} road captain.</p>
     {comparison&&<div className="motor-compare" aria-label="Compare two runs of the same scenario">
      <h3>Same scenario, two decisions</h3>
      <table><thead><tr><th scope="col">Outcome</th><th scope="col">Previous: {comparison.planLabel}<small>{orderSummary(comparison)}</small></th><th scope="col">Current: {recording.planLabel}<small>{orderSummary(recording)}</small></th></tr></thead>
       <tbody><tr><th scope="row">Amber Captain</th><td>{captainPlace(comparison)}</td><td>{captainPlace(recording)}</td></tr>
        <tr><th scope="row">Amber chase kilometres</th><td>{chaseKilometres(comparison)}</td><td>{chaseKilometres(recording)}</td></tr>
        <tr><th scope="row">Winner</th><td>{comparison.results[0].name}</td><td>{recording.results[0].name}</td></tr></tbody></table>
      <p>Both runs used scenario {recording.seed}. This comparison is a test signal, not proof that the race balance is final.</p>
     </div>}
     <div className="motor-scoreboard"><div><small>KILOMETRE</small><strong>{frame.km} / {recording.distanceKm}</strong></div>
      <div><small>GROUPS AHEAD</small><strong>{frame.groups.length}</strong></div>
      <div><small>AMBER CAPTAIN</small><strong>#{amberCaptain?.position??'—'}</strong></div></div>
     <figure className="motor-timeline">
      <figcaption>Breakaway advantage across the race</figcaption>
      <svg viewBox="0 0 1000 150" preserveAspectRatio="none" aria-hidden="true">
       <line x1="20" y1="130" x2="980" y2="130" className="motor-timeline-baseline"/>
       <polyline points={timeline.trace} className="motor-timeline-trace"/>
       {timeline.multi.map((x,index)=><line key={index} x1={x} x2={x} y1="139" y2="148" className="motor-timeline-multi"/>)}
       <line x1={20+frameIndex/(recording.frames.length-1)*960} x2={20+frameIndex/(recording.frames.length-1)*960} y1="12" y2="148" className="motor-timeline-position"/>
      </svg>
      <div className="motor-timeline-ticks"><span>0 km</span><span>40</span><span>80</span><span>120</span><span>160 km</span></div>
      <p>At {frame.km} km, the leading group is {seconds(frame.groups[0]?.gapSeconds??0)} ahead. The largest recorded gap is {seconds(timeline.peakGap)}. Gold marks indicate multiple road groups.</p>
     </figure>
     <label className="motor-scrubber">Inspect recorded kilometre
      <input type="range" min="0" max={recording.frames.length-1} value={frameIndex}
       onChange={event=>{setPlaying(false);setFrameIndex(Number(event.target.value));}}/>
     </label>
     <div className="motor-step"><button type="button" disabled={!previous} onClick={()=>{setPlaying(false);setFrameIndex(previous.index);}}>← Previous moment</button>
      <button type="button" onClick={()=>{if(playing)setPlaying(false);else{if(frameIndex===recording.frames.length-1)setFrameIndex(0);setPlaying(true);}}}>{playing?'Pause replay':'▶ Play replay'}</button>
      <button type="button" disabled={!next} onClick={()=>{setPlaying(false);setFrameIndex(next.index);}}>Next moment →</button></div>
     <div className="motor-conditions"><span>{frame.terrain} · {frame.surface}{frame.exposed?' · exposed':''}</span>
      <span>{frame.weather.temperatureC}°C · wind {frame.weather.windKph} km/h · rain {frame.weather.rainMm} mm</span>
      <span>Amber mean energy {frame.amberEnergy?.toFixed(1)??'—'}</span></div>
     <div className="motor-road" aria-label="Road groups at selected kilometre">
      {frame.groups.map((group,index)=><article key={group.id}>
       <div><span className="motor-group-marker">{index+1}</span><strong>Group {index+1} · {seconds(group.gapSeconds)} ahead</strong></div>
       <p>{group.riders.join(', ')}</p><small>{group.workers.length?`Taking pulls: ${group.workers.join(', ')}`:'No recorded pulls this kilometre'}</small>
      </article>)}
      <article><div><span className="motor-group-marker motor-peloton">P</span><strong>Peloton · {frame.pelotonCount} riders</strong></div>
       <p>{frame.chasingTeams.length?`Chasing: ${frame.chasingTeams.join(', ')}`:'No team chasing this kilometre'}</p>
       {frame.droppedCount>0&&<small>{frame.droppedCount} rider{frame.droppedCount===1?'':'s'} behind the peloton</small>}</article>
     </div>
     {frame.moments.length>0&&<p className="motor-current-moment"><strong>At kilometre {frame.km}:</strong> {frame.moments.join(' · ')}</p>}
    </section>
    <div className="motor-bottom">
     <section className="motor-panel"><div className="motor-section-heading"><span>03 / KEY MOMENTS</span><h2>How the race changed</h2></div>
      <ol className="motor-moments">{highlights.map(moment=><li key={moment.km}>
       <button type="button" aria-current={frameIndex===moment.index?'step':undefined} onClick={()=>{setPlaying(false);setFrameIndex(moment.index);}}>
        <strong>{moment.km} km</strong><span>{moment.moments.join(' · ')}</span></button></li>)}</ol>
     </section>
     <section className="motor-panel"><div className="motor-section-heading"><span>04 / PROVISIONAL FINISH</span><h2>Who came home first?</h2></div>
      <ol className="motor-results">{recording.results.slice(0,10).map(result=><li key={result.name}>
       <span>{result.position}. <strong>{result.name}</strong><small>{result.team}</small></span>
       <span>{result.position===1?'Winner':`+${seconds(result.gapSeconds)}`}</span></li>)}</ol>
      {amberCaptain?.position>10&&<p>Amber Captain finished #{amberCaptain.position}.</p>}
      <p className="motor-hint">These placings are experimental balance output, not official race results.</p>
     </section>
    </div>
   </>}
  </main>
 </TeamShell>;
}
