import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyFilters, failureQuery, failureReadError, failureSummary, failureTime, parseFailurePage,
  type FailureRecord,
} from "./query-monitoring.ts";

const item: FailureRecord = {
  failure_log_id: 1, prompt: "지난달 구매한 회원", api_status: "unsupported",
  failure_stage: "sql_generation", failure_reason: "unsupported_semantics",
  called_at: null, recorded_at: "2026-10-10T15:00:00Z", summary: null,
  message: "기간 조건을 지원하지 않습니다.", diagnosis_stage: null, diagnosis_code: null,
};
const page = { items: [item], total: 23, page: 1, page_size: 20 };

test("historical records never borrow the logged time as a fabricated call time", () => {
  assert.equal(parseFailurePage(page)?.items[0].called_at, null);
  const called = "2026-10-11T08:59:00+09:00";
  assert.equal(parseFailurePage({ ...page, items: [{ ...item, called_at: called }] })?.items[0].called_at, called);
  assert.match(failureTime(item.recorded_at), /2026\. 10\. 11\./);
  assert.match(failureTime(item.recorded_at), /00:00:00/);
});

test("invalid responses and naive timestamps are errors, not empty history", () => {
  for (const value of [null, {}, { detail: "unavailable" }, { ...page, total: -1 }, { ...page, page: 0 },
    { ...page, page_size: 101 }, { ...page, items: [{}] },
    { ...page, items: [{ ...item, called_at: "2026-10-11T09:00:00" }] },
    { ...page, items: [{ ...item, recorded_at: "invalid" }] },
    { ...page, items: [{ ...item, failure_reason: {} }] }]) {
    assert.equal(parseFailurePage(value), null);
  }
  assert.deepEqual(parseFailurePage({ ...page, items: [], total: 0 }), { ...page, items: [], total: 0 });
});

test("the saved final explanation has precedence with honest legacy fallback", () => {
  assert.equal(failureSummary({ ...item, summary: "최종 설명" }), "최종 설명");
  assert.equal(failureSummary(item), item.message);
  assert.equal(failureSummary({ ...item, message: null }), item.failure_reason);
  assert.equal(failureSummary({ ...item, summary: " ", message: "" }), item.failure_reason);
});

test("filter queries preserve literal natural language and pagination", () => {
  const q = "상위 10% & 회원_ #1";
  const params = new URLSearchParams(failureQuery({ ...emptyFilters, q, since: "2026-10-01", stage: "sql_generation" }, 2));
  assert.equal(params.get("q"), q);
  assert.equal(params.get("since"), "2026-10-01");
  assert.equal(params.get("stage"), "sql_generation");
  assert.equal(params.get("page"), "2");
  assert.equal(params.get("page_size"), "20");
  assert.equal(params.has("until"), false);
  assert.equal(new URLSearchParams(failureQuery(emptyFilters, 1)).has("q"), false);
});

test("read failures use server explanations without dumping validation inputs", () => {
  assert.equal(failureReadError({ detail: "비밀번호를 다시 확인해 주세요." }), "비밀번호를 다시 확인해 주세요.");
  assert.equal(failureReadError({ detail: [{ input: "private", msg: "invalid" }] }).includes("private"), false);
});
