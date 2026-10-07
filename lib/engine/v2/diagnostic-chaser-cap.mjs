import {SPORTING_SKILLS} from './skills.mjs';

export const CHASER_CAP_SCOPES=Object.freeze({
  all:SPORTING_SKILLS,
  power:Object.freeze(['strength','endurance','repeatability']),
  terrain:Object.freeze(['flat','hills','mountain','descending']),
  chase:Object.freeze(['strength','endurance','repeatability',
    'flat','hills','mountain','descending']),
  other:Object.freeze(SPORTING_SKILLS.filter(skill=>!
    ['strength','endurance','repeatability','flat','hills','mountain',
      'descending'].includes(skill))),
});

// Fictional roster intervention for paired offline probes only. The race
// motor receives ordinary rider skills and cannot see which scope was used.
export function capDiagnosticChaserSkills(skills,cap,scope='all'){
  if(!CHASER_CAP_SCOPES[scope]||!Number.isInteger(cap)||cap<20||cap>100)
    throw new Error('Invalid diagnostic chaser cap.');
  const selected=new Set(CHASER_CAP_SCOPES[scope]);
  return Object.fromEntries(Object.entries(skills).map(([skill,value])=>
    [skill,selected.has(skill)?Math.min(cap,value):value]));
}
