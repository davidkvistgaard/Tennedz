import {notFound} from 'next/navigation';
import V2TacticsClient from './V2TacticsClient';
import '../v2-tactics.css';

export const metadata={title:'Private v2 tactics | Pelotonia'};
export const dynamic='force-dynamic';

export default async function V2TacticsPage({params}){
  if(process.env.RACE_LAB_ENABLED!=='true'||
    process.env.PELOTONIA_V2_TACTICS_SAVE_ENABLED!=='true')notFound();
  const {event_id:eventId}=await params;
  return <V2TacticsClient eventId={eventId}/>;
}
