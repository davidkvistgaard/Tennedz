// A versioned, visual-only scene for the fictional Motor Lab recording.
// No rider, group, timing, event, route distance or result data is changed.
export const SCENIC_PRESENTATION_VERSION='motor-lab-scenic-study-3';

export function scenicPresentationV1(recordedFeed){
  const totalDistance=recordedFeed.route.profile.samples.at(-1)[0];
  const treeStep=totalDistance>40000?180:95;
  const terrain={
    origin:[-80,-20],step:[20,20],columns:9,
    rows:Math.ceil(totalDistance/20)+3,
    heights:Array(9*(Math.ceil(totalDistance/20)+3)).fill(-.2),
  };
  const landmarks=[];
  for(let distance=55;distance<totalDistance-20;distance+=treeStep){
    for(const side of [-1,1]){
      const index=Math.floor(distance/treeStep);
      const x=side*(12+(index*17%19));
      const z=distance+(side===1?18:-18);
      landmarks.push({
        id:`scenic-tree-${index}-${side}`,type:'pine',
        position:[x,-.2,z],rotation:(index*2.399)%6.28,
        scale:.7+(index*7%9)/15,
        assetId:index%3===0?'scenic-larch':'scenic-spruce',
      });
      if(index%3===0)landmarks.push({
        id:`scenic-grass-${index}-${side}`,type:'grass',
        position:[side*9,-.2,z+8],scale:1.3,
      });
    }
  }
  const spectators=Array.from({length:240},(_,index)=>{
    const side=index%2===0?-1:1;
    const station=Math.floor(index/2);
    return {position:[side*(5.6+index%6*.7),-.2,
      totalDistance-300+station*2.5],
    rotation:side<0?Math.PI/2:-Math.PI/2,
    color:['#d7aa5a','#6e9a83','#ba7771','#667b98'][index%4],
    pose:index%3===0?'cheering':'standing'};
  });
  return {
    ...recordedFeed,
    title:'Recorded Motor Lab race · synthetic scene',
    synthetic:true,
    route:{...recordedFeed.route,width:7.4},
    terrain,
    assets:[
      {id:'scenic-spruce',type:'foliage-card',
        textureUrl:'/viewer-scenery/alpine-spruce-v1.png',
        width:8.2,height:13.5},
      {id:'scenic-larch',type:'foliage-card',
        textureUrl:'/viewer-scenery/alpine-larch-v1.png',
        width:7.4,height:14.5},
    ],
    landmarks,spectators,
    crowd:{enabled:false,seed:17,backgroundSpacing:80,
      zones:[{id:'scenic-finish-crowd',from:totalDistance-300,
        to:totalDistance,
        kind:'finish',rows:3,spacing:2,side:'both',barriers:true}]},
    finish:{routeFraction:1,label:'FINISH',color:'#25463e',
      accent:'#dec475',barrierBefore:150,barrierAfter:15},
  };
}
