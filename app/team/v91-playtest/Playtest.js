'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import TeamShell from '../../components/TeamShell';
import {api} from '../../../lib/api';
import {playtestRiderCards} from '../../../lib/engine/v2/playtest-riders.mjs';
import {raceViewerCommentaryV1} from
  '../../../lib/engine/v2/playtest-commentary-v1.mjs';
import {recordedStageProfile} from '../../../lib/engine/v2/playtest-stage-trace.mjs';
import {summarizePlaytestRaceStory} from
  '../../../lib/engine/v2/playtest-race-story.mjs';
import {raceViewerCheckpoints,raceViewerEnergySeries,
  raceViewerEnergyCurve,
  raceViewerBreaksAndChase,raceViewerFinale,raceViewerRoad,
  raceViewerLateEffort,raceViewerLateTeamWork,
  raceViewerEffortInsight,raceViewerTimeline,raceViewerRivalAt,
  raceViewerOwnRiderActionsAt,raceViewerCheckpointChange,
  raceViewerSituationAt} from
  '../../../lib/engine/v2/playtest-viewer.mjs';

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
const optionLabel=(key,value)=>OPTIONS[key].find(([choice])=>
  String(choice)===String(value))?.[1]??String(value);

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
    profileHeightsM,teamOverrides}=settings;
  return JSON.stringify({distanceKm,terrain,teamCount,gender,fatigue,seed,
    ...(teamOverrides?.length?{teamOverrides}:{}),
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
  const effortMarkerKm=settings.managerTacticalOrdersV4?.[0]?.atKm??
    settings.managerTacticalOrdersV2?.[0]?.atKm??settings.distanceKm-5;
  return {conditions:comparisonConditions(settings),finisherId,effortMarkerKm,
    multiMarker: Boolean(settings.managerTacticalOrdersV4?.length||
      settings.managerTacticalOrdersV3?.length),
    planWithoutLateEffort:JSON.stringify({
      settings:{...settings,managerFinaleOrders:
        settings.managerFinaleOrders?.filter(order=>
          order.teamId!=='you'||order.atKm!==settings.distanceKm-5)},
      finishers:summary.managerDecisions.map(row=>({teamId:row.teamId,
        finisherId:row.finisherId,leadOutRiderId:row.leadOutRiderId}))}),
    lateEffort:raceViewerLateEffort(summary,finisherId),
    lateTeamWork:raceViewerLateTeamWork(summary),
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

export default function Playtest({guided=false}){
  const [settings,setSettings]=useState(guided?{...INITIAL,distanceKm:40,
    attack:'none',seed:'sample-flat-finish'}:INITIAL);
  const [customRivals,setCustomRivals]=useState(0);
  const [extraRivalId,setExtraRivalId]=useState('');
  const [integratedMode,setIntegratedMode]=useState(guided);
  const [coastedMode,setCoastedMode]=useState(guided);
  const [coasted,setCoasted]=useState(null);
  const [roadPreview,setRoadPreview]=useState(null);
  const [roadPreviewIndex,setRoadPreviewIndex]=useState(0);
  const [coastedKm,setCoastedKm]=useState(1);
  const [checkpointPlaying,setCheckpointPlaying]=useState(false);
  const [raceScreenOpen,setRaceScreenOpen]=useState(false);
  const [raceScreenPlaying,setRaceScreenPlaying]=useState(false);
  const [coastedRoadIndex,setCoastedRoadIndex]=useState(0);
  const [coastedBandId,setCoastedBandId]=useState('');
  const [coastedBandIndex,setCoastedBandIndex]=useState(0);
  const [coastedRiderId,setCoastedRiderId]=useState('');
  const [viewerRiderId,setViewerRiderId]=useState('you-7');
  const [viewerRivalId,setViewerRivalId]=useState('rival-1');
  const [finalePlans,setFinalePlans]=useState({});
  const [lateEfforts,setLateEfforts]=useState({});
  const [effortMarkerKm,setEffortMarkerKm]=useState(null);
  const [secondEffortMarkerKm,setSecondEffortMarkerKm]=useState(null);
  const [secondEfforts,setSecondEfforts]=useState({});
  const [firstFrontWork,setFirstFrontWork]=useState('');
  const [secondFrontWork,setSecondFrontWork]=useState('');
  const [finaleFrontWork,setFinaleFrontWork]=useState({});
  const [namedAttack,setNamedAttack]=useState({teamId:'',riderId:''});
  const [secondNamedAttack,setSecondNamedAttack]=useState({teamId:'',riderId:''});
  const [showPointPreview,setShowPointPreview]=useState(guided);
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
  const [submittedChoices,setSubmittedChoices]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [stagePlan,setStagePlan]=useState(null);
  const [stagePlanBusy,setStagePlanBusy]=useState(false);
  const [stagePlanError,setStagePlanError]=useState('');
  const roadPreviewFrame=roadPreview?.lastKmRoad[roadPreviewIndex];
  const catchSourceFrame=roadPreview?.lastKmRoad.length===0?
    roadPreview.kilometreFrames.at(-1):null;
  const catchRoadFrame=catchSourceFrame?
    roadPreview.kilometreFrames[roadPreviewIndex]:null;
  const refusedRoadChanges=catchSourceFrame?
    recordedRoadChanges(roadPreview.kilometreFrames):[];
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
  const clearSecondTimedOrder=()=>{
    setSecondEffortMarkerKm(null);
    setSecondEfforts({});
    setSecondFrontWork('');
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
  const viewerOwnActions=raceViewerOwnRiderActionsAt(coasted,coastedFrame);
  const viewerSelectedAction=viewerOwnActions.find(row=>
    row.riderId===viewerRiderId);
  const viewerCheckpointChange=raceViewerCheckpointChange(coasted,
    coastedFrame,viewerRiderId);
  const coastedStage=coasted?.stageTrace?.kilometres[coastedKm-1];
  const coastedProfile=coasted?.stageTrace?recordedStageProfile(coasted.stageTrace):null;
  const ownRecordedOrder=coasted?.managerOrders.find(order=>
    order.teamId==='you');
  const activeOwnPhase=ownRecordedOrder?.phaseOrders
    .filter(phase=>phase.atKm<=coastedKm-1).at(-1);
  const activeOwnOrder=ownRecordedOrder?
    {...ownRecordedOrder,...activeOwnPhase}:null;
  const previousOwnEnergy=coasted?.kilometreFrames[coastedKm-2]
    ?.ownRiders.find(row=>row.riderId===viewerRiderId)?.energy;
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
  const photoFinishGroups=[...new Map((coasted?.roadPlaceBounds?.riders??[])
    .filter(row=>row.position===null)
    .map(row=>[`${row.firstPossiblePlace}-${row.lastPossiblePlace}`,
      {first:row.firstPossiblePlace,last:row.lastPossiblePlace}]))
    .values()].map(group=>({...group,riderIds:(coasted?.roadPlaceBounds
      ?.riders??[]).filter(row=>row.position===null&&
      row.firstPossiblePlace===group.first&&
      row.lastPossiblePlace===group.last).map(row=>row.riderId).sort()}))
    .sort((a,b)=>a.first-b.first||a.last-b.last);
  const photoFinishRiderCount=photoFinishGroups.reduce((sum,group)=>
    sum+group.riderIds.length,0);
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
  const visibleCoastedOrder=coastedOrder.filter(row=>
    resultsTeam==='all'||row.riderId.startsWith(`${resultsTeam}-`));
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
  const coastedRaceStory=coasted?summarizePlaytestRaceStory(coasted):[];
  const coastedViewer=useMemo(()=>coasted?raceViewerCheckpoints(coasted,
    viewerRiderId):[],[coasted,viewerRiderId]);
  const viewerTrackRef=useRef(null);
  const raceScreenRef=useRef(null);
  const previousCheckpoint=[...coastedViewer].reverse()
    .find(checkpoint=>checkpoint.index<coastedKm-1);
  const nextCheckpoint=coastedViewer
    .find(checkpoint=>checkpoint.index>coastedKm-1);
  const selectRecordedKilometre=km=>{
    setCheckpointPlaying(false);
    setRaceScreenPlaying(false);
    setCoastedKm(km);
  };
  useEffect(()=>{
    if(!raceScreenOpen||!raceScreenPlaying||!coasted)return;
    if(coastedKm>=coasted.kilometreFrames.length){
      setRaceScreenPlaying(false);
      return;
    }
    const timer=window.setTimeout(()=>setCoastedKm(km=>km+1),1200);
    return ()=>window.clearTimeout(timer);
  },[raceScreenOpen,raceScreenPlaying,coasted,coastedKm]);
  useEffect(()=>{
    if(!checkpointPlaying||!coasted||!nextCheckpoint)return;
    const timer=window.setTimeout(()=>{
      setCoastedKm(nextCheckpoint.index+1);
      if(!coastedViewer.some(checkpoint=>
        checkpoint.index>nextCheckpoint.index))setCheckpointPlaying(false);
    },1800);
    return ()=>window.clearTimeout(timer);
  },[checkpointPlaying,coasted,coastedKm,nextCheckpoint,coastedViewer]);
  useEffect(()=>{
    const track=viewerTrackRef.current;
    const closest=[...coastedViewer].reverse()
      .find(checkpoint=>checkpoint.index<=coastedKm-1);
    const card=closest&&track?.querySelector(
      `[data-checkpoint-index="${closest.index}"]`);
    if(track&&card)track.scrollTo({left:card.offsetLeft-track.offsetLeft,
      behavior:checkpointPlaying?'auto':'smooth'});
  },[coastedKm,coasted,checkpointPlaying]);
  const viewerEnergy=coasted?raceViewerEnergySeries(coasted,viewerRiderId):[];
  const recordedTimedOrders=coasted?.settings.managerTacticalOrdersV4??
    coasted?.settings.managerTacticalOrdersV3??
    coasted?.settings.managerTacticalOrdersV2??[];
  const recordedEffortMarkersKm=[...new Set(recordedTimedOrders.map(row=>
    row.atKm))].sort((a,b)=>a-b);
  const recordedEffortMarkerKm=recordedEffortMarkersKm[0]??
    coasted?.settings.distanceKm-5;
  const paidFrontKilometres=coasted?.kilometreFrames.filter(frame=>
    frame.paidBunchPaceTeamId==='you').map(frame=>frame.km)??[];
  const paidFrontRanges=paidFrontKilometres.reduce((ranges,km)=>{
    const last=ranges.at(-1);
    if(last&&last.toKm===km-1)last.toKm=km;
    else ranges.push({fromKm:km,toKm:km});
    return ranges;
  },[]);
  const effortJumpKm=recordedTimedOrders.length?
    recordedEffortMarkerKm+1:recordedEffortMarkerKm;
  const viewerFiveKm=viewerEnergy.find(row=>
    row.km>=coasted.settings.distanceKm-5);
  const viewerLine=coasted?.lineTimes.find(row=>row.riderId===viewerRiderId);
  const viewerEnergyCurve=coasted?raceViewerEnergyCurve(coasted,
    viewerRiderId):[];
  const viewerEnergyPoints=viewerEnergyCurve.map((row,index)=>
    `${20+index/Math.max(1,viewerEnergyCurve.length-1)*560},${120-row.energy}`)
    .join(' ');
  const viewerSelectedEnergy=viewerEnergy[coastedKm-1];
  const viewerBreaks=coasted?raceViewerBreaksAndChase(coasted):null;
  const viewerFinale=coasted?raceViewerFinale(coasted,viewerRiderId):null;
  const viewerRoad=coasted?raceViewerRoad(coastedFrame,
    coasted.settings.teamCount*8):[];
  const viewerSituation=coasted?raceViewerSituationAt(coasted,coastedFrame,
    playtestRiderCards(coasted.settings,'you')):null;
  const raceScreenElevationY=coastedProfile&&coastedStage?
    110-(coastedStage.endM-coastedProfile.minElevationM)/Math.max(1,
      coastedProfile.maxElevationM-coastedProfile.minElevationM)*90:110;
  useEffect(()=>{
    if(!raceScreenOpen)return;
    const previousOverflow=document.body.style.overflow;
    const previousFocus=document.activeElement;
    document.body.style.overflow='hidden';
    raceScreenRef.current?.querySelector('button')?.focus();
    const handleRaceScreenKeys=event=>{
      if(event.key==='Escape')setRaceScreenOpen(false);
      if(event.key!=='Tab')return;
      if(!raceScreenRef.current)return;
      const focusable=[...raceScreenRef.current.querySelectorAll(
        'button:not(:disabled),input:not(:disabled)')];
      if(!focusable.length)return;
      if(event.shiftKey&&document.activeElement===focusable[0]){
        event.preventDefault();focusable.at(-1).focus();
      }else if(!event.shiftKey&&
        document.activeElement===focusable.at(-1)){
        event.preventDefault();focusable[0].focus();
      }
    };
    window.addEventListener('keydown',handleRaceScreenKeys);
    return ()=>{
      document.body.style.overflow=previousOverflow;
      window.removeEventListener('keydown',handleRaceScreenKeys);
      previousFocus?.focus();
    };
  },[raceScreenOpen]);
  const viewerMaxAbsGap=Math.max(1,...viewerRoad.map(band=>
    Math.abs(band.gapSeconds)));
  const viewerRival=raceViewerRivalAt(coasted,coastedFrame,viewerRivalId);
  const viewerRivalPhases=viewerRival?.orders?.phaseOrders??[];
  const viewerRivalActivePhase=viewerRivalPhases.filter(phase=>
    phase.atKm<=coastedKm-1).at(-1);
  const viewerRivalBreaks=coasted?
    raceViewerBreaksAndChase(coasted,viewerRivalId).riders:[];
  const viewerRiderRoad=viewerRoad.find(band=>
    band.ownRiderIds.includes(viewerRiderId));
  const viewerCurrentEnergy=coastedFrame?.ownRiders.find(row=>
    row.riderId===viewerRiderId)?.energy;
  const viewerTimeline=coasted?raceViewerTimeline(coasted):[];
  const commentaryNames=coasted?{
    teams:Object.fromEntries(Array.from({length:coasted.settings.teamCount},
      (_,index)=>{
        const id=index===0?'you':`rival-${index}`;
        return [id,index===0?'Your team':`Fictional rival ${index}`];
      })),
    riders:Object.fromEntries(Array.from({length:coasted.settings.teamCount},
      (_,index)=>playtestRiderCards(coasted.settings,
        index===0?'you':`rival-${index}`)).flat()
      .map(rider=>[rider.id,rider.name]))}:null;
  const viewerCommentary=coasted?raceViewerCommentaryV1(coasted,
    {names:commentaryNames}):[];
  const commentaryAtKm=viewerCommentary.filter(moment=>
    moment.index===coastedKm-1);
  const recentRaceCommentary=viewerCommentary.filter(moment=>
    moment.index<=coastedKm-1).slice(-8).reverse();
  const viewerKmMoments=viewerTimeline.filter(moment=>
    moment.finaleRoadIndex==null);
  const previousViewerMoment=[...viewerKmMoments].reverse().find(moment=>
    moment.km<coastedKm);
  const nextViewerMoment=viewerKmMoments.find(moment=>
    moment.km>coastedKm);
  const selectViewerMoment=moment=>{
    if(moment.finaleRoadIndex!=null){
      selectRecordedKilometre(coasted.kilometreFrames.length);
      setCoastedRoadIndex(moment.finaleRoadIndex);
      document.getElementById('v93-recorded-road')?.scrollIntoView();
    }else selectRecordedKilometre(moment.index+1);
  };
  const viewerPlace=coastedProvisionalPlaces.get(viewerRiderId)??
    coastedRoadBounds.get(viewerRiderId);
  const coastedBunchExitCount=(coasted?.unresolvedBunchExits??[])
    .reduce((count,wave)=>count+wave.riderIds.length,0);
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
  const stageSettings={distanceKm:settings.distanceKm,terrain:settings.terrain,
    seed:settings.seed,...(settings.terrain==='custom'?
      {profileHeightsM:settings.profileHeightsM}:{})};
  const stagePlanKey=JSON.stringify(stageSettings);
  const visibleStagePlan=stagePlan?.key===stagePlanKey?stagePlan.data:null;
  const stageProfile=visibleStagePlan?
    recordedStageProfile(visibleStagePlan.stageTrace):null;
  const chosenEffortMarkerKm=Math.min(effortMarkerKm??settings.distanceKm-5,settings.distanceKm-5);
  const chosenSecondEffortMarkerKm=Number.isInteger(secondEffortMarkerKm)&&
    secondEffortMarkerKm>=5&&secondEffortMarkerKm<=settings.distanceKm-5&&
    secondEffortMarkerKm%5===0&&secondEffortMarkerKm!==chosenEffortMarkerKm?
      secondEffortMarkerKm:null;
  const currentChoices=JSON.stringify({settings,customRivals,
    finalePlans,lateEfforts,effortMarkerKm,secondEffortMarkerKm,
    secondEfforts,firstFrontWork,secondFrontWork,showPointPreview,
    pointContext:showPointPreview?pointContext:null,
    integratedMode,coastedMode,
    ...(!coastedMode?{finaleFrontWork,namedAttack,
      secondNamedAttack}:{})});
  const resultUsesEarlierChoices=Boolean(coasted&&submittedChoices&&
    submittedChoices!==currentChoices);
  const roadPreviewUsesEarlierChoices=Boolean(roadPreview&&submittedChoices&&
    submittedChoices!==currentChoices);
  const ownPlan=finalePlans.you??{finisherId:'you-7',
    leadOutRiderId:null};
  const individuallyManagedRivals=new Set([
    ...Array.from({length:customRivals},(_,index)=>`rival-${index+1}`),
    ...settings.managerTacticOverrides.map(row=>row.teamId)]);
  const setupExampleRace=(kind)=>{
    const tactical=kind==='tactical';
    const measuredChase=kind==='measured-chase';
    const chase=kind==='chase'||measuredChase;
    setIntegratedMode(true);setCoastedMode(true);
    setSettings(tactical?{...INITIAL,distanceKm:120,terrain:'rolling',
      gender:'F',teamCount:15,fatigue:15,attack:'none',
      seed:'late-phase-6',managerTacticOverrides:[{teamId:'rival-14',
        effort:'hard',attack:'none',chase:'all'}]}:chase?
      {...INITIAL,distanceKm:40,terrain:'flat',attack:'none',
        chase:'all',defaultRivalPlan:'attack',seed:'near-catch',
        teamOverrides:[{teamId:'you',level:measuredChase?45:40},
          ...['rival-1','rival-2','rival-3'].map(teamId=>(
            {teamId,level:measuredChase?25:20}))]}:
      {...INITIAL,distanceKm:40,attack:'none',
        seed:'sample-flat-finish'});
    setCustomRivals(0);setExtraRivalId('');
    setFinalePlans(tactical?{'you':{finisherId:'you-7',
      leadOutRiderId:'you-6'},'rival-14':{finisherId:'rival-14-3',
      leadOutRiderId:'rival-14-5'}}:{});
    setEffortMarkerKm(null);
    setSecondEffortMarkerKm(null);setSecondEfforts({});
    setLateEfforts(tactical?{'you':'hard','rival-14':'conserve'}:
      chase?{'you':'conserve'}:{});
    setFinaleFrontWork({});
    setFirstFrontWork('');setSecondFrontWork('');
    setNamedAttack({teamId:'',riderId:''});
    setSecondNamedAttack({teamId:'',riderId:''});
    setShowPointPreview(true);
    setPointContext({tier:2,divisionIndex:1,divisionCount:2});
    setResult(null);setIntegrated(null);setCoasted(null);
    setRoadPreview(null);setError('');
    setComparison(null);setPreviousRun(null);
    setCoastedComparison(null);setPreviousCoastedRun(null);
    setSubmittedChoices(null);
    document.getElementById('v91-race-settings')?.scrollIntoView();
  };
  async function loadStagePlan(){
    setStagePlanBusy(true);setStagePlanError('');
    const key=stagePlanKey;
    try{
      const response=await api('/api/v91-playtest/stage-plan',{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({settings:stageSettings})});
      setStagePlan({key,data:response.stagePlan});
    }catch(cause){setStagePlanError(cause.message||'The stage could not load.');}
    finally{setStagePlanBusy(false);}
  }

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
      const firstTimedPhases=finaleTeams.flatMap(teamId=>{
        const effort=lateEfforts[teamId];
        const frontWork=teamId==='you'?firstFrontWork:'';
        return effort||frontWork?[{teamId,atKm:chosenEffortMarkerKm,
          ...(effort?{effort}:{}),...(frontWork?{frontWork}:{})}]:[];
      });
      const secondTimedPhases=chosenSecondEffortMarkerKm===null?[]:
        finaleTeams.flatMap(teamId=>{
          const effort=secondEfforts[teamId];
          const frontWork=teamId==='you'?secondFrontWork:'';
          return effort||frontWork?[{teamId,atKm:chosenSecondEffortMarkerKm,
            ...(effort?{effort}:{}),...(frontWork?{frontWork}:{})}]:[];
        });
      const raceSettings={...settings,managerTactics,
        ...(!coastedMode&&secondNamedAttack.teamId?{
          managerFinaleOrders:[...orders.values()]}:{}),
        ...(integratedMode&&coastedMode&&(firstFrontWork||
          chosenSecondEffortMarkerKm!==null&&secondFrontWork)?{
          managerTacticalOrdersV4:[...firstTimedPhases,...secondTimedPhases]}:
        integratedMode&&coastedMode?chosenSecondEffortMarkerKm!==null&&
          finaleTeams.some(teamId=>secondEfforts[teamId])?{
            managerTacticalOrdersV3:[
              ...finaleTeams.filter(teamId=>lateEfforts[teamId]).map(teamId=>
                ({teamId,atKm:chosenEffortMarkerKm,effort:lateEfforts[teamId]})),
              ...finaleTeams.filter(teamId=>secondEfforts[teamId]).map(teamId=>
                ({teamId,atKm:chosenSecondEffortMarkerKm,
                  effort:secondEfforts[teamId]})),
            ]}:{
            [chosenEffortMarkerKm===settings.distanceKm-5?
              'managerFinaleOrders':'managerTacticalOrdersV2']:finaleTeams
              .filter(teamId=>lateEfforts[teamId])
              .map(teamId=>({teamId,atKm:chosenEffortMarkerKm,
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
        setCoastedComparison(previousCoastedRun?.conditions===next.conditions&&
          !previousCoastedRun.multiMarker&&!next.multiMarker&&
          previousCoastedRun.effortMarkerKm===raceSettings.distanceKm-5&&
          next.effortMarkerKm===raceSettings.distanceKm-5?
          {before:previousCoastedRun,after:next}:null);
        setPreviousCoastedRun(next);
        setComparison(null);setPreviousRun(null);
      }else{
        setComparison(null);setPreviousRun(null);
        setCoastedComparison(null);setPreviousCoastedRun(null);
      }
      setRoadPreview(null);
      setCoasted(response.coasted??null);
      setCheckpointPlaying(false);
      setRaceScreenPlaying(false);
      setRaceScreenOpen(Boolean(response.coasted));
      setCoastedKm(1);setCoastedRoadIndex(0);
      setCoastedBandId(response.coasted?.bandReplays.find(band=>
        band.riderIds.includes(response.coasted.managerDecisions.find(row=>
          row.teamId==='you')?.finisherId))?.id??'');
      setCoastedBandIndex(0);
      setCoastedRiderId(response.coasted?.managerDecisions.find(row=>
        row.teamId==='you')?.finisherId??'');
      setViewerRiderId(response.coasted?.managerDecisions.find(row=>
        row.teamId==='you')?.finisherId??'you-7');
      setViewerRivalId('rival-1');
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
      setSubmittedChoices(currentChoices);
    }catch(cause){setComparison(null);setPreviousRun(null);
      setCoastedComparison(null);setPreviousCoastedRun(null);
      setResult(null);setIntegrated(null);setCoasted(null);setAttackRoad(null);
      setCheckpointPlaying(false);
      setRaceScreenPlaying(false);
      setRaceScreenOpen(false);
      setAttackApproach(null);setFinaleReplay(null);setBandLocalReplay(null);
      setRoadPreview(cause.roadPreview??null);
      setSubmittedChoices(cause.roadPreview?currentChoices:null);
      setRoadPreviewIndex(Math.max(0,
        (cause.roadPreview?.lastKmRoad.length===0?
          cause.roadPreview.kilometreFrames.length:
          cause.roadPreview?.lastKmRoad.length??1)-1));
      setError(cause.message||'The playtest could not run.');}
    finally{setBusy(false);}
  }
  return <TeamShell compact>
    <main className={`v91-lab${guided?' v91-guided':''}`}>
      <p className="v91-eyebrow">Experimental race engine</p>
      <h1>{guided?'Motor Lab: plan a race':'Try a fictional race'}</h1>
      <p>{guided?'Choose a route and tactics, run the race, then follow the road to the finish. Start with the sample or change any choice below.':'Change your orders and the race conditions, then rerun with the same seed to compare what happened on the road.'}</p>
      <p className="v91-warning">This is a fictional preview. Results and points are for inspection only; no official result or award is saved.</p>
      {guided&&<nav className="v91-flow-nav" aria-label="Motor Lab race flow">
        <button type="button" onClick={()=>{
          setCheckpointPlaying(false);
          document.getElementById('v91-race-settings')?.scrollIntoView();
        }}>
          1 · Plan tactics</button>
        <button type="button" disabled={!coasted&&!roadPreview}
          onClick={()=>document.getElementById(coasted?
            'v93-race-viewer':'v91-paid-road')?.scrollIntoView()}>
          {coasted?'2 · Watch recorded race':
            roadPreview?'2 · Inspect paid road':'2 · Watch recorded race'}</button>
        <button type="button" disabled={!coasted?.lineTimes?.length}
          onClick={()=>{
            setCheckpointPlaying(false);
            document.getElementById('v93-your-finish')?.scrollIntoView();
          }}>
          3 · Inspect conditional result</button>
      </nav>}
      <div className="v91-start" aria-label="Start a playable race preview">
        <strong>{guided?'Ready-made races':'Start with a race you can inspect.'}</strong>
        <div className="v91-start-actions">
          <button type="button" onClick={()=>setupExampleRace('sample')}
            disabled={busy}>{guided?'Reset sample race':'Set up sample race'}</button>
          <button type="button" onClick={()=>setupExampleRace('tactical')}
            disabled={busy}>Set up two-manager race</button>
          <button type="button" onClick={()=>setupExampleRace('chase')}
            disabled={busy}>Set up close-chase race</button>
          <button type="button" onClick={()=>setupExampleRace('measured-chase')}
            disabled={busy}>Set up measured-chase race</button>
        </div>
        <p>{guided?'A 40 km sample is ready below. Try the 120 km race to control a rival manager too. You can edit either setup before running.':
          'Choose a 40 km sample or a 120 km two-manager race with custom tactics and lead-outs. Edit either setup, then inspect the road, finish and rider replay.'}</p>
        <p>The 40 km close chase starts with three attacking rivals and
          synthetic team strengths of 40 for your team and 20 for each rival.
          Run it with conserve at 5 km, then try hard with the same seed to
          inspect the catch, energy and conditional finish. You can also try
          the measured chase: conserve leaves the break ahead, while steady
          and hard both catch it. Compare the energy each choice leaves at
          the line. The sample and 120 km two-manager races remain available.</p>
      </div>
      <form id="v91-race-settings" onSubmit={run} className="v91-controls">
        {!guided&&<label className="v91-mode"><input type="checkbox" checked={integratedMode}
          onChange={event=>setIntegratedMode(event.target.checked)}/>
          Continue to a conditional finish</label>}
        {integratedMode&&!guided&&<label className="v91-mode"><input type="checkbox"
          checked={coastedMode}
          onChange={event=>setCoastedMode(event.target.checked)}/>
          Try v93 road-to-line preview</label>}
        {integratedMode&&coastedMode&&<p className="v91-warning">
          {guided?'Some complex finishes cannot yet be calculated. If that happens, you will see the recorded road and a clear explanation, without a made-up result or points.':
            'This preview pays supported bunch, front-group, and isolated-rider roads from the final-kilometre handoff. Unsupported roads return a clear refusal; results and points remain experimental.'}
        </p>}
        {guided&&<div className="v91-step-heading"><span>01 / RACE</span><h2>Set the scene</h2><p>Pick a route, distance, field and starting condition.</p></div>}
        {Object.entries(OPTIONS).filter(([key])=>!guided||
          ['distanceKm','terrain','teamCount','gender','fatigue'].includes(key))
          .map(([key,options])=><label key={key}>{LABELS[key]}
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
        {guided&&<section className="v91-stage-plan" aria-label="Stage inputs before tactics">
          <h3>Inspect the stage before giving orders</h3>
          <p>The stage plan uses the same simulated 1 km route inputs as the race. Each 5 km card summarizes five separate kilometres, including changing wind and weather. This view does not resolve short climbs or landmarks.</p>
          <button type="button" onClick={loadStagePlan} disabled={stagePlanBusy}>
            {stagePlanBusy?'Loading stage…':visibleStagePlan?'Reload stage inputs':'Load stage inputs'}
          </button>
          {stagePlanError&&<p className="v91-error" role="alert">{stagePlanError}</p>}
          {stagePlan&&!visibleStagePlan&&<p role="status">Route settings changed. Reload the stage inputs for this route.</p>}
          {visibleStagePlan&&<div>
            <div className="v91-stage-profile">
              <svg viewBox="0 0 600 120" role="img" aria-label="Stage profile before tactics">
                <polyline points={stageProfile.points}/>
                {[chosenEffortMarkerKm,chosenSecondEffortMarkerKm]
                  .filter(km=>km!==null).map((km,index)=>
                  <line key={index} className="v91-stage-marker"
                    x1={20+km/settings.distanceKm*560}
                    x2={20+km/settings.distanceKm*560}
                    y1="12" y2="110"/>)}
              </svg>
              <p>Selected markers: {chosenEffortMarkerKm} km{chosenSecondEffortMarkerKm!==null?
                ', '+chosenSecondEffortMarkerKm+' km':''}. Dashed lines are selected tactic locations, not issued orders.</p>
              <p>Simulated route · {stageProfile.minElevationM.toFixed(0)}–{stageProfile.maxElevationM.toFixed(0)} m at 1 km resolution. The profile can hide short steep climbs.</p>
            </div>
            <div className="v91-stage-intervals">{visibleStagePlan.intervals.map(interval=>
              <article key={interval.fromKm}>
                <strong>{interval.fromKm}–{interval.toKm} km</strong>
                <span>{interval.terrains.join(', ')} · {interval.surfaces.join(', ')}</span>
                <span>{interval.startM.toFixed(0)} → {interval.endM.toFixed(0)} m · sampled range {interval.minM.toFixed(0)}–{interval.maxM.toFixed(0)} m</span>
                <span>{interval.exposedKm}/5 km exposed · wind {interval.windKph[0].toFixed(0)}–{interval.windKph[1].toFixed(0)} km/h</span>
                <span>Temp {interval.temperatureC[0].toFixed(0)}–{interval.temperatureC[1].toFixed(0)} °C · rain {interval.rainMm[0].toFixed(1)}–{interval.rainMm[1].toFixed(1)} mm</span>
                {interval.toKm<settings.distanceKm&&<>
                  <button type="button" aria-pressed={interval.toKm===chosenEffortMarkerKm}
                    onClick={()=>{
                      setEffortMarkerKm(interval.toKm);
                      if(secondEffortMarkerKm===interval.toKm)
                        clearSecondTimedOrder();
                    }}>
                    Use {interval.toKm} km as first order marker
                  </button>
                  {interval.toKm!==chosenEffortMarkerKm&&
                    <button type="button"
                      aria-pressed={interval.toKm===chosenSecondEffortMarkerKm}
                      onClick={()=>setSecondEffortMarkerKm(interval.toKm)}>
                      Use {interval.toKm} km as second order marker
                    </button>}
                </>}
              </article>)}</div>
            <p>Open Timed team orders below to choose an effort or bunch-front work; selecting a marker alone does not issue an order.</p>
          </div>}
        </section>}
        {guided&&<div className="v91-step-heading"><span>02 / TACTICS</span><h2>Give your team orders</h2><p>Effort spends energy; attacks and chasing change where your riders travel.</p></div>}
        {guided&&<p>Selective attacks are considered every 20 km and at route keypoints; repeated attacks every 5 km and at keypoints. An attempt may fail or be blocked by rider position or energy. Selective chase reacts to the gap and attack pressure; All helpers commits available helpers more strongly and costs more energy. After the race, the viewer shows which orders became recorded actions.</p>}
        {guided&&['effort','attack','chase'].map(key=><label key={key}>{LABELS[key]}
          <select value={settings[key]} onChange={event=>change(key,event.target.value)}>
            {OPTIONS[key].map(([value,label])=><option value={value} key={value}>{label}</option>)}
          </select></label>)}
        <details className="v91-optional" open={!guided}>
          <summary>Other managers <span>Use defaults or set rival tactics</span></summary>
        <fieldset className="v91-profile">
          <legend>Other managers</legend>
          <p>Rival 1 controls team rival-1 and its eight riders, rival-1-0 to rival-1-7; Rival 2 controls rival-2, and so on. Choose default tactics or customize a manager. After the race, select a rival in the viewer to see its riders, actions and nominated finisher on the recorded road.</p>
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
        </details>
        {integratedMode&&coastedMode&&<details className="v91-optional" open={!guided}>
          <summary>Timed team orders <span>Plan up to two 5 km markers</span></summary>
          <fieldset className="v91-profile">
          <legend>Precommitted effort and bunch-front work</legend>
          <p>Choose when a team-wide effort or bunch-front work change begins. The marker is every 5 km; the order takes effect in the following kilometre. Hard raises work demand. A front-work order attempts to put two available helpers on the bunch front, but an attack, chase, front rider or low helper energy can prevent that work. Check the recorded road and energy after a run.</p>
          <label>First order marker after
            <select value={chosenEffortMarkerKm} onChange={event=>{
              const next=Number(event.target.value);
              setEffortMarkerKm(next);
              if(secondEffortMarkerKm===next)clearSecondTimedOrder();
            }}>
              {Array.from({length:settings.distanceKm/5-1},(_,index)=>
                (index+1)*5).map(km=><option key={km} value={km}>
                {km} km ({settings.distanceKm-km} km to go)</option>)}
            </select>
          </label>
          <div className="v91-manager-tactics">{finaleTeams.map(teamId=>
            <label key={teamId}>Effort after {chosenEffortMarkerKm} km for {teamId}
              <select value={lateEfforts[teamId]??''} onChange={event=>
                setLateEfforts(current=>({...current,
                  [teamId]:event.target.value}))}>
                <option value="">Keep race effort</option>
                {OPTIONS.effort.map(([value,label])=><option key={value}
                  value={value}>{label}</option>)}
              </select>
            </label>)}</div>
          <label>Bunch-front work after {chosenEffortMarkerKm} km for your team
            <select value={firstFrontWork} onChange={event=>
              setFirstFrontWork(event.target.value)}>
              <option value="">Keep current work order</option>
              <option value="rotate">Try to set pace with two helpers</option>
              <option value="sit_in">Sit in</option>
            </select>
          </label>
          <label>Optional second order marker after
            <select value={chosenSecondEffortMarkerKm??''} onChange={event=>{
              if(event.target.value)
                setSecondEffortMarkerKm(Number(event.target.value));
              else clearSecondTimedOrder();
            }}>
              <option value="">No second change</option>
              {Array.from({length:settings.distanceKm/5-1},(_,index)=>
                (index+1)*5).filter(km=>km!==chosenEffortMarkerKm)
                .map(km=><option key={km} value={km}>
                  {km} km ({settings.distanceKm-km} km to go)
                </option>)}
            </select>
          </label>
          {chosenSecondEffortMarkerKm!==null&&
            <div className="v91-manager-tactics">{finaleTeams.map(teamId=>
              <label key={teamId}>Effort after {chosenSecondEffortMarkerKm} km for {teamId}
                <select value={secondEfforts[teamId]??''} onChange={event=>
                  setSecondEfforts(current=>({...current,
                    [teamId]:event.target.value}))}>
                  <option value="">Keep previous effort</option>
                  {OPTIONS.effort.map(([value,label])=><option key={value}
                    value={value}>{label}</option>)}
                </select>
              </label>)}</div>}
          {chosenSecondEffortMarkerKm!==null&&
            <label>Bunch-front work after {chosenSecondEffortMarkerKm} km for your team
              <select value={secondFrontWork} onChange={event=>
                setSecondFrontWork(event.target.value)}>
                <option value="">Keep previous work order</option>
                <option value="rotate">Try to set pace with two helpers</option>
                <option value="sit_in">Sit in</option>
              </select>
            </label>}
        </fieldset></details>}
        {guided&&<div className="v91-step-heading"><span>03 / FINALE</span><h2>Choose your finisher</h2><p>Nominate a rider and, if you wish, a helper to lead them out. The road decides whether they can work together.</p></div>}
        {integratedMode&&<fieldset className="v91-profile">
          <legend>Finale nominations</legend>
          <p>Choose a finisher and an optional helper for your team and any customized rival manager. Sprint and endurance are the riders&apos; actual synthetic skills for this race. A helper works only if they share the road and have energy left at 500 m.</p>
          <div className="v91-manager-tactics">{finaleTeams.map(teamId=>{
            const plan=finalePlans[teamId]??{finisherId:`${teamId}-7`,
              leadOutRiderId:null};
            const riders=playtestRiderCards(settings,teamId);
            return <div key={teamId}><strong>{teamId==='you'?'Your team':teamId}</strong>
              <label>{teamId} finisher<select value={plan.finisherId}
                onChange={event=>changeFinale(teamId,'finisherId',event.target.value)}>
                {riders.map((rider,index)=><option key={rider.id}
                  value={rider.id}>Rider {index+1} · Sprint {rider.sprint} · Endurance {rider.endurance}</option>)}</select>
              </label>
              <label>{teamId} lead-out helper<select value={plan.leadOutRiderId??''}
                onChange={event=>changeFinale(teamId,'leadOutRiderId',
                  event.target.value||null)}>
                <option value="">None</option>
                {riders.filter(rider=>rider.id!==plan.finisherId)
                  .map(rider=><option key={rider.id} value={rider.id}>
                    Rider {Number(rider.id.split('-').at(-1))+1} · Endurance {rider.endurance}
                  </option>)}</select>
              </label>
              <details className="v91-rider-guide" open={teamId==='you'}>
                <summary>{teamId==='you'?'Your riders':'Rival riders'}: skills before the race</summary>
                <div className="v91-result-scroll"><table className="v91-result-table">
                  <thead><tr><th scope="col">Rider</th><th scope="col">Sprint</th>
                    <th scope="col">Flat</th><th scope="col">Climb</th>
                    <th scope="col">Endurance</th></tr></thead>
                  <tbody>{riders.map((rider,index)=><tr key={rider.id}>
                    <th scope="row">Rider {index+1}{rider.id===plan.finisherId?' · finisher':''}{rider.id===plan.leadOutRiderId?' · helper':''}</th>
                    <td>{rider.sprint}</td><td>{rider.flat}</td>
                    <td>{rider.mountain}</td><td>{rider.endurance}</td>
                  </tr>)}</tbody>
                </table></div>
                <small>Skills are out of 100. These are starting abilities, not energy remaining during the race.</small>
              </details>
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
        {integratedMode&&coastedMode&&<section className="v91-brief"
          aria-label="Race plan before running">
          <h2>Your race plan</h2>
          <p>{settings.distanceKm} km {optionLabel('terrain',settings.terrain)} ·
            {' '}{optionLabel('gender',settings.gender)} · {' '}
            {settings.teamCount} teams · {' '}
            {optionLabel('fatigue',settings.fatigue).toLowerCase()} riders</p>
          <dl>
            <div><dt>Your orders</dt><dd>
              {optionLabel('effort',settings.effort)} effort · {' '}
              {optionLabel('attack',settings.attack)} attack · {' '}
              {optionLabel('chase',settings.chase)} chase
              {lateEfforts.you&&` · ${optionLabel('effort',lateEfforts.you)} effort after ${chosenEffortMarkerKm} km`}
              {firstFrontWork&&` · ${firstFrontWork==='rotate'?
                'try bunch-front work':'sit in'} after ${chosenEffortMarkerKm} km`}
              {chosenSecondEffortMarkerKm!==null&&secondEfforts.you&&
                ` · ${optionLabel('effort',secondEfforts.you)} effort after ${chosenSecondEffortMarkerKm} km`}
              {chosenSecondEffortMarkerKm!==null&&secondFrontWork&&
                ` · ${secondFrontWork==='rotate'?'try bunch-front work':
                  'sit in'} after ${chosenSecondEffortMarkerKm} km`}
            </dd></div>
            <div><dt>Your finish</dt><dd>{ownPlan.finisherId} nominated · {' '}
              {ownPlan.leadOutRiderId?
                `${ownPlan.leadOutRiderId} leads out`:'no lead-out helper'}</dd></div>
            <div><dt>Other managers</dt><dd>
              {individuallyManagedRivals.size} with your own tactics · {' '}
              {settings.teamCount-1-individuallyManagedRivals.size} use {' '}
              {settings.defaultRivalPlan==='mixed'?'mixed defaults':
                settings.defaultRivalPlan+' defaults'}
            </dd></div>
            <div><dt>Points</dt><dd>{showPointPreview?
              `Read-only illustration, tier ${pointContext.tier}`:
              'No point illustration'} · no awards saved</dd></div>
          </dl>
        </section>}
        <div className="v91-run-bar">
          <div><strong>Ready to race?</strong><span>{settings.distanceKm} km ·
            {' '}{settings.terrain} · {settings.teamCount} teams</span></div>
          <button type="submit" disabled={busy}>{busy?'Running race…':
            guided?'Run the race':integratedMode&&coastedMode?'Run v93 race preview':
              integratedMode?'Run full race preview':'Run race'}</button>
        </div>
      </form>
      {error&&<p role="alert" className="v91-error">{error}</p>}
      {roadPreview&&<section className="v91-results" id="v91-paid-road"
        aria-label="Recorded road without individual finish">
        <h2>Paid road · {roadPreview.settings.distanceKm} km {' '}
          {roadPreview.settings.terrain}</h2>
        {roadPreviewUsesEarlierChoices&&<p className="v91-warning"
          role="status">You changed the setup after this run. The paid road
          below still shows the previous choices. Run the race again to see
          the current choices.</p>}
        {catchSourceFrame?<>
          {roadPreview.catch?<>
            <p>The kilometre road is recorded through km {' '}
              {catchSourceFrame.km}. A front group is calculated to meet the
              bunch at {(roadPreview.catch.calculatedCatchDistanceM/1000)
                .toFixed(3)} km ({Math.round(roadPreview.catch.metresToGo)} m
              to go). That merge has no paid final-kilometre continuation;
              individual finish, replay and points are withheld.</p>
            <p>Approaching group: {roadPreview.catch.groupId}.</p>
          </>:<p>The kilometre road is recorded through km {' '}
            {catchSourceFrame.km}. {' '}
            {roadPreview.unsupportedReason==='unpayable_front_handoff'?
              `${roadPreview.handoff.riderId} cannot pay for the next road interval.`:
              roadPreview.unsupportedReason==='depleted_front_dissolution'?
                `${roadPreview.handoff.groupId} has no rider with energy to `+
                  'stay in the front group. Its riders need separate paid '+
                  'travel and contact before a result can be shown.':
              'The following front, bunch or isolated paths have unresolved contact.'}
            {' '}No final-kilometre passage, individual finish, replay or
            points is shown.</p>}
          <p>Recorded groups at the last-kilometre handoff: {catchSourceFrame.roadGroups.map(
              group=>`${group.id} (${group.riderIds.length} riders, `+
              `${group.gapSeconds.toFixed(2)} s ahead)`).join(' · ')||'none'}.
          </p>
          {roadPreview.markerAudit&&<div role="note"
            aria-label="Unresolved front marker overlaps">
            <p>The paid solo and {roadPreview.markerAudit.encounters[0].activeBandId}
              {' '}clocks cross after the last-kilometre handoff:</p>
            <p>{roadPreview.markerAudit.encounters.filter(row=>
              row.distanceM<roadPreview.settings.distanceKm*1000-500).length}
              {' '}marker overlaps before the 500 m sprint handoff and {' '}
              {roadPreview.markerAudit.encounters.filter(row=>
                row.distanceM>=roadPreview.settings.distanceKm*1000-500).length}
              {' '}at or after it. The sprint handoff does not settle these
              {' '}riders' occupied-wheel order.</p>
            <ul>{roadPreview.markerAudit.encounters.map(row=><li
              key={row.riderId}>{row.riderId} at {' '}
              {(row.distanceM/1000).toFixed(3)} km · {' '}
              {row.energyAtMarker.toFixed(1)} energy</li>)}</ul>
            <p>These are marker overlaps, not resolved occupied-wheel
              encounters. No individual finish, replay, place or points
              follow from them.</p>
          </div>}
          <div aria-label="Recorded race before the refusal">
            <h3>Recorded road changes</h3>
            <p>This refusal keeps the kilometre-level groups and energy.
              {' '}It does not retain the detailed attack and catch events
              {' '}needed for a full race timeline. Select a road change to
              {' '}inspect its riders below.</p>
            <ol>{refusedRoadChanges.map(({index,frame})=><li key={index}>
              <button type="button" onClick={()=>setRoadPreviewIndex(index)}>
                Km {frame.km}: {frame.roadGroups.length} front
                {' '}{frame.roadGroups.length===1?'group':'groups'} and
                {' '}{frame.droppedRiders.length} riding alone
              </button>
            </li>)}</ol>
          </div>
          <p>Your riders at that handoff: {catchSourceFrame.ownRiders.map(
            row=>`${row.riderId} ${row.roadGroup}, `+
              `${row.energy.toFixed(1)} energy`).join(' · ')}.</p>
          <label>Recorded kilometre: {roadPreviewIndex+1} of {' '}
            {roadPreview.kilometreFrames.length}
            <input type="range" min="0"
              max={roadPreview.kilometreFrames.length-1}
              value={roadPreviewIndex}
              onChange={event=>setRoadPreviewIndex(Number(event.target.value))}/>
          </label>
          <p>At km {catchRoadFrame.km}: {' '}
            {catchRoadFrame.roadGroups.length} groups ahead · {' '}
            {catchRoadFrame.droppedRiders.length} isolated riders.</p>
          <p>Road groups: {catchRoadFrame.roadGroups.map(group=>
            `${group.id} (${group.riderIds.length} riders, `+
            `${group.gapSeconds.toFixed(2)} s ahead)`).join(' · ')||'none'}</p>
          <p>Your riders: {catchRoadFrame.ownRiders.map(row=>
            `${row.riderId} ${row.roadGroup}, `+
            `${row.energy.toFixed(1)} energy`).join(' · ')}.</p>
        </>:roadPreview.catch?<>
          <p>The group-level final-kilometre road is paid through the line.
            {' '}{roadPreview.catch.groupId} meets the bunch at {' '}
            {(roadPreview.catch.calculatedCatchDistanceM/1000).toFixed(3)} km
            {' '}({Math.round(roadPreview.catch.metresToGo)} m to go), after {' '}
            {roadPreview.catch.elapsedSecondsFromLastKmStart.toFixed(2)} s.
            Individual finish, replay and points are withheld until the
            post-contact rider order can be resolved.</p>
          {roadPreview.individualContactAudit?.status===
            'possible_earlier_sprint_contact'&&<p role="note"
              aria-label="Individual sprint contact audit">
              With nominated sprints, individual rider paths may meet sooner,
              at {' '}
              {(roadPreview.individualContactAudit.firstPotentialOverlap
                .distanceM/1000).toFixed(3)} km. That encounter is not yet
              resolved on the shared road. The group catch does not establish
              rider places or points.
            </p>}
          <label>Recorded road boundary: {roadPreviewIndex+1} of {' '}
            {roadPreview.lastKmRoad.length}
            <input type="range" min="0"
              max={roadPreview.lastKmRoad.length-1}
              value={roadPreviewIndex}
              onChange={event=>setRoadPreviewIndex(Number(event.target.value))}/>
          </label>
          <p>{(roadPreviewFrame.distanceM/1000).toFixed(3)} km · bunch passage
            {' '}{roadPreviewFrame.bunchPassageSecondsFromBunchMarker.toFixed(2)} s
            {' '}· {roadPreviewFrame.groups.length} groups ahead · {' '}
            {roadPreviewFrame.droppedPassages.length} isolated riders.</p>
          <p>Road groups: {roadPreviewFrame.groups.map(group=>
            `${group.id} (${group.riderIds.length} riders, `+
            `${group.gapSeconds.toFixed(2)} s ahead)`).join(' · ')||'none'}</p>
          {roadPreviewFrame.contact&&<p role="note" aria-label="Paid late catch">
            Paid catch: {roadPreviewFrame.contact.groupId} joins the bunch at
            {' '}{(roadPreviewFrame.contact.atDistanceM/1000).toFixed(3)} km.
          </p>}
          <p>Your riders: {roadPreviewFrame.ownRiderEnergy.map(row=>
            `${row.riderId} ${row.roadBandId}, `+
            `${row.energy.toFixed(1)} energy`).join(' · ')}.</p>
        </>:<>
          <p>The final-kilometre clock is recorded through the line. The late
            bunch exit has no supported individual finish or replay, so places
            and points are withheld.</p>
          <p>Exit at {(roadPreview.exits[0].atDistanceM/1000).toFixed(3)} km:
            {' '}{roadPreview.exits.map(row=>row.riderId).join(', ')}.</p>
          <label>Recorded road boundary: {roadPreviewIndex+1} of {' '}
            {roadPreview.lastKmRoad.length}
            <input type="range" min="0"
              max={roadPreview.lastKmRoad.length-1}
              value={roadPreviewIndex}
              onChange={event=>setRoadPreviewIndex(Number(event.target.value))}/>
          </label>
          <p>{(roadPreviewFrame.distanceM/1000).toFixed(3)} km · bunch passage
            {' '}{roadPreviewFrame.bunchPassageSecondsFromBunchMarker.toFixed(2)} s
            {' '}· {roadPreviewFrame.groups.length} groups ahead · {' '}
            {roadPreviewFrame.droppedPassages.length} isolated riders.</p>
          <p>Road groups: {roadPreviewFrame.groups.map(group=>
            `${group.id} (${group.riderIds.length} riders, `+
            `${group.gapSeconds.toFixed(2)} s ahead)`).join(' · ')||'none'}</p>
          <p>Exit riders: {roadPreviewFrame.exitRiderEnergy.map(row=>
            `${row.riderId} ${row.energy.toFixed(3)} energy`).join(' · ')}</p>
          <p>Isolated passages: {roadPreviewFrame.droppedPassages.map(row=>
            `${row.riderId} ${row.passageSecondsFromBunchMarker.toFixed(2)} s`
          ).join(' · ')||'none'}</p>
        </>}
      </section>}
      {coasted&&<section className="v91-results" aria-label="V93 coasted race preview">
        <h2>V93 race preview · {coasted.settings.distanceKm} km {coasted.settings.terrain}</h2>
        {resultUsesEarlierChoices&&<p className="v91-warning" role="status">
          You changed the setup after this race. The road, finish and replay
          below still show the previous run. Run the race again to see the
          current choices.</p>}
        <div className="v91-race-story" aria-label="What happened in your race">
          <h3>What happened in your race</h3>
          <ol>{coastedRaceStory.map((moment,index)=><li key={index}>{moment}</li>)}</ol>
          <p>At the line, {coastedOwnDecision?.finisherId??'your finisher'} had a conditional place of {conditionalPlace(coastedOwnPlace,'unresolved')} and {coastedOwnLine?.energyAtLine.toFixed(1)??'—'} of 100 energy remaining. Energy is reserve left after recorded work, not a rider skill or a race time. The order is not an official classification.</p>
        </div>
        <section className="v91-race-viewer" id="v93-race-viewer"
          aria-label="Race viewer">
          <h3>Follow your riders through the race</h3>
          <p>Choose a kilometre to see where the field and your riders were.
            The race is recorded once per kilometre; the final result follows
            the paid finish road where available.</p>
          <button type="button" className="v91-open-race-screen"
            onClick={()=>{
              setCheckpointPlaying(false);setRaceScreenOpen(true);
            }}>
            Open simple race screen
          </button>
          {raceScreenOpen&&viewerSituation&&coastedProfile&&<div
            ref={raceScreenRef}
            className="v91-race-screen" role="dialog" aria-modal="true"
            aria-label="Race screen">
            <div className="v91-race-screen-inner">
              <header className="v91-race-screen-header">
                <div><span>RECORDED RACE</span><h2>Km {coastedKm} <small>/ {
                  viewerSituation.totalKm}</small></h2>
                  <p>{viewerSituation.remainingKm} km to go</p></div>
                <button type="button" onClick={()=>{
                  setRaceScreenPlaying(false);setRaceScreenOpen(false);
                }}>
                  Close race screen</button>
              </header>
              <div className="v91-race-screen-main">
                <section className="v91-race-screen-route"
                  aria-label="Route and race progress">
                  <div className="v91-race-screen-section-head">
                    <h3>Where the race is</h3>
                    <span>Recorded profile · 1 km samples</span>
                  </div>
                  <svg viewBox="0 0 600 145" preserveAspectRatio="none"
                    role="img" aria-label={`Stage profile with the field at km ${coastedKm} of ${viewerSituation.totalKm}`}>
                    <polygon className="v91-race-screen-profile-fill"
                      points={`20,120 ${coastedProfile.points} 580,120`}/>
                    <polyline className="v91-race-screen-profile"
                      points={coastedProfile.points}/>
                    <line className="v91-race-screen-position"
                      x1={20+coastedKm/viewerSituation.totalKm*560}
                      x2={20+coastedKm/viewerSituation.totalKm*560}
                      y1="8" y2="118"/>
                    <circle className="v91-race-screen-field"
                      cx={20+coastedKm/viewerSituation.totalKm*560}
                      cy={raceScreenElevationY} r="7"/>
                  </svg>
                  <div className="v91-race-screen-route-labels">
                    <span>Start</span><strong>Field at km {coastedKm}</strong>
                    <span>Finish · {viewerSituation.totalKm} km</span>
                  </div>
                  <input type="range" min="1"
                    max={coasted.kilometreFrames.length}
                    value={coastedKm}
                    aria-label="Choose recorded kilometre"
                    onChange={event=>selectRecordedKilometre(
                      Number(event.target.value))}/>
                  <div className="v91-race-screen-controls">
                    <button type="button" disabled={coastedKm<=1}
                      onClick={()=>selectRecordedKilometre(coastedKm-1)}>
                      Previous km</button>
                    <button type="button" aria-pressed={raceScreenPlaying}
                      onClick={()=>{
                        if(raceScreenPlaying){
                          setRaceScreenPlaying(false);return;
                        }
                        if(coastedKm>=coasted.kilometreFrames.length)
                          setCoastedKm(1);
                        setRaceScreenPlaying(true);
                      }}>{raceScreenPlaying?'Pause':
                        coastedKm>=coasted.kilometreFrames.length?
                          'Replay':'Play'}</button>
                    <button type="button"
                      disabled={coastedKm>=coasted.kilometreFrames.length}
                      onClick={()=>selectRecordedKilometre(coastedKm+1)}>
                      Next km</button>
                  </div>
                  <p>Play advances one recorded kilometre every 1.2 seconds.
                    All markers use the selected recorded kilometre. Time
                    gaps below are group clocks, not measured road distances.
                    Short climbs may be hidden by the 1 km profile.</p>
                </section>
                <section className="v91-race-screen-story"
                  aria-label="Recent race events">
                  <div className="v91-race-screen-section-head">
                    <h3>Recent events</h3><span>Viewing km {coastedKm}</span>
                  </div>
                  <p>The race keeps moving. Earlier calls remain here to read.</p>
                  {recentRaceCommentary.length?<ol
                    aria-label="Recent commentary history"
                    className="v91-race-screen-events">{
                    recentRaceCommentary.map((moment,index)=><li
                      key={`${moment.index}-${moment.kind}-${index}`}
                      className={moment.km===coastedKm?
                        'v91-race-screen-event-current':''}>
                      <strong>Km {moment.km}{moment.km===coastedKm?
                        ' · Now':''}</strong>
                      <span>{moment.text}</span>
                    </li>)}</ol>:
                    <p>No recorded events yet.</p>}
                  <div className="v91-race-screen-stage">
                    <strong>On the road</strong>
                    <span>{coastedStage?.terrain??'—'} · {
                      coastedStage?.gradientPct.toFixed(1)??'—'}% · {
                      coastedStage?.surface??'—'}</span>
                    <span>Your order: {activeOwnOrder?.effort??'—'} effort
                      {activeOwnOrder?.frontWork==='rotate'?
                        ' · try front work':''}</span>
                  </div>
                </section>
              </div>
              <section className="v91-race-screen-field-summary"
                aria-label="Field positions at selected kilometre">
                <div><strong>{viewerSituation.frontRiders}</strong>
                  <span>ahead in {viewerSituation.frontGroups} {
                    viewerSituation.frontGroups===1?'group':'groups'}</span></div>
                <div><strong>{viewerSituation.bunchRiders}</strong>
                  <span>in the bunch</span></div>
                <div><strong>{viewerSituation.isolatedRiders}</strong>
                  <span>riding alone</span></div>
              </section>
              <section className="v91-race-screen-team" aria-label="Your riders on the road">
                <div className="v91-race-screen-section-head">
                  <h3>Your riders</h3>
                  <span>Energy changes · fatigue is the starting setting</span>
                </div>
                <div className="v91-race-screen-riders">{
                  viewerSituation.own.map(rider=><button type="button"
                    key={rider.riderId}
                    aria-pressed={viewerRiderId===rider.riderId}
                    onClick={()=>setViewerRiderId(rider.riderId)}>
                    <strong>{rider.name.replace(
                      /^Your test team rider /,'Rider ')}</strong>
                    <span>{rider.position}</span>
                    <div><progress value={rider.energy??0} max="100"
                      aria-label={`Energy left for ${rider.name}`}/>
                      <b>{rider.energy?.toFixed(0)??'—'}</b></div>
                    <small>Energy left · starting fatigue {
                      rider.startingFatigue??'—'}</small>
                  </button>)}</div>
              </section>
            </div>
          </div>}
          {viewerSituation&&<div className="v91-race-dashboard"
            aria-label={`Race situation at km ${viewerSituation.km}`}>
            <div className="v91-dashboard-progress">
              <div><span>RACE DISTANCE</span><strong>Km {
                viewerSituation.km} / {viewerSituation.totalKm}</strong></div>
              <span>{viewerSituation.remainingKm} km to go</span>
              <progress value={viewerSituation.km}
                max={viewerSituation.totalKm}
                aria-label="Race distance completed"/>
            </div>
            <div className="v91-dashboard-road" aria-label="Field situation">
              <div><strong>{viewerSituation.bunchRiders}</strong><span>in the bunch</span></div>
              <div><strong>{viewerSituation.frontRiders}</strong><span>ahead in {
                viewerSituation.frontGroups} {
                  viewerSituation.frontGroups===1?'group':'groups'}</span></div>
              <div><strong>{viewerSituation.isolatedRiders}</strong><span>riding alone</span></div>
              {viewerSituation.frontGroups>0&&<p>Leading front group: {
                viewerSituation.leadGapSeconds.toFixed(1)} s ahead of the bunch.</p>}
            </div>
            <div className="v91-commentary-current" aria-live="polite">
              <strong>At km {coastedFrame?.km}</strong>
              {commentaryAtKm.length?<ul>{commentaryAtKm.map((moment,ordinal)=><li
                key={`${moment.kind}-${ordinal}`}>{moment.text}</li>)}</ul>:
                <p>No new headline. The road positions and rider reserves
                  below are the current recorded state.</p>}
            </div>
            <div className="v91-dashboard-team"
              aria-label={`Your riders at km ${viewerSituation.km}`}>
              <div className="v91-dashboard-team-heading"><h4>Your riders</h4>
                <p>Energy left changes during the race. Starting fatigue is
                  the pre-race setting, not a live fatigue reading.</p></div>
              <div className="v91-dashboard-riders">{viewerSituation.own.map(
                rider=><button type="button" key={rider.riderId}
                  aria-pressed={viewerRiderId===rider.riderId}
                  onClick={()=>setViewerRiderId(rider.riderId)}>
                  <span><strong>{rider.name.replace(
                    /^Your test team rider /,'Rider ')}</strong>
                    <small>{rider.position}</small></span>
                  <span className="v91-dashboard-rider-state"><strong>{
                    rider.energy?.toFixed(1)??'—'} / 100</strong>
                    <small>Energy left</small></span>
                  <progress className={rider.energy!=null&&rider.energy<25?
                    'v91-low-energy':''} value={rider.energy??0} max="100"
                    aria-label={`Energy left for ${rider.name}`}/>
                  <small>Starting fatigue: {
                    rider.startingFatigue??'—'}</small>
                </button>)}</div>
            </div>
          </div>}
          <label>Rider to follow<select value={viewerRiderId}
            onChange={event=>setViewerRiderId(event.target.value)}>
            {Array.from({length:8},(_,index)=>`you-${index}`).map(id=><option
              key={id} value={id}>Rider {Number(id.slice(4))+1}{
                id===coastedOwnDecision?.finisherId?' · nominated finisher':
                id===coastedOwnDecision?.leadOutRiderId?' · lead-out helper':''}
            </option>)}</select></label>
          {coastedProfile&&<div className="v91-stage-profile"
            aria-label="Recorded stage elevation profile">
            <svg viewBox="0 0 600 130" preserveAspectRatio="none" role="img"
              aria-label={`Recorded one-kilometre elevation profile. Viewing km ${coastedKm}; order markers at km ${recordedEffortMarkersKm.length?recordedEffortMarkersKm.join(', '):recordedEffortMarkerKm}.`}>
              <polyline points={coastedProfile.points}/>
              {(recordedEffortMarkersKm.length?recordedEffortMarkersKm:
                [recordedEffortMarkerKm]).map(markerKm=><line
                key={markerKm} className="v91-stage-marker"
                x1={20+markerKm/coasted.settings.distanceKm*560}
                x2={20+markerKm/coasted.settings.distanceKm*560}
                y1="12" y2="115"/>)}
              {paidFrontKilometres.map(km=><rect key={`paid-front-${km}`}
                className="v91-stage-paid-front"
                x={20+(km-1)/coasted.settings.distanceKm*560}
                y="119" width={560/coasted.settings.distanceKm}
                height="7"/>)}
              <line className="v91-stage-current"
                x1={20+coastedKm/coasted.settings.distanceKm*560}
                x2={20+coastedKm/coasted.settings.distanceKm*560}
                y1="12" y2="115"/>
            </svg>
            <p>{coastedProfile.minElevationM.toFixed(0)}–{coastedProfile.maxElevationM.toFixed(0)} m recorded elevation · dashed lines: order markers at km {recordedEffortMarkersKm.length?recordedEffortMarkersKm.join(', '):recordedEffortMarkerKm} · solid line: viewing km {coastedKm}. The profile uses one-kilometre samples; short climbs may be hidden.</p>
            <p>Blue strip: {paidFrontRanges.length?
              `your team paid bunch-front work at ${paidFrontRanges.map(range=>
                `km ${range.fromKm}${range.toKm===range.fromKm?'':
                  `–${range.toKm}`}`).join(', ')} (${paidFrontKilometres.length} recorded km)`:
              'no paid bunch-front work by your team'}. An order without paid helpers is not shown as work.</p>
          </div>}
          <div className="v91-energy-view" aria-label={`${viewerRiderId} recorded energy through the race`}>
            <svg viewBox="0 0 600 145" preserveAspectRatio="none" role="img"
              aria-label={`${viewerRiderId} energy by recorded kilometre${
                viewerLine?' and at the line':''}`}>
              <line x1="20" y1="20" x2="580" y2="20"/>
              <line x1="20" y1="70" x2="580" y2="70"/>
              <line x1="20" y1="120" x2="580" y2="120"/>
              <polyline points={viewerEnergyPoints}/>
              {viewerSelectedEnergy&&<circle
                cx={20+(coastedKm-1)/Math.max(1,viewerEnergyCurve.length-1)*560}
                cy={120-viewerSelectedEnergy.energy} r="5"/>}
              {viewerLine&&<circle cx="580"
                cy={120-viewerLine.energyAtLine} r="5"/>}
            </svg>
            <div><span>100</span><span>50</span><span>0</span></div>
          </div>
          <p>{viewerRiderId}: {viewerFiveKm?.energy.toFixed(1)??'—'} energy at 5 km to go · {viewerEnergy.at(-1)?.energy.toFixed(1)??'—'} at 1 km to go · {viewerLine?.energyAtLine.toFixed(1)??'—'} at the line. {viewerLine?'The curve ends at the paid line. ':''}The line is recorded reserve, not speed.</p>
          <div className="v91-viewer-navigation" aria-label="Race checkpoint navigation">
            <button type="button" aria-pressed={checkpointPlaying}
              disabled={!coastedViewer.length}
              onClick={()=>{
                if(checkpointPlaying){setCheckpointPlaying(false);return;}
                if(!nextCheckpoint)
                  setCoastedKm(coastedViewer[0].index+1);
                setCheckpointPlaying(true);
              }}>
              {checkpointPlaying?'Pause checkpoints':
                nextCheckpoint?'Play checkpoints':'Replay checkpoints'}
            </button>
            <button type="button" aria-label="Previous checkpoint"
              disabled={!previousCheckpoint}
              onClick={()=>selectRecordedKilometre(
                previousCheckpoint.index+1)}>Previous</button>
            {(recordedEffortMarkersKm.length?recordedEffortMarkersKm:
              [recordedEffortMarkerKm]).map((markerKm,index)=>{
              const jumpKm=recordedTimedOrders.length?markerKm+1:effortJumpKm;
              return <button type="button" key={markerKm}
                aria-pressed={coastedKm===jumpKm}
                onClick={()=>selectRecordedKilometre(jumpKm)}>
                {recordedTimedOrders.length?
                  'First km after order marker '+markerKm:
                  index===0?'5 km order handoff':'Order marker '+markerKm}
              </button>;
            })}
            <button type="button" aria-pressed={
              coastedKm===coasted.settings.distanceKm-1}
              onClick={()=>selectRecordedKilometre(
                coasted.settings.distanceKm-1)}>
              1 km road</button>
            <span>Viewing km {coastedFrame?.km} of {coasted.settings.distanceKm} · swipe cards for more</span>
            <button type="button" aria-label="Next checkpoint"
              disabled={!nextCheckpoint}
              onClick={()=>selectRecordedKilometre(
                nextCheckpoint.index+1)}>Next</button>
          </div>
          <p>Playback advances through recorded checkpoints every 1.8 seconds,
            including every recorded attack, break join and catch by your riders.
            It does not simulate motion between checkpoints. Selecting a
            checkpoint pauses playback.</p>
          <div className="v91-moment-jumps" aria-label="Recorded change navigation">
            <button type="button" disabled={!previousViewerMoment}
              onClick={()=>selectRecordedKilometre(previousViewerMoment.km)}>
              Previous recorded change{previousViewerMoment?
                `: km ${previousViewerMoment.km}`:''}
            </button>
            <button type="button" disabled={!nextViewerMoment}
              onClick={()=>selectRecordedKilometre(nextViewerMoment.km)}>
              Next recorded change{nextViewerMoment?
                `: km ${nextViewerMoment.km}`:''}
            </button>
            <span>Jumps between recorded attacks, road changes, chase changes and race boundaries.</span>
          </div>
          <div className="v91-viewer-track" ref={viewerTrackRef}>{coastedViewer.map(checkpoint=><button
            type="button" key={checkpoint.index}
            data-checkpoint-index={checkpoint.index}
            aria-pressed={coastedKm===checkpoint.index+1}
            onClick={()=>selectRecordedKilometre(checkpoint.index+1)}>
            <strong>Km {checkpoint.km}</strong>
            <span>{checkpoint.position}</span>
            <span>{checkpoint.energy?.toFixed(1)??'—'} / 100 energy</span>
            <small>{checkpoint.moments.length?
              checkpoint.moments.join(' · '):
              `${checkpoint.frontCount} groups ahead${checkpoint.chasing?' · your team chased':''}`}</small>
          </button>)}</div>
          {coastedStage&&<div className="v91-viewer-road"
            aria-label={'Stage and orders at km '+coastedKm}>
            <h4>Stage, orders and recorded actions</h4>
            <p>Stage input at km {coastedKm}: {coastedStage.terrain}
              {' '}{coastedStage.gradientPct>=0?'+':''}{coastedStage.gradientPct.toFixed(1)}% gradient
              · {coastedStage.surface} surface
              · {coastedStage.exposed?'exposed road':'sheltered road'}
              · {coastedStage.weather.windKph.toFixed(1)} km/h wind
              · {coastedStage.weather.rainMm.toFixed(2)} mm rain
              · {coastedStage.weather.temperatureC.toFixed(1)} °C.
            </p>
            {activeOwnOrder&&<p>Your active order: {activeOwnOrder.effort} effort
              · {activeOwnOrder.attack} attack
              · {activeOwnOrder.chase} chase
              · {activeOwnOrder.frontWork==='rotate'?
                'try bunch-front work':'sit in'}
              {activeOwnPhase?' (changed at km '+activeOwnPhase.atKm+')':
                ' (starting order)'}.
            </p>}
            <p>Actual bunch-front work this kilometre: {
              coastedFrame?.paidBunchPaceTeamId==='you'?
                `your team set the pace with ${
                  coastedFrame.paidBunchPaceRiderIds?.join(' and ')??
                  'paid helpers'}`:
                coastedFrame?.paidBunchPaceTeamId?
                  `${coastedFrame.paidBunchPaceTeamId} set the pace`:
                  'no team recorded a paid pace pair'}.
            </p>
            <p>Paid front work identifies riders who spent energy at the front.
              It does not by itself prove that the bunch accelerated; compare
              the recorded road groups and rider energy.</p>
            {coastedFrame?.attackAttempts&&coastedFrame?.joinedRiderIds&&
              coastedFrame?.caughtRiderIds&&coastedFrame?.engagedChaseTeamIds?
              <p>Recorded this kilometre: {coastedFrame.attackAttempts.length}
                {' '}attack attempts · {coastedFrame.joinedRiderIds.length}
                {' '}break joins · {coastedFrame.caughtRiderIds.length}
                {' '}catches · {coastedFrame.engagedChaseTeamIds.includes('you')?
                  'your team engaged the chase':'no new chase engagement by your team'}.
              </p>:
              <p>Detailed actions are unavailable for this versioned recording.</p>}
            {viewerSelectedAction&&<p aria-label="Followed rider actions at this kilometre">
              {viewerSelectedAction.riderId}: {
                viewerSelectedAction.events.join(' · ')}.
              {' '}Recorded road: {viewerSelectedAction.road}.
              {viewerSelectedAction.energyChange!==null&&
                ` Energy change since the previous kilometre: ${
                  viewerSelectedAction.energyChange>0?'+':''}${
                  viewerSelectedAction.energyChange.toFixed(1)}.`}
            </p>}
            {viewerOwnActions.length>0&&<details className="v91-rider-actions">
              <summary>Actions and energy for all {viewerOwnActions.length} of your riders at km {coastedKm}</summary>
              <ul>{viewerOwnActions.map(row=><li key={row.riderId}>
                <button type="button" aria-pressed={viewerRiderId===row.riderId}
                  onClick={()=>setViewerRiderId(row.riderId)}>
                  Follow {row.riderId}
                </button>{row.events.join(' · ')}
                {' '}· {row.road} · {row.energy.toFixed(1)} energy
                {row.energyChange!==null&&` (${row.energyChange>0?'+':''}${
                  row.energyChange.toFixed(1)} since the previous kilometre)`}
              </li>)}</ul>
            </details>}
            {viewerCheckpointChange&&<div aria-label={
              `Recorded change from km ${viewerCheckpointChange.fromKm} to ${viewerCheckpointChange.toKm}`}>
              <h5>Since the previous kilometre</h5>
              <p>Front groups: {viewerCheckpointChange.before.frontGroups} → {
                viewerCheckpointChange.after.frontGroups} · riders ahead: {
                viewerCheckpointChange.before.frontRiders} → {
                viewerCheckpointChange.after.frontRiders} · isolated behind: {
                viewerCheckpointChange.before.isolatedRiders} → {
                viewerCheckpointChange.after.isolatedRiders}.</p>
              <p>{viewerRiderId}: {viewerCheckpointChange.rider.roadBefore} → {
                viewerCheckpointChange.rider.roadAfter}; energy {
                viewerCheckpointChange.rider.energyBefore.toFixed(1)} → {
                viewerCheckpointChange.rider.energyAfter.toFixed(1)} ({
                viewerCheckpointChange.rider.energyChange>0?'+':''}{
                viewerCheckpointChange.rider.energyChange.toFixed(1)}).</p>
              {viewerCheckpointChange.ownRoadTransitions.length>0&&
                <details className="v91-rider-actions">
                  <summary>{viewerCheckpointChange.ownRoadTransitions.length} of your riders changed road band</summary>
                  <ul>{viewerCheckpointChange.ownRoadTransitions.map(row=><li
                    key={row.riderId}>{row.riderId}: {row.roadBefore} → {
                      row.roadAfter}</li>)}</ul>
                </details>}
              <p>These are two recorded checkpoints, not a continuous wheel trace or proof of cause.</p>
            </div>}
            <p>{viewerRiderId} has {viewerCurrentEnergy?.toFixed(1)??'—'}
              {' '}energy at this checkpoint{previousOwnEnergy!=null&&
                viewerCurrentEnergy!=null?
                ' ('+(viewerCurrentEnergy-previousOwnEnergy).toFixed(1)+' since km '+(coastedKm-1)+')':''}.
              {' '}These are recorded inputs and actions; they do not prove that
              one condition caused a road change. Route conditions here are
              simulated for this test race, not measured stage weather.
              The current overlay uses one-kilometre segments and does not
              identify shorter climbs or stage landmarks.
            </p>
          </div>}
          <div className="v91-viewer-commentary" aria-label="Race commentary">
            <h4>Race commentary</h4>
            <p>Commentary follows recorded actions and checkpoints. An order is
              a plan; the road and rider energy show what followed. Replaying
              this race keeps the same wording and sequence.</p>
            <ol>{[...viewerCommentary.slice(0,5),
              ...(viewerCommentary.length>10?viewerCommentary.slice(-5):
                viewerCommentary.slice(5))].map((moment,ordinal)=><li
              key={`${moment.index}-${moment.kind}-${ordinal}`}>
              <button type="button" onClick={()=>selectRecordedKilometre(
                moment.index+1)} aria-pressed={coastedKm===moment.index+1}>
                <strong>Km {moment.km}</strong><span>{moment.text}</span>
              </button>
            </li>)}</ol>
            {viewerCommentary.length>10&&<details><summary>Read all {
              viewerCommentary.length} commentary lines</summary>
              <ol>{viewerCommentary.map((moment,ordinal)=><li
                key={`${moment.index}-${moment.kind}-${ordinal}`}>
                <button type="button" onClick={()=>selectRecordedKilometre(
                  moment.index+1)} aria-pressed={coastedKm===moment.index+1}>
                  <strong>Km {moment.km}</strong><span>{moment.text}</span>
                </button>
              </li>)}</ol>
            </details>}
          </div>
          <div className="v91-viewer-timeline" aria-label="Recorded race timeline">
            <h4>How the race unfolded</h4>
            <p>These are recorded attacks, joins, catches, chase changes and road changes. Select a moment to inspect its road; a changing group alone does not prove a catch.</p>
            <ol>{[...viewerTimeline.slice(0,5),
              ...(viewerTimeline.length>10?viewerTimeline.slice(-5):
                viewerTimeline.slice(5))].map(moment=><li
                key={moment.finaleRoadIndex!=null?`final-${moment.finaleRoadIndex}`:moment.index}>
              <button type="button" onClick={()=>selectViewerMoment(moment)}
                aria-pressed={moment.finaleRoadIndex!=null?
                  coastedRoadIndex===moment.finaleRoadIndex:
                  coastedKm===moment.index+1}>
                <strong>Km {moment.km}</strong>
                <span>{moment.messages.join(' · ')}</span>
              </button>
            </li>)}</ol>
            {viewerTimeline.length>10&&<details><summary>Show all {viewerTimeline.length} recorded moments</summary>
              <ol>{viewerTimeline.map(moment=><li
                key={moment.finaleRoadIndex!=null?`final-${moment.finaleRoadIndex}`:moment.index}>
                <button type="button" onClick={()=>selectViewerMoment(moment)}>
                  <strong>Km {moment.km}</strong> · {moment.messages.join(' · ')}
                </button>
              </li>)}</ol>
            </details>}
          </div>
          <div className="v91-viewer-road" aria-label={`Road groups at km ${coastedFrame?.km}`}>
            <h4>Road at km {coastedFrame?.km}</h4>
            <p>Groups are ordered from front to back at this recorded checkpoint. Gaps are measured against the bunch.</p>
            {viewerRiderRoad&&<p aria-label="Followed rider at this checkpoint">
              Following {viewerRiderId}: {viewerRiderRoad.label.toLowerCase()},
              {' '}{viewerRiderRoad.gapSeconds>0?
                `${viewerRiderRoad.gapSeconds.toFixed(1)} s ahead of the bunch`:
                viewerRiderRoad.gapSeconds<0?
                  `${Math.abs(viewerRiderRoad.gapSeconds).toFixed(1)} s behind the bunch`:
                  'with the bunch'} · {viewerCurrentEnergy?.toFixed(1)??'—'} energy left.
            </p>}
            <p>Recorded time-gap diagram, scaled to the largest gap at this checkpoint. It shows group clocks, not road distance or wheel order.</p>
            <div className="v91-road-gap-diagram" aria-label={`Recorded time gaps at km ${coastedFrame?.km}`}>
              {viewerRoad.map(band=><div
                className={`v91-road-gap-row${band.key===viewerRiderRoad?.key?' v91-road-gap-followed':''}`}
                key={band.key}
                role={band.key===viewerRiderRoad?.key?'group':undefined}
                aria-label={band.key===viewerRiderRoad?.key?`Following ${viewerRiderId} in ${band.label}`:undefined}>
                <span title={band.label}>{band.key.startsWith('solo:')?
                  band.key.slice(5):band.label.replace('Front group ','Group ')}</span>
                <div className="v91-road-gap-track" aria-hidden="true">
                  {band.gapSeconds===0?<i className="v91-road-gap-bunch"/>:
                    <i className={band.gapSeconds>0?'v91-road-gap-ahead':'v91-road-gap-behind'}
                      style={{width:`${Math.abs(band.gapSeconds)/viewerMaxAbsGap*45}%`}}/>}
                </div>
                <small>{band.gapSeconds>0?`+${band.gapSeconds.toFixed(1)} s`:
                  band.gapSeconds<0?`${band.gapSeconds.toFixed(1)} s`:'bunch'}</small>
              </div>)}
            </div>
            <ol>{viewerRoad.map(band=><li key={band.key}>
              <strong>{band.label}</strong>
              <span>{band.riderCount} {band.riderCount===1?'rider':'riders'} · {band.gapSeconds>0?
                `${band.gapSeconds.toFixed(1)} s ahead`:band.gapSeconds<0?
                `${Math.abs(band.gapSeconds).toFixed(1)} s behind`:'with the bunch'}</span>
              {band.ownRiderIds.length>0&&<small>Your riders: {band.ownRiderIds.join(', ')}</small>}
            </li>)}</ol>
          </div>
          <div className="v91-viewer-road" aria-label="Selected rival manager">
            <h4>Follow a rival manager</h4>
            <p>Choose a team to connect its orders with its recorded riders and actions at this kilometre.</p>
            <label>Rival team<select value={viewerRivalId}
              onChange={event=>setViewerRivalId(event.target.value)}>
              {Array.from({length:coasted.settings.teamCount-1},(_,index)=>
                `rival-${index+1}`).map(id=><option key={id} value={id}>
                {id}</option>)}</select></label>
            {viewerRival&&<div aria-label={`${viewerRival.teamId} at km ${coastedFrame?.km}`}>
              <p>Starting orders: {viewerRival.orders?.effort??'unavailable'} effort · {viewerRival.orders?.attack??'unavailable'} attacks · {viewerRival.orders?.chase??'unavailable'} chase.</p>
              {viewerRivalPhases.length>0&&<p>Precommitted effort changes: {
                viewerRivalPhases.filter(phase=>phase.effort).map(phase=>
                  phase.effort+' after km '+phase.atKm).join(' · ')||
                  'none'}.</p>}
              <p>Active effort at km {coastedKm}: {
                viewerRivalActivePhase?.effort??viewerRival.orders?.effort??
                  'unavailable'}.</p>
              <p>{viewerRival.finisherId}: {viewerRival.finisherRoad}. At this checkpoint, {viewerRival.frontCount} riders are ahead, {viewerRival.bunchCount} in the bunch and {viewerRival.droppedCount} behind.</p>
              <p>This kilometre: {viewerRival.attacks.length} attack attempts · {viewerRival.joins.length} break joins · {viewerRival.catches.length} caught · {viewerRival.pulls.length} riders taking pulls · {viewerRival.chased?'team chased':'team did not chase'}.</p>
              <p>Whole-kilometre record: chased {viewerRival.wholeRaceChaseKm} km · first attack {viewerRival.firstAttackKm===null?'none':`km ${viewerRival.firstAttackKm}`} · first break join {viewerRival.firstJoinKm===null?'none':`km ${viewerRival.firstJoinKm}`} · last recorded catch {viewerRival.lastCatchKm===null?'none':`km ${viewerRival.lastCatchKm}`}.</p>
              {viewerRival.chasePeriods.length>0&&<div>
                <p>Recorded chase stretches for {viewerRivalId}; select one to inspect the road at its start:</p>
                <ul>{viewerRival.chasePeriods.map(period=><li
                  key={period.startIndex}>
                  <button type="button" onClick={()=>selectRecordedKilometre(
                    period.startIndex+1)}>Km {period.startKm}{
                    period.endKm!==period.startKm?`–${period.endKm}`:''}
                  </button>
                </li>)}</ul>
              </div>}
              {viewerRivalBreaks.length>0&&<div aria-label={`${viewerRivalId} breakaway outcomes`}>
                <p>Recorded attack and breakaway riders:</p>
                <ul>{viewerRivalBreaks.map(row=><li key={row.riderId}>
                  <strong>{row.riderId}</strong>: {row.events.join(' · ')}. Outcome: {row.fate}. With 1 km to go: {row.atOneKm}.
                </li>)}</ul>
              </div>}
              {viewerRival.lineEnergy!==null&&<p>{viewerRival.finisherId} had {viewerRival.lineEnergy.toFixed(1)} energy at the conditional line. This is recorded reserve, not an official placing.</p>}
            </div>}
          </div>
          <div className="v91-viewer-breaks" aria-label="Breakaways and chase">
            <h4>Breakaways and chase</h4>
            <p>Your team chased in {viewerBreaks?.ownChaseKm??0} recorded kilometres; at least one rival chased in {viewerBreaks?.rivalChaseKm??0}. These counts describe the recorded road, not a guarantee that a break was caught.</p>
            {viewerBreaks?.riders.length?<ul>{viewerBreaks.riders.map(row=><li
              key={row.riderId}><strong>{row.riderId}</strong>: {' '}
              {row.events.join(' · ')}. <strong>Outcome:</strong> {row.fate}.
              {' '}With 1 km to go: {row.atOneKm}.
              {' '}<button type="button" onClick={()=>{
                setViewerRiderId(row.riderId);
                selectRecordedKilometre(row.firstKm);
                document.querySelector('.v91-race-viewer')?.scrollIntoView();
              }}>Follow {row.riderId} from km {row.firstKm}</button>
            </li>)}</ul>:<p>No attack, breakaway join or catch was recorded for your team.</p>}
          </div>
          {viewerFinale&&<div className="v91-viewer-finale"
            aria-label="Your rider's final kilometre">
            <h4>From 1 km to the line</h4>
            <div>
              <p><strong>1 km to go</strong><span>{viewerFinale.atOneKmEnergy?.toFixed(1)??'—'} energy remaining</span></p>
              <p><strong>500 m to go</strong><span>{viewerFinale.at500Energy?.toFixed(1)??'—'} energy remaining{viewerFinale.at500Role?` · ${viewerFinale.at500Role.replaceAll('_',' ')}`:''}</span></p>
              <p><strong>Finish</strong><span>{viewerFinale.atLineEnergy?.toFixed(1)??'—'} energy remaining · conditional place {conditionalPlace(viewerPlace,'unresolved')}</span></p>
            </div>
            <p>{viewerFinale.at500Energy===null?
              'No paid 500 m rider state is available in this recording.':
              'The 500 m and finish states come from this rider’s paid replay.'} Official results and awards remain withheld.</p>
            {viewerFinale.roadBandId&&<button type="button" onClick={()=>{
              setCoastedBandId(viewerFinale.roadBandId);
              setCoastedRiderId(viewerRiderId);
              setCoastedBandIndex(0);
              document.getElementById('v93-paid-finale-replay')
                ?.scrollIntoView();
            }}>Inspect this rider&apos;s detailed finale replay</button>}
          </div>}
        </section>
        <details className="v91-technical"><summary>Engine status and recording details</summary>
        <p>{coasted.tuningVersion} · {coasted.settings.managerTactics.length+
          (coasted.settings.managerTacticOverrides?.length??0)} custom rival managers · {' '}
          {coasted.sharedWheelContact?
            'paid shared-road contact and photo-finish ranges':
            coasted.isolatedLaneEncounters?.length?
              'paid independent lanes for isolated riders through the final kilometre':
            coasted.roadStatus}</p>
        <p>Conditional individual line: {coasted.lineTimes.length} riders. Official results and points are withheld.</p></details>
        <nav className="v91-result-nav" aria-label="Explore this race">
          <a href="#v93-your-finish">Your finish</a>
          <a href="#v93-recorded-road">Recorded road</a>
          <a href="#v93-conditional-results">Individual results</a>
          <a href="#v93-paid-finale-replay">Rider replay</a>
        </nav>
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
        {coastedOwnDecision&&<section className="v91-finish" id="v93-your-finish" aria-label="Your v93 finish">
          <h3>Your finish</h3>
          <p>Nominated finisher: {coastedOwnDecision.finisherId} ·
            {' '}{coastedOwnLine?.roadBandId??'no paid road band'} ·
            {' '}{coastedOwnLine?.elapsedSecondsFromLastKmStart.toFixed(3)??'—'} s
            from the bunch&apos;s final-kilometre marker ·
            {' '}{coastedOwnLine?.energyAtLine.toFixed(1)??'—'} of 100 energy remaining.</p>
          <p>The seconds are measured from when the bunch reached the 1 km marker; they are not the rider&apos;s total race time. Riders already ahead can cross sooner on this shared clock.</p>
          {coasted.unlaunchedSoloSprints?.some(row=>
            row.riderId===coastedOwnDecision.finisherId)&&
            <p>The nominated rider lacked energy for the full solo sprint
              and followed their recorded road to the line.</p>}
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
              key={frame.km} onClick={()=>selectRecordedKilometre(index+1)}
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
              key={frame.km} onClick={()=>selectRecordedKilometre(index+1)}
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
            value={coastedKm} onChange={event=>selectRecordedKilometre(
              Number(event.target.value))}/>
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
          <h3 id="v93-recorded-road">Recorded final-kilometre road</h3>
          {coasted.sharedWheelContact&&<p role="note"
            aria-label="Paid shared wheel contact">
            {coasted.sharedWheelContact.roadGroupId} met the bunch at {' '}
            {(coasted.sharedWheelContact.atDistanceM/1000).toFixed(3)} km
            {' '}after {coasted.sharedWheelContact.elapsedSecondsFromLastKmStart
              .toFixed(2)} s. {' '}
            {coasted.sharedWheelContact.wheelPairs.length} same-lane wheel
            {' '}pairs met at the 2.5 m spacing.
            {coasted.sharedWheelContact.phase==='paid_final_500m_sprint'?
              ' The separate sprint paths are paid to that contact; the merged road, remaining sprint, individual energy and line crossings continue on one clock.':
              ' The merged road, sprint, individual energy and line crossings are paid on one clock.'}
            {' '}Inferred lanes leave some photo finishes tied, so official
            {' '}places and points are withheld.
          </p>}
          {coasted.frontCatch&&<p role="note" aria-label="Paid front catch">
            {coasted.frontCatch.roadGroupId} ({coasted.frontCatch.caughtRiderIds.length}
            {' '}riders) joined the bunch at {' '}
            {(coasted.frontCatch.atDistanceM/1000).toFixed(3)} km,
            {' '}after {coasted.frontCatch.elapsedSecondsFromLastKmStart.toFixed(2)} s
            {' '}of paid final-kilometre travel. Their individual paths continue
            {' '}in the line and replays.
            {coasted.frontCatch.inferredLaneQueue?
              coasted.frontCatch.isolatedContactResolved?
                ' Inferred lanes keep the front and bunch wheels apart at the catch. Isolated riders continue in separate outside lanes after the active field finishes. The conditional place order retains exact ties; policy points are withheld.':
                ' Inferred lanes keep the front and bunch wheels apart at the catch. Isolated rider contact and point order remain unresolved, so points are withheld.':
              ' Their order within the bunch remains unresolved, so points are withheld.'}
          </p>}
          {coasted.dissolvedFront&&<p role="note"
            aria-label="Paid front dissolution">
            {coasted.dissolvedFront.riderIds.length} exhausted riders left
            {' '}{coasted.dissolvedFront.fromRoadGroupId} at
            {' '}{(coasted.dissolvedFront.atDistanceM/1000).toFixed(3)} km.
            Their separate outside lanes have paid travel and energy through
            the line. The remaining front group and bunch stayed apart; the
            finish order and policy points below are conditional only.
          </p>}
          {coasted.lateExitShoulder&&<div role="note"
            aria-label="Paid late bunch exits">
            <p>{coasted.lateExitShoulder.assignments.length} exhausted riders
              {' '}left the bunch for separate outside lanes after the 500 m
              {' '}handoff. Their time and energy are paid to the line. Equal
              {' '}solo clocks still have no recorded place order, so official
              {' '}results and points remain withheld.</p>
            {coasted.lateExitShoulder.assignments.map(row=><p
              key={row.riderId}>{row.riderId} left at {' '}
              {(row.atDistanceM/1000).toFixed(3)} km · {' '}
              {row.passages.at(-1).secondsBehindBunch.toFixed(2)} s behind
              {' '}the bunch at the line. {' '}
              <button type="button"
                aria-label={`Inspect late exit rider ${row.riderId} finale replay`}
                onClick={()=>{
                  const band=coasted.bandReplays.find(value=>
                    value.id===`isolated:${row.riderId}`);
                  setCoastedBandId(band.id);setCoastedRiderId(row.riderId);
                  setCoastedBandIndex(band.frames.length-1);
                  document.getElementById('v93-paid-finale-replay')
                    ?.scrollIntoView();
                }}>Inspect finish replay</button>
            </p>)}
          </div>}
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
              {band.id}{band.mergedIntoRoadBandId&&
                band.id!==band.mergedIntoRoadBandId?
                ` → ${band.mergedIntoRoadBandId}`:''}
              {' '}· {band.riderIds.length} riders</option>)}
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
          <h3 id="v93-conditional-results">Individual conditional results</h3>
          {coasted.exhaustedTail?.length>0&&<div role="note"
            aria-label="Exhausted tail finish">
            <p>Exhausted riders slowed in their final metres. Their remaining
              energy and the curtailed work are recorded in the rider replay;
              official points remain withheld.</p>
            {coasted.exhaustedTail.map(row=><p key={row.riderId}>
              {row.riderId}: slowed after {' '}
              {(row.fromDistanceM/1000).toFixed(3)} km ·
              {' '}{row.curtailedEnergyDemand.toFixed(3)} curtailed energy demand ·
              {' '}crossed at {row.elapsedSecondsFromLastKmStart.toFixed(3)} s.
            </p>)}
          </div>}
          <label>Results team<select value={resultsTeam}
            onChange={event=>setResultsTeam(event.target.value)}>
            <option value="all">All teams ({coastedOrder.length} riders)</option>
            {Array.from({length:coasted.settings.teamCount},(_,index)=>
              index===0?'you':`rival-${index}`).map(teamId=><option
                value={teamId} key={teamId}>
                {teamId==='you'?'Your team':teamId}
              </option>)}
          </select></label>
          {coasted.frontExit&&<div role="note"
            aria-label="Recorded front exit">
            <p>{coasted.frontExit.exitRiderIds.length} exhausted riders left
              {' '}{coasted.frontExit.fromRoadGroupId} at
              {' '}{(coasted.frontExit.exitDistanceM/1000).toFixed(3)} km.
              They took an outside lane while the remaining
              {' '}{coasted.frontExit.frontRiderCount} front riders passed.
              The paid paths give no draft or free energy; the last front
              wheel was clear by 250 m.</p>
            {coasted.frontExit.clearance.map(row=><p key={row.riderId}>
              {row.riderId}: front clearance at 250 m
              {' '}{row.frontClearanceSecondsAt250.toFixed(2)} s.
              <button type="button"
                aria-label={`Inspect front exit rider ${row.riderId} finish replay`}
                onClick={()=>{
                  setCoastedBandId(`isolated:${row.riderId}`);
                  setCoastedRiderId(row.riderId);setCoastedBandIndex(0);
                  document.getElementById('v93-paid-finale-replay')
                    ?.scrollIntoView();
                }}>Finish replay {row.riderId}</button>
            </p>)}
          </div>}
          {coasted.post500OutsideLanePasses?.length>0&&<div role="note"
            aria-label="Conditional post-500 m outside-lane passes">
            <p>After the 500 m handoff, former front riders approached
              {' '}road-2. Each kept its separately paid speed and energy in
              {' '}an inferred outside lane, without draft. These are exact
              {' '}first individual wheel-spacing approaches, not the earlier
              {' '}group-marker crossings. The road boundaries below use paid
              {' '}individual passages; a group time is its first rider's
              {' '}passage. Wheel order, official places and points remain
              {' '}unresolved.</p>
            {coasted.post500OutsideLanePasses.map(event=><p
              key={event.isolatedRiderId}>
              {event.isolatedRiderId} approached
              {' '}{event.activeRiderId} of {event.roadGroupId} at
              {' '}{(event.atDistanceM/1000).toFixed(3)} km.
              <button type="button"
                aria-label={`Inspect post-500 outside-lane rider ${
                  event.isolatedRiderId} finish replay`}
                onClick={()=>{
                  const band=coasted.bandReplays.find(row=>
                    row.id===`isolated:${event.isolatedRiderId}`);
                  setCoastedBandId(band.id);
                  setCoastedRiderId(event.isolatedRiderId);
                  setCoastedBandIndex(band.frames.length-1);
                  document.getElementById('v93-paid-finale-replay')
                    ?.scrollIntoView();
                }}>Inspect finish replay</button>
            </p>)}
          </div>}
          {coasted.straddlingOutsideLaneApproaches?.length>0&&
            <div role="note" aria-label="Conditional straddling outside lanes">
              <p>Seven former front riders first came within one wheel
                {' '}spacing of road-2 before the 500 m handoff. Four group
                {' '}marker crossings happened later; those markers are not
                {' '}individual contacts. Each departing rider keeps a
                {' '}separately paid, inferred outside lane without draft.
                {' '}The 500 m handoff, rider energy and conditional finish
                {' '}are recorded, but occupied wheel order, official places
                {' '}and points remain unresolved.</p>
              {coasted.straddlingOutsideLaneApproaches.map(event=><p
                key={event.isolatedRiderId}>
                {event.isolatedRiderId} approached {event.activeRiderId}
                {' '}at {(event.atDistanceM/1000).toFixed(3)} km.
                <button type="button"
                  aria-label={`Inspect straddling outside-lane rider ${
                    event.isolatedRiderId} finish replay`}
                  onClick={()=>{
                    const band=coasted.bandReplays.find(row=>
                      row.id===`isolated:${event.isolatedRiderId}`);
                    setCoastedBandId(band.id);
                    setCoastedRiderId(event.isolatedRiderId);
                    setCoastedBandIndex(band.frames.length-1);
                    document.getElementById('v93-paid-finale-replay')
                      ?.scrollIntoView();
                  }}>Inspect finish replay</button>
              </p>)}
            </div>}
          {coasted.mixedTwoFrontOlderDrops&&<div role="note"
            aria-label="Conditional two-front exits with older drops">
            <p>Riders left {Array.from(new Set(coasted.mixedTwoFrontOlderDrops
              .formerFrontLeavers.map(row=>row.fromRoadGroupId)))
              .join(' and ')} at the final-kilometre
              {' '}boundary, while
              {' '}{coasted.mixedTwoFrontOlderDrops.olderDroppedRiderIds.length}
              {' '}older dropped riders remained behind the bunch. The
              {' '}departing and older isolated riders use
              {' '}{coasted.mixedTwoFrontOlderDrops.inferredOutsideLaneCount}
              {' '}distinct inferred outside lanes without draft. Paid
              {' '}individual movement and energy are checked through the
              {' '}500 m handoff and finish. Possible wheel proximities stay
              {' '}within their original groups; occupied wheel order,
              {' '}official places and points remain unresolved.</p>
            {coasted.mixedTwoFrontOlderDrops.freshWheelApproaches?.length>0&&
              <details><summary>{coasted.mixedTwoFrontOlderDrops
                .freshWheelApproaches.length} possible individual approach
                {coasted.mixedTwoFrontOlderDrops.freshWheelApproaches.length===
                  1?' is':'es are'} recorded (
                {coasted.mixedTwoFrontOlderDrops.freshWheelApproaches
                  .filter(row=>row.handoffPhase==='before_500m').length}
                {' '}before and
                {' '}{coasted.mixedTwoFrontOlderDrops.freshWheelApproaches
                  .filter(row=>row.handoffPhase==='after_500m').length}
                {' '}after the 500 m handoff)</summary>
                <p>Movement and energy are paid at each wheel-spacing
                  {' '}approach. An approach does not confirm a catch: the
                  {' '}outside-lane response and crossing order remain
                  {' '}conditional.</p>
                <ul>{coasted.mixedTwoFrontOlderDrops.freshWheelApproaches
                  .map((row,index)=><li key={`${row.firstRiderId}:${
                    row.secondRiderId}:${index}`}>
                    {row.firstRiderId} approached {row.secondRiderId} at
                    {' '}{(row.atDistanceM/1000).toFixed(3)} km
                    {' '}in {row.sourceRoadGroupId??'its source group'},
                    {' '}{row.handoffPhase==='after_500m'?'after':'before'}
                    {' '}the 500 m handoff.
                    <button type="button" aria-label={`Inspect ${
                      row.firstRiderId} finish replay after approaching ${
                      row.secondRiderId} at ${
                      (row.atDistanceM/1000).toFixed(3)} km`}
                    onClick={()=>{
                      const band=coasted.bandReplays.find(entry=>
                        entry.riderIds.includes(row.firstRiderId));
                      if(!band)return;
                      setCoastedBandId(band.id);
                      setCoastedRiderId(row.firstRiderId);
                      setCoastedBandIndex(band.frames.length-1);
                      document.getElementById('v93-paid-finale-replay')
                        ?.scrollIntoView();
                    }}>Inspect finish replay</button>
                  </li>)}</ul>
              </details>}
            {coasted.mixedTwoFrontOlderDrops.parallelFinalLaneEvidence&&
              <p>The final close approach between
                {' '}{coasted.mixedTwoFrontOlderDrops
                  .parallelFinalLaneEvidence.firstRiderId} and
                {' '}{coasted.mixedTwoFrontOlderDrops
                  .parallelFinalLaneEvidence.secondRiderId} runs in
                {' '}different fixed source lanes. Both riders&apos; movement
                {' '}and energy are paid to the line without drafting after
                {' '}that approach. Earlier outside-lane responses remain
                {' '}conditional, so no official placing or points follow.</p>}
          </div>}
          {coasted.mixedFrontLeavers&&<div role="note"
            aria-label="Mixed front exits">
            <p>At {(coasted.mixedFrontLeavers.sourceDistanceM/1000)
              .toFixed(3)} km, {coasted.mixedFrontLeavers.leadingRiderIds.length}
              {' '}riders left {coasted.mixedFrontLeavers.leadingGroupId} and
              stayed ahead. {coasted.mixedFrontLeavers.rearRiderIds.length}
              {' '}left {coasted.mixedFrontLeavers.rearGroupId} and
              {' '}{coasted.mixedFrontLeavers.rearStayedAhead?
                'stayed ahead of the bunch.':'were passed by the bunch.'}
              {coasted.mixedFrontLeavers.thirdGroupId&&<>
                {' '}The separate {coasted.mixedFrontLeavers.thirdGroupId}
                {' '}remained ahead of the bunch.</>}
              {coasted.mixedFrontLeavers.olderDroppedRiderIds?.length>0&&<>
                {' '}{coasted.mixedFrontLeavers.olderDroppedRiderIds.length}
                {' '}earlier isolated riders stayed behind the bunch.</>}
              {' '}Their individual travel, energy and
              finish replays are recorded; their places and points remain
              unresolved.</p>
            {coasted.mixedFrontLeavers.frontPasses?.length>0&&<p>
              {coasted.mixedFrontLeavers.rearGroupId} passed
              {' '}{coasted.mixedFrontLeavers.frontPasses.length} former
              front riders on separate inferred outside lanes before the
              500 m handoff. Their paid
              road times and energy meet at the recorded pass markers;
              wheel order remains unresolved.
            </p>}
            {coasted.mixedFrontLeavers.frontPasses?.map(event=><p
              key={event.riderId}>
              {event.groupId} passed {event.riderId} at
              {' '}{(event.atDistanceM/1000).toFixed(3)} km.
            </p>)}
            {coasted.mixedFrontLeavers.bunchPasses.length===2&&
              coasted.mixedFrontLeavers.bunchPasses[0].distanceM===
                coasted.mixedFrontLeavers.bunchPasses[1].distanceM&&
              <p>Both riders were passed at the same point. Their wheel
                order remains unresolved.</p>}
            {coasted.mixedFrontLeavers.bunchPasses.map(event=><p
              key={event.riderId}>
              The bunch passed {event.riderId} at
              {' '}{(event.distanceM/1000).toFixed(3)} km.
            </p>)}
            {[...coasted.mixedFrontLeavers.leadingRiderIds,
              ...coasted.mixedFrontLeavers.rearRiderIds].map(id=><button
              type="button" key={id}
              aria-label={`Inspect mixed front exit rider ${id} finish replay`}
              onClick={()=>{
                setCoastedBandId(`isolated:${id}`);
                setCoastedRiderId(id);setCoastedBandIndex(0);
                document.getElementById('v93-paid-finale-replay')
                  ?.scrollIntoView();
              }}>Finish replay {id}</button>)}
          </div>}
          {coasted.dissolvedLeadingFront&&<div role="note"
            aria-label="Dissolved leading front">
            <p>At {(coasted.dissolvedLeadingFront.sourceDistanceM/1000)
              .toFixed(3)} km, all
              {' '}{coasted.dissolvedLeadingFront.leadingRiderIds.length}
              {' '}riders exhausted and left
              {' '}{coasted.dissolvedLeadingFront.dissolvedGroupId}.
              {coasted.dissolvedLeadingFront.survivorPasses?.length?
                <> They used separate outside lanes until
                  {' '}{coasted.dissolvedLeadingFront.survivingGroupId}
                  {' '}passed them unassisted.</>:
                <> They stayed ahead of
                  {' '}{coasted.dissolvedLeadingFront.survivingGroupId}.</>}
              {coasted.dissolvedLeadingFront.survivingGroupIds?.length>1&&<>
                {' '}{coasted.dissolvedLeadingFront.survivingGroupIds[1]}
                {' '}also stayed behind them and ahead of the bunch.</>}
              {coasted.dissolvedLeadingFront.rearRiderIds.length>0&&<>
                {' '}{coasted.dissolvedLeadingFront.rearRiderIds.length}
                {' '}rider left the surviving group and was passed by the
                bunch.</>}
              {' '}Their paid travel, energy and individual finish replays
              are recorded. Places and points remain unresolved.</p>
            {coasted.dissolvedLeadingFront.bunchPasses.map(event=><p
              key={event.riderId}>The bunch passed {event.riderId} at
              {' '}{(event.distanceM/1000).toFixed(3)} km.</p>)}
            {coasted.dissolvedLeadingFront.survivorPasses?.map(event=><p
              key={event.riderId}>{event.groupId} passed {event.riderId}
              {' '}unassisted at {(event.atDistanceM/1000).toFixed(3)} km.</p>)}
            {[...coasted.dissolvedLeadingFront.leadingRiderIds,
              ...coasted.dissolvedLeadingFront.rearRiderIds].map(id=><button
              type="button" key={id}
              aria-label={`Inspect dissolved front rider ${id} finish replay`}
              onClick={()=>{
                setCoastedBandId(`isolated:${id}`);
                setCoastedRiderId(id);setCoastedBandIndex(0);
                document.getElementById('v93-paid-finale-replay')
                  ?.scrollIntoView();
              }}>Finish replay {id}</button>)}
          </div>}
          {coasted.dissolvedAllFronts&&<div role="note"
            aria-label="Both leading fronts dissolved">
            <p>At {(coasted.dissolvedAllFronts.sourceDistanceM/1000)
              .toFixed(3)} km, both leading groups dissolved from exhaustion.
              {' '}{coasted.dissolvedAllFronts.leadingRiderIds.length}
              {' '}riders from {coasted.dissolvedAllFronts.leadingGroupId}
              {' '}stayed ahead of the bunch. All
              {' '}{coasted.dissolvedAllFronts.rearRiderIds.length}
              {' '}riders from {coasted.dissolvedAllFronts.rearGroupId}
              {' '}were passed by it. Their paid travel, energy and individual
              finish replays are recorded. Places and points remain
              unresolved.</p>
            {coasted.dissolvedAllFronts.bunchPasses.map(event=><p
              key={event.riderId}>The bunch passed {event.riderId} at
              {' '}{(event.distanceM/1000).toFixed(3)} km.</p>)}
            {[...coasted.dissolvedAllFronts.leadingRiderIds,
              ...coasted.dissolvedAllFronts.rearRiderIds].map(id=><button
              type="button" key={id}
              aria-label={`Inspect dissolved all-fronts rider ${id} finish replay`}
              onClick={()=>{
                setCoastedBandId(`isolated:${id}`);
                setCoastedRiderId(id);setCoastedBandIndex(0);
                document.getElementById('v93-paid-finale-replay')
                  ?.scrollIntoView();
              }}>Finish replay {id}</button>)}
          </div>}
          {coasted.dissolvedSingle&&<div role="note"
            aria-label="Single leading front dissolved">
            <p>At {(coasted.dissolvedSingle.sourceDistanceM/1000)
              .toFixed(3)} km, all
              {' '}{coasted.dissolvedSingle.leadingRiderIds.length}
              {' '}riders left {coasted.dissolvedSingle.dissolvedGroupId}
              {' '}as it dissolved. Their separately paid roads stayed ahead
              of the bunch through the finish. Individual energy and replays
              are recorded; places and points remain unresolved.</p>
            {coasted.dissolvedSingle.leadingRiderIds.map(id=><button
              type="button" key={id}
              aria-label={`Inspect dissolved single-front rider ${id} finish replay`}
              onClick={()=>{
                setCoastedBandId(`isolated:${id}`);
                setCoastedRiderId(id);setCoastedBandIndex(0);
                document.getElementById('v93-paid-finale-replay')
                  ?.scrollIntoView();
              }}>Finish replay {id}</button>)}
          </div>}
          {coasted.isolatedPassEvents?.length>0&&<div role="note"
            aria-label="Recorded isolated passes">
            <p>{coasted.isolatedPassEvents.length} isolated-rider passes were
              paid on the common road clock. Each passer uses an open lane;
              neither rider gains drafting or free energy.</p>
            {coasted.isolatedPassEvents.map((event,index)=><p key={index}>
              {(event.distanceM/1000).toFixed(3)} km ·
              {' '}{event.elapsedSecondsFromLastKmStart.toFixed(3)} s ·
              {' '}{event.passingRiderId} passed {event.passedRiderId}.
              {[event.passingRiderId,event.passedRiderId].map(id=><button
                key={id} type="button"
                aria-label={`Inspect pass rider ${id} finish replay`}
                onClick={()=>{
                  setCoastedBandId(`isolated:${id}`);
                  setCoastedRiderId(id);setCoastedBandIndex(0);
                  document.getElementById('v93-paid-finale-replay')
                    ?.scrollIntoView();
                }}>Finish replay {id}</button>)}
            </p>)}
          </div>}
          {coasted.isolatedParallelStarts?.length>0&&<div role="note"
            aria-label="Recorded parallel isolated lanes">
            <p>{coasted.isolatedParallelStarts.length} pair of isolated riders
              entered the final kilometre side by side. Their separately
              paid passages diverged by 250 m; neither gained a draft or
              free energy. Times and points below remain illustrative.</p>
            {coasted.isolatedParallelStarts.map((event,index)=><p key={index}>
              {(event.distanceM/1000).toFixed(3)} km ·
              {' '}{event.riderIds.join(' and ')}.
              {event.riderIds.map(id=><button key={id} type="button"
                aria-label={`Inspect parallel rider ${id} finish replay`}
                onClick={()=>{
                  setCoastedBandId(`isolated:${id}`);
                  setCoastedRiderId(id);setCoastedBandIndex(0);
                  document.getElementById('v93-paid-finale-replay')
                    ?.scrollIntoView();
                }}>Finish replay {id}</button>)}
            </p>)}
          </div>}
          {coasted.isolatedLaneEncounters?.length>0&&<div role="note"
            aria-label="Full-kilometre isolated lanes">
            <p>{coasted.isolatedLaneEncounters.length} possible meetings
              between already isolated riders were checked across the paid
              final kilometre. They keep separate outside lanes with no
              draft or free energy. The road groups, crossing times and
              replays remain recorded; exact ties keep possible place
              ranges and receive no point illustration.</p>
            {coasted.isolatedLaneEncounters.slice(0,3).map((event,index)=><p
              key={index}>
              {(event.distanceM/1000).toFixed(3)} km ·
              {' '}{event.riderIds.join(' and ')}.
              {event.riderIds.map(id=><button key={id} type="button"
                aria-label={`Inspect isolated lane rider ${id} finish replay`}
                onClick={()=>{
                  setCoastedBandId(`isolated:${id}`);
                  setCoastedRiderId(id);setCoastedBandIndex(0);
                  document.getElementById('v93-paid-finale-replay')
                    ?.scrollIntoView();
                }}>Finish replay {id}</button>)}
            </p>)}
            {coasted.isolatedLaneEncounters.length>3&&<p>
              Showing the first three meetings; all riders remain in the
              conditional line and replay.</p>}
          </div>}
          {!coasted.provisionalLineOrder&&<p>
            Riders are grouped by proven road-place ranges where available.
            Within a range, names are alphabetical; row order is not a
            classified finish.
          </p>}
          {coasted.roadPlaceBounds&&<p>{
            coasted.roadPlaceBounds.status===
              'shared_contact_photo_ranges'?
              'The shared road records every crossing. Tied times show possible place ranges; no tied rider receives a point illustration.':
            coasted.roadPlaceBounds.status===
              'conditional_front_separated_rear_contact_unresolved'?
              'The paid front stays separate through the finale. Contact between the bunch and new leavers remains unresolved; these are conditional ranges and points are withheld.':
              'Road ranges follow the paid front, leaver and bunch passages after the split. Wheel order and contact at the split remain unresolved; points are withheld.'
          }</p>}
          {photoFinishGroups.length>0&&<div role="note"
            aria-label="Unresolved photo finishes">
            <p>{photoFinishRiderCount} riders share
              {' '}{photoFinishGroups.length} unresolved possible-place
              {' '}{photoFinishGroups.length===1?'range':'ranges'}.
              Their crossing times and energy are recorded, but the order
              within each range has no point illustration.</p>
            {photoFinishGroups.slice(0,3).map(group=><p
              key={`${group.first}-${group.last}`}>
              Places {group.first}–{group.last}:
              {' '}{group.riderIds.join(', ')}.
              {group.riderIds.slice(0,3).map(id=><button key={id}
                type="button" aria-label={`Inspect photo finish rider ${id}`}
                onClick={()=>{
                  const line=coasted.lineTimes.find(row=>row.riderId===id);
                  setCoastedBandId(line.roadBandId);
                  setCoastedRiderId(id);setCoastedBandIndex(0);
                  document.getElementById('v93-paid-finale-replay')
                    ?.scrollIntoView();
                }}>Finish replay {id}</button>)}
            </p>)}
            {photoFinishGroups.length>3&&<p>
              Showing the first three ranges; every rider is listed in the
              conditional results table.</p>}
          </div>}
          {coasted.unresolvedBunchExits&&<div role="note"
            aria-label="Unresolved bunch exits">
            <p>{coastedBunchExitCount}
              {' '}{coastedBunchExitCount===1?'rider':'riders'} left the bunch in
              {' '}{coasted.unresolvedBunchExits.length} recorded
              {' '}{coasted.unresolvedBunchExits.length===1?'wave':'waves'}.
              Their paid crossings remain visible, but the exit has no
              recorded wheel order; unique places and points are withheld.</p>
            {coasted.unresolvedBunchExits.map(wave=><p
              key={wave.atDistanceM}>
              {(wave.atDistanceM/1000).toFixed(3)} km:
              {' '}{wave.riderIds.length}
              {' '}{wave.riderIds.length===1?'rider':'riders'} ·
              {' '}{wave.riderIds.length===1?
                'one recorded crossing time':wave.distinctLineTimes===1?
                'one shared crossing time':
                `${wave.distinctLineTimes} distinct crossing times`}.
            </p>)}
          </div>}
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
          <p>Times below start when the bunch reaches the final-kilometre marker, not at the race start. A front rider can cross before that marker and have a negative time. Energy is reserve left out of 100, not speed.</p>
          <div className="v91-result-scroll"><table className="v91-result-table"
            aria-label="V93 individual conditional results">
            <thead><tr><th scope="col">Possible place</th><th scope="col">Rider</th>
              <th scope="col">Road band</th><th scope="col">Time from bunch's final-km marker</th>
              <th scope="col">Energy at line</th><th scope="col">Preview points</th>
              <th scope="col">Replay</th>
            </tr></thead>
            <tbody>{visibleCoastedOrder.map(row=>{
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
                  aria-label={`Replay ${row.riderId}`}>Inspect finale</button>
                  {row.riderId.startsWith('you-')&&<button type="button"
                    onClick={()=>{
                      setViewerRiderId(row.riderId);
                      selectRecordedKilometre(Math.max(1,
                        coasted.settings.distanceKm-5));
                      document.querySelector('.v91-race-viewer')
                        ?.scrollIntoView();
                    }} aria-label={`Follow race for ${row.riderId}`}>
                    Follow race</button>}</td></tr>;
            })}</tbody>
          </table></div>
          {coasted.pointPreview?.status==='unavailable'&&<p>
            Point illustration unavailable: {coasted.pointPreview.reason}
          </p>}
          <p>Official points: withheld · Awards saved: 0</p>
        </div>
        {coastedComparison&&<section className="v91-finish"
          aria-label="Paired v93 race comparison">
          <h3>Compare two runs on the same route</h3>
          <p>Route, profile, category, field, fatigue and seed match.
            Manager tactics and finale nominations may differ.</p>
          <div className="v91-effort-comparison" aria-label="Late effort comparison">
            {[['Previous run',coastedComparison.before],
              ['Current run',coastedComparison.after]].map(([label,run])=><div
              key={label}>
              <h4>{label} · {run.lateEffort.effort??'unknown'} at 5 km to go</h4>
              <p>{run.finisherId} at 5 km: {run.lateEffort.atFiveKmRoad??'unavailable'} · {run.lateEffort.atFiveKmEnergy?.toFixed(1)??'—'} energy.</p>
              <p>At 1 km: {run.lateEffort.atOneKmRoad??'unavailable'} · {run.lateEffort.atOneKmEnergy?.toFixed(1)??'—'} energy.</p>
              {run.lateEffort.atOneKmFrontGapSeconds>0&&<p>
                Front group at 1 km: {run.lateEffort.atOneKmFrontGapSeconds.toFixed(1)} s ahead of the bunch.
              </p>}
              <p>Recorded work from 5 km to the 1 km handoff: {run.lateTeamWork.attacks} attacks · {run.lateTeamWork.chaseKm} chase km · {run.lateTeamWork.breakPullKm} break-pull km · {run.lateTeamWork.bunchPaceKm} bunch-front km.</p>
              <p>Recorded catches in those kilometres: {run.lateTeamWork.catches.length?
                run.lateTeamWork.catches.map(event=>
                  `km ${event.km}: ${event.riderIds.join(', ')}`).join(' · '):
                'none'}.</p>
              <p>At the line: {run.energyAtLine?.toFixed(1)??'—'} energy · conditional place {run.place}.</p>
            </div>)}</div>
          <p aria-label="Late effort takeaway">{raceViewerEffortInsight(
            coastedComparison.before,coastedComparison.after)}</p>
          <p>The recorded road and remaining energy show what changed. Line time below starts at the last kilometre, not the race start.</p>
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
