import {NextResponse} from 'next/server';
import {recordedViewerRaceV1} from '../../../lib/viewer/recorded-race-v1.mjs';
import {previewBroadcastClockV2} from '../../../lib/viewer/preview-clock-v2.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export function GET(request){
  const category=new URL(request.url).searchParams.get('category');
  if(!['men','women'].includes(category))
    return NextResponse.json({error:'Invalid category.'},{status:400});
  const feed=recordedViewerRaceV1(category).feed;
  return NextResponse.json({raceId:feed.raceId,
    ...previewBroadcastClockV2(feed.duration,Date.now())},
  {headers:{'Cache-Control':'no-store'}});
}
