'use client';
import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';

const PreviewScene=dynamic(()=>import(
  '../team/motor-lab/viewer-preview/ViewerPreviewScene'),{
  ssr:false,loading:()=>
    <p role="status">Loading the race renderer…</p>});

export default function PublicViewerClient({feed,coverage,version,
  mode='recorded',
  fieldSize=32,missingAsset=false,
  previewPath='/team/motor-lab',
  clockPath='/api/viewer-sample-clock'}){
  const categoryQuery=feed.riderCategory==='women'?'?category=women':'';
  const splitQuery=`?mode=split${
    feed.riderCategory==='women'?'&category=women':''}`;
  const exhibitionQuery=`?mode=exhibition${
    feed.riderCategory==='women'?'&category=women':''}${
    fieldSize===32?'':`&field=${fieldSize}`}${
    missingAsset?'&asset=missing':''}`;
  const clockQuery=`category=${feed.riderCategory}${
    mode==='split'?'&race=split':''}${
    mode==='exhibition'&&fieldSize!==32?`&field=${fieldSize}`:''}${
    mode==='exhibition'&&missingAsset?'&asset=missing':''}`;
  const [sync,setSync]=useState(null);
  const [error,setError]=useState(null);
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      try{
        const sent=Date.now();
        const response=await fetch(`${clockPath}?${clockQuery}`,
          {cache:'no-store'});
        if(!response.ok)throw new Error('Shared preview clock unavailable.');
        const payload=await response.json();
        const received=Date.now();
        const elapsed=Math.min(feed.duration,Math.max(0,
          (payload.serverNowMs-payload.clock?.serverEpochMs)*
            payload.clock?.rate/1000));
        if(payload.raceId!==feed.raceId||
          payload.clock?.duration!==feed.duration||
          !Number.isFinite(elapsed)||
          !Array.isArray(payload.events)||
          payload.events.some(event=>event.time>elapsed))
          throw new Error('Shared clock does not match this race.');
        if(active){
          setSync({clock:payload.clock,
            events:payload.events,
            serverOffsetMs:payload.serverNowMs-(sent+received)/2});
          setError(null);
        }
      }catch(cause){if(active)setError(cause.message);}
    };
    load();
    const timer=setInterval(load,5000);
    return ()=>{active=false;clearInterval(timer);};
  },[feed.raceId,feed.riderCategory,feed.duration,clockPath,clockQuery]);
  return <main className="motor-viewer-preview">
    <div className="motor-viewer-intro">
      <h1>{mode==='exhibition'?'Synthetic visual exhibition':
        mode==='split'?'Saved split-road Motor Lab sample':
          'Saved Motor Lab sample race'}</h1>
      <span>{feed.riderCategory==='women'?'Women':'Men'} · {
        coverage.riderCount} riders · {mode==='exhibition'?'4 min':
        `${feed.route.profile.samples.at(-1)[0]/1000} km`}</span>
      <span>{mode==='exhibition'?(missingAsset?
        'Fictional fixture · missing texture test':
        'Entire race is fictional'):
        'Immutable Motor Lab test recording · synthetic scenery · no game result'}</span>
      {mode==='split'?<span>Same-seed finish calibration: {
        coverage.sameSeedFinishMismatches}/{coverage.riderCount}
        {' '}riders differ. No official result.</span>:null}
      <nav className="motor-viewer-modes" aria-label="Viewer mode">
        <a aria-current={mode==='recorded'?'page':undefined}
          href={`/viewer${categoryQuery}`}>Recorded race</a>
        <a aria-current={mode==='split'?'page':undefined}
          href={`/viewer${splitQuery}`}>Split-road race</a>
        <a aria-current={mode==='exhibition'?'page':undefined}
          href={`/viewer${exhibitionQuery}`}>Visual exhibition</a>
      </nav>
    </div>
    {error?<p role="alert">{error} <a href="/team/motor-lab/engine">
      Open the Motor Lab engine</a>.</p>:null}
    {!sync&&!error?<p role="status">Synchronizing race time…</p>:null}
    {sync?<PreviewScene feed={feed} coverage={coverage} mode={mode}
      publicEvents={sync.events}
      version={version} {...sync}/>:null}
    <footer><a href="/team/motor-lab/engine">
      Motor Lab engine</a> · <a href={mode==='exhibition'?
      `/viewer${categoryQuery}`:`/viewer${exhibitionQuery}`}>
      {mode==='exhibition'?'Recorded Motor Lab race':
        'Synthetic visual exhibition'}</a> · <a href={
      `${previewPath}?category=${
        feed.riderCategory==='women'?'men':'women'}${
        mode==='split'?`&${previewPath==='/viewer'?'mode':'race'}=split`:
        mode==='exhibition'?`&mode=exhibition${
          fieldSize===32?'':`&field=${fieldSize}`}${
          missingAsset?'&asset=missing':''}`:''}`}>
      Switch to {feed.riderCategory==='women'?'men':'women'}’s test field</a>
    </footer>
  </main>;
}
