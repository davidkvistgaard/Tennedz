import ViewerPreviewPage from './viewer-preview/page';

export const dynamic='force-dynamic';

export default function MotorLabPage({searchParams}){
  return <ViewerPreviewPage searchParams={searchParams}/>;
}
