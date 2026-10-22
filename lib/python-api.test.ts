import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { pythonApiHeaders, pythonFetch, PYTHON_API_ACCESS_TOKEN_ENV } from "./python-api.ts";

const token = "t".repeat(40);
const withToken = { [PYTHON_API_ACCESS_TOKEN_ENV]: token };

test("the bearer token rides along only when the server holds one", () => {
  const init = { "Content-Type": "application/json", Accept: "application/x-ndjson" };
  for (const env of [{}, { [PYTHON_API_ACCESS_TOKEN_ENV]: "" }]) {
    const headers = pythonApiHeaders(init, env);
    assert.equal(headers.has("Authorization"), false);
    assert.equal(headers.get("Content-Type"), "application/json");
  }
  const headers = pythonApiHeaders(init, withToken);
  assert.equal(headers.get("Authorization"), `Bearer ${token}`);
  assert.equal(headers.get("Accept"), "application/x-ndjson");
});

test("an authorization supplied by the caller never reaches the API", () => {
  for (const init of [{ authorization: "Bearer browser" }, new Headers({ Authorization: "Bearer browser" }),
    [["Authorization", "Bearer browser"]] as [string, string][]]) {
    assert.equal(pythonApiHeaders(init, {}).has("Authorization"), false);
    assert.equal(pythonApiHeaders(init, withToken).get("Authorization"), `Bearer ${token}`);
  }
});

test("pythonFetch keeps the request and only adds the header", async (context) => {
  const seen: { input: string | URL | Request; init?: RequestInit }[] = [];
  context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    seen.push({ input, init });
    return new Response("{}");
  });
  const signal = new AbortController().signal;
  await pythonFetch("http://api:8000/target-sql", { method: "POST", body: "{}", cache: "no-store", signal }, withToken);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].input, "http://api:8000/target-sql");
  assert.equal(seen[0].init?.method, "POST");
  assert.equal(seen[0].init?.body, "{}");
  assert.equal(seen[0].init?.signal, signal);
  assert.equal(new Headers(seen[0].init?.headers).get("Authorization"), `Bearer ${token}`);
});

test("every API route reaches Python through pythonFetch", () => {
  const root = new URL("../app/api/", import.meta.url);
  const routes = readdirSync(root, { recursive: true, encoding: "utf8" }).filter((name) => name.endsWith(".ts"));
  assert.ok(routes.length > 10, "라우트를 찾지 못했다 — 아래 판정이 공허해진다");
  const bare = routes.filter((name) => /(?<![A-Za-z])fetch\(/.test(readFileSync(new URL(name, root), "utf8")));
  assert.deepEqual(bare, [], "토큰 없이 Python 을 부르는 라우트가 있다");
});
