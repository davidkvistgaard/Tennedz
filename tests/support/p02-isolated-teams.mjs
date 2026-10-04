// Temporary accounts for a real HTTP cron capacity check. Never use production.
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,mkdirSync,unlinkSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const configPath=process.env.PELOTONIA_P02_TEST_CONFIG;
if(!configPath)throw new Error('Set PELOTONIA_P02_TEST_CONFIG to the isolated project config.');
const config=JSON.parse(readFileSync(configPath,'utf8'));
if(config.url!=='https://nxhvaoonnvmvohqaxfdx.supabase.co'||!config.serviceKey)
  throw new Error('Refusing a project outside the P02 test allowlist.');
const db=createClient(config.url,config.serviceKey,
  {auth:{persistSession:false,autoRefreshToken:false}});
const fixturePath=new URL('../../.recovery-local/p02-isolated-teams.json',import.meta.url);
const mode=process.argv[2];
const save=entries=>{
  mkdirSync(new URL('../../.recovery-local/',import.meta.url),{recursive:true});
  writeFileSync(fixturePath,JSON.stringify(entries,null,2));
};

if(mode==='seed'){
  const count=Number(process.argv[3]??24);
  if(!Number.isSafeInteger(count)||count<1||count>200)
    throw new Error('Seed count must be an integer from 1 to 200.');
  if(existsSync(fixturePath))throw new Error('Existing fixture ledger; clean it first.');
  const entries=[];
  save(entries);
  for(let index=0;index<count;index++){
    const email=`p02-cron-${randomUUID()}@example.com`;
    const {data,error}=await db.auth.admin.createUser({email,
      password:randomBytes(24).toString('base64url'),email_confirm:true});
    if(error)throw error;
    const entry={userId:data.user.id};
    entries.push(entry);save(entries);
    const team=await db.from('teams').insert({user_id:entry.userId,
      name:`P02 isolated cron ${index+1}`}).select('id').single();
    if(team.error)throw team.error;
    entry.teamId=team.data.id;save(entries);
  }
  console.log(`Created ${entries.length} isolated accounts and teams.`);
}else if(mode==='cleanup'){
  if(!existsSync(fixturePath))throw new Error('No fixture ledger to clean.');
  const entries=JSON.parse(readFileSync(fixturePath,'utf8'));
  const initialCount=entries.length;
  for(const entry of [...entries]){
    if(entry.teamId){
      const team=await db.from('teams').select('name,user_id').eq('id',entry.teamId).single();
      if(team.error||!team.data.name.startsWith('P02 isolated cron ')||
        team.data.user_id!==entry.userId)
        throw new Error('Refusing to remove a team outside the fixture ledger.');
      const removed=await db.from('teams').delete().eq('id',entry.teamId);
      if(removed.error)throw removed.error;
      delete entry.teamId;save(entries);
    }
    const user=await db.auth.admin.getUserById(entry.userId);
    if(user.error||!user.data.user.email?.startsWith('p02-cron-')||
      !user.data.user.email.endsWith('@example.com'))
      throw new Error('Refusing to remove a user outside the fixture ledger.');
    const removedUser=await db.auth.admin.deleteUser(entry.userId);
    if(removedUser.error)throw removedUser.error;
    entries.splice(entries.indexOf(entry),1);save(entries);
  }
  unlinkSync(fixturePath);
  console.log(`Removed ${initialCount} isolated accounts and teams.`);
}else{
  throw new Error('Use seed or cleanup.');
}
