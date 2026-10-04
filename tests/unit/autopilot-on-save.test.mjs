import test from 'node:test';
import assert from 'node:assert/strict';
import {enterUpcomingOnDefaultSave} from '../../lib/calendar/autopilot-on-save.mjs';

function eventDb(events,error=null){
  const calls=[];
  const query={};
  for(const method of ['select','eq','in','gt','lte','order'])
    query[method]=(...args)=>{calls.push([method,...args]);return query;};
  query.limit=limit=>{calls.push(['limit',limit]);return Promise.resolve({data:events,error});};
  return {db:{from:table=>{assert.equal(table,'events');return query;}},calls};
}

test('saving a default checks the imminent race window and reports each join',async()=>{
  const {db,calls}=eventDb([{id:'a'},{id:'b'}]);
  const joins=[];
  const result=await enterUpcomingOnDefaultSave(db,{
    teamId:'team',gender:'F',now:new Date('2026-10-04T12:00:00Z'),
    enter:async(_db,eventId,teamId)=>{
      joins.push([eventId,teamId]);
      return {entered:eventId==='a',reason:eventId==='b'?'ENTRY_ALREADY_EXISTS':null};
    },
  });
  assert.deepEqual(joins,[['a','team'],['b','team']]);
  assert.deepEqual(result,{attempted:2,entered:1,more_eligible:false,results:[
    {event_id:'a',entered:true,reason:null},
    {event_id:'b',entered:false,reason:'ENTRY_ALREADY_EXISTS'},
  ]});
  assert.ok(calls.some(call=>call[0]==='gt'&&call[1]==='deadline'&&
    call[2]==='2026-10-04T12:00:00.000Z'));
  assert.ok(calls.some(call=>call[0]==='lte'&&call[1]==='deadline'&&
    call[2]==='2026-10-06T12:00:00.000Z'));
});

test('saved-default trigger exposes a cap and keeps permanent skips separate from retryable failures',async()=>{
  const {db}=eventDb(Array.from({length:9},(_,i)=>({id:`event-${i}`})));
  const result=await enterUpcomingOnDefaultSave(db,{teamId:'team',gender:'M',
    enter:async(_db,id)=>{
      if(id==='event-0')throw {status:409,code:'ENTRY_CONFLICT'};
      return {entered:true};
    }});
  assert.equal(result.attempted,8);
  assert.equal(result.entered,7);
  assert.equal(result.more_eligible,true);
  assert.equal(result.results[0].reason,'ENTRY_CONFLICT');
  await assert.rejects(enterUpcomingOnDefaultSave(db,{teamId:'team',gender:'M',
    enter:async()=>{throw {status:503,code:'RETRY'};}}));
  const broken=eventDb(null,{message:'unavailable'});
  await assert.rejects(enterUpcomingOnDefaultSave(broken.db,{teamId:'team',gender:'M',
    enter:async()=>({entered:true})}),/Could not load upcoming races/);
});
