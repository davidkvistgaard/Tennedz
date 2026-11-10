import * as THREE from './vendor/three.module.js';

export const FLIGHT_SECONDS = 40;
const clamp = (v,a=0,b=1) => Math.min(b,Math.max(a,v));
const lerp = (a,b,t) => a+(b-a)*t;
const smooth = (a,b,v) => {const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const metres = 1000;
const TAU = 2*Math.PI;

export function random(seed) {
  return () => ((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
}
export function hash(x,z) {
  let h=Math.imul(x,1597334677)^Math.imul(z,3812015801);
  h=Math.imul(h^(h>>>15),2246822519);
  return ((h^(h>>>13))>>>0)/4294967296;
}
export function noise(x,z) {
  const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,x-a),v=smooth(0,1,z-b);
  return lerp(lerp(hash(a,b),hash(a+1,b),u),lerp(hash(a,b+1),hash(a+1,b+1),u),v);
}

export function terrainFor(route, village) {
  const origin=village.geometry.coordinates;
  const coords=route.geometry.coordinates;
  const delta=[coords.at(-1)[0]-coords[0][0],coords.at(-1)[1]-coords[0][1]];
  const norm=Math.hypot(...delta);
  const ux=delta[0]/norm,uz=delta[1]/norm;
  // Rotate around the existing settlement anchor, retaining the route's atlas coordinates.
  const nodes=coords.map(([x,z])=>{
    const dx=(x-origin[0])*metres,dz=(z-origin[1])*metres;
    return [ux*dx+uz*dz, -uz*dx+ux*dz];
  });
  function centre(u) {
    let i=nodes.findIndex(p=>p[0]>u)-1;
    if(u>=nodes.at(-1)[0]) i=nodes.length-2;
    i=Math.max(0,i);
    const [a,b,c,d]=[nodes[Math.max(0,i-1)],nodes[i],nodes[i+1],nodes[Math.min(nodes.length-1,i+2)]];
    const span=c[0]-b[0],t=clamp((u-b[0])/span);
    const m=(c[1]-a[1])/(c[0]-a[0]),n=(d[1]-b[1])/(d[0]-b[0]);
    const v=(2*t**3-3*t*t+1)*b[1]+(t**3-2*t*t+t)*span*m+(-2*t**3+3*t*t)*c[1]+(t**3-t*t)*span*n;
    return v + (u<b[0] ? (u-b[0])*m : u>c[0] ? (u-c[0])*n : 0);
  }
  const grade=u=>180+.042*u+10*Math.sin(u/510)+7*Math.sin(u/1050);
  const ground=(u,v)=>{
    const d=v-centre(u);
    const spread=Math.abs(d-58*Math.sin(u/540));
    const fold=noise(u/1150+12,v/1050-8);
    const ravine=Math.max(0,1-Math.abs((d+260+95*Math.sin(u/630))/230));
    const hill=smooth(42,870,spread)*(110+115*fold+54*Math.sin(u/610+v/570));
    const range=smooth(440,3040,spread)*(350+760*noise(u/1280-11,v/920+3));
    const cliffs=smooth(180,1250,spread)*smooth(.42,.79,fold);
    const grain=(noise(u/138+5,v/125)-.5)*(15+25*cliffs)+(noise(u/29,v/36+4)-.5)*(5+16*cliffs);
    const ridge=1-2*Math.abs(noise(u/485+v/480,v/520)-.5);
    const ridges=ridge*ridge*cliffs*235;
    return grade(u)+smooth(8,72,Math.abs(d))*(hill+range+ridges+grain-ravine*29);
  };
  return {centre,grade,ground,nodes};
}

export function batch() {
  const positions=[],colours=[];
  const palette=new Map();
  function vertex(p,hex){
    let colour=hex;
    if(typeof hex==='string'){
      if(!palette.has(hex)) palette.set(hex,new THREE.Color(hex));
      colour=palette.get(hex);
    }
    positions.push(...p);
    colours.push(colour.r,colour.g,colour.b);
  }
  return {
    tri(a,b,c,col){vertex(a,col);vertex(b,col);vertex(c,col);},
    quad(a,b,c,d,col){this.tri(a,b,c,col);this.tri(a,c,d,col);},
    mesh(material, name){
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));
      geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,material);
      mesh.name=name;
      mesh.castShadow=mesh.receiveShadow=true;
      return mesh;
    },
  };
}
export const standard=options=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,...options});

function terrainMesh(land) {
  // Higher mesh density near the road and village, coarser triangles on the outer mountains.
  const axis=(radius,centre)=>Array.from({length:251},(_,i)=>{
    const n=(i-125)/125;
    return Math.sign(n)*radius*(.29*Math.abs(n)+.71*Math.abs(n)**2.8)+centre;
  });
  const us=axis(4700,70),vs=axis(4300,0);
  const pos=[],col=[],index=[];
  const grass=new THREE.Color('#8da363'),grove=new THREE.Color('#496943'),stone=new THREE.Color('#898a83');
  const pale=new THREE.Color('#b7b8a4'),colour=new THREE.Color();
  const fields=['#aab177','#b2ad67','#879451','#c0b482','#a0a972'].map(c=>new THREE.Color(c));
  for(const v of vs) for(const u of us) {
    const y=land.ground(u,v),d=Math.abs(v-land.centre(u));
    const canopy=noise(u/305+4,v/270)+.23*noise(u/102,v/99)+smooth(130,350,d)*.19;
    const slope=Math.hypot(land.ground(u+8,v)-y,land.ground(u,v+8)-y)/8;
    const rock=smooth(.31,.66,slope)*smooth(100,640,d);
    colour.copy(grass).lerp(grove,smooth(.51,.93,canopy)*.86);
    colour.lerp(pale,smooth(630,1100,y)*.65).lerp(stone,rock*.86);
    const row=Math.floor((u+v*.21)/124);
    const column=Math.floor((v-u*.09)/72);
    const farmland=smooth(45,66,d)*(1-smooth(185,240,d))*(1-smooth(370,810,Math.abs(u-45)));
    const furlong=(u+v*.21)-row*124,strip=(v-u*.09)-column*72;
    const parcel=smooth(1,6,Math.min(furlong,124-furlong,strip,72-strip));
    if(hash(row,column)>.23) colour.lerp(fields[Math.floor(hash(row+19,column)*fields.length)],farmland*parcel*.82);
    const variation=.76+.25*noise(u/83+12,v/67)+.19*noise(u/19,v/26);
    colour.multiplyScalar(variation);
    pos.push(u,y,v);col.push(colour.r,colour.g,colour.b);
  }
  for(let j=0;j<vs.length-1;j++) for(let i=0;i<us.length-1;i++){
    const a=j*us.length+i,b=a+us.length;
    index.push(a,b,a+1,b,b+1,a+1);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  g.setIndex(index);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,standard());
  mesh.name='H5 hillside and valley';
  mesh.receiveShadow=true;
  return mesh;
}

function roadMesh(land) {
  const road=batch(),paint=batch(),retaining=batch();
  const a=land.nodes[0][0],b=land.nodes.at(-1)[0];
  function point(u,offset,rise){
    const v=land.centre(u);
    const tangent=(land.centre(u+1)-land.centre(u-1))*.5;
    return [u-offset*tangent,land.grade(u)+rise,v+offset];
  }
  const strip=(mesh,start,end,left,right,rise,color)=>mesh.quad(point(start,left,rise),point(start,right,rise),
    point(end,right,rise),point(end,left,rise),color);
  for(let u=a;u<b;u+=4){
    const end=Math.min(u+4,b);
    const edge=4.4+noise(u/45,.41)*.58;
    strip(road,u,end,-edge,edge,.46,'#8e8976');
    strip(road,u,end,-3.55,3.55,.54,'#515550');
    strip(paint,u,end,-3.30,-3.19,.58,'#dcd9c4');
    strip(paint,u,end,3.19,3.30,.58,'#dcd9c4');
  }
  for(let u=a+3;u<b-3;u+=15){
    if(Math.abs(u)>56)strip(paint,u,u+5,-.055,.055,.585,'#e5dec0');
  }
  // Low dry-stone wall above the road cut and timber posts at the village approach.
  for(let u=140;u<315;u+=1.7){
    const d=8.8; const p=point(u,d,0); const q=point(u+1.65,d,0);
    for(let i=0;i<3;i++){
      const h=.36*i,y=land.ground(p[0],p[2])+h;
      const r=[p[0],y,p[2]],s=[q[0],y,q[2]],t=[q[0],y+.34,q[2]],w=[p[0],y+.34,p[2]];
      const color=['#8a8473','#9c947f','#777668'][Math.floor(hash(Math.round(u),i)*3)];
      retaining.quad(r,s,t,w,color);
      retaining.quad(w,t,[t[0],t[1],t[2]+.45],[w[0],w[1],w[2]+.45],color);
    }
  }
  const material=standard({side:THREE.DoubleSide});
  const surface=road.mesh(material,'Asphalt, shoulders and road cut');
  const markings=paint.mesh(material,'Painted road edges and centre line');
  surface.castShadow=markings.castShadow=false;
  return [surface,markings,retaining.mesh(material,'Dry-stone roadside wall')];
}

export function box(mesh,centre,width,depth,bottom,height,yaw,palette){
  const [u,v]=centre,c=Math.cos(yaw),s=Math.sin(yaw);
  const at=(x,y,z)=>[u+x*c-z*s,bottom+y,v+x*s+z*c];
  const corners=[[-1,-1],[-1,1],[1,1],[1,-1]].map(([x,z])=>[x*width/2,z*depth/2]);
  for(let i=0;i<4;i++){
    const [x,z]=corners[i],[X,Z]=corners[(i+1)%4];
    mesh.quad(at(x,0,z),at(X,0,Z),at(X,height,Z),at(x,height,z),palette[i%palette.length]);
  }
  mesh.quad(...corners.map(([x,z])=>at(x,height,z)),palette[0]);
  return at;
}
export function cottage(mesh,u,v,yaw,size,land,rng,kind,style={}) {
  const [w,d,h]=[size,size*(.61+rng()*.15),size*(kind==='barn'?.39:.47)];
  const base=land.ground(u,v)-1.2;
  const walls=style.walls ?? ['#d0c1a6','#dcd0b7','#afa38b','#e0d3b4'];
  const plaster=walls[Math.floor(rng()*walls.length)];
  const timber=kind==='barn'?'#6c5743':'#a18b6b';
  const at=box(mesh,[u,v],w,d,base,h,yaw,[plaster,plaster,timber,plaster]);
  const e=.55,ridge=h+d*.46;
  const roofs=style.roofs ?? ['#705748','#986c50','#864d39','#66645e','#645a51'];
  const roof=roofs[Math.floor(rng()*roofs.length)];
  for(const side of [-1,1]){
    for(let row=0;row<11;row++){
      const a=row/11,b=(row+1)/11;
      const roofY=t=>lerp(ridge,h,t);
      const roofZ=t=>side*(d/2+e)*t;
      const tint=new THREE.Color(roof).multiplyScalar(.8+rng()*.29);
      mesh.quad(at(-w/2-e,roofY(a),roofZ(a)),at(w/2+e,roofY(a),roofZ(a)),
        at(w/2+e,roofY(b),roofZ(b)),at(-w/2-e,roofY(b),roofZ(b)),tint);
    }
  }
  for(const side of [-1,1]){
    const x=side*w/2;
    mesh.tri(at(x,h,-d/2),at(x,ridge,0),at(x,h,d/2),timber);
    for(const z of [-d/4,d/4]){
      const y=h*.53;
      mesh.quad(at(x+side*.05,y-.61,z-.72),at(x+side*.05,y-.61,z+.72),at(x+side*.05,y+.61,z+.72),at(x+side*.05,y+.61,z-.72),'#ebe2c7');
      mesh.quad(at(x+side*.08,y-.40,z-.49),at(x+side*.08,y-.40,z+.49),at(x+side*.08,y+.40,z+.49),at(x+side*.08,y+.40,z-.49),'#364b4b');
    }
    for(const f of [-.33,0,.33]){
      const y=h*(f===0?.42:.59),z=side*(d/2+.05),x=f*w;
      mesh.quad(at(x-.6,y-.65,z),at(x+.6,y-.65,z),at(x+.6,y+.65,z),at(x-.6,y+.65,z),f===0?'#765b43':'#4c605d');
      if(f!==0){
        const w=.31,p=z+side*.055;
        for(const s of [-1,1]){
          const a=x+s*.86;
          mesh.quad(at(a-w,y-.69,p),at(a+w,y-.69,p),at(a+w,y+.69,p),at(a-w,y+.69,p),'#766147');
        }
      }
    }
    const z=side*(d/2+.04);
    mesh.quad(at(-w/2,.15,z),at(w/2,.15,z),at(w/2,1.28,z),at(-w/2,1.28,z),'#8b8475');
  }
  if(kind!=='barn'){
    const p=at(w*.28,0,d*.14);
    box(mesh,[p[0],p[2]],.82,.78,base+h,.46*d+1.25,yaw,['#887b69','#94816e']);
  }
}

function villageMesh(land){
  const rng=random(18620),mesh=batch(),grounds=batch(),positions=[];
  for(const side of [-1,1]){
    for(let i=0;i<10;i++){
      const u=-133+i*27+(rng()-.5)*19;
      const v=land.centre(u)+side*(13+rng()*31);
      const yaw=Math.atan2(land.centre(u+4)-land.centre(u-4),8)+(rng()-.5)*.56;
      cottage(mesh,u,v,yaw,10+rng()*7,land,rng,i%4===0?'barn':'house');
      positions.push([u,v]);
      const start=land.centre(u)+side*4.4;
      const access=t=>{
        const x=u+(u%3)*t+(rngSeed(u)-.5)*3*Math.sin(t*Math.PI),z=lerp(start,v-side*3,t);
        const w=lerp(1.55,1.05,t);
        return [x-w,x+w,z];
      };
      const y=(a,b)=>[a,land.ground(a,b)+.43,b];
      for(let n=0;n<12;n++){
        const [l,r,z]=access(n/12),[L,R,Z]=access((n+1)/12);
        grounds.quad(y(l,z),y(r,z),y(R,Z),y(L,Z),'#9c957e');
      }
      if(i%3===0){
        cottage(mesh,u+8,v+side*15,yaw+1.1,6.5+rng()*3,land,rng,'barn');
        positions.push([u+8,v+side*15]);
      }
    }
  }
  return {
    mesh:mesh.mesh(standard({side:THREE.DoubleSide}),'Alpine village: plaster, timber and slate'),
    grounds:grounds.mesh(standard({side:THREE.DoubleSide}),'Village access tracks'),
    positions,
  };
}

const rngSeed=u=>hash(Math.floor(u),63);

function fieldEdges(land){
  const mesh=batch();
  for(const [start,end,side,offset] of [[-416,-233,-1,61],[96,242,1,57],[268,424,1,91],[-550,-397,1,84]]){
    for(let u=start;u<end;u+=3.6){
      const v=land.centre(u)+side*offset;
      const w=land.centre(u+3.6)+side*offset;
      const y=land.ground(u,v),z=land.ground(u+3.6,w);
      box(mesh,[u,v],.24,.21,y-.13,1.35,0,['#685b44','#9b8766']);
      for(const h of [.47,.89]){
        mesh.quad([u,y+h,v],[u+3.6,z+h,w],[u+3.6,z+h+.15,w],[u,y+h+.15,v],'#857457');
        mesh.quad([u,y+h+.15,v],[u+3.6,z+h+.15,w],[u+3.6,z+h+.15,w+.13],[u,y+h+.15,v+.13],'#9b8866');
      }
    }
  }
  return mesh.mesh(standard({side:THREE.DoubleSide}),'Split-rail pasture fences');
}

export function coniferGeometry(variant,close){
  const out=batch(),rng=random(729+variant*129);
  const bark=['#695645','#584c3e'];
  box(out,[0,0],.032,.032,0,.69,0,bark);
  const colors=['#39533d','#455f41','#54724b','#365140','#687d4e'];
  const rings=close?(variant===2?13:16):6;
  const branches=close?6:4;
  for(let tier=0;tier<rings;tier++){
    const h=.17+tier*.79/rings,r=.25*(1-tier/(rings+1))**1.05*(variant===1?.78:1);
    const spin=tier*2.39;
    for(let j=0;j<branches;j++){
      const angle=spin+j*TAU/branches+rng()*.42;
      const x=Math.cos(angle),z=Math.sin(angle);
      const spread=r*(.64+.54*rng());
      const a=[x*spread,h-.045-rng()*.045,z*spread];
      const b=[x*r*.30-z*r*.25,h-.018,z*r*.30+x*r*.25];
      const c=[x*r*.30+z*r*.25,h-.03,z*r*.30-x*r*.25];
      const d=[x*r*.29,h+.095,z*r*.29];
      out.tri(a,b,d,colors[(j+tier)%colors.length]);
      out.tri(a,d,c,colors[(j+tier+1)%colors.length]);
      out.tri(a,c,b,colors[0]);
    }
  }
  return out.mesh(standard(),'Conifer').geometry;
}

function forests(land,houses){
  const bins=Array.from({length:6},()=>[]);
  const rng=random(92833);
  const step=18;
  for(let u=-3600;u<3900;u+=step) for(let v=-3420;v<3420;v+=step){
    const x=u+(rng()-.5)*step,z=v+(rng()-.5)*step,d=Math.abs(z-land.centre(x));
    const sideBand=smooth(130,350,d)*.19 + (z>land.centre(x)?.06:0);
    const growth=noise(x/305+4,z/270)+.23*noise(x/102,z/99)+sideBand;
    if(d<15 || (Math.abs(x)<205 && d<58) || land.ground(x,z)>1100)continue;
    if(growth<.62 || rng()>clamp((growth-.56)*1.9,.06,.86))continue;
    if(houses.some(([a,b])=>Math.hypot(x-a,z-b)<13))continue;
    const scale=10+rng()*14, yaw=rng()*TAU;
    const close=d<450 && x>-900 && x<1550;
    bins[(close?0:3)+Math.floor(rng()*3)].push({x,z,scale,yaw});
  }
  // Trees in small rows and gardens near the road anchor.
  for(let i=0;i<130;i++){
    const x=(rng()-.5)*470,z=land.centre(x)+(rng()<.5?-1:1)*(28+rng()*78);
    if(houses.some(([a,b])=>Math.hypot(x-a,z-b)<11))continue;
    bins[i%3].push({x,z,scale:7+rng()*11,yaw:rng()*TAU});
  }
  const dummy=new THREE.Object3D(),color=new THREE.Color();
  const material=standard({side:THREE.DoubleSide});
  return bins.flatMap((group,variant)=>{
    const geometry=coniferGeometry(variant%3,variant<3);
    const patches=new Map();
    for(const item of group){
      const key=Math.floor(item.x/950)+':'+Math.floor(item.z/950);
      if(!patches.has(key))patches.set(key,[]);
      patches.get(key).push(item);
    }
    return [...patches.values()].map(patch=>{
      const mesh=new THREE.InstancedMesh(geometry,material,patch.length);
      mesh.name='Alpine firs '+(variant+1);
      patch.forEach(({x,z,scale,yaw},i)=>{
        dummy.position.set(x,land.ground(x,z)-.4,z);
        dummy.rotation.y=yaw;
        dummy.scale.set(scale,scale,scale);
        dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
        color.setScalar(.81+.19*hash(Math.round(x),Math.round(z)));mesh.setColorAt(i,color);
      });
      mesh.computeBoundingSphere();
      mesh.castShadow=variant<3;
      mesh.receiveShadow=true;
      return mesh;
    });
  });
}

function foreground(land){
  const rng=random(18692),grass=batch(),rock=batch();
  for(let i=0;i<7400;i++){
    const u=-860+rng()*2140;
    const v=land.centre(u)+(rng()<.5?-1:1)*(8+rng()*190);
    if(Math.abs(u)<160 && Math.abs(v-land.centre(u))>13 && Math.abs(v-land.centre(u))<43)continue;
    const y=land.ground(u,v), h=.22+rng()*.52;
    for(let j=0;j<3;j++){
      const z=v+(rng()-.5)*.6,x=u+(rng()-.5)*.6;
      grass.tri([x-.08,y,z],[x+.08,y,z],[x+(rng()-.5)*.45,y+h,z+.12],j%2?'#91a35f':'#728b4f');
    }
    if(i%49===0){
      const s=.7+rng()*2;
      rock.tri([u-s,y,v-s],[u+s,y,v-s],[u,y+s*.8,v], '#979385');
      rock.tri([u,y+s*.8,v],[u+s,y,v-s],[u+s*.6,y,v+s], '#888477');
      rock.tri([u-s,y,v-s],[u,y+s*.8,v],[u+s*.6,y,v+s], '#a49d87');
    }
  }
  return [grass.mesh(standard({side:THREE.DoubleSide}),'Meadow verge and grass tufts'),rock.mesh(standard({side:THREE.DoubleSide}),'Exposed roadside rocks')];
}

function gardenTrees(land,houses){
  const mesh=batch(),rng=random(431);
  const foliage=new THREE.IcosahedronGeometry(1,1).getAttribute('position');
  const palette=['#466d47','#64804d','#778c51','#537748','#819956'];
  for(let i=0;i<49;i++){
    const u=-213+rng()*435,v=land.centre(u)+(rng()>.5?1:-1)*(13+rng()*53);
    if(houses.some(([x,z])=>Math.hypot(u-x,v-z)<9))continue;
    const h=5+rng()*7,y=land.ground(u,v);
    box(mesh,[u,v],.35,.32,y-.1,h*.78,0,['#665747','#5b4c3f']);
    for(let j=0;j<6;j++){
      const a=j*TAU/6,r=h*(.19+rng()*.1);
      const centre=[u+Math.cos(a)*h*.19,y+h*(.62+rng()*.29),v+Math.sin(a)*h*.19];
      for(let k=0;k<foliage.count;k+=3){
        const p=Array.from({length:3},(_,m)=>{
          const n=k+m;
          return [centre[0]+r*foliage.getX(n),centre[1]+r*foliage.getY(n)*.9,centre[2]+r*foliage.getZ(n)];
        });
        const light=foliage.getY(k)>.25?3:0;
        mesh.tri(...p,palette[light+Math.floor(rng()*(light?2:3))]);
      }
    }
  }
  return mesh.mesh(standard(),'Village fruit trees and broadleaf crowns');
}

export function buildH5(route,village){
  const land=terrainFor(route,village),group=new THREE.Group();
  const hamlet=villageMesh(land);
  group.add(terrainMesh(land),...roadMesh(land),hamlet.mesh,hamlet.grounds,fieldEdges(land),
    ...forests(land,hamlet.positions),gardenTrees(land,hamlet.positions),...foreground(land));
  return {land,group};
}

export function flightPose(land,time){
  const progress=clamp(time/FLIGHT_SECONDS);
  const ramp=.055;
  const distance=progress<ramp ? progress**2/(2*ramp) : progress>1-ramp ?
    1-ramp-(1-progress)**2/(2*ramp) : progress-ramp/2;
  const t=distance/(1-ramp);
  const u=lerp(-630,1090,t);
  const side=lerp(-132,-27,smooth(0,.39,t))+142*smooth(.52,1,t);
  const rise=lerp(121,40,smooth(0,.42,t))+188*smooth(.49,1,t);
  const v=land.centre(u)+side;
  const desired=land.grade(u)+rise,clearance=land.ground(u,v)+23;
  const y=(desired+clearance+Math.hypot(desired-clearance,9))/2;
  const lookU=u+lerp(215,740,smooth(.41,.98,t));
  const lookV=land.centre(lookU)+lerp(0,-220,smooth(.43,1,t));
  return {eye:[u,y,v],target:[lookU,land.grade(lookU)+lerp(4,154,smooth(.42,1,t)),lookV]};
}
