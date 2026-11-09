import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFeed} from '@pelotonia/race-viewer/data';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {exportPaidMotorRaceToViewerV1,
  PAID_MOTOR_RACE_EXPORT_VERSION} from
  '../../lib/viewer/paid-motor-race-export-v1.mjs';
import {sealPhysicalFirstRaceDocumentV2} from
  '../../lib/viewer/physical-first-race-document-v2.mjs';

const rider=id=>({id,name:`Rider ${id}`,flat:65,hills:65,
  mountain:65,endurance:65,form:50,fatigue:0});
const input=()=>({raceSeed:'two-km-viewer-fixture',
  start:{sourceKm:0,roads:[{roadId:'peloton',
    riderIds:['a','b'],clockSeconds:0}],
  riders:['a','b'].map(riderId=>({riderId,
    teamId:riderId,roadId:'peloton',distanceM:0,
    clockSeconds:0,reserve:100,quietKm:0}))},
  kilometres:[1,2].map(km=>({km,terrain:'flat',
    gradientPct:0,startM:100,endM:100,
    surface:'road',exposed:false,
    weather:{temperatureC:16,windKph:0,rainMm:0}})),
  teams:['a','b'].map(id=>({id,name:`Team ${id}`,
    riders:[rider(id)],orders:{captainId:id,helperIds:[id],
      baseline:{effort:'steady',chase:'selective',attack:'none',
        frontWork:id==='a'?'rotate':'sit_in',
        frontWorkRiderId:id==='a'?id:null},phases:[]}})),
  stakes:['a','b'].map(teamId=>({teamId,
    sportingGoal:'sprint_finish',sportingCaptainId:teamId}))});
const styles=[{id:'a',name:'Team a',color:'#224466',
  accent:'#ffffff'},{id:'b',name:'Team b',color:'#664422',
  accent:'#ffffff'}];
const exportRace=(committed=input(),extra={})=>
  exportPaidMotorRaceToViewerV1({input:committed,
    raceId:'paid-two-km',category:'men',teamStyles:styles,...extra});

test('committed two kilometre race exports complete viewer evidence',()=>{
  const exported=exportRace();
  assert.deepEqual(validateFeed(exported.feed),exported.feed);
  assert.equal(exported.source.validatedKm,2);
  assert.equal(exported.source.exportVersion,
    PAID_MOTOR_RACE_EXPORT_VERSION);
  assert.equal(exported.source.validatedRiderKilometres,4);
  assert.equal(exported.coverage.teamKitSource,'committed-team-style');
  assert.equal(exported.finishEvidence.entries.length,2);
  assert.equal(sealPhysicalFirstRaceDocumentV2(exported,
    {category:'men'}).raceId,'paid-two-km');
});

test('export refuses missing orders and a different paid recording',()=>{
  const missing=input();
  delete missing.teams[0].orders.baseline;
  assert.throws(()=>exportRace(missing),/committed Motor Lab inputs/);
  const recordedInput=input();
  const paidRace=runPhysicalFirstWholeRaceProbeV1(recordedInput);
  const altered=input();
  altered.teams[0].riders[0].flat=70;
  assert.throws(()=>exportRace(altered,{paidRace}),
    /source commitment differs/);
});
