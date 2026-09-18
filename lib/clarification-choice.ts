import type {
  ClarificationPresentation,
  ClarificationQuestion,
} from "./campaign-data.ts";

/**
 * 되묻기 보기가 제출할 완성 요청 문장.
 *
 * 백엔드가 `query` 를 명시했으면 그 값을 그대로 쓴다. 명시가 없던 이전 재서술 응답은 `value`
 * 가 곧 완성 문장이었으므로 그 경우에만 되돌아간다. 슬롯 질문의 값은 문장이 아니다.
 * 라벨로 문장을 다시 조립하지 않는다 — 라벨은 사람이 읽는 요약일 뿐이다.
 */
export function clarificationOptionQuery(
  answerShape: ClarificationQuestion["answerShape"],
  option: { query?: unknown; value?: unknown },
): string {
  if (typeof option.query === "string" && option.query.trim()) {
    return option.query.trim();
  }
  if (answerShape === "restatement" && typeof option.value === "string") {
    return option.value.trim();
  }
  return "";
}

/** 알 수 없는 값은 기존 화면(`default`)으로 읽는다. */
export function clarificationPresentation(raw: unknown): ClarificationPresentation {
  return raw === "request_choice" ? "request_choice" : "default";
}

/**
 * 보기 선택형 질문에서 고른 보기가 보낼 요청. 고르지 않았거나 문장이 없는 보기면 `null` 이다
 * — 그때는 실행하지 않는다.
 */
export function requestChoiceQuery(
  question: ClarificationQuestion,
  optionId: string | undefined,
): string | null {
  if (!optionId) {
    return null;
  }
  const option = question.options.find((candidate) => candidate.id === optionId);
  const query = option?.query?.trim();
  return query ? query : null;
}
