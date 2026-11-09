import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../lib/auth/server';
import {createPhysicalFirstViewerTestRaceV1} from
  '../../../../lib/viewer/physical-first-test-race-v1.mjs';
import {createPhysicalFirstSplitViewerTestRaceV1} from
  '../../../../lib/viewer/physical-first-split-test-race-v1.mjs';
import {parsePhysicalSplitVariantV1} from
  '../../../../lib/viewer/physical-first-split-variant-v1.mjs';
import {previewBroadcastClockV1} from
  '../../../../lib/viewer/preview-clock-v1.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handler(request){
  if(process.env.PELOTONIA_VIEWER_V1_ENABLED==='false')
    return NextResponse.json({error:'Preview unavailable.'},{status:404});
  const params=new URL(request.url).searchParams;
  const category=params.get('category');
  const raceMode=params.get('race')===
    'split'?'split':'connected';
  if(!['men','women'].includes(category))
    return NextResponse.json({error:'Invalid category.'},{status:400});
  let variant=null;
  if(raceMode==='split'){
    try{variant=parsePhysicalSplitVariantV1(Object.fromEntries(
      ['chase','terrain','attack','seed']
        .filter(key=>params.has(key)).map(key=>[key,params.get(key)])));}
    catch{return NextResponse.json({error:'Invalid split race settings.'},
      {status:400});}
  }
  const race=raceMode==='split'?
    createPhysicalFirstSplitViewerTestRaceV1(category,variant):
    createPhysicalFirstViewerTestRaceV1(category);
  return NextResponse.json({
    raceId:race.feed.raceId,
    ...previewBroadcastClockV1(race.feed.duration,Date.now())},
  {headers:{'Cache-Control':'no-store'}});
}

// Local acceptance has no Supabase account. Production always requires auth.
export const GET=process.env.NODE_ENV==='development'&&
  process.env.PELOTONIA_VIEWER_V1_PREVIEW_ENABLED==='true'?
  handler:protectedRoute(handler);
