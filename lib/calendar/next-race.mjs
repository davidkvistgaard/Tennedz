// Prefer a real race date to a legacy entry deadline. The latter is only a
// fallback until older events have been reconciled with the calendar.
export function nextTeamRace(events,gender,now){
  const candidates=(events??[]).filter(event=>event.kind==='one_day'&&
    event.gender===gender&&event.status==='OPEN');
  const scheduled=candidates.filter(event=>event.scheduled_at&&
    Number.isFinite(Date.parse(event.scheduled_at))&&
    Date.parse(event.scheduled_at)>=now);
  const legacy=candidates.filter(event=>!event.scheduled_at&&
    Number.isFinite(Date.parse(event.deadline))&&Date.parse(event.deadline)>now);
  return (scheduled.length?scheduled:legacy).sort((a,b)=>
    Date.parse(a.scheduled_at??a.deadline)-Date.parse(b.scheduled_at??b.deadline)||
    a.id.localeCompare(b.id))[0]??null;
}
