// Run only after adding the eight disposable P02 concurrent fixtures.
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const configPath=process.env.PELOTONIA_P02_TEST_CONFIG;
if(!configPath)throw new Error('Set PELOTONIA_P02_TEST_CONFIG.');
const config=JSON.parse(readFileSync(configPath,'utf8'));
if(config.url!=='https://nxhvaoonnvmvohqaxfdx.supabase.co'||!config.serviceKey)
  throw new Error('Refusing a project outside the P02 test allowlist.');
const db=createClient(config.url,config.serviceKey,
  {auth:{persistSession:false,autoRefreshToken:false}});
const source='5a676cd4-5558-488c-884a-d4c21ad9eb33';
const original=await db.from('event_teams')
  .select('team_id,selected_riders,captain_id').eq('event_id',source).limit(1).single();
if(original.error)throw original.error;
const {team_id:teamId,selected_riders:riders,captain_id:captainId}=original.data;
const team=await db.from('teams').select('user_id').eq('id',teamId).single();
if(team.error)throw team.error;
const orders=plan=>({version:1,plan,riders:Object.fromEntries(
  riders.map(id=>[id,{role:id===captainId?'captain':plan==='captain'?'helper':'free',
    effort:'balanced'}]))});
let automaticFirst=0;
for(let n=1;n<=8;n++){
  const eventId=`d02c0000-0000-4000-8000-${String(100+n).padStart(12,'0')}`;
  const params={p_user:team.data.user_id,p_event:eventId,
    p_riders:riders,p_captain:captainId};
  const manual=()=>db.rpc('recovery_join_event_with_orders',
    {...params,p_orders:orders('captain')});
  const automatic=()=>db.rpc('recovery_autopilot_join_event',
    {...params,p_orders:orders('balanced')});
  const [first,second]=await Promise.all(n%2?[automatic(),manual()]:[manual(),automatic()]);
  if(first.error||second.error)
    throw new Error(`Race ${n}: ${first.error?.message??second.error?.message}`);
  const automaticResult=n%2?first.data:second.data;
  if(automaticResult.entered)automaticFirst++;
  const entry=await db.from('event_teams').select('orders')
    .eq('event_id',eventId).eq('team_id',teamId).single();
  if(entry.error||entry.data.orders?.plan!=='captain')
    throw new Error(`Race ${n}: manual orders were not retained.`);
  const receipt=await db.from('recovery_entry_receipts').select('event_id')
    .eq('event_id',eventId).eq('team_id',teamId);
  if(receipt.error||receipt.data.length!==1)
    throw new Error(`Race ${n}: expected one entry fee receipt.`);
}
console.log(`Eight concurrent manager/autopilot races passed; automatic-first joins: ${automaticFirst}.`);
