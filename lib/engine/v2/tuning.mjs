// Versioned balance parameters for the isolated v2 prototype. Changing these
// values changes simulated outcomes and must be accompanied by scenario tests.
export const TUNING=Object.freeze({
  weather:Object.freeze({temperatureStep:.6,temperatureRange:3,windStep:1.6,windRange:8,rainStep:.35,rainRange:2}),
  effortCost:Object.freeze({conserve:.12,steady:.20,hard:.34}),
  attack:Object.freeze({selectiveEveryKm:20,repeatedEveryKm:5,accelerationWeight:.45,strengthWeight:.25,terrainWeight:.30,
    repeatedCost:2.4,selectiveCost:1.8,pressureToSeconds:.17}),
  chase:Object.freeze({strengthWeight:.42,enduranceWeight:.33,terrainWeight:.25,helperCapacityFactor:.55,
    selectiveCommitment:.55,selectiveCost:.65,allCost:1.15,awarenessThreshold:25,leadershipAwareness:.2,
    recoverySecondsPerCapacity:.12}),
});
