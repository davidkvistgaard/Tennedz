import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../lib/auth/server';
import {recordedViewerRaceV1} from
  '../../../../lib/viewer/recorded-race-v1.mjs';
import {recordedSplitRaceV1} from
  '../../../../lib/viewer/recorded-split-race-v1.mjs';
import {previewBroadcastClockV2} from
  '../../../../lib/viewer/preview-clock-v2.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handler(request){
  const category=new URL(request.url).searchParams.get('category');
  const split=new URL(request.url).searchParams.get('race')==='split';
  if(!['men','women'].includes(category))
    return NextResponse.json({error:'Invalid category.'},{status:400});
  const feed=(split?recordedSplitRaceV1(category):
    recordedViewerRaceV1(category)).feed;
  return NextResponse.json({
    raceId:feed.raceId,
    ...previewBroadcastClockV2(feed.duration,Date.now())},
  {headers:{'Cache-Control':'no-store'}});
}

// Local acceptance has no Supabase account. Production always requires auth.
export const GET=process.env.NODE_ENV==='development'&&
  process.env.PELOTONIA_VIEWER_V1_PREVIEW_ENABLED==='true'?
  handler:protectedRoute(handler);
