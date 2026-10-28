// Read-only explanation of the existing paid road-group pull selection.
// It labels observable/order-backed reasons, never invents a rider's motive.
import {decideRoadGroupWork} from './road-groups.mjs';

export function explainRoadGroupParticipation(groups,teams,km,
  {holdTeamIds=[]}={}){
  const selection=decideRoadGroupWork(groups,teams,km,{holdTeamIds});
  const pulling=new Set(selection.pullRiderIds);
  const decisions=groups.map(group=>{
    const groupPullers=group.riderIds.filter(id=>pulling.has(id));
    const riders=selection.riderDecisions.filter(row=>
      row.roadGroupId===group.id).map(({roadGroupId,...row})=>row);
    return {roadGroupId:group.id,pullerCount:groupPullers.length,riders};
  });
  return {version:1,groups:decisions,
    pullRiderIds:[...selection.pullRiderIds],
    reciprocalHoldRiderIds:[...selection.reciprocalHoldRiderIds]};
}
