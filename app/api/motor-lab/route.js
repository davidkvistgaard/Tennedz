import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../lib/auth/server';
import {createMotorLabPreview} from '../../../lib/engine/v2/preview.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';

// Supplemental per-process protection for a CPU-bound, read-only fixture.
const runs=new Map();
function allowRun(userId,now=Date.now()){
 for(const [id,entry] of runs)if(entry.until<=now)runs.delete(id);
 const entry=runs.get(userId)??{count:0,until:now+60_000};
 if(runs.size>=1000&&!runs.has(userId))return false;
 entry.count++;
 runs.set(userId,entry);
 return entry.count<=20;
}

async function handler(request,_context,auth){
 if(Number(request.headers.get('content-length')??0)>1024)
  return NextResponse.json({ok:false,error:'The request is too large.'},{status:413});
 if(!allowRun(auth.user.id))
  return NextResponse.json({ok:false,error:'Too many preview runs. Try again in a minute.'},{status:429});
 let input;
 try{input=await request.json();}catch{
  return NextResponse.json({ok:false,error:'Invalid request.'},{status:400});
 }
 try{
  const recording=createMotorLabPreview({plan:input?.plan,seed:input?.seed});
  return NextResponse.json({ok:true,recording});
 }catch(error){
  if(error.message==='Choose a valid plan and scenario number.')
   return NextResponse.json({ok:false,error:error.message},{status:400});
  throw error;
 }
}

export const POST=protectedRoute(handler);
