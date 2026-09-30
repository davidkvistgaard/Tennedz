import {sportingSkills} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

// Only genuinely quiet kilometres in the bunch can restore effort capacity.
// The caller caps the restored energy at the rider's starting race capacity.
export function recoveryForKilometre({rider,segment,effort,group,working=false,quietKm=0}){
  if(!Number.isInteger(quietKm)||quietKm<0)throw new Error('Invalid quiet-kilometre state.');
  const tune=TUNING.recovery;
  const calm=effort==='conserve'&&group==='peloton'&&!working&&
    segment.terrain==='flat'&&segment.surface==='road'&&!segment.exposed&&
    Math.abs(segment.gradientPct)<=tune.maxGradientPct&&
    segment.weather.windKph<=tune.maxWindKph&&segment.weather.rainMm<=tune.maxRainMm;
  if(!calm)return {quietKm:0,recovery:0};
  const nextQuietKm=quietKm+1;
  if(nextQuietKm<tune.quietKmRequired)return {quietKm:nextQuietKm,recovery:0};
  const endurance=sportingSkills(rider).endurance;
  return {quietKm:nextQuietKm,recovery:+(tune.basePerKm+endurance*tune.endurancePerPoint).toFixed(3)};
}
