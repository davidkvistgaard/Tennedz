import {NextResponse} from 'next/server';
import {protectedRoute,requireGameWrites} from '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {rpc} from '../../../../lib/race/server';
import {prepareV2TacticsRequest} from '../../../../lib/race/v2-tactics-request';

// An isolated draft. The legacy tactics lock, simulator and awards never read it.
export const POST=protectedRoute(async(req,context,auth)=>{
  if(process.env.RACE_LAB_ENABLED!=='true'||
    process.env.PELOTONIA_V2_TACTICS_SAVE_ENABLED!=='true')
    throw new AuthError('V2_SAVE_DISABLED','V2 tactics drafts are unavailable.',404);
  requireGameWrites();
  const {eventId,divisionIndex,orders}=await prepareV2TacticsRequest(req,auth);
  const saved=await rpc(auth.db,'recovery_save_v2_tactics_draft',{
    p_user:auth.user.id,p_event:eventId,p_orders:orders,
  });
  return NextResponse.json({...saved,division_index:divisionIndex,orders,saved:true});
});
