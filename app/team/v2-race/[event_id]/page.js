import {notFound} from 'next/navigation';
import V2RecordedRaceClient from './V2RecordedRaceClient';
import '../../../race-lab/recorded/recorded.css';

export const metadata={title:'Private v2 race recording | Pelotonia'};
export const dynamic='force-dynamic';

export default async function V2RecordedRacePage({params}){
  if(process.env.RACE_LAB_ENABLED!=='true'||
    process.env.PELOTONIA_V2_RECORDING_ENABLED!=='true')notFound();
  const {event_id:eventId}=await params;
  return <V2RecordedRaceClient eventId={eventId}/>;
}
