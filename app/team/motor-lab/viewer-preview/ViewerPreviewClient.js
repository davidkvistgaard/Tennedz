'use client';
import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';

const PreviewScene=dynamic(()=>import('./ViewerPreviewScene'),{
  ssr:false,loading:()=>
    <p role="status">Loading the race renderer…</p>});

export default function ViewerPreviewClient({feed,coverage,version,
  previewPath='/team/motor-lab'}){
  const [sync,setSync]=useState(null);
  const [error,setError]=useState(null);
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      try{
        const sent=Date.now();
        const response=await fetch(`/api/motor-lab/viewer-clock?category=${
          feed.riderCategory}`,{cache:'no-store'});
        if(!response.ok)throw new Error('Shared preview clock unavailable.');
        const payload=await response.json();
        const received=Date.now();
        if(payload.raceId!==feed.raceId||
          payload.clock?.duration!==feed.duration)
          throw new Error('Shared clock does not match this race.');
        if(active){
          setSync({clock:payload.clock,
            serverOffsetMs:payload.serverNowMs-(sent+received)/2});
          setError(null);
        }
      }catch(cause){if(active)setError(cause.message);}
    };
    load();
    const timer=setInterval(load,5000);
    return ()=>{active=false;clearInterval(timer);};
  },[feed.raceId,feed.riderCategory,feed.duration]);
  return <main className="motor-viewer-preview">
    <header>
      <p className="eyebrow">Motor Lab · new race viewer</p>
      <h1>Recorded sample race</h1>
      <p>40 km · {feed.riderCategory==='women'?'Women':'Men'} · {
        coverage.riderCount} riders · 1× shared replay</p>
      <p>The road is a schematic distance axis. Geography, rider lanes,
        helmets and official results are unavailable in this recording.</p>
    </header>
    {error?<p role="alert">{error} <a href="/team/motor-lab/engine">
      Open the Motor Lab engine</a>.</p>:null}
    {!sync&&!error?<p role="status">Synchronizing race time…</p>:null}
    {sync?<PreviewScene feed={feed} coverage={coverage}
      version={version} {...sync}/>:null}
    <footer><a href="/team/motor-lab/engine">
      Motor Lab engine</a> · <a href={
      `${previewPath}?category=${
        feed.riderCategory==='women'?'men':'women'}`}>
      Switch to {feed.riderCategory==='women'?'men':'women'}’s test field</a>
    </footer>
  </main>;
}
