// Keep the experimental entry contract scoped to one named event.
// An unset target never changes ordinary guided-race entry.
export function physicalEntryEnabledForEventV1(eventId,environment){
  return environment.PELOTONIA_PHYSICAL_ENTRY_ENABLED==='true'&&
    typeof eventId==='string'&&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(eventId)&&
    environment.PELOTONIA_PHYSICAL_ENTRY_EVENT_ID===eventId;
}
