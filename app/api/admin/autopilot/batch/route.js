import {NextResponse} from "next/server";
import {protectedRoute,databaseClient,requireGameWrites} from "../../../../../lib/auth/server";
import {AuthError} from "../../../../../lib/auth/policy.mjs";
import {uuid} from "../../../../../lib/race/server";
import {enterAutopilotEntry} from "../../../../../lib/calendar/autopilot-server";

export const maxDuration=60;
export const POST=protectedRoute(async(req)=>{
  requireGameWrites();
  const body=await req.json().catch(()=>({}));
  const eventId=uuid(body.event_id);
  const cursor=body.cursor==null?null:uuid(body.cursor);
  const limit=body.limit??20;
  if(!Number.isInteger(limit)||limit<1||limit>25)
    throw new AuthError("INVALID_BATCH","Choose a batch size from 1 to 25 teams.",400);
  const db=databaseClient();
  let query=db.from("teams").select("id").order("id").limit(limit);
  if(cursor)query=query.gt("id",cursor);
  const {data:teams,error}=await query;
  if(error)throw new AuthError("AUTOPILOT_UNAVAILABLE","Could not list teams for autopilot.",503);
  const results=[];
  for(const team of teams??[]){
    try{
      const result=await enterAutopilotEntry(db,eventId,team.id);
      results.push({team_id:team.id,entered:!!result.entered,
        reason:result.reason??null});
    }catch(error){
      // Retry the page after service failures. The atomic join makes already
      // entered teams safe to revisit; advancing the cursor would lose them.
      if(!(error instanceof AuthError)||error.status>=500)throw error;
      // A team-specific eligibility failure does not stop the page.
      results.push({team_id:team.id,entered:false,
        reason:error instanceof AuthError?error.code:"AUTOPILOT_UNAVAILABLE"});
    }
  }
  return NextResponse.json({ok:true,event_id:eventId,processed:results.length,
    entered:results.filter(item=>item.entered).length,
    next_cursor:results.length===limit?results.at(-1).team_id:null,results});
},{admin:true});
