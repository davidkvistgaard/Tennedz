import {validateRecordedTour} from '../engine/v2/recording.mjs';
import {validateV2OneDayResultContract,validateV2OneDayDivisionSlice}
  from './v2-result-contract.mjs';

// A read-only selector for a trusted team identity. A future API must derive
// that identity from the authenticated manager, never from a query parameter.
export function selectV2RecordedDivision(candidate,teamId){
  if(typeof teamId!=='string'||!teamId||
    !candidate||!candidate.divisionReveal||
    candidate?.divisionReveal?.eventId!==candidate?.eventId||
    !Array.isArray(candidate.divisions)||!candidate.divisions.length||
    !Array.isArray(candidate.divisionReveal.assignments)||
    candidate.divisionReveal.assignments.some(row=>!row||typeof row.teamId!=='string'||
      !row.teamId||!Number.isInteger(row.divisionIndex)||row.divisionIndex<1||
      row.divisionIndex>candidate.divisions.length)||
    new Set(candidate.divisionReveal.assignments.map(row=>row.teamId)).size!==
      candidate.divisionReveal.assignments.length)
    throw new Error('A recorded division needs a saved reveal and team identity.');
  const assignments=candidate.divisionReveal.assignments.filter(row=>row?.teamId===teamId);
  if(assignments.length!==1)throw new Error('The team has no unique saved division.');
  const index=assignments[0].divisionIndex;
  const divisions=candidate.divisions.filter(division=>division?.index===index);
  if(divisions.length!==1||!divisions[0].teamIds?.includes(teamId))
    throw new Error('The recorded division differs from the saved reveal.');
  const division=divisions[0];
  validateRecordedTour(division.recording);
  if(division.recording.raceCategory!==candidate.divisionReveal.gender)
    throw new Error('The recorded division differs from the saved reveal.');
  const recordedTeams=new Set(division.recording.committedInputs.teams.map(team=>team.id));
  const revealedTeams=new Set(candidate.divisionReveal.assignments
    .filter(row=>row.divisionIndex===index).map(row=>row.teamId));
  if(recordedTeams.size!==division.teamIds.length||
    revealedTeams.size!==division.teamIds.length||
    division.teamIds.some(id=>!recordedTeams.has(id)||!revealedTeams.has(id)))
    throw new Error('The recorded division differs from the saved reveal.');
  return {eventId:candidate.eventId,divisionIndex:index,recording:division.recording};
}

// A post-race player payload is a viewer projection, not a complete recording.
// Validate the private saved contract first, then keep only the selected
// division and omit rivals' locked plans, ability and remaining energy.
export function projectV2RecordedDivisionForTeam(contract,teamId){
  validateV2OneDayResultContract(contract);
  const selected=selectV2RecordedDivision(contract,teamId);
  const division=contract.divisions.find(row=>row.index===selected.divisionIndex);
  return projectSelectedDivision(contract.eventId,division,teamId);
}

export function projectV2RecordedDivisionSliceForTeam(slice,teamId){
  validateV2OneDayDivisionSlice(slice);
  if(typeof teamId!=='string'||!slice.division.teamIds.includes(teamId))
    throw new Error('The team is not in the selected v2 division.');
  return projectSelectedDivision(slice.eventId,slice.division,teamId);
}

function projectSelectedDivision(eventId,division,teamId){
  const recording=structuredClone(division.recording);
  const ownRiderIds=new Set(recording.committedInputs.teams.find(team=>
    team.id===teamId).riders.map(rider=>rider.id));
  recording.committedInputs.classification=null;
  recording.committedInputs.teams=recording.committedInputs.teams.map(team=>
    team.id===teamId?team:{id:team.id,name:team.name,
      riders:team.riders.map(rider=>({id:rider.id,name:rider.name})),
      orders:{captainId:team.orders.captainId}});
  recording.frames=recording.frames.map(frame=>{
    const {teamEnergy,teamPace,...publicFrame}=frame;
    return {...publicFrame,
      ...(Object.hasOwn(frame,'paidBunchPace')?{
        paidBunchPace:frame.paidBunchPace?.teamId===teamId?
          frame.paidBunchPace:null}:{}),
      hardBunchWorkTeamIds:frame.hardBunchWorkTeamIds?.filter(id=>id===teamId)??[],
      hardBunchWorkRiderIds:frame.hardBunchWorkRiderIds?.filter(id=>
        ownRiderIds.has(id))??[],
      steadyBunchWorkTeamIds:frame.steadyBunchWorkTeamIds?.filter(id=>id===teamId)??[],
      steadyBunchWorkRiderIds:frame.steadyBunchWorkRiderIds?.filter(id=>
        ownRiderIds.has(id))??[],
      riderGroups:frame.riderGroups.map(rider=>{
      if(rider.teamId===teamId)return rider;
      const {energy,...publicRider}=rider;
      return publicRider;
    })};
  });
  recording.provisionalResults=recording.provisionalResults.map(result=>{
    if(result.teamId===teamId)return result;
    const {energy,finaleAbility,...publicResult}=result;
    return publicResult;
  });
  return {schemaVersion:1,eventId,
    divisionIndex:division.index,settled:false,
    focusTeamId:teamId,recording,
    teamResults:structuredClone(division.teamResults),
    riderResults:structuredClone(division.riderResults),
    projectedAwards:structuredClone(division.awards)};
}
