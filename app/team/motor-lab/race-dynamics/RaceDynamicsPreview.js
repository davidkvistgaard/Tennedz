'use client';
import {useState} from 'react';
import TeamShell from '../../../components/TeamShell';
import {api} from '../../../../lib/api';

const INITIAL={format:'one_day',distanceKm:260,terrain:'flat',teamCount:20,
  gender:'M',fatigue:0,effort:'steady',attack:'none',chase:'selective',
  rivalOneGoal:'auto',controlWithdrawalVersion:1,ownFrontWork:'none',
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
  ownFrontWork:[['none','No standing front-work order'],
    ['rotate','Rotate paid bunch-front helpers']],
  rivalOneGoal:[['auto','Seeded plan'],['break','Break'],
    ['control','Control'],['protect','Protect'],
    ['opportunistic','Opportunistic']],
  controlWithdrawalVersion:[[1,'Current selective pursuit'],
    [2,'Try impossible-pursuit withdrawal']]};
const LABELS={format:'Race format',distanceKm:'Distance',terrain:'Route',
  teamCount:'Field',gender:'Category',fatigue:'Starting fatigue',
  effort:'Your effort',attack:'Your attack order',chase:'Your chase order',
  ownFrontWork:'Your bunch-front work',
  rivalOneGoal:'Fictional rival 1 goal',
  controlWithdrawalVersion:'Control-team pursuit'};
const time=seconds=>{
  const rounded=Math.round(Number(seconds)*10)/10;
  if(rounded<60)return `${rounded.toFixed(1)}s`;
  const totalSeconds=Math.round(rounded);
  return `${Math.floor(totalSeconds/60)}m ${totalSeconds%60}s`;
};
const riderLabel=(preview,id)=>preview.riderNames[id]??id;
const teamLabel=(preview,id)=>preview.teamPlans.find(row=>
  row.teamId===id)?.teamName??id;
const riders=(preview,ids)=>ids.length?
  ids.map(id=>riderLabel(preview,id)).join(', '):'None';
const coastOutcome=(preview,frame,row)=>{
  const rider=riderLabel(preview,row.riderId);
  const outcome=row.joinedGroupId?`joined ${row.joinedGroupId}`:
    row.detachedGroupId?`formed ${row.detachedGroupId}`:
      frame.caughtRiders.includes(row.riderId)?
        `caught by the bunch${row.residualSeconds>0?
          ` with ${time(row.residualSeconds)} residual delay`:''}`:
        'stayed on the road';
  return `${rider} lost ${time(row.delaySeconds)}; ${outcome}`;
};
const LEAD_CHART={left:26,right:694,top:14,bottom:150};
function LeadTimeline({preview,km}){
  const frames=preview.frames;
  const maxGap=Math.max(60,preview.story.widestRecordedLead.gapSeconds);
  const x=index=>LEAD_CHART.left+(LEAD_CHART.right-LEAD_CHART.left)*
    index/Math.max(1,frames.length-1);
  const y=seconds=>LEAD_CHART.bottom-(LEAD_CHART.bottom-LEAD_CHART.top)*
    seconds/maxGap;
  const selected=frames[km-1];
  const points=frames.map((frame,index)=>
    `${x(index).toFixed(1)},${y(frame.gapSeconds).toFixed(1)}`).join(' ');
  return <figure className="v94-lead-timeline">
    <svg viewBox="0 0 720 185" role="img" aria-label={
      `Recorded leading-group gap from km 1 to km ${frames.length}; `+
      `widest ${time(preview.story.widestRecordedLead.gapSeconds)} `+
      `at km ${preview.story.widestRecordedLead.km}`}>
      <line className="v94-lead-axis" x1="26" x2="694" y1="150" y2="150"/>
      <line className="v94-lead-minute" x1="26" x2="694"
        y1={y(60)} y2={y(60)}/>
      <polyline className="v94-lead-line" points={points}/>
      <circle className="v94-lead-current" cx={x(km-1)}
        cy={y(selected.gapSeconds)} r="5"/>
      <text x="26" y="174">Km 1</text>
      <text x="694" y="174" textAnchor="end">Km {frames.length}</text>
    </svg>
    <figcaption>Recorded lead in seconds. The dashed line marks one minute;
      the dot marks km {km}. This is time, not mapped road distance.</figcaption>
  </figure>;
}

export default function RaceDynamicsPreview(){
  const [settings,setSettings]=useState(INITIAL);
  const [extraGoals,setExtraGoals]=useState({});
  const [preview,setPreview]=useState(null);
  const [km,setKm]=useState(1);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const frame=preview?.frames[km-1];
  const controlEnergy=frame?.teamEnergy.filter(row=>
    preview.teamPlans.some(plan=>plan.teamId===row.teamId&&
      plan.role==='control'))??[];
  const paidTeamWork=preview?preview.teamPlans.map(plan=>({
    teamId:plan.teamId,role:plan.role,
    chaseKm:preview.frames.slice(0,km).filter(row=>
      row.chasers.includes(plan.teamId)).length,
    bunchFrontKm:preview.frames.slice(0,km).filter(row=>
      row.paidBunchPace?.teamId===plan.teamId).length,
    energy:frame.teamEnergy.find(row=>row.teamId===plan.teamId)?.mean,
  })):[];
  const coastMoments=preview?.frames.filter(row=>row.frontCoast.length>0)
    .map(row=>row.km)??[];
  const setChoice=(key,value)=>setSettings(current=>({...current,
    [key]:['distanceKm','teamCount','fatigue',
      'controlWithdrawalVersion'].includes(key)?
      Number(value):value}));
  async function run(event){
    event.preventDefault();setBusy(true);setError('');setPreview(null);
    try{
      const {format,rivalOneGoal,controlWithdrawalVersion,ownFrontWork,
        ...raceSettings}=settings;
      const rivalGoals=[
        ...(rivalOneGoal==='auto'?[]:[{teamId:'rival-1',role:rivalOneGoal}]),
        ...Object.entries(extraGoals).filter(([number,role])=>
          Number(number)<settings.teamCount&&role!=='auto')
          .map(([number,role])=>({teamId:`rival-${number}`,role})),
      ];
      const response=await api('/api/v91-playtest',{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({mode:'v94-race-dynamics',format,
          controlWithdrawalVersion,ownFrontWork,
          settings:raceSettings,rivalGoals}),
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
        {Object.entries(OPTIONS).map(([key,options])=><label key={key}
          className={key==='controlWithdrawalVersion'?'v94-policy-choice':
            undefined}>
          <span>{LABELS[key]}</span><select value={settings[key]}
            onChange={event=>setChoice(key,event.target.value)}>
            {options.map(([value,label])=><option key={value} value={value}>
              {label}</option>)}
          </select></label>)}
        <p className="v94-goal-note">Rival 1 uses the seeded plan unless you
          choose a goal. A chosen goal commits its matching opening orders
          for this preview.</p>
        <details className="v94-more-goals">
          <summary>Set more rival goals</summary>
          <p>Each changed goal replaces that fictional team's opening orders.
            Other teams keep their seeded plans.</p>
          <div className="v94-more-goal-grid">
            {Array.from({length:settings.teamCount-2},(_,index)=>index+2)
              .map(number=><label key={number}>
                <span>Fictional rival {number} goal</span>
                <select value={extraGoals[number]??'auto'}
                  onChange={event=>setExtraGoals(current=>({...current,
                    [number]:event.target.value}))}>
                  {OPTIONS.rivalOneGoal.map(([value,label])=><option
                    key={value} value={value}>{label}</option>)}
                </select>
              </label>)}
          </div>
        </details>
        <p className="v94-goal-note">The optional withdrawal rule lets a
          control team stop paying for a chase when its recorded catch
          projection is impossible. The lead may grow much larger.</p>
        <p className="v94-goal-note">A standing bunch-front order spends your
          eligible helpers' reserve on kilometres when they are selected to
          pace. Inspect the paid work before treating a long effort as free.</p>
        <p className="v94-goal-note">This workbench allows up to six race runs
          per minute on your account.</p>
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
          <p>Seed <strong>{preview.settings.seed}</strong> · control pursuit:{' '}
            <strong>{preview.policy.controlWithdrawalVersion===2?
              'experimental impossible-pursuit withdrawal':
              'current selective pursuit'}</strong>.</p>
          <p>Front exhaustion: <strong>paid coast and group contact, version {
            preview.policy.frontExhaustionVersion}</strong>.</p>
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
          <LeadTimeline preview={preview} km={km}/>
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
          {coastMoments.length>0&&<div className="v94-jumps"
            aria-label="Recorded paid slowdown moments">
            {coastMoments.slice(0,12).map(moment=><button key={moment}
              type="button" onClick={()=>setKm(moment)}>
              Paid slowdown km {moment}</button>)}
          </div>}
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
            {frame.controlWithheld.length>0&&<p><strong>Control teams
              withholding an uncatchable chase:</strong> {
              frame.controlWithheld.map(id=>teamLabel(preview,id))
                .join(', ')}</p>}
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
              frame.frontCoast.map(row=>coastOutcome(preview,frame,row))
                .join(', ')}</p>}
          </div>
          {controlEnergy.length>0&&<p><strong>Control-team mean rider
            reserve:</strong> {controlEnergy.map(row=>`${teamLabel(preview,
              row.teamId)} ${row.mean.toFixed(1)}`).join(' · ')}</p>}
          <h3>Your riders</h3>
          <div className="v94-riders">{frame.ownRiders.map(row=><p key={row.id}>
            <strong>{riderLabel(preview,row.id)}</strong> · {row.group} · {
              row.energy.toFixed(1)} energy{row.deficitSeconds>0?
              ` · ${time(row.deficitSeconds)} behind bunch`:''}</p>)}</div>
        </section>
        <details className="v94-plans"><summary>Paid team work through km {km}</summary>
          <p>Each kilometre counts only a recorded chase or a paid bunch-front
            pace by that team. Reserve is the recorded team mean at km {km}.</p>
          <div className="v94-work-list">{paidTeamWork.map(row=><p key={row.teamId}>
            <strong>{teamLabel(preview,row.teamId)}</strong> · {row.role} ·
            chase {row.chaseKm} km · bunch front {row.bunchFrontKm} km ·
            reserve {row.energy?.toFixed(1)??'—'}
          </p>)}</div>
        </details>
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
