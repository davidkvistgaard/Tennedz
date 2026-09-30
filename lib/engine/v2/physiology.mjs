import {TUNING} from './tuning.mjs';
import {SPORTING_SKILLS} from './skills.mjs';

export {SPORTING_SKILLS};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function number(value,label){
  const n=Number(value);
  if(!Number.isFinite(n)||n<0||n>100)throw new Error(`Invalid ${label}.`);
  return n;
}
function nonnegative(value,label){
  const n=Number(value);
  if(!Number.isFinite(n)||n<0)throw new Error(`Invalid ${label}.`);
  return n;
}

// New fields are derived only inside the v2 prototype for legacy riders.
// Persistent values will need a reviewed migration before any live release.
export function sportingSkills(rider){
  const base=Object.fromEntries(SPORTING_SKILLS.slice(0,9).map(key=>[key,number(rider?.[key]??40,key)]));
  const derived={
    acceleration:.65*base.sprint+.35*base.hills,
    repeatability:.65*base.endurance+.35*base.hills,
    descending:.55*base.hills+.45*base.cobbles,
    handling:.55*base.cobbles+.45*base.wind,
    positioning:.55*base.flat+.45*base.wind,
  };
  return {...base,...Object.fromEntries(Object.entries(derived).map(([key,fallback])=>
    [key,number(rider?.[key]??fallback,key)]))};
}

export function riderKilometreEffect(rider,segment,{phase='cruise',energy=100,exposed=false}={}){
  const profile=TUNING.riderEffects[phase];
  if(!profile)throw new Error('Unknown riding phase.');
  if(!segment||!['flat','hill','climb','descent'].includes(segment.terrain))throw new Error('Unknown terrain.');
  const skills=sportingSkills(rider),condition=clamp(number(energy,'energy'),0,100);
  const terrainKey={flat:'flat',hill:'hills',climb:'mountain',descent:'descending'}[segment.terrain];
  const components={...skills,terrain:skills[terrainKey]};
  let ability=Object.entries(profile).reduce((sum,[key,weight])=>sum+components[key]*weight,0);
  if(segment.surface==='cobbles')ability=ability*.55+skills.cobbles*.35+skills.handling*.10;
  else if(['gravel','dirt'].includes(segment.surface))ability=ability*.75+skills.handling*.25;
  else if(segment.surface!=='road')throw new Error('Unknown road surface.');
  const rain=nonnegative(segment.weather?.rainMm??0,'rain');
  const wind=nonnegative(segment.weather?.windKph??0,'wind speed');
  const temperature=Number(segment.weather?.temperatureC??16);
  if(!Number.isFinite(temperature))throw new Error('Invalid temperature.');
  if(rain>=2)ability=ability*.85+skills.handling*.15;
  if(exposed&&wind>=20)ability=ability*.78+skills.wind*.22;
  const form=number(rider?.form??50,'form'),fatigue=number(rider?.fatigue??0,'fatigue');
  ability*=.85+form*.003;
  ability*=.85+condition*.0015;
  if(condition<TUNING.exhaustion.thresholdEnergy)
    ability*=1-TUNING.exhaustion.maxAbilityPenalty*
      (1-condition/TUNING.exhaustion.thresholdEnergy);
  ability*=1-fatigue*.002;
  const stressTune=TUNING.temperatureStress;
  const temperatureStress=Math.max(0,stressTune.comfortMinC-temperature,
    temperature-stressTune.comfortMaxC);
  ability*=1-Math.min(stressTune.maxAbilityPenalty,temperatureStress*
    stressTune.abilityPenaltyPerDegree*(1-skills.endurance/100*stressTune.enduranceProtection));
  const resilience=phase==='attack'?(skills.endurance+skills.repeatability)/2:skills.endurance;
  const energyCostMultiplier=(1.2-resilience*.004)*
    (1+temperatureStress*stressTune.costPerDegree*(1-skills.endurance/100*.3));
  return {ability:+ability.toFixed(3),energyCostMultiplier:+energyCostMultiplier.toFixed(3),primarySkill:
    phase==='solo'?'timetrial':phase==='finale'?'sprint':phase==='attack'?'acceleration':phase==='chase'?'strength':terrainKey};
}
