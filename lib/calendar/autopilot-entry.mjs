import {resolveAutopilotLineup} from './autopilot.mjs';
import {teamSizeFor} from './config.mjs';
import {validCalendarPlacement} from './rhythm.mjs';
import {defaultOrders} from '../race/orders.mjs';

// A conservative plan for one team and one scheduled one-day race. Conflicting
// same-day entries are held until the manager's priority policy is specified.
export function planAutopilotEntry({event,team,roster,defaultSelection,
  existingEntry=false,conflictingEventIds=[],unavailableRiderIds=[]}){
  if(!event||!team||!Array.isArray(roster))throw new Error('Invalid autopilot input.');
  if(event.kind!=='one_day'||!event.scheduled_at||
    !validCalendarPlacement({gender:event.gender,source:event.calendar_source,
      format:'ONE_DAY',scheduledDate:event.scheduled_at.slice(0,10)}))
    return {ready:false,reason:'EVENT_NOT_SCHEDULED'};
  if(event.status!=='OPEN'||!Number.isFinite(Date.parse(event.deadline))||
    Date.parse(event.deadline)<=Date.now())
    return {ready:false,reason:'ENTRY_CLOSED'};
  if(existingEntry)return {ready:false,reason:'ENTRY_ALREADY_EXISTS'};
  if(conflictingEventIds.length)return {ready:false,
    reason:'SIMULTANEOUS_EVENT_PRIORITY_UNRESOLVED',conflictingEventIds};
  const teamSize=teamSizeFor(event);
  // The existing transactional join currently accepts eight one-day riders.
  if(teamSize!==8)return {ready:false,reason:'TEAM_SIZE_NOT_SUPPORTED'};
  const lineup=resolveAutopilotLineup({event:{gender:event.gender,format:'ONE_DAY',
    scheduledDate:event.scheduled_at.slice(0,10)},roster,defaultSelection,
    unavailableRiderIds,teamSize});
  if(!lineup.ready)return lineup;
  return {ready:true,eventId:event.id,teamId:team.id,userId:team.user_id,
    selectedRiders:lineup.selectedRiders,captainId:lineup.captainId,
    replacements:lineup.replacements,orders:defaultOrders(lineup.selectedRiders,lineup.captainId)};
}
