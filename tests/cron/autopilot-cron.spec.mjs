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

test('cron commits an unrevealed due division once after its entry scan',async({request})=>{
  const fixture='http://127.0.0.1:54330';
  await fetch(`${fixture}/__cron_reset`,{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({revealCandidate:true})});
  const headers={Authorization:'Bearer fixture-cron-secret'};
  const first=await request.get('/api/cron/autopilot',{headers});
  expect(first.status()).toBe(200);
  expect((await first.json()).divisions.revealed).toEqual([{
    event_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',already_revealed:false,
  }]);
  expect((await (await fetch(`${fixture}/__cron_state`)).json()).revealed).toBe(true);
  const repeated=await request.get('/api/cron/autopilot',{headers});
  expect(repeated.status()).toBe(200);
  expect((await repeated.json()).divisions.revealed).toEqual([]);
});

test('daily cron processes a 400-team field inside its request budget',async({request})=>{
  test.setTimeout(90000);
  const fixture='http://127.0.0.1:54330';
  const reset=await fetch(`${fixture}/__cron_reset`,{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({teamCount:400})});
  expect(await reset.json()).toMatchObject({teamCount:400,defaultCount:20});
  const started=Date.now();
  const response=await request.get('/api/cron/autopilot',{
    headers:{Authorization:'Bearer fixture-cron-secret'},timeout:60000,
  });
  expect(response.status()).toBe(200);
  const elapsed=Date.now()-started;
  const result=await response.json();
  const state=await (await fetch(`${fixture}/__cron_state`)).json();
  expect(result.ok).toBe(true);
  expect(result.batches).toHaveLength(41);
  expect(result.batches.at(-1)).toMatchObject({processed:0,complete:true});
  expect(state).toMatchObject({teamCount:400,defaultCount:20,complete:true,
    processed:400,entered:20,reportedEntered:20,claims:41,lease:null});
  expect(state.maxConcurrentEventReads).toBeGreaterThan(1);
  expect(state.maxConcurrentEventReads).toBeLessThanOrEqual(4);
  expect(elapsed).toBeLessThan(35000);
});

test('a larger field resumes at the cursor after one request budget',async({request})=>{
  test.setTimeout(130000);
  const fixture='http://127.0.0.1:54330';
  const reset=await fetch(`${fixture}/__cron_reset`,{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({teamCount:1000})});
  expect(await reset.json()).toMatchObject({teamCount:1000,defaultCount:50});
  const headers={Authorization:'Bearer fixture-cron-secret'};
  const first=await request.get('/api/cron/autopilot',{headers,timeout:60000});
  expect(first.status()).toBe(200);
  const firstResult=await first.json();
  const firstState=await (await fetch(`${fixture}/__cron_state`)).json();
  expect(firstResult.ok).toBe(true);
  expect(firstState.complete).toBe(false);
  expect(firstState.processed).toBeGreaterThan(0);
  expect(firstState.processed).toBeLessThan(1000);
  expect(firstState.cursor).toBeTruthy();
  expect(firstState.lease).toBeNull();
  const second=await request.get('/api/cron/autopilot',{headers,timeout:60000});
  expect(second.status()).toBe(200);
  const secondState=await (await fetch(`${fixture}/__cron_state`)).json();
  expect(secondState).toMatchObject({teamCount:1000,defaultCount:50,
    complete:true,processed:1000,entered:50,reportedEntered:50,lease:null});
  expect(secondState.maxConcurrentEventReads).toBeLessThanOrEqual(4);
  expect((await second.json()).batches.at(-1)).toMatchObject({processed:0,complete:true});
});

test('division reveal waits for an incomplete large scan and commits after its retry',async({request})=>{
  test.setTimeout(130000);
  const fixture='http://127.0.0.1:54330';
  await fetch(`${fixture}/__cron_reset`,{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({teamCount:1000,revealCandidate:true})});
  const headers={Authorization:'Bearer fixture-cron-secret'};
  const first=await request.get('/api/cron/autopilot',{headers,timeout:60000});
  expect(first.status()).toBe(503);
  const firstResult=await first.json();
  expect(firstResult).toMatchObject({ok:false,code:'DIVISION_REVEAL_BLOCKED'});
  const firstState=await (await fetch(`${fixture}/__cron_state`)).json();
  expect(firstState.complete).toBe(false);
  expect(firstState.revealed).toBe(false);
  expect(firstResult.divisions.revealed).toEqual([]);
  expect(firstResult.divisions.pending).toEqual([{
    event_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    reason:'AUTOPILOT_PENDING',
  }]);

  const second=await request.get('/api/cron/autopilot',{headers,timeout:60000});
  expect(second.status()).toBe(200);
  const secondResult=await second.json();
  const secondState=await (await fetch(`${fixture}/__cron_state`)).json();
  expect(secondState).toMatchObject({complete:true,revealed:true,
    processed:1000,entered:50,reportedEntered:50});
  expect(secondResult.divisions.revealed).toEqual([{
    event_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',already_revealed:false,
  }]);
  const repeated=await request.get('/api/cron/autopilot',{headers,timeout:60000});
  expect(repeated.status()).toBe(200);
  expect((await repeated.json()).divisions.revealed).toEqual([]);
});

test('cron reports a missing reveal after tactics closed instead of returning healthy',async({request})=>{
  const fixture='http://127.0.0.1:54330';
  await fetch(`${fixture}/__cron_reset`,{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({overdueCandidate:true})});
  const headers={Authorization:'Bearer fixture-cron-secret'};
  const first=await request.get('/api/cron/autopilot',{headers});
  expect(first.status()).toBe(503);
  expect(await first.json()).toMatchObject({ok:false,
    code:'DIVISION_REVEAL_OVERDUE',
    overdue:['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']});
  const repeated=await request.get('/api/cron/autopilot',{headers});
  expect(repeated.status()).toBe(503);
  expect((await repeated.json()).batches).toEqual([]);
});
