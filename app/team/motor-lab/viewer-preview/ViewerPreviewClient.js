'use client';
import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';

const PreviewScene=dynamic(()=>import('./ViewerPreviewScene'),{
  ssr:false,loading:()=>
    <p role="status">Loading the race renderer…</p>});

export default function ViewerPreviewClient({feed,coverage,version,
  finishEvidence:initialFinishEvidence=null,
  raceMode='connected',
  physicalRecordingAvailable=false,
  variantQuery='',
  previewPath='/team/motor-lab'}){
  const splitSettings=new URLSearchParams(variantQuery);
  const [sync,setSync]=useState(null);
  const [error,setError]=useState(null);
  const [paidFinish,setPaidFinish]=useState(initialFinishEvidence?
    {raceId:feed.raceId,evidence:initialFinishEvidence}:null);
  const finishEvidence=paidFinish?.raceId===feed.raceId?
    paidFinish.evidence:initialFinishEvidence;
  const racePublished=sync?.raceId===feed.raceId&&
    sync.serverNowMs>=
    sync.clock.serverEpochMs+feed.duration*1000;
  const publicEvents=sync?.raceId===feed.raceId?sync.events:[];
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      try{
        const sent=Date.now();
        const response=await fetch(`/api/motor-lab/viewer-clock?category=${
          feed.riderCategory}&race=${raceMode}${
          variantQuery?`&${variantQuery}`:''}`,{cache:'no-store'});
        if(!response.ok)throw new Error('Shared preview clock unavailable.');
        const payload=await response.json();
        const received=Date.now();
        if(payload.raceId!==feed.raceId||
          payload.clock?.duration!==feed.duration||
          !Array.isArray(payload.events)||
          payload.events.some(event=>event.time>
            Math.min(feed.duration,(payload.serverNowMs-
              payload.clock.serverEpochMs)/1000)))
          throw new Error('Shared clock does not match this race.');
        if(active){
          setSync({raceId:payload.raceId,events:payload.events,
            clock:payload.clock,serverNowMs:payload.serverNowMs,
            serverOffsetMs:payload.serverNowMs-(sent+received)/2});
          setError(null);
        }
      }catch(cause){if(active)setError(cause.message);}
    };
    load();
    const timer=setInterval(load,5000);
    return ()=>{active=false;clearInterval(timer);};
  },[feed.raceId,feed.riderCategory,feed.duration,raceMode,
    variantQuery]);
  useEffect(()=>{
    if(raceMode!=='split'||!racePublished||finishEvidence)return;
    let active=true;
    const controller=new AbortController();
    (async()=>{
      const response=await fetch(`/api/motor-lab/viewer-race?category=${
        feed.riderCategory}${variantQuery?`&${variantQuery}`:''}`,
      {cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error('Paid finish unavailable.');
      const document=await response.json();
      if(document.raceId!==feed.raceId||
        document.feed?.duration!==feed.duration||
        document.finishEvidence?.publishedAt!==feed.duration)
        throw new Error('Paid finish does not match this race.');
      if(active)setPaidFinish({raceId:feed.raceId,
        evidence:document.finishEvidence});
    })().catch(cause=>{
      if(active&&cause.name!=='AbortError')setError(cause.message);
    });
    return()=>{active=false;controller.abort();};
  },[raceMode,racePublished,finishEvidence,feed.raceId,
    feed.riderCategory,feed.duration,variantQuery]);
  return <main className="motor-viewer-preview">
    <header className="motor-viewer-intro">
      <h1>{raceMode==='split'?'Motor Lab recorded race':
        'Motor Lab sample race'}</h1>
      <span>{feed.route.profile.samples.at(-1)[0]/1000} km · {
        feed.riderCategory==='women'?'Women':'Men'} · {
        coverage.riderCount} riders</span>
      <span>Experimental motor data · synthetic scenery · no official result</span>
    </header>
    <details className="motor-viewer-setup">
      <summary>Race setup and data limits</summary>
      <p>Distances between paid kilometre crossings are interpolated.
        The road is a schematic distance axis. Geography, rider lanes,
        helmets and official results are unavailable in this recording.</p>
      {coverage.sameSeedFinishMismatches>0?<p role="note">
        {coverage.sameSeedFinishMismatches} of {coverage.riderCount}
        {' '}same-seed finish times still differ from the guided engine.
      </p>:null}
      {raceMode==='split'?<form action={previewPath} method="get"
        aria-label="Generate a Motor Lab viewer race">
        <input type="hidden" name="race" value="split"/>
        <input type="hidden" name="category" value={feed.riderCategory}/>
        <label>Route profile <select name="terrain"
          defaultValue={splitSettings.get('terrain')??'mountain'}>
          <option value="flat">Flat</option>
          <option value="rolling">Rolling</option>
          <option value="mountain">Mountain</option>
        </select></label>{' '}
        <label>Chase order <select name="chase"
          defaultValue={splitSettings.get('chase')??'selective'}>
          <option value="selective">Selective</option>
          <option value="all">All helpers</option>
        </select></label>{' '}
        <label>Attack order <select name="attack"
          defaultValue={splitSettings.get('attack')??'none'}>
          <option value="none">None</option>
          <option value="selective">Selective</option>
          <option value="repeated">Repeated</option>
        </select></label>{' '}
        <label>Seed <input name="seed" required maxLength="64"
          pattern="[A-Za-z0-9-]+"
          defaultValue={splitSettings.get('seed')??
            'preview-recorded-road-1'}/></label>{' '}
        <button type="submit">Generate recorded race</button>
        <p>120 km · 15 teams · experimental paid road. The orders
          affect the motor run; no official placing is inferred.</p>
        {racePublished?<p><a href={`/api/motor-lab/viewer-race?category=${
          feed.riderCategory}${variantQuery?`&${variantQuery}`:''}`}>
          Open completed race data (versioned JSON)</a></p>:null}
      </form>:null}
    </details>
    {error?<p role="alert">{error} <a href="/team/motor-lab/engine">
      Open the Motor Lab engine</a>.</p>:null}
    {!sync&&!error?<p role="status">Synchronizing race time…</p>:null}
    {sync?.raceId===feed.raceId?<PreviewScene feed={feed} coverage={coverage}
      publicEvents={publicEvents}
      finishEvidence={racePublished?finishEvidence:null}
      mode={raceMode==='split'?'split':'recorded'}
      version={version} {...sync}/>:null}
    <footer><a href="/team/motor-lab/engine">
      Motor Lab engine</a> · <a href={
      `${previewPath}?race=${raceMode}&category=${
        feed.riderCategory==='women'?'men':'women'}${
        variantQuery?`&${variantQuery}`:''}`}>
      Switch to {feed.riderCategory==='women'?'men':'women'}’s test field</a>
      {' '}· <a href={`${previewPath}?race=${
        raceMode==='split'?'connected':'split'}&category=${
        feed.riderCategory}`}>
        {raceMode==='split'?'Connected sample':'Split road sample'}</a>
      {physicalRecordingAvailable?<> · <a href={
        '/team/motor-lab/recorded-viewer'}>Record a game race</a></>:null}
    </footer>
  </main>;
}
