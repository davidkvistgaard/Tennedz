// Disposable auth-test transport probe. The random event does not exist;
// the save function must reject before writing a race.
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {readTestConfig} from '../tests/support/real-project.mjs';

const {url,serviceKey}=readTestConfig();
const db=createClient(url,serviceKey,{auth:{persistSession:false,
  autoRefreshToken:false,detectSessionInUrl:false},
global:{fetch:(input,init)=>fetch(input,{...init,
  signal:AbortSignal.timeout(90000)})}});
const eventId=randomUUID();
const existing=await db.from('events').select('id').eq('id',eventId)
  .maybeSingle();
if(existing.error||existing.data)
  throw new Error('Refusing payload probe: event lookup failed or exists.');
const payload={p_event:eventId,p_snapshot:{},p_entries:[],
  p_document:{padding:'x'.repeat(3283473)},
  p_archive_metadata:{},
  p_archive_base64:Buffer.alloc(2975934).toString('base64')};
const bytes=Buffer.byteLength(JSON.stringify(payload));
const start=performance.now();
const {data,error}=await db.rpc(
  'recovery_save_position_race_recording_v1',payload);
const after=await db.from('recovery_position_race_recordings')
  .select('event_id').eq('event_id',eventId).maybeSingle();
if(after.error||after.data||data)
  throw new Error('The nonexistent event unexpectedly saved a recording.');
console.log(JSON.stringify({payloadBytes:bytes,
  elapsedMs:Math.round(performance.now()-start),
  rejectedCode:error?.code??null,
  rejectedMessage:error?.message?.slice(0,130)??null,
  transportReachedSql:['PT404','PT409'].includes(error?.code)}));
if(!['PT404','PT409'].includes(error?.code))process.exitCode=1;
