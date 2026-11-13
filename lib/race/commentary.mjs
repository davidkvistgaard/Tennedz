// English presentation of recorded recovery-engine copy. Stored races are never rewritten.
const legacy = {
  "Ingen kommer rigtigt afsted — feltet holder det samlet.": "No one gets clear — the peloton stays together.",
  "Sidevind! Feltet splittes i vifter, og flere ryttere kæmper for at sidde med.": "Crosswinds! The peloton splits into echelons as riders fight to stay in contact.",
  "Tempoet stiger gradvist, men feltet ser kontrolleret ud.": "The pace builds gradually, but the peloton remains in control.",
  "En rolig dag — alle virker til at spare kræfter til finalen.": "A quiet day — everyone seems to be saving energy for the finale.",
  "5 km igen — holdene begynder at positionere sig.": "5 km to go — the teams begin fighting for position.",
  "4 km — tempoet er højt, og det gælder om at ramme de rigtige hjul.": "4 km — the pace is high, and finding the right wheel matters.",
  "3 km igen — løbet nærmer sig sin afgørelse.": "3 km to go — the race is approaching its decisive moment.",
  "2 km — nervøst, og der bliver kæmpet om pladsen.": "2 km — nerves are rising as riders fight for space.",
  "1 km — nu er det sprinten der afgør det!": "1 km — now the sprint will decide it!",
  "bjergvejene": "the mountain roads",
  "bakkerne": "the hills",
  "brostenene": "the cobbles",
  "enkeltstartsruten": "the time trial course",
  "Udbruddet holder overraskende stand ind i finalen!": "The breakaway holds on into the finale against the odds!",
  "Feltet organiserer jagten — udbruddet bliver hentet.": "The peloton organises the chase — the breakaway is caught.",
  "vinden": "the wind",
  "det vanskelige føre": "the difficult conditions",
  "Feltet holder sammen gennem det vanskelige føre.": "The peloton stays together through the difficult conditions."
};
export function commentaryText(value) {
  const text = String(value ?? "");
  if (Object.hasOwn(legacy, text)) return legacy[text];
  if (text.startsWith("Vejr: ")) return text.replace(/^Vejr:/, "Weather:").replace(" · vind ", " · wind ").replace(" km/t ", " km/h ").replace(" · nedbør ", " · precipitation ");
  const attack = text.match(/^(.*) går i udbrud!$/);
  if (attack) return `${attack[1]} attack and break away!`;
  const finish = text.match(/^Mål! (.*) tager sejren\.$/);
  if (finish) return `Finish! ${finish[1]} takes the win.`;
  const finale = text.match(/^(\d+) km igen — finalen afgøres på (bjergvejene|bakkerne|brostenene|enkeltstartsruten)\.$/);
  if (finale) return `${finale[1]} km to go — the finale will be decided on ${legacy[finale[2]]}.`;
  const split = text.match(/^(\d+) ryttere mister kontakten i (vinden|det vanskelige føre)\. Feltet er delt\.$/);
  if (split) return `${split[1]} riders lose contact in ${legacy[split[2]]}. The peloton is split.`;
  return text;
}
