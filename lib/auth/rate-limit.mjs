// Supplemental per-process limit; production must also retain Supabase Auth rate limits.
const attempts = new Map();
export function allowLogin(key, now = Date.now()) {
  for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
  const current = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
  if (attempts.size >= 5000 && !attempts.has(key)) return false;
  current.count += 1; attempts.set(key, current);
  return current.count <= 20;
}
