"use client";
import{useEffect,useRef,useState,useSyncExternalStore}from'react';
import{VIEWER_VERSION,RaceViewer,FeedPreflight,createRaceSession,createRaceExportLoader,type RaceViewerHandle,type CameraSafeArea,type CameraTarget}from'@pelotonia/race-viewer';
const PREVIEW_AREA={top:.15};
const tick=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
/** Synthetic package acceptance; host authentication/transport remains external. */
export default function SessionAcceptanceHarness(){
 const failNext=useRef(false),a=useRef<RaceViewerHandle>(null),b=useRef<RaceViewerHandle>(null),host=useRef<HTMLDivElement>(null);
 const[previewArea,setPreviewArea]=useState<Partial<CameraSafeArea>|undefined>(PREVIEW_AREA),[previewTarget,setPreviewTarget]=useState<CameraTarget|undefined>(),configErrors=useRef<Error[]>([]);
 const[session]=useState(()=>createRaceSession({load:createRaceExportLoader({urlForRace:id=>new URL(`/exports/${encodeURIComponent(id)}/export.json`,location.origin).href,fetchImpl:async(input,init)=>{if(failNext.current){failNext.current=false;return new Response('Synthetic outage',{status:503})}return fetch(input,init)}})}));
 const state=useSyncExternalStore(session.subscribe,session.getSnapshot,session.getSnapshot),[status,setStatus]=useState('Ready'),[running,setRunning]=useState(false);
 useEffect(()=>()=>session.close(),[session]);
 async function ready(){const raceId=session.getSnapshot().active?.raceId;for(let i=0;i<60&&(!a.current||!b.current||a.current.getSnapshot().raceId!==raceId||b.current.getSnapshot().raceId!==raceId);i++)await tick();if(!a.current||!b.current||a.current.getSnapshot().raceId!==raceId||b.current.getSnapshot().raceId!==raceId)throw Error('Missing current-race spectators');const assets=await Promise.all([a.current.whenAssetsReady(),b.current.whenAssetsReady()]);if(assets.some(s=>!s||'superseded'in s||s.errors.length))throw Error('Asset readiness failed');await tick();}
 async function run(){setRunning(true);try{
  setStatus('Loading export A');if(!await session.open('A'))throw Error('Export A rejected');await ready();
  for(const viewer of [a.current!,b.current!]){const d=viewer.getDiagnostics();if(!d||d.viewerVersion!==VIEWER_VERSION||d.riderCategory!=='men'||d.renderedFrames<1||d.renderFault||d.errors.length)throw Error("Installed renderer diagnostics failed");}
  const camera=a.current!.getCameraState();
  if(!camera?.position?.every(Number.isFinite)||!camera.focus?.every(Number.isFinite)||!camera.aspect||!camera.verticalFovDegrees||!camera.fittedScale)throw Error("Rendered camera geometry missing");
  const canvas=host.current!.querySelector('canvas'),time=a.current!.getSnapshot().time,oldTarget=a.current!.getSnapshot().target;
  configErrors.current=[];setPreviewTarget({type:'rider',id:''});await tick();
  if(Number(configErrors.current.length)!==1||a.current!.getSnapshot().target?.id!==oldTarget?.id||host.current!.querySelector('canvas')!==canvas)throw Error('Invalid target destroyed the live viewer');
  setPreviewTarget({type:'rider',id:'r1'});await tick();
  if(a.current!.getCameraState()?.safeArea.top!==.15||b.current!.getCameraState()?.safeArea.top!==0)throw Error('Host layout not isolated');
  setPreviewArea(undefined);await tick();if(a.current!.getCameraState()?.safeArea.top!==0||host.current!.querySelector('canvas')!==canvas)throw Error('Layout removal rebuilt the scene');
  setPreviewArea(PREVIEW_AREA);await tick();setPreviewArea({top:2});await tick();
  if(Number(configErrors.current.length)!==2||a.current!.getCameraState()?.safeArea.top!==.15||host.current!.querySelector('canvas')!==canvas||a.current!.getSnapshot().time!==time)throw Error('Invalid layout changed the previous valid viewer');
  setPreviewArea(PREVIEW_AREA);await tick();
  if(!a.current!.getDiagnostics()?.errors.some(e=>e.kind==='error-subscriber'))throw Error('Host callback error not recorded');
  const coverage=a.current!.getSnapshot().routeCoverage;
  if(!coverage||coverage.availableRiderCount!==150||coverage.beforeStartRiderIds.length||coverage.afterEndRiderIds.length)throw Error("Display route coverage metadata missing");
  const transition=a.current!.getRiderState("r1")?.actionTransition;
  if(transition?.previous?.state!=="sprinting"||transition.next!==null)throw Error("Source action transition metadata missing");
  const motion=a.current!.getRiderState("r1")?.displayVelocity;if(!motion||!Object.values(motion).every(Number.isFinite))throw Error("Source velocity metadata missing");
  const active=session.getSnapshot().active!;if(active.feed.riders.length!==150||!active.feed.assets?.some(x=>x.type==='gltf'&&x.url===new URL('/assets/finish-import-v1.glb',location.origin).href))throw Error('Relative model URL not resolved');
  a.current!.follow({type:'rider',id:'r1'});b.current!.follow({type:'rider',id:'r8'});a.current!.focusFinish();
  session.updateClock({raceId:'A',revision:2,clock:{...active.clock,position:225}});await tick();
  if(a.current!.getSnapshot().time!==225||b.current!.getSnapshot().time!==225||a.current!.getResults()||a.current!.getRiderState('r1')?.action?.state!=='sprinting')throw Error('Shared rewind failed');
  if(session.updateClock({raceId:'A',revision:1,clock:{...active.clock,position:0}}))throw Error('Old clock accepted');
  session.setConnection({raceId:'A',status:'reconnecting'});if(a.current!.getCameraState()?.mode!=='finish'||b.current!.getCameraState()?.mode==='finish'||session.getSnapshot().active?.clock.position!==225)throw Error('Connection changed camera or time');
  const canvases=[...host.current!.querySelectorAll('canvas')];failNext.current=true;setStatus('Testing failed race switch');if(await session.open('B')||session.getSnapshot().active?.raceId!=='A')throw Error('Failed replacement lost A');await tick();if(canvases.some((c,i)=>host.current!.querySelectorAll('canvas')[i]!==c))throw Error('Failure rebuilt the visible race');
  if(!await session.retry()||session.getSnapshot().active?.raceId!=='B')throw Error('Retry did not load B');await ready();for(const viewer of [a.current!,b.current!])if(viewer.getDiagnostics()?.riderCategory!=='women')throw Error('Women export selected wrong model');if(session.updateClock({raceId:'A',revision:99,clock:active.clock}))throw Error('Previous race clock accepted');
  session.close();await tick();if(host.current!.querySelectorAll('canvas').length)throw Error('Closed session retained canvas');if(!await session.open('A'))throw Error('Reopen failed');await ready();a.current!.follow({type:'rider',id:'r1'});a.current!.focusFinish();
  if(a.current!.getDiagnostics()?.riderCategory!=='men')throw Error('Reopen retained women model');
  if(a.current!.getResults()?.entries[0].riderId!=='r1')throw Error('Winner result missing');
  setStatus('PASS — installed package; two 150-rider spectators; HTTP export loading; relative GLB; ordered shared clock; rewind; independent camera; men/women source switch; failed switch retention; explicit retry; close and reopen');
 }catch(e){setStatus('FAIL — '+(e instanceof Error?e.message:String(e)))}finally{setRunning(false)}}
 return <main style={{fontFamily:'system-ui',background:'#edf0e5',color:'#294232',padding:16}}><h1>Game integration acceptance · 150 riders · {VIEWER_VERSION}</h1><p>Isolated synthetic exports. No game engine, account or database is connected.</p><button disabled={running} onClick={run}>Run installed-package acceptance</button><p role="status">{status}</p><p>{state.status} · {state.active?.raceId} · connection {state.active?.connection.status}</p>{state.active&&<FeedPreflight feed={state.active.feed}/>}<div ref={host} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:12}}>{state.active&&<><RaceViewer ref={a} target={previewTarget} cameraSafeArea={previewArea} onError={e=>{configErrors.current.push(e);throw Error('Synthetic host error subscriber')}} feed={state.active.feed} clock={state.active.clock} serverOffsetMs={state.active.serverOffsetMs} style={{height:420}}/><RaceViewer ref={b} feed={state.active.feed} clock={state.active.clock} serverOffsetMs={state.active.serverOffsetMs} style={{height:420}}/></>}</div></main>;
}
