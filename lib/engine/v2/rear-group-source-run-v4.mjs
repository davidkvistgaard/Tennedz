// Opt-in full-kilometre rear ledger: paid terrain work, source-derived
// capacity ceiling and explicit zero rear recovery. Contact still needs a
// separate road for the untravelled remainder.
import {isDeepStrictEqual} from 'node:util';
import {decideRearGroupChoiceV2} from './rear-group-choice-v2.mjs';
import {advanceRearGroupFromPaidSourceV3} from
  './rear-group-source-road-v3.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {MOTOR_RECOVERY_CEILING} from './tuning.mjs';

export const REAR_GROUP_SOURCE_RUN_V4_VERSION=
  'v2-rear-group-source-run-4';

export function runRearGroupSourceV4({initialChoiceInput,initialChoice,
  routeKilometres,kilometres}){
  if(!isDeepStrictEqual(initialChoice,
    decideRearGroupChoiceV2(initialChoiceInput))||
    !Array.isArray(routeKilometres)||
    !Array.isArray(kilometres)||!kilometres.length)
    throw new Error('Rear cap run needs replayed contact and route.');
  const riders=new Map(initialChoiceInput.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const roster=initialChoiceInput.teams.map(team=>[team.id,team.riders]);
  let group=initialChoice.group.continuation.rearGroup;
  const contactSegment=initialChoiceInput.contactInput.segment;
  // The contact trace binds its own segment and the one before it, but
  // no earlier route. After cap decay begins, a caller could otherwise
  // change unrecorded precontact climbs to manufacture a different cap.
  if(contactSegment.km>MOTOR_RECOVERY_CEILING.afterKm)
    throw new Error('Rear cap needs sourced precontact decay route.');
  if(!isDeepStrictEqual(routeKilometres[group.atDistanceM/1000-1],
    contactSegment)||
    ['front','rear'].some(side=>{
      const prior=initialChoiceInput.contactInput[side].priorSource.segment;
      return !isDeepStrictEqual(routeKilometres[prior.km-1],prior);
    })||group.riderIds.some(id=>group.energyByRider[id]>
    replayRearEnergyCapV1({rider:riders.get(id),
      kilometres:routeKilometres,throughKm:contactSegment.km}).cap+1e-6))
    throw new Error('Rear cap needs the committed contact route and reserve.');
  let nextKm=initialChoice.group.sourceKm+1;
  const steps=[];
  for(const kilometre of kilometres){
    const segment=kilometre?.segment;
    if(!group||kilometre?.group!==undefined||
      segment?.km!==nextKm||
      !isDeepStrictEqual(routeKilometres[nextKm-1],segment)||
      !Array.isArray(kilometre.teams)||
      !isDeepStrictEqual(kilometre.teams.map(team=>
        [team.id,team.riders]),roster))
      throw new Error('Rear cap run needs consecutive committed road.');
    const sourceStep=advanceRearGroupFromPaidSourceV3({
      ...kilometre,group});
    if(sourceStep.road.event)
      throw new Error('Rear cap run needs postcontact road before settlement.');
    const decisions=new Map(sourceStep.sourceV2.sourceRoad.memberDecisions.map(
      row=>[row.riderId,row]));
    const settlement=sourceStep.prices.map(price=>{
      const rider=riders.get(price.riderId);
      const capSource=replayRearEnergyCapV1({rider,
        kilometres:routeKilometres,throughKm:nextKm});
      const recovery=recoveryForKilometre({rider,segment,
        effort:decisions.get(rider.id).effort,group:'dropped',
        working:price.role==='leader',quietKm:0});
      if(recovery.recovery!==0||recovery.quietKm!==0)
        throw new Error('Rear road cannot award bunch recovery.');
      const capAdjustment=Math.max(0,price.energyAfter-capSource.cap);
      return {riderId:rider.id,role:price.role,
        energyBefore:price.energyBefore,paidWork:price.energyDemand,
        recoveryAward:0,cap:capSource.cap,capAdjustment,
        energyAfter:+Math.min(price.energyAfter,capSource.cap).toFixed(3)};
    });
    const settledGroup={...sourceStep.road.rearGroup,
      energyByRider:Object.fromEntries(settlement.map(row=>
        [row.riderId,row.energyAfter]))};
    steps.push({sourceStep,settlement,settledGroup});
    group=settledGroup;
    nextKm++;
  }
  return {version:REAR_GROUP_SOURCE_RUN_V4_VERSION,
    initialGroupId:initialChoice.groupId,steps,
    finalRearGroup:group,officialResults:false};
}

export function validateRearGroupSourceRunV4(input,recording){
  if(!isDeepStrictEqual(recording,runRearGroupSourceV4(input)))
    throw new Error('Rear cap run differs from paid source.');
  return true;
}
