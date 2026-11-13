// Read-only same-seed inventory of V94's resolved, source-replayed front.
// Named paid turns are candidate physical input, not a calibrated road clock.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {prepareV91Playtest} from
  '../lib/engine/v2/playtest.mjs';
import {orderAt} from '../lib/engine/v2/orders.mjs';
import {replayRaceDynamicsRecording} from
  '../lib/engine/v2/replay-race-dynamics-v94.mjs';

const seedArgument=process.argv.find(arg=>arg.startsWith('--seeds='));
const seedCount=seedArgument?Number(seedArgument.slice(8)):1;
if(!Number.isInteger(seedCount)||seedCount<1||seedCount>8)
  throw new Error('Resolved front audit needs 1–8 seeds.');
const rows=[];
for(let seed=1;seed<=seedCount;seed++)
  for(const distanceKm of [120,260])
    for(const terrain of ['flat','mountain'])
      for(const fatigue of [0,30]){
        const settings={distanceKm,teamCount:20,terrain,fatigue,
          attack:'none',chase:'selective',
          seed:`chase-turn-holdout-${seed}-${terrain}-${fatigue}`};
        const sportingStakes=prepareV91Playtest(settings).teams
          .map(team=>({teamId:team.id,goal:'none',
            captainId:team.orders.captainId}));
        let recording;
        try{
          ({recording}=createV94RaceDynamicsPreview({
            format:'one_day',settings,sportingStakes,
            roadGroupPaceVersion:3,bunchFrontTurnVersion:1,
            chaseTurnVersion:1,pelotonFrontTurnVersion:1}));
        }catch(error){
          if(!String(error.message).includes(
            'Combined fresh attack and paid pursuit'))throw error;
          rows.push({seed,distanceKm,terrain,fatigue,
            refusal:error.message});
          continue;
        }
        replayRaceDynamicsRecording(recording);
        if(recording.provisionalResults.length!==160||
          recording.frames.some(frame=>
            frame.riderGroups.length!==160||
            frame.energyLedger.length!==160))
          throw new Error('Resolved front lacks a complete rider replay.');
        const teams=new Map(recording.committedInputs.teams.map(team=>
          [team.id,team]));
        const counts={paidTurnKm:0,noFrontKm:0,turns:0,
          frontTurns:0,chaseTurns:0,
          sourceOrderMismatches:0,unpaidTurns:0};
        let firstMismatch=null;
        for(const frame of recording.frames){
          const plan=frame.pelotonFrontTurnPlan;
          if(!plan||!['worked','no_front'].includes(plan.status))
            throw new Error('Missing resolved front source.');
          if(plan.status==='no_front'){
            if(plan.turns.length)throw new Error('Unpaid no-front turn.');
            counts.noFrontKm++;
            continue;
          }
          if(!plan.turns.length||plan.turns[0].startM!==0||
            plan.turns.at(-1).endM!==1000||
            plan.turns.some((turn,index)=>index&&
              turn.startM!==plan.turns[index-1].endM))
            throw new Error('Resolved turn metres do not cover road.');
          counts.paidTurnKm++;
          const energy=new Map(frame.energyLedger.map(row=>[
            row.riderId,row]));
          for(const turn of plan.turns){
            counts.turns++;
            if(turn.workKind==='front')counts.frontTurns++;
            else if(turn.workKind==='chase')counts.chaseTurns++;
            else throw new Error('Unknown resolved front work.');
            const team=teams.get(turn.teamId);
            if(!team?.riders.some(rider=>rider.id===
              turn.leaderRiderId))
              throw new Error('Resolved leader lacks committed rider.');
            const order=orderAt(team.orders,frame.km-1);
            const ordered=turn.workKind==='front'?
              order.frontWork==='rotate':
              order.chase!=='ignore'&&frame.chasers.includes(team.id);
            if(!ordered){
              counts.sourceOrderMismatches++;
              firstMismatch??={km:frame.km,teamId:team.id,
                riderId:turn.leaderRiderId,
                workKind:turn.workKind,order};
            }
            if(!(energy.get(turn.leaderRiderId)
              ?.paidFromReserve>0))counts.unpaidTurns++;
          }
        }
        if(counts.paidTurnKm+counts.noFrontKm!==distanceKm)
          throw new Error('Resolved plan omitted a kilometre.');
        rows.push({seed,distanceKm,terrain,fatigue,
          riderKilometres:160*distanceKm,
          finishRiders:recording.provisionalResults.length,
          ...counts,firstMismatch});
      }
const accepted=rows.filter(row=>!row.refusal);
const sum=key=>accepted.reduce((total,row)=>total+row[key],0);
console.log(JSON.stringify({version:'v94-resolved-front-compatibility-1',
  seedCount,cases:rows.length,replayedCases:accepted.length,
  refusedCases:rows.length-accepted.length,
  riderKilometres:sum('riderKilometres'),
  finishRiders:sum('finishRiders'),
  paidTurnKm:sum('paidTurnKm'),noFrontKm:sum('noFrontKm'),
  turns:sum('turns'),frontTurns:sum('frontTurns'),
  chaseTurns:sum('chaseTurns'),
  sourceOrderMismatches:sum('sourceOrderMismatches'),
  unpaidTurns:sum('unpaidTurns'),
  firstMismatch:accepted.find(row=>row.firstMismatch)
    ?.firstMismatch??null,
  refusals:rows.filter(row=>row.refusal)}));
