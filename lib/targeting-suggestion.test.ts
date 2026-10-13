import assert from "node:assert/strict";
import test from "node:test";

import {
  groundingLocation,
  groundingRoleLabel,
  MAX_TOPIC_LENGTH,
  readTopic,
  readTopicSuggestions,
  suggestionFailureMessage,
  suggestionRequestBody,
} from "./targeting-suggestion.ts";

const SUGGESTED = {
  topic: "첫구매 유도",
  status: "suggested",
  message: null,
  analysis: "가입하고  아직 사지 않은 고객이 대상이다",
  suggestions: [
    {
      prompt: "가입 후  아직 구매한 적이 없는 고객",
      rationale: "첫 구매 전 고객이다",
      grounding: [
        { role: "field", label: "첫 구매일", table: "cust_repurchase_summary", column: "first_purchase_date" },
        { role: "source", label: "구매", table: "cust_sales_fact", column: null },
        { role: "field", label: "선호 구매 요일", table: null, column: null },
      ],
    },
  ],
  rejected_count: 0,
  catalog_items: 187,
};

test("주제는 다듬어서 보내고, 주제가 아닌 입력은 보내지 않는다", () => {
  assert.equal(readTopic("  첫구매   유도 "), "첫구매 유도");
  // 글자도 숫자도 없으면 주제가 아니다.
  for (const value of ["", "   ", "!!!", null, undefined, 7, ["첫구매"]]) {
    assert.equal(readTopic(value), null, JSON.stringify(value));
  }
});

test("한도를 넘는 주제는 잘라 보내지 않고 막는다", () => {
  // 잘린 주제로 만든 문장은 사용자가 적은 주제의 문장이 아니다.
  assert.equal(readTopic("가".repeat(MAX_TOPIC_LENGTH)), "가".repeat(MAX_TOPIC_LENGTH));
  assert.equal(readTopic("가".repeat(MAX_TOPIC_LENGTH + 1)), null);
});

test("화면이 고른 해석 모델을 함께 보내고, 고르지 않았으면 칸을 싣지 않는다", () => {
  assert.deepEqual(suggestionRequestBody("첫구매 유도", " gpt-5.4 "), {
    topic: "첫구매 유도",
    structuring_model: "gpt-5.4",
  });
  // 칸이 없어야 Python 이 배포의 해석 모델을 쓴다 — 빈 이름을 실으면 그 이름이 거절된다.
  for (const value of [null, undefined, "", "   ", 7]) {
    assert.deepEqual(suggestionRequestBody("첫구매 유도", value), { topic: "첫구매 유도" });
  }
});

test("제안과 근거를 그대로 읽는다", () => {
  const read = readTopicSuggestions(SUGGESTED);
  assert.ok(read);
  assert.equal(read.status, "suggested");
  assert.equal(read.analysis, "가입하고 아직 사지 않은 고객이 대상이다");
  assert.equal(read.suggestions[0].rationale, "첫 구매 전 고객이다");
  assert.equal(read.suggestions[0].prompt, "가입 후 아직 구매한 적이 없는 고객");
  assert.deepEqual(read.suggestions[0].grounding, [
    { role: "field", label: "첫 구매일", table: "cust_repurchase_summary", column: "first_purchase_date" },
    { role: "source", label: "구매", table: "cust_sales_fact", column: null },
    { role: "field", label: "선호 구매 요일", table: null, column: null },
  ]);
});

test("제안 없음은 오류가 아니라 안내가 붙은 빈 결과다", () => {
  const read = readTopicSuggestions({
    topic: "날씨 좋은 날",
    status: "no_grounded_suggestion",
    suggestions: [],
    // 문장 없이 해석만 온 응답에서는 해석을 보여 주지 않는다.
    analysis: "날씨는 고객을 고르는 조건이 아니다",
    message: "이 주제를 현재 데이터 항목으로 표현하지 못했습니다.",
  });
  assert.ok(read);
  assert.deepEqual(read.suggestions, []);
  assert.equal(read.analysis, null);
  assert.equal(read.message, "이 주제를 현재 데이터 항목으로 표현하지 못했습니다.");
});

test("모르는 모양은 빈 결과로 읽지 않고 거절한다", () => {
  // `null` 은 「제안 없음」이 아니다 — 화면은 이것을 오류로 보여 준다.
  for (const payload of [
    null,
    "문장",
    [],
    {},
    { status: "suggested" },
    { status: "done", suggestions: [] },
    { status: "suggested", suggestions: [] },
    { status: "no_grounded_suggestion", suggestions: [{ prompt: "고객" }] },
    { status: "suggested", suggestions: [{ prompt: "   " }] },
    { status: "suggested", suggestions: [{ rationale: "문장이 없다" }] },
    { status: "suggested", suggestions: ["고객"] },
  ]) {
    assert.equal(readTopicSuggestions(payload), null, JSON.stringify(payload));
  }
});

test("읽을 수 없는 근거 항목은 버리되 문장은 남긴다", () => {
  const read = readTopicSuggestions({
    status: "suggested",
    suggestions: [
      {
        prompt: "최근 30일 내 구매한 고객",
        grounding: [
          { role: "source", label: "구매", table: "cust_sales_fact", column: "purchase_datetime" },
          { role: "source" },
          "구매",
          // 표 없이 컬럼만 온 위치는 위치가 아니다.
          { role: "field", label: "성별", column: "gender" },
        ],
      },
    ],
  });
  assert.ok(read);
  assert.deepEqual(read.suggestions[0].grounding, [
    { role: "source", label: "구매", table: "cust_sales_fact", column: "purchase_datetime" },
    { role: "field", label: "성별", table: null, column: null },
  ]);
  assert.equal(read.suggestions[0].rationale, "");
  // 해석을 싣지 않던 서버의 응답도 읽는다 — 그때는 해석 자리를 비운다.
  assert.equal(read.analysis, null);
});

test("거절은 서버가 말한 사유와 조치로 보여 준다", () => {
  const detail = {
    stage: "prompt_suggestion",
    code: "suggestion_llm_unavailable",
    path: "provider",
    reason: "문장 제안에 쓸 모델이 설정되어 있지 않습니다.",
    action: "배포 환경의 OPENAI_MODEL 을 확인해 주세요.",
  };
  assert.equal(
    suggestionFailureMessage(503, { detail }),
    "문장 제안에 쓸 모델이 설정되어 있지 않습니다. 배포 환경의 OPENAI_MODEL 을 확인해 주세요.",
  );
  assert.equal(
    suggestionFailureMessage(503, { detail: { reason: "배포 설정을 적용하는 중입니다." } }),
    "배포 설정을 적용하는 중입니다.",
  );
});

test("사유가 없는 실패는 상태 코드가 말하는 만큼만 말한다", () => {
  // 아직 재시작하지 않은 API 는 이 경로를 모른다 — 그때 문장을 고치라고 안내하면 거짓이다.
  assert.match(suggestionFailureMessage(404, { detail: "Not Found" }), /최신 버전/);
  assert.match(suggestionFailureMessage(422, { detail: [{ loc: ["body", "topic"] }] }), /80자/);
  assert.match(suggestionFailureMessage(500, null), /다시 시도/);
});

test("근거 항목은 종류와 확인된 위치만 말한다", () => {
  assert.equal(groundingRoleLabel("source"), "사건");
  assert.equal(groundingRoleLabel("metric"), "지표");
  assert.equal(groundingRoleLabel("field"), "속성");
  assert.equal(groundingRoleLabel("value_domain"), null);

  const base = { role: "field", label: "첫 구매일" };
  assert.equal(
    groundingLocation({ ...base, table: "cust_repurchase_summary", column: "first_purchase_date" }),
    "cust_repurchase_summary.first_purchase_date",
  );
  assert.equal(groundingLocation({ ...base, table: "cust_sales_fact", column: null }), "cust_sales_fact");
  // 위치를 확인하지 못했으면 이름만 보여 준다.
  assert.equal(groundingLocation({ ...base, table: null, column: null }), null);
});
