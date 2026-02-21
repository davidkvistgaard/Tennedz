"use client";

import seedrandom from "seedrandom";

/**
 * Pelotonia 2.5D sprite-stack avatar – Daylight edition
 * - Built for light UI (road/green)
 * - Softer shadows, more skin, less “mask”
 * - No glasses
 */

function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)]; }
function pickW(rng, items){
  const sum = items.reduce((s,x)=>s+x.w,0);
  let r = rng()*sum;
  for(const it of items){ r-=it.w; if(r<=0) return it.v; }
  return items[items.length-1].v;
}
function rarityTier(rng){
  const x = rng();
  if(x<0.50) return 0;
  if(x<0.80) return 1;
  if(x<0.95) return 2;
  return 3;
}
function svgToDataUri(svg){ return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`; }

const SKIN = [
  "#F6D2B8","#F1C7AA","#E8B894","#DDAA84","#D09C76",
  "#C38E6B","#B97E5F","#AA7254","#9C664A","#8D5A3F",
  "#7E4F36","#6F452E","#603B27","#523222","#452B1E",
];

const HAIR = [
  { v:"#1b1b1f", w:28 }, { v:"#2a1f1a", w:22 }, { v:"#3b2a1f", w:18 },
  { v:"#5a3c2a", w:10 }, { v:"#7b5a32", w:7 },  { v:"#c6a15a", w:6 },
  { v:"#8b3a2b", w:6 },  { v:"#e7d9c0", w:1.4 },
  { v:"#2f66ff", w:0.6 },{ v:"#ff4fa6", w:0.5 },{ v:"#19c37d", w:0.4 },
];
function normalizeHair(rng, tier, c){
  const bold = ["#2f66ff","#ff4fa6","#19c37d"];
  if(!bold.includes(c)) return c;
  const p = tier===3?0.25:tier===2?0.08:0.02;
  return rng()<p?c:"#3b2a1f";
}

function layerBust({ jerseyA, jerseyB, accent }){
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <defs>
    <linearGradient id="j" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${jerseyA}"/>
      <stop offset="1" stop-color="${jerseyB}"/>
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="30%" r="85%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="60%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.10"/>
    </radialGradient>
  </defs>

  <path d="M16 154 C28 118, 52 104, 80 104 C108 104, 132 118, 144 154 Z" fill="url(#j)" opacity="0.98"/>
  <path d="M58 106 C64 92, 96 92, 102 106 C96 116, 64 116, 58 106 Z" fill="#0f172a" opacity="0.55"/>
  <path d="M61 106 C66 98, 94 98, 99 106 C94 112, 66 112, 61 106 Z" fill="#ffffff" opacity="0.08"/>
  <path d="M20 142 C40 116, 58 112, 80 112 C102 112, 120 116, 140 142"
        stroke="${accent}" stroke-width="6" stroke-linecap="round" opacity="0.70"/>
  <ellipse cx="78" cy="122" rx="70" ry="44" fill="url(#glow)"/>
</svg>`;
}

function layerHead({ skin, faceVariant }){
  // two head shapes for variation
  const headPath = faceVariant===0
  ? `M80 24 C58 24, 46 40, 46 62 C46 90, 58 106, 80 110 C102 106, 114 90, 114 62 C114 40, 102 24, 80 24 Z`
  : `M80 24 C60 24, 44 42, 46 66 C48 92, 62 108, 80 112 C98 108, 112 92, 114 66 C116 42, 100 24, 80 24 Z`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <defs>
    <radialGradient id="s" cx="28%" cy="22%" r="85%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="38%" stop-color="${skin}" stop-opacity="1"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.12"/>
    </radialGradient>
  </defs>

  <path d="M62 108 C66 126, 94 126, 98 108 L98 128 C92 140, 68 140, 62 128 Z" fill="url(#s)"/>
  <path d="${headPath}" fill="url(#s)"/>

  <!-- softer shaping -->
  <path d="M54 78 C58 98, 68 108, 80 110 C92 108, 102 98, 106 78" fill="#000" opacity="0.05"/>
  <path d="M56 42 C52 50, 50 58, 50 70 C50 92, 62 106, 80 110" stroke="#fff" stroke-opacity="0.07" stroke-width="6" stroke-linecap="round"/>
</svg>`;
}

function layerEyes({ variant, iris }){
  const presets = [
    {rx:12, ry:9, tilt:-6, lid:0.30},
    {rx:13, ry:10, tilt:0,  lid:0.18},
    {rx:11, ry:8, tilt:6,  lid:0.34},
    {rx:14, ry:10, tilt:-2, lid:0.14},
    {rx:10, ry:7, tilt:8,  lid:0.38},
    {rx:12, ry:9, tilt:2,  lid:0.22},
  ];
  const p = presets[variant%presets.length];
  const irisColor = iris;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  ${[-18,18].map(dx=>`
    <g transform="rotate(${p.tilt} ${80+dx} 64)">
      <ellipse cx="${80+dx}" cy="64" rx="${p.rx}" ry="${p.ry}" fill="#fff" opacity="0.98"/>
      <circle cx="${80+dx}" cy="64" r="${Math.max(4,p.ry-2)}" fill="${irisColor}" opacity="0.95"/>
      <circle cx="${80+dx}" cy="64" r="${Math.max(2.2,p.ry-5)}" fill="#0B0B0F"/>
      <circle cx="${80+dx-3}" cy="61" r="2.2" fill="#fff" opacity="0.90"/>
      <path d="M ${80+dx-p.rx} 63
               C ${80+dx-4} ${64-p.ry*(0.9+p.lid)},
                 ${80+dx+4} ${64-p.ry*(0.9+p.lid)},
                 ${80+dx+p.rx} 63"
            stroke="#0f172a" stroke-width="2" opacity="0.26" fill="none" stroke-linecap="round"/>
    </g>
  `).join("")}
</svg>`;
}

function layerBrows({ variant }){
  const presets = [
    {t:4,a:-10,arch:2},{t:3,a:-4,arch:1},{t:3,a:6,arch:1},
    {t:5,a:-14,arch:3},{t:2,a:2,arch:0},{t:4,a:8,arch:2},
  ];
  const p = presets[variant%presets.length];
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  ${[-18,18].map(dx=>{
    const x=80+dx, y=52, ang=(dx<0?1:-1)*p.a;
    return `
      <g transform="rotate(${ang} ${x} ${y})">
        <path d="M ${x-14} ${y} C ${x-4} ${y-p.arch}, ${x+4} ${y-p.arch}, ${x+14} ${y}"
              stroke="#0f172a" stroke-width="${p.t}" stroke-linecap="round" opacity="0.78" fill="none"/>
      </g>`;
  }).join("")}
</svg>`;
}

function layerNose({ variant }){
  const presets = [
    {w:12,l:18,op:0.08},{w:10,l:16,op:0.08},{w:13,l:20,op:0.09},
    {w:11,l:18,op:0.07},{w:14,l:18,op:0.10},{w:10,l:20,op:0.07},
  ];
  const p = presets[variant%presets.length];
  const nx=80, ny=80;
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <path d="M ${nx} ${ny-p.l/2}
           C ${nx+p.w/2} ${ny-2}, ${nx+p.w/3} ${ny+p.l/2}, ${nx} ${ny+p.l/2}
           C ${nx-p.w/3} ${ny+p.l/2}, ${nx-p.w/2} ${ny-2}, ${nx} ${ny-p.l/2} Z"
        fill="#0f172a" opacity="${p.op}"/>
  <path d="M ${nx-6} ${ny+p.l/2-2} C ${nx-2} ${ny+p.l/2+2}, ${nx+2} ${ny+p.l/2+2}, ${nx+6} ${ny+p.l/2-2}"
        stroke="#0f172a" stroke-width="2" opacity="0.18" fill="none" stroke-linecap="round"/>
</svg>`;
}

function layerMouth({ variant }){
  const moods=["neutral","focus","slightSmile","tight","neutral","focus"];
  const mood=moods[variant%6];
  const x=80,y=100,w=[20,22,18,24,20,22][variant%6];
  const L=x-w/2,R=x+w/2;
  const d = mood==="slightSmile"
    ? `M ${L} ${y} C ${x-w*0.2} ${y+4}, ${x+w*0.2} ${y+4}, ${R} ${y}`
    : mood==="tight"
    ? `M ${L} ${y} L ${R} ${y}`
    : mood==="focus"
    ? `M ${L} ${y} C ${x-w*0.2} ${y+2}, ${x+w*0.2} ${y+1}, ${R} ${y}`
    : `M ${L} ${y} C ${x-w*0.2} ${y+1}, ${x+w*0.2} ${y+1}, ${R} ${y}`;
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <path d="${d}" stroke="#0f172a" stroke-width="3" opacity="0.46" fill="none" stroke-linecap="round"/>
</svg>`;
}

function layerHair({ style, hairColor }){
  const shapes={
    bald:``,
    buzz:`<path d="M50 46 C56 34, 72 28, 80 28 C96 28, 110 38, 110 54
                 C104 50, 96 48, 80 48 C64 48, 56 50, 50 46 Z"/>`,
    fade:`<path d="M48 54 C52 36, 68 28, 80 28 C98 28, 114 40, 112 60
                 C102 52, 96 50, 80 50 C64 50, 56 52, 48 54 Z"/>`,
    classic:`<path d="M46 60 C46 36, 66 26, 80 26 C98 26, 116 40, 112 66
                    C102 56, 96 52, 80 52 C64 52, 56 56, 46 60 Z"/>
              <path d="M60 46 C64 36, 74 34, 84 38 C74 40, 66 44, 60 46 Z" opacity="0.5"/>`,
    curly:`<path d="M44 66 C44 38, 66 24, 80 24 C100 24, 118 42, 114 74
                    C102 60, 96 56, 80 56 C64 56, 56 60, 44 66 Z"/>
            <path d="M50 56 C56 44, 66 44, 70 52 C62 52, 56 54, 50 56 Z" opacity="0.5"/>
            <path d="M90 50 C96 40, 108 44, 110 58 C104 54, 98 52, 90 50 Z" opacity="0.5"/>`,
    afro:`<path d="M44 70 C44 40, 66 22, 80 22 C104 22, 120 44, 114 82
                  C104 64, 96 58, 80 58 C64 58, 56 64, 44 70 Z"/>`,
    bob:`<path d="M46 66 C46 38, 66 24, 80 24 C100 24, 116 42, 112 72
                 C110 90, 96 96, 80 96 C64 96, 50 90, 48 74 Z"/>`,
    medium:`<path d="M44 70 C44 38, 64 22, 80 22 C102 22, 120 44, 114 82
                 C110 110, 96 120, 80 120 C64 120, 50 110, 46 84 Z"/>`,
    long:`<path d="M42 72 C42 38, 64 20, 80 20 C104 20, 122 44, 114 86
                 C108 132, 96 146, 80 146 C64 146, 52 132, 46 88 Z"/>`,
    ponytail:`<path d="M44 70 C44 38, 64 22, 80 22 C102 22, 120 44, 114 82
                 C110 102, 98 112, 80 112 C62 112, 50 102, 46 84 Z"/>
              <path d="M114 90 C132 102, 126 134, 110 146 C98 132, 112 110, 114 90 Z" opacity="0.9"/>`,
    bun:`<path d="M46 66 C46 38, 66 24, 80 24 C100 24, 116 42, 112 72
                 C110 92, 96 102, 80 102 C64 102, 50 92, 48 74 Z"/>
          <path d="M112 88 C126 88, 126 106, 112 106 C100 106, 100 88, 112 88 Z" opacity="0.95"/>`,
    braid:`<path d="M44 70 C44 38, 64 22, 80 22 C102 22, 120 44, 114 82
                 C110 104, 96 112, 80 112 C62 112, 50 104, 46 84 Z"/>
            <path d="M108 92 C124 104, 112 132, 96 140 C92 122, 104 112, 108 92 Z" opacity="0.92"/>`,
    mohawk:`<path d="M76 26 C80 10, 84 10, 88 26 L94 86 C88 82, 76 82, 70 86 Z"/>`,
  };
  const inner=shapes[style] ?? shapes.classic;
  if(!inner) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"></svg>`;
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <defs>
    <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="40%" stop-color="${hairColor}" stop-opacity="1"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.18"/>
    </linearGradient>
  </defs>
  <g fill="url(#hg)">${inner}</g>
</svg>`;
}

function layerDetails({ freckles, scar, gender, facialHair }){
  const frecklesSvg = freckles ? `
    <g fill="#0f172a" opacity="0.08">
      <circle cx="64" cy="82" r="1.1"/><circle cx="68" cy="84" r="1.0"/><circle cx="72" cy="83" r="1.1"/>
      <circle cx="96" cy="82" r="1.1"/><circle cx="92" cy="84" r="1.0"/><circle cx="88" cy="83" r="1.1"/>
    </g>` : "";

  const scarSvg = scar ? `<path d="M 102 62 L 116 70" stroke="#0f172a" stroke-width="2.2" opacity="0.18" stroke-linecap="round"/>` : "";

  const facialHairSvg =
    gender==="M" && facialHair!=="none"
      ? (() => {
          const op = facialHair==="stubble" ? 0.08 : facialHair==="moustache" ? 0.15 : 0.12;
          const moustache = (facialHair==="moustache" || facialHair==="shortbeard")
            ? `<path d="M 66 92 C 72 86, 88 86, 94 92" stroke="#0f172a" stroke-width="6" opacity="${op}" stroke-linecap="round"/>`
            : "";
          const beard = (facialHair==="stubble" || facialHair==="shortbeard")
            ? `<path d="M 56 102 C 62 118, 98 118, 104 102" stroke="#0f172a" stroke-width="${facialHair==="stubble"?8:10}" opacity="${op}" stroke-linecap="round"/>`
            : "";
          return `<g>${moustache}${beard}</g>`;
        })()
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">${frecklesSvg}${scarSvg}${facialHairSvg}</svg>`;
}

function config(rider){
  const seed = rider?.id || rider?.name || "seed";
  const gender = rider?.gender || "M";
  const rng = seedrandom(String(seed));
  const tier = rarityTier(rng);

  const skin = pick(rng, SKIN);
  const faceVariant = pick(rng, [0,1]);

  const eyeVariant = pickW(rng, [
    {v:0,w:18},{v:1,w:22},{v:2,w:16},{v:3,w:22},{v:4,w:12},{v:5,w:10},
  ]);
  const iris = pickW(rng, [
    {v:"#111827",w:45},{v:"#3b82f6",w:18},{v:"#10b981",w:18},{v:"#d97706",w:12},{v:"#a855f7",w:7},
  ]);

  const browVariant = pick(rng, [0,1,2,3,4,5]);
  const noseVariant = pick(rng, [0,1,2,3,4,5]);
  const mouthVariant = pick(rng, [0,1,2,3,4,5]);

  const freckles = rng() < (tier===0?0.10:tier===1?0.16:0.20);
  const scar = rng() < (tier<2?0.06:0.12);

  const maleHair = [
    {v:"bald",w:6},{v:"buzz",w:18},{v:"fade",w:18},{v:"classic",w:22},{v:"curly",w:14},{v:"afro",w:6},
    {v:"medium",w:10},{v:"long",w:4},{v:"mohawk",w:tier===3?6:0.8},
  ];
  const femaleHair = [
    {v:"buzz",w:4},{v:"fade",w:6},{v:"classic",w:8},{v:"bob",w:10},{v:"medium",w:18},{v:"long",w:18},
    {v:"ponytail",w:12},{v:"bun",w:7},{v:"braid",w:7},{v:"curly",w:10},{v:"afro",w:6},{v:"mohawk",w:tier===3?6:0.8},
  ];
  const hairStyle = pickW(rng, gender==="F"?femaleHair:maleHair);

  let hairColor = pickW(rng, HAIR);
  hairColor = normalizeHair(rng, tier, hairColor);

  const facialHair = gender==="M"
    ? pickW(rng, [{v:"none",w:60},{v:"stubble",w:22},{v:"shortbeard",w:12},{v:"moustache",w:6}])
    : "none";

  // “Road & Green” jerseys: lighter than before so portraits pop
  const jersey = pickW(rng, [
    {v:["#ffffff","#E9EFEA","#1FAF5A"], w:22},
    {v:["#F8FAFC","#E6E9EF","#2B2F36"], w:18},
    {v:["#ffffff","#EEF2FF","#1E88E5"], w:16},
    {v:["#ffffff","#FFF7CC","#FFD600"], w:14},
    {v:["#ffffff","#FFE3E3","#E10600"], w:12},
  ]);

  return {
    seed, gender, tier,
    skin, faceVariant,
    eyeVariant, iris,
    browVariant, noseVariant, mouthVariant,
    freckles, scar,
    hairStyle, hairColor,
    facialHair,
    jerseyA: jersey[0], jerseyB: jersey[1], accent: jersey[2],
  };
}

export default function RiderAvatar({ rider, size=76 }){
  const c = config(rider);

  const layers = [
    svgToDataUri(layerBust({ jerseyA:c.jerseyA, jerseyB:c.jerseyB, accent:c.accent })),
    svgToDataUri(layerHead({ skin:c.skin, faceVariant:c.faceVariant })),
    svgToDataUri(layerHair({ style:c.hairStyle, hairColor:c.hairColor })),
    svgToDataUri(layerBrows({ variant:c.browVariant })),
    svgToDataUri(layerEyes({ variant:c.eyeVariant, iris:c.iris })),
    svgToDataUri(layerNose({ variant:c.noseVariant })),
    svgToDataUri(layerMouth({ variant:c.mouthVariant })),
    svgToDataUri(layerDetails({ freckles:c.freckles, scar:c.scar, gender:c.gender, facialHair:c.facialHair })),
  ];

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        borderRadius: 14,
        overflow: "hidden",
        background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.95), rgba(241,243,240,0.95))",
        border: "1px solid rgba(17,24,39,0.10)",
        boxShadow: "0 10px 18px rgba(15,23,42,0.08)",
      }}
    >
      {layers.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          draggable={false}
          style={{ position:"absolute", inset:0, width:"100%", height:"100%" }}
        />
      ))}
    </div>
  );
}
