export class AuthError extends Error {
  constructor(code, message, status = 401) {
    super(message); this.code = code; this.status = status;
  }
}
export function loginEmail(value) {
  if (typeof value !== "string" || value.length > 254) throw new AuthError("INVALID_LOGIN", "Enter your email or existing username.", 400);
  const input = value.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) return input;
  // Compatibility with historical Supabase accounts, never custom login_accounts.
  if (/^[a-z0-9._-]{1,64}$/.test(input)) return `${input}@tennedz.local`;
  throw new AuthError("INVALID_LOGIN", "Invalid email or username.", 400);
}
export function passwordChangeInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).sort().join(",") !== "confirm_password,current_password,new_password")
    throw new AuthError("INVALID_PASSWORD_CHANGE", "Enter your current password and confirm the new one.", 400);
  const current = body.current_password, next = body.new_password;
  if (typeof current !== "string" || !current || current.length > 1024)
    throw new AuthError("INVALID_PASSWORD_CHANGE", "Enter your current password.", 400);
  if (typeof next !== "string" || next.length < 12 || next.length > 128)
    throw new AuthError("INVALID_PASSWORD_CHANGE", "Choose a new password of 12–128 characters.", 400);
  if (next === current)
    throw new AuthError("INVALID_PASSWORD_CHANGE", "Choose a password different from your current one.", 400);
  if (body.confirm_password !== next)
    throw new AuthError("INVALID_PASSWORD_CHANGE", "The new passwords do not match.", 400);
  return { current, next };
}
export function selectOwnedTeam(rows, userId) {
  if (!Array.isArray(rows) || rows.length === 0) throw new AuthError("TEAM_NOT_LINKED", "You are signed in and can now create your first team. If you previously had a team, contact the administrator before creating one.", 409);
  if (rows.length !== 1 || rows[0].user_id !== userId) throw new AuthError("TEAM_LINK_CONFLICT", "Your team ownership needs to be checked by the administrator. No data has been changed.", 409);
  return rows[0];
}
export function assertTeamId(requested, actual) {
  if (requested != null && requested !== actual) throw new AuthError("FORBIDDEN", "You do not have access to this team.", 403);
}
export function assertSameOrigin(req, configuredOrigin) {
  const origin = req.headers.get("origin");
  const allowed = configuredOrigin || new URL(req.url).origin;
  if (!origin || origin !== allowed || req.headers.get("sec-fetch-site") === "cross-site") throw new AuthError("FORBIDDEN_ORIGIN", "The request must come from the game website.", 403);
}
export function assertAdmin(userId, allowlist = "") {
  if (!allowlist.split(",").map(x => x.trim()).filter(Boolean).includes(userId)) throw new AuthError("ADMIN_REQUIRED", "Administrator access required.", 403);
}
