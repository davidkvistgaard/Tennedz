// Experimental whole-race physical replay. Each selected kilometre
// retains its own paid decision and refusal guards; no source gap is
// adopted as a road position or official result.
import {completeV94PhysicalFirstKmV1} from
  './v94-physical-first-km-completion-v1.mjs';
import {replayV94PhysicalSecondRearKmV1} from
  './v94-physical-second-rear-km-v1.mjs';
import {replayV94PhysicalThirdRearKmV1} from
  './v94-physical-third-rear-km-v1.mjs';
import {replayV94PhysicalFourthKmV1} from
  './v94-physical-fourth-km-v1.mjs';
import {replayV94PhysicalFifthKmV1} from
  './v94-physical-fifth-km-v1.mjs';
import {replayV94PhysicalSixthKmV1} from
  './v94-physical-sixth-km-v1.mjs';
import {replayV94PhysicalFrontCatchKmV1} from
  './v94-physical-front-catch-km-v1.mjs';
import {decideV94PhysicalFrontDropContactChoiceV1} from
  './v94-physical-front-drop-contact-choice-v1.mjs';
import {replayV94PhysicalFrontDropSecondFieldV1} from
  './v94-physical-front-drop-second-contact-field-v1.mjs';
import {replayV94PhysicalFrontDropAfterNoJoinFieldV1} from
  './v94-physical-front-drop-after-no-join-field-v1.mjs';
import {replayV94PhysicalSeventhKmV1} from
  './v94-physical-seventh-km-v1.mjs';
import {replayV94PhysicalMixedFreshKmV1} from
  './v94-physical-mixed-fresh-km-v1.mjs';
import {replayV94PhysicalPostBreakFreshKmV1} from
  './v94-physical-post-break-fresh-km-v1.mjs';
import {replayV94PhysicalDetachedPresetKmV1} from
  './v94-physical-detached-preset-km-v1.mjs';
import {replayV94PhysicalMixedOriginPresetKmV1} from
  './v94-physical-mixed-origin-preset-km-v1.mjs';
import {replayV94PhysicalPostSourceBreakKmV1} from
  './v94-physical-post-source-break-km-v1.mjs';
import {replayV94PhysicalPartialSourceWithdrawalKmV1} from
  './v94-physical-partial-source-withdrawal-km-v1.mjs';
import {replayV94PhysicalMixedPaidNextKmV1} from
  './v94-physical-mixed-paid-next-km-v1.mjs';
import {replayV94PhysicalUnattachedSourceNextKmV1} from
  './v94-physical-unattached-source-next-km-v1.mjs';
import {replayV94PhysicalRecordedRestKmV1} from
  './v94-physical-recorded-rest-km-v1.mjs';
import {replayV94PhysicalRecordedRestFrontDropKmV1} from
  './v94-physical-recorded-rest-front-drop-km-v1.mjs';
import {replayV94PhysicalMidKmContactFullFieldV1} from
  './v94-physical-mid-km-contact-full-field-v1.mjs';
import {replayV94PhysicalMixedPayableNextKmV1} from
  './v94-physical-mixed-payable-next-km-v1.mjs';
import {validateV94PhysicalWholeRaceV1,
  auditV94PhysicalRiderDecisionsV1,
  auditV94PhysicalWholeRaceSourceGapsV1} from
  './v94-physical-whole-race-validation-v1.mjs';
import {auditV94PhysicalFinishSourceV1} from
  './v94-physical-finish-source-audit-v1.mjs';
import {deriveV94PhysicalFinishRoadsV1} from
  './v94-physical-finish-roads-v1.mjs';

export const V94_PHYSICAL_WHOLE_RACE_REPLAY_VERSION=
  'v94-physical-whole-race-replay-5';

export function replayV94PhysicalWholeRaceV1(recording){
  const totalKm=recording?.route?.kilometres?.length;
  if(!Number.isInteger(totalKm)||totalKm<7||
    recording.frames?.length!==totalKm)
    throw new Error('Physical whole-race replay needs a recorded route.');
  const fourth=replayV94PhysicalFourthKmV1(recording);
  const fifth=replayV94PhysicalFifthKmV1(recording,fourth);
  let sixth;
  try{sixth=replayV94PhysicalSixthKmV1(recording,fifth);}
  catch(error){
    if(error.message===
      'Physical rear/front contact needs paid resolution.')
      sixth=replayV94PhysicalFrontCatchKmV1(recording,fifth);
    else if(error.message===
      'Physical front drop/rear contact needs paid resolution.'){
      const choice=decideV94PhysicalFrontDropContactChoiceV1(
        recording,fifth);
      sixth=choice.pendingLeaderRiderId?
        replayV94PhysicalFrontDropSecondFieldV1(
          recording,fifth):
        replayV94PhysicalFrontDropAfterNoJoinFieldV1(
          recording,fifth);
    }else throw error;
  }
  let prior=replayV94PhysicalSeventhKmV1(recording,sixth);
  const traces=[completeV94PhysicalFirstKmV1(recording),
    replayV94PhysicalSecondRearKmV1(recording),
    replayV94PhysicalThirdRearKmV1(recording),
    fourth,fifth,sixth,prior];
  for(let km=8;km<=totalKm;km++){
    const frame=recording.frames[km-1];
    let next=null,failure=null;
    try{
      if(frame.attackers.length){
        const byId=new Map(prior.finishes.map(row=>
          [row.riderId,row]));
        next=frame.attackers.every(id=>
          byId.get(id)?.physicalGroup==='peloton')?
          prior.sourceBreakRiderIds.length?
            replayV94PhysicalMixedFreshKmV1(recording,prior):
            replayV94PhysicalPostBreakFreshKmV1(
              recording,prior):
          prior.sourceBreakRiderIds.length===0&&
            frame.attackers.some(id=>
              byId.get(id)?.physicalGroup==='peloton')?
            replayV94PhysicalMixedOriginPresetKmV1(
              recording,prior):
            replayV94PhysicalDetachedPresetKmV1(
              recording,prior);
      }else if(frame.breakawayRiderIds.length===0){
        next=replayV94PhysicalPostSourceBreakKmV1(
          recording,prior);
      }else if(frame.breakawayRiderIds.length<
        prior.sourceBreakRiderIds.length){
        next=replayV94PhysicalPartialSourceWithdrawalKmV1(
          recording,prior);
      }else next=prior.physicallyCaughtSourceBreakRiderIds
        ?.length?
          replayV94PhysicalUnattachedSourceNextKmV1(
            recording,prior):
        prior.contactFragmentVersion||
        prior.mixedPaidContactFromPrior===true?
          replayV94PhysicalMixedPaidNextKmV1(recording,prior):
          replayV94PhysicalUnattachedSourceNextKmV1(
            recording,prior);
    }catch(error){failure=error;}
    if(failure?.message===
      'Attached front energy differs from V94 source.'&&
      frame.pelotonRestTeamIds?.length){
      try{next=replayV94PhysicalRecordedRestKmV1(
        recording,prior);failure=null;}
      catch(error){failure=error;}
    }
    if(['Named leader left the physical front.',
      'Physical front lacks continuous paid reserve.'].includes(
      failure?.message)&&
      (failure.message==='Named leader left the physical front.'||
        prior.mixedPaidContactFromPrior===true||
        prior.front.availableFrontPlanVersion)&&
      prior.sourceBreakRiderIds?.length&&
      !frame.attackers.length&&
      (failure.message==='Named leader left the physical front.'||
        prior.front.availableFrontPlanVersion)){
      try{next=replayV94PhysicalUnattachedSourceNextKmV1(
        recording,prior,{useAvailableFront:true});failure=null;}
      catch(error){failure=error;}
    }
    if(['Physical front needs an intact paid plan.',
      'Physical front lacks continuous paid reserve.',
      'Named leader left the physical front.'].includes(
      failure?.message)&&
      prior.front.availableFrontPlanVersion&&
      frame.attackers.length&&
      frame.attackers.every(id=>prior.finishes.some(row=>
        row.riderId===id&&row.physicalGroup!=='peloton'))){
      try{next=replayV94PhysicalDetachedPresetKmV1(
        recording,prior,{useAvailableFront:true});failure=null;}
      catch(error){failure=error;}
    }
    if(['Physical front needs an intact paid plan.',
      'Physical front lacks continuous paid reserve.',
      'Named leader left the physical front.'].includes(
      failure?.message)&&
      frame.breakawayRiderIds.length===0&&
      (prior.sourceBreakRiderIds?.length||
        prior.formerSourceBreakRiderIds?.length)){
      try{next=replayV94PhysicalPostSourceBreakKmV1(
        recording,prior,{useAvailableFront:true});failure=null;}
      catch(error){failure=error;}
    }
    if(failure?.message===
      'Physical front drop/rear contact needs paid resolution.'&&
      frame.pelotonRestTeamIds?.length){
      try{next=replayV94PhysicalRecordedRestFrontDropKmV1(
        recording,prior);failure=null;}
      catch(error){failure=error;}
    }
    if(['Mixed paid km needs physical mixed contact.',
      'Mixed paid km needs contact-settled field.'].includes(
      failure?.message)){
      try{next=replayV94PhysicalUnattachedSourceNextKmV1(
        recording,prior);failure=null;}
      catch(error){failure=error;}
    }
    if(failure?.message===
      'Physical rear roads need paid contact resolution.'&&
      failure.physicalRoads?.front?.availableFrontPlanVersion&&
      frame.attackers.length){
      try{next=replayV94PhysicalMidKmContactFullFieldV1(
        recording,prior,{detachedPresetAvailable:true});
      failure=null;}
      catch(error){
        failure=error;
        if(error.message===
          'Contact fragment needs one payable leader and all riders.'&&
          error.sourceEvidence?.pendingLeaderRiderId===null&&
          error.sourceEvidence?.candidateCount===2&&
          prior.sourceBreakMembershipEnded===true){
          try{next=replayV94PhysicalDetachedPresetKmV1(
            recording,prior,{useAvailableFront:true,
              allowSoloPassThrough:true});failure=null;}
          catch(refusal){failure=refusal;}
        }
      }
    }
    if(failure?.message===
      'Physical rear roads need paid contact resolution.'&&
      !frame.attackers.length){
      try{next=replayV94PhysicalMidKmContactFullFieldV1(
        recording,prior);failure=null;}
      catch(error){failure=error;}
    }
    if(failure?.message===
      'Contact fragment needs one payable leader and all riders.'&&
      failure.sourceEvidence?.pendingLeaderRiderId===null&&
      failure.sourceEvidence?.candidateCount===2&&
      prior.front.availableFrontPlanVersion&&
      prior.sourceBreakRiderIds?.length&&
      !frame.attackers.length){
      try{next=replayV94PhysicalUnattachedSourceNextKmV1(
        recording,prior,{useAvailableFront:true,
          allowSoloPassThrough:true});failure=null;}
      catch(error){failure=error;}
    }
    if(failure?.message===
      'Physical rear/front contact needs paid resolution.'){
      try{next=replayV94PhysicalFrontCatchKmV1(
        recording,prior);failure=null;}
      catch(error){failure=error;}
    }
    if(failure?.message===
      'Rear rider cannot pay terrain-priced work.'&&
      failure.sourceEvidence?.sourceKm===km){
      try{next=replayV94PhysicalMixedPayableNextKmV1(
        recording,prior);failure=null;}
      catch(error){failure=error;}
    }
    if(failure){
      Object.defineProperty(failure,'paidPriorTrace',{
        value:prior});
      Object.defineProperty(failure,'paidTraces',{
        value:traces});
      throw new Error(
        `Physical whole-race replay stops at km ${km}: ${
          failure.message}`,{cause:failure});
    }
    if(next?.sourceKm!==km||
      next.fullFieldKilometre!==true)
      throw new Error(
        `Physical whole-race replay lacks km ${km}.`);
    traces.push(next);
    prior=next;
  }
  const validation=validateV94PhysicalWholeRaceV1(
    recording,traces);
  const riderDecisionAudit=auditV94PhysicalRiderDecisionsV1(
    recording,traces);
  const sourceGapAudit=auditV94PhysicalWholeRaceSourceGapsV1(
    recording,traces);
  const finishSourceAudit=auditV94PhysicalFinishSourceV1(
    recording,traces);
  const physicalFinish=deriveV94PhysicalFinishRoadsV1(
    recording,traces);
  return {version:V94_PHYSICAL_WHOLE_RACE_REPLAY_VERSION,
    traces,validation,riderDecisionAudit,
    sourceGapAudit,finishSourceAudit,
    physicalFinish,
    sourceCheckpointCalibrationFailed:
      sourceGapAudit.sourceGapExceedsBestPaidLeadCount>0||
      finishSourceAudit.mismatchCount>0,
    officialResults:false};
}
