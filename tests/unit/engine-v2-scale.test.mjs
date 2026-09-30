import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {MAX_ROAD_GROUPS} from '../../lib/engine/v2/road-groups.mjs';
import {startGeneralClassification,recordGeneralClassificationStage} from
  '../../lib/engine/v2/classification.mjs';

const stage={distance_km:100,profile_points:[[0,100],[100,100]],
  keypoints:[10,20,30,40,50,60,70,80,90].map(km=>({km,kind:'SPRINT'}))};
const teams=Array.from({length:20},(_,index)=>{
  const id=`team-${index.toString().padStart(2,'0')}`;
  const attackAt=10+(index%8)*10;
  return {id,riders:Array.from({length:8},(_,riderIndex)=>({
    id:`${id}-r${riderIndex}`,gender:'M',flat:riderIndex===0?95:50,
    strength:riderIndex===0?95:60,endurance:riderIndex===0?95:60,
    timetrial:riderIndex===0?95:50,leadership:50,
  })),orders:{captainId:`${id}-r0`,roadCaptainId:`${id}-r1`,
    preset:'balanced',baseline:{attack:'none',chase:'ignore'},
    phases:[{atKm:attackAt,attack:'selective',attackRiderId:`${id}-r0`},
      {atKm:attackAt+10,attack:'none'}]}};
});

test('the maximum team roster produces bounded, replayable multi-group racing',()=>{
  const input={stage,teams,seed:'twenty-team-stress'};
  const race=simulateTacticalTour(input);
  assert.equal(race.provisionalResults.length,160);
  assert.equal(race.frames.length,100);
  assert.ok(race.frames.some(frame=>frame.roadGroups.length>=2));
  assert.ok(race.frames.every(frame=>frame.roadGroups.length<=MAX_ROAD_GROUPS&&
    frame.riderGroups.length===160));
  assert.equal(validateRecordedTour(race),true);
  assert.deepEqual(race,simulateTacticalTour({...input,
    teams:[...teams].reverse().map(team=>({...team,riders:[...team.riders].reverse()}))}));
});

test('the full roster can project GC without mixing categories or corrupting replay',()=>{
  const cast=structuredClone(teams);
  cast[0].orders={...cast[0].orders,phases:[],gcObjective:'defend_top_ten'};
  const riders=cast.flatMap(team=>team.riders.map(rider=>({
    riderId:rider.id,teamId:team.id,gender:'M',
  })));
  const start=startGeneralClassification({raceCategory:'M',riders});
  const fast=new Set([
    ...cast[0].riders.slice(1).map(rider=>rider.id),
    ...cast[1].riders.slice(1,3).map(rider=>rider.id),
  ]);
  const classification=recordGeneralClassificationStage(start,{stageId:'earlier-stage',
    classifiedTimes:riders.map(rider=>({riderId:rider.riderId,
      timeSeconds:fast.has(rider.riderId)?3590:
        rider.riderId===cast[0].riders[0].id?3600:
          rider.riderId===cast[1].riders[0].id?3602:3610,
    }))});
  const race=simulateTacticalTour({stage,teams:cast,seed:'twenty-team-gc',classification});
  assert.equal(race.committedInputs.classification.standings.length,160);
  assert.ok(race.frames.some(frame=>frame.activeGcResponseTeamIds.includes(cast[0].id)));
  assert.equal(validateRecordedTour(race),true);
});
