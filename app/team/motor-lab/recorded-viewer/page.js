import {notFound,redirect} from 'next/navigation';
import {requireAdministrator} from '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import TeamShell from '../../../components/TeamShell';
import RecordingLauncher from './RecordingLauncher';
import '../viewer-preview/viewer-preview.css';

export const dynamic='force-dynamic';

export default async function RecordedViewerLauncherPage(){
  if(process.env.PELOTONIA_PHYSICAL_VIEWER_PREVIEW_ENABLED!==
      'true')notFound();
  try{await requireAdministrator({method:'GET'});}
  catch(error){
    if(error instanceof AuthError&&
      error.code==='UNAUTHENTICATED')redirect('/login');
    throw error;
  }
  return <TeamShell compact><RecordingLauncher/></TeamShell>;
}
