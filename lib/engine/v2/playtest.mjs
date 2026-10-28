// Synthetic, read-only v91 input builder for a future hands-on motor workbench.
// No account roster, calendar event, saved result or point ledger is involved.
import {simulateTacticalTour} from './tour.mjs';
import {validateRecordedTour} from './recording.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from './tuning.mjs';
import {createPlaytestRider,playtestTeamLevel} from './playtest-riders.mjs';
import {GENERATED_STAGE_ANCHORS} from './playtest-stage-generator.mjs';

const DISTANCES=new Set([40,120,260]);
const TERRAINS=new Set(['flat','rolling','mountain','exposed','custom']);
const TEAM_COUNTS=new Set([4,15,20]);
const FATIGUES=new Set([0,15,30]);
const EFFORTS=new Set(['conserve','steady','hard']);
const ATTACKS=new Set(['none','selective','repeated']);
const CHASES=new Set(['ignore','selective','all']);
const FRONT_WORK=new Set(['rotate','sit_in']);
const RIVAL_PLANS=new Set(['chase','attack','neutral','passive']);
const DEFAULT_RIVAL_PLANS=new Set(['mixed',...RIVAL_PLANS]);

function rivalPlan(index,rivalPlans){
  return index<=3?rivalPlans[index-1]:
    index%4===1?'chase':index%4===2?'attack':'neutral';
}

function baselineFor(plan){
  return plan==='chase'?{effort:'hard',attack:'none',chase:'all'}:
    plan==='attack'?{effort:'steady',attack:'selective',chase:'ignore'}:
    plan==='passive'?{effort:'steady',attack:'none',chase:'ignore'}:
    {effort:'steady',attack:'none',chase:'selective'};
}

function validTactic(tactic){
  return tactic&&typeof tactic==='object'&&!Array.isArray(tactic)&&
    Object.keys(tactic).sort().join(',')==='attack,chase,effort'&&
    EFFORTS.has(tactic.effort)&&ATTACKS.has(tactic.attack)&&
    CHASES.has(tactic.chase);
}

function validFinaleOrder(row,teamCount,distanceKm){
  if(!row||typeof row!=='object'||Array.isArray(row)||
    Object.keys(row).some(key=>!['teamId','effort','attack','attackRiderId',
      'chase','frontWork','atKm'].includes(key))||
    !['you',...Array.from({length:teamCount-1},(_,index)=>
      `rival-${index+1}`)].includes(row.teamId)||
    !['effort','attack','attackRiderId','chase','frontWork'].some(
      key=>row[key]!==undefined)||
    row.effort!==undefined&&!EFFORTS.has(row.effort)||
    row.attack!==undefined&&!ATTACKS.has(row.attack)||
    row.chase!==undefined&&!CHASES.has(row.chase)||
    row.frontWork!==undefined&&!FRONT_WORK.has(row.frontWork)||
    row.atKm!==undefined&&![distanceKm-5,distanceKm-1].includes(row.atKm))return false;
  if(row.attackRiderId===undefined)return true;
  return row.attack==='selective'&&
    Array.from({length:8},(_,index)=>`${row.teamId}-${index}`)
      .includes(row.attackRiderId);
}

function validTacticalEffortV2(row,teamCount,distanceKm){
  return row&&typeof row==='object'&&!Array.isArray(row)&&
    Object.keys(row).sort().join(',')==='atKm,effort,teamId'&&
    ['you',...Array.from({length:teamCount-1},(_,index)=>
      'rival-'+(index+1))].includes(row.teamId)&&
    Number.isInteger(row.atKm)&&row.atKm>=5&&
    row.atKm<=distanceKm-5&&row.atKm%5===0&&
    EFFORTS.has(row.effort);
}
function validTacticalFrontV4(row,teamCount,distanceKm){
  return row&&typeof row==='object'&&!Array.isArray(row)&&
    Object.keys(row).every(key=>
      ['teamId','atKm','effort','frontWork'].includes(key))&&
    (row.effort!==undefined||row.frontWork!==undefined)&&
    ['you',...Array.from({length:teamCount-1},(_,index)=>
      'rival-'+(index+1))].includes(row.teamId)&&
    Number.isInteger(row.atKm)&&row.atKm>=5&&
    row.atKm<=distanceKm-5&&row.atKm%5===0&&
    (row.effort===undefined||EFFORTS.has(row.effort))&&
    (row.frontWork===undefined||FRONT_WORK.has(row.frontWork));
}
function validTacticalTimelineV5(row,teamCount,distanceKm){
  return row&&typeof row==='object'&&!Array.isArray(row)&&
    Object.keys(row).every(key=>
      ['teamId','atKm','effort','frontWork','attack','chase'].includes(key))&&
    ['effort','frontWork','attack','chase'].some(key=>row[key]!==undefined)&&
    ['you',...Array.from({length:teamCount-1},(_,index)=>
      `rival-${index+1}`)].includes(row.teamId)&&
    Number.isInteger(row.atKm)&&row.atKm>=5&&
    row.atKm<=distanceKm-5&&row.atKm%5===0&&
    (row.effort===undefined||EFFORTS.has(row.effort))&&
    (row.frontWork===undefined||FRONT_WORK.has(row.frontWork))&&
    (row.attack===undefined||['none','selective'].includes(row.attack))&&
    (row.chase===undefined||CHASES.has(row.chase));
}
function validTacticalTimelineV6(row,teamCount,distanceKm){
  const {attackRiderId,...base}=row??{};
  return validTacticalTimelineV5(base,teamCount,distanceKm)&&
    (attackRiderId===undefined||row.attack==='selective'&&
      Array.from({length:8},(_,index)=>`${row.teamId}-${index}`)
        .includes(attackRiderId));
}
function validTacticalTimelineV7(row,teamCount,distanceKm){
  const {chaseTarget,...base}=row??{};
  const validTarget=chaseTarget===undefined||chaseTarget===null||
    Array.from({length:teamCount-1},(_,index)=>`rival-${index+1}`)
      .some(id=>chaseTarget===id||
        Array.from({length:8},(_,riderIndex)=>`${id}-${riderIndex}`)
          .includes(chaseTarget));
  return validTarget&&
    (validTacticalTimelineV6(base,teamCount,distanceKm)||
      chaseTarget!==undefined&&Object.keys(base).sort().join(',')===
        'atKm,teamId'&&base.teamId==='you'&&
        Number.isInteger(base.atKm)&&base.atKm>=5&&
        base.atKm<=distanceKm-5&&base.atKm%5===0);
}
function validTacticalTimelineV8(row,teamCount,distanceKm){
  const {frontWorkRiderId,...base}=row??{};
  const onlyWorker=frontWorkRiderId!==undefined&&
    Object.keys(base).sort().join(',')==='atKm,teamId'&&
    base.teamId==='you'&&Number.isInteger(base.atKm)&&base.atKm>=5&&
    base.atKm<=distanceKm-5&&base.atKm%5===0;
  return (validTacticalTimelineV7(base,teamCount,distanceKm)||onlyWorker)&&
    (frontWorkRiderId===undefined||row.teamId==='you'&&
      (frontWorkRiderId===null||
        Array.from({length:8},(_,index)=>`you-${index}`)
          .filter(id=>id!=='you-1'&&id!=='you-7')
          .includes(frontWorkRiderId)));
}
function validBoundedAttacksV5(rows){
  const teams=new Set(rows.map(row=>row.teamId));
  for(const teamId of teams){
    let active=false;
    for(const row of rows.filter(row=>row.teamId===teamId)
      .sort((a,b)=>a.atKm-b.atKm)){
      if(row.attack===undefined)continue;
      if(row.attack==='selective'){
        if(active)return false;
        active=true;
      }else{
        if(!active)return false;
        active=false;
      }
    }
    if(active)return false;
  }
  return true;
}
function validCustomProfile(heights,distanceKm){
  const generatedCount=GENERATED_STAGE_ANCHORS[distanceKm];
  if(!Array.isArray(heights)||
    (heights.length!==6&&heights.length!==generatedCount)||
    heights.some(height=>!Number.isInteger(height)||height<0||height>2500))return false;
  const segmentKm=distanceKm/(heights.length-1);
  return heights.every((height,index)=>index===0||
    Math.abs(height-heights[index-1])/segmentKm<=100);
}

function routeFor(distanceKm,terrain,profileHeightsM){
  const at=fraction=>Math.round(distanceKm*fraction);
  if(terrain==='custom')return {stage:{distance_km:distanceKm,
    profile_points:profileHeightsM.map((height,index)=>[
      at(index/(profileHeightsM.length-1)),height])},
    weather:{temp_c:16,wind_kph:10,precipitation_mm:0}};
  if(terrain==='rolling')return {stage:{distance_km:distanceKm,
    profile_points:[[0,120],[at(.2),380],[at(.4),130],[at(.65),460],
      [at(.82),150],[distanceKm,120]],tags:['HILLY']},
    weather:{temp_c:16,wind_kph:10,precipitation_mm:0}};
  if(terrain==='mountain')return {stage:{distance_km:distanceKm,
    profile_points:[[0,350],[at(.2),1250],[at(.35),450],[at(.6),1650],
      [at(.75),600],[distanceKm,1350]],tags:['MOUNTAIN']},
    weather:{temp_c:12,wind_kph:8,precipitation_mm:0}};
  return {stage:{distance_km:distanceKm,
    profile_points:[[0,80],[distanceKm,80]],tags:['FLAT'],
    ...(terrain==='exposed'?{exposed_segments:[{from_km:at(.25),to_km:at(.8)}]}:{})},
    weather:{temp_c:18,wind_kph:terrain==='exposed'?28:8,precipitation_mm:0}};
}

// Share the exact synthetic course construction with the isolated finale
// trial; it must not fork a second route builder or change this playtest.
export {routeFor as routeForV91Playtest};

function team(index,{gender,fatigue,effort,attack,chase,rivalPlans,
  defaultRivalPlan,managerTactics,managerTacticOverrides,teamOverrides,
  managerFinaleOrders,distanceKm}){
  const id=index===0?'you':`rival-${index}`;
  const name=index===0?'Your test team':`Fictional rival ${index}`;
  const override=teamOverrides.get(id);
  const level=override?.level??playtestTeamLevel(index);
  const startingFatigue=override?.fatigue??fatigue;
  const riders=Array.from({length:8},(_,riderIndex)=>createPlaytestRider({
    teamId:id,teamName:name,gender,fatigue:startingFatigue,level,riderIndex}));
  const defaultPlan=defaultRivalPlan==='mixed'?rivalPlan(index,rivalPlans):
    defaultRivalPlan;
  const rivalBaseline=managerTacticOverrides.get(id)??
    managerTactics[index-1]??baselineFor(defaultPlan);
  const phaseOrders=managerFinaleOrders.get(id)??[];
  return {id,name,riders,orders:{captainId:`${id}-7`,roadCaptainId:`${id}-1`,
    preset:'balanced',baseline:index===0?{effort,attack,chase}:rivalBaseline,
    ...(phaseOrders.length?{phases:phaseOrders.map(order=>
      ({atKm:order.atKm??distanceKm-1,...order}))}:{})}};
}

export function prepareV91Playtest({distanceKm=120,terrain='flat',teamCount=4,
  gender='M',fatigue=0,effort='steady',attack='selective',chase='selective',
  seed='playtest-1',profileHeightsM=[100,100,100,100,100,100],
  rivalPlans=['chase','attack','neutral'],defaultRivalPlan='mixed',
  managerTactics=[],managerTacticOverrides=[],teamOverrides=[],
  managerFinaleOrders=[],managerTacticalOrdersV2=[],
  managerTacticalOrdersV3=[],managerTacticalOrdersV4=[],
  managerTacticalOrdersV5=[],managerTacticalOrdersV6=[],
  managerTacticalOrdersV7=[],managerTacticalOrdersV8=[]}={}){
  if(!DISTANCES.has(distanceKm)||!TERRAINS.has(terrain)||
    !TEAM_COUNTS.has(teamCount)||!['M','F'].includes(gender)||
    !FATIGUES.has(fatigue)||!EFFORTS.has(effort)||!ATTACKS.has(attack)||
    !CHASES.has(chase)||typeof seed!=='string'||!seed.trim()||seed.length>80||
    (terrain==='custom'&&!validCustomProfile(profileHeightsM,distanceKm))||
    !Array.isArray(rivalPlans)||rivalPlans.length!==3||
    rivalPlans.some(plan=>!RIVAL_PLANS.has(plan))||
    !DEFAULT_RIVAL_PLANS.has(defaultRivalPlan)||
    !Array.isArray(managerTactics)||managerTactics.length>teamCount-1||
    managerTactics.some(tactic=>!validTactic(tactic))||
    !Array.isArray(managerTacticOverrides)||
    managerTacticOverrides.length>teamCount-1||
    new Set(managerTacticOverrides.map(row=>row?.teamId)).size!==
      managerTacticOverrides.length||
    managerTacticOverrides.some(row=>!row||typeof row!=='object'||
      Array.isArray(row)||Object.keys(row).sort().join(',')!==
        'attack,chase,effort,teamId'||
      !validTactic({effort:row.effort,attack:row.attack,
        chase:row.chase})||
      !Array.from({length:teamCount-1},(_,index)=>
        `rival-${index+1}`).includes(row.teamId)||
      Number(row.teamId.slice(6))<=managerTactics.length)||
    !Array.isArray(managerFinaleOrders)||
    managerFinaleOrders.length>teamCount||
    new Set(managerFinaleOrders.map(row=>row?.teamId)).size!==
      managerFinaleOrders.length||
    managerFinaleOrders.some(row=>!validFinaleOrder(row,teamCount,distanceKm))||
    !Array.isArray(managerTacticalOrdersV2)||
    managerTacticalOrdersV2.length>teamCount||
    managerFinaleOrders.length>0&&managerTacticalOrdersV2.length>0||
    new Set(managerTacticalOrdersV2.map(row=>row?.teamId)).size!==
      managerTacticalOrdersV2.length||
    managerTacticalOrdersV2.some(row=>
      !validTacticalEffortV2(row,teamCount,distanceKm))||
    !Array.isArray(managerTacticalOrdersV3)||
    managerTacticalOrdersV3.length>teamCount*(distanceKm/5-1)||
    (managerFinaleOrders.length>0||managerTacticalOrdersV2.length>0)&&
      managerTacticalOrdersV3.length>0||
    new Set(managerTacticalOrdersV3.map(row=>
      row?.teamId+':'+row?.atKm)).size!==managerTacticalOrdersV3.length||
    managerTacticalOrdersV3.some(row=>
      !validTacticalEffortV2(row,teamCount,distanceKm))||
    !Array.isArray(managerTacticalOrdersV4)||
    managerTacticalOrdersV4.length>teamCount*(distanceKm/5-1)||
    (managerFinaleOrders.length>0||managerTacticalOrdersV2.length>0||
      managerTacticalOrdersV3.length>0)&&managerTacticalOrdersV4.length>0||
    new Set(managerTacticalOrdersV4.map(row=>
      row?.teamId+':'+row?.atKm)).size!==managerTacticalOrdersV4.length||
    managerTacticalOrdersV4.some(row=>
      !validTacticalFrontV4(row,teamCount,distanceKm))||
    !Array.isArray(managerTacticalOrdersV5)||
    managerTacticalOrdersV5.length>teamCount*(distanceKm/5-1)||
    (managerFinaleOrders.length>0||managerTacticalOrdersV2.length>0||
      managerTacticalOrdersV3.length>0||managerTacticalOrdersV4.length>0)&&
      managerTacticalOrdersV5.length>0||
    new Set(managerTacticalOrdersV5.map(row=>
      row?.teamId+':'+row?.atKm)).size!==managerTacticalOrdersV5.length||
    managerTacticalOrdersV5.some(row=>
      !validTacticalTimelineV5(row,teamCount,distanceKm))||
    !validBoundedAttacksV5(managerTacticalOrdersV5)||
    !Array.isArray(managerTacticalOrdersV6)||
    managerTacticalOrdersV6.length>teamCount*(distanceKm/5-1)||
    (managerFinaleOrders.length>0||managerTacticalOrdersV2.length>0||
      managerTacticalOrdersV3.length>0||managerTacticalOrdersV4.length>0||
      managerTacticalOrdersV5.length>0)&&managerTacticalOrdersV6.length>0||
    new Set(managerTacticalOrdersV6.map(row=>
      row?.teamId+':'+row?.atKm)).size!==managerTacticalOrdersV6.length||
    managerTacticalOrdersV6.some(row=>
      !validTacticalTimelineV6(row,teamCount,distanceKm))||
    !validBoundedAttacksV5(managerTacticalOrdersV6)||
    !Array.isArray(managerTacticalOrdersV7)||
    managerTacticalOrdersV7.length>teamCount*(distanceKm/5-1)||
    (managerFinaleOrders.length>0||managerTacticalOrdersV2.length>0||
      managerTacticalOrdersV3.length>0||managerTacticalOrdersV4.length>0||
      managerTacticalOrdersV5.length>0||managerTacticalOrdersV6.length>0)&&
      managerTacticalOrdersV7.length>0||
    new Set(managerTacticalOrdersV7.map(row=>
      row?.teamId+':'+row?.atKm)).size!==managerTacticalOrdersV7.length||
    managerTacticalOrdersV7.some(row=>
      !validTacticalTimelineV7(row,teamCount,distanceKm))||
    !validBoundedAttacksV5(managerTacticalOrdersV7)||
    !Array.isArray(managerTacticalOrdersV8)||
    managerTacticalOrdersV8.length>teamCount*(distanceKm/5-1)||
    (managerFinaleOrders.length>0||managerTacticalOrdersV2.length>0||
      managerTacticalOrdersV3.length>0||managerTacticalOrdersV4.length>0||
      managerTacticalOrdersV5.length>0||managerTacticalOrdersV6.length>0||
      managerTacticalOrdersV7.length>0)&&managerTacticalOrdersV8.length>0||
    new Set(managerTacticalOrdersV8.map(row=>
      row?.teamId+':'+row?.atKm)).size!==managerTacticalOrdersV8.length||
    managerTacticalOrdersV8.some(row=>
      !validTacticalTimelineV8(row,teamCount,distanceKm))||
    !validBoundedAttacksV5(managerTacticalOrdersV8)||
    !Array.isArray(teamOverrides)||teamOverrides.length>teamCount||
    new Set(teamOverrides.map(row=>row?.teamId)).size!==
      teamOverrides.length||teamOverrides.some(row=>
      !row||typeof row!=='object'||Array.isArray(row)||
      !['you',...Array.from({length:teamCount-1},(_,index)=>
        `rival-${index+1}`)].includes(row.teamId)||
      Object.keys(row).some(key=>
        !['teamId','level','fatigue'].includes(key))||
      !('level' in row)&&!('fatigue' in row)||
      'level' in row&&(!Number.isInteger(row.level)||
        row.level<0||row.level>100)||
      'fatigue' in row&&(!Number.isFinite(row.fatigue)||
        row.fatigue<0||row.fatigue>100)))
    throw new Error('Choose valid playtest settings.');
  const effectivePhaseOrders=managerTacticalOrdersV8.length?
    managerTacticalOrdersV8:managerTacticalOrdersV7.length?
    managerTacticalOrdersV7:managerTacticalOrdersV6.length?
    managerTacticalOrdersV6:managerTacticalOrdersV5.length?
    managerTacticalOrdersV5:managerTacticalOrdersV4.length?
    managerTacticalOrdersV4:managerTacticalOrdersV3.length?
    managerTacticalOrdersV3:managerTacticalOrdersV2.length?
      managerTacticalOrdersV2:managerFinaleOrders;
  const {stage:baseStage,weather}=routeFor(distanceKm,terrain,profileHeightsM);
  const stage=effectivePhaseOrders.some(row=>
    row.atKm===undefined||row.atKm===distanceKm-1)?{...baseStage,
    keypoints:[...(baseStage.keypoints??[]),
      {km:distanceKm-1,kind:'SPRINT'}]}:baseStage;
  const overrides=new Map(teamOverrides.map(row=>[row.teamId,row]));
  const tacticOverrides=new Map(managerTacticOverrides.map(row=>[
    row.teamId,{effort:row.effort,attack:row.attack,chase:row.chase}]));
  const finaleOrders=new Map();
  for(const {teamId,...order} of effectivePhaseOrders){
    if(!finaleOrders.has(teamId))finaleOrders.set(teamId,[]);
    finaleOrders.get(teamId).push(order);
  }
  for(const phases of finaleOrders.values())phases.sort((a,b)=>
    (a.atKm??distanceKm-1)-(b.atKm??distanceKm-1));
  const teams=Array.from({length:teamCount},(_,index)=>
    team(index,{gender,fatigue,effort,attack,chase,rivalPlans,
      defaultRivalPlan,managerTactics,managerTacticOverrides:tacticOverrides,
      teamOverrides:overrides,managerFinaleOrders:finaleOrders,distanceKm}));
  return {settings:{distanceKm,terrain,teamCount,gender,fatigue,effort,attack,chase,seed,
    rivalPlans:[...rivalPlans],defaultRivalPlan,
    managerTactics:managerTactics.map(tactic=>({...tactic})),
    ...(managerTacticOverrides.length?{managerTacticOverrides:
      managerTacticOverrides.map(row=>({...row}))}:{}),
    ...(managerTacticalOrdersV2.length?{managerTacticalOrdersV2:
      managerTacticalOrdersV2.map(row=>({...row}))}:{}),
    ...(managerTacticalOrdersV3.length?{managerTacticalOrdersV3:
      managerTacticalOrdersV3.map(row=>({...row}))}:{}),
    ...(managerTacticalOrdersV4.length?{managerTacticalOrdersV4:
      managerTacticalOrdersV4.map(row=>({...row}))}:{}),
    ...(managerTacticalOrdersV5.length?{managerTacticalOrdersV5:
      managerTacticalOrdersV5.map(row=>({...row}))}:{}),
    ...(managerTacticalOrdersV6.length?{managerTacticalOrdersV6:
      managerTacticalOrdersV6.map(row=>({...row}))}:{}),
    ...(managerTacticalOrdersV7.length?{managerTacticalOrdersV7:
      managerTacticalOrdersV7.map(row=>({...row}))}:{}),
    ...(managerTacticalOrdersV8.length?{managerTacticalOrdersV8:
      managerTacticalOrdersV8.map(row=>({...row}))}:{}),
    ...(managerFinaleOrders.length?{managerFinaleOrders:
      managerFinaleOrders.map(row=>({...row}))}:{}),
    ...(teamOverrides.length?{teamOverrides:teamOverrides.map(row=>({...row}))}:{}),
    ...(terrain==='custom'?{profileHeightsM:[...profileHeightsM]}:{})},
    stage,weather,teams,seed};
}

export function createV91Playtest(input={}){
  const prepared=prepareV91Playtest(input);
  const {stage,weather,teams,seed}=prepared;
  const recording=simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  validateRecordedTour(recording);
  return {settings:prepared.settings,recording};
}

export function summarizeV91Playtest({settings,recording}){
  return {settings,tuningVersion:recording.tuningVersion,
    provisional:true,
    warning:'Kilometre-level v91 diagnostic only. The short-step finale, official results and points are not part of this playtest.',
    frames:recording.frames.map(frame=>({km:frame.km,terrain:frame.terrain,
      gapSeconds:frame.gapSeconds,roadGroups:frame.roadGroups.map(group=>({
        id:group.id,gapSeconds:group.gapSeconds,riderIds:group.riderIds})),
      attackers:frame.attackers,blockedAttacks:frame.blockedAttacks,
      chasers:frame.chasers,hardBunchWorkTeamIds:frame.hardBunchWorkTeamIds,
      steadyBunchWorkTeamIds:frame.steadyBunchWorkTeamIds,
      ownMeanEnergy:frame.teamEnergy.find(team=>team.teamId==='you')?.mean,
      ownRiders:frame.riderGroups.filter(rider=>rider.teamId==='you').map(rider=>({
        id:rider.id,energy:rider.energy,group:rider.group}))})),
    provisionalTopTen:recording.provisionalResults.slice(0,10).map(result=>({
      position:result.position,riderId:result.riderId,teamId:result.teamId})),
    ownCaptain:recording.provisionalResults.find(result=>result.riderId==='you-7')?.position};
}
