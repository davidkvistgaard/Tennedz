// Local companion to the isolated, disposable real-output SQL fixture.
// Input and output contain private rider data; keep both in ignored test output.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { buildRace } from "../../lib/race/cycle.mjs";

const [snapshotPath, outputPath] = process.argv.slice(2);
if (!snapshotPath || !outputPath) throw Error("Pass private snapshot and output file paths.");
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
assert.ok(snapshot.locked_division_reveal?.assignments);
const output = buildRace(snapshot);
assert.deepEqual(output.division_reveal, snapshot.locked_division_reveal);
writeFileSync(outputPath, JSON.stringify(output));
console.log(JSON.stringify({ divisions: output.divisions.length,
  teams: output.divisions.reduce((count, division) => count + division.teams.length, 0),
  riders: output.divisions.reduce((count, division) => count + division.results.length, 0) }));
