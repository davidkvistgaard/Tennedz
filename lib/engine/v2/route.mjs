import seedrandom from 'seedrandom';
import {TUNING} from './tuning.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const SURFACES=new Set(['road','cobbles','gravel','dirt']);

function elevationAt(points,km){
  const next=points.findIndex(([position])=>position>=km);
  if(next<=0)return points[0][1];
  const [fromKm,fromM]=points[next-1],[toKm,toM]=points[next];
  return fromM+(toM-fromM)*(km-fromKm)/(toKm-fromKm);
}

function validWeather(weather){
  const values={temperatureC:Number(weather?.temp_c??15),windKph:Number(weather?.wind_kph??10),rainMm:Number(weather?.precipitation_mm??0)};
  if(Object.values(values).some(value=>!Number.isFinite(value))||values.windKph<0||values.rainMm<0)
    throw new Error('The locked race weather must contain finite, non-negative wind and rain.');
  return values;
}

export function buildKilometreRoute(stage,{seed,weather}={}){
  const distance=Number(stage?.distance_km);
  if(!Number.isInteger(distance)||distance<20||distance>400)throw new Error('A kilometre route needs an integer distance of 20–400 km.');
  const raw=stage.profile_points;
  if(!Array.isArray(raw)||raw.length<2)throw new Error('A kilometre route needs an elevation profile.');
  const points=raw.map(point=>[Number(point?.[0]),Number(point?.[1])]);
  if(points.some(([km,m])=>!Number.isFinite(km)||!Number.isFinite(m)||km<0||km>distance||m<0)
    ||points[0][0]!==0||points.at(-1)[0]!==distance
    ||points.some((point,index)=>index>0&&point[0]<=points[index-1][0]))
    throw new Error('Elevation points must run strictly from start to finish.');
  const segments=(stage.surface_segments??[]).map(segment=>({
    from:Number(segment.from_km),to:Number(segment.to_km),surface:segment.surface,
  }));
  if(segments.some(s=>!Number.isInteger(s.from)||!Number.isInteger(s.to)||s.from<0||s.to>distance||s.from>=s.to||!SURFACES.has(s.surface))
    ||segments.some((s,index)=>index>0&&s.from<segments[index-1].to))
    throw new Error('Surface segments must be sorted, valid and non-overlapping.');
  const locked=validWeather(weather);
  const tune=TUNING.weather;
  const rng=seedrandom(`route-v2:${String(seed??'default')}`);
  let temperature=locked.temperatureC,wind=locked.windKph,rain=locked.rainMm;
  const kilometres=[];
  for(let km=0;km<distance;km++){
    const startM=elevationAt(points,km),endM=elevationAt(points,km+1),gradientPct=(endM-startM)/10;
    // Small, bounded changes give adjacent kilometres related weather while
    // preserving the event's locked weather as the centre of the forecast.
    temperature=clamp(temperature+(rng()-.5)*tune.temperatureStep,locked.temperatureC-tune.temperatureRange,locked.temperatureC+tune.temperatureRange);
    wind=clamp(wind+(rng()-.5)*tune.windStep,Math.max(0,locked.windKph-tune.windRange),locked.windKph+tune.windRange);
    rain=clamp(rain+(rng()-.5)*tune.rainStep,Math.max(0,locked.rainMm-tune.rainRange),locked.rainMm+tune.rainRange);
    const surface=segments.find(s=>s.from<=km&&km<s.to)?.surface??'road';
    const terrain=gradientPct>=5?'climb':gradientPct>=1.5?'hill':gradientPct<=-2?'descent':'flat';
    kilometres.push({km:km+1,startM:+startM.toFixed(1),endM:+endM.toFixed(1),gradientPct:+gradientPct.toFixed(2),terrain,surface,
      weather:{temperatureC:+temperature.toFixed(1),windKph:+wind.toFixed(1),rainMm:+rain.toFixed(2)}});
  }
  return {version:2,distanceKm:distance,kilometres};
}
