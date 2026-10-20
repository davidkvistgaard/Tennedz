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

export const runtime='nodejs';
export const dynamic='force-dynamic';

const runs=new Map();
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
          summarizeV91PaidConcurrentDoubleCatchReplay(output)});
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
