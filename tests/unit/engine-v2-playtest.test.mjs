import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91Playtest,summarizeV91Playtest} from
  '../../lib/engine/v2/playtest.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';

test('a synthetic v91 playtest is deterministic and keeps its versioned recording',()=>{
  const input={distanceKm:40,terrain:'rolling',teamCount:4,gender:'F',seed:'repeat'};
  const first=createV91Playtest(input);
  const second=createV91Playtest(input);
  assert.deepEqual(first.recording,second.recording);
  assert.equal(first.recording.tuningVersion,MOTOR_ATTACK_TRACE_VERSION);
  const summary=summarizeV91Playtest(first);
  assert.equal(summary.frames.length,40);
  assert.equal(summary.frames[0].ownRiders.length,8);
  assert.equal(summary.provisional,true);
  assert.equal(summary.provisionalTopTen.length,10);
});

test('changing a manager order changes attacks and paid energy on the same field',()=>{
  const shared={distanceKm:40,terrain:'flat',teamCount:4,seed:'paired'};
  const quiet=createV91Playtest({...shared,effort:'conserve',attack:'none',chase:'ignore'});
  const active=createV91Playtest({...shared,effort:'hard',attack:'repeated',chase:'all'});
  const ownAttacks=playtest=>playtest.recording.frames.flatMap(frame=>frame.attackers)
    .filter(riderId=>riderId.startsWith('you-')).length;
  assert.equal(ownAttacks(quiet),0);
  assert.ok(ownAttacks(active)>0);
  const energy=playtest=>playtest.recording.frames.at(-1).teamEnergy
    .find(team=>team.teamId==='you').mean;
  assert.ok(energy(active)<energy(quiet));
});

test('playtest settings stay bounded to documented synthetic options',()=>{
  assert.throws(()=>createV91Playtest({distanceKm:401}),/valid playtest settings/);
  assert.throws(()=>createV91Playtest({teamCount:21}),/valid playtest settings/);
  assert.throws(()=>createV91Playtest({terrain:'custom'}),/valid playtest settings/);
  assert.throws(()=>createV91Playtest({seed:''}),/valid playtest settings/);
});
