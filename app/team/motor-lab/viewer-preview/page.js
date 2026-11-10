import {recordedViewerRaceV1} from
  '../../../../lib/viewer/recorded-race-v1.mjs';
import {recordedSplitRaceV1} from
  '../../../../lib/viewer/recorded-split-race-v1.mjs';
import {scenicPresentationV1} from
  '../../../../lib/viewer/scenic-presentation-v1.mjs';
import ViewerPreviewClient from './ViewerPreviewClient';
import TeamShell from '../../../components/TeamShell';
import '@pelotonia/race-viewer/commentary.css';
import '@pelotonia/race-viewer/profile.css';
import './viewer-preview.css';

export const dynamic='force-dynamic';

export default async function ViewerPreviewPage({searchParams}){
  const params=await searchParams;
  const category=params?.category==='women'?'women':'men';
  const split=params?.race==='split';
  const race=split?recordedSplitRaceV1(category):
    recordedViewerRaceV1(category);
  return <TeamShell compact><ViewerPreviewClient {...race}
    feed={scenicPresentationV1(race.feed)}
    mode={split?'split':'recorded'}
    previewPath="/team/motor-lab"/></TeamShell>;
}
