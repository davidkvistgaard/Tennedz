import seedrandom from "seedrandom";

// Stable IDs and order are part of the v1 team allocation contract.
const palettes = [
  ["forest","Forest & honey","#285440","#dfb665"],
  ["ocean","Ocean & coral","#305c73","#edaa87"],
  ["plum","Plum & cream","#69475e","#e9d7b0"],
  ["ember","Ember & gold","#994b35","#f0cc83"],
  ["alpine","Alpine pine","#174d44","#d3e9d6"],
  ["moss","Moss & chalk","#596b38","#fff1d3"],
  ["sage","Sage & aubergine","#acb58c","#51354c"],
  ["mint","Mint & ink","#9ad4bf","#243d45"],
  ["lime","Lime & charcoal","#d0dc57","#303638"],
  ["emerald","Emerald & sand","#147553","#ead8ac"],
  ["petrol","Petrol & copper","#205961","#d99b70"],
  ["lagoon","Lagoon & ivory","#268d91","#fff1d2"],
  ["navy","Navy & marigold","#23364f","#f2bf4e"],
  ["cobalt","Cobalt & ice","#335eaa","#d8ecf0"],
  ["sky","Sky & burgundy","#91c2d9","#6d3042"],
  ["denim","Denim & peach","#516f8f","#f0c2a1"],
  ["midnight","Midnight & lilac","#283149","#c8b3dc"],
  ["fjord","Fjord & glacier","#426c73","#dae9df"],
  ["royal","Royal & lemon","#454a99","#f1db79"],
  ["steel","Steel & tangerine","#657c89","#f3aa68"],
  ["aubergine","Aubergine & rose","#503248","#e8b5b7"],
  ["violet","Violet & butter","#735b9a","#eee0a1"],
  ["lavender","Lavender & pine","#b5a7cf","#294e44"],
  ["berry","Berry & blush","#8a385d","#f2d0bf"],
  ["orchid","Orchid & midnight","#b57da4","#26394e"],
  ["wine","Wine & wheat","#702f3b","#dbc58e"],
  ["rose","Rose & graphite","#cb8f93","#343e42"],
  ["mulberry","Mulberry & mint","#663d64","#b8dec7"],
  ["heather","Heather & silver","#8a798f","#e8e5dc"],
  ["fuchsia","Fuchsia & cream","#a43f76","#fff0d5"],
  ["rust","Rust & sky","#a85538","#b4d7e3"],
  ["terracotta","Terracotta & sage","#c27c5e","#d4dfb4"],
  ["scarlet","Scarlet & vanilla","#b83b39","#f7e6ba"],
  ["brick","Brick & stone","#844435","#e0d7c7"],
  ["coral","Coral & ocean","#e08d77","#244e60"],
  ["apricot","Apricot & espresso","#e7b178","#513f36"],
  ["saffron","Saffron & indigo","#dda63d","#3a416d"],
  ["ochre","Ochre & forest","#b58b3e","#23493b"],
  ["sunflower","Sunflower & navy","#efcb4b","#29394b"],
  ["sand","Sand & teal","#d8c49c","#285d60"],
  ["cream","Cream & racing green","#f4e8cc","#28543b"],
  ["chalk","Chalk & vermilion","#eee9df","#b64733"],
  ["graphite","Graphite & pearl","#3c4244","#e9e5d5"],
  ["espresso","Espresso & caramel","#4b3932","#d8ae74"],
  ["slate","Slate & dusty rose","#535b63","#d7a7a5"],
  ["bronze","Bronze & ice","#877043","#d4e7ea"],
  ["olive","Olive & orange","#636440","#e9a467"],
  ["pistachio","Pistachio & cocoa","#c5cf9a","#67483d"],
  ["arctic","Arctic & cobalt","#d8e4df","#385d97"],
  ["blackberry","Blackberry & gold","#383043","#e3c36f"],
];
export const CLUB_PALETTES = Object.freeze(Object.fromEntries(palettes.map(([id,name,primary,accent]) => [id,Object.freeze({name,primary,accent})])));

// Torso artwork in a shared 100 × 100 space. Used by kit and rider previews.
export const KIT_PATTERNS = Object.freeze(Object.fromEntries([
  ["plain","Classic plain",[]],
  ["band","Chest band",["M0 35H100V55H0Z"]],
  ["diagonal","Diagonal sash",["M0 65L100 0V25L0 90Z"]],
  ["reverse","Reverse sash",["M0 0L100 65V90L0 25Z"]],
  ["twin-bands","Twin bands",["M0 25H100V37H0Z M0 57H100V69H0Z"]],
  ["triple-bands","Triple bands",["M0 19H100V27H0Z M0 39H100V47H0Z M0 59H100V67H0Z"]],
  ["centre","Centre stripe",["M38 0H62V100H38Z"]],
  ["twin-stripes","Twin stripes",["M22 0H35V100H22Z M65 0H78V100H65Z"]],
  ["pinstripes","Pinstripes",Array.from({length:8},(_,i)=>`M${5+i*12} 0h3v100h-3Z`)],
  ["hoops","Racing hoops",Array.from({length:7},(_,i)=>`M0 ${5+i*14}h100v6H0Z`)],
  ["half","Half split",["M0 0H50V100H0Z"]],
  ["quarters","Quartered",["M0 0H50V50H0Z M50 50H100V100H50Z"]],
  ["chevron","Chevron",["M0 20L50 48L100 20V42L50 70L0 42Z"]],
  ["double-chevron","Double chevron",["M0 12L50 37L100 12V23L50 48L0 23Z M0 48L50 73L100 48V59L50 84L0 59Z"]],
  ["yoke","Shoulder yoke",["M0 0H100V27Q50 48 0 27Z"]],
  ["hem","Contrast hem",["M0 76H100V100H0Z"]],
  ["side-panels","Side panels",["M0 0H20L13 50L20 100H0Z M100 0H80L87 50L80 100H100Z"]],
  ["diamond","Diamond",["M50 12L83 49L50 86L17 49Z"]],
  ["mountains","Mountain peaks",["M0 79L27 31L48 64L69 18L100 79V100H0Z"]],
  ["wave","Coastal wave",["M0 39Q25 13 50 39T100 39V62Q75 88 50 62T0 62Z"]],
  ["lightning","Lightning",["M62 0L22 55H47L30 100L83 36H56L80 0Z"]],
  ["checker","Checkerboard",Array.from({length:25},(_,i)=>{const x=i%5,y=Math.floor(i/5);return (x+y)%2===0?`M${x*20} ${y*20}h20v20h-20Z`:"";}).filter(Boolean)],
  ["dots","Polka dots",Array.from({length:16},(_,i)=>{const x=12+(i%4)*25,y=12+Math.floor(i/4)*25;return `M${x-5} ${y}a5 5 0 1 0 10 0a5 5 0 1 0-10 0`;})],
  ["steps","Stepped blocks",["M0 0H33V33H66V66H100V100H0Z"]],
  ["rays","Sun rays",["M50 100L0 0H18Z M50 100L35 0H53Z M50 100L70 0H90Z"]],
].map(([id,name,paths])=>[id,Object.freeze({name,paths:Object.freeze(paths)})])));

export function teamKitOptions(teamId) {
  const rng = seedrandom(`pelotonia-kit-v1:${teamId || "guest"}`);
  const pick = (ids,n) => {
    const shuffled = [...ids];
    for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
    return shuffled.slice(0,n);
  };
  return { palettes:pick(Object.keys(CLUB_PALETTES),4), patterns:pick(Object.keys(KIT_PATTERNS),3) };
}
export function defaultKit(teamId) { const choices=teamKitOptions(teamId);return {palette:choices.palettes[0],pattern:choices.patterns[0]}; }
export function validateTeamKit(value,teamId) {
  const choices=teamKitOptions(teamId);
  return value && choices.palettes.includes(value.palette) && choices.patterns.includes(value.pattern)
    ? {palette:value.palette,pattern:value.pattern} : defaultKit(teamId);
}
