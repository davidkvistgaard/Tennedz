import Link from 'next/link';
import {notFound} from 'next/navigation';
import TacticalTourViewer from '../../components/TacticalTourViewer';
import {assignPointDivisions} from '../../../lib/calendar/division-reveal.mjs';
import {previewRecordedDivisions} from '../../../lib/race/v2-candidate.mjs';
import './recorded.css';

const skills=['sprint','flat','hills','mountain','cobbles','timetrial','endurance','strength','wind'];
const teams=['Amber','Birch','Cedar'].map((name,teamIndex)=>{
  const id=`sample-${name.toLowerCase()}`;
  const selected=Array.from({length:8},(_,index)=>`${name}-${index}`);
  return {id,name,riders:selected.map((id,index)=>({id,
    name:index===0?`${name} Captain`:`${name} Rider ${index+1}`,gender:'M',
    ...Object.fromEntries(skills.map((skill,skillIndex)=>[skill,
      Math.min(100,58+teamIndex*4+(index%3)*3+(skillIndex%3)*2)])),form:65,fatigue:5})),
    entry:{selected_riders:selected,captain_id:selected[0]}};
});
const snapshot={event:{id:'recorded-tour-sample',kind:'one_day',gender:'M',
  scheduled_at:'2026-10-08T12:00:00Z',seed:'recorded-tour-sample',
  weather_locked:{temp_c:17,wind_kph:14,precipitation_mm:0}},
  stage:{distance_km:60,profile_points:[[0,40],[12,40],[20,280],[30,60],
    [43,60],[50,240],[60,40]],keypoints:[{km:20},{km:50}]},
  game_date:'2026-10-08',teams,
  locked_division_reveal:assignPointDivisions({eventId:'recorded-tour-sample',
    seasonYear:2026,gender:'M',entrants:teams.map((team,index)=>({
      teamId:team.id,earnedPoints:30-index*4}))})};
const v2OrdersByTeamId=Object.fromEntries(teams.map((team,index)=>{
  const selected=team.entry.selected_riders;
  return [team.id,{captainId:selected[0],roadCaptainId:selected[index===0?1:0],
    helperIds:index===0?[selected[2],selected[3]]:[],
    preset:index===0?'protect':index===1?'aggressive':'balanced',
    ...(index===0?{phases:[{atKm:20,effort:'hard',chase:'all',
      attack:'selective',attackRiderId:selected[4],breakWork:'drive'},
      {atKm:50,effort:'steady',chase:'selective',attackRiderId:null}]}:{}),
  }];
}));
export const metadata={title:'Recorded tour prototype | Pelotonia'};
export const dynamic='force-dynamic';

export default function RecordedTourPrototype(){
  if(process.env.RACE_LAB_ENABLED!=='true')notFound();
  const recording=previewRecordedDivisions(snapshot,{v2OrdersByTeamId}).divisions[0].recording;
  return <div className="recorded-lab-shell">
    <div className="tactical-back"><Link href="/race-lab">← Back to Race Lab</Link>
      <span>Isolated sample · no saved race or points</span></div>
    <TacticalTourViewer recording={recording} focusTeamId="sample-amber"/>
  </div>;
}
