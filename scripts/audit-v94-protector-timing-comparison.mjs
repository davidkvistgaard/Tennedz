// Read-only same-seed comparison of two experimental protector policies.
// The all-sprint stakes are a synthetic boundary, not actual team plans.
import {prepareV91Playtest} from
  '../lib/engine/v2/playtest.mjs';
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {replayRaceDynamicsRecording} from
  '../lib/engine/v2/replay-race-dynamics-v94.mjs';

const recordedRoadSeeds=process.argv.includes('--recorded-road-seeds');
function caughtTransitions(recording){
  const transitions=[];
  let unmatchedMarkers=0;
  for(let index=1;index<recording.frames.length;index++){
    const prior=recording.frames[index-1];
    const frame=recording.frames[index];
    const priorGroups=new Map(prior.riderGroups.map(row=>[row.id,row.group]));
    const currentGroups=new Map(frame.riderGroups.map(row=>[row.id,row.group]));
    for(const riderId of frame.caughtBreakawayRiderIds){
      if(priorGroups.get(riderId)==='breakaway'&&
        currentGroups.get(riderId)==='peloton')
        transitions.push({riderId,km:frame.km});
      else unmatchedMarkers++;
    }
  }
  return {beforeFinish:transitions.filter(row=>
    row.km<recording.route.kilometres.length).length,
  atFinish:transitions.filter(row=>
    row.km===recording.route.kilometres.length).length,
  firstKm:transitions[0]?.km??null,unmatchedMarkers};
}
const results=[];
for(let seed=1;seed<=3;seed++)
  for(const distanceKm of [120,260])
    for(const terrain of ['flat','mountain'])
      for(const fatigue of [0,30]){
        const settings={distanceKm,teamCount:20,terrain,fatigue,
          attack:'none',chase:'selective',
          seed:recordedRoadSeeds?`preview-recorded-road-${seed}`:
            `chase-turn-holdout-${seed}-${terrain}-${fatigue}`};
        const sportingStakes=prepareV91Playtest(settings).teams.map(team=>({
          teamId:team.id,goal:'sprint_finish',
          captainId:team.orders.captainId}));
        const base={format:'one_day',settings,sportingStakes,
          roadGroupPaceVersion:3,chaseTurnVersion:1,
          bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1,
          protectorSportingPursuitVersion:1};
        const row={seed,distanceKm,terrain,fatigue};
        for(const [name,timingVersion] of [['earlier',0],['observed',1]]){
          try{
            const {recording}=createV94RaceDynamicsPreview({
              ...base,protectorPursuitTimingVersion:timingVersion,
              ...(recordedRoadSeeds?{
                pelotonDraftCostVersion:1,
                pelotonExposureCostVersion:1,
                pelotonDropContactVersion:1,
                pelotonFollowerDecisionVersion:2,
                freshAttackDecisionVersion:1}:{})});
            replayRaceDynamicsRecording(recording);
            const caught=caughtTransitions(recording);
            row[name]={firstPaidChaseKm:recording.frames.find(frame=>
              frame.chasePower>0)?.km??null,
            paidChaseKm:recording.frames.filter(frame=>
              frame.chasePower>0).length,
            finalFrontGapSeconds:recording.frames.at(-1)
              .roadGroups[0]?.gapSeconds??0,
            frontCaught:recording.frames.at(-1).roadGroups.length===0,
            caughtBeforeFinish:caught.beforeFinish,
            caughtAtFinish:caught.atFinish,
            firstCaughtKm:caught.firstKm,
            unmatchedCatchMarkers:caught.unmatchedMarkers,
            timingChoices:recording.frames.reduce((sum,frame)=>sum+
              (frame.protectorPursuitDecisions??[]).length,0)};
          }catch(error){
            row[name]={refusal:error.message,sourceKm:error.sourceKm??null};
          }
        }
        results.push(row);
      }
if(process.argv.includes('--summary')){
  const summary={cases:results.length,earlierValidated:0,
    recordedRoadSeeds,
    observedValidated:0,pairedValidated:0,
    observedEarlierChase:0,observedLaterChase:0,
    earlierCaught:0,observedCaught:0,
    earlierFinalGapSum:0,observedFinalGapSum:0,
    pairedEarlierCaughtBeforeFinish:0,
    pairedObservedCaughtBeforeFinish:0,
    pairedEarlierCaughtAtFinish:0,
    pairedObservedCaughtAtFinish:0,
    unmatchedCatchMarkers:0,
    observedTimingChoices:0,refusals:[]};
  for(const row of results){
    if(row.earlier.refusal||row.observed.refusal)
      summary.refusals.push({seed:row.seed,distanceKm:row.distanceKm,
        terrain:row.terrain,fatigue:row.fatigue,
        earlier:row.earlier.refusal??null,
        observed:row.observed.refusal??null});
    if(!row.earlier.refusal){
      summary.earlierValidated++;
      summary.earlierCaught+=Number(row.earlier.frontCaught);
    }
    if(!row.observed.refusal){
      summary.observedValidated++;
      summary.observedCaught+=Number(row.observed.frontCaught);
      summary.observedTimingChoices+=row.observed.timingChoices;
    }
    if(row.earlier.refusal||row.observed.refusal)continue;
    summary.pairedValidated++;
    summary.earlierFinalGapSum+=row.earlier.finalFrontGapSeconds;
    summary.observedFinalGapSum+=row.observed.finalFrontGapSeconds;
    summary.pairedEarlierCaughtBeforeFinish+=
      row.earlier.caughtBeforeFinish;
    summary.pairedObservedCaughtBeforeFinish+=
      row.observed.caughtBeforeFinish;
    summary.pairedEarlierCaughtAtFinish+=row.earlier.caughtAtFinish;
    summary.pairedObservedCaughtAtFinish+=row.observed.caughtAtFinish;
    summary.unmatchedCatchMarkers+=row.earlier.unmatchedCatchMarkers+
      row.observed.unmatchedCatchMarkers;
    if(row.observed.firstPaidChaseKm!==null&&
      row.earlier.firstPaidChaseKm!==null){
      summary.observedEarlierChase+=Number(
        row.observed.firstPaidChaseKm<row.earlier.firstPaidChaseKm);
      summary.observedLaterChase+=Number(
        row.observed.firstPaidChaseKm>row.earlier.firstPaidChaseKm);
    }
  }
  console.log(JSON.stringify(summary));
}else console.log(JSON.stringify(results));
