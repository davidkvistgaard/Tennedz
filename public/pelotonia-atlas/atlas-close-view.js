import * as THREE from './vendor/three.module.js';
import {buildField} from './field-landscape.js';
import {buildH5} from './h5-landscape.js';
import {addTerrainDetail, animateWater} from './landscape-materials.js';

const PATCH_KM = 3;
const SUN = new THREE.Vector3(-.5, .72, .44).normalize();

function dispose(group) {
  const geometries = new Set(), materials = new Set();
  group.traverse(object => {
    if (!object.isMesh && !object.isLine) return;
    geometries.add(object.geometry);
    materials.add(object.material);
    if (object.isInstancedMesh) object.dispose();
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

function makeGrid(land, cell) {
  const positions = [];
  const [west, north, east, south] = cell.boundsKm;
  const point = (x, z) => {
    const [u, v] = land.toLocal([x,z]);
    return [u, Math.max(0, land.ground(u,v)) + 1.2, v];
  };
  for (const x of [west, east]) {
    for (let z = north; z < south; z += .25) positions.push(...point(x,z), ...point(x,z+.25));
  }
  for (const z of [north, south]) {
    for (let x = west; x < east; x += .25) positions.push(...point(x,z), ...point(x+.25,z));
  }
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color:0xffebbf, transparent:true, opacity:.54}));
}

export function makeAtlasCloseView({atlas, geography, heights, cells}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a9bec3');
  scene.fog = new THREE.Fog('#a9bec3', 1000, 26000);
  const sun = new THREE.DirectionalLight('#ffe3ba', 2.8);
  sun.position.copy(SUN).multiplyScalar(900);
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.bias = -.00013;
  sun.shadow.normalBias = .35;
  scene.add(new THREE.HemisphereLight('#d5e7ef','#797254',2.1), sun, sun.target);
  const camera = new THREE.OrthographicCamera();
  const vector = new THREE.Vector3();
  let patch, lastFrame;
  let previousTilt;
  let lastMove = 0;
  let pending, failed;

  function activate(request, renderer) {
    const {cell, focus, key} = request;
    const {land, group} = buildField({atlas, geography, heights, cell, features:cell.features, atlasFocus:focus});
    const grid = makeGrid(land, cell);
    group.add(grid);
    configure(group);
    replace({key, land, group, grid, focus, cell:cell.cell});
    renderer.shadowMap.needsUpdate = true;
  }

  function configure(group) {
    addTerrainDetail(group.children[0].material);
    const road = group.children.find(mesh => /asphalt/i.test(mesh.name));
    if (road) addTerrainDetail(road.material);
    const water = group.children.find(mesh => mesh.userData.water);
    if (water) animateWater(water.material);
  }

  function replace(next) {
    if (patch) {
      scene.remove(patch.group);
      dispose(patch.group);
    }
    patch = next;
    scene.add(patch.group);
    lastFrame = null;
  }

  function h5Request(cell, x, z, widthKm) {
    if (cell.cell !== 'H5' || widthKm > 3.2) return;
    const village = cell.features.find(f => f.id === 'LOCAL-H5-village');
    const route = cell.features.find(f => f.id === 'LOCAL-H5-road-asphalt');
    if (!village || !route) return;
    const point = village.geometry.coordinates;
    if (Math.hypot(x-point[0],z-point[1]) > 1.15) return;
    return {key:'H5:flight', cell, village, route};
  }

  function activateH5({key,cell,village,route}, renderer) {
    const {land,group} = buildH5(route,village);
    configure(group);
    replace({key,land,group,cell:cell.cell});
    renderer.shadowMap.needsUpdate = true;
  }

  function requestAt(cell, x, z, widthKm) {
    const authored = h5Request(cell, x, z, widthKm);
    if (authored) return authored;
    const [west,north] = cell.boundsKm;
    const ix = Math.floor((x-west)/PATCH_KM);
    const iz = Math.floor((z-north)/PATCH_KM);
    const focus = [west+(ix+.5)*PATCH_KM,north+(iz+.5)*PATCH_KM];
    return {cell, focus, key:cell.cell+':'+ix+':'+iz};
  }

  function render(renderer, {x,z,zoom,ortho,offset,grid}, now) {
    const col = Math.floor(x/atlas.grid.cellSizeKm), row = Math.floor(z/atlas.grid.cellSizeKm);
    const column = atlas.grid.columns[col];
    const cell = column && cells.get(column+(row+1));
    if (!cell) return 'unavailable';
    const halfWidth = (ortho.right-ortho.left)*500/zoom;
    const halfHeight = (ortho.top-ortho.bottom)*500/zoom;
    const request = requestAt(cell,x,z,Math.max(halfWidth,halfHeight)/500);
    if (request.key !== patch?.key && request.key !== failed) {
      // Only build after the focus stays in the same patch across frames.
      if (pending?.key !== request.key) pending = {key:request.key,since:now};
      else if (now-pending.since>120) {
        try {
          if (request.route) activateH5(request,renderer);
          else activate(request,renderer);
        } catch (error) {
          failed = request.key;
          console.warn('Could not build the close atlas scene.',error);
        }
      }
    }
    if (patch?.key !== request.key) {
      const usable = patch?.focus && Math.hypot(x-patch.focus[0],z-patch.focus[1]) < 6;
      if (!usable) return request.key === failed ? 'unavailable' : 'loading';
    } else {
      pending = undefined;
    }

    const {land} = patch;
    const [u,v] = land.toLocal([x,z]);
    const [aheadX,aheadZ] = land.toLocal([x+offset.x,z+offset.z]);
    const y = Math.max(0,land.ground(u,v),...(land.lakes??[]).filter(lake=>lake.inside(u,v)).map(lake=>lake.level));
    const baseTilt = Math.atan2(Math.hypot(offset.x,offset.z),offset.y);
    const pitch = baseTilt < .05 ? baseTilt : Math.max(baseTilt,THREE.MathUtils.lerp(.36,.94,THREE.MathUtils.smoothstep(zoom,18,110)));
    const dt = lastMove ? Math.max(0,now-lastMove) : 16;
    lastMove = now;
    previousTilt = THREE.MathUtils.lerp(previousTilt??baseTilt,pitch,1-Math.exp(-dt/85));
    if (Math.abs(previousTilt-pitch)<.001) previousTilt=pitch;
    const heading = Math.atan2(aheadX-u,aheadZ-v);
    const distance = Math.max(900, Math.max(halfWidth,halfHeight)*2.6);
    const frame = [u,v,y,halfWidth,halfHeight,heading,previousTilt,grid];
    if (lastFrame?.every((value,i)=>value===frame[i])) return 'retained';
    lastFrame = frame;
    camera.left=-halfWidth; camera.right=halfWidth; camera.top=halfHeight; camera.bottom=-halfHeight;
    camera.near=1; camera.far=distance+45000;
    camera.position.set(u+distance*Math.sin(previousTilt)*Math.sin(heading),
      y+distance*Math.cos(previousTilt),v+distance*Math.sin(previousTilt)*Math.cos(heading));
    camera.lookAt(u,y,v);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    scene.fog.near=Math.max(0,distance-1000);
    scene.fog.far=distance+24000;
    const shadowSize = Math.max(halfWidth,halfHeight)*1.45;
    sun.castShadow=shadowSize<=2600;
    if (sun.castShadow) {
      const shadowDistance=Math.max(900,shadowSize*2.2);
      sun.target.position.set(u,y,v);
      sun.position.copy(sun.target.position).addScaledVector(SUN,shadowDistance);
      Object.assign(sun.shadow.camera,{left:-shadowSize,right:shadowSize,top:shadowSize,bottom:-shadowSize,
        near:20,far:shadowDistance+shadowSize*2.3});
      sun.shadow.camera.updateProjectionMatrix();
      renderer.shadowMap.needsUpdate=true;
    }
    if (patch.grid) patch.grid.visible=grid;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = sun.castShadow;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.render(scene,camera);
    return 'rendered';
  }

  function project(place,width,height) {
    const [u,v]=patch.land.toLocal([place.x,place.z]);
    const y=Math.max(0,patch.land.ground(u,v));
    vector.set(u,y+2,v).project(camera);
    return [(vector.x+1)*width/2,(1-vector.y)*height/2];
  }

  function invalidate() { lastFrame=null; }

  return {render,project,invalidate};
}
