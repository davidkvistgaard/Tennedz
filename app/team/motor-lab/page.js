import MotorLabEnginePage from './engine/page';
import ViewerPreviewPage from './viewer-preview/page';

export const dynamic='force-dynamic';

export default function MotorLabPage({searchParams}){
  if(process.env.PELOTONIA_VIEWER_V1_ENABLED==='false')
    return <MotorLabEnginePage/>;
  return <ViewerPreviewPage searchParams={searchParams}/>;
}
