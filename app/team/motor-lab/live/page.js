import TeamShell from '../../../components/TeamShell';
import MotorLabLiveClient from './MotorLabLiveClient';
import '@pelotonia/race-viewer/commentary.css';
import '@pelotonia/race-viewer/profile.css';
import '../viewer-preview/viewer-preview.css';

export const dynamic = 'force-dynamic';

export default function MotorLabLivePage() {
  return <TeamShell compact><MotorLabLiveClient/></TeamShell>;
}
