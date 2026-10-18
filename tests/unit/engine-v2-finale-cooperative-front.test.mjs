import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {finaleSnapshotFromTour} from
  '../../lib/engine/v2/finale-snapshot.mjs';
import {finaleCooperativeFront} from
  '../../lib/engine/v2/finale-cooperative-front.mjs';
import {simulateFinaleGroupToLine,validateFinaleGroupToLine} from
  '../../lib/engine/v2/finale-group-run.mjs';
import {FINALE_WORKER_PASSIVE_SLOPE_VERSION} from
  '../../lib/engine/v2/finale-worker.mjs';

function source({distanceKm=40,teamCount=4,gender='M'}={}){
  const {recording}=createV91Playtest({distanceKm,
    terrain:distanceKm===40?'flat':'rolling',
    fatigue:distanceKm===40?0:15,teamCount,gender,
    seed:'coverage-1',defaultRivalPlan:'attack',
    attack:'repeated',chase:'ignore'});
  const snapshot=finaleSnapshotFromTour(recording,{
    remainingKm:1,includeAttackLoad:true});
  assert.equal(snapshot.roadGroups.length,1);
  assert.deepEqual(snapshot.droppedRiderIds,[]);
  return {recording,snapshot};
}

function input({recording,snapshot}){
  return {route:recording.route,snapshot,
    teams:recording.committedInputs.teams,
    frontPullRiderId:null,chasePullRiderId:null,
    passiveChase:true,cooperativeFront:true,
    paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION};
}

test('every eligible break worker pays on the recorded final road',()=>{
  for(const distanceKm of [40,120])for(const gender of ['M','F'])
    for(const teamCount of [4,15,20]){
      const locked=source({distanceKm,gender,teamCount});
      const options=input(locked);
      const line=simulateFinaleGroupToLine(options);
      assert.equal(line.version,'v2-finale-group-cooperative-to-line-12');
      assert.equal(line.outcome,'survived');
      assert.equal(line.approachFrames.length,7);
      assert.equal(line.finalRiderEnergy.length,teamCount*8);
      assert.equal(line.resultStatus,'unclassified');
      assert.equal(line.pointsStatus,'withheld');
      const first=line.approachFrames[0];
      assert.deepEqual(first.frontWorkerRiderIds,
        locked.snapshot.roadGroups[0].riderIds);
      for(const rider of first.riders){
        const sourceEnergy=locked.snapshot.riders.find(row=>
          row.riderId===rider.riderId).energy;
        assert.ok(Math.abs(sourceEnergy-rider.energy-
          rider.energySpent)<1e-8);
        if(first.frontWorkerRiderIds.includes(rider.riderId)){
          assert.equal(rider.role,'pull');
          assert.ok(rider.energySpent>0);
        }
      }
      assert.equal(validateFinaleGroupToLine(options,line),true);
    }
});

test('locked break-work choice changes eligible work and cost',()=>{
  const {recording,snapshot}=source();
  const teams=recording.committedInputs.teams;
  const energies=new Map(snapshot.riders.map(row=>[row.riderId,row.energy]));
  const segment=recording.route.kilometres.at(-1);
  const group=snapshot.roadGroups[0];
  const baseline=finaleCooperativeFront({group,teams,energies,segment});
  const sitting=teams.map(team=>team.id==='you'?{
    ...team,orders:{...team.orders,baseline:{...team.orders.baseline,
      breakWork:'sit_on'}}}:team);
  const after=finaleCooperativeFront({group,teams:sitting,energies,segment});
  const ownWorkers=group.riderIds.filter(id=>id.startsWith('you-'));
  assert.ok(ownWorkers.length>0);
  assert.ok(ownWorkers.every(id=>baseline.workerRiderIds.includes(id)));
  assert.ok(ownWorkers.every(id=>!after.workerRiderIds.includes(id)));
  assert.notEqual(after.speedKph,baseline.speedKph);
  for(const id of ownWorkers)
    assert.ok(after.workCosts.get(id)<baseline.workCosts.get(id));
  assert.equal(baseline.version,'v2-finale-cooperative-front-1');
});

test('cooperative break work stops at a measured catch and pays the remainder',()=>{
  const locked=source();
  const snapshot=structuredClone(locked.snapshot);
  snapshot.roadGroups[0].gapSeconds=.1;
  const front=new Set(snapshot.roadGroups[0].riderIds);
  const teams=structuredClone(locked.recording.committedInputs.teams);
  for(const team of teams)for(const rider of team.riders)
    for(const skill of ['flat','strength','endurance','timetrial','sprint'])
      rider[skill]=front.has(rider.id)?20:100;
  const options={...input({...locked,snapshot}),teams};
  const line=simulateFinaleGroupToLine(options);
  assert.equal(line.outcome,'caught_merged');
  assert.ok(line.catchDistanceM>39000&&line.catchDistanceM<39250);
  assert.equal(line.mergedFrames[0].startDistanceM,line.catchDistanceM);
  assert.equal(line.endDistanceM,40000);
  assert.equal(line.finalRiderEnergy.length,32);
  assert.equal(line.resultStatus,'unclassified');
  assert.equal(line.pointsStatus,'withheld');
  assert.equal(validateFinaleGroupToLine(options,line),true);
});

test('cooperative front is opt-in and refuses incompatible road modes',()=>{
  const options=input(source());
  assert.throws(()=>simulateFinaleGroupToLine({...options,
    frontPullRiderId:options.snapshot.roadGroups[0].riderIds[0]}),
  /isolated last-kilometre road/);
  assert.throws(()=>simulateFinaleGroupToLine({...options,
    paceVersion:null}),/isolated last-kilometre road/);
});
