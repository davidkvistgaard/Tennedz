// A versioned, visual-only scene for the fictional Motor Lab recording.
// No rider, group, timing, event, route distance or result data is changed.
export const SCENIC_PRESENTATION_VERSION='motor-lab-scenic-study-1';

export function scenicPresentationV1(recordedFeed){
  const terrain={
    origin:[-80,-20],step:[20,20],columns:9,rows:2003,
    heights:Array(9*2003).fill(-.2),
  };
  const landmarks=[];
  for(let distance=55;distance<39980;distance+=95){
    for(const side of [-1,1]){
      const index=Math.floor(distance/95);
      const x=side*(14+(index*17%39));
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
    landmarks,
    crowd:{enabled:true,seed:17,backgroundSpacing:80,
      zones:[{id:'scenic-finish-crowd',from:39700,to:40000,
        kind:'finish',rows:3,spacing:2,side:'both',barriers:true}]},
    finish:{routeFraction:1,label:'FINISH',color:'#25463e',
      accent:'#dec475',barrierBefore:150,barrierAfter:15},
  };
}
