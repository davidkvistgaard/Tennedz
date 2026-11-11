// Experimental, read-only Motor Lab to viewer contract audit.
import {createSampler,commentaryAt,validateFeed} from
  '@pelotonia/race-viewer/data';
import {preparePhysicalFirstSplitMotorInputV1} from
  '../lib/viewer/physical-first-split-test-race-v1.mjs';
import {PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../lib/engine/v2/physical-first-position-start-v2.mjs';
import {recordPhysicalFirstPositionGeneralRaceV7} from
  '../lib/engine/v2/physical-first-position-general-race-v1.mjs';
import {adaptPhysicalFirstPositionRaceV1} from
  '../lib/viewer/physical-first-position-adapter-v1.mjs';
import {CLUB_PALETTES,KIT_PATTERNS,defaultKit} from
  '../lib/riders/club-kit.mjs';

for(const category of ['men','women']){
  const prepared=preparePhysicalFirstSplitMotorInputV1(
    category,{terrain:'mountain',chase:'selective',
      attack:'selective',seed:'preview-recorded-road-1'});
  const request={input:{...prepared.input,
    positionModelVersion:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION,
    positionPassingCorridorCount:1},
  grid:{laneCount:4,wheelSpacingM:2.5,
    laneStaggerM:.08}};
  const race=recordPhysicalFirstPositionGeneralRaceV7(
    request);
  const teamStyles=request.input.teams.map(team=>{
    const kit=defaultKit(team.id);
    const palette=CLUB_PALETTES[kit.palette];
    const pattern=KIT_PATTERNS[kit.pattern];
    return {id:team.id,name:team.name,
      color:palette.primary,accent:palette.accent,
      pattern:'paths',paths:[...pattern.paths]};
  });
  const riderNumbers=Object.fromEntries(request.input.teams
    .flatMap((team,teamIndex)=>team.riders.map((rider,index)=>
      [rider.id,teamIndex*8+index+1])));
  const exported=adaptPhysicalFirstPositionRaceV1({
    request,race,
    raceId:`experimental-position-${category}-${race.raceSeed}`,
    category,teamStyles,riderNumbers,
    teamKitSource:'game-catalog-test-allocation',
    riderNumberSource:'synthetic-test-allocation'});
  const feed=validateFeed(exported.feed);
  const sample=createSampler(feed);
  const times=[0,feed.frames[1].time,
    feed.frames.at(-2).time,feed.duration];
  if(times.some(time=>
    sample(time).positions.length!==race.riderCount||
    commentaryAt(feed,time).some(event=>
      event.time>time)))
    throw new Error('Viewer sample or commentary lost paid time.');
  console.log(JSON.stringify({category,
    raceVersion:race.version,
    adapterVersion:exported.version,
    raceSeed:race.raceSeed,
    riderCount:race.riderCount,
    decisions:race.decisionCount,
    finishCrossings:race.finishCrossings.length,
    frames:feed.frames.length,
    eventCount:feed.events.length,
    duration:feed.duration,
    unresolvedModelClockTies:
      race.finaleFinishTieObservations.length,
    feedBytes:Buffer.byteLength(JSON.stringify(feed)),
    coverage:exported.coverage}));
}
