import {NextResponse} from 'next/server';
import {syntheticExhibitionV1} from '../../../lib/viewer/synthetic-exhibition-v1.mjs';
import {recordedViewerRaceV1} from '../../../lib/viewer/recorded-race-v1.mjs';
import {previewBroadcastClockV1} from '../../../lib/viewer/preview-clock-v1.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(request){
  const params=new URL(request.url).searchParams;
  const category=params.get('category');
  if(!['men','women'].includes(category))
    return NextResponse.json({error:'Invalid category.'},{status:400});
  const fieldSize=['30','150'].includes(params.get('field'))?
    Number(params.get('field')):32;
  const feed=syntheticExhibitionV1(recordedViewerRaceV1(category).feed,
    {fieldSize,missingAsset:params.get('asset')==='missing'}).feed;
  return NextResponse.json({raceId:feed.raceId,
    ...previewBroadcastClockV1(feed.duration,Date.now())},
  {headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
}
