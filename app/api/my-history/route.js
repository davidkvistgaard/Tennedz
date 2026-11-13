import { protectedRoute } from "../../../lib/auth/server";
import { assertTeamId, AuthError } from "../../../lib/auth/policy.mjs";
import { NextResponse } from "next/server";
import {positionResultPublishedV1} from
  "../../../lib/viewer/position-result-publication-v1.mjs";
export const POST = protectedRoute(async(req,context,auth)=>{
  const body=await req.json().catch(()=>({})); assertTeamId(body.team_id,auth.team.id);
  const limit=Number(body.limit ?? 25);
  if (!Number.isInteger(limit) || limit<1 || limit>100) throw new AuthError("INVALID_LIMIT","Ugyldigt antal resultater.",400);
  const {data,error}=await auth.db.from("event_team_results")
    .select("event_id,team_id,division_index,position,points,created_at,event:events(id,name,engine_version,scheduled_at)")
    .eq("team_id",auth.team.id).order("created_at",{ascending:false}).limit(limit);
  if (error) throw new AuthError("HISTORY_UNAVAILABLE","Could not load your history.",503);
  const rows=[],publication=new Map(),now=Date.now();
  try{
    for(const row of data||[]){
      if(row.event&&!publication.has(row.event_id))
        publication.set(row.event_id,await positionResultPublishedV1(
          auth.db,row.event,now));
      if(!row.event||publication.get(row.event_id))
        rows.push({...row,event_name:row.event?.name||"One-day race"});
    }
  }catch{throw new AuthError("HISTORY_UNAVAILABLE",
    "Could not check result publication.",503);}
  return NextResponse.json({ok:true,rows});
});
