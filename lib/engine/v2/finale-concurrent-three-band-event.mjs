// Find the first physical event for three ordered road bands that retain
// their already chosen pace. The caller decides work at the next boundary;
// this kernel never changes a role or grants a contact benefit.
export function firstThreeBandEvent({frontPositionM,rearPositionM,
  bunchPositionM,frontNextBoundaryM,rearNextBoundaryM,
  bunchNextBoundaryM,frontSpeedMps,rearSpeedMps,bunchSpeedMps,
  frontBoundaryKind,rearBoundaryKind,bunchBoundaryKind}){
  const candidates=[
    {kind:frontBoundaryKind,seconds:
      (frontNextBoundaryM-frontPositionM)/frontSpeedMps},
    {kind:rearBoundaryKind,seconds:
      (rearNextBoundaryM-rearPositionM)/rearSpeedMps},
    {kind:bunchBoundaryKind,seconds:
      (bunchNextBoundaryM-bunchPositionM)/bunchSpeedMps}];
  if(rearSpeedMps>frontSpeedMps)candidates.push({
    kind:'attackers_contact_uncontinued',seconds:
      (frontPositionM-rearPositionM)/(rearSpeedMps-frontSpeedMps)});
  if(bunchSpeedMps>rearSpeedMps)candidates.push({
    kind:'second_attacker_bunch_contact_uncontinued',seconds:
      (rearPositionM-bunchPositionM)/(bunchSpeedMps-rearSpeedMps)});
  const earliest=Math.min(...candidates.map(row=>row.seconds));
  const tied=candidates.filter(row=>
    Math.abs(row.seconds-earliest)<1e-9);
  const contacts=tied.filter(row=>row.kind.includes('contact'));
  return {kind:contacts.length===2?'multiple_contacts_uncontinued':
    (contacts[0]??tied[0]).kind,seconds:earliest};
}
