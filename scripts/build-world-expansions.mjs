import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const deep=readFileSync(resolve(root,'docs/PELOTONIA_DEEP_WORLD_EXPANSION_V1_2.md'),'utf8');
const discovery=readFileSync(resolve(root,'docs/PELOTONIA_DISCOVERY_EXPANSION_V1_3.md'),'utf8');
const cells=[...deep.matchAll(/^## ([A-P](?:[1-9]|1[0-2])) — ([^\r\n]+)\r?\n([^#]*?)(?=\r?\n## |\r?\n# |$)/gm)].map(([,id,region,body])=>{
  const landscape=body.match(/\*\*(?:Landscape|Character):\*\* ([^.]+)\./)?.[1]??null;
  const list=body.match(/\*\*(?:Working named places|Named features):\*\* ([^.]+)\./)?.[1]??'';
  return {id,region,landscape,names:list.split(',').map(n=>n.trim()).filter(Boolean)};
});
const cities=[...discovery.matchAll(/^- \*\*(RC-\d{3}) — ([^*]+)\*\* — ([^;]+); ~([\d,]+)\./gm)].map(([,id,name,region,population])=>({id,name,region,population:Number(population.replaceAll(',',''))}));
const discoveries=[...discovery.matchAll(/^- \*\*(DISC-\d{3}) — ([^*]+)\*\* — ([^\r\n]+)/gm)].map(match=>{
  const [,id,name,body]=match;
  const section=discovery.slice(0,match.index).match(/^## (.+)$/gm)?.at(-1)?.slice(3)??null;
  const region=Number(id.slice(5))<=28 ? body.split(';')[0].trim() : section;
  return {id,name,region,description:body.trim()};
});
const major=new Map();
for(const [,name,section] of deep.matchAll(/^## (Valedor|Westhaven|Rivermere|Kaen|Greenfall|Northwatch|Southport|Ember) — [^\r\n]+\r?\n([\s\S]*?)(?=^## |^# |(?![\s\S]))/gm)){
  const districts=section.match(/\*\*Districts:\*\* ([^\r\n]+)/)?.[1].split(';').map(n=>n.trim().replace(/\.$/,''))??[];
  const landmarks=section.match(/\*\*Landmarks:\*\* ([^\r\n]+)/)?.[1].split(';').map(n=>n.trim().replace(/\.$/,''))??[];
  major.set(name,{districts,landmarks});
}
const aurelia=new Map([...deep.matchAll(/^- \*\*(AUR-\d{2}) ([^*]+):\*\* ([^\r\n]+)/gm)].map(([,id,name,places])=>[id,{name,places:places.split(';').map(n=>n.trim().replace(/\.$/,''))}]));
const cathedral=deep.match(/## AUR-LMK-001 Great Cathedral of Aurelia\r?\n[^\r\n]*L4 children: ([^\r\n]+)/)?.[1].split(';').map(n=>n.trim().replace(/\.$/,''))??[];
const naturalSections=[...deep.matchAll(/^## (Great Range \/ Aurelia Massif|Great Caldera \/ Volcanic Basin|Red Canyon \/ Redlands|Emerald Coast \/ waterfall country|Southern Fjords|Southeastern Islands)\r?\n([\s\S]*?)(?=^## |^# |(?![\s\S]))/gm)].map(([,title,body])=>({title,lines:body.trim().split(/\r?\n/).filter(Boolean)}));
if(cells.length!==192||cities.length!==24||discoveries.length!==119||major.size!==8||aurelia.size!==14||cathedral.length!==10||naturalSections.length!==6) throw new Error(`Expansion parse mismatch: ${cells.length} cells, ${cities.length} cities, ${discoveries.length} discoveries, ${major.size} major cities, ${aurelia.size} Aurelia districts, ${cathedral.length} cathedral sites, ${naturalSections.length} natural systems`);
const dataset={cells,cities,discoveries,major:Object.fromEntries(major),aurelia:Object.fromEntries(aurelia),cathedral,naturalSections};
const target=resolve(root,'lib/world/expansion-sources.mjs');
const output=`// Generated from the owner's V1.2 and V1.3 Markdown. Edit sources, then rerun scripts/build-world-expansions.mjs.\nexport const expansionSources = ${JSON.stringify(dataset,null,2)};\n`;
if(process.argv.includes('--check')) {
  if(readFileSync(target,'utf8')!==output) throw new Error('World expansion source is stale');
} else writeFileSync(target,output);
console.log(`${cells.length} cells, ${cities.length} regional cities, ${discoveries.length} discoveries, ${major.size} major-city dossiers`);
