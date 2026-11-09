import {notFound} from 'next/navigation';
import {createPhysicalFirstViewerTestRaceV1} from
  '../../../../lib/viewer/physical-first-test-race-v1.mjs';
import {createPhysicalFirstSplitViewerTestRaceV1} from
  '../../../../lib/viewer/physical-first-split-test-race-v1.mjs';
import {parsePhysicalSplitVariantV1,physicalSplitVariantQueryV1} from
  '../../../../lib/viewer/physical-first-split-variant-v1.mjs';
import {scenicPresentationV1} from
  '../../../../lib/viewer/scenic-presentation-v1.mjs';
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
  let variant=null;
  if(raceMode==='split'){
    try{variant=parsePhysicalSplitVariantV1(Object.fromEntries(
      Object.entries(params??{}).filter(([key])=>
        ['chase','terrain','attack','seed'].includes(key))));}
    catch{notFound();}
  }
  const race=raceMode==='split'?
    createPhysicalFirstSplitViewerTestRaceV1(category,variant):
    createPhysicalFirstViewerTestRaceV1(category);
  return <TeamShell compact><ViewerPreviewClient {...race}
    feed={scenicPresentationV1(race.feed)}
    raceMode={raceMode}
    variantQuery={variant?physicalSplitVariantQueryV1(variant):''}
    previewPath="/team/motor-lab/viewer-preview"/></TeamShell>;
}
