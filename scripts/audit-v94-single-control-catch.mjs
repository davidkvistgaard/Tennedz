// Read-only diagnosis of a single control team's selective pursuit. This
// reconstructs its potential from prior rider reserves; the observed road
// and paid work still come exclusively from validated recording frames.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {chaseCapacity} from '../lib/engine/v2/tactics.mjs';
import {projectedCatchKm} from '../lib/engine/v2/race-context-v1.mjs';
import {TUNING,MOTOR_CANDIDATE} from '../lib/engine/v2/tuning.mjs';

const {recording,preview}=createV94RaceDynamicsPreview({format:'stage',
  settings:{distanceKm:260,terrain:'mountain',teamCount:20,gender:'M',
    fatigue:30,effort:'steady',attack:'none',chase:'selective',
    seed:'preview-boundary-6'}});
const controls=preview.teamPlans.filter(plan=>plan.role==='control');
if(controls.length!==1)throw new Error('Expected exactly one control team.');
const teamId=controls[0].teamId;
const committed=recording.committedInputs.teams.find(team=>team.id===teamId);
const rows=[];
for(let index=1;index<recording.frames.length;index++){
  const prior=recording.frames[index-1],frame=recording.frames[index];
  const ahead=new Set(prior.roadGroups.flatMap(group=>group.riderIds));
  const unavailable=new Set([...ahead,...prior.riderGroups.filter(row=>
    row.group==='dropped').map(row=>row.id)]);
  const energy=Object.fromEntries(prior.riderGroups.filter(row=>
    row.teamId===teamId).map(row=>[row.id,row.energy]));
  const team={...committed,energy};
  const capacity=chaseCapacity(team,recording.route.kilometres[index],
    unavailable);
  const gain=capacity.capacity*TUNING.chase.selectiveCommitment*
    MOTOR_CANDIDATE.chaseRecoverySecondsPerCapacity;
  const priorGap=prior.roadGroups.at(-1)?.gapSeconds??0;
  const remainingKm=recording.route.distanceKm-frame.km;
  const catchKm=priorGap===0?0:projectedCatchKm({
    gapSeconds:priorGap,remainingKm,frontSecondsPerKm:100,
    bunchSecondsPerKm:Math.max(1,100-gain)});
  rows.push({km:frame.km,priorGap,recordedGap:frame.gapSeconds,
    gain,catchKm,paidChase:frame.chasers.includes(teamId),
    paidFront:frame.paidBunchPace?.teamId===teamId,
    observedClosing:frame.observedPriorFront?.closingSecondsPerKm??null,
    teamEnergy:frame.riderGroups.filter(row=>row.teamId===teamId)
      .reduce((sum,row)=>sum+row.energy,0)/committed.riders.length});
}
const chasing=rows.filter(row=>row.paidChase);
const summary={teamId,paidChaseKm:chasing.length,
  chaseWhenCatchProjectionNull:chasing.filter(row=>row.catchKm===null).length,
  chaseWithObservedNonclosing:chasing.filter(row=>
    row.observedClosing!==null&&row.observedClosing<=0).length,
  controlFrontKm:rows.filter(row=>row.paidFront).length,
  checkpoints:rows.filter(row=>[50,75,100,125,150,175,200,225,250]
    .includes(row.km))};
process.stdout.write(`${JSON.stringify(summary,null,2)}\n`);
