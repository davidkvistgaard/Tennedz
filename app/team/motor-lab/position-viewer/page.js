import {notFound,redirect} from 'next/navigation';
import {requireAdministrator} from '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import TeamShell from '../../../components/TeamShell';
import RecordingLauncher from '../recorded-viewer/RecordingLauncher';
import '../viewer-preview/viewer-preview.css';

export const dynamic='force-dynamic';

export default async function PositionViewerLauncherPage(){
  if(process.env.PELOTONIA_V7_POSITION_PREVIEW_ENABLED!==
      'true')notFound();
  try{await requireAdministrator({method:'GET'});}
  catch(error){
    if(error instanceof AuthError&&
      error.code==='UNAUTHENTICATED')redirect('/login');
    throw error;
  }
  return <TeamShell compact><RecordingLauncher
    viewerKind="position"/></TeamShell>;
}
