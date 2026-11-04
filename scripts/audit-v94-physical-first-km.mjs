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
import {decideV94PhysicalBoundaryChoicesV1,
  validateV94PhysicalBoundaryChoicesV1} from
  '../lib/engine/v2/v94-physical-boundary-choice-v1.mjs';
import {replayV94PhysicalSecondRearKmV1,
  validateV94PhysicalSecondRearKmV1} from
  '../lib/engine/v2/v94-physical-second-rear-km-v1.mjs';
import {replayV94PhysicalThirdFrontKmV1,
  validateV94PhysicalThirdFrontKmV1} from
  '../lib/engine/v2/v94-physical-third-front-km-v1.mjs';
import {decideV94PhysicalThirdBoundaryChoicesV1,
  validateV94PhysicalThirdBoundaryChoicesV1} from
  '../lib/engine/v2/v94-physical-third-boundary-choice-v1.mjs';
import {replayV94PhysicalThirdRearKmV1,
  validateV94PhysicalThirdRearKmV1} from
  '../lib/engine/v2/v94-physical-third-rear-km-v1.mjs';

const requested=process.argv.find(arg=>arg.startsWith('--seeds='));
const seedCount=requested?Number(requested.slice(8)):1;
const complete=process.argv.includes('--complete');
const secondFront=process.argv.includes('--second-front');
const boundaryChoice=process.argv.includes('--boundary-choice');
const secondRear=process.argv.includes('--second-rear');
const thirdSource=process.argv.includes('--third-source');
const thirdFront=process.argv.includes('--third-front');
const thirdBoundary=process.argv.includes('--third-boundary');
const thirdRear=process.argv.includes('--third-rear');
if((secondFront||boundaryChoice||secondRear||thirdSource)&&!complete||
  thirdSource&&!secondRear||thirdFront&&!secondRear||
  thirdBoundary&&!secondRear||thirdRear&&!secondRear)
  throw new Error('Continuation audit needs --complete.');
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
      const boundary=boundaryChoice?
        decideV94PhysicalBoundaryChoicesV1(recording):null;
      if(boundary)
        validateV94PhysicalBoundaryChoicesV1(recording,boundary);
      let nextFront=null,nextFrontRefusal=null;
      if(secondFront)try{
        nextFront=replayV94PhysicalSecondFrontKmV1(recording);
        validateV94PhysicalSecondFrontKmV1(recording,nextFront);
      }catch(error){nextFrontRefusal=error.message;}
      let rear=null,rearRefusal=null;
      if(secondRear)try{
        rear=replayV94PhysicalSecondRearKmV1(recording);
        validateV94PhysicalSecondRearKmV1(recording,rear);
      }catch(error){rearRefusal=error.message;}
      let thirdTrace=null,thirdFrontRefusal=null;
      if(thirdFront&&rear)try{
        thirdTrace=replayV94PhysicalThirdFrontKmV1(recording);
        validateV94PhysicalThirdFrontKmV1(recording,thirdTrace);
      }catch(error){thirdFrontRefusal=error.message;}
      let thirdChoice=null,thirdBoundaryRefusal=null;
      if(thirdBoundary&&rear)try{
        thirdChoice=decideV94PhysicalThirdBoundaryChoicesV1(
          recording);
        validateV94PhysicalThirdBoundaryChoicesV1(
          recording,thirdChoice);
      }catch(error){thirdBoundaryRefusal=error.message;}
      let thirdRearTrace=null,thirdRearRefusal=null;
      if(thirdRear&&rear)try{
        thirdRearTrace=replayV94PhysicalThirdRearKmV1(recording);
        validateV94PhysicalThirdRearKmV1(recording,thirdRearTrace);
      }catch(error){thirdRearRefusal=error.message;}
      const third=thirdSource?recording.frames[2]:null;
      const physicalFrontAtTwo=new Set(rear?.finishes.filter(row=>
        row.physicalGroup==='peloton').map(row=>row.riderId)??[]);
      const thirdTurns=third?.pelotonFrontTurnPlan?.turns??[];
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
          ...(boundary?{
            pendingBoundaryGroups:boundary.pendingGroupCount,
            noLeaderBoundaryContacts:boundary.choices.length-
              boundary.pendingGroupCount}:{}),
          nextKmSourceFront:next?.pelotonFrontTurnPlan?.status??null,
          nextKmSourceLeadersAttached:nextTurns.every(row=>
            attached.has(row.leaderRiderId)),
          nextKmSourceHasAttack:!!(next?.attackers.length||
            next?.joinedBreakawayRiderIds.length||
            next?.breakawayRiderIds.length||next?.roadGroups.length),
          ...(secondFront?{
            nextFrontRiderKilometres:nextFront?.completeFrontRiderKilometres??0,
            nextFrontRefusal}:{}),
          ...(secondRear?{
            secondKmFullField:rear?.fullFieldKilometre??false,
            secondKmRearGroups:rear?.physicalRearGroups.length??0,
            secondKmNewFrontDrops:rear?.newFrontDrops.length??0,
            secondKmCoincidentDropSets:
              rear?.coincidentNewFrontDropSets.length??0,
            secondKmCoincidentDropRiders:
              rear?.coincidentNewFrontDropSets.reduce((sum,row)=>
                sum+row.riderIds.length,0)??0,
            secondKmRefusal:rearRefusal}:{}),
          ...(thirdSource?{
            thirdKmSourceFront:third?.pelotonFrontTurnPlan?.status??null,
            thirdKmLeadersAttached:thirdTurns.every(row=>
              physicalFrontAtTwo.has(row.leaderRiderId)),
            thirdKmSourceHasAttack:!!(third?.attackers.length||
              third?.joinedBreakawayRiderIds.length||
              third?.breakawayRiderIds.length||
              third?.roadGroups.length)}:{}),
          ...(thirdFront?{
            thirdFrontRiderKilometres:
              thirdTrace?.completeFrontRiderKilometres??0,
            thirdFrontNewDrops:thirdTrace?.atFrontClock.filter(row=>
              !row.attached).length??0,
            thirdFrontRefusal}:{}),
          ...(thirdBoundary?{
            thirdBoundaryChoices:thirdChoice?.choices.length??0,
            thirdPendingGroups:thirdChoice?.pendingGroupCount??0,
            thirdBoundaryRiders:thirdChoice?.choices.reduce(
              (sum,row)=>sum+row.riderIds.length,0)??0,
            thirdUnpairedSolos:
              thirdChoice?.unpairedSoloRiderIds.length??0,
            thirdBoundaryRefusal}:{}),
          ...(thirdRear?{
            thirdKmFullField:
              thirdRearTrace?.fullFieldKilometre??false,
            thirdKmRearGroups:
              thirdRearTrace?.physicalRearGroups.length??0,
            thirdKmNewFrontDrops:
              thirdRearTrace?.newFrontDrops.length??0,
            thirdKmCoincidentDropSets:
              thirdRearTrace?.coincidentNewFrontDropSets.length??0,
            thirdRearRefusal}:{}),
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
console.log(JSON.stringify({seedCount,complete,secondFront,boundaryChoice,
  secondRear,thirdSource,thirdFront,thirdBoundary,thirdRear,
  cases:cases.length,
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
  pendingBoundaryGroups:accepted.reduce((sum,row)=>
    sum+(row.pendingBoundaryGroups??0),0),
  noLeaderBoundaryContacts:accepted.reduce((sum,row)=>
    sum+(row.noLeaderBoundaryContacts??0),0),
  nextKmSourceLeadersAttached:accepted.filter(row=>
    row.nextKmSourceFront==='worked'&&
    row.nextKmSourceLeadersAttached).length,
  nextKmSourceHasAttack:accepted.filter(row=>
    row.nextKmSourceHasAttack).length,
  nextFrontTraces:accepted.filter(row=>
    row.nextFrontRefusal===null).length,
  nextFrontCompletedRiderKilometres:accepted.reduce((sum,row)=>
    sum+(row.nextFrontRiderKilometres??0),0),
  secondKmFullFields:accepted.filter(row=>
    row.secondKmFullField).length,
  secondKmRearGroups:accepted.reduce((sum,row)=>
    sum+(row.secondKmRearGroups??0),0),
  secondKmNewFrontDrops:accepted.reduce((sum,row)=>
    sum+(row.secondKmNewFrontDrops??0),0),
  secondKmCoincidentDropSets:accepted.reduce((sum,row)=>
    sum+(row.secondKmCoincidentDropSets??0),0),
  secondKmCoincidentDropRiders:accepted.reduce((sum,row)=>
    sum+(row.secondKmCoincidentDropRiders??0),0),
  thirdKmLeadersAttached:accepted.filter(row=>
    row.thirdKmSourceFront==='worked'&&
    row.thirdKmLeadersAttached).length,
  thirdKmSourceHasAttack:accepted.filter(row=>
    row.thirdKmSourceHasAttack).length,
  thirdFrontTraces:accepted.filter(row=>
    row.thirdFrontRefusal===null&&row.thirdFrontRiderKilometres>0).length,
  thirdFrontRiderKilometres:accepted.reduce((sum,row)=>
    sum+(row.thirdFrontRiderKilometres??0),0),
  thirdFrontNewDrops:accepted.reduce((sum,row)=>
    sum+(row.thirdFrontNewDrops??0),0),
  thirdBoundaryChoices:accepted.reduce((sum,row)=>
    sum+(row.thirdBoundaryChoices??0),0),
  thirdPendingGroups:accepted.reduce((sum,row)=>
    sum+(row.thirdPendingGroups??0),0),
  thirdBoundaryRiders:accepted.reduce((sum,row)=>
    sum+(row.thirdBoundaryRiders??0),0),
  thirdUnpairedSolos:accepted.reduce((sum,row)=>
    sum+(row.thirdUnpairedSolos??0),0),
  thirdKmFullFields:accepted.filter(row=>
    row.thirdKmFullField).length,
  thirdKmRearGroups:accepted.reduce((sum,row)=>
    sum+(row.thirdKmRearGroups??0),0),
  thirdKmNewFrontDrops:accepted.reduce((sum,row)=>
    sum+(row.thirdKmNewFrontDrops??0),0),
  thirdKmCoincidentDropSets:accepted.reduce((sum,row)=>
    sum+(row.thirdKmCoincidentDropSets??0),0),
  firstCase:cases[0],refusals:cases.filter(row=>row.refusal),
  secondFrontRefusals:accepted.filter(row=>
    row.nextFrontRefusal),
  secondKmRefusals:accepted.filter(row=>
    row.secondKmRefusal).map(row=>({seed:row.seed,
      distanceKm:row.distanceKm,terrain:row.terrain,
      fatigue:row.fatigue,refusal:row.secondKmRefusal})),
  thirdFrontRefusals:accepted.filter(row=>
    row.thirdFrontRefusal).map(row=>({seed:row.seed,
      distanceKm:row.distanceKm,terrain:row.terrain,
      fatigue:row.fatigue,refusal:row.thirdFrontRefusal})),
  thirdBoundaryRefusals:accepted.filter(row=>
    row.thirdBoundaryRefusal).map(row=>({seed:row.seed,
      distanceKm:row.distanceKm,terrain:row.terrain,
      fatigue:row.fatigue,refusal:row.thirdBoundaryRefusal})),
  thirdRearRefusals:accepted.filter(row=>
    row.thirdRearRefusal).map(row=>({seed:row.seed,
      distanceKm:row.distanceKm,terrain:row.terrain,
      fatigue:row.fatigue,refusal:row.thirdRearRefusal}))},
null,2));
