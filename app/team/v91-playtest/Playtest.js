'use client';
import {useState} from 'react';
import TeamShell from '../../components/TeamShell';
import {api} from '../../../lib/api';

const DEFAULT_PLANS=['chase','attack','neutral'];
const DEFAULT_BASELINES={chase:{effort:'hard',attack:'none',chase:'all'},
  attack:{effort:'steady',attack:'selective',chase:'ignore'},
  neutral:{effort:'steady',attack:'none',chase:'selective'}};
function defaultTacticFor(index,settings){
  let plan=settings.defaultRivalPlan;
  if(plan==='mixed'){
    const cycle=(index+1)%4;
    plan=index<3?settings.rivalPlans[index]:
      cycle===1?'chase':cycle===2?'attack':'neutral';
  }
  return {...DEFAULT_BASELINES[plan]};
}
const INITIAL={distanceKm:120,terrain:'flat',teamCount:4,gender:'M',fatigue:0,
  effort:'steady',attack:'selective',chase:'selective',seed:'playtest-1',
  profileHeightsM:[100,350,150,500,180,100],
  rivalPlans:[...DEFAULT_PLANS],defaultRivalPlan:'mixed',
  managerTactics:[]};
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
  const [customRivals,setCustomRivals]=useState(0);
  const [integratedMode,setIntegratedMode]=useState(false);
  const [finalePlans,setFinalePlans]=useState({});
  const [namedAttack,setNamedAttack]=useState({teamId:'',riderId:''});
  const [showPointPreview,setShowPointPreview]=useState(false);
  const [pointContext,setPointContext]=useState({tier:2,
    divisionIndex:1,divisionCount:2});
  const [result,setResult]=useState(null);
  const [integrated,setIntegrated]=useState(null);
  const [attackRoad,setAttackRoad]=useState(null);
  const [finaleReplay,setFinaleReplay]=useState(null);
  const [finaleFrameIndex,setFinaleFrameIndex]=useState(0);
  const [inspectedRiderId,setInspectedRiderId]=useState('you-7');
  const [selectedKm,setSelectedKm]=useState(1);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const frame=result?.frames[selectedKm-1];
  const change=(key,value)=>{
    if(key==='teamCount'){
      setCustomRivals(count=>Math.min(count,Number(value)-1));
      setNamedAttack(current=>current.teamId==='you'||
        Number(current.teamId.split('-').at(-1))<Number(value)?current:
        {teamId:'',riderId:''});
    }
    setSettings(current=>({...current,
      [key]:['distanceKm','teamCount','fatigue'].includes(key)?Number(value):value}));
  };
  const changeHeight=(index,value)=>setSettings(current=>({...current,
    profileHeightsM:current.profileHeightsM.map((height,at)=>at===index?Number(value):height)}));
  const changeRival=(index,value)=>setSettings(current=>({...current,
    rivalPlans:current.rivalPlans.map((plan,at)=>at===index?value:plan)}));
  const changeManager=(index,key,value)=>setSettings(current=>{
    const managerTactics=[...current.managerTactics];
    managerTactics[index]={...(managerTactics[index]??defaultTacticFor(index,current)),
      [key]:value};
    return {...current,managerTactics};
  });
  const changeFinale=(teamId,key,value)=>setFinalePlans(current=>{
    const plan=current[teamId]??{finisherId:`${teamId}-7`,
      leadOutRiderId:null};
    return {...current,[teamId]:{...plan,[key]:value,
      ...(key==='finisherId'&&plan.leadOutRiderId===value?
        {leadOutRiderId:null}:{})}};
  });
  const finaleTeams=['you',...Array.from({length:customRivals},
    (_,index)=>`rival-${index+1}`)];
  const lineTimes=integrated?.finale?.lineTimes??[];
  const conditionalLine=[...lineTimes].sort((a,b)=>
    a.elapsedSecondsFromLastKmStart-b.elapsedSecondsFromLastKmStart||
    a.riderId.localeCompare(b.riderId));
  const ownFinisher=integrated?.managerDecisions?.find(row=>
    row.teamId==='you')?.finisherId??'you-7';
  const ownCrossing=conditionalLine.find(row=>row.riderId===ownFinisher);
  const ownPointPreview=integrated?.provisionalPointPreview?.riders
    ?.find(row=>row.riderId===ownFinisher);
  const finaleFrame=finaleReplay?.frames[finaleFrameIndex];
  const inspectedRider=finaleFrame?.riders.find(row=>
    row.riderId===inspectedRiderId);
  const roadLeaders=[...(finaleFrame?.riders??[])].sort((a,b)=>
    b.positionM-a.positionM||a.riderId.localeCompare(b.riderId)).slice(0,5);
  const allAtLine=finaleFrame?.riders.every(row=>
    Math.abs(row.positionM-finaleReplay.lineDistanceM)<1e-6);
  const maxHeight=Math.max(500,...settings.profileHeightsM);
  const profileLine=settings.profileHeightsM.map((height,index)=>
    `${10+index*196},${110-height/maxHeight*100}`).join(' ');
  async function run(event){
    event.preventDefault();setBusy(true);setError('');
    try{
      const raceSettings={...settings,managerTactics:Array.from(
        {length:customRivals},(_,index)=>
          settings.managerTactics[index]??defaultTacticFor(index,settings))};
      const payload=integratedMode?{mode:'integrated',settings:raceSettings,
        finalePlans:finaleTeams.map(teamId=>({teamId,
          finisherId:finalePlans[teamId]?.finisherId??`${teamId}-7`,
          leadOutRiderId:finalePlans[teamId]?.leadOutRiderId??null})),
        ...(namedAttack.teamId?{attack:namedAttack}:{}),
        ...(showPointPreview?{pointContext}:{})}:
        raceSettings;
      const response=await api('/api/v91-playtest',{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      setResult(response.playtest);setIntegrated(response.integrated??null);
      setAttackRoad(response.attackRoad??null);
      setFinaleReplay(response.finaleReplay??null);
      setFinaleFrameIndex(0);
      setInspectedRiderId(response.integrated?.managerDecisions
        ?.find(row=>row.teamId==='you')?.finisherId??'you-7');
      setSelectedKm(1);
    }catch(cause){setError(cause.message||'The playtest could not run.');}
    finally{setBusy(false);}
  }
  return <TeamShell>
    <main className="v91-lab">
      <p className="v91-eyebrow">Experimental motor workbench · v91</p>
      <h1>Try a fictional race</h1>
      <p>Change your orders and the race conditions, then rerun with the same seed to compare what happened on the road.</p>
      <p className="v91-warning">Experimental preview. The full-race option records a conditional individual finish where the road can be paid and replayed; official places and points remain unavailable.</p>
      <form onSubmit={run} className="v91-controls">
        <label className="v91-mode"><input type="checkbox" checked={integratedMode}
          onChange={event=>setIntegratedMode(event.target.checked)}/>
          Continue to a conditional finish</label>
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
          <legend>Other managers</legend>
          <p>Choose default tactics for rivals, then customize as many individual managers as you want. The same seed keeps riders and route comparable.</p>
          <label>Default tactics for uncustomized managers
            <select value={settings.defaultRivalPlan} onChange={event=>change('defaultRivalPlan',event.target.value)}>
              <option value="mixed">Mixed defaults</option>
              <option value="chase">Hard chase</option>
              <option value="attack">Seek a break</option>
              <option value="neutral">Steady / selective</option>
            </select>
          </label>
          {settings.defaultRivalPlan==='mixed'&&<div className="v91-profile-points">{settings.rivalPlans.map((plan,index)=><label key={index}>
            Rival {index+1}
            <select value={plan} onChange={event=>changeRival(index,event.target.value)}>
              <option value="chase">Hard chase</option>
              <option value="attack">Seek a break</option>
              <option value="neutral">Steady / selective</option>
            </select>
          </label>)}</div>}
          <label>Managers with your own tactics
            <select value={customRivals} onChange={event=>setCustomRivals(Number(event.target.value))}>
              {Array.from({length:settings.teamCount},(_,count)=><option key={count} value={count}>
                {count} of {settings.teamCount-1} rivals
              </option>)}
            </select>
          </label>
          {customRivals>0&&<div className="v91-manager-tactics">
            {Array.from({length:customRivals},(_,index)=>
              settings.managerTactics[index]??defaultTacticFor(index,settings))
              .map((tactic,index)=><div key={index}>
              <strong>Rival {index+1}</strong>
              {['effort','attack','chase'].map(key=><label key={key}>
                Rival {index+1} {key}
                <select value={tactic[key]} onChange={event=>changeManager(index,key,event.target.value)}>
                  {OPTIONS[key].map(([value,label])=><option key={value} value={value}>{label}</option>)}
                </select>
              </label>)}
            </div>)}
          </div>}
        </fieldset>
        {integratedMode&&<fieldset className="v91-profile">
          <legend>Finale nominations</legend>
          <p>Choose a finisher and an optional helper for your team and any customized rival manager. Other managers use their captain. A helper works only when the recorded road lets the pair assemble.</p>
          <div className="v91-manager-tactics">{finaleTeams.map(teamId=>{
            const plan=finalePlans[teamId]??{finisherId:`${teamId}-7`,
              leadOutRiderId:null};
            return <div key={teamId}><strong>{teamId==='you'?'Your team':teamId}</strong>
              <label>{teamId} finisher<select value={plan.finisherId}
                onChange={event=>changeFinale(teamId,'finisherId',event.target.value)}>
                {Array.from({length:8},(_,index)=><option key={index}
                  value={`${teamId}-${index}`}>Rider {index+1}</option>)}</select>
              </label>
              <label>{teamId} lead-out helper<select value={plan.leadOutRiderId??''}
                onChange={event=>changeFinale(teamId,'leadOutRiderId',
                  event.target.value||null)}>
                <option value="">None</option>
                {Array.from({length:8},(_,index)=>`${teamId}-${index}`)
                  .filter(id=>id!==plan.finisherId).map(id=><option key={id}
                    value={id}>Rider {Number(id.split('-').at(-1))+1}</option>)}</select>
              </label>
            </div>;
          })}</div>
        </fieldset>}
        {integratedMode&&<fieldset className="v91-profile">
          <legend>Named final-kilometre attack</legend>
          <p>Optionally order one rider to attack at the start of the last kilometre. Other managers keep their chosen tactics. The recorded road decides whether the move survives.</p>
          <small>For this controlled attack, every other manager must use Attack: None and Chase: Ignore or All helpers. Unsupported orders return an explicit refusal.</small>
          <div className="v91-profile-points">
            <label>Named attack manager<select value={namedAttack.teamId}
              onChange={event=>setNamedAttack(event.target.value?{
                teamId:event.target.value,riderId:`${event.target.value}-0`}:
                {teamId:'',riderId:''})}>
              <option value="">None</option>
              {Array.from({length:settings.teamCount},(_,index)=>
                index===0?'you':`rival-${index}`).map(teamId=><option
                  key={teamId} value={teamId}>{teamId==='you'?'Your team':teamId}</option>)}
            </select></label>
            {namedAttack.teamId&&<label>Named attacking rider<select
              value={namedAttack.riderId}
              onChange={event=>setNamedAttack(current=>({...current,
                riderId:event.target.value}))}>
              {Array.from({length:8},(_,index)=><option key={index}
                value={`${namedAttack.teamId}-${index}`}>Rider {index+1}</option>)}
            </select></label>}
          </div>
        </fieldset>}
        {integratedMode&&<fieldset className="v91-profile">
          <legend>Optional points illustration</legend>
          <label className="v91-mode"><input type="checkbox"
            checked={showPointPreview}
            onChange={event=>setShowPointPreview(event.target.checked)}/>
            Show read-only point illustration</label>
          {showPointPreview&&<div className="v91-profile-points">
            <label>Race tier<select value={pointContext.tier}
              onChange={event=>setPointContext(current=>({...current,
                tier:Number(event.target.value)}))}>
              {Array.from({length:6},(_,index)=><option key={index+1}
                value={index+1}>Tier {index+1}</option>)}</select></label>
            <label>Division count<select value={pointContext.divisionCount}
              onChange={event=>setPointContext(current=>({
                ...current,divisionCount:Number(event.target.value),
                divisionIndex:Math.min(current.divisionIndex,
                  Number(event.target.value))}))}>
              {Array.from({length:4},(_,index)=><option key={index+1}
                value={index+1}>{index+1}</option>)}</select></label>
            <label>Fictional division<select value={pointContext.divisionIndex}
              onChange={event=>setPointContext(current=>({...current,
                divisionIndex:Number(event.target.value)}))}>
              {Array.from({length:pointContext.divisionCount},(_,index)=><option
                key={index+1} value={index+1}>{index+1}</option>)}</select></label>
          </div>}
          <small>Only an unambiguous conditional line can receive a policy illustration. No awards are saved.</small>
        </fieldset>}
        <label>Scenario seed<input value={settings.seed} maxLength={80}
          onChange={event=>change('seed',event.target.value)} /></label>
        <button type="submit" disabled={busy}>{busy?'Running race…':
          integratedMode?'Run full race preview':'Run race'}</button>
      </form>
      {error&&<p role="alert" className="v91-error">{error}</p>}
      {result&&<section className="v91-results" aria-label="Playtest recording">
        <h2>Recorded race · {result.settings.distanceKm} km {result.settings.terrain}</h2>
        <p>{result.tuningVersion} · {result.settings.managerTactics.length} custom rival managers{integrated?' · Conditional finale':` · Your captain: provisional #${result.ownCaptain??'—'}`}</p>
        {integrated&&<p>Replay the locked kilometres through {result.handoffKm} km here. The paid final kilometre continues below.</p>}
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
        {finaleReplay&&<div className="v91-finish">
          <h3>Paid final-kilometre replay</h3>
          <p>All {finaleFrame?.riders.length} riders continue from the locked {result.handoffKm} km handoff on one clock.</p>
          <label>Finale interval: {finaleFrameIndex+1} of {finaleReplay.frames.length}
            <input type="range" min="0" max={finaleReplay.frames.length-1}
              value={finaleFrameIndex}
              onChange={event=>setFinaleFrameIndex(Number(event.target.value))}/>
          </label>
          <p>{finaleFrame?.elapsedSeconds.toFixed(2)} s after the handoff · {finaleFrame?.roadGroups.length?
            `${finaleFrame.roadGroups.length} groups ahead`:'No recorded groups ahead'}</p>
          <label>Inspect rider<select value={inspectedRiderId}
            onChange={event=>setInspectedRiderId(event.target.value)}>
            {finaleReplay.frames[0].riders.map(row=><option
              key={row.riderId} value={row.riderId}>{row.riderId}</option>)}
          </select></label>
          {inspectedRider&&<p>{inspectedRider.riderId}: {(finaleReplay.lineDistanceM-
            inspectedRider.positionM).toFixed(1)} m to go · {inspectedRider.energyAfter.toFixed(1)} energy · {inspectedRider.energySpent.toFixed(2)} spent this interval · {inspectedRider.role}</p>}
          <p>{allAtLine?'All riders have crossed; see the conditional times below.':
            `Frontmost positions at this boundary: ${roadLeaders.map(row=>
              `${row.riderId} (${(finaleReplay.lineDistanceM-row.positionM).toFixed(1)} m to go)`).join(', ')}`}</p>
        </div>}
        {integrated&&!finaleReplay&&<p className="v91-warning">
          A complete rider-by-rider final-kilometre replay is not available for this road state. The recorded handoff, conditional line and contact evidence remain below.
        </p>}
        {integrated?<div className="v91-finish">
          <h3>Conditional finish</h3>
          <p>Road: {integrated.roadStatus??integrated.status??'unresolved'} · Individual finish: {integrated.finale?.individualFinishStatus??'unavailable'} · Points: {integrated.pointsStatus}</p>
          {integrated.reason&&<p role="status">{integrated.reason}</p>}
          {integrated.request?.attackRiderId&&<p>Named attack: {integrated.request.attackRiderId} · {attackRoad?
            `launched at ${attackRoad.atKm} km; ${attackRoad.branch} road, ${attackRoad.roadGroupCount} group at ${(attackRoad.handoffDistanceM/1000).toFixed(1)} km`:
            'no paid road decision recorded'}</p>}
          <p>Your nominated finisher: {ownFinisher} · {ownCrossing?
            `${ownCrossing.elapsedSecondsFromLastKmStart.toFixed(3)} s from the last kilometre, ${ownCrossing.energyAtLine.toFixed(1)} energy at the line`:
            'No paid individual crossing'}</p>
          {integrated.unavailableLeadOuts?.map(row=><p key={row.teamId}>
            {row.helperId} could not assemble in the source lane; no helper work was charged.
          </p>)}
          <p>Paid lead-out work: {integrated.finale?.leadOutWork?.length??0} recorded rider intervals.</p>
          {integrated.finale?.leadOutWork?.length>0&&<ul>{Object.entries(
            integrated.finale.leadOutWork.reduce((totals,row)=>({
              ...totals,[row.riderId]:(totals[row.riderId]??0)+row.energySpent
            }),{})).map(([riderId,energy])=><li key={riderId}>
            {riderId}: {energy.toFixed(1)} energy spent</li>)}</ul>}
          {conditionalLine.length>0&&<><h4>First conditional crossings</h4>
            <ol>{conditionalLine.slice(0,10).map(row=><li key={row.riderId}>
              {row.riderId} · {row.elapsedSecondsFromLastKmStart.toFixed(3)} s · {row.energyAtLine.toFixed(1)} energy
            </li>)}</ol>
            <p>{conditionalLine.length} of {result.settings.teamCount*8} riders have individual crossing times. Times do not establish official places.</p></>}
          {integrated.provisionalPointPreview&&<div>
            <h4>Read-only points illustration</h4>
            {ownPointPreview?<p>{ownFinisher}: provisional place {ownPointPreview.provisionalPlace}, {ownPointPreview.previewPoints} preview points.</p>:
              <p>{integrated.provisionalPointPreview.reason??'No unambiguous individual order.'}</p>}
            <p>Official points: withheld · Awards saved: 0</p>
          </div>}
          <p>Last-kilometre source: {integrated.lastKmSource?.roadGroups?.length??0} groups ahead; {integrated.lastKmSource?.droppedRiderIds?.length??0} isolated riders.</p>
          {integrated.lastKmSource?.roadGroups?.map(group=><p key={group.id}>
            {group.id}: {group.riderIds.join(', ')} · {group.gapSeconds.toFixed(1)} s ahead
          </p>)}
          {integrated.finale?.roadEvents?.length>0&&<details>
            <summary>Replay finale road events ({integrated.finale.roadEvents.length})</summary>
            <ol>{integrated.finale.roadEvents.map((event,index)=><li key={index}>
              {event.elapsedSeconds?.toFixed(2)??'—'} s · {event.kind} · {event.passerId??event.riderId??'field'}
              {event.passedId?` passes ${event.passedId}`:''}
            </li>)}</ol>
          </details>}
        </div>:<p className="v91-warning">{result.warning}</p>}
      </section>}
    </main>
  </TeamShell>;
}
