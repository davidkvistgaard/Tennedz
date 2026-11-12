import {NextResponse} from 'next/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {authFailure,databaseClient,privateHeaders,
  requireGameWrites} from '../../../../lib/auth/server';
import {rpc} from '../../../../lib/race/server';
import {runWinterAgentTacticsV1} from
  '../../../../lib/race/winter-agent-runner-v1.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

export async function GET(req){
  try{
    const secret=process.env.CRON_SECRET;
    if(!secret||secret.length<32||
      req.headers.get('authorization')!==`Bearer ${secret}`)
      throw new AuthError('UNAUTHORIZED','Unauthorized.',401);
    if(process.env.PELOTONIA_WINTER_AGENT_TACTICS_ENABLED!=='true')
      return NextResponse.json({ok:true,enabled:false},
        {headers:privateHeaders});
    requireGameWrites();
    const result=await runWinterAgentTacticsV1({db:databaseClient(),
      rpc,environment:process.env});
    return NextResponse.json(result,{headers:privateHeaders});
  }catch(error){return authFailure(error);}
}
