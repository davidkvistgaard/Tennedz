import {notFound,redirect} from 'next/navigation';
import {requireAdministrator,databaseClient} from
  '../../../../../lib/auth/server';
import {AuthError} from '../../../../../lib/auth/policy.mjs';
import {uuid} from '../../../../../lib/race/server';
import {verifyGameSnapshotPositionViewerDocumentV1} from
  '../../../../../lib/viewer/game-snapshot-position-viewer-v1.mjs';
import {scenicPresentationV1} from
  '../../../../../lib/viewer/scenic-presentation-v1.mjs';
import {recordedGameBroadcastV1} from
  '../../../../../lib/viewer/recorded-game-broadcast-v1.mjs';
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
  if(process.env.PELOTONIA_V7_POSITION_PREVIEW_ENABLED!==
      'true')notFound();
  try{await requireAdministrator({method:'GET'});}
  catch(error){
    if(error instanceof AuthError&&
      error.code==='UNAUTHENTICATED')redirect('/login');
    throw error;
  }
  let eventId;
  try{eventId=uuid((await params).eventId);}
  catch{notFound();}
  const {data,error}=await databaseClient().from(
    'recovery_position_race_recordings')
    .select('document,recorded_at').eq('event_id',eventId)
    .maybeSingle();
  if(error)throw new Error(
    'Could not load the recorded position race.');
  if(!data)notFound();
  const source={recorded_at:data.recorded_at,
    race_id:data.document.raceId,
    duration:data.document.feed?.duration,
    events:data.document.feed?.events};
  const broadcast=recordedGameBroadcastV1(source,Date.now());
  if(!broadcast.recordingPublished)
    return <TeamShell compact><WaitingRecordedGameViewer
      eventId={eventId}
      viewerKind="position"
      publicationAtMs={broadcast.publicationAtMs}/></TeamShell>;
  const document=verifyGameSnapshotPositionViewerDocumentV1(
    data.document);
  if(document.input?.eventId!==eventId||
    document.input?.officialResults!==false)notFound();
  const feed=scenicPresentationV1({...document.feed,events:[]});
  return <TeamShell compact><RecordedGameViewerClient
    viewerKind="position" eventId={eventId}
    raceId={document.raceId} sha256={document.sha256}
    feed={feed} coverage={document.coverage}
    version={document.adapterVersion}/></TeamShell>;
}
