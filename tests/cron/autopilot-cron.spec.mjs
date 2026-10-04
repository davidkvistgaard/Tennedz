import {test,expect} from '@playwright/test';

test('enabled cron processes three pages and stays idempotent over HTTP',async({request})=>{
  const denied=await request.get('/api/cron/autopilot');
  expect(denied.status()).toBe(401);
  const started=Date.now();
  const response=await request.get('/api/cron/autopilot',{
    headers:{Authorization:'Bearer fixture-cron-secret'},
  });
  expect(response.status()).toBe(200);
  const result=await response.json();
  expect(result.ok).toBe(true);
  expect(result.enabled).toBe(true);
  expect(result.batches.map(batch=>batch.processed)).toEqual([10,10,3]);
  expect(result.batches.map(batch=>batch.complete)).toEqual([false,false,true]);
  expect(result.batches.map(batch=>batch.entered)).toEqual([1,1,1]);
  expect(Date.now()-started).toBeLessThan(35000);
  const state=await (await fetch('http://127.0.0.1:54330/__cron_state')).json();
  expect(state).toMatchObject({complete:true,processed:23,entered:3,claims:3,lease:null});
  expect(state.maxConcurrentEventReads).toBeGreaterThan(1);
  expect(state.maxConcurrentEventReads).toBeLessThanOrEqual(4);
  const repeated=await request.get('/api/cron/autopilot',{
    headers:{Authorization:'Bearer fixture-cron-secret'},
  });
  expect(repeated.status()).toBe(200);
  expect((await repeated.json()).batches).toEqual([]);
});

test('an interrupted page resumes after its lease expires without duplicate entries',async({request})=>{
  const fixture='http://127.0.0.1:54330';
  await fetch(`${fixture}/__cron_reset`,{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({failAfterJoin:true})});
  const headers={Authorization:'Bearer fixture-cron-secret'};
  const interrupted=await request.get('/api/cron/autopilot',{headers});
  expect(interrupted.status()).toBe(503);
  let state=await (await fetch(`${fixture}/__cron_state`)).json();
  expect(state).toMatchObject({processed:10,entered:2,claims:2,failed:true});
  expect(state.activeEventReads).toBe(0);
  expect(state.lease).toBeTruthy();
  const stillLeased=await request.get('/api/cron/autopilot',{headers});
  expect(stillLeased.status()).toBe(200);
  expect((await stillLeased.json()).batches).toEqual([]);
  await fetch(`${fixture}/__cron_expire`,{method:'POST'});
  const resumed=await request.get('/api/cron/autopilot',{headers});
  expect(resumed.status()).toBe(200);
  expect((await resumed.json()).batches.map(batch=>batch.processed)).toEqual([10,3]);
  state=await (await fetch(`${fixture}/__cron_state`)).json();
  expect(state).toMatchObject({complete:true,processed:23,entered:3,claims:4,lease:null});
  expect(state.reportedEntered).toBe(3);
});
