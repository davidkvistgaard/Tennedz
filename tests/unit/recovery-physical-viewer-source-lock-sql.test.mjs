import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=readFileSync(new URL(
  '../../supabase/migrations/20261109184219_physical_viewer_source_lock_v1.sql',
  import.meta.url),'utf8');
const event='11111111-1111-4111-8111-111111111111';
const teams=['22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'];
const weather={source:'LOCKED_SIM',temp_c:16,
  wind_kph:12,precipitation_mm:0};

async function database(){
  const db=new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create role service_role;
    create table public.events(id uuid primary key,seed text,
      weather_locked jsonb,weather_locked_at timestamptz,
      weather_source text);
    create table public.recovery_physical_entry_inputs(
      event_id uuid,team_id uuid,committed_at timestamptz default now());
    create function public.recovery_race_snapshot(p_event uuid)
    returns jsonb language sql as $$select jsonb_build_object(
      'event',to_jsonb(e),
      'teams',(select jsonb_agg(jsonb_build_object('id',i.team_id)
        order by i.team_id) from public.recovery_physical_entry_inputs i
        where i.event_id=e.id))
      from public.events e where e.id=p_event$$;`);
  await db.query('insert into public.events(id) values($1)',[event]);
  for(const team of teams)
    await db.query(`insert into public.recovery_physical_entry_inputs
      (event_id,team_id) values($1,$2)`,[event,team]);
  await db.exec(migration);
  return db;
}

async function input(db){
  const snapshot=(await db.query(`select
    public.recovery_race_snapshot($1::uuid) as snapshot`,[event]))
    .rows[0].snapshot;
  const entries=(await db.query(`select to_jsonb(i)-'committed_at'
    as entry from public.recovery_physical_entry_inputs i
    where event_id=$1 order by team_id`,[event]))
    .rows.map(row=>row.entry);
  return {snapshot,entries};
}

async function lock(db,{snapshot,entries},seed,
  lockedWeather=weather){
  return (await db.query(`select
    public.recovery_lock_physical_viewer_source_v1(
      $1::uuid,$2::jsonb,$3::jsonb,$4::text,$5::jsonb) as snapshot`,
  [event,JSON.stringify(snapshot),JSON.stringify(entries),seed,
    JSON.stringify(lockedWeather)])).rows[0].snapshot;
}

test('physical source lock is atomic, idempotent and private',async()=>{
  const db=await database();
  try{
    const before=await input(db);
    const seed=`${event}:recovery-one-day-3`;
    await assert.rejects(lock(db,before,'invented-seed'),
      /differs from official race inputs/);
    const first=await lock(db,before,seed);
    assert.equal(first.event.seed,seed);
    assert.deepEqual(first.event.weather_locked,weather);
    assert.equal(first.event.weather_source,'LOCKED_SIM');
    assert.ok(first.event.weather_locked_at);
    const committed=await input(db);
    assert.deepEqual(await lock(db,committed,seed),first);
    await assert.rejects(lock(db,committed,seed,
      {...weather,wind_kph:40}),
    /differs from official race inputs/);
    await assert.rejects(lock(db,before,seed),
      /race changed before/);
    const grants=await db.query(`select
      has_function_privilege('anon',
        'public.recovery_lock_physical_viewer_source_v1(uuid,jsonb,jsonb,text,jsonb)',
        'EXECUTE') as anon_execute,
      has_function_privilege('authenticated',
        'public.recovery_lock_physical_viewer_source_v1(uuid,jsonb,jsonb,text,jsonb)',
        'EXECUTE') as user_execute`);
    assert.equal(grants.rows[0].anon_execute,false);
    assert.equal(grants.rows[0].user_execute,false);
  }finally{await db.close();}
});

test('changed or incomplete physical entries cannot lock race inputs',
  async()=>{
    const db=await database();
    try{
      const prior=await input(db);
      await db.query(`delete from public.recovery_physical_entry_inputs
        where team_id=$1`,[teams[1]]);
      await assert.rejects(lock(db,prior,
        `${event}:recovery-one-day-3`),/race changed before/);
      const changed=await input(db);
      await assert.rejects(lock(db,{snapshot:changed.snapshot,
        entries:prior.entries},`${event}:recovery-one-day-3`),
      /team inputs changed/);
      const row=await db.query('select seed from public.events where id=$1',
        [event]);
      assert.equal(row.rows[0].seed,null);
    }finally{await db.close();}
  });
