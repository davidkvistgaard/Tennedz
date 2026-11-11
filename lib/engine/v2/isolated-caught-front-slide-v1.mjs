// A source-paid one-rider front is caught; if it cannot match the next
// named bunch turn, it passes through without receiving a free wheel.
import {isDeepStrictEqual} from 'node:util';
import {advanceIsolatedPaidChaseRoadV1} from
  './isolated-paid-chase-road-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {orderAt} from './orders.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const ISOLATED_CAUGHT_FRONT_SLIDE_VERSION=
  'v2-isolated-caught-front-slide-1';
const DRAFT_COST_FRACTION=.8;
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Caught front has invalid road pace.');
  return 3600/seconds;
};

export function advanceCaughtFrontSlideV1({paidInput,paidRoad,
  slideDecision}){
  if(!isDeepStrictEqual(paidRoad,
    advanceIsolatedPaidChaseRoadV1(paidInput))||
    !paidRoad.contact||
    paidRoad.contact.frontRiderIds.length!==1||
    paidRoad.contact.atDistanceM>=paidInput.segment.km*1000)
    throw new Error('Slide needs one replayed paid front catch.');
  const riderId=paidRoad.contact.frontRiderIds[0];
  if(!isDeepStrictEqual(slideDecision,{riderId,
    action:'finish_safely',effort:'conserve'}))
    throw new Error('Caught rider needs an explicit solo finish decision.');
  const teams=paidInput.committedChoiceInput.teams;
  const byRider=new Map(teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const {rider}=byRider.get(riderId)??{};
  if(!rider)throw new Error('Caught rider is missing from paid source.');
  const segment=paidInput.segment;
  const base=segmentBaseSeconds(segment);
  const startM=(segment.km-1)*1000;
  const contactM=paidRoad.contact.atDistanceM-startM;
  const firstTurn=paidRoad.chaseTurnPlan.turns.find(turn=>
    turn.startM<=contactM&&turn.endM>contactM);
  if(!firstTurn)
    throw new Error('Caught rider has no remaining named bunch turn.');
  const startEnergy=paidRoad.energyByRider[riderId];
  const chaseLeader=byRider.get(firstTurn.leaderRiderId);
  const chaseLeaderEffect=riderKilometreEffect(chaseLeader.rider,
    segment,{phase:'chase',
      energy:paidRoad.energyByRider[firstTurn.leaderRiderId],
      exposed:segment.exposed});
  const hold=riderKilometreEffect(rider,segment,{phase:'cruise',
    energy:startEnergy,exposed:segment.exposed});
  const holdAbility=hold.ability+
    (TUNING.effortPressure.hard-1)*20;
  if(holdAbility+1e-9>=chaseLeaderEffect.ability)
    throw new Error('Caught rider could hold the paid bunch wheel.');
  const candidates=new Map(paidRoad.chaseTurnPlan.candidates.map(
    row=>[row.riderId,row]));
  const bunchIds=[...candidates.keys()];
  const energy={...paidRoad.energyByRider};
  const slices=[];
  let behindBunchSeconds=0;
  for(const turn of paidRoad.chaseTurnPlan.turns){
    const from=Math.max(contactM,turn.startM);
    const to=turn.endM;
    if(to<=from)continue;
    const leader=byRider.get(turn.leaderRiderId);
    const leaderEffect=riderKilometreEffect(leader.rider,segment,{
      phase:'chase',energy:energy[turn.leaderRiderId],
      exposed:segment.exposed});
    const soloEffect=riderKilometreEffect(rider,segment,{
      phase:'solo',energy:energy[riderId],
      exposed:segment.exposed});
    const bunchSpeedKph=speed(base,leaderEffect.ability+
      TUNING.breakaway.bunchDraftAdvantage);
    const soloSpeedKph=speed(base,soloEffect.ability+
      (TUNING.effortPressure.conserve-1)*20);
    const fraction=(to-from)/1000;
    const riderRows=[riderId,...bunchIds].map(id=>{
      const source=byRider.get(id);
      const isSolo=id===riderId;
      const leading=id===turn.leaderRiderId;
      const effect=isSolo?soloEffect:leading?leaderEffect:
        riderKilometreEffect(source.rider,segment,{
          phase:'cruise',energy:energy[id],
          exposed:segment.exposed});
      const effort=isSolo?'conserve':
        orderAt(source.team.orders,segment.km-1).effort;
      const extra=leading?candidates.get(id).costPerKm:0;
      const spent=fraction*(TUNING.effortCost[effort]+extra)*
        effect.energyCostMultiplier*
        (isSolo||leading?1:DRAFT_COST_FRACTION);
      const before=energy[id];
      if(spent>before+1e-9)
        throw new Error('Caught rider road has unpaid work.');
      energy[id]=Math.max(0,before-spent);
      return {riderId:id,role:isSolo?'solo':
        leading?'bunch_leader':'sheltered',
      energyBefore:before,energySpent:spent,energy:energy[id]};
    });
    behindBunchSeconds+=(to-from)*3.6/soloSpeedKph-
      (to-from)*3.6/bunchSpeedKph;
    if(behindBunchSeconds<=0)
      throw new Error('Caught rider did not fall behind the bunch.');
    slices.push({startDistanceM:startM+from,
      endDistanceM:startM+to,
      bunchLeaderRiderId:turn.leaderRiderId,
      bunchSpeedKph,soloSpeedKph,
      behindBunchSeconds,riders:riderRows});
  }
  const status=behindBunchSeconds>TUNING.groups.droppedAtSeconds?
    'solo_behind':'wheel_gap_unresolved';
  return {version:ISOLATED_CAUGHT_FRONT_SLIDE_VERSION,
    sourceKm:segment.km,riderId,slideDecision,
    catchDistanceM:paidRoad.contact.atDistanceM,
    endDistanceM:segment.km*1000,slices,
    behindBunchSeconds,energyByRider:energy,
    status,event:status==='solo_behind'?{
      kind:'front_passes_through_bunch',
      atDistanceM:paidRoad.contact.atDistanceM,riderId}:null};
}

export function validateCaughtFrontSlideV1(input,recording){
  if(!isDeepStrictEqual(recording,advanceCaughtFrontSlideV1(input)))
    throw new Error('Caught front slide differs from paid source.');
  return true;
}
