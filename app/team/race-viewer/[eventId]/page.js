import {notFound,redirect} from 'next/navigation';
import {requireTeam} from '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {uuid} from '../../../../lib/race/server';
import {recordedGameBroadcastV1} from
  '../../../../lib/viewer/recorded-game-broadcast-v1.mjs';
import {physicalSpectatorFeedV1} from
  '../../../../lib/viewer/physical-spectator-projection-v1.mjs';
import RecordedGameViewerClient from
  '../../motor-lab/recorded-viewer/[eventId]/RecordedGameViewerClient';
import WaitingRecordedGameViewer from
  '../../motor-lab/recorded-viewer/[eventId]/WaitingRecordedGameViewer';
import TeamShell from '../../../components/TeamShell';
import '@pelotonia/race-viewer/commentary.css';
import '@pelotonia/race-viewer/profile.css';
import '../../motor-lab/viewer-preview/viewer-preview.css';

export const dynamic='force-dynamic';
const clockPath='/api/event/physical-viewer-clock';

export default async function RaceViewerPage({params}){
  if(process.env.PELOTONIA_PHYSICAL_VIEWER_SPECTATOR_ENABLED!==
      'true')notFound();
  let db;
  try{({db}=await requireTeam());}
  catch(error){
    if(error instanceof AuthError&&
      error.code==='UNAUTHENTICATED')redirect('/login');
    if(error instanceof AuthError&&
      error.code==='TEAM_NOT_LINKED')redirect('/onboarding');
    throw error;
  }
  let eventId;
  try{eventId=uuid((await params).eventId);}
  catch{notFound();}
  const {data,error}=await db.from(
    'recovery_physical_viewer_recordings')
    .select('document,recorded_at').eq('event_id',eventId)
    .maybeSingle();
  if(error)throw new Error('Could not load the recorded physical race.');
  if(!data)notFound();
  const document=data.document;
  const broadcast=recordedGameBroadcastV1({
    recorded_at:data.recorded_at,
    race_id:document.raceId,
    duration:document.feed?.duration,
    events:document.feed?.events},Date.now());
  if(!broadcast.recordingPublished)
    return <TeamShell compact><WaitingRecordedGameViewer
      eventId={eventId} clockPath={clockPath}
      publicationAtMs={broadcast.publicationAtMs}/></TeamShell>;
  const projection=physicalSpectatorFeedV1(document,eventId,
    broadcast.elapsed);
  return <TeamShell compact><RecordedGameViewerClient
    eventId={eventId} raceId={projection.raceId}
    sha256={projection.sha256} feed={projection.feed}
    coverage={projection.coverage}
    version={projection.adapterVersion}
    initialAvailableThrough={projection.availableThrough}
    initialCycleEpochMs={broadcast.clock.serverEpochMs}
    framesPath="/api/event/physical-viewer-frames"
    clockPath={clockPath}
    finishPath="/api/event/physical-viewer-finish"/>
  </TeamShell>;
}
