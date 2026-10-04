import test from 'node:test';
import assert from 'node:assert/strict';
import {oneDaySlot,validCalendarPlacement,entryReadiness} from '../../lib/calendar/rhythm.mjs';
import {validateDefaultLineup,resolveAutopilotLineup} from '../../lib/calendar/autopilot.mjs';
import {pointsForResult,pointsForDivisionResult,aggregateRanking,POINT_POLICY_VERSION} from '../../lib/calendar/points.mjs';
import {planAutopilotEntry} from '../../lib/calendar/autopilot-entry.mjs';

test('UCI one-day sources keep their week while mapping to fixed slots',()=>{
  assert.equal(oneDaySlot('2026-04-11'),'2026-04-12'); // Saturday to Sunday.
  assert.equal(oneDaySlot('2026-04-10'),'2026-04-08'); // Friday tie to Wednesday.
  assert.equal(oneDaySlot('2026-04-10',{preferredDay:'SUNDAY'}),'2026-04-12');
  assert.equal(validCalendarPlacement({gender:'M',source:'UCI',format:'ONE_DAY',scheduledDate:'2026-04-12'}),true);
  assert.equal(validCalendarPlacement({gender:'F',source:'UCI',format:'ONE_DAY',scheduledDate:'2026-04-11'}),false);
  assert.equal(validCalendarPlacement({gender:'F',source:'UCI',format:'STAGE_RACE',startDate:'2026-04-11',endDate:'2026-04-18'}),true);
  assert.throws(()=>oneDaySlot('2026-02-30'));
});

test('readiness is private to the team entry, not the event lifecycle',()=>{
  const event={status:'OPEN',deadline:'2099-01-01T12:00:00Z',teamSize:2};
  assert.equal(entryReadiness(event,null),'TEAM_INCOMPLETE');
  assert.equal(entryReadiness(event,{selected_riders:['a','b'],captain_id:'a'}),'ORDERS_MISSING');
  assert.equal(entryReadiness(event,{selected_riders:['a','b'],captain_id:'a',orders:{version:1}}),'READY');
  assert.equal(entryReadiness({...event,status:'FINISHED'},null),'FINISHED');
});

test('autopilot replaces unavailable defaults deterministically without inventing riders',()=>{
  const roster=[{id:'a',gender:'M',rating:10},{id:'b',gender:'M',rating:50},
    {id:'c',gender:'M',rating:70},{id:'d',gender:'M',rating:60},
    {id:'w',gender:'F',rating:100}];
  const fallback={gender:'M',eventFormat:'ONE_DAY',selectedRiders:['a','b'],captainId:'b'};
  validateDefaultLineup(fallback,roster,{teamSize:2});
  const event={gender:'M',format:'ONE_DAY',scheduledDate:'2026-04-12'};
  assert.deepEqual(resolveAutopilotLineup({event,roster,defaultSelection:fallback,
    unavailableRiderIds:['a'],teamSize:2}),{ready:true,source:'DEFAULT',
    selectedRiders:['b','c'],captainId:'b',replacements:['c']});
  assert.deepEqual(resolveAutopilotLineup({event,roster,defaultSelection:fallback,
    unavailableRiderIds:['a','c','d'],teamSize:2}),{ready:false,
    reason:'NOT_ENOUGH_ELIGIBLE_RIDERS',selectedRiders:['b'],missing:1});
  assert.throws(()=>validateDefaultLineup({...fallback,selectedRiders:['a','a']},roster,{teamSize:2}));
  assert.equal(resolveAutopilotLineup({event,roster,teamSize:2}).reason,'DEFAULT_NOT_CONFIGURED');
});

test('autopilot builds a valid conservative entry without overwriting a manager',()=>{
  const event={id:'event',kind:'one_day',gender:'F',calendar_source:'PELOTONIA',
    scheduled_at:'2099-05-03T12:00:00Z',deadline:'2099-05-02T12:00:00Z',status:'OPEN'};
  const team={id:'team',user_id:'user'};
  const roster=Array.from({length:9},(_,i)=>({id:`r${i}`,gender:'F',rating:90-i}));
  const defaultSelection={selectedRiders:roster.slice(0,8).map(r=>r.id),captainId:'r0'};
  const input={event,team,roster,defaultSelection};
  const plan=planAutopilotEntry(input);
  assert.equal(plan.ready,true);
  assert.equal(plan.orders.plan,'balanced');
  assert.equal(plan.orders.riders.r0.role,'captain');
  assert.equal(Object.keys(plan.orders.riders).length,8);
  assert.equal(planAutopilotEntry({...input,existingEntry:true}).reason,'ENTRY_ALREADY_EXISTS');
  assert.equal(planAutopilotEntry({...input,conflictingEventIds:['another']}).reason,
    'SIMULTANEOUS_EVENT_PRIORITY_UNRESOLVED');
  assert.equal(planAutopilotEntry({...input,defaultSelection:null}).reason,'DEFAULT_NOT_CONFIGURED');
  assert.equal(planAutopilotEntry({...input,event:{...event,scheduled_at:null}}).reason,
    'EVENT_NOT_SCHEDULED');
  assert.equal(planAutopilotEntry({...input,event:{...event,scheduled_at:'2099-05-05T12:00:00Z'}}).reason,
    'EVENT_NOT_SCHEDULED');
});

test('one points award belongs to filtered rankings without duplicate transactions',()=>{
  assert.equal(POINT_POLICY_VERSION,'v0.1');
  assert.equal(pointsForResult({tier:6,resultType:'GC',placing:1}),1000);
  assert.equal(pointsForResult({tier:6,resultType:'ONE_DAY',placing:2}),750);
  assert.equal(pointsForResult({tier:6,resultType:'STAGE',placing:1}),150);
  assert.equal(pointsForResult({tier:6,resultType:'KOM',placing:1}),300);
  assert.equal(pointsForResult({tier:3,resultType:'STAGE',placing:1}),40);
  assert.equal(pointsForDivisionResult({tier:2,resultType:'ONE_DAY',placing:1,multiplier:0.8}),100);
  assert.equal(pointsForDivisionResult({tier:1,resultType:'ONE_DAY',placing:21,multiplier:1}),0);
  assert.throws(()=>pointsForDivisionResult({tier:2,resultType:'ONE_DAY',placing:1,multiplier:1.1}));
  const awards=[{rider_id:'a',team_id:'team',gender:'F',calendar_source:'PELOTONIA',
    event_format:'STAGE_RACE',season_year:2027,points:1000},
  {rider_id:'b',team_id:'team',gender:'M',calendar_source:'UCI',
    event_format:'ONE_DAY',season_year:2027,points:750}];
  assert.deepEqual(aggregateRanking(awards,{entity:'team'}),[{id:'team',points:1750}]);
  assert.deepEqual(aggregateRanking(awards,{entity:'team',gender:'F'}),[{id:'team',points:1000}]);
  assert.deepEqual(aggregateRanking(awards,{entity:'rider',source:'UCI'}),[{id:'b',points:750}]);
});
