// Read-only ability comparison at a named first turn. Required shelter
// points are model units, not a measured wheel, position or contact event.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {orderAt} from '../lib/engine/v2/orders.mjs';
import {riderKilometreEffect} from
  '../lib/engine/v2/physiology.mjs';
import {replayRaceDynamicsRecording} from
  '../lib/engine/v2/replay-race-dynamics-v94.mjs';
import {MOTOR_DRAFT_SHELTER,TUNING} from
  '../lib/engine/v2/tuning.mjs';

const option=(name,fallback)=>{
  const value=process.argv.find(arg=>arg.startsWith(`--${name}=`));
  return value?value.slice(name.length+3):fallback;
};
const distanceKm=Number(option('distance',120));
const terrain=option('terrain','flat');
const fatigue=Number(option('fatigue',0));
const seedNumber=Number(option('seed-number',1));
if(![120,260].includes(distanceKm)||
  !['flat','rolling','mountain'].includes(terrain)||
  ![0,30].includes(fatigue)||
  !Number.isInteger(seedNumber)||seedNumber<1||seedNumber>4)
  throw new Error('Shelter audit needs a known synthetic case.');
const settings={distanceKm,terrain,teamCount:20,fatigue,
  attack:'none',chase:'selective',
  seed:`preview-recorded-road-${seedNumber}`};
const sportingStakes=prepareV91Playtest(settings).teams.map(team=>({
  teamId:team.id,goal:'sprint_finish',
  captainId:team.orders.captainId}));
let recording;
try{
  ({recording}=createV94RaceDynamicsPreview({format:'one_day',
    settings,sportingStakes,roadGroupPaceVersion:3,
    bunchFrontTurnVersion:1,chaseTurnVersion:1,
    pelotonFrontTurnVersion:1,pelotonDraftCostVersion:1,
    pelotonExposureCostVersion:1,pelotonDropContactVersion:1,
    pelotonFollowerDecisionVersion:2}));
}catch(error){
  if(!String(error.message).includes('Unresolved peloton drop contact')&&
    !String(error.message).includes(
      'Combined fresh attack and paid pursuit'))throw error;
  console.log(JSON.stringify({version:'v94-first-turn-shelter-capacity-1',
    distanceKm,terrain,fatigue,seedNumber,
    refusal:error.message}));
  process.exit(0);
}
replayRaceDynamicsRecording(recording);
const groups=new Map();
const transitionExclusions=[];
for(const frame of recording.frames){
  const segment=recording.route.kilometres[frame.km-1];
  const plan=frame.pelotonFrontTurnPlan;
  const first=plan.turns[0];
  if(plan.status!=='worked'||first.startM!==0||
    typeof first.leaderRiderId!=='string'||
    !Number.isFinite(first.ability))
    throw new Error('Shelter audit lacks named paid first turn.');
  const ledgerById=new Map(frame.energyLedger.map(row=>
    [row.riderId,row]));
  const groupById=new Map(frame.riderGroups.map(row=>
    [row.id,row.group]));
  const priorGroupById=frame.km===1?null:new Map(
    recording.frames[frame.km-2].riderGroups.map(row=>
      [row.id,row.group]));
  const decisionById=new Map(frame.pelotonFollowerDecisions.map(row=>
    [row.riderId,row]));
  const key=segment.terrain;
  if(!groups.has(key))groups.set(key,[]);
  for(const team of recording.committedInputs.teams)
    for(const rider of team.riders){
      if(priorGroupById&&
        groupById.get(rider.id)==='peloton'&&
        priorGroupById.get(rider.id)!=='peloton')
        transitionExclusions.push({km:frame.km,riderId:rider.id,
          priorGroup:priorGroupById.get(rider.id),
          caughtBreakawayRecorded:frame.caughtBreakawayRiderIds
            .includes(rider.id)});
      if(rider.id===first.leaderRiderId||
        groupById.get(rider.id)!=='peloton'||
        (priorGroupById&&
          priorGroupById.get(rider.id)!=='peloton'))continue;
      const ledger=ledgerById.get(rider.id);
      if(!ledger)throw new Error('Shelter audit lacks energy source.');
      const orderEffort=orderAt(team.orders,frame.km-1).effort;
      const decision=decisionById.get(rider.id);
      if(!decision&&!plan.turns.some(turn=>
        turn.leaderRiderId===rider.id))
        throw new Error('Shelter audit lacks follower effort source at '+
          `km ${frame.km}: ${rider.id}.`);
      const appliedEffort=decision
        ?.appliedEffort??orderEffort;
      const effect=riderKilometreEffect(rider,segment,{
        phase:'cruise',energy:ledger.energyBefore,
        exposed:segment.exposed});
      const ability=effect.ability+
        (TUNING.effortPressure[appliedEffort]-1)*20;
      groups.get(key).push({km:frame.km,riderId:rider.id,
        requiredBonus:first.ability-ability});
    }
}
const quantile=(sorted,fraction)=>sorted.length?
  +sorted[Math.floor((sorted.length-1)*fraction)].toFixed(6):null;
const summary=Object.fromEntries([...groups].map(([key,rows])=>{
  const values=rows.map(row=>row.requiredBonus).sort((a,b)=>a-b);
  const currentBonus=TUNING.breakaway.bunchDraftAdvantage;
  const terrainBonus=MOTOR_DRAFT_SHELTER[key];
  return [key,{firstTurnFollowerKm:rows.length,
    currentBonus,terrainBonus,
    needMoreThanCurrent:values.filter(value=>
      value>currentBonus+1e-9).length,
    needMoreThanTerrainBonus:values.filter(value=>
      value>terrainBonus+1e-9).length,
    requiredBonus:{min:quantile(values,0),
      median:quantile(values,.5),p90:quantile(values,.9),
      max:quantile(values,1)},
    firstKmFollowers:rows.filter(row=>row.km===1).length,
    firstKmNeedMoreThanCurrent:rows.filter(row=>
      row.km===1&&row.requiredBonus>
        currentBonus+1e-9).length,
    firstKmNeedMoreThanTerrainBonus:rows.filter(row=>
      row.km===1&&row.requiredBonus>
        terrainBonus+1e-9).length}];
}));
console.log(JSON.stringify({version:'v94-first-turn-shelter-capacity-1',
  raceSeed:recording.raceSeed,distanceKm,terrain,fatigue,
  seedNumber,transitionExcludedCount:transitionExclusions.length,
  transitionWithoutCaughtMarker:transitionExclusions.filter(row=>
    !row.caughtBreakawayRecorded).length,
  firstTransitionExcluded:transitionExclusions[0]??null,summary}));
