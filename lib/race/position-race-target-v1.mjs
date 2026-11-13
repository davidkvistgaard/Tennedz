// A production experiment targets one named race. Other races continue
// through their existing engine until explicitly migrated.
export function positionRaceTargetV1(eventId,environment){
  return environment.PELOTONIA_V7_RACE_ENABLED==='true'&&
    typeof eventId==='string'&&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(eventId)&&
    environment.PELOTONIA_PHYSICAL_ENTRY_EVENT_ID===eventId;
}
