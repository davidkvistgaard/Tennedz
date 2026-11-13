// HTTP and database integration only, explicitly allowlisted disposable project.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync,writeFileSync,existsSync } from "node:fs";
import { request } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { starterPack,skills } from "../../lib/onboarding/starter.mjs";
import { readTestConfig } from "./real-project.mjs";
const config=readTestConfig();
const db=createClient(config.url,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const origin="http://localhost:3100";
const path=new URL("../../.recovery-local/onboarding-fixtures.json",import.meta.url);
const saved=existsSync(path)?JSON.parse(readFileSync(path,"utf8")):{};
for(const name of ["starter","rollback","browser"]) {
  if(saved[name]) continue;
  const password=randomBytes(24).toString("base64url");
  const email=`onboarding-${name}-${Date.now()}@example.com`;
  const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true});
  if(error)throw new Error(`Could not seed synthetic ${name} user: ${error.code}`);
  saved[name]={id:data.user.id,email,password};writeFileSync(path,JSON.stringify(saved,null,2));
}
const original=JSON.parse(readFileSync(new URL("../../.recovery-local/real-test-fixtures.json",import.meta.url),"utf8"));
const contexts=[];let passes=0;
async function client(account) {
  const c=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});contexts.push(c);
  if(account)assert.equal((await c.post("/api/auth/login",{data:{login_name:account.email,password:account.password}})).status(),200);
  return c;
}
function pass(name){passes++;console.log("PASS "+name);}
try {
  const anon=await client();
  assert.equal((await anon.post("/api/onboarding",{data:{name:"Forged Cycling",user_id:original.alice.id}})).status(),401);
  assert.equal((await anon.get("/api/onboarding")).status(),401);pass("anonymous onboarding rejected");
  assert.equal((await anon.post("/api/auth/signup",{data:{email:"invalid",password:"short"}})).status(),400);
  assert.equal((await anon.post("/api/auth/signup",{data:{email:"x@example.com",password:"long-test-passphrase"},headers:{Origin:"https://evil.example"}})).status(),403);pass("signup validation and origin checks before contacting Auth");
  const fresh=await client(saved.starter);
  assert.equal((await fresh.post("/api/onboarding",{data:{name:"<script>"}})).status(),400);
  assert.equal((await fresh.post("/api/onboarding",{data:{name:"X".repeat(41)}})).status(),400);pass("invalid team names rejected");
  const requests=await Promise.all(Array.from({length:6},()=>fresh.post("/api/onboarding",{data:{name:"Test Nordlys",user_id:original.bob.id,coins:99999999,riders:[]}})));
  for(const res of requests)assert.equal(res.status(),200);
  const bodies=await Promise.all(requests.map(r=>r.json()));assert.equal(new Set(bodies.map(b=>b.team_id)).size,1);
  assert.ok(bodies.filter(b=>b.created).length<=1);pass("six concurrent requests resolve to one team");
  const me=await fresh.get("/api/auth/me");assert.equal(me.status(),200);
  const body=await me.json();assert.equal(body.team.user_id,saved.starter.id);assert.equal(body.team.coins,100000);assert.equal(body.riders.length,16);
  for(const gender of ["M","F"])assert.equal(body.riders.filter(r=>r.gender===gender).length,8);
  assert.ok(body.riders.every(r=>r.rating===0&&r.fatigue===0&&r.form===40&&r.birth_date&&r.age>=22&&r.age<=25));
  assert.ok(body.riders.every(r=>Object.keys(r).every(k=>!k.endsWith("_cap")&&!k.includes("potential"))));
  assert.equal(body.is_admin,false);pass("owned 8+8 roster, starting values and hidden caps");
  const stored=await db.from("team_riders").select("rider:riders(*)").eq("team_id",body.team.id);assert.ifError(stored.error);
  for(const row of stored.data)for(const s of skills)assert.ok(row.rider[s+"_cap"]>row.rider[s]);pass("individual caps exist only in stored data");
  const repeat=await fresh.post("/api/onboarding",{data:{name:"Try to rename and reroll"}});assert.equal((await repeat.json()).created,false);
  const again=await(await fresh.get("/api/auth/me")).json();assert.deepEqual(again.team,body.team);assert.deepEqual(again.riders,body.riders);pass("retry does not rename, reroll or grant another starter pack");
  const alice=await client(original.alice);const before=await(await alice.get("/api/auth/me")).json();
  assert.equal((await(await alice.post("/api/onboarding",{data:{name:"Cannot replace existing team"}})).json()).created,false);
  assert.deepEqual(await(await alice.get("/api/auth/me")).json(),before);pass("existing team is unchanged");
  const duplicate=await client(original.duplicate);assert.equal((await duplicate.post("/api/onboarding",{data:{name:"Conflict Cycling"}})).status(),409);
  assert.equal((await duplicate.get("/api/onboarding")).status(),409);pass("ambiguous ownership fails closed");
  const broken=starterPack(()=>0.25);broken[15].sprint_cap=0;
  const countBefore=await db.from("riders").select("id",{count:"exact",head:true});assert.ifError(countBefore.error);
  const bad=await db.rpc("recovery_create_starter_team",{p_user:saved.rollback.id,p_name:"Atomic Failure",p_riders:broken});assert.ok(bad.error);
  const empty=await db.from("teams").select("id").eq("user_id",saved.rollback.id);assert.ifError(empty.error);assert.equal(empty.data.length,0);
  const countAfter=await db.from("riders").select("id",{count:"exact",head:true});assert.ifError(countAfter.error);assert.equal(countAfter.count,countBefore.count);pass("late rider validation failure rolls back team and all riders");
  const direct=await fetch(`${config.url}/rest/v1/rpc/recovery_create_starter_team`,{method:"POST",headers:{apikey:config.anonKey,Authorization:`Bearer ${config.anonKey}`,"Content-Type":"application/json"},body:JSON.stringify({p_user:saved.starter.id,p_name:"Intrusion",p_riders:[]})});
  assert.ok([401,403].includes(direct.status));pass("direct public RPC denied");
  assert.equal((await fresh.post("/api/auth/signup",{data:{email:"unused@example.com",password:"long-passphrase-here"}})).status(),409);pass("signup cannot replace a logged-in session");
  const callback=await anon.get("/auth/callback?code=invalid&next=https://evil.example",{maxRedirects:0});assert.equal(callback.status(),307);assert.equal(callback.headers().location,origin+"/login?confirmation=failed");pass("invalid confirmation is recoverable and cannot redirect externally");
  console.log(`${passes} onboarding integration checks passed. Synthetic accounts retained in allowlisted test project.`);
} finally {await Promise.all(contexts.map(c=>c.dispose()));}
