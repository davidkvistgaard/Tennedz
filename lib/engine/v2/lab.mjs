import {simulateTacticalTour} from './tour.mjs';
import {validateRecordedTour} from './recording.mjs';

const STRATEGY_PRESET={sprint:'protect',break:'aggressive',balanced:'balanced',conserve:'protect'};

// Reuse the established Race Lab cast so v1 and v2 can be inspected with the
// same seed and team identities. This adapter never writes to game data.
export function runKilometreLab({scenario,seed}){
  if(!scenario||!Array.isArray(scenario.teams)||scenario.teams.length<2)throw new Error('Invalid laboratory scenario.');
  const teams=scenario.teams.map(team=>{
    const preset=STRATEGY_PRESET[team.strategy];
    if(!preset)throw new Error('Unknown laboratory strategy.');
    const riderIds=team.riders.map(r=>r.id);
    const baseline={...(team.strategy==='conserve'?{effort:'conserve',attack:'none',chase:'ignore'}:{}),
      ...(team.breakWork?{breakWork:team.breakWork}:{}),
      ...(team.breakFinale?{breakFinale:team.breakFinale}:{})};
    return {id:team.id,riders:team.riders.map(r=>({...r,gender:'M',strength:r.flat,form:50,fatigue:0,leadership:45})),
      orders:{captainId:team.captainId,roadCaptainId:riderIds[1],preset,
        ...(team.breakResponse?{breakResponse:team.breakResponse}:{}),
        ...(team.forwardResponse?{forwardResponse:team.forwardResponse}:{}),
        ...(team.breakAttackAtKm?{phases:[{atKm:team.breakAttackAtKm,
          breakAttackRiderId:team.captainId}]}:{}),
        ...(Object.keys(baseline).length?{baseline}:{})}};
  });
  const result=simulateTacticalTour({stage:{distance_km:160,profile_points:[[0,25],[40,25],[80,30],[120,20],[160,25]],
    exposed_segments:[{from_km:55,to_km:80}],keypoints:[{km:55,kind:'EXPOSED',label:'Exposed coast'}]},
  teams,seed,weather:{temp_c:16,wind_kph:28,precipitation_mm:1}});
  validateRecordedTour(result);
  return {...result,scenario:structuredClone(scenario),seed:String(seed)};
}
