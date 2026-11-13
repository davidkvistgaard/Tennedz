import {NextResponse} from 'next/server';
import {authFailure,databaseClient,privateHeaders,
  requireGameWrites} from '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {rpc} from '../../../../lib/race/server';
import {submitAgentPhysicalEntryV1} from
  '../../../../lib/race/agent-physical-entry-v1.mjs';

export const runtime='nodejs';
const MAX_ENTRY_BYTES=32768;

async function readEntry(req){
  const length=Number(req.headers.get('content-length'));
  if(Number.isFinite(length)&&length>MAX_ENTRY_BYTES)
    throw new AuthError('ENTRY_TOO_LARGE',
      'The race entry is too large.',413);
  const reader=req.body?.getReader();
  if(!reader)throw new AuthError('INVALID_ENTRY',
    'Enter a valid race order document.',400);
  const chunks=[];
  let size=0;
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    size+=value.byteLength;
    if(size>MAX_ENTRY_BYTES){await reader.cancel();
      throw new AuthError('ENTRY_TOO_LARGE',
        'The race entry is too large.',413);}
    chunks.push(value);
  }
  let body;
  try{body=JSON.parse(Buffer.concat(chunks,size).toString('utf8'));}
  catch{throw new AuthError('INVALID_ENTRY',
    'Enter a valid race order document.',400);}
  return body;
}

export async function POST(req){
  try{
    // Agent credentials are server-side only; browsers use the manager form.
    if(req.headers.get('origin')||req.headers.get('cookie'))
      throw new AuthError('AGENT_ENTRY_FORBIDDEN',
        'Use the manager form in the game website.',403);
    const body=await readEntry(req);
    requireGameWrites();
    const result=await submitAgentPhysicalEntryV1({body,
      authorization:req.headers.get('authorization'),
      environment:process.env,db:databaseClient(),rpc});
    return NextResponse.json(result,{headers:privateHeaders});
  }catch(error){return authFailure(error);}
}
