import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=readFileSync(new URL(
  '../../supabase/migrations/20261109135901_physical_viewer_recording_v1.sql',
  import.meta.url),'utf8');
const event='11111111-1111-4111-8111-111111111111';
const teams=['22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'];
const sha='a'.repeat(64);
const document={schemaVersion:'motor-lab-viewer-document-v2',
  raceId:'recorded-race',sha256:sha,
  input:{eventId:event,officialResults:false},
  coverage:{officialResults:false},source:{raceSeed:'real-seed'},
  feed:{raceId:'recorded-race'}};

async function database(){
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;
    create role service_role;
    create table public.events(id uuid primary key,seed text);
    create table public.recovery_physical_entry_inputs(
      event_id uuid,team_id uuid,schema_version text,
      selected_riders uuid[],captain_id uuid,orders jsonb,
      stake jsonb,team_style jsonb,rider_numbers jsonb,
      committed_at timestamptz default now());
    create function public.recovery_race_snapshot(p_event uuid)
    returns jsonb language sql as $$select jsonb_build_object(
      'event',jsonb_build_object('id',e.id,'seed',e.seed),
      'teams',(select jsonb_agg(jsonb_build_object('id',i.team_id)
        order by i.team_id) from public.recovery_physical_entry_inputs i
        where i.event_id=e.id))
      from public.events e where e.id=p_event$$;`);
  await db.query('insert into public.events values($1,$2)',
    [event,'real-seed']);
  for(const team of teams)
    await db.query(`insert into public.recovery_physical_entry_inputs
      (event_id,team_id,schema_version,selected_riders,captain_id,
       orders,stake,team_style,rider_numbers)
      values($1,$2,'physical-entry-input-v1',array[$3]::uuid[],$3,
      '{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb)`,
    [event,team,team]);
  await db.exec(migration);
  return db;
}
async function source(db){
  const snapshot=(await db.query(`select
    public.recovery_race_snapshot($1::uuid) as snapshot`,[event]))
    .rows[0].snapshot;
  const entries=(await db.query(`select to_jsonb(i)-'committed_at'
    as entry from public.recovery_physical_entry_inputs i
    where event_id=$1 order by team_id`,[event]))
    .rows.map(row=>row.entry);
  return {snapshot,entries};
}
async function save(db,{snapshot,entries},value=document){
  return (await db.query(`select
    public.recovery_save_physical_viewer_recording_v1(
      $1::uuid,$2::jsonb,$3::jsonb,$4::jsonb) as receipt`,
  [event,JSON.stringify(snapshot),JSON.stringify(entries),
    JSON.stringify(value)])).rows[0].receipt;
}

test('paid viewer recording is immutable and private',async()=>{
  const db=await database();
  try{
    const input=await source(db);
    await assert.rejects(save(db,input,{...document,
      coverage:{officialResults:true}}),/falsely official/);
    await assert.rejects(save(db,input,{...document,
      feed:{raceId:'recorded-race',results:[{place:1}]}}),
    /falsely official/);
    const first=await save(db,input);
    assert.equal(first.sha256,sha);
    assert.equal(first.already_recorded,false);
    assert.equal((await save(db,input)).already_recorded,true);
    await assert.rejects(save(db,input,{...document,
      sha256:'b'.repeat(64)}),/already committed/);
    const count=await db.query(`select count(*)::int as total
      from public.recovery_physical_viewer_recordings`);
    assert.equal(count.rows[0].total,1);
    const grants=await db.query(`select
      has_table_privilege('anon',
        'public.recovery_physical_viewer_recordings','SELECT')
        as anon_read,
      has_function_privilege('anon',
        'public.recovery_save_physical_viewer_recording_v1(uuid,jsonb,jsonb,jsonb)',
        'EXECUTE') as anon_execute`);
    assert.equal(grants.rows[0].anon_read,false);
    assert.equal(grants.rows[0].anon_execute,false);
  }finally{await db.close();}
});

test('changed team inputs or race snapshot cannot be recorded',async()=>{
  const db=await database();
  try{
    const input=await source(db);
    await db.query(`update public.recovery_physical_entry_inputs
      set orders='{"changed":true}'::jsonb where team_id=$1`,
    [teams[0]]);
    await assert.rejects(save(db,input),/team inputs changed/);
    const current=await source(db);
    await db.query(`update public.events set seed='new-seed'
      where id=$1`,[event]);
    await assert.rejects(save(db,current),/race changed/);
    const count=await db.query(`select count(*)::int as total
      from public.recovery_physical_viewer_recordings`);
    assert.equal(count.rows[0].total,0);
  }finally{await db.close();}
});
