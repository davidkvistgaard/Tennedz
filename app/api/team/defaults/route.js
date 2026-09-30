import {NextResponse} from "next/server";
import {protectedRoute} from "../../../../lib/auth/server";
import {AuthError,assertTeamId} from "../../../../lib/auth/policy.mjs";
import {DEFAULT_TEAM_SIZES} from "../../../../lib/calendar/config.mjs";
import {validateDefaultLineup} from "../../../../lib/calendar/autopilot.mjs";

export const dynamic="force-dynamic";
export const GET=protectedRoute(async(req,context,{team,db})=>{
  assertTeamId(new URL(req.url).searchParams.get("team_id"),team.id);
  const {data,error}=await db.from("recovery_default_lineups")
    .select("gender,event_format,selected_riders,captain_id,updated_at")
    .eq("team_id",team.id);
  if(error)throw new AuthError("DEFAULTS_UNAVAILABLE","Could not load default teams.",503);
  return NextResponse.json({ok:true,defaults:data??[],team_sizes:DEFAULT_TEAM_SIZES});
});

export const PUT=protectedRoute(async(req,context,{team,db})=>{
  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=="object"||Array.isArray(body)||
    Object.keys(body).some(key=>!["team_id","gender","event_format","selected_riders","captain_id"].includes(key)))
    throw new AuthError("INVALID_DEFAULT","Choose a default squad and captain.",400);
  assertTeamId(body.team_id,team.id);
  const teamSize=DEFAULT_TEAM_SIZES[body.event_format];
  if(!teamSize)throw new AuthError("INVALID_DEFAULT","Choose a valid race format.",400);
  const {data:membership,error:rosterError}=await db.from("team_riders")
    .select("rider:riders(id,gender)").eq("team_id",team.id);
  if(rosterError)throw new AuthError("ROSTER_UNAVAILABLE","Could not check your riders.",503);
  try{validateDefaultLineup({gender:body.gender,eventFormat:body.event_format,
    selectedRiders:body.selected_riders,captainId:body.captain_id},
  (membership??[]).map(row=>row.rider).filter(Boolean),{teamSize});}
  catch(error){throw new AuthError("INVALID_DEFAULT",error.message,400);}
  const {data,error}=await db.from("recovery_default_lineups").upsert({
    team_id:team.id,gender:body.gender,event_format:body.event_format,
    selected_riders:body.selected_riders,captain_id:body.captain_id,
    updated_at:new Date().toISOString(),
  },{onConflict:"team_id,gender,event_format"})
    .select("gender,event_format,selected_riders,captain_id,updated_at").single();
  if(error)throw new AuthError("DEFAULT_SAVE_FAILED","Could not save your default team.",503);
  return NextResponse.json({ok:true,default:data});
});
