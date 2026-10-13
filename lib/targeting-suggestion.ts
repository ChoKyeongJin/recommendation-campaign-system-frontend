/**
 * 주제 한 줄 → 타겟 조건 문장 **초안** — 화면이 읽는 자리.
 *
 * 초안은 입력칸을 채울 뿐 실행되지 않는다. 사용자가 읽고 고친 뒤 「타겟 추출하기」를 눌러야
 * 정규 해석이 그 문장을 처음부터 읽는다. 그래서 이 모듈은 문장을 고치거나 보태지 않는다 —
 * Python 이 근거를 확인해 돌려준 것만 옮긴다.
 *
 * 근거 항목의 표·컬럼은 Python 이 스키마 카탈로그에서 확인한 것만 실어 보낸다. 확인되지 않은
 * 위치는 `null` 이고, 화면은 그때 이름만 보여 준다(위치를 지어내지 않는다).
 */

/** Python 요청 계약의 주제 길이 한도와 같은 값. 넘는 입력은 보내기 전에 막는다. */
export const MAX_TOPIC_LENGTH = 80;

export type SuggestionGrounding = {
  role: string;
  label: string;
  table: string | null;
  column: string | null;
};

export type TopicSuggestion = {
  prompt: string;
  rationale: string;
  grounding: SuggestionGrounding[];
};

export type TopicSuggestionResult = {
  topic: string;
  status: "suggested" | "no_grounded_suggestion";
  /**
   * 모델이 주제를 어떻게 읽었는가(대상 고객과 그 이유). 초안을 고르는 사람이 읽는 설명이고
   * 제안이 없으면 `null` 이다.
   */
  analysis: string | null;
  suggestions: TopicSuggestion[];
  /** 제안이 없을 때의 안내. 제안이 있으면 `null`. */
  message: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/**
 * 보낼 수 있는 주제면 그 주제, 아니면 `null`.
 *
 * 글자나 숫자가 하나도 없는 입력(공백·문장부호뿐)은 주제가 아니다. 한도를 넘는 입력은 잘라서
 * 보내지 않는다 — 잘린 주제로 만든 문장은 사용자가 적은 주제의 문장이 아니다.
 */
export function readTopic(value: unknown): string | null {
  const topic = text(value);
  if (!topic || topic.length > MAX_TOPIC_LENGTH) return null;
  return /[\p{L}\p{N}]/u.test(topic) ? topic : null;
}

function readGrounding(value: unknown): SuggestionGrounding | null {
  const record = asRecord(value);
  const role = text(record?.role);
  const label = text(record?.label);
  if (!record || !role || !label) return null;
  const table = text(record.table) || null;
  // 표 없이 컬럼만 온 위치는 읽을 수 없는 위치다.
  const column = table ? text(record.column) || null : null;
  return { role, label, table, column };
}

function readSuggestion(value: unknown): TopicSuggestion | null {
  const record = asRecord(value);
  const prompt = text(record?.prompt);
  if (!record || !prompt) return null;
  const grounding = Array.isArray(record.grounding)
    ? record.grounding
        .map(readGrounding)
        .filter((item): item is SuggestionGrounding => item !== null)
    : [];
  return { prompt, rationale: text(record.rationale), grounding };
}

/**
 * Python 응답을 화면이 쓰는 모양으로 읽는다. 모르는 모양이면 `null` 이다.
 *
 * `null` 은 「제안 없음」이 아니다 — 응답을 믿을 수 없다는 뜻이고 화면은 오류로 보여 준다.
 * 「제안 없음」은 Python 이 `no_grounded_suggestion` 으로 말한다.
 */
export function readTopicSuggestions(
  payload: unknown,
): TopicSuggestionResult | null {
  const record = asRecord(payload);
  if (!record || !Array.isArray(record.suggestions)) return null;
  const status = record.status;
  if (status !== "suggested" && status !== "no_grounded_suggestion") return null;
  const suggestions = record.suggestions.map(readSuggestion);
  if (suggestions.some((item) => item === null)) return null;
  const read = suggestions as TopicSuggestion[];
  // 상태와 내용이 어긋난 응답은 어느 쪽을 믿을지 정할 수 없다.
  if ((status === "suggested") !== (read.length > 0)) return null;
  return {
    topic: text(record.topic),
    status,
    // 해석은 문장에 딸린 설명이다 — 문장 없이 해석만 온 응답에서는 보여 주지 않는다.
    analysis: read.length > 0 ? text(record.analysis) || null : null,
    suggestions: read,
    message: text(record.message) || null,
  };
}

const DEFAULT_FAILURE = "문장을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.";

/**
 * 실패 응답을 사용자가 읽을 한 줄로 옮긴다.
 *
 * Python 의 거절은 `detail` 에 사유(`reason`)와 조치(`action`)를 함께 싣는다. 그 둘이 있으면
 * 그대로 쓰고, 없으면 상태 코드가 말하는 만큼만 말한다.
 */
export function suggestionFailureMessage(status: number, payload: unknown): string {
  const detail = asRecord(asRecord(payload)?.detail);
  const reason = text(detail?.reason);
  if (reason) {
    const action = text(detail?.action);
    return action ? `${reason} ${action}` : reason;
  }
  if (status === 404) {
    return "문장 생성 기능을 서버에서 찾지 못했습니다. API 서버가 최신 버전으로 실행 중인지 확인해 주세요.";
  }
  if (status === 422) {
    return `주제를 ${MAX_TOPIC_LENGTH}자 이내로 입력해 주세요.`;
  }
  return DEFAULT_FAILURE;
}

const ROLE_LABELS: Record<string, string> = {
  source: "사건",
  metric: "지표",
  field: "속성",
};

/** 근거 항목의 종류. 모르는 역할은 종류를 붙이지 않는다. */
export function groundingRoleLabel(role: string): string | null {
  return ROLE_LABELS[role] ?? null;
}

/** 근거 항목이 읽는 위치 — `표.컬럼`, 컬럼이 확인되지 않았으면 `표`, 둘 다 없으면 `null`. */
export function groundingLocation(item: SuggestionGrounding): string | null {
  if (!item.table) return null;
  return item.column ? `${item.table}.${item.column}` : item.table;
}
