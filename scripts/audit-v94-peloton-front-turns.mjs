// Read-only source replay of a proposed shared peloton leader position.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {planPelotonFrontTurnsV1} from
  '../lib/engine/v2/peloton-front-turns-v1.mjs';

const rows=[];
for(let seed=1;seed<=4;seed++)for(const terrain of ['flat','mountain'])
  for(const fatigue of [0,30]){
    const settings={distanceKm:120,teamCount:20,terrain,fatigue,
      attack:'none',chase:'selective',
      seed:`chase-turn-holdout-${seed}-${terrain}-${fatigue}`};
    const {recording}=createV94RaceDynamicsPreview({format:'one_day',settings,
      chaseTurnVersion:1});
    let workedKm=0,simultaneousKm=0,soloChaseKm=0,soloFrontKm=0;
    let unifiedAbility=0,unifiedChasePower=0;
    for(const frame of recording.frames){
      const priorEnergy=new Map(frame.energyLedger.map(row=>
        [row.riderId,row.energyBefore]));
      const teams=recording.committedInputs.teams.map(team=>({...team,
        energy:Object.fromEntries(team.riders.map(rider=>
          [rider.id,priorEnergy.get(rider.id)]))}));
      const plan=planPelotonFrontTurnsV1({
        chaseTurnPlan:frame.chaseTurnPlan,paidPace:frame.paidBunchPace,
        teams,segment:recording.route.kilometres[frame.km-1],km:frame.km});
      if(plan.status!=='worked')continue;
      workedKm++;
      const chase=frame.chaseTurnPlan.status==='worked';
      const front=frame.paidBunchPace!==null;
      if(chase&&front)simultaneousKm++;
      else if(chase)soloChaseKm++;
      else if(front)soloFrontKm++;
      if(plan.turns[0].startM!==0||plan.turns.at(-1).endM!==1000||
        plan.extraEnergyCosts.reduce((sum,row)=>sum+row.leadingM,0)!==1000)
        throw new Error('Unpaid or overlapping bunch-front road.');
      unifiedAbility+=plan.leaderAbility;
      unifiedChasePower+=plan.chasePower;
    }
    rows.push({seed,terrain,fatigue,workedKm,simultaneousKm,
      soloChaseKm,soloFrontKm,
      meanUnifiedLeaderAbility:+(unifiedAbility/workedKm).toFixed(2),
      meanUnifiedChasePower:+(unifiedChasePower/workedKm).toFixed(2)});
  }
const total=key=>rows.reduce((sum,row)=>sum+row[key],0);
console.log(JSON.stringify({cases:rows.length,workedKm:total('workedKm'),
  simultaneousKm:total('simultaneousKm'),
  soloChaseKm:total('soloChaseKm'),soloFrontKm:total('soloFrontKm'),rows}));
