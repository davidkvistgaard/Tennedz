import {notFound} from 'next/navigation';
import {createPhysicalFirstViewerTestRaceV1} from
  '../../../../lib/viewer/physical-first-test-race-v1.mjs';
import ViewerPreviewClient from './ViewerPreviewClient';
import '@pelotonia/race-viewer/commentary.css';
import '@pelotonia/race-viewer/profile.css';
import './viewer-preview.css';

export const dynamic='force-dynamic';

export default async function ViewerPreviewPage({searchParams}){
  if(process.env.PELOTONIA_VIEWER_V1_PREVIEW_ENABLED!=='true')
    notFound();
  const params=await searchParams;
  const category=params?.category==='women'?'women':'men';
  const race=createPhysicalFirstViewerTestRaceV1(category);
  return <ViewerPreviewClient {...race}/>;
}
