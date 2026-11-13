"use client";
import dynamic from 'next/dynamic';
import type {RaceSession,CameraSafeArea} from '@pelotonia/race-viewer';
const Scene=dynamic(()=>import('./RaceSessionScene').then(m=>m.RaceSessionScene),{ssr:false,loading:()=><p role="status">Loading race viewer…</p>});
/** Pass a session owned by a client component; do not serialize it from a server component. */
export default function RaceSessionClient({session,cameraSafeArea}:{session:RaceSession;cameraSafeArea?:Partial<CameraSafeArea>}){return <Scene session={session} cameraSafeArea={cameraSafeArea}/>}
