// Read-only decomposition of the opt-in paid single-leader chase road clock.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {MOTOR_CANDIDATE} from '../lib/engine/v2/tuning.mjs';
import {riderKilometreEffect} from '../lib/engine/v2/physiology.mjs';

const rows=[];
for(let seed=1;seed<=4;seed++)for(const terrain of ['flat','mountain'])
  for(const fatigue of [0,30]){
    const settings={distanceKm:120,teamCount:20,terrain,fatigue,
      attack:'none',chase:'selective',
      seed:`chase-turn-holdout-${seed}-${terrain}-${fatigue}`};
    const {recording}=createV94RaceDynamicsPreview({format:'one_day',settings,
      chaseTurnVersion:1});
    const riders=new Map(recording.committedInputs.teams.flatMap(team=>
      team.riders.map(rider=>[rider.id,rider])));
    const worked=recording.frames.filter(frame=>
      frame.chaseTurnPlan?.status==='worked'&&frame.attackPower===0&&
      frame.gapSeconds>0);
    const sum=(select)=>worked.reduce((total,frame)=>total+select(frame),0);
    const passive=sum(frame=>frame.passiveGapDelta);
    const chaseCredit=sum(frame=>frame.chasePower*
      MOTOR_CANDIDATE.chaseRecoverySecondsPerCapacity);
    const withPaidBunchPace=worked.filter(frame=>frame.paidBunchPace).length;
    const leaderAbilities=worked.map(frame=>{
      const segment=recording.route.kilometres[frame.km-1];
      const energy=new Map(frame.energyLedger.map(row=>
        [row.riderId,row.energyBefore]));
      const ability=frame.chaseTurnPlan.turns.reduce((total,turn)=>{
        const rider=riders.get(turn.leaderRiderId);
        if(!rider||!energy.has(turn.leaderRiderId))
          throw new Error('Recorded chase leader lacks committed source.');
        return total+(turn.endM-turn.startM)*riderKilometreEffect(
          rider,segment,{phase:'chase',energy:energy.get(turn.leaderRiderId),
            exposed:segment.exposed}).ability/1000;
      },0);
      return {ability,paidBunchAbility:frame.paidBunchPace?.ability??null};
    });
    rows.push({seed,terrain,fatigue,workedKm:worked.length,
      passiveSeconds:+passive.toFixed(2),
      chaseCreditSeconds:+chaseCredit.toFixed(2),
      meanChasePower:+(chaseCredit/worked.length/
        MOTOR_CANDIDATE.chaseRecoverySecondsPerCapacity).toFixed(2),
      meanLeaderChaseAbility:+(leaderAbilities.reduce((sum,row)=>
        sum+row.ability,0)/worked.length).toFixed(2),
      withPaidBunchPace,
      leaderAbovePaidBunchPaceKm:leaderAbilities.filter(row=>
        row.paidBunchAbility!==null&&row.ability>row.paidBunchAbility).length,
      netBeforeCatch:+(passive-chaseCredit).toFixed(2)});
  }
const total=(key)=>rows.reduce((sum,row)=>sum+row[key],0);
console.log(JSON.stringify({cases:rows.length,
  workedKm:total('workedKm'),
  passiveSeconds:+total('passiveSeconds').toFixed(2),
  chaseCreditSeconds:+total('chaseCreditSeconds').toFixed(2),
  paidBunchPaceKm:total('withPaidBunchPace'),
  leaderAbovePaidBunchPaceKm:total('leaderAbovePaidBunchPaceKm'),
  netBeforeCatch:+total('netBeforeCatch').toFixed(2),rows}));
