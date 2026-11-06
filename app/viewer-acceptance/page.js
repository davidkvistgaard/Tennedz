import {notFound} from 'next/navigation';
import {createPhysicalFirstViewerTestRaceV1} from
  '../../lib/viewer/physical-first-test-race-v1.mjs';
import ViewerPreviewClient from '../team/motor-lab/viewer-preview/ViewerPreviewClient';
import '@pelotonia/race-viewer/commentary.css';
import '@pelotonia/race-viewer/profile.css';
import '../team/motor-lab/viewer-preview/viewer-preview.css';

export const dynamic='force-dynamic';

export default async function ViewerAcceptancePage({searchParams}){
  if(process.env.NODE_ENV!=='development'||
    process.env.PELOTONIA_VIEWER_V1_PREVIEW_ENABLED!=='true')
    notFound();
  const params=await searchParams;
  return <ViewerPreviewClient previewPath="/viewer-acceptance"
    {...createPhysicalFirstViewerTestRaceV1(
      params?.category==='women'?'women':'men')}/>;
}
