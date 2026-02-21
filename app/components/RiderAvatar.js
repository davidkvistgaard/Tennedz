// app/components/RiderAvatar.js
"use client";

import seedrandom from "seedrandom";

/**
 * Pelotonia 2.5D avatar generator (SVG)
 * - Deterministic per rider (seed = rider.id)
 * - Gender-specific option pools
 * - Weighted "mostly normal" distribution
 * - No glasses
 */

function pick(rng, items, weights = null) {
  if (!weights) return items[Math.floor(rng() * items.length)];
  const sum = weights.reduce((a, b) => a + b, 0);
  let x = rng() * sum;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x <= 0) return items[i];
  }
  return items[items.length - 1];
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// Weighted hair colors (natural-heavy, rare bold)
const HAIR_COLORS = [
  { k: "black", c: "#1b1b1f", w: 28 },
  { k: "darkbrown", c: "#2a1f1a", w: 22 },
  { k: "brown", c: "#3b2a1f", w: 18 },
  { k: "lightbrown", c: "#5a3c2a", w: 10 },
  { k: "darkblonde", c: "#7b5a32", w: 7 },
  { k: "blonde", c: "#c6a15a", w: 6 },
  { k: "red", c: "#8b3a2b", w: 6 },
  // rare bold (still plausible game-world)
  { k: "platinum", c: "#e7d9c0", w: 1.4 },
  { k: "blue", c: "#2f66ff", w: 0.6 },
  { k: "pink", c: "#ff4fa6", w: 0.5 },
  { k: "green", c: "#19c37d", w: 0.4 },
];

const SKIN_TONES = [
  "#F6D2B8","#F1C7AA","#E8B894","#DDAA84","#D09C76",
  "#C38E6B","#B97E5F","#AA7254","#9C664A","#8D5A3F",
  "#7E4F36","#6F452E","#603B27","#523222","#452B1E",
];

// “Most normal” distribution helper
function rarityTier(rng) {
  // 50% normal, 30% subtle, 15% distinctive, 5% iconic
  const x = rng();
  if (x < 0.50) return 0;
  if (x < 0.80) return 1;
  if (x < 0.95) return 2;
  return 3;
}

function genParams({ seed, gender }) {
  const rng = seedrandom(String(seed));

  const tier = rarityTier(rng);

  // Face geometry (subtle stylization)
  const faceW = pick(rng, [78, 80, 82, 84, 86], [1, 2, 3, 2, 1]);
  const faceH = pick(rng, [92, 94, 96, 98, 100], [1, 2, 3, 2, 1]);
  const jaw = pick(rng, [10, 12, 14, 16, 18], [1, 2, 3, 2, 1]); // corner radius-ish

  const skin = pick(rng, SKIN_TONES);

  // Eyes (the personality)
  const eyeSize = pick(rng, [10, 11, 12, 13], [1, 2, 3, 1]);
  const eyeTilt = pick(rng, [-8, -4, 0, 4, 8], [1, 2, 3, 2, 1]); // degrees
  const eyeGap = pick(rng, [18, 20, 22, 24], [1, 2, 3, 1]);
  const iris = pick(rng, ["#3b82f6", "#10b981", "#a855f7", "#d97706", "#111827"], [2, 2, 1.2, 1, 3]); // brown-ish is #111827
  const eyeLid = pick(rng, [0, 0.1, 0.2, 0.3], [3, 3, 2, 1]);

  // Brows
  const browThickness = pick(rng, [3, 4, 5], [2, 3, 1]);
  const browAngle = pick(rng, [-14, -8, -2, 4, 10], [1, 2, 3, 2, 1]);
  const browArch = pick(rng, [0, 1, 2, 3], [2, 3, 2, 1]);

  // Nose
  const noseLen = pick(rng, [14, 16, 18, 20], [1, 2, 3, 1]);
  const noseWidth = pick(rng, [10, 11, 12, 13], [1, 2, 3, 1]);

  // Mouth (subtle)
  const mouthW = pick(rng, [18, 20, 22, 24], [1, 2, 3, 1]);
  const mouthMood = pick(rng, ["neutral", "focus", "slightSmile", "tight"], [4, 3, 1.5, 1]);

  // Details
  const freckles = rng() < (tier === 0 ? 0.12 : tier === 1 ? 0.18 : 0.22);
  const scar = rng() < (tier < 2 ? 0.06 : 0.12);

  // Hair pools (gender-specific, equal variety)
  // Each style maps to a “shape” choice later.
  const hairStylesM = [
    { k: "bald", w: 6 },
    { k: "buzz", w: 18 },
    { k: "fade", w: 18 },
    { k: "classic", w: 22 },
    { k: "curly", w: 14 },
    { k: "afro", w: 6 },
    { k: "medium", w: 10 },
    { k: "long", w: 4 },
    { k: "mohawk", w: tier === 3 ? 6 : 0.8 }, // rare
  ];
  const hairStylesF = [
    { k: "pixie", w: 10 },
    { k: "shortSport", w: 14 },
    { k: "bob", w: 10 },
    { k: "medium", w: 18 },
    { k: "long", w: 18 },
    { k: "ponytail", w: 12 },
    { k: "bunLow", w: 7 },
    { k: "braid", w: 7 },
    { k: "curly", w: 10 },
    { k: "afro", w: 6 },
    { k: "mohawk", w: tier === 3 ? 6 : 0.8 }, // rare
  ];

  const pool = gender === "F" ? hairStylesF : hairStylesM;
  const hairStyle = pick(rng, pool.map(x => x.k), pool.map(x => x.w));

  const hc = pick(rng, HAIR_COLORS.map(x => x.c), HAIR_COLORS.map(x => x.w));
  // Rare bold colors should mostly appear at high tier
  const boldChance = tier === 3 ? 0.25 : tier === 2 ? 0.08 : 0.02;
  const hairColor = (hc === "#2f66ff" || hc === "#ff4fa6" || hc === "#19c37d") && rng() > boldChance
    ? "#3b2a1f"
    : hc;

  // Facial hair (men only)
  const facialHair = gender === "M"
    ? pick(rng, ["none", "stubble", "shortbeard", "moustache"], [60, 22, 12, 6])
    : "none";

  return {
    seed,
    gender,
    tier,
    faceW, faceH, jaw,
    skin,
    eyeSize, eyeTilt, eyeGap, iris, eyeLid,
    browThickness, browAngle, browArch,
    noseLen, noseWidth,
    mouthW, mouthMood,
    freckles, scar,
    hairStyle, hairColor,
    facialHair
  };
}

function mouthPath(mood, x, y, w) {
  const left = x - w / 2;
  const right = x + w / 2;
  if (mood === "slightSmile") {
    return `M ${left} ${y} C ${x - w*0.2} ${y+4}, ${x + w*0.2} ${y+4}, ${right} ${y}`;
  }
  if (mood === "tight") {
    return `M ${left} ${y} L ${right} ${y}`;
  }
  if (mood === "focus") {
    return `M ${left} ${y} C ${x - w*0.2} ${y+2}, ${x + w*0.2} ${y+1}, ${right} ${y}`;
  }
  return `M ${left} ${y} C ${x - w*0.2} ${y+1}, ${x + w*0.2} ${y+1}, ${right} ${y}`;
}

function hairShape(style, faceX, faceY, faceW, faceH) {
  // Returns path(s) for hair cap + optional extras.
  const top = faceY - faceH * 0.55;
  const left = faceX - faceW * 0.55;
  const right = faceX + faceW * 0.55;

  // Helper: rounded cap
  const cap = (height, bulge = 18) =>
    `M ${left} ${top+bulge}
     C ${faceX - faceW*0.45} ${top-height}, ${faceX + faceW*0.45} ${top-height}, ${right} ${top+bulge}
     L ${right} ${top+bulge+22}
     C ${faceX + faceW*0.30} ${top+bulge+10}, ${faceX - faceW*0.30} ${top+bulge+10}, ${left} ${top+bulge+22}
     Z`;

  if (style === "bald") return { cap: null, extra: null };
  if (style === "buzz") return { cap: cap(20, 10), extra: null };
  if (style === "fade") return { cap: cap(26, 12), extra: null };
  if (style === "classic") return { cap: cap(34, 14), extra: `M ${faceX-10} ${top+18} C ${faceX-22} ${top+28}, ${faceX-20} ${top+40}, ${faceX-4} ${top+46}` };
  if (style === "pixie") return { cap: cap(30, 12), extra: `M ${faceX+4} ${top+18} C ${faceX+18} ${top+28}, ${faceX+18} ${top+38}, ${faceX+2} ${top+46}` };
  if (style === "shortSport") return { cap: cap(28, 12), extra: null };
  if (style === "bob") return { cap: cap(36, 14), extra: `M ${left+4} ${top+44} C ${faceX-30} ${top+66}, ${faceX+30} ${top+66}, ${right-4} ${top+44}` };
  if (style === "medium") return { cap: cap(40, 14), extra: `M ${left+6} ${top+44} C ${faceX-40} ${top+92}, ${faceX+40} ${top+92}, ${right-6} ${top+44}` };
  if (style === "long") return { cap: cap(44, 14), extra: `M ${left+6} ${top+44} C ${faceX-50} ${top+118}, ${faceX+50} ${top+118}, ${right-6} ${top+44}` };
  if (style === "ponytail") return { cap: cap(38, 14), extra: `M ${right-10} ${top+52} C ${right+18} ${top+72}, ${right+8} ${top+108}, ${right-8} ${top+118} C ${right-26} ${top+106}, ${right-8} ${top+72}, ${right-10} ${top+52} Z` };
  if (style === "bunLow") return { cap: cap(36, 14), extra: `M ${faceX+34} ${top+84} C ${faceX+54} ${top+84}, ${faceX+54} ${top+106}, ${faceX+34} ${top+106} C ${faceX+18} ${top+106}, ${faceX+18} ${top+84}, ${faceX+34} ${top+84} Z` };
  if (style === "braid") return { cap: cap(38, 14), extra: `M ${faceX+28} ${top+54} C ${faceX+54} ${top+78}, ${faceX+40} ${top+112}, ${faceX+18} ${top+122} C ${faceX+12} ${top+104}, ${faceX+28} ${top+76}, ${faceX+28} ${top+54} Z` };
  if (style === "curly") return { cap: cap(44, 16), extra: `M ${left+10} ${top+40} C ${faceX-34} ${top+26}, ${faceX-18} ${top+16}, ${faceX-4} ${top+30} C ${faceX+6} ${top+18}, ${faceX+24} ${top+22}, ${right-10} ${top+40}` };
  if (style === "afro") return { cap: cap(52, 20), extra: `M ${left+12} ${top+42} C ${faceX-48} ${top-10}, ${faceX+48} ${top-10}, ${right-12} ${top+42}` };
  if (style === "mohawk") return {
    cap: `M ${faceX-10} ${top+10} C ${faceX-2} ${top-30}, ${faceX+2} ${top-30}, ${faceX+10} ${top+10} L ${faceX+16} ${top+80} C ${faceX+2} ${top+70}, ${faceX-2} ${top+70}, ${faceX-16} ${top+80} Z`,
    extra: null
  };

  return { cap: cap(34, 14), extra: null };
}

export default function RiderAvatar({ rider, size = 76 }) {
  const seed = rider?.id || rider?.name || "seed";
  const gender = rider?.gender || "M";
  const p = genParams({ seed, gender });

  // Canvas area (viewBox)
  const W = 160;
  const H = 160;
  const cx = 80;
  const cy = 84;

  // Face
  const faceX = cx;
  const faceY = cy;
  const fw = p.faceW;
  const fh = p.faceH;
  const rx = p.jaw;

  // Eyes positions
  const eyeY = faceY - 10;
  const eyeX1 = faceX - p.eyeGap;
  const eyeX2 = faceX + p.eyeGap;

  // Nose & mouth positions
  const noseY = faceY + 8;
  const mouthY = faceY + 30;

  const { cap: hairCap, extra: hairExtra } = hairShape(p.hairStyle, faceX, faceY, fw, fh);

  // Slight gender shaping (subtle)
  const cheekShadow = gender === "F" ? 0.18 : 0.22;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: "block" }}
      aria-label="Rider avatar"
    >
      <defs>
        <radialGradient id={`skinGrad-${seed}`} cx="35%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="35%" stopColor={p.skin} stopOpacity="1" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.16" />
        </radialGradient>

        <linearGradient id={`hairGrad-${seed}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.10" />
          <stop offset="25%" stopColor={p.hairColor} stopOpacity="1" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
        </linearGradient>

        <filter id={`softShadow-${seed}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.25" />
        </filter>

        <filter id={`inner-${seed}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="-1" stdDeviation="1.2" floodColor="#000" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* Background circle */}
      <circle cx="80" cy="80" r="74" fill="#0b1220" opacity="0.55" />
      <circle cx="80" cy="80" r="72" fill="#111827" opacity="0.65" />

      {/* Neck */}
      <path
        d={`M ${faceX - 18} ${faceY + fh * 0.38} C ${faceX - 10} ${faceY + fh * 0.58}, ${faceX + 10} ${faceY + fh * 0.58}, ${faceX + 18} ${faceY + fh * 0.38}
            L ${faceX + 18} ${faceY + fh * 0.56} C ${faceX + 10} ${faceY + fh * 0.72}, ${faceX - 10} ${faceY + fh * 0.72}, ${faceX - 18} ${faceY + fh * 0.56} Z`}
        fill={`url(#skinGrad-${seed})`}
        filter={`url(#inner-${seed})`}
      />

      {/* Face */}
      <rect
        x={faceX - fw / 2}
        y={faceY - fh / 2}
        width={fw}
        height={fh}
        rx={rx}
        fill={`url(#skinGrad-${seed})`}
        filter={`url(#softShadow-${seed})`}
      />

      {/* Cheek shadows */}
      <path
        d={`M ${faceX - fw/2 + 10} ${faceY + 8}
            C ${faceX - fw/2 + 18} ${faceY + 18}, ${faceX - fw/2 + 22} ${faceY + 30}, ${faceX - fw/2 + 14} ${faceY + 38}`}
        stroke="#000"
        strokeOpacity={cheekShadow}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d={`M ${faceX + fw/2 - 10} ${faceY + 8}
            C ${faceX + fw/2 - 18} ${faceY + 18}, ${faceX + fw/2 - 22} ${faceY + 30}, ${faceX + fw/2 - 14} ${faceY + 38}`}
        stroke="#000"
        strokeOpacity={cheekShadow}
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Hair */}
      {hairCap ? (
        <path d={hairCap} fill={`url(#hairGrad-${seed})`} />
      ) : null}
      {hairExtra ? (
        <path d={hairExtra} fill={`url(#hairGrad-${seed})`} opacity="0.98" />
      ) : null}

      {/* Brows */}
      {[-1, 1].map((side) => {
        const x = side === -1 ? eyeX1 : eyeX2;
        const y = eyeY - 12;
        const angle = (side === -1 ? 1 : -1) * p.browAngle;
        return (
          <g key={`brow-${side}`} transform={`rotate(${angle} ${x} ${y})`}>
            <path
              d={`M ${x - 12} ${y} C ${x - 4} ${y - p.browArch}, ${x + 4} ${y - p.browArch}, ${x + 12} ${y}`}
              stroke="#0b0f17"
              strokeWidth={p.browThickness}
              strokeLinecap="round"
              opacity="0.88"
            />
          </g>
        );
      })}

      {/* Eyes */}
      {[{ x: eyeX1 }, { x: eyeX2 }].map((e, i) => (
        <g key={`eye-${i}`} transform={`rotate(${p.eyeTilt} ${e.x} ${eyeY})`}>
          {/* white */}
          <ellipse cx={e.x} cy={eyeY} rx={p.eyeSize + 6} ry={p.eyeSize} fill="#F9FAFB" opacity="0.98" />
          {/* iris */}
          <circle cx={e.x} cy={eyeY} r={p.eyeSize - 2} fill={p.iris} opacity="0.95" />
          {/* pupil */}
          <circle cx={e.x} cy={eyeY} r={p.eyeSize - 6} fill="#0B0B0F" />
          {/* highlight */}
          <circle cx={e.x - 3} cy={eyeY - 3} r="2.2" fill="#fff" opacity="0.9" />
          {/* lid */}
          <path
            d={`M ${e.x - (p.eyeSize + 6)} ${eyeY - 1}
               C ${e.x - 4} ${eyeY - (p.eyeSize * (0.9 + p.eyeLid))},
                 ${e.x + 4} ${eyeY - (p.eyeSize * (0.9 + p.eyeLid))},
                 ${e.x + (p.eyeSize + 6)} ${eyeY - 1}`}
            stroke="#0b0f17"
            strokeWidth="2"
            opacity="0.35"
            fill="none"
          />
        </g>
      ))}

      {/* Nose */}
      <path
        d={`M ${faceX} ${noseY - p.noseLen/2}
            C ${faceX + p.noseWidth/2} ${noseY - 2}, ${faceX + p.noseWidth/3} ${noseY + p.noseLen/2}, ${faceX} ${noseY + p.noseLen/2}
            C ${faceX - p.noseWidth/3} ${noseY + p.noseLen/2}, ${faceX - p.noseWidth/2} ${noseY - 2}, ${faceX} ${noseY - p.noseLen/2} Z`}
        fill="#000"
        opacity="0.10"
      />
      <path
        d={`M ${faceX - 6} ${noseY + p.noseLen/2 - 2} C ${faceX - 2} ${noseY + p.noseLen/2 + 2}, ${faceX + 2} ${noseY + p.noseLen/2 + 2}, ${faceX + 6} ${noseY + p.noseLen/2 - 2}`}
        stroke="#0b0f17"
        strokeWidth="2"
        opacity="0.25"
        fill="none"
        strokeLinecap="round"
      />

      {/* Mouth */}
      <path
        d={mouthPath(p.mouthMood, faceX, mouthY, p.mouthW)}
        stroke="#0b0f17"
        strokeWidth="3"
        opacity="0.55"
        fill="none"
        strokeLinecap="round"
      />

      {/* Facial hair (men only) */}
      {p.facialHair !== "none" ? (
        <g opacity={p.facialHair === "stubble" ? 0.12 : p.facialHair === "moustache" ? 0.22 : 0.18}>
          {p.facialHair === "moustache" || p.facialHair === "shortbeard" ? (
            <path
              d={`M ${faceX - 14} ${mouthY - 6} C ${faceX - 6} ${mouthY - 12}, ${faceX + 6} ${mouthY - 12}, ${faceX + 14} ${mouthY - 6}`}
              stroke="#0b0f17"
              strokeWidth="6"
              strokeLinecap="round"
            />
          ) : null}
          {p.facialHair === "stubble" || p.facialHair === "shortbeard" ? (
            <path
              d={`M ${faceX - fw/2 + 14} ${mouthY + 6}
                  C ${faceX - 18} ${faceY + fh/2 - 8}, ${faceX + 18} ${faceY + fh/2 - 8}, ${faceX + fw/2 - 14} ${mouthY + 6}`}
              stroke="#0b0f17"
              strokeWidth={p.facialHair === "stubble" ? 8 : 10}
              strokeLinecap="round"
            />
          ) : null}
        </g>
      ) : null}

      {/* Freckles */}
      {p.freckles ? (
        <g fill="#0b0f17" opacity="0.10">
          {Array.from({ length: 10 }).map((_, i) => (
            <circle
              key={`f-${i}`}
              cx={faceX - 18 + (i * 3)}
              cy={faceY + 8 + ((i % 3) * 2)}
              r="1.2"
            />
          ))}
        </g>
      ) : null}

      {/* Scar */}
      {p.scar ? (
        <path
          d={`M ${faceX + 18} ${faceY - 10} L ${faceX + 30} ${faceY - 2}`}
          stroke="#0b0f17"
          strokeWidth="2"
          opacity="0.22"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}
