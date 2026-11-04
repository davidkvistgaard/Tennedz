// Read-only same-seed first-kilometre road probe; it awards no finish.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {prepareV91Playtest} from
  '../lib/engine/v2/playtest.mjs';
import {replayV94PhysicalFirstKmV1,
  validateV94PhysicalFirstKmV1} from
  '../lib/engine/v2/v94-physical-first-km-v1.mjs';
import {completeV94PhysicalFirstKmV1,
  validateV94PhysicalFirstKmCompletionV1} from
  '../lib/engine/v2/v94-physical-first-km-completion-v1.mjs';
import {replayV94PhysicalSecondFrontKmV1,
  validateV94PhysicalSecondFrontKmV1} from
  '../lib/engine/v2/v94-physical-second-front-km-v1.mjs';

const requested=process.argv.find(arg=>arg.startsWith('--seeds='));
const seedCount=requested?Number(requested.slice(8)):1;
const complete=process.argv.includes('--complete');
const secondFront=process.argv.includes('--second-front');
if(secondFront&&!complete)
  throw new Error('Second-km front audit needs --complete.');
if(!Number.isInteger(seedCount)||seedCount<1||seedCount>3)
  throw new Error('First-km physical audit needs one to three seeds.');
const cases=[];
for(let seed=1;seed<=seedCount;seed++)
  for(const distanceKm of [120,260])
  for(const terrain of ['flat','mountain'])
  for(const fatigue of [0,30]){
    const settings={distanceKm,teamCount:20,terrain,fatigue,
      attack:'none',chase:'selective',
      seed:`preview-recorded-road-${seed}`};
    const sportingStakes=prepareV91Playtest(settings).teams.map(team=>({
      teamId:team.id,goal:'sprint_finish',
      captainId:team.orders.captainId}));
    try{
      const {recording}=createV94RaceDynamicsPreview({format:'one_day',
        settings,sportingStakes,roadGroupPaceVersion:3,chaseTurnVersion:1,
        bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1,
        pelotonDraftCostVersion:1,pelotonExposureCostVersion:1,
        freshAttackDecisionVersion:1,roadGroupRiderDecisionVersion:1,
        protectorSportingPursuitVersion:1});
      const physical=replayV94PhysicalFirstKmV1(recording);
      validateV94PhysicalFirstKmV1(recording,physical);
      const completion=complete?
        completeV94PhysicalFirstKmV1(recording):null;
      if(completion)
        validateV94PhysicalFirstKmCompletionV1(recording,completion);
      let nextFront=null,nextFrontRefusal=null;
      if(secondFront)try{
        nextFront=replayV94PhysicalSecondFrontKmV1(recording);
        validateV94PhysicalSecondFrontKmV1(recording,nextFront);
      }catch(error){nextFrontRefusal=error.message;}
      const firstDetached=physical.atFrontClock.find(row=>!row.attached);
      const attached=new Set(physical.atFrontClock.filter(row=>
        row.attached).map(row=>row.riderId));
      const next=recording.frames[1];
      const nextTurns=next?.pelotonFrontTurnPlan?.turns??[];
      cases.push({seed,distanceKm,terrain,fatigue,
        frontClockSeconds:physical.frontClockSeconds,
        completeRiderKilometres:physical.completeRiderKilometres,
        detachedRiderCount:physical.detachedRiderCount,
        ...(completion?{
          completedWholeFirstKm:completion.completeRiderKilometres,
          coincidentSoloSets:completion.coincidentSoloSets.length,
          coincidentSoloRiders:completion.coincidentSoloSets.reduce(
            (sum,row)=>sum+row.riderIds.length,0),
          nextKmSourceFront:next?.pelotonFrontTurnPlan?.status??null,
          nextKmSourceLeadersAttached:nextTurns.every(row=>
            attached.has(row.leaderRiderId)),
          nextKmSourceHasAttack:!!(next?.attackers.length||
            next?.joinedBreakawayRiderIds.length||
            next?.breakawayRiderIds.length||next?.roadGroups.length),
          ...(secondFront?{
            nextFrontRiderKilometres:nextFront?.completeFrontRiderKilometres??0,
            nextFrontRefusal}:{}),
          lastSoloClockSeconds:completion.soloCompletions.length?
            Math.max(...completion.soloCompletions.map(row=>
              row.finishClockSeconds)):null}:{}),
        firstDetached:firstDetached?{riderId:firstDetached.riderId,
          remainingDistanceM:firstDetached.remainingDistanceM}:null});
    }catch(error){
      cases.push({seed,distanceKm,terrain,fatigue,
        refusal:error.message});
    }
  }
const accepted=cases.filter(row=>!row.refusal);
console.log(JSON.stringify({seedCount,complete,secondFront,cases:cases.length,
  replayedFirstKilometres:accepted.length,
  refusedCases:cases.length-accepted.length,
  totalCompletedRiderKilometres:accepted.reduce((sum,row)=>
    sum+row.completeRiderKilometres,0),
  totalDetachedAtFrontClock:accepted.reduce((sum,row)=>
    sum+row.detachedRiderCount,0),
  completedWholeFirstKm:accepted.reduce((sum,row)=>
    sum+(row.completedWholeFirstKm??0),0),
  coincidentSoloSets:accepted.reduce((sum,row)=>
    sum+(row.coincidentSoloSets??0),0),
  coincidentSoloRiders:accepted.reduce((sum,row)=>
    sum+(row.coincidentSoloRiders??0),0),
  nextKmSourceLeadersAttached:accepted.filter(row=>
    row.nextKmSourceFront==='worked'&&
    row.nextKmSourceLeadersAttached).length,
  nextKmSourceHasAttack:accepted.filter(row=>
    row.nextKmSourceHasAttack).length,
  nextFrontTraces:accepted.filter(row=>
    row.nextFrontRefusal===null).length,
  nextFrontCompletedRiderKilometres:accepted.reduce((sum,row)=>
    sum+(row.nextFrontRiderKilometres??0),0),
  firstCase:cases[0],refusals:cases.filter(row=>row.refusal),
  secondFrontRefusals:accepted.filter(row=>
    row.nextFrontRefusal)},null,2));
