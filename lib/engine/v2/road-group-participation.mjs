// Read-only explanation of the existing paid road-group pull selection.
// It labels observable/order-backed reasons, never invents a rider's motive.
import {orderAt} from './orders.mjs';
import {assertRoadGroups,selectRoadGroupWork} from './road-groups.mjs';
import {TUNING} from './tuning.mjs';

export function explainRoadGroupParticipation(groups,teams,km,
  {holdTeamIds=[]}={}){
  assertRoadGroups(groups);
  const selection=selectRoadGroupWork(groups,teams,km,{holdTeamIds});
  const pulling=new Set(selection.pullRiderIds);
  const reciprocal=new Set(selection.reciprocalHoldRiderIds);
  const hold=new Set(holdTeamIds);
  const teamByRider=new Map(teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team])));
  const aheadTeams=new Set();
  const decisions=groups.map(group=>{
    const groupPullers=group.riderIds.filter(id=>pulling.has(id));
    const riders=group.riderIds.map(riderId=>{
      const team=teamByRider.get(riderId);
      if(!team)throw new Error('Unknown rider in road-group participation.');
      const order=orderAt(team.orders,km-1);
      const reason=pulling.has(riderId)?'selected_pull':
        hold.has(team.id)?'held_by_committed_response':
          order.breakWork==='sit_on'?'ordered_sit_on':
            reciprocal.has(riderId)?'reciprocal_hold':
              aheadTeams.has(team.id)?'teammate_further_ahead':
                Number(team.energy?.[riderId]??100)<=
                  TUNING.breakaway.minPullEnergy?'insufficient_energy':
                  'not_selected';
      return {riderId,teamId:team.id,reason};
    });
    group.teamIds.forEach(id=>aheadTeams.add(id));
    return {roadGroupId:group.id,pullerCount:groupPullers.length,riders};
  });
  return {version:1,groups:decisions,
    pullRiderIds:[...selection.pullRiderIds],
    reciprocalHoldRiderIds:[...selection.reciprocalHoldRiderIds]};
}
