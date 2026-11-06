import {notFound} from 'next/navigation';
import {createPhysicalFirstViewerTestRaceV1} from
  '../../../lib/viewer/physical-first-test-race-v1.mjs';
import InspectionClient from './inspection-client';
import '../../team/motor-lab/viewer-preview/viewer-preview.css';

export const dynamic='force-dynamic';

export default async function ViewerInspectionPage({searchParams}){
  if(process.env.NODE_ENV!=='development'||
    process.env.PELOTONIA_VIEWER_V1_PREVIEW_ENABLED!=='true')notFound();
  const params=await searchParams;
  const race=createPhysicalFirstViewerTestRaceV1(
    params?.category==='women'?'women':'men');
  const boundary=params?.at==='finish'?race.feed.duration:
    params?.at==='middle'?race.feed.frames[20].time:0;
  return <InspectionClient {...race} boundary={boundary}/>;
}
