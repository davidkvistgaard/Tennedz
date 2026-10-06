import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../../lib/auth/server';
import {AuthError} from '../../../../../lib/auth/policy.mjs';
import {prepareV2TacticsRequest} from '../../../../../lib/race/v2-tactics-request';

// Preview-only validation. No v2 orders are persisted or used by the live race.
export const POST=protectedRoute(async(req,context,auth)=>{
  if(process.env.RACE_LAB_ENABLED!=='true'||
    process.env.PELOTONIA_V2_TACTICS_PREVIEW_ENABLED!=='true')
    throw new AuthError('V2_PREVIEW_DISABLED','This tactics preview is unavailable.',404);
  const {eventId,divisionIndex,orders}=await prepareV2TacticsRequest(req,auth);
  return NextResponse.json({ok:true,event_id:eventId,team_id:auth.team.id,
    division_index:divisionIndex,orders,saved:false});
});
