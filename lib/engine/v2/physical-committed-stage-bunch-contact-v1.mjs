// A conserving released solo can meet the paid bunch again. This
// records the first clock crossing only; a new choice and shared road
// are required before either path can be continued through the km.
import {isDeepStrictEqual} from 'node:util';
import {advancePhysicalBunchAfterStageReleaseContinuationKmV1} from
  './physical-start-bunch-v1.mjs';
import {replayPhysicalCommittedStageReleaseKmV1,
  advancePhysicalCommittedStageReleaseSoloKmV1,
  projectPhysicalCommittedStageReleaseSoloPaceV1} from
  './physical-committed-stage-release-km-v1.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';

export const PHYSICAL_COMMITTED_STAGE_BUNCH_CONTACT_VERSION=
  'v2-physical-committed-stage-bunch-contact-1';

export function probePhysicalCommittedStageBunchContactV1({
  startInput,start,riderId,releaseKm,throughKm}){
  const first=replayPhysicalCommittedStageReleaseKmV1({
    startInput,start,riderId,releaseKm});
  if(!Number.isInteger(throughKm)||
    throughKm<=releaseKm||
    throughKm>startInput.routeKilometres.length)
    throw new Error('Stage bunch contact needs later road.');
  let bunchPrior=first.sources.bunch.step;
  let bunchClock=first.kilometres.at(-1)
    .riderStates.find(row=>
      row.physicalGroupId==='peloton').elapsedSeconds;
  let soloClock=first.sources.release.elapsedSeconds;
  let soloEnergy=first.sources.release.energyAfter;
  let gap=first.sources.release.gapSecondsToBunch;
  const earlier=[];
  for(let km=releaseKm+1;km<=throughKm;km++){
    const segment=startInput.routeKilometres[km-1];
    const prior={riderIds:bunchPrior.physicalGroup.riderIds,
      energyByRider:bunchPrior.energyByRider,
      quietKmByRider:bunchPrior.quietKmByRider};
    const bunch=advancePhysicalBunchAfterStageReleaseContinuationKmV1({
      startInput,prior,segment,riderId});
    const projection=projectPhysicalCommittedStageReleaseSoloPaceV1({
      startInput,riderId,km,energyBefore:soloEnergy});
    const nextBunchClock=bunchClock+bunch.elapsedSeconds;
    const nextGap=soloClock+
      projection.secondsPerKm-nextBunchClock;
    if(nextGap>0){
      const solo=advancePhysicalCommittedStageReleaseSoloKmV1({
        startInput,riderId,km,
        energyBefore:soloEnergy,
        previousClock:soloClock,previousGap:gap});
      earlier.push({sourceKm:km,bunch,solo,
        gapSecondsToBunch:nextGap});
      bunchPrior=bunch;
      bunchClock=nextBunchClock;
      soloClock=solo.elapsedSeconds;
      soloEnergy=solo.energyAfter;
      gap=nextGap;
      continue;
    }
    const closingSecondsPerKm=
      bunch.elapsedSeconds-
        projection.secondsPerKm;
    const metresIntoKm=gap/
      closingSecondsPerKm*1000;
    if(closingSecondsPerKm<=0||
      metresIntoKm<=0||metresIntoKm>1000)
      throw new Error('Stage contact lacks crossing paid clocks.');
    const contactClock=soloClock+
      projection.secondsPerKm*metresIntoKm/1000;
    if(Math.abs(contactClock-(bunchClock+
      bunch.elapsedSeconds*metresIntoKm/1000))>1e-7)
      throw new Error('Stage contact clocks differ.');
    const paid=priceRearEnergyDemandV1({
      rider:projection.rider,segment,
      energyBefore:soloEnergy,
      effort:'conserve',role:'solo',
      distanceM:metresIntoKm});
    const reserve=projection.intent
      .committedStagePlan.reserveEnergy;
    if(paid.energyAfter<reserve)
      throw new Error('Stage contact breaks committed reserve.');
    const bunchRiders=bunch.physicalGroup.riderIds.map(id=>{
      const row=bunch.riders.find(item=>
        item.riderId===id);
      return {riderId:id,
        role:row.role,
        energyBefore:row.energyBefore,
        energySpentToContact:row.energySpent*
          metresIntoKm/1000,
        energyAtContact:row.energyBefore-
          row.energySpent*metresIntoKm/1000};
    });
    if(bunchRiders.length!==prior.riderIds.length||
      bunchRiders.some(row=>
        !Number.isFinite(row.energyAtContact)||
        row.energyAtContact<0)||
      bunchRiders.filter(row=>
        row.role==='leader').length!==1)
      throw new Error('Stage contact lacks paid bunch riders.');
    const contact={sourceKm:km,riderId,
      atDistanceM:(km-1)*1000+metresIntoKm,
      metresIntoKm,clockSeconds:contactClock,
      previousGapSeconds:gap,
      closingSecondsPerKm,
      soloEnergyBefore:soloEnergy,
      soloEnergySpentToContact:paid.energyDemand,
      soloEnergyAtContact:paid.energyAfter,
      bunchLeaderRiderId:bunch.leaderRiderId,
      bunchRiders,
      physicalGroupsStillSeparate:true,
      nextChoiceUnsettled:true};
    return {version:
      PHYSICAL_COMMITTED_STAGE_BUNCH_CONTACT_VERSION,
    throughKm,releaseKm,riderId,
    sources:{first,earlier,
      bunchPaceProjection:{sourceKm:km,
        secondsPerKm:bunch.elapsedSeconds,
        leaderRiderId:bunch.leaderRiderId},
      soloPaceProjection:{sourceKm:km,
        secondsPerKm:projection.secondsPerKm,
        energyBefore:soloEnergy}},
    contact,movesGuidedRace:false,
    officialResults:false};
  }
  return {version:
    PHYSICAL_COMMITTED_STAGE_BUNCH_CONTACT_VERSION,
  throughKm,releaseKm,riderId,
  sources:{first,earlier},contact:null,
  movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalCommittedStageBunchContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    probePhysicalCommittedStageBunchContactV1(input)))
    throw new Error('Stage bunch contact differs from paid source.');
  return true;
}
