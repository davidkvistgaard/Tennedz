// An independently paid rear solo may join an already paid rear group only
// at their calculated road contact. The new three-rider group stops there.
import {isDeepStrictEqual} from 'node:util';
import {runRearGroupSourceV1} from './rear-group-source-run-v1.mjs';
import {advanceRearGroupFromPaidSourceV1} from
  './rear-group-source-road-v1.mjs';
import {runRearSoloSourceV1} from './rear-solo-source-run-v1.mjs';
import {advanceRearSoloRoadV1} from './rear-solo-road-v1.mjs';
import {advanceFinaleGap} from './finale-step.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_GROUP_SOLO_JOIN_VERSION='v2-rear-group-solo-join-1';

export function advanceRearGroupSoloJoinV1({priorRunInput,priorRun,
  priorSoloRunInput,priorSoloRun,soloRider,segment,bunchTurnPlan,teams,
  rearGoals,roadGroups=[],stageNumber,stageCount,soloEffort,
  soloReason}){
  if(!isDeepStrictEqual(priorRun,runRearGroupSourceV1(priorRunInput)))
    throw new Error('Rear join needs a replayed prior group.');
  const group=priorRun.finalRearGroup;
  if(!isDeepStrictEqual(priorSoloRun,
    runRearSoloSourceV1(priorSoloRunInput)))
    throw new Error('Rear join needs a replayed paid solo.');
  const soloPrior=priorSoloRun.finalSolo;
  if(!group||
    soloPrior.status!=='solo_behind'||
    !Number.isInteger(segment?.km)||
    segment.km!==priorRun.steps.at(-1).sourceKm+1||
    segment.km!==soloPrior.sourceKm+1||
    soloPrior.endDistanceM!==group.atDistanceM||
    soloPrior.riderId!==soloRider?.id||
    !isDeepStrictEqual(soloRider,
      priorSoloRunInput.initialInput.rider)||
    group.riderIds.includes(soloRider.id)||
    !Array.isArray(teams)||
    !isDeepStrictEqual(teams.map(team=>[team.id,team.riders]),
      priorRunInput.initialChoiceInput.teams.map(team=>
        [team.id,team.riders]))||
    !teams?.some(team=>team.riders.some(rider=>
      isDeepStrictEqual(rider,soloRider))))
    throw new Error('Rear join needs a distinct paid solo at the same marker.');
  const groupPlan=advanceRearGroupFromPaidSourceV1({group,segment,
    bunchTurnPlan,teams,rearGoals,roadGroups,stageNumber,stageCount});
  const soloInput={prior:soloPrior,rider:soloRider,segment,
    bunchTurnPlan,effort:soloEffort,reason:soloReason};
  const soloPlan=advanceRearSoloRoadV1(soloInput);
  if(groupPlan.road.event||soloPlan.event)
    throw new Error('Bunch contact before rear join needs another clock.');
  const initialGap=soloPrior.behindBunchSeconds-
    group.behindBunchSeconds;
  if(initialGap<=0)
    throw new Error('Rear solo must start behind the group.');
  const slice={startDistanceM:(segment.km-1)*1000,
    endDistanceM:segment.km*1000,lengthM:1000};
  const leader=groupPlan.riderPlans.find(row=>
    row.riderId===groupPlan.road.leaderRiderId);
  const soloSeconds=segmentBaseSeconds(segment)+
    (50-soloPlan.riderAbility)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(soloSeconds<=0)throw new Error('Rear solo has invalid paid pace.');
  const movement=advanceFinaleGap({slice,gapSeconds:initialGap,
    frontSpeedKph:leader.speedKph,
    chaseSpeedKph:3600/soloSeconds});
  if(!movement.caught)
    throw new Error('Rear solo does not reach the group in this kilometre.');
  const atDistanceM=movement.catchDistanceM;
  const fraction=(atDistanceM-slice.startDistanceM)/1000;
  const bunchSeconds=1000*3.6/groupPlan.bunchSpeedKph*fraction;
  const groupSeconds=1000*3.6/leader.speedKph*fraction;
  const soloElapsed=soloSeconds*fraction;
  const groupGap=group.behindBunchSeconds+groupSeconds-bunchSeconds;
  const soloGap=soloPrior.behindBunchSeconds+soloElapsed-bunchSeconds;
  if(groupGap<=0||Math.abs(groupGap-soloGap)>1e-6)
    throw new Error('Rear join clocks do not meet behind the bunch.');
  const riders=group.riderIds.map(riderId=>{
    const plan=groupPlan.riderPlans.find(row=>row.riderId===riderId);
    const role=riderId===leader.riderId?'leader':'sheltered';
    const energySpent=fraction*(role==='leader'?
      plan.leadCostPerKm:plan.shelteredCostPerKm);
    const energy=group.energyByRider[riderId]-energySpent;
    if(energy<-1e-9)
      throw new Error('Rear group cannot pay its work to contact.');
    return {riderId,role,energySpent,energy:Math.max(0,energy)};
  });
  const soloEnergySpent=soloPlan.energySpent*fraction;
  const soloEnergy=soloPrior.energyAfter-soloEnergySpent;
  if(soloEnergy<-1e-9)
    throw new Error('Rear solo cannot pay its work to contact.');
  riders.push({riderId:soloRider.id,role:'solo',
    energySpent:soloEnergySpent,energy:Math.max(0,soloEnergy)});
  const joinedGroup={id:group.id,riderIds:[...group.riderIds,
    soloRider.id],atDistanceM,behindBunchSeconds:groupGap,
  turnCount:group.turnCount+1,
  energyByRider:Object.fromEntries(riders.map(row=>
    [row.riderId,row.energy]))};
  return {version:REAR_GROUP_SOLO_JOIN_VERSION,
    sourceKm:segment.km,groupId:group.id,
    groupPlan,soloPlan,atDistanceM,
    bunchElapsedSeconds:bunchSeconds,
    groupElapsedSeconds:groupSeconds,soloElapsedSeconds:soloElapsed,
    riders,joinedGroup,
    event:{kind:'join_rear_group',atDistanceM,groupId:group.id,
      riderIds:[...joinedGroup.riderIds]}};
}

export function validateRearGroupSoloJoinV1(input,recording){
  if(!isDeepStrictEqual(recording,advanceRearGroupSoloJoinV1(input)))
    throw new Error('Rear join differs from its paid road source.');
  return true;
}
