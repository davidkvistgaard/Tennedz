import {assignPointDivisions} from '../calendar/division-reveal.mjs';
import {simulateTacticalTour} from '../engine/v2/tour.mjs';
import {validateRecordedTour} from '../engine/v2/recording.mjs';
import {normalizeOrders} from '../engine/v2/orders.mjs';
import {validateOrders} from './orders.mjs';

// Read-only integration probe. These recordings are not compatible with the
// current race viewer or point-award transaction and must not be persisted as
// completed division runs.
export function previewRecordedDivisions(snapshot,{v2OrdersByTeamId=null}={}){
  const {event,stage,teams,game_date:gameDate,locked_division_reveal:reveal,
    points_at_registration_lock:pointsSnapshot}=snapshot??{};
  if(event?.kind!=='one_day'||!['M','F'].includes(event.gender)||
    !Array.isArray(teams)||teams.length<2||teams.length>400||
    !reveal||!Array.isArray(reveal.assignments))
    throw new Error('A v2 preview needs a one-day race and a saved division reveal.');
  const seasonYear=new Date(event.scheduled_at).getUTCFullYear();
  if(!Number.isInteger(seasonYear)||reveal.eventId!==event.id||
    reveal.seasonYear!==seasonYear||reveal.gender!==event.gender)
    throw new Error('The saved division reveal belongs to another race or season.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(gameDate??''))
    throw new Error('A v2 preview needs the race game date.');
  if(!event.weather_locked)throw new Error('A v2 preview needs locked race weather.');
  const calculated=assignPointDivisions({eventId:reveal.eventId,seasonYear,
    gender:reveal.gender,entrants:reveal.assignments.map(row=>({
      teamId:row.teamId,earnedPoints:row.earnedPointsAtLock,
    }))});
  if(calculated.assignments.length!==teams.length||
    calculated.assignments.some((row,index)=>Object.keys(row).some(key=>
      row[key]!==reveal.assignments[index]?.[key])))
    throw new Error('The saved division reveal does not match its locked points.');
  if(pointsSnapshot){
    const fromSnapshot=assignPointDivisions(pointsSnapshot);
    if(fromSnapshot.eventId!==calculated.eventId||
      fromSnapshot.seasonYear!==calculated.seasonYear||
      fromSnapshot.gender!==calculated.gender||
      fromSnapshot.assignments.length!==calculated.assignments.length||
      fromSnapshot.assignments.some((row,index)=>Object.keys(row).some(key=>
        row[key]!==calculated.assignments[index]?.[key])))
      throw new Error('The saved division reveal differs from the registration lock.');
  }
  const byId=new Map(teams.map(team=>[team.id,team]));
  if(byId.size!==teams.length||reveal.assignments.some(row=>!byId.has(row.teamId)))
    throw new Error('The division reveal does not cover the entered teams.');
  if(v2OrdersByTeamId!==null&&(!v2OrdersByTeamId||
    typeof v2OrdersByTeamId!=='object'||Array.isArray(v2OrdersByTeamId)||
    Object.keys(v2OrdersByTeamId).length!==teams.length||
    Object.keys(v2OrdersByTeamId).some(id=>!byId.has(id))))
    throw new Error('Explicit v2 orders must cover exactly the entered teams.');
  const usedRiders=new Set();
  const prepared=new Map(teams.map(team=>{
    const ids=team.entry?.selected_riders;
    const captain=team.entry?.captain_id;
    if(!Array.isArray(ids)||ids.length!==8||new Set(ids).size!==8||!ids.includes(captain))
      throw new Error('A v2 preview needs eight selected riders and a captain per team.');
    const roster=new Map(team.riders?.map(rider=>[rider.id,rider]));
    if(roster.size!==team.riders?.length)throw new Error('A team has duplicate rider IDs.');
    const riders=ids.map(id=>roster.get(id));
    for(const rider of riders){
      if(!rider||rider.gender!==event.gender||usedRiders.has(rider.id)||
        (rider.injury_until&&rider.injury_until>gameDate))
        throw new Error('An entry has a foreign, injured, or duplicate rider.');
      usedRiders.add(rider.id);
    }
    let v2Orders;
    if(v2OrdersByTeamId){
      v2Orders=normalizeOrders(v2OrdersByTeamId[team.id],{
        riderIds:ids,distanceKm:Number(stage.distance_km),keypoints:stage.keypoints??[],
      });
      if(v2Orders.captainId!==captain)
        throw new Error('The committed v2 captain differs from the entered captain.');
    }else{
      const orders=validateOrders(team.entry.orders,ids,captain);
      if(orders.plan!=='balanced'||ids.some(id=>
        orders.riders[id].role!==(id===captain?'captain':'free')||
        orders.riders[id].effort!=='balanced'))
        throw new Error('Custom legacy orders cannot yet be translated to v2.');
      v2Orders={captainId:captain,roadCaptainId:captain,helperIds:[],preset:'balanced'};
    }
    return [team.id,{id:team.id,name:team.name,riders,orders:{captainId:captain,
      ...v2Orders}}];
  }));
  const divisions=[];
  for(let index=1;index<=calculated.assignments.at(-1).divisionIndex;index++){
    const assigned=calculated.assignments.filter(row=>row.divisionIndex===index);
    const seed=`${event.seed??event.id}:v2-candidate:div${index}`;
    const recording=simulateTacticalTour({stage,teams:assigned.map(row=>prepared.get(row.teamId)),
      seed,weather:event.weather_locked});
    validateRecordedTour(recording);
    divisions.push({index,teamIds:assigned.map(row=>row.teamId),recording});
  }
  return {eventId:event.id,divisionReveal:structuredClone(reveal),divisions};
}
