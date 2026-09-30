import {NextResponse} from "next/server";
import {protectedRoute,databaseClient,requireGameWrites} from "../../../../../lib/auth/server";
import {AuthError} from "../../../../../lib/auth/policy.mjs";
import {uuid} from "../../../../../lib/race/server";
import {runAutopilotBatch} from "../../../../../lib/calendar/autopilot-server";

export const maxDuration=60;
export const POST=protectedRoute(async(req)=>{
  requireGameWrites();
  const body=await req.json().catch(()=>({}));
  const eventId=uuid(body.event_id);
  const cursor=body.cursor==null?null:uuid(body.cursor);
  const limit=body.limit??20;
  if(!Number.isInteger(limit)||limit<1||limit>25)
    throw new AuthError("INVALID_BATCH","Choose a batch size from 1 to 25 teams.",400);
  const {last_cursor,...result}=await runAutopilotBatch(databaseClient(),eventId,cursor,limit);
  return NextResponse.json(result);
},{admin:true});
