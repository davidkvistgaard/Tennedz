import seedrandom from "seedrandom";
import { simulateStage } from "../engine/simulateStage.js";
import { generateLockedWeather } from "../weather/weatherModel.js";
import { teamRating } from "./rating.mjs";

export const ENGINE_VERSION = "recovery-one-day-3";
const POINTS = [100,85,75,68,62,57,53,49,45,41,38,35,32,29,26,23,20,17,14,11];
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const skills = ["sprint","flat","hills","mountain","cobbles","timetrial","endurance","strength","wind"];
export function splitDivisions(teams) {
  const ranked = teams.slice().sort((a,b) => b.seed_power-a.seed_power || a.id.localeCompare(b.id));
  const divisions = [];
  while (ranked.length) divisions.push(ranked.splice(0,20));
  // A final solo team must race: move the weakest team from the preceding division.
  if (divisions.length>1 && divisions.at(-1).length===1) divisions.at(-1).unshift(divisions.at(-2).pop());
  return divisions;
}
export function buildRace(snapshot) {
  const {event,stage,game_date,teams} = snapshot;
  if (event?.kind!=="one_day" || !stage || !Number.isFinite(Number(stage.distance_km)) || stage.distance_km<20 || stage.distance_km>400) throw new Error("This one-day race needs a valid route of 20–400 km.");
  if (!Array.isArray(teams) || teams.length<2 || teams.length>400) throw new Error("A one-day race requires 2–400 teams.");
  const allSelected = new Set();
  const prepared = teams.map(t => {
    const ids=t.entry.selected_riders;
    if (!Array.isArray(ids) || ids.length!==8 || new Set(ids).size!==8 || !ids.includes(t.entry.captain_id)) throw new Error("An entry requires eight different riders and a captain.");
    const riders=ids.map(id => t.riders.find(r=>r.id===id));
    for (const r of riders) {
      if (!r || allSelected.has(r.id) || (event.gender && r.gender!==event.gender) || (r.injury_until && r.injury_until>game_date)) throw new Error("An entry contains invalid, injured, or unowned riders.");
      if (skills.some(k=>!Number.isFinite(Number(r[k] ?? 0)))) throw new Error("Invalid rider attributes.");
      allSelected.add(r.id);
    }
    return {...t, seed_power:teamRating(t.riders,event.gender),
      riders:riders.map(r=>({...r,is_captain:r.id===t.entry.captain_id}))};
  });
  const groups=splitDivisions(prepared);
  const seed=event.seed || `${event.id}:${ENGINE_VERSION}`;
  const weather=event.weather_locked || generateLockedWeather({event_id:event.id,country_code:event.country_code,game_date_iso:game_date,deadline_iso:event.deadline});
  const divisions=groups.map((group,i)=>{
    const index=i+1;
    const minimum=clamp(0.62+0.25*(1-Math.exp(-(groups.length-1)/6)),0.62,0.90);
    const multiplier=groups.length===1?1:1-(1-minimum)*Math.pow(i/(groups.length-1),1.35);
    const divSeed=`${seed}:div${index}`;
    const sim=simulateStage({stage,teamsWithRiders:group,seed:divSeed,weather});
    if (sim.results.length!==group.length*8) throw new Error("The engine returned an incomplete result.");
    const results=sim.results.map(r=>{
      const before=group.find(t=>t.id===r.team_id).riders.find(x=>x.id===r.rider_id);
      const rng=seedrandom(`${divSeed}:injury:${r.rider_id}`);
      const crash=rng()<0.015;
      let injury_until=before.injury_until || null;
      if (crash) { const date=new Date(`${game_date}T00:00:00Z`); date.setUTCDate(date.getUTCDate()+(1+Math.floor(rng()*6))*7); injury_until=date.toISOString().slice(0,10); }
      return {...r,points:Math.round((POINTS[r.position-1] || 0)*multiplier),after:{
        fatigue:clamp(Number(before.fatigue ?? 0)+clamp(Math.round(10+stage.distance_km*0.08),12,28),0,100),
        form:clamp(Number(before.form ?? 50)+3-(crash?35:0),0,100),injury_until}};
    });
    const teamResults=group.map(t=>{
      const captain=results.find(r=>r.rider_id===t.entry.captain_id);
      return {team_id:t.id,captain_id:captain.rider_id,time_sec:captain.time_sec,seed_power:t.seed_power};
    }).sort((a,b)=>a.time_sec-b.time_sec || a.team_id.localeCompare(b.team_id))
      .map((t,j)=>({...t,position:j+1,points:Math.round((POINTS[j] || 0)*multiplier)}));
    return {index,seed:divSeed,multiplier,teams:teamResults,results,feed:sim.feed,replay:sim.replay};
  });
  return {seed,engine_version:ENGINE_VERSION,stage,weather,divisions};
}
