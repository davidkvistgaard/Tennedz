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
