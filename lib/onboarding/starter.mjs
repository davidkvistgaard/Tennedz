import { AuthError } from "../auth/policy.mjs";

export const skills = ["sprint", "flat", "hills", "mountain", "cobbles", "timetrial", "endurance", "strength", "wind"];
// Identical sporting starting opportunities for both categories; two of each role.
const profiles = [
  [48,42,28,22,30,30,38,42,36],
  [24,30,42,48,24,34,42,34,36],
  [30,38,40,24,48,28,40,38,30],
  [26,42,28,26,28,48,40,38,40],
];
export const namePools = [
  { nation:"DEN", M:["Emil","Mikkel","Søren","Frederik","Anders","Rasmus"], F:["Emma","Freja","Sofie","Clara","Ida","Astrid"], last:["Nielsen","Larsen","Madsen","Jensen","Lund","Holm"] },
  { nation:"FRA", M:["Louis","Jules","Hugo","Antoine","Maxime","Adrien"], F:["Camille","Léa","Juliette","Manon","Élodie","Chloé"], last:["Laurent","Moreau","Garnier","Rousseau","Dubois","Marchand"] },
  { nation:"ITA", M:["Luca","Matteo","Lorenzo","Davide","Marco","Alessio"], F:["Giulia","Chiara","Francesca","Elena","Valentina","Alessia"], last:["Rossi","Romano","Conti","Galli","Costa","Ferrari"] },
  { nation:"ESP", M:["Pablo","Diego","Álvaro","Javier","Adrián","Sergio"], F:["Lucía","Carmen","Elena","Alba","Marta","Isabel"], last:["García","Romero","Santos","Navarro","Torres","Vega"] },
  { nation:"NED", M:["Daan","Bram","Koen","Thijs","Jasper","Stijn"], F:["Lotte","Femke","Sanne","Maartje","Anouk","Eva"], last:["De Vries","Bakker","Visser","Van Dijk","Smit","De Boer"] },
  { nation:"GER", M:["Felix","Jonas","Lukas","Leon","Niklas","Moritz"], F:["Hannah","Lena","Frieda","Mia","Johanna","Luisa"], last:["Weber","Fischer","Becker","Hoffmann","Koch","Wagner"] },
  { nation:"GBR", M:["Oliver","George","Harry","Thomas","James","Callum"], F:["Alice","Emily","Charlotte","Grace","Eleanor","Lucy"], last:["Wilson","Taylor","Bennett","Clarke","Turner","Hughes"] },
  { nation:"COL", M:["Santiago","Mateo","Andrés","Daniel","Nicolás","Julián"], F:["Mariana","Valeria","Catalina","Daniela","Natalia","Laura"], last:["Ramírez","Rojas","Morales","Vargas","Castro","Mendoza"] },
];
export function teamName(value) {
  if (typeof value !== "string" || value.length > 160 || /[\p{Cc}\p{Cf}<>]/u.test(value)) throw new AuthError("INVALID_TEAM_NAME", "Brug et holdnavn på 3–40 tegn uden specialkoder.", 400);
  const name = value.normalize("NFC").trim().replace(/\s+/g," ");
  if (name.length < 3 || name.length > 40) throw new AuthError("INVALID_TEAM_NAME", "Holdnavnet skal være mellem 3 og 40 tegn.", 400);
  return name;
}
export function signupInput(body) {
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith(".local")) throw new AuthError("INVALID_SIGNUP", "Skriv en gyldig e-mailadresse.", 400);
  if (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 128) throw new AuthError("INVALID_SIGNUP", "Vælg et kodeord på 12–128 tegn.", 400);
  return { email, password: body.password };
}
export function starterPack(random) {
  const pick = list => list[Math.floor(random()*list.length)];
  const used = new Set();
  return ["M","F"].flatMap(gender => Array.from({length:8}, (_, index) => {
    const pool = namePools[index];
    const combinations = pool[gender].flatMap(first => pool.last.map(last => ({first,last,name:`${first} ${last}`}))).filter(n => !used.has(n.name));
    const n = pick(combinations); used.add(n.name);
    const stats = Object.fromEntries(skills.map((skill,i) => [skill,profiles[index%4][i]]));
    const caps = Object.fromEntries(skills.map(skill => [`${skill}_cap`,Math.min(90,stats[skill]+15+Math.floor(random()*21))]));
    return { name:n.name, first_name:n.first, last_name:n.last, display_name:n.name, nationality:pool.nation,
      gender, age:22+Math.floor(random()*4), ...stats, ...caps,
      leadership:35, moral:50, luck:35, form:40, fatigue:0, rating:0 };
  }));
}
