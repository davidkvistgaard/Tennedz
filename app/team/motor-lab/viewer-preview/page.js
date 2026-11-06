import {notFound} from 'next/navigation';
import {recordedViewerRaceV1} from
  '../../../../lib/viewer/recorded-race-v1.mjs';
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
  const race=recordedViewerRaceV1(category);
  return <TeamShell compact><ViewerPreviewClient {...race}
    previewPath="/team/motor-lab"/></TeamShell>;
}
