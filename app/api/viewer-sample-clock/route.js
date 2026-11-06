import {NextResponse} from 'next/server';
import {recordedViewerRaceV1} from '../../../lib/viewer/recorded-race-v1.mjs';
import {previewBroadcastClockV1} from '../../../lib/viewer/preview-clock-v1.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export function GET(request){
  if(process.env.PELOTONIA_VIEWER_V1_ENABLED==='false')
    return NextResponse.json({error:'Viewer unavailable.'},{status:404});
  const category=new URL(request.url).searchParams.get('category');
  if(!['men','women'].includes(category))
    return NextResponse.json({error:'Invalid category.'},{status:400});
  const feed=recordedViewerRaceV1(category).feed;
  return NextResponse.json({raceId:feed.raceId,
    ...previewBroadcastClockV1(feed.duration,Date.now())},
  {headers:{'Cache-Control':'no-store'}});
}
