'use client';
import {useState} from 'react';
import TeamShell from '../../components/TeamShell';
import {api} from '../../../lib/api';

const DEFAULT_PLANS=['chase','attack','neutral'];
const DEFAULT_BASELINES={chase:{effort:'hard',attack:'none',chase:'all'},
  attack:{effort:'steady',attack:'selective',chase:'ignore'},
  neutral:{effort:'steady',attack:'none',chase:'selective'},
  passive:{effort:'steady',attack:'none',chase:'ignore'}};
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
  managerTactics:[],managerTacticOverrides:[]};
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

function conditionalPlace(place,fallback='—'){
  if(Number.isInteger(place?.position))return place.position;
  if(!Number.isInteger(place?.firstPossiblePlace)||
    !Number.isInteger(place?.lastPossiblePlace))return fallback;
  return place.firstPossiblePlace===place.lastPossiblePlace?
    place.firstPossiblePlace:
    `${place.firstPossiblePlace}–${place.lastPossiblePlace}`;
}

function phaseOrderSummary(phases){
  return phases.length?phases.map(phase=>
    `at ${phase.atKm} km: ${['effort','attack','attackRiderId',
      'chase','frontWork'].filter(key=>phase[key]!=null)
      .map(key=>`${key} ${phase[key]}`).join(', ')}`).join('; '):'none';
}

function roadComposition(frame){
  const groups=frame.roadGroups.map(group=>
    `${group.id}:${[...group.riderIds].sort().join(',')}`).sort();
  const isolated=frame.droppedRiders.map(row=>row.riderId).sort();
  return JSON.stringify([groups,isolated]);
}

function recordedRoadChanges(frames){
  return frames.flatMap((frame,index)=>index>0&&
    roadComposition(frame)!==roadComposition(frames[index-1])?
    [{index,frame}]:[]);
}

function comparisonConditions(settings){
  const {distanceKm,terrain,teamCount,gender,fatigue,seed,
    profileHeightsM}=settings;
  return JSON.stringify({distanceKm,terrain,teamCount,gender,fatigue,seed,
    ...(terrain==='custom'?{profileHeightsM}:{})});
}

function comparisonRun(settings,response,pointContext){
  const summary=response.integrated;
  const ownDecision=summary.managerDecisions?.find(row=>
    row.teamId==='you');
  const finisherId=ownDecision?.finisherId??'you-7';
  const leadOutRiderId=ownDecision?.leadOutRiderId??null;
  const crossing=summary.finale?.lineTimes?.find(row=>
    row.riderId===finisherId);
  const ownPreview=summary.provisionalPointPreview?.riders?.find(row=>
    row.riderId===finisherId);
  const pointLabel=pointContext?
    ownPreview?`${finisherId}: provisional place ${ownPreview.provisionalPlace}, ${ownPreview.previewPoints} preview points`:
      `unavailable (${summary.provisionalPointPreview?.reason??'No unambiguous individual line.'})`:
    null;
  return {conditions:comparisonConditions(settings),finisherId,
    crossingSeconds:crossing?.elapsedSecondsFromLastKmStart??null,
    energyAtLine:crossing?.energyAtLine??null,
    sourceGroups:summary.lastKmSource?.roadGroups?.length??0,
    namedAttack:summary.request?.attackRiderId??
      summary.request?.namedAttacks?.map(row=>row.riderId).join(', ')??'none',
    attackRoad:response.attackRoad?.branch??null,
    leadOutRiderId,
    leadOutEnergy:(summary.finale?.leadOutWork??[])
      .filter(row=>row.riderId===leadOutRiderId)
      .reduce((total,row)=>total+row.energySpent,0),
    pointContext:pointContext?JSON.stringify(pointContext):null,
    pointLabel};
}

function coastedComparisonRun(settings,summary,pointContext){
  const ownDecision=summary.managerDecisions.find(row=>
    row.teamId==='you');
  const finisherId=ownDecision?.finisherId??'you-7';
  const leadOutRiderId=ownDecision?.leadOutRiderId??null;
  const crossing=summary.lineTimes.find(row=>row.riderId===finisherId);
  const place=summary.provisionalLineOrder?.find(row=>
    row.riderId===finisherId)??summary.roadPlaceBounds?.riders.find(row=>
    row.riderId===finisherId);
  const ownPoints=summary.pointPreview?.riders?.find(row=>
    row.riderId===finisherId);
  const rivalOutcomes=summary.managerOrders.filter(order=>
    order.teamId!=='you').map(order=>{
    const decision=summary.managerDecisions.find(row=>
      row.teamId===order.teamId);
    const riderId=decision?.finisherId;
    const line=summary.lineTimes.find(row=>row.riderId===riderId);
    const rivalPlace=summary.provisionalLineOrder?.find(row=>
      row.riderId===riderId)??summary.roadPlaceBounds?.riders.find(row=>
      row.riderId===riderId);
    const preview=summary.pointPreview?.riders?.find(row=>
      row.riderId===riderId);
    return {teamId:order.teamId,effort:order.effort,
      attack:order.attack,chase:order.chase,
      phaseOrders:order.phaseOrders,finisherId:riderId,
      leadOutRiderId:decision?.leadOutRiderId??null,
      roadBandId:line?.roadBandId??null,
      crossingSeconds:line?.elapsedSecondsFromLastKmStart??null,
      energyAtLine:line?.energyAtLine??null,
      place:conditionalPlace(rivalPlace,'unresolved'),
      previewPoints:pointContext?preview?.previewPoints??null:null};
  });
  return {conditions:comparisonConditions(settings),finisherId,
    crossingSeconds:crossing?.elapsedSecondsFromLastKmStart??null,
    energyAtLine:crossing?.energyAtLine??null,
    place:conditionalPlace(place,'unresolved'),
    roadStatus:summary.roadStatus,
    sourceGroups:summary.kilometreFrames.at(-1)?.roadGroups.length??0,
    sourceDropped:summary.kilometreFrames.at(-1)?.droppedRiders.length??0,
    leadOutRiderId,
    leadOutEnergy:summary.leadOutWork.filter(row=>
      row.riderId===leadOutRiderId).reduce((sum,row)=>
      sum+row.energySpent,0),
    rivalOutcomes,
    pointContext:pointContext?JSON.stringify(pointContext):null,
    pointLabel:pointContext?ownPoints?
      `${ownPoints.previewPoints} (place ${conditionalPlace(place)})`:
      `unavailable (${summary.pointPreview?.reason??
        'No unambiguous individual order.'})`:null};
}

function attackDescription(run){
  return `${run.namedAttack}${run.attackRoad?
    ` (${run.attackRoad} road)`:''}`;
}

function bunchRelativeGap(deficitSeconds,decimals){
  if(deficitSeconds<0)return `${Math.abs(deficitSeconds).toFixed(decimals)} s ahead of bunch`;
  if(deficitSeconds>0)return `${deficitSeconds.toFixed(decimals)} s behind bunch`;
  return 'with bunch';
}

export default function Playtest(){
  const [settings,setSettings]=useState(INITIAL);
  const [customRivals,setCustomRivals]=useState(0);
  const [extraRivalId,setExtraRivalId]=useState('');
  const [integratedMode,setIntegratedMode]=useState(false);
  const [coastedMode,setCoastedMode]=useState(false);
  const [coasted,setCoasted]=useState(null);
  const [coastedKm,setCoastedKm]=useState(1);
  const [coastedRoadIndex,setCoastedRoadIndex]=useState(0);
  const [coastedBandId,setCoastedBandId]=useState('');
  const [coastedBandIndex,setCoastedBandIndex]=useState(0);
  const [coastedRiderId,setCoastedRiderId]=useState('');
  const [finalePlans,setFinalePlans]=useState({});
  const [lateEfforts,setLateEfforts]=useState({});
  const [finaleFrontWork,setFinaleFrontWork]=useState({});
  const [namedAttack,setNamedAttack]=useState({teamId:'',riderId:''});
  const [secondNamedAttack,setSecondNamedAttack]=useState({teamId:'',riderId:''});
  const [showPointPreview,setShowPointPreview]=useState(false);
  const [pointContext,setPointContext]=useState({tier:2,
    divisionIndex:1,divisionCount:2});
  const [result,setResult]=useState(null);
  const [integrated,setIntegrated]=useState(null);
  const [attackRoad,setAttackRoad]=useState(null);
  const [attackApproach,setAttackApproach]=useState(null);
  const [approachFrameIndex,setApproachFrameIndex]=useState(0);
  const [approachRiderId,setApproachRiderId]=useState('');
  const [finaleReplay,setFinaleReplay]=useState(null);
  const [bandLocalReplay,setBandLocalReplay]=useState(null);
  const [bandId,setBandId]=useState('');
  const [bandFrameIndex,setBandFrameIndex]=useState(0);
  const [bandRiderId,setBandRiderId]=useState('');
  const [finaleFrameIndex,setFinaleFrameIndex]=useState(0);
  const [concurrentRoadIndex,setConcurrentRoadIndex]=useState(0);
  const [inspectedRiderId,setInspectedRiderId]=useState('you-7');
  const [selectedKm,setSelectedKm]=useState(1);
  const [resultsTeam,setResultsTeam]=useState('all');
  const [previousRun,setPreviousRun]=useState(null);
  const [comparison,setComparison]=useState(null);
  const [previousCoastedRun,setPreviousCoastedRun]=useState(null);
  const [coastedComparison,setCoastedComparison]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const changedRivalOutcomes=coastedComparison?
    coastedComparison.after.rivalOutcomes.flatMap(after=>{
      const before=coastedComparison.before.rivalOutcomes.find(row=>
        row.teamId===after.teamId);
      return before&&JSON.stringify({effort:before.effort,
        attack:before.attack,chase:before.chase,
        phaseOrders:before.phaseOrders,
        finisherId:before.finisherId,
        leadOutRiderId:before.leadOutRiderId})!==
        JSON.stringify({effort:after.effort,attack:after.attack,
          chase:after.chase,phaseOrders:after.phaseOrders,
          finisherId:after.finisherId,
          leadOutRiderId:after.leadOutRiderId})?
        [{before,after}]:[];
    }):[];
  const frame=result?.frames[selectedKm-1];
  const change=(key,value)=>{
    if(key==='teamCount'){
      setCustomRivals(count=>Math.min(count,Number(value)-1));
      setExtraRivalId('');
      setNamedAttack(current=>current.teamId==='you'||
        Number(current.teamId.split('-').at(-1))<Number(value)?current:
        {teamId:'',riderId:''});
      setSecondNamedAttack(current=>current.teamId==='you'||
        Number(current.teamId.split('-').at(-1))<Number(value)?current:
        {teamId:'',riderId:''});
    }
    setSettings(current=>({...current,
      [key]:['distanceKm','teamCount','fatigue'].includes(key)?Number(value):value,
      ...(key==='teamCount'?{managerTacticOverrides:
        current.managerTacticOverrides.filter(row=>
          Number(row.teamId.split('-')[1])<Number(value))}:{})}));
  };
  const changeCustomRivals=value=>{
    const count=Number(value);
    setCustomRivals(count);
    setExtraRivalId('');
    setSettings(current=>{
      const managerTactics=[...current.managerTactics];
      for(const row of current.managerTacticOverrides){
        const index=Number(row.teamId.split('-')[1])-1;
        if(index<count)managerTactics[index]={effort:row.effort,
          attack:row.attack,chase:row.chase};
      }
      return {...current,managerTactics,managerTacticOverrides:
        current.managerTacticOverrides.filter(row=>
          Number(row.teamId.split('-')[1])>count)};
    });
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
  const addExtraRival=()=>{
    if(!extraRivalId)return;
    const index=Number(extraRivalId.split('-')[1])-1;
    setSettings(current=>({...current,managerTacticOverrides:[
      ...current.managerTacticOverrides,
      {teamId:extraRivalId,...defaultTacticFor(index,current)}]
      .sort((a,b)=>Number(a.teamId.split('-')[1])-
        Number(b.teamId.split('-')[1]))}));
    setExtraRivalId('');
  };
  const changeExtraRival=(teamId,key,value)=>setSettings(current=>({...current,
    managerTacticOverrides:current.managerTacticOverrides.map(row=>
      row.teamId===teamId?{...row,[key]:value}:row)}));
  const removeExtraRival=teamId=>{
    setSettings(current=>({...current,
      managerTacticOverrides:current.managerTacticOverrides.filter(row=>
        row.teamId!==teamId)}));
    setFinalePlans(current=>{
      const plans={...current};
      delete plans[teamId];
      return plans;
    });
  };
  const changeFinale=(teamId,key,value)=>setFinalePlans(current=>{
    const plan=current[teamId]??{finisherId:`${teamId}-7`,
      leadOutRiderId:null};
    return {...current,[teamId]:{...plan,[key]:value,
      ...(key==='finisherId'&&plan.leadOutRiderId===value?
        {leadOutRiderId:null}:{})}};
  });
  const finaleTeams=['you',...Array.from({length:customRivals},
    (_,index)=>`rival-${index+1}`),
    ...settings.managerTacticOverrides.map(row=>row.teamId)];
  const availableExtraRivals=Array.from(
    {length:settings.teamCount-customRivals-1},
    (_,index)=>`rival-${customRivals+index+1}`).filter(teamId=>
    !settings.managerTacticOverrides.some(row=>row.teamId===teamId));
  const lineTimes=integrated?.finale?.lineTimes??[];
  const coastedFrame=coasted?.kilometreFrames[coastedKm-1];
  const coastedRoadChanges=recordedRoadChanges(
    coasted?.kilometreFrames??[]);
  const coastedTacticalFrames=(coasted?.kilometreFrames??[])
    .flatMap((frame,index)=>frame.attackAttempts.length||
      frame.joinedRiderIds.length||frame.caughtRiderIds.length||
      frame.frontAttacks.length?[{frame,index}]:[]);
  const coastedRoad=coasted?.lastKmRoad[coastedRoadIndex];
  const coastedBand=coasted?.bandReplays.find(band=>
    band.id===coastedBandId);
  const coastedBandFrame=coastedBand?.frames[coastedBandIndex];
  const coastedReplayRider=coastedBandFrame?.riders.find(row=>
    row.riderId===coastedRiderId);
  const coastedReplayResult=coasted?.lineTimes.find(row=>
    row.riderId===coastedRiderId);
  const coastedProvisionalPlaces=new Map((coasted?.provisionalLineOrder??[])
    .map(row=>[row.riderId,row]));
  const coastedRoadBounds=new Map((coasted?.roadPlaceBounds?.riders??[])
    .map(row=>[row.riderId,row]));
  const coastedOrder=[...(coasted?.lineTimes??[])].sort((a,b)=>
    coasted?.provisionalLineOrder?
      (coastedProvisionalPlaces.get(a.riderId)?.position??0)-
        (coastedProvisionalPlaces.get(b.riderId)?.position??0)||
      a.elapsedSecondsFromLastKmStart-b.elapsedSecondsFromLastKmStart||
      a.riderId.localeCompare(b.riderId):
      (coastedRoadBounds.get(a.riderId)?.firstPossiblePlace??Infinity)-
        (coastedRoadBounds.get(b.riderId)?.firstPossiblePlace??Infinity)||
      (coastedRoadBounds.get(a.riderId)?.lastPossiblePlace??Infinity)-
        (coastedRoadBounds.get(b.riderId)?.lastPossiblePlace??Infinity)||
      a.riderId.localeCompare(b.riderId));
  const coastedOwnDecision=coasted?.managerDecisions.find(row=>
    row.teamId==='you');
  const coastedOwnLine=coasted?.lineTimes.find(row=>
    row.riderId===coastedOwnDecision?.finisherId);
  const coastedOwnPlace=coasted?.provisionalLineOrder?.find(row=>
    row.riderId===coastedOwnDecision?.finisherId)??
    coastedRoadBounds.get(coastedOwnDecision?.finisherId);
  const coastedOwnPoints=coasted?.pointPreview?.riders?.find(row=>
    row.riderId===coastedOwnDecision?.finisherId);
  const coastedOwnHelperWork=(coasted?.leadOutWork??[])
    .filter(row=>row.riderId===coastedOwnDecision?.leadOutRiderId)
    .reduce((sum,row)=>sum+row.energySpent,0);
  const conditionalLine=[...lineTimes].sort((a,b)=>
    a.elapsedSecondsFromLastKmStart-b.elapsedSecondsFromLastKmStart||
    a.riderId.localeCompare(b.riderId));
  const visibleLine=conditionalLine.map((row,index)=>({...row,
    conditionalOrder:index+1,teamId:row.riderId.slice(0,
      row.riderId.lastIndexOf('-'))})).filter(row=>
    resultsTeam==='all'||row.teamId===resultsTeam);
  const pointRows=new Map((integrated?.provisionalPointPreview?.riders??[])
    .map(row=>[row.riderId,row]));
  const ownFinisher=integrated?.managerDecisions?.find(row=>
    row.teamId==='you')?.finisherId??'you-7';
  const ownCrossing=conditionalLine.find(row=>row.riderId===ownFinisher);
  const ownPointPreview=integrated?.provisionalPointPreview?.riders
    ?.find(row=>row.riderId===ownFinisher);
  const finaleFrame=finaleReplay?.frames[finaleFrameIndex];
  const selectedBand=bandLocalReplay?.bands.find(band=>band.id===bandId);
  const bandFrame=selectedBand?.frames[bandFrameIndex];
  const bandRider=bandFrame?.riders.find(row=>
    row.riderId===bandRiderId);
  const bandSourceRider=selectedBand?.sourceRiders.find(row=>
    row.riderId===bandRiderId);
  const concurrentRoadFrame=finaleReplay?.roadFrames?.[concurrentRoadIndex];
  const concurrentRoadRider=concurrentRoadFrame?.riders.find(row=>
    row.riderId===inspectedRiderId);
  const approachFrame=attackApproach?.frames[approachFrameIndex];
  const approachRider=approachFrame?.riders.find(row=>
    row.riderId===approachRiderId);
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
      const managerTactics=Array.from(
        {length:customRivals},(_,index)=>
          settings.managerTactics[index]??defaultTacticFor(index,settings));
      const namedTactics=new Map(settings.managerTacticOverrides.map(row=>
        [row.teamId,row]));
      const allTeams=['you',...Array.from({length:settings.teamCount-1},
        (_,index)=>`rival-${index+1}`)];
      const orders=new Map(allTeams.map((teamId,index)=>[
        teamId,{teamId,attack:'none',
          chase:index===0?settings.chase:
            (namedTactics.get(teamId)??managerTactics[index-1]??
              defaultTacticFor(index-1,settings)).chase,
          frontWork:finaleFrontWork[teamId]??'sit_in'}]));
      if(secondNamedAttack.teamId)for(const row of [namedAttack,
        secondNamedAttack])orders.set(row.teamId,{
        ...(orders.get(row.teamId)??{teamId:row.teamId,
          chase:'ignore',frontWork:'sit_in'}),attack:'selective',
        attackRiderId:row.riderId});
      const raceSettings={...settings,managerTactics,
        ...(!coastedMode&&secondNamedAttack.teamId?{
          managerFinaleOrders:[...orders.values()]}:{}),
        ...(integratedMode&&coastedMode?{managerFinaleOrders:finaleTeams
          .filter(teamId=>lateEfforts[teamId])
          .map(teamId=>({teamId,atKm:settings.distanceKm-5,
            effort:lateEfforts[teamId]}))}:{})};
      const payload=integratedMode&&coastedMode?{
        mode:'v93-coasted',settings:raceSettings,
        plans:allTeams.map(teamId=>({teamId,
          finisherId:finalePlans[teamId]?.finisherId??`${teamId}-7`,
          leadOutRiderId:finalePlans[teamId]?.leadOutRiderId??null})),
        ...(showPointPreview?{pointContext}:{})}:
        integratedMode?{mode:'integrated',settings:raceSettings,
        finalePlans:finaleTeams.map(teamId=>({teamId,
          finisherId:finalePlans[teamId]?.finisherId??`${teamId}-7`,
          leadOutRiderId:finalePlans[teamId]?.leadOutRiderId??null})),
        ...(namedAttack.teamId&&!secondNamedAttack.teamId?
          {attack:namedAttack}:{}),
        ...(showPointPreview?{pointContext}:{})}:
        raceSettings;
      const response=await api('/api/v91-playtest',{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),
        signal:AbortSignal.timeout(coastedMode||secondNamedAttack.teamId?
          60_000:15_000)});
      if(integratedMode&&!coastedMode){
        const next=comparisonRun(raceSettings,response,
          showPointPreview?pointContext:null);
        setComparison(previousRun?.conditions===next.conditions?
          {before:previousRun,after:next}:null);
        setPreviousRun(next);
        setCoastedComparison(null);setPreviousCoastedRun(null);
      }else if(integratedMode&&coastedMode){
        const next=coastedComparisonRun(raceSettings,response.coasted,
          showPointPreview?pointContext:null);
        setCoastedComparison(previousCoastedRun?.conditions===next.conditions?
          {before:previousCoastedRun,after:next}:null);
        setPreviousCoastedRun(next);
        setComparison(null);setPreviousRun(null);
      }else{
        setComparison(null);setPreviousRun(null);
        setCoastedComparison(null);setPreviousCoastedRun(null);
      }
      setCoasted(response.coasted??null);
      setCoastedKm(1);setCoastedRoadIndex(0);
      setCoastedBandId(response.coasted?.bandReplays.find(band=>
        band.riderIds.includes(response.coasted.managerDecisions.find(row=>
          row.teamId==='you')?.finisherId))?.id??'');
      setCoastedBandIndex(0);
      setCoastedRiderId(response.coasted?.managerDecisions.find(row=>
        row.teamId==='you')?.finisherId??'');
      setResult(response.playtest??null);
      setIntegrated(response.integrated??null);
      setAttackRoad(response.attackRoad??null);
      setAttackApproach(response.attackApproach??response.soloApproach??null);
      setApproachFrameIndex(0);
      setApproachRiderId((response.attackApproach??response.soloApproach)
        ?.attackRiderId??'');
      setFinaleReplay(response.finaleReplay??response.finaleTail??
        response.finaleContactReplay??response.concurrentLateCatchReplay??
        response.concurrentDoubleCatchReplay??null);
      const bandReplay=response.multibandReplay??null;
      const finisherId=response.integrated?.managerDecisions
        ?.find(row=>row.teamId==='you')?.finisherId??'you-7';
      setBandLocalReplay(bandReplay);
      setBandId(bandReplay?.bands.find(band=>
        band.riderIds.includes(finisherId))?.id??'');
      setBandRiderId(finisherId);
      setBandFrameIndex(0);
      setFinaleFrameIndex(0);
      setConcurrentRoadIndex(0);
      setInspectedRiderId(response.integrated?.managerDecisions
        ?.find(row=>row.teamId==='you')?.finisherId??'you-7');
      setSelectedKm(1);
      setResultsTeam('all');
    }catch(cause){setComparison(null);setPreviousRun(null);
      setCoastedComparison(null);setPreviousCoastedRun(null);
      setResult(null);setIntegrated(null);setCoasted(null);setAttackRoad(null);
      setAttackApproach(null);setFinaleReplay(null);setBandLocalReplay(null);
      setError(cause.message||'The playtest could not run.');}
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
        {integratedMode&&<label className="v91-mode"><input type="checkbox"
          checked={coastedMode}
          onChange={event=>setCoastedMode(event.target.checked)}/>
          Try v93 road-to-line preview</label>}
        {integratedMode&&coastedMode&&<p className="v91-warning">
          This preview pays supported bunch, front-group, and isolated-rider
          roads from the final-kilometre handoff. Unsupported roads return a
          clear refusal; results and points remain experimental.
        </p>}
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
              <option value="passive">Hold position / no chase</option>
            </select>
          </label>
          {settings.defaultRivalPlan==='mixed'&&<div className="v91-profile-points">{settings.rivalPlans.map((plan,index)=><label key={index}>
            Rival {index+1}
            <select value={plan} onChange={event=>changeRival(index,event.target.value)}>
              <option value="chase">Hard chase</option>
              <option value="attack">Seek a break</option>
              <option value="neutral">Steady / selective</option>
              <option value="passive">Hold position / no chase</option>
            </select>
          </label>)}</div>}
          <label>Managers with your own tactics
            <select value={customRivals} onChange={event=>changeCustomRivals(event.target.value)}>
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
          {availableExtraRivals.length>0&&<div>
            <label>Choose another rival manager
              <select value={extraRivalId} onChange={event=>
                setExtraRivalId(event.target.value)}>
                <option value="">Select a rival</option>
                {availableExtraRivals.map(teamId=><option key={teamId}
                  value={teamId}>{teamId}</option>)}
              </select>
            </label>
            <button type="button" disabled={!extraRivalId}
              onClick={addExtraRival}>Add rival manager</button>
          </div>}
          {settings.managerTacticOverrides.length>0&&
            <div className="v91-manager-tactics">
              {settings.managerTacticOverrides.map(tactic=><div
                key={tactic.teamId}>
                <strong>{tactic.teamId}</strong>
                {['effort','attack','chase'].map(key=><label key={key}>
                  {tactic.teamId} {key}
                  <select value={tactic[key]} onChange={event=>
                    changeExtraRival(tactic.teamId,key,event.target.value)}>
                    {OPTIONS[key].map(([value,label])=><option key={value}
                      value={value}>{label}</option>)}
                  </select>
                </label>)}
                <button type="button" onClick={()=>
                  removeExtraRival(tactic.teamId)}>
                  Remove {tactic.teamId}
                </button>
              </div>)}
            </div>}
        </fieldset>
        {integratedMode&&coastedMode&&<fieldset className="v91-profile">
          <legend>Five-kilometre effort orders</legend>
          <p>Choose a new effort at 5 km to go for your team or a customized rival. The previous effort stays in force until that marker.</p>
          <div className="v91-manager-tactics">{finaleTeams.map(teamId=>
            <label key={teamId}>5 km to go effort for {teamId}
              <select value={lateEfforts[teamId]??''} onChange={event=>
                setLateEfforts(current=>({...current,
                  [teamId]:event.target.value}))}>
                <option value="">Keep race effort</option>
                {OPTIONS.effort.map(([value,label])=><option key={value}
                  value={value}>{label}</option>)}
              </select>
            </label>)}</div>
        </fieldset>}
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
              {!coastedMode&&secondNamedAttack.teamId&&<label>{teamId} last-kilometre front work
                <select value={finaleFrontWork[teamId]??'sit_in'}
                  onChange={event=>setFinaleFrontWork(current=>({
                    ...current,[teamId]:event.target.value}))}>
                  <option value="sit_in">Sit in</option>
                  <option value="rotate">Rotate</option>
                </select>
              </label>}
            </div>;
          })}</div>
        </fieldset>}
        {integratedMode&&!coastedMode&&<fieldset className="v91-profile">
          <legend>Named final-kilometre attack</legend>
          <p>Order one or two managers to attack at the start of the last kilometre. With two named attacks, other managers keep their chosen chase and effort while further attacks are held. The recorded road decides whether either move survives.</p>
          <small>Two named attacks use the concurrent conditional road. Unsupported orders return an explicit refusal.</small>
          <div className="v91-profile-points">
            <label>Named attack manager<select value={namedAttack.teamId}
              onChange={event=>{
                const teamId=event.target.value;
                setNamedAttack(teamId?{teamId,riderId:`${teamId}-0`}:
                  {teamId:'',riderId:''});
                if(!teamId||teamId===secondNamedAttack.teamId)
                  setSecondNamedAttack({teamId:'',riderId:''});
              }}>
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
            {namedAttack.teamId&&<label>Second attack manager<select
              value={secondNamedAttack.teamId}
              onChange={event=>setSecondNamedAttack(event.target.value?{
                teamId:event.target.value,riderId:`${event.target.value}-0`}:
                {teamId:'',riderId:''})}>
              <option value="">None</option>
              {Array.from({length:settings.teamCount},(_,index)=>
                index===0?'you':`rival-${index}`)
                .filter(teamId=>teamId!==namedAttack.teamId)
                .map(teamId=><option key={teamId} value={teamId}>
                  {teamId==='you'?'Your team':teamId}</option>)}
            </select></label>}
            {secondNamedAttack.teamId&&<label>Second attacking rider<select
              value={secondNamedAttack.riderId}
              onChange={event=>setSecondNamedAttack(current=>({...current,
                riderId:event.target.value}))}>
              {Array.from({length:8},(_,index)=><option key={index}
                value={`${secondNamedAttack.teamId}-${index}`}>Rider {index+1}</option>)}
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
          integratedMode&&coastedMode?'Run v93 race preview':
            integratedMode?'Run full race preview':'Run race'}</button>
      </form>
      {error&&<p role="alert" className="v91-error">{error}</p>}
      {coasted&&<section className="v91-results" aria-label="V93 coasted race preview">
        <h2>V93 race preview · {coasted.settings.distanceKm} km {coasted.settings.terrain}</h2>
        <p>{coasted.tuningVersion} · {coasted.settings.managerTactics.length+
          (coasted.settings.managerTacticOverrides?.length??0)} custom rival managers · {coasted.roadStatus}</p>
        <p>Conditional individual line: {coasted.lineTimes.length} riders. Official results and points are withheld.</p>
        <details aria-label="Locked v93 manager orders">
          <summary>Locked manager orders for this race</summary>
          {coasted.managerOrders.map(order=>{
            const decision=coasted.managerDecisions.find(row=>
              row.teamId===order.teamId);
            return <p key={order.teamId}>{order.teamId}: {order.effort} effort ·
              {' '}{order.attack} attack · {order.chase} chase ·
              {' '}finisher {decision?.finisherId} ·
              {' '}lead-out {decision?.leadOutRiderId??'none'}
              {order.phaseOrders.map(phase=>
                <span key={phase.atKm}> · At {phase.atKm} km: {' '}
                  {['effort','attack','attackRiderId','chase','frontWork']
                    .filter(key=>phase[key]!=null)
                    .map(key=>`${key}: ${phase[key]}`).join(' · ')}
                </span>)}</p>;
          })}
        </details>
        {coastedOwnDecision&&<section className="v91-finish" aria-label="Your v93 finish">
          <h3>Your finish</h3>
          <p>Nominated finisher: {coastedOwnDecision.finisherId} ·
            {' '}{coastedOwnLine?.roadBandId??'no paid road band'} ·
            {' '}{coastedOwnLine?.elapsedSecondsFromLastKmStart.toFixed(3)??'—'} s
            from the bunch&apos;s final-kilometre marker ·
            {' '}{coastedOwnLine?.energyAtLine.toFixed(1)??'—'} energy at line.</p>
          <p>Conditional place: {conditionalPlace(coastedOwnPlace,
            'unresolved')} · Read-only points: {coastedOwnPoints?
              coastedOwnPoints.previewPoints:
              coasted?.pointPreview?.status==='unavailable'?
                'unavailable':'not requested'}.</p>
          <p>Lead-out helper: {coastedOwnDecision.leadOutRiderId??'none'} ·
            {' '}{coastedOwnHelperWork.toFixed(2)} energy of recorded work.</p>
        </section>}
        <details aria-label="Recorded road changes" className="v91-road-changes">
          <summary>Recorded road changes ({coastedRoadChanges.length})</summary>
          <p>Jump to a kilometre where a road group or the isolated riders changed.</p>
          {coastedRoadChanges.length?<div className="v91-road-jumps">
            {coastedRoadChanges.map(({index,frame})=><button type="button"
              key={frame.km} onClick={()=>setCoastedKm(index+1)}
              aria-label={`Jump to recorded km ${frame.km}`}
              aria-pressed={coastedKm===index+1}>
              Km {frame.km} · {frame.roadGroups.length} ahead ·
              {' '}{frame.droppedRiders.length} isolated
            </button>)}
          </div>:<p>No road-group or isolation changes before the final kilometre.</p>}
        </details>
        <details aria-label="Recorded tactical moments" className="v91-road-changes">
          <summary>Recorded tactical moments ({coastedTacticalFrames.length})</summary>
          <p>Jump to a recorded attack attempt, a rider joining a road group, or a catch.</p>
          {coastedTacticalFrames.length?<div className="v91-road-jumps">
            {coastedTacticalFrames.map(({frame,index})=><button type="button"
              key={frame.km} onClick={()=>setCoastedKm(index+1)}
              aria-label={`Jump to tactical km ${frame.km}`}
              aria-pressed={coastedKm===index+1}>
              Km {frame.km} · {frame.attackAttempts.length} attempts ·
              {' '}{frame.joinedRiderIds.length} joined ·
              {' '}{frame.caughtRiderIds.length} caught ·
              {' '}{frame.frontAttacks.length} front attacks
            </button>)}
          </div>:<p>No recorded attacks, joins, or catches before the final kilometre.</p>}
        </details>
        <label>Recorded kilometre: {coastedKm}
          <input type="range" min="1" max={coasted.kilometreFrames.length}
            value={coastedKm} onChange={event=>setCoastedKm(Number(event.target.value))}/>
        </label>
        <div className="v91-metrics">
          <div><strong>{coastedFrame?.terrain}</strong><span>Terrain</span></div>
          <div><strong>{coastedFrame?.roadGroups.length??0}</strong><span>Groups ahead</span></div>
          <div><strong>{coastedFrame?.droppedRiders.length??0}</strong><span>Isolated riders</span></div>
          <div><strong>{coastedFrame?.coastedRiders??0}</strong><span>Riders slowed by exhaustion</span></div>
        </div>
        <p>Road groups: {coastedFrame?.roadGroups.map(group=>
          `${group.id} (${group.riderIds.length} riders, ${group.gapSeconds.toFixed(1)} s ahead)`)
          .join(' · ')||'none'}</p>
        <p>Isolated riders: {coastedFrame?.droppedRiders.map(row=>
          `${row.riderId} (${bunchRelativeGap(row.deficitSeconds,1)}, ${row.energy.toFixed(1)} energy)`)
          .join(' · ')||'none'}</p>
        <div aria-label="Recorded kilometre tactics">
          <p>Attack attempts: {coastedFrame?.attackAttempts.join(', ')||'none'}</p>
          <p>Joined road group: {coastedFrame?.joinedRiderIds.join(', ')||'none'}</p>
          <p>Caught riders: {coastedFrame?.caughtRiderIds.join(', ')||'none'}</p>
          <p>Front attacks: {coastedFrame?.frontAttacks.map(row=>
            `${row.riderId} (${row.status.replaceAll('_',' ')})`).join(', ')||'none'}</p>
          <p>Engaged chase: {coastedFrame?.engagedChaseTeamIds.join(', ')||'none'}</p>
        </div>
        <div className="v91-riders">{coastedFrame?.ownRiders.map(row=><div key={row.riderId}>
          <strong>{row.riderId}</strong><span>{row.roadGroup}</span>
          <span>{row.energy.toFixed(1)} energy</span>
        </div>)}</div>
        <div className="v91-finish">
          <h3>Recorded final-kilometre road</h3>
          <label>Road boundary: {coastedRoadIndex+1} of {coasted.lastKmRoad.length}
            <input type="range" min="0" max={coasted.lastKmRoad.length-1}
              value={coastedRoadIndex}
              onChange={event=>setCoastedRoadIndex(Number(event.target.value))}/>
          </label>
          <p>{(coastedRoad?.distanceM/1000).toFixed(3)} km · bunch passage {coastedRoad?.bunchPassageSecondsFromBunchMarker.toFixed(2)} s</p>
          {coastedRoad?.groups.map(group=><p key={group.id}>
            {group.id}: {group.riderIds.length} riders · {group.passageSecondsFromBunchMarker.toFixed(2)} s · {group.gapSeconds.toFixed(2)} s ahead
          </p>)}
          <p>Isolated passages: {coastedRoad?.droppedPassages.map((row,index)=><span
            key={row.riderId}>{index>0?' · ':''}{row.riderId} {' '}
            {row.passageSecondsFromBunchMarker.toFixed(2)} s
            {' '}({bunchRelativeGap(row.deficitSeconds,2)})
            {row.contactDistanceM!=null&&<>
              {' '}· bunch passed at {(row.contactDistanceM/1000).toFixed(3)} km
              {' '}<button type="button"
                aria-label={`Inspect passage rider ${row.riderId} finale replay`}
                onClick={()=>{
                  const band=coasted.bandReplays.find(value=>
                    value.id===`isolated:${row.riderId}`);
                  setCoastedBandId(band.id);setCoastedRiderId(row.riderId);
                  setCoastedBandIndex(band.frames.length-1);
                  document.getElementById('v93-paid-finale-replay')
                    ?.scrollIntoView();
                }}>Inspect finish replay</button>
            </>}</span>)}</p>
        </div>
        <div className="v91-finish" id="v93-paid-finale-replay">
          <h3>Paid individual finale replay</h3>
          <label>Road band<select value={coastedBandId}
            onChange={event=>{setCoastedBandId(event.target.value);
              setCoastedRiderId(coasted.bandReplays.find(band=>
                band.id===event.target.value)?.riderIds[0]??'');
              setCoastedBandIndex(0);}}>
            {coasted.bandReplays.map(band=><option key={band.id} value={band.id}>
              {band.id} · {band.riderIds.length} riders</option>)}
          </select></label>
          {coastedBand&&<label>Rider<select value={coastedRiderId}
            onChange={event=>setCoastedRiderId(event.target.value)}>
            {coastedBand.riderIds.map(id=><option key={id} value={id}>
              {id}</option>)}
          </select></label>}
          <p>{coastedBand?.riderIds.length} riders · 500 m passage at {coastedBand?.passageAt500Seconds.toFixed(2)} s</p>
          {coastedBand&&<label>Band interval: {coastedBandIndex+1} of {coastedBand.frames.length}
            <input type="range" min="0" max={coastedBand.frames.length-1}
              value={coastedBandIndex}
              onChange={event=>setCoastedBandIndex(Number(event.target.value))}/>
          </label>}
          {coastedReplayRider&&<p aria-label="Selected rider finale replay">
            {coastedRiderId}: {coastedReplayRider.role} after this interval ·
            {' '}{(coastedReplayRider.positionM/1000).toFixed(3)} km ·
            {' '}{coastedReplayRider.energyAfter.toFixed(1)} energy,
            {' '}{coastedReplayRider.energySpent.toFixed(2)} spent.
            {coastedReplayRider.elapsedToLineSeconds!=null&&
              ` Crossed at ${coastedReplayRider.elapsedToLineSeconds.toFixed(3)} s; result ${coastedReplayResult?.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${coastedReplayResult?.energyAtLine.toFixed(1)} energy.`}
          </p>}
          <p>Lead-out work: {coasted.leadOutWork.map(row=>
            `${row.riderId} ${row.energySpent.toFixed(2)} energy`)
            .join(' · ')||'none'}</p>
        </div>
        <div className="v91-finish">
          <h3>Individual conditional results</h3>
          {!coasted.provisionalLineOrder&&<p>
            Riders are grouped by proven road-place ranges where available.
            Within a range, names are alphabetical; row order is not a
            classified finish.
          </p>}
          {coasted.roadPlaceBounds&&<p>{
            coasted.roadPlaceBounds.status===
              'conditional_front_separated_rear_contact_unresolved'?
              'The paid front stays separate through the finale. Contact between the bunch and new leavers remains unresolved; these are conditional ranges and points are withheld.':
              'Road ranges follow the paid front, leaver and bunch passages after the split. Wheel order and contact at the split remain unresolved; points are withheld.'
          }</p>}
          {coasted.potentialRoadContact&&<div role="note"
            aria-label="Potential road contact">
            <p>Potential contact at {' '}
              {(coasted.potentialRoadContact.distanceM/1000).toFixed(3)} km
              {' '}· {' '}
              {coasted.potentialRoadContact.elapsedSecondsFromLastKmStart
                .toFixed(3)} s, during the {' '}
              {coasted.potentialRoadContact.sourcePhase===
                'paid_first_500m'?'first 500 m':'final 500 m'}.
              {' '}The paid paths overlap; contact and passing remain
              unresolved.</p>
            {coasted.potentialRoadContact.riderIds.map((id,index)=><button
              key={id} type="button"
              onClick={()=>{
                setCoastedBandId(
                  coasted.potentialRoadContact.roadBandIds[index]);
                setCoastedRiderId(id);setCoastedBandIndex(0);
                document.getElementById('v93-paid-finale-replay')
                  ?.scrollIntoView();
              }} aria-label={`Inspect contact rider ${id}`}>
              Inspect {id}</button>)}
          </div>}
          <div className="v91-result-scroll"><table className="v91-result-table"
            aria-label="V93 individual conditional results">
            <thead><tr><th scope="col">Possible place</th><th scope="col">Rider</th>
              <th scope="col">Road band</th><th scope="col">Time</th>
              <th scope="col">Energy at line</th><th scope="col">Preview points</th>
              <th scope="col">Replay</th>
            </tr></thead>
            <tbody>{coastedOrder.map(row=>{
              const place=coastedProvisionalPlaces.get(row.riderId)??
                coastedRoadBounds.get(row.riderId);
              const points=coasted.pointPreview?.riders?.find(value=>
                value.riderId===row.riderId)?.previewPoints;
              return <tr key={row.riderId}><td>{conditionalPlace(place)}</td>
                <th scope="row">{row.riderId}</th><td>{row.roadBandId}</td>
                <td>{row.elapsedSecondsFromLastKmStart.toFixed(3)} s</td>
                <td>{row.energyAtLine.toFixed(1)}</td>
                <td>{points??'—'}</td><td><button type="button"
                  onClick={()=>{setCoastedBandId(row.roadBandId);
                    setCoastedRiderId(row.riderId);setCoastedBandIndex(0);
                    document.getElementById('v93-paid-finale-replay')
                      ?.scrollIntoView();}}
                  aria-label={`Replay ${row.riderId}`}>Inspect</button></td></tr>;
            })}</tbody>
          </table></div>
          {coasted.pointPreview?.status==='unavailable'&&<p>
            Point illustration unavailable: {coasted.pointPreview.reason}
          </p>}
          <p>Official points: withheld · Awards saved: 0</p>
        </div>
        {coastedComparison&&<section className="v91-finish"
          aria-label="Paired v93 race comparison">
          <h3>Previous preview on the same conditions</h3>
          <p>Route, profile, category, field, fatigue and seed match.
            Manager tactics and finale nominations may differ.</p>
          <p>Recorded road: {coastedComparison.before.roadStatus} →
            {' '}{coastedComparison.after.roadStatus} ·
            {' '}groups at the last-kilometre handoff:
            {' '}{coastedComparison.before.sourceGroups} →
            {' '}{coastedComparison.after.sourceGroups} ·
            {' '}isolated riders:
            {' '}{coastedComparison.before.sourceDropped} →
            {' '}{coastedComparison.after.sourceDropped}.</p>
          <p>Lead-out: {coastedComparison.before.leadOutRiderId??'none'}
            {' '}({coastedComparison.before.leadOutEnergy.toFixed(2)} energy paid)
            {' '}→ {coastedComparison.after.leadOutRiderId??'none'}
            {' '}({coastedComparison.after.leadOutEnergy.toFixed(2)} energy paid).</p>
          <p>Nominated finisher crossing:
            {' '}{coastedComparison.before.finisherId}
            {' '}{coastedComparison.before.crossingSeconds?.toFixed(3)??'unavailable'} s
            {' '}→ {coastedComparison.after.finisherId}
            {' '}{coastedComparison.after.crossingSeconds?.toFixed(3)??'unavailable'} s.
            {' '}Energy at line:
            {' '}{coastedComparison.before.energyAtLine?.toFixed(1)??'—'}
            {' '}→ {coastedComparison.after.energyAtLine?.toFixed(1)??'—'}.
            {' '}Conditional place:
            {' '}{coastedComparison.before.place} →
            {' '}{coastedComparison.after.place}.</p>
          {coastedComparison.before.pointContext&&
            coastedComparison.before.pointContext===
              coastedComparison.after.pointContext&&<p>
              Read-only points:
              {' '}{coastedComparison.before.pointLabel} →
              {' '}{coastedComparison.after.pointLabel}.
              {' '}Official points remain withheld.
            </p>}
          {changedRivalOutcomes.length>0&&<details
            aria-label="Changed rival manager outcomes">
            <summary>Changed rival managers ({changedRivalOutcomes.length})</summary>
            {changedRivalOutcomes.map(({before,after})=><div
              key={after.teamId}>
              <p><strong>{after.teamId}</strong> · Effort:
                {' '}{before.effort} → {after.effort} · Attack:
                {' '}{before.attack} → {after.attack} · Chase:
                {' '}{before.chase} → {after.chase}.</p>
              <p>Finisher: {before.finisherId} → {after.finisherId} ·
                {' '}Lead-out: {before.leadOutRiderId??'none'} →
                {' '}{after.leadOutRiderId??'none'} · Road band:
                {' '}{before.roadBandId??'unavailable'} →
                {' '}{after.roadBandId??'unavailable'}.</p>
              {JSON.stringify(before.phaseOrders)!==
                JSON.stringify(after.phaseOrders)&&<p>
                Phase orders:
                {' '}{phaseOrderSummary(before.phaseOrders)} →
                {' '}{phaseOrderSummary(after.phaseOrders)}.
              </p>}
              <p>Crossing: {before.crossingSeconds?.toFixed(3)??'unavailable'} s
                {' '}→ {after.crossingSeconds?.toFixed(3)??'unavailable'} s ·
                {' '}Energy at line:
                {' '}{before.energyAtLine?.toFixed(1)??'—'} →
                {' '}{after.energyAtLine?.toFixed(1)??'—'} ·
                {' '}Conditional place: {before.place} → {after.place}.
                {coastedComparison.before.pointContext&&
                  coastedComparison.before.pointContext===
                    coastedComparison.after.pointContext&&<>
                    {' '}Read-only points:
                    {' '}{before.previewPoints??'unavailable'} →
                    {' '}{after.previewPoints??'unavailable'}.
                  </>}
              </p>
            </div>)}
          </details>}
        </section>}
      </section>}
      {result&&<section className="v91-results" aria-label="Playtest recording">
        <h2>Recorded race · {result.settings.distanceKm} km {result.settings.terrain}</h2>
        <p>{result.tuningVersion} · {result.settings.managerTactics.length+
          (result.settings.managerTacticOverrides?.length??0)} custom rival managers{integrated?' · Conditional finale':` · Your captain: provisional #${result.ownCaptain??'—'}`}</p>
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
        {attackApproach&&<div className="v91-finish">
          <h3>{attackApproach.branch==='solo'?'Paid solo-attack approach':'Paid named-attack approach'}</h3>
          <p>The recorded attack and chase run from the locked {result.handoffKm} km handoff to {attackApproach.lastBoundaryM/1000} km. Individual positions in this segment are unavailable.</p>
          <label>Attack boundary: {approachFrameIndex+1} of {attackApproach.frames.length}
            <input type="range" min="0" max={attackApproach.frames.length-1}
              value={approachFrameIndex}
              onChange={event=>setApproachFrameIndex(Number(event.target.value))}/>
          </label>
          <p>{approachFrame?.distanceM/1000} km · {approachFrame?.elapsedSeconds.toFixed(2)} s on the bunch clock · {approachFrame?.pelotonRiderCount} in the bunch</p>
          {approachFrame?.catchDistanceM&&<p>{attackApproach.attackRiderId} was caught at {(approachFrame.catchDistanceM/1000).toFixed(3)} km.</p>}
          {approachFrame?.roadGroups.map(group=><p key={group.id}>
            {group.riderIds.join(', ')} ahead by {group.gapSeconds.toFixed(2)} s
          </p>)}
          <label>Inspect attack rider<select value={approachRiderId}
            onChange={event=>setApproachRiderId(event.target.value)}>
            {attackApproach.frames[0].riders.map(row=><option
              key={row.riderId} value={row.riderId}>{row.riderId}</option>)}
          </select></label>
          {approachRider&&<p>{approachRider.riderId}: {approachRider.role} · {approachRider.energyAfter.toFixed(1)} energy · {approachRider.energySpent.toFixed(2)} spent this segment</p>}
        </div>}
        {finaleReplay&&<div className="v91-finish">
          <h3>{finaleReplay.status?.startsWith('concurrent_')?
            'Paid double-catch finale':finaleReplay.status==='partial_paid_trace'?
            'Paid final 500 m':finaleReplay.status===
              'partial_contact_paid_trace'?
              'Paid finale through contact':'Paid final-kilometre replay'}</h3>
          {finaleReplay.status?.startsWith('concurrent_')?
            <p>Two named attacks meet the bunch at recorded contacts. Road bands and energy are paid until {finaleReplay.handoffDistanceM/1000} km; individual positions begin there and the finish order remains conditional.</p>:
            finaleReplay.status==='partial_paid_trace'?
            <p>All {finaleFrame?.riders.length} riders continue from the recorded {finaleReplay.handoffDistanceM/1000} km boundary on one clock. Opening 500 m: groups and energy only. These later positions are conditional bunch positions, not an official order.</p>:
            finaleReplay.status==='partial_contact_paid_trace'?
              <p>All {finaleFrame?.riders.length} riders continue from the recorded {finaleReplay.handoffDistanceM/1000} km boundary through the exact catch to the line. Positions and energy follow the paid road; the finish order remains conditional.</p>:
            <p>All {finaleFrame?.riders.length} riders continue from the locked {result.handoffKm} km handoff on one clock.</p>}
          {finaleReplay.roadFrames&&<div>
            <p>{finaleReplay.roadFrames.length} paid road boundaries · {finaleReplay.contactEvents.length} exact contacts</p>
            {finaleReplay.contactEvents.map(event=><p key={event.kind}>
              {event.riderId}: {event.kind.replaceAll('_',' ')} at {(event.positionM/1000).toFixed(3)} km · {event.elapsedSinceLaunchSeconds.toFixed(2)} s
            </p>)}
            <label>Paid road boundary: {concurrentRoadIndex+1} of {finaleReplay.roadFrames.length}
              <input type="range" min="0" max={finaleReplay.roadFrames.length-1}
                value={concurrentRoadIndex}
                onChange={event=>setConcurrentRoadIndex(Number(event.target.value))}/>
            </label>
            <p>{concurrentRoadFrame?.elapsedSeconds.toFixed(2)} s after launch · {concurrentRoadFrame?.roadGroups.map(group=>
              `${group.kind}: ${group.riderIds.length} riders at ${(group.positionM/1000).toFixed(3)} km`).join(' · ')}</p>
            {concurrentRoadRider&&<p>{concurrentRoadRider.riderId}: {concurrentRoadRider.energyAfter.toFixed(1)} energy · {concurrentRoadRider.energySpent===null?'contact observation':`${concurrentRoadRider.energySpent.toFixed(2)} spent this segment`} · {concurrentRoadRider.role}</p>}
          </div>}
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
        {bandLocalReplay&&selectedBand&&<div className="v91-finish">
          <h3>Paid group-local finale</h3>
          <p>Each road group or isolated rider passes {bandLocalReplay.handoffDistanceM/1000} km on its own recorded clock. Select a band to follow its paid individual positions and energy to the line. These frames are not one simultaneous road view; the combined order remains conditional.</p>
          <label>Finale road band<select value={bandId}
            onChange={event=>{
              const next=bandLocalReplay.bands.find(band=>
                band.id===event.target.value);
              setBandId(event.target.value);setBandFrameIndex(0);
              setBandRiderId(next?.riderIds[0]??'');
            }}>
            {bandLocalReplay.bands.map(band=><option key={band.id}
              value={band.id}>{band.id.startsWith('isolated:')?
                `Isolated rider ${band.riderIds[0]}`:
                `${band.id} · ${band.riderIds.length} riders`}</option>)}
          </select></label>
          <p>{selectedBand.riderIds.length} {selectedBand.riderIds.length===1?'rider passes':'riders pass'} the 500 m boundary at {selectedBand.passageSecondsFromBunchMarker.toFixed(2)} s from the bunch last-kilometre marker.</p>
          <label>Band interval: {bandFrameIndex+1} of {selectedBand.frames.length}
            <input type="range" min="0" max={selectedBand.frames.length-1}
              value={bandFrameIndex}
              onChange={event=>setBandFrameIndex(Number(event.target.value))}/>
          </label>
          <p>{bandFrame?.elapsedSeconds.toFixed(2)} s from the bunch last-kilometre marker · {bandFrame?.riders.length} {bandFrame?.riders.length===1?'rider':'riders'} in this band</p>
          <label>Inspect group rider<select value={bandRiderId}
            onChange={event=>setBandRiderId(event.target.value)}>
            {selectedBand.riderIds.map(riderId=><option key={riderId}
              value={riderId}>{riderId}</option>)}
          </select></label>
          {bandRider&&<p>{bandRider.riderId}: {(bandLocalReplay.lineDistanceM-
            bandRider.positionM).toFixed(1)} m to go · {bandRider.energyAfter.toFixed(1)} energy · {bandRider.energySpent.toFixed(2)} spent this interval · {bandRider.role} · {bandSourceRider?.energyAt500.toFixed(1)} energy at 500 m</p>}
          <p>{bandFrame?.riders.every(row=>
            Math.abs(row.positionM-bandLocalReplay.lineDistanceM)<1e-6)?
              `${selectedBand.id.startsWith('isolated:')?
                'This isolated rider has':'Every rider in this group has'} crossed. The full conditional result is below.`:
              'Other groups follow their own recorded passage clocks.'}</p>
        </div>}
        {integrated&&!finaleReplay&&!bandLocalReplay&&<p className="v91-warning">
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
            {row.helperId} {row.status==='unavailable_at_500m'?
              row.reason==='exhausted'?
                'had too little energy at 500 m':
                row.reason==='different_road_group'?
                  'was in a different road group at 500 m':
                  'could not work at 500 m':
              'could not assemble in the source lane'}; no helper work was charged.
          </p>)}
          <p>Paid lead-out work: {integrated.finale?.leadOutWork?.length??0} recorded rider intervals.</p>
          {integrated.finale?.leadOutWork?.length>0&&<ul>{Object.entries(
            integrated.finale.leadOutWork.reduce((totals,row)=>({
              ...totals,[row.riderId]:(totals[row.riderId]??0)+row.energySpent
            }),{})).map(([riderId,energy])=><li key={riderId}>
            {riderId}: {energy.toFixed(1)} energy spent</li>)}</ul>}
          {conditionalLine.length>0&&<div>
            <h4>Individual conditional results</h4>
            <p>{conditionalLine.length} of {result.settings.teamCount*8} riders have individual crossing times. Times do not establish official places.</p>
            <p>Times use the bunch's last-kilometre marker as zero. A negative time means a front rider crossed before the bunch reached that marker; the gap column is measured from the first crossing. The kilometre recording has no paid whole-race clock.</p>
            <label>Results team<select value={resultsTeam}
              onChange={event=>setResultsTeam(event.target.value)}>
              <option value="all">All teams</option>
              {Array.from({length:result.settings.teamCount},(_,index)=>
                index===0?'you':`rival-${index}`).map(teamId=><option
                  key={teamId} value={teamId}>{teamId==='you'?'Your team':teamId}</option>)}
            </select></label>
            <div className="v91-result-scroll"><table className="v91-result-table"
              aria-label="Individual conditional results">
              <thead><tr><th scope="col">Conditional order</th>
                <th scope="col">Rider</th><th scope="col">Time from bunch's final-km marker</th>
                <th scope="col">Gap</th><th scope="col">Energy at line</th>
                {pointRows.size>0&&<th scope="col">Preview points</th>}
              </tr></thead>
              <tbody>{visibleLine.map(row=><tr key={row.riderId}>
                <td>{row.conditionalOrder}</td><th scope="row">{row.riderId}</th>
                <td>{row.elapsedSecondsFromLastKmStart.toFixed(3)} s</td>
                <td>+{(row.elapsedSecondsFromLastKmStart-
                  conditionalLine[0].elapsedSecondsFromLastKmStart).toFixed(3)} s</td>
                <td>{row.energyAtLine.toFixed(1)}</td>
                {pointRows.size>0&&<td>{pointRows.get(row.riderId)
                  ?.previewPoints??'—'}</td>}
              </tr>)}</tbody>
            </table></div>
            <p>Showing {visibleLine.length} riders. Point values, when shown, are read-only illustrations; official points remain withheld.</p>
          </div>}
          {integrated.provisionalPointPreview&&<div>
            <h4>Read-only points illustration</h4>
            {ownPointPreview?<p>{ownFinisher}: provisional place {ownPointPreview.provisionalPlace}, {ownPointPreview.previewPoints} preview points.</p>:
              <p>{integrated.provisionalPointPreview.reason??'No unambiguous individual order.'}</p>}
            <p>Official points: withheld · Awards saved: 0</p>
          </div>}
          <p>Last-kilometre source: {integrated.lastKmSource?.roadGroups?.length??0} groups ahead; {integrated.lastKmSource?.droppedRiderIds?.length??0} isolated riders.</p>
          {integrated.lastKmSource?.droppedRiderIds?.length>0&&<p>
            Isolated riders: {integrated.lastKmSource.droppedRiderIds.join(', ')}
          </p>}
          {integrated.finale?.totalUnmetEnergyDemand>0&&<p className="v91-warning">
            Unpaid rider travel: {integrated.finale.totalUnmetEnergyDemand.toFixed(3)} energy demand remains after reserve reached zero. No individual finish or point preview can be paid for this road.
          </p>}
          {integrated.sourceEnergyAudit?.riders.length>0&&<p className="v91-warning">
            Earlier zero-reserve travel: {integrated.sourceEnergyAudit.riders.length} riders recorded zero energy in successive whole kilometres before the finale. First: {integrated.sourceEnergyAudit.riders[0].riderId} at km {integrated.sourceEnergyAudit.riders[0].firstZeroKm}. This recording has no paid exhaustion rule for that interval.
          </p>}
          {integrated.sourceEnergyAudit?.totalUnmetEnergyDemand>0&&<p className="v91-warning">
            Whole-race energy audit: {integrated.sourceEnergyAudit.totalUnmetEnergyDemand.toFixed(3)} energy demand went unpaid across {integrated.sourceEnergyAudit.unpaidRiderKilometres} rider-kilometres, starting at km {integrated.sourceEnergyAudit.firstUnpaidKm}. Results and points remain withheld until that travel has a paid rule.
          </p>}
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
          {comparison&&<div aria-label="Paired race comparison">
            <h4>Previous run on the same conditions</h4>
            <p>Route, profile, category, field, fatigue and seed match. Tactics and finale nominations may differ.</p>
            <p>Named final attack: {attackDescription(comparison.before)} → {attackDescription(comparison.after)}</p>
            <p>Groups at the last-kilometre handoff: {comparison.before.sourceGroups} → {comparison.after.sourceGroups}</p>
            <p>Lead-out: {comparison.before.leadOutRiderId??'none'} ({comparison.before.leadOutEnergy.toFixed(1)} energy paid) → {comparison.after.leadOutRiderId??'none'} ({comparison.after.leadOutEnergy.toFixed(1)} energy paid)</p>
            {comparison.before.pointContext&&
              comparison.before.pointContext===comparison.after.pointContext&&
              <p>Read-only points: {comparison.before.pointLabel} → {comparison.after.pointLabel}. Official points: withheld.</p>}
            <p>Finisher crossing: {comparison.before.finisherId} {comparison.before.crossingSeconds?.toFixed(3)??'unavailable'} s → {comparison.after.finisherId} {comparison.after.crossingSeconds?.toFixed(3)??'unavailable'} s</p>
            {comparison.before.finisherId===comparison.after.finisherId&&
              comparison.before.crossingSeconds!==null&&
              comparison.after.crossingSeconds!==null&&<p>
                Same finisher time change: {(comparison.after.crossingSeconds-
                  comparison.before.crossingSeconds).toFixed(3)} s · Energy at line: {comparison.before.energyAtLine?.toFixed(1)??'—'} → {comparison.after.energyAtLine?.toFixed(1)??'—'}
              </p>}
          </div>}
        </div>:<p className="v91-warning">{result.warning}</p>}
      </section>}
    </main>
  </TeamShell>;
}
