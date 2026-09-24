"use client";
import {useState} from 'react';
import TeamShell from '../../components/TeamShell';
import RiderAvatar from '../../components/RiderAvatar';
import {useAuth} from '../../components/AuthProvider';
import {countryLabel} from '../../../lib/riders/identity.mjs';

export default function PortraitsPage(){
  const {session}=useAuth();const [gender,setGender]=useState('M');
  const riders=(session?.riders||[]).filter(r=>r.gender===gender);
  return <TeamShell title="Meet your team">
    <p style={{color:'var(--muted)',maxWidth:660}}>The faces behind the results. Every rider has a consistent appearance. Personal style offers no advantage on the road.</p>
    <div style={{display:'flex',gap:8,margin:'20px 0'}} role="group" aria-label="Rider category">
      {[['M','Men'],['F','Women']].map(([value,label])=><button key={value} className="pillBtn" aria-pressed={gender===value} onClick={()=>setGender(value)} style={{background:gender===value?'#d5e9d9':undefined}}>{label}</button>)}
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:18}}>
      {riders.map(r=><article key={r.id} className="card" style={{padding:16,display:'grid',justifyItems:'center',textAlign:'center',gap:8,alignContent:'start'}}>
        <RiderAvatar rider={r} size={180}/>
        <div style={{fontSize:12,letterSpacing:'.08em',textTransform:'uppercase',marginTop:5,color:'var(--muted)'}}>{countryLabel(r.nationality)}</div>
        <h2 style={{fontSize:19,margin:0}}>{r.display_name||r.name}</h2>
        <div className="small">{r.age??'?'} years · {r.rating??0} points</div>
      </article>)}
    </div>
    {!riders.length&&<p>Your team has no riders in this category yet.</p>}
  </TeamShell>;
}
