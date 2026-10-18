// Offline diagnostic only: paired finale orders on one locked fictional race.
// These inferred positions and line orders cannot settle a race or award points.
import {createV91FinaleTrialWithIndependentBunch} from
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
    const request={attackTeamId:'you',attackRiderId:'you-0'};
    let baseline;
    try{baseline=createV91FinaleTrialWithIndependentBunch(
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
    const teams=['you',...Array.from({length:teamCount-1},
      (_,index)=>`rival-${index+1}`)];
    const opportunities=teams.map(teamId=>{
      const nominated=slots.find(row=>row.riderId===`${teamId}-7`);
      const candidates=slots.filter(row=>row.teamId===teamId&&
        row.riderId!==nominated.riderId&&
        row.riderId!==`${teamId}-1`&&
        Math.abs(row.lane-nominated.lane)<=1&&
        row.positionM>=nominated.positionM-1e-8&&
        row.positionM-nominated.positionM<=
          baseline.paidFinale.positionedSource.wheelSpacingM+1e-8);
      return {teamId,helperIds:candidates.map(row=>row.riderId)};
    });
    const finisher=slots.find(row=>row.riderId==='rival-1-7');
    const helpers=slots.filter(row=>row.teamId==='rival-1'&&
      row.riderId!==finisher.riderId&&
      row.riderId!=='rival-1-1'&&
      Math.abs(row.lane-finisher.lane)<=1&&
      row.positionM>=finisher.positionM-1e-8&&
      row.positionM-finisher.positionM<=
        baseline.paidFinale.positionedSource.wheelSpacingM+1e-8);
    const baselineLine=baseline.paidFinale.lineOrder.find(row=>
      row.riderId===finisher.riderId);
    const pairs=[];
    for(const helper of helpers){
      try{
        const plans=teams.map(teamId=>({teamId,
          finisherId:`${teamId}-7`,
          leadOutRiderId:teamId==='rival-1'?helper.riderId:null}));
        const withLead=createV91FinaleTrialWithIndependentBunch(
          settings,{...request,plans});
        const after=withLead.paidFinale.lineOrder.find(row=>
          row.riderId===finisher.riderId);
        pairs.push({helperId:helper.riderId,
          secondsGained:baselineLine.elapsedSecondsFromLastKmStart-
            after.elapsedSecondsFromLastKmStart,
          placesGained:baselineLine.position-after.position,
          sameRecording:JSON.stringify(baseline.recording)===
            JSON.stringify(withLead.recording),
          sameWheels:JSON.stringify(slots)===JSON.stringify(
            withLead.paidFinale.positionedSource.slots)});
      }catch(error){
        pairs.push({helperId:helper.riderId,rejected:error.message});
      }
    }
    outputs.push({...field,gender,teamCount,status:'complete_bunch',
      teamsWithEligibleHelper:opportunities.filter(row=>
        row.helperIds.length>0).length,
      eligiblePairs:opportunities.reduce((count,row)=>
        count+row.helperIds.length,0),
      finisherPlace:baselineLine.position,availableHelpers:helpers.length,
      pairs});
  }
console.log(JSON.stringify({version:'v2-positioned-finale-audit-1',
  outputs},null,2));
