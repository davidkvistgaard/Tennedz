'use client';
import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';

const PreviewScene=dynamic(()=>import('./ViewerPreviewScene'),{
  ssr:false,loading:()=>
    <p role="status">Loading the race renderer…</p>});

export default function ViewerPreviewClient({feed,coverage,version,
  mode='recorded',
  fieldSize=32,missingAsset=false,
  previewPath='/team/motor-lab',
  clockPath='/api/motor-lab/viewer-clock'}){
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
  },[feed.raceId,feed.riderCategory,feed.duration,clockPath,clockQuery]);
  return <main className="motor-viewer-preview">
    <div className="motor-viewer-intro">
      <h1>{mode==='exhibition'?'Synthetic visual exhibition':
        mode==='split'?'Recorded split-road Motor Lab race':
          'Recorded Motor Lab race'}</h1>
      <span>{feed.riderCategory==='women'?'Women':'Men'} · {
        coverage.riderCount} riders · {mode==='exhibition'?'4 min':
        `${feed.route.profile.samples.at(-1)[0]/1000} km`}</span>
      <span>{mode==='exhibition'?(missingAsset?
        'Fictional fixture · missing texture test':
        'Entire race is fictional'):
        mode==='split'?'Experimental motor race data · synthetic scenery':
          'Motor race data · synthetic scenery'}</span>
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
