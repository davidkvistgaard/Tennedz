import {notFound} from 'next/navigation';
import {createPhysicalFirstViewerTestRaceV1} from
  '../../../../lib/viewer/physical-first-test-race-v1.mjs';
import {createPhysicalFirstSplitViewerTestRaceV1} from
  '../../../../lib/viewer/physical-first-split-test-race-v1.mjs';
import ViewerPreviewClient from './ViewerPreviewClient';
import TeamShell from '../../../components/TeamShell';
import '@pelotonia/race-viewer/commentary.css';
import '@pelotonia/race-viewer/profile.css';
import './viewer-preview.css';

export const dynamic='force-dynamic';

export default async function ViewerPreviewPage({searchParams}){
  if(process.env.PELOTONIA_VIEWER_V1_ENABLED==='false')
    notFound();
  const params=await searchParams;
  const category=params?.category==='women'?'women':'men';
  const raceMode=params?.race==='split'?'split':'connected';
  const race=raceMode==='split'?
    createPhysicalFirstSplitViewerTestRaceV1(category):
    createPhysicalFirstViewerTestRaceV1(category);
  return <TeamShell compact><ViewerPreviewClient {...race}
    raceMode={raceMode}
    previewPath="/team/motor-lab/viewer-preview"/></TeamShell>;
}
