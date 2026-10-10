import assert from "node:assert/strict";
import test from "node:test";
import { requestLimitErrorResponse } from "./sql-request-limit.ts";

test("quota rejection preserves 429, retry time and the message shown by the wizard", async () => {
  const detail = { stage: "request_admission", code: "daily_sql_request_limit_exceeded", reason: "오늘 SQL 생성 요청 한도 50회를 모두 사용했습니다." };
  const response = requestLimitErrorResponse(new Response(null, { status: 429, headers: { "Retry-After": "3600" } }), { detail });
  assert.ok(response);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "3600");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: detail.reason, detail });
});

test("unavailable quota storage remains a visible 503 admission failure", async () => {
  const detail = { stage: "request_admission", code: "quota_unavailable", reason: "호출 한도를 확인할 수 없습니다." };
  const response = requestLimitErrorResponse(new Response(null, { status: 503 }), { detail });
  assert.ok(response);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, detail.reason);
});

test("unrelated errors and malformed bodies keep the existing error handling", () => {
  for (const data of [null, {}, { detail: "error" }, { detail: { stage: "request_admission" } }, { detail: { stage: "provider", reason: "failed" } }]) {
    assert.equal(requestLimitErrorResponse(new Response(null, { status: 429 }), data), null);
  }
});
