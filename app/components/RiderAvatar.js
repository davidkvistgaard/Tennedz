"use client";

import seedrandom from "seedrandom";

/**
 * Pelotonia 2.5D sprite-stack avatar
 * - Uses layered SVG sprites (as data URIs)
 * - Deterministic per rider.id
 * - Gender parity: separate hair pools + face variation
 * - No glasses
 * - "Most normal" distribution
 */

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pickWeighted(rng, items) {
  // items: [{v, w}]
  const sum = items.reduce((s, x) => s + x.w, 0);
  let x = rng() * sum;
  for (const it of items) {
    x -= it.w;
    if (x <= 0) return it.v;
  }
  return items[items.length - 1].v;
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// 50% normal, 30% subtle, 15% distinctive, 5% iconic
function rarityTier(rng) {
  const x = rng();
  if (x < 0.50) return 0;
  if (x < 0.80) return 1;
  if (x < 0.95) return 2;
  return 3;
}

function svgToDataUri(svg) {
  // utf8 is fine for modern browsers
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SKIN_TONES = [
  "#F6D2B8","#F1C7AA","#E8B894","#DDAA84","#D09C76",
  "#C38E6B","#B97E5F","#AA7254","#9C664A","#8D5A3F",
  "#7E4F36","#6F452E","#603B27","#523222","#452B1E",
];

const HAIR_COLORS = [
  { v: "#1b1b1f", w: 28 }, // black
  { v: "#2a1f1a", w: 22 }, // dark brown
  { v: "#3b2a1f", w: 18 }, // brown
  { v: "#5a3c2a", w: 10 }, // light brown
  { v: "#7b5a32", w: 7 },  // dark blonde
  { v: "#c6a15a", w: 6 },  // blonde
  { v: "#8b3a2b", w: 6 },  // red
  // rare “iconic” colors (only if tier high)
  { v: "#e7d9c0", w: 1.4 }, // platinum
  { v: "#2f66ff", w: 0.6 }, // blue
  { v: "#ff4fa6", w: 0.5 }, // pink
  { v: "#19c37d", w: 0.4 }, // green
];

function normalizeHairColor(rng, tier, color) {
  const bold = ["#2f66ff", "#ff4fa6", "#19c37d"];
  if (!bold.includes(color)) return color;
  const boldChance = tier === 3 ? 0.25 : tier === 2 ? 0.08 : 0.02;
  return rng() < boldChance ? color : "#3b2a1f";
}

/**
 * ---------- SPRITE LAYERS (SVG) ----------
 * Each layer returns an SVG string with transparent background.
 * We'll stack them inside a fixed box.
 *
 * Design goal:
 * - 2.5D shading: highlight top-left, shadow bottom-right
 * - Bust + jersey collar (pro look)
 * - Eyes carry personality
 * - No glasses
 */

function layerBust({ jerseyA, jerseyB, accent }) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <defs>
    <linearGradient id="j" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${jerseyA}"/>
      <stop offset="1" stop-color="${jerseyB}"/>
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="25%" r="80%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.22"/>
    </radialGradient>
  </defs>

  <!-- shoulders -->
  <path d="M18 152 C28 118, 52 102, 80 102 C108 102, 132 118, 142 152 Z" fill="url(#j)" opacity="0.98"/>
  <!-- collar -->
  <path d="M58 104 C64 92, 96 92, 102 104 C96 114, 64 114, 58 104 Z" fill="#0b0f17" opacity="0.65"/>
  <path d="M61 104 C66 96, 94 96, 99 104 C94 111, 66 111, 61 104 Z" fill="#ffffff" opacity="0.06"/>

  <!-- accent stripe -->
  <path d="M20 140 C40 114, 58 110, 80 110 C102 110, 120 114, 140 140"
        stroke="${accent}" stroke-width="6" stroke-linecap="round" opacity="0.75"/>

  <!-- subtle glow -->
  <ellipse cx="70" cy="118" rx="64" ry="44" fill="url(#glow)"/>
</svg>`;
}

function layerHeadBase({ skin }) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <defs>
    <radialGradient id="s" cx="28%" cy="22%" r="80%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="35%" stop-color="${skin}" stop-opacity="1"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.22"/>
    </radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.18"/>
    </linearGradient>
  </defs>

  <!-- neck -->
  <path d="M62 106 C66 126, 94 126, 98 106 L98 126 C92 140, 68 140, 62 126 Z"
        fill="url(#s)"/>

  <!-- head -->
  <path d="M80 24
           C58 24, 46 40, 46 60
           C46 88, 58 104, 80 108
           C102 104, 114 88, 114 60
           C114 40, 102 24, 80 24 Z"
        fill="url(#s)"/>

  <!-- rim light -->
  <path d="M56 36 C50 44, 48 52, 48 64 C48 90, 60 103, 80 107"
        stroke="#fff" stroke-opacity="0.08" stroke-width="6" stroke-linecap="round"/>

  <!-- jaw shadow -->
  <path d="M54 76 C58 98, 68 106, 80 108 C92 106, 102 98, 106 76"
        fill="#000" opacity="0.08"/>

  <!-- cheek highlights -->
  <path d="M54 70 C60 62, 66 58, 72 58" stroke="#fff" stroke-opacity="0.06" stroke-width="4" stroke-linecap="round"/>
  <path d="M106 70 C100 62, 94 58, 88 58" stroke="#000" stroke-opacity="0.05" stroke-width="4" stroke-linecap="round"/>
</svg>`;
}

function layerEyes({ variant, iris }) {
  // 6 eye variants for now (easy to expand)
  const v = variant;
  const irisColor = iris;

  const shapes = {
    0: { rx: 12, ry: 9, tilt: -6, lid: 0.35 },
    1: { rx: 13, ry: 10, tilt: 0, lid: 0.22 },
    2: { rx: 11, ry: 8, tilt: 6, lid: 0.40 },
    3: { rx: 14, ry: 10, tilt: -2, lid: 0.18 },
    4: { rx: 10, ry: 7, tilt: 8, lid: 0.45 },
    5: { rx: 12, ry: 9, tilt: 2, lid: 0.28 },
  }[v] || { rx: 12, ry: 9, tilt: 0, lid: 0.25 };

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <g transform="translate(0,0)">
    ${[-18, 18].map((dx, i) => `
      <g transform="rotate(${shapes.tilt} ${80 + dx} 64)">
        <ellipse cx="${80 + dx}" cy="64" rx="${shapes.rx}" ry="${shapes.ry}" fill="#F9FAFB" opacity="0.98"/>
        <circle cx="${80 + dx}" cy="64" r="${Math.max(4, shapes.ry - 2)}" fill="${irisColor}" opacity="0.95"/>
        <circle cx="${80 + dx}" cy="64" r="${Math.max(2.2, shapes.ry - 5)}" fill="#0B0B0F"/>
        <circle cx="${80 + dx - 3}" cy="61" r="2.2" fill="#fff" opacity="0.9"/>
        <!-- upper lid -->
        <path d="M ${80 + dx - shapes.rx} 63
                 C ${80 + dx - 4} ${64 - shapes.ry * (0.9 + shapes.lid)},
                   ${80 + dx + 4} ${64 - shapes.ry * (0.9 + shapes.lid)},
                   ${80 + dx + shapes.rx} 63"
              stroke="#0b0f17" stroke-width="2" opacity="0.34" fill="none" stroke-linecap="round"/>
      </g>
    `).join("")}
  </g>
</svg>`;
}

function layerBrows({ variant }) {
  const presets = [
    { t: 4, a: -10, arch: 2 }, // strong
    { t: 3, a: -4, arch: 1 },  // neutral
    { t: 3, a: 6, arch: 1 },   // open
    { t: 5, a: -14, arch: 3 }, // aggressive
    { t: 2, a: 2, arch: 0 },   // soft
    { t: 4, a: 8, arch: 2 },   // surprised-ish
  ];
  const p = presets[variant % presets.length];

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  ${[-18, 18].map((dx, i) => {
    const x = 80 + dx;
    const y = 52;
    const ang = (dx < 0 ? 1 : -1) * p.a;
    return `
      <g transform="rotate(${ang} ${x} ${y})">
        <path d="M ${x-14} ${y} C ${x-4} ${y - p.arch}, ${x+4} ${y - p.arch}, ${x+14} ${y}"
              stroke="#0b0f17" stroke-width="${p.t}" stroke-linecap="round" opacity="0.86" fill="none"/>
      </g>
    `;
  }).join("")}
</svg>`;
}

function layerNose({ variant }) {
  const presets = [
    { w: 12, l: 18, op: 0.10 },
    { w: 10, l: 16, op: 0.10 },
    { w: 13, l: 20, op: 0.11 },
    { w: 11, l: 18, op: 0.09 },
    { w: 14, l: 18, op: 0.12 },
    { w: 10, l: 20, op: 0.09 },
  ];
  const p = presets[variant % presets.length];
  const nx = 80;
  const ny = 80;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <path d="M ${nx} ${ny - p.l/2}
           C ${nx + p.w/2} ${ny - 2}, ${nx + p.w/3} ${ny + p.l/2}, ${nx} ${ny + p.l/2}
           C ${nx - p.w/3} ${ny + p.l/2}, ${nx - p.w/2} ${ny - 2}, ${nx} ${ny - p.l/2} Z"
        fill="#000" opacity="${p.op}"/>
  <path d="M ${nx - 6} ${ny + p.l/2 - 2} C ${nx - 2} ${ny + p.l/2 + 2}, ${nx + 2} ${ny + p.l/2 + 2}, ${nx + 6} ${ny + p.l/2 - 2}"
        stroke="#0b0f17" stroke-width="2" opacity="0.24" fill="none" stroke-linecap="round"/>
</svg>`;
}

function layerMouth({ variant }) {
  const moods = ["neutral", "focus", "slightSmile", "tight", "neutral", "focus"];
  const mood = moods[variant % moods.length];
  const x = 80;
  const y = 100;
  const w = [20, 22, 18, 24, 20, 22][variant % 6];
  const left = x - w / 2;
  const right = x + w / 2;

  const path =
    mood === "slightSmile"
      ? `M ${left} ${y} C ${x - w*0.2} ${y+4}, ${x + w*0.2} ${y+4}, ${right} ${y}`
      : mood === "tight"
      ? `M ${left} ${y} L ${right} ${y}`
      : mood === "focus"
      ? `M ${left} ${y} C ${x - w*0.2} ${y+2}, ${x + w*0.2} ${y+1}, ${right} ${y}`
      : `M ${left} ${y} C ${x - w*0.2} ${y+1}, ${x + w*0.2} ${y+1}, ${right} ${y}`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <path d="${path}" stroke="#0b0f17" stroke-width="3" opacity="0.55" fill="none" stroke-linecap="round"/>
</svg>`;
}

function layerHair({ style, hairColor }) {
  // Hair “sprite” shapes. Expandable.
  // These are meant to feel more 2.5D via gradient.
  const shapes = {
    bald: ``,
    buzz: `<path d="M50 46 C56 34, 72 28, 80 28 C96 28, 110 38, 110 54
                 C104 50, 96 48, 80 48 C64 48, 56 50, 50 46 Z"/>`,
    fade: `<path d="M48 54 C52 36, 68 28, 80 28 C98 28, 114 40, 112 60
                 C102 52, 96 50, 80 50 C64 50, 56 52, 48 54 Z"/>`,
    classic: `<path d="M46 60 C46 36, 66 26, 80 26 C98 26, 116 40, 112 66
                    C102 56, 96 52, 80 52 C64 52, 56 56, 46 60 Z"/>
              <path d="M60 46 C64 36, 74 34, 84 38 C74 40, 66 44, 60 46 Z" opacity="0.55"/>`,
    curly: `<path d="M44 66 C44 38, 66 24, 80 24 C100 24, 118 42, 114 74
                    C102 60, 96 56, 80 56 C64 56, 56 60, 44 66 Z"/>
            <path d="M50 56 C56 44, 66 44, 70 52 C62 52, 56 54, 50 56 Z" opacity="0.55"/>
            <path d="M90 50 C96 40, 108 44, 110 58 C104 54, 98 52, 90 50 Z" opacity="0.55"/>`,
    afro: `<path d="M44 70 C44 40, 66 22, 80 22 C104 22, 120 44, 114 82
                  C104 64, 96 58, 80 58 C64 58, 56 64, 44 70 Z"/>`,
    bob: `<path d="M46 66 C46 38, 66 24, 80 24 C100 24, 116 42, 112 72
                 C110 90, 96 96, 80 96 C64 96, 50 90, 48 74 Z"/>`,
    medium: `<path d="M44 70 C44 38, 64 22, 80 22 C102 22, 120 44, 114 82
                 C110 110, 96 120, 80 120 C64 120, 50 110, 46 84 Z"/>`,
    long: `<path d="M42 72 C42 38, 64 20, 80 20 C104 20, 122 44, 114 86
                 C108 132, 96 146, 80 146 C64 146, 52 132, 46 88 Z"/>`,
    ponytail: `<path d="M44 70 C44 38, 64 22, 80 22 C102 22, 120 44, 114 82
                 C110 102, 98 112, 80 112 C62 112, 50 102, 46 84 Z"/>
              <path d="M114 90 C132 102, 126 134, 110 146 C98 132, 112 110, 114 90 Z" opacity="0.9"/>`,
    bun: `<path d="M46 66 C46 38, 66 24, 80 24 C100 24, 116 42, 112 72
                 C110 92, 96 102, 80 102 C64 102, 50 92, 48 74 Z"/>
          <path d="M112 88 C126 88, 126 106, 112 106 C100 106, 100 88, 112 88 Z" opacity="0.95"/>`,
    braid: `<path d="M44 70 C44 38, 64 22, 80 22 C102 22, 120 44, 114 82
                 C110 104, 96 112, 80 112 C62 112, 50 104, 46 84 Z"/>
            <path d="M108 92 C124 104, 112 132, 96 140 C92 122, 104 112, 108 92 Z" opacity="0.92"/>`,
    mohawk: `<path d="M76 26 C80 10, 84 10, 88 26 L94 86 C88 82, 76 82, 70 86 Z"/>`,
  };

  const inner = shapes[style] ?? shapes.classic;
  if (!inner) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"></svg>`;
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <defs>
    <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.10"/>
      <stop offset="35%" stop-color="${hairColor}" stop-opacity="1"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.28"/>
    </linearGradient>
  </defs>
  <g fill="url(#hg)">
    ${inner}
  </g>
  <!-- subtle edge -->
  <g opacity="0.16" stroke="#000" stroke-width="2" fill="none">
    ${inner}
  </g>
</svg>`;
}

function layerDetails({ freckles, scar, gender, facialHair }) {
  const frecklesSvg = freckles
    ? `<g fill="#0b0f17" opacity="0.09">
         <circle cx="64" cy="82" r="1.1"/><circle cx="68" cy="84" r="1.0"/><circle cx="72" cy="83" r="1.1"/>
         <circle cx="96" cy="82" r="1.1"/><circle cx="92" cy="84" r="1.0"/><circle cx="88" cy="83" r="1.1"/>
       </g>`
    : "";

  const scarSvg = scar
    ? `<path d="M 102 62 L 116 70" stroke="#0b0f17" stroke-width="2.2" opacity="0.22" stroke-linecap="round"/>`
    : "";

  const facialHairSvg =
    gender === "M" && facialHair !== "none"
      ? (() => {
          const op = facialHair === "stubble" ? 0.11 : facialHair === "moustache" ? 0.20 : 0.17;
          const moustache =
            facialHair === "moustache" || facialHair === "shortbeard"
              ? `<path d="M 66 92 C 72 86, 88 86, 94 92" stroke="#0b0f17" stroke-width="6" opacity="${op}" stroke-linecap="round"/>`
              : "";
          const beard =
            facialHair === "stubble" || facialHair === "shortbeard"
              ? `<path d="M 56 102 C 62 118, 98 118, 104 102" stroke="#0b0f17" stroke-width="${facialHair === "stubble" ? 8 : 10}" opacity="${op}" stroke-linecap="round"/>`
              : "";
          return `<g>${moustache}${beard}</g>`;
        })()
      : "";

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  ${frecklesSvg}
  ${scarSvg}
  ${facialHairSvg}
</svg>`;
}

function generateAvatarConfig(rider) {
  const seed = rider?.id || rider?.name || "seed";
  const gender = rider?.gender || "M";
  const rng = seedrandom(String(seed));

  const tier = rarityTier(rng);
  const skin = pick(rng, SKIN_TONES);

  // eyes: 6 variants now, expand later
  const eyeVariant = pickWeighted(rng, [
    { v: 0, w: 18 }, { v: 1, w: 22 }, { v: 2, w: 16 }, { v: 3, w: 22 }, { v: 4, w: 12 }, { v: 5, w: 10 }
  ]);

  const iris = pickWeighted(rng, [
    { v: "#111827", w: 45 }, // brown/dark
    { v: "#3b82f6", w: 18 }, // blue
    { v: "#10b981", w: 18 }, // green
    { v: "#d97706", w: 12 }, // hazel
    { v: "#a855f7", w: 7 },  // rare violet-ish
  ]);

  const browVariant = pick(rng, [0,1,2,3,4,5]);
  const noseVariant = pick(rng, [0,1,2,3,4,5]);
  const mouthVariant = pick(rng, [0,1,2,3,4,5]);

  // details
  const freckles = rng() < (tier === 0 ? 0.10 : tier === 1 ? 0.16 : 0.20);
  const scar = rng() < (tier < 2 ? 0.06 : 0.12);

  // jersey colors (UI accent) – can later be per team
  const jerseyBase = pickWeighted(rng, [
    { v: ["#0f172a", "#111827", "#00E676"], w: 22 },  // dark + green accent
    { v: ["#111827", "#0b1220", "#FFD600"], w: 20 },  // dark + yellow
    { v: ["#111827", "#0b1220", "#E10600"], w: 18 },  // dark + red
    { v: ["#111827", "#0b1220", "#1E88E5"], w: 16 },  // dark + blue
    { v: ["#0b1220", "#111827", "#F9FAFB"], w: 10 },  // mono
    { v: ["#111827", "#1f2937", "#c6a24f"], w: 14 },  // gold-ish
  ]);

  // hair pools (equal richness)
  const maleHairPool = [
    { v: "bald", w: 6 },
    { v: "buzz", w: 18 },
    { v: "fade", w: 18 },
    { v: "classic", w: 22 },
    { v: "curly", w: 14 },
    { v: "afro", w: 6 },
    { v: "medium", w: 10 },
    { v: "long", w: 4 },
    { v: "mohawk", w: tier === 3 ? 6 : 0.8 },
  ];

  const femaleHairPool = [
    { v: "buzz", w: 4 },       // women can have short/buzz too
    { v: "fade", w: 6 },
    { v: "classic", w: 8 },
    { v: "bob", w: 10 },
    { v: "medium", w: 18 },
    { v: "long", w: 18 },
    { v: "ponytail", w: 12 },
    { v: "bun", w: 7 },
    { v: "braid", w: 7 },
    { v: "curly", w: 10 },
    { v: "afro", w: 6 },
    { v: "mohawk", w: tier === 3 ? 6 : 0.8 },
  ];

  const hairStyle = pickWeighted(rng, gender === "F" ? femaleHairPool : maleHairPool);

  let hairColor = pickWeighted(rng, HAIR_COLORS);
  hairColor = normalizeHairColor(rng, tier, hairColor);

  const facialHair =
    gender === "M"
      ? pickWeighted(rng, [
          { v: "none", w: 60 },
          { v: "stubble", w: 22 },
          { v: "shortbeard", w: 12 },
          { v: "moustache", w: 6 },
        ])
      : "none";

  return {
    seed,
    gender,
    tier,
    skin,
    eyeVariant,
    iris,
    browVariant,
    noseVariant,
    mouthVariant,
    freckles,
    scar,
    hairStyle,
    hairColor,
    facialHair,
    jerseyA: jerseyBase[0],
    jerseyB: jerseyBase[1],
    accent: jerseyBase[2],
  };
}

export default function RiderAvatar({ rider, size = 76 }) {
  const c = generateAvatarConfig(rider);

  // Build sprite stack as data URIs
  const layers = [
    svgToDataUri(layerBust({ jerseyA: c.jerseyA, jerseyB: c.jerseyB, accent: c.accent })),
    svgToDataUri(layerHeadBase({ skin: c.skin })),
    svgToDataUri(layerHair({ style: c.hairStyle, hairColor: c.hairColor })),
    svgToDataUri(layerBrows({ variant: c.browVariant })),
    svgToDataUri(layerEyes({ variant: c.eyeVariant, iris: c.iris })),
    svgToDataUri(layerNose({ variant: c.noseVariant })),
    svgToDataUri(layerMouth({ variant: c.mouthVariant })),
    svgToDataUri(layerDetails({ freckles: c.freckles, scar: c.scar, gender: c.gender, facialHair: c.facialHair })),
  ];

  const box = Math.max(48, size);

  return (
    <div
      style={{
        width: box,
        height: box,
        position: "relative",
        borderRadius: 14,
        overflow: "hidden",
        background: "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.10), rgba(0,0,0,0.65))",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
      }}
      aria-label="Rider avatar"
      title={`Avatar tier ${c.tier}`}
    >
      {layers.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            imageRendering: "auto",
            transform: "translateZ(0)",
          }}
        />
      ))}
    </div>
  );
}
