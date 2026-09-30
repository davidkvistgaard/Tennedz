// Isolated stage-race accounting. The caller supplies classified stage times;
// this module does not invent bonuses, same-group timing or abandonment rules.
function validId(value){
  return typeof value==='string'&&value.length>0&&value.length<=160;
}

export function startGeneralClassification({raceCategory,riders}){
  if(!['M','F'].includes(raceCategory)||!Array.isArray(riders)||riders.length<2||
    riders.some(rider=>!validId(rider?.riderId)||!validId(rider?.teamId)||
      rider.gender!==raceCategory)||
    new Set(riders.map(rider=>rider.riderId)).size!==riders.length)
    throw new Error('Invalid classification roster.');
  return {version:1,raceCategory,completedStageIds:[],
    standings:[...riders].sort((a,b)=>a.riderId.localeCompare(b.riderId)).map(rider=>({
      riderId:rider.riderId,teamId:rider.teamId,totalMilliseconds:0,position:null,
    }))};
}

export function recordGeneralClassificationStage(previous,{stageId,classifiedTimes}){
  if(previous?.version!==1||!['M','F'].includes(previous.raceCategory)||
    !Array.isArray(previous.completedStageIds)||!Array.isArray(previous.standings)||
    previous.completedStageIds.some(id=>!validId(id))||
    new Set(previous.completedStageIds).size!==previous.completedStageIds.length||
    previous.standings.some(row=>!validId(row?.riderId)||!validId(row?.teamId)||
      !Number.isSafeInteger(row?.totalMilliseconds)||row.totalMilliseconds<0)||
    !validId(stageId)||previous.completedStageIds.includes(stageId)||
    !Array.isArray(classifiedTimes)||classifiedTimes.length!==previous.standings.length)
    throw new Error('Invalid classification stage.');
  const previousById=new Map(previous.standings.map(rider=>[rider.riderId,rider]));
  if(previousById.size!==previous.standings.length||
    new Set(classifiedTimes.map(row=>row?.riderId)).size!==classifiedTimes.length)
    throw new Error('Invalid classification roster.');
  const next=classifiedTimes.map(row=>{
    const before=previousById.get(row?.riderId);
    const milliseconds=row?.timeSeconds*1000;
    if(!before||typeof row.timeSeconds!=='number'||!Number.isFinite(milliseconds)||
      milliseconds<0||
      !Number.isSafeInteger(Math.round(milliseconds))||
      Math.abs(milliseconds-Math.round(milliseconds))>1e-6)
      throw new Error('Invalid classified stage time.');
    const totalMilliseconds=before.totalMilliseconds+Math.round(milliseconds);
    if(!Number.isSafeInteger(before.totalMilliseconds)||before.totalMilliseconds<0||
      !Number.isSafeInteger(totalMilliseconds))
      throw new Error('Invalid previous classification time.');
    return {riderId:before.riderId,teamId:before.teamId,totalMilliseconds};
  }).sort((a,b)=>a.totalMilliseconds-b.totalMilliseconds||
    a.riderId.localeCompare(b.riderId));
  let position=0;
  const standings=next.map((rider,index)=>{
    if(index===0||rider.totalMilliseconds!==next[index-1].totalMilliseconds)
      position=index+1;
    return {...rider,position};
  });
  return {version:1,raceCategory:previous.raceCategory,
    completedStageIds:[...previous.completedStageIds,stageId],standings};
}
