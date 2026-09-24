import { createGrid, GRID } from './grid.mjs';

const approximate = (value, unit) => ({ value, unit, approximate: true });
const range = (min, max, unit) => ({ min, max, unit, approximate: true });
const object = (id, name, type, parentId, minZoom, properties = {}, extra = {}) => ({
  id, name, status: 'canonical_editable', type, parentId, gridCells: [], geometry: null,
  minZoom, maxZoom: null, description: '', relations: [], properties, ...extra,
});
const regionSeeds = [
  ['REG-001','S','Stormlands',250000,'Storm-exposed western/northern region.'],
  ['REG-002','H','Northern Highlands',1250000,'Northern highlands.'],
  ['REG-003','W','Emerald Coast',1050000,'Extremely wet western coast.'],
  ['REG-004','R','Rainforest Belt',550000,'Wet western rainforest.'],
  ['REG-005','M','Great Range',50000,'Central NW–SE mountain backbone; alpine and glaciated; causes the eastern rain shadow.'],
  ['REG-006','C','Central Plains',3650000,'Temperate, fertile plains.'],
  ['REG-007','V','Volcanic Basin',350000,'Volcanic basin.'],
  ['REG-008','E','Eastern Steppe',950000,'Eastern rain-shadow steppe.'],
  ['REG-009','D','Redlands',450000,'Hot, arid southeast.'],
  ['REG-010','L','Southern Coast',2650000,'Southern coastal region.'],
  ['REG-011','F','Southern Fjords',150000,'Southern fjord country.'],
  ['REG-012','I','Southeastern Islands',750000,'Southeastern island group.'],
];
const classifications = Object.fromEntries(regionSeeds.map(([id,code]) => [code,id]));
const grid = createGrid(classifications);
const regions = regionSeeds.map(([id,code,name,population,description]) => object(id,name,'region','WORLD-001',1,
  { environmentCode: code, population: approximate(population,'people'), physicalStatus: 'fixed' },
  {description, gridCells: grid.filter(c => c.properties.environmentCode === code).map(c => c.name)}));

const mountains = [
  ['PHY-001','Mount Aurelia',4372,false], ['PHY-002','Frostpeak',3850,true],
  ['PHY-003','White Crown',3600,true], ['PHY-004','Mount Nyx',3106,false],
  ['PHY-005','Southwatch',3050,true], ['PHY-006','Ember Peak',2418,false],
].map(([id,name,value,approx]) => object(id,name,'mountain','WORLD-001',2,{elevation:{value,unit:'m',approximate:approx}}));
const features = [
  ...mountains,
  object('PHY-007','Aurelia Icefield','icefield','WORLD-001',2,{area:range(1000,1500,'km2')}),
  object('PHY-008','Lake Verdan','lake','WORLD-001',2,{}, {description:'Major northern/central lake.'}),
  object('PHY-009','Lake Aurel','lake','WORLD-001',2,{}, {description:'High-altitude glacial lake.'}),
  object('PHY-010','Lake Kaen','lake','WORLD-001',2,{}, {description:'Drier eastern lake.'}),
  object('PHY-011','Great Caldera Lake','lake','WORLD-001',2,{diameter:range(18,22,'km')}),
  object('PHY-012','Great Escarpment','escarpment','WORLD-001',2,{length:approximate(150,'km'),localRelief:range(800,900,'m')}),
  object('PHY-013','Red Canyon','canyon','WORLD-001',2,{length:range(150,200,'km'),maximumDepth:range(1000,1200,'m')}),
  object('PHY-014',null,'waterfall_country','WORLD-001',2,{namePending:true},{description:'Western waterfall country; precise extent not supplied.'}),
  object('PHY-015',null,'waterfall','PHY-014',3,{height:approximate(800,'m'),namePending:true},{description:'At least one approximately 800 m waterfall; name and location pending.'}),
  ...[1,2,3,4].map(n => object(`RIV-00${n}`,null,'river_system','WORLD-001',2,{namePending:true,coursePending:true},
    {description:'One of four required primary systems, originating mainly in the Great Range/highlands. Individual source, course and mouth unassigned.'})),
];
const citySeeds = [
  ['CITY-001','Aurelia',2450000], ['CITY-002','Valedor',1180000], ['CITY-003','Westhaven',760000],
  ['CITY-004','Rivermere',620000], ['CITY-005','Kaen',510000], ['CITY-006','Greenfall',390000],
  ['CITY-007','Northwatch',310000], ['CITY-008','Southport',280000], ['CITY-009','Ember',220000],
];
const cities = citySeeds.map(([id,name,population]) => object(id,name,'settlement','WORLD-001',2,
  {population:approximate(population,'people'),populationScope:id === 'CITY-001' ? 'metropolitan' : 'unspecified',isCapital:id === 'CITY-001'},
  id === 'CITY-001' ? {gridCells:['I10','J10'],description:'Primary cells only; the metropolitan area may extend into neighboring cells. No exact boundary assigned.'} : {}));
const districts = ['Old Aurelia','Crown District','Central Aurelia','Grand Harbour','Eastbank','Westbank','University Quarter','South Shore','Ironworks','North Gardens','Rivergate','Heights','Airport Coast','Outer Aurelia']
  .map((name,i) => object(`AUR-${String(i+1).padStart(2,'0')}`,name,'district','CITY-001',3));
const landmarks = ['Great Cathedral of Aurelia','Parliament Complex','Aurelia Central Station','University of Aurelia','National Stadium','Old Citadel','Aurelia Tower','Grand Market','National Gardens','Harbour Arch','National Museum',null]
  .map((name,i) => object(`AUR-LMK-${String(i+1).padStart(3,'0')}`,name,'landmark','CITY-001',4,
    i === 0 ? {length:approximate(188,'m'),width:approximate(92,'m'),centralSpireHeight:approximate(171,'m'),westernTowerHeight:approximate(143,'m'),naveInternalHeight:approximate(48,'m'),plaza:{length:approximate(250,'m'),width:approximate(180,'m')},capacity:{minExclusive:15000,unit:'people'},precinctArea:approximate(35,'ha')}
      : i === 11 ? {reserved:true,namePending:true} : {}, i === 11 ? {status:'concept',description:'Reserved ID; no landmark invented.'} : {}));
const infrastructure = [
  object('INF-001','Pelotonia Link','fixed_connection','WORLD-001',2,{length:range(35,45,'km')},{description:'Potential connection between the main island and Southeastern Islands; alignment unknown.',relations:[{kind:'connects_to',targetId:'REG-012'}]}),
  object('INF-002','Great Range Base Tunnel','tunnel','WORLD-001',2,{length:range(30,40,'km')},{relations:[{kind:'associated_with',targetId:'REG-005'}]}),
  object('INF-003','Great River Dam','dam','WORLD-001',3),
  object('INF-004','Aurelia International Airport','airport','CITY-001',3),
  object('INF-005','Westhaven Deepwater Port','port','CITY-003',3),
].map(entry => ({...entry,status:'concept'}));

export const worldV1 = {
  schemaVersion: 1, datasetVersion: '1.0', title: 'Pelotonia World 1.0',
  coordinateSystem: {id:'pelotonia-local-km',units:'km',origin:'northwest corner of macro-grid',xDirection:'east',yDirection:'south',earthAnchor:null},
  grid: {...GRID},
  levels: [{level:0,name:'Earth'},{level:1,name:'Pelotonia'},{level:2,name:'Macro-grid / local region'},{level:3,name:'Local area / city district'},{level:4,name:'Landmark / site'}],
  issues: [
    {id:'SOURCE-001',description:'P appears in the source grid but has no legend definition. It is preserved as unresolved, not interpreted as Plains.',objectIds:grid.filter(c => c.properties.environmentCode === 'P').map(c => c.id)},
    {id:'SOURCE-002',description:'Regional estimates sum to the stated national total of approximately 12,100,000. City estimates are subsets and must not be added to regional totals.',objectIds:['WORLD-001']},
    {id:'SOURCE-003',description:'Reference illustration and text differ in grid alignment and some names. Text is the initial data source; illustration is a non-georeferenced visual reference, not exact geometry.',objectIds:['WORLD-001']},
  ],
  objects: [
    object('EARTH-001','Earth','planet',null,0,{}, {status:'fixed'}),
    object('WORLD-001','Pelotonia','island_nation','EARTH-001',1,{
      location:'South Pacific on Earth',mainIslandArea:approximate(115000,'km2'),population:approximate(12100000,'people'),
      physicalStatus:'fixed',prevailingWeatherFrom:['W','SW'],backboneDirection:'NW–SE',
      climateStructure:{west:'extremely wet',mountains:'alpine/glaciated',central:'temperate/fertile',east:'rain-shadow steppe',southeast:'hot/arid'},
      coastlineStatus:'broad outline fixed; exact geometry not provided',riverSystemCount:4,
    }),
    ...grid,...regions,...features,...cities,...districts,...landmarks,...infrastructure,
  ],
};
