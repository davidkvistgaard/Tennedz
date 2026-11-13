import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../lib/auth/server';
import {createPhysicalFirstRaceDocumentV2} from
  '../../../../lib/viewer/physical-first-race-document-v2.mjs';
import {parsePhysicalSplitVariantV1} from
  '../../../../lib/viewer/physical-first-split-variant-v1.mjs';
import {previewBroadcastClockV1,previewRacePublishedV1} from
  '../../../../lib/viewer/physical-preview-clock-v1.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';

async function handler(request){
  if(process.env.PELOTONIA_PHYSICAL_VIEWER_PREVIEW_ENABLED!=='true')
    return NextResponse.json({error:'Preview unavailable.'},{status:404});
  const params=new URL(request.url).searchParams;
  const category=params.get('category');
  if(!['men','women'].includes(category))
    return NextResponse.json({error:'Invalid category.'},{status:400});
  const allowed=new Set(['category','chase','terrain','attack','seed']);
  if([...params.keys()].some(key=>
    !allowed.has(key)||params.getAll(key).length!==1))
    return NextResponse.json({error:'Invalid race settings.'},
      {status:400});
  let variant;
  try{
    variant=parsePhysicalSplitVariantV1(Object.fromEntries(
      ['chase','terrain','attack','seed']
        .filter(key=>params.has(key)).map(key=>[key,params.get(key)])));
  }catch{
    return NextResponse.json({error:'Invalid split race settings.'},
      {status:400});
  }
  const document=createPhysicalFirstRaceDocumentV2(category,variant);
  const now=Date.now();
  if(!previewRacePublishedV1(document.feed.duration,now))
    return NextResponse.json({error:'Race recording is still in progress.'},
      {status:425,headers:{'Cache-Control':'private, no-store'}});
  const {clock}=previewBroadcastClockV1(document.feed.duration,now);
  return NextResponse.json({...document,clock,revision:0},
    {headers:{'Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff'}});
}

export const GET=process.env.NODE_ENV==='development'&&
  process.env.PELOTONIA_VIEWER_V1_PREVIEW_ENABLED==='true'?
  handler:protectedRoute(handler);
