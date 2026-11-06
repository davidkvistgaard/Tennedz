'use client';
import dynamic from 'next/dynamic';
const Scene=dynamic(()=>import(
  '../../team/motor-lab/viewer-preview/ViewerPreviewScene'),{ssr:false});

export default function InspectionClient({feed,coverage,version,boundary}){
  const clock={position:boundary,serverEpochMs:0,rate:0,
    paused:true,duration:feed.duration};
  return <main className="motor-viewer-preview">
    <h1>Recorded race boundary inspection</h1>
    <p>Development-only paused inspection of actual Motor Lab output at
      {boundary===0?' start':boundary===feed.duration?' finish':' midrace'}.
      The broadcast preview uses its separate shared clock.</p>
    <Scene feed={feed} coverage={coverage} version={version}
      clock={clock} serverOffsetMs={0}/>
  </main>;
}
