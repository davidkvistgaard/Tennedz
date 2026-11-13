import { NextResponse } from "next/server";
import { protectedRoute } from "../../../lib/auth/server";
import { AuthError } from "../../../lib/auth/policy.mjs";
import {positionResultPublishedV1} from
  "../../../lib/viewer/position-result-publication-v1.mjs";
export const GET=protectedRoute(async(req,ctx,auth)=>{
  const gender=new URL(req.url).searchParams.get("gender") || "M";
  if(!["M","F"].includes(gender)) throw new AuthError("INVALID_GENDER","Choose men or women.",400);
  const target=process.env.PELOTONIA_PHYSICAL_ENTRY_EVENT_ID;
  if(process.env.PELOTONIA_V7_RACE_ENABLED==='true'&&target){
    const {data:event,error:eventError}=await auth.db.from('events')
      .select('id,status,gender,engine_version,scheduled_at')
      .eq('id',target).maybeSingle();
    if(eventError)throw new AuthError('RANKING_UNAVAILABLE',
      'Could not check ranking publication.',503);
    if(event?.gender===gender&&event.status==='FINISHED'){
      let published;
      try{published=await positionResultPublishedV1(
        auth.db,event,Date.now());}
      catch{throw new AuthError('RANKING_UNAVAILABLE',
        'Could not check ranking publication.',503);}
      if(!published)throw new AuthError('RANKING_PENDING',
        'Rankings will update after the shared race reaches the finish.',409);
    }
  }
  const {data,error}=await auth.db.rpc("recovery_rankings",{p_gender:gender});
  if(error) throw new AuthError("RANKING_UNAVAILABLE","Could not load the rankings.",503);
  return NextResponse.json(data);
});
