import { GRID } from './grid.mjs';

/** The ordered cells traversed by a local-km line. Samples are much smaller than one cell. */
export function traceLineCells(geometry) {
  if (geometry?.coordinateSystem !== 'pelotonia-local-km' || !['LineString','MultiLineString'].includes(geometry?.type)) throw new TypeError('Expected a local-km line');
  const paths = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
  const cells = [];
  for (const path of paths) for (let i=1;i<path.length;i++) {
    const [ax,ay]=path[i-1], [bx,by]=path[i];
    if (![ax,ay,bx,by].every(Number.isFinite)) throw new TypeError('Invalid line coordinates');
    const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/.25));
    for(let j=0;j<=steps;j++) {
      const x=ax+(bx-ax)*j/steps, y=ay+(by-ay)*j/steps;
      if(x<0||x>=GRID.widthKm||y<0||y>=GRID.heightKm) throw new RangeError('National network leaves the 16×12 grid');
      const cell=`${GRID.columns[Math.floor(x/GRID.cellSizeKm)]}${Math.floor(y/GRID.cellSizeKm)+1}`;
      if (cells.at(-1)!==cell) cells.push(cell);
    }
  }
  return cells;
}
export function lineCells(geometry) { return [...new Set(traceLineCells(geometry))]; }

export function contiguousCellSequence(cells) {
  return cells.every((cell,i)=>!i||Math.abs(GRID.columns.indexOf(cell[0])-GRID.columns.indexOf(cells[i-1][0]))<=1&&Math.abs(Number(cell.slice(1))-Number(cells[i-1].slice(1)))<=1);
}
