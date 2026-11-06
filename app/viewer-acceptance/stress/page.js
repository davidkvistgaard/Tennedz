import {notFound} from 'next/navigation';
import {createPhysicalFirstViewerTestRaceV1} from
  '../../../lib/viewer/physical-first-test-race-v1.mjs';
import {rendererStressFeedV1} from
  '../../../lib/viewer/renderer-stress-feed-v1.mjs';
import StressClient from './stress-client';
import '../../team/motor-lab/viewer-preview/viewer-preview.css';

export const dynamic='force-dynamic';

export default async function ViewerStressPage({searchParams}){
  if(process.env.NODE_ENV!=='development'||
    process.env.PELOTONIA_VIEWER_V1_PREVIEW_ENABLED!=='true')notFound();
  const params=await searchParams;
  const count=Number(params?.count)===150?150:30;
  const category=params?.category==='women'?'women':'men';
  const source=createPhysicalFirstViewerTestRaceV1(category).feed;
  return <StressClient feed={rendererStressFeedV1(source,count,{
    missingAsset:params?.asset==='missing'})}/>;
}
