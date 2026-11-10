import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {centerOf, DETAIL_ZOOM, drawFlatLayer, indexLocalLayer, LOCAL_ZOOM, makeThreeLayer, MAX_ZOOM, SURFACES, zoomLevel} from './local-layer.js';
import {drawSettlements, makeSettlements, settlementModels} from './settlement-models.js';

const $ = (id) => document.getElementById(id);
const host = $('surface');
const map = $('map');
const status = $('status');
const response = await fetch('./atlas.json');
if (!response.ok) throw new Error('Could not load the atlas.');
const data = await response.json();
let local;
try {
  const [collection, manifest] = await Promise.all(['./lokallag.geojson', './lokallag-manifest.json'].map(async url => {
    const result = await fetch(url);
    if (!result.ok) throw new Error(`Could not load ${url}`);
    return result.json();
  }));
  local = indexLocalLayer(collection, manifest, data);
} catch (error) {
  console.warn(error);
  $('local-info').textContent = 'Could not load local details.';
  $('field').disabled = $('local-toggle').disabled = true;
}
const [west, north, spanX, spanZ] = data.bounds;
const cx = west + spanX / 2;
const cz = north + spanZ / 2;
const kinds = {capital:'Capital',city:'City','region-label':'Region',peak:'Summit',island:'Island'};
const settlements=settlementModels(local);
const pins = new Map();
let selected = '';
let view;
const places = data.places.map((p) => ({...p, px:p.x-cx, pz:p.z-cz}));
const placeById = new Map(places.map(p=>[p.id,p]));
const rankedPlaces = [...places].sort((a,b)=>priority(a.type)-priority(b.type));
const localPins = $('local-labels');
const field = $('field');
const localChoice = $('local-feature');
let activeCell, activeLevel, selectedLocal = '';
let localLabels = [];
let layerEnabled = true;

for (const key of local?.cells.keys() ?? []) field.add(new Option(key, key));

function focusLocal(x, z, zoom) {
  view.focus({x,z,px:x-cx,pz:z-cz}, zoom);
}
function chooseLocal(id) {
  const feature = local.features.get(id);
  if (!feature) {
    selectedLocal = '';
    $('local-description').textContent = '';
    return;
  }
  selectedLocal = id;
  const {description, surface, minZoom, type} = feature.properties;
  $('local-description').textContent = [SURFACES[surface]?.[0], description].filter(Boolean).join(' · ');
  const [x,z] = centerOf(feature);
  const closeZoom=type==='settlement' ? 128 : surface ? 32 : minZoom===4 ? DETAIL_ZOOM+1 : LOCAL_ZOOM+1;
  focusLocal(x, z, Math.max(view.magnification(), closeZoom));
}
function updateLocal(zoom, x, z) {
  const level = layerEnabled && local ? zoomLevel(zoom) : 2;
  const {cellSizeKm, columns, rows} = data.grid;
  const col = Math.floor(x/cellSizeKm), row = Math.floor(z/cellSizeKm);
  const key = level >= 3 && col >= 0 && col < columns.length && row >= 0 && row < rows ? columns[col] + (row+1) : '';
  if (activeCell === key && activeLevel === level) return level;
  const cell = local?.cells.get(key);
  const visible = cell?.features.filter(f => f.properties.minZoom <= level) ?? [];
  const preserve = visible.some(f => f.id === selectedLocal);
  activeCell = key;
  activeLevel = level;
  map.dataset.localLevel = String(level);
  $('map-level').textContent = level === 2 ? 'WORLD OVERVIEW' : `${level === 3 ? 'LOCAL AREA' : 'SITE DETAIL'}${key ? ' · '+key : ''}`;
  field.value = key;
  $('flight-link').href = `./field-flight.html?cell=${key||'H5'}`;
  $('flight-field').textContent = key ? `FIELD ${key}` : '192 ATLAS FIELDS';
  $('flight-hint').textContent = key ? '40-second drone flight' : 'Choose any field for a drone flight';
  localChoice.replaceChildren(new Option('Select a detail', ''));
  localChoice.disabled = !visible.length;
  localPins.replaceChildren();
  localLabels = [];
  for (const feature of visible) {
    const {name, type} = feature.properties;
    localChoice.add(new Option(name, feature.id));
    const pin = document.createElement('button');
    pin.className = 'pin local-pin';
    pin.dataset.type = type;
    pin.textContent = name;
    pin.onclick = () => {localChoice.value = feature.id; chooseLocal(feature.id);};
    localPins.append(pin);
    const [fx,fz] = centerOf(feature);
    localLabels.push({pin, id:feature.id, name, type, point:feature.geometry.type === 'Point', px:fx-cx, pz:fz-cz, x:fx,z:fz});
  }
  if (preserve) localChoice.value = selectedLocal;
  else {
    selectedLocal = '';
    $('local-description').textContent = '';
  }
  if (local) $('local-info').textContent = cell ?
    `${visible.length} proposals in ${key}${cell.landSourceConflict ? ' · Shoreline needs review' : ''}` :
    'Select a grid cell or zoom in on the map.';
  return level;
}

function choose(id) {
  const p = placeById.get(id);
  if (!p) return;
  pins.get(selected)?.classList.remove('active');
  selected = id;
  pins.get(id).classList.add('active');
  $('places').value = id;
  $('place-info').textContent = `${kinds[p.type]} · ${Math.round(p.x)}, ${Math.round(p.z)} km`;
  view.focus(p);
}
for (const p of [...places].sort((a,b)=>a.name.localeCompare(b.name))) {
  $('places').add(new Option(p.name,p.id));
}
for (const p of places) {
  const button = document.createElement('button');
  button.className='pin';
  button.dataset.type=p.type;
  button.textContent=p.name;
  button.addEventListener('click',()=>choose(p.id));
  $('labels').append(button);
  pins.set(p.id,button);
}
function layout(project, pixelsPerKm) {
  const w=host.clientWidth,h=host.clientHeight;
  const occupied=[];
  for(const p of [...rankedPlaces, ...localLabels]) {
    const [x,sy]=project(p);
    const y=sy-(p.type==='settlement' ? (p.id===selectedLocal ? 34 : 15) : 0);
    const pin=p.pin ?? pins.get(p.id);
    const hidden = (p.pin && !p.point && selectedLocal!==p.id) || x<12||x>w-12||y<34||y>h-20 ||
      (w<600 && pixelsPerKm<1.8 && !['capital','city'].includes(p.type)) ||
      (p.type==='peak' && pixelsPerKm<1.45);
    const half=Math.max(22,p.name.length*3.3);
    const box=[x-half,y-9,x+half,y+9];
    const covered=occupied.some(b=>box[0]<b[2]&&box[2]>b[0]&&box[1]<b[3]&&box[3]>b[1]);
    pin.hidden=hidden || (covered && selected!==p.id && selectedLocal!==p.id);
    if(p.pin) pin.classList.toggle('active',selectedLocal===p.id);
    if(pin.hidden) continue;
    occupied.push(box);
    pin.style.left=`${x}px`;
    pin.style.top=`${y}px`;
  }
  const km=[50,20,10,5,2,1,.5,.2,.1,.05].find(value=>value*pixelsPerKm<=Math.min(115,w*.23)) ?? .05;
  $('scale-line').style.width=`${km*pixelsPerKm}px`;
  $('scale-value').textContent=km<1 ? `${km*1000} m` : `${km} km`;
}
function priority(type){return ['capital','city','island','region-label','peak'].indexOf(type);}
function fit(){return Math.min(host.clientWidth/(spanX*1.03),host.clientHeight/(spanZ*1.03));}
const terrainBlend=zoom=>THREE.MathUtils.smoothstep(zoom,3.1,5.2);

function terrainMaterial(renderer) {
  const loader=new THREE.TextureLoader();
  const detail={value:0};
  const texture=(file)=>{
    const map=loader.load(file);
    map.colorSpace=THREE.SRGBColorSpace;
    map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return map;
  };
  const close=texture('./terrain-local.webp');
  const material=new THREE.MeshBasicMaterial({map:texture('./terrain.webp')});
  material.onBeforeCompile=shader=>{
    shader.uniforms.localMap={value:close};
    shader.uniforms.localDetail=detail;
    shader.uniforms.atlasSize={value:new THREE.Vector2(spanX,spanZ)};
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`
      #include <common>
      uniform sampler2D localMap;
      uniform float localDetail;
      uniform vec2 atlasSize;
      float gritHash(vec2 p) {
        p=fract(p*vec2(.1031,.11369));
        p+=dot(p,p.yx+19.19);
        return fract((p.x+p.y)*p.x);
      }
      float grit(vec2 p) {
        vec2 i=floor(p),f=fract(p);
        f=f*f*(3.-2.*f);
        return mix(mix(gritHash(i),gritHash(i+vec2(1,0)),f.x),
          mix(gritHash(i+vec2(0,1)),gritHash(i+vec2(1,1)),f.x),f.y)-.5;
      }
      float filteredGrit(vec2 p) {
        return grit(p)*(1.-smoothstep(.28,1.1,max(length(dFdx(p)),length(dFdy(p)))));
      }
    `).replace('#include <map_fragment>',`
      #include <map_fragment>
      vec3 nearColour=texture2D(localMap,vMapUv).rgb;
      vec2 km=vMapUv*atlasSize;
      float landGrain=filteredGrit(km*1.9)*.22+filteredGrit(km*6.7)*.32+
        filteredGrit(km*17.)*.26+filteredGrit(km*61.)*.16;
      float landMask=smoothstep(-.017,.014,nearColour.r-nearColour.b);
      nearColour*=1.+landGrain*landMask;
      diffuseColor.rgb=mix(diffuseColor.rgb,nearColour,localDetail);
    `);
  };
  return {material,update(zoom){detail.value=close.image ? terrainBlend(zoom) : 0;}};
}

function terrainGrain(context) {
  const tile=document.createElement('canvas');
  const size=256;
  tile.width=tile.height=size;
  const ctx=tile.getContext('2d');
  const image=ctx.createImageData(size,size);
  let seed=6081;
  const octave=count=>Array.from({length:count**2},()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/2**32;
  });
  const fields=[5,12,32,96].map(n=>[n,octave(n)]);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    let value=0;
    for(const [n,grid] of fields){
      const u=x*n/size,v=y*n/size,i=Math.floor(u),j=Math.floor(v);
      const f=t=>t*t*(3-2*t);
      const s=f(u-i),t=f(v-j);
      const sample=(a,b)=>grid[(b%n)*n+a%n];
      value+=((sample(i,j)*(1-s)+sample(i+1,j)*s)*(1-t)+(sample(i,j+1)*(1-s)+sample(i+1,j+1)*s)*t-.5)*
        (n===5?80:n===12?87:n===32?54:27);
    }
    const k=(y*size+x)*4;
    image.data[k]=image.data[k+1]=image.data[k+2]=128+value;
    image.data[k+3]=255;
  }
  ctx.putImageData(image,0,0);
  return context.createPattern(tile,'repeat');
}

function start3d(renderer, heights) {
  const n=data.resolution;
  if(heights.length!==n*n) throw new Error('Invalid elevation model.');
  host.append(renderer.domElement);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setClearColor(0x0e2b3e);
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,1,2600);
  const geometry=new THREE.PlaneGeometry(spanX,spanZ,n-1,n-1);
  geometry.rotateX(-Math.PI/2);
  const positions=geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++) positions.setY(i,heights[i]);
  geometry.computeVertexNormals();
  const reliefMaterial=terrainMaterial(renderer);
  const terrain=new THREE.Mesh(geometry,reliefMaterial.material);
  scene.add(terrain);
  function height(x,z){
    const u=THREE.MathUtils.clamp((x-west)/spanX,0,1)*(n-1);
    const v=THREE.MathUtils.clamp((z-north)/spanZ,0,1)*(n-1);
    const col=Math.min(Math.floor(u),n-2),row=Math.min(Math.floor(v),n-2);
    const dx=u-col,dz=v-row,i=row*n+col;
    const a=heights[i],b=heights[i+n],c=heights[i+n+1],d=heights[i+1];
    return dx+dz<=1 ? a+(d-a)*dx+(b-a)*dz : c+(b-c)*(1-dx)+(d-c)*(1-dz);
  }
  const localLayer=makeThreeLayer(local,height,cx,cz);
  scene.add(localLayer.root);
  const villages=makeSettlements(settlements,height,cx,cz);
  scene.add(villages);
  const segments=[];
  function add(a,b) {
    segments.push(a[0]-cx,height(...a)+.38,a[1]-cz,b[0]-cx,height(...b)+.38,b[1]-cz);
  }
  for(let x=0;x<=480;x+=30)for(let z=0;z<360;z+=2)add([x,z],[x,z+2]);
  for(let z=0;z<=360;z+=30)for(let x=0;x<480;x+=2)add([x,z],[x+2,z]);
  const gridGeom=new THREE.BufferGeometry();
  gridGeom.setAttribute('position',new THREE.Float32BufferAttribute(segments,3));
  const grid=new THREE.LineSegments(gridGeom,new THREE.LineBasicMaterial({color:0xe9f2de,transparent:true,opacity:.2,depthWrite:false}));
  scene.add(grid);
  grid.visible=$('grid').checked;
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.mouseButtons={LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.ROTATE};
  controls.touches={ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_ROTATE};
  controls.screenSpacePanning=true;
  controls.enableDamping=true;
  controls.minZoom=.75;
  controls.maxZoom=MAX_ZOOM;
  controls.maxPolarAngle=1.18;
  controls.minPolarAngle=.018;
  let mode='top';
  const vector=new THREE.Vector3();
  let projectionScale;
  function resize(){
    const w=host.clientWidth,h=host.clientHeight;
    projectionScale=fit();
    camera.left=-w/2/projectionScale;camera.right=-camera.left;
    camera.top=h/2/projectionScale;camera.bottom=-camera.top;
    camera.updateProjectionMatrix();
    renderer.setSize(w,h,false);
  }
  function setMode(value){
    mode=value;
    controls.enableRotate=mode==='tilt';
    const polar=mode==='tilt'?.36:.018;
    camera.position.copy(controls.target).add(new THREE.Vector3(0,620*Math.cos(polar),620*Math.sin(polar)));
    controls.update();
    $('top').setAttribute('aria-pressed',String(mode==='top'));
    $('tilt').setAttribute('aria-pressed',String(mode==='tilt'));
  }
  function reset(){
    controls.target.set(0,0,0);
    camera.zoom=1;
    camera.updateProjectionMatrix();
    setMode('tilt');
  }
  function zoom(factor){
    camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,controls.minZoom,controls.maxZoom);
    camera.updateProjectionMatrix();
  }
  function focus(p, magnification=2.4){
    const offset=camera.position.clone().sub(controls.target);
    controls.target.set(p.px,height(p.x,p.z),p.pz);
    camera.position.copy(controls.target).add(offset);
    camera.zoom=magnification;
    camera.updateProjectionMatrix();
    controls.update();
  }
  resize();
  reset();
  new ResizeObserver(resize).observe(host);
  renderer.setAnimationLoop(()=>{
    controls.update();
    const level=updateLocal(camera.zoom,controls.target.x+cx,controls.target.z+cz);
    localLayer.show(level);
    villages.visible=level>=4;
    reliefMaterial.update(camera.zoom);
    renderer.render(scene,camera);
    layout((p)=>{
      vector.set(p.px,height(p.x,p.z)+(camera.zoom>=DETAIL_ZOOM?.05:.75),p.pz).project(camera);
      return [(vector.x+1)*host.clientWidth/2,(1-vector.y)*host.clientHeight/2];
    },projectionScale*camera.zoom);
  });
  status.textContent='Three.js · 3D terrain';
  map.dataset.renderer='three';
  return {setMode,reset,zoom,focus,magnification:()=>camera.zoom,refresh(){},grid:(visible)=>{grid.visible=visible;}};
}

function start2d(){
  const canvas=document.createElement('canvas');
  canvas.setAttribute('aria-label','Flat map');
  host.append(canvas);
  const context=canvas.getContext('2d');
  const grain=terrainGrain(context);
  const terrain=new Image();
  const localTerrain=new Image();
  let panX=0,panZ=0,magnification=1,showGrid=$('grid').checked;
  const pointers=new Map();
  function render(){
    const w=host.clientWidth,h=host.clientHeight,ratio=Math.min(devicePixelRatio,2),s=fit()*magnification;
    canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
    context.scale(ratio,ratio);
    const project=(x,z)=>[w/2+(x-panX)*s,h/2+(z-panZ)*s];
    const frame=[...project(-spanX/2,-spanZ/2),spanX*s,spanZ*s];
    const blend=localTerrain.naturalWidth ? terrainBlend(magnification) : 0;
    if(terrain.naturalWidth && blend<1) context.drawImage(terrain,...frame);
    if(blend>0){
      context.globalAlpha=blend;
      context.drawImage(localTerrain,...frame);
      context.globalAlpha=1;
    }
    if(grain && magnification>9){
      const scale=3.8*s/256;
      grain.setTransform(new DOMMatrix([scale,0,0,scale,frame[0],frame[1]]));
      context.save();
      context.globalCompositeOperation='soft-light';
      context.globalAlpha=THREE.MathUtils.smoothstep(magnification,9,30)*.72;
      context.fillStyle=grain;
      context.fillRect(...frame);
      context.restore();
    }
    if(showGrid){
      context.strokeStyle='#e9f2de38';context.beginPath();
      for(let x=0;x<=480;x+=30){context.moveTo(...project(x-west-spanX/2,-north-spanZ/2));context.lineTo(...project(x-west-spanX/2,360-north-spanZ/2));}
      for(let z=0;z<=360;z+=30){context.moveTo(...project(-west-spanX/2,z-north-spanZ/2));context.lineTo(...project(480-west-spanX/2,z-north-spanZ/2));}
      context.stroke();
    }
    const level=updateLocal(magnification,panX+cx,panZ+cz);
    const projectWorld=(x,z)=>project(x-cx,z-cz);
    drawFlatLayer(local,level,context,projectWorld,s);
    if(level>=4)drawSettlements(context,projectWorld,settlements,s);
    layout(p=>project(p.px,p.pz),s);
  }
  function zoom(factor){magnification=Math.max(.75,Math.min(MAX_ZOOM,magnification*factor));render();}
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.12:1/1.12);},{passive:false});
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);});
  canvas.addEventListener('pointermove',e=>{
    const old=pointers.get(e.pointerId);
    if(!old)return;
    const other=[...pointers].find(([id])=>id!==e.pointerId)?.[1];
    const [x,y]=[e.clientX,e.clientY];
    const s=fit()*magnification;
    panX-=(x-old[0])/s/(other?2:1);panZ-=(y-old[1])/s/(other?2:1);
    pointers.set(e.pointerId,[x,y]);
    if(other){const before=Math.hypot(old[0]-other[0],old[1]-other[1]);if(before>1)zoom(Math.hypot(x-other[0],y-other[1])/before);else render();}
    else render();
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>pointers.delete(e.pointerId));
  new ResizeObserver(render).observe(host);
  terrain.onload=render;
  terrain.src='./terrain.webp';
  localTerrain.onload=render;
  localTerrain.src='./terrain-local.webp';
  $('tilt').disabled=true;
  status.textContent='Flat map · WebGL unavailable';
  map.dataset.renderer='flat';
  return {
    setMode(){},reset(){panX=0;panZ=0;magnification=1;render();},zoom,
    focus(p,value=2.4){panX=p.px;panZ=p.pz;magnification=value;render();},
    magnification:()=>magnification,refresh:render,grid(value){showGrid=value;render();},
  };
}
try{
  const canvas=document.createElement('canvas');
  const context=canvas.getContext('webgl2',{antialias:true});
  if(!context)throw new Error('WebGL2 unavailable.');
  const response=await fetch('./elevation.bin');
  if(!response.ok)throw new Error('Could not load the elevation model.');
  view=start3d(new THREE.WebGLRenderer({canvas,context,antialias:true}),new Float32Array(await response.arrayBuffer()));
}catch(error){
  console.warn(error);
  host.replaceChildren();
  view=start2d();
}
$('top').onclick=()=>view.setMode('top');
$('tilt').onclick=()=>view.setMode('tilt');
$('plus').onclick=()=>view.zoom(1.32);
$('minus').onclick=()=>view.zoom(1/1.32);
$('reset').onclick=()=>view.reset();
$('grid').onchange=e=>view.grid(e.target.checked);
$('places').onchange=e=>choose(e.target.value);
function openField(key){
  const cell=local?.cells.get(key);
  if (!cell) return;
  $('local-toggle').checked=layerEnabled=true;
  const [x,z,e,s]=cell.boundsKm;
  focusLocal((x+e)/2,(z+s)/2,LOCAL_ZOOM+1.5);
}
field.onchange=()=>openField(field.value);
localChoice.onchange=()=>chooseLocal(localChoice.value);
$('local-toggle').onchange=e=>{layerEnabled=e.target.checked;view.refresh();};
openField(new URLSearchParams(location.search).get('cell'));
