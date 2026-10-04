import test from 'node:test';
import assert from 'node:assert/strict';
import {nextTeamRace} from '../../lib/calendar/next-race.mjs';

test('team home chooses the next actual race date over a legacy entry deadline',()=>{
  const now=Date.parse('2026-10-01T00:00:00Z');
  const events=[
    {id:'legacy',kind:'one_day',gender:'F',status:'OPEN',deadline:'2026-10-02T00:00:00Z'},
    {id:'later',kind:'one_day',gender:'F',status:'OPEN',deadline:'2026-10-03T00:00:00Z',scheduled_at:'2026-10-11T12:00:00Z'},
    {id:'next',kind:'one_day',gender:'F',status:'OPEN',deadline:'2026-10-03T00:00:00Z',scheduled_at:'2026-10-07T12:00:00Z'},
    {id:'men',kind:'one_day',gender:'M',status:'OPEN',deadline:'2026-10-02T00:00:00Z',scheduled_at:'2026-10-04T12:00:00Z'},
  ];
  assert.equal(nextTeamRace(events,'F',now).id,'next');
  assert.equal(nextTeamRace(events.filter(event=>!event.scheduled_at),'F',now).id,'legacy');
  assert.equal(nextTeamRace(events,'M',now).id,'men');
  assert.equal(nextTeamRace(events,'F',Date.parse('2026-10-12T00:00:00Z')),null);
});
