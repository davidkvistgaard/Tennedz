// Read-only 260 km attack/chase diagnostic for the isolated v2 motor.
// Run: node tests/support/p03-v2-long-race-break-probe.mjs [--candidate|--paid-pace] [seed ...]
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import assert from 'node:assert/strict';
import {MOTOR_CANDIDATE_VERSION,MOTOR_PAID_PACE_VERSION} from '../../lib/engine/v2/tuning.mjs';

const skills=['sprint','flat','hills','mountain','cobbles','timetrial',
  'endurance','strength','wind'];
const spread=[-8,-6,-4,-2,2,4,6,8];
const stage={distance_km:260,profile_points:[[0,200],[52,800],[104,250],
  [161,1100],[208,350],[260,200]],tags:['HILLY']};
const weather={temp_c:12,wind_kph:5,precipitation_mm:1};

function team(id,level,effort='steady',phases=[],chase='ignore'){
  return {id,riders:spread.map((offset,index)=>({
    id:`${id}-${index}`,gender:'M',form:70,fatigue:10,
    ...Object.fromEntries(skills.map(skill=>[skill,Math.min(100,level+offset)])),
  })),orders:{captainId:`${id}-7`,preset:'balanced',
    baseline:{effort,attack:'none',chase},phases}};
}

const plans=[
  {name:'conserve ignore',effort:'conserve',phases:[],chase:'ignore'},
  {name:'conserve-hard ignore',effort:'conserve',
    phases:[{atKm:160,effort:'hard'}],chase:'ignore'},
  {name:'conserve-hard chase',effort:'conserve',
    phases:[{atKm:160,effort:'hard',chase:'all'}],chase:'ignore'},
  {name:'hard chase',effort:'hard',phases:[],chase:'all'},
  {name:'steady chase',effort:'steady',phases:[],chase:'all'},
];
const candidate=process.argv.includes('--candidate');
const paidPace=process.argv.includes('--paid-pace');
if(candidate&&paidPace)throw new Error('Choose one candidate version.');
const seeds=process.argv.slice(2).filter(value=>!['--candidate','--paid-pace'].includes(value));
if(!seeds.length)seeds.push('s1','s2','s3');

for(const seed of seeds){
  for(const plan of plans){
    const teams=[
      team('weak',80),
      team('strong',96,plan.effort,plan.phases,plan.chase),
      team('rival',94,'conserve',[
        {atKm:150,attack:'selective',attackRiderId:'rival-7',effort:'hard'},
        {atKm:160,attack:'none',attackRiderId:null},
      ]),
      ...Array.from({length:12},(_,index)=>
        team(`neutral-${index}`,76+index%13)),
    ];
    const race=simulateTacticalTour({stage,teams,seed,weather,
      ...(candidate?{motorVersion:MOTOR_CANDIDATE_VERSION}:
        paidPace?{motorVersion:MOTOR_PAID_PACE_VERSION}:{})});
    validateRecordedTour(race);
    const frames=race.frames;
    const results=race.provisionalResults;
    const finish=frames.at(-1);
    const attackFrames=frames.filter(frame=>frame.attackers.includes('rival-7'));
    assert.equal(attackFrames.length,1);
    assert.equal(attackFrames[0].km,160);
    assert.ok(attackFrames[0].joinedBreakawayRiderIds.includes('rival-7'));
    const place=id=>results.find(row=>row.riderId===id).position;
    const state=id=>finish.riderGroups.find(row=>row.id===id);
    console.log(JSON.stringify({seed,tuningVersion:race.tuningVersion,plan:plan.name,
      attack:attackFrames
        .map(frame=>({km:frame.km,
          joined:frame.joinedBreakawayRiderIds.includes('rival-7'),
          gapSeconds:frame.gapSeconds})),
      chaseKm:frames.filter(frame=>frame.chasers.includes('strong')).length,
      gapSeconds:{km180:frames[179].gapSeconds,km220:frames[219].gapSeconds,
        km250:frames[249].gapSeconds,finish:finish.gapSeconds},
      strongHelperEnergy:['strong-5','strong-6'].map(id=>state(id).energy),
      strongCaptain:{place:place('strong-7'),energy:state('strong-7').energy},
      rivalCaptain:{place:place('rival-7'),energy:state('rival-7').energy,
        group:state('rival-7').group},
      winnerId:results[0].riderId,
    }));
  }
}
