import {NextResponse} from 'next/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {authFailure,databaseClient,privateHeaders,requireGameWrites} from
  '../../../../lib/auth/server';
import {executeRace} from '../../../../lib/race/server';
import {positionRaceTargetV1} from
  '../../../../lib/race/position-race-target-v1.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;

const EVENT_ID='109a9235-44e6-d390-1fa9-aec19b65cf3b';
const DEADLINE='2026-11-15T17:00:00.000Z';
const SCHEDULED='2026-11-15T18:00:00.000Z';

// A one-race pilot. The daily cron is inert outside this date and must not
// be treated as the scheduler for future races.
export async function GET(req){
  try{
    const secret=process.env.CRON_SECRET;
    if(!secret||secret.length<32||
      req.headers.get('authorization')!==`Bearer ${secret}`)
      throw new AuthError('UNAUTHORIZED','Unauthorized.',401);
    const now=Date.now();
    if(now<Date.parse(DEADLINE)||now>=Date.parse('2026-11-16T00:00:00Z'))
      return NextResponse.json({ok:true,eligible:false},
        {headers:privateHeaders});
    if(!positionRaceTargetV1(EVENT_ID,process.env))
      throw new AuthError('POSITION_RACE_NOT_ENABLED',
        'The scheduled race engine is not enabled.',409);
    requireGameWrites();
    const db=databaseClient();
    const {data:event,error}=await db.from('events')
      .select('id,status,deadline,scheduled_at').eq('id',EVENT_ID)
      .maybeSingle();
    if(error||!event)throw new AuthError('RACE_UNAVAILABLE',
      'Could not verify the scheduled race.',503);
    if(event.status==='FINISHED')
      return NextResponse.json({ok:true,alreadyFinished:true},
        {headers:privateHeaders});
    if(event.status!=='OPEN'||Date.parse(event.deadline)!==
      Date.parse(DEADLINE)||Date.parse(event.scheduled_at)!==
      Date.parse(SCHEDULED))
      throw new AuthError('RACE_SCHEDULE_CHANGED',
        'The scheduled race no longer matches its approved start and cutoff.',409);
    const result=await executeRace(db,EVENT_ID);
    return NextResponse.json({ok:true,eventId:EVENT_ID,
      alreadyFinished:!!result.already_finished},
    {headers:privateHeaders});
  }catch(error){
    console.error('Scheduled November 2026 race failed',error);
    return authFailure(error);
  }
}
