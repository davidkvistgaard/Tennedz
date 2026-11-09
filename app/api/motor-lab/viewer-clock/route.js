import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../lib/auth/server';
import {createPhysicalFirstViewerTestRaceV1} from
  '../../../../lib/viewer/physical-first-test-race-v1.mjs';
import {createPhysicalFirstSplitViewerTestRaceV1} from
  '../../../../lib/viewer/physical-first-split-test-race-v1.mjs';
import {previewBroadcastClockV1} from
  '../../../../lib/viewer/preview-clock-v1.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const durations=new Map();

async function handler(request){
  if(process.env.PELOTONIA_VIEWER_V1_ENABLED==='false')
    return NextResponse.json({error:'Preview unavailable.'},{status:404});
  const category=new URL(request.url).searchParams.get('category');
  const raceMode=new URL(request.url).searchParams.get('race')===
    'split'?'split':'connected';
  if(!['men','women'].includes(category))
    return NextResponse.json({error:'Invalid category.'},{status:400});
  const key=`${raceMode}:${category}`;
  const race=raceMode==='split'?
    createPhysicalFirstSplitViewerTestRaceV1(category):
    createPhysicalFirstViewerTestRaceV1(category);
  if(!durations.has(key))durations.set(key,race.feed.duration);
  return NextResponse.json({
    raceId:race.feed.raceId,
    ...previewBroadcastClockV1(durations.get(key),Date.now())},
  {headers:{'Cache-Control':'no-store'}});
}

// Local acceptance has no Supabase account. Production always requires auth.
export const GET=process.env.NODE_ENV==='development'&&
  process.env.PELOTONIA_VIEWER_V1_PREVIEW_ENABLED==='true'?
  handler:protectedRoute(handler);
