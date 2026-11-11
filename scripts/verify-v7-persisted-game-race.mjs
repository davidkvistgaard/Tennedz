// Disposable, file-backed game-race integration control. Never points at
// Supabase or production. The game-generated starter data is synthetic.
import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import seedrandom from 'seedrandom';
import {PGlite} from '@electric-sql/pglite';
import {starterPack} from '../lib/onboarding/starter.mjs';
import {physicalGameViewerInputsV1} from
  '../tests/support/physical-game-viewer-fixture.mjs';
import {loadGameSnapshotPositionRaceRecordingV1,
  verifyGameSnapshotPositionViewerDocumentV1} from
  '../lib/viewer/game-snapshot-position-viewer-v1.mjs';
import {encodeGameSnapshotPositionRaceArchiveV2,
  decodeGameSnapshotPositionRaceArchiveV2} from
  '../lib/viewer/game-snapshot-position-archive-v2.mjs';

const action=process.argv[2];
const category=process.argv[3]??'men';
const directory=resolve(process.argv[4]??
  `.recovery-local/v7-persisted-${category}`);
const publishedFixture=process.argv[5]==='published_fixture';
if(!['create','verify'].includes(action)||
  !['men','women'].includes(category)||
  (process.argv[5]&&!publishedFixture))
  throw new Error('Use create|verify and men|women.');
const migration=name=>readFileSync(new URL(
  `../supabase/migrations/${name}`,import.meta.url),'utf8');
const raceId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const stageId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const userIds=['11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'];
const schema=`create role anon; create role authenticated;
  create role service_role;
  create table public.events(id uuid primary key,kind text,
    status text,deadline timestamptz,stage_profile_id uuid,
    gender text,seed text,weather_locked jsonb,entry_fee integer,
    country_code text);
  create table public.stage_profiles(id uuid primary key,
    distance_km integer,profile_points jsonb,keypoints jsonb);
  create table public.teams(id uuid primary key,user_id uuid,
    name text,coins integer,rating integer default 0);
  create table public.riders(id uuid primary key,name text,
    display_name text,gender text,injury_until date,
    sprint numeric,flat numeric,hills numeric,mountain numeric,
    cobbles numeric,timetrial numeric,endurance numeric,
    strength numeric,wind numeric,leadership numeric,
    form numeric,fatigue numeric);
  create table public.team_riders(team_id uuid,rider_id uuid);
  create table public.event_teams(event_id uuid,team_id uuid,
    selected_riders uuid[],captain_id uuid,
    unique(event_id,team_id));
  create table public.game_state(id integer primary key,game_date date);
  create table public.event_division_runs(event_id uuid);
  create table public.event_team_results(event_id uuid);
  create table public.event_rider_results(event_id uuid);
  create table public.event_runs(event_id uuid);
  create table public.event_stages(event_id uuid);`;
const snapshotQuery=`select public.recovery_race_snapshot(
  $1::uuid) as snapshot`;
const entriesQuery=`select to_jsonb(i)-'committed_at' as entry
  from public.recovery_physical_entry_inputs i
  where event_id=$1 order by team_id`;
async function readSnapshot(db){
  return (await db.query(snapshotQuery,[raceId]))
    .rows[0].snapshot;
}
async function readEntries(db){
  return (await db.query(entriesQuery,[raceId]))
    .rows.map(row=>row.entry);
}
if(action==='create'&&existsSync(directory))
  throw new Error('The disposable saved race already exists. Verify it instead.');
if(action==='verify'&&!existsSync(directory))
  throw new Error('The disposable saved race does not exist.');
if(action==='create')mkdirSync(resolve(directory,'..'),
  {recursive:true});
const db=new PGlite(directory);
try{
  if(action==='create'){
    await db.exec(schema);
    await db.exec(migration(
      '20260923173040_atomic_one_day_cycle.sql'));
    await db.exec(migration(
      '20261109131922_committed_physical_entry_inputs.sql'));
    await db.exec(migration(
      '20261111033000_experimental_position_race_recording_v1.sql'));
    if(publishedFixture)
      await db.exec(`alter table public.recovery_position_race_recordings
        alter column recorded_at set default
        (clock_timestamp()-interval '1 day')`);
    const {snapshot,rows}=physicalGameViewerInputsV1(
      {teamCount:2,category});
    const gender=category==='men'?'M':'F';
    await db.query(`insert into public.stage_profiles values(
      $1,20,$2::jsonb,$3::jsonb)`,
    [stageId,JSON.stringify(snapshot.stage.profile_points),
      JSON.stringify(snapshot.stage.keypoints)]);
    await db.query(`insert into public.events values(
      $1,'one_day','OPEN',clock_timestamp()+interval '1 hour',
      $2,$3,$4,$5::jsonb,0,'FR')`,
    [raceId,stageId,gender,snapshot.event.seed,
      JSON.stringify(snapshot.event.weather_locked)]);
    await db.query(`insert into public.game_state values(1,$1)`,
      [snapshot.game_date]);
    for(const [index,team] of snapshot.teams.entries()){
      await db.query(`insert into public.teams(
        id,user_id,name,coins) values($1,$2,$3,1000)`,
      [team.id,userIds[index],team.name]);
      const starter=starterPack(seedrandom(
        `persisted-game-${category}-${index}`))
        .filter(row=>row.gender===gender);
      for(const [riderIndex,rider] of team.riders.entries()){
        const profile=starter[riderIndex];
        await db.query(`insert into public.riders(
          id,name,display_name,gender,sprint,flat,hills,
          mountain,cobbles,timetrial,endurance,strength,
          wind,leadership,form,fatigue)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
            $12,$13,$14,$15,$16)`,
        [rider.id,profile.name,profile.display_name,gender,
          ...['sprint','flat','hills','mountain','cobbles',
            'timetrial','endurance','strength','wind',
            'leadership','form','fatigue']
            .map(key=>profile[key])]);
        await db.query(`insert into public.team_riders
          values($1,$2)`,[team.id,rider.id]);
      }
      const row=rows[index];
      const joined=await db.query(`select
        public.recovery_join_event_physical_v1(
          $1::uuid,$2::uuid,$3::uuid[],$4::uuid,
          $5::jsonb,$6::jsonb,$7::jsonb) as receipt`,
      [userIds[index],raceId,row.selected_riders,
        row.captain_id,JSON.stringify(row.orders),
        JSON.stringify(row.stake),
        JSON.stringify(row.team_style)]);
      if(joined.rows[0].receipt.physical_input_version!==
          'physical-entry-input-v1')
        throw new Error('The game did not commit physical inputs.');
    }
    await db.query(`update public.events set deadline=
      clock_timestamp()-interval '1 minute' where id=$1`,
    [raceId]);
    const recording=await loadGameSnapshotPositionRaceRecordingV1({
      readSnapshot:()=>readSnapshot(db),
      readEntries:()=>readEntries(db)});
    const archive=encodeGameSnapshotPositionRaceArchiveV2(
      recording.bundle);
    const receipt=(await db.query(`select
      public.recovery_save_position_race_recording_v1(
        $1::uuid,$2::jsonb,$3::jsonb,$4::jsonb,
        $5::jsonb,$6::text) as receipt`,
    [raceId,JSON.stringify(recording.snapshot),
      JSON.stringify(recording.entries),
      JSON.stringify(recording.bundle.document),
      JSON.stringify(archive.metadata),
      archive.body.toString('base64')])).rows[0].receipt;
    if(receipt.already_recorded||
      receipt.sha256!==recording.bundle.document.sha256)
      throw new Error('The game race was not saved once.');
  }
  const stored=(await db.query(`select document,
    archive_metadata,archive_gzip,recorded_at
    from public.recovery_position_race_recordings
    where event_id=$1`,[raceId])).rows[0];
  if(!stored)throw new Error('No persisted race recording.');
  const document=verifyGameSnapshotPositionViewerDocumentV1(
    stored.document);
  const bundle=decodeGameSnapshotPositionRaceArchiveV2({
    metadata:stored.archive_metadata,
    body:Buffer.from(stored.archive_gzip)});
  if(bundle.document.sha256!==document.sha256||
    bundle.race.decisionCount!==320||
    bundle.race.finishCrossings.length!==16||
    document.feed.riders.length!==16)
    throw new Error('The saved race lost motor or viewer coverage.');
  const count=(await db.query(`select
    (select count(*)::int from public.event_teams) as teams,
    (select count(*)::int from
      public.recovery_physical_entry_inputs) as inputs,
    (select count(*)::int from
      public.recovery_position_race_recordings) as recordings`))
    .rows[0];
  if(count.teams!==2||count.inputs!==2||
    count.recordings!==1)
    throw new Error('The saved game inputs are incomplete.');
  const privacy=(await db.query(`select
    has_table_privilege('anon',
      'public.recovery_position_race_recordings',
      'SELECT') as anon_read,
    has_table_privilege('service_role',
      'public.recovery_position_race_recordings',
      'SELECT') as service_read`)).rows[0];
  if(privacy.anon_read||!privacy.service_read)
    throw new Error('The saved race changed its access policy.');
  const clock=(await db.query(`select
    public.recovery_position_viewer_broadcast_source_v1(
      $1::uuid) as source`,[raceId])).rows[0].source;
  if(clock.race_id!==document.raceId||
    !Array.isArray(clock.events)||
    Object.hasOwn(clock,'frames'))
    throw new Error('The saved broadcast source changed.');
  console.log(JSON.stringify({action,category,
    source:'persisted_synthetic_game_starter_control',
    publishedFixture,
    directory,eventId:raceId,recordedAt:stored.recorded_at,
    teamCount:count.teams,riderCount:16,
    decisions:bundle.race.decisionCount,
    finishes:bundle.race.finishCrossings.length,
    archiveBytes:Buffer.from(stored.archive_gzip).length,
    viewerSha256:document.sha256,
    replayVerified:true,officialResults:false}));
}finally{await db.close();}
