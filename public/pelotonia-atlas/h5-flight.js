import * as THREE from './vendor/three.module.js';
import {addTerrainDetail, animateWater} from './landscape-materials.js';
import {buildH5, flightPose, FLIGHT_SECONDS} from './h5-landscape.js';
import {buildField, describeField} from './field-landscape.js';
import {centerOf,drawFlatLayer} from './local-layer.js';

import {readGuide, withCyclingGuide} from './cycling-guide.mjs';

const $=id=>document.getElementById(id);
const shots={
  village:['Village approach','The H5 road winding through an alpine village beneath forested slopes'],
  ridge:['Across the valley','A higher view over the H5 valley and alpine ridges'],
};
const fieldExplorer=document.body.hasAttribute('data-field-explorer');
const previews={H5:'h5-village.webp',H6:'field-h6.webp',N9:'field-n9.webp',C11:'field-c11.webp',A1:'field-a1.webp'};
let field;
const readJson=async file=>{
  const response=await fetch('./'+file);
  if(!response.ok)throw new Error('Could not load '+file);
  return response.json();
};

async function openField(){
  const [atlas,geography,baseManifest,baseCollection,guide]=await Promise.all([
    ...['atlas.json','field-geography.json','lokallag-manifest.json','lokallag.geojson'].map(readJson),
    readGuide().catch(error=>{console.warn(error);return {sites:[]};}),
  ]);
  const [collection,manifest]=withCyclingGuide(baseCollection,baseManifest,guide,atlas.grid);
  const index=new Map(manifest.cells.map(cell=>[cell.cell,cell]));
  const query=new URLSearchParams(location.search);
  const key=query.get('cell');
  const cell=index.get(key)??index.get('H5');
  const lookup=new Map(collection.features.map(f=>[f.id,f]));
  const features=cell.featureIds.map(id=>lookup.get(id));
  const description=describeField(cell,geography,features);
  const landmarks=features.filter(f=>f.properties.model);
  const selectedSite=landmarks.find(f=>f.id===query.get('site'));
  const select=$('field-choice');
  select.replaceChildren(...manifest.cells.map(c=>new Option(c.cell,c.cell)));
  select.value=cell.cell;select.disabled=false;
  select.onchange=()=>{location.href=`./field-flight.html?cell=${select.value}`;};
  $('atlas-back').href=`./index.html?cell=${cell.cell}`;
  $('atlas-back').setAttribute('aria-label',`Back to ${cell.cell} in the atlas`);
  $('landscape-region').textContent=`${description.region.toUpperCase()} · ${cell.cell}`;
  $('landscape-title').textContent=cell.cell==='H5'?'Through the alpine village':description.title;
  $('stage').setAttribute('aria-label',`Landscape of field ${cell.cell}`);
  $('phase').textContent=cell.landDetail?'Local roads and terrain':'Marine landscape';
  $('note').textContent=description.note;
  document.title=`Field ${cell.cell} · Pelotonia Atlas`;
  const preview=previews[cell.cell];
  if(preview){
    $('poster').src='./'+preview;
    $('poster').alt=`Rendered landscape of field ${cell.cell}`;
    $('poster').hidden=false;
  }
  return {atlas,geography,cell,features,lookup,description,preview,landmarks,selectedSite};
}

function showFeature(feature) {
  const {cell,description}=field;
  const site=feature?.properties.model ? feature.id : '';
  const query=new URLSearchParams({cell:cell.cell});
  if(site)query.set('site',site);
  $('atlas-back').href='./index.html?'+query;
  $('note').textContent=feature?.properties.description ?? description.note;
  if(feature)$('phase').textContent=feature.properties.name;
}

function fieldPicker(features,placeholder,selectFeature,selected='') {
  const detail=$('detail-choice');
  $('detail-control').hidden=false;
  detail.replaceChildren(new Option(placeholder,''),...features.map(f=>new Option(f.properties.name,f.id)));
  detail.value=selected;
  detail.onchange=()=>selectFeature(field.lookup.get(detail.value));
}

async function flatField(reason){
  if(!field){$('mode').textContent='Landscape unavailable';$('note').textContent=reason;return;}
  const hasStill=field.preview&&!field.landmarks.length;
  $('mode').textContent=hasStill?'Rendered view':'Field map';
  $('phase').textContent=hasStill?'A view from the drone route':`${field.features.length} local features`;
  $('note').textContent=reason+' '+field.description.note;
  if(field.landmarks.length){
    const show=feature=>{
      showFeature(feature);
      if(!feature)$('phase').textContent=`${field.landmarks.length} cycling landmarks`;
    };
    fieldPicker(field.landmarks,'Choose a cycling landmark',show,field.selectedSite?.id);
    if(field.selectedSite)show(field.selectedSite);
  }
  if(hasStill)return;
  const map=new Image();
  map.src='./terrain-local.webp';
  await map.decode();
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=1024;
  const ctx=canvas.getContext('2d');
  const [w,n,e,s]=field.cell.boundsKm,[west,north,spanX,spanZ]=field.atlas.bounds;
  ctx.drawImage(map,(w-west)/spanX*map.width,(n-north)/spanZ*map.height,
    (e-w)/spanX*map.width,(s-n)/spanZ*map.height,0,0,1024,1024);
  drawFlatLayer({features:new Map(field.features.map(f=>[f.id,f])),junctions:new Set()},4,ctx,
    (x,z)=>[(x-w)/(e-w)*1024,(z-n)/(s-n)*1024],1024/(e-w));
  const poster=$('poster');
  poster.src=canvas.toDataURL('image/webp',.91);
  poster.alt=`Overview map of field ${field.cell.cell} with local features`;
  poster.dataset.overview='';
  poster.hidden=false;
}

function showStills(reason){
  if(fieldExplorer){flatField(reason).catch(()=>{$('note').textContent=reason;});return;}
  $('mode').textContent='Rendered views';
  $('stills').hidden=false;
  $('note').textContent=reason;
  for(const button of $('stills').querySelectorAll('button')){
    button.onclick=()=>{
      const shot=button.dataset.shot;
      $('poster').src=`./h5-${shot}.webp`;
      $('poster').alt=shots[shot][1];
      $('phase').textContent=shots[shot][0];
      for(const item of $('stills').querySelectorAll('button')){
        item.setAttribute('aria-pressed',String(item===button));
      }
    };
  }
}

function skyDome(){
  const material=new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    uniforms:{
      zenith:{value:new THREE.Color('#729bb1')},
      haze:{value:new THREE.Color('#a9bec3')},
      light:{value:new THREE.Color('#f0dfb6')},
    },
    vertexShader:`
      varying vec3 skyDirection;
      void main(){
        skyDirection=position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,
    fragmentShader:`
      uniform vec3 zenith;
      uniform vec3 haze;
      uniform vec3 light;
      varying vec3 skyDirection;
      void main(){
        vec3 v=normalize(skyDirection);
        vec3 sunDirection=normalize(vec3(-.5,.72,.44));
        float glow=pow(max(dot(v,sunDirection),0.),12.);
        vec3 air=mix(haze,zenith,smoothstep(-.05,.82,v.y));
        air=mix(air,light,glow*.32);
        gl_FragColor=vec4(air,1.);
        #include <colorspace_fragment>
      }`,
  });
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(9000,24,12),material);
  mesh.renderOrder=-10;
  return mesh;
}

async function start(){
  if(fieldExplorer)field=await openField();
  const canvas=document.createElement('canvas');
  const context=canvas.getContext('webgl2',{antialias:true,alpha:false});
  if(!context){
    showStills(fieldExplorer?'Live flight requires WebGL2.':
      'Live flight requires WebGL2. These views were rendered from the H5 landscape and flight path.');
    return;
  }
  let group,pose,land;
  if(field&&field.cell.cell!=='H5'){
    const response=await fetch('./elevation.bin');
    if(!response.ok)throw new Error('Could not load the relief.');
    const terrain=buildField({...field,heights:new Float32Array(await response.arrayBuffer())});
    group=terrain.group;pose=terrain.pose;land=terrain.land;
  }else{
    const features=field?.lookup??new Map((await readJson('lokallag.geojson')).features.map(f=>[f.id,f]));
    const h5=buildH5(features.get('LOCAL-H5-road-asphalt'),features.get('LOCAL-H5-village'));
    group=h5.group;pose=time=>flightPose(h5.land,time);
  }
  const renderer=new THREE.WebGLRenderer({canvas,context,antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.04;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#9ab5be');
  scene.fog=new THREE.FogExp2('#a7bdc2',.00029);
  scene.add(skyDome());
  addTerrainDetail(group.children[0].material);
  const water=group.children.find(mesh=>mesh.userData.water);
  const waveTime=water?animateWater(water.material):null;
  const road=group.children.find(mesh=>/asphalt/i.test(mesh.name));
  if(road)addTerrainDetail(road.material);
  scene.add(group,new THREE.HemisphereLight('#d5e7ef','#797254',2.1));
  const sun=new THREE.DirectionalLight('#ffe3ba',2.8);
  sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-340,right:340,top:340,bottom:-340,near:50,far:2050});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias=-.00013;
  sun.shadow.normalBias=.35;
  scene.add(sun,sun.target);
  const camera=new THREE.PerspectiveCamera(36,1,1.1,22000);
  const stage=$('stage');
  const range=$('time'),play=$('play');
  let time=0,last=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,dirty=true;
  let inspection=null,transition=null,currentPose=null;
  const resize=()=>{
    const w=stage.clientWidth,h=stage.clientHeight;
    renderer.setSize(w,h,false);
    camera.aspect=w/h;
    camera.fov=w<h ? 50 : 36;
    camera.updateProjectionMatrix();
    dirty=true;
  };
  const showPlay=()=>{play.textContent=playing?'Pause':time>=FLIGHT_SECONDS?'Replay':'Play';};
  function draw(now=0){
    let view=inspection??pose(time);
    if(transition){
      const d=Math.min(1,Math.max(0,(now-transition.start)/950));
      const t=d*d*(3-2*d),blend=(a,b)=>a.map((value,i)=>value+(b[i]-value)*t);
      view={eye:blend(transition.from.eye,view.eye),target:blend(transition.from.target,view.target)};
      if(d>=1)transition=null;
    }
    currentPose=view;
    const {eye,target}=view;
    camera.position.set(...eye);
    camera.lookAt(...target);
    sun.target.position.set(target[0],target[1],target[2]);
    sun.position.copy(sun.target.position).add(new THREE.Vector3(-500,720,440));
    if(waveTime)waveTime.value=time;
    renderer.render(scene,camera);
    range.value=String(time);
    $('clock').textContent=`0:${String(Math.floor(time)).padStart(2,'0')} / 0:${FLIGHT_SECONDS}`;
    const phase=field&&field.cell.cell!=='H5' ?
      (field.cell.landDetail?(time<11?'Road approach':time<22?'Along the local road':'Above the landscape'):
        (time<12?'Over the water':time<24?'Marine features':'Above the seascape')):
      (time<11?'Village approach':time<22?'Through the village':'Across the valley');
    if(!inspection&&$('phase').textContent!==phase)$('phase').textContent=phase;
  }
  stage.append(canvas);
  resize();
  draw();
  $('poster').hidden=true;
  $('controls').hidden=false;
  $('mode').textContent='Live 3D flight';
  showPlay();
  new ResizeObserver(resize).observe(stage);
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();renderer.setAnimationLoop(null);
    canvas.remove();$('poster').hidden=false;$('controls').hidden=true;
    if($('detail-control'))$('detail-control').hidden=true;
    showStills('The 3D context was interrupted.');
  });
  function resumeRoute(){
    if(!inspection)return;
    transition={start:performance.now(),from:currentPose};
    inspection=null;
    $('detail-choice').value='';
    showFeature();
    dirty=true;
  }
  if(land){
    const inspect=feature=>{
      if(!feature){resumeRoute();return;}
      const [x,z]=land.toLocal(centerOf(feature));
      const level=Math.max(0,land.ground(x,z),...land.lakes.filter(l=>l.inside(x,z)).map(l=>l.level));
      const site=land.landmarks.find(landmark=>landmark.id===feature.id);
      const wide=feature.geometry.type==='Polygon';
      const dx=site?Math.max(105,site.radius*2.75):wide?570:175;
      const dz=dx*.8;
      const height=site?Math.max(60,site.radius*1.68):wide?520:136;
      transition={start:performance.now(),from:currentPose};
      inspection={eye:[x-dx,Math.max(level,land.ground(x-dx,z+dz))+height,z+dz],
        target:[x,level+(site?.model==='cathedral'?58:site?12:5),z]};
      playing=false;dirty=true;showPlay();
      showFeature(feature);
    };
    fieldPicker(field.features,'Drone route',inspect,field.selectedSite?.id);
    if(field.selectedSite){
      inspect(field.selectedSite);
      transition=null;
    }
  }
  play.onclick=()=>{
    resumeRoute();
    if(time>=FLIGHT_SECONDS){time=0;dirty=true;}
    playing=!playing;showPlay();
  };
  $('restart').onclick=()=>{resumeRoute();time=0;playing=true;dirty=true;showPlay();};
  range.oninput=()=>{
    resumeRoute();playing=false;time=Number(range.value);dirty=true;showPlay();
  };
  renderer.setAnimationLoop(now=>{
    if(playing && last){
      time=Math.min(FLIGHT_SECONDS,time+Math.min(.15,(now-last)/1000));
      if(time>=FLIGHT_SECONDS){playing=false;showPlay();}
      dirty=true;
    }
    last=now;
    if(dirty||transition){draw(now);dirty=false;}
  });
}

start().catch(error=>{
  console.warn(error);
  $('stage').querySelector('canvas')?.remove();
  $('poster').hidden=false;
  $('controls').hidden=true;
  if($('detail-control'))$('detail-control').hidden=true;
  showStills('Live flight could not start.');
});
