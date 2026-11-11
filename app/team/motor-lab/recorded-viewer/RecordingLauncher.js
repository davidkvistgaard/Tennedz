'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function RecordingLauncher({viewerKind='physical'}){
  const positionViewer=viewerKind==='position';
  const apiBase=positionViewer?'position-viewer':
    'physical-viewer';
  const router=useRouter();
  const [eventId,setEventId]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function save(event){
    event.preventDefault();
    const id=eventId.trim();
    if(!UUID.test(id))return setMessage('Enter a valid race ID.');
    setBusy(true);setMessage('');
    try{
      const response=await fetch(`/api/admin/${apiBase}-preview`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({event_id:id})});
      const result=await response.json();
      if(!response.ok||!result.ok)throw new Error(
        typeof result.error==='string'?result.error:
          result.error?.message??result.message??
          'The race could not be recorded.');
      router.push(positionViewer?
        `/team/motor-lab/position-viewer/${id}`:
        `/team/motor-lab/recorded-viewer/${id}`);
    }catch(error){setMessage(error.message);setBusy(false);}
  }
  return <main className="motor-viewer-preview">
    <header className="motor-viewer-intro">
      <h1>{positionViewer?'Record a position race':
        'Record a game race'}</h1>
      <span>Administrator · experimental {
        positionViewer?'V7 position motor':'physical motor'}</span>
    </header>
    <section className="motor-viewer-setup">
      <p>Enter a game race ID after its entry deadline. Recording requires
        complete physical team entries and saves one immutable Motor Lab
        calculation. It does not publish an official game result.
        {positionViewer?' The viewer route and scenery are schematic.':''}</p>
      <form onSubmit={save} aria-label="Record a game race">
        <label>Race ID<input required value={eventId}
          onChange={event=>setEventId(event.target.value)}
          autoComplete="off" spellCheck="false"/></label>
        <button disabled={busy} type="submit">{busy?
          'Recording…':'Record and open viewer'}</button>
      </form>
      {message?<p role="alert">{message}</p>:null}
    </section>
  </main>;
}
