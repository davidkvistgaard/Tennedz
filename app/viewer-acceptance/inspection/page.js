import {notFound} from 'next/navigation';
import {createPhysicalFirstViewerTestRaceV1} from
  '../../../lib/viewer/physical-first-test-race-v1.mjs';
import {createPhysicalFirstPositionViewerTestRaceV1} from
  '../../../lib/viewer/physical-first-position-test-race-v1.mjs';
import InspectionClient from './inspection-client';
import '../../team/motor-lab/viewer-preview/viewer-preview.css';

export const dynamic='force-dynamic';

export default async function ViewerInspectionPage({searchParams}){
  if(process.env.NODE_ENV!=='development'||
    process.env.PELOTONIA_VIEWER_V1_PREVIEW_ENABLED!=='true')notFound();
  const params=await searchParams;
  const positionMode=params?.race==='position';
  const category=params?.category==='women'?'women':'men';
  const race=positionMode?
    createPhysicalFirstPositionViewerTestRaceV1(category):
    createPhysicalFirstViewerTestRaceV1(category);
  const boundary=params?.at==='finish'?race.feed.duration:
    params?.at==='middle'?
      race.feed.frames[positionMode?
        Math.floor(race.coverage.recordedBoundaryFrames/2):20]
        .time:0;
  return <InspectionClient {...race} boundary={boundary}
    heading={positionMode?
      'Experimental V7 position inspection':
      'Recorded race boundary inspection'}/>;
}
