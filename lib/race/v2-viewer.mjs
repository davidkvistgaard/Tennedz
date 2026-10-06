import {validateRecordedTour} from '../engine/v2/recording.mjs';

// A read-only selector for a trusted team identity. A future API must derive
// that identity from the authenticated manager, never from a query parameter.
export function selectV2RecordedDivision(candidate,teamId){
  if(typeof teamId!=='string'||!teamId||
    candidate?.divisionReveal?.eventId!==candidate?.eventId||
    !Array.isArray(candidate.divisionReveal.assignments)||
    !Array.isArray(candidate.divisions))
    throw new Error('A recorded division needs a saved reveal and team identity.');
  const assignments=candidate.divisionReveal.assignments.filter(row=>row?.teamId===teamId);
  if(assignments.length!==1)throw new Error('The team has no unique saved division.');
  const index=assignments[0].divisionIndex;
  const divisions=candidate.divisions.filter(division=>division?.index===index);
  if(divisions.length!==1||!divisions[0].teamIds?.includes(teamId))
    throw new Error('The recorded division differs from the saved reveal.');
  const division=divisions[0];
  validateRecordedTour(division.recording);
  const recordedTeams=new Set(division.recording.committedInputs.teams.map(team=>team.id));
  const revealedTeams=new Set(candidate.divisionReveal.assignments
    .filter(row=>row.divisionIndex===index).map(row=>row.teamId));
  if(recordedTeams.size!==division.teamIds.length||
    revealedTeams.size!==division.teamIds.length||
    division.teamIds.some(id=>!recordedTeams.has(id)||!revealedTeams.has(id)))
    throw new Error('The recorded division differs from the saved reveal.');
  return {eventId:candidate.eventId,divisionIndex:index,recording:division.recording};
}
