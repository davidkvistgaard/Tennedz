import test from 'node:test';
import assert from 'node:assert/strict';
import {teamRating} from '../../lib/race/rating.mjs';
test('rating separates genders and counts the best sixteen result scores',()=>{
 const men=Array.from({length:20},(_,i)=>({id:`m${i}`,gender:'M',rating:i+1}));
 const women=Array.from({length:8},(_,i)=>({id:`f${i}`,gender:'F',rating:100}));
 assert.equal(teamRating([...men,...women],'M'),200);
 assert.equal(teamRating([...men,...women],'F'),800);
 assert.equal(teamRating([...men,...women,men[19]],'M'),200);
});
test('seeding rating never depends on skills, form, fatigue or injury',()=>{
 const r={id:'a',gender:'M',rating:85};
 assert.equal(teamRating([r],'M'),teamRating([{...r,mountain:100,form:100,fatigue:90,injury_until:'2099-01-01'}],'M'));
 assert.equal(teamRating([{id:'new',gender:'F'}],'F'),0);
 assert.throws(()=>teamRating([r],null));
});
