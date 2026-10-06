import {POINT_POLICY_VERSION,pointsForDivisionResult} from '../calendar/points.mjs';
import {divisionMultiplier} from '../calendar/division-reveal.mjs';
import {validateRecordedTour} from '../engine/v2/recording.mjs';

// Read-only projection of the existing one-day ranking policy. The live
// result transaction still owns all rating changes, awards and idempotency.
export function projectV2OneDayAwards(candidate,{tier}){
  if(!candidate||typeof candidate.eventId!=='string'||!candidate.eventId||
    !Array.isArray(candidate.divisions)||!candidate.divisions.length||
    !Number.isInteger(tier)||tier<1||tier>6)
    throw new Error('A v2 award projection needs a recorded race and tier.');
  const divisionCount=candidate.divisions.length;
  const seenTeams=new Set(),seenRiders=new Set();
  const divisions=candidate.divisions.map((division,offset)=>{
    if(division?.index!==offset+1||!Array.isArray(division.teamIds)||
      division.teamIds.length<2||division.teamIds.length>20||
      new Set(division.teamIds).size!==division.teamIds.length)
      throw new Error('Invalid recorded division for award projection.');
    validateRecordedTour(division.recording);
    const recordedTeams=new Set(division.recording.committedInputs.teams.map(team=>team.id));
    if(recordedTeams.size!==division.teamIds.length||
      division.teamIds.some(id=>!recordedTeams.has(id)||seenTeams.has(id)))
      throw new Error('Recorded award teams differ from the division reveal.');
    for(const id of division.teamIds)seenTeams.add(id);
    const multiplier=divisionMultiplier(division.index,divisionCount);
    const awards=division.recording.provisionalResults.map(result=>{
      if(!recordedTeams.has(result.teamId)||seenRiders.has(result.riderId))
        throw new Error('Recorded award rider is duplicated or belongs to another division.');
      seenRiders.add(result.riderId);
      return {awardKey:`one_day:${candidate.eventId}:${result.riderId}`,
        riderId:result.riderId,teamId:result.teamId,divisionIndex:division.index,
        placing:result.position,
        points:pointsForDivisionResult({tier,resultType:'ONE_DAY',
          placing:result.position,multiplier})};
    }).filter(award=>award.points>0);
    return {index:division.index,multiplier,awards};
  });
  return {eventId:candidate.eventId,policyVersion:POINT_POLICY_VERSION,divisions};
}
