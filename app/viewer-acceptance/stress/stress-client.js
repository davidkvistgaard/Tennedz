'use client';
import dynamic from 'next/dynamic';
import {useState} from 'react';
const RaceViewer=dynamic(()=>import('./stress-scene'),{ssr:false});

export default function StressClient({feed}){
  const [target,setTarget]=useState({type:'group',id:'peloton'});
  const [stats,setStats]=useState(null);
  const [error,setError]=useState(null);
  const [epoch]=useState(()=>Date.now());
  const clock={position:feed.frames[20].time,serverEpochMs:epoch,
    rate:1,paused:false,duration:feed.duration};
  return <main className="motor-viewer-preview">
    <h1>Renderer-only synthetic fixture</h1>
    <p>{feed.riders.length} synthetic riders · {feed.riderCategory}.
      Rider lanes and spacing are fabricated solely for renderer load testing.
      This is not a Motor Lab race.</p>
    <label>Camera target <select value={target.type==='rider'?
      target.id:''} onChange={event=>setTarget(event.target.value?
      {type:'rider',id:event.target.value}:
      {type:'group',id:'peloton'})}>
      <option value="">Peloton</option>
      {feed.riders.map(rider=><option key={rider.id}
        value={rider.id}>{rider.name}</option>)}
    </select></label>
    <p role="status">{stats?.renderer??'Loading renderer'} · {
      stats?.visible??0} visible · {stats?.fps??0} fps · {
      stats?.drawCalls??0} draw calls · {
      stats?.assetStatus?.errors?.length??0} asset errors</p>
    {error?<p role="alert">{error}</p>:null}
    <RaceViewer feed={feed} clock={clock} target={target}
      onSelect={setTarget} onStats={setStats}
      onError={cause=>setError(cause.message)}
      style={{height:'min(75vh,720px)',minHeight:360}}/>
  </main>;
}
