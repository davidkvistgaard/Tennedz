import {validateV2OneDayResultAgainstLock} from './v2-result-contract.mjs';

// Full, still read-only sporting-ledger rows. A later atomic settlement must
// recheck these against the saved candidate before inserting into the ledger.
export function buildV2OneDayLedgerRows(lock,contract){
  validateV2OneDayResultAgainstLock(lock,contract);
  const event=lock.event;
  const seasonYear=new Date(event.scheduled_at).getUTCFullYear();
  if(!['UCI','PELOTONIA'].includes(event.calendar_source)||
    !Number.isInteger(seasonYear)||seasonYear!==contract.seasonYear||
    !['M','F'].includes(event.gender)||event.gender!==contract.gender)
    throw new Error('The locked race lacks valid sporting-ledger metadata.');
  const rows=contract.divisions.flatMap(division=>division.awards.map(award=>({
    award_key:award.awardKey,rider_id:award.riderId,team_id:award.teamId,
    event_id:contract.eventId,season_year:seasonYear,gender:contract.gender,
    calendar_source:event.calendar_source,event_format:'ONE_DAY',
    race_tier:contract.tier,result_type:'ONE_DAY',result_place:award.placing,
    points:award.points,points_policy_version:contract.pointsPolicyVersion,
  })));
  if(new Set(rows.map(row=>row.award_key)).size!==rows.length||
    new Set(rows.map(row=>row.rider_id)).size!==rows.length)
    throw new Error('The v2 sporting awards are duplicated.');
  return rows;
}
