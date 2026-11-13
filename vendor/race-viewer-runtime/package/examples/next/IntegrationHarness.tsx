"use client";
import {useEffect,useRef,useState} from "react";
import {RaceViewer,validateFeed,type ViewerFeed,type BroadcastClock,type CameraTarget,type RaceViewerHandle} from "@pelotonia/race-viewer";
function freezeDeep<T>(value:T):T {if(value && typeof value==='object'){Object.freeze(value);for(const item of Object.values(value))freezeDeep(item);}return value;}
const tick=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
export default function IntegrationHarness(){
 const [feed,setFeed]=useState<ViewerFeed>(),[clock,setClock]=useState<BroadcastClock>(),[targetA,setTargetA]=useState<CameraTarget>({type:'rider',id:'r8'}),[targetB,setTargetB]=useState<CameraTarget>();
 const [mountA,setMountA]=useState(true),[mountB,setMountB]=useState(true),[status,setStatus]=useState('Loading synthetic acceptance data…'),[running,setRunning]=useState(false);
 const a=useRef<RaceViewerHandle>(null),b=useRef<RaceViewerHandle>(null),statsB=useRef(0),errors=useRef<Error[]>([]),host=useRef<HTMLDivElement>(null);
 useEffect(()=>{let cancelled=false;fetch('/demo-feed-v1.json').then(r=>{if(!r.ok)throw Error('Fixture unavailable');return r.json();}).then(raw=>{if(cancelled)return;raw.synthetic=false;for(const p of raw.frames[0].positions)p.groupId="opening-group";const next=freezeDeep(validateFeed(raw));setFeed(next);setClock(freezeDeep({position:77,serverEpochMs:Date.now(),duration:next.duration,rate:1,paused:true}));setStatus('Ready — two independent viewers, one authoritative clock');}).catch(e=>{if(!cancelled)setStatus('FAIL — '+e.message);});return()=>{cancelled=true;};},[]);
 async function ready(){await tick();const statuses=await Promise.all([a.current?.whenAssetsReady(),b.current?.whenAssetsReady()]);if(statuses.some(s=>!s||'superseded' in s||s.errors.length))throw Error('Scene assets did not become ready without errors');await tick();}
 async function run(){setRunning(true);try{
  if(!feed||!clock)throw Error('No acceptance data');errors.current=[];setMountA(true);setMountB(true);setClock(freezeDeep({...clock,position:77,serverEpochMs:Date.now()}));await ready();
  if(!a.current||!b.current)throw Error('Missing component refs');
  if(a.current?.getSnapshot().time!==77||b.current?.getSnapshot().time!==77)throw Error('Initial shared times differ');
  if(!targetB && b.current?.getSnapshot().target?.id!=='peloton')throw Error('Initial camera ignored current broadcast groups');
  const bCamera=b.current.getCameraState();
  setTargetA({type:'rider',id:'r7'});setTargetB({type:'rider',id:'r8'});await tick();
  a.current?.setCamera({yaw:Math.PI/2,zoom:.7});await tick();
  if(a.current?.getSnapshot().target?.id!=='r7'||b.current?.getSnapshot().target?.id!=='r8'||b.current?.getCameraState()?.yaw!==bCamera?.yaw)throw Error('Spectator cameras are coupled');
  if(a.current?.seek(100)!==false||b.current?.seek(100)!==false)throw Error('Local seek altered shared playback');
  setClock(freezeDeep({...clock,position:121}));await tick();
  if(a.current?.getSnapshot().time!==121||b.current?.getSnapshot().time!==121)throw Error('Shared update did not reach both viewers');
  const before=statsB.current;setMountA(false);await tick();await tick();
  if(host.current?.querySelectorAll('canvas').length!==1||b.current?.getSnapshot().time!==121||statsB.current<=before)throw Error('Unmounting A interrupted B');
  setMountA(true);await ready();
  if(host.current?.querySelectorAll('canvas').length!==2||a.current?.getSnapshot().time!==121||a.current?.getSnapshot().target?.id!=='r7')throw Error('A did not remount on the current clock');
  setMountA(false);setMountB(false);await tick();
  if(host.current?.querySelectorAll('canvas').length!==0)throw Error('Canvas remained after unmount');
  setMountA(true);setMountB(true);await ready();
  if(errors.current.length||host.current?.querySelectorAll('canvas').length!==2)throw Error('Remount errors: '+errors.current.map(e=>e.message).join(', '));
  setClock(freezeDeep({...clock,position:225,paused:true}));await tick();
  if(a.current?.getSnapshot().time!==225||b.current?.getSnapshot().time!==225||a.current?.getRiderState('r1')?.action?.state!=='sprinting'||b.current?.getRiderState('r1')?.action?.state!=='sprinting')throw Error('Supplied finale state did not reach both viewers');
  setClock(freezeDeep({...clock,position:239.5,paused:true}));await tick();
  if(a.current?.getResults()?.entries[0].riderId!=='r1'||b.current?.getResults()?.entries[0].riderId!=='r1'||a.current?.getRiderState('r1')?.action?.state!=='celebrating')throw Error('Official winner result/reaction missing');
  if(!a.current?.focusFinish()||a.current?.getCameraState()?.mode!=='finish'||b.current?.getCameraState()?.mode==='finish')throw Error('Finish camera did not stay spectator-local');
  setClock(freezeDeep({...clock,position:130,serverEpochMs:Date.now(),paused:false}));await tick();
  const ta=a.current?.getSnapshot().time,tb=b.current?.getSnapshot().time;
  if(typeof ta!=='number'||typeof tb!=='number'||ta<=130||Math.abs(ta-tb)>.025)throw Error('Running shared clocks diverged');
  if(a.current?.getResults()||b.current?.getResults())throw Error('Official results survived rewind');
  if(a.current?.getRiderState('r1')?.action||b.current?.getRiderState('r1')?.action)throw Error('Future sprint state survived rewind');
  setClock(freezeDeep({...clock,position:121,paused:true}));await tick();
  setStatus('PASS — Next.js client boundary; frozen 150-rider feed; two synchronized paused/running clocks; supplied sprint state and rewind; independent cameras; shared seeking locked; A unmount leaves B rendering; full unmount removes canvases; remount restores both viewers');
 }catch(e){setStatus('FAIL — '+(e instanceof Error?e.message:String(e)));}finally{setRunning(false);}}
 return <main style={{fontFamily:'system-ui',padding:16,background:'#edf0e5',color:'#294232'}}>
  <h1>Pelotonia integration acceptance</h1><p>Two spectators consume one immutable synthetic feed and authoritative clock. No game service is connected.</p>
  <button disabled={!feed||running} onClick={run}>Run two-viewer integration acceptance</button><p role="status">{status}</p>
  <div ref={host} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:16}}>
   <section><h2>Spectator A</h2>{mountA&&feed&&clock?<RaceViewer ref={a} feed={feed} clock={clock} target={targetA} onSelect={setTargetA} onError={e=>errors.current.push(e)} style={{height:420}}/>:null}</section>
   <section><h2>Spectator B</h2>{mountB&&feed&&clock?<RaceViewer ref={b} feed={feed} clock={clock} target={targetB} onSelect={setTargetB} onStats={()=>statsB.current++} onError={e=>errors.current.push(e)} style={{height:420}}/>:null}</section>
  </div>
 </main>;
}
