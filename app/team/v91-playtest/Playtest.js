'use client';
import {useState} from 'react';
import TeamShell from '../../components/TeamShell';
import {api} from '../../../lib/api';

const INITIAL={distanceKm:120,terrain:'flat',teamCount:4,gender:'M',fatigue:0,
  effort:'steady',attack:'selective',chase:'selective',seed:'playtest-1',
  profileHeightsM:[100,350,150,500,180,100],
  rivalPlans:['chase','attack','neutral']};
const OPTIONS={distanceKm:[[40,'40 km — short'],[120,'120 km — medium'],[260,'260 km — long']],
  terrain:[['flat','Flat'],['rolling','Rolling'],['mountain','Mountain'],
    ['exposed','Flat, exposed'],['custom','Draw your own']],
  teamCount:[[4,'4 teams'],[15,'15 teams'],[20,'20 teams']],
  gender:[['M','Men'],['F','Women']],fatigue:[[0,'Fresh'],[15,'Some fatigue'],[30,'Tired']],
  effort:[['conserve','Conserve'],['steady','Steady'],['hard','Hard']],
  attack:[['none','None'],['selective','Selective'],['repeated','Repeated']],
  chase:[['ignore','Ignore'],['selective','Selective'],['all','All helpers']]};
const LABELS={distanceKm:'Distance',terrain:'Route profile',teamCount:'Field size',
  gender:'Category',fatigue:'Starting fatigue',effort:'Your effort',
  attack:'Your attack order',chase:'Your chase order'};

export default function Playtest(){
  const [settings,setSettings]=useState(INITIAL);
  const [result,setResult]=useState(null);
  const [selectedKm,setSelectedKm]=useState(1);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const frame=result?.frames[selectedKm-1];
  const change=(key,value)=>setSettings(current=>({...current,
    [key]:['distanceKm','teamCount','fatigue'].includes(key)?Number(value):value}));
  const changeHeight=(index,value)=>setSettings(current=>({...current,
    profileHeightsM:current.profileHeightsM.map((height,at)=>at===index?Number(value):height)}));
  const changeRival=(index,value)=>setSettings(current=>({...current,
    rivalPlans:current.rivalPlans.map((plan,at)=>at===index?value:plan)}));
  const maxHeight=Math.max(500,...settings.profileHeightsM);
  const profileLine=settings.profileHeightsM.map((height,index)=>
    `${10+index*196},${110-height/maxHeight*100}`).join(' ');
  async function run(event){
    event.preventDefault();setBusy(true);setError('');
    try{
      const response=await api('/api/v91-playtest',{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)});
      setResult(response.playtest);setSelectedKm(1);
    }catch(cause){setError(cause.message||'The playtest could not run.');}
    finally{setBusy(false);}
  }
  return <TeamShell>
    <main className="v91-lab">
      <p className="v91-eyebrow">Experimental motor workbench · v91</p>
      <h1>Try a fictional race</h1>
      <p>Change your orders and the race conditions, then rerun with the same seed to compare what happened on the road.</p>
      <p className="v91-warning">Diagnostic preview: kilometre-level dynamics only. The short-step finale, official results and points are still in development.</p>
      <form onSubmit={run} className="v91-controls">
        {Object.entries(OPTIONS).map(([key,options])=><label key={key}>{LABELS[key]}
          <select value={settings[key]} onChange={event=>change(key,event.target.value)}>
            {options.map(([value,label])=><option value={value} key={value}>{label}</option>)}
          </select></label>)}
        {settings.terrain==='custom'&&<fieldset className="v91-profile">
          <legend>Route elevation profile</legend>
          <p>Set the height at the start, every 20% of the race, and the finish. The motor calculates the slopes between these points.</p>
          <svg viewBox="0 0 1000 120" role="img" aria-label="Your route elevation profile">
            <polyline points={profileLine} fill="none" stroke="currentColor" strokeWidth="4"/>
          </svg>
          <div className="v91-profile-points">{settings.profileHeightsM.map((height,index)=><label key={index}>
            {index===0?'Start':index===5?'Finish':`${index*20}%`} (m)
            <input type="number" min="0" max="2500" step="1" value={height}
              onChange={event=>changeHeight(index,event.target.value)}/>
          </label>)}</div>
          <small>Each 20% segment is limited to an average gradient of 10%.</small>
        </fieldset>}
        <fieldset className="v91-profile">
          <legend>Independent rival plans</legend>
          <p>Change one rival at a time to compare its chase or attack decision with the same riders and seed. Larger fields also contain fixed background teams.</p>
          <div className="v91-profile-points">{settings.rivalPlans.map((plan,index)=><label key={index}>
            Rival {index+1}
            <select value={plan} onChange={event=>changeRival(index,event.target.value)}>
              <option value="chase">Hard chase</option>
              <option value="attack">Seek a break</option>
              <option value="neutral">Steady / selective</option>
            </select>
          </label>)}</div>
        </fieldset>
        <label>Scenario seed<input value={settings.seed} maxLength={80}
          onChange={event=>change('seed',event.target.value)} /></label>
        <button type="submit" disabled={busy}>{busy?'Running race…':'Run race'}</button>
      </form>
      {error&&<p role="alert" className="v91-error">{error}</p>}
      {result&&<section className="v91-results" aria-label="Playtest recording">
        <h2>Recorded race · {result.settings.distanceKm} km {result.settings.terrain}</h2>
        <p>{result.tuningVersion} · Your captain: provisional #{result.ownCaptain??'—'}</p>
        <label>Race kilometre: {selectedKm}
          <input type="range" min="1" max={result.frames.length} value={selectedKm}
            onChange={event=>setSelectedKm(Number(event.target.value))}/>
        </label>
        <div className="v91-metrics">
          <div><strong>{frame?.terrain}</strong><span>Terrain</span></div>
          <div><strong>{frame?.roadGroups.length??0}</strong><span>Groups ahead</span></div>
          <div><strong>{frame?.gapSeconds.toFixed(1)??0} s</strong><span>Lead gap</span></div>
          <div><strong>{frame?.ownMeanEnergy?.toFixed(1)??'—'}</strong><span>Your mean energy</span></div>
        </div>
        <div className="v91-columns">
          <section><h3>Road groups</h3>{frame?.roadGroups.length?
            frame.roadGroups.map(group=><p key={group.id}>Group {group.id}: {group.riderIds.length} riders · {group.gapSeconds.toFixed(1)} s</p>):
            <p>No group ahead of the bunch.</p>}</section>
          <section><h3>Actions this kilometre</h3>
            <p>Attacks: {frame?.attackers.join(', ')||'none'}</p>
            <p>Chasing teams: {frame?.chasers.join(', ')||'none'}</p>
            <p>Hard bunch work: {frame?.hardBunchWorkTeamIds.join(', ')||'none'}</p>
            <p>Steady bunch work: {frame?.steadyBunchWorkTeamIds.join(', ')||'none'}</p>
          </section>
        </div>
        <h3>Your riders</h3>
        <div className="v91-riders">{frame?.ownRiders.map(rider=><div key={rider.id}>
          <strong>{rider.id}</strong><span>{rider.group}</span><span>{rider.energy.toFixed(1)} energy</span>
        </div>)}</div>
        <p className="v91-warning">{result.warning}</p>
      </section>}
    </main>
  </TeamShell>;
}
