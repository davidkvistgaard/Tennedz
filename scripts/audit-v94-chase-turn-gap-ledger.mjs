// Read-only decomposition of the opt-in paid single-leader chase road clock.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {MOTOR_CANDIDATE} from '../lib/engine/v2/tuning.mjs';

const rows=[];
for(let seed=1;seed<=4;seed++)for(const terrain of ['flat','mountain'])
  for(const fatigue of [0,30]){
    const settings={distanceKm:120,teamCount:20,terrain,fatigue,
      attack:'none',chase:'selective',
      seed:`chase-turn-holdout-${seed}-${terrain}-${fatigue}`};
    const {recording}=createV94RaceDynamicsPreview({format:'one_day',settings,
      chaseTurnVersion:1});
    const worked=recording.frames.filter(frame=>
      frame.chaseTurnPlan?.status==='worked'&&frame.attackPower===0&&
      frame.gapSeconds>0);
    const sum=(select)=>worked.reduce((total,frame)=>total+select(frame),0);
    const passive=sum(frame=>frame.passiveGapDelta);
    const chaseCredit=sum(frame=>frame.chasePower*
      MOTOR_CANDIDATE.chaseRecoverySecondsPerCapacity);
    const withPaidBunchPace=worked.filter(frame=>frame.paidBunchPace).length;
    rows.push({seed,terrain,fatigue,workedKm:worked.length,
      passiveSeconds:+passive.toFixed(2),
      chaseCreditSeconds:+chaseCredit.toFixed(2),
      meanChasePower:+(chaseCredit/worked.length/
        MOTOR_CANDIDATE.chaseRecoverySecondsPerCapacity).toFixed(2),
      withPaidBunchPace,netBeforeCatch:+(passive-chaseCredit).toFixed(2)});
  }
const total=(key)=>rows.reduce((sum,row)=>sum+row[key],0);
console.log(JSON.stringify({cases:rows.length,
  workedKm:total('workedKm'),
  passiveSeconds:+total('passiveSeconds').toFixed(2),
  chaseCreditSeconds:+total('chaseCreditSeconds').toFixed(2),
  paidBunchPaceKm:total('withPaidBunchPace'),
  netBeforeCatch:+total('netBeforeCatch').toFixed(2),rows}));
