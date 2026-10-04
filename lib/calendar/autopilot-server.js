import "server-only";
import {AuthError} from "../auth/policy.mjs";
import {rpc} from "../race/server";
import {planAutopilotEntry} from "./autopilot-entry.mjs";

function checked(result,description){
  if(result.error)throw new AuthError("AUTOPILOT_UNAVAILABLE",`Could not load ${description}.`,503);
  return result.data;
}

export async function previewAutopilotEntry(db,eventId,teamId){
  const [eventResult,teamResult,defaultResult,rosterResult,entryResult]=await Promise.all([
    db.from("events").select("id,kind,gender,calendar_source,race_team_size,scheduled_at,deadline,status")
      .eq("id",eventId).maybeSingle(),
    db.from("teams").select("id,user_id").eq("id",teamId).maybeSingle(),
    db.from("recovery_default_lineups")
      .select("gender,event_format,selected_riders,captain_id")
      .eq("team_id",teamId).eq("event_format","ONE_DAY"),
    db.from("team_riders").select("rider:riders(id,gender,rating,injury_until)")
      .eq("team_id",teamId),
    db.from("event_teams").select("event_id").eq("event_id",eventId)
      .eq("team_id",teamId).maybeSingle(),
  ]);
  const event=checked(eventResult,"the event"),team=checked(teamResult,"the team");
  const defaults=checked(defaultResult,"default teams"),membership=checked(rosterResult,"the roster");
  const existingEntry=checked(entryResult,"the event entry");
  if(!event||!team)throw new AuthError("AUTOPILOT_NOT_FOUND","The team or race was not found.",404);
  let conflictingEventIds=[];
  if(event.scheduled_at&&event.kind==="one_day"){
    const day=event.scheduled_at.slice(0,10);
    const next=new Date(Date.parse(`${day}T00:00:00Z`)+86400000).toISOString();
    const sameDay=checked(await db.from("events").select("id")
      .eq("kind","one_day").eq("gender",event.gender).neq("id",eventId)
      .gte("scheduled_at",`${day}T00:00:00Z`).lt("scheduled_at",next),"same-day races");
    const ids=(sameDay??[]).map(row=>row.id);
    if(ids.length){const entries=checked(await db.from("event_teams").select("event_id")
      .eq("team_id",teamId).in("event_id",ids),"competing entries");
      conflictingEventIds=(entries??[]).map(row=>row.event_id);}
  }
  const saved=(defaults??[]).find(item=>item.gender===event.gender);
  return planAutopilotEntry({event,team,
    roster:(membership??[]).map(row=>row.rider).filter(Boolean),
    defaultSelection:saved?{selectedRiders:saved.selected_riders,captainId:saved.captain_id}:null,
    existingEntry:!!existingEntry,conflictingEventIds});
}

export async function enterAutopilotEntry(db,eventId,teamId){
  const plan=await previewAutopilotEntry(db,eventId,teamId);
  if(!plan.ready)return {ok:true,entered:false,...plan};
  return rpc(db,"recovery_autopilot_join_event",{
    p_user:plan.userId,p_event:plan.eventId,p_riders:plan.selectedRiders,
    p_captain:plan.captainId,p_orders:plan.orders,
  });
}

export async function runAutopilotBatch(db,eventId,cursor,limit){
  let query=db.from("teams").select("id").order("id").limit(limit);
  if(cursor)query=query.gt("id",cursor);
  const teams=checked(await query,"teams for autopilot")??[];
  const results=[];
  // Different teams can be checked together. Wait for every in-flight join
  // before reporting a failed page, so no request continues after the lease is
  // abandoned. The receipt table makes a retried page safe after partial work.
  for(let offset=0;offset<teams.length;offset+=4){
    const settled=await Promise.allSettled(teams.slice(offset,offset+4).map(async team=>{
      try{
        const result=await enterAutopilotEntry(db,eventId,team.id);
        return {team_id:team.id,entered:!!result.entered,
          reason:result.reason??null};
      }catch(error){
        if(!(error instanceof AuthError)||error.status>=500)throw error;
        return {team_id:team.id,entered:false,reason:error.code};
      }
    }));
    const failure=settled.find(item=>item.status==="rejected");
    if(failure)throw failure.reason;
    for(const item of settled){
      results.push(item.value);
    }
  }
  return {ok:true,event_id:eventId,processed:results.length,
    entered:results.filter(item=>item.entered).length,
    next_cursor:results.length===limit?results.at(-1).team_id:null,
    last_cursor:results.at(-1)?.team_id??cursor,results};
}
