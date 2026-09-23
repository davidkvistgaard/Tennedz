import test from "node:test";
import assert from "node:assert/strict";
import { buildRace,splitDivisions } from "../../lib/race/cycle.mjs";
const rider=(id)=>({id,name:id,gender:"M",sprint:40,flat:40,hills:40,mountain:40,cobbles:40,timetrial:40,endurance:40,strength:40,wind:40,form:50,fatigue:0});
function input(){return {event:{id:"race",kind:"one_day",gender:"M",deadline:"2026-01-01",country_code:"FR"},game_date:"2026-01-01",
  stage:{name:"Flat 130",distance_km:130,tags:["FLAT"],profile_points:[[0,0],[130,0]]},
  teams:["a","b"].map(id=>({id,name:id,riders:Array.from({length:8},(_,i)=>rider(`${id}${i}`)),entry:{selected_riders:Array.from({length:8},(_,i)=>`${id}${i}`),captain_id:`${id}0`}}))};}
test("race replay is deterministic, complete and uses actual distance",()=>{
  const s=input(),a=buildRace(s);assert.deepEqual(a,buildRace(s));
  assert.equal(a.divisions[0].results.length,16);
  assert.equal(a.stage.distance_km,130);
  assert.deepEqual(a.divisions[0].teams.map(t=>t.points).sort((a,b)=>b-a),[100,85]);
  const feed=a.divisions[0].feed;assert.equal(feed.at(-1).km,130);
  assert.ok(feed.every((f,i)=>f.km>=0&&f.km<=130&&(!i||f.km>=feed[i-1].km)));
  assert.ok(a.divisions[0].results.every(r=>r.after.fatigue===20&&r.after.form>=0&&r.after.form<=100));
});
test("no singleton divisions at 21 and 41 teams; 400-team input stays bounded",()=>{
  for(const n of [2,20,21,40,41,400]){const d=splitDivisions(Array.from({length:n},(_,i)=>({id:String(i),seed_power:n-i})));assert.equal(d.flat().length,n);assert.ok(d.every(x=>x.length>=2&&x.length<=20));}
});
test("invalid ownership, duplicate selection, gender and injured riders fail closed",()=>{
  for(const mutate of [s=>s.teams[0].entry.selected_riders[0]="foreign",s=>s.teams[0].entry.selected_riders[1]="a0",s=>s.teams[0].riders[0].gender="F",s=>s.teams[0].riders[0].injury_until="2026-01-02"]){const s=input();mutate(s);assert.throws(()=>buildRace(s));}
});
test("route specialty changes the calculated outcome",()=>{
  const s=input();s.teams[0].riders.forEach(r=>{r.flat=100;r.mountain=1;});s.teams[1].riders.forEach(r=>{r.flat=1;r.mountain=100;});
  const flat=buildRace(s);s.stage.tags=["MOUNTAIN"];const mountain=buildRace(s);
  assert.notDeepEqual(flat.divisions[0].results,mountain.divisions[0].results);
});
test("full multi-division simulation ranks each rider and captain exactly once",()=>{
 const s=input();
 s.teams=Array.from({length:41},(_,i)=>{
  const id=`t${String(i).padStart(2,"0")}`;
  return {id,name:id,riders:Array.from({length:8},(_,j)=>rider(`${id}-${j}`)),entry:{selected_riders:Array.from({length:8},(_,j)=>`${id}-${j}`),captain_id:`${id}-0`}};
 });
 const race=buildRace(s);
 assert.deepEqual(race.divisions.map(d=>d.teams.length),[20,19,2]);
 const results=race.divisions.flatMap(d=>d.results);
 assert.equal(new Set(results.map(r=>r.rider_id)).size,328);
 assert.ok(race.divisions.every(d=>d.teams.every(t=>t.captain_id===`${t.team_id}-0`) && d.teams[0].points===Math.round(100*d.multiplier)));
});
