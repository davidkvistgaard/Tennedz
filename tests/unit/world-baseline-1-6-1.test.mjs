import test from 'node:test';
import assert from 'node:assert/strict';
import {auditWorldBaseline} from '../../scripts/audit-world-baseline.mjs';

test('World Baseline 1.6.1 preserves source and object identities across every layer',()=>{
 const result=auditWorldBaseline();
 assert.equal(result.correctedDiscoverySources,18);
 assert.equal(result.gridCells,192);
 assert.ok(result.atlasObjects>=result.worldObjects);
});
