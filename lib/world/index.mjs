import { worldV1_1 } from './data-v1-1.mjs';
import { assertWorld } from './validate.mjs';
export { validateWorld, assertWorld } from './validate.mjs';
export { isGridId } from './grid.mjs';

function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export const world = freeze(assertWorld(worldV1_1));
const index = new Map(world.objects.map(o => [o.id,o]));
const aliases = new Map(world.objects.flatMap(o => (o.properties.sourceAliases ?? []).map(alias => [alias,o])));
export function getWorldObject(id) { return index.get(id) ?? aliases.get(id) ?? null; }
export function getWorldChildren(parentId) { const primary=getWorldObject(parentId)?.id ?? parentId; return world.objects.filter(o => o.parentId === primary); }
export function getWorldObjectsInCell(cell) { return world.objects.filter(o => o.gridCells.includes(cell)); }
export function getVisibleWorldObjects(level, {includeConcepts = false} = {}) {
  if (!Number.isInteger(level) || level < 0 || level > 4) throw new RangeError('Expected a world level from 0 to 4');
  return world.objects.filter(o => o.minZoom <= level && (o.maxZoom === null || level <= o.maxZoom) && (includeConcepts || o.status !== 'concept'));
}
