// Controlled, fictional whole-race audit: only the player's 5 km effort
// changes between each pair. Reads no live data and never saves awards.
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest} from
  '../lib/engine/v2/playtest-v93-coasted.mjs';

const distances=[40,120,260],teams=[4,15,20];
const genders=['M','F'],terrains=['flat','rolling','mountain','exposed','custom'];
const fatigues=[0,15,30],rivalPlans=['neutral','mixed','attack','chase'];
const attacks=['none','selective','repeated'],chases=['ignore','selective','all'];
const indices=[0,1,5,9,13,18,20,26,34,40,42,47];
const results=[];
for(const index of indices){
  const settings={distanceKm:distances[index%3],
    teamCount:teams[Math.floor(index/3)%3],
    gender:genders[Math.floor(index/9)%2],terrain:terrains[index%5],
    fatigue:fatigues[Math.floor(index/2)%3],
    seed:`v93-diversity-${Math.floor(index/12)}`,
    defaultRivalPlan:rivalPlans[Math.floor(index/4)%4],
    attack:attacks[Math.floor(index/5)%3],
    chase:chases[Math.floor(index/7)%3],
    profileHeightsM:[100,350,150,500,180,100]};
  const runs=[];
  for(const effort of ['conserve','hard']){
    const input={...settings,managerFinaleOrders:[
      {teamId:'you',atKm:settings.distanceKm-5,effort}]};
    try{
      const race=createV93PlayableTest(input);
      const summary=summarizeV93CoastedPlaytest(race);
      assert.equal(summary.lineTimes.length,settings.teamCount*8);
      assert.equal(summary.lastKmRoad.at(-1).distanceM,
        settings.distanceKm*1000);
      assert.equal(summary.pointsStatus,'withheld');
      assert.equal(race.canCommitAwards,false);
      const finisher=summary.managerDecisions.find(row=>
        row.teamId==='you').finisherId;
      const line=summary.lineTimes.find(row=>row.riderId===finisher);
      const place=summary.provisionalLineOrder?.find(row=>
        row.riderId===finisher)?.position??null;
      const five=summary.kilometreFrames.find(frame=>
        frame.km===settings.distanceKm-5);
      const one=summary.kilometreFrames.at(-1);
      const oneFront=one.roadGroups.find(group=>
        group.riderIds.includes(finisher));
      const oneDrop=one.droppedRiders.find(row=>
        row.riderId===finisher);
      const lateFrames=race.recording.frames.filter(frame=>
        frame.km>settings.distanceKm-5);
      runs.push({effort,summary,finisher,place,
        ownFrontPaceKm:lateFrames.filter(frame=>
          frame.paidBunchPace?.teamId==='you').length,
        ownChaseKm:lateFrames.filter(frame=>
          frame.chasers.includes('you')).length,
        ownAttackKm:lateFrames.filter(frame=>
          frame.attackers.some(id=>id.startsWith('you-'))).length,
        oneRoad:oneFront?.id??(oneDrop?'isolated':'bunch'),
        oneGapSeconds:oneFront?.gapSeconds??
          (oneDrop?-oneDrop.deficitSeconds:0),
        lineSeconds:line.elapsedSecondsFromLastKmStart,
        lineEnergy:line.energyAtLine,
        fiveEnergy:five.ownRiders.find(row=>
          row.riderId===finisher).energy,
        oneEnergy:one.ownRiders.find(row=>
          row.riderId===finisher).energy});
    }catch(error){runs.push({effort,error:error.message});}
  }
  const [conserve,hard]=runs;
  if(conserve.summary&&hard.summary){
    assert.equal(conserve.finisher,hard.finisher);
    assert.deepEqual(conserve.summary.kilometreFrames.filter(frame=>
      frame.km<settings.distanceKm-5),
    hard.summary.kilometreFrames.filter(frame=>
      frame.km<settings.distanceKm-5));
  }
  results.push({index,settings,
    runs:runs.map(({effort,error,finisher,place,oneRoad,oneGapSeconds,
      ownFrontPaceKm,ownChaseKm,ownAttackKm,
      lineSeconds,lineEnergy,fiveEnergy,oneEnergy})=>({effort,error,
      finisher,place,oneRoad,oneGapSeconds,ownFrontPaceKm,ownChaseKm,
      ownAttackKm,lineSeconds,lineEnergy,
      fiveEnergy,oneEnergy})),
    ...(conserve.summary&&hard.summary?{hardMinusConserve:{
      place:Number.isInteger(conserve.place)&&Number.isInteger(hard.place)?
        hard.place-conserve.place:null,
      oneGapSeconds:hard.oneGapSeconds-conserve.oneGapSeconds,
      lineSeconds:hard.lineSeconds-conserve.lineSeconds,
      lineEnergy:hard.lineEnergy-conserve.lineEnergy,
      oneEnergy:hard.oneEnergy-conserve.oneEnergy}}:{})});
}
const paired=results.filter(row=>row.hardMinusConserve).length;
assert.equal(paired,indices.length,'Every controlled whole-race pair must finish.');
console.log(JSON.stringify({scenarios:results.length,
  paired,
  better:results.filter(row=>row.hardMinusConserve?.place<0).length,
  worse:results.filter(row=>row.hardMinusConserve?.place>0).length,
  same:results.filter(row=>row.hardMinusConserve?.place===0).length,
  results},null,2));
