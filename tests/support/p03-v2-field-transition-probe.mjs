// Read-only diagnostic for the same strong/weak teams in different fields.
// Run: node tests/support/p03-v2-field-transition-probe.mjs
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';

const skills=['sprint','flat','hills','mountain','cobbles','timetrial',
  'endurance','strength','wind'];
const spread=[-8,-6,-4,-2,2,4,6,8];
function team(id,level,hard=false){
  const riders=spread.map((offset,index)=>({id:`${id}-${index}`,gender:'M',
    form:70,fatigue:10,...Object.fromEntries(skills.map(skill=>
      [skill,Math.min(100,Math.max(0,level+offset))]))}));
  return {id,riders,orders:{captainId:`${id}-7`,preset:'balanced',
    baseline:{effort:hard?'hard':'steady',attack:'none',chase:'ignore'}}};
}
function run(size,neutralMode='competitive',strongEffort='hard',strongLevel=96){
  const teams=[team('weak',80),team('strong',strongLevel,strongEffort==='hard'),
    ...Array.from({length:size-2},(_,index)=>
      team(`neutral-${index}`,neutralMode==='inert'?30:76+index%13))];
  const recording=simulateTacticalTour({stage:{distance_km:140,
    profile_points:[[0,0],[140,0]],tags:['FLAT']},teams,
  seed:'fixed',weather:{temp_c:18,wind_kph:5,precipitation_mm:0}});
  const firstDrop=recording.frames.find(frame=>frame.riderGroups.some(row=>
    row.teamId==='weak'&&row.group==='dropped'))?.km??null;
  const firstStoppedWork=recording.frames.find(frame=>
    !frame.hardBunchWorkTeamIds.includes('strong'))?.km??null;
  return {teams:size,neutralMode,strongEffort,strongLevel,firstWeakDropKm:firstDrop,
    firstStrongWorkStopKm:firstStoppedWork,
    snapshots:[1,20,40,60,80,100,120,140].map(km=>{
      const frame=recording.frames[km-1];
      const weak=frame.riderGroups.filter(row=>row.teamId==='weak');
      const neutral=frame.riderGroups.filter(row=>row.teamId.startsWith('neutral-'));
      const leader=weak.find(row=>row.id==='weak-7');
      return {km,hardWork:frame.hardBunchWorkTeamIds.includes('strong'),
        weakDropped:weak.filter(row=>row.group==='dropped').length,
        neutralDropped:neutral.filter(row=>row.group==='dropped').length,
        weakLeaderGroup:leader.group,
        weakLeaderDeficitSeconds:leader.deficitSeconds,
        strongMeanEnergy:frame.teamEnergy.find(row=>row.teamId==='strong').mean};
    }),
    firstWeakGapSeconds:recording.provisionalResults.find(row=>
      row.teamId==='weak').gapSeconds};
}
const runs=[
  run(2),run(15),run(15,'inert'),run(2,'competitive','steady'),
  run(15,'competitive','steady'),run(2,'competitive','hard',90),
  run(15,'competitive','hard',90)];
console.log(JSON.stringify({probe:'v2 field-size transition',runs,
  comparisons:{hardMinusSteadySeconds:{twoTeams:+(runs[0].firstWeakGapSeconds-
    runs[3].firstWeakGapSeconds).toFixed(2),fifteenTeams:+(runs[1].firstWeakGapSeconds-
    runs[4].firstWeakGapSeconds).toFixed(2)},
  competitiveFieldEffectSeconds:+(runs[0].firstWeakGapSeconds-
    runs[1].firstWeakGapSeconds).toFixed(2),
  inertFieldEffectSeconds:+(runs[0].firstWeakGapSeconds-
    runs[2].firstWeakGapSeconds).toFixed(2)}},null,2));
