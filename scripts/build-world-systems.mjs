import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {correctedDiscoverySources} from '../lib/world/source-corrections.mjs';
import {expansionSources} from '../lib/world/expansion-sources.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const local=readFileSync(resolve(root,'docs/PELOTONIA_LOCAL_DETAIL_EXPANSION_V1_4.md'),'utf8');
const systems=readFileSync(resolve(root,'docs/PELOTONIA_CONNECTIVITY_SYSTEMS_EXPANSION_V1_5.md'),'utf8');
const sections=text=>[...text.matchAll(/^## ([^\r\n]+)\r?\n([\s\S]*?)(?=^## |^# |(?![\s\S]))/gm)].map(([,heading,body])=>({heading,body:body.trim()}));
const localSections=sections(local),systemSections=sections(systems);
const take=(text,field)=>text.match(new RegExp(`\\*\\*${field}:\\*\\* ([^\\r\\n]+)`))?.[1]?.trim()??null;
const split=value=>value?.replace(/\.$/,'').split(',').map(x=>x.trim()).filter(Boolean)??[];
const regional=localSections.filter(x=>/^RC-\d{3} /.test(x.heading)).map(x=>{
 const [,id,name]=x.heading.match(/^(RC-\d{3}) (.+)$/);
 return{id,name,region:take(x.body,'Region')?.replace(/\.$/,'')??null,districts:split(take(x.body,'Districts \/ local areas')),anchors:split(take(x.body,'Landmarks \/ anchors'))};
});
const towns=localSections.filter(x=>/^TOWN-\d{3} — /.test(x.heading)).map(x=>{
 const [,id,name]=x.heading.match(/^(TOWN-\d{3}) — (.+)$/);
 return{id,name,region:take(x.body,'Region')?.split('.')[0]??null,places:split(take(x.body,'L3 places'))};
});
const signature=localSections.filter(x=>/^DISC-\d{3} /.test(x.heading)).map(x=>{
 const [,sourceId,name]=x.heading.match(/^(DISC-\d{3}) (.+)$/);
 return{sourceId,name,children:split(take(x.body,'L4 children'))};
});
const v13DiscoveryNames=new Map(expansionSources.discoveries.map(x=>[x.id,x.name]));
for(const [oldId,newId,name] of correctedDiscoverySources){
 if(!signature.some(x=>x.sourceId===newId&&x.name===name))throw new Error(`Missing corrected V1.4 source ${newId}: ${name}`);
 if(signature.some(x=>x.sourceId===oldId&&x.name===name))throw new Error(`Uncorrected V1.4 source ${oldId}: ${name}`);
}
for(const item of signature)if(v13DiscoveryNames.has(item.sourceId)&&v13DiscoveryNames.get(item.sourceId)!==item.name)throw new Error(`V1.4 source collision with V1.3: ${item.sourceId}`);
if(new Set(signature.map(x=>x.sourceId)).size!==signature.length)throw new Error('Duplicate V1.4 discovery source ID');
const engineering=localSections.filter(x=>/^INF-0[1-5] /.test(x.heading)).map(x=>{
 const [,sourceId,rawName]=x.heading.match(/^(INF-0[1-5]) (.+)$/);
 const name=rawName.replace(/ \(.*\)$/,'');
 const children=x.body.startsWith('Preferred components:')
   ? [...x.body.matchAll(/^- \*\*([^*]+)\*\*/gm)].map(m=>m[1])
   : [...(x.body.match(/^Children: ([^\r\n]+)/m)?.[1]??'').matchAll(/\*\*([^*]+)\*\*/g)].map(m=>m[1]);
 return{sourceId,name,children};
});
const network=systemSections.filter(x=>/^(HYD-R\d{2}|ROAD-N\d{2}|RAIL-N\d{2}|FERRY-N\d{2}|AIR-\d{3}) — /.test(x.heading)).map(x=>{
 const [,id,name]=x.heading.match(/^((?:HYD-R\d{2}|ROAD-N\d{2}|RAIL-N\d{2}|FERRY-N\d{2}|AIR-\d{3})) — (.+)$/);
 return{id,name,body:x.body};
});
if(regional.length!==24||towns.length!==26||signature.length!==24||engineering.length!==5||network.length!==31||regional.some(x=>!x.region||!x.districts.length||!x.anchors.length)||towns.some(x=>!x.region||!x.places.length)||signature.some(x=>!x.children.length)||engineering.some(x=>!x.children.length))throw new Error(`Unexpected inventory: RC ${regional.length}, towns ${towns.length}, signature ${signature.length}, engineering ${engineering.length}, systems ${network.length}`);
const output=`// Generated from the owner's V1.4 and V1.5 Markdown. Edit sources then regenerate.\nexport const systemsSources=${JSON.stringify({regional,towns,signature,engineering,network},null,2)};\n`;
const target=resolve(root,'lib/world/systems-sources.mjs');
if(process.argv.includes('--check')){if(readFileSync(target,'utf8')!==output)throw new Error('World systems source is stale');}
else writeFileSync(target,output);
console.log(`${regional.length} regional cities, ${towns.length} towns, ${signature.length} signature sites, ${engineering.length} infrastructure sites, ${network.length} systems`);
