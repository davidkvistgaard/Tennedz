import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../lib/auth/server';
import {verifyCheckpointBroadcastSessionV2,
  checkpointSessionClockV2} from
  '../../../../lib/viewer/checkpoint-broadcast-session-v2.mjs';
import {MOTOR_LAB_CHECKPOINT_SECONDS} from
  '../../../../lib/viewer/motor-lab-checkpoint-adapter-v1.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(request) {
  const now = Date.now();
  let session;
  try { session = verifyCheckpointBroadcastSessionV2(
    new URL(request.url).searchParams.get('session'), now); }
  catch { return NextResponse.json({ok: false,
    error: 'Invalid viewer session.'}, {status: 400}); }
  const duration = 160 * MOTOR_LAB_CHECKPOINT_SECONDS;
  return NextResponse.json({raceId: session.raceId,
    ...checkpointSessionClockV2(duration, session.startedAtMs, now)},
  {headers: {'Cache-Control': 'private, no-store'}});
}

export const GET = protectedRoute(handler);
