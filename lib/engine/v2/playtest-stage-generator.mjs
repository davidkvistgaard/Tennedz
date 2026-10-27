import seedrandom from 'seedrandom';

const STYLES={
  flat:{base:100,rise:35,shape:[0,.3,-.15,.4,.1,0]},
  rolling:{base:240,rise:190,shape:[0,.9,-.45,1,-.35,.15]},
  mountain:{base:650,rise:680,shape:[0,1,-.35,1.2,-.25,.8]},
};

// Produces the six anchors accepted by the existing custom-route contract.
// The complete anchor array is committed with the race; the generator seed
// is only a way to reproduce a candidate before the race is submitted.
export function generatePlaytestStageProfile({distanceKm,style,seed}){
  if(![40,120,260].includes(distanceKm)||!Object.hasOwn(STYLES,style)||
    typeof seed!=='string'||!seed)
    throw new Error('A supported distance, route style and seed are required.');
  const {base,rise,shape}=STYLES[style];
  const random=seedrandom(`playtest-generated-stage-v1:${seed}:${distanceKm}:${style}`);
  const maxStep=distanceKm/5*95;
  const heights=[];
  for(let index=0;index<shape.length;index++){
    const variation=(random()-.5)*rise*(index===0?.18:.35);
    const desired=Math.round(Math.max(0,Math.min(2500,
      base+shape[index]*rise+variation)));
    const previous=heights.at(-1);
    heights.push(previous===undefined?desired:Math.round(Math.max(
      previous-maxStep,Math.min(previous+maxStep,desired))));
  }
  return heights;
}
