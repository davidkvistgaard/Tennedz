import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../lib/auth/server';
import {summarizeGuidedStagePlan} from
  '../../../../lib/engine/v2/playtest-stage-plan.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const requests=new Map();
async function handler(request,_context,auth){
  if(process.env.PELOTONIA_V91_PLAYTEST_ENABLED!=='true')
    return NextResponse.json({ok:false,error:'Stage plan unavailable.'},
      {status:404});
  if(Number(request.headers.get('content-length')??0)>8192)
    return NextResponse.json({ok:false,error:'The request is too large.'},
      {status:413});
  const now=Date.now();
  for(const [id,entry] of requests)if(entry.until<=now)requests.delete(id);
  const entry=requests.get(auth.user.id)??{count:0,until:now+60_000};
  if(requests.size>=1000&&!requests.has(auth.user.id))
    return NextResponse.json({ok:false,error:'Stage plan busy.'},
      {status:429});
  entry.count++;
  requests.set(auth.user.id,entry);
  if(entry.count>20)
    return NextResponse.json({ok:false,error:'Please wait before loading another stage.'},
      {status:429});
  let input;
  try{input=await request.json();}catch{
    return NextResponse.json({ok:false,error:'Invalid request.'},
      {status:400});
  }
  if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).some(key=>key!=='settings')||
    !input.settings||typeof input.settings!=='object'||
    Array.isArray(input.settings)||
    Object.keys(input.settings).some(key=>
      !['distanceKm','terrain','seed','profileHeightsM'].includes(key)))
    return NextResponse.json({ok:false,error:'Invalid stage settings.'},
      {status:400});
  try{
    return NextResponse.json({ok:true,stagePlan:
      summarizeGuidedStagePlan(input.settings)});
  }catch{
    return NextResponse.json({ok:false,error:'Choose valid stage settings.'},
      {status:400});
  }
}
export const POST=protectedRoute(handler);
