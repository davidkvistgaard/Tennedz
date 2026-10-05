import test from "node:test";
import assert from "node:assert/strict";
import { buildRace,splitDivisions } from "../../lib/race/cycle.mjs";
const rider=(id)=>({id,name:id,gender:"M",sprint:40,flat:40,hills:40,mountain:40,cobbles:40,timetrial:40,endurance:40,strength:40,wind:40,form:50,fatigue:0});
function input(){return {event:{id:"race",kind:"one_day",gender:"M",deadline:"2026-01-01",scheduled_at:"2026-01-01T12:00:00Z",country_code:"FR"},game_date:"2026-01-01",
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
test("division sizes stay balanced and bounded at 21, 41, 45 and 400 teams",()=>{
  for(const n of [2,20,21,40,41,45,400]){
    const d=splitDivisions(Array.from({length:n},(_,i)=>({id:String(i),seed_power:n-i})));
    assert.equal(d.flat().length,n);
    assert.ok(d.every(x=>x.length>=2&&x.length<=20));
    assert.ok(Math.max(...d.map(x=>x.length))-Math.min(...d.map(x=>x.length))<=1);
    assert.deepEqual(d.flat().map(x=>x.seed_power),Array.from({length:n},(_,i)=>n-i));
    if(n===45)assert.deepEqual(d.map(x=>x.length),[15,15,15]);
  }
});
test("invalid ownership, duplicate selection, gender and injured riders fail closed",()=>{
  for(const mutate of [s=>s.teams[0].entry.selected_riders[0]="foreign",s=>s.teams[0].entry.selected_riders[1]="a0",s=>s.teams[0].riders[0].gender="F",s=>s.teams[0].riders[0].injury_until="2026-01-02"]){const s=input();mutate(s);assert.throws(()=>buildRace(s));}
});
test("route specialty changes the calculated outcome",()=>{
  const s=input();s.teams[0].riders.forEach(r=>{r.flat=100;r.mountain=1;});s.teams[1].riders.forEach(r=>{r.flat=1;r.mountain=100;});
  const flat=buildRace(s);s.stage.tags=["MOUNTAIN"];const mountain=buildRace(s);
  assert.notDeepEqual(flat.divisions[0].results,mountain.divisions[0].results);
});
test("45-team simulation records three separate complete races",()=>{
 const s=input();
 s.teams=Array.from({length:45},(_,i)=>{
  const id=`t${String(i).padStart(2,"0")}`;
  return {id,name:id,riders:Array.from({length:8},(_,j)=>rider(`${id}-${j}`)),entry:{selected_riders:Array.from({length:8},(_,j)=>`${id}-${j}`),captain_id:`${id}-0`}};
 });
 const race=buildRace(s);
 assert.deepEqual(race,buildRace(s));
 assert.deepEqual(race.divisions.map(d=>d.teams.length),[15,15,15]);
 const results=race.divisions.flatMap(d=>d.results);
 assert.equal(new Set(results.map(r=>r.rider_id)).size,360);
 assert.equal(new Set(race.divisions.flatMap(d=>d.teams.map(t=>t.team_id))).size,45);
 assert.equal(new Set(race.divisions.map(d=>d.seed)).size,3);
 for(const division of race.divisions){
  assert.equal(division.replay.roster.length,120);
  assert.deepEqual(new Set(division.replay.roster.map(r=>r.id)),new Set(division.results.map(r=>r.rider_id)));
  assert.deepEqual(new Set(division.replay.roster.map(r=>r.team_id)),new Set(division.teams.map(t=>t.team_id)));
 }
 assert.ok(race.divisions.every(d=>d.teams.every(t=>t.captain_id===`${t.team_id}-0`) && d.teams[0].points===Math.round(100*d.multiplier)));
});
test("an explicit locked points snapshot seeds separate races despite later roster changes",()=>{
 const s=input();
 s.teams=Array.from({length:45},(_,i)=>{
  const id=`t${String(i).padStart(2,"0")}`;
  return {id,name:id,riders:Array.from({length:8},(_,j)=>({...rider(`${id}-${j}`),flat:40+i})),
   entry:{selected_riders:Array.from({length:8},(_,j)=>`${id}-${j}`),captain_id:`${id}-0`}};
 });
 s.points_at_registration_lock={eventId:s.event.id,seasonYear:2026,gender:"M",
  entrants:s.teams.map((team,i)=>({teamId:team.id,earnedPoints:45-i}))};
 const first=buildRace(s);
 assert.deepEqual(first.divisions.map(d=>d.teams.length),[15,15,15]);
 const membership=(race)=>race.divisions.map(d=>d.teams.map(t=>t.team_id).sort());
 assert.deepEqual(membership(first),[0,1,2].map(index=>s.teams.slice(index*15,index*15+15).map(t=>t.id).sort()));
 assert.equal(first.division_reveal.assignments[0].teamId,"t00");
 s.teams.reverse();
 s.teams[0].riders.forEach(r=>{r.flat=100;});
 assert.deepEqual(membership(buildRace(s)),membership(first));
});
test("a locked points snapshot must match the exact event, season, gender and entrant set",()=>{
 const s=input();
 const points={eventId:s.event.id,seasonYear:2026,gender:"M",
  entrants:s.teams.map(team=>({teamId:team.id,earnedPoints:0}))};
 for(const invalid of [
  {...points,eventId:"foreign"},
  {...points,seasonYear:2025},
  {...points,gender:"F"},
  {...points,entrants:points.entrants.slice(0,1)},
  {...points,entrants:[points.entrants[0],{teamId:"foreign",earnedPoints:0}]},
  {...points,entrants:[points.entrants[0],points.entrants[0]]},
 ]) assert.throws(()=>buildRace({...s,points_at_registration_lock:invalid}));
 assert.throws(()=>buildRace({...s,event:{...s.event,scheduled_at:null},points_at_registration_lock:points}),/scheduled race season/);
});
