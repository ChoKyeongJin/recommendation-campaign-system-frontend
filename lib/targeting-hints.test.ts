import assert from "node:assert/strict";
import test from "node:test";

import type { TargetingResult } from "./campaign-data.ts";
import { buildReinforcementHints } from "./targeting-hints.ts";

function resultWithDiagnostics(
  diagnostics: NonNullable<TargetingResult["diagnostics"]>,
): TargetingResult {
  return {
    total: null,
    resultRowCount: null,
    targetCampaignCount: null,
    segments: [],
    sql: "",
    diagnostics,
  };
}

function diagnostics(
  overrides: Partial<NonNullable<TargetingResult["diagnostics"]>> = {},
): NonNullable<TargetingResult["diagnostics"]> {
  return {
    unsupportedConditions: [],
    unsupportedConditionLabels: [],
    droppedConditions: [],
    droppedConditionLabels: [],
    missingInputConditions: [],
    clarificationQuestions: [],
    ...overrides,
  };
}

test("내부 audience.requirement만 있는 방출 실패는 힌트를 숨긴다", () => {
  const hints = buildReinforcementHints(
    resultWithDiagnostics(
      diagnostics({
        failureReason: "semantic_emission_failure",
        missingInputConditions: ["audience.requirement"],
      }),
    ),
  );

  assert.deepEqual(hints, []);
});

test("구체적인 확인 질문은 입력 수정 안내로 보여 준다", () => {
  const hints = buildReinforcementHints(
    resultWithDiagnostics(
      diagnostics({
        clarificationQuestions: ["로그인 횟수를 계산할 기간을 입력해 주세요."],
      }),
    ),
  );

  assert.equal(hints.length, 1);
  assert.equal(hints[0]?.where, "입력한 타겟 조건");
  assert.match(hints[0]?.symptom ?? "", /로그인 횟수/);
  assert.doesNotMatch(JSON.stringify(hints), /\.json/);
});

test("알려진 누락 필드는 사용자 질문으로 번역한다", () => {
  const hints = buildReinforcementHints(
    resultWithDiagnostics(
      diagnostics({ missingInputConditions: ["audience.percentage"] }),
    ),
  );

  assert.match(hints[0]?.symptom ?? "", /상위 몇 %/);
});

test("데이터 한계로 막힌 실패는 입력 수정 안내를 만들지 않는다", () => {
  const result = resultWithDiagnostics(
    diagnostics({
      failureReason: "unsupported_semantics",
      clarificationQuestions: [
        "요청한 조건을 현재 실행 자산으로 표현할 수 없습니다.",
      ],
    }),
  );
  result.failureExplanation = {
    failureType: "data_capability_failure",
    failureReason: "event_history_missing",
    message: "조건은 이해했지만 현재 데이터로 계산할 수 없습니다.",
    summary:
      "현재 '로그인' 데이터에는 마지막 값 하나만 있어 최근 1개월 동안의 '서로 다른 날짜 수'를 계산할 수 없습니다.",
    steps: [
      { id: "conclusion", title: "결론", detail: "조건 자체는 정상적으로 인식했습니다." },
    ],
    suggestedData: "회원별 발생 날짜 이력(하루에 한 행)",
    retryCount: 1,
    trace: [],
    developerDiagnostic: null,
  };

  const hints = buildReinforcementHints(result);

  assert.equal(hints.length, 1);
  assert.match(hints[0]?.symptom ?? "", /계산할 수 없습니다/);
  // 무용한 조언(값을 다시 입력하라)이 사라졌는지가 이 테스트의 요점이다.
  assert.doesNotMatch(hints[0]?.how ?? "", /입력 문장에 명시/);
  assert.match(hints[0]?.how ?? "", /적재를 요청/);
  assert.doesNotMatch(JSON.stringify(hints), /LAST_LOGIN_DATE|login\./);
});

test("미지원 조건은 조건명과 가능한 다음 행동만 안내한다", () => {
  const hints = buildReinforcementHints(
    resultWithDiagnostics(
      diagnostics({
        failureReason: "real_db_unsupported_conditions",
        unsupportedConditionLabels: ["최근 로그인 채널"],
      }),
    ),
  );

  assert.equal(hints.length, 1);
  assert.equal(hints[0]?.where, "최근 로그인 채널");
  assert.match(hints[0]?.how ?? "", /DB 매핑 추가/);
  assert.doesNotMatch(JSON.stringify(hints), /member_target_filters|\.json/);
});
