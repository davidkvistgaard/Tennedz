// Cheap, read-only rejection before re-simulating a large saved v2 recording.
// SQL repeats the phase and identity checks under its transaction lock.
export function assertV2SettlementAttemptPhase(event,{now=Date.now()}={}){
  if(!event||event.kind!=='one_day'||
    !['OPEN','FINISHED'].includes(event.status)||!Number.isFinite(now))
    throw new Error('The v2 race is not ready for settlement.');
  if(event.status==='FINISHED')return;
  if(['registration_deadline','tactics_deadline','scheduled_at'].some(field=>
    !Number.isFinite(Date.parse(event[field]))||Date.parse(event[field])>now))
    throw new Error('The v2 race is not ready for settlement.');
}
