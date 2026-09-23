import test from "node:test";
import assert from "node:assert/strict";
import seedrandom from "seedrandom";
import { starterPack, skills, teamName, signupInput } from "../../lib/onboarding/starter.mjs";
import { countryCode } from "../../lib/riders/identity.mjs";
import { namePools } from "../../lib/riders/names.mjs";
import { publicRiderFields } from "../../lib/onboarding/public-rider.mjs";
test("starter packs contain eight riders per gender, appropriate names and equal sporting profiles",()=>{
  for(let i=0;i<50;i++) {
    const pack=starterPack(seedrandom(String(i)));
    assert.equal(pack.length,16);assert.equal(new Set(pack.map(r=>r.name)).size,16);
    for(const gender of ["M","F"]) {
      const riders=pack.filter(r=>r.gender===gender);assert.equal(riders.length,8);
      for(const r of riders) {
        const pool=namePools[r.name_tradition];
        assert.ok(pool[gender].includes(r.first_name));assert.ok((gender==="F"&&pool.lastF?pool.lastF:pool.last).includes(r.last_name));
        assert.ok(countryCode(r.nationality));assert.equal(r.appearance.version,1);
        assert.equal(r.rating,0);assert.equal(r.fatigue,0);assert.equal(r.form,40);
        assert.ok(r.age>=22&&r.age<=25);
        for(const skill of skills) assert.ok(r[skill]>=20&&r[skill]<=50&&r[skill+"_cap"]>r[skill]&&r[skill+"_cap"]<=90);
      }
    }
    assert.deepEqual(pack.slice(0,8).map(r=>skills.map(s=>r[s])),pack.slice(8).map(r=>skills.map(s=>r[s])));
  }
});
test("onboarding validates names and real email credentials",()=>{
  assert.equal(teamName("  Nordlys   Cycling  "),"Nordlys Cycling");
  for(const bad of [null,"","AB","X".repeat(41),"<script>","A\u202eBC","hello\nworld"]) assert.throws(()=>teamName(bad));
  assert.equal(signupInput({email:" Player@Example.com ",password:"long passphrase here"}).email,"player@example.com");
  for(const body of [{},{email:"tennedz",password:"abcdefghijkl"},{email:"x@tennedz.local",password:"abcdefghijkl"},{email:"x@example.com",password:"short"}]) assert.throws(()=>signupInput(body));
});
test("public rider allowlist excludes all hidden caps and potential",()=>{
  assert.ok(publicRiderFields.includes("birth_date"));
  assert.ok(!/cap|potential|\*/.test(publicRiderFields));
});
test("public cosmetic seeds cannot reconstruct or control hidden sporting potential",()=>{
  function source(cosmetic,sport){let n=0;return()=>n++<4?cosmetic:sport;}
  const a=starterPack(source(.1,.2)),b=starterPack(source(.3,.2)),c=starterPack(source(.1,.4));
  const sport=pack=>pack.map(r=>[r.age,...skills.map(s=>r[s]),...skills.map(s=>r[s+'_cap'])]);
  assert.deepEqual(sport(a),sport(b));
  assert.notDeepEqual(a.map(r=>r.appearance),b.map(r=>r.appearance));
  assert.deepEqual(a.map(r=>r.appearance),c.map(r=>r.appearance));
  assert.notDeepEqual(sport(a),sport(c));
});
