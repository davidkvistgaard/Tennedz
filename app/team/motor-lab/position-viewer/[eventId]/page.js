import {notFound,redirect} from 'next/navigation';
import {requireAdministrator,requireTeam,databaseClient} from
  '../../../../../lib/auth/server';
import {AuthError} from '../../../../../lib/auth/policy.mjs';
import {uuid} from '../../../../../lib/race/server';
import {verifyGameSnapshotPositionViewerDocumentV1} from
  '../../../../../lib/viewer/game-snapshot-position-viewer-v1.mjs';
import {scenicPresentationV1} from
  '../../../../../lib/viewer/scenic-presentation-v1.mjs';
import {scheduledGameBroadcastV2} from
  '../../../../../lib/viewer/scheduled-game-broadcast-v2.mjs';
import RecordedGameViewerClient from
  '../../recorded-viewer/[eventId]/RecordedGameViewerClient';
import WaitingRecordedGameViewer from
  '../../recorded-viewer/[eventId]/WaitingRecordedGameViewer';
import TeamShell from '../../../../components/TeamShell';
import '@pelotonia/race-viewer/commentary.css';
import '@pelotonia/race-viewer/profile.css';
import '../../viewer-preview/viewer-preview.css';

export const dynamic='force-dynamic';

export default async function PositionGameViewerPage({params}){
  let eventId;
  try{eventId=uuid((await params).eventId);}
  catch{notFound();}
  const db=databaseClient();
  const {data:raceType,error:raceTypeError}=await db.from('events')
    .select('engine_version,scheduled_at').eq('id',eventId)
    .maybeSingle();
  if(raceTypeError)throw new Error('Could not check the race version.');
  const publicPosition=raceType?.engine_version===
    'physical-first-position-general-race-8';
  if(!publicPosition&&
    process.env.PELOTONIA_V7_POSITION_PREVIEW_ENABLED!==
      'true')notFound();
  try{
    if(publicPosition){
      await requireTeam();
    }else await requireAdministrator({method:'GET'});
  }catch(error){
    if(error instanceof AuthError&&
      error.code==='UNAUTHENTICATED')redirect('/login');
    if(error instanceof AuthError&&
      [403,404].includes(error.status))notFound();
    throw error;
  }
  const {data,error}=await db.from(
    'recovery_position_race_recordings')
    .select('document,recorded_at').eq('event_id',eventId)
    .maybeSingle();
  if(error)throw new Error(
    'Could not load the recorded position race.');
  if(!data)notFound();
  const source={recorded_at:data.recorded_at,
    scheduled_at:publicPosition?raceType.scheduled_at:null,
    race_id:data.document.raceId,
    duration:data.document.feed?.duration,
    events:data.document.feed?.events};
  const broadcast=scheduledGameBroadcastV2(source,Date.now());
  if(!broadcast.recordingPublished)
    return <TeamShell compact><WaitingRecordedGameViewer
      eventId={eventId}
      viewerKind={publicPosition?'position-public':'position'}
      publicationAtMs={broadcast.publicationAtMs}/></TeamShell>;
  const document=verifyGameSnapshotPositionViewerDocumentV1(
    data.document);
  if(document.input?.eventId!==eventId||
    document.input?.officialResults!==false)notFound();
  const feed=scenicPresentationV1({...document.feed,events:[]});
  return <TeamShell compact><RecordedGameViewerClient
    viewerKind={publicPosition?'position-public':'position'}
    eventId={eventId}
    raceId={document.raceId} sha256={document.sha256}
    feed={feed} coverage={document.coverage}
    version={document.adapterVersion}/></TeamShell>;
}
