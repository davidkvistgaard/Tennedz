'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {RaceViewer,RouteProfile,commentaryAt,createSampler,
  formatFinishDistance,labelRaceGroups,raceGroups} from '@pelotonia/race-viewer';

const clockLabel=seconds=>{
  const value=Math.max(0,Math.floor(seconds||0));
  return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;
};

export default function ViewerPreviewScene({feed,coverage,mode='recorded',
  version,clock,serverOffsetMs}){
  const viewerRef=useRef(null),lastUpdate=useRef(-1);
  const pelotonId=Object.entries(feed.frames[0]?.groupRoles??{})
    .find(([,role])=>role==='peloton')?.[0]??
    feed.frames[0]?.positions[0]?.groupId;
  const [target,setTarget]=useState({type:'group',id:pelotonId});
  const [cycleKey,setCycleKey]=useState(0);
  const [stats,setStats]=useState(null),[error,setError]=useState(null);
  const [detailsOpen,setDetailsOpen]=useState(false);
  const [tab,setTab]=useState('riders'),[light,setLight]=useState('day');
  useEffect(()=>{
    viewerRef.current?.setZoom(.35);
  },[cycleKey]);
  const time=stats?.time??0;
  const sampler=useMemo(()=>createSampler(feed),[feed]);
  const situation=useMemo(()=>sampler(time),[sampler,time]);
  const groups=labelRaceGroups(raceGroups(situation.positions),
    situation.groupRoles);
  const commentary=commentaryAt(feed,time),latest=commentary.at(-1);
  const remaining=formatFinishDistance(stats?.finishRemaining??
    feed.route.profile.samples.at(-1)[0]);
  const selected=target.type==='rider'?
    feed.riders.find(rider=>rider.id===target.id):null;
  const progress=Math.min(100,100*time/feed.duration);
  const choose=next=>{setTarget(next);viewerRef.current?.follow(next);};
  return <section className="race-theatre" aria-label="Pelotonia race theatre">
    <div className="race-theatre-stage">
      <RaceViewer key={cycleKey} ref={viewerRef} feed={feed} clock={clock}
        serverOffsetMs={serverOffsetMs} target={target}
        onSelect={choose} onError={cause=>setError(cause.message)}
        onStats={next=>{if(next.time<lastUpdate.current-30)
          setCycleKey(current=>current+1);
          if(Math.abs(next.time-lastUpdate.current)>=.5||
          next.time===feed.duration){lastUpdate.current=next.time;
          setStats(next);}}} className="race-theatre-canvas"/>
      <header className="race-theatre-header">
        <div className="race-theatre-brand"><span aria-hidden="true">◩</span>
          <strong>PELOTONIA</strong><small>RACE THEATRE</small></div>
        <div className="race-theatre-headline" aria-live="polite">
          <span className="race-theatre-dot"/><time>{clockLabel(latest?.time)}</time>
          <span>{latest?.text??'The recorded race begins.'}</span>
        </div>
        <span className="race-theatre-badge">{mode==='exhibition'?
          'SYNTHETIC EXHIBITION':'RECORDED MOTOR LAB RACE'}</span>
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
            <b>{index===0?'LEAD':Number.isFinite(stats?.gaps?.[group.id])?
              `+${clockLabel(stats.gaps[group.id])}`:'—'}</b>
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
          {['riders','teams','route','events'].map(name=><button
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
        <p className="race-theatre-coverage">{mode==='exhibition'?
          'Fictional positions, groups, route and scenery. No game result.':
          'Motor positions and events are recorded. Scenery is a synthetic visual study, not game geography.'}</p>
      </aside>:null}
      <div className="race-theatre-camera-status" role="status">
        {stats?.renderer??'Loading renderer'} · {stats?.visible??0} riders
        {stats?.fps?` · ${Math.round(stats.fps)} fps`:''}
      </div>
    </div>
    <div className="race-theatre-bottom">
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
            {feed.events?.filter(event=>event.riderId).map((event,index)=><i
              key={index} style={{left:`${100*event.time/feed.duration}%`}}/>)}</div>
          <div><small>START</small><small>{Math.round(progress)}% OF RACE</small>
            <small>FINISH</small></div>
        </div>
        <span className="race-theatre-rate">1× shared</span>
      </div>
      <div className="race-theatre-footnote">
        <span>Camera is local · race time is shared</span>
        <span>{mode==='exhibition'?
          'SYNTHETIC DATA ONLY':'SYNTHETIC SCENE · RECORDED MOTOR DATA'} · VIEWER v1</span>
      </div>
      {error?<p role="alert" className="race-theatre-error">{error}</p>:null}
      <details className="race-theatre-data"><summary>Data coverage and limitations</summary>
        <p>{mode==='exhibition'?'Visual fixture':'Adapter'} {version};
          {coverage.boundaryFrames} frames.</p>
        <p>{mode==='exhibition'?
          'All positions, groups, gaps, route and events are fictional. This mode tests the viewer appearance only.':
          'Within-kilometre movement is interpolation between recorded states. Lanes, canonical geography, helmets and official results are absent. Trees, ground and spectators are synthetic visual presentation.'}</p>
      </details>
    </div>
  </section>;
}
