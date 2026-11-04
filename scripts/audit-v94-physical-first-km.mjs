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
import {replayV94PhysicalFourthKmV1,
  validateV94PhysicalFourthKmV1} from
  '../lib/engine/v2/v94-physical-fourth-km-v1.mjs';
import {replayV94PhysicalNextKmV1,
  validateV94PhysicalNextKmV1} from
  '../lib/engine/v2/v94-physical-next-km-v1.mjs';
import {inspectV94PhysicalFreshLaunchBoundaryV1,
  validateV94PhysicalFreshLaunchBoundaryV1} from
  '../lib/engine/v2/v94-physical-fresh-launch-boundary-v1.mjs';
import {replayV94PhysicalFreshAttackSolosV1,
  validateV94PhysicalFreshAttackSolosV1} from
  '../lib/engine/v2/v94-physical-fresh-attack-solo-v1.mjs';
import {replayV94PhysicalFifthFrontKmV1,
  validateV94PhysicalFifthFrontKmV1} from
  '../lib/engine/v2/v94-physical-fifth-front-km-v1.mjs';
import {replayV94PhysicalFifthKmV1,
  validateV94PhysicalFifthKmV1} from
  '../lib/engine/v2/v94-physical-fifth-km-v1.mjs';
import {inspectV94PhysicalSixthSourceBoundaryV1,
  validateV94PhysicalSixthSourceBoundaryV1} from
  '../lib/engine/v2/v94-physical-sixth-source-boundary-v1.mjs';
import {decideV94PhysicalSixthRiderBoundaryV1,
  validateV94PhysicalSixthRiderBoundaryV1} from
  '../lib/engine/v2/v94-physical-sixth-rider-boundary-v1.mjs';

const requested=process.argv.find(arg=>arg.startsWith('--seeds='));
const seedCount=requested?Number(requested.slice(8)):1;
const selectedCase=process.argv.find(arg=>arg.startsWith('--case='));
const caseFilter=selectedCase?selectedCase.slice(7):null;
const complete=process.argv.includes('--complete');
const secondFront=process.argv.includes('--second-front');
const boundaryChoice=process.argv.includes('--boundary-choice');
const secondRear=process.argv.includes('--second-rear');
const thirdSource=process.argv.includes('--third-source');
const thirdFront=process.argv.includes('--third-front');
const thirdBoundary=process.argv.includes('--third-boundary');
const thirdRear=process.argv.includes('--third-rear');
const fourthSource=process.argv.includes('--fourth-source');
const fourthReplay=process.argv.includes('--fourth-replay');
const nextRequested=process.argv.find(arg=>
  arg.startsWith('--next-through='));
const nextThrough=nextRequested?Number(nextRequested.slice(15)):null;
const freshLaunchBoundary=process.argv.includes(
  '--fresh-launch-boundary');
const freshAttackSolos=process.argv.includes(
  '--fresh-attack-solos');
const fifthFront=process.argv.includes('--fifth-front');
const fifthReplay=process.argv.includes('--fifth-replay');
const sixthSourceBoundary=process.argv.includes(
  '--sixth-source-boundary');
const sixthRiderBoundary=process.argv.includes(
  '--sixth-rider-boundary');
if((secondFront||boundaryChoice||secondRear||thirdSource)&&!complete||
  thirdSource&&!secondRear||thirdFront&&!secondRear||
  thirdBoundary&&!secondRear||thirdRear&&!secondRear||
  fourthSource&&!thirdRear||fourthReplay&&!thirdRear||
  nextThrough!==null&&!fourthReplay||
  freshLaunchBoundary&&!fourthReplay||
  freshAttackSolos&&!fourthReplay||
  fifthFront&&!fourthReplay||
  fifthReplay&&!fourthReplay||
  sixthSourceBoundary&&!fifthReplay||
  sixthRiderBoundary&&!fifthReplay)
  throw new Error('Continuation audit needs --complete.');
if(nextThrough!==null&&(!Number.isInteger(nextThrough)||
  nextThrough<5||nextThrough>260))
  throw new Error('Next physical audit needs km 5 through 260.');
if(!Number.isInteger(seedCount)||seedCount<1||seedCount>3)
  throw new Error('First-km physical audit needs one to three seeds.');
const cases=[];
for(let seed=1;seed<=seedCount;seed++)
  for(const distanceKm of [120,260])
  for(const terrain of ['flat','mountain'])
  for(const fatigue of [0,30]){
    if(caseFilter&&caseFilter!==
      `${distanceKm}-${terrain}-${fatigue}`)continue;
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
      let fourthTrace=null,fourthRefusal=null;
      if(fourthReplay&&thirdRearTrace)try{
        fourthTrace=replayV94PhysicalFourthKmV1(recording);
        validateV94PhysicalFourthKmV1(recording,fourthTrace);
      }catch(error){fourthRefusal=error.message;}
      let freshLaunch=null,freshLaunchRefusal=null;
      if(freshLaunchBoundary&&fourthTrace)try{
        freshLaunch=inspectV94PhysicalFreshLaunchBoundaryV1(
          recording,fourthTrace);
        validateV94PhysicalFreshLaunchBoundaryV1(
          recording,fourthTrace,freshLaunch);
      }catch(error){freshLaunchRefusal=error.message;}
      let freshSolo=null,freshSoloRefusal=null;
      if(freshAttackSolos&&fourthTrace)try{
        freshSolo=replayV94PhysicalFreshAttackSolosV1(
          recording,fourthTrace);
        validateV94PhysicalFreshAttackSolosV1(
          recording,fourthTrace,freshSolo);
      }catch(error){freshSoloRefusal=error.message;}
      let fifthFrontTrace=null,fifthFrontRefusal=null;
      if(fifthFront&&fourthTrace)try{
        fifthFrontTrace=replayV94PhysicalFifthFrontKmV1(
          recording,fourthTrace);
        validateV94PhysicalFifthFrontKmV1(
          recording,fourthTrace,fifthFrontTrace);
      }catch(error){fifthFrontRefusal=error.message;}
      let fifthTrace=null,fifthRefusal=null,fifthEvidence=null;
      if(fifthReplay&&fourthTrace)try{
        fifthTrace=replayV94PhysicalFifthKmV1(
          recording,fourthTrace);
        validateV94PhysicalFifthKmV1(
          recording,fourthTrace,fifthTrace);
      }catch(error){
        fifthRefusal=error.message;
        fifthEvidence=error.sourceEvidence??null;
      }
      let sixthBoundary=null,sixthBoundaryRefusal=null;
      if(sixthSourceBoundary&&fifthTrace)try{
        sixthBoundary=inspectV94PhysicalSixthSourceBoundaryV1(
          recording,fifthTrace);
        validateV94PhysicalSixthSourceBoundaryV1(
          recording,fifthTrace,sixthBoundary);
      }catch(error){sixthBoundaryRefusal=error.message;}
      let sixthRiders=null,sixthRiderRefusal=null;
      if(sixthRiderBoundary&&fifthTrace)try{
        sixthRiders=decideV94PhysicalSixthRiderBoundaryV1(
          recording,fifthTrace);
        validateV94PhysicalSixthRiderBoundaryV1(
          recording,fifthTrace,sixthRiders);
      }catch(error){sixthRiderRefusal=error.message;}
      let nextTrace=fourthTrace,nextRefusal=null;
      let nextRefusalKm=null,nextRefusalEvidence=null;
      if(nextThrough!==null&&fourthTrace){
        for(let km=5;km<=Math.min(nextThrough,
          recording.route.kilometres.length);km++)try{
          const candidate=replayV94PhysicalNextKmV1(
            recording,nextTrace);
          validateV94PhysicalNextKmV1(
            recording,nextTrace,candidate);
          nextTrace=candidate;
        }catch(error){
          nextRefusal=error.message;
          nextRefusalKm=km;
          const frame=recording.frames[km-1];
          nextRefusalEvidence={
            frontPlanStatus:
              frame?.pelotonFrontTurnPlan?.status??null,
            frontTurnCount:
              frame?.pelotonFrontTurnPlan?.turns?.length??0,
            attackers:frame?.attackers?.length??0,
            joinedBreakawayRiders:
              frame?.joinedBreakawayRiderIds?.length??0,
            breakawayRiders:
              frame?.breakawayRiderIds?.length??0,
            roadGroups:frame?.roadGroups?.length??0,
            roadGroupDetails:frame?.roadGroups?.map(group=>({
              id:group.id,riderIds:group.riderIds,
              gapSeconds:group.gapSeconds}))??[],
            roadGroupTurnPlans:frame?.roadGroupTurnPlans??[],
            sourceAttackContributions:
              frame?.attackContributions??[],
            attackerPhysicalStarts:(frame?.attackers??[]).map(
              riderId=>({riderId,
                priorPhysicalGroup:nextTrace?.finishes.find(row=>
                  row.riderId===riderId)?.physicalGroup??null,
                sourceDecision:frame?.freshAttackRiderDecisions
                  ?.find(row=>row.riderId===riderId)??null,
                sourceEnergy:frame?.energyLedger?.find(row=>
                  row.riderId===riderId)??null})),
            sourceContactEvidence:error.sourceEvidence??null};
          break;
        }
      }
      const fourth=fourthSource?recording.frames[3]:null;
      const physicalFrontAtThree=new Set(
        thirdRearTrace?.finishes.filter(row=>
          row.physicalGroup==='peloton').map(row=>row.riderId)??[]);
      const fourthTurns=fourth?.pelotonFrontTurnPlan?.turns??[];
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
          ...(fourthSource?{
            fourthKmSourceFront:
              fourth?.pelotonFrontTurnPlan?.status??null,
            fourthKmLeadersAttached:fourthTurns.every(row=>
              physicalFrontAtThree.has(row.leaderRiderId)),
            fourthKmSourceHasAttack:!!(fourth?.attackers.length||
              fourth?.joinedBreakawayRiderIds.length||
              fourth?.breakawayRiderIds.length||
              fourth?.roadGroups.length)}:{}),
          ...(fourthReplay?{
            fourthKmFullField:fourthTrace?.fullFieldKilometre??false,
            fourthKmRearGroups:
              fourthTrace?.physicalRearGroups.length??0,
            fourthKmNewFrontDrops:
              fourthTrace?.newFrontDrops.length??0,
            fourthKmCoincidentDropSets:
              fourthTrace?.coincidentNewFrontDropSets.length??0,
            fourthRefusal}:{}),
          ...(nextThrough!==null?{
            nextCompletedThroughKm:nextTrace?.sourceKm??null,
            nextRearGroups:nextTrace?.physicalRearGroups.length??0,
            nextRefusalKm,nextRefusal,nextRefusalEvidence}:{}),
          ...(freshLaunchBoundary?{
            freshLaunchDecisions:freshLaunch?.decisions.length??0,
            freshLaunchSourcePaidPlan:
              freshLaunch?.sourceNewBreakHasPaidTurnPlan??null,
            freshLaunchRefusal}:{}),
          ...(freshAttackSolos?{
            freshSoloRoads:freshSolo?.roads.length??0,
            freshSoloAhead:freshSolo?.roads.filter(row=>
              row.earnedLeadSecondsAtBoundary>0).length??0,
            freshSoloSourceBreakAheadMismatches:
              freshSolo?.sourceBreakAheadMismatchRiderIds.length??0,
            freshSoloSourceRoads:
              freshSolo?.sourceCheckpointComparisons.length??0,
            freshSoloLargestSourceGapExcessSeconds:
              freshSolo?.sourceCheckpointComparisons.length?
                Math.max(...freshSolo.sourceCheckpointComparisons.map(
                  row=>row.sourceGapMinusMaxIndividualLeadSeconds)):
                null,
            freshSoloCoincidentSets:
              freshSolo?.coincidentSoloSets.length??0,
            freshSoloRefusal}:{}),
          ...(fifthFront?{
            fifthFrontRiderKilometres:
              fifthFrontTrace?.completeFrontRiderKilometres??0,
            fifthFrontNewDrops:fifthFrontTrace?.atFrontClock.filter(
              row=>!row.attached).length??0,
            fifthFrontExcludedAttackers:
              fifthFrontTrace?.excludedFreshAttackRiderIds.length??0,
            fifthFrontRefusal}:{}),
          ...(fifthReplay?{
            fifthFullField:fifthTrace?.fullFieldKilometre??false,
            fifthRearGroups:
              fifthTrace?.physicalRearGroups.length??0,
            fifthAttackSolos:
              fifthTrace?.freshAttackSoloRiderIds.length??0,
            fifthRefusal,fifthEvidence}:{}),
          ...(sixthSourceBoundary?{
            sixthSourceRoads:sixthBoundary?.sourceRoads.length??0,
            sixthUnattachableSourceRoads:
              sixthBoundary?.sourceRoads.filter(row=>
                row.sourcePlanCannotAttach).length??0,
            sixthNoncoincidentSourceRoads:
              sixthBoundary?.sourceRoads.filter(row=>
                !row.physicallyCoLocatedAtBoundary).length??0,
            sixthLargestClockSpreadSeconds:
              sixthBoundary?.sourceRoads.length?Math.max(
                ...sixthBoundary.sourceRoads.map(row=>
                  row.boundaryClockSpreadSeconds)):null,
            sixthBoundaryRefusal}:{}),
          ...(sixthRiderBoundary?{
            sixthRiderDecisions:
              sixthRiders?.decisions.length??0,
            sixthRiderBreakClaims:
              sixthRiders?.decisions.filter(row=>
                row.sourceBreakMembershipClaim).length??0,
            sixthRiderPhysicallyAhead:
              sixthRiders?.decisions.filter(row=>
                row.relativeToPaidFrontSeconds<0).length??0,
            sixthRiderRefusal}:{}),
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
  fourthSource,fourthReplay,nextThrough,freshLaunchBoundary,
  freshAttackSolos,fifthFront,fifthReplay,sixthSourceBoundary,
  sixthRiderBoundary,
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
  fourthKmSourceWorked:accepted.filter(row=>
    row.fourthKmSourceFront==='worked').length,
  fourthKmLeadersAttached:accepted.filter(row=>
    row.fourthKmSourceFront==='worked'&&
    row.fourthKmLeadersAttached).length,
  fourthKmSourceHasAttack:accepted.filter(row=>
    row.fourthKmSourceHasAttack).length,
  fourthKmFullFields:accepted.filter(row=>
    row.fourthKmFullField).length,
  fourthKmRearGroups:accepted.reduce((sum,row)=>
    sum+(row.fourthKmRearGroups??0),0),
  fourthKmNewFrontDrops:accepted.reduce((sum,row)=>
    sum+(row.fourthKmNewFrontDrops??0),0),
  fourthKmCoincidentDropSets:accepted.reduce((sum,row)=>
    sum+(row.fourthKmCoincidentDropSets??0),0),
  nextCompletedThroughKm:accepted.map(row=>
    row.nextCompletedThroughKm).filter(Number.isInteger),
  nextRefusalKilometres:accepted.filter(row=>
    row.nextRefusalKm!==null&&row.nextRefusalKm!==undefined)
    .map(row=>({seed:row.seed,distanceKm:row.distanceKm,
      terrain:row.terrain,fatigue:row.fatigue,
      km:row.nextRefusalKm,refusal:row.nextRefusal,
      evidence:row.nextRefusalEvidence})),
  freshLaunchObservations:accepted.filter(row=>
    row.freshLaunchRefusal===null&&
    row.freshLaunchDecisions>0).length,
  freshLaunchDecisions:accepted.reduce((sum,row)=>
    sum+(row.freshLaunchDecisions??0),0),
  freshLaunchPaidPlans:accepted.filter(row=>
    row.freshLaunchSourcePaidPlan===true).length,
  freshSoloCases:accepted.filter(row=>
    row.freshSoloRefusal===null&&row.freshSoloRoads>0).length,
  freshSoloRoads:accepted.reduce((sum,row)=>
    sum+(row.freshSoloRoads??0),0),
  freshSoloAhead:accepted.reduce((sum,row)=>
    sum+(row.freshSoloAhead??0),0),
  freshSoloSourceBreakAheadMismatches:accepted.reduce(
    (sum,row)=>sum+
      (row.freshSoloSourceBreakAheadMismatches??0),0),
  freshSoloSourceRoads:accepted.reduce((sum,row)=>
    sum+(row.freshSoloSourceRoads??0),0),
  freshSoloLargestSourceGapExcessSeconds:freshAttackSolos&&
    accepted.some(row=>row.freshSoloSourceRoads>0)?Math.max(
      ...accepted.map(row=>
        row.freshSoloLargestSourceGapExcessSeconds??-Infinity)):
    null,
  freshSoloCoincidentSets:accepted.reduce((sum,row)=>
    sum+(row.freshSoloCoincidentSets??0),0),
  fifthFrontCases:accepted.filter(row=>
    row.fifthFrontRefusal===null&&
    row.fifthFrontExcludedAttackers>0).length,
  fifthFrontRiderKilometres:accepted.reduce((sum,row)=>
    sum+(row.fifthFrontRiderKilometres??0),0),
  fifthFrontNewDrops:accepted.reduce((sum,row)=>
    sum+(row.fifthFrontNewDrops??0),0),
  fifthFullFields:accepted.filter(row=>
    row.fifthFullField).length,
  fifthRearGroups:accepted.reduce((sum,row)=>
    sum+(row.fifthRearGroups??0),0),
  fifthAttackSolos:accepted.reduce((sum,row)=>
    sum+(row.fifthAttackSolos??0),0),
  sixthSourceRoads:accepted.reduce((sum,row)=>
    sum+(row.sixthSourceRoads??0),0),
  sixthUnattachableSourceRoads:accepted.reduce((sum,row)=>
    sum+(row.sixthUnattachableSourceRoads??0),0),
  sixthNoncoincidentSourceRoads:accepted.reduce((sum,row)=>
    sum+(row.sixthNoncoincidentSourceRoads??0),0),
  sixthLargestClockSpreadSeconds:sixthSourceBoundary&&
    accepted.some(row=>row.sixthSourceRoads>0)?Math.max(
      ...accepted.map(row=>
        row.sixthLargestClockSpreadSeconds??-Infinity)):
    null,
  sixthRiderDecisions:accepted.reduce((sum,row)=>
    sum+(row.sixthRiderDecisions??0),0),
  sixthRiderBreakClaims:accepted.reduce((sum,row)=>
    sum+(row.sixthRiderBreakClaims??0),0),
  sixthRiderPhysicallyAhead:accepted.reduce((sum,row)=>
    sum+(row.sixthRiderPhysicallyAhead??0),0),
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
      fatigue:row.fatigue,refusal:row.thirdRearRefusal})),
  fourthRefusals:accepted.filter(row=>
    row.fourthRefusal).map(row=>({seed:row.seed,
      distanceKm:row.distanceKm,terrain:row.terrain,
      fatigue:row.fatigue,refusal:row.fourthRefusal})),
  freshLaunchRefusals:accepted.filter(row=>
    row.freshLaunchRefusal).map(row=>({seed:row.seed,
      distanceKm:row.distanceKm,terrain:row.terrain,
      fatigue:row.fatigue,refusal:row.freshLaunchRefusal})),
  freshSoloRefusals:accepted.filter(row=>
    row.freshSoloRefusal).map(row=>({seed:row.seed,
      distanceKm:row.distanceKm,terrain:row.terrain,
      fatigue:row.fatigue,refusal:row.freshSoloRefusal})),
  fifthFrontRefusals:accepted.filter(row=>
    row.fifthFrontRefusal).map(row=>({seed:row.seed,
      distanceKm:row.distanceKm,terrain:row.terrain,
      fatigue:row.fatigue,refusal:row.fifthFrontRefusal})),
  fifthRefusals:accepted.filter(row=>
    row.fifthRefusal).map(row=>({seed:row.seed,
      distanceKm:row.distanceKm,terrain:row.terrain,
      fatigue:row.fatigue,refusal:row.fifthRefusal,
      evidence:row.fifthEvidence})),
  sixthBoundaryRefusals:accepted.filter(row=>
    row.sixthBoundaryRefusal).map(row=>({seed:row.seed,
      distanceKm:row.distanceKm,terrain:row.terrain,
      fatigue:row.fatigue,refusal:row.sixthBoundaryRefusal})),
  sixthRiderRefusals:accepted.filter(row=>
    row.sixthRiderRefusal).map(row=>({seed:row.seed,
      distanceKm:row.distanceKm,terrain:row.terrain,
      fatigue:row.fatigue,refusal:row.sixthRiderRefusal}))},
null,2));
