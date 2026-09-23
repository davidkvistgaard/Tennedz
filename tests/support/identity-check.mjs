// Test project only. Synthetic accounts are retained; production is never targeted.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {request} from '@playwright/test';
import {readTestConfig} from './real-project.mjs';
import {starterPack} from '../../lib/onboarding/starter.mjs';
const config=readTestConfig();
const db=createClient(config.url,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const path=new URL('../../.recovery-local/identity-fixtures.json',import.meta.url);
const saved=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{};
for(const key of ['riders','rollback']) {
  if(saved[key])continue;
  const email=`identity-${key}-${Date.now()}@example.com`,password=randomBytes(24).toString('base64url');
  const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(error);
  saved[key]={id:data.user.id,email,password};writeFileSync(path,JSON.stringify(saved,null,2));
}
const origin='http://localhost:3100';
const c=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
let passed=0;const pass=label=>{passed++;console.log('PASS '+label);};
try{
  assert.equal((await c.post('/api/auth/login',{data:{login_name:saved.riders.email,password:saved.riders.password}})).status(),200);
  const responses=await Promise.all(Array.from({length:4},()=>c.post('/api/onboarding',{data:{name:'Identity Test Cycling',appearance:{seed:'forged'},nationality:'FORGED'}})));
  for(const res of responses)assert.equal(res.status(),200,await res.text());
  const body=await (await c.get('/api/auth/me')).json();assert.equal(body.riders.length,16);
  for(const r of body.riders){assert.equal(r.appearance.version,1);assert.ok(r.first_name&&r.last_name);assert.notEqual(r.nationality,'FORGED');assert.ok(!Object.keys(r).some(k=>k.endsWith('_cap')));}
  pass('authenticated onboarding stores sixteen server-generated identities, no hidden caps');
  const stored=await db.from('riders').select('id,appearance,middle_name,nationality').in('id',body.riders.map(r=>r.id));assert.ifError(stored.error);
  for(const r of body.riders)assert.deepEqual(stored.data.find(s=>s.id===r.id).appearance,r.appearance);
  assert.equal(new Set(body.riders.map(r=>r.appearance.seed)).size,16);pass('profiles round-trip unchanged through database and API');
  const repeated=await (await c.get('/api/auth/me')).json();assert.deepEqual(repeated.riders,body.riders);pass('reload returns identical identities');
  const pack=starterPack(()=>.67);pack[15].appearance={...pack[0].appearance,seed:'different-seed-same-face'};
  const before=await db.from('riders').select('id',{head:true,count:'exact'});assert.ifError(before.error);
  const result=await db.rpc('recovery_create_starter_team',{p_user:saved.rollback.id,p_name:'Duplicate Face Test',p_riders:pack});
  assert.equal(result.error?.code,'23505');
  const after=await db.from('riders').select('id',{head:true,count:'exact'});assert.equal(after.count,before.count);
  const teams=await db.from('teams').select('id').eq('user_id',saved.rollback.id);assert.equal(teams.data.length,0);pass('identical facial traits rejected even with another seed; entire creation rolls back');
  const invalid=starterPack(()=>.68);invalid[15].appearance={version:1};
  const bad=await db.rpc('recovery_create_starter_team',{p_user:saved.rollback.id,p_name:'Invalid Identity Test',p_riders:invalid});assert.equal(bad.error?.code,'23514');pass('incomplete stored profile rejected');
  const anon=createClient(config.url,config.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const update=await anon.from('riders').update({appearance:{version:1,seed:'forged'}}).eq('id',body.riders[0].id).select('id');
  assert.ok(update.error||update.data.length===0);pass('anonymous caller cannot replace rider identity');
  console.log(`${passed} identity integration checks passed.`);
}finally{await c.dispose();}
