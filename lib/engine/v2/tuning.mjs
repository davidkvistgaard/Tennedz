// Versioned balance parameters for the isolated v2 prototype. Changing these
// values changes simulated outcomes and must be accompanied by scenario tests.
export const TUNING_VERSION='v2-prototype-3';
export const TUNING=Object.freeze({
  weather:Object.freeze({temperatureStep:.6,temperatureRange:3,windStep:1.6,windRange:8,rainStep:.35,rainRange:2}),
  effortCost:Object.freeze({conserve:.12,steady:.20,hard:.34}),
  effortPressure:Object.freeze({conserve:.78,steady:1,hard:1.16}),
  breakaway:Object.freeze({maxRidersPerTeam:2,extraCostPerKm:.18}),
  groups:Object.freeze({dropTolerance:8,consecutiveKm:3,dropSecondsPerPoint:.25,
    rejoinSecondsPerPoint:.12,droppedAtSeconds:3}),
  finish:Object.freeze({baseSecondsPerKm:90,climbFactor:.035,descentFactor:.008,
    cobbleFactor:.08,roughSurfaceFactor:.06,windFactor:.0008,rainFactor:.002,
    finaleSecondsPerPoint:.03,noiseSeconds:.5}),
  contingency:Object.freeze({captainEnergyThreshold:30,backupEnergyLead:10,responseKmPerLeadershipBand:25}),
  attack:Object.freeze({selectiveEveryKm:20,repeatedEveryKm:5,accelerationWeight:.45,strengthWeight:.25,terrainWeight:.30,
    repeatedCost:2.4,selectiveCost:1.8,pressureToSeconds:.17}),
  chase:Object.freeze({strengthWeight:.42,enduranceWeight:.33,terrainWeight:.25,helperCapacityFactor:.55,
    selectiveCommitment:.55,selectiveCost:.65,allCost:1.15,awarenessThreshold:25,leadershipAwareness:.2,
    recoverySecondsPerCapacity:.12}),
  riderEffects:Object.freeze({
    cruise:Object.freeze({terrain:.60,endurance:.25,strength:.15}),
    attack:Object.freeze({terrain:.25,acceleration:.40,repeatability:.25,endurance:.10}),
    chase:Object.freeze({terrain:.25,strength:.45,endurance:.20,repeatability:.10}),
    finale:Object.freeze({terrain:.15,sprint:.45,positioning:.25,acceleration:.15}),
    solo:Object.freeze({timetrial:.55,endurance:.30,strength:.15}),
  }),
});
