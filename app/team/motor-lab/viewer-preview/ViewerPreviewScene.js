'use client';
import {useEffect,useRef,useState} from 'react';
import {RaceViewer,RouteProfile,commentaryAt,
  formatFinishDistance} from '@pelotonia/race-viewer';

export default function ViewerPreviewScene({feed,coverage,
  version,clock,serverOffsetMs}){
  const [target,setTarget]=useState({type:'group',id:'peloton'});
  const [stats,setStats]=useState(null);
  const [error,setError]=useState(null);
  const viewerRef=useRef(null);
  const lastUpdate=useRef(-1);
  useEffect(()=>{
    viewerRef.current?.setZoom(.55);
  },[feed]);
  const time=stats?.time??0;
  const commentary=commentaryAt(feed,time);
  const latest=commentary.at(-1);
  const remaining=formatFinishDistance(
    stats?.finishRemaining??feed.route.profile.samples.at(-1)[0]);
  return <section aria-label="Physical Motor Lab race preview">
    <div className="motor-viewer-status" role="status">
      <span>{remaining.value} {remaining.unit} to finish</span>
      <span>{stats?.renderer??'Loading renderer'}</span>
      <span>{Math.round(time)} / {Math.round(feed.duration)} race seconds</span>
      {stats?<span>{stats.visible} visible · {
        Math.round(stats.fps)} fps · {
        Number(stats.cpuMs??0).toFixed(1)} ms CPU</span>:null}
    </div>
    <div className="motor-viewer-targets">
      <button type="button" onClick={()=>
        setTarget({type:'group',id:'peloton'})}>Follow peloton</button>
      <label>Follow rider <select value={target.type==='rider'?
        target.id:''} onChange={event=>setTarget(event.target.value?
        {type:'rider',id:event.target.value}:
        {type:'group',id:'peloton'})}>
        <option value="">Peloton</option>
        {feed.riders.map(rider=><option key={rider.id}
          value={rider.id}>{rider.name}</option>)}
      </select></label>
    </div>
    {error?<p role="alert">Viewer error: {error}</p>:null}
    <RaceViewer ref={viewerRef} feed={feed} clock={clock}
      serverOffsetMs={serverOffsetMs} target={target}
      onSelect={setTarget} onError={cause=>setError(cause.message)}
      onStats={next=>{if(Math.abs(next.time-lastUpdate.current)>=.5||
        next.time===feed.duration){lastUpdate.current=next.time;
        setStats(next);}}}
      style={{height:'min(65vh,720px)',minHeight:360}}/>
    <RouteProfile feed={feed} time={time}/>
    <aside className="motor-viewer-commentary" aria-label="Race commentary">
      <p className="eyebrow">Recorded commentary</p>
      <p>{latest?.text??'Waiting for the first recorded event.'}</p>
      {latest?.riderId?<button type="button" onClick={()=>
        setTarget({type:'rider',id:latest.riderId})}>
        Follow rider</button>:null}
      <details><summary>Full race report</summary>
        <ol>{commentary.map(row=><li key={row.id}>
          {Math.floor(row.time/60)}:{String(Math.floor(row.time%60))
            .padStart(2,'0')} · {row.text}</li>)}</ol>
      </details>
    </aside>
    <details><summary>Recording coverage and limitations</summary>
      <p>Adapter {version}; {coverage.paidRiderKilometres}
        independently replayed rider-kilometres; {
          coverage.boundaryFrames} measured boundary frames.</p>
      <p>Within-kilometre positions are viewer interpolation between
        paid boundary states. All rider lanes are unknown and rendered on
        the centreline. The horizontal route is schematic. The test kit
        uses the game’s catalog allocation for fictional teams. No
        official result, geography or scene asset was supplied.</p>
    </details>
  </section>;
}
