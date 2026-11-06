import {recordedViewerRaceV1} from '../../lib/viewer/recorded-race-v1.mjs';
import ViewerPreviewClient from '../team/motor-lab/viewer-preview/ViewerPreviewClient';
import '@pelotonia/race-viewer/commentary.css';
import '@pelotonia/race-viewer/profile.css';
import '../team/motor-lab/viewer-preview/viewer-preview.css';

export const dynamic='force-dynamic';

export default async function PublicViewerPage({searchParams}){
  const params=await searchParams;
  return <ViewerPreviewClient previewPath="/viewer"
    clockPath="/api/viewer-sample-clock"
    {...recordedViewerRaceV1(
      params?.category==='women'?'women':'men')}/>;
}
