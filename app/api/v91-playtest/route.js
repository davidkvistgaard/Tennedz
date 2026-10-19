import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../lib/auth/server';
import {createV91Playtest,summarizeV91Playtest} from '../../../lib/engine/v2/playtest.mjs';
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
      const playtest=summarizeV91Playtest({settings:output.summary.input??
        scenario.settings,recording:source});
      return NextResponse.json({ok:true,playtest,
        integrated:output.summary});
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
