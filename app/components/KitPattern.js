import { KIT_PATTERNS } from "../../lib/riders/club-kit.mjs";
export default function KitPattern({ pattern, color }) {
  return <g fill={color}>{(KIT_PATTERNS[pattern]?.paths || []).map((d,i)=><path key={i} d={d}/>)}</g>;
}
