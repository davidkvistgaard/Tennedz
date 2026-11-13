"use client";
import {useState,useSyncExternalStore} from 'react';
import {RaceViewer,type RaceSession,type ActiveRaceSession,type CameraTarget,type CameraSafeArea} from '@pelotonia/race-viewer';
/** Mount through the same client-only boundary as PelotoniaRaceClient.tsx.
 * Session owner calls open/updateClock; each spectator owns only their own target. */
export function RaceSessionScene({session,cameraSafeArea}:{session:RaceSession;cameraSafeArea?:Partial<CameraSafeArea>}){
 const state=useSyncExternalStore(session.subscribe,session.getSnapshot,session.getSnapshot);
 return <section>
  {state.status==='loading'&&<p role="status">Loading race…</p>}
  {state.active&&state.active.connection.status!=="unknown"&&<p role="status">Broadcast: {state.active.connection.status}{state.active.connection.message?` · ${state.active.connection.message}`:""}</p>}
  {state.error&&<p role="alert">Could not load the requested race: {state.error.message} <button onClick={()=>session.retry()}>Retry race load</button></p>}
  {state.active?<Spectator key={state.active.raceId} active={state.active} cameraSafeArea={cameraSafeArea}/>:state.status==='idle'?<p>Select a race.</p>:null}
 </section>;
}
function Spectator({active,cameraSafeArea}:{active:ActiveRaceSession;cameraSafeArea?:Partial<CameraSafeArea>}){
 const [target,setTarget]=useState<CameraTarget|undefined>(),[error,setError]=useState<Error|null>(null);
 return <>{error&&<p role="alert">Viewer: {error.message}</p>}<RaceViewer cameraSafeArea={cameraSafeArea} feed={active.feed} clock={active.clock} serverOffsetMs={active.serverOffsetMs} target={target} onSelect={setTarget} onError={setError} style={{height:'70vh'}}/></>;
}
