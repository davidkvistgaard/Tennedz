import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93CoastedPlaytest,validateV93CoastedPlaytest,
  summarizeV93CoastedPlaytest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {pointsForDivisionResult} from '../../lib/calendar/points.mjs';

const profileHeightsM=[100,350,150,500,180,100];
const context={tier:3,divisionIndex:1,divisionCount:1};
const settings=(terrain,gender)=>({distanceKm:260,terrain,gender,
  teamCount:4,fatigue:30,seed:'cross-route-1',
  defaultRivalPlan:'mixed',attack:'selective',chase:'selective',
  ...(terrain==='custom'?{profileHeightsM}:{})});
const crossing=(race,id)=>race.individualLine.conditionalCrossings.find(
  row=>row.riderId===id);

test('ten exhausted routes yield replayable individual lines and policy points',()=>{
  for(const terrain of ['flat','rolling','mountain','exposed','custom'])
    for(const gender of ['M','F']){
      const input=settings(terrain,gender);
      const base=createV93CoastedPlaytest(input,{pointContext:context});
      const plans=base.recording.committedInputs.teams.map(team=>({
        teamId:team.id,
        finisherId:team.id==='you'?'you-4':team.orders.captainId,
        leadOutRiderId:team.id==='you'?'you-6':
          team.id==='rival-2'?'rival-2-5':null}));
      const race=createV93CoastedPlaytest(input,{plans,
        pointContext:context});
      const summary=summarizeV93CoastedPlaytest(race);
      assert.equal(validateV93CoastedPlaytest(input,{plans,
        pointContext:context},race),true);
      assert.deepEqual(race.recording,base.recording);
      assert.deepEqual(race.clock,base.clock);
      assert.equal(race.individualLine.conditionalCrossings.length,32);
      assert.equal(summary.kilometreFrames.length,259);
      assert.equal(summary.lastKmRoad.at(-1).distanceM,260000);
      assert.equal(summary.lineTimes.length,32);
      assert.ok(summary.bandReplays.some(band=>band.id==='peloton'));
      assert.ok(summary.leadOutWork.some(row=>row.riderId==='you-6'));
      assert.ok(summary.leadOutWork.some(row=>
        row.riderId==='rival-2-5'));
      assert.equal(race.individualLine.provisionalLineOrder.length,32);
      assert.equal(base.pointPreview.riders.length,32);
      assert.equal(race.pointsStatus,'withheld');
      assert.equal(race.canCommitAwards,false);
      if(race.pointPreview.status==='unavailable'){
        assert.equal(race.pointPreview.pointsStatus,'withheld');
        assert.ok(race.individualLine.provisionalLineOrder.some(row=>
          row.firstPossiblePlace!==row.lastPossiblePlace));
      }else assert.deepEqual(race.pointPreview.awardRows,[]);
      assert.ok(crossing(race,'you-4')
        .elapsedSecondsFromLastKmStart<
        crossing(base,'you-4').elapsedSecondsFromLastKmStart);
      assert.ok(crossing(race,'rival-2-7')
        .elapsedSecondsFromLastKmStart<
        crossing(base,'rival-2-7').elapsedSecondsFromLastKmStart);
      for(const [helperId,bandId] of [['you-6','peloton'],
        ['rival-2-5',race.clock.trace.frames.at(-1).roadGroups[0].id]]){
        const band=race.individualLine.bandRunners.find(row=>
          row.roadBandId===bandId);
        assert.ok(band.runner.frames.flatMap(frame=>frame.riders)
          .some(row=>row.riderId===helperId&&
            row.role==='lead_out'&&row.energySpent>0));
      }
      const lineEnergy=new Map(base.individualLine.conditionalCrossings
        .map(row=>[row.riderId,row.energyAtLine]));
      for(const [index,row] of base.pointPreview.riders.entries()){
        assert.equal(row.provisionalPlace,index+1);
        assert.equal(row.energyAtLine,lineEnergy.get(row.riderId));
        assert.equal(row.previewPoints,pointsForDivisionResult({
          tier:3,resultType:'ONE_DAY',placing:index+1,multiplier:1}));
      }
    }
});

test('coasted playtest rejects a cross-road helper and changed replay',()=>{
  const input=settings('flat','M');
  const base=createV93CoastedPlaytest(input);
  const plans=base.recording.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:team.id==='you'?'you-6':null}));
  assert.throws(()=>createV93CoastedPlaytest(input,{plans}),
    /cannot work beside the finisher/);
  const altered=structuredClone(base);
  altered.individualLine.conditionalCrossings[0].energyAtLine+=1;
  assert.throws(()=>validateV93CoastedPlaytest(input,{},altered),
    /does not replay/);
});
