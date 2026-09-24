"use client";
import {useId,useState} from 'react';
import {useClubStyle, CLUB_PALETTES} from './ClubStyle';
import {riderAppearance} from '../../lib/riders/identity.mjs';

const shade=(hex,factor)=>'#'+hex.slice(1).match(/../g).map(v=>Math.min(255,Math.round(parseInt(v,16)*factor)).toString(16).padStart(2,'0')).join('');

// Lightweight deterministic fallback. Original painted portraits can replace it
// individually without rerolling a rider's identity or adding a runtime AI bill.
export function RiderArt({rider}) {
  const {kit}=useClubStyle();
  const colors=CLUB_PALETTES[kit.palette];
  const a=riderAppearance(rider), id=useId().replace(/:/g,'');
  const hair=a.dye?.placement==='full'?a.dye.color:a.naturalHair;
  const jaw=27*a.jawWidth, chin=13*a.chinWidth, bottom=153+a.chinLength;
  const top=a.headShape==='round'?43:a.headShape==='long'?33:38;
  const side=a.headShape==='square'?48:a.headShape==='heart'?46:a.headShape==='trapezoid'?44:42;
  const cheek=side+3*a.cheekFullness;
  const head=`M100 ${top} C${100-side} ${top-3} ${100-side-5} 65 ${100-cheek} 101 Q${100-side} 133 ${100-jaw} 143 Q${100-chin} ${bottom} 100 ${bottom+1} Q${100+chin} ${bottom} ${100+jaw} 143 Q${100+side} 133 ${100+cheek} 101 C${100+side+5} 65 ${100+side} ${top-3} 100 ${top}Z`;
  const sx=a.headWidth,sy=a.headLength;
  const long=['long','medium','bob','ponytail','braid','bun'].includes(a.hairStyle);
  const lipY=127, mw=a.mouthWidth/2;
  const smile=a.expression==='grin'?7:a.expression==='smile'?4:a.expression==='serious'?-2:0;
  const mouths=`M${100-mw} ${lipY} Q100 ${lipY+smile} ${100+mw} ${lipY-a.asymmetry}`;
  const hairline=a.hairline==='high'?8:a.hairline==='receding'?12:a.hairline==='low'?-4:0;
  const fringe=a.hairStyle==='pixie'?`M56 64Q72 29 138 49L120 73L124 56L77 72Z`:a.hairStyle==='fade'?`M58 67L63 42Q96 23 139 42L141 60Q101 47 58 67Z`:a.hairStyle==='classic'?`M56 70Q64 22 139 42Q127 62 80 67L64 83Z`:null;
  return <svg viewBox="8 8 184 222" preserveAspectRatio="xMidYMax meet" width="100%" height="100%" aria-hidden="true">
    <defs>
      <radialGradient id={`${id}paper`} cx="35%" cy="28%" r="80%"><stop stopColor="#fcf4df"/><stop offset=".65" stopColor="#e4dfc7"/><stop offset="1" stopColor="#c5cdb4"/></radialGradient>
      <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2=".6"><stop stopColor={shade(a.skin,1.08)}/><stop offset=".48" stopColor={a.skin}/><stop offset="1" stopColor={shade(a.skin,.83)}/></linearGradient>
      <linearGradient id={`${id}h`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={shade(hair,1.22)}/><stop offset="1" stopColor={hair}/></linearGradient>
      <linearGradient id={`${id}j`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={shade(colors.primary,1.2)}/><stop offset="1" stopColor={colors.primary}/></linearGradient>
      <clipPath id={`${id}face`}><path d={head}/></clipPath>
      <clipPath id={`${id}hair`}><path d={`M${100-side-5} 85 Q44 29 100 ${top-8} Q158 25 ${100+side+5} 87 L138 64 Q101 74 62 64Z`}/></clipPath>
    </defs>
    <rect width="200" height="240" fill={`url(#${id}paper)`}/>
    <path d="M0 185Q42 173 66 185T129 179T200 168V240H0Z" fill="#a1ae8d" opacity=".15"/>
    <ellipse cx="101" cy="233" rx="77" ry="14" fill="#293e30" opacity=".10"/>
    {long&&<path d="M56 68 Q42 120 55 190 L144 190 Q157 115 144 66Z" fill={hair}/>}
    <path d={`M${100-18*a.neckWidth} 137 L${100-18*a.neckWidth} 176 Q100 194 ${100+18*a.neckWidth} 176 L${100+18*a.neckWidth} 137Z`} fill={`url(#${id}s)`}/>
    <path d="M79 147 Q100 167 121 147 L120 161 Q101 176 80 161Z" fill="#5b3428" opacity=".16"/>
    <path d={`M${100-83*a.shoulders} 240 L${100-74*a.shoulders} 193 Q49 177 76 170 Q100 187 124 170 Q151 177 ${100+74*a.shoulders} 193 L${100+83*a.shoulders} 240Z`} fill={`url(#${id}j)`}/>
    {kit.pattern==='band'&&<path d="M48 208H151V225H48Z" fill={colors.accent}/>}
    {kit.pattern==='diagonal'&&<path d="M49 225L134 181L150 192L62 240H49Z" fill={colors.accent}/>}
    <path d="M76 171 Q100 188 124 171 L127 180 Q100 198 73 180Z" fill="#a6b8a2"/>
    <path d="M41 191Q47 213 46 240M157 191Q151 213 153 240" fill="none" stroke="#092f28" strokeWidth="2" opacity=".25"/>
    <path d="M100 187V240" stroke="#c4d0b4" strokeWidth="2" opacity=".7"/>
    <path d="M28 211L53 219M147 219L174 211" stroke="#d3dcc3" strokeWidth="8" opacity=".8"/>
    <g transform={`translate(100 98) scale(${sx} ${sy}) translate(-100 -98)`}>
      {[-1,1].map(d=><g key={d} transform={`rotate(${d*a.earAngle} ${100+d*44} 98)`}><ellipse cx={100+d*44} cy="98" rx={7*a.earSize} ry={12*a.earSize} fill={a.skin}/><path d={`M${100+d*47} 94q${-d*7} -4 ${-d*4} 12`} fill="none" stroke="#714b3b" opacity=".3"/></g>)}
      <path d={head} fill={`url(#${id}s)`}/>
      <g clipPath={`url(#${id}face)`}>
        <path d="M54 49Q44 120 89 159H42V35Z" fill="#563325" opacity=".10"/>
        <path d="M142 53Q153 120 111 157H160V40Z" fill="#563325" opacity=".15"/>
        <ellipse cx="75" cy="112" rx={12+a.cheekFullness*3} ry="8" fill="#be796b" opacity=".14"/>
        <ellipse cx="124" cy="112" rx={12+a.cheekFullness*3} ry="8" fill="#be796b" opacity=".14"/>
        {a.freckles&&Array.from({length:15},(_,i)=><circle key={i} cx={66+(i*13)%66} cy={104+(i*7)%9} r=".8" fill="#8c5a3d" opacity=".4"/>)}
        {a.mole&&<circle cx="123" cy="119" r="1.1" fill="#654230"/>}
        {a.scar&&<path d="M66 105l4 8" stroke="#efd4bc" strokeWidth="1.5"/>}
      </g>
      {[-1,1].map(d=>{const x=100+d*a.eyeSpacing,y=88+(d===1?a.asymmetry:0),w=a.eyeWidth,h=a.eyeHeight;return <g key={d}>
        <g transform={`rotate(${d*a.eyeTilt} ${x} ${y})`}>
          <path d={`M${x-w} ${y} Q${x} ${y-h*1.5} ${x+w} ${y} Q${x} ${y+h} ${x-w} ${y}`} fill="#f6f0e8"/>
          <ellipse cx={x} cy={y-.2} rx={Math.min(4.5,h*.7)} ry={Math.min(4.5,h*.7)} fill={a.iris}/>
          <circle cx={x} cy={y-.2} r="2" fill="#282323"/><circle cx={x-1.1} cy={y-1.6} r=".9" fill="#fff"/>
          <path d={`M${x-w} ${y} Q${x} ${y-h*1.5} ${x+w} ${y}`} fill="none" stroke="#533c32" strokeWidth="1.5" opacity=".8"/>
          <path d={`M${x-w} ${y-3} Q${x} ${y-h*1.6-3} ${x+w} ${y-3}`} fill="none" stroke="#805442" opacity={a.eyelid*.4}/>
        </g>
        <path d={`M${x-a.browLength} ${75+a.browSpacing+d*a.browAsymmetry} Q${x} ${75+a.browSpacing-a.browArch} ${x+a.browLength} ${75+a.browSpacing-d*a.browAngle/4}`} fill="none" stroke={a.browColor} strokeWidth={a.browThickness} strokeLinecap="round" opacity={a.browDensity} strokeDasharray={a.browGap?'10 2 20':undefined}/>
      </g>;})}
      <path d={`M99 92 Q${a.noseBridge==='convex'?109:103} 103 ${100+a.noseWidth/2} ${95+a.noseLength} Q101 ${99+a.noseLength} ${100-a.noseWidth/2} ${95+a.noseLength}`} fill="none" stroke="#8c5a43" opacity=".4" strokeWidth="1.7"/>
      <ellipse cx="100" cy={95+a.noseLength} rx={a.noseTip==='rounded'?4:2.5} ry="2" fill="#fff" opacity=".12"/>
      <path d={mouths} fill="none" stroke="#9d6658" strokeWidth={a.lipFullness+1} strokeLinecap="round" opacity=".65"/>
      {a.expression==='grin'&&<path d={`M${100-mw+2} ${lipY} Q100 ${lipY+8} ${100+mw-2} ${lipY}`} fill="#faf3e6"/>}
      <path d={mouths} fill="none" stroke="#644439" strokeWidth="1" opacity=".65"/>
      {a.dimples&&<path d={`M${97-mw} 127l-1 3M${103+mw} 126l1 3`} stroke="#9a6952" opacity=".3"/>}
      {['stubble','shortbeard'].includes(a.facialHair)&&<path d={`M${100-jaw-7} 124 Q100 ${bottom+13} ${100+jaw+7} 124 Q100 ${bottom-6} ${100-jaw-7} 124`} fill={a.naturalHair} opacity={a.facialHair==='stubble'?.16:.65}/>}
      {['moustache','shortbeard'].includes(a.facialHair)&&<path d="M85 124Q94 118 100 122Q106 118 115 124" stroke={a.naturalHair} fill="none" strokeWidth="3.5"/>}
      {Number(rider.age)>29&&<path d="M66 72Q76 68 85 72M114 72Q124 68 134 72M68 97l-6 2M132 97l6 2" fill="none" stroke="#72503c" opacity={Math.min(.35,(Number(rider.age)-29)*.03)}/>}
      {a.hairStyle!=='bald'&&<g>
        <path d={`M${100-side-5} 85 Q44 29 100 ${top-8} Q158 25 ${100+side+5} 87 L138 ${64-hairline} Q101 ${74-hairline} 62 ${64-hairline}Z`} fill={`url(#${id}h)`}/>
        {fringe&&<path d={fringe} fill={`url(#${id}h)`}/>}
        {a.hairStyle==='buzz'&&<path d={`M${100-side-5} 85 Q44 29 100 ${top-8} Q158 25 ${100+side+5} 87 L138 64 Q101 74 62 64Z`} fill={a.skin} opacity=".45"/>}
        {['curly','afro'].includes(a.hairStyle)&&Array.from({length:10},(_,i)=><circle key={i} cx={57+i*9.4} cy={49-Math.sin(i/9*Math.PI)*(a.hairStyle==='afro'?22:10)} r={a.hairStyle==='afro'?13:9} fill={hair}/>)}
        {a.hairStyle==='bun'&&<circle cx="139" cy="50" r="15" fill={hair}/>}
        {a.hairStyle==='ponytail'&&<path d="M143 62Q177 70 151 145Q160 100 140 86Z" fill={hair}/>}
        {a.hairStyle==='braid'&&Array.from({length:8},(_,i)=><ellipse key={i} cx={146+i*.4} cy={83+i*10} rx="6" ry="8" fill={hair}/>)}
        <g clipPath={`url(#${id}hair)`} opacity=".18">{Array.from({length:9},(_,i)=><path key={i} d={`M${58+i*10} 32q${a.hairTexture==='straight'?0:12} 12 -8 40`} stroke="#fff" fill="none"/>)}</g>
        {a.dye&&a.dye.placement!=='full'&&<g clipPath={`url(#${id}hair)`}><path d={a.dye.placement==='tips'?'M48 66Q100 85 151 65':a.dye.placement==='roots'?'M80 29L100 48':'M113 27Q100 46 116 71'} stroke={a.dye.color} strokeWidth="8" fill="none" opacity=".85"/></g>}
      </g>}
      {a.jewelry&&[-1,1].filter(d=>a.jewelry.side==='both'||a.jewelry.side===(d===-1?'left':'right')).map(d=>a.jewelry.kind==='nose-stud'?<circle key={d} cx={100+d*6} cy={97+a.noseLength} r="1.6" fill={a.jewelry.metal}/>:a.jewelry.kind==='hoop'?<ellipse key={d} cx={100+d*46} cy="109" rx="3" ry="5" fill="none" stroke={a.jewelry.metal} strokeWidth="2"/>:<circle key={d} cx={100+d*46} cy="108" r="2" fill={a.jewelry.metal}/>)}
    </g>
  </svg>;
}

export default function RiderAvatar({rider,size=76}) {
  const [failedPath,setFailedPath]=useState(null);
  // Only reviewed local assets; no arbitrary remote tracking URLs or SVG uploads.
  const path=/^\/portraits\/[a-zA-Z0-9_-]+\.(png|webp)$/.test(rider?.portrait_path||'')?rider.portrait_path:null;
  return <div className="rider-avatar" role="img" aria-label={`Portrait of ${rider?.display_name||rider?.name||'rider'}`} style={{width:size,height:size,flexShrink:0,borderRadius:12,overflow:'hidden',background:'#eee9df',border:'1px solid #dadfd6'}}>
    {path&&failedPath!==path?<img src={path} alt="" width={size} height={size} onError={()=>setFailedPath(path)} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<RiderArt rider={rider}/>}
  </div>;
}
