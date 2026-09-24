import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CLUB_PALETTES,KIT_PATTERNS,teamKitOptions,defaultKit,validateTeamKit} from '../../lib/riders/club-kit.mjs';
test('kit catalogue contains 50 distinct palettes and 25 distinct layouts',()=>{
  assert.equal(Object.keys(CLUB_PALETTES).length,50);
  assert.equal(Object.keys(KIT_PATTERNS).length,25);
  assert.equal(new Set(Object.values(CLUB_PALETTES).map(p=>`${p.primary}:${p.accent}`)).size,50);
  assert.equal(new Set(Object.values(KIT_PATTERNS).map(p=>p.paths.join(' '))).size,25);
  for(const p of Object.values(CLUB_PALETTES))for(const c of [p.primary,p.accent])assert.match(c,/^#[0-9a-f]{6}$/);
});
test('team draws are stable, unique, restricted and cover the catalogue',()=>{
  const palettes=new Set(),patterns=new Set(),draws=new Set();
  for(let i=0;i<1000;i++){
    const id=`team-${i}`,options=teamKitOptions(id);
    assert.deepEqual(options,teamKitOptions(id));
    assert.equal(new Set(options.palettes).size,4);assert.equal(new Set(options.patterns).size,3);
    options.palettes.forEach(x=>palettes.add(x));options.patterns.forEach(x=>patterns.add(x));draws.add(JSON.stringify(options));
    const valid={palette:options.palettes[3],pattern:options.patterns[2]};
    assert.deepEqual(validateTeamKit(valid,id),valid);
    const excluded=Object.keys(CLUB_PALETTES).find(x=>!options.palettes.includes(x));
    assert.deepEqual(validateTeamKit({...valid,palette:excluded},id),defaultKit(id));
    assert.deepEqual(validateTeamKit({palette:'__proto__',pattern:'bogus'},id),defaultKit(id));
  }
  assert.equal(palettes.size,50);assert.equal(patterns.size,25);assert.ok(draws.size>990);
});
