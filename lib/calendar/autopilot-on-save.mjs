// A saved one-day default gets an immediate attempt for races whose entry
// deadline is near. The daily queue remains responsible for unattended teams.
export async function enterUpcomingOnDefaultSave(db,{teamId,gender,now=new Date(),enter}){
  const horizon=new Date(now.getTime()+48*60*60*1000).toISOString();
  const {data,error}=await db.from('events').select('id')
    .eq('kind','one_day').eq('gender',gender).eq('status','OPEN')
    .in('calendar_source',['UCI','PELOTONIA'])
    .gt('deadline',now.toISOString()).lte('deadline',horizon)
    .order('deadline').order('id').limit(9);
  if(error)throw new Error('Could not load upcoming races.');
  const events=data??[],results=[];
  for(const event of events.slice(0,8)){
    try{
      const result=await enter(db,event.id,teamId);
      results.push({event_id:event.id,entered:!!result.entered,reason:result.reason??null});
    }catch(error){
      if(typeof error.status!=='number'||error.status>=500)throw error;
      results.push({event_id:event.id,entered:false,reason:error.code??'ENTRY_REJECTED'});
    }
  }
  return {attempted:results.length,entered:results.filter(item=>item.entered).length,
    more_eligible:events.length>8,results};
}
