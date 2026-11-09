import {NextResponse} from 'next/server';
import {recordedViewerRaceV1} from '../../../lib/viewer/recorded-race-v1.mjs';
import {recordedSplitRaceV1} from
  '../../../lib/viewer/recorded-split-race-v1.mjs';
import {previewBroadcastClockV2,previewVisibleEventsV2} from
  '../../../lib/viewer/preview-clock-v2.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export function GET(request){
  const category=new URL(request.url).searchParams.get('category');
  const split=new URL(request.url).searchParams.get('race')==='split';
  if(!['men','women'].includes(category))
    return NextResponse.json({error:'Invalid category.'},{status:400});
  const feed=(split?recordedSplitRaceV1(category):
    recordedViewerRaceV1(category)).feed;
  const broadcast=previewBroadcastClockV2(feed.duration,Date.now());
  return NextResponse.json({raceId:feed.raceId,...broadcast,
    events:previewVisibleEventsV2(feed,broadcast)},
  {headers:{'Cache-Control':'no-store'}});
}
