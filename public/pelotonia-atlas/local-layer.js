import * as THREE from 'three';

export const LOCAL_ZOOM = 4;
export const DETAIL_ZOOM = 8;
export const MAX_ZOOM = 180;
export const SURFACES = {
  asphalt: ['Asphalt', '#62655e'],
  gravel: ['Gravel', '#b1a182'],
  cobblestone: ['Cobblestone', '#8c8779'],
  dirt: ['Dirt', '#947756'],
};
const roadVerge = '#544c3c';
const roadWidths = {asphalt:.028,gravel:.022,cobblestone:.020,dirt:.016};
const water = '#69c2d3';
const greenery = '#b1c176';

export function zoomLevel(zoom) {
  return zoom >= DETAIL_ZOOM ? 4 : zoom >= LOCAL_ZOOM ? 3 : 2;
}

export function indexLocalLayer(collection, manifest, atlas) {
  if (manifest.baseSha256 !== atlas.sourceHash || collection.coordinateSystem.id !== 'pelotonia-local-km') {
    throw new Error('The local layer requires a different atlas reference.');
  }
  const features = new Map(collection.features.map(f => [f.id, f]));
  const roadVertices=new Map();
  for(const feature of features.values()) {
    if(feature.properties.type!=='road') continue;
    for(const point of feature.geometry.coordinates) {
      const key=point.join(',');
      roadVertices.set(key,(roadVertices.get(key)??0)+1);
    }
  }
  const junctions=new Set([...roadVertices].filter(([,count])=>count>1).map(([key])=>key));
  const cells = new Map(manifest.cells.map(cell => [cell.cell, {
    ...cell, features: cell.featureIds.map(id => {
      const feature = features.get(id);
      if (feature?.properties.gridCell !== cell.cell) throw new Error('Invalid feature reference in the local layer.');
      return feature;
    }),
  }]));
  if (cells.size !== atlas.grid.columns.length * atlas.grid.rows) throw new Error('Grid cells are missing from the local layer.');
  return {cells, features, junctions};
}

export function centerOf(feature) {
  const {type, coordinates} = feature.geometry;
  if (type === 'Point') return coordinates;
  if (type === 'LineString') return coordinates[Math.floor(coordinates.length / 2)];
  const ring = coordinates[0].slice(0, -1);
  return [0, 1].map(i => ring.reduce((sum, p) => sum + p[i], 0) / ring.length);
}

function tint(feature) {
  const {surface, domain, type} = feature.properties;
  return SURFACES[surface]?.[1] ?? (
    domain === 'water' || ['lake', 'wetland'].includes(type) ? water :
    ['settlement', 'landmark'].includes(type) ? '#ffdfa0' :
    ['salt_flat', 'dry_basin', 'lava_field'].includes(type) ? '#e8bb89' : greenery
  );
}

const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const length = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mix = (a,b,t) => [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];

function roadCurve(points,junctions) {
  const curve = [points[0]];
  for (let i=1;i<points.length-1;i++) {
    const [a,b,c] = points.slice(i-1,i+2);
    if(junctions.has(b.join(','))) {curve.push(b);continue;}
    const trim = Math.min(length(a,b),length(b,c),.8)*.45;
    if(!trim) continue;
    const u=mix(b,a,trim/length(b,a)),v=mix(b,c,trim/length(b,c));
    for (let k=0;k<=6;k++){
      const t=k/6;
      curve.push(mix(mix(u,b,t),mix(b,v,t),t));
    }
  }
  curve.push(points.at(-1));
  return curve;
}

function ribbon(curve, width, emit) {
  const dense=[curve[0]];
  for(let i=1;i<curve.length;i++){
    const a=curve[i-1],b=curve[i],steps=Math.max(1,Math.ceil(length(a,b)/.08));
    for(let j=1;j<=steps;j++) dense.push(mix(a,b,j/steps));
  }
  const sides=dense.map(([x,z],i)=>{
    const a=dense[Math.max(0,i-1)],b=dense[Math.min(dense.length-1,i+1)];
    const scale=width/(length(a,b)||1),dx=(b[1]-a[1])*scale,dz=(a[0]-b[0])*scale;
    return [[x+dx,z+dz],[x-dx,z-dz]];
  });
  for(let i=1;i<sides.length;i++){
    const [a,b]=sides[i-1], [c,d]=sides[i];
    triangle(a,b,c,emit);triangle(b,d,c,emit);
  }
}

// Densify terrain overlays so their interiors follow the relief as well as their edges.
function triangle(a, b, c, emit, depth = 0) {
  if (depth >= 5 || Math.max(length(a, b), length(b, c), length(c, a)) <= .36) {
    emit(a); emit(b); emit(c);
    return;
  }
  const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
  triangle(a, ab, ca, emit, depth + 1);
  triangle(ab, b, bc, emit, depth + 1);
  triangle(ca, bc, c, emit, depth + 1);
  triangle(ab, bc, ca, emit, depth + 1);
}

export function makeThreeLayer(local, height, cx, cz) {
  const root = new THREE.Group();
  if (!local) return {root, show() {}};
  const groups = [new THREE.Group(), new THREE.Group()];
  groups.forEach(group => root.add(group));
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 32;
  const ctx = sprite.getContext('2d');
  ctx.beginPath(); ctx.arc(16, 16, 13, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.strokeStyle = '#233e38'; ctx.lineWidth = 4; ctx.stroke();
  const map = new THREE.CanvasTexture(sprite);
  const vergeColor = new THREE.Color(roadVerge);

  for (const [index, group] of groups.entries()) {
    const areas = {position: [], color: []};
    const roads = {position: [], color: []};
    const verges = {position: [], color: []};
    const points = {position: [], color: []};
    for (const feature of local.features.values()) {
      if (feature.properties.minZoom !== index + 3) continue;
      const {type, coordinates} = feature.geometry;
      if (feature.properties.type === 'settlement') continue;
      const bucket = type === 'Point' ? points : type === 'LineString' ? roads : areas;
      const color = new THREE.Color(tint(feature));
      const lift = type === 'Point' ? .035 : type === 'LineString' ? .014 : .075;
      const emit = ([x, z]) => {
        bucket.position.push(x - cx, height(x, z) + lift, z - cz);
        bucket.color.push(color.r, color.g, color.b);
      };
      if (type === 'Point') emit(coordinates);
      if (type === 'Polygon') {
        const ring = coordinates[0].slice(0, -1);
        const faces = THREE.ShapeUtils.triangulateShape(ring.map(p => new THREE.Vector2(...p)), []);
        for (const [a, b, c] of faces) triangle(ring[a], ring[b], ring[c], emit);
      }
      if (type === 'LineString') {
        const curve=roadCurve(coordinates,local.junctions);
        const half=roadWidths[feature.properties.surface]/2;
        ribbon(curve,half+.008,([x,z])=>{
          verges.position.push(x-cx,height(x,z)+.011,z-cz);
          verges.color.push(vergeColor.r,vergeColor.g,vergeColor.b);
        });
        ribbon(curve,half,emit);
      }
    }
    const geometry = (bucket) => new THREE.BufferGeometry()
      .setAttribute('position', new THREE.Float32BufferAttribute(bucket.position, 3))
      .setAttribute('color', new THREE.Float32BufferAttribute(bucket.color, 3));
    const areaMesh = new THREE.Mesh(geometry(areas), new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: .38, depthWrite: false,
    }));
    areaMesh.renderOrder = 1;
    const roadMaterial = new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
    const vergeMesh=new THREE.Mesh(geometry(verges),roadMaterial);
    const roadMesh=new THREE.Mesh(geometry(roads),roadMaterial);
    const markers = new THREE.Points(geometry(points), new THREE.PointsMaterial({
      vertexColors: true, map, size: index ? 6 : 8, sizeAttenuation: false, transparent: true, alphaTest: .3,
    }));
    group.add(areaMesh, vergeMesh, roadMesh, markers);
  }
  return {root, show(level) {groups.forEach((group, i) => group.visible = level >= i + 3);}};
}

export function drawFlatLayer(local, level, context, project, pixelsPerKm) {
  if (!local || level < 3) return;
  context.save();
  for (const type of ['Polygon', 'LineString', 'Point']) {
    for (const feature of local.features.values()) {
      if (feature.geometry.type !== type || feature.properties.minZoom > level) continue;
      if (feature.properties.type === 'settlement') continue;
      const {coordinates} = feature.geometry;
      context.beginPath();
      context.fillStyle = context.strokeStyle = tint(feature);
      context.globalAlpha = type === 'Polygon' ? .38 : .95;
      if (type === 'Point') {
        const [x, y] = project(...coordinates);
        context.arc(x, y, feature.properties.minZoom === 3 ? 3.5 : 2.5, 0, Math.PI * 2);
      } else {
        const points = type === 'Polygon' ? coordinates[0] : roadCurve(coordinates,local.junctions);
        context.moveTo(...project(...points[0]));
        for (const p of points.slice(1)) context.lineTo(...project(...p));
      }
      if (type === 'LineString') {
        const width=Math.max(.85,pixelsPerKm*roadWidths[feature.properties.surface]);
        context.lineJoin = context.lineCap = 'round';
        const material=context.strokeStyle;
        context.lineWidth=width+Math.max(.5,pixelsPerKm*.016);
        context.strokeStyle=roadVerge;
        context.stroke();
        context.lineWidth=width;
        context.strokeStyle=material;
        context.stroke();
      } else {
        context.fill();
      }
    }
  }
  context.restore();
}
