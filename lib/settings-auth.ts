// Server-only: node:crypto and unprefixed environment variables never enter client bundles.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SETTINGS_SESSION_COOKIE = "settings_session";
export const SETTINGS_SESSION_SECONDS = 60 * 60;

export type SettingsCredentials = Readonly<{ password: string; sessionSecret: string }>;

export function settingsCredentials(env: Readonly<Record<string, string | undefined>>): SettingsCredentials | null {
  const password = env.SETTINGS_PASSWORD;
  const sessionSecret = env.SETTINGS_SESSION_SECRET;
  if (!password || password.length > 128 || !sessionSecret || sessionSecret.length < 32) return null;
  return { password, sessionSecret };
}

export function settingsPasswordMatches(password: unknown, credentials: SettingsCredentials): boolean {
  if (typeof password !== "string" || password.length === 0 || password.length > 128) return false;
  return timingSafeEqual(
    createHash("sha256").update(password).digest(),
    createHash("sha256").update(credentials.password).digest(),
  );
}

function signature(payload: string, credentials: SettingsCredentials): string {
  // Changing either server secret or password invalidates existing sessions.
  const key = createHmac("sha256", credentials.sessionSecret).update(credentials.password).digest();
  return createHmac("sha256", key).update(`settings-session:${payload}`).digest("base64url");
}

export function createSettingsSession(credentials: SettingsCredentials, now: number): string {
  const expires = Math.floor(now / 1000) + SETTINGS_SESSION_SECONDS;
  const payload = `v1.${expires}.${randomBytes(24).toString("base64url")}`;
  return `${payload}.${signature(payload, credentials)}`;
}

export function validSettingsSession(token: string | undefined, credentials: SettingsCredentials, now: number): boolean {
  if (!token || token.length > 200) return false;
  const match = /^(v1\.([0-9]{1,13})\.[A-Za-z0-9_-]{32})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return false;
  const expires = Number(match[2]);
  const current = Math.floor(now / 1000);
  if (expires <= current || expires > current + SETTINGS_SESSION_SECONDS) return false;
  return timingSafeEqual(Buffer.from(match[3]), Buffer.from(signature(match[1], credentials)));
}

export function settingsApiRequiresSession(pathname: string, method: string): boolean {
  if (["/api/profile-setup", "/api/prompts", "/api/reference", "/api/monitoring"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )) return true;
  return pathname.replace(/\/$/, "") === "/api/request-limits" && !["GET", "HEAD", "OPTIONS"].includes(method);
}

export function settingsRequestIsSameOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (host === null) return origin === url.origin;
  // Next.js may construct request.url from its internal container address.
  // Docker preserves the browser's Host; forwarded-host is not a trusted source.
  if (!host || /[\s/@\\?#,]/.test(host)) return false;
  try {
    return origin === new URL(`${url.protocol}//${host}`).origin;
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}
