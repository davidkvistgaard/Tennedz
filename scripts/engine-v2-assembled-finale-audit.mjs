// Offline paired tactic audit. The inferred wheel source and line order are
// provisional, so this cannot calibrate win rates or award race points.
import {isDeepStrictEqual} from 'node:util';
import {createV91FinaleTrialWithAssembledBunch} from
  '../lib/engine/v2/playtest-finale-trial.mjs';

const fields=[
  {distanceKm:40,terrain:'flat',fatigue:0},
  {distanceKm:120,terrain:'rolling',fatigue:15},
  {distanceKm:260,terrain:'mountain',fatigue:30},
];
const outputs=[];
for(const field of fields)for(const gender of ['M','F'])
  for(const teamCount of [4,15,20]){
    const settings={...field,teamCount,gender,attack:'none',
      chase:'ignore',defaultRivalPlan:'chase',
      seed:`position-audit:${field.distanceKm}:${gender}:${teamCount}`};
    const teams=['you',...Array.from({length:teamCount-1},
      (_,index)=>`rival-${index+1}`)];
    const request={attackTeamId:'you',attackRiderId:'you-0'};
    let baseline;
    try{baseline=createV91FinaleTrialWithAssembledBunch(
      settings,request);}catch(error){
      outputs.push({...field,gender,teamCount,status:'unsupported',
        reason:error.message});
      continue;
    }
    if(!['caught','contained'].includes(baseline.decision.branch)){
      outputs.push({...field,gender,teamCount,status:'non_bunch',
        branch:baseline.decision.branch});
      continue;
    }
    const slots=baseline.paidFinale.positionedSource.slots;
    const candidates=teams.flatMap(teamId=>{
      const finisher=slots.find(row=>row.riderId===`${teamId}-7`);
      return slots.filter(row=>row.teamId===teamId&&
        row.riderId!==finisher.riderId&&
        row.riderId!==`${teamId}-1`&&
        Math.abs(row.lane-finisher.lane)<=1&&
        row.positionM<finisher.positionM-1e-8).map(helper=>({
          teamId,helperId:helper.riderId,finisherId:finisher.riderId,
          gapM:finisher.positionM-helper.positionM}));
    }).sort((a,b)=>a.gapM-b.gapM||
      a.teamId.localeCompare(b.teamId)||
      a.helperId.localeCompare(b.helperId));
    if(!candidates.length){
      outputs.push({...field,gender,teamCount,status:'no_rear_candidate',
        riderCount:slots.length});
      continue;
    }
    let candidate,withLead;
    const rejected=[];
    for(const next of candidates){
      const plans=teams.map(teamId=>({teamId,
        finisherId:`${teamId}-7`,
        leadOutRiderId:teamId===next.teamId?
          next.helperId:null}));
      try{
        withLead=createV91FinaleTrialWithAssembledBunch(settings,
          {...request,plans});
        candidate=next;
        break;
      }catch(error){
        rejected.push({helperId:next.helperId,reason:error.message});
      }
    }
    if(!candidate){
      outputs.push({...field,gender,teamCount,
        status:'no_payable_rear_candidate',
        rearCandidates:candidates.length,rejected});
      continue;
    }
    if(!isDeepStrictEqual(baseline.recording,withLead.recording)||
      !isDeepStrictEqual(slots,
        withLead.paidFinale.positionedSource.slots))
      throw new Error('The paired audit changed its locked race or wheels.');
    if(baseline.pointsStatus!=='withheld'||
      withLead.pointsStatus!=='withheld'||
      baseline.classifiedResults!==null||
      withLead.classifiedResults!==null||
      withLead.paidFinale.lineOrder.length!==teamCount*8)
      throw new Error('The audit acquired unearned results or points.');
    const before=baseline.paidFinale.lineOrder.find(row=>
      row.riderId===candidate.finisherId);
    const after=withLead.paidFinale.lineOrder.find(row=>
      row.riderId===candidate.finisherId);
    const assembly=withLead.paidFinale.frames.flatMap(frame=>
      frame.assemblyAttempts??[]).filter(row=>
      row.helperId===candidate.helperId);
    const formed=assembly.some(row=>
      row.status==='ready_next_boundary');
    const pulled=withLead.paidFinale.frames.some(frame=>
      frame.riders.some(row=>row.riderId===candidate.helperId&&
        row.role==='lead_out'));
    outputs.push({...field,gender,teamCount,status:'paired',
      rearCandidates:candidates.length,rejected,candidate,
      assembly,formed,pulled,
      readinessWithoutPull:formed&&!pulled,
      secondsGained:before.elapsedSecondsFromLastKmStart-
        after.elapsedSecondsFromLastKmStart,
      placesGained:before.position-after.position,
      pointsStatus:withLead.pointsStatus});
  }
const summary={sources:outputs.length,
  paired:outputs.filter(row=>row.status==='paired').length,
  unsupported:outputs.filter(row=>row.status==='unsupported').length,
  formed:outputs.filter(row=>row.formed).length,
  pulled:outputs.filter(row=>row.pulled).length,
  readinessWithoutPull:outputs.filter(row=>
    row.readinessWithoutPull).length};
console.log(JSON.stringify({version:'v2-assembled-finale-audit-1',
  summary,outputs},null,2));
