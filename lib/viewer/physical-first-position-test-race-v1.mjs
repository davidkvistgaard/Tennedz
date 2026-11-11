// Development-only projection of current synthetic Motor Lab inputs.
// No game event, official result or canonical geography is implied.
import {preparePhysicalFirstSplitMotorInputV1} from
  './physical-first-split-test-race-v1.mjs';
import {PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../engine/v2/physical-first-position-start-v2.mjs';
import {recordPhysicalFirstPositionGeneralRaceV7} from
  '../engine/v2/physical-first-position-general-race-v1.mjs';
import {adaptPhysicalFirstPositionRaceV2} from
  './physical-first-position-adapter-v1.mjs';
import {CLUB_PALETTES,KIT_PATTERNS,defaultKit} from
  '../riders/club-kit.mjs';

const cache=new Map();
export function createPhysicalFirstPositionViewerTestRaceV1(
  category='men'){
  if(!['men','women'].includes(category))
    throw new Error('Choose a valid Motor Lab field.');
  if(cache.has(category))return cache.get(category);
  const {input}=preparePhysicalFirstSplitMotorInputV1(
    category,{terrain:'mountain',chase:'selective',
      attack:'selective',seed:'preview-recorded-road-1'});
  const request={input:{...input,
    positionModelVersion:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION,
    positionPassingCorridorCount:1},
  grid:{laneCount:4,wheelSpacingM:2.5,
    laneStaggerM:.08}};
  const race=recordPhysicalFirstPositionGeneralRaceV7(request);
  const teamStyles=input.teams.map(team=>{
    const kit=defaultKit(team.id);
    const palette=CLUB_PALETTES[kit.palette];
    const pattern=KIT_PATTERNS[kit.pattern];
    return {id:team.id,name:team.name,
      color:palette.primary,accent:palette.accent,
      pattern:'paths',paths:[...pattern.paths]};
  });
  const riderNumbers=Object.fromEntries(input.teams.flatMap(
    (team,teamIndex)=>team.riders.map((rider,index)=>
      [rider.id,teamIndex*8+index+1])));
  const result=adaptPhysicalFirstPositionRaceV2({
    request,race,category,teamStyles,riderNumbers,
    raceId:`motor-lab-position-${category}-seed1`,
    fixtureKind:'synthetic_motor_lab',
    teamKitSource:'game-catalog-test-allocation',
    riderNumberSource:'synthetic-test-allocation'});
  cache.set(category,result);
  return result;
}
