export function siteCell([x, z], {columns, rows, cellSizeKm}) {
  const col = Math.floor(x / cellSizeKm);
  const row = Math.floor(z / cellSizeKm);
  return col >= 0 && col < columns.length && row >= 0 && row < rows ? columns[col] + (row + 1) : '';
}

export function withCyclingGuide(collection, manifest, guide, grid) {
  const byCell = new Map();
  const sites = guide.sites.map(site => {
    const gridCell = siteCell(site.point, grid);
    if (!gridCell) throw new Error('Landmark lies outside the atlas grid.');
    const ids = byCell.get(gridCell) ?? [];
    ids.push(site.id);
    byCell.set(gridCell, ids);
    return {
      type: 'Feature', id: site.id,
      geometry: {type: 'Point', coordinates: site.point},
      properties: {...site, gridCell, type: 'landmark', domain: 'land', minZoom: 3},
    };
  });
  return [
    {...collection, features: [...collection.features, ...sites]},
    {...manifest, cells: manifest.cells.map(cell => ({
      ...cell, featureIds: [...(byCell.get(cell.cell) ?? []), ...cell.featureIds],
    }))},
  ];
}

export function readGuide() {
  return fetch('./cycling-guide.json').then(response => {
    if (!response.ok) throw new Error('Could not load the cycling field guide.');
    return response.json();
  });
}

export function flightLink(cell, site) {
  const query = new URLSearchParams({cell});
  if (site) query.set('site', site);
  return './field-flight.html?' + query;
}
