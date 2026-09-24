// UI journey fixture: browser-bound responses only. No real signup, database writes,
// paid service, or production data. Sporting output comes from the real race engine.
import { execFileSync } from 'node:child_process';
import { routeTemplates } from '../../lib/race/templates.mjs';
export async function installJourney(page) {
  let signedIn=false, created=false, entry=null, finished=false, output=null, rejected=false;
  const team={id:'11111111-1111-4111-8111-111111111112',name:'Northern Lights Cycling',budget:100000,coins:100000};
  const names=['Emil Berg','Louis Morel','Mateo Rojas','Dawit Tesfay','Luca Rossi','Noah Vermeer','Adam Nowak','Elias Holm','Freja Møller','Elin Lind','Femke Visser','Zofia Kowalska','Haruka Mori','Lina Moreau','Sara Costa','Amina Diallo'];
  const riders=names.map((name,i)=>({id:`rider-${i}`,name,gender:i<8?'M':'F',nationality:['DNK','FRA','COL','ERI','ITA','NLD','POL','SWE'][i%8],age:22+i%7,rating:0,sprint:40+i,flat:52,hills:45+i,mountain:65-i,cobbles:40,timetrial:43,endurance:60,strength:45,wind:47,form:85,fatigue:i%8}));
  const event={id:'11111111-1111-4111-8111-111111111113',name:'The Coast Classic',kind:'one_day',gender:'M',status:'OPEN',entry_fee:0,deadline:new Date(Date.now()+3600000).toISOString(),seed:'ui-journey',weather_locked:{condition:'clear',temp_c:18,wind_kph:8,wind_dir:'W',precipitation_mm:0}};
  const stage=structuredClone(routeTemplates[0]);
  await page.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname;
    const send=(json,status=200)=>route.fulfill({status,json});
    if(path==='/api/auth/signup'){signedIn=true;return send({ok:true,needs_confirmation:false});}
    if(path==='/api/auth/me')return !signedIn?send({ok:false,code:'UNAUTHENTICATED',error:'Please sign in.'},401):!created?send({ok:false,code:'TEAM_NOT_LINKED',error:'Create your first team.'},409):send({ok:true,logged_in:true,user:{id:'journey-user'},team,riders});
    if(path==='/api/onboarding'){
      if(request.method()==='POST'){team.name=request.postDataJSON().name;created=true;return send({ok:true,team_id:team.id,created:true});}
      return send({ok:true,has_team:created});
    }
    if(path==='/api/game-date')return send({ok:true,game_date:'2026-09-24'});
    if(path==='/api/events')return send({ok:true,server_time:new Date().toISOString(),events:[event]});
    if(path==='/api/stage-profile')return send({ok:true,stage});
    if(path==='/api/event/join'){
      if(request.method()==='POST'){
        if(rejected){rejected=false;return send({ok:false,error:'Could not save your lineup. Please try again.'},503);}
        entry=request.postDataJSON();return send({ok:true});
      }
      return send({ok:true,entry});
    }
    if(path==='/api/event/divisions')return send({ok:true,my_division:1,divisions:[{division_index:1,team_count:2}]});
    if(path==='/api/event-run')return send({ok:true,team_id:team.id,run:{event_id:event.id,division_index:1,stage_snapshot:stage,replay:output.divisions[0].replay}});
    if(path==='/api/event/results'){
      const division=output.divisions[0];
      return send({ok:true,event,total_divisions:1,teams:division.teams.map(t=>({...t,multiplier:1,teams:{name:t.team_id===team.id?team.name:'Rival Cycling'}})),riders:division.results.map(r=>({...r,riders:{name:r.rider_name},teams:{name:r.team_name}}))});
    }
    return send({ok:true,rows:[]});
  });
  return {
    rejectNextSave(){rejected=true;},
    entry(){return entry;},
    finish(){
      if(!entry)throw Error('No saved lineup');
      event.deadline=new Date(Date.now()-1000).toISOString();
      const own={...team,riders,entry};
      const rival={id:'rival-team',name:'Rival Cycling',riders:riders.slice(0,8).map(r=>({...r,id:`other-${r.id}`}))};
      rival.entry={selected_riders:rival.riders.map(r=>r.id),captain_id:rival.riders[0].id};
      if(!finished) {
        // Use Node directly: Playwright's CJS transform cannot load the mixed legacy .js engine.
        const engine=new URL('../../lib/race/cycle.mjs',import.meta.url).href;
        const code=`import {buildRace} from ${JSON.stringify(engine)}; import {readFileSync} from 'node:fs'; process.stdout.write(JSON.stringify(buildRace(JSON.parse(readFileSync(0,'utf8')))));`;
        output=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',code],{input:JSON.stringify({event,stage,game_date:'2026-09-24',teams:[own,rival]}),encoding:'utf8',maxBuffer:8*1024*1024}));
      }
      finished=true;event.status='FINISHED';
    },event,stage,
  };
}
