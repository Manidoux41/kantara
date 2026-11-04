import "server-only";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { loginId, passwordInput, type TeamAccount, type TeamState } from "@/lib/team/schema";
import { guardDemoRequest } from "@/services/demo/session";
import { digest, hashPassword, sessionToken, verifyPassword } from "./passwords";

export const teamCookieName = "kantara-team-session";
export function guardTeamRequest(request: Request) {
  guardDemoRequest(request);
  if (new URL(request.url).search) throw new ApiError(400, "VALIDATION_ERROR", "Query parameters are not supported.");
}
function requestDigest(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map((item) => item.trim())
    .find((item) => item.startsWith(`${teamCookieName}=`))?.slice(teamCookieName.length + 1);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? digest(token) : "";
}
export function requireAccount(state: TeamState, request: Request, allowPasswordChange = false, now = Date.now()): TeamAccount {
  const session = state.sessions.find((item) => item.digest === requestDigest(request) && item.expiresAt > now);
  const account = session && state.accounts.find((item) => item.id === session.accountId && item.active);
  if (!account) throw new ApiError(401, "LOGIN_REQUIRED", "Sign in with an active account.");
  if (account.mustChangePassword && !allowPasswordChange) throw new ApiError(403, "PASSWORD_CHANGE_REQUIRED", "Replace the temporary password before accessing your workspace.");
  return account;
}
export function cookieHeader(token: string | null) {
  return `${teamCookieName}=${token ?? ""}; HttpOnly; SameSite=Strict; Path=/api/demo/team; Max-Age=${token ? 28800 : 0}`;
}
function issueSession(state: TeamState, account: TeamAccount, now: number) {
  state.sessions = state.sessions.filter((item) => item.expiresAt > now);
  if (state.sessions.length >= 100) throw new ApiError(503, "SESSION_CAPACITY", "Local session capacity reached. Sign out unused sessions.");
  const token = sessionToken();
  state.sessions.push({ digest: digest(token), accountId: account.id, expiresAt: now + 8 * 3600000 });
  return token;
}
const credentials = z.strictObject({ action: z.literal("login"), login: loginId, password: z.string().min(1).max(128) });
export async function login(state: TeamState, raw: unknown, now = Date.now()) {
  const input = credentials.parse(raw);
  state.attempts = state.attempts.filter((item) => item.until > now);
  const keys = ["global", digest(input.login)];
  if (keys.some((key) => state.attempts.some((item) => item.key === key && item.count >= (key === "global" ? 100 : 5)))) {
    return { error: new ApiError(429, "LOGIN_THROTTLED", "Too many sign-in attempts. Retry after 15 minutes.") };
  }
  for (const key of keys) {
    let attempt = state.attempts.find((item) => item.key === key);
    if (!attempt) { attempt = { key, count: 0, until: now + 15 * 60000 }; state.attempts.push(attempt); }
    attempt.count++;
  }
  const account = state.accounts.find((item) => item.login === input.login);
  // Unknown identifiers still perform a KDF rather than return immediately.
  const valid = await verifyPassword(input.password, account?.passwordHash ?? state.accounts[0].passwordHash);
  if (!account || !account.active || !valid) return { error: new ApiError(401, "INVALID_CREDENTIALS", "Invalid identifier or password.") };
  state.attempts = state.attempts.filter((item) => item.key !== digest(input.login));
  return { token: issueSession(state, account, now), account };
}
export function logout(state: TeamState, request: Request) {
  state.sessions = state.sessions.filter((item) => item.digest !== requestDigest(request));
}
export async function changePassword(state: TeamState, account: TeamAccount, raw: unknown, now = Date.now()) {
  const input = z.strictObject({ action: z.literal("changePassword"), currentPassword: z.string().min(1).max(128), password: passwordInput }).parse(raw);
  if (!await verifyPassword(input.currentPassword, account.passwordHash)) throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid current password.");
  if (input.currentPassword === input.password) throw new ApiError(400, "PASSWORD_REUSE", "Choose a different password.");
  account.passwordHash = await hashPassword(input.password);
  account.mustChangePassword = false;
  state.sessions = state.sessions.filter((item) => item.accountId !== account.id);
  state.revision++;
  return issueSession(state, account, now);
}
