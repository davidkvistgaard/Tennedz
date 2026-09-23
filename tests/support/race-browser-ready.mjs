// Add the second synthetic entrant and pass the deadline for the UI execution test.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";
import {request} from "@playwright/test";
import {readTestConfig} from "./real-project.mjs";
const cfg=readTestConfig(),db=createClient(cfg.url,cfg.serviceKey,{auth:{persistSession:false}});
const accounts=JSON.parse(readFileSync(new URL("../../.recovery-local/real-test-fixtures.json",import.meta.url)));
const f=JSON.parse(readFileSync(new URL("../../.recovery-local/race-fixtures.json",import.meta.url)));
const c=await request.newContext({baseURL:"http://localhost:3100",extraHTTPHeaders:{Origin:"http://localhost:3100"}});
try {
 assert.equal((await c.post("/api/auth/login",{data:{login_name:accounts.bob.email,password:accounts.bob.password}})).status(),200);
 const t=f.teams.bob;
 const joined=await c.post("/api/event/join",{data:{event_id:f.browserEvent,team_id:t.id,selected_riders:t.riders,captain_id:t.riders[0]}});
 assert.equal(joined.status(),200,await joined.text());
 const {error}=await db.from("events").update({deadline:new Date(Date.now()-5000).toISOString()}).eq("id",f.browserEvent);
 assert.equal(error,null);
 console.log("Browser fixture has two entrants and a passed deadline in the isolated test project.");
} finally {await c.dispose();}
