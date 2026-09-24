import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {readTestConfig} from "./real-project.mjs";
const cfg=readTestConfig(),db=createClient(cfg.url,cfg.serviceKey,{auth:{persistSession:false}});
const auth=JSON.parse(readFileSync(new URL("../../.recovery-local/real-test-fixtures.json",import.meta.url),"utf8"));
const target=new URL("../../.recovery-local/race-fixtures.json",import.meta.url);
const f=existsSync(target)?JSON.parse(readFileSync(target,"utf8")):{stage:randomUUID(),event:randomUUID(),browserEvent:randomUUID(),teams:{}};
if(f.ready)throw Error("Race fixtures already exist; do not silently reseed.");
const save=()=>writeFileSync(target,JSON.stringify(f,null,2));save();
async function ok(query){const r=await query;if(r.error)throw r.error;return r.data;}
for(const name of ["alice","bob"]){
  const team=auth[name].teamIds[0];
  const existing=await ok(db.from("team_riders").select("rider_id").eq("team_id",team));
  const ids=existing.map(x=>x.rider_id);
  const skills=Object.fromEntries(["sprint","flat","hills","mountain","cobbles","leadership","endurance","moral","luck","wind","form","timetrial"].map(k=>[k,40]));
  while(ids.length<8){const id=randomUUID();await ok(db.from("riders").insert({id,name:`${name.toUpperCase()} Race ${ids.length+1}`,gender:"M",...skills}));await ok(db.from("team_riders").insert({team_id:team,rider_id:id}));ids.push(id);}
  f.teams[name]={id:team,riders:ids.slice(0,8)};save();
}
await ok(db.from("stage_profiles").upsert({id:f.stage,name:"Recovery Flat 130",distance_km:130,tags:["FLAT","ROAD"],profile_points:[[0,20],[65,30],[130,20]]},{onConflict:"id",ignoreDuplicates:true}));
for(const [id,name] of [[f.event,"Recovery atomic race"],[f.browserEvent,"Recovery browser race"]])await ok(db.from("events").upsert({id,name,kind:"one_day",gender:"M",country_code:"FR",stage_profile_id:f.stage,deadline:new Date(Date.now()+86400000).toISOString(),entry_fee:25},{onConflict:"id",ignoreDuplicates:true}));
f.ready=true;save();
console.log("Synthetic race fixtures ready in isolated test project; no production data used.");
