import type { TargetingResult } from "@/lib/campaign-data";

/**
 * 타겟팅 실패·부분추출 시 "어디를 보강하면 좋을지" 힌트.
 * 백엔드 진단 신호(diagnostics)를 사람이 손볼 수 있는 위치·행동으로 번역한다.
 */
export type ReinforcementHint = {
  /** fail=명단을 못 뽑음(치명) · warn=명단은 나왔으나 일부 미반영/주의 */
  severity: "fail" | "warn";
  /** 무슨 일이 있었나(증상) */
  symptom: string;
  /** 어디를 보강하면 되는가(파일·설정 위치) */
  where: string;
  /** 어떻게 보강하나(행동) */
  how: string;
};

// 보강 대상 파일(설정 → 참조 파일 화면에서 열람 가능). 대부분의 회원 조건은
// member_target_filters.json 이 커버리지를 넓히는 1순위 손잡이다.
const MEMBER_FILTERS = "member_target_filters.json";
const DIMENSION_CATALOG = "dimension_catalog.sample.json";
const MEMBER_VALUE_INDEX = "member_value_index.json";
const NORMALIZATION = "normalization_rules.sample.json";
const LEXICON = "targeting_lexicon.json";
const SCHEMA_CATALOG = "schema_catalog.json";
// 파일이 아니라 프롬프트 문장 자체를 손봐야 하는 실패의 "어디를".
const PROMPT_POLARITY = "프롬프트 조건 표현(포함/제외)";

/** 조건 경로/라벨로 보강할 파일을 추정한다(브랜드/지역은 값 해석 파일, 그 외 회원 조건은 매핑 파일). */
function whereForConditions(paths: string[], labels: string[]): string {
  const hay = [...paths, ...labels].join(" ").toLowerCase();
  if (/(dimension|브랜드|brand)/.test(hay)) return DIMENSION_CATALOG;
  if (/(region|지역|sido|sigungu|시도|시군구|거주)/.test(hay)) {
    return `${MEMBER_VALUE_INDEX} · ${MEMBER_FILTERS}`;
  }
  return MEMBER_FILTERS;
}

/**
 * failure_reason 코드를 보강 위치·행동으로 번역한다.
 * 되물음 힌트(3번)의 where/how 도 이 매핑을 우선 쓴다 — 되물음이 떴다는 사실보다
 * "왜 막혔는지"가 항상 더 구체적이기 때문이다.
 */
function mapFailureReason(reason: string): ReinforcementHint | null {
  const r = reason.toLowerCase();
  // 같은 값이 포함·제외 양쪽에 잡힌 의미 충돌. 사전에 낱말을 더해도 절대 풀리지 않는다.
  if (r.includes("conflict")) {
    return {
      severity: "fail",
      symptom: "조건의 포함/제외가 서로 모순되어 명단을 뽑지 못했습니다.",
      where: PROMPT_POLARITY,
      how: "같은 값을 포함과 제외로 동시에 지정하지 않도록 문장을 정리해 주세요(예: '여자만 빼줘' → '여성 제외').",
    };
  }
  if (r.includes("unsupported_condition") || r.includes("real_db_unsupported")) {
    return {
      severity: "fail",
      symptom: "요청한 조건을 실DB 타겟 추출로 옮기지 못했습니다.",
      where: MEMBER_FILTERS,
      how: "조건→회원 컬럼·코드 매핑(eq_filters/activity_filters 등)을 추가하세요.",
    };
  }
  if (r.includes("guard") || r.includes("schema")) {
    return {
      severity: "fail",
      symptom: "생성된 SQL이 안전 검증(허용 테이블·컬럼)을 통과하지 못했습니다.",
      where: SCHEMA_CATALOG,
      how: "사용한 테이블·컬럼이 스키마 카탈로그의 허용 목록에 있는지 확인·추가하세요.",
    };
  }
  if (
    r.includes("no_target") ||
    r.includes("no_condition") ||
    r.includes("empty_condition")
  ) {
    return {
      severity: "fail",
      symptom: "문장에서 타겟 조건을 찾지 못했습니다.",
      where: `${LEXICON} · ${NORMALIZATION}`,
      how: "구매/판매 신호어·동의어를 사전에 추가하거나, 프롬프트를 표준 표현으로 바꿔 주세요.",
    };
  }
  return null;
}

/**
 * 타겟팅 결과의 진단 신호를 보강 힌트 목록으로 변환한다.
 * 힌트가 없으면(모든 조건이 온전히 반영된 성공) 빈 배열을 반환한다.
 */
export function buildReinforcementHints(
  result: TargetingResult,
): ReinforcementHint[] {
  const d = result.diagnostics;
  const hints: ReinforcementHint[] = [];
  if (!d) {
    return hints;
  }
  // 실패 사유 매핑은 되물음 힌트의 where/how 로도 쓰고, 아무 힌트도 안 잡혔을 때 단독 힌트로도 쓴다.
  const mappedFailure = d.failureReason ? mapFailureReason(d.failureReason) : null;
  let mappedFailureUsed = false;

  // 1) 부분추출 — SQL 은 나왔지만 일부 조건이 실DB 미지원이라 빠짐
  if (d.droppedConditionLabels.length) {
    hints.push({
      severity: "warn",
      symptom: `일부 조건이 실DB 타겟 추출로 지원되지 않아 제외됐습니다: ${d.droppedConditionLabels.join(", ")}`,
      where: whereForConditions(d.droppedConditions, d.droppedConditionLabels),
      how: "이 조건을 실제 회원 컬럼·코드로 매핑하는 규칙을 추가하면 다음부터 반영됩니다.",
    });
  }

  // 2) 미지원 — 명단 자체를 못 뽑음
  if (d.unsupportedConditionLabels.length) {
    hints.push({
      severity: "fail",
      symptom: `조건을 실DB로 옮기지 못했습니다: ${d.unsupportedConditionLabels.join(", ")}`,
      where: whereForConditions(
        d.unsupportedConditions,
        d.unsupportedConditionLabels,
      ),
      how: "조건→컬럼 매핑을 추가하거나, 프롬프트를 지원되는 조건으로 바꿔 주세요.",
    });
  }

  // 3) 되물음/입력 부족 — 백엔드가 보낸 되물음 문구를 그대로 증상으로 쓴다.
  //    ("되물음이 필요합니다" 같은 고정 문구는 어떤 실패든 똑같이 보여서 진단값이 0이었다.)
  const questions = [
    ...d.clarificationQuestions,
    ...d.missingInputConditions,
  ]
    .map((question) => question.trim())
    .filter(Boolean);
  if (questions.length) {
    mappedFailureUsed = mappedFailure !== null;
    hints.push({
      severity: mappedFailure?.severity ?? "warn",
      symptom: questions.join(" · "),
      where: mappedFailure?.where ?? `${NORMALIZATION} · ${LEXICON}`,
      how:
        mappedFailure?.how ??
        "새 동의어·신호어를 사전에 추가하거나, 프롬프트를 표준 용어로 바꿔 주세요.",
    });
  }

  // 4) 0명 진단 — 어느 조건이 명단을 비웠나
  const c = d.cardinality;
  if (c) {
    if (c.injectedDefaultIsCulprit) {
      hints.push({
        severity: "warn",
        symptom: "기본 '정상 회원' 게이트가 명단을 비웠습니다(휴면·탈퇴 제외).",
        where: `${MEMBER_FILTERS} (active_state)`,
        how: "휴면/탈퇴 포함이 필요한 캠페인이면 상태 조건을 조정하세요.",
      });
    } else if (c.cause === "predicate_empty") {
      const which = c.culpritPredicates.length
        ? `: ${c.culpritPredicates.join(" · ")}`
        : "";
      hints.push({
        severity: "fail",
        symptom: `특정 조건이 단독으로도 0명입니다${which}.`,
        where: `${DIMENSION_CATALOG} · ${MEMBER_VALUE_INDEX}`,
        how: "값·코드 표기가 실DB와 맞는지 확인하거나, 과도한 조건을 완화하세요.",
      });
    } else if (c.cause === "predicate_interaction") {
      hints.push({
        severity: "warn",
        symptom: "개별 조건은 매칭되나 조합하면 0명입니다(상호 배타).",
        where: "프롬프트 조건 조합",
        how: "AND 로 겹친 조건 중 일부를 빼거나 범위를 넓혀 보세요.",
      });
    }
  }

  // 5) failure_reason 힌트. 이전에는 앞 규칙이 하나라도 힌트를 넣으면 통째로 건너뛰어, 가장 구체적인
  //    신호(왜 막혔는지)가 늘 묻혔다. 이제는 되물음 힌트가 흡수했거나 같은 보강 위치를 이미 안내한
  //    구체적 힌트가 있을 때만 생략한다.
  //    조건 단위 힌트(1·2)가 이미 "어떤 조건이 왜 빠졌는지"를 말한 경우, 같은 원인(조건→컬럼 매핑)의
  //    일반 힌트는 덜 구체적이므로 생략한다.
  const conditionHintsShown =
    d.droppedConditionLabels.length > 0 ||
    d.unsupportedConditionLabels.length > 0;
  const failureIsConditionMapping =
    /unsupported_condition|real_db_unsupported/.test(
      (d.failureReason ?? "").toLowerCase(),
    );
  if (
    mappedFailure &&
    !mappedFailureUsed &&
    !(conditionHintsShown && failureIsConditionMapping) &&
    !hints.some((hint) => hint.where === mappedFailure.where)
  ) {
    hints.push(mappedFailure);
  }

  return hints;
}
