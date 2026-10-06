// Read-only check of one disposable v2 recording in the isolated project.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {loadV2SettlementReadiness}
  from '../../lib/race/v2-settlement-readiness.mjs';

const config=JSON.parse(readFileSync(process.env.PELOTONIA_P03_TEST_CONFIG,'utf8'));
if(config.url!=='https://nxhvaoonnvmvohqaxfdx.supabase.co'||!config.serviceKey)
  throw new Error('Refusing a project outside the isolated test allowlist.');
const eventId=process.argv[2];
assert.match(eventId,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const db=createClient(config.url,config.serviceKey,
  {auth:{persistSession:false,autoRefreshToken:false}});
const preflight=await loadV2SettlementReadiness(db,eventId);
const {data:awards,error:awardsError}=await db.from('recovery_ranking_awards')
  .select('award_key').eq('event_id',eventId);
if(awardsError)throw awardsError;
assert.equal(awards.length,0);
console.log(JSON.stringify({eventId,
  divisions:preflight.contract.divisions.length,
  teams:preflight.contract.divisions.reduce((sum,division)=>sum+division.teamIds.length,0),
  ledgerRows:preflight.ledgerRows.length,persistedAwards:awards.length}));
