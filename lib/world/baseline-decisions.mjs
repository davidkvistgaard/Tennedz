/** Owner-approved semantic decisions over the preserved World 1.5 object IDs. */
export const WORLD_BASELINE_DECISIONS = Object.freeze({
  northernPlateauPopulation: 300_000,
  northernHighlandsAdjustment: -150_000,
  centralPlainsAdjustment: -150_000,
  seasonalRiverId: 'RIV-004',
});

export const SAME_PLACE_ALIASES = Object.freeze([
  ['V12-011-003', 'V12-NAT-SOUTHERN-FJORDS-02'], // Deepfjord
  ['V12-011-005', 'V12-NAT-SOUTHERN-FJORDS-13'], // Sealholm
  ['AUR-V12-CATH-06', 'AUR-SITE-003'], // Cathedral Gardens
  ['V12-005-003', 'V12-NAT-GREAT-RANGE-AURELIA-MASSIF-19'], // Crown Pass
  ['V12-005-005', 'V12-NAT-GREAT-RANGE-AURELIA-MASSIF-08'], // Black Needle
  ['DISC-027', 'CITY-003-V12-LMK-03'], // Rainwall Viaduct
  ['V14-SITE-DISC-026-02', 'V12-NAT-SOUTHEASTERN-ISLANDS-04'], // West Reef
  ['V14-SITE-DISC-013-01', 'V12-NAT-GREAT-CALDERA-VOLCANIC-BASIN-01'],
  ['V14-SITE-DISC-013-02', 'V12-NAT-GREAT-CALDERA-VOLCANIC-BASIN-02'],
  ['V14-SITE-DISC-013-03', 'V12-NAT-GREAT-CALDERA-VOLCANIC-BASIN-03'],
  ['V14-SITE-DISC-013-04', 'V12-NAT-GREAT-CALDERA-VOLCANIC-BASIN-04'],
  ['V14-SITE-DISC-013-05', 'V12-NAT-GREAT-CALDERA-VOLCANIC-BASIN-06'],
  ['V14-SITE-DISC-013-06', 'V12-NAT-GREAT-CALDERA-VOLCANIC-BASIN-07'],
  ['V14-SITE-DISC-013-07', 'V12-NAT-GREAT-CALDERA-VOLCANIC-BASIN-08'],
  ['V14-SITE-DISC-013-08', 'V12-NAT-GREAT-CALDERA-VOLCANIC-BASIN-05'],
]);

const approximatePopulation = value => ({value,unit:'people',approximate:true});

export function applyWorldBaselineDecisions(objects) {
  const byId = new Map(objects.map(object => [object.id, object]));
  const get = id => {
    const object = byId.get(id);
    if (!object) throw new Error(`Missing stable world ID ${id}`);
    return object;
  };
  const alias = (olderId, canonicalId) => {
    const older = get(olderId), canonical = get(canonicalId);
    if (older.name !== canonical.name) throw new Error(`World identity mismatch ${olderId} → ${canonicalId}`);
    older.status = 'concept';
    older.properties.canonicalFeatureId = canonicalId;
    if (!older.relations.some(relation => relation.kind === 'alias_of' && relation.targetId === canonicalId))
      older.relations.push({kind:'alias_of',targetId:canonicalId});
  };

  const caldera = get('DISC-012'), lake = get('PHY-011');
  caldera.type = 'caldera';
  caldera.description = 'Volcanic caldera surrounding Great Caldera Lake; the eastern wall is breached.';
  lake.parentId = caldera.id;
  // The lake contains Blue Depths and Ash Islands. Rims, shores and volcanic
  // landforms belong to the surrounding caldera, not inside the water body.
  for (const child of objects.filter(object => object.parentId === lake.id)) {
    if (!['V12-NAT-GREAT-CALDERA-VOLCANIC-BASIN-05','V12-NAT-GREAT-CALDERA-VOLCANIC-BASIN-08','DETAIL-PHY-011-1'].includes(child.id))
      child.parentId = caldera.id;
  }
  get('AUR-SITE-003').parentId = 'AUR-LMK-001';
  for (const [olderId, canonicalId] of SAME_PLACE_ALIASES) alias(olderId, canonicalId);

  const river = get(WORLD_BASELINE_DECISIONS.seasonalRiverId);
  river.properties.terminalKind = 'seasonal-ocean-mouth';
  river.properties.seasonalOutlet = {
    normalFlow:'lower desert channel with no regular sea discharge',
    wetYearFlow:'reaches the southeastern coast',
  };
  get('HYD-R04-SEG-03').properties.flowRegime = 'wet-year-only';

  const highlands = get('REG-002'), plains = get('REG-006'), plateau = get('REG-NORTHERN-PLATEAU');
  highlands.properties.population = approximatePopulation(highlands.properties.population.value + WORLD_BASELINE_DECISIONS.northernHighlandsAdjustment);
  plains.properties.population = approximatePopulation(plains.properties.population.value + WORLD_BASELINE_DECISIONS.centralPlainsAdjustment);
  plateau.properties.population = approximatePopulation(WORLD_BASELINE_DECISIONS.northernPlateauPopulation);
  for (const region of [highlands,plains,plateau]) region.properties.populationAccounting = 'regional estimate; settlements are subsets, not additions';
  return objects;
}
