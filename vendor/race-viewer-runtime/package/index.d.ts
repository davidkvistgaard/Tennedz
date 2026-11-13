import type {
  CSSProperties,
  ForwardRefExoticComponent,
  RefAttributes,
} from "react";
import type { ViewerFeed, BroadcastClock, CameraTarget } from "./contract";
export type * from "./contract";
/** Display-only fields derived from source frames; not extra feed requirements. */
export type SampledPosition = import("./contract").PositionSample & { crash: import("./contract").CrashPose | null; displaySpeed: number; displayVelocity: {along:number;across:number}; pedalAngle: number; actionTransition: {previous: import("./contract").RiderAction | null; next: import("./contract").RiderAction | null} | null };
export interface AssetStatus {
  pending: number;
  loaded: number;
  errors: Array<{ assetId: string; message: string }>;
}
export interface FrameDistribution { samples: number; p50: number | null; p95: number | null; max: number | null; }
/** Source riders outside the supplied display geometry are retained as data, not drawn. */
export interface RouteCoverage {
  time: number;
  routeLength: number;
  availableRiderCount: number;
  beforeStartRiderIds: string[];
  afterEndRiderIds: string[];
}
/** Bounded CPU submission diagnostics, not GPU execution times or hardware approval. */
export interface ViewerDiagnostics {
  weather: import("./contract").WeatherFrame & {intensity:number;wind:[number,number]};
  crashedRiders:string[];
  crowdCount:number;
  riderCategory: import("./contract").RiderCategory;
  viewerVersion: string;
  /** Monotonic within a scene; terminal asset changes wake paused rendering. */
  assetContentRevision: number;
  /** Last rendered sample; null before the first render of a replacement feed. */
  routeCoverage: RouteCoverage | null;
  renderer: "WebGL" | "Compatibility";
  contextLost: boolean;
  renderFault: boolean;
  cameraSettled: boolean;
  renderedFrames: number;
  skippedFrames: number;
  cpuFrameMs: FrameDistribution;
  samplingMs: FrameDistribution;
  rigMs: FrameDistribution;
  drawSubmissionMs: FrameDistribution;
  errors: Array<{kind: string; message: string}>;
  resources: {geometries:number;textures:number;programs:number;drawCalls:number;triangles:number} | null;
  caches: {riderBytes:number;staticSpriteBytes:number;terrainDetailBytes:number;terrainCellCount:number;terrainCenterCount:number} | null;
}
export interface ViewerStats {
  weather: import("./contract").WeatherFrame & {intensity:number;wind:[number,number]};
  crowdCount:number;
  incidentCount:number;
  surface:import("./contract").RoadSurface;
  time: number;
  targetAvailable: boolean;
  camera: CameraState;
  playing: boolean;
  fps: number;
  renderer: "WebGL" | "Compatibility";
  visible: number;
  shared: boolean;
  cpuMs: number | null;
  drawCalls: number | null;
  distance: number;
  routeLength: number;
  routeCoverage: RouteCoverage;
  /** Leader distance to supplied finish; independent of camera selection. */
  finishRemaining: number | null;
  position: number | null;
  assetStatus: AssetStatus;
  gaps: Record<string, number> | undefined;
  events: import("./contract").RaceEvent[];
  results: import("./contract").RaceResults | null;
  [key: string]: unknown;
}
export interface RaceViewerProps {
  feed: ViewerFeed;
  /** Omit for local click-to-follow. Supply a target to keep selection host-controlled. */
  target?: CameraTarget;
  clock?: BroadcastClock | null;
  serverOffsetMs?: number;
  /** Fractions of the scene viewport reserved for host UI, not pixels. */
  cameraSafeArea?: Partial<CameraSafeArea>;
  onSelect?: (target: CameraTarget) => void;
  onStats?: (stats: ViewerStats) => void;
  onError?: (error: Error) => void;
  className?: string;
  style?: CSSProperties;
}
export interface CameraSafeArea {top:number;right:number;bottom:number;left:number;}
export interface CameraSettings {
  safeArea?: Partial<CameraSafeArea>;
  yaw: number;
  zoom: number;
  mode: "follow" | "overview" | "finish";
}
export interface CameraState extends CameraSettings {
  safeArea: CameraSafeArea;
  elevationDegrees: number;
  renderedYaw: number;
  renderedScale: number;
  /** Rendered camera geometry; copies, absent before scene construction. */
  position?: import("./contract").Vec3;
  focus?: import("./contract").Vec3;
  aspect?: number;
  verticalFovDegrees?: number;
  fittedScale?: number;
}
export interface RaceViewerHandle {
  /** Append reached recording frames without rebuilding the 3D scene. */
  appendRecordedFrames(frames: ViewerFeed["frames"]): number | undefined;
  getCameraState(): CameraState | undefined;
  setCamera(settings: Partial<CameraSettings>): CameraState | undefined;
  orbit(radians: number): CameraState | undefined;
  setZoom(zoom: number): CameraState | undefined;
  focusFinish(): boolean | undefined;
  resetCamera(): CameraState | undefined;
  pause(value: boolean): boolean | undefined;
  seek(seconds: number): boolean | undefined;
  speed(rate: number): boolean | undefined;
  follow(target: CameraTarget): void;
  getResults(): import("./contract").RaceResults | null | undefined;
  getRiderState(
    riderId: string,
  ): SampledPosition | null | undefined;
  getSnapshot(): {
    raceId?: string;
    results: import("./contract").RaceResults | null;
    camera?: CameraState;
    time: number | undefined;
    target: CameraTarget | undefined;
    targetAvailable: boolean | undefined;
    routeCoverage?: RouteCoverage;
  };
  setLight(value: "day" | "evening"): void;
  whenAssetsReady(): Promise<AssetStatus | { superseded: true }> | undefined;
  getAssetStatus(): AssetStatus | undefined;
  getDiagnostics(): ViewerDiagnostics | undefined;
}
export const RaceViewer: ForwardRefExoticComponent<
  RaceViewerProps & RefAttributes<RaceViewerHandle>
>;
export const SCHEMA: "pelotonia.viewer.v1";
export function validateFeed(input: unknown): ViewerFeed;
export function validateClock(input: unknown): BroadcastClock;
export function broadcastTime(clock: BroadcastClock, nowMs?: number): number;
export function createSampler(feed: ViewerFeed): (time: number) => {
  time: number;
  positions: SampledPosition[];
  groupRoles: Record<string, import("./contract").GroupRole>;
  gaps: Record<string, number> | undefined;
  events: import("./contract").RaceEvent[];
  results: import("./contract").RaceResults | null;
};
export function appearanceFor(
  feed: ViewerFeed,
  rider: ViewerFeed["riders"][number],
): unknown;
export function adaptPhysicalFinale(input: unknown): ViewerFeed;
export function adaptAtlasLineString(
  input: unknown,
  options: {
    originKm: [number, number];
    elevationsM: number[];
    width: number;
    chainagesM?: number[];
  },
): ViewerFeed["route"];
export function adaptClubIdentity(
  team: { id: string; name: string; short?: string; sponsor?: string },
  identity: unknown,
  catalog: unknown,
): import("./contract").Team;
export function decodeViewerImport(input: unknown): ViewerFeed;

export const ACTION_STATES: readonly string[];
export const ORDER_TYPES: readonly string[];
export function activityLabel(value: string): string;

export function resultsAt(feed: ViewerFeed, time: number): import("./contract").RaceResults | null;

export interface RaceSessionPayload {
  feed: ViewerFeed;
  clock: BroadcastClock;
  revision?: number;
  serverOffsetMs?: number;
}
export interface ActiveRaceSession {
  readonly connection: Readonly<{status:"unknown"|"connected"|"reconnecting"|"offline";message?:string}>;
  readonly raceId: string;
  readonly feed: ViewerFeed;
  readonly clock: Readonly<BroadcastClock>;
  readonly revision: number;
  readonly serverOffsetMs: number;
}
export interface RaceSessionState {
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly active: ActiveRaceSession | null;
  readonly error: Error | null;
  readonly requestedRaceId: string | null;
  readonly pendingRaceId: string | null;
}
export interface RaceSession {
  getSnapshot(): RaceSessionState;
  subscribe(listener: () => void): () => void;
  open(raceId: string): Promise<boolean>;
  retry(): Promise<boolean>;
  updateClock(update: {raceId: string; clock: BroadcastClock; revision: number; serverOffsetMs?: number}): boolean;
  setConnection(update:{raceId:string;status:"unknown"|"connected"|"reconnecting"|"offline";message?:string}):boolean;
  close(): void;
  dispose(): void;
}
export function createRaceSession(options: {onListenerError?:(error:unknown)=>void;load: (raceId: string, options: {signal: AbortSignal}) => Promise<RaceSessionPayload>}): RaceSession;
export function collectAssetReferences(feed: ViewerFeed): Array<{owner: string; url: string}>;
export function resolveFeedAssetUrls(feed: ViewerFeed, baseUrl: string): ViewerFeed;
export class RaceLoadError extends Error {constructor(code:string,message:string);code: string;}
export function createRaceExportLoader(options:{urlForRace:(raceId:string)=>string;fetchImpl?:typeof fetch;requestInit?:RequestInit;resolveAssets?:boolean;maxBytes?:number;timeoutMs?:number}):(raceId:string,options?:{signal?:AbortSignal})=>Promise<RaceSessionPayload>;
export interface ViewerFeedReport {valid:boolean;errors:string[];summary:null|{raceId:string;riderCategory:import("./contract").RiderCategory;duration:number;riderCount:number;teamCount:number;routePointCount:number;frameCount:number;assetReferenceCount:number;uniqueAssetCount:number;relativeAssetCount:number;missingRiderSamples:number;hasTerrain:boolean;hasFinish:boolean;hasOfficialResults:boolean};assets:Array<{owner:string;url:string}>;}
export function inspectViewerFeed(value:unknown):ViewerFeedReport;

export function FeedPreflight(props:{feed:unknown}):import("react").ReactElement;

/** Version of the installed rendering package. */
export const VIEWER_VERSION: string;

export interface BroadcastGroup {id:string;count:number;frontDistance:number;}
export function raceGroups(positions: Array<Pick<import("./contract").PositionSample,"groupId"|"distance">>): BroadcastGroup[];
export function labelRaceGroups(groups:BroadcastGroup[],roles?:Record<string,import("./contract").GroupRole>): Array<BroadcastGroup & {role:import("./contract").GroupRole;label:string}>;
export function formatFinishDistance(metres:number|null|undefined): {value:string;unit:"km"|"m"};
export function finishRemaining(positions:Array<{distance:number}>,routeLength:number,finish?:{routeFraction:number}): number|null;

export interface RouteProfileProps {feed:ViewerFeed;time?:number;className?:string;style?:CSSProperties;}
/** Import @pelotonia/race-viewer/profile.css once in the host layout. */
export function RouteProfile(props:RouteProfileProps): import("react").ReactElement;

export declare function surfaceAt(route:ViewerFeed["route"],distance:number):import("./contract").RoadSurface;
export declare function weatherAt(feed:ViewerFeed,time:number):import("./contract").WeatherFrame & {intensity:number;wind:[number,number]};

export interface CommentaryEntry { id:string; time:number; text:string; riderId?:string; event?:import("./contract").RaceEvent; index?:number; }
export function buildCommentary(feed:ViewerFeed):CommentaryEntry[];
export function commentaryAt(feed:ViewerFeed,time:number,entries?:CommentaryEntry[]):CommentaryEntry[];
/** Import @pelotonia/race-viewer/commentary.css in the host layout. */
export function Commentary(props:{feed:ViewerFeed;time:number;onFollow?:(target:CameraTarget)=>void}):import("react").ReactElement;
