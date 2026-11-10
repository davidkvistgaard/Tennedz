import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../lib/auth/server';
import {createMotorLabPreviewSource} from
  '../../../../lib/engine/v2/preview.mjs';
import {adaptMotorLabCheckpointsV1} from
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
    return NextResponse.json({ok: false,
      error: 'Too many Motor Lab runs. Try again in a minute.'},
    {status: 429});
  let input;
  try { input = await request.json(); }
  catch { return NextResponse.json({ok: false,
    error: 'Invalid request.'}, {status: 400}); }
  try {
    const source = createMotorLabPreviewSource(input);
    const adapted = adaptMotorLabCheckpointsV1(source);
    const now = Date.now();
    return NextResponse.json({ok: true, ...adapted,
      ...checkpointBroadcastClockV1(adapted.feed.duration, now)},
    {headers: {'Cache-Control': 'private, no-store'}});
  } catch (error) {
    if (error.message.startsWith('Choose '))
      return NextResponse.json({ok: false, error: error.message},
        {status: 400});
    throw error;
  }
}

export const POST = protectedRoute(handler);
