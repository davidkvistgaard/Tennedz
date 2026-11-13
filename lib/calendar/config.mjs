// Product policy is separate from the race engine and can be versioned later.
export const CALENDAR_POLICY_VERSION='v0.1';
export const DEFAULT_TEAM_SIZES=Object.freeze({ONE_DAY:8,STAGE_RACE:8});
export const INACTIVITY_DAYS=Object.freeze({inactive:90,dormantEligible:180});
export function teamSizeFor(event){
  const size=event?.race_team_size??DEFAULT_TEAM_SIZES[event?.kind==='stage_race'?'STAGE_RACE':'ONE_DAY'];
  if(!Number.isInteger(size)||size<1||size>20)throw new Error('Invalid race team size.');
  return size;
}
