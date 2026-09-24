export const GRID = Object.freeze({ columns: 'ABCDEFGHIJKLMNOP', rows: 12, cellSizeKm: 30, widthKm: 480, heightKm: 360 });
// Verbatim source classification. P was clarified by the owner as Northern Plateau.
export const ENVIRONMENT_ROWS = Object.freeze([
  'OOOSSHHHHHOOOOOO',
  'OOSSHHHHHHHPPOOO',
  'OSSHHHMMMHPPPPOO',
  'OWWHHMMMMPPPPPOO',
  'OWWWMMMMCCCVVEOO',
  'OWWWMMMCCCVVEEEO',
  'OWWRMMCCCCVEEEEO',
  'OWRRMCCCCVVEEDDO',
  'OFFRMCCCCVEEDDDI',
  'OFFFMMCCCEEDDDII',
  'OFFFFMMLLLLDDIII',
  'OOFFOOLLLLLIIIOO',
]);

export function isGridId(value) { return typeof value === 'string' && /^[A-P](?:[1-9]|1[0-2])$/.test(value); }

export function cellGeometry(id) {
  if (!isGridId(id)) throw new RangeError(`Invalid grid cell: ${id}`);
  const x = GRID.columns.indexOf(id[0]) * GRID.cellSizeKm;
  const y = (Number(id.slice(1)) - 1) * GRID.cellSizeKm;
  return { coordinateSystem: 'pelotonia-local-km', type: 'Polygon', coordinates: [[[x,y],[x+30,y],[x+30,y+30],[x,y+30],[x,y]]] };
}

export function createGrid(classifications) {
  if (ENVIRONMENT_ROWS.length !== GRID.rows || ENVIRONMENT_ROWS.some(row => row.length !== GRID.columns.length)) throw new Error('Invalid source grid dimensions');
  return ENVIRONMENT_ROWS.flatMap((row, y) => [...row].map((code, x) => {
    const id = GRID.columns[x] + (y+1);
    return {
      id: `GRID-${id}`, name: id, status: 'fixed', type: 'grid_cell', parentId: 'WORLD-001',
      gridCells: [id], geometry: cellGeometry(id), minZoom: 2, maxZoom: null,
      description: 'Nominal climate/index container; not a coastline or geographic boundary.',
      relations: [], properties: { column: GRID.columns[x], row: y+1, environmentCode: code,
        classificationStatus: 'defined', regionId: classifications[code] ?? null },
    };
  }));
}
