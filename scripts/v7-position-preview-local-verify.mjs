// Isolated, authenticated browser checks for the flag-gated V7 viewer.
// The protocol fixture is local and never contacts a real game database.
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {v93LocalBuildDirectory} from './v93-local-build-dir.mjs';

const cwd=resolve(import.meta.dirname,'..');
const {distDir,cleanup}=await v93LocalBuildDirectory(cwd);
const baseEnv={...process.env,PELOTONIA_NEXT_DIST_DIR:distDir,
  SUPABASE_URL:'http://127.0.0.1:54329',
  SUPABASE_ANON_KEY:'fixture-anon',
  SUPABASE_SERVICE_ROLE_KEY:'fixture-service-role',
  NEXT_PUBLIC_SUPABASE_URL:'',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:'',
  APP_ORIGIN:'http://localhost:3100',
  PELOTONIA_E2E_NO_CONTEST:'false',
  PELOTONIA_E2E_V2_SAVE:'false',
  PELOTONIA_E2E_V2_LOCK:'false',
  PELOTONIA_E2E_V2_RECORDING:'false',
  PELOTONIA_E2E_V2_SETTLEMENT:'false',
  PELOTONIA_E2E_PHYSICAL_VIEWER:'false',
  PELOTONIA_V7_POSITION_PREVIEW_ENABLED:'true',
  PELOTONIA_E2E_POSITION_VIEWER:'true'};

function run(args,env){
  return new Promise((resolveRun,reject)=>{
    const child=spawn(process.execPath,args,{cwd,env,
      stdio:'inherit'});
    child.once('error',reject);
    child.once('exit',(code,signal)=>code===0?
      resolveRun():reject(new Error(
        `${args[0]} exited with ${signal??code}`)));
  });
}

try{
  await run(['node_modules/next/dist/bin/next','build'],
    baseEnv);
  for(const [category,finished,teams] of [
    ['men',true,2],['women',false,2],
    ['men',true,15],['women',true,15]]){
    if(process.env.PELOTONIA_V7_VERIFY_ONLY&&
      process.env.PELOTONIA_V7_VERIFY_ONLY!==
        `${category}-${teams}`)continue;
    console.log(`V7 browser: ${category}, ${teams*8} riders, `+
      (finished?'published':'waiting'));
    await run(['node_modules/@playwright/test/cli.js',
      'test','tests/e2e/position-game-viewer.spec.mjs',
      '--reporter=dot'],{...baseEnv,
      PELOTONIA_E2E_POSITION_VIEWER_CATEGORY:category,
      PELOTONIA_E2E_POSITION_VIEWER_TEAMS:String(teams),
      PELOTONIA_E2E_POSITION_VIEWER_FINISHED:
        String(finished)});
  }
}catch(error){
  console.error(error.message);
  process.exitCode=1;
}finally{
  await cleanup();
}
