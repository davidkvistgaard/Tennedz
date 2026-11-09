/** Display contract, independent of the race engine. All coordinates in metres. */
export type Vec3 = [number, number, number];
export type HexColor = `#${string}`;
export interface JerseyDesign {
  id: string;
  name: string;
  color: HexColor;
  accent: HexColor;
  pattern: "band" | "chevron" | "stripe" | "polka" | "paths";
  paths?: string[];
  sponsor?: string;
  textureUrl?: string;
}
export interface Team extends JerseyDesign {
  short?: string;
}
export interface HelmetDesign {
  id: string;
  name: string;
  color: HexColor;
}
export type RiderCategory = "men" | "women";
export type GroupRole = "leaders" | "chase" | "peloton" | "dropped";
export interface Rider {
  hairStyle?: "none" | "short" | "tied";
  hairColor?: HexColor;
  id: string;
  name: string;
  number: number;
  teamId: string;
  /** Design ID supplied by engine. No classification is computed here. */
  jersey?: string | null;
  helmet?: string | null;
}
export interface PositionSample {
  riderId: string;
  distance: number;
  lateral: number;
  groupId: string;
  cadence?: number;
  /** Sampler-generated continuous crank angle, radians. Source cadence may be zero. */
  pedalAngle?: number;
  /** Filled by the sampler from producer-authored intervals. */
  order?: RiderOrder | null;
  action?: RiderAction | null;
}
export interface Frame {
  /** Optional source-authored broadcast roles, keyed by unchanged group ID. */
  groupRoles?: Record<string, GroupRole>;
  time: number;
  positions: PositionSample[];
  /** Precomputed gap in seconds, keyed by group ID. */
  gaps?: Record<string, number>;
}
export interface RaceEvent {
  time: number;
  label: string;
  type?: string;
  riderId?: string;
  groupId?: string;
}
/** Intervals use viewer time in seconds and are half-open: start <= t < end. */
export interface RiderOrder {
  id: string;
  riderId: string;
  start: number;
  end: number;
  type:
    | "attack"
    | "pull"
    | "follow"
    | "protect"
    | "bridge"
    | "sprint"
    | "recover"
    | "hold";
  label?: string;
  targetRiderId?: string;
  targetGroupId?: string;
}
export interface RiderAction {
  id: string;
  riderId: string;
  start: number;
  end: number;
  state:
    | "riding"
    | "attacking"
    | "pulling"
    | "dropped"
    | "caught"
    | "protecting"
    | "following"
    | "bridging"
    | "sprinting"
    | "recovering"
    | "celebrating"
    | "throwing";
  /** Optional on celebrating actions; default both-arms. */
  /** Optional release in seconds, 0 holds until end; max min(5, duration). */
  transitionOut?: number;
  celebrationStyle?: "both-arms" | "left-arm" | "right-arm";
  label?: string;
  effort?: number;
  posture?: "seated" | "standing";
  targetRiderId?: string;
  targetGroupId?: string;
}
export interface Heightfield {
  origin: [number, number];
  step: [number, number];
  columns: number;
  rows: number;
  /** Row major, X varies fastest; values are Y elevation in metres. */
  heights: number[];
  textureUrl?: string;
}
export interface Landmark {
  id: string;
  type: "house" | "farm" | "tree" | "pine" | "rock" | "grass" | string;
  position: Vec3;
  assetId?: string;
  rotation?: number;
  scale?: number;
}
export interface RaceResultEntry {
  riderId: string;
  status: "finished" | "dnf" | "dns" | "dsq";
  /** Producer-assigned; required only for finished riders. */
  rank?: number;
  elapsed?: number;
  gap?: number;
}
export interface RaceResults {
  publishedAt: number;
  /** May be partial (for example a confirmed podium). */
  entries: RaceResultEntry[];
}
export interface RouteProfileData {
  schemaVersion: "pelotonia.route-profile.v1";
  /** Source-authored [distance,elevation] in metres, increasing distance; may cover the full stage. */
  samples: Array<[number,number]>;
  /** Full-stage distance = recorded local rider distance + positionOffset. */
  positionOffset?: number;
  startName?: string;
  finishName?: string;
  markers?: Array<{id:string;name:string;distance:number;type:"climb"|"sprint"|"place";category?:"HC"|"1"|"2"|"3"|"4"}>;
}
export type RoadSurface = "asphalt" | "gravel" | "cobbles" | "dirt";
export interface WeatherFrame { time:number; condition:"sun"|"overcast"|"rain"|"sleet"; intensity?:number; /** World X/Z metres per second, visual only. */ wind?:[number,number]; }
export interface CrashParticipant { riderId:string; fallAt:number; side:-1|1; fallDuration?:number; downUntil?:number; recoveredAt?:number; causedByRiderId?:string; }
/** Every victim and source trajectory must be supplied; no collision propagation is calculated. */
export interface CrashIncident {id:string;type:"single"|"mass";start:number;end:number;riders:CrashParticipant[];}
export interface CrashPose {incidentId:string;type:"single"|"mass";causedByRiderId:string|null;fallAt:number;side:-1|1;amount:number;phase:"falling"|"down"|"remounting";}
export interface CrowdSettings { enabled?:boolean; seed?:number; backgroundSpacing?:number; autoFinish?:boolean; zones?:Array<{id:string;from:number;to:number;kind:"normal"|"town"|"climb"|"iconic"|"finish";rows?:number;spacing?:number;side?:-1|1|"both";barriers?:boolean;rowRise?:number}>; }
export interface ViewerFeed {
  weather?:WeatherFrame[];
  incidents?:CrashIncident[];
  crowd?:CrowdSettings;
  /** Single-category field; legacy feeds without this field use men. */
  riderCategory?: RiderCategory;
  /** Optional source-positioned event spectators; no automatic world placement. */
  spectators?: Array<{position:Vec3;rotation?:number;color?:HexColor;skinColor?:HexColor;scale?:number;pose?:"standing"|"clapping"|"cheering"}>;
  results?: RaceResults;
  schemaVersion: "pelotonia.viewer.v1";
  raceId: string;
  title?: string;
  synthetic?: boolean;
  duration: number;
  route: {
    surfaces?:Array<{from:number;to:number;type:RoadSurface;textureUrl?:string;barriers?:boolean}>;
    profile?: RouteProfileData;
    label?: string;
    points: Vec3[];
    width: number;
    interpolation?: "polyline" | "catmull-rom";
    distanceStations?: number[];
    textureUrl?: string;
    barriers?: Array<{ from: number; to: number; side: 1 | -1 }>;
  };
  /** Event kit anchored to source route distance, independent of terrain/atlas origin. */
  finish?: {
    /** 0 = source route start, 1 = source route end; includes distanceStations mapping. */
    routeFraction: number;
    label?: string; color?: HexColor; accent?: HexColor;
    roadText?: string;
    markers?: Array<{distanceBefore:number;label?:string}>;
    barrierBefore?: number; barrierAfter?: number;
    portalHeight?: number;
    /** False when the supplied venue already includes its own gantry. */
    portal?: boolean;
    /** Optional static glTF, authored with ground-level origin, Y up and Z forward. */
    portalAssetId?: string; portalScale?: number;
  };
  terrain?: Heightfield;
  waterBodies?: Array<{
    id: string;
    label?: string;
    color?: HexColor;
    outline: Vec3[];
  }>;
  landmarks?: Landmark[];
  assets?: Array<
    | {
        id: string;
        type: "foliage-card";
        textureUrl: string;
        width: number;
        height: number;
      }
    | { id: string; type: "gltf"; url: string }
  >;
  teams: Team[];
  jerseys?: JerseyDesign[];
  helmets?: HelmetDesign[];
  riders: Rider[];
  frames: Frame[];
  events?: RaceEvent[];
  orders?: RiderOrder[];
  actions?: RiderAction[];
}
export interface BroadcastClock {
  position: number;
  serverEpochMs: number;
  rate: number;
  paused: boolean;
  duration: number;
}
export interface CameraTarget {
  type: "rider" | "group";
  id: string;
}
