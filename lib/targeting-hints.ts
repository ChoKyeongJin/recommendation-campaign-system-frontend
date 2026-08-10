import type { TargetingResult } from "@/lib/campaign-data";

/**
 * 타겟팅 실패·부분 추출 뒤 사용자가 직접 실행할 수 있는 안내.
 * 내부 슬롯명이나 설정 파일은 사용자가 해결할 수 없으므로 노출하지 않는다.
 */
export type ReinforcementHint = {
  severity: "fail" | "warn";
  symptom: string;
  /** 사용자가 입력에서 확인하거나 고칠 대상 */
  where: string;
  /** 그대로 따라 할 수 있는 다음 행동 */
  how: string;
};

const INPUT_CONDITION = "입력한 타겟 조건";

const MISSING_FIELD_QUESTIONS: Record<string, string> = {
  "audience.percentage": "상위 몇 %인지 숫자로 입력해 주세요.",
  "audience.threshold": "비교할 기준값과 이상·이하 조건을 입력해 주세요.",
  "audience.period": "조회 기간을 일·주·개월 단위로 입력해 주세요.",
  "audience.window": "조건을 계산할 기간을 입력해 주세요.",
  "audience.metric": "순위나 비교에 사용할 기준 지표를 입력해 주세요.",
  "audience.population": "순위를 계산할 비교 대상 회원군을 입력해 주세요.",
  "audience.group_by":
    "순위를 전체 기준으로 계산할지 그룹별로 계산할지 입력해 주세요.",
};

/** 내부 경로는 사용자 질문으로 번역할 수 있을 때만 살린다. */
function userFacingQuestion(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const mapped = MISSING_FIELD_QUESTIONS[trimmed.toLowerCase()];
  if (mapped) {
    return mapped;
  }

  // audience.requirement, semantic_interpretation, req-1.member_entity 같은 값은
  // 구현 좌표일 뿐 사용자가 무엇을 고쳐야 하는지 말해 주지 못한다.
  if (/^[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)*$/i.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function uniqueQuestions(values: string[]): string[] {
  return [
    ...new Set(
      values
        .map(userFacingQuestion)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

/** 실패 사유가 사용자 입력으로 해결 가능한 경우에만 안내를 만든다. */
function mapFailureReason(reason: string): ReinforcementHint | null {
  const normalized = reason.toLowerCase();

  if (normalized.includes("conflict")) {
    return {
      severity: "fail",
      symptom: "같은 조건이 포함과 제외로 동시에 지정됐습니다.",
      where: "포함·제외 조건",
      how: "한 값에는 포함 또는 제외 중 하나만 남겨 다시 실행해 주세요. 예: '여성 제외'.",
    };
  }

  if (
    normalized.includes("no_target") ||
    normalized.includes("no_condition") ||
    normalized.includes("empty_condition") ||
    normalized === "no_sql_candidates"
  ) {
    return {
      severity: "fail",
      symptom: "실행할 타겟 조건을 찾지 못했습니다.",
      where: INPUT_CONDITION,
      how: "대상·기간·기준값을 함께 적어 주세요. 예: '최근 30일 구매한 서울 거주 30대 회원'.",
    };
  }

  // SQL 가드, 스키마, 구조화기, 실행 표현 방출 실패는 사용자가 입력을 바꿔서
  // 해결된다고 보장할 수 없다. 실패 단계 카드만 남기고 거짓 해결책은 만들지 않는다.
  return null;
}

/**
 * 데이터가 없어서 막힌 실패의 안내. **입력 수정 안내를 만들지 않는다.**
 *
 * 예전에는 이 경우에도 확인 질문을 그대로 실어 "위 항목의 값을 입력 문장에 명시한 뒤 다시
 * 실행해 주세요"가 나갔다. 회원별 방문 이력이 없어서 막힌 요청에 그 조언은 무용하고, 사용자는
 * 같은 문장을 고쳐 쓰며 같은 곳에서 다시 막힌다(실측 2026-08-10). 원인 설명은
 * `failureExplanation` 카드가 소유하므로 여기서는 **다음 행동 하나만** 남긴다.
 */
function dataLimitHint(result: TargetingResult): ReinforcementHint | null {
  const explanation = result.failureExplanation;
  if (!explanation || explanation.failureType !== "data_capability_failure") {
    return null;
  }

  return {
    severity: "fail",
    symptom: explanation.summary || explanation.message,
    where: "요청한 조건이 필요로 하는 데이터",
    how: explanation.suggestedData
      ? `문장을 고쳐도 열리지 않습니다. 담당자에게 '${explanation.suggestedData}' 적재를 요청하거나, 이 조건을 빼고 다시 실행해 주세요.`
      : "문장을 고쳐도 열리지 않습니다. 담당자에게 해당 데이터 적재를 요청하거나, 이 조건을 빼고 다시 실행해 주세요.",
  };
}

/**
 * 구체적인 근거가 있는 안내만 반환한다. 빈 배열이면 카드가 렌더링되지 않는다.
 */
export function buildReinforcementHints(
  result: TargetingResult,
): ReinforcementHint[] {
  const diagnostics = result.diagnostics;
  if (!diagnostics) {
    return [];
  }

  // 데이터 한계로 닫힌 실패는 입력 보강으로 열리지 않는다 — 아래 입력 수정 갈래를 타지 않는다.
  const dataLimit = dataLimitHint(result);
  if (dataLimit) {
    return [dataLimit];
  }

  const hints: ReinforcementHint[] = [];
  const mappedFailure = diagnostics.failureReason
    ? mapFailureReason(diagnostics.failureReason)
    : null;
  let mappedFailureUsed = false;

  if (diagnostics.droppedConditionLabels.length > 0) {
    const labels = diagnostics.droppedConditionLabels.join(", ");
    hints.push({
      severity: "warn",
      symptom: `다음 조건은 결과에 반영되지 않았습니다: ${labels}`,
      where: labels,
      how: "해당 조건을 뺀 결과를 원한 것이 아니라면 현재 결과를 사용하지 말고, 조건 지원 여부를 확인한 뒤 다시 실행해 주세요.",
    });
  }

  if (diagnostics.unsupportedConditionLabels.length > 0) {
    const labels = diagnostics.unsupportedConditionLabels.join(", ");
    hints.push({
      severity: "fail",
      symptom: `현재 실행할 수 없는 조건입니다: ${labels}`,
      where: labels,
      how: "이 조건을 제외하거나 지원되는 조건으로 바꿔 주세요. 꼭 필요한 조건이면 관리자에게 해당 조건의 DB 매핑 추가를 요청해 주세요.",
    });
  }

  const questions = uniqueQuestions([
    ...diagnostics.clarificationQuestions,
    ...diagnostics.missingInputConditions,
  ]);
  if (questions.length > 0) {
    mappedFailureUsed = mappedFailure !== null;
    hints.push({
      severity: mappedFailure?.severity ?? "warn",
      symptom: questions.join(" · "),
      where: mappedFailure?.where ?? INPUT_CONDITION,
      how:
        mappedFailure?.how ??
        "위 항목의 값을 입력 문장에 명시한 뒤 다시 실행해 주세요.",
    });
  }

  const cardinality = diagnostics.cardinality;
  if (cardinality?.injectedDefaultIsCulprit) {
    hints.push({
      severity: "warn",
      symptom: "기본 '정상 회원' 조건 때문에 조회 결과가 0명입니다.",
      where: "회원 상태 조건",
      how: "휴면·탈퇴 회원도 대상이라면 포함할 상태를 입력 문장에 명시해 주세요.",
    });
  } else if (cardinality?.cause === "predicate_empty") {
    const predicates = cardinality.culpritPredicates.join(" · ");
    hints.push({
      severity: "fail",
      symptom: predicates
        ? `이 조건만 적용해도 결과가 0명입니다: ${predicates}`
        : "입력한 조건 중 하나만 적용해도 결과가 0명입니다.",
      where: predicates || INPUT_CONDITION,
      how: "기간이나 기준값을 넓혀 다시 조회해 주세요.",
    });
  } else if (cardinality?.cause === "predicate_interaction") {
    hints.push({
      severity: "warn",
      symptom: "각 조건에는 대상이 있지만 모든 조건을 동시에 만족하는 회원은 없습니다.",
      where: "AND로 결합한 조건",
      how: "조건을 하나씩 빼서 다시 조회하거나 기간·기준값을 넓혀 주세요.",
    });
  }

  const conditionHintShown =
    diagnostics.droppedConditionLabels.length > 0 ||
    diagnostics.unsupportedConditionLabels.length > 0;
  if (
    mappedFailure &&
    !mappedFailureUsed &&
    !conditionHintShown &&
    !hints.some((hint) => hint.where === mappedFailure.where)
  ) {
    hints.push(mappedFailure);
  }

  return hints;
}
