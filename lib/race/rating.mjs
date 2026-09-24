// Sporting strength is separate from points earned in races.
export function teamRating(riders, gender) {
  if (!['M','F'].includes(gender)) throw new Error('Choose a men’s or women’s race.');
  const unique = new Map(riders.filter(r=>r.gender===gender).map(r=>[r.id,r]));
  return [...unique.values()].map(r=>Number(r.rating ?? 0))
    .map(n=>Number.isFinite(n)?Math.max(0,n):0)
    .sort((a,b)=>b-a).slice(0,16).reduce((sum,n)=>sum+n,0);
}
