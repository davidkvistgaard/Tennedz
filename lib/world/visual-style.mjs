/** V1.6 presentation tokens keyed by canonical region IDs. These are colours, not geography. */
export const REGION_VISUALS=Object.freeze({
 'REG-001':{ground:'#778b75',shade:'#344d50',cover:'#405e52',texture:'moor',climate:'wet'},
 'REG-002':{ground:'#82977b',shade:'#465d62',cover:'#37614b',texture:'highland',climate:'cool'},
 'REG-NORTHERN-PLATEAU':{ground:'#a6aa78',shade:'#686f60',cover:'#6b865d',texture:'heath',climate:'dry-cool'},
 'REG-003':{ground:'#508458',shade:'#214e48',cover:'#235d3b',texture:'canopy',climate:'wet'},
 'REG-004':{ground:'#48775a',shade:'#244946',cover:'#285940',texture:'rainforest',climate:'wet'},
 'REG-005':{ground:'#8b8f83',shade:'#515b5b',cover:'#526b5b',texture:'alpine',climate:'alpine'},
 'REG-006':{ground:'#b9bd84',shade:'#7f8b69',cover:'#6c9468',texture:'floodplain',climate:'temperate'},
 'REG-007':{ground:'#817865',shade:'#333d3b',cover:'#67735c',texture:'volcanic',climate:'volcanic'},
 'REG-008':{ground:'#b8ad78',shade:'#77745e',cover:'#858863',texture:'steppe',climate:'dry'},
 'REG-009':{ground:'#c88c60',shade:'#8f573f',cover:'#a6906a',texture:'arid',climate:'arid'},
 'REG-010':{ground:'#b6b982',shade:'#748c72',cover:'#7b9669',texture:'coastal',climate:'temperate'},
 'REG-011':{ground:'#637f70',shade:'#3b5054',cover:'#3a6858',texture:'fjord',climate:'wet'},
 'REG-012':{ground:'#79a38a',shade:'#416f72',cover:'#537d66',texture:'island',climate:'maritime'},
});

export function labelPriority(object){
 if(object.id==='WORLD-001')return 100;
 if(object.properties?.isCapital)return 95;
 if(object.type==='settlement'&&object.id.startsWith('CITY-'))return 85;
 if(object.type==='region')return 75;
 if(['mountain_system','icefield','river_system','lake','canyon','caldera'].includes(object.type)&&object.minZoom<=2)return 65;
 if(object.type==='settlement'&&object.id.startsWith('RC-'))return 55;
 if(object.type==='settlement')return 45;
 if(object.type==='district')return 30;
 return 15;
}

export function representationZoom(object,representation){
 let min=representation.minZoom,max=representation.maxZoom;
 if(['road','rail'].includes(object.type)&&object.properties?.networkKind===object.type&&object.properties?.continuity==='national')min=1;
 if(object.type==='ferry_route'&&object.properties?.networkKind==='ferry_route')min=2;
 if(object.type==='region')max=Math.min(max,2);
 return {min,max};
}

export function visualStyle(object,representation){
 const region=REGION_VISUALS[object.id];
 if(region&&['forest','upland','mountain','grass','volcanic','steppe','desert'].includes(representation.style))return {fill:region.ground,stroke:region.shade,texture:region.texture};
 if(object.id==='PHY-011')return {fill:'#295d70',stroke:'#b9c6ae'};
 if(object.id==='PHY-008'||object.id==='PHY-009')return {fill:'#6da9ae',stroke:'#d3e6d8'};
 if(object.type==='rail')return {fill:'none',stroke:'#514d45',dasharray:'1.4 1.1'};
 if(object.type==='road')return {fill:'none',stroke:'#f8e7c2'};
 if(object.type==='ferry_route')return {fill:'none',stroke:'#d9e9dd',dasharray:'3 2'};
 if(object.type==='river_system'&&(representation.style==='seasonal-river'||object.properties?.flowRegime==='wet-year-only'))return {fill:'none',stroke:'#83b7be',dasharray:'3 2'};
 if(object.type==='river_system'&&representation.style==='river')return {fill:'none',stroke:'#83b7be'};
 return null;
}

export function validateVisualStyle(world){
 const errors=[],byId=new Map(world.objects.map(o=>[o.id,o]));
 const regions=world.objects.filter(o=>o.type==='region');
 for(const region of regions){
  const token=REGION_VISUALS[region.id];
  if(!token)errors.push(`${region.id}: missing visual style`);
  else if(!/^#[0-9a-f]{6}$/i.test(token.ground)||!/^#[0-9a-f]{6}$/i.test(token.shade))errors.push(`${region.id}: invalid palette`);
 }
 for(const id of Object.keys(REGION_VISUALS))if(!byId.has(id))errors.push(`${id}: style has no canonical region`);
 if(REGION_VISUALS['REG-003'].climate!=='wet'||REGION_VISUALS['REG-009'].climate!=='arid')errors.push('Wet and arid visual identities are inconsistent');
 for(const object of world.objects){
  if(object.type==='grid_cell'&&object.representations?.some(r=>r.minZoom<=2))errors.push(`${object.id}: permanent grid representation`);
  if(object.type==='icefield'&&object.geometry&&object.gridCells.some(id=>byId.get(`GRID-${id}`)?.properties.regionId===null))errors.push(`${object.id}: ice in ocean`);
  if(object.type==='settlement'&&object.id.startsWith('CITY-')&&object.geometry?.type==='Point'&&object.gridCells.some(id=>byId.get(`GRID-${id}`)?.properties.regionId===null))errors.push(`${object.id}: city in ocean`);
 }
 return errors;
}
