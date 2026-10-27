'use client';
import {useState} from 'react';
import TeamShell from '../../../components/TeamShell';
import {api} from '../../../../lib/api';

const INITIAL={format:'one_day',distanceKm:260,terrain:'flat',teamCount:20,
  gender:'M',fatigue:0,effort:'steady',attack:'none',chase:'selective',
  rivalOneGoal:'auto',controlWithdrawalVersion:1,
  seed:'race-dynamics-preview-1'};
const OPTIONS={format:[['one_day','One-day race'],['stage','Stage race']],
  distanceKm:[[40,'40 km'],[120,'120 km'],[260,'260 km']],
  terrain:[['flat','Flat'],['rolling','Rolling'],['mountain','Mountain'],
    ['exposed','Exposed']],teamCount:[[4,'4 teams'],[15,'15 teams'],
    [20,'20 teams']],gender:[['M','Men'],['F','Women']],
  fatigue:[[0,'Fresh'],[15,'Some fatigue'],[30,'Tired']],
  effort:[['conserve','Conserve'],['steady','Steady'],['hard','Hard']],
  attack:[['none','None'],['selective','Selective'],['repeated','Repeated']],
  chase:[['ignore','Ignore'],['selective','Selective'],['all','All helpers']],
  rivalOneGoal:[['auto','Seeded plan'],['break','Break'],
    ['control','Control'],['protect','Protect'],
    ['opportunistic','Opportunistic']],
  controlWithdrawalVersion:[[1,'Current selective pursuit'],
    [2,'Try impossible-pursuit withdrawal']]};
const LABELS={format:'Race format',distanceKm:'Distance',terrain:'Route',
  teamCount:'Field',gender:'Category',fatigue:'Starting fatigue',
  effort:'Your effort',attack:'Your attack order',chase:'Your chase order',
  rivalOneGoal:'Fictional rival 1 goal',
  controlWithdrawalVersion:'Control-team pursuit'};
const time=seconds=>seconds>=60?
  `${Math.floor(seconds/60)}m ${Math.round(seconds%60)}s`:
  `${Number(seconds).toFixed(1)}s`;
const riderLabel=(preview,id)=>preview.riderNames[id]??id;
const teamLabel=(preview,id)=>preview.teamPlans.find(row=>
  row.teamId===id)?.teamName??id;
const riders=(preview,ids)=>ids.length?
  ids.map(id=>riderLabel(preview,id)).join(', '):'None';

export default function RaceDynamicsPreview(){
  const [settings,setSettings]=useState(INITIAL);
  const [preview,setPreview]=useState(null);
  const [km,setKm]=useState(1);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const frame=preview?.frames[km-1];
  const setChoice=(key,value)=>setSettings(current=>({...current,
    [key]:['distanceKm','teamCount','fatigue',
      'controlWithdrawalVersion'].includes(key)?
      Number(value):value}));
  async function run(event){
    event.preventDefault();setBusy(true);setError('');setPreview(null);
    try{
      const {format,rivalOneGoal,controlWithdrawalVersion,
        ...raceSettings}=settings;
      const response=await api('/api/v91-playtest',{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({mode:'v94-race-dynamics',format,
          controlWithdrawalVersion,
          settings:raceSettings,rivalGoals:rivalOneGoal==='auto'?[]:
            [{teamId:'rival-1',role:rivalOneGoal}]}),
        signal:AbortSignal.timeout(60_000)});
      setPreview(response.raceDynamics);setKm(1);
    }catch(cause){setError(cause.message||'The race could not run.');}
    finally{setBusy(false);}
  }
  return <TeamShell compact>
    <main className="v94-preview">
      <a href="/team/motor-lab" className="v94-back">← Motor Lab</a>
      <p className="v94-eyebrow">Experimental race dynamics</p>
      <h1>Follow the recorded road</h1>
      <p>Choose a race and your opening orders. Rival goals are committed
        before the start; the same seed and settings repeat the same field.</p>
      <p className="v94-caution">This preview records group movement and
        paid work. Individual finishing places, points and awards are not
        determined here or saved as official results.</p>
      <form onSubmit={run} className="v94-form">
        {Object.entries(OPTIONS).map(([key,options])=><label key={key}>
          <span>{LABELS[key]}</span><select value={settings[key]}
            onChange={event=>setChoice(key,event.target.value)}>
            {options.map(([value,label])=><option key={value} value={value}>
              {label}</option>)}
          </select></label>)}
        <p className="v94-goal-note">Rival 1 uses the seeded plan unless you
          choose a goal. A chosen goal commits its matching opening orders
          for this preview.</p>
        <p className="v94-goal-note">The optional withdrawal rule lets a
          control team stop paying for a chase when its recorded catch
          projection is impossible. The lead may grow much larger.</p>
        <label className="v94-seed"><span>Race seed</span><input
          value={settings.seed} maxLength={80}
          onChange={event=>setChoice('seed',event.target.value)}/></label>
        <button type="submit" disabled={busy}>{busy?'Running race…':
          'Run experimental race'}</button>
      </form>
      {error&&<p className="v94-error" role="alert">{error}</p>}
      {preview&&<>
        <section className="v94-summary" aria-label="Recorded race summary">
          <h2>What the recording shows</h2>
          <p>{preview.story.widestRecordedLead.km>0?<>
            Widest leading-group gap: <strong>{time(
              preview.story.widestRecordedLead.gapSeconds)}</strong> at km {
              preview.story.widestRecordedLead.km}. </>:
            'No leading road group was recorded. '}
            Recorded kilometres with a lead of at least one minute: <strong>{
              preview.story.kilometresAtOrAboveOneMinute}</strong>.</p>
          <p>At the last recorded kilometre: <strong>{
            preview.story.finalRoadGroups}</strong> group(s) ahead of the
            bunch, with a leading gap of <strong>{time(
              preview.story.finalRecordedLeadSeconds)}</strong>.</p>
        </section>
        <section className="v94-road" aria-label="Inspect race kilometre">
          <h2>Road clock at km {km}</h2>
          <div className="v94-jumps">
            <button type="button" onClick={()=>setKm(1)}>Start</button>
            <button type="button" onClick={()=>setKm(Math.max(1,
              preview.story.widestRecordedLead.km))}>Widest lead</button>
            <button type="button" onClick={()=>setKm(preview.frames.length)}>
              Last km</button>
          </div>
          <input type="range" min="1" max={preview.frames.length}
            value={km} aria-label="Race kilometre"
            onChange={event=>setKm(Number(event.target.value))}/>
          <p>{frame.terrain} · leading gap {time(frame.gapSeconds)} · {
            frame.roadGroups.length} group(s) ahead</p>
          {frame.roadGroups.length?frame.roadGroups.map(group=><article
            key={group.id} className="v94-group">
            <h3>{group.id} · {time(group.gapSeconds)} ahead</h3>
            <p>Group membership, unordered: {riders(preview,group.riderIds)}</p>
          </article>):<p>All recorded road groups are with the bunch.</p>}
          <div className="v94-evidence">
            <p><strong>Attack attempts:</strong> {riders(preview,frame.attackers)}</p>
            <p><strong>Chasing teams:</strong> {frame.chasers.length?
              frame.chasers.map(id=>teamLabel(preview,id)).join(', '):'None'}</p>
            <p><strong>Paid bunch-front work:</strong> {
              frame.paidBunchPace?`${teamLabel(preview,
                frame.paidBunchPace.teamId)} — ${riders(preview,
                frame.paidBunchPace.riderIds)}`:'None'}</p>
            <p><strong>Leading-group workers:</strong> {
              riders(preview,frame.frontWorkers)}</p>
            <p><strong>Leading-group riders resting:</strong> {
              riders(preview,frame.frontResters)}</p>
            <p><strong>Caught this km:</strong> {
              riders(preview,frame.caughtRiders)}</p>
            {frame.frontCoast.length>0&&<p><strong>Paid front coast:</strong> {
              frame.frontCoast.map(row=>`${riderLabel(preview,
                row.riderId)} delayed ${time(row.delaySeconds)}`).join(', ')}</p>}
          </div>
          <h3>Your riders</h3>
          <div className="v94-riders">{frame.ownRiders.map(row=><p key={row.id}>
            <strong>{riderLabel(preview,row.id)}</strong> · {row.group} · {
              row.energy.toFixed(1)} energy{row.deficitSeconds>0?
              ` · ${time(row.deficitSeconds)} behind bunch`:''}</p>)}</div>
        </section>
        <details className="v94-plans"><summary>Inspect every team's
          committed opening goal and orders</summary>
          <div className="v94-plan-list">{preview.teamPlans.map(plan=><article
            key={plan.teamId}><h3>{plan.teamName}</h3>
            <p>{plan.role} · {plan.source.replaceAll('_',' ')} · captain {
              riderLabel(preview,plan.captainId)}</p>
            <p>Attack {plan.baseline.attack} · chase {plan.baseline.chase} ·
              effort {plan.baseline.effort} · front work {
                plan.baseline.frontWork??'none'}</p>
            {plan.specialistRiderId&&<p>Opening specialist: {
              riderLabel(preview,plan.specialistRiderId)}</p>}</article>)}</div>
        </details>
      </>}
    </main>
  </TeamShell>;
}
