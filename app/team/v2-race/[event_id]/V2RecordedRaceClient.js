'use client';

import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import TeamShell from '../../../components/TeamShell';
import TacticalTourViewer from '../../../components/TacticalTourViewer';

export default function V2RecordedRaceClient({eventId}){
  const [data,setData]=useState(null);
  const [waiting,setWaiting]=useState(true);
  const [missing,setMissing]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const load=useCallback(async()=>{
    setWaiting(true);setError('');
    try{
      const response=await fetch(`/api/event/v2-recording/prepare?event_id=${
        encodeURIComponent(eventId)}`,{cache:'no-store'});
      if(response.status===404){setMissing(true);setData(null);return;}
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Could not load the private recording.');
      setData(result);setMissing(false);
    }catch(cause){setError(cause.message);setData(null);}
    finally{setWaiting(false);}
  },[eventId]);
  useEffect(()=>{load();},[load]);
  async function prepare(){
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/event/v2-recording/prepare',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({event_id:eventId}),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Could not prepare the recording.');
      await load();
    }catch(cause){setError(cause.message);}
    finally{setBusy(false);}
  }
  return <TeamShell title="Private race recording" compact>
    <div className="recorded-lab-shell">
      <div className="tactical-back"><Link href="/team/calendar">Back to calendar</Link>
        <span>Isolated v2 candidate · no final results or ranking points</span></div>
      {waiting?<section className="card empty-state" role="status">
        <h1>Loading the recorded race</h1><p>Checking your division.</p>
      </section>:data?<TacticalTourViewer key={`${data.eventId}:${data.focusTeamId}`}
        recording={data.recording}
        focusTeamId={data.focusTeamId} divisionIndex={data.divisionIndex}
        awardProjection={{awards:data.projectedAwards}} playerRecording/>:
        <section className="card empty-state" role="status">
          <h1>{missing?'Recording not prepared':'Recording unavailable'}</h1>
          <p>{error||'A private candidate can be prepared after the scheduled race start.'}</p>
          {missing&&<button type="button" className="btn primary" onClick={prepare}
            disabled={busy}>{busy?'Preparing…':'Prepare private recording'}</button>}
          <button type="button" className="btn" onClick={load}>Try again</button>
        </section>}
    </div>
  </TeamShell>;
}
