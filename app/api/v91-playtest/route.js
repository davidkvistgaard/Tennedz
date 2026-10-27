import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../lib/auth/server';
import {createV91Playtest,summarizeV91Playtest} from '../../../lib/engine/v2/playtest.mjs';
import {summarizeV91PaidFinaleReplay,
  summarizeV91PaidFinaleTail,
  summarizeV91PaidPartialContactReplay,
  summarizeV91PaidConcurrentLateCatchReplay,
  summarizeV91PaidConcurrentDoubleCatchReplay,
  summarizeV91PaidNamedAttackApproach,
  summarizeV91PaidSoloApproach} from
  '../../../lib/engine/v2/playtest-finale-replay.mjs';
import {runV91IntegratedTestDrive} from '../../../scripts/engine-v2-test-drive.mjs';
import {summarizeV91PaidMultibandReplay} from
  '../../../lib/engine/v2/playtest-multiband-replay.mjs';
import {createV93CoastedPlaytest,summarizeV93CoastedPlaytest} from
  '../../../lib/engine/v2/playtest-v93-coasted.mjs';
import {summarizeRecordedStageTrace} from
  '../../../lib/engine/v2/playtest-stage-trace.mjs';
import {createV94RaceDynamicsPreview} from
  '../../../lib/engine/v2/playtest-race-dynamics-v94.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const runs=new Map();
function v93PlanError(error){
  if(error.roadPreview?.unsupportedReason===
    'depleted_front_dissolution')
    return `${error.roadPreview.handoff.groupId} has no rider with energy `+
      'to stay in the front group at the final-kilometre handoff. '+
      'The recorded road is shown through that point. Its riders need '+
      'separate paid travel and contact before a finish, replay or points '+
      'can be shown.';
  if(error.roadPreview?.unsupportedReason==='unpayable_front_handoff')
    return `${error.roadPreview.handoff.riderId} cannot pay for travel `+
      'from the last-kilometre handoff. The validated kilometre road is '+
      'shown without an individual finish, replay or points. Choose '+
      'different route conditions or tactics and run again.';
  if(error.roadPreview?.unsupportedReason==='unresolved_band_contact')
    return 'The front, bunch or isolated paths meet during the last '+
      'kilometre without a paid contact model. The validated kilometre '+
      'road is shown without an individual finish, replay or points. '+
      'Choose different route conditions or tactics and run again.';
  if(error.roadPreview?.unsupportedReason==='individual_late_catch')
    return `${error.cause.groupId} meets the bunch with ${
      Math.round(error.roadPreview.catch.metresToGo)} m to go. `+
      'The group-level final-kilometre road and contact are paid through the line, '+
      'but individual places, replay and points remain unresolved.';
  if(error.message.startsWith(
    'The separated finale needs a recorded catch for ')&&
    Number.isFinite(error.roadPreview?.catch?.metresToGo))
    return `${error.cause.groupId} is calculated to meet the bunch with ${
      Math.round(error.roadPreview.catch.metresToGo)} m to go. `+
      'The merged road cannot yet be paid and replayed. The recorded '+
      'kilometre road is shown without a finish or points. Choose '+
      'different route conditions or tactics and run again.';
  if(error.message===
    'The v93 preview cannot continue riders leaving the bunch after 500 m.'&&
    Number.isFinite(error.cause?.metresToGo))
    return `Riders leave the bunch with ${error.cause.metresToGo} m to go. `+
      'Their separate movement cannot yet be reconciled with the bunch '+
      'replay. The paid road is shown without a finish or points. '+
      'Choose different route conditions or tactics and run again.';
  if(error.message!==
    'The nominated lead-out cannot work beside the finisher.'||
    !['different_road_group','exhausted'].includes(error.cause?.reason)||
    typeof error.cause?.helperId!=='string')return error.message;
  const reason=error.cause.reason==='different_road_group'?
    'is in a different road group':'has too little energy';
  return `${error.cause.helperId} ${reason} at 500 m and cannot lead out. `+
    'No race preview was recorded. Choose another helper or none and run again.';
}
async function handler(request,_context,auth){
  if(process.env.PELOTONIA_V91_PLAYTEST_ENABLED!=='true')
    return NextResponse.json({ok:false,error:'Playtest unavailable.'},{status:404});
  if(Number(request.headers.get('content-length')??0)>8192)
    return NextResponse.json({ok:false,error:'The request is too large.'},{status:413});
  const now=Date.now();
  for(const [id,entry] of runs)if(entry.until<=now)runs.delete(id);
  const entry=runs.get(auth.user.id)??{count:0,until:now+60_000};
  if(runs.size>=1000&&!runs.has(auth.user.id))
    return NextResponse.json({ok:false,error:'Playtest busy.'},{status:429});
  entry.count++;
  runs.set(auth.user.id,entry);
  if(entry.count>6)
    return NextResponse.json({ok:false,error:'Please wait a minute before running another race.'},{status:429});
  let input;
  try{input=await request.json();}catch{
    return NextResponse.json({ok:false,error:'Invalid request.'},{status:400});
  }
  if(!input||typeof input!=='object'||Array.isArray(input))
    return NextResponse.json({ok:false,error:'Invalid request.'},{status:400});
  try{
    if(input.mode==='v94-race-dynamics'){
      if(Object.keys(input).some(key=>
        !['mode','settings','format','rivalGoals',
          'controlWithdrawalVersion'].includes(key)))
        return NextResponse.json({ok:false,error:'Invalid race preview request.'},
          {status:400});
      try{
        const {preview}=createV94RaceDynamicsPreview(input);
        return NextResponse.json({ok:true,raceDynamics:preview});
      }catch(error){
        if(error.message.startsWith('Choose '))
          return NextResponse.json({ok:false,error:error.message},
            {status:400});
        return NextResponse.json({ok:false,
          error:'The experimental road could not be completed or replayed. '+
            'Choose another seed or plan and run again.',
          status:'unsupported_road_or_plan'},{status:422});
      }
    }
    if(input.mode==='v93-coasted'){
      if(process.env.PELOTONIA_V93_COASTED_PLAYTEST_ENABLED!=='true')
        return NextResponse.json({ok:false,error:'V93 preview unavailable.'},
          {status:404});
      if(Object.keys(input).some(key=>
        !['mode','settings','plans','pointContext'].includes(key))||
        !input.settings||!Array.isArray(input.plans))
        return NextResponse.json({ok:false,error:'Invalid v93 preview request.'},
          {status:400});
      try{
        const race=createV93CoastedPlaytest(input.settings,{
          plans:input.plans,pointContext:input.pointContext??null});
        return NextResponse.json({ok:true,
          coasted:{...summarizeV93CoastedPlaytest(race),
            stageTrace:summarizeRecordedStageTrace(race.recording)}});
      }catch(error){
        return NextResponse.json({ok:false,error:v93PlanError(error),
          status:'unsupported_road_or_plan',
          ...(error.roadPreview?{roadPreview:error.roadPreview}:{})},
        {status:422});
      }
    }
    if(input.mode==='integrated'){
      const {mode,...scenario}=input;
      const output=runV91IntegratedTestDrive(scenario,{full:true});
      const source=output.recording?.recording??
        createV91Playtest(scenario.settings).recording;
      const kilometreReplay=summarizeV91Playtest({settings:output.summary.input??
        scenario.settings,recording:source});
      const playtest={settings:kilometreReplay.settings,
        tuningVersion:kilometreReplay.tuningVersion,
        handoffKm:source.route.distanceKm-1,
        frames:kilometreReplay.frames.slice(0,-1)};
      const decision=output.recording?.roadDecision;
      const intent=output.recording?.attackIntent;
      const attackRoad=intent&&decision?{
        riderId:intent.riderId,atKm:intent.atKm,
        branch:decision.branch,handoffDistanceM:decision.handoffDistanceM,
        roadGroupCount:decision.roadGroupCount,
        pelotonRiderCount:decision.pelotonRiderCount}:null;
      return NextResponse.json({ok:true,playtest,
        integrated:output.summary,
        attackRoad,
        attackApproach:summarizeV91PaidNamedAttackApproach(output.recording),
        soloApproach:summarizeV91PaidSoloApproach(output.recording),
        finaleReplay:summarizeV91PaidFinaleReplay(output.recording),
        finaleTail:summarizeV91PaidFinaleTail(output.recording),
        finaleContactReplay:summarizeV91PaidPartialContactReplay(
          output.recording),
        concurrentLateCatchReplay:
          summarizeV91PaidConcurrentLateCatchReplay(output),
        concurrentDoubleCatchReplay:
          summarizeV91PaidConcurrentDoubleCatchReplay(output),
        multibandReplay:summarizeV91PaidMultibandReplay(output)});
    }
    if(input.mode!==undefined)
      return NextResponse.json({ok:false,error:'Invalid playtest mode.'},
        {status:400});
    const playtest=createV91Playtest(input);
    return NextResponse.json({ok:true,playtest:summarizeV91Playtest(playtest)});
  }catch(error){
    if(error.message.startsWith('Choose ')||
      error.message==='Invalid test-drive scenario.')
      return NextResponse.json({ok:false,error:error.message},{status:400});
    throw error;
  }
}

export const POST=protectedRoute(handler);
