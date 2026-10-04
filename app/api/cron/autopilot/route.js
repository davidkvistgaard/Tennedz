import {randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {databaseClient,authFailure,privateHeaders,requireGameWrites} from "../../../../lib/auth/server";
import {AuthError} from "../../../../lib/auth/policy.mjs";
import {rpc} from "../../../../lib/race/server";
import {runAutopilotBatch} from "../../../../lib/calendar/autopilot-server";

export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(req){
  try{
    const secret=process.env.CRON_SECRET;
    if(!secret||req.headers.get("authorization")!==`Bearer ${secret}`)
      throw new AuthError("UNAUTHORIZED","Unauthorized.",401);
    if(process.env.PELOTONIA_AUTOPILOT_ENABLED!=="true")
      return NextResponse.json({ok:true,enabled:false},{headers:privateHeaders});
    requireGameWrites();
    const db=databaseClient();
    const started=Date.now();
    const batches=[];
    // Leave room for a slow final RPC and the function's 60-second limit.
    while(Date.now()-started<35000){
      const token=randomUUID();
      const job=await rpc(db,"recovery_autopilot_claim_job",{p_token:token});
      if(!job)break;
      const batch=await runAutopilotBatch(db,job.event_id,job.cursor_team_id,10);
      const complete=batch.next_cursor===null;
      const advanced=await rpc(db,"recovery_autopilot_advance_job",{
        p_event:job.event_id,p_token:token,p_cursor:batch.last_cursor,
        p_processed:batch.processed,p_entered:batch.entered,p_complete:complete,
      });
      if(!advanced)throw new AuthError("AUTOPILOT_LEASE_LOST",
        "The autopilot job lease expired. The batch will be retried.",503);
      batches.push({event_id:job.event_id,processed:batch.processed,
        entered:batch.entered,complete});
    }
    return NextResponse.json({ok:true,enabled:true,batches},
      {headers:privateHeaders});
  }catch(error){return authFailure(error);}
}
