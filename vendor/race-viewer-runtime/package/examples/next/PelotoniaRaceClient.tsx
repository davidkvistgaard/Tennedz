"use client";
import dynamic from "next/dynamic";
import type { BroadcastClock, ViewerFeed, CameraSafeArea } from "@pelotonia/race-viewer";
const RaceScene = dynamic(() => import("./PelotoniaRaceScene"), {
  ssr: false,
  loading: () => <p role="status">Loading race viewer…</p>,
});
export interface PelotoniaRaceClientProps {
  feed: ViewerFeed;
  clock: BroadcastClock;
  serverOffsetMs?: number;
  cameraSafeArea?: Partial<CameraSafeArea>;
}
/** Client-only boundary. The game owns feed loading, authoritative clock and reconnects. */
export default function PelotoniaRaceClient(props: PelotoniaRaceClientProps) {
  return <RaceScene {...props} />;
}
