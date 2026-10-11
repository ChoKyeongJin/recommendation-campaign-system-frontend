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
