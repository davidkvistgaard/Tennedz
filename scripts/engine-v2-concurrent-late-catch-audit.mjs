// Fixed fictional coverage for the opt-in two-manager finale. This records
// which paid road states are supported; it is not a balance target.
import {runV91IntegratedTestDrive} from './engine-v2-test-drive.mjs';

const rows=[];
for(const gender of ['M','F'])for(const teamCount of [15,20])
  for(const [distanceKm,terrain,fatigue] of [[40,'flat',0],
    [40,'rolling',0],[40,'mountain',0],[120,'flat',0],
    [120,'rolling',15],[260,'mountain',30]]){
    const ids=['you',...Array.from({length:teamCount-1},(_,index)=>
      `rival-${index+1}`)];
    const managerFinaleOrders=ids.map(teamId=>({teamId,
      attack:['you','rival-2'].includes(teamId)?'selective':'none',
      ...(['you','rival-2'].includes(teamId)?{
        attackRiderId:`${teamId}-2`}:{}),
      chase:['rival-1','rival-4'].includes(teamId)?'selective':'ignore',
      frontWork:teamId==='rival-3'?'rotate':'sit_in'}));
    const scenario={settings:{distanceKm,teamCount,gender,terrain,fatigue,
      seed:'paired-final-orders',attack:'none',chase:'ignore',
      defaultRivalPlan:'neutral',managerFinaleOrders,
      teamOverrides:ids.map(teamId=>({teamId,
        level:teamId==='rival-2'?81:teamId==='you'?80:85}))}};
    const output=runV91IntegratedTestDrive(scenario,{full:true});
    const summary=output.summary;
    if(summary.pointsStatus!=='withheld'||summary.canCommitAwards!==false)
      throw new Error('The concurrent audit encountered an award path.');
    const crossings=summary.finale?.lineTimes;
    if(crossings&&(crossings.length!==teamCount*8||
      new Set(crossings.map(row=>row.riderId)).size!==teamCount*8||
      crossings.some(row=>!Number.isFinite(
        row.elapsedSecondsFromLastKmStart)||
        !Number.isFinite(row.energyAtLine))))
      throw new Error('The concurrent audit lost an individual crossing.');
    const paidRoad=summary.paidBandContinuation;
    if(paidRoad&&(paidRoad.finalRiders.length!==teamCount*8||
      new Set(paidRoad.finalRiders.map(row=>row.riderId)).size!==
        teamCount*8))
      throw new Error('The concurrent audit lost a paid road rider.');
    const row={gender,teamCount,distanceKm,terrain,fatigue,
      status:summary.status,roadStatus:summary.roadStatus,
      individualLineVersion:summary.individualLineVersion??null,
      contactKinds:output.individualLine?.roadPrefix?.contactEvents
        ?.map(event=>event.kind)??paidRoad?.contactEvents
        ?.map(event=>event.kind)??[],
      individualCrossings:crossings?.length??0,
      reason:summary.status==='unsupported'?
        summary.lateLineRefusal??summary.reason:null};
    rows.push(row);
    console.log(JSON.stringify(row));
  }
console.log(JSON.stringify({cases:rows.length,
  byRoadStatus:Object.fromEntries([...new Set(rows.map(row=>
    row.roadStatus))].map(status=>[status,rows.filter(row=>
    row.roadStatus===status).length]))}));
