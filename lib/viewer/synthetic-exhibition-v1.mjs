// A separate, clearly fictional visual fixture. Never use as a race result.
export const SYNTHETIC_EXHIBITION_VERSION='viewer-visual-exhibition-1';
export function syntheticExhibitionV1(source){
  const category=source.riderCategory;
  const frames=[];
  const roles={front:'leaders',chase:'chase',main:'peloton',
    dropped:'dropped'};
  for(let time=0;time<=240;time+=5){
    const front=80+320*time/240;
    frames.push({time,groupRoles:roles,gaps:{
      front:0,chase:9,main:24,dropped:48},
    positions:source.riders.map((rider,index)=>{
      const groupId=index<2?'front':index<10?'chase':
        index<25?'main':'dropped';
      const gap=groupId==='front'?0:groupId==='chase'?9:
        groupId==='main'?24:48;
      const offset=index<2?index*1.4:index%8*.85;
      return {riderId:rider.id,
        distance:Math.max(0,front-gap-offset),
        lateral:((index%5)-2)*.75,
        groupId};
    })});
  }
  const landmarks=[];
  for(let z=8;z<400;z+=10){
    for(const side of [-1,1]){
      const x=side*(15+(z*7%35));
      landmarks.push({id:`study-tree-${z}-${side}`,
        type:'pine',position:[x,-.2,z],scale:.75+(z%5)*.1,
        rotation:(z*.19)%6.28,
        assetId:z%3===0?'study-larch':'study-spruce'});
      landmarks.push({id:`study-grass-${z}-${side}`,
        type:'grass',position:[side*10,-.2,z+3],scale:1.2});
    }
  }
  const feed={
    schemaVersion:'pelotonia.viewer.v1',
    raceId:`synthetic-exhibition-${category}-v1`,
    title:'Synthetic visual exhibition',
    synthetic:true,riderCategory:category,duration:240,
    route:{label:'Fictional straight-road visual fixture',
      points:[[0,0,0],[0,0,430]],distanceStations:[0,430],
      width:7.4,interpolation:'polyline',
      profile:{schemaVersion:'pelotonia.route-profile.v1',
        samples:[[0,80],[100,80],[200,80],[300,80],[400,80],[430,80]]}},
    terrain:{origin:[-80,-20],step:[5,5],columns:33,rows:95,
      heights:Array(33*95).fill(-.2)},
    assets:[
      {id:'study-spruce',type:'foliage-card',
        textureUrl:'/viewer-scenery/alpine-spruce-v1.png',
        width:8.2,height:13.5},
      {id:'study-larch',type:'foliage-card',
        textureUrl:'/viewer-scenery/alpine-larch-v1.png',
        width:7.4,height:14.5}],
    landmarks,
    crowd:{enabled:true,seed:9,backgroundSpacing:12,
      zones:[{id:'study-finish',from:300,to:400,kind:'finish',
        rows:3,spacing:2,side:'both',barriers:true}]},
    finish:{routeFraction:400/430,label:'FINISH',roadText:'PELOTONIA',
      color:'#25463e',accent:'#dec475',barrierBefore:100,
      barrierAfter:20},
    teams:source.teams,riders:source.riders,frames,
    events:[{time:0,label:'Synthetic exhibition begins.'},
      {time:80,label:'The chase group follows the leaders.',groupId:'chase'},
      {time:180,label:'The field approaches the finish.',type:'sector'},
      {time:240,label:'Visual exhibition ends. No race result.',
        type:'finish'}],
  };
  return {feed,version:SYNTHETIC_EXHIBITION_VERSION,
    coverage:{riderCount:feed.riders.length,paidRiderKilometres:0,
      boundaryFrames:feed.frames.length,officialResults:false}};
}
