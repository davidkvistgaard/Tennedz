'use client';
import dynamic from 'next/dynamic';
import {useEffect,useRef,useState} from 'react';

const Scene=dynamic(()=>import(
  '../../viewer-preview/ViewerPreviewScene'),{
  ssr:false,loading:()=>
    <p role="status">Loading the race renderer…</p>});

function appendReachedFrames(feed,frames){
  if(!frames.length)return feed;
  const prior=feed.frames;
  const hasSentinel=prior.at(-1).time===feed.duration&&
    prior.at(-1).positions.length===0;
  const real=hasSentinel?prior.slice(0,-1):prior;
  const next=[...real,...frames];
  if(next.at(-1).time<feed.duration)
    next.push({time:feed.duration,positions:[]});
  return {...feed,frames:next};
}

function startingFeed(feed){
  return {...feed,frames:[feed.frames[0],
    {time:feed.duration,positions:[]}]};
}

export default function RecordedGameViewerClient({eventId,raceId,
  sha256,feed,coverage,version,
  framesPath=null,initialAvailableThrough=0,
  initialCycleEpochMs=null,
  clockPath='/api/admin/physical-viewer-clock',
  finishPath='/api/admin/physical-viewer-preview'}){
  const [sync,setSync]=useState(null);
  const [visibleFeed,setVisibleFeed]=useState(feed);
  const [rendererFeed,setRendererFeed]=useState(feed);
  const [cycleEpochMs,setCycleEpochMs]=useState(
    initialCycleEpochMs);
  const frameCursor=useRef({cycle:initialCycleEpochMs,
    time:initialAvailableThrough});
  const loading=useRef(false);
  const [finishEvidence,setFinishEvidence]=useState(null);
  const [error,setError]=useState(null);
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      if(loading.current)return;
      loading.current=true;
      try{
        const sent=Date.now();
        const cursor=frameCursor.current;
        const endpoint=framesPath?
          `${framesPath}?event_id=${eventId}&after=${cursor.time}`+
            `&cycle_epoch=${cursor.cycle}`:
          `${clockPath}?event_id=${eventId}`;
        const response=await fetch(endpoint,{cache:'no-store'});
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
        if(framesPath){
          if(payload.sha256!==sha256||
            !Array.isArray(payload.frames)||
            !Number.isFinite(payload.elapsed)||
            payload.frames.some((frame,index)=>
              !frame||!Array.isArray(frame.positions)||
              frame.time>payload.elapsed||
              frame.time<=(index?
                payload.frames[index-1].time:
                payload.reset?0:cursor.time)))
            throw new Error('The reached frames differ from this recording.');
          if(active){
            const changed=payload.reset||
              payload.cycleEpochMs!==cursor.cycle;
            if(changed){
              const start=startingFeed(feed);
              setRendererFeed(start);
              setVisibleFeed(appendReachedFrames(start,
                payload.frames));
              setCycleEpochMs(payload.cycleEpochMs);
            }else if(payload.frames.length)
              setVisibleFeed(current=>appendReachedFrames(
                current,payload.frames));
            frameCursor.current={cycle:payload.cycleEpochMs,
              time:payload.availableThrough};
          }
        }
        if(active){
          setSync({raceId,clock:payload.clock,
            serverNowMs:payload.serverNowMs,
            serverOffsetMs:payload.serverNowMs-
              (sent+received)/2,events:payload.events,
            finishPublished:payload.finishPublished});
          setError(null);
        }
      }catch(cause){if(active)setError(cause.message);}
      finally{loading.current=false;}
    };
    load();
    const timer=setInterval(load,framesPath?1000:5000);
    return ()=>{active=false;clearInterval(timer);};
  },[eventId,raceId,sha256,feed,clockPath,framesPath]);
  useEffect(()=>{
    if(!sync?.finishPublished||finishEvidence)return;
    const controller=new AbortController();
    let active=true;
    (async()=>{
      const response=await fetch(
        `${finishPath}?event_id=${eventId}`,
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
  },[eventId,raceId,sha256,feed.duration,sync?.finishPublished,
    finishEvidence,finishPath]);
  return <main className="motor-viewer-preview">
    <header className="motor-viewer-intro">
      <h1>Recorded game race</h1>
      <span>{feed.route.profile.samples.at(-1)[0]/1000} km · {
        feed.riderCategory==='women'?'Women':'Men'} · {
        coverage.riderCount} riders</span>
      <span>Saved Motor Lab race · synthetic scenery · unofficial finish</span>
    </header>
    {error?<p role="alert">{error}</p>:null}
    {!sync&&!error?<p role="status">
      Synchronizing the recorded race…</p>:null}
    {sync?<Scene key={cycleEpochMs??'admin'}
      feed={visibleFeed}
      rendererFeed={framesPath?rendererFeed:null}
      cycleEpochMs={cycleEpochMs}
      coverage={coverage}
      mode="split" version={version} clock={sync.clock}
      serverOffsetMs={sync.serverOffsetMs}
      publicEvents={sync.events}
      finishEvidence={sync.finishPublished?
        finishEvidence:null}/>:null}
  </main>;
}
