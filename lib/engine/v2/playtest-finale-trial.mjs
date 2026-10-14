import {isDeepStrictEqual} from 'node:util';
import {createV91Playtest,routeForV91Playtest} from './playtest.mjs';
import {simulateTacticalTour} from './tour.mjs';
import {validateRecordedTour} from './recording.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from './tuning.mjs';
import {decideLastKmRotationOutcomeFromTour} from
  './finale-last-km-rotation-outcome.mjs';
import {recordLeadOutConditionalLineFromTour} from
  './finale-lead-out-longitudinal.mjs';

export const V91_FINALE_TRIAL_VERSION='v91-finale-trial-1';

// Read-only motor trial. The ordinary playtest validates settings and creates
// the fictional roster; this opt-in branch adds one named last-km attack to
// that same roster. The saved v79/v2 event path is never called.
export function createV91FinaleTrial(settings,{attackTeamId,
  attackRiderId,plans,leadOutTiming='late'}={}){
  const base=createV91Playtest(settings);
  const {distanceKm,terrain,profileHeightsM,seed}=base.settings;
  const roster=base.recording.committedInputs.teams;
  const attackTeam=roster.find(team=>team.id===attackTeamId);
  if(!attackTeam||!attackTeam.riders.some(row=>
    row.id===attackRiderId)||
    roster.some(team=>team.orders.baseline.attack!=='none'||
      !['ignore','all'].includes(team.orders.baseline.chase))||
    leadOutTiming!=='late')
    throw new Error('Choose supported controlled-finale settings.');
  const namedPlans=plans??roster.map(team=>({teamId:team.id,
    finisherId:team.orders.captainId,leadOutRiderId:null}));
  const planByTeam=new Map(Array.isArray(namedPlans)?
    namedPlans.map(row=>[row?.teamId,row]):[]);
  if(!Array.isArray(namedPlans)||namedPlans.length!==roster.length||
    planByTeam.size!==roster.length||roster.some(team=>{
      const plan=planByTeam.get(team.id);
      return !plan||Object.keys(plan).length!==3||
        !team.riders.some(rider=>
        rider.id===plan.finisherId)||
        plan.leadOutRiderId!==null&&
          (plan.leadOutRiderId===plan.finisherId||
            !team.riders.some(rider=>rider.id===plan.leadOutRiderId));
    }))
    throw new Error('Choose one valid finale plan per manager.');
  const route=routeForV91Playtest(distanceKm,terrain,
    profileHeightsM);
  const stage={...route.stage,keypoints:[
    ...(route.stage.keypoints??[]),
    {km:distanceKm-1,kind:'SPRINT'}]};
  const teams=roster.map(team=>({...team,orders:{...team.orders,
    phases:team.id===attackTeamId?[{atKm:distanceKm-1,
      attack:'selective',attackRiderId}]:[]}}));
  const recording=simulateTacticalTour({stage,weather:route.weather,
    teams,seed,motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  validateRecordedTour(recording);
  const attackIntent={teamId:attackTeamId,riderId:attackRiderId,
    atKm:distanceKm-1};
  const finalePlans=namedPlans.map(row=>({teamId:row.teamId,
    finisherId:row.finisherId,leadOutRiderId:row.leadOutRiderId}));
  const decision=decideLastKmRotationOutcomeFromTour(recording,{
    teamId:attackTeamId});
  if(!['caught','contained'].includes(decision.branch))
    return {version:V91_FINALE_TRIAL_VERSION,settings:base.settings,
      sourceMotorVersion:recording.tuningVersion,recording,
      attackIntent,finalePlans,leadOutTiming,
      decision,finaleStatus:'unsupported_road_outcome',finale:null,
      sourceResultStatus:'kilometre_provisional_not_finale',
      classifiedResults:null,pointsStatus:'withheld',
      canCommitAwards:false};
  const finale=recordLeadOutConditionalLineFromTour(recording,{
    attackTeamId,attackRiderId,plans:finalePlans,leadOutTiming});
  return {version:V91_FINALE_TRIAL_VERSION,settings:base.settings,
    sourceMotorVersion:recording.tuningVersion,recording,
    attackIntent,finalePlans,leadOutTiming,
    decision,finaleStatus:'provisional_conditional',finale,
    sourceResultStatus:'kilometre_provisional_not_finale',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateV91FinaleTrial(settings,request,recorded){
  if(!isDeepStrictEqual(recorded,
    createV91FinaleTrial(settings,request)))
    throw new Error('The controlled finale trial does not replay.');
  return true;
}
