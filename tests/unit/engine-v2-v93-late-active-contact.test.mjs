import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,
  V93_LATE_ACTIVE_CONTACT_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {FINALE_LATE_ACTIVE_CONTACT_LINE_VERSION,
  validateFinaleLateActiveContactLine} from
  '../../lib/engine/v2/finale-late-active-contact-line.mjs';

const tactics=[
  {effort:'hard',attack:'none',chase:'all'},
  {effort:'steady',attack:'selective',chase:'ignore'},
  {effort:'conserve',attack:'none',chase:'selective'},
  {effort:'steady',attack:'repeated',chase:'selective'}];
const settings={distanceKm:260,teamCount:15,gender:'F',
  terrain:'mountain',fatigue:30,seed:'v93-matrix-77',
  defaultRivalPlan:'passive',effort:'hard',attack:'repeated',
  chase:'selective',
  profileHeightsM:[500,350,200,400,250,100],
  managerTactics:Array.from({length:14},(_,index)=>
    tactics[(index+77)%4])};
const pointContext={tier:3,divisionCount:4,divisionIndex:2};
const requestedPlans=['you',...Array.from({length:14},(_,index)=>
  `rival-${index+1}`)].map(teamId=>({teamId,
  finisherId:`${teamId}-7`,
  leadOutRiderId:['you','rival-1'].includes(teamId)?
    `${teamId}-6`:null}));

function playable(input,options){
  const plans=structuredClone(requestedPlans);
  for(;;){
    try{return {plans,race:createV93PlayableTest(
      settings,{plans,pointContext},options)};}
    catch(error){
      const helper=plans.find(row=>row.teamId===
        error.cause?.teamId&&
        row.leadOutRiderId===error.cause?.helperId);
      if(!helper||!['exhausted','different_road_group']
        .includes(error.cause?.reason))throw error;
      helper.leadOutRiderId=null;
    }
  }
}

test('the first occupied-lane contact pays a whole 120-rider line and replay',
  ()=>{
    const {plans,race}=playable();
    assert.equal(race.version,
      V93_LATE_ACTIVE_CONTACT_PLAYTEST_VERSION);
    assert.equal(race.individualLine.version,
      FINALE_LATE_ACTIVE_CONTACT_LINE_VERSION);
    assert.equal(validateV93CoastedPlaytest(settings,{
      plans,pointContext},race),true);
    const line=race.individualLine;
    const contact=line.contact;
    assert.ok(Math.abs(contact.atDistanceM-
      259731.87761240872)<1e-6);
    assert.equal(contact.wheelPairs.length,3);
    assert.deepEqual(contact.wheelPairs.map(row=>row.lane),
      [0,1,2]);
    assert.equal(line.pre500Gate.firstActiveWheel,null);
    assert.equal(line.pre500Gate.firstActiveIsolated,null);
    assert.equal(line.merged.finishers.length,91);
    assert.equal(line.conditionalCrossings.length,120);
    assert.equal(line.roadPlaceBounds.filter(row=>
      row.position===null).length,21);
    assert.equal(line.provisionalLineOrder,null);
    assert.equal(race.pointPreview.status,'unavailable');
    assert.match(race.pointPreview.reason,/Tied conditional crossings/);
    assert.equal(race.canCommitAwards,false);
    assert.equal(race.classifiedResults,null);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(summary.lastKmRoad.length,8);
    assert.deepEqual(summary.lastKmRoad.map(row=>
      row.distanceM).slice(0,4),
    [259250,259500,259600,259700]);
    assert.equal(summary.lastKmRoad[4].contact.kind,
      'shared_active_wheel_contact');
    assert.equal(summary.lastKmRoad[4].groups.length,0);
    assert.ok(summary.lastKmRoad.slice(4).every(row=>
      row.groups.length===0));
    assert.ok(summary.lastKmRoad.every(row=>
      row.ownRiderEnergy.length===8));
    assert.equal(summary.lastKmRoad.at(-1).distanceM,260000);
    assert.equal(summary.lineTimes.length,120);
    assert.equal(summary.roadPlaceBounds.riders.filter(row=>
      row.position===null).length,21);
    const replayed=new Set();
    const at500=new Map(race.clock.trace.frames.find(frame=>
      frame.endDistanceM===259500).riders.map(row=>
      [row.riderId,row.energy]));
    const byId=new Map(summary.lineTimes.map(row=>
      [row.riderId,row]));
    for(const band of summary.bandReplays)
      for(const riderId of band.riderIds){
        assert.equal(replayed.has(riderId),false);
        replayed.add(riderId);
        const first=band.frames[0].riders.find(row=>
          row.riderId===riderId);
        const last=band.frames.at(-1).riders.find(row=>
          row.riderId===riderId);
        assert.equal(first.energyAtDecision,
          at500.get(riderId));
        assert.ok(Math.abs(last.energyAfter-
          byId.get(riderId).energyAtLine)<1e-7);
        assert.ok(Math.abs(last.elapsedToLineSeconds-
          byId.get(riderId)
            .elapsedSecondsFromLastKmStart)<1e-7);
        const spent=band.frames.reduce((sum,frame)=>sum+
          frame.riders.find(row=>row.riderId===riderId)
            .energySpent,0);
        assert.ok(Math.abs(at500.get(riderId)-spent-
          last.energyAfter)<1e-7);
      }
    assert.equal(replayed.size,120);
    assert.equal(summary.pointPreview.status,'unavailable');
    assert.equal(summary.canCommitAwards,false);
    assert.equal(summary.classifiedResults,null);
  });

test('an older unresolved contact recording keeps its earlier version',()=>{
  const {plans,race}=playable(null,{
    resolveLateActiveContact:false});
  assert.notEqual(race.version,
    V93_LATE_ACTIVE_CONTACT_PLAYTEST_VERSION);
  assert.equal(race.individualLine.provisionalLineOrder,null);
  assert.equal(validateV93CoastedPlaytest(settings,{
    plans,pointContext},race),true);
  const later=playable().race;
  assert.equal(validateFinaleLateActiveContactLine(later.recording,
    later.clock,race.individualLine,later.individualLine),true);
});
