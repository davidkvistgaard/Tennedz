import {recordedViewerRaceV1} from '../../lib/viewer/recorded-race-v1.mjs';
import {scenicPresentationV1} from '../../lib/viewer/scenic-presentation-v1.mjs';
import {syntheticExhibitionV1} from
  '../../lib/viewer/synthetic-exhibition-v1.mjs';
import ViewerPreviewClient from '../team/motor-lab/viewer-preview/ViewerPreviewClient';
import '@pelotonia/race-viewer/commentary.css';
import '@pelotonia/race-viewer/profile.css';
import '../team/motor-lab/viewer-preview/viewer-preview.css';

export const dynamic='force-dynamic';

export default async function PublicViewerPage({searchParams}){
  const params=await searchParams;
  const category=params?.category==='women'?'women':'men';
  const exhibition=params?.mode==='exhibition';
  const recorded=recordedViewerRaceV1(category);
  const race=exhibition?syntheticExhibitionV1(recorded.feed):recorded;
  return <ViewerPreviewClient previewPath="/viewer"
    clockPath={exhibition?'/api/viewer-exhibition-clock':
      '/api/viewer-sample-clock'}
    mode={exhibition?'exhibition':'recorded'}
    {...race} feed={exhibition?race.feed:
      scenicPresentationV1(race.feed)}/>;
}
