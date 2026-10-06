const MAX_TEAMS_PER_DIVISION = 20;
const MAX_ENTRANTS = 400;

export function divisionMultiplier(index,total){
  if(!Number.isInteger(index)||!Number.isInteger(total)||total<1||
    index<1||index>total)throw new Error('Invalid division index or count.');
  const minimum=Math.max(.62,Math.min(.90,.62+.25*(1-Math.exp(-(total-1)/6))));
  return total===1?1:1-(1-minimum)*Math.pow((index-1)/(total-1),1.35);
}

function compareTeamIds(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Assign a registration-locked, season/gender points snapshot to balanced divisions.
 * The caller must persist this snapshot and the returned assignments at reveal time;
 * subsequent ranking or lineup changes must not re-run matchmaking.
 */
export function assignPointDivisions({ eventId, seasonYear, gender, entrants }) {
  if (typeof eventId !== "string" || !eventId.trim()) throw new Error("A division reveal needs an event ID.");
  if (!Number.isInteger(seasonYear) || seasonYear < 1) throw new Error("A division reveal needs a season year.");
  if (gender !== "M" && gender !== "F") throw new Error("A division reveal needs a gender.");
  if (!Array.isArray(entrants) || entrants.length < 2 || entrants.length > MAX_ENTRANTS) {
    throw new Error(`A division reveal requires 2-${MAX_ENTRANTS} teams.`);
  }

  const seen = new Set();
  const ranked = entrants.map((entrant) => {
    const teamId = entrant?.teamId;
    const points = entrant?.earnedPoints;
    if (typeof teamId !== "string" || !teamId.trim() || seen.has(teamId)) {
      throw new Error("Division entrants need distinct team IDs.");
    }
    if (!Number.isSafeInteger(points) || points < 0) {
      throw new Error("Division entrants need non-negative integer earned points.");
    }
    seen.add(teamId);
    return { teamId, earnedPointsAtLock: points };
  }).sort((a, b) => b.earnedPointsAtLock - a.earnedPointsAtLock || compareTeamIds(a.teamId, b.teamId));

  const divisionCount = Math.ceil(ranked.length / MAX_TEAMS_PER_DIVISION);
  const baseSize = Math.floor(ranked.length / divisionCount);
  const extra = ranked.length % divisionCount;
  const assignments = [];
  let offset = 0;
  for (let index = 0; index < divisionCount; index++) {
    const size = baseSize + (index < extra ? 1 : 0);
    for (const entrant of ranked.slice(offset, offset + size)) {
      assignments.push({ ...entrant, divisionIndex: index + 1, seedRank: assignments.length + 1 });
    }
    offset += size;
  }

  return { eventId, seasonYear, gender, assignments };
}
