import { worldV1 } from './data-v1.mjs';
import { assertWorld } from './validate.mjs';
const crs='pelotonia-local-km';
export const point=(x,y)=>({coordinateSystem:crs,type:'Point',coordinates:[x,y]});
const line=coordinates=>({coordinateSystem:crs,type:'LineString',coordinates});
const poly=points=>({coordinateSystem:crs,type:'Polygon',coordinates:[[...points,points[0]]]});
const box=(x,y,w,h)=>poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
const oval=(x,y,rx,ry)=>poly(Array.from({length:36},(_,i)=>{const a=i*Math.PI/18,w=1+.055*Math.sin(i*2.1)+.035*Math.cos(i*1.7);return [x+Math.cos(a)*rx*w,y+Math.sin(a)*ry*w];}));
const rep=(geometry,style,minZoom=1,maxZoom=4,label=false)=>({geometry,style,minZoom,maxZoom,label});
const patches=new Map();
function place(id,geometry,representations,extra={}){patches.set(id,{geometry,representations,properties:{geometryStatus:'prototype'},...extra});}
const coast=poly([[112,17],[139,10],[161,20],[185,12],[211,20],[237,30],[268,30],[277,49],[300,55],[306,80],[337,88],[356,105],[366,137],[391,148],[411,174],[426,201],[433,226],[419,241],[435,264],[422,287],[405,304],[387,304],[376,320],[347,323],[330,309],[305,315],[295,305],[284,298],[280,287],[275,282],[269,285],[266,298],[251,312],[248,334],[225,343],[211,330],[185,344],[168,326],[153,342],[138,317],[117,331],[103,308],[83,301],[74,272],[66,265],[72,246],[61,224],[52,212],[57,190],[44,172],[50,152],[38,134],[47,111],[37,92],[53,80],[64,65],[84,60],[80,42],[99,37]]);
place('WORLD-001',coast,[rep(coast,'land')],{focusBounds:[15,0,455,355]});
const regions=[['REG-001',100,53,42,30,'forest'],['REG-002',193,54,65,33,'upland'],['REG-003',76,142,28,62,'forest'],['REG-004',112,218,33,54,'forest'],['REG-005',181,170,33,110,'mountain'],['REG-006',243,199,53,72,'grass'],['REG-007',309,192,29,45,'volcanic'],['REG-008',364,185,37,61,'steppe'],['REG-009',389,274,37,45,'desert'],['REG-010',266,322,61,23,'grass'],['REG-011',111,287,41,31,'upland'],['REG-012',435,325,20,27,'grass'],['REG-NORTHERN-PLATEAU',322,105,49,34,'upland']];
for(const [id,x,y,rx,ry,style] of regions)place(id,oval(x,y,rx,ry),[rep(oval(x,y,rx,ry),style,1,2),rep(point(x,y),'region-label',1,2,true)]);
const islands=[oval(452,290,7,12),oval(435,318,9,14),oval(418,337,13,8),oval(449,345,7,6),oval(404,352,9,4)];
const extras=[];
function feature(id,name,type,parentId,geometry,representations,properties={},extra={}){extras.push({id,name,type,parentId,status:'concept',gridCells:[],geometry,minZoom:1,maxZoom:4,description:'Prototypegeometri; placering og udformning er et designforslag.',relations:[],properties:{geometryStatus:'prototype',...properties},representations,...extra});}
islands.forEach((g,i)=>feature(`ATLAS-ISLAND-00${i+1}`,`Sydøstlig ø ${i+1}`,'island_nation','REG-012',g,[rep(g,'land')],{workingLabel:true}));
const peaks=[['PHY-001',188,189],['PHY-002',166,119],['PHY-003',159,93],['PHY-004',313,206],['PHY-005',194,256],['PHY-006',388,278]];
for(const [id,x,y] of peaks)place(id,point(x,y),[rep(point(x,y),'peak',1,2,true)]);
place('PHY-007',poly([[153,97],[164,116],[171,148],[183,166],[190,190],[181,205],[171,176],[162,161],[157,125],[146,109]]),[rep(poly([[153,97],[164,116],[171,148],[183,166],[190,190],[181,205],[171,176],[162,161],[157,125],[146,109]]),'ice',1,2,true)]);
for(const [id,x,y,rx,ry] of [['PHY-008',207,79,17,7],['PHY-009',200,222,7,10],['PHY-010',319,166,12,10],['PHY-011',308,195,10,10]])place(id,oval(x,y,rx,ry),[rep(oval(x,y,rx,ry),'water',1,2,true)]);
place('PHY-012',line([[345,218],[358,241],[368,267],[379,288]]),[rep(line([[345,218],[358,241],[368,267],[379,288]]),'ridge',1,2,true)]);
place('PHY-013',line([[399,235],[385,253],[398,271],[393,294]]),[rep(line([[399,235],[385,253],[398,271],[393,294]]),'canyon',1,2,true)]);
const rivers=[[[170,111],[190,126],[216,138],[239,174],[261,222],[269,264],[271,282],[275,290],[277,300]],[[173,161],[142,164],[129,183],[105,189],[81,171],[54,166]],[[181,241],[161,260],[147,285],[124,305]],[[267,93],[295,109],[322,127],[353,165],[370,200],[396,222],[423,226]]];
rivers.forEach((coords,i)=>place(`RIV-00${i+1}`,line(coords),[rep(line(coords),'river',1,4)],{properties:{geometryStatus:'prototype',coursePending:true,courseStatus:'prototype',namePending:true}}));
const cities=[['CITY-001',270,286],['CITY-002',265,170],['CITY-003',72,169],['CITY-004',240,139],['CITY-005',340,178],['CITY-006',119,222],['CITY-007',189,39],['CITY-008',243,331],['CITY-009',392,268]];
for(const [id,x,y] of cities)place(id,point(x,y),[rep(point(x,y),'city',1,2,true)],{focusBounds:[x-15,y-11,x+15,y+11]});
const city=poly([[260,280],[263,277],[269,275.5],[273,276],[278,275.5],[282,278],[283,284],[283,291],[279,292],[275,290],[271,291],[266,290],[261.5,288]]);
place('CITY-001',city,[rep(point(270,286),'capital',1,2,true),rep(city,'city-area',2,4)],{focusBounds:[260,275,283,292.25],gridCells:['I10','J10'],description:'Hovedstad ved et sydvendt estuarie. Byens aftryk og distrikter er prototypegeometri.'});
feature('AUR-GEO-001','Estuariet','river_system','CITY-001',poly([[271,272],[271.3,278],[272.1,282],[273.1,286],[275.5,290],[278,296],[274,298],[273,291],[271.7,286],[271,282],[270.5,278],[270.6,272]]),[rep(poly([[271,272],[271.3,278],[272.1,282],[273.1,286],[275.5,290],[278,296],[274,298],[273,291],[271.7,286],[271,282],[270.5,278],[270.6,272]]),'water',2,4)]);
feature('AUR-GEO-002','Aurelias bugt','lake','CITY-001',oval(278,299,8,9),[rep(oval(278,299,8,9),'water',2,4)],{waterKind:'bay'});
const ds=[
[1,266.5,281.5,3.2,2.7],[2,266,278.5,3.7,2.6],[3,267,284.5,4.1,2.6],[4,276,287.5,3,3],[5,273,282,3,4.7],[6,263,284.5,3.6,3],[7,262.5,281,3.5,3],[8,267,288.2,5,2.5],[9,276.4,282,3.5,4.5],[10,270,276,3.5,3.6],[11,269.7,280,1.3,2],[12,261,277,4.5,3.5],[13,280.3,286.2,2.6,5.4],[14,279,276,4,5.5]];
for(const [n,x,y,w,h] of ds){const id=`AUR-${String(n).padStart(2,'0')}`;const g=poly([[x+w*.08,y+h*.12],[x+w*.7,y],[x+w,y+h*.2],[x+w*.93,y+h*.75],[x+w*.75,y+h],[x+w*.1,y+h*.95],[x,y+h*.45]]);place(id,g,[rep(g,n===10?'park':'district',3,4,true)],{focusBounds:[x-.4,y-.4,x+w+.4,y+h+.4],gridCells:[x<270?'I10':'J10']});}
const lm=[['AUR-LMK-001',267.8,282.8,'AUR-01'],['AUR-LMK-002',268.1,279.7,'AUR-02'],['AUR-LMK-003',269.4,285.5,'AUR-03'],['AUR-LMK-004',264.2,282.3,'AUR-07'],['AUR-LMK-005',278.9,280.1,'AUR-14'],['AUR-LMK-006',263.4,278.5,'AUR-12'],['AUR-LMK-007',270.1,286,'AUR-03'],['AUR-LMK-008',268.9,283.6,'AUR-01'],['AUR-LMK-009',272,277.5,'AUR-10'],['AUR-LMK-010',277.5,289,'AUR-04'],['AUR-LMK-011',267,280,'AUR-02']];
for(const [id,x,y,parentId] of lm)place(id,point(x,y),[rep(point(x,y),'landmark',3,4,true)],{parentId,focusBounds:[x-.5,y-.375,x+.5,y+.375]});
const precinct=box(267.45,282.55,.7,.5);
place('AUR-LMK-001',precinct,[rep(point(267.8,282.8),'landmark',3,3,true),rep(precinct,'precinct',4,4)],{parentId:'AUR-01',focusBounds:[267.25,282.35,268.35,283.175],properties:{geometryStatus:'prototype',heightAboveRiver:{value:45,unit:'m',approximate:true}}});
feature('AUR-SITE-001','Katedralbygningen','landmark','AUR-LMK-001',poly([[267.71,282.675],[267.775,282.675],[267.775,282.65],[267.809,282.65],[267.809,282.675],[267.885,282.675],[267.898,282.686],[267.898,282.71],[267.885,282.72],[267.809,282.72],[267.809,282.742],[267.775,282.742],[267.775,282.72],[267.71,282.72]]),[rep(poly([[267.71,282.675],[267.775,282.675],[267.775,282.65],[267.809,282.65],[267.809,282.675],[267.885,282.675],[267.898,282.686],[267.898,282.71],[267.885,282.72],[267.809,282.72],[267.809,282.742],[267.775,282.742],[267.775,282.72],[267.71,282.72]]),'building',4,4,true)],{lengthM:188,widthM:92});
feature('AUR-SITE-002','Katedralpladsen','landmark','AUR-LMK-001',box(267.46,282.7,.25,.18),[rep(box(267.46,282.7,.25,.18),'plaza',4,4,true)]);
feature('AUR-SITE-003','Katedralhaverne','landmark','AUR-LMK-001',box(267.92,282.59,.19,.38),[rep(box(267.92,282.59,.19,.38),'park',4,4,true)]);
feature('AUR-SITE-004','Kulturbygning · forslag','landmark','AUR-LMK-001',box(267.75,282.91,.13,.065),[rep(box(267.75,282.91,.13,.065),'building',4,4,true)]);
feature('AUR-SITE-005','Tilknyttet bygning · forslag','landmark','AUR-LMK-001',box(267.73,282.57,.115,.05),[rep(box(267.73,282.57,.115,.05),'building',4,4,true)]);
const roads=[[[260,287],[265,286],[269.4,285.5],[272.5,285],[279,284]],[[268,275],[268,279],[268,282.4],[268.5,286],[270,289]],[[260,280],[265,280.5],[268,281],[271,281],[276,280],[281,279]]];
roads.forEach((coords,i)=>feature(`AUR-INF-00${i+1}`,`Hovedforbindelse ${i+1}`,'fixed_connection','CITY-001',line(coords),[rep(line(coords),'road',3,4)],{workingLabel:true}));
place('INF-004',box(280.7,287,.55,3),[rep(box(280.7,287,.55,3),'runway',3,4,true)],{focusBounds:[279.5,286,282.5,291]});
place('INF-005',box(71,167,1,2),[rep(point(71,167),'landmark',2,2,true),rep(box(71,167,1,2),'building',3,4,true)]);
// Extensibility proof: an additional site uses the same object/representation pipeline.
feature('AUR-SITE-006','Havepavillon · forslag','landmark','AUR-SITE-003',box(268.01,282.73,.025,.025),[rep(box(268.01,282.73,.025,.025),'building',4,4,true)],{extensionExample:true});

// Cartographic relief and woodland marks: visual representations, not new named places.
for(const [id,x,y,rx,ry,style] of regions){
 const p=patches.get(id);
 if(style==='mountain'||style==='upland'){
  const triangles=[];
  for(let i=0;i<34;i++){const a=i*2.399,r=Math.sqrt((i+.5)/34),cx=x+Math.cos(a)*rx*r*.88,cy=y+Math.sin(a)*ry*r*.88,h=style==='mountain'?5:2.6,w=h*.7;triangles.push([[[cx-w,cy+h*.3],[cx,cy-h],[cx+w,cy+h*.3],[cx-w,cy+h*.3]]]);}
  p.representations.push(rep({coordinateSystem:crs,type:'MultiPolygon',coordinates:triangles},'relief',1,2));
 }
 if(style==='forest'){
  const marks=[];
  for(let i=0;i<90;i++){const a=i*2.399,r=Math.sqrt((i+.5)/90),cx=x+Math.cos(a)*rx*r*.85,cy=y+Math.sin(a)*ry*r*.85;marks.push([[[cx-1,cy+1],[cx,cy-1.7],[cx+1,cy+1],[cx-1,cy+1]]]);}
  p.representations.push(rep({coordinateSystem:crs,type:'MultiPolygon',coordinates:marks},'woodland',1,2));
 }
}
const cathedral=patches.get('AUR-LMK-001');
cathedral.representations.push(rep(line([[267.46,282.97],[268.11,282.97],[268.11,282.61]]),'footpath',4,4));
feature('AUR-SITE-007','Katedralens tagryg','landmark','AUR-SITE-001',line([[267.715,282.697],[267.89,282.697]]),[rep(line([[267.715,282.697],[267.89,282.697]]),'roof',4,4)]);
feature('AUR-SITE-008','Katedralens tværskib','landmark','AUR-SITE-001',line([[267.792,282.652],[267.792,282.74]]),[rep(line([[267.792,282.652],[267.792,282.74]]),'roof',4,4)]);

export const atlasWorld=assertWorld({...worldV1,datasetVersion:'1.1',title:'Pelotonia Atlas · prototype',issues:[...worldV1.issues,{id:'ATLAS-PROTOTYPE-001',description:'All non-grid geometry is schematic prototype design in local km; not georeferenced and not surveyed. Names and populations are unchanged.',objectIds:['WORLD-001','CITY-001']}],objects:[...worldV1.objects.map(o=>{const p=patches.get(o.id);return p?{...o,...p,properties:{...o.properties,...p.properties}}:o;}),...extras]});
