import {simulateTacticalTour} from './tour.mjs';
import {validateRecordedTour} from './recording.mjs';

const STRATEGY_PRESET={sprint:'protect',break:'aggressive',balanced:'balanced',conserve:'protect'};
const LAB_ROUTES={
  coast:{name:'Coast Road laboratory',stage:{distance_km:160,
    profile_points:[[0,25],[40,25],[80,30],[120,20],[160,25]],
    exposed_segments:[{from_km:55,to_km:80}],
    keypoints:[{km:55,kind:'EXPOSED',label:'Exposed coast'}]},
    weather:{temp_c:16,wind_kph:28,precipitation_mm:1}},
  ridge:{name:'Ridge Road laboratory',stage:{distance_km:160,
    profile_points:[[0,80],[30,80],[38,480],[48,80],[76,90],[84,490],[94,90],
      [125,95],[133,295],[143,95],[160,80]],
    keypoints:[{km:38,kind:'CLIMB',label:'First ridge'},
      {km:84,kind:'CLIMB',label:'Second ridge'},
      {km:133,kind:'HILL',label:'Final rise'}]},
    weather:{temp_c:18,wind_kph:13,precipitation_mm:.3}},
};
export const LAB_ROUTE_OPTIONS=Object.freeze(Object.keys(LAB_ROUTES));

// Reuse the established Race Lab cast so v1 and v2 can be inspected with the
// same seed and team identities. This adapter never writes to game data.
export function runKilometreLab({scenario,seed,routeId='coast'}){
  if(!scenario||!Array.isArray(scenario.teams)||scenario.teams.length<2)throw new Error('Invalid laboratory scenario.');
  if(!Object.hasOwn(LAB_ROUTES,routeId))throw new Error('Unknown laboratory route.');
  const teams=scenario.teams.map(team=>{
    const preset=STRATEGY_PRESET[team.strategy];
    if(!preset)throw new Error('Unknown laboratory strategy.');
    const riderIds=team.riders.map(r=>r.id);
    const baseline={...(team.strategy==='conserve'?{effort:'conserve',attack:'none',chase:'ignore'}:{}),
      ...(team.breakWork?{breakWork:team.breakWork}:{}),
      ...(team.breakFinale?{breakFinale:team.breakFinale}:{}),
      ...(team.helperAttackPolicy?{helperAttackPolicy:team.helperAttackPolicy}:{})};
    const phases=new Map();
    if(team.breakAttackAtKm)phases.set(team.breakAttackAtKm,
      {atKm:team.breakAttackAtKm,breakAttackRiderId:team.captainId});
    if(team.phaseAtKm&&(team.phaseEffort||team.phaseChase||team.phaseBreakWork))
      phases.set(team.phaseAtKm,{
      ...phases.get(team.phaseAtKm),atKm:team.phaseAtKm,
      ...(team.phaseEffort?{effort:team.phaseEffort}:{}),
      ...(team.phaseChase?{chase:team.phaseChase}:{}),
      ...(team.phaseBreakWork?{breakWork:team.phaseBreakWork}:{}),
    });
    return {id:team.id,riders:team.riders.map(r=>({...r,gender:'M',strength:r.flat,form:50,fatigue:0,
      leadership:r.id===riderIds[1]?team.roadCaptainLeadership??45:45})),
      orders:{captainId:team.captainId,roadCaptainId:riderIds[1],preset,
        ...(team.breakResponse?{breakResponse:team.breakResponse}:{}),
        ...(team.forwardResponse?{forwardResponse:team.forwardResponse}:{}),
        ...(phases.size?{phases:[...phases.values()].sort((a,b)=>a.atKm-b.atKm)}:{}),
        ...(Object.keys(baseline).length?{baseline}:{})}};
  });
  const route=LAB_ROUTES[routeId];
  const result=simulateTacticalTour({stage:route.stage,teams,seed,weather:route.weather});
  validateRecordedTour(result);
  return {...result,scenario:structuredClone(scenario),routeId,routeName:route.name,seed:String(seed)};
}
