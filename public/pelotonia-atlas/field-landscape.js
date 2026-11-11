import * as THREE from './vendor/three.module.js';
import {batch,box,coniferGeometry,cottage,FLIGHT_SECONDS,hash,noise,random,standard} from './h5-landscape.js';

import {landmarkMesh, landmarkRadius} from './landmark-models.js';

const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const TAU=Math.PI*2;
const color=hex=>new THREE.Color(hex);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const between=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
const roadStyles={
  asphalt:{width:7,colour:'#545755',edge:'#9b967e'},
  gravel:{width:4.4,colour:'#a69c83',edge:'#867a61'},
  cobblestone:{width:4.9,colour:'#858782',edge:'#ada28a'},
  dirt:{width:3.5,colour:'#967a57',edge:'#8a7857'},
};

// Relief weight and vegetation follow the atlas environment code.
const climates={
  S:['Storm coast','#829574','#47664a','#828880',.77,.54,'mixed'],
  H:['Wooded highlands','#91a363','#436746','#96978a',.78,.87,'pine'],
  W:['Wet forest coast','#7a9b6e','#356747','#828d80',.85,1.1,'mixed'],
  R:['Rainforest','#769a65','#326247','#6c8172',.62,1.25,'broadleaf'],
  M:['Alpine range','#94a574','#456b48','#9f9c8d',1.05,.78,'pine'],
  C:['River plains','#a5b077','#5a784b','#999988',.34,.60,'broadleaf'],
  V:['Volcanic country','#8d9570','#537147','#726b62',.95,.50,'mixed'],
  E:['Open steppe','#b2ae79','#747c50','#9d927b',.47,.26,'broadleaf'],
  D:['Dry plateau','#ba9d6d','#817a54','#af8060',.74,.16,'broadleaf'],
  L:['Coastal lowlands','#a1b177','#597d53','#a7a292',.34,.55,'broadleaf'],
  F:['Fjord country','#8a9c77','#45684e','#86918d',.96,.66,'pine'],
  I:['Island coast','#a3b475','#557f57','#949584',.55,.64,'broadleaf'],
  P:['Northern plateau','#a4aa79','#5e7958','#979a8c',.67,.45,'mixed'],
  O:['Open water','#94a771','#5c7c55','#969b8e',.52,.51,'mixed'],
};

export function describeField(cell,geography,features=[]){
  const highlights=features.filter(feature=>feature.properties.model).map(feature=>feature.properties.name);
  const guideNote=highlights.length ? 'From the cycling field guide: ' + new Intl.ListFormat('en').format(highlights) + '.' : '';
  return {
    region:geography.regions[cell.regionId]??'Pelotonia waters',
    title:cell.landDetail?climates[cell.environmentCode][0]:(cell.sampledLandPercent?'Along the coast':'Over open water'),
    note:cell.landSourceConflict?'This cell is classified as land. The current atlas shoreline places its features in water.':
      guideNote || 'Illustrative terrain and scenery follow the atlas geometry and proposed local features.',
  };
}

function polygon(rings){
  const ring=rings[0];
  const limits=ring.reduce(([w,n,e,s],[x,z])=>[Math.min(w,x),Math.min(n,z),Math.max(e,x),Math.max(s,z)],
    [Infinity,Infinity,-Infinity,-Infinity]);
  const within=(x,z,line)=>{
    let inside=false;
    for(let i=1;i<line.length;i++){
      const [a,b]=line[i-1],[c,d]=line[i];
      if((b>z)!==(d>z) && x<(c-a)*(z-b)/(d-b)+a)inside=!inside;
    }
    return inside;
  };
  return {rings,limits,inside(x,z){
    return x>=limits[0]&&x<=limits[2]&&z>=limits[1]&&z<=limits[3]&&within(x,z,ring)
      &&!rings.slice(1).some(hole=>within(x,z,hole));
  }};
}

function routeOf(feature,toLocal){
  const path=feature.geometry.coordinates.map(toLocal);
  const vectorPath=new THREE.CatmullRomCurve3(path.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');
  // Long curves need an arc-length table dense enough for flight timing.
  vectorPath.arcLengthDivisions=512;
  const length=vectorPath.getLength();
  const sample=(d)=>{
    const p=vectorPath.getPointAt(clamp(d/length));
    return [p.x,p.z];
  };
  // Resample for rendering and spatial queries. The route vertices stay at their source positions.
  const segmentCount=Math.max(1,Math.ceil(length/56));
  const segments=Array.from({length:segmentCount+1},(_,i)=>sample(i*length/segmentCount));
  return {feature,path,sample,length,segments,style:roadStyles[feature.properties.surface]};
}

function makeFieldTerrain({cell,features,geography,atlas,heights,atlasFocus}){
  const routes=features.filter(f=>f.properties.type==='road');
  const primary=routes.find(f=>f.properties.surface==='asphalt');
  const anchors=new Map(geography.places.map(p=>[p.id,p]));
  const village=features.find(f=>f.id===primary?.properties.anchorObjectId);
  const place=anchors.get(primary?.properties.anchorObjectId);
  const seaPoint=features.find(f=>f.properties.type==='marine_site')?.geometry.coordinates;
  const anchor=village?.geometry.coordinates??place?.point??seaPoint??
    [(cell.boundsKm[0]+cell.boundsKm[2])/2,(cell.boundsKm[1]+cell.boundsKm[3])/2];
  const toLocal=([x,z])=>[(x-anchor[0])*1000,(z-anchor[1])*1000];
  const [w,n]=toLocal(cell.boundsKm.slice(0,2)),[e,s]=toLocal(cell.boundsKm.slice(2));
  const detailCenter=atlasFocus ? toLocal(atlasFocus) : [0,0];
  const pad=atlasFocus ? 30000 : 2100;
  const bounds=[w-pad,n-pad,e+pad,s+pad];
  const near=p=>p.limits[0]<=bounds[2]&&p.limits[2]>=bounds[0]&&p.limits[1]<=bounds[3]&&p.limits[3]>=bounds[1];
  const coast=geography.coast.map(rings=>polygon(rings.map(r=>r.map(toLocal)))).filter(near);
  const areas=features.filter(f=>f.geometry.type==='Polygon').map(f=>({
    ...polygon(f.geometry.coordinates.map(r=>r.map(toLocal))),type:f.properties.type,domain:f.properties.domain,
  }));
  const isLand=(x,z)=>coast.some(p=>p.inside(x,z));
  const lakes=[
    ...geography.lakes.map(l=>polygon(l.rings.map(r=>r.map(toLocal)))).filter(near),
    ...areas.filter(a=>a.type==='lake'&&a.domain==='land'),
  ];
  const [west,north,spanX,spanZ]=atlas.bounds;
  const m=atlas.resolution;
  const profile=climates[cell.environmentCode];
  const dry=['D','E','V'].includes(cell.environmentCode);
  const sourceHeight=(x,z)=>{
    const u=clamp((anchor[0]+x/1000-west)/spanX)*(m-1),v=clamp((anchor[1]+z/1000-north)/spanZ)*(m-1);
    const i=Math.min(m-2,Math.floor(u)),j=Math.min(m-2,Math.floor(v)),k=j*m+i;
    return mix(mix(heights[k],heights[k+1],u-i),mix(heights[k+m],heights[k+m+1],u-i),v-j);
  };
  const groundBase=(x,z)=>{
    const X=x+anchor[0]*1000,Z=z+anchor[1]*1000;
    const h=sourceHeight(x,z);
    if(!isLand(x,z))return -4-65*noise(X/1900,Z/1900)-38*noise(X/7600,Z/6700);
    const relief=(noise(X/470,Z/430)-.5)*(dry?108:67)+(noise(X/124,Z/136)-.5)*(dry?28:17)+(noise(X/38,Z/43)-.5)*5;
    return Math.max(1.3, h*(42+profile[4]*46)+relief*profile[4]*smooth(0,3,h));
  };
  for(const lake of lakes){
    const [a,b,c,d]=lake.limits;
    lake.level=Math.max(.5,groundBase((a+c)/2,(b+d)/2)-2);
  }
  const roadLines=routes.map(r=>routeOf(r,toLocal));
  const road=roadLines.find(r=>r.feature===primary);
  const nearSegments=new Map(), binSize=260,maxSearch=160;
  for(const r of roadLines)for(let i=1;i<r.segments.length;i++){
    const a=r.segments[i-1],b=r.segments[i];
    const x0=Math.floor((Math.min(a[0],b[0])-maxSearch)/binSize),x1=Math.floor((Math.max(a[0],b[0])+maxSearch)/binSize);
    const z0=Math.floor((Math.min(a[1],b[1])-maxSearch)/binSize),z1=Math.floor((Math.max(a[1],b[1])+maxSearch)/binSize);
    for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
      const key=z*1024+x;
      if(!nearSegments.has(key))nearSegments.set(key,[]);
      nearSegments.get(key).push([a,b]);
    }
  }
  function roadDistance(x,z,limit=160){
    let best=limit*limit,closest=null;
    const segments=nearSegments.get(Math.floor(z/binSize)*1024+Math.floor(x/binSize));
    if(!segments)return null;
    for(const [[a,b],[c,d]] of segments){
      const dx=c-a,dz=d-b,t=clamp(((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz||1));
      const u=a+t*dx,v=b+t*dz,sq=(x-u)**2+(z-v)**2;
      if(sq<best){best=sq;closest=[u,v,Math.sqrt(sq)];}
    }
    return closest;
  }
  function bed(x,z){
    let y=groundBase(x,z);
    if(y<=0)return y;
    for(const lake of lakes)if(lake.inside(x,z))return Math.min(y,lake.level-3.5);
    const nearRoad=roadDistance(x,z,68);
    if(nearRoad) y=mix(groundBase(nearRoad[0],nearRoad[1]),y,smooth(12,68,nearRoad[2]));
    return y;
  }
  const landmarks=features.filter(f=>f.properties.model).map(f=>{
    const [x,z]=toLocal(f.geometry.coordinates);
    return {id:f.id,x,z,bearing:f.properties.bearing,model:f.properties.model,radius:landmarkRadius[f.properties.model]};
  }).filter(({x,z})=>isLand(x,z)&&!lakes.some(lake=>lake.inside(x,z)));
  return {cell,landmarks,anchor,bounds,toLocal,detailCenter,atlasFocus,profile,isLand,hasLand:coast.length>0,lakes,areas,roadLines,road,roadDistance,bed,place,village};
}

function groundMesh(land){
  const axis=(min,max,key,center)=>{
    const values=[min,max],step=land.atlasFocus?550:295;
    for(let x=Math.ceil(min/step)*step;x<max;x+=step)values.push(x);
    if(land.hasLand)for(let offset=-3060;offset<=3060;offset+=24){
      const p=center+offset;
      if(p>min&&p<max)values.push(p);
    }
    for(const site of land.landmarks){
      for(let offset=-120;offset<=120;offset+=24){
        const p=site[key]+offset;
        if(p>min&&p<max)values.push(p);
      }
    }
    return [...new Set(values)].sort((a,b)=>a-b);
  };
  const [w,n,e,s]=land.bounds,[focusX,focusZ]=land.detailCenter;
  const us=axis(w,e,'x',focusX),vs=axis(n,s,'z',focusZ),pos=[],colors=[],indices=[],ys=[];
  const [_,grassHex,treesHex,rockHex,relief]=land.profile;
  const grass=color(grassHex),trees=color(treesHex),rock=color(rockHex),high=color('#d5dcd4');
  const seabed=color('#487a79'),sand=color('#819d91'),col=color(grassHex);
  const wet=color('#7d9271'),field=color('#b0ab76');
  for(const z of vs)for(const x of us){
    const y=land.bed(x,z),X=x+land.anchor[0]*1000,Z=z+land.anchor[1]*1000;
    const grove=noise(X/315,Z/300)*.72+noise(X/105,Z/119)*.28;
    if(y<=0)col.copy(seabed).lerp(sand,(1-smooth(0,92,-y))*.76);
    else{
      const slope=Math.hypot(land.bed(x+14,z)-y,land.bed(x,z+14)-y)/14;
      col.copy(grass).lerp(trees,smooth(.27,.82,grove)*.78);
      col.lerp(rock,smooth(.26,.88,slope)*.81);
      if(relief>.72)col.lerp(high,smooth(1720,2680,y)*.8);
      if(land.profile[0]==='River plains'||land.profile[0]==='Coastal lowlands'){
        const u=(X+Z*.21)/155,v=(Z-X*.17)/103;
        col.lerp(field,smooth(.20,.73,hash(Math.floor(u),Math.floor(v)))*.53);
      }
      for(const a of land.areas){
        if(a.domain!=='land'||!a.inside(x,z))continue;
        if(['forest','woodland','rainforest'].includes(a.type))col.lerp(trees,.71);
        if(['meadow','farmland','grassland'].includes(a.type))col.lerp(field,.5);
        if(a.type==='wetland')col.lerp(wet,.72);
        if(['lava_field','salt_flat','dry_basin'].includes(a.type))col.lerp(rock,.67);
      }
    }
    col.multiplyScalar(.83+.21*noise(X/80,Z/75)+.13*noise(X/19,Z/23));
    ys.push(y);pos.push(x,y,z);colors.push(col.r,col.g,col.b);
  }
  for(let j=0;j<vs.length-1;j++)for(let i=0;i<us.length-1;i++){
    const a=j*us.length+i,b=a+us.length;indices.push(a,b,a+1,b,b+1,a+1);
  }
  function lower(a,x){
    let l=0,r=a.length-1;
    while(l+1<r){const m=(l+r)>>1;if(a[m]<=x)l=m;else r=m;}
    return l;
  }
  land.ground=(x,z)=>{
    const i=lower(us,x),j=lower(vs,z),u=clamp((x-us[i])/(us[i+1]-us[i])),v=clamp((z-vs[j])/(vs[j+1]-vs[j]));
    const k=j*us.length+i,a=ys[k],b=ys[k+us.length],c=ys[k+us.length+1],d=ys[k+1];
    return u+v<=1?a+(d-a)*u+(b-a)*v:c+(b-c)*(1-u)+(d-c)*(1-v);
  };
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setIndex(indices);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,standard());
  mesh.name='Field terrain';mesh.receiveShadow=true;
  return mesh;
}

function waterMeshes(land){
  const ocean=batch(),lake=batch();
  const [w,n,e,s]=land.bounds;
  ocean.quad([w,0,n],[w,0,s],[e,0,s],[e,0,n],'#3b7a80');
  for(const area of land.lakes){
    const ring=area.rings[0].slice(0,-1);
    for(const [i,j,k] of THREE.ShapeUtils.triangulateShape(ring.map(p=>new THREE.Vector2(...p)),[])){
      const at=n=>[ring[n][0],area.level,ring[n][1]];
      lake.tri(at(i),at(j),at(k),'#49878a');
    }
  }
  const material=standard({side:THREE.DoubleSide,transparent:true,opacity:.77,roughness:.33,depthWrite:false});
  const surfaces=[ocean.mesh(material,'Sea surface')];
  if(land.lakes.length)surfaces.push(lake.mesh(material,'Lake surfaces'));
  for(const mesh of surfaces){mesh.castShadow=false;mesh.renderOrder=1;mesh.userData.water=true;}
  return surfaces;
}

function roadsMesh(land){
  const out=batch();
  for(const r of land.roadLines){
    const {width,colour,edge}=r.style;
    const side=(d,offset,lift)=>{
      const p=r.sample(d),a=r.sample(Math.max(0,d-4)),b=r.sample(Math.min(r.length,d+4));
      const scale=offset/(distance(a,b)||1);
      const x=p[0]-(b[1]-a[1])*scale,z=p[1]+(b[0]-a[0])*scale;
      return [x,land.ground(x,z)+lift,z];
    };
    const strip=(d,end,w,h,colour,shift=0)=>out.quad(side(d,-w+shift,h),side(d,w+shift,h),side(end,w+shift,h),side(end,-w+shift,h),colour);
    for(let d=0;d<r.length;d+=7){
      const end=Math.min(r.length,d+7),p=r.sample((d+end)/2);
      // The atlas shoreline takes precedence in cells with an inconsistent proposal.
      if(!land.isLand(...p))continue;
      strip(d,end,width/2+1.18,.14,edge);
      const tint=color(colour).multiplyScalar(.96+hash(Math.floor(d),Math.floor(width))*.08);
      strip(d,end,width/2,.22,tint);
      if(r.style===roadStyles.asphalt){
        for(const s of [-1,1])strip(d,end,.046,.27,'#d9d7c7',s*(width/2-.27));
        if(d%21===0)strip(d,Math.min(end,d+4),.052,.27,'#e4deca');
      }
    }
  }
  const mesh=out.mesh(standard({side:THREE.DoubleSide}),'Local asphalt, cobble, gravel and tracks');
  mesh.castShadow=false;
  return mesh;
}

function nearLandmark(land,x,z) {
  return land.landmarks.some(site=>(x-site.x)**2+(z-site.z)**2<site.radius**2);
}

function settlementsMesh(land,features){
  const houses=batch(),yards=batch(),used=[];
  const style=land.profile[0]==='Dry plateau'?
    {walls:['#c9ab85','#bfa386','#d9bc99'],roofs:['#8f634d','#9a7157','#826956']}:
    land.cell.environmentCode==='L'||land.cell.environmentCode==='I'?
      {walls:['#e2d4b2','#d8c5a4','#e0d8c1'],roofs:['#915c43','#a96950','#765547']}:undefined;
  const settlements=features.filter(f=>f.properties.type==='settlement').map(f=>({
    p:land.toLocal(f.geometry.coordinates),village:f.properties.minZoom===3,
  }));
  if(land.place)settlements.unshift({p:[0,0],village:true,city:true});
  for(const {p,village,city} of settlements){
    const r=random(Math.floor((p[0]+10007)*19+(p[1]+20007)*97+land.anchor[0]*100));
    const main=land.road?.path;
    const a=main?.[0],b=main?.at(-1);
    const yaw=main?Math.atan2(b[1]-a[1],b[0]-a[0]):r()*TAU;
    const u=Math.cos(yaw),v=Math.sin(yaw);
    const count=city?42:village?21:7;
    for(let i=0;i<count;i++){
      const side=i%2?1:-1;
      const ahead=(Math.floor(i/2)-(count/4-1))*19+(r()-.5)*14;
      const setback=side*(12+r()*24+(city&&i%3===0?34:0));
      const x=p[0]+ahead*u-setback*v,z=p[1]+ahead*v+setback*u;
      const size=(city?12:8)+r()*(city?12:9);
      if(!land.isLand(x,z)||land.ground(x,z)<1 || land.roadDistance(x,z,8+size*.42) ||
        land.lakes.some(l=>l.inside(x,z)) || nearLandmark(land,x,z) || used.some(o=>distance(o,[x,z])<size*.93))continue;
      const rotation=yaw+(r()-.5)*.52+(i%6===0?1.18:0);
      cottage(houses,x,z,rotation,size,land,r,i%5===0?'barn':'house',style);
      used.push([x,z]);
      const road=land.roadDistance(x,z,55);
      if(road){
        const start=[road[0],road[1]],end=[x,z],len=distance(start,end);
        const point=(t,s)=>{
          const [a,b]=between(start,end,t),u=a+(end[1]-start[1])/len*s,v=b-(end[0]-start[0])/len*s;
          return [u,land.ground(u,v)+.19,v];
        };
        for(let k=1;k<9;k++)yards.quad(point(k/10,-1.1),point(k/10,1.1),point((k+1)/10,1.1),point((k+1)/10,-1.1),'#9e987c');
      }
    }
  }
  return {used,meshes:[houses.mesh(standard({side:THREE.DoubleSide}),'Local village and town buildings'),
    yards.mesh(standard({side:THREE.DoubleSide}),'Courtyards and access tracks')]};
}

function broadleafGeometry(){
  const out=batch(),r=random(3871);
  box(out,[0,0],.031,.033,0,.68,0,['#61533f','#75634a']);
  const shape=new THREE.IcosahedronGeometry(1,1).getAttribute('position');
  for(let i=0;i<8;i++){
    const a=i*2.399,rad=.12+r()*.07,dx=Math.cos(a)*rad,dz=Math.sin(a)*rad,dy=.52+r()*.26;
    const scale=.15+r()*.09;
    for(let j=0;j<shape.count;j+=3){
      const p=k=>[dx+shape.getX(k)*scale,dy+shape.getY(k)*scale,dz+shape.getZ(k)*scale];
      out.tri(p(j),p(j+1),p(j+2),['#476f48','#57784a','#6d884d','#72985a','#4c754c'][Math.floor(r()*5)]);
    }
  }
  return out.mesh(standard(),'Broadleaf').geometry;
}

function vegetation(land,houses){
  if(!land.hasLand)return [];
  const patches=new Map(),r=random(Math.round(land.anchor[0]*5291+land.anchor[1]*8851)),[,,,,,density,flora]=land.profile;
  const use=(x,z,near)=>{
    if(!land.isLand(x,z)||land.lakes.some(p=>p.inside(x,z))||land.ground(x,z)<3)return;
    const X=x+land.anchor[0]*1000,Z=z+land.anchor[1]*1000;
    const grove=noise(X/370,Z/350)*.70+noise(X/110,Z/92)*.30;
    const named=land.areas.some(a=>['forest','woodland','rainforest'].includes(a.type)&&a.inside(x,z));
    if(r()>clamp((grove-.33)*1.38*density+(named?.35:0))||land.ground(x,z)>2650||
      land.roadDistance(x,z,13)||nearLandmark(land,x,z)||houses.some(p=>distance(p,[x,z])<10))return;
    const broad=near&&(flora==='broadleaf'||(flora==='mixed'&&r()>.52));
    const model=broad?'broadleaf':near?'near conifer':'distant conifer';
    const key=model+':'+Math.floor(x/1300)+':'+Math.floor(z/1300);
    if(!patches.has(key))patches.set(key,{model,items:[]});
    const arid=land.cell.environmentCode==='D'||land.cell.environmentCode==='E';
    const size=(arid?3.4:7)+r()*(arid?6:16);
    patches.get(key).items.push([x,z,size,r()*TAU,.81+r()*.19]);
  };
  // Concentrate model detail along the camera corridor and use sparse, cheaper trees further away.
  const [focusX,focusZ]=land.detailCenter;
  for(let z=-2350;z<=2350;z+=24)for(let x=-2350;x<=2350;x+=24){
    use(focusX+x+(r()-.5)*24,focusZ+z+(r()-.5)*24,true);
  }
  const [w,n,e,s]=land.bounds,step=land.atlasFocus?340:118;
  for(let z=n;z<s;z+=step)for(let x=w;x<e;x+=step){
    if(Math.abs(x-focusX)<2400&&Math.abs(z-focusZ)<2400)continue;
    use(x+(r()-.5)*step,z+(r()-.5)*step,false);
  }
  if(!patches.size)return [];
  const geometry=new Map(),material=standard({side:THREE.DoubleSide});
  const dummy=new THREE.Object3D(),tint=new THREE.Color();
  return [...patches.values()].map(({model,items})=>{
    if(!geometry.has(model))geometry.set(model,model==='broadleaf'?broadleafGeometry():coniferGeometry(1,model==='near conifer'));
    const mesh=new THREE.InstancedMesh(geometry.get(model),material,items.length);
    mesh.name=model;
    items.forEach(([x,z,size,yaw,shade],i)=>{
      dummy.position.set(x,land.ground(x,z)-.35,z);
      dummy.rotation.y=yaw;dummy.scale.setScalar(size);dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,tint.setScalar(shade));
    });
    mesh.computeBoundingSphere();
    mesh.castShadow=model!=='distant conifer';mesh.receiveShadow=true;
    return mesh;
  });
}

function roadsideLandscape(land){
  if(!land.road)return null;
  const out=batch(),code=land.cell.environmentCode;
  const dry=['D','E','V'].includes(code);
  const stone=['M','F','V','S'].includes(code);
  const tones=dry?['#b5a17d','#9c8265','#bdab91']:['#a39b85','#8c897a','#7e806c'];
  const r=random(Math.round(land.anchor[0]*401+land.anchor[1]*907));
  let middle=0,closest=Infinity;
  for(let d=0;d<land.road.length;d+=28){
    const p=land.road.sample(d),dist=Math.hypot(...p);
    if(dist<closest){closest=dist;middle=d;}
  }
  const start=Math.max(0,middle-810),end=Math.min(land.road.length,middle+1170);
  const offset=(d,v)=>{
    const p=land.road.sample(d),a=land.road.sample(d-5),b=land.road.sample(d+5),s=v/(distance(a,b)||1);
    const x=p[0]-(b[1]-a[1])*s,z=p[1]+(b[0]-a[0])*s;
    return [x,land.ground(x,z),z];
  };
  for(let d=start;d<end;d+=3.5){
    for(const side of [-1,1]){
      const section=Math.floor((d+side*21)/98);
      const p=offset(d,side*(stone?8.7:27));
      if(!land.isLand(p[0],p[2])||p[1]<=.3)continue;
      if(!dry&&hash(section,side)>.48&&Math.abs(d-middle)>100){
        const q=offset(Math.min(end,d+3.5),side*(stone?8.7:27));
        const h=stone?.66:1.05;
        if(stone){
          for(let i=0;i<2;i++){
            const a=[p[0],p[1]+i*.31,p[2]],b=[q[0],q[1]+i*.31,q[2]],c=[q[0],q[1]+(i+1)*.31,q[2]],e=[p[0],p[1]+(i+1)*.31,p[2]];
            out.quad(a,b,c,e,tones[(i+Math.floor(r()*3))%3]);
            out.quad(e,c,[c[0]+.40,c[1],c[2]+.16],[e[0]+.40,e[1],e[2]+.16],tones[0]);
          }
        }else{
          box(out,[p[0],p[2]],.20,.19,p[1]-.12,h+.12,0,['#7a694d','#9b886b']);
          for(const lift of [.37,.78]){
            out.quad([p[0],p[1]+lift,p[2]],[q[0],q[1]+lift,q[2]],
              [q[0],q[1]+lift+.11,q[2]],[p[0],p[1]+lift+.11,p[2]],'#918162');
          }
        }
      }
      for(let i=0;i<(dry?2:1);i++){
        const [x,y,z]=offset(d+r()*3.4,side*(8+r()*(dry?124:38)));
        if(!land.isLand(x,z)||y<=.3||land.roadDistance(x,z,5.3))continue;
        if(dry){
          const exposure=noise((x+land.anchor[0]*1000)/58,(z+land.anchor[1]*1000)/49);
          if(r()>smooth(.28,.82,exposure)*.8)continue;
          const size=.45+r()**2.9*2.6,angle=r()*TAU;
          const h=size*(.23+r()*.43);
          const ring=Array.from({length:6},(_,n)=>{
            const a=angle+n*TAU/6,rad=size*(.72+r()*.5);
            return [x+Math.cos(a)*rad,z+Math.sin(a)*rad*.71];
          });
          const foot=ring.map(([u,v])=>[u,land.ground(u,v)-.09,v]);
          const crown=ring.map(([u,v])=>[mix(x,u,.62),y+h*(.65+r()*.45),mix(z,v,.62)]);
          for(let n=0;n<6;n++){
            const j=(n+1)%6;
            out.quad(foot[n],foot[j],crown[j],crown[n],tones[n%3]);
            out.tri(crown[n],crown[j],[x+size*.16,y+h*.96,z-size*.11],tones[0]);
          }
        }else{
          const h=.30+r()*.69;
          const green=['#79925c','#64804c','#a6ac70'][Math.floor(r()*3)];
          out.tri([x-.25,y,z],[x+.2,y,z],[x+.13,y+h,z+.12],green);
          out.tri([x,y,z-.25],[x,y,z+.24],[x+.12,y+h*.84,z-.13],green);
        }
      }
    }
  }
  const mesh=out.mesh(standard({side:THREE.DoubleSide}),'Verges, field boundaries and rock fragments');
  if(!mesh.geometry.attributes.position.count)return null;
  return mesh;
}

function localDetails(land,features){
  const out=batch();
  for(const f of features){
    if(f.geometry.type!=='Point'||['settlement','landmark'].includes(f.properties.type))continue;
    const [x,z]=land.toLocal(f.geometry.coordinates),{type,domain}=f.properties;
    if(domain==='water'){
      if(type!=='marine_site'||land.isLand(x,z))continue;
      box(out,[x,z],4.7,3.9,-.6,1.8,0,['#bc9657','#9b713f']);
      box(out,[x,z],.33,.33,1.2,4.4,0,['#d1bda0','#aba48d']);
      box(out,[x,z],1,1,5.1,.88,0,['#9c5545','#b5684d']);
      continue;
    }
    if(!land.isLand(x,z))continue;
    const rng=random(Math.round(x*13+z*19));
    for(let i=0;i<8;i++){
      const u=x+(rng()-.5)*26,v=z+(rng()-.5)*24,r=1+rng()*4,y=land.ground(u,v);
      const top=[u+r*.25,y+r*.78,v-r*.13];
      const a=[u-r,y,v-r*.65],b=[u+r,y,v-r*.55],c=[u+r*.7,y,v+r],d=[u-r*.65,y,v+r*.7];
      out.tri(a,top,b,'#aaa597');out.tri(b,top,c,'#8b8b80');out.tri(c,top,d,'#7f8376');out.tri(d,top,a,'#96978a');
    }
  }
  return out.mesh(standard({side:THREE.DoubleSide}),'Field landmarks and navigation buoys');
}

function makeFlight(land){
  const road=land.road;
  const fly=road&&road.length>90;
  let start=0,end=0;
  let shoreView=null;
  if(fly){
    let nearest=0,best=Infinity;
    for(let d=0;d<=road.length;d+=12){
      const p=road.sample(d),len=Math.hypot(...p);
      if(len<best){best=len;nearest=d;}
    }
    start=Math.max(0,nearest-690);end=Math.min(road.length,nearest+1060);
    if(land.cell.marineDetail){
      const [x,z]=road.sample(end);
      for(const radius of [180,350,700,1350,2400,4200]){
        for(let i=0;i<24;i++){
          const angle=i*TAU/24,p=[x+Math.cos(angle)*radius,z+Math.sin(angle)*radius];
          if(!land.isLand(...p)){shoreView=p;break;}
        }
        if(shoreView)break;
      }
    }
  }
  return time=>{
    const p=clamp(time/FLIGHT_SECONDS),t=p-.055*Math.sin(p*TAU);
    let x,z,lookX,lookZ,rise;
    if(fly){
      const d=mix(start,end,t),centre=road.sample(d);
      const a=road.sample(d-45),b=road.sample(d+80),norm=distance(a,b)||1;
      const off=mix(-102,-23,smooth(0,.43,t))+99*smooth(.62,1,t);
      x=centre[0]-(b[1]-a[1])/norm*off;z=centre[1]+(b[0]-a[0])/norm*off;
      const ahead=road.sample(d+mix(195,735,smooth(.51,1,t)));
      [lookX,lookZ]=ahead;
      // At the end, retain a forward direction past the last route node.
      const extra=310*(1-smooth(0,135,distance(centre,ahead)));
      lookX+=extra*(b[0]-a[0])/norm;lookZ+=extra*(b[1]-a[1])/norm;
      if(shoreView){
        const reveal=smooth(.65,1,t)*.83;
        lookX=mix(lookX,shoreView[0],reveal);lookZ=mix(lookZ,shoreView[1],reveal);
      }
      rise=mix(104,41,smooth(0,.45,t))+130*smooth(.54,1,t);
    }else{
      x=mix(-1090,850,t);z=-380+210*Math.sin(t*Math.PI*.8);
      lookX=x+480;lookZ=mix(80,250,smooth(.50,1,t));
      rise=mix(102,54,smooth(0,.46,t))+132*smooth(.61,1,t);
    }
    const base=Math.max(0,land.ground(x,z));
    const aheadY=Math.max(0,land.ground(lookX,lookZ));
    return {eye:[x,base+rise,z],target:[lookX,aheadY+mix(4,65,smooth(.52,1,t)),lookZ]};
  };
}

export function buildField(input){
  if(input.geography.sourceHash!==input.atlas.sourceHash)throw new Error('The field geography does not match the atlas.');
  const land=makeFieldTerrain(input),group=new THREE.Group();
  group.add(groundMesh(land),...waterMeshes(land));
  if(land.roadLines.length)group.add(roadsMesh(land));
  const settlements=settlementsMesh(land,input.features);
  for(const mesh of settlements.meshes)if(mesh.geometry.attributes.position.count)group.add(mesh);
  if(land.landmarks.length)group.add(landmarkMesh(land));
  const trees=vegetation(land,settlements.used);
  if(trees.length)group.add(...trees);
  const roadside=roadsideLandscape(land);
  if(roadside)group.add(roadside);
  const details=localDetails(land,input.features);
  if(details.geometry.attributes.position.count)group.add(details);
  return {group,land,pose:makeFlight(land),description:describeField(input.cell,input.geography,input.features)};
}
