// Synthetic, read-only v91 input builder for a future hands-on motor workbench.
// No account roster, calendar event, saved result or point ledger is involved.
import {simulateTacticalTour} from './tour.mjs';
import {validateRecordedTour} from './recording.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from './tuning.mjs';

const SKILLS=['sprint','flat','hills','mountain','cobbles','timetrial',
  'endurance','strength','wind'];
const DISTANCES=new Set([40,120,260]);
const TERRAINS=new Set(['flat','rolling','mountain','exposed','custom']);
const TEAM_COUNTS=new Set([4,15,20]);
const FATIGUES=new Set([0,15,30]);
const EFFORTS=new Set(['conserve','steady','hard']);
const ATTACKS=new Set(['none','selective','repeated']);
const CHASES=new Set(['ignore','selective','all']);
const RIVAL_PLANS=new Set(['chase','attack','neutral']);

function validCustomProfile(heights,distanceKm){
  if(!Array.isArray(heights)||heights.length!==6||
    heights.some(height=>!Number.isInteger(height)||height<0||height>2500))return false;
  const segmentKm=distanceKm/5;
  return heights.every((height,index)=>index===0||
    Math.abs(height-heights[index-1])/segmentKm<=100);
}

function routeFor(distanceKm,terrain,profileHeightsM){
  const at=fraction=>Math.round(distanceKm*fraction);
  if(terrain==='custom')return {stage:{distance_km:distanceKm,
    profile_points:profileHeightsM.map((height,index)=>[at(index/5),height])},
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

function team(index,{gender,fatigue,effort,attack,chase,rivalPlans}){
  const id=index===0?'you':`rival-${index}`;
  const name=index===0?'Your test team':`Fictional rival ${index}`;
  const level=index===0?78:index%4===1?82:index%4===2?76:80;
  const riders=Array.from({length:8},(_,riderIndex)=>{
    const value=Math.min(100,Math.max(0,level+(riderIndex-3)*2));
    return {id:`${id}-${riderIndex}`,name:`${name} rider ${riderIndex+1}`,
      gender,form:70,fatigue,leadership:50,
      ...Object.fromEntries(SKILLS.map(skill=>[skill,value])),
      sprint:Math.min(100,value+(riderIndex===7?14:0)),
      mountain:Math.min(100,value+(riderIndex===6?10:0)),
      endurance:Math.min(100,value+(riderIndex===5?10:0))};
  });
  const role=index<=3?rivalPlans[index-1]:
    index%4===1?'chase':index%4===2?'attack':'neutral';
  const rivalBaseline=role==='chase'?{effort:'hard',attack:'none',chase:'all'}:
    role==='attack'?{effort:'steady',attack:'selective',chase:'ignore'}:
    {effort:'steady',attack:'none',chase:'selective'};
  return {id,name,riders,orders:{captainId:`${id}-7`,roadCaptainId:`${id}-1`,
    preset:'balanced',baseline:index===0?{effort,attack,chase}:rivalBaseline}};
}

export function createV91Playtest({distanceKm=120,terrain='flat',teamCount=4,
  gender='M',fatigue=0,effort='steady',attack='selective',chase='selective',
  seed='playtest-1',profileHeightsM=[100,100,100,100,100,100],
  rivalPlans=['chase','attack','neutral']}={}){
  if(!DISTANCES.has(distanceKm)||!TERRAINS.has(terrain)||
    !TEAM_COUNTS.has(teamCount)||!['M','F'].includes(gender)||
    !FATIGUES.has(fatigue)||!EFFORTS.has(effort)||!ATTACKS.has(attack)||
    !CHASES.has(chase)||typeof seed!=='string'||!seed.trim()||seed.length>80||
    (terrain==='custom'&&!validCustomProfile(profileHeightsM,distanceKm))||
    !Array.isArray(rivalPlans)||rivalPlans.length!==3||
    rivalPlans.some(plan=>!RIVAL_PLANS.has(plan)))
    throw new Error('Choose valid playtest settings.');
  const {stage,weather}=routeFor(distanceKm,terrain,profileHeightsM);
  const teams=Array.from({length:teamCount},(_,index)=>
    team(index,{gender,fatigue,effort,attack,chase,rivalPlans}));
  const recording=simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  validateRecordedTour(recording);
  return {settings:{distanceKm,terrain,teamCount,gender,fatigue,effort,attack,chase,seed,
    rivalPlans:[...rivalPlans],
    ...(terrain==='custom'?{profileHeightsM:[...profileHeightsM]}:{})},
    recording};
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
