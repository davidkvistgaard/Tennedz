export class AuthError extends Error {
  constructor(code, message, status = 401) {
    super(message); this.code = code; this.status = status;
  }
}
export function loginEmail(value) {
  if (typeof value !== "string" || value.length > 254) throw new AuthError("INVALID_LOGIN", "Skriv din e-mail eller dit eksisterende brugernavn.", 400);
  const input = value.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) return input;
  // Compatibility with historical Supabase accounts, never custom login_accounts.
  if (/^[a-z0-9._-]{1,64}$/.test(input)) return `${input}@tennedz.local`;
  throw new AuthError("INVALID_LOGIN", "Ugyldig e-mail eller brugernavn.", 400);
}
export function selectOwnedTeam(rows, userId) {
  if (!Array.isArray(rows) || rows.length === 0) throw new AuthError("TEAM_NOT_LINKED", "Din konto er logget ind, men mangler en bekræftet tilknytning til dit hold. Kontakt administratoren.", 409);
  if (rows.length !== 1 || rows[0].user_id !== userId) throw new AuthError("TEAM_LINK_CONFLICT", "Din holdtilknytning skal kontrolleres af administratoren. Ingen data er ændret.", 409);
  return rows[0];
}
export function assertTeamId(requested, actual) {
  if (requested != null && requested !== actual) throw new AuthError("FORBIDDEN", "Du har ikke adgang til dette hold.", 403);
}
export function assertSameOrigin(req, configuredOrigin) {
  const origin = req.headers.get("origin");
  const allowed = configuredOrigin || new URL(req.url).origin;
  if (!origin || origin !== allowed || req.headers.get("sec-fetch-site") === "cross-site") throw new AuthError("FORBIDDEN_ORIGIN", "Anmodningen skal komme fra spillets egen side.", 403);
}
export function assertAdmin(userId, allowlist = "") {
  if (!allowlist.split(",").map(x => x.trim()).filter(Boolean).includes(userId)) throw new AuthError("ADMIN_REQUIRED", "Kun administratorer har adgang.", 403);
}
