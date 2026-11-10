import * as THREE from 'three';

const roofColours = ['#785648', '#87614b', '#665e54', '#82745f', '#715044'];

function direction(a, b) {
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  return [Math.cos(angle), Math.sin(angle)];
}

function distanceToRoad(p, [a,b]) {
  const dx=b[0]-a[0],dz=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);
}

export function settlementModels(local) {
  const buildings = [], trees = [];
  for (const feature of local?.features.values() ?? []) {
    if (feature.properties.type !== 'settlement') continue;
    const point = feature.geometry.coordinates;
    const cell=local.cells.get(feature.properties.gridCell);
    const roads=cell.features.filter(f=>f.properties.type==='road' && f.properties.anchorObjectId===feature.id);
    const main=roads.find(f=>f.properties.surface==='asphalt')?.geometry.coordinates;
    const hub=main?.findIndex(p=>p[0]===point[0] && p[1]===point[1]) ?? -1;
    const axis=hub>=0 ? direction(point,main[hub+1]) : [0.92,0.39];
    const segments=roads.flatMap(f=>f.geometry.coordinates.slice(1).map((p,i)=>[f.geometry.coordinates[i],p]));
    const seed = [...feature.id].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619),2166136261);
    let state = seed;
    const random = () => ((state = Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
    const offset = (u,v) => [point[0]+u*axis[0]-v*axis[1], point[1]+u*axis[1]+v*axis[0]];
    const village = feature.properties.minZoom === 3;
    for (const side of [-1, 1]) {
      const rows = village ? 2 : 1;
      for (let row=0; row<rows; row++) {
        for (let i=0; i<(village ? 5 : 3); i++) {
          if (row && random()<.32) continue;
          const x = .035 + i*.084 + (random()-.5)*.022;
          const z = side*(.095 + row*.10 + random()*.021);
          const centre = offset(x,z);
          const yaw = Math.atan2(axis[1],axis[0]) + (random()-.5)*.23 + (row && random()<.3 ? Math.PI/2 : 0);
          const width=.034+random()*.026, depth=.023+random()*.019;
          const h=.013+random()*.008;
          const c=Math.cos(yaw), s=Math.sin(yaw);
          const ring=[[-width,-depth],[-width,depth],[width,depth],[width,-depth]].map(([u,v])=>
            [centre[0]+(u*c-v*s)*.5,centre[1]+(u*s+v*c)*.5]);
          const ridge=[0,1].map(i=>[(ring[i*2][0]+ring[i*2+1][0])/2,(ring[i*2][1]+ring[i*2+1][1])/2]);
          if(segments.some(edge=>distanceToRoad(centre,edge)<.067)) continue;
          buildings.push({centre,ring,ridge,h,roof:roofColours[Math.floor(random()*roofColours.length)]});
          if (random()<.75) trees.push({p:offset(x+(random()-.5)*.065,z+side*.061), size:.024+random()*.021});
        }
      }
    }
    for(let i=0;i<14;i++) {
      const a=random()*Math.PI*2, r=.31+random()*.21;
      const p=offset(Math.cos(a)*r,Math.sin(a)*r);
      if(segments.every(edge=>distanceToRoad(p,edge)>.075)) trees.push({p,size:.021+random()*.025});
    }
    // Scatter groves in the same cleared area as the village's proposed road network.
    if(main) {
      const radius=Math.min(2.7,Math.hypot(main[0][0]-point[0],main[0][1]-point[1])*.92);
      for(let grove=0;grove<5;grove++){
        const bearing=random()*Math.PI*2;
        const distance=radius*(.42+random()*.33);
        const c=offset(Math.cos(bearing)*distance,Math.sin(bearing)*distance);
        const count=cell.environmentCode==='D'?9:40+Math.round(random()*28);
        const spread=radius*(.06+random()*.16);
        for(let i=0;i<count;i++){
          const a=random()*Math.PI*2,r=spread*Math.sqrt(random());
          const p=[c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r];
          if(Math.hypot(p[0]-point[0],p[1]-point[1])<.47 || segments.some(edge=>distanceToRoad(p,edge)<.095))continue;
          trees.push({p,size:.026+random()*.029});
        }
      }
    }
  }
  return {buildings,trees};
}

export function makeSettlements(models, height, cx, cz) {
  const positions=[], colors=[];
  const cachedColours = new Map();
  const vertex = ([x,z],y,hex) => {
    if(!cachedColours.has(hex)) cachedColours.set(hex,new THREE.Color(hex));
    const {r,g,b}=cachedColours.get(hex);
    positions.push(x-cx,y,z-cz); colors.push(r,g,b);
  };
  const face = (a,b,c,colour) => {for (const [p,y] of [a,b,c]) vertex(p,y,colour);};
  const quad = (a,b,c,d,colour) => {face(a,b,c,colour);face(a,c,d,colour);};
  for(const {ring,ridge,h,roof} of models.buildings) {
    const foot=ring.map(p=>height(...p));
    const eave=Math.max(...foot)+h;
    const top=eave+.012;
    for(let i=0;i<4;i++) {
      const j=(i+1)%4;
      quad([ring[i],foot[i]-.002],[ring[j],foot[j]-.002],[ring[j],eave],[ring[i],eave],i<2?'#d1bc98':'#a18d73');
    }
    face([ring[0],eave],[ring[1],eave],[ridge[0],top],'#c4ad8c');
    face([ring[2],eave],[ring[3],eave],[ridge[1],top],'#a89378');
    quad([ring[0],eave],[ridge[0],top],[ridge[1],top],[ring[3],eave],roof);
    quad([ring[1],eave],[ridge[0],top],[ridge[1],top],[ring[2],eave],'#634a3d');
  }
  const group = new THREE.Group();
  const houseGeometry=new THREE.BufferGeometry()
    .setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
    .setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  group.add(new THREE.Mesh(houseGeometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide})));
  const treeGeometry=new THREE.IcosahedronGeometry(1,0);
  const treeColours=['#3e6342','#527344','#486848','#657e4c'].map(c=>new THREE.Color(c));
  const treeVerts=treeGeometry.getAttribute('position');
  const shade=[];
  for(let i=0;i<treeVerts.count;i++){
    const light=.71+Math.max(0,treeVerts.getY(i)*.25-treeVerts.getX(i)*.14);
    shade.push(light,light,light);
  }
  treeGeometry.setAttribute('color',new THREE.Float32BufferAttribute(shade,3));
  const treeMesh=new THREE.InstancedMesh(treeGeometry,new THREE.MeshBasicMaterial({vertexColors:true}),models.trees.length);
  const transform=new THREE.Object3D();
  for(const [i,{p,size}] of models.trees.entries()) {
    transform.position.set(p[0]-cx,height(...p)+size*.65,p[1]-cz);
    transform.scale.set(size*.5,size*.86,size*.5);
    transform.updateMatrix();
    treeMesh.setMatrixAt(i,transform.matrix);
    treeMesh.setColorAt(i,treeColours[i%4]);
  }
  group.add(treeMesh);
  return group;
}

export function drawSettlements(context, project, models, pixelsPerKm) {
  const width=context.canvas.clientWidth,height=context.canvas.clientHeight;
  const path = (points, dx=0, dz=0) => {
    context.beginPath();
    points.forEach(([x,z],i)=>context[i?'lineTo':'moveTo'](...project(x+dx,z+dz)));
    context.closePath();
  };
  for (const {p,size} of models.trees) {
    const [x,y]=project(...p);
    if(x< -8 || y< -8 || x>width+8 || y>height+8)continue;
    const radius=Math.max(.55,size*pixelsPerKm*.58);
    context.fillStyle='#263c3377';
    context.beginPath();context.ellipse(x+radius*.65,y+radius*.65,radius*1.2,radius*.79,.45,0,Math.PI*2);context.fill();
    context.fillStyle='#35563c';
    context.beginPath();context.arc(x,y,radius,0,Math.PI*2);context.fill();
    context.fillStyle='#7f966685';
    context.beginPath();context.arc(x-radius*.23,y-radius*.25,radius*.54,0,Math.PI*2);context.fill();
  }
  for (const {ring,ridge,roof} of models.buildings) {
    context.fillStyle='#233d3463';path(ring,.014,.013);context.fill();
    context.fillStyle=roof;path([ring[0],ridge[0],ridge[1],ring[3]]);context.fill();
    context.fillStyle='#634a3d';path([ring[1],ridge[0],ridge[1],ring[2]]);context.fill();
  }
}
