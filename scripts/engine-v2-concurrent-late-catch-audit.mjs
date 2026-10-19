// Fixed fictional coverage for the opt-in two-manager finale. This records
// which paid road states are supported; it is not a balance target.
import {runV91IntegratedTestDrive} from './engine-v2-test-drive.mjs';

const [seed='paired-final-orders',mode='full',slots='2,2']=
  process.argv.slice(2);
const [youSlot,rivalSlot]=slots.split(',').map(Number);
if(typeof seed!=='string'||!seed||
  !['full','quick','one','mountain'].includes(mode)||
  process.argv.length>5||slots.split(',').length!==2||
  ![youSlot,rivalSlot].every(slot=>Number.isInteger(slot)&&
    slot>=0&&slot<8))
  throw new Error('Usage: node scripts/engine-v2-concurrent-late-catch-audit.mjs [seed] [full|quick|one|mountain] [youSlot,rivalSlot]');
const cases=mode==='mountain'?[[260,'mountain',30]]:
  mode!=='full'?[[40,'flat',0]]:[[40,'flat',0],
  [40,'rolling',0],[40,'mountain',0],[120,'flat',0],
  [120,'rolling',15],[260,'mountain',30]];
const rows=[];
for(const gender of mode==='one'?['M']:['M','F'])
  for(const teamCount of mode==='one'?[15]:[15,20])
  for(const [distanceKm,terrain,fatigue] of cases){
    const ids=['you',...Array.from({length:teamCount-1},(_,index)=>
      `rival-${index+1}`)];
    const managerFinaleOrders=ids.map(teamId=>({teamId,
      attack:['you','rival-2'].includes(teamId)?'selective':'none',
      ...(['you','rival-2'].includes(teamId)?{
        attackRiderId:`${teamId}-${teamId==='you'?youSlot:
          rivalSlot}`}:{}),
      chase:['rival-1','rival-4'].includes(teamId)?'selective':'ignore',
      frontWork:teamId==='rival-3'?'rotate':'sit_in'}));
    const scenario={settings:{distanceKm,teamCount,gender,terrain,fatigue,
      seed,attack:'none',chase:'ignore',
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
    const lineHandoff=output.individualLine?.roadPrefix?.frames.at(-1);
    if(output.individualLine?.frontSuffix&&
      (!Number.isFinite(output.individualLine.contactAudit
        ?.minimumGapM)||
      output.individualLine.contactAudit.minimumGapM<=0||
      !Number.isFinite(output.individualLine.frontSuffix
        .elapsedAtLineSeconds)||
      lineHandoff?.roadBands.length!==2||
      lineHandoff.roadBands[0].positionM<=
        lineHandoff.roadBands[1].positionM))
      throw new Error('The survivor audit lost a paid, separated front.');
    const priorContact=output.individualLine?.priorContact;
    if(priorContact&&(
      priorContact.kind!=='rear_attack_bunch_contact'||
      !Number.isFinite(priorContact.positionM)||
      priorContact.roadBands.map(band=>band.kind).join(',')!==
        'front,bunch'||
      !priorContact.roadBands[1].riderIds.includes(
        priorContact.caughtRiderId)||
      priorContact.elapsedSinceLaunchSeconds>=
        output.individualLine.roadPrefix.sourceElapsedSinceLaunchSeconds))
      throw new Error('The survivor audit lost its prior paid contact.');
    const bunchAt200=output.bandContinuation?.frames.find(frame=>
      frame.roadBands.some(band=>band.kind==='bunch'&&
        Math.abs(band.positionM-(distanceKm*1000-200))<1e-7));
    if(paidRoad&&(paidRoad.finalRiders.length!==teamCount*8||
      new Set(paidRoad.finalRiders.map(row=>row.riderId)).size!==
        teamCount*8))
      throw new Error('The concurrent audit lost a paid road rider.');
    const row={seed,youSlot,rivalSlot,gender,teamCount,distanceKm,
      terrain,fatigue,
      status:summary.status,roadStatus:summary.roadStatus,
      individualLineVersion:summary.individualLineVersion??null,
      contactKinds:[...(priorContact?[priorContact.kind]:[]),
        ...(output.individualLine?.roadPrefix?.contactEvents??
          paidRoad?.contactEvents??[]).map(event=>event.kind)],
      bandCrossings:paidRoad?.bandCrossings.map(band=>({
        kind:band.kind,seconds:band.elapsedSinceLaunchSeconds}))??[],
      minimumCrossBandGapM:output.individualLine?.contactAudit
        ?.minimumGapM??null,
      survivingFrontId:output.individualLine?.frontSuffix?.riderId??null,
      frontCrossingSeconds:output.individualLine?.frontSuffix
        ?.elapsedAtLineSeconds??null,
      handoffFrontGapM:lineHandoff?.roadBands.length===2?
        lineHandoff.roadBands[0].positionM-
          lineHandoff.roadBands[1].positionM:null,
      frontGapAtBunch200M:bunchAt200?.roadBands.length===2?
        bunchAt200.roadBands[0].positionM-
          bunchAt200.roadBands[1].positionM:null,
      ...(mode==='one'?{roadEvents:(output.bandContinuation?.frames??
        output.individualLine?.roadPrefix?.frames)
        .map(frame=>({event:frame.event,
          positions:frame.roadBands.map(band=>({kind:band.kind,
            positionM:band.positionM}))}))??[]}:{}),
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
