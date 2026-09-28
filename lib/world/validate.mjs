import { GRID, isGridId, cellGeometry } from './grid.mjs';
import { lineCells, traceLineCells, contiguousCellSequence } from './network.mjs';
import { validateConnectivity } from './connectivity-validate.mjs';

export const WORLD_TYPES = Object.freeze(['planet','island_nation','grid_cell','region','mountain','icefield','lake','escarpment','canyon','waterfall_country','waterfall','river_system','settlement','district','landmark','fixed_connection','tunnel','dam','airport','port','volcano','road','rail','ferry_terminal','ferry_route','settlement_corridor','mountain_system','local_area','site_area','marine_feature','hill','arch','hydro_works','geothermal_plant','bay','caldera','channel','cliff','estuary','fjord','forest','geothermal_field','glacier','gorge','grassland','harbour','headland','headwater','heath','hot_spring','island','lagoon','lava_field','lighthouse','meadow','mesa','moor','pass','rainforest','reef','ridge','river','salt_flat','sound','valley','viaduct','wadi','wetland','woodland']);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const zoom = value => Number.isInteger(value) && value >= 0 && value <= 4;
const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const line = value => Array.isArray(value) && value.length >= 2 && value.every(point);
const ring = value => Array.isArray(value) && value.length >= 4 && value.every(point) && value[0].every((n,i) => n === value.at(-1)[i]);
const polygon = value => Array.isArray(value) && value.length > 0 && value.every(ring);
const geometries = {
  Point: point,
  MultiPoint: value => Array.isArray(value) && value.length > 0 && value.every(point),
  LineString: line,
  MultiLineString: value => Array.isArray(value) && value.length > 0 && value.every(line),
  Polygon: polygon,
  MultiPolygon: value => Array.isArray(value) && value.length > 0 && value.every(polygon),
};

/** Returns all validation errors. Incomplete source geography is allowed explicitly as null geometry. */
export function validateWorld(world) {
  const errors = [];
  const fail = (where,message) => errors.push(`${where}: ${message}`);
  if (!record(world)) return ['world: expected an object'];
  if (world.schemaVersion !== 1) fail('world','unsupported schemaVersion');
  if (typeof world.datasetVersion !== 'string' || !/^\d+\.\d+$/.test(world.datasetVersion)) fail('world','invalid datasetVersion');
  if (typeof world.title !== 'string' || !world.title.trim()) fail('world','missing title');
  if (world.coordinateSystem?.id !== 'pelotonia-local-km' || world.coordinateSystem?.units !== 'km' || world.coordinateSystem?.xDirection !== 'east' || world.coordinateSystem?.yDirection !== 'south' || world.coordinateSystem?.earthAnchor !== null) fail('world','schema v1 requires unanchored local km coordinates, not WGS84');
  for (const [key,value] of Object.entries(GRID)) if (world.grid?.[key] !== value) fail('grid',`invalid ${key}`);
  if (!Array.isArray(world.levels) || world.levels.length !== 5 || world.levels.some((l,i) => l?.level !== i || typeof l.name !== 'string')) fail('levels','expected L0–L4');
  if (!Array.isArray(world.objects)) return [...errors,'world: objects must be an array'];
  const ids = new Map();
  const sourceAliases = new Set();
  for (const o of world.objects) {
    if (!record(o)) { fail('object','expected an object'); continue; }
    const at = o.id ?? 'object';
    if (typeof o.id !== 'string' || !/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/.test(o.id)) fail(at,'invalid stable ID');
    if (ids.has(o.id)) fail(at,'duplicate stable ID'); else ids.set(o.id,o);
    if (o.name !== null && (typeof o.name !== 'string' || !o.name.trim())) fail(at,'name must be nonempty or explicitly null');
    if (o.name === null && o.properties?.namePending !== true) fail(at,'unnamed object requires namePending');
    if (!['fixed','canonical_editable','concept'].includes(o.status)) fail(at,'invalid status');
    if (!WORLD_TYPES.includes(o.type)) fail(at,'invalid type');
    if (o.parentId !== null && typeof o.parentId !== 'string') fail(at,'parentId must be ID or null');
    if (!zoom(o.minZoom) || (o.maxZoom !== null && (!zoom(o.maxZoom) || o.maxZoom < o.minZoom))) fail(at,'invalid zoom range');
    if (typeof o.description !== 'string' || !record(o.properties)) fail(at,'description and structured properties required');
    if (o.properties?.sourceAliases !== undefined) {
      if(!Array.isArray(o.properties.sourceAliases)||o.properties.sourceAliases.some(a=>typeof a!=='string'||!/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/.test(a))) fail(at,'invalid stable source alias');
      else for(const alias of o.properties.sourceAliases){if(sourceAliases.has(alias))fail(at,'duplicate stable source alias');sourceAliases.add(alias);}
    }
    if (!Array.isArray(o.gridCells) || o.gridCells.some(c => !isGridId(c)) || new Set(o.gridCells).size !== o.gridCells.length) fail(at,'invalid or duplicate grid IDs');
    if (!Array.isArray(o.relations) || o.relations.some(r => !record(r) || typeof r.kind !== 'string' || !r.kind.trim() || typeof r.targetId !== 'string')) fail(at,'invalid relations');
    if (o.geometry !== null && (!record(o.geometry) || o.geometry.coordinateSystem !== 'pelotonia-local-km' || !geometries[o.geometry.type]?.(o.geometry.coordinates))) fail(at,'invalid local geometry');
    if (o.focusBounds !== undefined && (!Array.isArray(o.focusBounds) || o.focusBounds.length !== 4 || !o.focusBounds.every(Number.isFinite) || o.focusBounds[0] >= o.focusBounds[2] || o.focusBounds[1] >= o.focusBounds[3])) fail(at,'invalid focus bounds');
    if (o.representations !== undefined) {
      if (!Array.isArray(o.representations)) fail(at,'representations must be an array');
      else for (const r of o.representations) {
        if (!record(r) || !zoom(r.minZoom) || !zoom(r.maxZoom) || r.maxZoom < r.minZoom || typeof r.style !== 'string' || !r.style.trim() || typeof r.label !== 'boolean' || !record(r.geometry) || r.geometry.coordinateSystem !== 'pelotonia-local-km' || !geometries[r.geometry.type]?.(r.geometry.coordinates)) fail(at,'invalid representation');
      }
    }
    if (o.type === 'district' && ids.get(o.parentId)?.type === 'planet') fail(at,'district must belong to a settlement');
    if (o.properties?.continuity === 'national') {
      try {
        const traced=lineCells(o.geometry);
        if (!contiguousCellSequence(traceLineCells(o.geometry)) || JSON.stringify(traced)!==JSON.stringify(o.gridCells)) fail(at,'discontinuous national network references');
      } catch { fail(at,'invalid national network geometry'); }
    }

  }
  for (const o of ids.values()) {
    if(sourceAliases.has(o.id)) fail(o.id,'source alias collides with primary ID');
    if (o.parentId !== null && !ids.has(o.parentId)) fail(o.id,'broken parent reference');
    const parentObject=ids.get(o.parentId);
    if(parentObject?.type==='region'&&o.gridCells?.some(cell=>!parentObject.gridCells.includes(cell))) fail(o.id,'placed outside parent region');
    if(o.properties?.placementStatus==='cell-only'&&o.gridCells?.length===0) fail(o.id,'cell-only object needs a grid cell');
    if(o.properties?.placementStatus==='region-only'&&o.gridCells?.length!==0) fail(o.id,'region-only object must not claim a cell');
    if (o.type === 'district' && ids.get(o.parentId)?.type !== 'settlement') fail(o.id,'district must belong to a settlement');
    if (o.type === 'landmark' && !['settlement','district','landmark'].includes(ids.get(o.parentId)?.type)) fail(o.id,'landmark must belong to a settlement, district or site');

    if (o.parentId === null && o.id !== 'EARTH-001') fail(o.id,'only Earth may be root');
    const path = new Set([o.id]); let parent = ids.get(o.parentId);
    while (parent) {
      if (path.has(parent.id)) { fail(o.id,'containment cycle'); break; }
      path.add(parent.id); parent = ids.get(parent.parentId);
    }
    if (Array.isArray(o.relations)) for (const r of o.relations) if (r && !ids.has(r.targetId)) fail(o.id,'broken relation reference');
    if (Array.isArray(o.gridCells)) for (const c of o.gridCells) if (ids.get(`GRID-${c}`)?.type !== 'grid_cell') fail(o.id,'missing grid reference');
    if (o.type === 'grid_cell') {
      const cell = o.id.replace(/^GRID-/, '');
      if (!isGridId(cell) || o.gridCells?.length !== 1 || o.gridCells[0] !== cell) fail(o.id,'grid identity mismatch');
      else {
        if (o.properties?.column !== cell[0] || o.properties?.row !== Number(cell.slice(1))) fail(o.id,'grid index mismatch');
        if (JSON.stringify(o.geometry) !== JSON.stringify(cellGeometry(cell))) fail(o.id,'grid geometry mismatch');
      }
      const code = o.properties?.environmentCode;
      if (!['O','S','H','W','R','M','C','V','E','D','F','L','I','P'].includes(code)) fail(o.id,'unknown environmental code');
      if (o.properties?.classificationStatus !== 'defined') fail(o.id,'classification must be defined');
      if (code === 'P' && o.properties?.regionId !== 'REG-NORTHERN-PLATEAU') fail(o.id,'P must reference REG-NORTHERN-PLATEAU');
      if (code === 'O' && o.properties.regionId !== null) fail(o.id,'ocean must not reference a land region');
      if (code !== 'O') {
        const region = ids.get(o.properties?.regionId);
        if (region?.type !== 'region' || region.properties?.environmentCode !== code || !region.gridCells?.includes(cell)) fail(o.id,'broken region reference/classification');
      }
      if (world.datasetVersion !== '1.0' && world.objects.length > 300) {
        if (code !== 'O' && (typeof o.properties.localIdentity?.name !== 'string' || o.properties.localIdentity.status !== 'canonical_editable')) fail(o.id,'land cell requires editable local identity');
        if (code === 'O' && o.properties.localIdentity !== null) fail(o.id,'ocean local identity must be null');
      }
    }
    if (o.type === 'region' && Array.isArray(o.gridCells)) for (const c of o.gridCells) {
      if (ids.get(`GRID-${c}`)?.properties?.regionId !== o.id) fail(o.id,'region coverage mismatch');
    }
  }
  if (ids.get('EARTH-001')?.type !== 'planet' || ids.get('WORLD-001')?.type !== 'island_nation' || ids.get('WORLD-001')?.parentId !== 'EARTH-001') fail('world','missing Earth/Pelotonia roots');
  if (world.objects.filter(o => o?.type === 'grid_cell').length !== 192) fail('grid','expected exactly 192 macro cells');
  if (world.datasetVersion !== '1.0' && world.objects.length > 300) for (const cell of world.objects.filter(o=>o?.type==='grid_cell'&&o.properties?.environmentCode!=='O')) {
    const elevation=cell.properties.elevation;
    if (!Number.isFinite(elevation?.min)||!Number.isFinite(elevation?.max)||elevation.min>elevation.max||elevation.unit!=='m') {fail(cell.id,'invalid land elevation');continue;}
    const id=cell.id.slice(5),x=GRID.columns.indexOf(id[0]),y=Number(id.slice(1));
    for(const nextId of [x<GRID.columns.length-1?`${GRID.columns[x+1]}${y}`:null,y<GRID.rows?`${id[0]}${y+1}`:null]) {
      const next=ids.get(`GRID-${nextId}`);
      if(next?.properties?.environmentCode==='O'||!next)continue;
      const other=next.properties.elevation;
      if(Number.isFinite(other?.min)&&Number.isFinite(other?.max)&&(elevation.max<other.min||other.max<elevation.min)) fail(cell.id,`adjacent elevations lack transitional overlap with ${nextId}`);
    }
  }
  if (!Array.isArray(world.issues)) fail('world','issues must be an array');
  else for (const issue of world.issues) if (!record(issue) || typeof issue.id !== 'string' || typeof issue.description !== 'string' || !Array.isArray(issue.objectIds) || issue.objectIds.some(id => !ids.has(id))) fail('issues','invalid issue or broken reference');
  if(world.datasetVersion==='1.5')errors.push(...validateConnectivity(world));
  return errors;
}

export function assertWorld(world) {
  const errors = validateWorld(world);
  if (errors.length) throw new Error(`Invalid world dataset:\n${errors.join('\n')}`);
  return world;
}
