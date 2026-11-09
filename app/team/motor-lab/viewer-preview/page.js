import {notFound,redirect} from 'next/navigation';
import {requireTeam} from '../../../../lib/auth/server';
import {AuthError,assertAdmin} from '../../../../lib/auth/policy.mjs';
import {createPhysicalFirstViewerTestRaceV1} from
  '../../../../lib/viewer/physical-first-test-race-v1.mjs';
import {createPhysicalFirstRaceDocumentV2} from
  '../../../../lib/viewer/physical-first-race-document-v2.mjs';
import {parsePhysicalSplitVariantV1,physicalSplitVariantQueryV1} from
  '../../../../lib/viewer/physical-first-split-variant-v1.mjs';
import {scenicPresentationV1} from
  '../../../../lib/viewer/scenic-presentation-v1.mjs';
import {previewRacePublishedV1} from
  '../../../../lib/viewer/preview-clock-v1.mjs';
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
  let user;
  try{({user}=await requireTeam());}
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
    createPhysicalFirstRaceDocumentV2(category,variant):
    createPhysicalFirstViewerTestRaceV1(category);
  const finishEvidence=raceMode==='split'&&
    previewRacePublishedV1(race.feed.duration,Date.now())?
    race.finishEvidence:null;
  let physicalRecordingAvailable=false;
  if(process.env.PELOTONIA_PHYSICAL_VIEWER_PREVIEW_ENABLED===
      'true'){
    try{assertAdmin(user.id,process.env.ADMIN_USER_IDS);
      physicalRecordingAvailable=true;}
    catch(error){if(!(error instanceof AuthError))throw error;}
  }
  return <TeamShell compact><ViewerPreviewClient {...race}
    finishEvidence={finishEvidence}
    version={race.adapterVersion??race.version}
    feed={scenicPresentationV1({...race.feed,events:[]})}
    raceMode={raceMode}
    physicalRecordingAvailable={physicalRecordingAvailable}
    variantQuery={variant?physicalSplitVariantQueryV1(variant):''}
    previewPath="/team/motor-lab/viewer-preview"/></TeamShell>;
}
