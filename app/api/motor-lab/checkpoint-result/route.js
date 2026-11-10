import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../lib/auth/server';
import {createMotorLabPreviewSource} from
  '../../../../lib/engine/v2/preview.mjs';
import {motorLabCheckpointRaceId, MOTOR_LAB_CHECKPOINT_SECONDS} from
  '../../../../lib/viewer/motor-lab-checkpoint-adapter-v1.mjs';
import {checkpointBroadcastClockV1} from
  '../../../../lib/viewer/checkpoint-broadcast-clock-v1.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const runs = new Map();
function allowRun(userId, now = Date.now()) {
  for (const [id, entry] of runs) if (entry.until <= now) runs.delete(id);
  const entry = runs.get(userId) ?? {count: 0, until: now + 60_000};
  if (runs.size >= 1000 && !runs.has(userId)) return false;
  entry.count++;
  runs.set(userId, entry);
  return entry.count <= 8;
}

async function handler(request, _context, auth) {
  if (Number(request.headers.get('content-length') ?? 0) > 4096)
    return NextResponse.json({ok: false, error: 'Request too large.'},
      {status: 413});
  if (!allowRun(auth.user.id))
    return NextResponse.json({ok: false, error: 'Too many result requests.'},
      {status: 429});
  let input;
  try { input = await request.json(); }
  catch { return NextResponse.json({ok: false, error: 'Invalid request.'},
    {status: 400}); }
  try { motorLabCheckpointRaceId(input); }
  catch (error) { return NextResponse.json({ok: false,
    error: error.message}, {status: 400}); }
  const duration = 160 * MOTOR_LAB_CHECKPOINT_SECONDS;
  const clock = checkpointBroadcastClockV1(duration, Date.now());
  if (!clock.clock.paused)
    return NextResponse.json({ok: false,
      error: 'The provisional classification is withheld until the finish.'},
    {status: 425});
  try {
    const source = createMotorLabPreviewSource(input);
    const raceId = motorLabCheckpointRaceId(source);
    if (input.raceId !== raceId)
      return NextResponse.json({ok: false, error: 'Race ID mismatch.'},
        {status: 400});
    const results = source.race.provisionalResults;
    if (!Array.isArray(results) || results.length !== 32 ||
        new Set(results.map(row => row.riderId)).size !== 32 ||
        results.some(row => !Number.isInteger(row.position) ||
          !Number.isFinite(row.gapSeconds)))
      throw new Error('Incomplete Motor Lab classification.');
    return NextResponse.json({ok: true, raceId,
      kind: 'provisional-model-classification',
      results: results.map(row => ({riderId: row.riderId,
        position: row.position, gapSeconds: row.gapSeconds}))},
    {headers: {'Cache-Control': 'private, no-store'}});
  } catch (error) {
    if (error.message.startsWith('Choose '))
      return NextResponse.json({ok: false, error: error.message},
        {status: 400});
    throw error;
  }
}

export const POST = protectedRoute(handler);
