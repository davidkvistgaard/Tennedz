// Locate a caught break rider meeting a newly dropped bunch rider
// on their separately paid road. A meeting creates no group until
// the remaining kilometre has a willing, affordable named leader.
import {isDeepStrictEqual} from 'node:util';
import {advancePhysicalBunchAfterCaughtSlideLossKmV1} from
  './physical-start-bunch-v1.mjs';
import {completePhysicalPostCatchLossKmV1} from
  './physical-pace-loss-completion-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_POSTCATCH_SPLIT_CONTACT_VERSION=
  'v2-physical-postcatch-split-contact-1';

export function contactPhysicalPostcatchSplitV1({
  roadInput,loss,completion,priorBunchClock,
  frontRiderId,priorFrontClock,frontEnergyBefore}){
  if(!isDeepStrictEqual(loss,
    advancePhysicalBunchAfterCaughtSlideLossKmV1(
      roadInput))||
    !Number.isFinite(priorBunchClock)||
    !Number.isFinite(priorFrontClock)||
    priorFrontClock<=priorBunchClock||
    !Number.isFinite(frontEnergyBefore)||
    frontEnergyBefore<0||
    typeof frontRiderId!=='string'||
    frontRiderId!==roadInput.caughtRiderId||
    !isDeepStrictEqual(completion,
      completePhysicalPostCatchLossKmV1({
        ...roadInput,loss,
        priorBunchElapsedSeconds:priorBunchClock,
        riderId:completion?.riderId})))
    throw new Error('Post-catch contact needs paid split source.');
  const {startInput,segment}=roadInput;
  const split=loss.splits.find(row=>
    row.riderId===completion.riderId);
  const partial=loss.riders.find(row=>
    row.riderId===completion.riderId);
  const splitDecision=loss.riderDecisions.find(row=>
    row.riderId===completion.riderId);
  const frontRider=startInput.teams.flatMap(team=>
    team.riders).find(row=>row.id===frontRiderId);
  const dropRider=startInput.teams.flatMap(team=>
    team.riders).find(row=>row.id===completion.riderId);
  if(!split||!partial||!splitDecision||
    !frontRider||!dropRider)
    throw new Error('Post-catch contact lacks paid riders.');
  const splitM=split.atDistanceM-
    (segment.km-1)*1000;
  const firstDropSeconds=3600/split.soloSpeedKph;
  const frontEffect=riderKilometreEffect(frontRider,
    segment,{phase:'solo',energy:frontEnergyBefore,
      exposed:segment.exposed});
  const frontSeconds=segmentBaseSeconds(segment)+
    (50-frontEffect.ability-
      (TUNING.effortPressure.conserve-1)*20)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  const dropAtSplit=priorBunchClock+
    firstDropSeconds*splitM/1000;
  const frontAtSplit=priorFrontClock+
    frontSeconds*splitM/1000;
  const secondDropSeconds=(
    completion.elapsedSeconds-dropAtSplit)/
    (1-splitM/1000);
  if(!Number.isFinite(frontSeconds)||
    !Number.isFinite(secondDropSeconds)||
    frontSeconds<=0||secondDropSeconds<=0||
    Math.abs(dropAtSplit-
      (priorBunchClock+loss.elapsedSeconds))>1e-7)
    throw new Error('Post-catch contact needs paid clocks.');
  const inFirstLeg=frontAtSplit<=dropAtSplit;
  const dropSeconds=inFirstLeg?
    firstDropSeconds:secondDropSeconds;
  const dropStartClock=inFirstLeg?
    priorBunchClock:dropAtSplit;
  const dropStartM=inFirstLeg?0:splitM;
  const frontAtStart=priorFrontClock+
    frontSeconds*dropStartM/1000;
  const gain=dropSeconds-frontSeconds;
  const distanceFromLegStartM=(
    frontAtStart-dropStartClock)/gain*1000;
  const contactM=dropStartM+distanceFromLegStartM;
  if(!Number.isFinite(contactM)||gain<=0||
    distanceFromLegStartM<=0||
    contactM>=1000||
    (inFirstLeg&&contactM>splitM)||
    (!inFirstLeg&&contactM<=splitM))
    throw new Error('Post-catch riders have no paid contact here.');
  const contactClock=priorFrontClock+
    frontSeconds*contactM/1000;
  const dropClock=dropStartClock+
    dropSeconds*distanceFromLegStartM/1000;
  const bunchClock=priorBunchClock+
    loss.elapsedSeconds*contactM/1000;
  if(Math.abs(contactClock-dropClock)>1e-7||
    contactClock<=bunchClock)
    throw new Error('Post-catch meeting needs a rear clock.');
  const frontPaid=priceRearEnergyDemandV1({
    rider:frontRider,segment,
    energyBefore:frontEnergyBefore,effort:'conserve',
    role:'solo',distanceM:contactM});
  const dropFirst=priceRearEnergyDemandV1({
    rider:dropRider,segment,
    energyBefore:partial.energyBefore,
    effort:splitDecision.effort,role:'solo',
    distanceM:Math.min(contactM,splitM)});
  const dropSecond=inFirstLeg?null:
    priceRearEnergyDemandV1({
      rider:dropRider,segment,
      energyBefore:partial.energyAfter,
      effort:splitDecision.effort,role:'solo',
      distanceM:contactM-splitM});
  return {
    version:PHYSICAL_POSTCATCH_SPLIT_CONTACT_VERSION,
    sourceKm:segment.km,
    contactAtDistanceM:(segment.km-1)*1000+
      contactM,
    contactClockSeconds:contactClock,
    behindBunchSeconds:contactClock-bunchClock,
    phase:inFirstLeg?'before_bunch_km_end':
      'after_bunch_km_end',
    frontRiderId,detachedRiderId:completion.riderId,
    riders:[{
      riderId:frontRiderId,
      energyBefore:frontEnergyBefore,
      energySpent:frontPaid.energyDemand,
      energyAfter:frontPaid.energyAfter,
      effort:'conserve'},{
      riderId:completion.riderId,
      energyBefore:partial.energyBefore,
      energySpent:dropFirst.energyDemand+
        (dropSecond?.energyDemand??0),
      energyAfter:dropSecond?.energyAfter??
        dropFirst.energyAfter,
      effort:splitDecision.effort}],
    remainingKmUnsettled:true,
    officialResults:false};
}

export function validatePhysicalPostcatchSplitContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    contactPhysicalPostcatchSplitV1(input)))
    throw new Error('Post-catch contact differs from paid source.');
  return true;
}
