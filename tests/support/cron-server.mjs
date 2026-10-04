// HTTP-only cron fixture. It never connects to a real Supabase project.
import http from 'node:http';
import {spawn} from 'node:child_process';

const eventId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const teamIds=Array.from({length:23},(_,index)=>
  `00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`);
const defaultTeams=new Set([teamIds[0],teamIds[10],teamIds[20]]);
const riderIds=teamId=>Array.from({length:8},(_,index)=>
  `cccccccc-cccc-4ccc-8ccc-${String(Number(teamId.slice(-12))*8+index).padStart(12,'0')}`);
const state={cursor:null,lease:null,complete:false,processed:0,entered:0,
  reportedEntered:0,claims:0,joined:new Set(),failTeamId:null,failed:false,
  activeEventReads:0,maxConcurrentEventReads:0};
const send=(res,status,data)=>{
  res.writeHead(status,{'Content-Type':'application/json','x-supabase-api-version':'2024-01-01'});
  res.end(JSON.stringify(data));
};
const fixture=http.createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;
  let body;try{body=JSON.parse(raw||'{}');}catch{body={};}
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/__test_shutdown'&&req.method==='POST'){
    send(res,200,{ok:true});setTimeout(stop,100);return;
  }
  if(url.pathname==='/__cron_reset'&&req.method==='POST'){
    Object.assign(state,{cursor:null,lease:null,complete:false,processed:0,entered:0,
      reportedEntered:0,claims:0,joined:new Set(),
      failTeamId:body.failAfterJoin?teamIds[11]:null,failed:false,
      activeEventReads:0,maxConcurrentEventReads:0});
    return send(res,200,{ok:true});
  }
  if(url.pathname==='/__cron_expire'&&req.method==='POST'){
    state.lease=null;state.failTeamId=null;return send(res,200,{ok:true});
  }
  if(url.pathname==='/__cron_state')return send(res,200,state);
  if(req.headers.apikey!=='fixture-service-role')return send(res,403,{message:'Invalid fixture key'});
  if(url.pathname==='/rest/v1/rpc/recovery_autopilot_claim_job'){
    if(state.complete||state.lease)return send(res,200,null);
    state.lease=body.p_token;state.claims++;
    return send(res,200,{event_id:eventId,cursor_team_id:state.cursor});
  }
  if(url.pathname==='/rest/v1/rpc/recovery_autopilot_advance_job'){
    if(body.p_token!==state.lease||body.p_event!==eventId)return send(res,200,false);
    state.processed+=body.p_processed;state.reportedEntered=state.joined.size;
    state.cursor=body.p_cursor;
    state.complete=body.p_complete;
    state.lease=null;
    return send(res,200,true);
  }
  if(url.pathname==='/rest/v1/rpc/recovery_autopilot_join_event'){
    const teamId=teamIds.find(id=>id.slice(-12)===body.p_user?.slice(-12));
    if(!defaultTeams.has(teamId)||body.p_event!==eventId||
      body.p_riders?.length!==8||body.p_orders?.plan!=='balanced'||
      body.p_orders?.riders?.[body.p_captain]?.role!=='captain')
      return send(res,400,{code:'PT400',message:'Invalid fixture entry'});
    if(state.joined.has(teamId))return send(res,200,{ok:true,entered:false,
      reason:'ENTRY_ALREADY_EXISTS'});
    state.joined.add(teamId);state.entered++;
    return send(res,200,{ok:true,entered:true});
  }
  if(url.pathname==='/rest/v1/teams'){
    const id=url.searchParams.get('id');
    if(id?.startsWith('eq.')){
      const teamId=id.slice(3);
      if(teamId===state.failTeamId){
        state.failed=true;return send(res,503,{message:'Injected transient read failure'});
      }
      return send(res,200,{id:teamId,
        user_id:`bbbbbbbb-bbbb-4bbb-8bbb-${id.slice(-12)}`});
    }
    const after=url.searchParams.get('id')?.replace('gt.','');
    const limit=Number(url.searchParams.get('limit')??10);
    return send(res,200,teamIds.filter(teamId=>!after||teamId>after).slice(0,limit)
      .map(teamId=>({id:teamId})));
  }
  if(url.pathname==='/rest/v1/events'){
    if(!url.searchParams.get('id')?.startsWith('eq.'))return send(res,200,[]);
    state.activeEventReads++;
    state.maxConcurrentEventReads=Math.max(state.maxConcurrentEventReads,
      state.activeEventReads);
    await new Promise(resolve=>setTimeout(resolve,120));
    state.activeEventReads--;
    return send(res,200,{id:eventId,kind:'one_day',gender:'M',calendar_source:'PELOTONIA',
      race_team_size:8,scheduled_at:'2099-05-03T12:00:00Z',
      deadline:'2099-05-02T12:00:00Z',status:'OPEN'});
  }
  if(url.pathname==='/rest/v1/recovery_default_lineups'){
    const teamId=url.searchParams.get('team_id')?.replace('eq.','');
    return send(res,200,defaultTeams.has(teamId)?[{gender:'M',event_format:'ONE_DAY',
      selected_riders:riderIds(teamId),captain_id:riderIds(teamId)[0]}]:[]);
  }
  if(url.pathname==='/rest/v1/team_riders'){
    const teamId=url.searchParams.get('team_id')?.replace('eq.','');
    return send(res,200,defaultTeams.has(teamId)?riderIds(teamId).map((id,index)=>({
      rider:{id,gender:'M',rating:80-index,injury_until:null},
    })):[]);
  }
  if(url.pathname==='/rest/v1/event_teams'){
    const teamId=url.searchParams.get('team_id')?.replace('eq.','');
    return send(res,200,state.joined.has(teamId)?{event_id:eventId}:null);
  }
  return send(res,404,{message:'Unknown fixture path'});
});
fixture.listen(54330,'127.0.0.1');

const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3102'],{
  stdio:'inherit',env:{...process.env,SUPABASE_URL:'http://127.0.0.1:54330',
    SUPABASE_SERVICE_ROLE_KEY:'fixture-service-role',CRON_SECRET:'fixture-cron-secret',
    PELOTONIA_AUTOPILOT_ENABLED:'true',RECOVERY_ALLOW_GAME_WRITES:'true',
    APP_ORIGIN:'http://localhost:3102'},
});
const stop=()=>{child.kill();fixture.closeAllConnections();fixture.close();};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
child.on('exit',code=>{fixture.close();process.exitCode=code||0;});
