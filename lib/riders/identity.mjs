import seedrandom from 'seedrandom';
import codes from './country-codes.json' with { type:'json' };
import {generateName,traditionsByCountry} from './names.mjs';

export const IDENTITY_VERSION=1;
// Uninhabited/administrative territories are not rider nationalities.
const excluded=new Set(['AQ','BV','HM','TF','GS','UM','IO']);
export const countries=codes.filter(([code])=>!excluded.has(code)).map(([code,iso3])=>({code,iso3:code==='XK'?'XKX':iso3}));
const aliases={DEN:'DK',NED:'NL',GER:'DE',SUI:'CH',SLO:'SI',POR:'PT',GRE:'GR',RSA:'ZA',CRO:'HR',LAT:'LV',TPE:'TW'};
export function countryCode(value) {
  const code=String(value||'').toUpperCase();
  return aliases[code]||countries.find(c=>c.code===code||c.iso3===code)?.code||null;
}
const labels=new Intl.DisplayNames(['da'],{type:'region'});
export function countryLabel(value) {const code=countryCode(value);return code?labels.of(code):String(value||'Ukendt');}

// Game-design weights, NOT demographic statistics or a current UCI ranking.
export const majorWeights={BE:12,FR:11,IT:10,NL:10,ES:9,DK:7,GB:7,DE:6,SI:6,AU:5,CH:4,CO:4,US:4};
export const establishedWeights={NO:4,SE:3,PL:4,PT:4,AT:3,CZ:3,SK:2,IE:2,CA:3,NZ:3,EC:3,ER:3,ZA:2,JP:2,LU:2,KZ:2,EE:1,LV:1,LT:1,HU:1,HR:1,FI:1,BR:1,AR:1,MX:1,RW:1,CN:1,KR:1,UA:1};
export const nationTier=code=>majorWeights[code]?'major':establishedWeights[code]?'established':'world';
const world=countries.filter(c=>nationTier(c.code)==='world');
function pick(random,list){return list[Math.floor(random()*list.length)];}
function weighted(random,weights){let n=random()*Object.values(weights).reduce((a,b)=>a+b,0);for(const [key,weight] of Object.entries(weights)){n-=weight;if(n<0)return key;}return Object.keys(weights).at(-1);}
export function generateNationality(random) {
  const tier=random();
  return tier<.75?weighted(random,majorWeights):tier<.95?weighted(random,establishedWeights):pick(random,world).code;
}

// Broad palettes are art direction only; facial geometry has no nationality gate.
const palettes={
  light:{skin:['#f4d2bc','#ebc4a8','#dfb395','#d5a183'],hair:['#d0b276','#a68148','#715035','#422d25','#b16a40'],eye:['#7594a4','#778966','#70503a']},
  olive:{skin:['#ebc2a1','#d6a27e','#bf8b66','#ab7655'],hair:['#211c1c','#3c2a23','#684b32'],eye:['#49352a','#78694a','#6d805c']},
  warm:{skin:['#d7aa82','#c08d65','#a87450','#936040'],hair:['#211a19','#30221d','#493025'],eye:['#473023','#66452d']},
  deep:{skin:['#a57553','#8c5d40','#754a34','#603d2d','#4b3025'],hair:['#171719','#241c19','#35251e'],eye:['#2d211d','#4a3125','#70492d']},
  east:{skin:['#efc9a4','#ddb58b','#c99b73','#b48561'],hair:['#171719','#251d1b','#3b2820'],eye:['#332620','#513729','#755439']},
  mixed:{skin:['#efd0b1','#d8ae88','#c4916c','#aa7552','#835739'],hair:['#211d1b','#4b3325','#795336','#b38c53'],eye:['#453228','#755338','#768773']},
};
const paletteRegions={
  light:'DK SE NO FI IS GB IE NL BE DE AT CH LU EE LV LT PL CZ SK UA BY RU',
  olive:'FR IT ES PT GR CY MT SI HR BA RS ME MK AL XK RO BG HU TR GE AM IL',
  warm:'IN PK BD LK NP MV AF IR IQ SA AE OM YE QA BH KW JO SY LB MA DZ TN LY EG',
  deep:'ER ET SO DJ SN GM GN ML BF NE GH TG CI NG BJ CM CF CG CD GA TD KE TZ UG SS SD RW BI ZA BW LS SZ NA ZM ZW MW AO MZ LR SL',
  east:'CN TW HK MO JP KR KP VN TH LA KH MM MN BT',
};
const basePalette=Object.fromEntries(Object.entries(paletteRegions).flatMap(([p,list])=>list.split(' ').map(c=>[c,p])));
export function generateAppearance(seed,nationality,gender) {
  const random=seedrandom(`appearance-v1:${seed}`), choose=items=>pick(random,items);
  const number=(min,max)=>Math.round((min+random()*(max-min))*100)/100;
  // 82% local palette, 18% open worldwide mixture; every palette possible everywhere.
  const palette=random()<.82?(basePalette[countryCode(nationality)]||'mixed'):choose(Object.keys(palettes));
  const colors=palettes[palette], naturalHair=choose(colors.hair);
  const hairStyle=choose(gender==='F'?['buzz','pixie','bob','medium','long','ponytail','bun','braid','curly','afro']:['bald','buzz','fade','classic','curly','afro','medium','long']);
  const dye=hairStyle!=='bald'&&random()<.035?{color:choose(['#d665ad','#6d78d1','#329e9d','#ad5bd0','#d15f46']),placement:choose(['full','streak','tips','roots'])}:null;
  const jewelry=random()<.10?{kind:choose(['stud','hoop','nose-stud']),side:choose(['left','right','both']),metal:choose(['#dac18a','#c7cbd0'])}:null;
  return {version:1,seed:String(seed),palette,skin:choose(colors.skin),iris:choose(colors.eye),naturalHair,hairStyle,dye,jewelry,
    hairTexture:choose(['straight','wavy','curly','coily']),hairline:choose(['low','regular','high','receding']),
    headShape:choose(['oval','round','square','long','heart','trapezoid']),headWidth:number(.87,1.12),headLength:number(.91,1.1),
    jawWidth:number(.65,1.1),chinWidth:number(.7,1.25),chinLength:number(-3,4),cheekbone:number(.2,1),cheekFullness:number(.1,1),
    eyeWidth:number(8,13),eyeHeight:number(3.5,8),eyeSpacing:number(16,21),eyeTilt:number(-7,7),eyelid:number(.1,.7),
    browThickness:number(.7,4.8),browDensity:number(.25,1),browLength:number(8,14),browArch:number(-1,5),browAngle:number(-8,8),browSpacing:number(0,4),
    browColor:naturalHair,browAsymmetry:number(-1.7,1.7),browGap:random()<.045,
    noseWidth:number(7,18),noseLength:number(13,23),noseTip:choose(['rounded','pointed','upturned']),noseBridge:choose(['straight','convex','concave']),
    mouthWidth:number(17,29),lipFullness:number(1,4.4),expression:choose(['neutral','focused','smile','grin','serious']),
    earSize:number(.8,1.2),earAngle:number(-8,8),neckWidth:number(.8,1.2),shoulders:number(.9,1.1),
    facialHair:gender==='M'?choose(['none','none','none','stubble','moustache','shortbeard']):'none',
    freckles:random()<.17,mole:random()<.12,dimples:random()<.13,scar:random()<.025,asymmetry:number(-1.5,1.5),
  };
}

export function generateIdentity(seed,gender,{nationality}={}) {
  if(!['M','F'].includes(gender))throw new Error('Invalid rider category');
  const random=seedrandom(`identity-v1:${seed}`);
  const code=nationality?countryCode(nationality):generateNationality(random);
  if(!code||!traditionsByCountry[code])throw new Error('Unsupported rider nationality');
  const name=generateName(code,gender,random);
  return {...name,name:name.display_name,nationality:countries.find(c=>c.code===code).iso3,identity_version:1,appearance:generateAppearance(seed,code,gender)};
}

// Legacy riders retain names/nationality/stats; only missing appearance is derived.
export function riderAppearance(rider) {
  return rider?.appearance?.version===1?rider.appearance:generateAppearance(`legacy:${rider?.id||rider?.name||'unknown'}`,rider?.nationality,rider?.gender||'M');
}

export function portraitPrompt(rider) {
  return `Original fictional adult cyclist, ${rider.gender==='F'?'woman':'man'}, age ${rider.age||24}. Premium cartoon 2.5D painted portrait, visible eyes, no glasses or helmet, mid torso and arms, green cycling jersey without logos, warm cream background, soft daylight. Individual natural face, not a beauty model. Match these saved visual traits literally, without adding national stereotypes: ${JSON.stringify(riderAppearance(rider))}. No text, flags or labels. Preserve this identity in later jersey variants.`;
}
