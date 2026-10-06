"use client";

import {useEffect,useMemo,useState} from "react";

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const formatSeconds=value=>`${Math.round(value)} s`;
const title=value=>value.replaceAll('_',' ');

export default function TacticalTourViewer({recording,focusTeamId}){
  const [index,setIndex]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(1);
  const [selectedTeamId,setSelectedTeamId]=useState(focusTeamId);
  const frames=recording.frames;
  const frame=frames[index];
  const distance=recording.route.distanceKm;
  const teams=recording.committedInputs.teams;
  const focusedTeam=teams.find(team=>team.id===selectedTeamId);
  const names=useMemo(()=>new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider.name]))),[teams]);
  const moments=useMemo(()=>frames.flatMap((item,index)=>{
    const events=[];
    const previousGroups=frames[index-1]?.roadGroups.length??0;
    if(item.roadGroups.length>previousGroups)events.push({km:item.km,
      text:item.roadGroups.length===1?'A group moves clear of the peloton.':
        'Another group forms on the road.'});
    if(item.formedChaseGroupId)events.push({km:item.km,
      text:'A chasing group forms behind the leaders.'});
    for(const riderId of item.attackers)events.push({km:item.km,
      text:`${names.get(riderId)} attacks from the bunch.`});
    for(const riderId of item.joinedBreakawayRiderIds)events.push({km:item.km,
      text:`${names.get(riderId)} reaches the group ahead.`});
    for(const riderId of item.caughtBreakawayRiderIds)events.push({km:item.km,
      text:`${names.get(riderId)} is caught.`});
    if(item.mergedRoadGroupIds.length)events.push({km:item.km,
      text:'Two road groups come back together.'});
    for(const decision of item.decisions)events.push({km:item.km,
      text:`${teams.find(team=>team.id===decision.teamId)?.id} changes plan: ${title(decision.kind)}.`});
    return events;
  }),[frames,names,teams]);
  useEffect(()=>{
    if(!playing)return;
    const timer=setInterval(()=>setIndex(current=>Math.min(current+speed,frames.length-1)),240);
    return ()=>clearInterval(timer);
  },[playing,speed,frames.length]);
  useEffect(()=>{if(index===frames.length-1)setPlaying(false);},[index,frames.length]);
  const current=frame.riderGroups;
  const roadGroupByRider=new Map(frame.roadGroups.flatMap((group,groupIndex)=>
    group.riderIds.map(id=>[id,groupIndex===0?'Front group':`Group ${groupIndex+1}`])));
  const own=current.filter(rider=>rider.teamId===selectedTeamId);
  const peloton=current.filter(rider=>rider.group==='peloton').length;
  const dropped=current.filter(rider=>rider.group==='dropped').length;
  const recent=moments.filter(moment=>moment.km<=frame.km).slice(-8).reverse();
  const previousMoment=[...moments].reverse().find(moment=>moment.km<frame.km)?.km;
  const nextMoment=moments.find(moment=>moment.km>frame.km)?.km;
  const ascent=Math.round(recording.route.kilometres.reduce((total,segment)=>
    total+Math.max(0,segment.endM-segment.startM),0));
  const elevation=recording.route.kilometres.map(segment=>segment.endM);
  const maxElevation=Math.max(1,...elevation);
  const profile=elevation.map((height,i)=>`${i/(elevation.length-1)*100},${100-height/maxElevation*85}`).join(' ');
  const results=recording.provisionalResults;
  const selectedResults=results.filter(result=>result.teamId===selectedTeamId);
  return <div className="tactical-viewer">
    <header className="tactical-hero">
      <p className="tactical-eyebrow">RECORDED TOUR PROTOTYPE · DIVISION 1</p>
      <h1>Follow the race, kilometre by kilometre</h1>
      <p>This sample was calculated before playback. Scrubbing and play speed only change what you see.</p>
      <div className="tactical-facts"><span>{distance} km</span><span>{ascent} m climbing</span>
        <span>{teams.length} teams</span><span>Locked weather: {recording.route.lockedWeather.windKph} km/h wind</span></div>
    </header>
    <section className="tactical-panel" aria-label="Race playback">
      <div className="tactical-panel-head"><h2>Race position</h2>
        <strong>Km {frame.km} / {distance}</strong></div>
      <svg className="tactical-profile" viewBox="0 0 100 100" preserveAspectRatio="none"
        role="img" aria-label={`Route elevation profile, current position kilometre ${frame.km}`}>
        <polyline points={profile} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
        <line x1={frame.km/distance*100} x2={frame.km/distance*100} y1="0" y2="100"
          stroke="var(--pelotonia-green,#4FB28A)" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
      </svg>
      <label htmlFor="tactical-position">Playback position</label>
      <input id="tactical-position" type="range" min="0" max={frames.length-1} value={index}
        onChange={event=>{setPlaying(false);setIndex(Number(event.target.value));}}
        aria-valuetext={`Kilometre ${frame.km} of ${distance}`}/>
      <div className="tactical-controls">
        <button type="button" onClick={()=>{
          if(index===frames.length-1)setIndex(0);
          setPlaying(!playing);
        }}>{playing?'Pause':index===frames.length-1?'Watch again':'Play recording'}</button>
        <button type="button" onClick={()=>{setPlaying(false);setIndex(current=>
          clamp(current+10,0,frames.length-1));}}>Skip 10 km</button>
        <button type="button" disabled={previousMoment===undefined} onClick={()=>{
          setPlaying(false);setIndex(previousMoment-1);
        }}>Previous moment</button>
        <button type="button" disabled={nextMoment===undefined} onClick={()=>{
          setPlaying(false);setIndex(nextMoment-1);
        }}>Next moment</button>
        <label>Speed <select value={speed} onChange={event=>setSpeed(Number(event.target.value))}>
          <option value={1}>1x</option><option value={3}>3x</option><option value={6}>6x</option>
        </select></label>
      </div>
    </section>
    <div className="tactical-grid">
      <section className="tactical-panel" aria-label="Road groups">
        <div className="tactical-panel-head"><h2>On the road</h2>
          <span>{title(frame.terrain)} · {title(frame.surface)}</span></div>
        {frame.roadGroups.map((group,groupIndex)=><div className="tactical-road-group" key={group.id}>
          <strong>{groupIndex===0?'Front group':`Group ${groupIndex+1}`}</strong>
          <span>{group.riderIds.length} riders · {formatSeconds(group.gapSeconds)} ahead</span>
          <small>{group.riderIds.slice(0,4).map(id=>names.get(id)).join(', ')}
            {group.riderIds.length>4?' + more':''}</small>
        </div>)}
        <div className="tactical-road-group"><strong>Peloton</strong><span>{peloton} riders</span></div>
        {dropped>0&&<div className="tactical-road-group"><strong>Off the back</strong><span>{dropped} riders</span></div>}
      </section>
      <section className="tactical-panel" aria-label="Your riders">
        <div className="tactical-panel-head"><h2>{focusedTeam?.id} riders</h2>
          <label htmlFor="tactical-team">Watch team <select id="tactical-team"
            value={selectedTeamId} onChange={event=>setSelectedTeamId(event.target.value)}>
            {teams.map(team=><option key={team.id} value={team.id}>{team.id}</option>)}
          </select></label></div>
        <div className="tactical-rider-list">{own.map(rider=><div key={rider.id}>
          <strong>{names.get(rider.id)}</strong><span>{roadGroupByRider.get(rider.id)??title(rider.group)}</span>
          <span>{Math.round(rider.energy)} energy</span>
          <span>{rider.deficitSeconds>0?`${formatSeconds(rider.deficitSeconds)} behind`:''}</span>
        </div>)}</div>
      </section>
      <section className="tactical-panel" aria-label="Race moments">
        <div className="tactical-panel-head"><h2>What happened</h2><span>Through km {frame.km}</span></div>
        {recent.length?<ol className="tactical-moments">{recent.map((moment,i)=><li key={`${moment.km}-${i}`}>
          <b>{moment.km} km</b><span>{moment.text}</span></li>)}</ol>:
          <p>The field is settling in. Move the playback to see attacks and responses.</p>}
      </section>
      <section className="tactical-panel" aria-label="Provisional results">
        <div className="tactical-panel-head"><h2>Provisional finish</h2>
          <span>Shown after the final kilometre</span></div>
        {index===frames.length-1?<>
          <h3>{focusedTeam?.id} finish</h3>
          <ol className="tactical-results" aria-label={`${focusedTeam?.id} finish`}>{selectedResults.map(result=><li key={result.riderId}>
            <b>{result.position}</b><span>{result.name}</span><small>{result.teamId}</small>
            <strong>+{result.gapSeconds.toFixed(1)} s</strong></li>)}</ol>
          <h3>First 12 across the division</h3>
          <ol className="tactical-results" aria-label="First 12 across the division">{results.slice(0,12).map(result=><li key={result.riderId}>
            <b>{result.position}</b><span>{result.name}</span><small>{result.teamId}</small>
            <strong>+{result.gapSeconds.toFixed(1)} s</strong></li>)}</ol>
        </>:
          <p>Placings stay hidden during playback. The result has already been recorded.</p>}
      </section>
    </div>
  </div>;
}
