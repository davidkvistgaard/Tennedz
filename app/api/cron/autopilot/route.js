import {randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {databaseClient,authFailure,privateHeaders,requireGameWrites} from "../../../../lib/auth/server";
import {AuthError} from "../../../../lib/auth/policy.mjs";
import {rpc} from "../../../../lib/race/server";
import {runAutopilotBatch} from "../../../../lib/calendar/autopilot-server";
import {revealDueDivisions} from "../../../../lib/calendar/reveal-server";
import {overdueDivisionReveals} from "../../../../lib/calendar/reveal-health.mjs";

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
      if(!advanced)throw new AuthError("AUTOPILOT_PROGRESS_REJECTED",
        "The entry scan could not be saved before registration closed or its lease expired. Administrator review may be required.",503);
      batches.push({event_id:job.event_id,processed:batch.processed,
        entered:batch.entered,complete});
    }
    const divisions=await revealDueDivisions(db);
    const overdue=await overdueDivisionReveals(db);
    // A due reveal with an unfinished entry scan cannot safely be committed.
    // Surface it as a failed scheduler run so monitoring cannot mistake an
    // HTTP 200 with no reveal for a healthy registration close.
    if(overdue.length||divisions.pending.some(item=>item.reason==="AUTOPILOT_PENDING"))
      return NextResponse.json({ok:false,enabled:true,
        code:overdue.length?"DIVISION_REVEAL_OVERDUE":"DIVISION_REVEAL_BLOCKED",
        batches,divisions,overdue},
      {status:503,headers:privateHeaders});
    return NextResponse.json({ok:true,enabled:true,batches,divisions,overdue},
      {headers:privateHeaders});
  }catch(error){return authFailure(error);}
}
