export const POINT_POLICY_VERSION='v0.1';
export const TIER_WINNER_POINTS=Object.freeze({1:60,2:125,3:250,4:400,5:650,6:1000});
export const PLACING_PERCENT=Object.freeze([100,75,60,50,42,36,31,27,23,20,17,14,12,10,8,7,6,5,4,3]);
export const STAGE_POINTS=Object.freeze({
  1:{stage:[10,7,5,4,3],classification:[20,14,10,7,5]},
  2:{stage:[20,14,10,8,6],classification:[40,28,20,14,10]},
  3:{stage:[40,28,20,16,12],classification:[75,53,38,26,19]},
  4:{stage:[65,45,33,26,22],classification:[110,77,55,39,28]},
  5:{stage:[100,70,50,40,33],classification:[175,123,88,61,44]},
  6:{stage:[150,100,75,60,50,40,32,25,20,15],classification:[300,210,150,105,75]},
});

export function pointsForResult({tier,resultType,placing}){
  if(!Number.isInteger(tier)||!TIER_WINNER_POINTS[tier]||
    !Number.isInteger(placing)||placing<1)throw new Error('Invalid race tier or placing.');
  if(resultType==='ONE_DAY'||resultType==='GC')
    return Math.round(TIER_WINNER_POINTS[tier]*(PLACING_PERCENT[placing-1]??0)/100);
  if(resultType==='STAGE')return STAGE_POINTS[tier].stage[placing-1]??0;
  if(['POINTS_CLASSIFICATION','KOM'].includes(resultType))
    return STAGE_POINTS[tier].classification[placing-1]??0;
  if(resultType==='YOUTH')return 0;
  throw new Error('Invalid result type.');
}

export function pointsForDivisionResult({tier,resultType,placing,multiplier}){
  if(!Number.isFinite(multiplier)||multiplier<=0||multiplier>1)
    throw new Error('Invalid division multiplier.');
  return Math.round(pointsForResult({tier,resultType,placing})*multiplier);
}

export function rankingIncludes(award,{gender,source,format,seasonYear}={}){
  return (gender===undefined||award.gender===gender)&&
    (source===undefined||award.calendar_source===source)&&
    (format===undefined||award.event_format===format)&&
    (seasonYear===undefined||award.season_year===seasonYear);
}

export function aggregateRanking(awards,{entity='rider',...filters}={}){
  if(!['rider','team'].includes(entity))throw new Error('Choose a rider or team ranking.');
  const key=entity==='rider'?'rider_id':'team_id',totals=new Map();
  for(const award of awards){
    if(!rankingIncludes(award,filters))continue;
    totals.set(award[key],(totals.get(award[key])??0)+award.points);
  }
  return [...totals].map(([id,points])=>({id,points}))
    .sort((a,b)=>b.points-a.points||a.id.localeCompare(b.id));
}
