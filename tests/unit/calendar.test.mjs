import test from "node:test";
import assert from "node:assert/strict";
import { calendarRequest, routeTemplates } from "../../lib/race/templates.mjs";
import { normalizeRoute } from "../../lib/race/route.mjs";
test("calendar validates deadlines and only allows reviewed fictional routes and separate genders", () => {
  const now = Date.parse("2026-09-23T12:00:00Z");
  const input = {
    name: "  Åbningsløbet  ",
    template_id: "coast",
    gender: "BOTH",
    deadline: "2026-09-24T12:00:00Z",
  };
  const value = calendarRequest(input, now);
  assert.equal(value.name, "Åbningsløbet");
  assert.equal(value.gender, "BOTH");
  for (const patch of [
    { name: "a" },
    { name: "bad\nname" },
    { gender: "ALL" },
    { template_id: "custom" },
    { deadline: "invalid" },
    { deadline: "2026-09-23T12:10:00Z" },
    { deadline: "2027-01-01T12:00:00Z" },
  ])
    assert.throws(() => calendarRequest({ ...input, ...patch }, now));
  for (const template of routeTemplates) {
    const route = normalizeRoute(template);
    assert.ok(route.distance >= 100);
    assert.ok(route.points.length > 2);
    assert.ok(route.ascent > 0);
  }
  value.stage.profile_points[0][1] = 99999;
  assert.notEqual(routeTemplates[0].profile_points[0][1], 99999);
});

test("scheduled calendar creation preserves a UCI source week and keeps genders separate",()=>{
  const now=Date.parse("2026-09-23T12:00:00Z");
  const input={name:"Northern Classic",template_id:"hills",gender:"BOTH",
    deadline:"2026-09-24T12:00:00Z",scheduled_at:"2026-09-30T12:00:00Z",
    calendar_source:"UCI",race_tier:5,source_date:"2026-10-03",
    source_url:"https://example.org/races/northern-classic"};
  const value=calendarRequest(input,now);
  assert.equal(value.scheduled_at,new Date(input.scheduled_at).toISOString());
  assert.equal(value.source_date,input.source_date);
  assert.equal(value.race_tier,5);
  for(const patch of [
    {scheduled_at:"2026-10-01T12:00:00Z"},
    {scheduled_at:"2026-09-24T11:00:00Z"},
    {race_tier:7},{source_date:"2026-10-10"},{source_url:"javascript:bad"},
  ])assert.throws(()=>calendarRequest({...input,...patch},now));
  assert.equal(calendarRequest({...input,calendar_source:"PELOTONIA",
    source_date:null,source_url:null},now).calendar_source,"PELOTONIA");
});
