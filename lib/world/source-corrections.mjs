/** World Baseline 1.6.1: corrected V1.4 source labels, never object renames. */
export const correctedDiscoverySources=Object.freeze([
 ['DISC-008','DISC-120','Aurelia Icefield'],
 ['DISC-010','DISC-121','Three Lakes Basin'],
 ['DISC-012','DISC-122','Great River Marshes'],
 ['DISC-013','DISC-123','Great Caldera'],
 ['DISC-014','DISC-124','White Terraces'],
 ['DISC-015','DISC-125','Glass Plain'],
 ['DISC-016','DISC-126','Great Escarpment'],
 ['DISC-018','DISC-127','Red Canyon'],
 ['DISC-019','DISC-128','Salt Mirror'],
 ['DISC-020','DISC-129','Dry Cathedral'],
 ['DISC-021','DISC-130','Black Cliffs'],
 ['DISC-022','DISC-131','Mist Gate'],
 ['DISC-023','DISC-132','Needle Island'],
 ['DISC-024','DISC-133','White Dunes'],
 ['DISC-026','DISC-134','Azure Lagoon'],
 ['DISC-027','DISC-135','East Light'],
 ['DISC-029','DISC-136','Rainwall Viaduct'],
 ['DISC-030','DISC-137','Canyon Bridge'],
]);
export const priorSourceFor=new Map(correctedDiscoverySources.map(([prior,corrected])=>[corrected,prior]));
