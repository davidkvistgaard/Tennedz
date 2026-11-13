'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';

export default function WaitingRecordedGameViewer({eventId,
  publicationAtMs,viewerKind='physical'}){
  const positionViewer=viewerKind==='position'||
    viewerKind==='position-public';
  const publicPosition=viewerKind==='position-public';
  const apiBase=positionViewer?'position-viewer':
    'physical-viewer';
  const clockPath=publicPosition?'/api/event/position-race-clock':
    `/api/admin/${apiBase}-clock`;
  const router=useRouter();
  const [remaining,setRemaining]=useState(null);
  const [error,setError]=useState(null);
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      try{
        const response=await fetch(
          `${clockPath}?event_id=${eventId}`,
          {cache:'no-store'});
        if(!response.ok)throw new Error(
          'The race clock is unavailable.');
        const source=await response.json();
        if(source.publicationAtMs!==publicationAtMs)
          throw new Error('The race publication time changed.');
        if(!active)return;
        if(source.recordingPublished){router.refresh();return;}
        setRemaining(Math.max(0,Math.ceil((publicationAtMs-
          source.serverNowMs)/1000)));
        setError(null);
      }catch(cause){if(active)setError(cause.message);}
    };
    load();
    const timer=setInterval(load,5000);
    return ()=>{active=false;clearInterval(timer);};
  },[clockPath,eventId,publicationAtMs,router]);
  return <main className="motor-viewer-preview">
    <header className="motor-viewer-intro">
      <h1>{positionViewer?'Recorded position race':
        'Recorded game race'}</h1>
      <span>Motor Lab recording · shared publication clock</span>
    </header>
    <p role="status">The race recording is being held until its
      shared publication time. {remaining===null?'Checking the clock…':
        `${remaining} seconds remaining.`}</p>
    <p>The race feed and measured finish are not available yet.</p>
    {error?<p role="alert">{error}</p>:null}
  </main>;
}
