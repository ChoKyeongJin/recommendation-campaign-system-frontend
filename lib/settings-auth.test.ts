import assert from "node:assert/strict";
import test from "node:test";
import {
  createSettingsSession, settingsApiRequiresSession, settingsCredentials,
  settingsPasswordMatches, settingsRequestIsSameOrigin, validSettingsSession, SETTINGS_SESSION_SECONDS,
} from "./settings-auth.ts";

const credentials = { password: "test-password", sessionSecret: "a-test-signing-secret-with-at-least-32-characters" };
const now = Date.UTC(2026, 9, 11, 12);

test("server configuration fails closed without both credentials", () => {
  for (const env of [{}, { SETTINGS_PASSWORD: "test" }, { SETTINGS_SESSION_SECRET: credentials.sessionSecret },
    { SETTINGS_PASSWORD: "test", SETTINGS_SESSION_SECRET: "short" }]) {
    assert.equal(settingsCredentials(env), null);
  }
  assert.deepEqual(settingsCredentials({ SETTINGS_PASSWORD: credentials.password,
    SETTINGS_SESSION_SECRET: credentials.sessionSecret }), credentials);
});

test("password verification is exact and does not coerce input", () => {
  assert.equal(settingsPasswordMatches(credentials.password, credentials), true);
  for (const password of ["wrong", "", " test-password", "test-password ", 4567, null, {}, "x".repeat(129)]) {
    assert.equal(settingsPasswordMatches(password, credentials), false);
  }
});

test("server sessions expire and cannot be forged or extended by the browser", () => {
  const token = createSettingsSession(credentials, now);
  assert.equal(validSettingsSession(token, credentials, now), true);
  assert.equal(validSettingsSession(token, credentials, now + SETTINGS_SESSION_SECONDS * 1000 - 1), true);
  assert.equal(validSettingsSession(token, credentials, now + SETTINGS_SESSION_SECONDS * 1000), false);
  const pieces = token.split(".");
  pieces[1] = String(Number(pieces[1]) + 1);
  for (const invalid of [undefined, "true", "unlocked", "", "x".repeat(201), `${token}x`, pieces.join("."),
    `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`]) {
    assert.equal(validSettingsSession(invalid, credentials, now), false);
  }
  assert.equal(validSettingsSession(token, { ...credentials, password: "new-password" }, now), false);
  assert.equal(validSettingsSession(token, { ...credentials, sessionSecret: "a-different-secret" }, now), false);
  assert.equal(token.includes(credentials.password), false);
  assert.notEqual(createSettingsSession(credentials, now), token);
});

test("all settings APIs require a session while ordinary targeting and quota reads stay available", () => {
  for (const path of ["/api/profile-setup", "/api/profile-setup/", "/api/profile-setup/validate",
    "/api/profile-setup/apply", "/api/prompts", "/api/prompts/example", "/api/prompts/reload",
    "/api/prompts/seed", "/api/reference", "/api/reference/data/example", "/api/monitoring", "/api/monitoring/failures"]) {
    for (const method of ["GET", "POST", "PUT", "DELETE"]) assert.equal(settingsApiRequiresSession(path, method), true);
  }
  assert.equal(settingsApiRequiresSession("/api/request-limits", "PUT"), true);
  assert.equal(settingsApiRequiresSession("/api/request-limits/", "PUT"), true);
  for (const path of ["/api/targeting", "/api/targeting/trace", "/api/structuring-models", "/api/settings-auth"]) {
    assert.equal(settingsApiRequiresSession(path, "POST"), false);
  }
  assert.equal(settingsApiRequiresSession("/api/request-limits", "GET"), false);
  assert.equal(settingsApiRequiresSession("/api/profile-setup-extra", "GET"), false);
});

test("cross-site settings requests are rejected", () => {
  const url = "https://example.test/api/settings-auth";
  assert.equal(settingsRequestIsSameOrigin(new Request(url)), true);
  assert.equal(settingsRequestIsSameOrigin(new Request(url, { headers: { origin: "https://example.test" } })), true);
  const deniedHeaders: HeadersInit[] = [{ origin: "https://other.test" }, { origin: "null" }, { "sec-fetch-site": "cross-site" }];
  for (const headers of deniedHeaders) {
    assert.equal(settingsRequestIsSameOrigin(new Request(url, { headers })), false);
  }
});

test("settings accept the browser host when Next.js uses an internal container address", () => {
  for (const [url, host, origin] of [
    ["http://localhost:3000/api/settings-auth", "example.test", "http://example.test"],
    ["http://0.0.0.0:3000/api/settings-auth", "203.0.113.10", "http://203.0.113.10"],
    ["http://localhost:3000/api/settings-auth", "example.test:8080", "http://example.test:8080"],
    ["https://localhost:3000/api/settings-auth", "example.test", "https://example.test"],
    ["http://localhost:3000/api/settings-auth", "[::1]:8080", "http://[::1]:8080"],
    ["http://localhost:3000/api/settings-auth", "EXAMPLE.TEST:80", "http://example.test"],
  ]) {
    assert.equal(settingsRequestIsSameOrigin(new Request(url, { headers: { host, origin } })), true);
  }
});

test("container origin checks reject foreign origins, ports, schemes and untrusted forwarded hosts", () => {
  const url = "http://localhost:3000/api/settings-auth";
  for (const origin of ["http://other.test", "http://localhost:3000", "http://example.test:8080", "https://example.test", "null"]) {
    assert.equal(settingsRequestIsSameOrigin(new Request(url, { headers: {
      host: "example.test", origin, "x-forwarded-host": new URL(origin === "null" ? url : origin).host,
      "sec-fetch-site": "same-origin",
    } })), false);
  }
  assert.equal(settingsRequestIsSameOrigin(new Request(url, { headers: {
    host: "example.test", origin: "http://example.test", "sec-fetch-site": "cross-site",
  } })), false);
});

test("malformed Host headers cannot turn an origin check into a redirect or URL parse error", () => {
  const url = "http://localhost:3000/api/settings-auth";
  for (const host of ["", "bad host", "user@example.test", "example.test/", "example.test\\path", "example.test?query",
    "example.test#fragment", "example.test,other.test", "[invalid]", "example.test:invalid"]) {
    assert.equal(settingsRequestIsSameOrigin(new Request(url, { headers: { host, origin: "http://example.test" } })), false);
  }
});
