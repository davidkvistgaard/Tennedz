// Explicitly experimental whole-race preview. Only validated, replayable
// road-clock evidence leaves this boundary; individual awards are withheld.
import {prepareV91Playtest} from './playtest.mjs';
import {prepareV94RivalIntent} from './playtest-rival-intent-v94.mjs';
import {simulateTacticalTour} from './tour.mjs';
import {validateRecordedTour} from './recording.mjs';
import {replayRaceDynamicsRecording} from './replay-race-dynamics-v94.mjs';
import {MOTOR_RACE_DYNAMICS_VERSION} from './tuning.mjs';

const SETTINGS=new Set(['distanceKm','terrain','teamCount','gender',
  'fatigue','effort','attack','chase','seed']);
const ROLES=new Set(['break','control','protect','opportunistic']);
const sorted=ids=>[...ids].sort();

export function createV94RaceDynamicsPreview({settings,format,rivalGoals=[],
  controlWithdrawalVersion=1}){
  if(!settings||typeof settings!=='object'||Array.isArray(settings)||
    Object.keys(settings).some(key=>!SETTINGS.has(key))||
    !['one_day','stage'].includes(format)||
    ![1,2].includes(controlWithdrawalVersion))
    throw new Error('Choose valid experimental race settings.');
  const prepared=prepareV91Playtest(settings);
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
    frontRotationVersion:3});
  const race=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:plan.teams,seed:prepared.seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:{...plan.raceContext,controlPursuitVersion:2,
      ...(controlWithdrawalVersion===2?{controlWithdrawalVersion:2}:{}),
      frontObservationVersion:2,frontExhaustionVersion:3},
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
    paidBunchPace:frame.paidBunchPace?{
      teamId:frame.paidBunchPace.teamId,
      riderIds:sorted(frame.paidBunchPace.riderIds)}:null,
    frontWorkers:sorted(frame.roadGroupWorkerRiderIds),
    frontResters:sorted(frame.settledFrontRestRiderIds),
    caughtRiders:sorted(frame.caughtBreakawayRiderIds),
    frontCoast:frame.frontCoast.map(row=>({riderId:row.riderId,
      delaySeconds:row.delaySeconds})),
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
      ...race.committedInputs.raceContext},
    teamPlans:race.committedInputs.rivalIntent.map(intent=>({
      ...intent,teamName:teams.get(intent.teamId).name,
      captainId:teams.get(intent.teamId).orders.captainId})),
    riderNames:Object.fromEntries([...riders].map(([id,rider])=>
      [id,rider.name])),
    route:race.route.kilometres.map(segment=>({km:segment.km,
      terrain:segment.terrain,endM:segment.endM,
      gradientPct:segment.gradientPct})),
    frames,story:{widestRecordedLead:widest,
      kilometresAtOrAboveOneMinute:frames.filter(frame=>
        frame.gapSeconds>=60).length,
      finalRecordedLeadSeconds:frames.at(-1).gapSeconds,
      finalRoadGroups:frames.at(-1).roadGroups.length},
    resultStatus:'provisional_road_groups_only'};
  return {recording:race,preview};
}
