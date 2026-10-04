import {NextResponse} from "next/server";
import {protectedRoute,databaseClient,requireGameWrites} from "../../../../lib/auth/server";
import {uuid} from "../../../../lib/race/server";
import {previewAutopilotEntry,enterAutopilotEntry} from "../../../../lib/calendar/autopilot-server";

export const dynamic="force-dynamic";
export const GET=protectedRoute(async(req)=>{
  const params=new URL(req.url).searchParams;
  const plan=await previewAutopilotEntry(databaseClient(),
    uuid(params.get("event_id")),uuid(params.get("team_id")));
  return NextResponse.json({ok:true,plan});
},{admin:true});

export const POST=protectedRoute(async(req)=>{
  requireGameWrites();
  const body=await req.json().catch(()=>({}));
  const result=await enterAutopilotEntry(databaseClient(),
    uuid(body.event_id),uuid(body.team_id));
  return NextResponse.json(result);
},{admin:true});
