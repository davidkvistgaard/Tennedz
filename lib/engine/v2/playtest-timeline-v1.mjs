// Guided Motor Lab orders are changes at route markers, not repeated commands.
// A break attempt is bounded by a second marker that restores the attack order.
export function guidedTimelinePhases(orders,breakWindow,distanceKm){
  const phases=new Map();
  for(const row of orders){
    if(!Number.isInteger(row.atKm)||row.atKm<5||
      row.atKm>distanceKm-5||row.atKm%5!==0)continue;
    const {atKm,effort,chase,frontWork}=row;
    const changes={...(effort?{effort}:{}),...(chase?{chase}:{}),
      ...(frontWork?{frontWork}:{})};
    if(Object.keys(changes).length)phases.set(atKm,{...phases.get(atKm),
      teamId:'you',atKm,...changes});
  }
  if(breakWindow&&Number.isInteger(breakWindow.fromKm)&&
    Number.isInteger(breakWindow.toKm)&&breakWindow.fromKm>=5&&
    breakWindow.toKm<=distanceKm-5&&
    breakWindow.fromKm%5===0&&breakWindow.toKm%5===0&&
    breakWindow.fromKm<breakWindow.toKm){
    for(const [atKm,attack] of [[breakWindow.fromKm,'selective'],
      [breakWindow.toKm,'none']])phases.set(atKm,{...phases.get(atKm),
      teamId:'you',atKm,attack,
      ...(attack==='selective'&&/^you-[0-7]$/.test(breakWindow.riderId??'')?
        {attackRiderId:breakWindow.riderId}:{})});
  }
  return [...phases.values()].sort((a,b)=>a.atKm-b.atKm);
}
