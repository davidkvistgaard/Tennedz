import seedrandom from "seedrandom";
import { generateIdentity } from "../riders/identity.mjs";
import { AuthError } from "../auth/policy.mjs";

export const skills = ["sprint", "flat", "hills", "mountain", "cobbles", "timetrial", "endurance", "strength", "wind"];
// Identical sporting starting opportunities for both categories; two of each role.
const profiles = [
  [48,42,28,22,30,30,38,42,36],
  [24,30,42,48,24,34,42,34,36],
  [30,38,40,24,48,28,40,38,30],
  [26,42,28,26,28,48,40,38,40],
];
export function teamName(value) {
  if (typeof value !== "string" || value.length > 160 || /[\p{Cc}\p{Cf}<>]/u.test(value)) throw new AuthError("INVALID_TEAM_NAME", "Use a team name of 3–40 characters without control characters or markup.", 400);
  const name = value.normalize("NFC").trim().replace(/\s+/g," ");
  if (name.length < 3 || name.length > 40) throw new AuthError("INVALID_TEAM_NAME", "The team name must be between 3 and 40 characters.", 400);
  return name;
}
export function signupInput(body) {
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith(".local")) throw new AuthError("INVALID_SIGNUP", "Enter a valid email address.", 400);
  if (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 128) throw new AuthError("INVALID_SIGNUP", "Choose a password of 12–128 characters.", 400);
  return { email, password: body.password };
}
export function starterPack(random) {
  const packSeed = Array.from({length:4},()=>Math.floor(random()*2**32).toString(16).padStart(8,"0")).join("");
  // Never expose the sporting seed through the public appearance seed: otherwise
  // players could reconstruct hidden potential from their portrait data.
  const sportSeed = Array.from({length:4},()=>Math.floor(random()*2**32).toString(16).padStart(8,"0")).join("");
  const used = new Set();
  return ["M","F"].flatMap(gender => Array.from({length:8}, (_, index) => {
    // Separate streams: cosmetic changes cannot change ability, caps or age.
    const sportRandom=seedrandom(`sport-v1:${sportSeed}:${gender}:${index}`);
    let identity;
    for(let attempt=0;attempt<64;attempt++) {
      identity=generateIdentity(`${packSeed}:${gender}:${index}:${attempt}`,gender);
      if(!used.has(identity.name))break;
    }
    if(used.has(identity.name))throw new Error("Could not generate distinct starter names");
    used.add(identity.name);
    const stats = Object.fromEntries(skills.map((skill,i) => [skill,profiles[index%4][i]]));
    const caps = Object.fromEntries(skills.map(skill => [`${skill}_cap`,Math.min(90,stats[skill]+15+Math.floor(sportRandom()*21))]));
    return { ...identity,
      gender, age:22+Math.floor(sportRandom()*4), ...stats, ...caps,
      leadership:35, moral:50, luck:35, form:40, fatigue:0, rating:0 };
  }));
}
