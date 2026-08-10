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
