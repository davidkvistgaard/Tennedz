import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PELOTONIA_SEASONS,seasonForDate} from "../../lib/calendar/season-plan.mjs";

const outline=JSON.parse(readFileSync(new URL("../../data/calendar/2027-outline.json",import.meta.url),"utf8"));

test("2027 outline has three separate four-month Pelotonia years",()=>{
  assert.equal(outline.status,"planning");
  assert.equal(outline.calendar_year,2027);
  assert.deepEqual(outline.seasons.map(season=>season.number),[1,2,3]);
  assert.deepEqual(outline.seasons.map(season=>season.months.length),[4,4,4]);
  assert.deepEqual(outline.seasons.flatMap(season=>season.months.map(month=>month.key)),
    Array.from({length:12},(_,month)=>`2027-${String(month+1).padStart(2,"0")}`));
  assert.deepEqual(PELOTONIA_SEASONS.map(season=>season.number),[1,2,3]);
  assert.equal(seasonForDate("2027-04-30"),1);
  assert.equal(seasonForDate("2027-05-01"),2);
  assert.equal(seasonForDate("2027-08-31"),2);
  assert.equal(seasonForDate("2027-09-01"),3);
});

test("monthly totals are internally consistent and the published outline contains no named races",()=>{
  const months=outline.seasons.flatMap(season=>season.months);
  for(const month of months){
    assert.equal(month.candidates,month.one_day+month.stage_races,month.key);
    assert.ok(month.open_one_day_slots>=0,month.key);
  }
  assert.equal(months.reduce((sum,month)=>sum+month.candidates,0),110);
  assert.equal(months.reduce((sum,month)=>sum+month.one_day,0),61);
  assert.equal(months.reduce((sum,month)=>sum+month.stage_races,0),49);
  assert.equal(outline.seasons[2].months[2].candidates,0);
  assert.equal(outline.seasons[2].months[3].candidates,0);
  assert.ok(!JSON.stringify(outline).includes("race_name"));
  assert.ok(!JSON.stringify(outline).includes("planned_date"));
});
