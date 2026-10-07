import test from 'node:test';
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../../lib/engine/v2/skills.mjs';
import {capDiagnosticChaserSkills} from
  '../../lib/engine/v2/diagnostic-chaser-cap.mjs';

const rider=Object.fromEntries(SPORTING_SKILLS.map((skill,index)=>
  [skill,60+index]));

test('paired chaser probes cap only the chosen skill dimensions',()=>{
  for(const scope of ['all','power','terrain','chase','other']){
    const result=capDiagnosticChaserSkills(rider,50,scope);
    assert.deepEqual(Object.keys(result),SPORTING_SKILLS);
    for(const skill of SPORTING_SKILLS){
      const selected=scope==='all'||scope==='power'&&
        ['strength','endurance','repeatability'].includes(skill)||
        scope==='terrain'&&
        ['flat','hills','mountain','descending'].includes(skill)||
        scope==='chase'&&
        ['strength','endurance','repeatability','flat','hills',
          'mountain','descending'].includes(skill)||
        scope==='other'&&
        !['strength','endurance','repeatability','flat','hills',
          'mountain','descending'].includes(skill);
      assert.equal(result[skill],selected?50:rider[skill],`${scope}: ${skill}`);
    }
  }
  assert.deepEqual(rider,Object.fromEntries(SPORTING_SKILLS.map((skill,index)=>
    [skill,60+index])));
  assert.throws(()=>capDiagnosticChaserSkills(rider,50,'unknown'),/diagnostic/);
  assert.throws(()=>capDiagnosticChaserSkills(rider,0,'all'),/diagnostic/);
});
