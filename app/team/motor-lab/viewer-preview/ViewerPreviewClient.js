'use client';
import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';

const PreviewScene=dynamic(()=>import('./ViewerPreviewScene'),{
  ssr:false,loading:()=>
    <p role="status">Loading the race renderer…</p>});

export default function ViewerPreviewClient({feed,coverage,version,
  raceMode='connected',
  variantQuery='',
  previewPath='/team/motor-lab'}){
  const splitSettings=new URLSearchParams(variantQuery);
  const [sync,setSync]=useState(null);
  const [error,setError]=useState(null);
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
  },[feed.raceId,feed.riderCategory,feed.duration,raceMode,
    variantQuery]);
  return <main className="motor-viewer-preview">
    <header>
      <p className="eyebrow">Motor Lab · new race viewer</p>
      <h1>{raceMode==='split'?'Recorded split road race':
        'Recorded sample race'}</h1>
      <p>{feed.route.profile.samples.at(-1)[0]/1000} km · {
        feed.riderCategory==='women'?'Women':'Men'} · {
        coverage.riderCount} riders · 1× shared replay</p>
      <p>Distances between paid kilometre crossings are interpolated.
        The road is a schematic distance axis. Geography, rider lanes,
        helmets and official results are unavailable in this recording.</p>
      {coverage.sameSeedFinishMismatches>0?<p role="note">
        Experimental Motor Lab race: {coverage.sameSeedFinishMismatches}
        {' '}of {coverage.riderCount} same-seed finish times still differ
        from the guided engine. This preview is not an official result.
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
      </form>:null}
    </header>
    {error?<p role="alert">{error} <a href="/team/motor-lab/engine">
      Open the Motor Lab engine</a>.</p>:null}
    {!sync&&!error?<p role="status">Synchronizing race time…</p>:null}
    {sync?<PreviewScene feed={feed} coverage={coverage}
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
    </footer>
  </main>;
}
