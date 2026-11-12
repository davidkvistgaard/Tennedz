'use client';
import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';

const Scene=dynamic(()=>import(
  '../../viewer-preview/ViewerPreviewScene'),{
  ssr:false,loading:()=>
    <p role="status">Loading the race renderer…</p>});

export default function RecordedGameViewerClient({eventId,raceId,
  sha256,feed,coverage,version,viewerKind='physical'}){
  const positionViewer=viewerKind==='position'||
    viewerKind==='position-public';
  const publicPosition=viewerKind==='position-public';
  const apiBase=positionViewer?'position-viewer':
    'physical-viewer';
  const clockPath=publicPosition?'/api/event/position-race-clock':
    `/api/admin/${apiBase}-clock`;
  const recordingPath=publicPosition?
    '/api/event/position-race-recording':
    `/api/admin/${apiBase}-preview`;
  const [sync,setSync]=useState(null);
  const [finishEvidence,setFinishEvidence]=useState(null);
  const [pointsPreview,setPointsPreview]=useState(null);
  const [pointsError,setPointsError]=useState(null);
  const [error,setError]=useState(null);
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      try{
        const sent=Date.now();
        const response=await fetch(
          `${clockPath}?event_id=${eventId}`,
          {cache:'no-store'});
        if(!response.ok)throw new Error(
          'The recorded race clock is unavailable.');
        const payload=await response.json();
        const received=Date.now();
        const elapsed=Math.min(feed.duration,Math.max(0,
          (payload.serverNowMs-payload.clock?.serverEpochMs)*
            payload.clock?.rate/1000));
        if(payload.raceId!==raceId||
          payload.clock?.duration!==feed.duration||
          !Number.isFinite(elapsed)||
          !Array.isArray(payload.events)||
          payload.events.some(event=>event.time>elapsed)||
          payload.finishPublished!==(elapsed>=feed.duration))
          throw new Error('The shared clock differs from this recording.');
        if(active){
          setSync({raceId,clock:payload.clock,
            serverNowMs:payload.serverNowMs,
            serverOffsetMs:payload.serverNowMs-
              (sent+received)/2,events:payload.events,
            finishPublished:payload.finishPublished});
          setError(null);
        }
      }catch(cause){if(active)setError(cause.message);}
    };
    load();
    const timer=setInterval(load,5000);
    return ()=>{active=false;clearInterval(timer);};
  },[clockPath,eventId,raceId,feed.duration]);
  useEffect(()=>{
    if(!sync?.finishPublished||finishEvidence)return;
    const controller=new AbortController();
    let active=true;
    (async()=>{
      const response=await fetch(
        `${recordingPath}?event_id=${eventId}`,
        {cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error(
        'The recorded finish is unavailable.');
      const document=await response.json();
      if(document.sha256!==sha256||document.raceId!==raceId||
        document.finishEvidence?.publishedAt!==feed.duration)
        throw new Error('The finish differs from this recording.');
      if(active)setFinishEvidence(document.finishEvidence);
    })().catch(cause=>{
      if(active&&cause.name!=='AbortError')setError(cause.message);
    });
    return ()=>{active=false;controller.abort();};
  },[recordingPath,eventId,raceId,sha256,feed.duration,sync?.finishPublished,
    finishEvidence]);
  useEffect(()=>{
    if(!publicPosition||!sync?.finishPublished||pointsPreview)return;
    const controller=new AbortController();
    let active=true;
    fetch(`/api/event/position-points-preview?event_id=${eventId}`,
      {cache:'no-store',signal:controller.signal})
      .then(async response=>{
        if(!response.ok)throw new Error(
          'The points preview is unavailable.');
        return response.json();
      })
      .then(result=>{
        if(active&&result.event_id===eventId&&
          result.official===false){
          setPointsPreview(result);
          setPointsError(null);
        }
      })
      .catch(cause=>{
        if(active&&cause.name!=='AbortError')
          setPointsError(cause.message);
      });
    return()=>{active=false;controller.abort();};
  },[publicPosition,sync?.finishPublished,sync?.serverNowMs,
    pointsPreview,eventId]);
  return <main className="motor-viewer-preview">
    <header className="motor-viewer-intro">
      <h1>{positionViewer?'Recorded position race':
        'Recorded game race'}</h1>
      <span>{feed.route.profile.samples.at(-1)[0]/1000} km · {
        feed.riderCategory==='women'?'Women':'Men'} · {
        coverage.riderCount} riders</span>
      <span>Saved Motor Lab race · synthetic scenery · unofficial finish</span>
    </header>
    {error?<p role="alert">{error}</p>:null}
    {!sync&&!error?<p role="status">
      Synchronizing the recorded race…</p>:null}
    {sync?<Scene feed={feed} coverage={coverage}
      mode={positionViewer?'position':'split'}
      version={version} clock={sync.clock}
      serverOffsetMs={sync.serverOffsetMs}
      publicEvents={sync.events}
      finishEvidence={finishEvidence}
      pointsPreview={pointsPreview}
      pointsError={pointsError}/>:null}
  </main>;
}
