import test from 'node:test';
import assert from 'node:assert/strict';
import seedrandom from 'seedrandom';
import {countries,countryCode,countryLabel,generateIdentity,generateNationality,generateAppearance,riderAppearance,nationTier,portraitPrompt} from '../../lib/riders/identity.mjs';
import {traditionsByCountry} from '../../lib/riders/names.mjs';

test('every supported country has working male and female names and a stable appearance',()=>{
  assert.equal(countries.length,243);
  assert.equal(new Set(countries.map(c=>c.iso3)).size,countries.length);
  for(const c of countries) {
    assert.ok(traditionsByCountry[c.code],c.code);
    for(const gender of ['M','F']) {
      const r=generateIdentity('coverage-'+c.code+gender,gender,{nationality:c.code});
      assert.equal(r.nationality,c.iso3);assert.ok(r.first_name&&r.last_name&&r.name);
      assert.ok(!r.name.includes('undefined'));assert.equal(r.appearance.version,1);
      assert.deepEqual(r,generateIdentity('coverage-'+c.code+gender,gender,{nationality:c.code}));
    }
  }
  assert.equal(countryCode('DEN'),'DK');assert.equal(countryCode('DNK'),'DK');assert.equal(countryLabel('SWE'),'Sweden');
});
test('weighted nations follow 75/20/5 and every world country remains reachable',()=>{
  const random=seedrandom('nationality-distribution'),counts={major:0,established:0,world:0},seen=new Set();
  for(let i=0;i<200000;i++){const code=generateNationality(random);counts[nationTier(code)]++;seen.add(code);}
  for(const [tier,expected] of [['major',.75],['established',.2],['world',.05]])assert.ok(Math.abs(counts[tier]/200000-expected)<.006,JSON.stringify(counts));
  assert.equal(seen.size,countries.length);
});
test('large portrait sample varies brows and faces with rare style details and no exact duplicates',()=>{
  const seen=new Set(),palettes=new Set();let dyed=0,jewelry=0,thin=0,light=0;
  for(let i=0;i<10000;i++) {
    const a=generateAppearance('sample-'+i,'SWE',i%2?'F':'M');
    const {seed,...traits}=a;assert.ok(seed);
    const key=JSON.stringify(traits);assert.ok(!seen.has(key));seen.add(key);
    palettes.add(a.palette);if(a.dye)dyed++;if(a.jewelry)jewelry++;
    if(a.browThickness<1.5)thin++;if(a.browDensity<.4)light++;
    assert.equal(a.browColor,a.naturalHair);
  }
  assert.equal(palettes.size,6);assert.ok(dyed>200&&dyed<450);assert.ok(jewelry>800&&jewelry<1200);
  assert.ok(thin>1500&&light>1500);
});
test('legacy identity is deterministic without renaming riders; saved appearance wins',()=>{
  const rider={id:'legacy-112',name:'Existing Name',nationality:'DEN',gender:'M',sprint:45};
  const before=JSON.stringify(rider),a=riderAppearance(rider);
  assert.equal(JSON.stringify(rider),before);assert.deepEqual(a,riderAppearance({...rider,form:99}));
  assert.equal(riderAppearance({...rider,appearance:a,nationality:'JPN'}),a);
  assert.ok(portraitPrompt(rider).includes('no glasses'));assert.ok(!('sprint' in a));
});
