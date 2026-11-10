import TeamShell from '../../../components/TeamShell';
import MotorLabLiveClient from './MotorLabLiveClient';
import {motorLabCheckpointRaceId} from
  '../../../../lib/viewer/motor-lab-checkpoint-adapter-v1.mjs';
import '@pelotonia/race-viewer/commentary.css';
import '@pelotonia/race-viewer/profile.css';
import '../viewer-preview/viewer-preview.css';

export const dynamic = 'force-dynamic';

export default async function MotorLabLivePage({searchParams}) {
  const params = await searchParams;
  const initialInput = params?.plan && params?.route && params?.seed !== undefined?
    {plan: params.plan, routeId: params.route, seed: Number(params.seed)}:null;
  try { if (initialInput) motorLabCheckpointRaceId(initialInput); }
  catch { return <TeamShell compact><MotorLabLiveClient/></TeamShell>; }
  return <TeamShell compact><MotorLabLiveClient
    initialInput={initialInput}/></TeamShell>;
}
