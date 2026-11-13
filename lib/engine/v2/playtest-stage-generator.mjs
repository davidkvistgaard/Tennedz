import seedrandom from 'seedrandom';

export const GENERATED_STAGE_ANCHORS={40:6,120:9,260:13};

const STYLES={
  flat:{base:100,baseVariation:45,noise:30,gradeMin:0,gradeRange:0},
  rolling:{base:240,baseVariation:100,noise:45,
    gradeMin:15,gradeRange:18},
  mountain:{base:500,baseVariation:180,noise:70,
    gradeMin:65,gradeRange:18},
};

const PEAK_PATTERNS={
  6:[[2],[4],[1,4]],
  9:[[3],[6],[2,6],[1,4,7]],
  13:[[3,9],[2,6,11],[1,4,8,12],[2,4,7,9,12]],
};

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// The full profile is committed with the race. Old six-anchor recordings
// remain valid; longer generated routes use more anchors to vary climb count,
// location and duration without changing the recorded-road contract.
export function generatePlaytestStageProfile({distanceKm,style,seed}){
  const count=GENERATED_STAGE_ANCHORS[distanceKm];
  if(!count||!Object.hasOwn(STYLES,style)||
    typeof seed!=='string'||!seed)
    throw new Error('A supported distance, route style and seed are required.');
  const random=seedrandom(
    `playtest-generated-stage-v2:${seed}:${distanceKm}:${style}`);
  const {base,baseVariation,noise,gradeMin,gradeRange}=STYLES[style];
  const segmentKm=distanceKm/(count-1);
  const floor=base+(random()-.5)*baseVariation;
  const heights=Array.from({length:count},()=>Math.round(clamp(
    floor+(random()-.5)*noise,0,2500)));
  if(style==='flat')return heights;

  const patterns=PEAK_PATTERNS[count];
  const pattern=patterns[Math.floor(random()*patterns.length)];
  let previous=-2;
  for(let index=0;index<pattern.length;index++){
    const remaining=pattern.length-index-1;
    const centre=pattern[index];
    const peak=clamp(centre+Math.floor(random()*3)-1,
      previous+2,count-1-remaining*2);
    previous=peak;
    const rise=segmentKm*(gradeMin+random()*gradeRange);
    const shoulder=style==='mountain'?.03+random()*.15:
      .12+random()*.28;
    heights[peak]=Math.round(clamp(floor+rise,0,2500));
    for(const neighbour of [peak-1,peak+1]){
      if(neighbour<0||neighbour>=count)continue;
      heights[neighbour]=Math.max(heights[neighbour],
        Math.round(clamp(floor+rise*shoulder,0,2500)));
    }
  }
  return heights;
}
