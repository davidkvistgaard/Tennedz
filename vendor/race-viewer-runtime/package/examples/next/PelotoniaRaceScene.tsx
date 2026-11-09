"use client";
import { useState } from "react";
import { RaceViewer, Commentary, type CameraTarget } from "@pelotonia/race-viewer";
import type { PelotoniaRaceClientProps } from "./PelotoniaRaceClient";
export default function PelotoniaRaceScene(props: PelotoniaRaceClientProps) {
  // Omitting the initial target lets the viewer choose a supplied group ID.
  const [target, setTarget] = useState<CameraTarget>();
  const [error, setError] = useState<Error | null>(null);
  const [time, setTime] = useState(0);
  const [renderer, setRenderer] = useState("Loading");
  return <section aria-label="Race broadcast">
    <p role="status">Renderer: {renderer}</p>
    {error ? <p role="alert">Viewer update rejected: {error.message}</p> : null}
    <RaceViewer {...props} target={target} onSelect={setTarget}
      onError={setError} onStats={stats => {setRenderer(stats.renderer);setTime(stats.time);}}
      style={{height:"65vh", minHeight:360}} />
    <Commentary feed={props.feed} time={time} onFollow={setTarget}/>
  </section>;
}
