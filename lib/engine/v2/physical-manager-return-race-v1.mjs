// Continue every rider after a slid break rider has physically
// returned to the bunch through source-replayed paid contact.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalManagerReturnKmV1} from
  './physical-manager-return-km-v1.mjs';
import {advancePhysicalBunchAfterReturnKmV1,
  advancePhysicalBunchAfterReturnLossKmV1} from
  './physical-start-bunch-v1.mjs';
import {completePhysicalReturnLossKmV1} from
  './physical-pace-loss-completion-v1.mjs';

export const PHYSICAL_MANAGER_RETURN_RACE_VERSION=
  'v2-physical-manager-return-race-1';

export function replayPhysicalManagerReturnRaceV1(input){
  const returned=replayPhysicalManagerReturnKmV1(input);
  const {startInput,throughKm}=input;
  if(!Number.isInteger(throughKm)||
    throughKm<=returned.sourceKm||
    throughKm>startInput.routeKilometres.length)
    throw new Error('Return race needs later sourced road.');
  const contact=returned.source.contact;
  const priorStep=returned.source.bunchStep;
  let prior={riderIds:contact.physicalGroup.riderIds,
    energyByRider:{...priorStep.energyByRider,
      [contact.riderId]:contact.energyAfter},
    quietKmByRider:{...priorStep.quietKmByRider,
      [contact.riderId]:0}};
  let clock=contact.bunchEndClockSeconds;
  const riderIds=returned.riderIds;
  const later=[];
  for(let km=returned.sourceKm+1;km<=throughKm;km++){
    const segment=startInput.routeKilometres[km-1];
    let step;
    try{
      step=advancePhysicalBunchAfterReturnKmV1({
        startInput,prior,segment,returnContact:contact});
    }catch(error){
      if(error.message===
        'Physical start follower cannot hold paid pace.'){
        const loss=advancePhysicalBunchAfterReturnLossKmV1({
          startInput,prior,segment,returnContact:contact});
        const completionInputs=loss.splits.map(split=>({
          startInput,prior,segment,returnContact:contact,
          priorBunchElapsedSeconds:clock,loss,
          riderId:split.riderId}));
        const completions=completionInputs.map(row=>
          completePhysicalReturnLossKmV1(row));
        if(loss.splits.length===2){
          const splitM=loss.splits.map(row=>
            row.atDistanceM-(km-1)*1000);
          const splitClock=clock+loss.elapsedSeconds;
          const clockAt=(index,distanceM)=>
            distanceM<=splitM[index]?
              clock+loss.elapsedSeconds*
                distanceM/splitM[index]:
              splitClock+(completions[index]
                .elapsedSeconds-splitClock)*
                (distanceM-splitM[index])/
                (1000-splitM[index]);
          const checkpoints=[Math.min(...splitM),
            Math.max(...splitM),1000];
          const signs=checkpoints.map(distanceM=>
            Math.sign(clockAt(1,distanceM)-
              clockAt(0,distanceM)));
          if(signs.includes(0)||
            new Set(signs).size!==1)
            throw new Error(
              'Return loss solos need paid contact.');
        }
        const nextClock=clock+loss.elapsedSeconds;
        const decisions=new Map(loss.riderDecisions.map(
          row=>[row.riderId,row]));
        const states=loss.physicalGroup.riderIds.map(
          riderId=>{
            const row=loss.riders.find(item=>
              item.riderId===riderId);
            return {riderId,sourceKm:km,
              physicalGroupId:'peloton',
              atDistanceM:km*1000,
              elapsedSeconds:nextClock,
              energyAfter:row.energyAfter,
              decisions:[decisions.get(riderId)]};
          });
        for(const row of completions)
          states.push({riderId:row.riderId,
            sourceKm:km,
            physicalGroupId:row.physicalGroup.id,
            atDistanceM:km*1000,
            elapsedSeconds:row.elapsedSeconds,
            energyAfter:row.energyAfter,
            decisions:[row.decision]});
        if(states.length!==riderIds.length||
          new Set(states.map(row=>row.riderId))
            .size!==riderIds.length||
          states.some(row=>!row.decisions[0]||
            row.energyAfter<0))
          throw new Error('Return loss lacks rider road.');
        const lossKilometre={sourceKm:km,
          riderStates:states.sort((a,b)=>
            riderIds.indexOf(a.riderId)-
            riderIds.indexOf(b.riderId))};
        const refused=new Error(
          'Return bunch loss needs later solo road.');
        refused.physicalReturnLoss={sourceKm:km,
          loss,completionInputs,completions,
          priorBunch:prior,priorBunchClock:clock,
          returnContact:contact,
          priorKilometres:[...returned.kilometres,
            ...later.map(row=>({sourceKm:row.sourceKm,
              riderStates:row.riderStates}))],
          lossKilometre};
        throw refused;
      }
      error.sourceKm=km;
      throw error;
    }
    clock+=step.elapsedSeconds;
    const decisions=new Map(step.riderDecisions.map(row=>
      [row.riderId,row]));
    const riderStates=step.physicalGroup.riderIds.map(
      riderId=>{
        const row=step.riders.find(item=>
          item.riderId===riderId);
        return {riderId,sourceKm:km,
          physicalGroupId:'peloton',
          atDistanceM:km*1000,
          elapsedSeconds:clock,
          energyAfter:row.energyAfter,
          decisions:[decisions.get(riderId)]};
      });
    if(riderStates.length!==riderIds.length||
      new Set(riderStates.map(row=>
        row.riderId)).size!==riderIds.length||
      riderStates.some(row=>!row.decisions[0]||
        row.energyAfter<0))
      throw new Error('Return race lacks rider road.');
    later.push({sourceKm:km,step,
      riderStates:riderStates.sort((a,b)=>
        riderIds.indexOf(a.riderId)-
        riderIds.indexOf(b.riderId))});
    prior={riderIds:step.physicalGroup.riderIds,
      energyByRider:step.energyByRider,
      quietKmByRider:step.quietKmByRider};
  }
  const kilometres=[...returned.kilometres,
    ...later.map(row=>({sourceKm:row.sourceKm,
      riderStates:row.riderStates}))];
  return {version:PHYSICAL_MANAGER_RETURN_RACE_VERSION,
    throughKm,riderIds:[...riderIds],kilometres,
    sources:{returned,later},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        kilometres.at(-1).riderStates.map(row=>[
          row.riderId,row.elapsedSeconds]))}:{}),
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalManagerReturnRaceV1(input,
recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalManagerReturnRaceV1(input)))
    throw new Error('Return race differs from paid source.');
  return true;
}
