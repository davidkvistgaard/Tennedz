'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {RaceViewer,RouteProfile,commentaryAt,createSampler,
  finishRemaining,formatFinishDistance,labelRaceGroups,raceGroups} from '@pelotonia/race-viewer';
import {illustrativeGroupLayoutFeedV2} from
  '../../../../lib/viewer/illustrative-group-layout-v2.mjs';

const clockLabel=seconds=>{
  const value=Math.max(0,Math.floor(seconds||0));
  return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;
};

export default function ViewerPreviewScene({feed,coverage,mode='recorded',
  version,clock,serverOffsetMs}){
  const viewerRef=useRef(null),lastUpdate=useRef(-1);
  const lastAssetStatus=useRef('');
  const graphicsBackend=useRef(null);
  const pelotonId=Object.entries(feed.frames[0]?.groupRoles??{})
    .find(([,role])=>role==='peloton')?.[0]??
    feed.frames[0]?.positions[0]?.groupId;
  const [target,setTarget]=useState({type:'group',id:pelotonId});
  const [cycleKey,setCycleKey]=useState(0);
  const [stats,setStats]=useState(null),[error,setError]=useState(null);
  const [assetStatus,setAssetStatus]=useState(null);
  const [diagnostics,setDiagnostics]=useState(null);
  const [detailsOpen,setDetailsOpen]=useState(false);
  const [tab,setTab]=useState('riders'),[light,setLight]=useState('day');
  useEffect(()=>{
    viewerRef.current?.setZoom(.35);
  },[cycleKey]);
  const time=stats?.time??0;
  // Keep the recorded feed authoritative for every sporting display value.
  // Only the WebGL canvas receives illustrative rider spacing.
  const displayFeed=useMemo(()=>mode==='exhibition'?feed:
    illustrativeGroupLayoutFeedV2(feed),[feed,mode]);
  const sampler=useMemo(()=>createSampler(feed),[feed]);
  const groupOnlyPositions=useMemo(()=>mode!=='exhibition'&&
    feed.frames.some(frame=>{
      const seen=new Set();
      return frame.positions.some(row=>{
        const key=`${row.groupId}:${row.distance}:${row.lateral??0}`;
        if(seen.has(key))return true;
        seen.add(key);
        return false;
      });
    }),[feed,mode]);
  const situation=useMemo(()=>sampler(time),[sampler,time]);
  const groups=labelRaceGroups(raceGroups(situation.positions),
    situation.groupRoles);
  const commentary=mode==='guided'?
    (feed.events??[]).filter(event=>event.time<=time)
      .map((event,index)=>({id:`recorded-${index}`,time:event.time,
        text:event.label})):
    commentaryAt(feed,time),latest=commentary.at(-1);
  const totalDistance=feed.route.profile.samples.at(-1)[0];
  const remaining=formatFinishDistance(finishRemaining(
    situation.positions,totalDistance,feed.finish)??totalDistance);
  const selected=target.type==='rider'?
    feed.riders.find(rider=>rider.id===target.id):null;
  const progress=Math.min(100,100*time/feed.duration);
  const choose=next=>{setTarget(next);viewerRef.current?.follow(next);};
  return <section className="race-theatre" aria-label="Pelotonia race theatre">
    <div className="race-theatre-stage">
      <RaceViewer key={cycleKey} ref={viewerRef} feed={displayFeed} clock={clock}
        serverOffsetMs={serverOffsetMs} target={target}
        onSelect={choose} onError={cause=>setError(cause.message)}
        onStats={next=>{if(next.time<lastUpdate.current-30)
          setCycleKey(current=>current+1);
          if(Math.abs(next.time-lastUpdate.current)>=.5||
          next.time===feed.duration){lastUpdate.current=next.time;
          setStats(next);
          const status=viewerRef.current?.getAssetStatus();
          const signature=JSON.stringify(status);
          if(signature!==lastAssetStatus.current){
            lastAssetStatus.current=signature;
            setAssetStatus(status);
          }
          const report=viewerRef.current?.getDiagnostics();
          if(report?.renderer==='WebGL'&&!graphicsBackend.current){
            try{
              const canvas=document.querySelector('.race-theatre-canvas canvas');
              const gl=canvas?.getContext('webgl2');
              if(gl){
                const extension=gl.getExtension('WEBGL_debug_renderer_info');
                graphicsBackend.current={
                  api:'WebGL2',
                  vendor:gl.getParameter(gl.VENDOR),
                  renderer:gl.getParameter(gl.RENDERER),
                  unmaskedVendor:extension?
                    gl.getParameter(extension.UNMASKED_VENDOR_WEBGL):null,
                  unmaskedRenderer:extension?
                    gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):null,
                };
              }
            }catch{graphicsBackend.current={api:'WebGL2',detail:'unavailable'};}
          }
          if(report)setDiagnostics({
            renderer:report.renderer,
            fps:next.fps,
            visible:next.visible,
            camera:next.camera,
            targetAvailable:next.targetAvailable,
            sampledDistance:next.distance,
            routeCoverage:next.routeCoverage,
            crowdCount:report.crowdCount,
            renderedFrames:report.renderedFrames,
            cpuP50Ms:report.cpuFrameMs?.p50,
            samplingP50Ms:report.samplingMs?.p50,
            rigP50Ms:report.rigMs?.p50,
            drawP50Ms:report.drawSubmissionMs?.p50,
            drawCalls:report.resources?.drawCalls,
            triangles:report.resources?.triangles,
            errors:report.errors?.length,
            graphicsBackend:graphicsBackend.current,
          });
        }}} className="race-theatre-canvas"/>
      <header className="race-theatre-header">
        <div className="race-theatre-brand"><span aria-hidden="true">◩</span>
          <strong>PELOTONIA</strong><small>RACE THEATRE</small></div>
        <div className="race-theatre-headline" aria-live="polite">
          <span className="race-theatre-dot"/><time>{clockLabel(latest?.time)}</time>
          <span>{latest?.text??'The recorded race begins.'}</span>
        </div>
        <span className="race-theatre-badge">{mode==='exhibition'?
          'SYNTHETIC EXHIBITION':mode==='guided'?
            'RECORDED GAME RACE · SCHEMATIC ROAD':'RECORDED MOTOR LAB RACE'}</span>
      </header>
      <nav className="race-theatre-groups" aria-label="Race groups">
        <div className="race-theatre-distance"><span>⚑</span>
          <strong>{remaining.value}</strong>
          <small>{remaining.unit.toUpperCase()} TO FINISH</small></div>
        <div className="race-theatre-group-scroll">
          {groups.map((group,index)=><button type="button" key={group.id}
            className={target.type==='group'&&target.id===group.id?'active':''}
            aria-pressed={target.type==='group'&&target.id===group.id}
            onClick={()=>choose({type:'group',id:group.id})}>
            <span>{String(index+1).padStart(2,'0')}</span>
            <strong>{group.label}</strong>
            <small>{group.count} {group.count===1?'rider':'riders'}</small>
            <b>{index===0?'LEAD':mode==='split'?'—':
              Number.isFinite(situation.gaps?.[group.id])?
              `+${clockLabel(situation.gaps[group.id])}`:'—'}</b>
          </button>)}
        </div>
        <button className="race-theatre-details-toggle" type="button"
          aria-expanded={detailsOpen} onClick={()=>setDetailsOpen(!detailsOpen)}>
          {detailsOpen?'Close details':'Race details'}</button>
      </nav>
      <nav className="race-theatre-tools" aria-label="Camera controls">
        <button aria-label="Orbit camera left" onClick={()=>
          viewerRef.current?.orbit(-Math.PI/6)}>↶</button>
        <button aria-label="Orbit camera right" onClick={()=>
          viewerRef.current?.orbit(Math.PI/6)}>↷</button>
        <button aria-label="Follow peloton" onClick={()=>choose(
          {type:'group',id:pelotonId})}>◎</button>
        <button aria-label="Zoom in" onClick={()=>viewerRef.current?.setZoom(
          Math.max(.2,(viewerRef.current?.getCameraState()?.zoom??.55)-.15))}>+</button>
        <button aria-label="Zoom out" onClick={()=>viewerRef.current?.setZoom(
          Math.min(2,(viewerRef.current?.getCameraState()?.zoom??.55)+.15))}>−</button>
        <button aria-label="Toggle evening light" onClick={()=>{
          const next=light==='day'?'evening':'day';
          setLight(next);viewerRef.current?.setLight(next);
        }}>☼</button>
        <button aria-label="Reset camera" onClick={()=>
          viewerRef.current?.resetCamera()}>⟲</button>
      </nav>
      {detailsOpen?<aside className="race-theatre-details" aria-label="Race details">
        <div className="race-theatre-tabs">
          {['riders','teams','route','events',
            ...(mode==='guided'?['results']:[])].map(name=><button
            key={name} type="button" aria-pressed={tab===name}
            onClick={()=>setTab(name)}>{name}</button>)}
        </div>
        {selected?<p className="race-theatre-selection">Following {selected.name}</p>:null}
        {tab==='riders'?<div className="race-theatre-detail-list">
          {feed.riders.map(rider=><button key={rider.id} type="button"
            aria-pressed={target.type==='rider'&&target.id===rider.id}
            onClick={()=>choose({type:'rider',id:rider.id})}>
            <span>{rider.number}</span>{rider.name}</button>)}
        </div>:null}
        {tab==='teams'?<div className="race-theatre-detail-list">
          {feed.teams.map(team=><p key={team.id}><span
            style={{background:team.color}} className="race-theatre-swatch"/>
            {team.name}</p>)}</div>:null}
        {tab==='route'?<RouteProfile feed={feed} time={time}/>:null}
        {tab==='events'?<ol className="race-theatre-event-list">
          {commentary.map(row=><li key={row.id}>
            <time>{clockLabel(row.time)}</time> {row.text}</li>)}</ol>:null}
        {tab==='results'&&mode==='guided'?situation.results?
          <ol className="race-theatre-event-list">
            {[...situation.results.entries].sort((a,b)=>a.rank-b.rank)
              .map(row=><li key={row.riderId}>
                <strong>{row.rank}.</strong> {feed.riders.find(r=>
                  r.id===row.riderId)?.name??row.riderId}
                {' '}{row.gap>0?`+${clockLabel(row.gap)}`:'Winner'}
              </li>)}</ol>:
          <p>The official result appears at the recorded finish.</p>:null}
        <p className="race-theatre-coverage">{mode==='exhibition'?
          'Fictional positions, groups, route and scenery. No game result.':
          mode==='guided'?
            'The saved race supplies checkpoint kilometres, group membership, time gaps, events and official results. The road is schematic; scenery is illustrative. Exact simultaneous rider metres, lanes and group order were not recorded. Kits without a saved race snapshot use neutral colours.':
          mode==='split'?
            'Paid kilometre crossings and contact events are recorded. Between crossings, distance is interpolated. No official result or precise rider lanes. Scenery is synthetic.':
          'Motor positions and events are recorded. Scenery is a synthetic visual study, not game geography.'}</p>
      </aside>:null}
      <div className="race-theatre-camera-status" role="status">
        {stats?.renderer??'Loading renderer'} · {stats?.visible??0} riders
        {stats?.fps?` · ${Math.round(stats.fps)} fps`:''}
      </div>
      {assetStatus?.errors?.length?<p role="alert"
        className="race-theatre-error">{`${assetStatus.errors.length} scene asset${
          assetStatus.errors.length===1?'':'s'} failed to load; fallback rendering remains active.`}</p>:null}
    </div>
    <div className="race-theatre-bottom">
      {mode==='guided'?<p className="race-theatre-position-note">
        Rider spacing within a group is illustrative. The saved race records
        checkpoint kilometres and group time gaps, not precise lanes or order.
      </p>:mode==='split'?<p className="race-theatre-position-note">
        Riders sharing a recorded road position are spaced for display only.
        Exact lanes and order were not recorded.
      </p>:groupOnlyPositions?<p className="race-theatre-position-note">
        Riders sharing a recorded road position are spaced for display only.
        Exact lanes and order were not recorded.
      </p>:null}
      <div className="race-theatre-commentary">
        <p>RACE COMMENTARY <small>{mode==='exhibition'?
          'FICTIONAL EVENTS':'RECORDED EVENTS'}</small></p>
        <div><time>{clockLabel(latest?.time)}</time>
          <strong>{latest?.text??'The paid race begins.'}</strong></div>
        <details><summary>Full race report</summary>
          <ol>{commentary.map(row=><li key={row.id}>
            <time>{clockLabel(row.time)}</time> {row.text}</li>)}</ol>
        </details>
      </div>
      <div className="race-theatre-transport">
        <span className="race-theatre-live" aria-label="Shared replay in progress">●</span>
        <div className="race-theatre-time"><small>SHARED REPLAY</small>
          <strong>{clockLabel(time)} <span>/ {clockLabel(feed.duration)}</span></strong>
        </div>
        <div className="race-theatre-timeline" aria-label="Shared race timeline">
          <div className="race-theatre-track"><span style={{width:`${progress}%`}}/>
            {feed.events?.filter(event=>event.riderId&&event.time<=time)
              .map((event,index)=><i
              key={index} style={{left:`${100*event.time/feed.duration}%`}}/>)}</div>
          <div><small>START</small><small>{Math.round(progress)}% OF RACE</small>
            <small>FINISH</small></div>
        </div>
        <span className="race-theatre-rate">{clock.rate}× shared</span>
      </div>
      <div className="race-theatre-footnote">
        <span>Camera is local · race time is shared</span>
        <span>{mode==='exhibition'? 'SYNTHETIC DATA ONLY':
          mode==='guided'?'ILLUSTRATIVE SCENERY · RECORDED GAME DATA':
            'SYNTHETIC SCENE · RECORDED MOTOR DATA'} · VIEWER v1</span>
      </div>
      {error?<p role="alert" className="race-theatre-error">{error}</p>:null}
      <details className="race-theatre-data"><summary>Data coverage and limitations</summary>
        <p>{mode==='exhibition'?'Visual fixture':'Adapter'} {version};
          {coverage.boundaryFrames} display frames.
          {mode==='split'?` ${coverage.paidRiderKilometres} paid rider-kilometres; ${
            coverage.recordedContactEvents} recorded contacts.`:''}</p>
        <p>{mode==='exhibition'?
          'All positions, groups, gaps, route and events are fictional. This mode tests the viewer appearance only.':
          mode==='guided'?
            'The recording has one kilometre per checkpoint for every rider. Between checkpoints the display interpolates time and distance. All members of a checkpoint share its recorded kilometre; visual overlap does not mean a measured tie. Group gaps remain seconds, not invented metres. The trees, ground and spectators are illustrative; no canonical geography or exact lanes were recorded.':
          mode==='split'?
            'Longitudinal positions between motor crossings are interpolated. Riders at the same recorded road position are spaced visually within their group; the recorded distance and group remain authoritative. Group gaps are not presented as exact simultaneous positions. Lanes, canonical geography, helmets and official results are absent. Trees, ground and spectators are synthetic.':
          'Within-kilometre movement is interpolation between recorded states. Riders sharing a road position are spaced visually; their recorded distance and group remain authoritative. Exact lanes, order, canonical geography, helmets and official results are absent. Trees, ground and spectators are synthetic visual presentation.'}</p>
      </details>
      <output className="race-theatre-diagnostics" hidden
        data-viewer-diagnostics={JSON.stringify(diagnostics)}/>
    </div>
  </section>;
}
