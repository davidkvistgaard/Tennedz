// Read-only check of one disposable v2 recording in the isolated project.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {loadStoredV2SettlementPreflight}
  from '../../lib/race/v2-settlement-preflight.mjs';

const config=JSON.parse(readFileSync(process.env.PELOTONIA_P03_TEST_CONFIG,'utf8'));
if(config.url!=='https://nxhvaoonnvmvohqaxfdx.supabase.co'||!config.serviceKey)
  throw new Error('Refusing a project outside the isolated test allowlist.');
const eventId=process.argv[2];
assert.match(eventId,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const db=createClient(config.url,config.serviceKey,
  {auth:{persistSession:false,autoRefreshToken:false}});
const {data:lock,error}=await db.from('recovery_v2_tactics_commits')
  .select('input_snapshot').eq('event_id',eventId).single();
if(error)throw error;
const preflight=await loadStoredV2SettlementPreflight(db,lock.input_snapshot);
const {data:awards,error:awardsError}=await db.from('recovery_ranking_awards')
  .select('award_key').eq('event_id',eventId);
if(awardsError)throw awardsError;
assert.equal(awards.length,0);
console.log(JSON.stringify({eventId,
  divisions:preflight.contract.divisions.length,
  teams:preflight.contract.divisions.reduce((sum,division)=>sum+division.teamIds.length,0),
  ledgerRows:preflight.ledgerRows.length,persistedAwards:awards.length}));
