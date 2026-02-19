// BUILD: MOTOR-V1.4-BATCH
// Central place for live feed text: names + many variations + anti-repetition

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function makeFeedSpeaker({ rng, teamNameById, riderNameById }) {
  const recent = []; // store last N messages to avoid repeats
  const RECENT_MAX = 10;

  const T = {
    attack_started: [
      ({ km, rider }) => `${km} km: ${rider} trykker på – der bliver angrebet!`,
      ({ km, rider }) => `${km} km: ${rider} går i offensiven.`,
      ({ km, rider }) => `${km} km: ${rider} rykker – feltet reagerer.`,
      ({ km, rider }) => `${km} km: ${rider} sætter et hårdt angreb ind.`
    ],
    break_formed: [
      ({ km, gap, riders }) => `${km} km: Udbruddet er etableret (${riders} mand). Forspring: ${gap} sek.`,
      ({ km, gap, riders }) => `${km} km: En gruppe slipper væk (${riders}). De får ${gap} sek.`,
      ({ km, gap, riders }) => `${km} km: Udbruddet kører. ${gap} sek forspring (${riders} mand).`
    ],
    peloton_chasing: [
      ({ km, team, names, gap }) => `${km} km: ${team} sætter sig i front. ${names} slider i vinden. Gap: ${gap} sek.`,
      ({ km, team, names, gap }) => `${km} km: Jagten strammes op – ${team} fører an med ${names}. (${gap} sek)`,
      ({ km, team, names, gap }) => `${km} km: ${team} tager ansvar. ${names} trækker feltet. Gap: ${gap} sek.`
    ],
    peloton_passive: [
      ({ km, team, inBreak }) => `${km} km: ${team} kører passivt – de har allerede ${inBreak} mand foran.`,
      ({ km, team, inBreak }) => `${km} km: Ingen grund til at jage for ${team}. (${inBreak} i udbruddet)`,
      ({ km, team, inBreak }) => `${km} km: ${team} lader andre tage slæbet. (${inBreak} mand i front)`
    ],
    helpers_drop_back: [
      ({ km, team, captain, helpers }) => `${km} km: ${team} sender hjælp tilbage til ${captain}. ${helpers} falder tilbage.`,
      ({ km, team, captain, helpers }) => `${km} km: ${captain} er i problemer – ${team} reorganiserer sig. ${helpers} kommer tilbage.`,
      ({ km, team, captain, helpers }) => `${km} km: Redningsaktion! ${team} hjælper ${captain}. (${helpers})`
    ],
    crosswind_split: [
      ({ km, gap }) => `${km} km: Sidevind! Der bliver revet over. Nyt hul: ${gap} sek.`,
      ({ km, gap }) => `${km} km: Vinden splitter grupperne – ${gap} sek opstår.`,
      ({ km, gap }) => `${km} km: Det smækker i sidevinden. Et hul på ${gap} sek.`
    ],
    break_caught: [
      ({ km, kmLeft }) => `${km} km: Udbruddet bliver hentet. ${kmLeft} km igen.`,
      ({ km, kmLeft }) => `${km} km: Det er slut for udbruddet – feltet er samlet (${kmLeft} km til mål).`,
      ({ km, kmLeft }) => `${km} km: Hullet lukkes. Nu er alt samlet igen (${kmLeft} km).`
    ],

    // Finale timeline (last 5km)
    finale_5: [
      ({ km, scenario }) => `${km} km: 5 km igen. ${scenario} Positionskampen starter!`,
      ({ km, scenario }) => `${km} km: 5 km. ${scenario} Alle vil sidde rigtigt nu.`
    ],
    finale_4: [
      ({ km, scenario }) => `${km} km: 4 km. ${scenario} Holdene maser sig frem.`,
      ({ km, scenario }) => `${km} km: 4 km igen. ${scenario} Tempoet stiger.`
    ],
    finale_3: [
      ({ km, scenario }) => `${km} km: 3 km. ${scenario} Leadout-togene tager over!`,
      ({ km, scenario }) => `${km} km: 3 km igen. ${scenario} Nu begynder optakten for alvor.`
    ],
    finale_2: [
      ({ km, scenario }) => `${km} km: 2 km. ${scenario} Kaos i positionskampen!`,
      ({ km, scenario }) => `${km} km: 2 km igen. ${scenario} Nu kan man ikke komme bagfra.`
    ],
    finale_1: [
      ({ km, scenario }) => `${km} km: 1 km. ${scenario} Nu kommer spurten!`,
      ({ km, scenario }) => `${km} km: 1 km igen. ${scenario} Der bliver åbnet op!`
    ],
    finish_line: [
      ({ km }) => `${km} km: Stregen!`,
      ({ km }) => `${km} km: Mål!`,
      ({ km }) => `${km} km: De kaster cyklerne på stregen!`
    ],
    sprint_top3: [
      ({ winner, second, third }) => `Mål: ${winner} vinder foran ${second} og ${third}!`,
      ({ winner, second, third }) => `Mål: Sejr til ${winner}! ${second} bliver toer, ${third} treer.`,
      ({ winner, second, third }) => `Mål: ${winner} tager den! Podiet: ${second}, ${third}.`
    ],

    climb_pressure: [
      ({ km, names }) => `${km} km: Stigningen bider. ${names} sætter tempoet.`,
      ({ km, names }) => `${km} km: Der køres hårdt på bakken. ${names} presser på.`,
      ({ km, names }) => `${km} km: Tempo på stigningen – ${names} gør det surt for alle.`
    ]
  };

  function teamName(id) {
    return teamNameById?.get(id) || String(id || "Et hold");
  }
  function riderName(id) {
    return riderNameById?.get(id) || String(id || "En rytter");
  }

  function say(type, ctx) {
    const arr = T[type] || [() => `${ctx.km} km: (event)`];
    // try avoid repeats
    for (let tries = 0; tries < 6; tries++) {
      const fn = pick(rng, arr);
      const msg = fn(ctx);
      if (!recent.includes(msg)) {
        recent.push(msg);
        while (recent.length > RECENT_MAX) recent.shift();
        return msg;
      }
    }
    const fallback = pick(rng, arr)(ctx);
    recent.push(fallback);
    while (recent.length > RECENT_MAX) recent.shift();
    return fallback;
  }

  return { say, teamName, riderName };
}
