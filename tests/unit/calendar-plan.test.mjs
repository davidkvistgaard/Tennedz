import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PELOTONIA_SEASONS,openOneDaySlots,seasonForDate} from "../../lib/calendar/season-plan.mjs";

const plan=JSON.parse(readFileSync(new URL("../../data/calendar/2027-plan.json",import.meta.url),"utf8"));

test("the supplied draft assigns every selected race to one of the three 2027 seasons",()=>{
  assert.equal(plan.status,"draft");
  assert.equal(plan.races.length,110);
  assert.deepEqual(PELOTONIA_SEASONS.map(season=>season.number),[1,2,3]);
  const slots=new Set();
  for(const race of plan.races){
    assert.equal(seasonForDate(race.planned_date),race.season,`${race.name} season`);
    assert.ok(race.source_start<=race.source_end,`${race.name} source dates`);
    if(race.format!=="one_day")continue;
    assert.ok([0,3].includes(new Date(`${race.planned_date}T12:00:00Z`).getUTCDay()),`${race.name} race day`);
    const key=`${race.planned_date}:${race.gender}`;
    assert.ok(!slots.has(key),`duplicate one-day slot ${key}`);
    slots.add(key);
  }
  assert.equal(slots.size,61);
});

test("open slots count only unused Wednesday and Sunday gender opportunities",()=>{
  const season={start:"2027-01-04",end:"2027-01-10"};
  assert.equal(openOneDaySlots([],season),4);
  assert.equal(openOneDaySlots([{format:"one_day",planned_date:"2027-01-06",gender:"M"}],season),3);
  assert.equal(openOneDaySlots([{format:"stage_race",planned_date:"2027-01-06",gender:"M"}],season),4);
});
