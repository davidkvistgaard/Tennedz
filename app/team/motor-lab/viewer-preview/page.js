import {notFound,redirect} from 'next/navigation';
import {requireTeam} from '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {createPhysicalFirstViewerTestRaceV1} from
  '../../../../lib/viewer/physical-first-test-race-v1.mjs';
import {createPhysicalFirstRaceDocumentV1} from
  '../../../../lib/viewer/physical-first-race-document-v1.mjs';
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
  // The team layout checks on the client, after server rendering. Reject here
  // before a seed can trigger the full 120 km simulation.
  try{await requireTeam();}
  catch(error){
    if(error instanceof AuthError&&error.code==='UNAUTHENTICATED')
      redirect('/login');
    if(error instanceof AuthError&&error.code==='TEAM_NOT_LINKED')
      redirect('/onboarding');
    throw error;
  }
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
    createPhysicalFirstRaceDocumentV1(category,variant):
    createPhysicalFirstViewerTestRaceV1(category);
  return <TeamShell compact><ViewerPreviewClient {...race}
    version={race.adapterVersion??race.version}
    feed={scenicPresentationV1(race.feed)}
    raceMode={raceMode}
    variantQuery={variant?physicalSplitVariantQueryV1(variant):''}
    previewPath="/team/motor-lab/viewer-preview"/></TeamShell>;
}
