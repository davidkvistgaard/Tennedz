import {buildV2OneDayLedgerRows} from './v2-ledger.mjs';
import {TUNING_VERSION} from '../engine/v2/tuning.mjs';

// Reconstruct the immutable candidate from database rows before any future
// finalisation. This is deliberately read-only: no race status, result or
// ranking row changes here. The eventual write transaction must recheck its
// own locked inputs and candidate identity rather than trusting this object.
export async function loadStoredV2SettlementPreflight(db,lock){
  const eventId=lock?.event?.id;
  if(typeof eventId!=='string'||!eventId)
    throw new Error('The v2 settlement needs an event tactics lock.');
  const saved=await db.from('recovery_v2_recorded_candidates')
    .select('event_id,contract_header,result_contract,recorded_at')
    .eq('event_id',eventId).maybeSingle();
  if(saved.error)throw new Error('Could not read the saved v2 candidate.',
    {cause:saved.error});
  const candidate=saved.data;
  if(!candidate||candidate.event_id!==eventId)
    throw new Error('The v2 settlement needs a saved recording candidate.');
  const split=candidate.contract_header!==null&&candidate.contract_header!==undefined;
  const legacy=candidate.result_contract!==null&&candidate.result_contract!==undefined;
  if(split===legacy)
    throw new Error('The saved v2 candidate has an ambiguous storage format.');
  let contract;
  if(split){
    const parts=await db.from('recovery_v2_recorded_divisions')
      .select('division_index,result_division')
      .eq('event_id',eventId).order('division_index',{ascending:true});
    if(parts.error)throw new Error('Could not read the saved v2 divisions.',
      {cause:parts.error});
    if(!Array.isArray(parts.data)||!parts.data.length||
      parts.data.some((row,index)=>row.division_index!==index+1))
      throw new Error('The saved v2 divisions are incomplete.');
    contract={...candidate.contract_header,
      divisions:parts.data.map(row=>row.result_division)};
  }else contract=candidate.result_contract;
  if(Array.isArray(contract?.divisions)&&contract.divisions.some(division=>
    division?.recording?.tuningVersion!==TUNING_VERSION))
    throw new Error('The saved v2 candidate needs its original engine version for settlement.');
  // This recomputes the result against the frozen manager plans and maps the
  // exact point curve into ledger-shaped rows. It does not persist any row.
  const ledgerRows=buildV2OneDayLedgerRows(lock,contract);
  return {eventId,recordedAt:candidate.recorded_at,contract,ledgerRows};
}
