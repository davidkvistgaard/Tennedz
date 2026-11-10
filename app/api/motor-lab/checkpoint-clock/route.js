import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../lib/auth/server';
import {checkpointBroadcastClockV1} from
  '../../../../lib/viewer/checkpoint-broadcast-clock-v1.mjs';
import {MOTOR_LAB_CHECKPOINT_SECONDS} from
  '../../../../lib/viewer/motor-lab-checkpoint-adapter-v1.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(request) {
  const raceId = new URL(request.url).searchParams.get('raceId');
  if (!/^motor-lab-checkpoints-v1:(coast|ridge):(sprint|break|balanced|conserve):(?:0|[1-9][0-9]{0,3}):[a-f0-9]{12}$/.test(raceId ?? ''))
    return NextResponse.json({ok: false, error: 'Invalid race ID.'},
      {status: 400});
  const duration = 160 * MOTOR_LAB_CHECKPOINT_SECONDS;
  return NextResponse.json({raceId,
    ...checkpointBroadcastClockV1(duration, Date.now())},
  {headers: {'Cache-Control': 'private, no-store'}});
}

export const GET = protectedRoute(handler);
