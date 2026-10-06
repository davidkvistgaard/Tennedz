import {isDeepStrictEqual} from 'node:util';
import {assignPointDivisions,divisionMultiplier} from '../calendar/division-reveal.mjs';
import {POINT_POLICY_VERSION,pointsForDivisionResult} from '../calendar/points.mjs';
import {validateRecordedTour} from '../engine/v2/recording.mjs';
import {projectV2OneDayAwards} from './v2-points.mjs';
import {previewLockedV2RecordedDivisions} from './v2-candidate.mjs';

export const V2_RESULT_CONTRACT_VERSION=1;
const PERSISTED_REVEAL_POLICY_VERSION='provisional-zero-point-id-tiebreak-v1';

function buildDivisionResult(division,awards){
  const recording=division.recording;
  const awardByRider=new Map(awards.map(award=>[award.riderId,award]));
  const results=recording.provisionalResults;
  const captains=recording.committedInputs.teams.map(team=>{
    const result=results.find(row=>row.riderId===team.orders.captainId);
    if(!result||result.teamId!==team.id)
      throw new Error('A recorded team captain is missing from the result.');
    return {teamId:team.id,captainId:result.riderId,timeSeconds:result.timeSeconds};
  }).sort((a,b)=>a.timeSeconds-b.timeSeconds||a.teamId.localeCompare(b.teamId));
  const winnerTime=captains[0].timeSeconds;
  const teamResults=captains.map((captain,rank)=>({
    ...captain,position:rank+1,
    gapSeconds:+(captain.timeSeconds-winnerTime).toFixed(2),
  }));
  const riderResults=results.map(result=>({
    riderId:result.riderId,teamId:result.teamId,position:result.position,
    timeSeconds:result.timeSeconds,gapSeconds:result.gapSeconds,
    rankingPoints:awardByRider.get(result.riderId)?.points??0,
  }));
  return {index:division.index,teamIds:[...division.teamIds],
    recordingVersion:recording.version,recording:structuredClone(recording),
    teamResults,riderResults,awards:structuredClone(awards)};
}

// A complete, still read-only result boundary. It deliberately carries the
// recording, classified placings and exact sporting award keys together so a
// future transaction cannot pair one division's replay with another's points.
export function buildV2OneDayResultContract(candidate,{tier}){
  const projection=projectV2OneDayAwards(candidate,{tier});
  const reveal=candidate.divisionReveal;
  const divisions=candidate.divisions.map((division,index)=>{
    const awards=projection.divisions[index].awards;
    return buildDivisionResult(division,awards);
  });
  return {schemaVersion:V2_RESULT_CONTRACT_VERSION,engineVersion:2,
    eventId:candidate.eventId,seasonYear:reveal.seasonYear,gender:reveal.gender,
    tier,pointsPolicyVersion:projection.policyVersion,
    divisionReveal:structuredClone(reveal),divisions};
}

export function validateV2OneDayResultContract(contract){
  if(contract?.schemaVersion!==V2_RESULT_CONTRACT_VERSION||
    contract.engineVersion!==2||!Array.isArray(contract.divisions))
    throw new Error('Unsupported v2 result contract.');
  const candidate={eventId:contract.eventId,divisionReveal:contract.divisionReveal,
    divisions:contract.divisions.map(division=>({index:division?.index,
      teamIds:division?.teamIds,recording:division?.recording}))};
  const expected=buildV2OneDayResultContract(candidate,{tier:contract.tier});
  if(!isDeepStrictEqual(contract,expected))
    throw new Error('The v2 result, recording and awards disagree.');
  return contract;
}

// Validate one immutable division without transferring all rival recordings.
// The full contract is checked when the candidate is first saved.
export function validateV2OneDayDivisionSlice(slice){
  const {divisionReveal:reveal,division}=slice??{};
  if(slice?.schemaVersion!==V2_RESULT_CONTRACT_VERSION||
    slice.engineVersion!==2||slice.pointsPolicyVersion!==POINT_POLICY_VERSION||
    !Number.isInteger(slice.tier)||slice.tier<1||slice.tier>6||
    !Number.isInteger(slice.divisionCount)||slice.divisionCount<1||
    !reveal||!Array.isArray(reveal.assignments)||
    reveal.eventId!==slice.eventId||reveal.seasonYear!==slice.seasonYear||
    reveal.gender!==slice.gender||!['M','F'].includes(slice.gender)||
    !division||!Number.isInteger(division.index)||
    division.index<1||division.index>slice.divisionCount)
    throw new Error('Unsupported v2 division slice.');
  const expectedReveal=assignPointDivisions({eventId:slice.eventId,
    seasonYear:slice.seasonYear,gender:slice.gender,
    entrants:reveal.assignments.map(row=>({teamId:row?.teamId,
      earnedPoints:row?.earnedPointsAtLock}))});
  const {revealedAt,pointsPolicyVersion,...revealCore}=reveal;
  const hasPersistedMetadata=revealedAt!==undefined||pointsPolicyVersion!==undefined;
  if((hasPersistedMetadata&&
      (pointsPolicyVersion!==PERSISTED_REVEAL_POLICY_VERSION||
        typeof revealedAt!=='string'||!Number.isFinite(Date.parse(revealedAt))))||
    !isDeepStrictEqual(revealCore,expectedReveal)||
    slice.divisionCount!==Math.ceil(reveal.assignments.length/20))
    throw new Error('The v2 division differs from its saved reveal.');
  const expectedTeamIds=reveal.assignments.filter(row=>
    row.divisionIndex===division.index).map(row=>row.teamId);
  if(!Array.isArray(division.teamIds)||
    !isDeepStrictEqual(division.teamIds,expectedTeamIds))
    throw new Error('The v2 division differs from its saved reveal.');
  validateRecordedTour(division.recording);
  const recorded=division.recording;
  if(recorded.raceCategory!==slice.gender||
    !isDeepStrictEqual(new Set(recorded.committedInputs.teams.map(team=>team.id)),
      new Set(expectedTeamIds)))
    throw new Error('The v2 division differs from its saved reveal.');
  const multiplier=divisionMultiplier(division.index,slice.divisionCount);
  const awards=recorded.provisionalResults.map(result=>({
    awardKey:`one_day:${slice.eventId}:${result.riderId}`,
    riderId:result.riderId,teamId:result.teamId,divisionIndex:division.index,
    placing:result.position,points:pointsForDivisionResult({tier:slice.tier,
      resultType:'ONE_DAY',placing:result.position,multiplier}),
  })).filter(award=>award.points>0);
  const expected=buildDivisionResult({index:division.index,
    teamIds:expectedTeamIds,recording:recorded},awards);
  if(!isDeepStrictEqual(division,expected))
    throw new Error('The v2 division recording, result and awards disagree.');
  return slice;
}

// The portable contract alone proves internal consistency. Before any future
// storage or awards, also prove it was generated from this event's immutable
// manager lock, including its tier, orders, weather and division assignment.
export function validateV2OneDayResultAgainstLock(lock,contract){
  validateV2OneDayResultContract(contract);
  if(lock?.event?.id!==contract.eventId||
    lock.event.race_tier!==contract.tier)
    throw new Error('The v2 result belongs to another locked race or tier.');
  const candidate=previewLockedV2RecordedDivisions(lock);
  const expected=buildV2OneDayResultContract(candidate,{tier:lock.event.race_tier});
  if(!isDeepStrictEqual(contract,expected))
    throw new Error('The v2 result differs from the saved manager tactics lock.');
  return contract;
}
