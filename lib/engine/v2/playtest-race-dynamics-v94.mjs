// Explicitly experimental whole-race preview. Only validated, replayable
// road-clock evidence leaves this boundary; individual awards are withheld.
import {prepareV91Playtest} from './playtest.mjs';
import {prepareV94RivalIntent} from './playtest-rival-intent-v94.mjs';
import {simulateTacticalTour} from './tour.mjs';
import {validateRecordedTour} from './recording.mjs';
import {replayRaceDynamicsRecording} from './replay-race-dynamics-v94.mjs';
import {recordedGroupFinish} from './race-group-finish-v94.mjs';
import {MOTOR_RACE_DYNAMICS_VERSION} from './tuning.mjs';

const SETTINGS=new Set(['distanceKm','terrain','teamCount','gender',
  'fatigue','effort','attack','chase','seed']);
const ROLES=new Set(['break','control','protect','opportunistic']);
const sorted=ids=>[...ids].sort();

export function createV94RaceDynamicsPreview({settings,format,rivalGoals=[],
  controlWithdrawalVersion=1,frontExhaustionVersion=4,
  frontRotationVersion=1,roadGroupPaceVersion=2,
  bunchFrontTurnVersion=0,ownFrontWork='none'}){
  if(!settings||typeof settings!=='object'||Array.isArray(settings)||
    Object.keys(settings).some(key=>!SETTINGS.has(key))||
    !['one_day','stage'].includes(format)||
    ![1,2].includes(controlWithdrawalVersion)||
    ![3,4].includes(frontExhaustionVersion)||
    ![1,3].includes(frontRotationVersion)||
    ![1,2,3].includes(roadGroupPaceVersion)||
    ![0,1].includes(bunchFrontTurnVersion)||
    !['none','rotate'].includes(ownFrontWork))
    throw new Error('Choose valid experimental race settings.');
  const prepared=prepareV91Playtest(settings);
  if(ownFrontWork==='rotate')prepared.teams[0]={...prepared.teams[0],
    orders:{...prepared.teams[0].orders,
      baseline:{...prepared.teams[0].orders.baseline,frontWork:'rotate'}}};
  const rivalIds=new Set(prepared.teams.slice(1).map(team=>team.id));
  if(!Array.isArray(rivalGoals)||rivalGoals.length>rivalIds.size||
    new Set(rivalGoals.map(row=>row?.teamId)).size!==rivalGoals.length||
    rivalGoals.some(row=>!row||typeof row!=='object'||Array.isArray(row)||
      Object.keys(row).sort().join(',')!=='role,teamId'||
      !rivalIds.has(row.teamId)||!ROLES.has(row.role)))
    throw new Error('Choose valid rival goals.');
  const plan=prepareV94RivalIntent({prepared,format,
    ...(format==='stage'?{stageNumber:8}:{}),
    rivalGoals,
    controlTempoVersion:2,opportunisticSpecialistVersion:2,
    frontRotationVersion});
  const race=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:plan.teams,seed:prepared.seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:{...plan.raceContext,controlPursuitVersion:2,
      ...(controlWithdrawalVersion===2?{controlWithdrawalVersion:2}:{}),
      ...(roadGroupPaceVersion>=2?{roadGroupPaceVersion}:{}),
      ...(bunchFrontTurnVersion===1?{bunchFrontTurnVersion:1}:{}),
      frontObservationVersion:2,frontExhaustionVersion},
    rivalIntent:plan.intent});
  validateRecordedTour(race);
  replayRaceDynamicsRecording(race);
  const teams=new Map(race.committedInputs.teams.map(team=>[team.id,team]));
  const riders=new Map([...teams.values()].flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const frames=race.frames.map(frame=>({km:frame.km,
    terrain:frame.terrain,gapSeconds:frame.gapSeconds,
    roadGroups:frame.roadGroups.map(group=>({id:group.id,
      gapSeconds:group.gapSeconds,riderIds:sorted(group.riderIds),
      teamIds:sorted(group.teamIds)})),
    attackers:sorted(frame.attackers),chasers:sorted(frame.chasers),
    paidChase:frame.chaseContributions.map(row=>({teamId:row.teamId,
      reason:row.reason,riderIds:sorted(row.riderIds)}))
      .sort((a,b)=>a.teamId.localeCompare(b.teamId)),
    heldChase:sorted(frame.heldChaseTeamIds),
    controlWithheld:sorted(frame.disengagedControlTeamIds??[]),
    teamEnergy:frame.teamEnergy.map(row=>({teamId:row.teamId,
      mean:row.mean})).sort((a,b)=>a.teamId.localeCompare(b.teamId)),
    paidBunchPace:frame.paidBunchPace?{
      teamId:frame.paidBunchPace.teamId,
      riderIds:sorted(frame.paidBunchPace.riderIds)}:null,
    frontWorkers:sorted(frame.roadGroupWorkerRiderIds),
    frontResters:sorted(frame.settledFrontRestRiderIds),
    caughtRiders:sorted(frame.caughtBreakawayRiderIds),
    frontCoast:frame.frontCoast.map(row=>({riderId:row.riderId,
      delaySeconds:row.delaySeconds,
      residualSeconds:row.residualSeconds,
      detachedGroupId:row.detachedGroupId??null,
      joinedGroupId:row.joinedGroupId??null})),
    ownRiders:frame.riderGroups.filter(row=>row.teamId==='you')
      .map(row=>({id:row.id,group:row.group,energy:row.energy,
        deficitSeconds:row.deficitSeconds})).sort((a,b)=>
        a.id.localeCompare(b.id))}));
  const widest=frames.reduce((best,frame)=>
    frame.gapSeconds>best.gapSeconds?{km:frame.km,
      gapSeconds:frame.gapSeconds}:best,{km:0,gapSeconds:0});
  const preview={version:'v94-race-dynamics-preview-1',
    motorVersion:race.tuningVersion,format,settings:prepared.settings,
    policy:{rivalIntentVersion:race.committedInputs.rivalIntentVersion,
      ...race.committedInputs.raceContext,
      frontRotationVersion:race.committedInputs.raceContext
        .frontRotationVersion??1},
    teamPlans:race.committedInputs.rivalIntent.map(intent=>({
      ...intent,teamName:teams.get(intent.teamId).name,
      captainId:teams.get(intent.teamId).orders.captainId})),
    riderNames:Object.fromEntries([...riders].map(([id,rider])=>
      [id,rider.name])),
    route:race.route.kilometres.map(segment=>({km:segment.km,
      terrain:segment.terrain,endM:segment.endM,
      gradientPct:segment.gradientPct})),
    frames,finish:recordedGroupFinish(race),
    story:{widestRecordedLead:widest,
      kilometresAtOrAboveOneMinute:frames.filter(frame=>
        frame.gapSeconds>=60).length,
      finalRecordedLeadSeconds:frames.at(-1).gapSeconds,
      finalRoadGroups:frames.at(-1).roadGroups.length},
    resultStatus:'provisional_road_groups_only'};
  return {recording:race,preview};
}
