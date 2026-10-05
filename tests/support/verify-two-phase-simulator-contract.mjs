// Use with a private JSON snapshot returned by the rollback-only SQL probe.
// Prints only aggregate counts; never commit or upload the snapshot itself.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildRace} from "../../lib/race/cycle.mjs";

const path=process.argv[2];
if(!path)throw Error("Pass the private tactics snapshot JSON file path.");
const snapshot=JSON.parse(readFileSync(path,"utf8"));
const reveal=snapshot.locked_division_reveal;
assert.ok(reveal&&Array.isArray(reveal.assignments));
const output=buildRace(snapshot);
assert.deepEqual(output,buildRace(snapshot));
assert.deepEqual(output.division_reveal,reveal);
const assigned=new Set(reveal.assignments.map(row=>row.teamId));
const seenTeams=new Set(),seenRiders=new Set();
for(const division of output.divisions){
  assert.equal(division.teams.length*8,division.results.length);
  assert.deepEqual(new Set(division.replay.roster.map(row=>row.id)),
    new Set(division.results.map(row=>row.rider_id)));
  for(const team of division.teams){
    assert.ok(assigned.has(team.team_id));
    assert.ok(!seenTeams.has(team.team_id));
    seenTeams.add(team.team_id);
  }
  for(const rider of division.results){
    assert.ok(!seenRiders.has(rider.rider_id));
    seenRiders.add(rider.rider_id);
  }
}
assert.equal(seenTeams.size,snapshot.teams.length);
assert.equal(seenRiders.size,snapshot.teams.length*8);
console.log(JSON.stringify({divisions:output.divisions.length,
  teams:seenTeams.size,riders:seenRiders.size,
  replay_rosters:output.divisions.map(division=>division.replay.roster.length)}));
