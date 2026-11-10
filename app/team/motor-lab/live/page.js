import TeamShell from '../../../components/TeamShell';
import MotorLabLiveClient from './MotorLabLiveClient';
import {motorLabCheckpointRaceId} from
  '../../../../lib/viewer/motor-lab-checkpoint-adapter-v1.mjs';
import {normalizePreviewOrders} from
  '../../../../lib/engine/v2/preview.mjs';
import {verifyCheckpointBroadcastSessionV2} from
  '../../../../lib/viewer/checkpoint-broadcast-session-v2.mjs';
import '@pelotonia/race-viewer/commentary.css';
import '@pelotonia/race-viewer/profile.css';
import '../viewer-preview/viewer-preview.css';

export const dynamic = 'force-dynamic';

export default async function MotorLabLivePage({searchParams}) {
  const params = await searchParams;
  let initialInput = null;
  try {
    if (params?.session) {
      const session = verifyCheckpointBroadcastSessionV2(params.session,
        Date.now());
      initialInput = {...session.input, sessionToken: session.token};
    } else if (params?.plan && params?.route &&
        params?.seed !== undefined) {
      initialInput = {plan: params.plan, routeId: params.route,
        seed: Number(params.seed)};
      initialInput.orders = normalizePreviewOrders(params.orders?
        JSON.parse(params.orders):undefined);
      motorLabCheckpointRaceId(initialInput);
    }
  }
  catch { return <TeamShell compact><MotorLabLiveClient/></TeamShell>; }
  return <TeamShell compact><MotorLabLiveClient
    initialInput={initialInput}/></TeamShell>;
}
